import { test, expect } from '@playwright/test';
import { seedPolishFixture } from './uiux-fixture.mjs';
test.use({ viewport: { width: 1440, height: 900 } });
for (const [width, height] of [
  [1440, 900],
  [768, 1024],
  [390, 844],
])
  test(`long take names and IDs stay inside the dialog at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const ids = await seedPolishFixture(page);
    const long = await page.evaluate(async (ids) => {
      const db = await import('/src/storage/db.ts'),
        projects = await import('/src/storage/projects.ts'),
        snapshot = await db.getAllSnapshot();
      const original = snapshot.scenes[0],
        id = 'scene_' + 'longidentifier'.repeat(8),
        title = 'SyntheticUnbrokenTakeTitle'.repeat(4).slice(0, 100),
        handle = await db.openDatabase(),
        tx = handle.transaction('scenes', 'readwrite');
      tx.objectStore('scenes').add({ ...original, id, title });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () => reject(tx.error);
      });
      await projects.addProjectTake({
        collectionId: ids.collectionId,
        shotId: ids.shotId,
        sceneId: id,
      });
      return { id, title };
    }, ids);
    await page.reload();
    await page.goto(`/#/collections/${ids.collectionId}?tab=storyboard`);
    await page
      .getByRole('button', { name: /Manage takes/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: /Takes for/ }),
      card = dialog.locator('.project-take-card').last();
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByRole('heading', { name: long.title })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true);
    const overflowProof = await dialog
      .locator('.modal-body')
      .evaluate((el) => ({
        fits: el.scrollWidth <= el.clientWidth + 1,
        offenders: [...el.querySelectorAll('*')]
          .filter((child) => child.scrollWidth > child.clientWidth + 1)
          .map((child) => ({
            tag: child.tagName,
            className: child.className,
            width: child.clientWidth,
            scroll: child.scrollWidth,
            text: child.textContent.slice(0, 60),
          })),
      }));
    expect(overflowProof.fits, JSON.stringify(overflowProof.offenders)).toBe(
      true
    );
    const visual = await card.locator('.project-take-image').boundingBox(),
      details = await card.locator('.project-take-details').boundingBox(),
      note = await card.getByRole('textbox').boundingBox();
    expect(
      visual.x + visual.width <= details.x + 1 ||
        visual.y + visual.height <= details.y + 1
    ).toBe(true);
    expect(note.width).toBeGreaterThan(details.width * 0.9);
  });

async function dropFiles(page, files, selector = '.media-drop-zone') {
  await page.locator(selector).evaluate((element, files) => {
    const transfer = new DataTransfer();
    for (const file of files)
      transfer.items.add(
        new File(
          [
            'base64' in file
              ? Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))
              : file.bytes,
          ],
          file.name,
          { type: file.type, lastModified: 1793000000000 }
        )
      );
    element.dispatchEvent(
      new DragEvent('drop', {
        dataTransfer: transfer,
        bubbles: true,
        cancelable: true,
      })
    );
  }, files);
  await expect(
    page.getByRole('button', { name: /Choose Image or Video Files/ })
  ).toBeEnabled();
}
async function png(page, name, color) {
  return page.evaluate(
    ({ name, color }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 48, 48);
      return {
        name,
        type: 'image/png',
        base64: canvas.toDataURL('image/png').split(',')[1],
      };
    },
    { name, color }
  );
}
const snapshot = (page) =>
  page.evaluate(async () => {
    const s = await (await import('/src/storage/db.ts')).getAllSnapshot();
    return {
      ...s,
      media: s.media.map((m) => ({
        ...m,
        blob: undefined,
        posterBlob: undefined,
      })),
    };
  });

