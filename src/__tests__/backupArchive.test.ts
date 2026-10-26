import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { hashBackupBlob, readBackupArchive, writeBackupArchive } from '../storage/backupArchive';
import { inspectBackupZip } from '../storage/backupZipIndex';

function capture() {
  const chunks: Uint8Array[] = [];
  let closed = false;
  let aborted = false;
  const stream = new WritableStream<Uint8Array>({
    write(chunk) { chunks.push(chunk.slice()); },
    close() { closed = true; },
    abort() { aborted = true; },
  });
  return { stream, get blob() { return new Blob(chunks as BlobPart[]); }, get closed() { return closed; }, get aborted() { return aborted; } };
}

function legacy(payload: Record<string, Uint8Array> = { 'manifest.json': strToU8('ok') }) {
  const bytes = zipSync(payload);
  const data = new DataView(bytes.buffer);
  const eocd = bytes.length - 22;
  return { bytes, data, eocd, central: data.getUint32(eocd + 16, true) };
}

function insertBytes(original: Uint8Array, offset: number, addition: number[]): Uint8Array {
  const result = new Uint8Array(original.length + addition.length);
  result.set(original.subarray(0, offset));
  result.set(addition, offset);
  result.set(original.subarray(offset), offset + addition.length);
  return result;
}

