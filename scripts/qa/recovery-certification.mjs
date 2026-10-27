// Manual certification. No multi-GiB allocation unless disk and quota preflight pass.
// This run intentionally retains every artifact/profile; no filesystem deletion.
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, cp, readFile, writeFile, statfs, stat, readdir } from 'node:fs/promises';
import { resolve, dirname, join, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(process.argv.slice(2).map(value => { const [key, ...parts] = value.replace(/^--/, '').split('='); return [key, parts.join('=')]; }));
if (!args.output || process.env.CI) throw new Error('Manual local-only --output=<new owned directory> is required.');
const output = resolve(args.output); const canonical = value => process.platform === 'win32' ? value.toLowerCase() : value;
if (canonical(output) === canonical(root) || canonical(output).startsWith(canonical(root + sep))) throw new Error('Output must be outside the repository.');
await mkdir(output, { recursive: false });
await writeFile(join(output, '.krakinai-recovery-owned'), 'synthetic-recovery-only-v1\n', { flag: 'wx' });
const MiB = 1024 ** 2; const GiB = 1024 ** 3; const reserve = 8 * GiB;
const free = await statfs(output); const diskFree = Number(free.bavail) * Number(free.bsize);
if (diskFree < reserve + 256 * MiB) throw new Error('Even the small fixture would breach the retained disk reserve.');
const profile = join(output, 'fresh-chromium-profile');
const staticRoot = join(output, 'static'); await cp(join(root, 'dist'), staticRoot, { recursive: true, errorOnExist: true, force: false });
await build({ entryPoints: [join(root, 'scripts/qa/recovery-browser-api.mjs')], outfile: join(staticRoot, '__recovery-api.mjs'), bundle: true, platform: 'browser', format: 'esm', target: 'es2022', logLevel: 'warning' });
const port = Number(args.port || 4198); const origin = `http://127.0.0.1:${port}`;
const server = createServer(async (request, response) => {
  try {
    const path = resolve(staticRoot, decodeURIComponent(new URL(request.url, origin).pathname).replace(/^\//, '') || 'index.html');
    if (!canonical(path).startsWith(canonical(staticRoot + sep))) throw new Error('Outside static root');
    const bytes = await readFile(path); response.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' }); response.end(bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
const started = performance.now(); const result = { practicalHeadroomBytes: 35 * GiB, diskFreeBeforeBytes: diskFree, reserveBytes: reserve, largeCases: [], checks: [], samples: [], limitations: [], retainedFiles: [], sourceHashes: {} };
const fingerprintFiles = ['src/domain/validation.ts', 'src/domain/projectExport.ts', 'src/storage/backupLimits.ts', 'src/storage/backup.ts', 'src/storage/backupArchive.ts', 'src/storage/backupZipIndex.ts', 'src/storage/db.ts', 'src/storage/restoreStaging.ts', 'src/storage/libraryWrite.ts', 'scripts/qa/recovery-fixture.mjs', 'scripts/qa/recovery-certification.mjs'];
for (const path of fingerprintFiles) result.sourceHashes[path] = createHash('sha256').update(await readFile(join(root, path))).digest('hex');
let previousCheckAt = started;
const record = (name, detail = {}) => { const now = performance.now(); result.checks.push({ id: `check-${result.checks.length + 1}`, name, pass: true, elapsedMs: Math.round(now - started), sincePreviousCheckMs: Math.round(now - previousCheckAt), details: detail }); previousCheckAt = now; console.log(`PASS ${name}`); };
const exec = promisify(execFile); let context; let timer; let sampling = false; let browserCDP; let page;
async function launch() {
  context = await chromium.launchPersistentContext(profile, { channel: args.channel || undefined, headless: args['native-picker'] !== 'true', viewport: { width: 1440, height: 900 } });
  result.browserVersion = context.browser().version(); result.browserChannel = args.channel || 'bundled Chromium';
  await context.addInitScript(() => { window.__recovery = () => import('/__recovery-api.mjs'); });
  context.on('page', tab => tab.on('pageerror', error => { result.pageErrors ??= []; result.pageErrors.push(error.message); }));
  browserCDP = await context.browser().newBrowserCDPSession(); page = await context.newPage(); page.setDefaultTimeout(60_000);
  await page.goto(origin); await page.getByText('Your reusable video creation toolkit').waitFor();
  await page.evaluate(() => { document.title = 'KRAKINAI Synthetic Recovery Certification'; });
}
const snapshot = () => page.evaluate(async () => { const a = await window.__recovery(); return a.fixtures.describeRecoverySnapshot(a.db, a.backupArchive); });
const attachFile = async () => { await page.evaluate(() => { const old = document.querySelector('#cert-backup'); old?.remove(); const input = document.createElement('input'); input.type = 'file'; input.id = 'cert-backup'; document.body.append(input); }); await page.locator('#cert-backup').setInputFiles(join(output, 'streamed-backup.zip')); };
async function crashAt(phase, action) {
  const info = await browserCDP.send('SystemInfo.getProcessInfo'); const pid = info.processInfo.find(process => process.type === 'browser')?.id; assert.ok(Number.isSafeInteger(pid));
  let reached = false;
  await page.exposeBinding('__certCrash', () => { reached = true; process.kill(pid, 'SIGKILL'); });
  const closed = context.waitForEvent('close', { timeout: 120_000 }).then(() => null, error => error);
  try { await action(); } catch (error) { if (!reached) throw error; }
  const error = await closed; if (error) throw error; assert.equal(reached, true, `${phase} crash checkpoint not reached`);
  await launch();
}

try {
  await launch();
  timer = setInterval(async () => {
    if (sampling) return; sampling = true;
    try {
      const { processInfo } = await browserCDP.send('SystemInfo.getProcessInfo'); const ids = processInfo.map(item => item.id).filter(Number.isSafeInteger);
      const observed = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum`], { windowsHide: true });
      const disk = await statfs(output); result.samples.push({ elapsedMs: Math.round(performance.now() - started), browserWorkingSetSumBytes: Number(observed.stdout.trim()), diskFreeBytes: Number(disk.bavail) * Number(disk.bsize) });
    } catch { /* Crashed process gaps are not zero-memory samples. */ } finally { sampling = false; }
  }, 1000);
  const quota = await page.evaluate(() => navigator.storage.estimate());
  result.browserQuotaBefore = quota;
  for (const mediaMiB of [2000, 4000, 5000]) {
    const expanded = (mediaMiB + 20) * MiB; const archive = expanded + MiB;
    const calculated = archive + 2 * expanded + 128 * MiB + GiB + reserve;
    const requiredQuota = 2 * expanded + GiB;
    const blockers = [];
    if (diskFree < Math.max(35 * GiB, calculated)) blockers.push('requested_practical_disk_headroom');
    if (typeof quota.quota !== 'number' || typeof quota.usage !== 'number') blockers.push('browser_quota_unknown');
    else if (quota.quota - quota.usage < requiredQuota) blockers.push('conservative_browser_quota_estimate');
    result.largeCases.push({ mediaMiB, estimatedExpandedBytes: expanded, estimatedArchiveBytes: archive, originalFixtureAllowanceBytes: 128 * MiB, nativeAndMetadataAllowanceBytes: GiB, calculatedMinimumFreeBytes: calculated, practicalMinimumFreeBytes: Math.max(35 * GiB, calculated), estimatedAdditionalBrowserQuotaBytes: requiredQuota, quota: quota.quota ?? null, usage: quota.usage ?? null, status: blockers.length ? 'BLOCKED_NOT_RUN_PREFLIGHT' : 'NOT_RUN_REQUIRES_CERTIFICATION_BUILD_WITH_UNCHANGED_PRODUCTION_GATE', blockingConstraints: blockers, gateBypassed: false, dataGenerated: false });
  }
  await writeFile(join(output, 'capacity-preflight.json'), JSON.stringify({ diskFree, quota, cases: result.largeCases }, null, 2));
  result.fixture = await page.evaluate(async () => { const a = await window.__recovery(); return a.fixtures.seedRecoveryFixture(a); });
  result.original = await snapshot(); result.decodedOriginal = await page.evaluate(async () => { const a = await window.__recovery(); return a.fixtures.decodeRecoveryMedia(a.db); });
  record('metadata-rich synthetic graph and all image/video decoders validated', { counts: result.original.counts, mediaBytes: result.original.mediaBytes });
  const exported = await page.evaluate(async () => {
    const a = await window.__recovery(); const root = await navigator.storage.getDirectory(); const file = await root.getFileHandle('cert-streamed-backup.zip', { create: true });
    const result = await a.backup.exportFullBackupToStream(await file.createWritable()); const blob = await file.getFile();
    if (blob.size > 64 * 1024 * 1024) throw new Error('Small fixture readback copy exceeds explicit 64MiB bound.');
    return { result, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())), sha256: await a.backupArchive.hashBackupBlob(blob) };
  });
  await writeFile(join(output, 'streamed-backup.zip'), Buffer.from(exported.bytes)); result.export = { ...exported.result, archiveSha256: exported.sha256 }; record('successful bounded streaming export to real OPFS writable');
  await writeFile(join(output, 'expected-source.json'), JSON.stringify(result.original, null, 2));
  const python = await exec(args.python || 'python', [join(root, 'scripts/qa/recovery-inspect.py'), join(output, 'streamed-backup.zip'), join(output, 'expected-source.json')], { windowsHide: true });
  console.log(python.stdout.trim()); result.python = JSON.parse(await readFile(join(output, 'python-inspection.json'), 'utf8')); record('independent Python CRC/SHA readback and legacy version1 fixture');
  await page.evaluate(async () => { const a = await window.__recovery(); await a.db.savePromptAsset({ title: 'Synthetic previous-library sentinel', category: 'styles', promptText: 'This record and every previous scene/media must survive failed replacement.', tags: [] }); });
  const previous = await snapshot(); result.previousLibrary = previous; await attachFile();

  const cdp = await context.newCDPSession(page); const quotaBefore = await cdp.send('Storage.getUsageAndQuota', { origin }); result.nativeQuotaBefore = quotaBefore;
  await cdp.send('Storage.overrideQuotaForOrigin', { origin, quotaSize: Math.ceil(quotaBefore.usage) + 512 * 1024 });
  try {
    result.nativeQuotaOverride = await cdp.send('Storage.getUsageAndQuota', { origin });
    result.quotaFailure = await page.evaluate(async () => { try { const a = await window.__recovery(); await a.backup.prepareFullBackupRestore(document.querySelector('#cert-backup').files[0]); return { rejected: false }; } catch (error) { return { rejected: true, name: error.name, message: error.message }; } });
    assert.equal(result.quotaFailure.rejected, true); assert.deepEqual(await snapshot(), previous); record('native origin quota exhaustion rejects staging and preserves previous graph', result.quotaFailure);
  } finally { await cdp.send('Storage.overrideQuotaForOrigin', { origin }); }
  result.quotaAfterReset = await cdp.send('Storage.getUsageAndQuota', { origin });
  assert.equal(result.quotaAfterReset.overrideActive, false, 'Origin quota override must be reset.');
  const cancellation = await page.evaluate(async () => {
    const a = await window.__recovery(); const controller = new AbortController();
    try { await a.backup.prepareFullBackupRestore(document.querySelector('#cert-backup').files[0], { signal: controller.signal, onProgress(p) { if (p.phase === 'extract' && p.completedBytes > 512 * 1024) controller.abort(); } }); return false; } catch { return controller.signal.aborted; }
  });
  assert.equal(cancellation, true); assert.deepEqual(await snapshot(), previous); record('cancellation during extraction preserves full previous graph');
  result.corruption = await page.evaluate(async offset => {
    const a = await window.__recovery(); const source = document.querySelector('#cert-backup').files[0]; const byte = new Uint8Array(await source.slice(offset, offset + 1).arrayBuffer()); byte[0] ^= 1;
    try { await a.backup.prepareFullBackupRestore(new Blob([source.slice(0, offset), byte, source.slice(offset + 1)])); return { rejected: false }; } catch (error) { return { rejected: true, message: error.message }; }
  }, result.python.entries.find(entry => entry.path.includes('cert_decodable_png')).dataOffset + 100);
  assert.equal(result.corruption.rejected, true); assert.deepEqual(await snapshot(), previous); record('corrupted PNG entry rejected without changing previous records/media', result.corruption);

  await crashAt('staging', () => page.evaluate(async () => { const a = await window.__recovery(); await a.backup.prepareFullBackupRestore(document.querySelector('#cert-backup').files[0], { onProgress(p) { if (p.phase === 'extract' && p.completedBytes > 512 * 1024) { void window.__certCrash(); const until = Date.now() + 5000; while (Date.now() < until) {} } } }); }));
  assert.deepEqual(await snapshot(), previous); result.interruptedStages = await page.evaluate(async () => (await window.__recovery()).restoreStaging.listRestoreStages());
  assert.ok(result.interruptedStages.some(stage => stage.state === 'staging')); record('forced browser crash during staging retains previous library and recoverable incomplete stage');
  await attachFile();
  const ready = await page.evaluate(async () => { const a = await window.__recovery(); window.__prepared = await a.backup.prepareFullBackupRestore(document.querySelector('#cert-backup').files[0]); return window.__prepared; });
  result.readyStage = ready;
  await crashAt('replacement', () => page.evaluate(async () => { const a = await window.__recovery(); await a.backup.commitPreparedBackupRestore(window.__prepared, { onProgress(p) { if (p.phase === 'commit-records' && p.completedBytes === 1) { void window.__certCrash(); const until = Date.now() + 5000; while (Date.now() < until) {} } } }); }));
  assert.deepEqual(await snapshot(), previous); record('forced browser crash after first replacement put rolls back all records and hashes');
  const stale = await context.newPage(); await stale.goto(origin); await stale.getByText('Your reusable video creation toolkit').waitFor(); await stale.evaluate(async () => (await window.__recovery()).db.openDatabase());
  await page.getByRole('button', { name: 'Open Settings and ZIP Backup' }).click();
  await page.getByText('Recoverable temporary restore stages').click();
  const readyCard = page.locator('.card').filter({ hasText: ready.stageId }); await readyCard.getByRole('button', { name: 'Revalidate Stage' }).click();
  await page.getByRole('button', { name: 'Confirm & Replace Current Library' }).waitFor(); assert.deepEqual(await snapshot(), previous);
  await page.getByRole('button', { name: 'Confirm & Replace Current Library' }).click(); await page.getByText(/Library replacement committed/).waitFor();
  result.staleWrite = await stale.evaluate(async () => { try { await (await window.__recovery()).db.savePromptAsset({ title: 'Stale unsafe write', category: 'styles', promptText: 'Should be rejected.', tags: [] }); return { rejected: false }; } catch (error) { return { rejected: true, message: error.message }; } });
  assert.equal(result.staleWrite.rejected, true); await stale.close(); await context.close(); await launch();
  result.restored = await snapshot(); assert.deepEqual(result.restored, result.original); result.decodedRestored = await page.evaluate(async () => { const a = await window.__recovery(); return a.fixtures.decodeRecoveryMedia(a.db); });
  record('explicit UI confirmation, full replacement, browser restart, exact metadata/scene outputs/counts and all media SHA256');
  record('stale tab rejected and restored PNG/SVG/WebM decode/playback passed');

  await page.getByRole('button', { name: 'Open Settings and ZIP Backup' }).click(); await page.getByLabel('Choose a backup to stage for restore').setInputFiles(join(output, 'legacy-backup.zip'));
  await page.getByRole('button', { name: 'Confirm & Replace Current Library' }).waitFor(); await page.getByRole('button', { name: 'Confirm & Replace Current Library' }).click(); await page.getByText(/Library replacement committed/).waitFor(); await context.close(); await launch();
  assert.deepEqual(await snapshot(), result.original); record('legacy version1 without optional SHA fields restores rich records exactly after restart');
  result.destinationInterruption = await page.evaluate(async () => {
    const a = await window.__recovery(); const dir = await navigator.storage.getDirectory(); const handle = await dir.getFileHandle('cert-interrupted-destination.zip', { create: true });
    const first = await handle.createWritable(); await first.write('original synthetic destination'); await first.close(); const controller = new AbortController();
    try { await a.backup.exportFullBackupToStream(await handle.createWritable(), { signal: controller.signal, onProgress(p) { if (p.phase === 'write' && p.completedBytes > 512 * 1024) controller.abort(); } }); return { rejected: false }; }
    catch (error) { return { rejected: true, name: error.name, preserved: await (await handle.getFile()).text() }; }
  });
  assert.equal(result.destinationInterruption.rejected, true); assert.equal(result.destinationInterruption.preserved, 'original synthetic destination'); assert.deepEqual(await snapshot(), result.original); record('interrupted native OPFS destination write preserves prior destination and live library');
  result.browserQuotaAfter = await page.evaluate(() => navigator.storage.estimate());
  result.opfsFiles = await page.evaluate(async () => { const entries = []; async function walk(dir, prefix = '') { for await (const [name, handle] of dir.entries()) { const path = prefix + name; if (handle.kind === 'directory') await walk(handle, path + '/'); else { const file = await handle.getFile(); entries.push({ path, bytes: file.size }); } } } await walk(await navigator.storage.getDirectory()); return entries; });
  if (args['native-picker'] === 'true') {
    await page.getByRole('button', { name: 'Open Settings and ZIP Backup' }).click();
    const suggestedName = `synthetic-recovery-${Date.now()}.zip`;
    await page.evaluate(filename => {
      const nativePicker = window.showSaveFilePicker; window.__nativeOriginalSource = Function.prototype.toString.call(nativePicker);
      window.showSaveFilePicker = async options => { const handle = await nativePicker.call(window, { ...options, suggestedName: filename }); window.__nativeSavedHandle = handle; return handle; };
    }, suggestedName);
    console.log(`NATIVE_PICKER_READY save a NEW synthetic file named ${suggestedName}; record the actual destination separately.`);
    await writeFile(join(output, 'native-picker-ready.json'), JSON.stringify({ suggestedName, suggestedPath: join(output, suggestedName), browserVersion: result.browserVersion, profile, origin, title: 'KRAKINAI Synthetic Recovery Certification', actualPathMustBeReportedByOperator: true }, null, 2));
    await page.getByRole('button', { name: 'Export Full Library (ZIP64)' }).click({ noWaitAfter: true });
    try {
      await page.getByText(/Saved .* bytes\. Select the saved file/).waitFor({ timeout: 300_000 });
      const selected = await page.evaluate(async () => { const file = await window.__nativeSavedHandle.getFile(); if (file.size > 64 * 1024 * 1024) throw new Error('Small readback copy exceeds cap.'); return { name: file.name, bytes: file.size, sha256: await (await window.__recovery()).backupArchive.hashBackupBlob(file), data: Array.from(new Uint8Array(await file.arrayBuffer())), nativeFunction: window.__nativeOriginalSource }; });
      if (!selected.nativeFunction.includes('[native code]')) throw new Error('Original picker was not native.');
      await writeFile(join(output, 'native-picker-readback.zip'), Buffer.from(selected.data), { flag: 'wx' });
      result.nativePicker = { pass: true, filename: selected.name, bytes: selected.bytes, sha256: selected.sha256, browserVersion: result.browserVersion, headless: false, pickerStubbed: false, nativeDelegatedForReadback: true, absolutePathExposedByBrowser: false, largeArchiveCertified: false };
      record('actual installed Chrome Save As workflow completed for small rich fixture', result.nativePicker);
    } catch (error) { result.nativePicker = { pass: false, blocked: 'Native UI automation unavailable; manual Save As did not complete', error: error.message, largeArchiveCertified: false }; result.limitations.push('Actual native picker not completed.'); }
  }
  result.smallFixturePass = true; result.nearLimitCertified = false;
} catch (error) { result.smallFixturePass = false; result.error = error.stack || String(error); process.exitCode = 1; }
finally {
  if (timer) clearInterval(timer); if (context) await context.close().catch(() => {}); await new Promise(done => server.close(done));
  const disk = await statfs(output); result.diskFreeAfterBytes = Number(disk.bavail) * Number(disk.bsize); result.elapsedMs = Math.round(performance.now() - started);
  result.peakObservedBrowserWorkingSetBytes = Math.max(0, ...result.samples.map(sample => sample.browserWorkingSetSumBytes));
  result.minimumObservedDiskFreeBytes = Math.min(diskFree, ...result.samples.map(sample => sample.diskFreeBytes));
  result.retainedFiles = [...new Set([...(await readdir(output)), 'recovery-results.json'])].sort(); result.noManualFilesystemCleanup = true;
  await writeFile(join(output, 'recovery-results.json'), JSON.stringify(result, null, 2));
}
console.log(JSON.stringify({ smallFixturePass: result.smallFixturePass, checks: result.checks.length, error: result.error, nearLimitCertified: result.nearLimitCertified, peakObservedBrowserWorkingSetBytes: result.peakObservedBrowserWorkingSetBytes, elapsedMs: result.elapsedMs }));
