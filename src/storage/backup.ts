import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  SCHEMA_VERSION,
  type Collection,
  type MediaAsset,
  type Preferences,
  type PromptAsset,
  type SavedScene,
  type SceneDraft,
  type Template,
  type Variant,
} from '../types/domain';
import {
  CATEGORY_TO_SLOT,
  MAX_BACKUP_ENTRIES,
  MAX_BACKUP_UNCOMPRESSED_BYTES,
  MAX_MANIFEST_BYTES,
  MAX_TOTAL_MEDIA_BYTES,
  VARIANT_TYPE_TO_SLOT,
} from '../domain/validation';
import { ORDERED_BUILDER_SLOTS } from '../domain/promptAssembler';
import {
  collectReferencedMediaIds,
  getAllSnapshot,
  replaceAllStoresTransactionally,
  type LibrarySnapshot,
} from './db';

export interface SerializedMediaManifestEntry {
  id: string;
  filename: string;
  safeFilename: string;
  mimeType: string;
  byteSize: number;
  archivePath: string;
  posterArchivePath?: string;
  posterByteSize?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  isBundledIllustration?: boolean;
  createdAt: string;
}

export interface BackupManifest {
  schemaVersion: number;
  appVersion: string;
  appName: string;
  exportedAt: string;
  assets: PromptAsset[];
  variants: Variant[];
  drafts: SceneDraft[];
  scenes: SavedScene[];
  collections: Collection[];
  templates: Template[];
  preferences: Preferences;
  media: SerializedMediaManifestEntry[];
}

export interface BackupValidationSummary {
  schemaVersion: number;
  exportedAt: string;
  assetsCount: number;
  variantsCount: number;
  scenesCount: number;
  draftsCount: number;
  collectionsCount: number;
  templatesCount: number;
  mediaCount: number;
  totalMediaBytes: number;
}

function extensionForMime(mime: string, fallbackName: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    case 'image/svg+xml':
      return 'svg';
    default: {
      const m = fallbackName.match(/\.([a-zA-Z0-9]+)$/);
      return m ? m[1].toLowerCase() : 'bin';
    }
  }
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    const ab = await blob.arrayBuffer();
    return new Uint8Array(ab);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export async function exportFullBackupZip(): Promise<Uint8Array> {
  const snap = await getAllSnapshot();
  const files: Record<string, Uint8Array> = {};
  const mediaEntries: SerializedMediaManifestEntry[] = [];
  let totalUncompressed = 0;

  for (const m of snap.media) {
    const ext = extensionForMime(m.mimeType, m.safeFilename);
    const archivePath = `media/${m.id}.${ext}`;
    const bytes = await blobToUint8Array(m.blob);
    files[archivePath] = bytes;
    totalUncompressed += bytes.byteLength;

    let posterArchivePath: string | undefined;
    let posterByteSize: number | undefined;
    if (m.posterBlob) {
      posterArchivePath = `posters/${m.id}.jpg`;
      const pBytes = await blobToUint8Array(m.posterBlob);
      files[posterArchivePath] = pBytes;
      posterByteSize = pBytes.byteLength;
      totalUncompressed += pBytes.byteLength;
    }

    mediaEntries.push({
      id: m.id,
      filename: m.filename,
      safeFilename: m.safeFilename,
      mimeType: m.mimeType,
      byteSize: bytes.byteLength,
      archivePath,
      posterArchivePath,
      posterByteSize,
      width: m.width,
      height: m.height,
      durationSeconds: m.durationSeconds,
      isBundledIllustration: m.isBundledIllustration,
      createdAt: m.createdAt,
    });
  }

  const manifest: BackupManifest = {
    schemaVersion: SCHEMA_VERSION,
    appVersion: '1.0.0',
    appName: 'KRAKINAI',
    exportedAt: new Date().toISOString(),
    assets: snap.assets,
    variants: snap.variants,
    drafts: snap.drafts,
    scenes: snap.scenes,
    collections: snap.collections,
    templates: snap.templates,
    preferences: snap.preferences,
    media: mediaEntries,
  };

  const manifestBytes = strToU8(JSON.stringify(manifest, null, 2));
  totalUncompressed += manifestBytes.byteLength;

  if (totalUncompressed > MAX_BACKUP_UNCOMPRESSED_BYTES) {
    throw new Error('Backup exceeds the 250 MiB uncompressed prototype limit.');
  }

  files['manifest.json'] = manifestBytes;
  return zipSync(files, { level: 6 });
}

