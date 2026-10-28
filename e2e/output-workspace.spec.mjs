import { test, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  seedOutputWorkspace,
  outputBaseline,
} from './output-workspace-fixture.mjs';
import { storedProof } from './storyboard-fixture.mjs';

const golden = JSON.parse(
  await readFile(
    new URL('./fixtures/output-workspace-baseline.json', import.meta.url),
    'utf8'
  )
);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const formats = {
  full: 'Narrative',
  structured: 'Structured',
  compact: 'Compact',
  json: 'Project JSON',
  generation_json: 'Generation JSON',
};
const viewer = (page) => page.getByRole('dialog', { name: /^Scene Prompt —/ });
async function selectOutput(page, key) {
  if (key in formats) {
    await page
      .getByLabel('Target Workflow', { exact: true })
      .selectOption('canonical');
    await page
      .getByRole('tab', { name: new RegExp(`^${formats[key]}`) })
      .click();
  } else
    await page.getByLabel('Target Workflow', { exact: true }).selectOption(key);
}
async function actualDownload(page, action) {
  const pending = page.waitForEvent('download');
  await action();
  const file = await pending;
  return {
    filename: file.suggestedFilename(),
    bytes: await readFile(await file.path()),
  };
}
test('laptop dialog keeps the final prompt line and every section link above its fixed footer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const ids = await seedOutputWorkspace(page);
  await page.goto('/#/output/' + ids.draftId);
  const checkEnd = async () => {
    const dialog = viewer(page),
      region = dialog.getByRole('region', { name: 'Complete prompt text' }),
      nav = dialog.getByRole('navigation', { name: 'Prompt sections' });
    const footerTop = await dialog
      .locator('.modal-footer')
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(
      await region.evaluate((el) => el.getBoundingClientRect().bottom)
    ).toBeLessThanOrEqual(footerTop);
    expect(
      await nav.evaluate((el) => el.getBoundingClientRect().bottom)
    ).toBeLessThanOrEqual(footerTop);
    await region.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    expect(
      await region
        .locator('.formatted-prompt-line')
        .last()
        .evaluate((el) => el.getBoundingClientRect().bottom)
    ).toBeLessThanOrEqual(footerTop);
    await nav.getByRole('button').last().click();
    await expect(nav.getByRole('button').last()).toBeInViewport();
    await expect(
      dialog.getByRole('button', { name: 'Close', exact: true })
    ).toBeInViewport();
  };
  await page.getByRole('button', { name: 'Show Prompt', exact: true }).click();
  await checkEnd();
  await page.keyboard.press('Escape');
  await page.evaluate(async (id) => {
    const db = await import('/src/storage/db.ts'),
      draft = (await db.getAllSnapshot()).drafts.find((d) => d.id === id);
    const text =
      Array.from(
        { length: 30 },
        (_, i) => `=== CAMERA & CINEMATOGRAPHY ===\nPreserved shot ${i + 1}.`
      ).join('\n\n') + '\nEND OF PROMPT';
    await db.saveSceneDraft({
      ...draft,
      manualOutputs: {
        structured: {
          text,
          basedOnInputRevision: draft.inputRevision,
          updatedAt: '2026-10-28T00:00:00.000Z',
        },
      },
      bumpInputRevision: false,
    });
  }, ids.draftId);
  await page.reload();
  await page.getByRole('button', { name: 'Show Prompt', exact: true }).click();
  await checkEnd();
});

