import { test, expect } from '@playwright/test';
import {
  seedDialogueCoverFixture,
  openDialogue,
  exactDialogue,
} from './dialogue-cover-fixture.mjs';
import { storedProof } from './storyboard-fixture.mjs';
const generated =
  'Emotion: angry mixed with sad; strong intensity. Delivery technique: lecturing. Vocal tone: stern. Relative pitch: mid. Speaking pace: fast. Intonation: emphatic. Body language: strong, purposeful pointing gestures.';
const direction = {
  version: 2,
  emotion: { primary: 'angry', secondary: 'sad', intensity: 'strong' },
  techniques: ['lecturing'],
  voice: { tone: 'stern', pitch: 'mid' },
  speech: { pace: 'fast', intonation: 'emphatic' },
  gestures: ['strong_pointing'],
};
const group = (page, name) =>
  page.getByRole('button', { name: new RegExp(`^${name}`) });
const choose = (page, name, value) =>
  page.getByRole('combobox', { name, exact: true }).selectOption(value);
const getDraft = (page, id) =>
  page.evaluate(async (id) => {
    const db = await import('/src/storage/db.ts');
    return (await db.getAllSnapshot()).drafts.find((d) => d.id === id);
  }, id);
test('version 2 acting persists through all outputs, Script Board, Edit a Copy and backup without rewriting any existing data', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const ids = await seedDialogueCoverFixture(page),
    before = await storedProof(page);
  await openDialogue(page, ids);
  await expect(group(page, 'Emotions')).toHaveAttribute(
    'aria-expanded',
    'false'
  );
  await group(page, 'Emotions').click();
  await choose(page, 'Primary emotion', 'angry');
  await choose(page, 'Secondary emotion', 'sad');
  await choose(page, 'Emotional intensity', 'strong');
  await group(page, 'Delivery Technique').click();
  await page
    .getByRole('searchbox', { name: 'Search delivery techniques' })
    .fill('lectur');
  await page.getByRole('checkbox', { name: 'Lecturing', exact: true }).check();
  await group(page, 'Voice Characteristics').click();
  await choose(page, 'Vocal tone', 'stern');
  await choose(page, 'Relative pitch', 'mid');
  await group(page, 'Speech & Intonation').click();
  await choose(page, 'Speaking pace', 'fast');
  await choose(page, 'Intonation', 'emphatic');
  await group(page, 'Body Language').click();
  await page
    .getByRole('checkbox', { name: 'Strong pointing gestures' })
    .check();
  await expect(
    page.getByLabel('Exact Spoken Line (Preserved verbatim)')
  ).toHaveValue(exactDialogue);
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await getDraft(page, ids.draftId)).dialogue.performanceDirection
    )
    .toEqual(direction);
  await page.reload();
  await page
    .locator('summary')
    .filter({ hasText: /^Dialogue/ })
    .click();
  await expect(group(page, 'Emotions')).toContainText('Primary emotion: Angry');
  await expect(group(page, 'Emotions')).toContainText('Secondary emotion: Sad');
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
    if (['json', 'generation_json'].includes(workflow))
      expect(JSON.parse(text).dialogue.exactLine).toBe(exactDialogue);
    else expect(text).toContain(exactDialogue);
    if (workflow === 'json')
      expect(JSON.parse(text).dialogue.performanceDirection).toEqual(direction);
  }
  await page.getByRole('button', { name: 'Save Scene', exact: true }).click();
  await expect(page).toHaveURL(/#\/output\/scene_/);
  const sceneId = page.url().split('#/output/')[1].split('?')[0];
  const preservation = await page.evaluate(
    async ({ ids, sceneId }) => {
      const db = await import('/src/storage/db.ts'),
        projects = await import('/src/storage/projects.ts');
      const scene = (await db.getAllSnapshot()).scenes.find(
          (s) => s.id === sceneId
        ),
        frozen = JSON.stringify(scene);
      const copy = await db.createDraftFromSavedScene(sceneId);
      const exactCopy =
        JSON.stringify(copy.dialogue) === JSON.stringify(scene.dialogue);
      await db.saveSceneDraft({
        ...copy,
        dialogue: {
          ...copy.dialogue,
          performanceDirection: { version: 2, voice: { tone: 'warm' } },
        },
      });
      const immutable =
        JSON.stringify(
          (await db.getAllSnapshot()).scenes.find((s) => s.id === sceneId)
        ) === frozen;
      await projects.addProjectTake({
        collectionId: ids.collectionId,
        shotId: ids.shotId,
        sceneId,
      });
      await projects.selectProjectTake({
        collectionId: ids.collectionId,
        shotId: ids.shotId,
        sceneId,
      });
      const backup = await import('/src/storage/backup.ts'),
        before = await db.getAllSnapshot(),
        zip = await backup.exportFullBackupZip();
      const valid = (await backup.validateBackupZip(zip)).valid;
      await backup.restoreFullBackupZip(zip);
      const after = await db.getAllSnapshot();
      return {
        exactCopy,
        immutable,
        valid,
        metadataPreserved:
          JSON.stringify(before.scenes) === JSON.stringify(after.scenes) &&
          JSON.stringify(before.drafts) === JSON.stringify(after.drafts),
      };
    },
    { ids, sceneId }
  );
  expect(preservation).toEqual({
    exactCopy: true,
    immutable: true,
    valid: true,
    metadataPreserved: true,
  });
  await page.reload();
  await page.goto(`/#/collections/${ids.collectionId}?tab=characters`);
  await expect(
    page
      .getByRole('region', { name: 'Project Script' })
      .getByLabel('Script document')
  ).toHaveValue(new RegExp(generated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const after = await storedProof(page);
  for (const key of ['assets', 'variants', 'media'])
    expect(after[key]).toEqual(before[key]);
  for (const scene of before.scenes)
    expect(after.scenes.find((s) => s.id === scene.id)).toEqual(scene);
  await info.attach('performance-studio-preservation', {
    body: JSON.stringify({
      ...preservation,
      oldScenesUnchanged: true,
      assetsVariantsMediaUnchanged: true,
    }),
    contentType: 'application/json',
  });
});

test('keyboard search, conflict explanation, per-field removal and Clear All work with reduced motion and no inferred defaults', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ids = await seedDialogueCoverFixture(page);
  await openDialogue(page, ids);
  const search = page.getByRole('searchbox', { name: 'Search All Directions' });
  await search.fill('stern');
  const voice = group(page, 'Voice Characteristics');
  await voice.focus();
  await page.keyboard.press('Enter');
  await choose(page, 'Vocal tone', 'stern');
  await search.fill('');
  await group(page, 'Delivery Technique').focus();
  await page.keyboard.press('Space');
  await page.getByRole('checkbox', { name: 'Whispered', exact: true }).check();
  await expect(
    page.getByRole('checkbox', { name: /^Screamed/ })
  ).toBeDisabled();
  await expect(
    page.getByRole('checkbox', { name: /^Screamed/ })
  ).toHaveAccessibleDescription(/Remove Whispered first/);
  await page
    .getByRole('button', { name: 'Remove Whispered', exact: true })
    .click();
  await expect(
    page.getByRole('checkbox', { name: 'Screamed', exact: true })
  ).toBeEnabled();
  await group(page, 'Custom Instructions').click();
  await page
    .getByRole('textbox', { name: 'Custom Notes', exact: true })
    .fill('  Angry? Whispered? Keep this prose exactly. 😊  ');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await getDraft(page, ids.draftId)).dialogue.performanceDirection
    )
    .toEqual({ version: 2, voice: { tone: 'stern' } });
  await page.getByRole('button', { name: 'Remove Vocal tone: Stern' }).click();
  await page
    .getByRole('button', { name: 'Clear All performance direction' })
    .click();
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect
    .poll(async () => (await getDraft(page, ids.draftId)).dialogue)
    .toEqual({ speaker: 'Ari', line: exactDialogue });
});

