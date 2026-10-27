import { test, expect } from '@playwright/test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

test.beforeEach(async ({ page }) => {
  // Playwright supplies a new browser context for each test. These synthetic
  // writes must never target a developer's existing localhost:5173 profile.
  await page.goto('/#/');
  await expect(page.getByText('Your reusable video creation toolkit')).toBeVisible();
});

const openSettings = async page => {
  await page.getByRole('button', { name: 'Open Settings and ZIP Backup' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings & Local Data Backup' })).toBeVisible();
};

const snapshot = page => page.evaluate(async () => (await import('/src/storage/db.ts')).getAllSnapshot());
const zipFile = bytes => ({ name: 'synthetic-full-library.zip', mimeType: 'application/zip', buffer: Buffer.from(bytes) });

test('Settings labels the separate limits and Verify does not write or offer replacement', async ({ page }) => {
  const bytes = await page.evaluate(async () => {
    const db = await import('/src/storage/db.ts');
    const backup = await import('/src/storage/backup.ts');
    await db.clearAllStoresForTesting();
    await db.savePromptAsset({ title: 'Verify only', category: 'styles', promptText: 'Keep this synthetic record.', tags: [] });
    return Array.from(await backup.exportFullBackupZip());
  });
  const before = await snapshot(page);
  await page.reload();
  await openSettings(page);
  const dialog = page.getByRole('dialog', { name: 'Settings & Local Data Backup' });
  await expect(dialog).toContainText('Media usage:');
  await expect(dialog).toContainText('5,000 MiB');
  await expect(dialog).toContainText('5,500 MiB');
  await expect(dialog).toContainText('Compressed ZIP ceiling');
  await expect(dialog).toContainText('Uncompressed backup ceiling');
  await expect(dialog).toContainText('Current enforced restore ceiling');
  await expect(dialog).toContainText('Project Export is a separate selection workflow with its existing 128 MiB cap.');
  await dialog.getByLabel('Choose a backup to verify').setInputFiles(zipFile(bytes));
  await expect(dialog.getByText(/Verified: archive structure/)).toBeVisible();
  await expect(dialog.getByLabel('Backup validation report')).toContainText('1 prompts');
  await expect(dialog.getByRole('button', { name: 'Confirm & Replace Current Library' })).toHaveCount(0);
  expect((await snapshot(page)).assets).toEqual(before.assets);
});

test('native OPFS writable export and legacy starter SVG restore keep media and fence an older tab', async ({ page, context }) => {
  const original = await page.evaluate(async () => {
    const db = await import('/src/storage/db.ts');
    await db.clearAllStoresForTesting();
    const snap = await db.loadStarterLibrary();
    const svg = snap.media.find(media => media.mimeType === 'image/svg+xml');
    if (!svg) throw new Error('Starter fixture has no SVG media');
    const digest = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    return { assets: snap.assets.length, media: snap.media.length, svgId: svg.id,
      svgSha256: digest(await crypto.subtle.digest('SHA-256', await svg.blob.arrayBuffer())) };
  });
  await page.reload();
  await page.evaluate(() => {
    // This stub returns the browser's real FileSystemWritableFileStream.
    // It deliberately does not claim to test the operating-system save dialog.
    window.showSaveFilePicker = async () => ({
      createWritable: async () => {
        const root = await navigator.storage.getDirectory();
        const file = await root.getFileHandle('synthetic-export.zip', { create: true });
        return file.createWritable();
      },
    });
  });
  await openSettings(page);
  const dialog = page.getByRole('dialog', { name: 'Settings & Local Data Backup' });
  await dialog.getByRole('button', { name: 'Export Full Library (ZIP64)' }).click();
  await expect(dialog.getByText(/Saved .* bytes\. Select the saved file/)).toBeVisible();
  const streamed = await page.evaluate(async () => {
    const file = await (await (await navigator.storage.getDirectory()).getFileHandle('synthetic-export.zip')).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  });
  expect(streamed.length).toBeGreaterThan(0);
  await dialog.getByLabel('Choose a backup to verify').setInputFiles(zipFile(streamed));
  await expect(dialog.getByText(/Verified: archive structure/)).toBeVisible();

  // A version-1 backup without optional media hashes remains importable.
  const entries = unzipSync(Uint8Array.from(streamed));
  const manifest = JSON.parse(strFromU8(entries['manifest.json']));
  for (const media of manifest.media) { delete media.sha256; delete media.posterSha256; }
  entries['manifest.json'] = strToU8(JSON.stringify(manifest));
  const legacy = zipSync(entries);
  const oldTab = await context.newPage();
  await oldTab.goto('/#/');
  await expect(oldTab.getByText('Your reusable video creation toolkit')).toBeVisible();
  await page.evaluate(async () => {
    const db = await import('/src/storage/db.ts');
    await db.savePromptAsset({ title: 'After export', category: 'styles', promptText: 'Must disappear on restore.', tags: [] });
  });
  await dialog.getByLabel('Choose a backup to stage for restore').setInputFiles(zipFile(legacy));
  await expect(dialog.getByLabel('Backup validation report')).toContainText(`${original.assets} prompts`);
  await expect(dialog.getByRole('button', { name: 'Confirm & Replace Current Library' })).toBeVisible();
  expect((await snapshot(page)).assets.some(asset => asset.title === 'After export')).toBe(true);
  await dialog.getByRole('button', { name: 'Confirm & Replace Current Library' }).click();
  await expect(dialog.getByText(/Library replacement committed/)).toBeVisible();
  const restored = await page.evaluate(async () => {
    const snap = await (await import('/src/storage/db.ts')).getAllSnapshot();
    const svg = snap.media.find(media => media.mimeType === 'image/svg+xml');
    if (!svg) throw new Error('Restored SVG missing');
    const digest = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    const url = URL.createObjectURL(svg.blob);
    const decoded = await new Promise(resolve => { const img = new Image(); img.onload = () => resolve(img.naturalWidth > 0); img.onerror = () => resolve(false); img.src = url; });
    URL.revokeObjectURL(url);
    return { assets: snap.assets.length, media: snap.media.length, svgId: svg.id, type: svg.blob.type, decoded,
      svgSha256: digest(await crypto.subtle.digest('SHA-256', await svg.blob.arrayBuffer())),
      lateAsset: snap.assets.some(asset => asset.title === 'After export') };
  });
  expect(restored).toEqual({ ...original, type: 'image/svg+xml', decoded: true, lateAsset: false });
  const staleWrite = await oldTab.evaluate(async () => {
    try {
      await (await import('/src/storage/db.ts')).savePromptAsset({ title: 'Stale write', category: 'styles', promptText: 'Must be blocked.', tags: [] });
      return 'allowed';
    } catch (error) { return String(error.message); }
  });
  expect(staleWrite).toMatch(/restored in another tab|reload/i);
  await expect(oldTab.getByText('Library restored. Reload before saving.')).toBeVisible();
  expect((await snapshot(page)).assets.some(asset => asset.title === 'Stale write')).toBe(false);
});

test('ready preview survives closing its tab, but another-tab mutation blocks commit', async ({ page, context }) => {
  const bytes = await page.evaluate(async () => {
    const db = await import('/src/storage/db.ts');
    await db.clearAllStoresForTesting();
    await db.savePromptAsset({ title: 'Original', category: 'styles', promptText: 'Keep original.', tags: [] });
    return Array.from(await (await import('/src/storage/backup.ts')).exportFullBackupZip());
  });
  await page.reload();
  await openSettings(page);
  await page.getByLabel('Choose a backup to stage for restore').setInputFiles(zipFile(bytes));
  await expect(page.getByRole('button', { name: 'Confirm & Replace Current Library' })).toBeVisible();
  const originalIds = (await snapshot(page)).assets.map(asset => asset.id);
  await page.close();

  const reopened = await context.newPage();
  await reopened.goto('/#/');
  await expect(reopened.getByText('Your reusable video creation toolkit')).toBeVisible();
  await openSettings(reopened);
  await reopened.getByText('Recoverable temporary restore stages').click();
  await expect(reopened.getByRole('button', { name: 'Confirm & Replace Current Library' })).toHaveCount(0);
  await reopened.getByRole('button', { name: 'Revalidate Stage' }).click();
  await expect(reopened.getByRole('button', { name: 'Confirm & Replace Current Library' })).toBeVisible();
  expect((await snapshot(reopened)).assets.map(asset => asset.id)).toEqual(originalIds);

  const otherTab = await context.newPage();
  await otherTab.goto('/#/');
  await expect(otherTab.getByText('Your reusable video creation toolkit')).toBeVisible();
  await otherTab.evaluate(async () => {
    await (await import('/src/storage/db.ts')).savePromptAsset({ title: 'Other tab mutation', category: 'styles', promptText: 'Must survive failed commit.', tags: [] });
  });
  const liveBeforeCommit = (await snapshot(reopened)).assets.map(asset => asset.id).sort();
  await reopened.getByRole('button', { name: 'Confirm & Replace Current Library' }).click();
  await expect(reopened.getByRole('alert')).toContainText(/changed|conflict|modified/i);
  expect((await snapshot(reopened)).assets.map(asset => asset.id).sort()).toEqual(liveBeforeCommit);
  await expect(reopened.getByRole('button', { name: 'Discard Preview' })).toBeEnabled();
});
