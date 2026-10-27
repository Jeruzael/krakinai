import { test, expect } from '@playwright/test';
import {
  seedDialogueCoverFixture,
  openDialogue,
  openCoverPicker,
  exactDialogue,
} from './dialogue-cover-fixture.mjs';
import { storedProof } from './storyboard-fixture.mjs';
test.use({ viewport: { width: 1440, height: 900 } });
const generated =
  'Angry, energetic and lecturing delivery. Fast-paced speech with strong, purposeful pointing gestures.';
const getDraft = (page, id) =>
  page.evaluate(async (id) => {
    const { getAllSnapshot } = await import('/src/storage/db.ts');
    return (await getAllSnapshot()).drafts.find((d) => d.id === id);
  }, id);
const cover = (page, id) =>
  page.evaluate(async (id) => {
    const { getAllSnapshot } = await import('/src/storage/db.ts');
    return (await getAllSnapshot()).collections.find((c) => c.id === id)
      .coverMediaId;
  }, id);
const search = async (page, text) =>
  page.getByRole('searchbox', { name: 'Search cover images' }).fill(text);
const chooseImage = async (page, name) =>
  page
    .getByRole('button', { name: `Use ${name} as cover`, exact: true })
    .click();

test('delivery choices persist and exact Taglish directions reach every output and Script Board without rewriting saved scenes', async ({
  page,
  context,
}, info) => {
  const ids = await seedDialogueCoverFixture(page),
    before = await storedProof(page);
  await openDialogue(page, ids);
  for (const name of ['Angry', 'Energetic', 'Lecturing'])
    await page.getByRole('checkbox', { name, exact: true }).check();
  await page
    .getByRole('combobox', { name: 'Speaking Pace', exact: true })
    .selectOption('fast');
  await page
    .getByRole('combobox', { name: 'Body Language', exact: true })
    .selectOption('strong_pointing');
  await expect(
    page.getByLabel('Exact Spoken Line (Preserved verbatim)')
  ).toHaveValue(exactDialogue);
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await getDraft(page, ids.draftId)).dialogue?.performanceDirection
    )
    .toEqual({
      version: 1,
      styles: ['angry', 'energetic', 'lecturing'],
      pace: 'fast',
      gestures: 'strong_pointing',
    });
  await page.reload();
  await page
    .locator('summary')
    .filter({ hasText: /^Dialogue/ })
    .click();
  for (const name of ['Angry', 'Energetic', 'Lecturing'])
    await expect(
      page.getByRole('checkbox', { name, exact: true })
    ).toBeChecked();
  await expect(page.getByLabel('Custom Notes')).toHaveValue(
    'Keep the last pause.\nHuwag baguhin ang linya.'
  );
  await page
    .getByRole('button', { name: 'Assemble Prompt', exact: true })
    .click();
  await expect(page).toHaveURL(/#\/output\//);
  for (const [workflow, mode] of [
    ['canonical', 'Narrative'],
    ['canonical', 'Structured'],
    ['canonical', 'Compact'],
    ['generic_structured'],
    ['gemini_omni_flash'],
    ['json'],
    ['generation_json'],
  ]) {
    await page
      .getByLabel('Target Workflow', { exact: true })
      .selectOption(workflow);
    if (mode)
      await page.getByRole('tab', { name: new RegExp(`^${mode}`) }).click();
    const raw = page.getByRole('button', { name: 'Raw', exact: true });
    if (await raw.isVisible()) await raw.click();
    const text = await page
      .getByRole('region', { name: 'Complete prompt text' })
      .textContent();
    expect(text.split(generated)).toHaveLength(2);
    if (workflow === 'json' || workflow === 'generation_json')
      expect(JSON.parse(text).dialogue.exactLine).toBe(exactDialogue);
    else expect(text).toContain(exactDialogue);
  }
  await page
    .getByLabel('Target Workflow', { exact: true })
    .selectOption('canonical');
  await page.getByRole('tab', { name: 'Narrative', exact: true }).click();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy Prompt', exact: true }).click();
  const rawText = await page
    .getByRole('region', { name: 'Complete prompt text' })
    .textContent();
  expect(
    (await page.evaluate(() => navigator.clipboard.readText())).replace(
      /\r\n/g,
      '\n'
    )
  ).toBe(rawText.replace(/\r\n/g, '\n'));
  await page.getByRole('button', { name: 'Save Scene', exact: true }).click();
  await expect(page).toHaveURL(/#\/output\/scene_/);
  const savedId = page.url().split('#/output/')[1].split('?')[0];
  await page.evaluate(
    async ({ ids, savedId }) => {
      const p = await import('/src/storage/projects.ts');
      await p.addProjectTake({
        collectionId: ids.collectionId,
        shotId: ids.shotId,
        sceneId: savedId,
      });
      await p.selectProjectTake({
        collectionId: ids.collectionId,
        shotId: ids.shotId,
        sceneId: savedId,
      });
    },
    { ids, savedId }
  );
  await page.reload();
  await page.goto(`/#/collections/${ids.collectionId}?tab=characters`);
  await expect(
    page
      .getByRole('region', { name: 'Project Script' })
      .getByLabel('Script document')
  ).toHaveValue(new RegExp(generated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const after = await storedProof(page);
  expect(after.assets).toEqual(before.assets);
  expect(after.media).toEqual(before.media);
  for (const scene of before.scenes)
    expect(after.scenes.find((s) => s.id === scene.id)).toEqual(scene);
  await info.attach('delivery-output-preservation', {
    body: JSON.stringify({
      formats: 7,
      exactLine: exactDialogue,
      existingScenesUnchanged: true,
      assetsAndMediaUnchanged: true,
      selectedPresets: (await getDraft(page, ids.draftId)).dialogue
        .performanceDirection,
    }),
    contentType: 'application/json',
  });
});

test('custom-only, presets-only and clear performance keep spoken text exact and impose no default style', async ({
  page,
}) => {
  const ids = await seedDialogueCoverFixture(page);
  await openDialogue(page, ids);
  for (const input of await page
    .locator('.performance-direction input[type=checkbox]')
    .all())
    await expect(input).not.toBeChecked();
  await page
    .getByLabel('Custom Notes')
    .fill('Angry? No—gentle custom words only.');
  await expect(
    page.getByRole('checkbox', { name: 'Angry', exact: true })
  ).not.toBeChecked();
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect
    .poll(
      async () => (await getDraft(page, ids.draftId)).dialogue.deliveryNotes
    )
    .toBe('Angry? No—gentle custom words only.');
  await page.getByLabel('Custom Notes').fill('');
  await page.getByRole('checkbox', { name: 'Calm', exact: true }).check();
  await page.locator('.performance-preview > summary').click();
  await expect(page.getByTestId('delivery-preview')).toHaveText(
    'Calm delivery.'
  );
  await page.getByRole('checkbox', { name: 'Calm', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Happy', exact: true }).check();
  await page
    .getByRole('button', { name: 'Clear performance direction' })
    .click();
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect
    .poll(async () => (await getDraft(page, ids.draftId)).dialogue)
    .toEqual({ speaker: 'Ari', line: exactDialogue });
  const omitted = await page.evaluate(async (id) => {
    const db = await import('/src/storage/db.ts'),
      { assembleScenePrompt } = await import('/src/domain/promptAssembler.ts');
    const d = (await db.getAllSnapshot()).drafts.find((d) => d.id === id);
    return Object.values(assembleScenePrompt(d).outputs).every(
      (s) => !s.includes('Delivery Notes:')
    );
  }, ids.draftId);
  expect(omitted).toBe(true);
});

test('cover search, relationship filtering, staged Use and both cancellation paths preserve originals', async ({
  page,
}) => {
  const ids = await seedDialogueCoverFixture(page),
    before = await storedProof(page);
  await openCoverPicker(page, ids);
  const picker = page.getByRole('dialog', { name: 'Choose Collection Cover' });
  await expect(
    picker.getByRole('tab', { name: /Project Media/ })
  ).toHaveAttribute('aria-selected', 'true');
  await expect(
    picker.getByRole('button', { name: 'Use Project result.png as cover' })
  ).toBeVisible();
  await expect(
    picker.getByRole('button', { name: 'Use Unrelated image.png as cover' })
  ).toHaveCount(0);
  await expect(
    picker.getByRole('button', {
      name: 'Use Other collection cover.png as cover',
    })
  ).toHaveCount(0);
  await picker.getByRole('tab', { name: /All Images/ }).click();
  await search(page, '景色');
  const unicode = picker.getByRole('button', {
    name: `Use ${ids.unicodeFilename} as cover`,
    exact: true,
  });
  await expect(unicode).toHaveAccessibleDescription(
    `Original filename: ${ids.unicodeFilename}`
  );
  await search(page, 'Unrelated image');
  await chooseImage(page, 'Unrelated image.png');
  await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Choose Cover', exact: true })
  ).toBeFocused();
  expect(await cover(page, ids.collectionId)).toBe(ids.coverId);
  await page.getByRole('button', { name: 'Choose Cover', exact: true }).click();
  await page.getByRole('tab', { name: /All Images/ }).click();
  await search(page, 'Unrelated image');
  await chooseImage(page, 'Unrelated image.png');
  await page.getByRole('button', { name: 'Use Cover', exact: true }).click();
  expect(await cover(page, ids.collectionId)).toBe(ids.coverId);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await cover(page, ids.collectionId)).toBe(ids.coverId);
  await openCoverPicker(page, ids);
  await page.getByRole('tab', { name: /All Images/ }).click();
  await search(page, 'Unrelated image');
  await chooseImage(page, 'Unrelated image.png');
  await page.getByRole('button', { name: 'Use Cover', exact: true }).click();
  await page.getByRole('button', { name: 'Save Project', exact: true }).click();
  await expect.poll(() => cover(page, ids.collectionId)).toBe(ids.unrelatedId);
  await page.reload();
  expect(await cover(page, ids.collectionId)).toBe(ids.unrelatedId);
  const after = await storedProof(page);
  for (const key of Object.keys(before).filter((key) => key !== 'collections'))
    expect(after[key]).toEqual(before[key]);
});

test('bounded gallery, Covers grouping and native upload/cancel retain bytes and existing associations', async ({
  page,
}, info) => {
  const ids = await seedDialogueCoverFixture(page),
    before = await storedProof(page);
  await openCoverPicker(page, ids);
  await page.getByRole('tab', { name: /All Images/ }).click();
  const gallery = page.getByRole('list', { name: 'Cover images' });
  await expect(gallery.getByRole('button')).toHaveCount(24);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(gallery.getByRole('button')).toHaveCount(24);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(gallery.getByRole('button')).toHaveCount(15);
  await page.getByRole('tab', { name: /Covers/ }).click();
  await expect(
    page.getByRole('button', {
      name: 'Use Other collection cover.png as cover',
    })
  ).toBeVisible();
  const encoded = await page.evaluate(async (id) => {
    const { getAllSnapshot } = await import('/src/storage/db.ts');
    return btoa(
      String.fromCharCode(
        ...new Uint8Array(
          await (await getAllSnapshot()).media
            .find((m) => m.id === id)
            .blob.arrayBuffer()
        )
      )
    );
  }, ids.coverId);
  await page
    .getByLabel('Upload new cover image')
    .setInputFiles({
      name: '新しい-cover.png',
      mimeType: 'image/png',
      buffer: Buffer.from(encoded, 'base64'),
    });
  const uploaded = page.getByRole('button', {
    name: 'Use 新しい-cover.png as cover',
  });
  await expect(uploaded).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: 'Use Cover', exact: true })
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const after = await storedProof(page),
    added = after.media.filter(
      (item) => !before.media.some((old) => old.id === item.id)
    );
  expect(added).toHaveLength(1);
  expect(added[0].sha256).toBe(
    before.media.find((m) => m.id === ids.coverId).sha256
  );
  expect(added[0].filename).toBe('新しい-cover.png');
  expect(after.collections).toEqual(before.collections);
  expect(after.scenes).toEqual(before.scenes);
  expect(after.assets).toEqual(before.assets);
  expect(
    after.media.filter((item) => before.media.some((old) => old.id === item.id))
  ).toEqual(before.media);
  await info.attach('cover-upload-preservation', {
    body: JSON.stringify({
      newImage: added[0],
      existingMediaUnchanged: true,
      collectionsAndScenesUnchanged: true,
    }),
    contentType: 'application/json',
  });
});

test('overview cover editor supplies project context and missing covers stay explicit on Escape', async ({
  page,
}) => {
  const ids = await seedDialogueCoverFixture(page);
  await page.goto('/#/collections');
  const card = page
    .locator('.prompt-card')
    .filter({
      has: page.getByRole('heading', {
        name: 'Synthetic production',
        exact: true,
      }),
    });
  await card.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByRole('button', { name: 'Change Cover', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Use Project result.png as cover' })
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Edit Collection' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.evaluate(async (id) => {
    const { openDatabase } = await import('/src/storage/db.ts');
    const db = await openDatabase(),
      tx = db.transaction('collections', 'readwrite'),
      store = tx.objectStore('collections'),
      req = store.get(id);
    req.onsuccess = () =>
      store.put({
        ...req.result,
        coverMediaId: 'missing-cover-' + 'long-id-'.repeat(15),
      });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }, ids.collectionId);
  await page.reload();
  await openCoverPicker(page, ids);
  await expect(page.getByRole('status')).toContainText(
    'Current cover is missing'
  );
  await expect(
    page.getByRole('button', { name: 'Use Cover', exact: true })
  ).toBeDisabled();
  const before = await storedProof(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await storedProof(page)).toEqual(before);
});