test('drops decodable JPG, PNG, WebP, MP4 and WebM through the existing media pipeline', async ({
  page,
}) => {
  test.setTimeout(60000);
  const ids = await seedPolishFixture(page);
  await page.goto(`/#/prompts/${ids.characterId}/edit`);
  const supported = await page.evaluate(() =>
    ['video/mp4', 'video/webm'].every((type) =>
      MediaRecorder.isTypeSupported(type)
    )
  );
  test.skip(
    !supported,
    'This Chromium cannot encode both playable synthetic video fixtures; MIME delivery is covered separately.'
  );
  const files = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d'),
      files = [];
    const encoded = async (blob, name, type) => ({
      name,
      type,
      base64: btoa(
        String.fromCharCode(...new Uint8Array(await blob.arrayBuffer()))
      ),
    });
    for (const [type, ext, color] of [
      ['image/jpeg', 'jpg', '#b83f50'],
      ['image/png', 'png', '#348063'],
      ['image/webp', 'webp', '#3e69c4'],
    ]) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 64, 64);
      files.push(
        await encoded(
          await new Promise((resolve) => canvas.toBlob(resolve, type)),
          `synthetic.${ext}`,
          type
        )
      );
    }
    for (const [type, ext] of [
      ['video/mp4', 'mp4'],
      ['video/webm', 'webm'],
    ]) {
      const stream = canvas.captureStream(0),
        recorder = new MediaRecorder(stream, { mimeType: type }),
        chunks = [];
      const stopped = new Promise((resolve, reject) => {
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        recorder.onstop = resolve;
        recorder.onerror = () =>
          reject(Error('Synthetic video encoding failed'));
      });
      recorder.start();
      // A static offscreen canvas emits no frames automatically in headless
      // Chromium. Feed real frames so the fixtures contain encoded video.
      for (let frame = 0; frame < 10; frame++) {
        ctx.fillStyle = `hsl(${frame * 30},65%,50%)`;
        ctx.fillRect(0, 0, 64, 64);
        stream.getVideoTracks()[0].requestFrame();
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      recorder.stop();
      await stopped;
      stream.getTracks().forEach((track) => track.stop());
      files.push(
        await encoded(new Blob(chunks, { type }), `synthetic.${ext}`, type)
      );
    }
    return files;
  });
  const videoFixtureProof = await page.evaluate(async (files) => {
    const results = [];
    for (const file of files.filter((f) => f.type.startsWith('video/'))) {
      const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0)),
        url = URL.createObjectURL(new Blob([bytes], { type: file.type })),
        video = document.createElement('video');
      const result = await new Promise((resolve) => {
        const timer = setTimeout(
          () =>
            resolve({
              name: file.name,
              bytes: bytes.length,
              error: 'metadata timeout',
            }),
          5000
        );
        video.onloadedmetadata = () => {
          clearTimeout(timer);
          resolve({
            name: file.name,
            bytes: bytes.length,
            width: video.videoWidth,
            height: video.videoHeight,
          });
        };
        video.onerror = () => {
          clearTimeout(timer);
          resolve({
            name: file.name,
            bytes: bytes.length,
            errorCode: video.error?.code,
            message: video.error?.message,
          });
        };
        video.src = url;
        video.load();
      });
      URL.revokeObjectURL(url);
      results.push(result);
    }
    return results;
  }, files);
  console.log(
    'Synthetic video fixture readback',
    JSON.stringify(videoFixtureProof)
  );
  for (const proof of videoFixtureProof)
    expect(
      proof.width,
      'Video must decode before the application sees it'
    ).toBe(64);
  await dropFiles(page, files);
  await expect(
    page.getByRole('article', { name: /Attached media/ })
  ).toHaveCount(6);
  await expect(page.locator('.editor-media-card video')).toHaveCount(2);
  for (const video of await page.locator('.editor-media-card video').all()) {
    await expect
      .poll(() => video.evaluate((v) => v.readyState))
      .toBeGreaterThanOrEqual(1);
    expect(await video.evaluate((v) => v.videoWidth)).toBe(64);
  }
  for (const img of await page.locator('.editor-media-card img').all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((i) => i.naturalWidth))
      .toBeGreaterThan(0);
  }
  expect((await snapshot(page)).media.map((m) => m.mimeType).sort()).toEqual(
    [
      'image/jpeg',
      'image/png',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/webm',
    ].sort()
  );
});

