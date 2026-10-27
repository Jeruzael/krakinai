/** Private records share the existing preferences store; they are never exported. */
export const LIBRARY_CLOCK_ID = 'library_mutation_clock';
export const LIBRARY_GENERATION_ID = 'library_restore_generation';

const registered = new WeakMap<IDBDatabase, string | null>();
const failures = new WeakMap<IDBTransaction, Error>();

export function newLibraryToken(): string {
  if (!globalThis.crypto?.randomUUID) throw new Error('Secure random IDs are unavailable.');
  return globalThis.crypto.randomUUID();
}

export function readPrivateToken(value: unknown, id: string): string | null {
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || (value as { id?: unknown }).id !== id ||
      typeof (value as { token?: unknown }).token !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((value as { token: string }).token)) {
    throw new Error(`Library ${id} record is malformed.`);
  }
  return (value as { token: string }).token;
}

export function registeredLibraryGeneration(db: IDBDatabase): string | null {
  if (!registered.has(db)) throw new Error('Library connection is not registered; reload this page.');
  return registered.get(db)!;
}

export async function registerLibraryConnection(db: IDBDatabase): Promise<void> {
  if (registered.has(db)) return;
  const tx = db.transaction(['preferences'], 'readonly');
  const req = tx.objectStore('preferences').get(LIBRARY_GENERATION_ID);
  await new Promise<void>((resolve, reject) => {
    let token: string | null;
    req.onsuccess = () => {
      try { token = readPrivateToken(req.result, LIBRARY_GENERATION_ID); }
      catch (error) { try { tx.abort(); } catch { /* already finished */ } reject(error); }
    };
    tx.oncomplete = () => { registered.set(db, token!); resolve(); };
    tx.onabort = () => reject(tx.error ?? new Error('Library generation registration failed.'));
    tx.onerror = () => reject(tx.error ?? new Error('Library generation registration failed.'));
  });
}

/** Only the test reset may adopt the generation left by its own clear. */
export async function adoptLibraryGenerationAfterTestReset(db: IDBDatabase): Promise<void> {
  registered.delete(db);
  await registerLibraryConnection(db);
}

export function staleLibraryError(): Error {
  return new Error('The library was restored in another tab. Reload this page before saving.');
}

export function markLibraryReloadRequired(tx: IDBTransaction): void {
  failures.set(tx, staleLibraryError());
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('krakinai-library-reload-required'));
}

export function libraryTransactionError(tx: IDBTransaction, fallback = 'Database transaction failed.'): Error {
  return failures.get(tx) ?? tx.error ?? new Error(fallback);
}

export function libraryCaughtError(tx: IDBTransaction, error: unknown): unknown {
  return failures.get(tx) ?? error;
}

export function beginLibraryWrite(db: IDBDatabase, stores: readonly string[]): IDBTransaction {
  const expected = registeredLibraryGeneration(db);
  const clock = newLibraryToken();
  const names = [...new Set([...stores, 'preferences'])];
  const tx = db.transaction(names, 'readwrite');
  try {
    const prefs = tx.objectStore('preferences');
    const first = prefs.get(LIBRARY_GENERATION_ID);
    first.onsuccess = () => {
      try {
        if (readPrivateToken(first.result, LIBRARY_GENERATION_ID) !== expected) {
          markLibraryReloadRequired(tx);
          tx.abort();
        }
      } catch (error) {
        failures.set(tx, error instanceof Error ? error : new Error(String(error)));
        tx.abort();
      }
    };
    prefs.put({ id: LIBRARY_CLOCK_ID, token: clock });
  } catch (error) {
    try { tx.abort(); } catch { /* already inactive */ }
    throw error;
  }
  return tx;
}
