/** Disposable OPFS payloads with a small, persistent IndexedDB catalog. */
import { MAX_BACKUP_UNCOMPRESSED_BYTES } from '../domain/validation';

const CATALOG_NAME = 'krakinai_restore_stages';
const CATALOG_STORE = 'stages';
const DIRECTORY = 'restore-stages';
const MAX_CATALOG_METADATA_BYTES = 1024 * 1024;

type StageState = 'staging' | 'ready' | 'committed';
interface StageFile { path: string; name: string; size: number; complete: boolean }
interface StageRecord { id: string; state: StageState; metadata: unknown; files: StageFile[] }

export interface RestoreStage {
  id: string;
  metadata: unknown;
  state: string;
  createSink(path: string): Promise<WritableStream<Uint8Array>>;
  getEntries(): Promise<Map<string, File>>;
  markReady(metadata: unknown): Promise<void>;
  markCommitted(): Promise<void>;
  discard(): Promise<void>;
}

function safePath(path: string): boolean {
  return typeof path === 'string' && path.length > 0 && path.length <= 512 &&
    !path.startsWith('/') && !path.includes('\\') && !path.includes(':') && !/[\u0000-\u001f\u007f]/.test(path) &&
    path.split('/').every(part => part.length > 0 && part !== '.' && part !== '..');
}

function boundedMetadata(metadata: unknown): void {
  if (metadata === undefined) return;
  const json = JSON.stringify(metadata);
  if (json === undefined || new TextEncoder().encode(json).byteLength > MAX_CATALOG_METADATA_BYTES) {
    throw new Error('Restore stage metadata is too large or invalid.');
  }
}

function randomId(): string {
  if (!globalThis.crypto?.randomUUID) throw new Error('Secure random IDs are unavailable.');
  return globalThis.crypto.randomUUID();
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Restore catalog request failed.'));
  });
}

function complete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('Restore catalog transaction aborted.'));
    tx.onerror = () => reject(tx.error ?? new Error('Restore catalog transaction failed.'));
  });
}

function openCatalog(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CATALOG_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(CATALOG_STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Restore catalog is unavailable.'));
  });
}

async function catalogRead(id: string): Promise<StageRecord> {
  const db = await openCatalog();
  try {
    const tx = db.transaction(CATALOG_STORE, 'readonly');
    const result = await request<StageRecord | undefined>(tx.objectStore(CATALOG_STORE).get(id));
    await complete(tx);
    if (!result) throw new Error('Restore stage was not found.');
    return result;
  } finally { db.close(); }
}

async function catalogPut(record: StageRecord): Promise<void> {
  const db = await openCatalog();
  try {
    const tx = db.transaction(CATALOG_STORE, 'readwrite');
    tx.objectStore(CATALOG_STORE).put(record);
    await complete(tx);
  } finally { db.close(); }
}

async function catalogUpdate(id: string, edit: (record: StageRecord) => void): Promise<StageRecord> {
  const db = await openCatalog();
  try {
    const tx = db.transaction(CATALOG_STORE, 'readwrite');
    const completion = complete(tx);
    let next: StageRecord | undefined;
    const req = tx.objectStore(CATALOG_STORE).get(id);
    req.onsuccess = () => {
      try {
        if (!req.result) throw new Error('Restore stage was not found.');
        next = req.result as StageRecord;
        edit(next);
        tx.objectStore(CATALOG_STORE).put(next);
      } catch (error) {
        updateFailure = error instanceof Error ? error : new Error(String(error));
        tx.abort();
      }
    };
    let updateFailure: Error | undefined;
    try { await completion; } catch (error) { throw updateFailure ?? error; }
    return next!;
  } finally { db.close(); }
}

async function rootDirectory(): Promise<FileSystemDirectoryHandle> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
    throw new Error('Temporary disk staging (OPFS) is unavailable in this browser.');
  }
  return (await navigator.storage.getDirectory()).getDirectoryHandle(DIRECTORY, { create: true });
}

async function stageDirectory(id: string, create = false): Promise<FileSystemDirectoryHandle> {
  return (await rootDirectory()).getDirectoryHandle(id, { create });
}