test('legacy selection bytes survive reload and UI search requires explicit replacement before new directions', async ({
  page,
}) => {
  const ids = await seedDialogueCoverFixture(page);
  const original = {
    version: 1,
    styles: ['urgent', 'apologetic', 'energetic'],
    pace: 'slow',
    gestures: 'subtle',
  };
  await page.evaluate(
    async ({ ids, original }) => {
      const db = await import('/src/storage/db.ts');
      const draft = (await db.getAllSnapshot()).drafts.find(
        (d) => d.id === ids.draftId
      );
      await db.saveSceneDraft({
        ...draft,
        dialogue: { ...draft.dialogue, performanceDirection: original },
      });
    },
    { ids, original }
  );
  await page.reload();
  await openDialogue(page, ids);
  await expect(page.getByText(/Legacy directions/)).toBeVisible();
  await page.locator('.performance-preview > summary').click();
  await expect(page.getByTestId('delivery-preview')).toContainText(
    'Apologetic, energetic and urgent delivery. Slow-paced speech with subtle gestures.'
  );
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  expect(
    (await getDraft(page, ids.draftId)).dialogue.performanceDirection
  ).toEqual(original);
  await page.getByRole('checkbox', { name: 'Urgent', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await getDraft(page, ids.draftId)).dialogue.performanceDirection
    )
    .toEqual({ ...original, styles: ['apologetic', 'energetic'] });
  await page
    .getByRole('button', {
      name: 'Replace legacy directions with Performance Studio',
    })
    .click();
  await expect(group(page, 'Emotions')).toHaveAttribute(
    'aria-expanded',
    'false'
  );
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect
    .poll(async () => (await getDraft(page, ids.draftId)).dialogue)
    .toEqual({
      speaker: 'Ari',
      line: exactDialogue,
      deliveryNotes: 'Keep the last pause.\nHuwag baguhin ang linya.',
    });
});