test('editor drop validates per file, skips repeated bytes, preserves cover and persists dragged order', async ({
  page,
}) => {
  const ids = await seedPolishFixture(page);
  const before = await snapshot(page);
  await page.goto(`/#/prompts/${ids.characterId}/edit`);
  const first = await png(page, 'first.png', '#d23b54'),
    second = await png(page, 'second.png', '#286bd4');
  await dropFiles(page, [
    first,
    second,
    { name: 'rejected.txt', type: 'text/plain', bytes: 'not media' },
  ]);
  await expect(page.getByRole('alert')).toContainText('rejected.txt');
  await expect(
    page.getByRole('article', { name: /Attached media/ })
  ).toHaveCount(3);
  await dropFiles(page, [{ ...first, name: 'renamed.png' }]);
  await expect(page.getByRole('alert')).toContainText('already attached');
  expect((await snapshot(page)).media.length).toBe(before.media.length + 2);
  await page
    .getByRole('article', { name: 'Attached media 1', exact: true })
    .evaluate((el) =>
      scrollTo(0, el.getBoundingClientRect().top + scrollY - 40)
    );
  await page
    .getByRole('button', { name: 'Drag sample 2 to reorder' })
    .dragTo(
      page.getByRole('article', { name: 'Attached media 1', exact: true }),
      { targetPosition: { x: 20, y: 20 } }
    );
  await page
    .getByRole('button', { name: 'Save Prompt', exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`#/prompts/${ids.characterId}$`));
  await page.reload();
  const after = await snapshot(page),
    asset = after.assets.find((a) => a.id === ids.characterId),
    original = before.assets.find((a) => a.id === ids.characterId);
  expect(asset.mediaLinks.map((link) => link.filename)).toEqual([
    'first.png',
    original.mediaLinks[0].filename,
    'second.png',
  ]);
  expect(asset.mediaLinks.map((link) => link.order)).toEqual([0, 1, 2]);
  expect(asset.coverMediaId).toBe(original.coverMediaId);
  expect(asset.promptText).toBe(original.promptText);
  expect(asset.identityAnchor).toEqual(original.identityAnchor);
  expect(after.scenes).toEqual(before.scenes);
  expect(after.drafts).toEqual(before.drafts);
});

