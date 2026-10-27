import { captureMediaNames } from '../domain/mediaNaming';
import { adoptLibraryGenerationAfterTestReset, beginLibraryWrite, libraryTransactionError, libraryCaughtError, LIBRARY_CLOCK_ID, LIBRARY_GENERATION_ID, markLibraryReloadRequired, newLibraryToken, readPrivateToken, registerLibraryConnection, registeredLibraryGeneration } from './libraryWrite';
import { findSimilarScenes, sceneDuplicateKey, SimilarSceneError } from '../domain/sceneDuplicates';
import { getProjectShots, projectMembersFromShots, removeTakeFromProject } from '../domain/projectStoryboard';
export { SimilarSceneError } from '../domain/sceneDuplicates';
import { getIdentityRevision, resolveGenerationIdentity } from '../domain/identityAnchors';
import {
  SCHEMA_VERSION,
  type BuilderSlot,
  type Collection,
  type CollectionMemberType,
  type ProjectShot,
  type ComponentSnapshot,
  type MediaAsset,
  type MediaLink,
  type OutputMode,
  type Preferences,
  type PromptAsset,
  type PromptCategory,
  type ProvenanceMetadata,
  type ReviewStatus,
  type SavedScene,
  type SceneDraft,
  type SceneSettings,
  type Template,
  type Variant,
  type VariantType,
} from '../types/domain';
import {
  assembleScenePrompt,
  createSnapshotFromAsset,
  createSnapshotFromTemplateDefault,
  createSnapshotFromVariant,
  ORDERED_BUILDER_SLOTS,
} from '../domain/promptAssembler';
import { buildStarterLibraryBundle, getStarterTemplates } from '../domain/starterData';
import {
  MAX_TOTAL_MEDIA_BYTES,
  VARIANT_TYPE_TO_SLOT,
  validateCollectionInput,
  validatePromptAssetInput,
  validateVariantInput,
} from '../domain/validation';

const DB_NAME = 'krakinai_prompt_library_db';
const DB_VERSION = 1;

export const STORE_NAMES = [
  'assets',
  'variants',
  'media',
  'drafts',
  'scenes',
  'collections',
  'templates',
  'preferences',
] as const;

export type StoreName = (typeof STORE_NAMES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser environment.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORE_NAMES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => {
      registerLibraryConnection(req.result).then(() => resolve(req.result), error => {
        req.result.close();
        dbPromise = null;
        reject(error);
      });
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error || new Error('Failed to open IndexedDB.'));
    };
  });
  return dbPromise;
}

/** Test-only equivalent of discarding the old page's native connection. */
export async function reopenDatabaseAfterPageReloadForTesting(): Promise<IDBDatabase> {
  const db = await openDatabase();
  db.close();
  dbPromise = null;
  return openDatabase();
}

function getAllFromStore<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as T[]);
    req.onerror = () => reject(libraryCaughtError(store.transaction, req.error));
  });
}

function getFromStore<T>(store: IDBObjectStore, id: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(libraryCaughtError(store.transaction, req.error));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(libraryTransactionError(tx));
    tx.onabort = () => reject(libraryTransactionError(tx, 'Database transaction aborted.'));
  });
}

export function generateId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `${prefix}_${rand}`;
}

export interface LibrarySnapshot {
  assets: PromptAsset[];
  variants: Variant[];
  media: MediaAsset[];
  drafts: SceneDraft[];
  scenes: SavedScene[];
  collections: Collection[];
  templates: Template[];
  preferences: Preferences;
}

export interface RestoreBaseline {
  clock: string | null;
  generation: string | null;
  fingerprint: string;
}

function fallbackPreferences(): Preferences {
  return { id: 'app_preferences', schemaVersion: SCHEMA_VERSION, starterLoaded: false, updatedAt: '' };
}

function snapshotRequests(tx: IDBTransaction) {
  return {
    assets: tx.objectStore('assets').getAll(),
    variants: tx.objectStore('variants').getAll(),
    media: tx.objectStore('media').getAll(),
    drafts: tx.objectStore('drafts').getAll(),
    scenes: tx.objectStore('scenes').getAll(),
    collections: tx.objectStore('collections').getAll(),
    templates: tx.objectStore('templates').getAll(),
    preferences: tx.objectStore('preferences').get('app_preferences'),
  };
}

function snapshotResults(requests: ReturnType<typeof snapshotRequests>): LibrarySnapshot {
  return {
    assets: requests.assets.result as PromptAsset[],
    variants: requests.variants.result as Variant[],
    media: requests.media.result as MediaAsset[],
    drafts: requests.drafts.result as SceneDraft[],
    scenes: requests.scenes.result as SavedScene[],
    collections: requests.collections.result as Collection[],
    templates: requests.templates.result as Template[],
    preferences: (requests.preferences.result as Preferences | undefined) ?? fallbackPreferences(),
  };
}

function metadataValue(value: unknown): unknown {
  if (value instanceof Blob) return { $blob: { size: value.size, type: value.type } };
  if (Array.isArray(value)) return value.map(metadataValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, metadataValue((value as Record<string, unknown>)[key])]));
  }
  return value;
}

function snapshotFingerprint(snapshot: LibrarySnapshot): string {
  const source = JSON.stringify(metadataValue(snapshot));
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < source.length; i++) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(source.charCodeAt(i))) * 0x100000001b3n);
  }
  return `${source.length}:${hash.toString(16)}`;
}

export async function captureRestoreBaseline(): Promise<RestoreBaseline> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAMES, 'readonly');
  const requests = snapshotRequests(tx);
  const clockReq = tx.objectStore('preferences').get(LIBRARY_CLOCK_ID);
  const generationReq = tx.objectStore('preferences').get(LIBRARY_GENERATION_ID);
  await txDone(tx);
  return {
    clock: readPrivateToken(clockReq.result, LIBRARY_CLOCK_ID),
    generation: readPrivateToken(generationReq.result, LIBRARY_GENERATION_ID),
    fingerprint: snapshotFingerprint(snapshotResults(requests)),
  };
}

