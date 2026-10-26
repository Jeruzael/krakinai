import { test, expect } from '@playwright/test';

test('native writable abort preserves an existing file on injected quota, permission and cancellation failures', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByText('Your reusable video creation toolkit')).toBeVisible();
  const evidence = await page.evaluate(async () => {
    const db = await import('/src/storage/db.ts');
    const backup = await import('/src/storage/backup.ts');
    // Synthetic nonplayable bytes exercise storage, not an image-decoder fixture.
    await db.saveMediaAsset({ id: 'synthetic_failure_media', filename: 'synthetic.png', mimeType: 'image/png', blob: new Blob([new Uint8Array(1024 * 1024).fill(27)], { type: 'image/png' }) });
    const before = await db.captureRestoreBaseline();
    const directory = await navigator.storage.getDirectory();
    const results = [];
    for (const failure of ['QuotaExceededError', 'NotAllowedError', 'AbortError']) {
      const handle = await directory.getFileHandle(`synthetic-${failure}.zip`, { create: true });
      const original = await handle.createWritable(); await original.write('existing synthetic destination'); await original.close();
      const target = await handle.createWritable();
      const controller = new AbortController();
      let writes = 0; let aborted = false; let closed = false; let message = '';
      const sink = new WritableStream({
        async write(chunk) {
          if (++writes === 2) {
            if (failure === 'AbortError') controller.abort(new DOMException('Synthetic cancellation.', 'AbortError'));
            else {
              // A Web Stream whose write throws is already errored, so its abort
              // algorithm is no longer called. The injecting adapter owns and
              // closes the nested native file before surfacing its synthetic fault.
              const error = new DOMException('Synthetic destination failure.', failure);
              await target.abort(error); aborted = true; throw error;
            }
          }
          await target.write(chunk);
        },
        async close() { await target.close(); closed = true; },
        async abort(reason) { aborted = true; await target.abort(reason); },
      });
      let rejected = false;
      try { await backup.exportFullBackupToStream(sink, { signal: controller.signal }); }
      catch (error) { rejected = true; message = error.message; }
      const preserved = await (await handle.getFile()).text();
      await directory.removeEntry(`synthetic-${failure}.zip`);
      results.push({ failure, rejected, aborted, closed, preserved, writes, message });
    }
    return { results, before, after: await db.captureRestoreBaseline() };
  });
  expect(evidence.after).toEqual(evidence.before);
  expect(evidence.results).toHaveLength(3);
  for (const result of evidence.results) {
    expect(result.rejected, result.failure).toBe(true);
    expect(result.aborted, result.failure).toBe(true);
    expect(result.closed, result.failure).toBe(false);
    expect(result.preserved, result.failure).toBe('existing synthetic destination');
  }
});