export async function validateBackupZip(zipBytes: Uint8Array): Promise<{
  valid: boolean;
  error?: string;
  summary?: BackupValidationSummary;
  parsedSnapshot?: LibrarySnapshot;
}> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes);
  } catch {
    return { valid: false, error: 'Archive is not a valid ZIP file or is corrupted.' };
  }

  const paths = Object.keys(entries);
  if (paths.length === 0) {
    return { valid: false, error: 'ZIP archive is empty.' };
  }
  if (paths.length > MAX_BACKUP_ENTRIES) {
    return { valid: false, error: `Archive exceeds maximum of ${MAX_BACKUP_ENTRIES} entries.` };
  }

  let totalUncompressed = 0;
  for (const p of paths) {
    if (p.includes('..') || p.startsWith('/') || p.includes('\\')) {
      return { valid: false, error: `Unsafe archive path rejected: ${p}` };
    }
    if (p !== 'manifest.json' && !p.startsWith('media/') && !p.startsWith('posters/')) {
      return { valid: false, error: `Unexpected archive entry rejected: ${p}` };
    }
    totalUncompressed += entries[p].byteLength;
    if (totalUncompressed > MAX_BACKUP_UNCOMPRESSED_BYTES) {
      return { valid: false, error: 'Archive uncompressed size exceeds the 250 MiB limit.' };
    }
  }

  const manifestBytes = entries['manifest.json'];
  if (!manifestBytes) {
    return {
      valid: false,
      error: 'Missing manifest.json. Metadata-only or non-backup ZIPs are not supported.',
    };
  }
  if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) {
    return { valid: false, error: 'manifest.json exceeds the 20 MiB metadata limit.' };
  }

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as BackupManifest;
  } catch {
    return { valid: false, error: 'manifest.json is not valid JSON.' };
  }

  if (!manifest || manifest.schemaVersion !== SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Unsupported or missing schemaVersion (expected ${SCHEMA_VERSION}).`,
    };
  }

  if (
    !Array.isArray(manifest.assets) ||
    !Array.isArray(manifest.variants) ||
    !Array.isArray(manifest.drafts) ||
    !Array.isArray(manifest.scenes) ||
    !Array.isArray(manifest.collections) ||
    !Array.isArray(manifest.templates) ||
    !Array.isArray(manifest.media)
  ) {
    return { valid: false, error: 'manifest.json is missing required entity arrays.' };
  }

  const seenIds = new Set<string>();
  const checkUniqueId = (id: string, label: string): string | null => {
    if (!id || typeof id !== 'string') return `Invalid ${label} ID.`;
    if (seenIds.has(id)) return `Duplicate ID detected in backup: ${id}`;
    seenIds.add(id);
    return null;
  };

  const assetIds = new Set<string>();
  const characterIds = new Set<string>();
  for (const a of manifest.assets) {
    const err = checkUniqueId(a.id, 'asset');
    if (err) return { valid: false, error: err };
    if (!a.title || !(a.category in CATEGORY_TO_SLOT) || !a.promptText) {
      return { valid: false, error: `Invalid asset record: ${a.id}` };
    }
    assetIds.add(a.id);
    if (a.category === 'characters') characterIds.add(a.id);
  }

  const variantIds = new Set<string>();
  for (const v of manifest.variants) {
    const err = checkUniqueId(v.id, 'variant');
    if (err) return { valid: false, error: err };
    if (!(v.type in VARIANT_TYPE_TO_SLOT) || v.targetSlot !== VARIANT_TYPE_TO_SLOT[v.type]) {
      return { valid: false, error: `Variant ${v.id} has invalid type or targetSlot mapping.` };
    }
    if (!characterIds.has(v.parentCharacterId)) {
      return {
        valid: false,
        error: `Variant ${v.id} references missing parent character ${v.parentCharacterId}.`,
      };
    }
    variantIds.add(v.id);
  }

  const sceneIds = new Set<string>();
  for (const s of manifest.scenes) {
    const err = checkUniqueId(s.id, 'scene');
    if (err) return { valid: false, error: err };
    sceneIds.add(s.id);
  }

  const draftIds = new Set<string>();
  for (const d of manifest.drafts) {
    const err = checkUniqueId(d.id, 'draft');
    if (err) return { valid: false, error: err };
    draftIds.add(d.id);
  }

  for (const c of manifest.collections) {
    const err = checkUniqueId(c.id, 'collection');
    if (err) return { valid: false, error: err };
    for (const m of c.members ?? []) {
      const exists =
        (m.type === 'asset' && assetIds.has(m.id)) ||
        (m.type === 'variant' && variantIds.has(m.id)) ||
        (m.type === 'scene' && sceneIds.has(m.id));
      if (!exists) {
        return {
          valid: false,
          error: `Collection "${c.name}" references missing ${m.type} (${m.id}).`,
        };
      }
    }
  }

  if (
    manifest.preferences?.activeDraftId &&
    !draftIds.has(manifest.preferences.activeDraftId)
  ) {
    return {
      valid: false,
      error: `Preferences activeDraftId (${manifest.preferences.activeDraftId}) does not exist in backup drafts.`,
    };
  }

  const mediaRecords: MediaAsset[] = [];
  const mediaIds = new Set<string>();
  let totalMediaBytes = 0;

  for (const mEntry of manifest.media) {
    const err = checkUniqueId(mEntry.id, 'media');
    if (err) return { valid: false, error: err };

    const rawBytes = entries[mEntry.archivePath];
    if (!rawBytes) {
      return {
        valid: false,
        error: `Missing media file in archive: ${mEntry.archivePath}`,
      };
    }
    if (rawBytes.byteLength !== mEntry.byteSize) {
      return {
        valid: false,
        error: `Byte size mismatch for ${mEntry.archivePath} (expected ${mEntry.byteSize}, got ${rawBytes.byteLength}).`,
      };
    }

    totalMediaBytes += rawBytes.byteLength;
    let posterBlob: Blob | undefined;
    if (mEntry.posterArchivePath) {
      const pBytes = entries[mEntry.posterArchivePath];
      if (!pBytes) {
        return {
          valid: false,
          error: `Missing poster file in archive: ${mEntry.posterArchivePath}`,
        };
      }
      totalMediaBytes += pBytes.byteLength;
      posterBlob = new Blob([pBytes as unknown as BlobPart], { type: 'image/jpeg' });
    }

    if (totalMediaBytes > MAX_TOTAL_MEDIA_BYTES) {
      return {
        valid: false,
        error: 'Backup media exceeds the 200 MiB total stored media limit.',
      };
    }

    mediaIds.add(mEntry.id);
    mediaRecords.push({
      id: mEntry.id,
      filename: mEntry.filename,
      safeFilename: mEntry.safeFilename,
      mimeType: mEntry.mimeType,
      byteSize: rawBytes.byteLength,
      blob: new Blob([rawBytes as unknown as BlobPart], { type: mEntry.mimeType }),
      posterBlob,
      width: mEntry.width,
      height: mEntry.height,
      durationSeconds: mEntry.durationSeconds,
      isBundledIllustration: mEntry.isBundledIllustration,
      createdAt: mEntry.createdAt,
    });
  }

  // Verify all referenced media IDs across assets, variants, drafts, scenes, templates resolve
  const referencedMedia = collectReferencedMediaIds({
    assets: manifest.assets,
    variants: manifest.variants,
    drafts: manifest.drafts,
    scenes: manifest.scenes,
    templates: manifest.templates,
    collections: manifest.collections,
  });

  for (const refMediaId of referencedMedia) {
    if (!mediaIds.has(refMediaId)) {
      return {
        valid: false,
        error: `Backup references media ID "${refMediaId}" which is missing from the archive.`,
      };
    }
  }

  const parsedSnapshot: LibrarySnapshot = {
    assets: manifest.assets,
    variants: manifest.variants,
    media: mediaRecords,
    drafts: manifest.drafts,
    scenes: manifest.scenes,
    collections: manifest.collections,
    templates: manifest.templates,
    preferences: {
      ...manifest.preferences,
      id: 'app_preferences',
      schemaVersion: SCHEMA_VERSION,
    },
  };

  return {
    valid: true,
    summary: {
      schemaVersion: manifest.schemaVersion,
      exportedAt: manifest.exportedAt,
      assetsCount: manifest.assets.length,
      variantsCount: manifest.variants.length,
      scenesCount: manifest.scenes.length,
      draftsCount: manifest.drafts.length,
      collectionsCount: manifest.collections.length,
      templatesCount: manifest.templates.length,
      mediaCount: mediaRecords.length,
      totalMediaBytes,
    },
    parsedSnapshot,
  };
}

export async function restoreFullBackupZip(zipBytes: Uint8Array): Promise<BackupValidationSummary> {
  const validation = await validateBackupZip(zipBytes);
  if (!validation.valid || !validation.parsedSnapshot || !validation.summary) {
    throw new Error(validation.error || 'Invalid backup archive.');
  }

  await replaceAllStoresTransactionally(validation.parsedSnapshot);
  return validation.summary;
}