export async function clearAllStoresForTesting(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAMES, 'readwrite');
  for (const name of STORE_NAMES) {
    tx.objectStore(name).clear();
  }
  tx.objectStore('preferences').put({ id: LIBRARY_CLOCK_ID, token: newLibraryToken() });
  tx.objectStore('preferences').put({ id: LIBRARY_GENERATION_ID, token: newLibraryToken() });
  await txDone(tx);
  await adoptLibraryGenerationAfterTestReset(db);
}

export async function initializeDatabase(): Promise<LibrarySnapshot> {
  const db = await openDatabase();
  const inspection = db.transaction(['preferences', 'templates'], 'readonly');
  const existingPrefs = inspection.objectStore('preferences').get('app_preferences');
  const templateCount = inspection.objectStore('templates').count();
  await txDone(inspection);
  if (existingPrefs.result && templateCount.result > 0) return getAllSnapshot();
  const tx = beginLibraryWrite(db, STORE_NAMES);
  const prefStore = tx.objectStore('preferences');
  const tplStore = tx.objectStore('templates');

  let prefs = await getFromStore<Preferences>(prefStore, 'app_preferences');
  const now = new Date().toISOString();
  if (!prefs) {
    prefs = {
      id: 'app_preferences',
      schemaVersion: SCHEMA_VERSION,
      starterLoaded: false,
      updatedAt: now,
    };
    prefStore.put(prefs);
  }

  const existingTpls = await getAllFromStore<Template>(tplStore);
  if (existingTpls.length === 0) {
    for (const tpl of getStarterTemplates()) {
      tplStore.put(tpl);
    }
  }

  await txDone(tx);
  return getAllSnapshot();
}

export async function getAllSnapshot(): Promise<LibrarySnapshot> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAMES, 'readonly');
  const [assets, variants, media, drafts, scenes, collections, templates, storedPrefs] =
    await Promise.all([
      getAllFromStore<PromptAsset>(tx.objectStore('assets')),
      getAllFromStore<Variant>(tx.objectStore('variants')),
      getAllFromStore<MediaAsset>(tx.objectStore('media')),
      getAllFromStore<SceneDraft>(tx.objectStore('drafts')),
      getAllFromStore<SavedScene>(tx.objectStore('scenes')),
      getAllFromStore<Collection>(tx.objectStore('collections')),
      getAllFromStore<Template>(tx.objectStore('templates')),
      getFromStore<Preferences>(tx.objectStore('preferences'), 'app_preferences'),
    ]);

  const preferences: Preferences = storedPrefs || fallbackPreferences();

  return {
    assets,
    variants,
    media,
    drafts,
    scenes,
    collections,
    templates,
    preferences,
  };
}

export async function loadStarterLibrary(forceReset = false): Promise<LibrarySnapshot> {
  const db = await openDatabase();
  const current = await getAllSnapshot();
  if (current.preferences.starterLoaded && !forceReset) {
    return current;
  }

  const bundle = buildStarterLibraryBundle();
  const tx = beginLibraryWrite(db, STORE_NAMES);

  for (const m of bundle.media) {
    tx.objectStore('media').put(m);
  }
  for (const a of bundle.assets) {
    tx.objectStore('assets').put(a);
  }
  for (const v of bundle.variants) {
    tx.objectStore('variants').put(v);
  }
  for (const c of bundle.collections) {
    tx.objectStore('collections').put(c);
  }
  for (const t of bundle.templates) {
    tx.objectStore('templates').put(t);
  }

  const nextPrefs: Preferences = {
    ...current.preferences,
    starterLoaded: true,
    updatedAt: new Date().toISOString(),
  };
  tx.objectStore('preferences').put(nextPrefs);

  await txDone(tx);
  return getAllSnapshot();
}

export function collectReferencedMediaIds(snap: {
  assets: PromptAsset[];
  variants: Variant[];
  drafts: SceneDraft[];
  scenes: SavedScene[];
  templates: Template[];
  collections?: Collection[];
}, options: { includeOptionalMetadata?: boolean } = {}): Set<string> {
  const ids = new Set<string>();
  for (const a of snap.assets) {
    if (a.coverMediaId) ids.add(a.coverMediaId);
    for (const l of a.mediaLinks) ids.add(l.mediaId);
  }
  for (const v of snap.variants) {
    if (v.coverMediaId) ids.add(v.coverMediaId);
    for (const l of v.mediaLinks) ids.add(l.mediaId);
  }
  for (const d of snap.drafts) {
    for (const slot of ORDERED_BUILDER_SLOTS) {
      const s = d.slots[slot];
      for (const l of s?.mediaLinks ?? []) ids.add(l.mediaId);
    }
    for (const l of d.resultMediaLinks ?? []) ids.add(l.mediaId);
    if (options.includeOptionalMetadata !== false) for (const l of d.referencePack?.entries ?? []) ids.add(l.mediaId);
  }
  for (const sc of snap.scenes) {
    for (const slot of ORDERED_BUILDER_SLOTS) {
      const s = sc.slots[slot];
      for (const l of s?.mediaLinks ?? []) ids.add(l.mediaId);
    }
    if (options.includeOptionalMetadata !== false) for (const l of sc.referencePack?.entries ?? []) ids.add(l.mediaId);
    for (const l of sc.references ?? []) ids.add(l.mediaId);
    for (const l of sc.resultMediaLinks ?? []) ids.add(l.mediaId);
  }
  for (const t of snap.templates) {
    for (const l of t.includedCharacterSnapshot?.mediaLinks ?? []) {
      ids.add(l.mediaId);
    }
  }
  for (const c of snap.collections ?? []) {
    if (c.coverMediaId) ids.add(c.coverMediaId);
    for(const shot of c.project?.shots ?? []) {
      if(shot.firstFrameMediaId)ids.add(shot.firstFrameMediaId);
      if(shot.lastFrameMediaId)ids.add(shot.lastFrameMediaId);
    }
    for(const cast of c.project?.cast ?? []) for(const mediaId of cast.referenceMediaIds ?? []) ids.add(mediaId);
  }
  return ids;
}

