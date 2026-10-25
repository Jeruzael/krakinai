import {
  SCHEMA_VERSION,
  type BuilderSlot,
  type Collection,
  type CollectionMemberType,
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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error || new Error('Failed to open IndexedDB.'));
    };
  });
  return dbPromise;
}

function getAllFromStore<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as T[]);
    req.onerror = () => reject(req.error);
  });
}

function getFromStore<T>(store: IDBObjectStore, id: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Database transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('Database transaction aborted.'));
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

export async function clearAllStoresForTesting(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAMES, 'readwrite');
  for (const name of STORE_NAMES) {
    tx.objectStore(name).clear();
  }
  await txDone(tx);
}

export async function initializeDatabase(): Promise<LibrarySnapshot> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAMES, 'readwrite');
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
  const [assets, variants, media, drafts, scenes, collections, templates, prefsList] =
    await Promise.all([
      getAllFromStore<PromptAsset>(tx.objectStore('assets')),
      getAllFromStore<Variant>(tx.objectStore('variants')),
      getAllFromStore<MediaAsset>(tx.objectStore('media')),
      getAllFromStore<SceneDraft>(tx.objectStore('drafts')),
      getAllFromStore<SavedScene>(tx.objectStore('scenes')),
      getAllFromStore<Collection>(tx.objectStore('collections')),
      getAllFromStore<Template>(tx.objectStore('templates')),
      getAllFromStore<Preferences>(tx.objectStore('preferences')),
    ]);

  const preferences: Preferences = prefsList[0] || {
    id: 'app_preferences',
    schemaVersion: SCHEMA_VERSION,
    starterLoaded: false,
    updatedAt: new Date().toISOString(),
  };

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
  const tx = db.transaction(STORE_NAMES, 'readwrite');

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
}): Set<string> {
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
  }
  for (const sc of snap.scenes) {
    for (const slot of ORDERED_BUILDER_SLOTS) {
      const s = sc.slots[slot];
      for (const l of s?.mediaLinks ?? []) ids.add(l.mediaId);
    }
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
    throw new Error('Cannot save media: total stored media would exceed the 200 MiB prototype limit.');
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
  const tx = db.transaction(['media'], 'readwrite');
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
  const tx = db.transaction(['assets', 'media'], 'readwrite');
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
  const tx = db.transaction(['assets'], 'readwrite');
  const store = tx.objectStore('assets');
  const existing = await getFromStore<PromptAsset>(store, id);
  if (!existing) throw new Error('Prompt asset not found.');
  const updated: PromptAsset = {
    ...existing,
    favorite: !existing.favorite,
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
  const tx = db.transaction(['variants', 'assets'], 'readwrite');
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
  const tx = db.transaction(['variants'], 'readwrite');
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
  const snap = await getAllSnapshot();
  const dependentVariants = snap.variants.filter((v) => v.parentCharacterId === assetId);
  if (dependentVariants.length > 0) {
    throw new Error(
      `Cannot delete character while ${dependentVariants.length} dependent variant(s) still reference it. Delete or handle those variants first.`
    );
  }

  const updatedCollections = snap.collections.map((c) => ({
    ...c,
    members: c.members.filter((m) => !(m.type === 'asset' && m.id === assetId)),
  }));

  const db = await openDatabase();
  const tx = db.transaction(['assets', 'collections'], 'readwrite');
  tx.objectStore('assets').delete(assetId);
  for (const col of updatedCollections) {
    tx.objectStore('collections').put(col);
  }
  await txDone(tx);
}

export async function deleteVariant(variantId: string): Promise<void> {
  const snap = await getAllSnapshot();
  const updatedCollections = snap.collections.map((c) => ({
    ...c,
    members: c.members.filter((m) => !(m.type === 'variant' && m.id === variantId)),
  }));

  const db = await openDatabase();
  const tx = db.transaction(['variants', 'collections'], 'readwrite');
  tx.objectStore('variants').delete(variantId);
  for (const col of updatedCollections) {
    tx.objectStore('collections').put(col);
  }
  await txDone(tx);
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
  const tx = db.transaction(['drafts', 'preferences'], 'readwrite');
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
    slots: input.slots,
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

export async function saveSceneFromDraft(draftId: string): Promise<SavedScene> {
  const db = await openDatabase();
  const tx = db.transaction(['drafts', 'scenes'], 'readwrite');
  const draft = await getFromStore<SceneDraft>(tx.objectStore('drafts'), draftId);
  if (!draft) throw new Error('Scene draft not found.');

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

  tx.objectStore('scenes').put(scene);
  await txDone(tx);
  return scene;
}

export async function updateSavedSceneReviewAndResults(params: {
  sceneId: string;
  resultMediaLinks: MediaLink[];
  reviewNotes: string;
  reviewStatus: ReviewStatus;
}): Promise<SavedScene> {
  const db = await openDatabase();
  const tx = db.transaction(['scenes'], 'readwrite');
  const sStore = tx.objectStore('scenes');
  const existing = await getFromStore<SavedScene>(sStore, params.sceneId);
  if (!existing) throw new Error('Saved scene not found.');

  const updated: SavedScene = {
    ...existing,
    resultMediaLinks: params.resultMediaLinks.map((r, i) => ({ ...r, order: i })),
    reviewNotes: params.reviewNotes.trim(),
    reviewStatus: params.reviewStatus,
    updatedAt: new Date().toISOString(),
  };
  sStore.put(updated);
  await txDone(tx);
  return updated;
}

export async function deleteSavedScene(sceneId: string): Promise<void> {
  const snap = await getAllSnapshot();
  const updatedCollections = snap.collections.map((c) => ({
    ...c,
    members: c.members.filter((m) => !(m.type === 'scene' && m.id === sceneId)),
  }));
  const db = await openDatabase();
  const tx = db.transaction(['scenes', 'collections'], 'readwrite');
  tx.objectStore('scenes').delete(sceneId);
  for (const col of updatedCollections) {
    tx.objectStore('collections').put(col);
  }
  await txDone(tx);
}

export async function createDraftFromSavedScene(sceneId: string): Promise<SceneDraft> {
  const snap = await getAllSnapshot();
  const scene = snap.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error('Saved scene not found.');

  return saveSceneDraft({
    title: `${scene.title} (Copy)`,
    slots: structuredClone(scene.slots),
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
  const tx = db.transaction(['templates'], 'readwrite');
  tx.objectStore('templates').put(tpl);
  await txDone(tx);
  return tpl;
}

export async function createCollection(input: {
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
  const tx = db.transaction(['collections'], 'readwrite');
  tx.objectStore('collections').put(col);
  await txDone(tx);
  return col;
}

export async function updateCollection(input: {
  id: string;
  name: string;
  description?: string;
}): Promise<Collection> {
  const val = validateCollectionInput(input);
  if (!val.valid) {
    throw new Error(Object.values(val.errors).join(' '));
  }
  const db = await openDatabase();
  const tx = db.transaction(['collections'], 'readwrite');
  const store = tx.objectStore('collections');
  const existing = await getFromStore<Collection>(store, input.id);
  if (!existing) throw new Error('Collection not found.');
  const updated: Collection = {
    ...existing,
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    updatedAt: new Date().toISOString(),
  };
  store.put(updated);
  await txDone(tx);
  return updated;
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(['collections'], 'readwrite');
  tx.objectStore('collections').delete(collectionId);
  await txDone(tx);
}

export async function addMemberToCollection(params: {
  collectionId: string;
  memberType: CollectionMemberType;
  memberId: string;
}): Promise<Collection> {
  const db = await openDatabase();
  const tx = db.transaction(['collections'], 'readwrite');
  const store = tx.objectStore('collections');
  const existing = await getFromStore<Collection>(store, params.collectionId);
  if (!existing) throw new Error('Collection not found.');

  const already = existing.members.some(
    (m) => m.type === params.memberType && m.id === params.memberId
  );
  if (already) return existing;

  const now = new Date().toISOString();
  const updated: Collection = {
    ...existing,
    members: [
      ...existing.members,
      { type: params.memberType, id: params.memberId, addedAt: now },
    ],
    updatedAt: now,
  };
  store.put(updated);
  await txDone(tx);
  return updated;
}

export async function removeMemberFromCollection(params: {
  collectionId: string;
  memberType: CollectionMemberType;
  memberId: string;
}): Promise<Collection> {
  const db = await openDatabase();
  const tx = db.transaction(['collections'], 'readwrite');
  const store = tx.objectStore('collections');
  const existing = await getFromStore<Collection>(store, params.collectionId);
  if (!existing) throw new Error('Collection not found.');

  const now = new Date().toISOString();
  const updated: Collection = {
    ...existing,
    members: existing.members.filter(
      (m) => !(m.type === params.memberType && m.id === params.memberId)
    ),
    updatedAt: now,
  };
  store.put(updated);
  await txDone(tx);
  return updated;
}

export async function replaceAllStoresTransactionally(data: LibrarySnapshot): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAMES, 'readwrite');

  for (const name of STORE_NAMES) {
    tx.objectStore(name).clear();
  }

  for (const a of data.assets) tx.objectStore('assets').put(a);
  for (const v of data.variants) tx.objectStore('variants').put(v);
  for (const m of data.media) tx.objectStore('media').put(m);
  for (const d of data.drafts) tx.objectStore('drafts').put(d);
  for (const s of data.scenes) tx.objectStore('scenes').put(s);
  for (const c of data.collections) tx.objectStore('collections').put(c);
  for (const t of data.templates) tx.objectStore('templates').put(t);
  tx.objectStore('preferences').put({
    ...data.preferences,
    id: 'app_preferences',
  });

  await txDone(tx);
}
