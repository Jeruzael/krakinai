// Manual local-only physical archive exercise. Never run in hosted PR CI.
import { build } from 'esbuild';
import { createWriteStream } from 'node:fs';
import { mkdir, open, readFile, realpath, stat, statfs, writeFile } from 'node:fs/promises';
import { randomFillSync, createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Writable } from 'node:stream';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...v] = arg.replace(/^--/, '').split('='); return [key, v.join('=')]; }));
const inspectExisting = args['inspect-existing'] === 'true';
const retryGenerated = args['retry-generated'] === 'true';
if (!args.output || !args['size-mib']) throw new Error('Explicit --output=C:/disposable/path --size-mib=128 required. This creates synthetic, nonplayable media only.');
if (process.env.CI) throw new Error('Multi-GiB stress is local-only; hosted CI is prohibited.');
const output = resolve(args.output);
await mkdir(output, { recursive: true });
const canonicalRoot = await realpath(root);
const canonicalOutput = await realpath(output);
const compareRoot = process.platform === 'win32' ? canonicalRoot.toLowerCase() : canonicalRoot;
const compareOutput = process.platform === 'win32' ? canonicalOutput.toLowerCase() : canonicalOutput;
if (compareOutput === compareRoot || compareOutput.startsWith(compareRoot + '\\') || compareOutput.startsWith(compareRoot + '/')) throw new Error('Stress output must be outside the repository.');
const sizeMiB = Number(args['size-mib']);
if (![128, 512, 1024, 4300, 4700, 5000, 5500].includes(sizeMiB)) throw new Error('Use an explicit acceptance-matrix size: 128, 512, 1024, 4300, 4700, 5000, or 5500.');
const archiveLayerOnly = sizeMiB === 5500;
const marker = join(output, '.krakinai-synthetic-stress');
try { if ((await readFile(marker, 'utf8')) !== 'synthetic-only-v1\n') throw new Error('Unrecognized ownership marker'); }
catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(marker, 'synthetic-only-v1\n', { flag: 'wx' }); }
const reserve = Number(args['reserve-mib'] || 8192) * 1024 * 1024;
const free = await statfs(output); const freeBytes = Number(free.bavail) * Number(free.bsize);
// Reserve archive + 50MiB input plus directory overhead. Browser stage/IDB runs have their own additional budget.
const required = sizeMiB * 1024 * 1024 + 52 * 1024 * 1024;
if (!inspectExisting && freeBytes - required < reserve) throw new Error(`Disk reserve would be breached: free ${freeBytes}, estimated new ${required}, reserve ${reserve}.`);
const archivePath = join(output, `synthetic-${sizeMiB}MiB.zip`);
if (inspectExisting) await stat(archivePath);
else {
  try { await stat(archivePath); throw new Error('Refusing to overwrite an existing stress ZIP. Use another explicitly owned output directory.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

// Node 22's Windows fs.openAsBlob() reports file size modulo 2^32 for a >4 GiB
// file. Both the index parser and zip.js BlobReader need exact 64-bit seek offsets.
// This duck-typed Blob performs only bounded positioned reads from a FileHandle.
const MAX_READ_BYTES = 16 * 1024 * 1024;
class SeekableFileSlice {
  constructor(handle, absoluteStart, size) {
    this.handle = handle;
    this.absoluteStart = absoluteStart;
    this.size = size;
  }
  slice(start = 0, end = this.size) {
    const first = Math.min(this.size, Math.max(0, Math.trunc(start)));
    const last = Math.min(this.size, Math.max(first, Math.trunc(end)));
    return new SeekableFileSlice(this.handle, this.absoluteStart + first, last - first);
  }
  async arrayBuffer() {
    if (this.size > MAX_READ_BYTES) throw new Error(`Seekable file read exceeds 16 MiB cap: ${this.size}`);
    const bytes = new Uint8Array(this.size);
    let filled = 0;
    while (filled < bytes.length) {
      const { bytesRead } = await this.handle.read(bytes, filled, bytes.length - filled, this.absoluteStart + filled);
      if (bytesRead === 0) throw new Error(`Unexpected end of seekable file at ${this.absoluteStart + filled}`);
      filled += bytesRead;
    }
    return bytes.buffer;
  }
}
async function openSeekableFile(path) {
  const handle = await open(path, 'r');
  try {
    const info = await handle.stat({ bigint: true });
    if (info.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('File size exceeds safe offset range.');
    return { blob: new SeekableFileSlice(handle, 0, Number(info.size)), close: () => handle.close() };
  } catch (error) { await handle.close(); throw error; }
}

const modulePath = join(output, 'archive-engine.mjs');
await build({ stdin: { contents: `export * from ${JSON.stringify(join(root, 'src/storage/backupArchive.ts'))}; export * from ${JSON.stringify(join(root, 'src/storage/backupZipIndex.ts'))};`, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: modulePath, logLevel: 'warning' });
const engine = await import(pathToFileURL(modulePath).href + `?time=${Date.now()}`);
const sourcePath = join(output, 'synthetic-source-50MiB.bin');
if (!inspectExisting && !retryGenerated) {
  const sourceHandle = await open(sourcePath, 'wx');
  try {
    const chunk = new Uint8Array(1024 * 1024);
    for (let i = 0; i < 50; i++) { randomFillSync(chunk); await sourceHandle.write(chunk); }
  } finally { await sourceHandle.close(); }
}
const sourceFile = await openSeekableFile(sourcePath);
let archiveFile;
let result;
try {
  const source = sourceFile.blob;
  if (source.size !== 50 * 1024 * 1024) throw new Error(`Retained source size mismatch: ${source.size}`);
  const sourceHash = await engine.hashBackupBlob(source);
  let overhead = 0;
  let measuredBaseOverhead = 0;
  let zip64OffsetExtraBytes = 0;
  let plannedCrossingEntries = 0;
  if (archiveLayerOnly) {
    // zip.js adds eight central-directory bytes to each member whose local
    // header offset crosses 0xffffffff. Tiny fixtures measure the fixed
    // per-entry STORE overhead; the offset additions are planned separately.
    async function measureProbe(bytesPerEntry) {
      let total = 0;
      const chunks = [];
      const entries = Array.from({ length: 110 }, (_, i) => ({ path: `media/synthetic_${String(i).padStart(4, '0')}.mp4`, blob: new Blob([new Uint8Array(bytesPerEntry)]) }));
      await engine.writeBackupArchive(entries, new WritableStream({ write(chunk) { total += chunk.length; chunks.push(chunk.slice()); } }));
      const bytes = new Uint8Array(total);
      let cursor = 0;
      for (const chunk of chunks) { bytes.set(chunk, cursor); cursor += chunk.length; }
      const data = new DataView(bytes.buffer);
      const locator = total - 42;
      if (data.getUint32(locator, true) !== 0x07064b50) throw new Error('Tiny overhead probe missing ZIP64 locator.');
      const zip64End = Number(data.getBigUint64(locator + 8, true));
      const centralOffset = Number(data.getBigUint64(zip64End + 48, true));
      return { overhead: total - 110 * bytesPerEntry, perEntryLocalOverhead: (centralOffset - 110 * bytesPerEntry) / 110 };
    }
    const oneByte = await measureProbe(1);
    const hundredBytes = await measureProbe(100);
    if (oneByte.overhead !== hundredBytes.overhead || oneByte.perEntryLocalOverhead !== hundredBytes.perEntryLocalOverhead || !Number.isInteger(oneByte.perEntryLocalOverhead)) throw new Error('STORE overhead changed across tiny fixtures.');
    measuredBaseOverhead = oneByte.overhead;
    let candidatePayload = sizeMiB * 1024 * 1024 - measuredBaseOverhead;
    for (let pass = 0; pass < 4; pass++) {
      let localOffset = 0;
      let remaining = candidatePayload;
      let crossings = 0;
      for (let i = 0; i < 110; i++) {
        const memberBytes = Math.min(source.size, remaining);
        if (memberBytes <= 0) throw new Error('Exact-boundary plan has fewer than 110 members.');
        if (localOffset >= 0xffffffff) crossings++;
        localOffset += oneByte.perEntryLocalOverhead + memberBytes;
        remaining -= memberBytes;
      }
      if (remaining !== 0) throw new Error('Exact-boundary plan has more than 110 members.');
      const nextPayload = sizeMiB * 1024 * 1024 - measuredBaseOverhead - crossings * 8;
      plannedCrossingEntries = crossings;
      if (nextPayload === candidatePayload) break;
      candidatePayload = nextPayload;
      if (pass === 3) throw new Error('ZIP64 offset overhead did not converge.');
    }
    zip64OffsetExtraBytes = plannedCrossingEntries * 8;
    overhead = measuredBaseOverhead + zip64OffsetExtraBytes;
  }
  let inspection;
  if (inspectExisting) {
    archiveFile = await openSeekableFile(archivePath);
    inspection = await engine.inspectBackupZip(archiveFile.blob);
  }
  const payloadBytes = archiveLayerOnly ? sizeMiB * 1024 * 1024 - overhead : sizeMiB * 1024 * 1024;
  const expectedHashes = {};
  const expectedEntrySizes = {};
  const media = [];
  const expectedPaths = [];
  let remaining = payloadBytes;
  let index = 0;
  while (remaining > 0) {
    const bytes = Math.min(source.size, remaining);
    const id = `synthetic_${String(index++).padStart(4, '0')}`;
    const path = `media/${id}.mp4`;
    const digest = bytes === source.size ? sourceHash : await engine.hashBackupBlob(source.slice(0, bytes));
    expectedPaths.push(path);
    expectedHashes[path] = digest;
    expectedEntrySizes[path] = bytes;
    media.push({ id, filename: `${id}.mp4`, safeFilename: `${id}.mp4`, mimeType: 'video/mp4', byteSize: bytes, archivePath: path, sha256: digest, createdAt: '2026-10-26T00:00:00.000Z' });
    remaining -= bytes;
  }
  if (archiveLayerOnly && media.length !== 110) throw new Error(`Expected 110 archive-only entries, got ${media.length}`);
  let manifestBytes;
  if (!archiveLayerOnly) {
    const manifest = { schemaVersion: 1, appVersion: '1.0.0', appName: 'KRAKINAI', exportedAt: '2026-10-26T00:00:00.000Z', assets: [], variants: [], drafts: [], scenes: [], collections: [], templates: [], preferences: { id: 'app_preferences', schemaVersion: 1, starterLoaded: false, updatedAt: '2026-10-26T00:00:00.000Z' }, media };
    manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
    expectedPaths.push('manifest.json');
    expectedHashes['manifest.json'] = createHash('sha256').update(manifestBytes).digest('hex');
    expectedEntrySizes['manifest.json'] = manifestBytes.length;
  }
  function assertInspection(value) {
    if (!value.zip64) throw new Error('ZIP64 end records not detected.');
    if (value.entries.length !== expectedPaths.length) throw new Error(`Entry count mismatch: ${value.entries.length} vs ${expectedPaths.length}`);
    for (let i = 0; i < value.entries.length; i++) {
      if (value.entries[i].path !== expectedPaths[i] || value.entries[i].uncompressedSize !== expectedEntrySizes[expectedPaths[i]]) throw new Error(`Entry path/size mismatch at ${i}`);
    }
    if (archiveLayerOnly && value.compressedBytes !== sizeMiB * 1024 * 1024) throw new Error('Compressed archive did not land on the exact 5500 MiB boundary.');
    if (value.uncompressedBytes !== payloadBytes + (manifestBytes?.length ?? 0)) throw new Error('Expanded total mismatch.');
  }
  const samples = [];
  let phaseStart = performance.now();
  let peakRss = process.memoryUsage().rss;
  let timer = inspectExisting ? null : setInterval(() => { const rss = process.memoryUsage().rss; peakRss = Math.max(peakRss, rss); samples.push({ elapsedMs: Math.round(performance.now() - phaseStart), rss }); }, 250);
  let writeElapsedMs = null;
  let writePeakRssBytes = null;
  try {
    if (!inspectExisting) {
      async function* entries() {
        for (const record of media) yield { path: record.archivePath, blob: source.slice(0, record.byteSize) };
        if (manifestBytes) yield { path: 'manifest.json', blob: new Blob([manifestBytes]), compress: true };
      }
      const written = await engine.writeBackupArchive(entries(), Writable.toWeb(createWriteStream(archivePath, { flags: 'wx', highWaterMark: 256 * 1024 })));
      writeElapsedMs = Math.round(performance.now() - phaseStart);
      writePeakRssBytes = peakRss;
      clearInterval(timer);
      timer = null;
      archiveFile = await openSeekableFile(archivePath);
      if (archiveFile.blob.size !== written.compressedBytes) throw new Error('Writer byte count differs from physical file.');
    }
    if (!archiveFile) throw new Error('Archive handle is missing.');
    inspection ??= await engine.inspectBackupZip(archiveFile.blob);
    assertInspection(inspection);
    // Recovery intentionally reports readback RSS only. The original >4 GiB export
    // succeeded before the old Node Blob size bug, but its memory samples were lost.
    const readSamples = [];
    phaseStart = performance.now();
    let readPeakRssBytes = process.memoryUsage().rss;
    timer = setInterval(() => { const rss = process.memoryUsage().rss; readPeakRssBytes = Math.max(readPeakRssBytes, rss); readSamples.push({ elapsedMs: Math.round(performance.now() - phaseStart), rss }); }, 250);
    const verified = await engine.readBackupArchive(archiveFile.blob, async () => new WritableStream({ write() {} }));
    for (const entry of verified.entries) {
      if (entry.sha256 !== expectedHashes[entry.path] || entry.bytes !== expectedEntrySizes[entry.path]) throw new Error(`Stream hash/size mismatch: ${entry.path}`);
    }
    const readElapsedMs = Math.round(performance.now() - phaseStart);
    result = {
      requestedMiB: sizeMiB, archiveLayerOnly, archivePath, recoveredExistingArchive: inspectExisting,
      measuredBaseOverhead, zip64OffsetExtraBytes, plannedCrossingEntries,
      mediaBytes: payloadBytes, compressedBytes: archiveFile.blob.size, uncompressedBytes: verified.uncompressedBytes,
      entryCount: verified.entries.length, zip64: inspection.zip64, streamingReadHashPass: true,
      expectedPaths, expectedHashes, expectedEntrySizes,
      writeElapsedMs, writePeakObservedNodeRssBytes: writePeakRssBytes,
      readElapsedMs, readPeakObservedNodeRssBytes: readPeakRssBytes,
      peakObservedNodeRssBytes: inspectExisting ? readPeakRssBytes : Math.max(writePeakRssBytes, readPeakRssBytes),
      peakObservedNodeRssPhase: inspectExisting ? 'inspection/readback only; original export memory unavailable' : 'write and readback',
      samplingIntervalMs: 250, diskFreeBeforeBytes: freeBytes, reserveBytes: reserve,
      source: 'Incrementally generated random bytes, synthetic nonplayable MP4 MIME. Reused 50MiB disk-backed source, STORE entries; not personal media.',
      writeMemorySamples: inspectExisting ? null : samples, readMemorySamples: readSamples,
    };
    await writeFile(join(output, 'archive-results.json'), JSON.stringify(result, null, 2));
  } finally { clearInterval(timer); }
} finally {
  if (archiveFile) await archiveFile.close();
  await sourceFile.close();
}
const python = args.python || 'python';
await new Promise((resolvePromise, reject) => {
  const child = spawn(python, [join(root, 'scripts/qa/zip64-inspect.py'), archivePath, join(output, 'archive-results.json')], { stdio: 'inherit', windowsHide: true });
  child.on('error', reject); child.on('close', code => code === 0 ? resolvePromise() : reject(new Error(`Python independent ZIP inspection exited ${code}`)));
});
console.log(JSON.stringify({ ...result, expectedPaths: undefined, expectedHashes: undefined, expectedEntrySizes: undefined, writeMemorySamples: undefined, readMemorySamples: undefined }, null, 2));