export async function saveMediaAsset(input: {
  id?: string;
  filename: string;
  mimeType: string;
  blob: Blob;
  posterBlob?: Blob;
  width?: number;
  height?: number;
  durationSeconds?: number;
}): Promise<MediaAsset> {
  const snap = await getAllSnapshot();
  const currentBytes = snap.media.reduce(
    (sum, m) => sum + m.byteSize + (m.posterBlob?.size ?? 0),
    0
  );
  const addedBytes = input.blob.size + (input.posterBlob?.size ?? 0);
  if (currentBytes + addedBytes > MAX_TOTAL_MEDIA_BYTES) {
    throw new Error(`Cannot save media: total stored media would exceed the ${(MAX_TOTAL_MEDIA_BYTES / (1024 * 1024)).toLocaleString('en-US')} MiB library limit.`);
  }

  const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'media_file';
  const record: MediaAsset = {
    id: input.id || generateId('media'),
    filename: input.filename,
    safeFilename,
    mimeType: input.mimeType,
    byteSize: input.blob.size,
    blob: input.blob,
    posterBlob: input.posterBlob,
    width: input.width,
    height: input.height,
    durationSeconds: input.durationSeconds,
    createdAt: new Date().toISOString(),
  };

  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['media']);
  tx.objectStore('media').put(record);
  await txDone(tx);
  return record;
}

// Missing persisted references do not prove that a blob is unused: another tab's
// unsaved editor may still need it. Ordinary saves and record deletions retain
// media until durable ownership tracking can make reclamation safe across tabs.

export async function savePromptAsset(input: {
  id?: string;
  title: string;
  category: PromptCategory;
  description?: string;
  promptText: string;
  compactText?: string;
  avoidText?: string;
  tags: string[];
  mediaLinks?: MediaLink[];
  coverMediaId?: string;
  favorite?: boolean;
  reviewStatus?: ReviewStatus;
  provenance?: ProvenanceMetadata;
  notes?: string;
}): Promise<PromptAsset> {
  const val = validatePromptAssetInput(input);
  if (!val.valid) {
    throw new Error(Object.values(val.errors).join(' '));
  }

  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['assets', 'media']);
  const store = tx.objectStore('assets');
  const existing = input.id ? await getFromStore<PromptAsset>(store, input.id) : undefined;

  if (existing && existing.category !== input.category) {
    throw new Error(
      'Category is fixed after first save. Duplicate this prompt into a new record to change its category.'
    );
  }

  const now = new Date().toISOString();
  const mediaLinks = (input.mediaLinks ?? existing?.mediaLinks ?? []).map((l, idx) => ({
    ...l,
    order: idx,
  }));
  const coverMediaId =
    input.coverMediaId && mediaLinks.some((m) => m.mediaId === input.coverMediaId)
      ? input.coverMediaId
      : mediaLinks[0]?.mediaId;

  const record: PromptAsset = {
    id: existing?.id || input.id || generateId('asset'),
    title: input.title.trim(),
    category: existing ? existing.category : input.category,
    description: (input.description ?? '').trim(),
    promptText: input.promptText.trim(),
    compactText:
      input.category === 'characters'
        ? undefined
        : input.compactText?.trim() || undefined,
    avoidText: input.avoidText?.trim() || undefined,
    tags: input.tags.map((t) => t.trim()).filter(Boolean),
    mediaLinks,
    coverMediaId,
    favorite: input.favorite ?? existing?.favorite ?? false,
    reviewStatus: input.reviewStatus ?? existing?.reviewStatus ?? 'unreviewed',
    provenance: input.provenance ?? existing?.provenance ?? {},
    notes: (input.notes ?? existing?.notes ?? '').trim(),
    isStarter: existing?.isStarter ?? false,
    ...(input.category === 'characters' ? {
      identityRevision: existing ? getIdentityRevision(existing) + (existing.promptText !== input.promptText.trim() ? 1 : 0) : 1,
      identityAnchor: existing?.identityAnchor ? structuredClone(existing.identityAnchor) : undefined,
    } : {}),
    revision: existing ? existing.revision + 1 : 1,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  store.put(record);
  await txDone(tx);
  return record;
}

export async function toggleAssetFavorite(id: string): Promise<PromptAsset> {
  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['assets']);
  const store = tx.objectStore('assets');
  const existing = await getFromStore<PromptAsset>(store, id);
  if (!existing) throw new Error('Prompt asset not found.');
  const updated: PromptAsset = {
    ...existing,
    favorite: !existing.favorite,
    ...(existing.category === 'characters' ? { identityRevision: getIdentityRevision(existing) } : {}),
  };
  store.put(updated);
  await txDone(tx);
  return updated;
}

export async function saveVariant(input: {
  id?: string;
  parentCharacterId: string;
  type: VariantType;
  title: string;
  description?: string;
  promptText: string;
  compactText?: string;
  avoidText?: string;
  tags: string[];
  mediaLinks?: MediaLink[];
  coverMediaId?: string;
  favorite?: boolean;
  reviewStatus?: ReviewStatus;
  notes?: string;
}): Promise<Variant> {
  const val = validateVariantInput(input);
  if (!val.valid) {
    throw new Error(Object.values(val.errors).join(' '));
  }

  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['variants', 'assets']);
  const vStore = tx.objectStore('variants');
  const aStore = tx.objectStore('assets');

  const parent = await getFromStore<PromptAsset>(aStore, input.parentCharacterId);
  if (!parent || parent.category !== 'characters') {
    throw new Error('Parent character does not exist.');
  }

  const existing = input.id ? await getFromStore<Variant>(vStore, input.id) : undefined;
  if (
    existing &&
    (existing.parentCharacterId !== input.parentCharacterId || existing.type !== input.type)
  ) {
    throw new Error(
      'Variant parent character and type are fixed after first save. Duplicate to change them.'
    );
  }

  const now = new Date().toISOString();
  const mediaLinks = (input.mediaLinks ?? existing?.mediaLinks ?? []).map((l, idx) => ({
    ...l,
    order: idx,
  }));
  const coverMediaId =
    input.coverMediaId && mediaLinks.some((m) => m.mediaId === input.coverMediaId)
      ? input.coverMediaId
      : mediaLinks[0]?.mediaId;

  const record: Variant = {
    id: existing?.id || input.id || generateId('variant'),
    parentCharacterId: existing ? existing.parentCharacterId : input.parentCharacterId,
    type: existing ? existing.type : input.type,
    targetSlot: VARIANT_TYPE_TO_SLOT[existing ? existing.type : input.type],
    title: input.title.trim(),
    description: (input.description ?? '').trim(),
    promptText: input.promptText.trim(),
    compactText: input.compactText?.trim() || undefined,
    avoidText: input.avoidText?.trim() || undefined,
    tags: input.tags.map((t) => t.trim()).filter(Boolean),
    mediaLinks,
    coverMediaId,
    favorite: input.favorite ?? existing?.favorite ?? false,
    reviewStatus: input.reviewStatus ?? existing?.reviewStatus ?? 'unreviewed',
    notes: (input.notes ?? existing?.notes ?? '').trim(),
    isStarter: existing?.isStarter ?? false,
    revision: existing ? existing.revision + 1 : 1,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  vStore.put(record);
  await txDone(tx);
  return record;
}

