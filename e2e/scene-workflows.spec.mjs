import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const hasDuplicateProtection = existsSync(new URL('../src/domain/sceneDuplicates.ts', import.meta.url));
const hasStoryboard = existsSync(new URL('../src/storage/projects.ts', import.meta.url));

test.beforeEach(async ({ page }) => {
  // A fresh Playwright context and the app's S01 shell precede all synthetic writes.
  await page.goto('/#/');
  await expect(page.getByText('Your reusable video creation toolkit')).toBeVisible();
});

async function fixture(page, { saved = false, project = false } = {}) {
  const ids = await page.evaluate(async ({ saved, project }) => {
    const db = await import('/src/storage/db.ts');
    await db.clearAllStoresForTesting();
    const slot = (name, promptText) => ({
      slot: name,
      sourceType: 'asset',
      sourceId: `asset_synthetic_${name}`,
      sourceRevision: 1,
      sourceTitle: `Synthetic ${name}`,
      promptText,
      mediaLinks: [],
    });
    const draft = await db.saveSceneDraft({
      title: 'Synthetic Café Scene',
      slots: {
        character: slot('character', 'A fictional adult character named Ari with steady facial identity.'),
        environment: slot('environment', 'A quiet café with oak tables and morning light.'),
        action: slot('action', 'Ari closes a notebook and looks toward the window.'),
      },
      extraRequiredSlots: [],
      sceneInstructions: 'Hold the final frame.',
      settings: { aspectRatio: '9:16', durationSeconds: 8 },
      manualOutputs: {},
      resultMediaLinks: [],
      reviewNotes: '',
      reviewStatus: 'unreviewed',
    });
    const scene = saved ? await db.saveSceneFromDraft(draft.id) : null;
    let collection = null;
    let shot = null;
    if (project) {
      collection = await db.createCollection({ name: 'Synthetic Film' });
      const projects = await import('/src/storage/projects.ts');
      const first = await projects.addProjectShot({ collectionId: collection.id, title: 'Opening', sceneId: scene.id });
      shot = first.project.shots[0];
      await projects.addProjectShot({ collectionId: collection.id, title: 'Closing' });
    }
    return { draftId: draft.id, sceneId: scene?.id, collectionId: collection?.id, shotId: shot?.id };
  }, { saved, project });
  // The app read its initial snapshot before the direct IDB fixture writes.
  await page.reload();
  return ids;
}

async function snapshot(page) {
  return page.evaluate(async () => (await import('/src/storage/db.ts')).getAllSnapshot());
}

test('canonical output copy, save, and small legacy backup roundtrip', async ({ page, context }) => {
  const { draftId } = await fixture(page);
  await page.goto(`/#/output/${draftId}`);
  await expect(page.getByRole('heading', { name: 'Synthetic Café Scene', level: 1 })).toBeVisible();
  await page.getByRole('tab', { name: 'Narrative' }).click();
  await page.getByRole('button', { name: 'Show Prompt', exact: true }).click();
  await page.getByRole('button', { name: 'Raw' }).click();
  const prompt = page.getByRole('region', { name: 'Complete prompt text' });
  await expect(prompt).toContainText('A quiet café with oak tables');
  await expect(prompt).toContainText('Hold the final frame.');
  const exactOutput = await prompt.textContent();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy Prompt' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  // Windows clipboard canonicalizes LF to CRLF; compare the actual text content.
  expect(copied.replace(/\r\n/g, '\n')).toBe(exactOutput.replace(/\r\n/g, '\n'));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save Scene' }).click();
  await expect(page).toHaveURL(/#\/output\/scene_/);
  const original = await snapshot(page);
  expect(original.scenes).toHaveLength(1);
  expect(original.scenes[0].outputs.full).toBe(exactOutput);

  const roundtrip = await page.evaluate(async () => {
    const backup = await import('/src/storage/backup.ts');
    const db = await import('/src/storage/db.ts');
    const bytes = await backup.exportFullBackupZip();
    const validation = await backup.validateBackupZip(bytes);
    if (!validation.valid) throw new Error(validation.error || 'Synthetic ZIP validation failed');
    await db.clearAllStoresForTesting();
    await backup.restoreFullBackupZip(bytes);
    const restored = await db.getAllSnapshot();
    return { byteLength: bytes.byteLength, summary: validation.summary, scenes: restored.scenes };
  });
  expect(roundtrip.byteLength).toBeGreaterThan(0);
  expect(roundtrip.summary.scenesCount).toBe(1);
  expect(roundtrip.scenes).toHaveLength(1);
  expect(roundtrip.scenes[0].outputs).toEqual(original.scenes[0].outputs);
});

test('duplicate save requires an explicit decision', async ({ page }) => {
  test.skip(!hasDuplicateProtection, 'sceneDuplicates.ts is absent on this stack branch');
  const { draftId } = await fixture(page, { saved: true });
  await page.goto(`/#/output/${draftId}`);
  await page.getByRole('button', { name: 'Save Scene' }).click();
  await expect(page.getByRole('dialog', { name: 'Similar saved scene' })).toBeVisible();
  expect((await snapshot(page)).scenes).toHaveLength(1);
  await page.getByRole('dialog', { name: 'Similar saved scene' }).getByRole('button', { name: 'Cancel' }).click();
  expect((await snapshot(page)).scenes).toHaveLength(1);
});

test('storyboard order and collection return survive navigation', async ({ page }) => {
  test.skip(!hasStoryboard, 'storage/projects.ts is absent on this stack branch');
  const { collectionId } = await fixture(page, { saved: true, project: true });
  await page.goto(`/#/collections/${collectionId}?tab=storyboard`);
  const storyboard = page.getByRole('tabpanel', { name: 'Storyboard' });
  await expect(storyboard.getByRole('heading', { name: 'Opening' })).toBeVisible();
  await expect(storyboard.getByRole('heading', { name: 'Closing' })).toBeVisible();
  await storyboard.getByLabel('More actions for Closing').click();
  await storyboard.getByRole('button', { name: 'Move Closing up' }).click();
  await expect.poll(async () => {
    const data = await snapshot(page);
    return data.collections.find(item => item.id === collectionId).project.shots.map(shot => shot.title);
  }).toEqual(['Closing', 'Opening']);
  await storyboard.getByRole('button', { name: 'Open Opening' }).click();
  await expect(page.getByRole('button', { name: 'Back to Collection' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Collection' }).click();
  await expect(page).toHaveURL(new RegExp(`/collections/${collectionId}\\?tab=storyboard`));
});
