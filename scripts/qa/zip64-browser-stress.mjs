// Manual local-only. Uses only a marker-owned disposable profile, never the user's browser.
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile, statfs, lstat, realpath, cp, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { build as esbuild } from 'esbuild';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...v] = arg.replace(/^--/, '').split('='); return [key, v.join('=')]; }));
if (!args.output || process.env.CI) throw new Error('Manual local-only --output=<owned archive stress directory> is required.');
const output = resolve(args.output);
assert.equal(await readFile(join(output, '.krakinai-synthetic-stress'), 'utf8'), 'synthetic-only-v1\n');
const archive = JSON.parse(await readFile(join(output, 'archive-results.json'), 'utf8'));
assert.equal(archive.archiveLayerOnly, false, 'The generic 5,500MiB archive is not a restorable library.');
const reserve = 8192 * 1024 * 1024;
const free = await statfs(output); const freeBytes = Number(free.bavail) * Number(free.bsize);
// At most staging+IDB, or IDB+reexport, coexist with the already existing input ZIP.
if (freeBytes - archive.uncompressedBytes * 2 < reserve) throw new Error(`Insufficient reserved disk for browser stage+IDB: ${freeBytes} free, ${archive.uncompressedBytes * 2} additional, reserve ${reserve}.`);
const profileName = args['profile-name'] || 'disposable-browser-profile';
if (!/^disposable-browser-profile(?:-[a-z0-9]+)?$/.test(profileName)) throw new Error('Invalid owned profile name.');
const profile = join(output, profileName);
const outputReal = await realpath(output);
const outputStat = await lstat(output);
if (!outputStat.isDirectory() || outputStat.isSymbolicLink()) throw new Error('Output must be a real owned directory.');
const canonical = path => process.platform === 'win32' ? path.toLowerCase() : path;
const repoReal = canonical(await realpath(root));
const ownedReal = canonical(outputReal);
if (ownedReal === repoReal || ownedReal.startsWith(repoReal + sep)) throw new Error('Stress output must be outside the repository.');
let reusedProfile = false;
let adoptRetryMarker = false;
try { const info = await lstat(profile); reusedProfile = true; if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Profile is not a real directory.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (reusedProfile) {
  if (args['reuse-owned-profile'] !== 'true') throw new Error('Existing disposable profile requires --reuse-owned-profile=true.');
  const profileReal = await realpath(profile);
  if (!canonical(profileReal).startsWith(ownedReal + sep)) throw new Error('Profile resolves outside the owned output directory.');
  // The current 1GiB retry profile predates per-profile markers. Its synthetic
  // contents are checked in-browser before this one-time marker adoption.
  const marker = join(profile, '.krakinai-owned-profile');
  try { assert.equal(await readFile(marker, 'utf8'), `synthetic-profile-v1:${profileName}\n`); }
  catch (error) {
    if (error.code !== 'ENOENT' || profileName !== 'disposable-browser-profile-retry') throw error;
    await access(join(profile, 'Default'));
    const prior = JSON.parse(await readFile(join(output, 'browser-dev-results.json'), 'utf8'));
    if (prior.requestedMiB !== 1024 || !prior.pass) throw new Error('Unmarked retry profile lacks the prior synthetic-only run evidence.');
    adoptRetryMarker = true;
  }
} else {
  if (args['reuse-owned-profile'] === 'true') throw new Error('Requested profile reuse, but the owned profile is absent.');
  await mkdir(profile, { recursive: false });
  await writeFile(join(profile, '.krakinai-owned-profile'), `synthetic-profile-v1:${profileName}\n`);
}
const port = Number(args.port || 4196);
const url = `http://127.0.0.1:${port}`;
try { await access(join(output, 'browser-dev-results.json')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  let priorExists = false;
  try { await access(join(output, 'browser-results.json')); priorExists = true; }
  catch (priorError) { if (priorError.code !== 'ENOENT') throw priorError; }
  if (priorExists) {
    await cp(join(output, 'browser-results.json'), join(output, 'browser-dev-results.json'), { force: false, errorOnExist: true });
  }
}
const staticRoot = join(output, 'production-static');
let reuseStatic = false;
try { const info = await lstat(staticRoot); reuseStatic = true; if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Static snapshot must be a real directory.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (reuseStatic) {
  if (args['reuse-static'] !== 'true' || !canonical(await realpath(staticRoot)).startsWith(ownedReal + sep)) throw new Error('Existing static snapshot requires --reuse-static=true inside owned output.');
} else {
  await mkdir(staticRoot, { recursive: false });
  await cp(join(root, 'dist'), staticRoot, { recursive: true, force: false });
  await esbuild({ entryPoints: [join(root, 'scripts/qa/zip64-browser-api.mjs')], outfile: join(staticRoot, '__qa-api.mjs'), bundle: true, platform: 'browser', format: 'esm', target: 'es2022', logLevel: 'warning' });
}
const git = promisify(execFile);
const [base, changes] = await Promise.all([
  git('git', ['rev-parse', 'HEAD'], { cwd: root }),
  git('git', ['status', '--porcelain'], { cwd: root }),
]);
const sourceFiles = ['src/App.tsx', 'src/components/FullLibraryBackupPanel.tsx', 'src/components/SharedModals.tsx', 'src/components/LibraryReloadNotice.tsx', 'src/storage/db.ts', 'src/storage/backup.ts', 'src/storage/backupArchive.ts', 'src/storage/backupZipIndex.ts', 'src/storage/backupLimits.ts', 'src/storage/libraryWrite.ts', 'src/storage/restoreStaging.ts', 'src/domain/validation.ts', 'scripts/qa/zip64-browser-stress.mjs', 'scripts/qa/zip64-browser-api.mjs', 'package-lock.json'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const currentBuildMetadata = { builtAt: new Date().toISOString(), buildCommand: 'npm run build (completed before this harness)', gitBase: base.stdout.trim(), dirty: changes.stdout.trim().length > 0,
  sourceHashes: Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, sha256(await readFile(join(root, path)))]))),
  distIndexSha256: sha256(await readFile(join(staticRoot, 'index.html'))), qaApiSha256: sha256(await readFile(join(staticRoot, '__qa-api.mjs'))) };