export async function toggleVariantFavorite(id: string): Promise<Variant> {
  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['variants']);
  const store = tx.objectStore('variants');
  const existing = await getFromStore<Variant>(store, id);
  if (!existing) throw new Error('Variant not found.');
  const updated: Variant = {
    ...existing,
    favorite: !existing.favorite,
  };
  store.put(updated);
  await txDone(tx);
  return updated;
}

export interface DeletionDependencies {
  blockedByVariants: Variant[];
  affectedCollections: Collection[];
  usedInSavedScenes: SavedScene[];
  usedInDrafts: SceneDraft[];
}

export async function getAssetDeletionDependencies(assetId: string): Promise<DeletionDependencies> {
  const snap = await getAllSnapshot();
  const blockedByVariants = snap.variants.filter((v) => v.parentCharacterId === assetId);
  const affectedCollections = snap.collections.filter((c) =>
    c.members.some((m) => m.type === 'asset' && m.id === assetId)
  );
  const usedInSavedScenes = snap.scenes.filter((s) =>
    ORDERED_BUILDER_SLOTS.some(
      (slot) => s.slots[slot]?.sourceType === 'asset' && s.slots[slot]?.sourceId === assetId
    )
  );
  const usedInDrafts = snap.drafts.filter((d) =>
    ORDERED_BUILDER_SLOTS.some(
      (slot) => d.slots[slot]?.sourceType === 'asset' && d.slots[slot]?.sourceId === assetId
    )
  );
  return {
    blockedByVariants,
    affectedCollections,
    usedInSavedScenes,
    usedInDrafts,
  };
}

export async function deletePromptAsset(assetId: string): Promise<void> {
  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['assets', 'variants', 'collections']);
  const completion=txDone(tx);
  try {
  const dependentVariants = (await getAllFromStore<Variant>(tx.objectStore('variants'))).filter((v) => v.parentCharacterId === assetId);
  if (dependentVariants.length > 0) {
    throw new Error(
      `Cannot delete character while ${dependentVariants.length} dependent variant(s) still reference it. Delete or handle those variants first.`
    );
  }

  const currentCollections=await getAllFromStore<Collection>(tx.objectStore('collections'));
  tx.objectStore('assets').delete(assetId);
  for (const col of currentCollections) {
    if(col.members.some(m=>m.type==='asset'&&m.id===assetId)) tx.objectStore('collections').put({...col,members:col.members.filter(m=>m.type!=='asset'||m.id!==assetId)});
  }
  await completion;
  } catch(error) {try{tx.abort();}catch{}await completion.catch(()=>undefined);throw libraryCaughtError(tx, error);}
}

export async function deleteVariant(variantId: string): Promise<void> {
  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['variants', 'collections']);
  const completion=txDone(tx);
  try {
  const currentCollections=await getAllFromStore<Collection>(tx.objectStore('collections'));
  tx.objectStore('variants').delete(variantId);
  for (const col of currentCollections) {
    if(col.members.some(m=>m.type==='variant'&&m.id===variantId)) tx.objectStore('collections').put({...col,members:col.members.filter(m=>m.type!=='variant'||m.id!==variantId)});
  }
  await completion;
  } catch(error) {try{tx.abort();}catch{}await completion.catch(()=>undefined);throw libraryCaughtError(tx, error);}
}

export function checkVariantApplicationToDraft(
  draft: SceneDraft,
  variant: Variant,
  allAssets: PromptAsset[]
): {
  requiresConfirmation: boolean;
  currentCharacterId?: string;
  currentCharacterTitle?: string;
  parentCharacterId: string;
  parentCharacterTitle: string;
  incompatibleVariantSlotsToClear: BuilderSlot[];
} {
  const parentChar = allAssets.find((a) => a.id === variant.parentCharacterId);
  const parentCharacterTitle = parentChar?.title || variant.parentCharacterId;
  const currentCharSnap = draft.slots.character;

  if (!currentCharSnap || currentCharSnap.sourceId === variant.parentCharacterId) {
    return {
      requiresConfirmation: false,
      currentCharacterId: currentCharSnap?.sourceId,
      currentCharacterTitle: currentCharSnap?.sourceTitle,
      parentCharacterId: variant.parentCharacterId,
      parentCharacterTitle,
      incompatibleVariantSlotsToClear: [],
    };
  }

  const incompatibleVariantSlotsToClear = ORDERED_BUILDER_SLOTS.filter((slot) => {
    if (slot === 'character' || slot === variant.targetSlot) return false;
    const s = draft.slots[slot];
    return s?.sourceType === 'variant' && s.parentCharacterId !== variant.parentCharacterId;
  });

  return {
    requiresConfirmation: true,
    currentCharacterId: currentCharSnap.sourceId,
    currentCharacterTitle: currentCharSnap.sourceTitle,
    parentCharacterId: variant.parentCharacterId,
    parentCharacterTitle,
    incompatibleVariantSlotsToClear,
  };
}