for (const kind of ['draft', 'saved'])
  for (const layout of ['split', 'tabs']) {
    test(`${kind} ${layout}: full viewer, clipboard payload and actual downloads match master bytes across every output`, async ({
      page,
    }) => {
      test.setTimeout(90000);
      // Record the exact Clipboard API payload without touching the user's OS clipboard.
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (text) => {
              window.__outputCopied = text;
            },
          },
        });
      });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const ids = await seedOutputWorkspace(page),
        id = kind === 'saved' ? ids.sceneId : ids.draftId;
      await page.goto('/#/output/' + id);
      await page
        .getByLabel('Workspace Layout', { exact: true })
        .selectOption(layout);
      const before = await storedProof(page),
        baseline = golden[kind],
        checks = [];
      expect(await outputBaseline(page, id)).toEqual(baseline);
      for (const [key, text] of Object.entries(baseline.text)) {
        await selectOutput(page, key);
        await expect(
          page.getByRole('region', { name: 'Complete prompt text' })
        ).toHaveCount(0);
        await page
          .getByRole('button', { name: 'Show Prompt', exact: true })
          .click();
        await expect(viewer(page)).toContainText(
          `${text.length.toLocaleString()} characters`
        );
        await viewer(page)
          .getByRole('button', { name: 'Raw', exact: true })
          .click();
        expect(
          await viewer(page)
            .getByRole('region', { name: 'Complete prompt text' })
            .textContent()
        ).toBe(text);
        await viewer(page)
          .getByRole('button', { name: 'Formatted', exact: true })
          .click();
        const links = viewer(page)
          .getByRole('navigation', { name: 'Prompt sections' })
          .getByRole('button');
        if (await links.last().isVisible()) await links.last().click();
        await viewer(page)
          .getByRole('button', { name: 'Copy Prompt', exact: true })
          .click();
        const copied = await page.evaluate(() => window.__outputCopied);
        expect(Buffer.from(copied, 'utf8')).toEqual(Buffer.from(text, 'utf8'));
        const downloaded = await actualDownload(page, () =>
          viewer(page)
            .getByRole('button', { name: 'Download Selected', exact: true })
            .click()
        );
        expect(downloaded.bytes).toEqual(Buffer.from(text, 'utf8'));
        expect(
          downloaded.filename.endsWith(
            ['json', 'generation_json'].includes(key) ? '.json' : '.txt'
          )
        ).toBe(true);
        await page.keyboard.press('Escape');
        await expect(
          page.getByRole('button', { name: 'Show Prompt', exact: true })
        ).toBeFocused();
        const mode = ['full', 'structured', 'compact'].includes(key)
          ? key
          : 'structured';
        const specification = await actualDownload(page, () =>
          page
            .getByRole('button', {
              name: /^Download (Structured )?full specification/,
            })
            .click()
        );
        expect(specification.bytes).toEqual(
          Buffer.from(baseline.specifications[mode], 'utf8')
        );
        checks.push({
          output: key,
          bytes: downloaded.bytes.length,
          expectedSha256: sha(Buffer.from(text)),
          selectedDownloadSha256: sha(downloaded.bytes),
          clipboardPayloadSha256: sha(Buffer.from(copied)),
          fullSpecificationSha256: sha(specification.bytes),
        });
      }
      expect(await storedProof(page)).toEqual(before);
      expect(errors).toEqual([]);
      await mkdir('qa-results/output-workspace/integrity', { recursive: true });
      await writeFile(
        `qa-results/output-workspace/integrity/${kind}-${layout}.json`,
        JSON.stringify(
          {
            baselineCommit: golden.baselineCommit,
            pass: true,
            kind,
            layout,
            clipboardApiPayloadCaptured: true,
            osClipboardTouched: false,
            allStoredRecordsAndMediaHashesUnchanged: true,
            checks,
          },
          null,
          2
        )
      );
    });
  }

test('viewer keyboard navigation, section positioning and scroll lock preserve the scene context', async ({
  page,
}) => {
  const ids = await seedOutputWorkspace(page);
  await page.goto('/#/output/' + ids.draftId);
  await page
    .getByLabel('Workspace Layout', { exact: true })
    .selectOption('tabs');
  const before = await storedProof(page);
  await page.getByRole('tab', { name: 'Sections', exact: true }).click();
  await page
    .getByRole('button', { name: 'CHARACTER IDENTITY', exact: true })
    .click();
  const dialog = viewer(page),
    region = dialog.getByRole('region', { name: 'Complete prompt text' });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    'hidden'
  );
  expect(await region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await dialog
    .getByRole('navigation', { name: 'Prompt sections' })
    .getByRole('button', { name: 'SPOKEN DIALOGUE SCRIPT', exact: true })
    .click();
  await expect(
    dialog.getByRole('heading', { name: 'SPOKEN DIALOGUE SCRIPT', exact: true })
  ).toBeFocused();
  const position = await dialog
    .getByRole('heading', { name: 'SPOKEN DIALOGUE SCRIPT', exact: true })
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(position).toBeGreaterThan(
    await region.evaluate((el) => el.getBoundingClientRect().top)
  );
  await dialog.getByRole('button', { name: 'Raw', exact: true }).click();
  await region.focus();
  await page.keyboard.press('ControlOrMeta+A');
  expect(await page.evaluate(() => getSelection().toString())).toBe(
    golden.draft.text.structured
  );
  await dialog.getByRole('button', { name: 'Close', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(
    dialog.getByRole('button', { name: /^Close Scene Prompt/ })
  ).toBeFocused();
  const scroll = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 400);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Show Prompt', exact: true })
  ).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    'hidden'
  );
  await page.getByRole('tab', { name: 'Configuration', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('tab', { name: 'Preview', exact: true })
  ).toBeFocused();
  expect(await storedProof(page)).toEqual(before);
});