const buildMetadata = reuseStatic ? JSON.parse(await readFile(join(staticRoot, 'qa-build-metadata.json'), 'utf8')) : currentBuildMetadata;
if (reuseStatic) {
  for (const path of sourceFiles.filter(path => !path.startsWith('scripts/qa/'))) assert.equal(currentBuildMetadata.sourceHashes[path], buildMetadata.sourceHashes[path], `Production source changed after static snapshot: ${path}`);
  assert.equal(currentBuildMetadata.distIndexSha256, buildMetadata.distIndexSha256);
  assert.equal(currentBuildMetadata.qaApiSha256, buildMetadata.qaApiSha256);
} else await writeFile(join(staticRoot, 'qa-build-metadata.json'), JSON.stringify(buildMetadata, null, 2));
const contentType = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, url).pathname);
    const target = resolve(staticRoot, pathname === '/' ? 'index.html' : pathname.slice(1));
    if (!target.startsWith(staticRoot + sep)) throw new Error('Invalid static path.');
    const bytes = await readFile(target);
    response.writeHead(200, { 'content-type': contentType[extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' }); response.end(bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise((resolveListen, rejectListen) => { server.once('error', rejectListen); server.listen(port, '127.0.0.1', resolveListen); });
const started = performance.now();
const result = { requestedMiB: archive.requestedMiB, compressedBytes: archive.compressedBytes, uncompressedBytes: archive.uncompressedBytes, mediaBytes: archive.mediaBytes, checks: [], memorySamples: [], diskFreeBeforeBytes: freeBytes, reserveBytes: reserve, samplingIntervalMs: 1000, peakObservedBrowserWorkingSetBytes: 0, peakObservedJsHeapBytes: 0, profile: reusedProfile ? 'reused marker-owned disposable persistent Chromium profile' : 'new marker-owned disposable persistent Chromium profile', osSaveDialogTested: false, buildMetadata, staticOrigin: url };
let context; let sampler; let sampling = false;
const powershell = promisify(execFile);
const record = (name, details = {}) => { result.checks.push({ name, pass: true, ...details }); console.log(`PASS ${name}`); };
try {
  context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 1440, height: 900 }, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  await context.addInitScript(() => { window.__qaImport = async name => (await import('/__qa-api.mjs'))[name]; });
  let browserCDP = await context.browser().newBrowserCDPSession();
  context.on('page', tab => tab.on('pageerror', error => { result.pageErrors ??= []; result.pageErrors.push(error.message); }));
  let page = await context.newPage();
  page.setDefaultTimeout(600_000);
  await page.goto(url); await page.getByText('Your reusable video creation toolkit').waitFor();
  await page.getByRole('button', { name: 'Open Settings and ZIP Backup' }).click();
  await page.getByRole('dialog', { name: 'Settings & Local Data Backup' }).getByText('Full Library Backup', { exact: true }).waitFor();
  await page.getByRole('dialog', { name: 'Settings & Local Data Backup' }).getByRole('button', { name: 'Close', exact: true }).click();
  record('production UI shell and Settings backup panel load without Vite/HMR');
  let cdp = await context.newCDPSession(page); await cdp.send('Performance.enable');
  sampler = setInterval(async () => {
    if (sampling) return; sampling = true;
    try {
      const { processInfo } = await browserCDP.send('SystemInfo.getProcessInfo');
      const ids = processInfo.map(p => p.id).filter(Number.isSafeInteger);
      const ps = await powershell('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$r=Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue; ($r | Measure-Object WorkingSet64 -Sum).Sum`], { windowsHide: true });
      const rss = Number(ps.stdout.trim());
      const { metrics } = await cdp.send('Performance.getMetrics');
      const heap = metrics.find(m => m.name === 'JSHeapUsedSize')?.value || 0;
      result.memorySamples.push({ elapsedMs: Math.round(performance.now() - started), workingSetSumBytes: rss, jsHeapBytes: heap });
      result.peakObservedBrowserWorkingSetBytes = Math.max(result.peakObservedBrowserWorkingSetBytes, rss);
      result.peakObservedJsHeapBytes = Math.max(result.peakObservedJsHeapBytes, heap);
    } catch { /* A process may exit between enumeration and the sample. Missing samples are not zero-memory observations. */ }
    finally { sampling = false; }
  }, 1000);
  const ownedContents = await page.evaluate(async ({ expected, reused }) => {
    const db = await window.__qaImport('db');
    const engine = await window.__qaImport('backupArchive');
    const snap = await db.getAllSnapshot();
    if (snap.assets.length || snap.variants.length || snap.drafts.length || snap.scenes.length) throw new Error('Owned profile contains non-synthetic library records.');
    if (snap.collections.length > 1 || snap.collections.some(item => item.name !== 'Synthetic original collection')) throw new Error('Owned profile contains an unexpected collection.');
    if (snap.templates.some(item => !item.isStarter)) throw new Error('Owned profile contains a non-starter template.');
    const expectedCount = reused ? Object.keys(expected).filter(path => path.startsWith('media/')).length : 0;
    if (snap.media.length !== expectedCount) throw new Error('Owned profile media count does not match the expected synthetic starting state.');
    const media = [];
    for (const item of snap.media) {
      if (!/^synthetic_\d{4}$/.test(item.id) || item.mimeType !== 'video/mp4' || item.posterBlob) throw new Error('Owned profile contains non-synthetic media.');
      const hash = await engine.hashBackupBlob(item.blob);
      if (hash !== expected[`media/${item.id}.mp4`]) throw new Error(`Owned profile media hash mismatch: ${item.id}`);
      media.push({ id: item.id, bytes: item.blob.size, sha256: hash });
    }
    return { media, collections: snap.collections.map(item => item.name), templates: snap.templates.length };
  }, { expected: archive.expectedHashes, reused: reusedProfile });
  record(reusedProfile ? 'reused owned profile contains only expected synthetic records and exact media hashes' : 'fresh owned profile is empty apart from starter templates', { mediaCount: ownedContents.media.length, collections: ownedContents.collections, templates: ownedContents.templates });
  if (adoptRetryMarker) await writeFile(join(profile, '.krakinai-owned-profile'), `synthetic-profile-v1:${profileName}\n`);
  await page.evaluate(async () => {
    const db = await window.__qaImport('db');
    if ((await db.getAllSnapshot()).collections.length === 0) await db.createCollection({ name: 'Synthetic original collection' });
    window.__heartbeat = 0; window.__heartbeatTimer = setInterval(() => window.__heartbeat++, 20);
    const input = document.createElement('input'); input.type = 'file'; input.id = 'synthetic-archive'; document.body.append(input);
  });
  await page.locator('#synthetic-archive').setInputFiles(archive.archivePath);
  const baseline = await page.evaluate(async () => (await window.__qaImport('db')).captureRestoreBaseline());
  const verification = await page.evaluate(async () => (await window.__qaImport('backup')).verifyFullBackupFile(document.querySelector('#synthetic-archive').files[0]));
  assert.equal(verification.summary.totalMediaBytes, archive.mediaBytes);
  assert.deepEqual(await page.evaluate(async () => (await window.__qaImport('db')).captureRestoreBaseline()), baseline);
  record('full file verification preserves live library', { report: verification });

  if (args.extended === 'true') {
    const cancelled = await page.evaluate(async () => {
      const controller = new AbortController();
      try { await (await window.__qaImport('backup')).prepareFullBackupRestore(document.querySelector('#synthetic-archive').files[0], { signal: controller.signal, onProgress(p) { if (p.phase === 'extract' && p.completedBytes > 4 * 1024 * 1024) controller.abort(); } }); return false; }
      catch { return controller.signal.aborted; }
    });
    assert.equal(cancelled, true);
    assert.deepEqual(await page.evaluate(async () => (await window.__qaImport('db')).captureRestoreBaseline()), baseline);
    record('cancellation during decompression preserves original library');
    const corruption = await page.evaluate(async () => {
      const file = document.querySelector('#synthetic-archive').files[0];
      const byte = new Uint8Array(await file.slice(1024, 1025).arrayBuffer()); byte[0] ^= 1;
      const corrupted = new Blob([file.slice(0, 1024), byte, file.slice(1025)]);
      try { await (await window.__qaImport('backup')).verifyFullBackupFile(corrupted); return { rejected: false }; }
      catch (err) { return { rejected: true, message: err.message }; }
    });
    assert.equal(corruption.rejected, true);
    assert.deepEqual(await page.evaluate(async () => (await window.__qaImport('db')).captureRestoreBaseline()), baseline);
    record('physical member corruption rejected without live writes', corruption);
  }

  const prepared = await page.evaluate(async () => {
    window.__prepared = await (await window.__qaImport('backup')).prepareFullBackupRestore(document.querySelector('#synthetic-archive').files[0]);
    return window.__prepared;
  });
  record('restore staging reaches validated preview', { stageId: prepared.stageId });
  // Reload simulates a restarted page. The persisted stage must survive and rehash before reuse.
  await page.reload(); await page.getByText('Your reusable video creation toolkit').waitFor();
  const resumed = await page.evaluate(async id => {
    window.__heartbeat = 0; window.__heartbeatTimer = setInterval(() => window.__heartbeat++, 20);
    window.__prepared = await (await window.__qaImport('backup')).resumeFullBackupRestore(id); return window.__prepared;
  }, prepared.stageId);
  assert.equal(resumed.uncompressedBytes, archive.uncompressedBytes);
  record('persisted stage reopens and rehashes after page restart');

  if (args.crash === 'true') {
    const { processInfo } = await browserCDP.send('SystemInfo.getProcessInfo');
    const ownedBrowserPid = processInfo.find(item => item.type === 'browser')?.id;
    assert.ok(Number.isSafeInteger(ownedBrowserPid) && ownedBrowserPid > 0);
    let checkpoint = false;
    await page.exposeBinding('__syntheticCrashCommit', () => {
      checkpoint = true;
      // PID comes only from the newly launched disposable context. Never enumerate or stop user browsers.
      process.kill(ownedBrowserPid, 'SIGKILL');
    });
    // Rechecking a large stage precedes the first native put. Handle timeout immediately
    // to avoid an unhandled rejection while that bounded but lengthy rehash is running.
    const closed = context.waitForEvent('close', { timeout: 600_000 }).then(() => null, error => error);
    await page.evaluate(async () => {
      await (await window.__qaImport('backup')).commitPreparedBackupRestore(window.__prepared, { onProgress(p) {
        if (p.phase === 'commit-records' && p.completedBytes === 1) {
          void window.__syntheticCrashCommit();
          // Keep this native request callback active until the controller kills the owned browser.
          // No asynchronous filesystem work is inserted into the transaction.
          const until = Date.now() + 10_000; while (Date.now() < until) {}
        }
      } });
    }).catch(() => {});
    const closeError = await closed; if (closeError) throw closeError;
    assert.equal(checkpoint, true);
    context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 1440, height: 900 }, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
    await context.addInitScript(() => { window.__qaImport = async name => (await import('/__qa-api.mjs'))[name]; });
    context.on('page', tab => tab.on('pageerror', error => { result.pageErrors ??= []; result.pageErrors.push(error.message); }));
    browserCDP = await context.browser().newBrowserCDPSession(); page = await context.newPage();
    page.setDefaultTimeout(600_000);
    cdp = await context.newCDPSession(page); await cdp.send('Performance.enable');
    await page.goto(url); await page.getByText('Your reusable video creation toolkit').waitFor();
    assert.deepEqual(await page.evaluate(async () => (await window.__qaImport('db')).captureRestoreBaseline()), baseline);
    const recovered = await page.evaluate(async expected => {
      const media = (await (await window.__qaImport('db')).getAllSnapshot()).media;
      const engine = await window.__qaImport('backupArchive');
      for (const item of media) if (await engine.hashBackupBlob(item.blob) !== expected[`media/${item.id}.mp4`]) throw new Error(`Crash recovery changed original media: ${item.id}`);
      return media.length;
    }, archive.expectedHashes);
    assert.equal(recovered, ownedContents.media.length);
    await page.evaluate(async id => { window.__prepared = await (await window.__qaImport('backup')).resumeFullBackupRestore(id); }, prepared.stageId);
    record('whole owned browser killed after first live put: original library/media hashes and ready stage recovered', { checkpointRecords: 1, recoveredMediaCount: recovered });
  }

  if (args.extended === 'true') {
    const rollback = await page.evaluate(async () => {
      const original = IDBObjectStore.prototype.put; let mediaPuts = 0;
      IDBObjectStore.prototype.put = function(...params) { if (this.name === 'media' && ++mediaPuts === 2) throw new DOMException('Synthetic quota failure.', 'QuotaExceededError'); return original.apply(this, params); };
      try { await (await window.__qaImport('backup')).commitPreparedBackupRestore(window.__prepared); return { rejected: false }; }
      catch (err) { return { rejected: true, message: err.message, mediaPuts }; }
      finally { IDBObjectStore.prototype.put = original; }
    });
    assert.equal(rollback.rejected, true); assert.equal(rollback.mediaPuts, 2);
    assert.deepEqual(await page.evaluate(async () => (await window.__qaImport('db')).captureRestoreBaseline()), baseline);
    record('injected native put quota failure rolls back cleared stores and prior media put', rollback);
    const aborted = await page.evaluate(async () => {
      const controller = new AbortController();
      try { await (await window.__qaImport('backup')).commitPreparedBackupRestore(window.__prepared, { signal: controller.signal, onProgress(p) { if (p.phase === 'commit-records' && p.completedBytes >= 1) controller.abort(); } }); return false; }
      catch { return controller.signal.aborted; }
    });
    assert.equal(aborted, true); assert.deepEqual(await page.evaluate(async () => (await window.__qaImport('db')).captureRestoreBaseline()), baseline);
    record('cancellation inside live transaction rolls back all stores');
  }
  const staleTab = await context.newPage(); await staleTab.goto(url); await staleTab.getByText('Your reusable video creation toolkit').waitFor();
  await staleTab.evaluate(async () => { await (await window.__qaImport('db')).openDatabase(); });
  await page.evaluate(async () => (await window.__qaImport('backup')).commitPreparedBackupRestore(window.__prepared));
  record('atomic replacement completes');
  const stale = await staleTab.evaluate(async () => { try { await (await window.__qaImport('db')).createCollection({ name: 'STALE MUST NOT SAVE' }); return { rejected: false }; } catch (err) { return { rejected: true, message: err.message }; } });
  assert.equal(stale.rejected, true); assert.match(stale.message, /Reload/);
  record('other current-build tab cannot write stale state after restore', stale);
  await page.evaluate(async id => { await (await window.__qaImport('restoreStaging')).openRestoreStage(id).then(stage => stage.discard()); }, prepared.stageId);
  await page.reload(); await page.getByText('Your reusable video creation toolkit').waitFor();
  const restored = await page.evaluate(async expected => {
    const snapshot = await (await window.__qaImport('db')).getAllSnapshot();
    const engine = await window.__qaImport('backupArchive');
    const hashes = [];
    for (const media of snapshot.media) { const hash = await engine.hashBackupBlob(media.blob); if (hash !== expected[`media/${media.id}.mp4`]) throw new Error(`Restored hash mismatch: ${media.id}`); hashes.push({ id: media.id, bytes: media.blob.size, hash }); }
    return { hashes, count: snapshot.media.length, collections: snapshot.collections.length };
  }, archive.expectedHashes);
  assert.equal(restored.count, verification.summary.mediaCount); assert.equal(restored.collections, 0);
  record('all restored Blob hashes survive stage deletion and page reload', { mediaCount: restored.count });
  const direct = await page.evaluate(async expected => {
    window.__heartbeat = 0; const timer = setInterval(() => window.__heartbeat++, 20);
    try {
      const dir = await navigator.storage.getDirectory(); const handle = await dir.getFileHandle('synthetic-direct-export.zip', { create: true });
      const result = await (await window.__qaImport('backup')).exportFullBackupToStream(await handle.createWritable());
      const file = await handle.getFile();
      const verified = await (await window.__qaImport('backupArchive')).readBackupArchive(file, async () => new WritableStream({ write() {} }));
      for (const entry of verified.entries) if (entry.path.startsWith('media/') && entry.sha256 !== expected[entry.path]) throw new Error('Direct export hash mismatch');
      await dir.removeEntry('synthetic-direct-export.zip');
      return { bytes: result.compressedBytes, expandedBytes: result.uncompressedBytes, heartbeatTicks: window.__heartbeat };
    } finally { clearInterval(timer); }
  }, archive.expectedHashes);
  record('direct OPFS writable export and streaming readback preserve hashes', direct);
  // This uses the real FileSystemWritableFileStream; the external OS Save As permission dialog is not automated.
  result.dataPass = true;
  result.uiPass = !result.pageErrors?.length;
  assert.equal(result.uiPass, true, `Production UI page errors: ${JSON.stringify(result.pageErrors)}`);
  result.elapsedMs = Math.round(performance.now() - started); result.pass = true;
} catch (error) { result.pass = false; result.error = error.stack || error.message; throw error; }
finally {
  if (sampler) clearInterval(sampler);
  if (context) await context.close().catch(() => {});
  server.closeAllConnections();
  await new Promise(resolveClose => server.close(resolveClose));
  await writeFile(join(output, 'browser-results.json'), JSON.stringify(result, null, 2));
}
console.log(JSON.stringify({ ...result, memorySamples: undefined }, null, 2));