export function checkCharacterReplacementInDraft(
  draft: SceneDraft,
  nextCharacterId: string | null
): {
  requiresConfirmation: boolean;
  incompatibleSlots: BuilderSlot[];
  incompatibleVariantTitles: string[];
} {
  const incompatibleSlots: BuilderSlot[] = [];
  const incompatibleVariantTitles: string[] = [];

  for (const slot of ORDERED_BUILDER_SLOTS) {
    if (slot === 'character') continue;
    const snap = draft.slots[slot];
    if (snap && snap.sourceType === 'variant' && snap.parentCharacterId) {
      if (!nextCharacterId || snap.parentCharacterId !== nextCharacterId) {
        incompatibleSlots.push(slot);
        incompatibleVariantTitles.push(snap.sourceTitle);
      }
    }
  }

  return {
    requiresConfirmation: incompatibleSlots.length > 0,
    incompatibleSlots,
    incompatibleVariantTitles,
  };
}

export async function saveSceneDraft(
  input: Omit<SceneDraft, 'id' | 'inputRevision' | 'updatedAt'> & {
    id?: string;
    inputRevision?: number;
    bumpInputRevision?: boolean;
  }
): Promise<SceneDraft> {
  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['drafts', 'preferences']);
  const dStore = tx.objectStore('drafts');
  const pStore = tx.objectStore('preferences');

  const existing = input.id ? await getFromStore<SceneDraft>(dStore, input.id) : undefined;
  const now = new Date().toISOString();
  const nextRevision =
    input.inputRevision !== undefined
      ? input.inputRevision
      : existing
      ? input.bumpInputRevision === false
        ? existing.inputRevision
        : existing.inputRevision + 1
      : 1;

  const record: SceneDraft = {
    id: existing?.id || input.id || generateId('draft'),
    title: input.title,
    slots: structuredClone(input.slots),
    generation: input.generation ? structuredClone(input.generation) : undefined,
    referencePack: input.referencePack ? structuredClone(input.referencePack) : undefined,
    extraRequiredSlots: input.extraRequiredSlots ?? [],
    sceneInstructions: input.sceneInstructions ?? '',
    avoidText: input.avoidText,
    dialogue: input.dialogue,
    settings: input.settings ?? {},
    sourceSceneId: input.sourceSceneId,
    templateId: input.templateId,
    inputRevision: nextRevision,
    manualOutputs: input.manualOutputs ?? {},
    resultMediaLinks: input.resultMediaLinks ?? [],
    reviewNotes: input.reviewNotes ?? '',
    reviewStatus: input.reviewStatus ?? 'unreviewed',
    updatedAt: now,
  };

  dStore.put(record);
  const prefs = await getFromStore<Preferences>(pStore, 'app_preferences');
  if (prefs) {
    pStore.put({
      ...prefs,
      activeDraftId: record.id,
      updatedAt: now,
    });
  }
  await txDone(tx);
  return record;
}

export interface SaveSceneOptions { duplicateDecision?: 'version' | 'take'; duplicateOfSceneId?: string; requestId?: string; projectTarget?: {collectionId:string;shotId:string} }
export async function saveSceneFromDraft(draftId: string, options: SaveSceneOptions = {}): Promise<SavedScene> {
  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['drafts', 'scenes', 'assets', 'media', 'collections']);
  const completion = txDone(tx);
  try {
  const draft = await getFromStore<SceneDraft>(tx.objectStore('drafts'), draftId);
  if (!draft) throw new Error('Scene draft not found.');

  const character = draft.slots.character;
  const liveMaster = character ? await getFromStore<PromptAsset>(tx.objectStore('assets'), character.sourceId) : undefined;
  const resolvedIdentity = resolveGenerationIdentity(draft, liveMaster);
  const assembled = assembleScenePrompt(draft);
  if (!assembled.valid) {
    throw new Error(assembled.errors.join(' '));
  }

  const now = new Date().toISOString();
  const finalOutputs: Record<OutputMode, string> = {
    full: draft.manualOutputs.full?.text ?? assembled.outputs.full,
    structured: draft.manualOutputs.structured?.text ?? assembled.outputs.structured,
    compact: draft.manualOutputs.compact?.text ?? assembled.outputs.compact,
  };

  const scene: SavedScene = {
    id: generateId('scene'),
    title: draft.title.trim(),
    slots: structuredClone(draft.slots),
    generation: resolvedIdentity.generation,
    referencePack: draft.referencePack ? structuredClone(draft.referencePack) : undefined,
    extraRequiredSlots: [...draft.extraRequiredSlots],
    sceneInstructions: draft.sceneInstructions,
    avoidText: assembled.avoidText,
    dialogue: draft.dialogue ? { ...draft.dialogue } : undefined,
    settings: { ...draft.settings },
    outputs: finalOutputs,
    manualOutputs: structuredClone(draft.manualOutputs),
    references: assembled.references.map((r) => ({ ...r })),
    sourceSceneId: draft.sourceSceneId,
    resultMediaLinks: draft.resultMediaLinks.map((r) => ({ ...r })),
    reviewNotes: draft.reviewNotes,
    reviewStatus: draft.reviewStatus,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };

  const mediaMap = new Map((await getAllFromStore<MediaAsset>(tx.objectStore('media'))).map(media => [media.id, media]));
  for (const slot of Object.values(scene.slots)) if (slot) slot.mediaLinks = captureMediaNames(slot.mediaLinks, mediaMap);
  scene.references = captureMediaNames(scene.references, mediaMap);
  scene.resultMediaLinks = captureMediaNames(scene.resultMediaLinks, mediaMap);
  if (scene.referencePack) scene.referencePack.entries = captureMediaNames(scene.referencePack.entries, mediaMap);
  const scenes = await getAllFromStore<SavedScene>(tx.objectStore('scenes'));
  const retry = options.requestId ? scenes.find(saved => saved.saveRequestId === options.requestId) : undefined;
  if (retry) {
    if (retry.sourceDraftId !== draft.id || retry.sourceDraftInputRevision !== draft.inputRevision || retry.saveDecision !== options.duplicateDecision || (retry.versionOfSceneId ?? retry.separateTakeOfSceneId) !== options.duplicateOfSceneId || JSON.stringify(retry.saveProjectTarget) !== JSON.stringify(options.projectTarget) || sceneDuplicateKey(retry) !== sceneDuplicateKey(scene)) throw new Error('Save request ID was already used for a different operation.');
    await completion;
    return retry;
  }
  const matches = findSimilarScenes(scene, scenes);
  if (options.duplicateDecision) {
    if (!matches.some(saved => saved.id === options.duplicateOfSceneId)) throw new Error('Choose a current matching saved scene for this decision.');
    if (options.duplicateDecision === 'version') scene.versionOfSceneId = options.duplicateOfSceneId;
    else scene.separateTakeOfSceneId = options.duplicateOfSceneId;
  } else {
    if (options.duplicateOfSceneId) throw new Error('Choose a duplicate save decision.');
    if (matches.length) throw new SimilarSceneError(matches);
  }
  scene.sourceDraftId = draft.id;
  scene.sourceDraftInputRevision = draft.inputRevision;
  scene.saveRequestId = options.requestId;
  scene.saveDecision = options.duplicateDecision;
  if (options.projectTarget) {
    const target=options.projectTarget;
    const collectionStore=tx.objectStore('collections');
    const collection=await getFromStore<Collection>(collectionStore,target.collectionId);
    if (!collection?.project) throw new Error('Target project not found.');
    const shot=collection.project.shots.find(s=>s.id===target.shotId);
    if (!shot) throw new Error('Target project shot not found.');
    const shots=collection.project.shots.map(s=>s.id===shot.id?{...s,takeSceneIds:[...s.takeSceneIds,scene.id],selectedSceneId:s.selectedSceneId??scene.id}:s);
    collectionStore.put({...collection,project:{...collection.project,revision:collection.project.revision+1,shots},members:projectMembersFromShots({...collection,updatedAt:now},shots),updatedAt:now});
    scene.saveProjectTarget={...target};
  }
  tx.objectStore('scenes').put(scene);
  await completion;
  return scene;
  } catch (error) {
    try { tx.abort(); } catch { /* Already completed or aborted. */ }
    await completion.catch(() => undefined);
    throw libraryCaughtError(tx, error);
  }
}

