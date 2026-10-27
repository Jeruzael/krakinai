import { beforeEach, expect, it, vi } from 'vitest';
import { createRestoreStage, listRestoreStages, openRestoreStage } from '../storage/restoreStaging';

type Node = { directories: Map<string, Node>; files: Map<string, Uint8Array> };
const node = (): Node => ({ directories: new Map(), files: new Map() });
let root = node();

function directory(current: Node) {
  return {
    async getDirectoryHandle(name: string, options?: { create?: boolean }) {
      if (!current.directories.has(name) && options?.create) current.directories.set(name, node());
      const found = current.directories.get(name);
      if (!found) throw new DOMException('Missing directory', 'NotFoundError');
      return directory(found);
    },
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!current.files.has(name) && options?.create) current.files.set(name, new Uint8Array());
      if (!current.files.has(name)) throw new DOMException('Missing file', 'NotFoundError');
      return {
        async getFile() { return new File([Uint8Array.from(current.files.get(name)!).buffer], name); },
        async createWritable() {
          const parts: Uint8Array[] = [];
          return {
            async write(bytes: ArrayBuffer) { parts.push(new Uint8Array(bytes)); },
            async close() {
              const size = parts.reduce((sum, part) => sum + part.byteLength, 0);
              const result = new Uint8Array(size);
              let offset = 0;
              for (const part of parts) { result.set(part, offset); offset += part.byteLength; }
              current.files.set(name, result);
            },
            async abort() { current.files.delete(name); },
          };
        },
      };
    },
    async removeEntry(name: string) {
      if (!current.directories.delete(name) && !current.files.delete(name)) throw new DOMException('Missing entry', 'NotFoundError');
    },
  };
}

beforeEach(() => {
  root = node();
  Object.defineProperty(navigator, 'storage', { configurable: true, value: { getDirectory: async () => directory(root) } });
});

it('streams opaque files into OPFS and reopens a ready stage from its catalog', async () => {
  const stage = await createRestoreStage({ source: 'synthetic' });
  const sink = await stage.createSink('media/picture.png');
  const writer = sink.getWriter();
  await writer.write(new Uint8Array([1, 2]));
  await writer.write(new Uint8Array([3]));
  await writer.close();
  await stage.markReady({ verified: true });
  const reopened = await openRestoreStage(stage.id);
  expect(reopened.state).toBe('ready');
  expect(reopened.metadata).toEqual({ verified: true });
  const entries = await reopened.getEntries();
  expect([...entries.keys()]).toEqual(['media/picture.png']);
  expect(new Uint8Array(await entries.get('media/picture.png')!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  const dir = root.directories.get('restore-stages')!.directories.get(stage.id)!;
  expect([...dir.files.keys()][0]).not.toContain('picture.png');
  await reopened.markCommitted();
  expect((await listRestoreStages()).find(item => item.id === stage.id)?.state).toBe('committed');
  await reopened.discard();
  expect((await listRestoreStages()).some(item => item.id === stage.id)).toBe(false);
});

it('leaves an interrupted stage listable and rejects unsafe or duplicate paths', async () => {
  const stage = await createRestoreStage();
  await expect(stage.createSink('../escape')).rejects.toThrow(/Invalid restore entry path/);
  await expect(stage.createSink('media\\escape')).rejects.toThrow(/Invalid restore entry path/);
  await stage.createSink('manifest.json');
  await expect(stage.createSink('manifest.json')).rejects.toThrow(/Duplicate/);
  await expect(stage.markReady({})).rejects.toThrow(/incomplete/);
  expect((await listRestoreStages()).find(item => item.id === stage.id)?.state).toBe('staging');
  await (await openRestoreStage(stage.id)).discard();
});

it('retains the staging state when a catalog update fails', async () => {
  const stage = await createRestoreStage();
  const sink = await stage.createSink('manifest.json');
  await sink.getWriter().close();
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
    if (this.name === 'stages' && (value as { state?: string }).state === 'ready') throw new Error('Catalog fault');
    return put.call(this, value, key);
  });
  try { await expect(stage.markReady({ verified: true })).rejects.toThrow(/Catalog fault/); }
  finally { vi.restoreAllMocks(); }
  expect((await openRestoreStage(stage.id)).state).toBe('staging');
  await stage.discard();
});
