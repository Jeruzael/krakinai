import {
  MAX_ARCHIVE_FILENAME_BYTES,
  MAX_BACKUP_COMPRESSED_BYTES,
  MAX_BACKUP_ENTRIES,
  MAX_BACKUP_UNCOMPRESSED_BYTES,
  MAX_CENTRAL_DIRECTORY_BYTES,
  MAX_MANIFEST_BYTES,
} from './backupLimits';
import type { ArchiveEntry, ArchiveOptions } from './backupArchive';

const EOCD = 0x06054b50;
const ZIP64_EOCD = 0x06064b50;
const ZIP64_LOCATOR = 0x07064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const DESCRIPTOR = 0x08074b50;
const U32_MAX = 0xffffffff;
const U16_MAX = 0xffff;
const decoder = new TextDecoder('utf-8', { fatal: true });

function invalid(reason: string): never { throw new Error(`Invalid backup ZIP: ${reason}`); }
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Archive operation cancelled.', 'AbortError');
}
function safeNumber(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) invalid(`${label} exceeds safe integer range.`);
  return Number(value);
}
function u64(view: DataView, offset: number, label: string): number {
  return safeNumber(view.getBigUint64(offset, true), label);
}
async function slice(blob: Blob, start: number, size: number, signal?: AbortSignal): Promise<Uint8Array> {
  checkAbort(signal);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(size) || start < 0 || size < 0 || start + size > blob.size) {
    invalid('record points outside the archive.');
  }
  const part = blob.slice(start, start + size);
  let buffer: ArrayBuffer;
  if (typeof part.arrayBuffer === 'function') buffer = await part.arrayBuffer();
  else buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(part);
  });
  checkAbort(signal);
  return new Uint8Array(buffer);
}
function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
function readName(bytes: Uint8Array, flags: number): string {
  if (bytes.length === 0 || bytes.length > MAX_ARCHIVE_FILENAME_BYTES) invalid('filename length is invalid.');
  // KRAKINAI paths are ASCII. This also avoids ambiguous CP437/Unicode-extra normalization.
  if (bytes.some(byte => byte < 0x20 || byte > 0x7e)) invalid('filename is not printable ASCII.');
  const name = decoder.decode(bytes);
  if ((flags & 0x800) === 0 && bytes.some(byte => byte > 0x7f)) invalid('non-UTF-8 filename.');
  if (name.startsWith('/') || name.startsWith('\\') || name.includes('\\') || name.includes(':') || name.includes('//') || name.endsWith('/') || name.split('/').some(segment => !segment || segment === '.' || segment === '..')) invalid('unsafe path.');
  if (name.includes('%') && /%(?:2e|2f|5c|00)/i.test(name)) invalid('encoded unsafe path.');
  return name;
}
function zip64Fields(extra: Uint8Array, needSize: boolean, needCompressed: boolean, needOffset: boolean): number[] {
  let cursor = 0;
  let found = false;
  let out: number[] = [];
  while (cursor < extra.length) {
    if (cursor + 4 > extra.length) invalid('malformed extra field.');
    const v = view(extra.subarray(cursor));
    const id = v.getUint16(0, true);
    const length = v.getUint16(2, true);
    cursor += 4;
    if (cursor + length > extra.length) invalid('malformed extra field.');
    if (id === 1) {
      if (found) invalid('duplicate ZIP64 extra field.');
      found = true;
      const data = view(extra.subarray(cursor, cursor + length));
      out = [];
      let p = 0;
      for (const [required, label] of [[needSize, 'entry size'], [needCompressed, 'compressed entry size'], [needOffset, 'local offset']] as const) {
        if (required) {
          if (p + 8 > length) invalid('missing ZIP64 size or offset.');
          out.push(u64(data, p, label));
          p += 8;
        }
      }
    }
    cursor += length;
  }
  if ((needSize || needCompressed || needOffset) && !found) invalid('missing ZIP64 extra field.');
  return out;
}