test('variant file input shares the pipeline, maximum handling and keyboard ordering', async ({
  page,
}) => {
  const ids = await seedPolishFixture(page);
  await page.goto(`/#/variants/${ids.variantId}/edit`);
  const files = [];
  for (let i = 0; i < 7; i++) {
    const file = await png(
      page,
      `synthetic-${i}.png`,
      `rgb(${20 + i * 30},80,150)`
    );
    files.push({
      name: file.name,
      mimeType: file.type,
      buffer: Buffer.from(file.base64, 'base64'),
    });
  }
  await page
    .getByLabel('Choose Image or Video Files', { exact: true })
    .setInputFiles(files);
  await expect(
    page.getByRole('button', { name: /Choose Image or Video Files/ })
  ).toBeEnabled();
  await expect(
    page.getByRole('article', { name: /Attached media/ })
  ).toHaveCount(6);
  await expect(page.getByRole('alert')).toContainText('synthetic-5.png');
  await page
    .getByRole('button', { name: 'Move sample 2 up', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await page
    .getByRole('button', { name: 'Save Variant', exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(
    new RegExp(`#/characters/${ids.characterId}/variants`)
  );
  await page.reload();
  const data = await snapshot(page),
    variant = data.variants.find((v) => v.id === ids.variantId);
  expect(variant.mediaLinks[0].filename).toBe('synthetic-0.png');
  expect(variant.mediaLinks).toHaveLength(6);
  expect(variant.coverMediaId).toBe(ids.mediaId);
});

test('library tags expand, search, select several and clear while preserving search, sorting and stored tags', async ({
  page,
}) => {
  await seedPolishFixture(page);
  const before = await snapshot(page);
  await page.goto('/#/library');
  const tags = page.getByRole('group', { name: 'Tag filters' });
  await expect(tags.locator('button[aria-pressed]')).toHaveCount(8);
  expect(await tags.getByRole('button').first().textContent()).toContain(
    'cinematic'
  );
  const trigger = tags.getByRole('button', { name: /more tags/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Filter by tags' });
  await dialog.getByRole('searchbox', { name: 'Search tags' }).fill('tag-14');
  await expect(dialog.getByRole('checkbox')).toHaveCount(1);
  await dialog.getByRole('checkbox').check();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(
    tags.getByRole('button', { name: /tag-14/, pressed: true })
  ).toBeVisible();
  await tags.getByRole('button', { name: /portrait/i }).click();
  await expect(page.getByRole('main').locator('.prompt-card')).toHaveCount(2);
  await page.getByLabel('Search prompts', { exact: true }).fill('Ari');
  await page.getByLabel('Sort order', { exact: true }).selectOption('az');
  await expect(page.getByRole('main').locator('.prompt-card')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Clear Filters', exact: true })
    .click();
  await expect(page.getByLabel('Search prompts', { exact: true })).toHaveValue(
    ''
  );
  await expect(page.getByLabel('Sort order', { exact: true })).toHaveValue(
    'az'
  );
  const after = await snapshot(page);
  expect(after.assets).toEqual(before.assets);
});

test('reference dialog preserves explicit order, exact downloads and historical read-only controls', async ({
  page,
}) => {
  const ids = await seedPolishFixture(page);
  await page.goto(`/#/output/${ids.draftId}`);
  await page.getByRole('tab', { name: 'References', exact: true }).click();
  const trigger = page.getByRole('button', {
    name: 'Manage Reference Pack',
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Reference Pack Manager' });
  await expect(dialog).toBeVisible();
  const checks = dialog.getByRole('checkbox');
  await checks.nth(0).check();
  await checks.nth(1).check();
  await dialog
    .getByRole('button', { name: /Move down/ })
    .first()
    .click();
  const order = await dialog.getByRole('checkbox').allTextContents();
  const downloadPromise = page.waitForEvent('download');
  await dialog
    .getByRole('button', { name: /Download original/ })
    .first()
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('synthetic-reference-');
  await dialog
    .getByRole('button', { name: 'Apply Reference Pack', exact: true })
    .click();
  const applied = (await snapshot(page)).drafts.find(
    (d) => d.id === ids.draftId
  ).referencePack;
  expect(applied.entries.map((e) => e.sourceSlot)).toEqual([
    'environment',
    'character',
  ]);
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.goto(`/#/output/${ids.sceneId}`);
  await page.getByRole('tab', { name: 'References', exact: true }).click();
  await page
    .getByRole('button', { name: 'Manage Reference Pack', exact: true })
    .click();
  for (const checkbox of await page
    .getByRole('dialog')
    .getByRole('checkbox')
    .all())
    await expect(checkbox).toBeDisabled();
  expect(order).toHaveLength(3);
});

test('take preference, project note, comparison and removal keep immutable source scenes', async ({
  page,
}) => {
  const ids = await seedPolishFixture(page),
    before = await snapshot(page);
  await page.goto(`/#/collections/${ids.collectionId}?tab=storyboard`);
  await page
    .getByRole('button', { name: /Manage takes/i })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: /Takes for/ });
  await dialog.getByRole('button', { name: /as preferred/ }).click();
  await expect
    .poll(
      async () =>
        (await snapshot(page)).collections.find(
          (c) => c.id === ids.collectionId
        ).project.shots[0].selectedSceneId
    )
    .toBe(ids.otherSceneId);
  await expect(
    dialog
      .locator('.project-take-card')
      .nth(1)
      .getByText('Preferred take', { exact: true })
  ).toBeVisible();
  const note = dialog.getByRole('textbox', { name: /Project note/ }).nth(1);
  await note.fill('Prefer the quieter pause.');
  await expect(
    dialog.getByRole('button', { name: 'Save note', exact: true }).nth(1)
  ).toBeEnabled();
  await dialog
    .getByRole('button', { name: 'Save note', exact: true })
    .nth(1)
    .click();
  await expect
    .poll(
      async () =>
        (await snapshot(page)).collections.find(
          (c) => c.id === ids.collectionId
        ).project.shots[0].takeNotes[ids.otherSceneId]
    )
    .toBe('Prefer the quieter pause.');
  await dialog
    .getByRole('button', { name: 'Compare takes', exact: true })
    .click();
  await expect(dialog.getByRole('region', { name: 'Take A' })).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Take B' })).toBeVisible();
  expect(await dialog.locator('details[open]').count()).toBe(0);
  await dialog
    .getByRole('button', { name: 'Back to takes', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: /Remove .* from shot/ })
    .first()
    .click();
  await dialog
    .getByRole('button', { name: 'Confirm remove take', exact: true })
    .click();
  await expect(dialog.locator('.project-take-card')).toHaveCount(1);
  expect((await snapshot(page)).scenes).toEqual(before.scenes);
});

test('identity approval and stale fallback preserve canonical outputs and saved generation snapshots', async ({
  page,
}) => {
  const ids = await seedPolishFixture(page),
    before = await snapshot(page);
  await page.goto(`/#/prompts/${ids.characterId}`);
  await page.locator('.identity-anchor-panel > summary').click();
  await expect(page.getByText(/Record revision 2/)).toBeVisible();
  await expect(page.getByText('Approved', { exact: true })).toBeVisible();
  await page
    .getByLabel('Identity Anchor text')
    .fill('User explicitly writes a shorter identity.');
  await page
    .getByRole('button', { name: 'Save Draft Anchor', exact: true })
    .click();
  await expect(
    page.getByText('Draft anchor saved. Approval is a separate action.')
  ).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Approve Anchor', exact: true })
    .click();
  await expect(
    page.getByText('Anchor explicitly approved for this master revision.')
  ).toBeVisible();
  expect(
    (await snapshot(page)).assets.find((a) => a.id === ids.characterId)
      .promptText
  ).toBe(ids.master);
  await page.goto(`/#/output/${ids.draftId}`);
  await expect(
    page.getByRole('option', { name: 'Approved Identity Anchor', exact: true })
  ).toBeDisabled();
  await page.evaluate(async (ids) => {
    const db = await import('/src/storage/db.ts'),
      assembler = await import('/src/domain/promptAssembler.ts'),
      s = await db.getAllSnapshot(),
      character = s.assets.find((a) => a.id === ids.characterId),
      draft = s.drafts.find((d) => d.id === ids.draftId);
    await db.saveSceneDraft({
      ...draft,
      slots: {
        ...draft.slots,
        character: assembler.createSnapshotFromAsset(character),
      },
    });
  }, ids);
  await page.reload();
  await page
    .getByLabel('Character Identity Source', { exact: true })
    .selectOption('approved_anchor');
  await expect
    .poll(
      async () =>
        (await snapshot(page)).drafts.find((d) => d.id === ids.draftId)
          .generation?.identitySource
    )
    .toBe('approved_anchor');
  await page.evaluate(async (ids) => {
    const db = await import('/src/storage/db.ts'),
      s = await db.getAllSnapshot(),
      character = s.assets.find((a) => a.id === ids.characterId);
    await db.savePromptAsset({
      ...character,
      promptText: character.promptText + ' User changed the master.',
    });
  }, ids);
  await page.reload();
  await expect(
    page.getByLabel('Character Identity Source', { exact: true })
  ).toHaveValue('master');
  await expect(page.getByText('Stale', { exact: true })).toBeVisible();
  expect((await snapshot(page)).scenes).toEqual(before.scenes);
});