class Stage implements RestoreStage {
  constructor(private record: StageRecord) {}
  get id(): string { return this.record.id; }
  get metadata(): unknown { return this.record.metadata; }
  get state(): string { return this.record.state; }

  async createSink(path: string): Promise<WritableStream<Uint8Array>> {
    if (!safePath(path)) throw new Error('Invalid restore entry path.');
    if (this.record.state !== 'staging') throw new Error('Restore stage is no longer writable.');
    const name = randomId();
    this.record = await catalogUpdate(this.id, record => {
      if (record.state !== 'staging' || record.files.some(file => file.path === path)) {
        throw new Error('Duplicate or unwritable restore entry.');
      }
      record.files.push({ path, name, size: 0, complete: false });
    });
    const directory = await stageDirectory(this.id, true);
    const file = await directory.getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    let size = 0;
    return new WritableStream<Uint8Array>({
      async write(chunk) {
        if (!(chunk instanceof Uint8Array)) throw new Error('Restore chunk must be bytes.');
        if (size + chunk.byteLength > MAX_BACKUP_UNCOMPRESSED_BYTES) {
          throw new Error('Restore stage entry exceeds the uncompressed backup limit.');
        }
        try { await writable.write(new Uint8Array(chunk).buffer); }
        catch (error) { try { await writable.abort(); } catch { /* preserve write error */ } throw error; }
        size += chunk.byteLength;
      },
      close: async () => {
        await writable.close();
        this.record = await catalogUpdate(this.id, record => {
          const entry = record.files.find(candidate => candidate.path === path && candidate.name === name);
          if (!entry) throw new Error('Restore stage entry disappeared.');
          entry.size = size;
          entry.complete = true;
        });
      },
      abort: async () => { await writable.abort(); },
    });
  }

  async getEntries(): Promise<Map<string, File>> {
    this.record = await catalogRead(this.id);
    const directory = await stageDirectory(this.id);
    const files = new Map<string, File>();
    for (const entry of this.record.files) {
      if (!entry.complete) throw new Error('Restore stage has an incomplete entry.');
      const file = await (await directory.getFileHandle(entry.name)).getFile();
      if (file.size !== entry.size) throw new Error('Restore stage file size changed.');
      files.set(entry.path, file);
    }
    return files;
  }

  async markReady(metadata: unknown): Promise<void> {
    boundedMetadata(metadata);
    this.record = await catalogUpdate(this.id, record => {
      if (record.state !== 'staging' || record.files.some(file => !file.complete)) {
        throw new Error('Restore stage is incomplete.');
      }
      record.metadata = metadata;
      record.state = 'ready';
    });
  }

  async markCommitted(): Promise<void> {
    this.record = await catalogUpdate(this.id, record => {
      if (record.state !== 'ready') throw new Error('Restore stage is not ready.');
      record.state = 'committed';
    });
  }

  async discard(): Promise<void> {
    const root = await rootDirectory();
    try { await root.removeEntry(this.id, { recursive: true }); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error; }
    const db = await openCatalog();
    try {
      const tx = db.transaction(CATALOG_STORE, 'readwrite');
      tx.objectStore(CATALOG_STORE).delete(this.id);
      await complete(tx);
    } finally { db.close(); }
  }
}

export async function createRestoreStage(metadata?: unknown): Promise<RestoreStage> {
  await rootDirectory();
  boundedMetadata(metadata);
  const record: StageRecord = { id: randomId(), state: 'staging', metadata, files: [] };
  await catalogPut(record);
  try { await stageDirectory(record.id, true); }
  catch (error) { /* Catalog survives so this interrupted stage is listable. */ throw error; }
  return new Stage(record);
}

export async function openRestoreStage(id: string): Promise<RestoreStage> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid restore stage ID.');
  await rootDirectory();
  return new Stage(await catalogRead(id));
}

export async function listRestoreStages(): Promise<Array<{ id: string; state: string; metadata: unknown }>> {
  await rootDirectory();
  const db = await openCatalog();
  try {
    const tx = db.transaction(CATALOG_STORE, 'readonly');
    const records = await request<StageRecord[]>(tx.objectStore(CATALOG_STORE).getAll());
    await complete(tx);
    return records.map(({ id, state, metadata }) => ({ id, state, metadata }));
  } finally { db.close(); }
}
