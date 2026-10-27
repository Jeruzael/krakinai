import { beforeEach, expect, it, vi } from 'vitest';
import {
  captureRestoreBaseline, clearAllStoresForTesting, getAllSnapshot, initializeDatabase, openDatabase,
  reopenDatabaseAfterPageReloadForTesting, replaceAllStoresTransactionally, saveMediaAsset, createCollection,
} from '../storage/db';
import { beginLibraryWrite, LIBRARY_CLOCK_ID, LIBRARY_GENERATION_ID, libraryTransactionError, registerLibraryConnection } from '../storage/libraryWrite';

beforeEach(clearAllStoresForTesting);

async function privateValue(id: string): Promise<{ id: string; token: string } | undefined> {
  const tx = (await openDatabase()).transaction('preferences', 'readonly');
  const request = tx.objectStore('preferences').get(id);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function complete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(libraryTransactionError(tx));
    tx.onerror = () => reject(libraryTransactionError(tx));
  });
}

it('captures private clock/generation atomically without exporting them as preferences', async () => {
  const baseline = await captureRestoreBaseline();
  expect(baseline.clock).toBe((await privateValue(LIBRARY_CLOCK_ID))?.token);
  expect(baseline.generation).toBe((await privateValue(LIBRARY_GENERATION_ID))?.token);
  expect((await getAllSnapshot()).preferences.id).toBe('app_preferences');
  expect(JSON.stringify(await getAllSnapshot())).not.toContain(LIBRARY_CLOCK_ID);
});

it('does not invalidate a prepared baseline when page initialization has nothing to write', async () => {
  await initializeDatabase();
  const baseline = await captureRestoreBaseline();
  await reopenDatabaseAfterPageReloadForTesting();
  await initializeDatabase();
  expect(await captureRestoreBaseline()).toEqual(baseline);
});

it('invalidates a preview for a same-size same-metadata blob replacement', async () => {
  const original = await saveMediaAsset({ id: 'same', filename: 'same.png', mimeType: 'image/png', blob: new Blob(['a'], { type: 'image/png' }) });
  const baseline = await captureRestoreBaseline();
  await saveMediaAsset({ id: original.id, filename: original.filename, mimeType: original.mimeType, blob: new Blob(['b'], { type: 'image/png' }) });
  const current = await getAllSnapshot();
  await expect(replaceAllStoresTransactionally(current, { baseline })).rejects.toThrow(/changed since backup preview/i);
  expect(await (await getAllSnapshot()).media[0].blob.text()).toBe('b');
});

it('rolls back all stores and both private tokens after a queued put failure', async () => {
  const original = await getAllSnapshot();
  const before = await captureRestoreBaseline();
  const candidate = { ...original, media: [{ id: 'x', blob: new Blob(['x']), byteSize: 1 }] } as never;
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
    if (this.name === 'media' && (value as { id?: string }).id === 'x') throw new Error('Injected write failure');
    return put.call(this, value, key);
  });
  try { await expect(replaceAllStoresTransactionally(candidate, { baseline: before })).rejects.toThrow(/Injected write failure/); }
  finally { vi.restoreAllMocks(); }
  expect(await getAllSnapshot()).toEqual(original);
  expect(await captureRestoreBaseline()).toEqual(before);
  await saveMediaAsset({ filename: 'still-writable.png', mimeType: 'image/png', blob: new Blob(['safe']) });
});

it('rolls back a later asynchronous request error after earlier replacement puts', async () => {
  const original = await getAllSnapshot();
  const before = await captureRestoreBaseline();
  const candidate = { ...original, assets: [{ id: 'duplicate' }, { id: 'duplicate' }] } as never;
  const put = IDBObjectStore.prototype.put;
  const add = IDBObjectStore.prototype.add;
  let assetPuts = 0;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
    if (this.name === 'assets' && ++assetPuts === 2) return add.call(this, value, key);
    return put.call(this, value, key);
  });
  try { await expect(replaceAllStoresTransactionally(candidate, { baseline: before })).rejects.toThrow(); }
  finally { vi.restoreAllMocks(); }
  expect(await getAllSnapshot()).toEqual(original);
  expect(await captureRestoreBaseline()).toEqual(before);
});

it('fences initiating and already-open connections after restore, then permits a fresh page connection', async () => {
  const native = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('krakinai_prompt_library_db', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await registerLibraryConnection(native);
  const data = await getAllSnapshot();
  await replaceAllStoresTransactionally(data, { baseline: await captureRestoreBaseline() });
  await expect(saveMediaAsset({ filename: 'stale.png', mimeType: 'image/png', blob: new Blob(['x']) })).rejects.toThrow(/reload/i);
  await expect(createCollection({ name: 'Stale project' })).rejects.toThrow(/reload/i);
  const oldTx = beginLibraryWrite(native, ['assets']);
  const oldDone = complete(oldTx);
  oldTx.objectStore('assets').put({ id: 'stale' });
  await expect(oldDone).rejects.toThrow(/reload/i);
  native.close();
  expect((await getAllSnapshot()).assets).toEqual([]);
  await reopenDatabaseAfterPageReloadForTesting();
  await saveMediaAsset({ filename: 'fresh.png', mimeType: 'image/png', blob: new Blob(['x']) });
  expect((await getAllSnapshot()).media).toHaveLength(1);
});

it('fails closed for unregistered and malformed generation records', async () => {
  const native = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('krakinai_prompt_library_db', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  expect(() => beginLibraryWrite(native, ['assets'])).toThrow(/not registered/i);
  native.close();
  const db = await openDatabase();
  const tx = db.transaction('preferences', 'readwrite');
  const completion = complete(tx);
  tx.objectStore('preferences').put({ id: LIBRARY_GENERATION_ID, token: 12 });
  await completion;
  await expect(saveMediaAsset({ filename: 'bad.png', mimeType: 'image/png', blob: new Blob(['x']) })).rejects.toThrow(/malformed/i);
  expect((await getAllSnapshot()).media).toEqual([]);
});

it('registers an absent pre-feature generation as a stable null sentinel', async () => {
  const db = await openDatabase();
  const tx = db.transaction('preferences', 'readwrite');
  const completion = complete(tx);
  tx.objectStore('preferences').delete(LIBRARY_GENERATION_ID);
  await completion;
  await reopenDatabaseAfterPageReloadForTesting();
  const baseline = await captureRestoreBaseline();
  expect(baseline.generation).toBeNull();
  await saveMediaAsset({ filename: 'legacy.png', mimeType: 'image/png', blob: new Blob(['legacy']) });
  expect((await captureRestoreBaseline()).generation).toBeNull();
});