export async function updateSavedSceneReviewAndResults(params: {
  sceneId: string;
  resultMediaLinks: MediaLink[];
  reviewNotes: string;
  reviewStatus: ReviewStatus;
}): Promise<SavedScene> {
  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['scenes', 'media']);
  const sStore = tx.objectStore('scenes');
  const existing = await getFromStore<SavedScene>(sStore, params.sceneId);
  if (!existing) throw new Error('Saved scene not found.');

  const mediaMap = new Map((await getAllFromStore<MediaAsset>(tx.objectStore('media'))).map(media => [media.id, media]));
  const updated: SavedScene = {
    ...existing,
    resultMediaLinks: params.resultMediaLinks.map((r, i) => {
      const retained = existing.resultMediaLinks.find(link => link.mediaId === r.mediaId && link.role === r.role && link.altText === r.altText && link.viewLabel === r.viewLabel);
      return { ...(retained ?? captureMediaNames([r], mediaMap)[0]), order: i };
    }),
    reviewNotes: params.reviewNotes.trim(),
    reviewStatus: params.reviewStatus,
    updatedAt: new Date().toISOString(),
  };
  sStore.put(updated);
  await txDone(tx);
  return updated;
}

export async function deleteSavedScene(sceneId: string): Promise<void> {
  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['scenes', 'collections']);
  const completion=txDone(tx);
  try {
  const currentCollections=await getAllFromStore<Collection>(tx.objectStore('collections'));
  const remainingScenes=(await getAllFromStore<SavedScene>(tx.objectStore('scenes'))).filter(s=>s.id!==sceneId);
  tx.objectStore('scenes').delete(sceneId);
  for (const col of currentCollections) {
    if(col.members.some(m=>m.type==='scene'&&m.id===sceneId)||col.project?.shots.some(s=>s.takeSceneIds.includes(sceneId))) {
      const updated=removeTakeFromProject(col,sceneId,remainingScenes);
      tx.objectStore('collections').put({...updated,updatedAt:new Date().toISOString()});
    }
  }
  await completion;
  } catch(error) {try{tx.abort();}catch{}await completion.catch(()=>undefined);throw libraryCaughtError(tx, error);}
}

export async function createDraftFromSavedScene(sceneId: string): Promise<SceneDraft> {
  const snap = await getAllSnapshot();
  const scene = snap.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error('Saved scene not found.');

  return saveSceneDraft({
    title: `${scene.title} (Copy)`,
    slots: structuredClone(scene.slots),
    generation: scene.generation ? structuredClone(scene.generation) : undefined,
    referencePack: scene.referencePack ? structuredClone(scene.referencePack) : undefined,
    extraRequiredSlots: [...scene.extraRequiredSlots],
    sceneInstructions: scene.sceneInstructions,
    avoidText: scene.avoidText,
    dialogue: scene.dialogue ? { ...scene.dialogue } : undefined,
    settings: { ...scene.settings },
    sourceSceneId: scene.id,
    manualOutputs: {},
    resultMediaLinks: [],
    reviewNotes: '',
    reviewStatus: 'unreviewed',
  });
}

export async function createDraftFromTemplate(templateId: string): Promise<SceneDraft> {
  const snap = await getAllSnapshot();
  const tpl = snap.templates.find((t) => t.id === templateId);
  if (!tpl) throw new Error('Template not found.');

  const slots: Partial<Record<BuilderSlot, ComponentSnapshot>> = {};
  if (tpl.includedCharacterSnapshot) {
    slots.character = structuredClone(tpl.includedCharacterSnapshot);
  }
  for (const slot of ORDERED_BUILDER_SLOTS) {
    if (slot === 'character') continue;
    const def = tpl.defaults[slot];
    if (def) {
      slots[slot] = createSnapshotFromTemplateDefault(tpl.id, tpl.revision, def);
    }
  }

  return saveSceneDraft({
    title: `${tpl.name} Draft`,
    slots,
    extraRequiredSlots: [...tpl.requiredSlots],
    sceneInstructions: tpl.sceneInstructionsDefault ?? '',
    settings: tpl.settingsDefault ? { ...tpl.settingsDefault } : { aspectRatio: '16:9', durationSeconds: 6 },
    templateId: tpl.id,
    manualOutputs: {},
    resultMediaLinks: [],
    reviewNotes: '',
    reviewStatus: 'unreviewed',
  });
}

