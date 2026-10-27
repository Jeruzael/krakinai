import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { BlobReader, ZipReader, ZipWriter } from '@zip.js/zip.js';
import {
  CHUNK_BYTES,
  MAX_BACKUP_COMPRESSED_BYTES,
  MAX_BACKUP_ENTRIES,
  MAX_BACKUP_UNCOMPRESSED_BYTES,
  MAX_MANIFEST_BYTES,
} from './backupLimits';
import { inspectBackupZip } from './backupZipIndex';

export interface ArchiveProgress { phase: string; path?: string; completedBytes: number; totalBytes?: number }
export interface ArchiveOptions { signal?: AbortSignal; onProgress?: (progress: ArchiveProgress) => void }
export interface ArchiveEntry { path: string; compressedSize: number; uncompressedSize: number; crc32: number }
export interface ArchiveResultEntry { path: string; bytes: number; sha256: string }
export interface ArchiveReadResult { compressedBytes: number; uncompressedBytes: number; entries: ArchiveResultEntry[] }

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Archive operation cancelled.', 'AbortError');
}

async function readSlice(blob: Blob, start: number, end: number): Promise<Uint8Array> {
  const slice = blob.slice(start, end);
  if (typeof slice.arrayBuffer === 'function') return new Uint8Array(await slice.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(slice);
  });
}

export async function hashBackupBlob(blob: Blob, options: ArchiveOptions = {}): Promise<string> {
  const hash = sha256.create();
  for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
    checkAbort(options.signal);
    const chunk = await readSlice(blob, offset, Math.min(blob.size, offset + CHUNK_BYTES));
    hash.update(chunk);
    options.onProgress?.({ phase: 'hash', completedBytes: offset + chunk.length, totalBytes: blob.size });
  }
  checkAbort(options.signal);
  return bytesToHex(hash.digest());
}

function blobChunks(blob: Blob, signal: AbortSignal | undefined, consume: (chunk: Uint8Array) => void): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        checkAbort(signal);
        if (offset >= blob.size) { controller.close(); return; }
        const chunk = await readSlice(blob, offset, Math.min(blob.size, offset + CHUNK_BYTES));
        checkAbort(signal);
        offset += chunk.length;
        consume(chunk);
        controller.enqueue(chunk);
      } catch (error) { controller.error(error); }
    },
  }, { highWaterMark: 1 });
}