test('small-screen default, manual layout choice and mobile section selector reflow without overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const ids = await seedOutputWorkspace(page);
  await page.goto('/#/output/' + ids.sceneId);
  await expect(
    page.getByLabel('Workspace Layout', { exact: true })
  ).toHaveValue('tabs');
  await page
    .getByLabel('Workspace Layout', { exact: true })
    .selectOption('split');
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(
    page.getByLabel('Workspace Layout', { exact: true })
  ).toHaveValue('split');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Show Prompt', exact: true }).click();
  await viewer(page)
    .getByLabel('Jump to prompt section', { exact: true })
    .selectOption({ label: 'Character Identity' });
  await expect(
    viewer(page).getByRole('heading', {
      name: 'Character Identity',
      exact: true,
    })
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1
    )
  ).toBe(true);
  expect(
    await viewer(page).evaluate(
      (el) =>
        el.getBoundingClientRect().right <= innerWidth &&
        el.getBoundingClientRect().left >= 0
    )
  ).toBe(true);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 720, height: 450 });
  await page.getByRole('button', { name: 'Show Prompt', exact: true }).click();
  expect(
    await viewer(page).evaluate(
      (el) => el.getBoundingClientRect().bottom <= innerHeight
    )
  ).toBe(true);
  await expect(
    viewer(page).getByRole('button', { name: 'Copy Prompt', exact: true })
  ).toBeInViewport();
  await mkdir('qa-results/output-workspace/after', { recursive: true });
  await page.screenshot({
    path: 'qa-results/output-workspace/after/reflow-200-percent.png',
  });
});

test('stale copy started in the viewer opens one operable confirmation and preserves unsaved editing buffers', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__outputCopied = text;
        },
      },
    });
  });
  const ids = await seedOutputWorkspace(page);
  const manual = '  Older manual output.\r\n“Sandali—wait!” 😊  ';
  await page.evaluate(
    async ({ id, manual }) => {
      const db = await import('/src/storage/db.ts'),
        draft = (await db.getAllSnapshot()).drafts.find((d) => d.id === id);
      await db.saveSceneDraft({
        ...draft,
        manualOutputs: {
          structured: {
            text: manual,
            basedOnInputRevision: 0,
            updatedAt: '2026-10-27T00:00:00.000Z',
          },
        },
        bumpInputRevision: false,
      });
    },
    { id: ids.draftId, manual }
  );
  await page.reload();
  await page.goto('/#/output/' + ids.draftId);
  await page
    .getByRole('button', { name: 'Edit This Output', exact: true })
    .click();
  await page
    .getByLabel('Manual prompt output', { exact: true })
    .fill('Unfinished editor buffer.');
  await expect(page.getByText(/Unsaved editing buffer/)).toBeVisible();
  await page.getByRole('button', { name: 'Show Prompt', exact: true }).click();
  await viewer(page)
    .getByRole('button', { name: 'Copy Prompt', exact: true })
    .click();
  const confirmation = page.getByRole('dialog', {
    name: 'Stale Manual Edit Warning',
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  expect(await page.evaluate(() => window.__outputCopied)).toBeUndefined();
  await confirmation
    .getByRole('button', { name: 'Retain & Copy Manual Edits', exact: true })
    .click();
  expect(await page.evaluate(() => window.__outputCopied)).toBe(manual);
  await expect(
    page.getByLabel('Manual prompt output', { exact: true })
  ).toHaveValue('Unfinished editor buffer.');
  await page
    .getByRole('button', { name: 'Save Manual Output Override', exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        async (id) =>
          (
            await (await import('/src/storage/db.ts')).getAllSnapshot()
          ).drafts.find((d) => d.id === id).manualOutputs.structured.text,
        ids.draftId
      )
    )
    .toBe('Unfinished editor buffer.');
});