export async function saveDraftAsTemplate(params: {
  draft: SceneDraft;
  name: string;
  description: string;
  includeCharacterIdentity: boolean;
}): Promise<Template> {
  const name = params.name.trim();
  if (!name || name.length > 100) {
    throw new Error('Template name must be between 1 and 100 characters.');
  }

  const defaults: Template['defaults'] = {};
  for (const slot of ORDERED_BUILDER_SLOTS) {
    if (slot === 'character') continue;
    const snap = params.draft.slots[slot];
    if (snap) {
      defaults[slot] = {
        slot,
        title: snap.sourceTitle,
        promptText: (snap.overrideText ?? snap.promptText).trim(),
        compactText: snap.overrideCompactText ?? snap.compactText,
        avoidText: snap.avoidText,
      };
    }
  }

  const requiredSlots = new Set<BuilderSlot>(['environment', 'action', ...params.draft.extraRequiredSlots]);
  if (params.includeCharacterIdentity && params.draft.slots.character) {
    requiredSlots.add('character');
  }

  const now = new Date().toISOString();
  const tpl: Template = {
    id: generateId('template'),
    name,
    description: params.description.trim(),
    category: 'Custom',
    requiredSlots: Array.from(requiredSlots),
    defaults,
    sceneInstructionsDefault: params.draft.sceneInstructions,
    settingsDefault: { ...params.draft.settings },
    includedCharacterSnapshot:
      params.includeCharacterIdentity && params.draft.slots.character
        ? structuredClone(params.draft.slots.character)
        : undefined,
    isStarter: false,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };

  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['templates']);
  tx.objectStore('templates').put(tpl);
  await txDone(tx);
  return tpl;
}

export async function createCollection(input: {
  coverMediaId?: string;
  name: string;
  description?: string;
}): Promise<Collection> {
  const val = validateCollectionInput(input);
  if (!val.valid) {
    throw new Error(Object.values(val.errors).join(' '));
  }
  const now = new Date().toISOString();
  const col: Collection = {
    id: generateId('collection'),
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    members: [],
    createdAt: now,
    updatedAt: now,
  };
  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['collections', 'media']);
  const completion = txDone(tx);
  try {
    if (input.coverMediaId) {
      await validateCollectionCover(tx, input.coverMediaId);
      col.coverMediaId = input.coverMediaId;
    }
    tx.objectStore('collections').put(col);
    await completion;
  } catch (error) { try { tx.abort(); } catch {} await completion.catch(() => undefined); throw libraryCaughtError(tx, error); }
  return col;
}

export async function updateCollection(input: {
  coverMediaId?: string | null;
  id: string;
  name: string;
  description?: string;
}): Promise<Collection> {
  const val = validateCollectionInput(input);
  if (!val.valid) {
    throw new Error(Object.values(val.errors).join(' '));
  }
  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['collections', 'media']);
  const completion = txDone(tx);
  try {
  if (input.coverMediaId) await validateCollectionCover(tx, input.coverMediaId);
  const store = tx.objectStore('collections');
  const existing = await getFromStore<Collection>(store, input.id);
  if (!existing) throw new Error('Collection not found.');
  const updated: Collection = {
    ...existing,
    coverMediaId: input.coverMediaId === undefined ? existing.coverMediaId : input.coverMediaId ?? undefined,
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    updatedAt: new Date().toISOString(),
  };
  store.put(updated);
  await completion;
  return updated;
  } catch (error) { try { tx.abort(); } catch {} await completion.catch(() => undefined); throw libraryCaughtError(tx, error); }
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['collections']);
  tx.objectStore('collections').delete(collectionId);
  await txDone(tx);
}

export async function addMemberToCollection(params: {
  collectionId: string;
  memberType: CollectionMemberType;
  memberId: string;
}): Promise<Collection> {
  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['collections','scenes']);
  const completion=txDone(tx);
  try {
  const store = tx.objectStore('collections');
  const existing = await getFromStore<Collection>(store, params.collectionId);
  if (!existing) throw new Error('Collection not found.');

  const already = existing.members.some(
    (m) => m.type === params.memberType && m.id === params.memberId
  );
  if (already) {await completion;return existing;}
  if(params.memberType==='scene' && !(await getFromStore<SavedScene>(tx.objectStore('scenes'),params.memberId))) throw new Error('Saved scene not found.');

  const now = new Date().toISOString();
  if(params.memberType==='scene' && existing.project){
    const shots=[...existing.project.shots];
    const shot:ProjectShot={id:generateId('shot'),order:shots.length,code:String(shots.length+1).padStart(2,'0'),title:'',takeSceneIds:[params.memberId],selectedSceneId:params.memberId,status:'prompt_ready'};
    shots.push(shot);
    const updated:Collection={...existing,project:{...existing.project,revision:existing.project.revision+1,shots},members:projectMembersFromShots({...existing,updatedAt:now},shots),updatedAt:now};
    store.put(updated);await completion;return updated;
  }
  const updated: Collection = {
    ...existing,
    members: [
      ...existing.members,
      { type: params.memberType, id: params.memberId, addedAt: now },
    ],
    updatedAt: now,
  };
  store.put(updated);
  await completion;
  return updated;
  }catch(error){try{tx.abort();}catch{}await completion.catch(()=>undefined);throw libraryCaughtError(tx, error);}
}