export async function writeBackupArchive(
  entries: Iterable<{ path: string; blob: Blob; compress?: boolean }> | AsyncIterable<{ path: string; blob: Blob; compress?: boolean }>,
  destination: WritableStream<Uint8Array>,
  options: ArchiveOptions = {},
): Promise<ArchiveReadResult> {
  const { signal, onProgress } = options;
  let compressedBytes = 0;
  let uncompressedBytes = 0;
  const results: ArchiveResultEntry[] = [];
  const seen = new Set<string>();
  const output = destination.getWriter();
  let closed = false;
  const boundedDestination = new WritableStream<Uint8Array>({
    async write(chunk) {
      checkAbort(signal);
      if (compressedBytes + chunk.length > MAX_BACKUP_COMPRESSED_BYTES) throw new Error('Compressed backup exceeds 5,500 MiB.');
      for (let offset = 0; offset < chunk.length; offset += CHUNK_BYTES) {
        checkAbort(signal);
        const part = chunk.subarray(offset, offset + CHUNK_BYTES);
        await output.write(part);
        compressedBytes += part.length;
        onProgress?.({ phase: 'write', completedBytes: compressedBytes });
      }
    },
    async close() {
      // Cancellation remains effective until final closure begins. Once close succeeds,
      // the destination has committed a complete archive and a late abort is advisory.
      checkAbort(signal);
      await output.close();
      closed = true;
    },
    async abort(reason) { await output.abort(reason); },
  });
  const writer = new ZipWriter(boundedDestination, { zip64: true, useWebWorkers: false, useCompressionStream: true });
  try {
    for await (const entry of entries) {
      checkAbort(signal);
      if (results.length >= MAX_BACKUP_ENTRIES) throw new Error(`Backup exceeds ${MAX_BACKUP_ENTRIES} entries.`);
      const path = entry.path;
      if (!/^[\x20-\x7e]{1,1024}$/.test(path) || path.startsWith('/') || path.includes('\\') || path.includes(':') || path.includes('//') || path.endsWith('/') || /%(?:2e|2f|5c|00)/i.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error(`Unsafe archive path: ${path}`);
      if (seen.has(path.toLowerCase())) throw new Error(`Duplicate archive path: ${path}`);
      seen.add(path.toLowerCase());
      if (path === 'manifest.json' && entry.blob.size > MAX_MANIFEST_BYTES) throw new Error('manifest.json exceeds 20 MiB.');
      if (uncompressedBytes + entry.blob.size > MAX_BACKUP_UNCOMPRESSED_BYTES) throw new Error('Expanded backup exceeds 5,500 MiB.');
      const hash = sha256.create();
      let bytes = 0;
      const input = blobChunks(entry.blob, signal, chunk => {
        bytes += chunk.length;
        uncompressedBytes += chunk.length;
        if (uncompressedBytes > MAX_BACKUP_UNCOMPRESSED_BYTES) throw new Error('Expanded backup exceeds 5,500 MiB.');
        hash.update(chunk);
        onProgress?.({ phase: 'source', path, completedBytes: bytes, totalBytes: entry.blob.size });
      });
      const metadata = await writer.add(path, input, { level: entry.compress ? 6 : 0, signal, zip64: true });
      if (bytes !== entry.blob.size || metadata.uncompressedSize !== bytes) throw new Error(`Entry size changed while writing: ${path}`);
      results.push({ path, bytes, sha256: bytesToHex(hash.digest()) });
    }
    checkAbort(signal);
    if (results.length === 0) throw new Error('Cannot write an empty backup archive.');
    await writer.close();
    if (!closed) throw new Error('ZIP destination did not close.');
    return { compressedBytes, uncompressedBytes, entries: results };
  } catch (error) {
    try { if (!closed) await output.abort(error); } catch { /* keep original error */ }
    throw error;
  } finally { output.releaseLock(); }
}

export async function readBackupArchive(
  blob: Blob,
  createSink: (entry: ArchiveEntry) => Promise<WritableStream<Uint8Array>>,
  options: ArchiveOptions = {},
): Promise<ArchiveReadResult> {
  const inspection = await inspectBackupZip(blob, options);
  const reader = new ZipReader(new BlobReader(blob), {
    useWebWorkers: false,
    checkCrc32: true,
    strictness: 'strict',
    checkOverlappingEntry: true,
  });
  let actualTotal = 0;
  const results: ArchiveResultEntry[] = [];
  try {
    const files = await reader.getEntries({ strictness: 'strict' });
    if (files.length !== inspection.entries.length) throw new Error('Archive directory changed after preflight.');
    for (let i = 0; i < files.length; i++) {
      checkAbort(options.signal);
      const file = files[i];
      const expected = inspection.entries[i];
      if (file.directory || file.symlink || file.filename !== expected.path || file.compressedSize !== expected.compressedSize || file.uncompressedSize !== expected.uncompressedSize || file.crc32 !== expected.crc32) throw new Error('Archive entry changed after preflight.');
      const sink = await createSink(expected);
      const target = sink.getWriter();
      const hash = sha256.create();
      let bytes = 0;
      const bounded = new WritableStream<Uint8Array>({
        async write(chunk) {
          checkAbort(options.signal);
          bytes += chunk.length;
          actualTotal += chunk.length;
          if (bytes > expected.uncompressedSize || actualTotal > MAX_BACKUP_UNCOMPRESSED_BYTES || (expected.path === 'manifest.json' && bytes > MAX_MANIFEST_BYTES)) throw new Error('Expanded archive exceeds declared or configured size.');
          hash.update(chunk);
          await target.write(chunk);
          options.onProgress?.({ phase: 'extract', path: expected.path, completedBytes: actualTotal, totalBytes: inspection.uncompressedBytes });
        },
        async close() { await target.close(); },
        async abort(reason) { await target.abort(reason); },
      });
      try {
        await file.getData(bounded, { signal: options.signal, checkCrc32: true, useWebWorkers: false });
        if (bytes !== expected.uncompressedSize) throw new Error(`Expanded size mismatch for ${expected.path}.`);
        results.push({ path: expected.path, bytes, sha256: bytesToHex(hash.digest()) });
      } catch (error) {
        try { await target.abort(error); } catch { /* keep original error */ }
        throw error;
      } finally { target.releaseLock(); }
    }
    if (actualTotal !== inspection.uncompressedBytes) throw new Error('Expanded archive total differs from directory.');
    return { compressedBytes: blob.size, uncompressedBytes: actualTotal, entries: results };
  } finally { await reader.close(); }
}