test('reference and sample previews use the existing associations without reassigning media', async ({
  page,
}) => {
  const ids = await seedOutputWorkspace(page);
  await page.goto('/#/output/' + ids.sceneId);
  await page
    .getByLabel('Workspace Layout', { exact: true })
    .selectOption('split');
  const before = await storedProof(page);
  const media = page.getByRole('region', { name: 'Scene Visual' }),
    picker = media.getByLabel('Associated media', { exact: true });
  await expect(media.locator('.output-section-heading')).toContainText(
    'Reference'
  );
  await picker.selectOption(
    await picker
      .locator('option')
      .filter({ hasText: /^Sample/ })
      .getAttribute('value')
  );
  await expect(media.locator('.output-section-heading')).toContainText(
    'Sample'
  );
  await media
    .getByRole('button', { name: 'Preview Media', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: /^Media:/ })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Actual Size', exact: true })
  ).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await storedProof(page)).toEqual(before);
  await page.evaluate(async (id) => {
    const db = await import('/src/storage/db.ts'),
      s = await db.getAllSnapshot(),
      scene = s.scenes.find((x) => x.id === id),
      link = scene.slots.character.mediaLinks[0];
    scene.referencePack = {
      version: 1,
      entries: [
        {
          ...link,
          associationId: 'captured_pack_only',
          sourceSlot: 'legacy',
          sourceId: 'historical_source',
          sourceTitle: 'Captured pack reference',
          purpose: 'general',
          order: 0,
        },
      ],
    };
    for (const slot of Object.values(scene.slots)) slot.mediaLinks = [];
    scene.references = [];
    await db.replaceAllStoresTransactionally(s);
  }, ids.sceneId);
  await page.reload();
  await page
    .getByLabel('Workspace Layout', { exact: true })
    .selectOption('split');
  const packBefore = await storedProof(page);
  await expect(
    page
      .getByRole('region', { name: 'Scene Visual' })
      .getByRole('img', { name: 'Synthetic blue reference guide' })
  ).toBeVisible();
  expect(
    await page
      .getByRole('region', { name: 'Scene Visual' })
      .locator('img')
      .evaluate((el) => el.naturalWidth)
  ).toBe(640);
  expect(await storedProof(page)).toEqual(packBefore);
});

test('complete long raw output and missing-media/empty states do not invent scene details', async ({
  page,
}) => {
  const ids = await seedOutputWorkspace(page),
    long =
      '  Preserved Unicode: “Tara na!” 😊 雨\r\n\tUnbrokenEvidence'.repeat(
        1100
      ) + '  ';
  await page.evaluate(
    async ({ id, long }) => {
      const db = await import('/src/storage/db.ts'),
        s = await db.getAllSnapshot(),
        scene = s.scenes.find((x) => x.id === id);
      scene.outputs.full = long;
      scene.references = [];
      for (const slot of Object.values(scene.slots)) slot.mediaLinks = [];
      await db.replaceAllStoresTransactionally(s);
    },
    { id: ids.sceneId, long }
  );
  await page.reload();
  await page.goto('/#/output/' + ids.sceneId);
  await page
    .getByLabel('Workspace Layout', { exact: true })
    .selectOption('split');
  const before = await storedProof(page);
  await expect(
    page
      .getByRole('region', { name: 'Scene Visual' })
      .getByRole('button', { name: 'Preview Media', exact: true })
  ).toBeDisabled();
  await expect(
    page.getByText(
      'No scene media available. Add references or upload a result when ready.'
    )
  ).toBeVisible();
  await page.getByRole('button', { name: 'Show Prompt', exact: true }).click();
  await viewer(page).getByRole('button', { name: 'Raw', exact: true }).click();
  expect(
    await viewer(page)
      .getByRole('region', { name: 'Complete prompt text' })
      .textContent()
  ).toBe(long);
  const file = await actualDownload(page, () =>
    viewer(page)
      .getByRole('button', { name: 'Download Selected', exact: true })
      .click()
  );
  expect(file.bytes).toEqual(Buffer.from(long));
  await page.keyboard.press('Escape');
  expect(await storedProof(page)).toEqual(before);
  await page.evaluate(async (id) => {
    const db = await import('/src/storage/db.ts'),
      s = await db.getAllSnapshot();
    s.scenes.find((x) => x.id === id).outputs.full = '';
    await db.replaceAllStoresTransactionally(s);
  }, ids.sceneId);
  await page.reload();
  await page.getByRole('button', { name: 'Show Prompt', exact: true }).click();
  await expect(
    viewer(page).getByText('No prompt text in this selected output.')
  ).toBeVisible();
  await expect(
    viewer(page).getByRole('button', { name: 'Copy Prompt', exact: true })
  ).toBeDisabled();
});

