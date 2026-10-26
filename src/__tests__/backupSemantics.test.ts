import { beforeEach, expect, it, vi } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { clearAllStoresForTesting, getAllSnapshot, initializeDatabase, saveMediaAsset, savePromptAsset } from '../storage/db';
import {
  commitPreparedBackupRestore, discardPreparedBackupRestore, exportFullBackupZip,
  exportFullBackupToStream, prepareFullBackupRestore, restoreFullBackupZip, resumeFullBackupRestore, validateBackupZip,
  verifyFullBackupFile,
} from '../storage/backup';

beforeEach(async () => { await clearAllStoresForTesting(); await initializeDatabase(); });

async function mutate(change: (files: Record<string, Uint8Array>, manifest: any) => void): Promise<Uint8Array> {
  const files = unzipSync(await exportFullBackupZip());
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  change(files, manifest);
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  return zipSync(files);
}

it('rejects an unassociated archive payload', async () => {
  const bytes = await mutate(files => { files['media/orphan.png'] = strToU8('orphan'); });
  expect((await validateBackupZip(bytes)).error).toMatch(/unassociated|unexpected/i);
});

it('accepts its own streamed small export', async () => {
  const result = await validateBackupZip(await exportFullBackupZip());
  expect(result.error).toBeUndefined();
  expect(result.valid).toBe(true);
});

it('accepts an export after restoring a version 1 backup', async () => {
  await restoreFullBackupZip(await exportFullBackupZip());
  const result = await validateBackupZip(await exportFullBackupZip());
  expect(result.error).toBeUndefined();
  expect(result.valid).toBe(true);
});

it('checks poster byte size against the actual poster', async () => {
  await saveMediaAsset({ filename: 'video.mp4', mimeType: 'video/mp4', blob: new Blob(['video']), posterBlob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }) });
  const bytes = await mutate((_files, manifest) => { manifest.media[0].posterByteSize = 1; });
  expect((await validateBackupZip(bytes)).error).toMatch(/poster.*size|size.*poster/i);
});

it('rejects a poster whose bytes are not JPEG', async () => {
  await saveMediaAsset({ filename: 'video.mp4', mimeType: 'video/mp4', blob: new Blob(['video']), posterBlob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }) });
  const bytes = await mutate((files, manifest) => {
    files[manifest.media[0].posterArchivePath] = strToU8('not JPEG');
    manifest.media[0].posterByteSize = files[manifest.media[0].posterArchivePath].length;
    delete manifest.media[0].posterSha256;
  });
  expect((await validateBackupZip(bytes)).error).toMatch(/JPEG|poster/i);
});

it('checks an optional media SHA-256 digest', async () => {
  await saveMediaAsset({ filename: 'image.png', mimeType: 'image/png', blob: new Blob(['image']) });
  const bytes = await mutate((_files, manifest) => { manifest.media[0].sha256 = '0'.repeat(64); });
  expect((await validateBackupZip(bytes)).error).toMatch(/sha|hash|digest/i);
});

it('accepts legacy version 1 media entries without SHA-256 fields', async () => {
  await saveMediaAsset({ filename: 'image.png', mimeType: 'image/png', blob: new Blob(['legacy image']) });
  const bytes = await mutate((_files, manifest) => {
    delete manifest.media[0].sha256;
    delete manifest.media[0].posterSha256;
  });
  const result = await validateBackupZip(bytes);
  expect(result.error).toBeUndefined();
  expect(result.summary?.mediaCount).toBe(1);
});

it('restores media and poster Blob MIME types from validated manifest entries', async () => {
  await saveMediaAsset({
    filename: 'starter.svg',
    mimeType: 'image/svg+xml',
    blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' }),
  });
  await saveMediaAsset({
    filename: 'clip.mp4',
    mimeType: 'video/mp4',
    blob: new Blob(['synthetic video'], { type: 'video/mp4' }),
    posterBlob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
  });
  await restoreFullBackupZip(await exportFullBackupZip());
  const media = (await getAllSnapshot()).media;
  expect(media.find(item => item.filename === 'starter.svg')?.blob.type).toBe('image/svg+xml');
  const video = media.find(item => item.filename === 'clip.mp4');
  expect(video?.blob.type).toBe('video/mp4');
  expect(video?.posterBlob?.type).toBe('image/jpeg');
});

it('rejects a media file above its individual image limit', async () => {
  await saveMediaAsset({ filename: 'image.png', mimeType: 'image/png', blob: new Blob(['image']) });
  const bytes = await mutate((files, manifest) => {
    files[manifest.media[0].archivePath] = new Uint8Array(10 * 1024 * 1024 + 1);
    manifest.media[0].byteSize = files[manifest.media[0].archivePath].length;
  });
  expect((await validateBackupZip(bytes)).error).toMatch(/image.*10|10.*image|limit/i);
});