describe('bounded backup archive engine', () => {
  it('writes ZIP64 and reads a legacy compatible archive with matching SHA and CRC', async () => {
    const output = capture();
    const source = new Blob(['hello backup']);
    const written = await writeBackupArchive([{ path: 'manifest.json', blob: source, compress: true }], output.stream);
    expect(output.closed).toBe(true);
    expect(written.uncompressedBytes).toBe(source.size);
    const inspected = await inspectBackupZip(output.blob);
    expect(inspected.zip64).toBe(true);
    expect(inspected.entries.map(entry => entry.path)).toEqual(['manifest.json']);
    const extracted = capture();
    const read = await readBackupArchive(output.blob, async () => extracted.stream);
    expect(read.entries[0].sha256).toBe(await hashBackupBlob(source));
    expect(extracted.blob.size).toBe(source.size);
    expect(extracted.closed).toBe(true);

    const legacy = new Blob([zipSync({ 'manifest.json': strToU8('legacy') }) as BlobPart]);
    const legacyResult = await inspectBackupZip(legacy);
    expect(legacyResult.zip64).toBe(false);
    expect(legacyResult.entries[0].uncompressedSize).toBe(6);
    const legacySink = capture();
    expect((await readBackupArchive(legacy, async () => legacySink.stream)).entries[0].sha256).toBe(await hashBackupBlob(new Blob(['legacy'])));
  });

  it('rejects traversal, duplicate paths and malformed central offsets before extraction', async () => {
    for (const names of [
      { '../evil.txt': strToU8('bad') },
      { 'media/x': strToU8('one'), 'MEDIA/X': strToU8('two') },
    ] as Record<string, Uint8Array>[]) {
      await expect(inspectBackupZip(new Blob([zipSync(names) as BlobPart]))).rejects.toThrow();
    }
    const bytes = zipSync({ 'manifest.json': strToU8('ok') });
    const bad = bytes.slice();
    const end = bad.length - 22;
    new DataView(bad.buffer).setUint32(end + 16, 0xffffff00, true);
    await expect(inspectBackupZip(new Blob([bad as BlobPart]))).rejects.toThrow();
  });

  it('rejects corrupt data through CRC and aborts incomplete output', async () => {
    const bytes = zipSync({ 'manifest.json': strToU8('hello') });
    const broken = bytes.slice();
    const filenameLength = new DataView(broken.buffer).getUint16(26, true);
    broken[30 + filenameLength] ^= 1;
    await expect(readBackupArchive(new Blob([broken as BlobPart]), async () => capture().stream)).rejects.toThrow();

    const controller = new AbortController();
    const output = capture();
    controller.abort();
    await expect(writeBackupArchive([{ path: 'manifest.json', blob: new Blob(['x']) }], output.stream, { signal: controller.signal })).rejects.toThrow();
    expect(output.aborted).toBe(true);
  });

  it('rejects forged expanded size, entry count, encryption and manifest cap without opening a sink', async () => {
    const original = zipSync({ 'manifest.json': strToU8('ok') });
    const eocd = original.length - 22;
    const central = new DataView(original.buffer).getUint32(eocd + 16, true);
    const variants = [
      (bytes: Uint8Array, data: DataView) => data.setUint32(central + 24, 21 * 1024 * 1024, true),
      (bytes: Uint8Array, data: DataView) => data.setUint16(eocd + 10, 2001, true),
      (bytes: Uint8Array, data: DataView) => { data.setUint16(central + 8, 1, true); data.setUint16(6, 1, true); },
    ];
    for (const mutate of variants) {
      const bytes = original.slice();
      mutate(bytes, new DataView(bytes.buffer));
      let sinkCalls = 0;
      await expect(readBackupArchive(new Blob([bytes as BlobPart]), async () => { sinkCalls++; return capture().stream; })).rejects.toThrow();
      expect(sinkCalls).toBe(0);
    }
  });

  it('rejects a corrupt ZIP64 locator and reports cancellation during inspection', async () => {
    const output = capture();
    await writeBackupArchive([{ path: 'media/test.bin', blob: new Blob(['bytes']) }], output.stream);
    const bytes = new Uint8Array(await output.blob.arrayBuffer());
    bytes[bytes.length - 42] ^= 1;
    await expect(inspectBackupZip(new Blob([bytes as BlobPart]))).rejects.toThrow();
    const controller = new AbortController();
    controller.abort();
    await expect(inspectBackupZip(output.blob, { signal: controller.signal })).rejects.toThrow();
  });

  it('rejects empty, truncated, multi-volume and unsupported compression archives', async () => {
    await expect(inspectBackupZip(new Blob())).rejects.toThrow();
    await expect(inspectBackupZip(new Blob([zipSync({}) as BlobPart]))).rejects.toThrow();
    const emptyOutput = capture();
    await expect(writeBackupArchive([], emptyOutput.stream)).rejects.toThrow(/empty/);
    expect(emptyOutput.aborted).toBe(true);
    const base = legacy();
    await expect(inspectBackupZip(new Blob([base.bytes.slice(0, -5) as BlobPart]))).rejects.toThrow();
    for (const mutate of [
      (data: DataView) => data.setUint16(base.eocd + 4, 1, true),
      (data: DataView) => data.setUint16(base.central + 10, 99, true),
      (data: DataView) => data.setUint32(base.eocd + 12, 16 * 1024 * 1024 + 1, true),
      (data: DataView) => data.setUint16(base.eocd + 10, 2001, true),
    ]) {
      const bytes = base.bytes.slice();
      mutate(new DataView(bytes.buffer));
      await expect(inspectBackupZip(new Blob([bytes as BlobPart]))).rejects.toThrow();
    }
  });

  it('rejects unsafe spellings and duplicate normalized paths', async () => {
    for (const path of ['/root', 'C:/media/x', 'media\\x', 'media/../x', 'media/%2e%2e/x', 'media//x', 'media/café']) {
      const output = capture();
      await expect(writeBackupArchive([{ path, blob: new Blob(['x']) }], output.stream)).rejects.toThrow();
      expect(output.aborted).toBe(true);
    }
    const output = capture();
    await expect(writeBackupArchive([
      { path: 'media/ONE', blob: new Blob(['a']) },
      { path: 'media/one', blob: new Blob(['b']) },
    ], output.stream)).rejects.toThrow();
    expect(output.aborted).toBe(true);
  });

  it('rejects missing ZIP64 extras, forged ratio, and local or descriptor mismatches', async () => {
    const base = legacy();
    const mutations = [
      (data: DataView) => data.setUint32(base.central + 24, 0xffffffff, true),
      (data: DataView) => data.setUint32(base.central + 24, 1024 * 1024 + 1, true),
      (data: DataView) => data.setUint16(8, 0, true),
      (data: DataView) => data.setUint32(base.central + 42, base.central, true),
    ];
    for (const mutate of mutations) {
      const bytes = base.bytes.slice();
      mutate(new DataView(bytes.buffer));
      await expect(inspectBackupZip(new Blob([bytes as BlobPart]))).rejects.toThrow();
    }
    const output = capture();
    await writeBackupArchive([{ path: 'manifest.json', blob: new Blob(['descriptor']) }], output.stream);
    const bytes = new Uint8Array(await output.blob.arrayBuffer());
    const descriptor = bytes.findIndex((value, i) => value === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 7 && bytes[i + 3] === 8);
    expect(descriptor).toBeGreaterThan(0);
    bytes[descriptor + 4] ^= 1;
    await expect(inspectBackupZip(new Blob([bytes as BlobPart]))).rejects.toThrow();
    const badSize = new Uint8Array(await output.blob.arrayBuffer());
    badSize[descriptor + 8] ^= 1;
    await expect(inspectBackupZip(new Blob([badSize as BlobPart]))).rejects.toThrow();
  });

  it('enforces the entry count at exactly 2000 and rejects 2001 entries', async () => {
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < 2000; i++) files[`media/${i}.bin`] = new Uint8Array(0);
    const accepted = zipSync(files);
    expect((await inspectBackupZip(new Blob([accepted as BlobPart]))).entries).toHaveLength(2000);
    files['manifest.json'] = new Uint8Array(0);
    await expect(inspectBackupZip(new Blob([zipSync(files) as BlobPart]))).rejects.toThrow(/entry count/);
  });

  it('propagates read cancellation and destination failures without returning success', async () => {
    const source = new Blob([zipSync({ 'manifest.json': strToU8('cancel me') }) as BlobPart]);
    const controller = new AbortController();
    await expect(readBackupArchive(source, async () => new WritableStream<Uint8Array>({
      write() { controller.abort(); },
    }), { signal: controller.signal })).rejects.toThrow();

    const failing = new WritableStream<Uint8Array>({ write() { throw new Error('Disk quota'); } });
    await expect(writeBackupArchive([{ path: 'manifest.json', blob: new Blob(['x']) }], failing)).rejects.toThrow('Disk quota');
    const closeFailure = new WritableStream<Uint8Array>({ close() { throw new Error('Permission denied on close'); } });
    await expect(writeBackupArchive([{ path: 'manifest.json', blob: new Blob(['x']) }], closeFailure)).rejects.toThrow('Permission denied on close');
  });

  it('rejects malformed trailing central and local extras and duplicate ZIP64 records', async () => {
    const base = legacy({ 'manifest.json': strToU8('test') });
    const nameLength = base.data.getUint16(base.central + 28, true);
    const centralExtraOffset = base.central + 46 + nameLength;
    const centralMalformed = insertBytes(base.bytes, centralExtraOffset, [1, 0, 0, 0, 0x99, 0x99, 0xff, 0xff]);
    const centralData = new DataView(centralMalformed.buffer);
    centralData.setUint16(base.central + 30, 8, true);
    centralData.setUint32(centralMalformed.length - 22 + 12, base.data.getUint32(base.eocd + 12, true) + 8, true);
    await expect(inspectBackupZip(new Blob([centralMalformed as BlobPart]))).rejects.toThrow(/malformed extra/);

    const localExtraOffset = 30 + base.data.getUint16(26, true);
    const localMalformed = insertBytes(base.bytes, localExtraOffset, [0x99, 0x99, 0xff, 0xff]);
    const localData = new DataView(localMalformed.buffer);
    localData.setUint16(28, 4, true);
    localData.setUint32(localMalformed.length - 22 + 16, base.central + 4, true);
    await expect(inspectBackupZip(new Blob([localMalformed as BlobPart]))).rejects.toThrow(/malformed extra/);

    const duplicateZip64 = insertBytes(base.bytes, centralExtraOffset, [1, 0, 0, 0, 1, 0, 0, 0]);
    const duplicateData = new DataView(duplicateZip64.buffer);
    duplicateData.setUint16(base.central + 30, 8, true);
    duplicateData.setUint32(duplicateZip64.length - 22 + 12, base.data.getUint32(base.eocd + 12, true) + 8, true);
    await expect(inspectBackupZip(new Blob([duplicateZip64 as BlobPart]))).rejects.toThrow(/duplicate ZIP64/);

    const zip64Output = capture();
    await writeBackupArchive([{ path: 'manifest.json', blob: new Blob(['descriptor']) }], zip64Output.stream);
    const descriptorBytes = new Uint8Array(await zip64Output.blob.arrayBuffer());
    const descriptorView = new DataView(descriptorBytes.buffer);
    expect(descriptorView.getUint16(6, true) & 8).toBe(8);
    const extraOffset = 30 + descriptorView.getUint16(26, true);
    expect(descriptorView.getUint16(28, true)).toBeGreaterThanOrEqual(20);
    descriptorBytes[extraOffset + 2] = 0;
    descriptorBytes[extraOffset + 3] = 0;
    descriptorBytes[extraOffset + 18] = 0xff;
    descriptorBytes[extraOffset + 19] = 0xff;
    await expect(inspectBackupZip(new Blob([descriptorBytes as BlobPart]))).rejects.toThrow(/malformed extra/);
  });

  it('rejects symlink and device mode bits even when the host says DOS', async () => {
    const base = legacy();
    for (const mode of [0xa1ff, 0x61ff, 0x21ff]) {
      const bytes = base.bytes.slice();
      const data = new DataView(bytes.buffer);
      data.setUint16(base.central + 4, 20, true); // DOS host
      data.setUint32(base.central + 38, mode << 16, true);
      await expect(inspectBackupZip(new Blob([bytes as BlobPart]))).rejects.toThrow(/non-file/);
    }
    const directory = base.bytes.slice();
    new DataView(directory.buffer).setUint32(base.central + 38, 0x10, true);
    await expect(inspectBackupZip(new Blob([directory as BlobPart]))).rejects.toThrow(/non-file/);
  });

  it('honors abort after the EOCD write and treats an abort during successful close as late', async () => {
    const controller = new AbortController();
    let aborted = false;
    let closed = false;
    const destination = new WritableStream<Uint8Array>({
      write(chunk) {
        if (chunk.some((value, i) => value === 0x50 && chunk[i + 1] === 0x4b && chunk[i + 2] === 5 && chunk[i + 3] === 6)) controller.abort();
      },
      close() { closed = true; },
      abort() { aborted = true; },
    });
    await expect(writeBackupArchive([{ path: 'manifest.json', blob: new Blob(['x']) }], destination, { signal: controller.signal })).rejects.toThrow();
    expect(controller.signal.aborted).toBe(true);
    expect(closed).toBe(false);
    expect(aborted).toBe(true);

    const late = new AbortController();
    let closeCalls = 0;
    const committed = new WritableStream<Uint8Array>({ close() { closeCalls++; late.abort(); } });
    const result = await writeBackupArchive([{ path: 'manifest.json', blob: new Blob(['x']) }], committed, { signal: late.signal });
    expect(result.entries).toHaveLength(1);
    expect(closeCalls).toBe(1);
    expect(late.signal.aborted).toBe(true);
  });
});