test('an associated decodable result video is labeled Result and opens the existing explicit player', async ({
  page,
}) => {
  const ids = await seedOutputWorkspace(page);
  await page.evaluate(async (id) => {
    const db = await import('/src/storage/db.ts'),
      canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d'),
      stream = canvas.captureStream(0),
      recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }),
      chunks = [];
    const stopped = new Promise((resolve) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = resolve;
    });
    recorder.start();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#315cf6' : '#cbdcfa';
      ctx.fillRect(0, 0, 160, 90);
      stream.getVideoTracks()[0].requestFrame();
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: 'video/webm' }),
      url = URL.createObjectURL(blob),
      video = document.createElement('video');
    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve;
      video.onerror = () =>
        reject(Error('Synthetic result video did not decode'));
      video.src = url;
    });
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
    const media = await db.saveMediaAsset({
      filename: 'synthetic-output-result.webm',
      mimeType: 'video/webm',
      blob,
    });
    await db.updateSavedSceneReviewAndResults({
      sceneId: id,
      resultMediaLinks: [
        {
          mediaId: media.id,
          role: 'result',
          altText: 'Synthetic animated blue frames',
          filename: media.filename,
          mimeType: media.mimeType,
          order: 0,
        },
      ],
      reviewNotes: '',
      reviewStatus: 'unreviewed',
    });
  }, ids.sceneId);
  await page.reload();
  await page.goto('/#/output/' + ids.sceneId);
  await page
    .getByLabel('Workspace Layout', { exact: true })
    .selectOption('split');
  const before = await storedProof(page);
  const visual = page.getByRole('region', { name: 'Scene Visual' });
  await expect(visual.locator('.output-section-heading')).toContainText(
    'Result'
  );
  await visual
    .getByRole('button', { name: 'Preview Media', exact: true })
    .click();
  const video = page.getByRole('dialog', { name: /^Media:/ }).locator('video');
  await expect(video).toHaveAttribute('controls', '');
  expect(await video.evaluate((el) => el.paused)).toBe(true);
  await page.keyboard.press('Escape');
  expect(await storedProof(page)).toEqual(before);
});

test('saved identity remains frozen and Edit a Copy creates an editable draft without changing the scene', async ({
  page,
}) => {
  const ids = await seedOutputWorkspace(page);
  await page.goto('/#/output/' + ids.sceneId);
  await page
    .getByLabel('Workspace Layout', { exact: true })
    .selectOption('split');
  const before = await storedProof(page);
  await expect(
    page.getByLabel('Character Identity Source', { exact: true })
  ).toBeDisabled();
  await expect(
    page.getByText('Master Identity in saved snapshot', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit a Copy', exact: true }).click();
  await expect(page).toHaveURL(/#\/builder\/draft_/);
  const after = await storedProof(page);
  expect(after.scenes).toEqual(before.scenes);
  expect(after.media).toEqual(before.media);
  expect(after.drafts.length).toBe(before.drafts.length + 1);
  const copy = after.drafts.find((d) => d.id !== ids.draftId);
  expect(copy.sourceSceneId).toBe(ids.sceneId);
  expect(copy.slots).toEqual(before.scenes[0].slots);
});
