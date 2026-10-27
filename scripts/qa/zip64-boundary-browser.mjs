// Manual local-only ZIP-layer boundary test. This is NOT a restorable library.
// Requires a separately generated/verified 5500 MiB synthetic ZIP and --go=true.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn, execFile } from 'node:child_process';
import { open, mkdir, readFile, realpath, stat, statfs, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const preflightOnly = args['preflight-only'] === 'true';
if (process.env.CI || (!preflightOnly && args.go !== 'true') || !args.output) {
  throw new Error('Manual local-only --output=<owned stress-5500 directory> --go=true required, or --preflight-only=true for bounded read-only checks.');
}
const mode = args.mode || 'full';
if (!['full', 'read-input', 'write-source'].includes(mode)) throw new Error('Use --mode=full, --mode=read-input, or --mode=write-source.');
const output = resolve(args.output);
const canonicalRoot = await realpath(root);
const canonicalOutput = await realpath(output);
const compareRoot = process.platform === 'win32' ? canonicalRoot.toLowerCase() : canonicalRoot;
const compareOutput = process.platform === 'win32' ? canonicalOutput.toLowerCase() : canonicalOutput;
if (compareOutput === compareRoot || compareOutput.startsWith(compareRoot + '\\') || compareOutput.startsWith(compareRoot + '/')) throw new Error('Output must be outside the repository.');
assert.equal(await readFile(join(output, '.krakinai-synthetic-stress'), 'utf8'), 'synthetic-only-v1\n');
const archive = JSON.parse(await readFile(join(output, 'archive-results.json'), 'utf8'));
const independent = JSON.parse(await readFile(join(output, 'python-results.json'), 'utf8'));
const targetBytes = 5500 * 1024 * 1024;
assert.equal(archive.requestedMiB, 5500);
assert.equal(archive.archiveLayerOnly, true, 'This test accepts the generic archive layer only.');
assert.equal(archive.compressedBytes, targetBytes);
assert.equal(archive.entryCount, 110);
assert.equal(archive.zip64, true);
assert.equal(archive.streamingReadHashPass, true);
assert.equal(independent.crcAndSha256Pass, true);
assert.equal(independent.compressedBytes, targetBytes);
assert.equal(independent.entryCount, 110);
assert.equal(independent.offsetBeyond32Bit, true);
assert.deepEqual(independent.entries.map(entry => entry.path), archive.expectedPaths);
const inputPath = join(output, 'synthetic-5500MiB.zip');
const sourcePath = join(output, 'synthetic-source-50MiB.bin');
if (mode !== 'write-source') assert.equal((await stat(inputPath)).size, targetBytes);
else assert.equal((await stat(sourcePath)).size, 50 * 1024 * 1024);

// Full/write-source modes create a real 5500 MiB OPFS file. The read-input
// mode only inspects the existing ZIP, so it can precede approved ZIP cleanup.
const reserveBytes = 8192 * 1024 * 1024;
const allowanceBytes = 256 * 1024 * 1024;
const free = await statfs(output);
const diskFreeBeforeBytes = Number(free.bavail) * Number(free.bsize);
const additionalBytes = mode === 'read-input' ? 0 : targetBytes;
if (!preflightOnly && diskFreeBeforeBytes - additionalBytes - allowanceBytes < reserveBytes) {
  throw new Error(`Disk reserve would be breached: free ${diskFreeBeforeBytes}, OPFS output ${additionalBytes}, allowance ${allowanceBytes}, reserve ${reserveBytes}.`);
}

// Extract the physical STORE payload offsets from each bounded local header.
// Python independently confirmed the central names, sizes, CRC and hashes.
const payloads = [];
for (const [i, entry] of independent.entries.entries()) {
  assert.equal(entry.path, `media/synthetic_${String(i).padStart(4, '0')}.mp4`);
  assert.equal(entry.compressedBytes, entry.size, 'Boundary source member must be STORE.');
  assert.equal(entry.size, archive.expectedEntrySizes[entry.path]);
  assert.equal(entry.sha256, archive.expectedHashes[entry.path]);
  payloads.push({ path: entry.path, dataStart: 0, size: entry.size, sha256: archive.expectedHashes[entry.path] });
}
if (mode === 'full') {
  const handle = await open(inputPath, 'r');
  try {
    for (const [i, entry] of independent.entries.entries()) {
      const header = new Uint8Array(30);
      const { bytesRead } = await handle.read(header, 0, header.length, entry.headerOffset);
      assert.equal(bytesRead, 30, `Truncated local header: ${entry.path}`);
      const fixed = new DataView(header.buffer);
      assert.equal(fixed.getUint32(0, true), 0x04034b50, `Missing local header: ${entry.path}`);
      assert.equal(fixed.getUint16(8, true), 0, `Non-STORE method: ${entry.path}`);
      const nameLength = fixed.getUint16(26, true);
      const extraLength = fixed.getUint16(28, true);
      assert.ok(nameLength > 0 && nameLength <= 1024 && extraLength <= 65535);
      const nameBytes = new Uint8Array(nameLength);
      assert.equal((await handle.read(nameBytes, 0, nameLength, entry.headerOffset + 30)).bytesRead, nameLength);
      assert.equal(new TextDecoder('utf-8', { fatal: true }).decode(nameBytes), entry.path);
      const dataStart = entry.headerOffset + 30 + nameLength + extraLength;
      assert.ok(dataStart + entry.size <= targetBytes, `Payload exceeds input archive: ${entry.path}`);
      payloads[i].dataStart = dataStart;
    }
  } finally { await handle.close(); }
}
assert.equal(payloads.length, 110);
if (preflightOnly) {
  console.log(JSON.stringify({ preflightOnly, mode, paths: payloads.length, compressedBytes: targetBytes, firstDataStart: payloads[0].dataStart, lastDataStart: payloads.at(-1).dataStart, diskFreeBeforeBytes, requiredAdditionalBytes: additionalBytes, reserveBytes, allowanceBytes }, null, 2));
  process.exit(0);
}

const profileName = mode === 'full' ? 'disposable-boundary-browser-profile' : mode === 'read-input' ? 'disposable-boundary-reader-profile' : 'disposable-boundary-writer-profile';
const profile = join(output, profileName);
await mkdir(profile, { recursive: false }); // Fail closed if a prior owned profile exists.
const port = Number(args.port || 4197);
if (port !== 4197) throw new Error('Boundary harness owns port 4197 only.');
const url = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk; });
server.stderr.on('data', chunk => { serverLog += chunk; });
const started = performance.now();
const result = {
  scenario: 'generic ZIP64 archive layer only; no manifest, restore, stage or IndexedDB write', mode,
  requestedMiB: 5500, inputPath, compressedBytes: targetBytes, expectedEntries: 110,
  diskFreeBeforeBytes, reserveBytes, allowanceBytes, osSaveDialogTested: false,
  profile: 'new owned persistent Chromium profile', port,
  checks: [], memorySamples: [], samplingIntervalMs: 1000,
  peakObservedBrowserWorkingSetBytes: 0, peakObservedJsHeapBytes: 0,
};
const powershell = promisify(execFile);
const record = (name, detail = {}) => { result.checks.push({ name, pass: true, ...detail }); console.log(`PASS ${name}`); };
let context;
let sampler;
let sampling = false;
try {
  while (true) {
    if (server.exitCode !== null) throw new Error(`Boundary Vite server failed: ${serverLog}`);
    try { if ((await fetch(url)).ok) break; } catch { /* startup */ }
    if (performance.now() - started > 60_000) throw new Error('Boundary Vite server startup timed out.');
    await new Promise(resolveWait => setTimeout(resolveWait, 250));
  }
  context = await chromium.launchPersistentContext(profile, {
    headless: true, viewport: { width: 1440, height: 900 },
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  const browserCDP = await context.browser().newBrowserCDPSession();
  const page = await context.newPage();
  page.setDefaultTimeout(30 * 60 * 1000);
  page.on('pageerror', error => { (result.pageErrors ??= []).push(error.message); });
  page.on('crash', () => { result.pageCrashed = true; });
  await page.goto(url);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  sampler = setInterval(async () => {
    if (sampling) return;
    sampling = true;
    try {
      const { processInfo } = await browserCDP.send('SystemInfo.getProcessInfo');
      const ids = processInfo.map(item => item.id).filter(Number.isSafeInteger);
      const ps = await powershell('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$r=Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue; ($r | Measure-Object WorkingSet64 -Sum).Sum`], { windowsHide: true });
      const workingSet = Number(ps.stdout.trim());
      const { metrics } = await cdp.send('Performance.getMetrics');
      const heap = metrics.find(item => item.name === 'JSHeapUsedSize')?.value || 0;
      result.memorySamples.push({ elapsedMs: Math.round(performance.now() - started), workingSetSumBytes: workingSet, jsHeapBytes: heap });
      result.peakObservedBrowserWorkingSetBytes = Math.max(result.peakObservedBrowserWorkingSetBytes, workingSet);
      result.peakObservedJsHeapBytes = Math.max(result.peakObservedJsHeapBytes, heap);
    } catch { /* A Chromium process can exit between enumeration and sampling. */ }
    finally { sampling = false; }
  }, 1000);
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.type = 'file'; input.id = 'synthetic-boundary-archive'; document.body.append(input);
  });
  await page.locator('#synthetic-boundary-archive').setInputFiles(mode === 'write-source' ? sourcePath : inputPath);
  const browser = await page.evaluate(async ({ payloads, targetBytes, mode }) => {
    const file = document.querySelector('#synthetic-boundary-archive').files[0];
    const expectedInputBytes = mode === 'write-source' ? 50 * 1024 * 1024 : targetBytes;
    if (file.size !== expectedInputBytes) throw new Error(`Browser input File size mismatch: ${file.size}`);
    const engine = await import('/src/storage/backupArchive.ts');
    const index = await import('/src/storage/backupZipIndex.ts');
    let inputInspection;
    if (mode !== 'write-source') {
      inputInspection = await index.inspectBackupZip(file);
      if (!inputInspection.zip64 || inputInspection.compressedBytes !== targetBytes || inputInspection.entries.length !== payloads.length) throw new Error('Browser input ZIP64 inspection failed.');
      for (let i = 0; i < payloads.length; i++) {
        if (inputInspection.entries[i].path !== payloads[i].path || inputInspection.entries[i].uncompressedSize !== payloads[i].size) throw new Error(`Browser input index mismatch at ${i}`);
      }
    }
    if (mode === 'read-input') {
      window.__zip64BoundaryHeartbeat = 0;
      const heartbeat = setInterval(() => window.__zip64BoundaryHeartbeat++, 20);
      try {
        const readStart = performance.now();
        const read = await engine.readBackupArchive(file, async () => new WritableStream({ write() {} }));
        for (let i = 0; i < payloads.length; i++) {
          if (read.entries[i].path !== payloads[i].path || read.entries[i].sha256 !== payloads[i].sha256 || read.entries[i].bytes !== payloads[i].size) throw new Error(`Browser input hash/size mismatch at ${i}`);
        }
        return { inputFileSize: file.size, inputEntryCount: read.entries.length, inputReadElapsedMs: Math.round(performance.now() - readStart), heartbeatTicks: window.__zip64BoundaryHeartbeat };
      } finally { clearInterval(heartbeat); }
    }
    const directory = await navigator.storage.getDirectory();
    const outputName = 'synthetic-boundary-direct-output.zip';
    const output = await directory.getFileHandle(outputName, { create: true });
    window.__zip64BoundaryHeartbeat = 0;
    const heartbeat = setInterval(() => window.__zip64BoundaryHeartbeat++, 20);
    let progressEvents = 0;
    let operationError;
    try {
      const writeStart = performance.now();
      async function* entries() {
        for (const entry of payloads) yield {
          path: entry.path,
          blob: file.slice(entry.dataStart, entry.dataStart + entry.size, 'video/mp4'),
        };
      }
      const written = await engine.writeBackupArchive(entries(), await output.createWritable(), {
        onProgress() { progressEvents++; },
      });
      const writeElapsedMs = Math.round(performance.now() - writeStart);
      if (written.compressedBytes !== targetBytes || written.entries.length !== payloads.length) throw new Error('Browser output writer size/count mismatch.');
      for (let i = 0; i < payloads.length; i++) {
        if (written.entries[i].path !== payloads[i].path || written.entries[i].sha256 !== payloads[i].sha256) throw new Error(`Browser writer source hash mismatch at ${i}`);
      }
      const saved = await output.getFile();
      if (saved.size !== targetBytes) throw new Error(`OPFS physical output size mismatch: ${saved.size}`);
      const outputInspection = await index.inspectBackupZip(saved);
      if (!outputInspection.zip64 || outputInspection.entries.length !== payloads.length || outputInspection.compressedBytes !== targetBytes) throw new Error('Browser output ZIP64 inspection failed.');
      const readStart = performance.now();
      const read = await engine.readBackupArchive(saved, async () => new WritableStream({ write() {} }));
      const readElapsedMs = Math.round(performance.now() - readStart);
      for (let i = 0; i < payloads.length; i++) {
        if (read.entries[i].path !== payloads[i].path || read.entries[i].sha256 !== payloads[i].sha256 || read.entries[i].bytes !== payloads[i].size) throw new Error(`Browser output hash/size mismatch at ${i}`);
      }
      return {
        inputFileSize: file.size, inputEntryCount: inputInspection?.entries.length,
        outputFileSize: saved.size, outputEntryCount: read.entries.length,
        outputExpandedBytes: read.uncompressedBytes, writeElapsedMs, readElapsedMs,
        heartbeatTicks: window.__zip64BoundaryHeartbeat, progressEvents,
      };
    } catch (error) {
      operationError = error;
      throw error;
    } finally {
      clearInterval(heartbeat);
      try { await directory.removeEntry(outputName); }
      catch (cleanupError) { if (!operationError) throw cleanupError; }
    }
  }, { payloads, targetBytes, mode });
  if (mode !== 'read-input') {
    assert.equal(browser.outputFileSize, targetBytes);
    assert.equal(browser.outputEntryCount, 110);
  } else assert.equal(browser.inputEntryCount, 110);
  assert.ok(browser.heartbeatTicks > 0, 'Browser heartbeat did not advance.');
  assert.equal(result.pageCrashed, undefined, 'Owned browser renderer crashed.');
  assert.deepEqual(result.pageErrors ?? [], [], 'Browser page errors occurred.');
  if (mode !== 'write-source') record('browser reads full 5500 MiB input ZIP64 index', { bytes: browser.inputFileSize, entries: browser.inputEntryCount });
  if (mode === 'read-input') record('browser streams input ZIP and matches every source SHA-256', { entries: browser.inputEntryCount, elapsedMs: browser.inputReadElapsedMs });
  else {
    record('native OPFS direct writer closes exact 5500 MiB ZIP64', { bytes: browser.outputFileSize, elapsedMs: browser.writeElapsedMs });
    record('browser streams output ZIP and matches every source SHA-256', { entries: browser.outputEntryCount, expandedBytes: browser.outputExpandedBytes, elapsedMs: browser.readElapsedMs });
  }
  record('heartbeat advanced during browser archive work', { ticks: browser.heartbeatTicks, progressEvents: browser.progressEvents });
  result.browser = browser;
  const after = await statfs(output);
  result.diskFreeAfterBytes = Number(after.bavail) * Number(after.bsize);
  result.elapsedMs = Math.round(performance.now() - started);
  result.pass = true;
} catch (error) {
  result.pass = false;
  result.error = error.stack || error.message;
  throw error;
} finally {
  if (sampler) clearInterval(sampler);
  if (context) await context.close().catch(() => {});
  server.kill();
  const reportName = mode === 'full' ? 'browser-boundary-results.json' : `browser-boundary-${mode}-results.json`;
  await writeFile(join(output, reportName), JSON.stringify(result, null, 2));
}
console.log(JSON.stringify({ ...result, memorySamples: undefined }, null, 2));