it('prepares, resumes, and verifies a backup without changing live records', async () => {
  await savePromptAsset({ title: 'Kept', category: 'styles', promptText: 'Keep this', tags: [] });
  const bytes = await exportFullBackupZip();
  const before = await getAllSnapshot();
  const report = await verifyFullBackupFile(new Blob([Uint8Array.from(bytes).buffer]));
  expect(report.summary.assetsCount).toBe(1);
  const prepared = await prepareFullBackupRestore(new Blob([Uint8Array.from(bytes).buffer]));
  expect((await resumeFullBackupRestore(prepared.stageId)).summary).toEqual(report.summary);
  expect(await getAllSnapshot()).toEqual(before);
  await discardPreparedBackupRestore(prepared);
  await expect(resumeFullBackupRestore(prepared.stageId)).rejects.toThrow();
});

it('writes the production stream through destination close and verifies its bytes', async () => {
  await saveMediaAsset({ filename: 'image.png', mimeType: 'image/png', blob: new Blob(['synthetic bytes'], { type: 'image/png' }) });
  const chunks: Uint8Array[] = [];
  let closed = false;
  const result = await exportFullBackupToStream(new WritableStream<Uint8Array>({
    write(chunk) { chunks.push(chunk.slice()); },
    close() { closed = true; },
  }));
  expect(closed).toBe(true);
  const blob = new Blob(chunks.map(chunk => Uint8Array.from(chunk).buffer));
  expect(result.compressedBytes).toBe(blob.size);
  expect((await verifyFullBackupFile(blob)).summary.mediaCount).toBe(1);
});

it('preserves a ready stage and live records when a preview becomes stale', async () => {
  const bytes = await exportFullBackupZip();
  const prepared = await prepareFullBackupRestore(new Blob([Uint8Array.from(bytes).buffer]));
  const newAsset = await savePromptAsset({ title: 'Changed after preview', category: 'styles', promptText: 'Keep this', tags: [] });
  await expect(commitPreparedBackupRestore(prepared)).rejects.toThrow(/changed|conflict|modified|reload/i);
  expect((await getAllSnapshot()).assets.some(asset => asset.id === newAsset.id)).toBe(true);
  expect((await resumeFullBackupRestore(prepared.stageId)).summary).toEqual(prepared.summary);
  await discardPreparedBackupRestore(prepared);
});

it('reports success if stage catalog marking fails after the live commit', async () => {
  type Node = { dirs: Map<string, Node>; files: Map<string, Uint8Array> };
  const makeNode = (): Node => ({ dirs: new Map(), files: new Map() });
  const root = makeNode();
  const directory = (node: Node): any => ({
    async getDirectoryHandle(name: string, options?: { create?: boolean }) {
      if (!node.dirs.has(name) && options?.create) node.dirs.set(name, makeNode());
      const child = node.dirs.get(name);
      if (!child) throw new DOMException('Missing', 'NotFoundError');
      return directory(child);
    },
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!node.files.has(name) && options?.create) node.files.set(name, new Uint8Array());
      if (!node.files.has(name)) throw new DOMException('Missing', 'NotFoundError');
      return {
        async getFile() { return new File([Uint8Array.from(node.files.get(name)!).buffer], name); },
        async createWritable() {
          const parts: Uint8Array[] = [];
          return {
            async write(bytes: ArrayBuffer) { parts.push(new Uint8Array(bytes)); },
            async close() {
              const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
              let offset = 0;
              for (const part of parts) { output.set(part, offset); offset += part.length; }
              node.files.set(name, output);
            },
            async abort() { node.files.delete(name); },
          };
        },
      };
    },
    async removeEntry(name: string) {
      if (!node.dirs.delete(name) && !node.files.delete(name)) throw new DOMException('Missing', 'NotFoundError');
    },
  });
  const originalStorage = navigator.storage;
  Object.defineProperty(navigator, 'storage', { configurable: true, value: { getDirectory: async () => directory(root) } });
  try {
    const archive = await mutate((_files, manifest) => {
      manifest.assets = [{ id: 'asset_from_zip', title: 'From backup', category: 'styles', promptText: 'Restored', mediaLinks: [] }];
    });
    const prepared = await prepareFullBackupRestore(new Blob([Uint8Array.from(archive).buffer]));
    const originalPut = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value: any, key?: IDBValidKey) {
      if (this.name === 'stages' && value?.state === 'committed') throw new Error('Catalog disk fault');
      return key === undefined ? originalPut.call(this, value) : originalPut.call(this, value, key);
    });
    const phases: string[] = [];
    try {
      const summary = await commitPreparedBackupRestore(prepared, { onProgress: progress => phases.push(progress.phase) });
      expect(summary.assetsCount).toBe(1);
    } finally { spy.mockRestore(); }
    expect(phases).toContain('commit-records');
    expect(phases).toContain('committed-stage-cleanup-required');
    expect((await getAllSnapshot()).assets[0].id).toBe('asset_from_zip');
    await discardPreparedBackupRestore(prepared);
  } finally {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: originalStorage });
  }
});
