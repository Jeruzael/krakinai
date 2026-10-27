import { test, expect } from '@playwright/test';

test('native quota failure preserves a metadata-rich library and its subsequent confirmed restore is exact', async ({ page, context }) => {
  test.setTimeout(60_000);
  await page.goto('/#/'); await expect(page.getByText('Your reusable video creation toolkit')).toBeVisible();
  const source = await page.evaluate(async () => {
    const fixture = await import('/scripts/qa/recovery-fixture.mjs');
    const db = await import('/src/storage/db.ts'); const archive = await import('/src/storage/backupArchive.ts');
    await fixture.seedRecoveryFixture({ db, assembler: await import('/src/domain/promptAssembler.ts'), projects: await import('/src/storage/projects.ts') });
    const original = await fixture.describeRecoverySnapshot(db, archive);
    window.__certBytes = await (await import('/src/storage/backup.ts')).exportFullBackupZip();
    await db.savePromptAsset({ title: 'Synthetic quota sentinel', category: 'styles', promptText: 'Preserve this on failure.', tags: [] });
    return { original, previous: await fixture.describeRecoverySnapshot(db, archive), bytes: Array.from(window.__certBytes) };
  });
  const cdp = await context.newCDPSession(page); const origin = new URL(page.url()).origin;
  const before = await cdp.send('Storage.getUsageAndQuota', { origin });
  await cdp.send('Storage.overrideQuotaForOrigin', { origin, quotaSize: Math.ceil(before.usage) + 512 * 1024 });
  try {
    const failure = await page.evaluate(async () => {
      try { await (await import('/src/storage/backup.ts')).prepareFullBackupRestore(new Blob([window.__certBytes])); return { rejected: false }; }
      catch (error) { return { rejected: true, name: error.name, message: error.message }; }
    });
    expect(failure.rejected).toBe(true); expect(failure.name + failure.message).toMatch(/quota/i);
    const unchanged = await page.evaluate(async () => (await import('/scripts/qa/recovery-fixture.mjs')).describeRecoverySnapshot(await import('/src/storage/db.ts'), await import('/src/storage/backupArchive.ts')));
    expect(unchanged).toEqual(source.previous);
  } finally { await cdp.send('Storage.overrideQuotaForOrigin', { origin }); }
  expect((await cdp.send('Storage.getUsageAndQuota', { origin })).overrideActive).toBe(false);
  await page.reload(); await page.getByRole('button', { name: 'Open Settings and ZIP Backup' }).click();
  await page.getByLabel('Choose a backup to stage for restore').setInputFiles({ name: 'synthetic-rich.zip', mimeType: 'application/zip', buffer: Buffer.from(source.bytes) });
  await expect(page.getByRole('button', { name: 'Confirm & Replace Current Library' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm & Replace Current Library' }).click(); await expect(page.getByText(/Library replacement committed/)).toBeVisible();
  await page.reload();
  const restored = await page.evaluate(async () => {
    const fixture = await import('/scripts/qa/recovery-fixture.mjs'); const db = await import('/src/storage/db.ts');
    return { snapshot: await fixture.describeRecoverySnapshot(db, await import('/src/storage/backupArchive.ts')), decoded: await fixture.decodeRecoveryMedia(db) };
  });
  expect(restored.snapshot).toEqual(source.original);
  expect(restored.snapshot.counts).toMatchObject({ assets: 21, variants: 6, media: 29, drafts: 3, scenes: 3, collections: 4, templates: 4 });
  expect(restored.decoded.filter(item => item.playable)).toHaveLength(1);
  expect(restored.decoded.filter(item => item.decoded)).toHaveLength(28);
});