export async function removeMemberFromCollection(params: {
  collectionId: string;
  memberType: CollectionMemberType;
  memberId: string;
}): Promise<Collection> {
  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['collections','scenes']);
  const completion=txDone(tx);
  try {
  const store = tx.objectStore('collections');
  const existing = await getFromStore<Collection>(store, params.collectionId);
  if (!existing) throw new Error('Collection not found.');

  const now = new Date().toISOString();
  if(params.memberType==='scene'&&existing.project){
    const scenes=await getAllFromStore<SavedScene>(tx.objectStore('scenes'));
    const updated=removeTakeFromProject(existing,params.memberId,scenes);
    if(JSON.stringify(updated)===JSON.stringify(existing)){await completion;return existing;}
    const result={...updated,updatedAt:now};store.put(result);await completion;return result;
  }
  const updated: Collection = {
    ...existing,
    members: existing.members.filter(
      (m) => !(m.type === params.memberType && m.id === params.memberId)
    ),
    updatedAt: now,
  };
  store.put(updated);
  await completion;
  return updated;
  }catch(error){try{tx.abort();}catch{}await completion.catch(()=>undefined);throw libraryCaughtError(tx, error);}
}

export async function replaceAllStoresTransactionally(
  data: LibrarySnapshot,
  options: { baseline?: RestoreBaseline; signal?: AbortSignal; onProgress?: (completed: number, total: number) => void } = {},
): Promise<void> {
  if (options.signal?.aborted) throw new DOMException('Restore cancelled.', 'AbortError');
  for (const name of STORE_NAMES) {
    if (name !== 'preferences' && !Array.isArray(data[name])) throw new Error(`Invalid restore ${name}.`);
  }
  if (!data.preferences || typeof data.preferences !== 'object') throw new Error('Invalid restore preferences.');
  const db = await openDatabase();
  const expectedGeneration = registeredLibraryGeneration(db);
  const nextGeneration = newLibraryToken();
  const nextClock = newLibraryToken();
  const tx = db.transaction(STORE_NAMES, 'readwrite', { durability: 'strict' });
  const completion = txDone(tx);
  const abort = () => { try { tx.abort(); } catch { /* settled */ } };
  options.signal?.addEventListener('abort', abort, { once: true });
  const requests = snapshotRequests(tx);
  const clockReq = tx.objectStore('preferences').get(LIBRARY_CLOCK_ID);
  const generationReq = tx.objectStore('preferences').get(LIBRARY_GENERATION_ID);
  const puts: Array<[StoreName, unknown]> = [];
  for (const name of STORE_NAMES) {
    if (name === 'preferences') puts.push([name, { ...data.preferences, id: 'app_preferences' }]);
    else for (const item of data[name]) puts.push([name, item]);
  }
  let completed = 0;
  const fail = (error: unknown) => {
    if (error instanceof Error) restoreFailure = error;
    else restoreFailure = new Error(String(error));
    abort();
  };
  let restoreFailure: Error | undefined;
  function queueNext(): void {
    if (options.signal?.aborted) { abort(); return; }
    if (completed === puts.length) {
      tx.objectStore('preferences').put({ id: LIBRARY_CLOCK_ID, token: nextClock });
      tx.objectStore('preferences').put({ id: LIBRARY_GENERATION_ID, token: nextGeneration });
      return;
    }
    try {
      const [name, item] = puts[completed];
      const request = tx.objectStore(name).put(item);
      request.onsuccess = () => {
        completed++;
        try { options.onProgress?.(completed, puts.length); queueNext(); }
        catch (error) { fail(error); }
      };
    } catch (error) { fail(error); }
  }
  generationReq.onsuccess = () => {
    try {
      const generation = readPrivateToken(generationReq.result, LIBRARY_GENERATION_ID);
      if (generation !== expectedGeneration) { markLibraryReloadRequired(tx); abort(); return; }
      if (options.baseline) {
        const clock = readPrivateToken(clockReq.result, LIBRARY_CLOCK_ID);
        if (generation !== options.baseline.generation || clock !== options.baseline.clock ||
            snapshotFingerprint(snapshotResults(requests)) !== options.baseline.fingerprint) {
          fail(new Error('The library changed since backup preview. Verify the backup again before restoring.'));
          return;
        }
      }
      let cleared = 0;
      for (const name of STORE_NAMES) {
        const request = tx.objectStore(name).clear();
        request.onsuccess = () => { if (++cleared === STORE_NAMES.length) queueNext(); };
      }
    } catch (error) { fail(error); }
  };
  try {
    await completion;
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('krakinai-library-reload-required'));
  }
  catch (error) { throw restoreFailure ?? error; }
  finally { options.signal?.removeEventListener('abort', abort); }
}

async function writeIdentityAnchor(characterId: string, text: string, approve: boolean, expectedIdentityRevision?: number): Promise<PromptAsset> {
  if (text.length > 12000) throw new Error('Identity anchor must be 12,000 characters or fewer.');
  if (approve && !text.trim()) throw new Error('Enter an identity anchor before approving it.');
  const db = await openDatabase();
  const tx = beginLibraryWrite(db, ['assets']);
  const store = tx.objectStore('assets');
  const existing = await getFromStore<PromptAsset>(store, characterId);
  if (!existing || existing.category !== 'characters') throw new Error('Character not found.');
  const identityRevision = getIdentityRevision(existing);
  if (expectedIdentityRevision !== undefined && expectedIdentityRevision !== identityRevision) throw new Error('Character identity changed. Refresh the master before approving or saving the anchor.');
  const now = new Date().toISOString();
  const updated: PromptAsset = {
    ...existing, identityRevision, revision: existing.revision + 1, updatedAt: now,
    identityAnchor: approve ? { text, approvedText: text, approvedMasterIdentityRevision: identityRevision, approvedAt: now } : { ...existing.identityAnchor, text },
  };
  store.put(updated);
  await txDone(tx);
  return updated;
}
export function saveIdentityAnchorDraft(characterId: string, text: string, expectedIdentityRevision?: number): Promise<PromptAsset> {
  return writeIdentityAnchor(characterId, text, false, expectedIdentityRevision);
}
export function approveIdentityAnchor(characterId: string, text: string, expectedIdentityRevision?: number): Promise<PromptAsset> {
  return writeIdentityAnchor(characterId, text, true, expectedIdentityRevision);
}

async function validateCollectionCover(tx: IDBTransaction, id: string): Promise<void> {
  const media = await getFromStore<MediaAsset>(tx.objectStore('media'), id);
  if (!media || !media.mimeType.startsWith('image/')) throw new Error('Collection cover must reference an existing image.');
}