interface IndexedEntry extends ArchiveEntry {
  localOffset: number;
  compressedSize: number;
  uncompressedSize: number;
  crc32: number;
  flags: number;
  method: number;
  rawName: Uint8Array;
}

export async function inspectBackupZip(blob: Blob, options: ArchiveOptions = {}): Promise<{
  entries: ArchiveEntry[];
  compressedBytes: number;
  uncompressedBytes: number;
  zip64: boolean;
}> {
  const { signal, onProgress } = options;
  checkAbort(signal);
  if (blob.size < 22 || blob.size > MAX_BACKUP_COMPRESSED_BYTES) invalid('compressed archive size is outside the 5,500 MiB limit.');
  const tailLength = Math.min(blob.size, 22 + U16_MAX);
  const tailStart = blob.size - tailLength;
  const tail = await slice(blob, tailStart, tailLength, signal);
  const tailView = view(tail);
  let eocd = -1;
  for (let p = tail.length - 22; p >= 0; p--) {
    if (tailView.getUint32(p, true) === EOCD && p + 22 + tailView.getUint16(p + 20, true) === tail.length) { eocd = p; break; }
  }
  if (eocd < 0) invalid('end-of-central-directory record is missing or trailing data exists.');
  const eocdOffset = tailStart + eocd;
  const disk = tailView.getUint16(eocd + 4, true);
  const centralDisk = tailView.getUint16(eocd + 6, true);
  const diskCount = tailView.getUint16(eocd + 8, true);
  const count16 = tailView.getUint16(eocd + 10, true);
  const centralSize32 = tailView.getUint32(eocd + 12, true);
  const centralOffset32 = tailView.getUint32(eocd + 16, true);
  const zip64Sentinel = count16 === U16_MAX || centralSize32 === U32_MAX || centralOffset32 === U32_MAX;
  if (!((disk === 0 && centralDisk === 0) || (zip64Sentinel && disk === U16_MAX && centralDisk === U16_MAX)) || diskCount !== count16) invalid('multi-disk archive is unsupported.');
  let count = count16;
  let centralSize = centralSize32;
  let centralOffset = centralOffset32;
  let directoryEnd = eocdOffset;
  let zip64 = false;
  if (zip64Sentinel) {
    zip64 = true;
    if (eocdOffset < 20) invalid('ZIP64 locator is missing.');
    const locatorBytes = await slice(blob, eocdOffset - 20, 20, signal);
    const locator = view(locatorBytes);
    if (locator.getUint32(0, true) !== ZIP64_LOCATOR || locator.getUint32(4, true) !== 0 || locator.getUint32(16, true) !== 1) invalid('invalid ZIP64 locator or multi-disk archive.');
    const zip64Offset = u64(locator, 8, 'ZIP64 directory offset');
    const recordBytes = await slice(blob, zip64Offset, 56, signal);
    const record = view(recordBytes);
    if (record.getUint32(0, true) !== ZIP64_EOCD || u64(record, 4, 'ZIP64 record length') !== 44 || zip64Offset + 56 !== eocdOffset - 20) invalid('invalid ZIP64 end record.');
    if (record.getUint32(16, true) !== 0 || record.getUint32(20, true) !== 0) invalid('multi-disk ZIP64 archive is unsupported.');
    const diskEntries = u64(record, 24, 'ZIP64 disk entry count');
    count = u64(record, 32, 'ZIP64 entry count');
    if (diskEntries !== count) invalid('multi-disk ZIP64 archive is unsupported.');
    centralSize = u64(record, 40, 'ZIP64 central size');
    centralOffset = u64(record, 48, 'ZIP64 central offset');
    directoryEnd = zip64Offset;
    if ((count16 !== U16_MAX && count16 !== count) || (centralSize32 !== U32_MAX && centralSize32 !== centralSize) || (centralOffset32 !== U32_MAX && centralOffset32 !== centralOffset)) invalid('ZIP64 and ordinary directory fields disagree.');
  }
  if (count === 0 || count > MAX_BACKUP_ENTRIES) invalid(`entry count exceeds ${MAX_BACKUP_ENTRIES} or is empty.`);
  if (centralSize > MAX_CENTRAL_DIRECTORY_BYTES || centralSize < count * 46) invalid('central directory exceeds 16 MiB or is truncated.');
  if (centralOffset + centralSize !== directoryEnd) invalid('central directory offset or size is invalid.');
  const centralBytes = await slice(blob, centralOffset, centralSize, signal);
  const central = view(centralBytes);
  const entries: IndexedEntry[] = [];
  const paths = new Set<string>();
  let cursor = 0;
  let totalUncompressed = 0;
  for (let i = 0; i < count; i++) {
    checkAbort(signal);
    if (cursor + 46 > centralSize || central.getUint32(cursor, true) !== CENTRAL) invalid('central directory entry is malformed.');
    const flags = central.getUint16(cursor + 8, true);
    const method = central.getUint16(cursor + 10, true);
    const crc32 = central.getUint32(cursor + 16, true);
    const compressed32 = central.getUint32(cursor + 20, true);
    const uncompressed32 = central.getUint32(cursor + 24, true);
    const nameLength = central.getUint16(cursor + 28, true);
    const extraLength = central.getUint16(cursor + 30, true);
    const commentLength = central.getUint16(cursor + 32, true);
    const startDisk = central.getUint16(cursor + 34, true);
    const externalAttrs = central.getUint32(cursor + 38, true);
    const local32 = central.getUint32(cursor + 42, true);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > centralSize || nameLength > MAX_ARCHIVE_FILENAME_BYTES) invalid('central directory field exceeds bounds.');
    if (startDisk !== 0 || (flags & ~0x080e) !== 0) invalid('encrypted or unsupported entry flags or multi-disk entry.');
    if (method !== 0 && method !== 8) invalid('unsupported compression method.');
    const unixFileType = (externalAttrs >>> 16) & 0xf000;
    const dosAttributes = externalAttrs & 0xff;
    if ((unixFileType !== 0 && unixFileType !== 0x8000) || (dosAttributes & 0x10) !== 0) invalid('non-file archive entry is unsupported.');
    const rawName = centralBytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const path = readName(rawName, flags);
    if (paths.has(path.toLowerCase())) invalid(`duplicate archive path: ${path}`);
    paths.add(path.toLowerCase());
    const extra = centralBytes.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength);
    const needed = [uncompressed32 === U32_MAX, compressed32 === U32_MAX, local32 === U32_MAX] as const;
    const fields = zip64Fields(extra, ...needed);
    let f = 0;
    const uncompressedSize = needed[0] ? fields[f++] : uncompressed32;
    const compressedSize = needed[1] ? fields[f++] : compressed32;
    const localOffset = needed[2] ? fields[f++] : local32;
    if (uncompressedSize > MAX_BACKUP_UNCOMPRESSED_BYTES || compressedSize > MAX_BACKUP_COMPRESSED_BYTES) invalid('entry size exceeds archive limit.');
    if (path === 'manifest.json' && uncompressedSize > MAX_MANIFEST_BYTES) invalid('manifest.json exceeds 20 MiB.');
    if (uncompressedSize > 1024 * 1024 && compressedSize > 0 && uncompressedSize / compressedSize > 2000) invalid('entry compression ratio exceeds 2000:1.');
    if (uncompressedSize > 0 && compressedSize === 0) invalid('nonempty entry has no compressed data.');
    if (method === 0 && compressedSize !== uncompressedSize) invalid('stored entry sizes disagree.');
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_BACKUP_UNCOMPRESSED_BYTES) invalid('expanded archive exceeds 5,500 MiB.');
    entries.push({ path, compressedSize, uncompressedSize, crc32, localOffset, flags, method, rawName });
    cursor = end;
    onProgress?.({ phase: 'inspect', path, completedBytes: cursor, totalBytes: centralSize });
  }
  if (cursor !== centralSize) invalid('central directory has unexpected data.');
  const intervals: Array<[number, number]> = [];
  for (const entry of entries) {
    const localBytes = await slice(blob, entry.localOffset, 30, signal);
    const local = view(localBytes);
    if (local.getUint32(0, true) !== LOCAL) invalid('local entry header is missing.');
    const flags = local.getUint16(6, true);
    const method = local.getUint16(8, true);
    const nameLength = local.getUint16(26, true);
    const extraLength = local.getUint16(28, true);
    if (flags !== entry.flags || method !== entry.method || nameLength !== entry.rawName.length || nameLength > MAX_ARCHIVE_FILENAME_BYTES) invalid('local and central metadata disagree.');
    const nameBytes = await slice(blob, entry.localOffset + 30, nameLength, signal);
    if (nameBytes.some((byte, i) => byte !== entry.rawName[i])) invalid('local filename differs from central filename.');
    const localExtra = await slice(blob, entry.localOffset + 30 + nameLength, extraLength, signal);
    const compressed32 = local.getUint32(18, true);
    const uncompressed32 = local.getUint32(22, true);
    const localZip64 = zip64Fields(localExtra, !(flags & 8) && uncompressed32 === U32_MAX, !(flags & 8) && compressed32 === U32_MAX, false);
    const payloadStart = entry.localOffset + 30 + nameLength + extraLength;
    const payloadEnd = payloadStart + entry.compressedSize;
    if (payloadEnd > centralOffset) invalid('entry payload overlaps central directory.');
    let intervalEnd = payloadEnd;
    if (flags & 8) {
      const descriptor = await slice(blob, payloadEnd, Math.min(24, centralOffset - payloadEnd), signal);
      const d = view(descriptor);
      let p = descriptor.length >= 4 && d.getUint32(0, true) === DESCRIPTOR ? 4 : 0;
      const needs64 = entry.compressedSize > U32_MAX || entry.uncompressedSize > U32_MAX || local.getUint32(18, true) === U32_MAX || local.getUint32(22, true) === U32_MAX;
      const length = p + (needs64 ? 20 : 12);
      if (descriptor.length < length || d.getUint32(p, true) !== entry.crc32) invalid('data descriptor checksum is invalid.');
      p += 4;
      const compressed = needs64 ? u64(d, p, 'descriptor compressed size') : d.getUint32(p, true);
      p += needs64 ? 8 : 4;
      const uncompressed = needs64 ? u64(d, p, 'descriptor expanded size') : d.getUint32(p, true);
      if (compressed !== entry.compressedSize || uncompressed !== entry.uncompressedSize) invalid('data descriptor sizes disagree.');
      intervalEnd += length;
    } else {
      if (local.getUint32(14, true) !== entry.crc32 || (compressed32 !== U32_MAX && compressed32 !== entry.compressedSize) || (uncompressed32 !== U32_MAX && uncompressed32 !== entry.uncompressedSize)) invalid('local size or checksum differs from central directory.');
      if (compressed32 === U32_MAX || uncompressed32 === U32_MAX) {
        let p = 0;
        if (uncompressed32 === U32_MAX && localZip64[p++] !== entry.uncompressedSize) invalid('local ZIP64 expanded size disagrees.');
        if (compressed32 === U32_MAX && localZip64[p++] !== entry.compressedSize) invalid('local ZIP64 compressed size disagrees.');
      }
    }
    if (intervalEnd > centralOffset) invalid('entry overlaps central directory.');
    intervals.push([entry.localOffset, intervalEnd]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  if (intervals[0]?.[0] !== 0) invalid('unexpected data precedes first entry.');
  for (let i = 1; i < intervals.length; i++) if (intervals[i][0] < intervals[i - 1][1]) invalid('archive entries overlap.');
  return { entries: entries.map(({ path, compressedSize, uncompressedSize, crc32 }) => ({ path, compressedSize, uncompressedSize, crc32 })), compressedBytes: blob.size, uncompressedBytes: totalUncompressed, zip64 };
}
