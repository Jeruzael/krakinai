import { validatePhase5Metadata } from '../domain/phase5MetadataValidation';
import { validateProject } from '../domain/phase5ProjectValidation';
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
  ALLOWED_IMAGE_MIMES,
  ALLOWED_VIDEO_MIMES,
  CATEGORY_TO_SLOT,
  MAX_BACKUP_ENTRIES,
  MAX_BACKUP_UNCOMPRESSED_BYTES,
  MAX_IMAGE_BYTES,
  MAX_MANIFEST_BYTES,
  MAX_TOTAL_MEDIA_BYTES,
  MAX_VIDEO_BYTES,
  VARIANT_TYPE_TO_SLOT,
} from '../domain/validation';
import { validatePhase4Record } from '../domain/phase4Validation';
import {
  captureRestoreBaseline,
  collectReferencedMediaIds,
  getAllSnapshot,
  replaceAllStoresTransactionally,
  type LibrarySnapshot,
} from './db';
import {
  hashBackupBlob,
  readBackupArchive,
  writeBackupArchive,
  type ArchiveOptions,
  type ArchiveReadResult,
} from './backupArchive';
import { inspectBackupZip } from './backupZipIndex';
import { MAX_BUFFERED_BACKUP_BYTES, MAX_VERIFIED_RESTORE_BYTES } from './backupLimits';
import { createRestoreStage, openRestoreStage, type RestoreStage } from './restoreStaging';
import type { RestoreBaseline } from './db';

export interface SerializedMediaManifestEntry {
  id: string;
  filename: string;
  safeFilename: string;
  displayName?: string;
  exportFilename?: string;
  mimeType: string;
  byteSize: number;
  archivePath: string;
  posterArchivePath?: string;
  posterByteSize?: number;
  sha256?: string;
  posterSha256?: string;
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

async function isJpegBlob(blob: Blob): Promise<boolean> {
  if (blob.size < 3) return false;
  const prefix = blob.slice(0, 3);
  const bytes = typeof prefix.arrayBuffer === 'function'
    ? new Uint8Array(await prefix.arrayBuffer())
    : await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(prefix);
    });
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

async function buildBackupEntries(snap: LibrarySnapshot, options?: ArchiveOptions): Promise<Map<string, Blob>> {
  const files = new Map<string, Blob>();
  const hashes = new Map<string, string>();
  const mediaEntries: SerializedMediaManifestEntry[] = [];
  let totalUncompressed = 0;

  for (const m of snap.media) {
    const ext = extensionForMime(m.mimeType, m.safeFilename);
    const archivePath = `media/${m.id}.${ext}`;
    files.set(archivePath, m.blob);
    totalUncompressed += m.blob.size;

    let posterArchivePath: string | undefined;
    let posterByteSize: number | undefined;
    if (m.posterBlob) {
      posterArchivePath = `posters/${m.id}.jpg`;
      files.set(posterArchivePath, m.posterBlob);
      posterByteSize = m.posterBlob.size;
      totalUncompressed += m.posterBlob.size;
    }

    const mediaSha256 = await hashBackupBlob(m.blob, options);
    hashes.set(archivePath, mediaSha256);
    const posterSha256 = m.posterBlob ? await hashBackupBlob(m.posterBlob, options) : undefined;
    if (posterArchivePath && posterSha256) hashes.set(posterArchivePath, posterSha256);
    mediaEntries.push({
      id: m.id,
      filename: m.filename,
      safeFilename: m.safeFilename,
      displayName: m.displayName,
      exportFilename: m.exportFilename,
      mimeType: m.mimeType,
      byteSize: m.blob.size,
      archivePath,
      posterArchivePath,
      posterByteSize,
      sha256: mediaSha256,
      posterSha256,
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

  const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  totalUncompressed += manifestBlob.size;

  if (totalUncompressed > MAX_BACKUP_UNCOMPRESSED_BYTES) {
    throw new Error('Backup exceeds the 5,500 MiB uncompressed limit.');
  }
  if (manifestBlob.size > MAX_MANIFEST_BYTES) throw new Error('manifest.json exceeds the 20 MiB metadata limit.');
  if (files.size + 1 > MAX_BACKUP_ENTRIES) throw new Error(`Archive exceeds maximum of ${MAX_BACKUP_ENTRIES} entries.`);
  files.set('manifest.json', manifestBlob);
  const validation = await validateBackupEntries(files, options, hashes);
  if (!validation.valid) throw new Error(validation.error);
  return files;
}

export async function validateBackupEntries(entries: Map<string, Blob>, options?: ArchiveOptions, verifiedHashes?: ReadonlyMap<string, string>): Promise<{
  valid: boolean;
  error?: string;
  summary?: BackupValidationSummary;
  parsedSnapshot?: LibrarySnapshot;
}> {
  const paths = [...entries.keys()];
  if (paths.length === 0) {
    return { valid: false, error: 'ZIP archive is empty.' };
  }
  if (paths.length > MAX_BACKUP_ENTRIES) {
    return { valid: false, error: `Archive exceeds maximum of ${MAX_BACKUP_ENTRIES} entries.` };
  }

  let totalUncompressed = 0;
  for (const p of paths) {
    if (p.includes('..') || p.startsWith('/') || p.includes('\\') || p.includes('//')) {
      return { valid: false, error: `Unsafe archive path rejected: ${p}` };
    }
    if (p !== 'manifest.json' && !p.startsWith('media/') && !p.startsWith('posters/')) {
      return { valid: false, error: `Unexpected archive entry rejected: ${p}` };
    }
    totalUncompressed += entries.get(p)!.size;
    if (totalUncompressed > MAX_BACKUP_UNCOMPRESSED_BYTES) {
      return { valid: false, error: 'Archive uncompressed size exceeds the 5,500 MiB limit.' };
    }
  }

  const manifestBlob = entries.get('manifest.json');
  if (!manifestBlob) {
    return {
      valid: false,
      error: 'Missing manifest.json. Metadata-only or non-backup ZIPs are not supported.',
    };
  }
  if (manifestBlob.size > MAX_MANIFEST_BYTES) {
    return { valid: false, error: 'manifest.json exceeds the 20 MiB metadata limit.' };
  }

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(await manifestBlob.text()) as BackupManifest;
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

  for (const record of [...manifest.assets, ...manifest.drafts, ...manifest.scenes, ...manifest.templates]) {
    const error = validatePhase4Record(record);
    if (error) return { valid: false, error };
  }

  const mediaMimes = new Map(manifest.media.map(media => [media.id, media.mimeType]));
  for (const record of [...manifest.media, ...manifest.assets, ...manifest.variants, ...manifest.drafts, ...manifest.scenes, ...manifest.templates]) {
    const error = validatePhase5Metadata(record, mediaMimes);
    if (error) return { valid: false, error };
  }
  for (const scene of manifest.scenes) {
    if (scene.saveProjectTarget !== undefined &&
      (!scene.saveProjectTarget || typeof scene.saveProjectTarget.collectionId !== 'string' || !scene.saveProjectTarget.collectionId.trim() || typeof scene.saveProjectTarget.shotId !== 'string' || !scene.saveProjectTarget.shotId.trim())) return {valid:false,error:'Invalid scene saveProjectTarget.'};
    for (const field of ['sourceDraftId', 'saveRequestId', 'versionOfSceneId', 'separateTakeOfSceneId'] as const) {
      const value = scene[field];
      if (value !== undefined && (typeof value !== 'string' || !value.trim())) return { valid: false, error: `Invalid scene ${field}.` };
    }
    if (scene.sourceDraftInputRevision !== undefined && (!Number.isSafeInteger(scene.sourceDraftInputRevision) || scene.sourceDraftInputRevision < 0)) return { valid: false, error: 'Invalid scene sourceDraftInputRevision.' };
    if (scene.saveDecision !== undefined && scene.saveDecision !== 'version' && scene.saveDecision !== 'take') return { valid: false, error: 'Invalid scene saveDecision.' };
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
    const projectError=validateProject(c,manifest.scenes,true,{assets:manifest.assets,variants:manifest.variants,media:manifest.media,allowMissingCastSources:true});
    if(projectError) return {valid:false,error:`Collection "${c.name}" project: ${projectError}`};
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
  const associatedPaths = new Set(['manifest.json']);
  let totalMediaBytes = 0;

  const allowedBackupMimes = new Set<string>([
    ...ALLOWED_IMAGE_MIMES,
    ...ALLOWED_VIDEO_MIMES,
    'image/svg+xml',
  ]);

  for (const mEntry of manifest.media) {
    if (!mEntry || typeof mEntry !== 'object') return { valid: false, error: 'Invalid media record.' };
    const err = checkUniqueId(mEntry.id, 'media');
    if (err) return { valid: false, error: err };

    if (!mEntry.mimeType || !allowedBackupMimes.has(mEntry.mimeType)) {
      return {
        valid: false,
        error: `Unsupported or disallowed media MIME type in backup: ${mEntry.mimeType}`,
      };
    }

    if (typeof mEntry.archivePath !== 'string' ||
        mEntry.archivePath !== `media/${mEntry.id}.${extensionForMime(mEntry.mimeType, mEntry.safeFilename ?? '')}` ||
        associatedPaths.has(mEntry.archivePath)) return { valid: false, error: `Invalid or duplicate media archive path: ${mEntry.archivePath}` };
    associatedPaths.add(mEntry.archivePath);

    const rawBlob = entries.get(mEntry.archivePath);
    if (!rawBlob) {
      return {
        valid: false,
        error: `Missing media file in archive: ${mEntry.archivePath}`,
      };
    }
    if (rawBlob.size !== mEntry.byteSize) {
      return {
        valid: false,
        error: `Byte size mismatch for ${mEntry.archivePath} (expected ${mEntry.byteSize}, got ${rawBlob.size}).`,
      };
    }

    const maxBytes = ALLOWED_VIDEO_MIMES.has(mEntry.mimeType) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (rawBlob.size > maxBytes) return { valid: false, error: `Media ${mEntry.archivePath} exceeds its ${maxBytes / 1024 / 1024} MiB limit.` };
    if (mEntry.sha256 !== undefined) {
      if (!/^[a-f0-9]{64}$/i.test(mEntry.sha256) || (verifiedHashes?.get(mEntry.archivePath) ?? await hashBackupBlob(rawBlob, options)).toLowerCase() !== mEntry.sha256.toLowerCase()) {
        return { valid: false, error: `SHA-256 mismatch for ${mEntry.archivePath}.` };
      }
    }

    totalMediaBytes += rawBlob.size;
    let posterBlob: Blob | undefined;
    if (mEntry.posterArchivePath) {
      if (mEntry.posterArchivePath !== `posters/${mEntry.id}.jpg` || associatedPaths.has(mEntry.posterArchivePath)) return { valid: false, error: `Invalid or duplicate poster archive path: ${mEntry.posterArchivePath}` };
      associatedPaths.add(mEntry.posterArchivePath);
      const pBlob = entries.get(mEntry.posterArchivePath);
      if (!pBlob) {
        return {
          valid: false,
          error: `Missing poster file in archive: ${mEntry.posterArchivePath}`,
        };
      }
      if (pBlob.size > MAX_IMAGE_BYTES) return { valid: false, error: `Poster ${mEntry.posterArchivePath} exceeds the 10 MiB image limit.` };
      if (mEntry.posterByteSize !== undefined && pBlob.size !== mEntry.posterByteSize) return { valid: false, error: `Poster byte size mismatch for ${mEntry.posterArchivePath}.` };
      if (!(await isJpegBlob(pBlob))) return { valid: false, error: `Poster ${mEntry.posterArchivePath} is not JPEG data.` };
      if (mEntry.posterSha256 !== undefined) {
        if (!/^[a-f0-9]{64}$/i.test(mEntry.posterSha256) || (verifiedHashes?.get(mEntry.posterArchivePath) ?? await hashBackupBlob(pBlob, options)).toLowerCase() !== mEntry.posterSha256.toLowerCase()) return { valid: false, error: `Poster SHA-256 mismatch for ${mEntry.posterArchivePath}.` };
      }
      totalMediaBytes += pBlob.size;
      posterBlob = pBlob.slice(0, pBlob.size, 'image/jpeg');
    } else if (mEntry.posterByteSize !== undefined || mEntry.posterSha256 !== undefined) {
      return { valid: false, error: `Poster metadata has no poster file for ${mEntry.id}.` };
    }

    if (totalMediaBytes > MAX_TOTAL_MEDIA_BYTES) {
      return {
        valid: false,
        error: 'Backup media exceeds the 5,000 MiB total stored media limit.',
      };
    }

    mediaIds.add(mEntry.id);
    mediaRecords.push({
      id: mEntry.id,
      filename: mEntry.filename,
      safeFilename: mEntry.safeFilename,
      displayName: mEntry.displayName,
      exportFilename: mEntry.exportFilename,
      mimeType: mEntry.mimeType,
      byteSize: rawBlob.size,
      blob: rawBlob.slice(0, rawBlob.size, mEntry.mimeType),
      posterBlob,
      width: mEntry.width,
      height: mEntry.height,
      durationSeconds: mEntry.durationSeconds,
      isBundledIllustration: mEntry.isBundledIllustration,
      createdAt: mEntry.createdAt,
    });
  }

  for (const path of paths) if (!associatedPaths.has(path)) return { valid: false, error: `Unassociated archive entry: ${path}` };

  // Verify all referenced media IDs across assets, variants, drafts, scenes, templates resolve
  const referencedMedia = collectReferencedMediaIds({
    assets: manifest.assets,
    variants: manifest.variants,
    drafts: manifest.drafts,
    scenes: manifest.scenes,
    templates: manifest.templates,
    collections: manifest.collections,
  }, { includeOptionalMetadata: false });

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

export interface BackupFileReport {
  summary: BackupValidationSummary;
  compressedBytes: number;
  uncompressedBytes: number;
  entries: number;
  warnings: string[];
}

export interface PreparedBackupRestore extends BackupFileReport {
  stageId: string;
  baseline: RestoreBaseline;
}

function checkIndexedMediaLimits(entries: ReadonlyArray<{ path: string; uncompressedSize: number }>): void {
  let mediaBytes = 0;
  for (const entry of entries) {
    if (entry.path.startsWith('media/') || entry.path.startsWith('posters/')) {
      mediaBytes += entry.uncompressedSize;
      if (mediaBytes > MAX_TOTAL_MEDIA_BYTES) throw new Error('Backup media exceeds the 5,000 MiB total stored media limit.');
      if (entry.path.startsWith('posters/') && entry.uncompressedSize > MAX_IMAGE_BYTES) throw new Error('Backup poster exceeds the 10 MiB image limit.');
      if (entry.path.startsWith('media/') && entry.uncompressedSize > MAX_VIDEO_BYTES) throw new Error('Backup media exceeds the 50 MiB individual media limit.');
    }
  }
}

interface StageMetadata {
  report: BackupFileReport;
  baseline: RestoreBaseline;
  hashes: Array<{ path: string; bytes: number; sha256: string }>;
}

const memoryStages = new Map<string, RestoreStage>();

function makeMemoryStage(): RestoreStage {
  const files = new Map<string, File>();
  const id = `memory-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  const stage: RestoreStage = {
    id,
    metadata: undefined,
    state: 'staging',
    async createSink(path: string) {
      const parts: Uint8Array[] = [];
      return new WritableStream<Uint8Array>({
        write(chunk) { parts.push(chunk.slice()); },
        close() { files.set(path, new File(parts.map(part => Uint8Array.from(part).buffer), path)); },
      });
    },
    async getEntries() { return new Map(files); },
    async markReady(metadata: unknown) { stage.metadata = metadata; stage.state = 'ready'; },
    async markCommitted() { stage.state = 'committed'; memoryStages.delete(id); },
    async discard() { files.clear(); memoryStages.delete(id); stage.state = 'discarded'; },
  };
  memoryStages.set(id, stage);
  return stage;
}

async function newStage(bytes: number): Promise<RestoreStage> {
  if (typeof navigator !== 'undefined' && typeof (navigator.storage as { getDirectory?: unknown } | undefined)?.getDirectory === 'function') return createRestoreStage();
  if (bytes > MAX_BUFFERED_BACKUP_BYTES) throw new Error('This browser has no OPFS temporary storage; only backups up to 64 MiB can be processed.');
  return makeMemoryStage();
}

async function stageArchive(file: Blob, stage: RestoreStage, options?: ArchiveOptions): Promise<ArchiveReadResult> {
  return readBackupArchive(file, entry => stage.createSink(entry.path), options);
}

async function checkedStage(stage: RestoreStage, archive: ArchiveReadResult, options?: ArchiveOptions): Promise<{ report: BackupFileReport; snapshot: LibrarySnapshot }> {
  const entries = await stage.getEntries();
  const verifiedHashes = new Map<string, string>();
  if (archive.entries.length !== entries.size) throw new Error('Staged archive entry count mismatch.');
  for (const entry of archive.entries) {
    const file = entries.get(entry.path);
    if (!file || file.size !== entry.bytes) throw new Error(`Staged archive size mismatch: ${entry.path}`);
    const hash = await hashBackupBlob(file, options);
    if (hash.toLowerCase() !== entry.sha256.toLowerCase()) {
      throw new Error(`Staged archive SHA-256 mismatch: ${entry.path}`);
    }
    verifiedHashes.set(entry.path, hash);
  }
  const validation = await validateBackupEntries(entries, options, verifiedHashes);
  if (!validation.valid || !validation.summary || !validation.parsedSnapshot) throw new Error(validation.error ?? 'Invalid backup metadata.');
  return {
    report: {
      summary: validation.summary,
      compressedBytes: archive.compressedBytes,
      uncompressedBytes: archive.uncompressedBytes,
      entries: archive.entries.length,
      warnings: [],
    },
    snapshot: validation.parsedSnapshot,
  };
}

async function recheckReadyStage(stage: RestoreStage, options?: ArchiveOptions): Promise<{ report: BackupFileReport; snapshot: LibrarySnapshot; baseline: RestoreBaseline }> {
  if (stage.state !== 'ready') throw new Error('Restore stage is not ready.');
  const metadata = stage.metadata as StageMetadata | undefined;
  if (!metadata?.report || !metadata.baseline || !Array.isArray(metadata.hashes)) throw new Error('Restore stage metadata is incomplete.');
  if (metadata.report.uncompressedBytes > MAX_VERIFIED_RESTORE_BYTES) throw new Error(`Restore exceeds the ${MAX_VERIFIED_RESTORE_BYTES / 1024 / 1024} MiB verified restore limit.`);
  const result: ArchiveReadResult = {
    compressedBytes: metadata.report.compressedBytes,
    uncompressedBytes: metadata.report.uncompressedBytes,
    entries: metadata.hashes,
  };
  const checked = await checkedStage(stage, result, options);
  if (JSON.stringify(checked.report.summary) !== JSON.stringify(metadata.report.summary)) throw new Error('Staged backup summary changed.');
  return { ...checked, baseline: metadata.baseline };
}

export async function exportFullBackupToStream(destination: WritableStream<Uint8Array>, options?: ArchiveOptions): Promise<ArchiveReadResult> {
  const files = await buildBackupEntries(await getAllSnapshot(), options);
  return writeBackupEntries(files, destination, options);
}

function writeBackupEntries(files: Map<string, Blob>, destination: WritableStream<Uint8Array>, options?: ArchiveOptions): Promise<ArchiveReadResult> {
  return writeBackupArchive([...files].map(([path, blob]) => ({ path, blob, compress: path === 'manifest.json' })), destination, options);
}

/** Compatibility path for existing callers and tests; hard bounded at 64 MiB. */
export async function exportFullBackupZip(options?: ArchiveOptions): Promise<Uint8Array> {
  const files = await buildBackupEntries(await getAllSnapshot(), options);
  const expandedBytes = [...files.values()].reduce((total, blob) => total + blob.size, 0);
  if (expandedBytes > MAX_BUFFERED_BACKUP_BYTES) throw new Error('Buffered backup exceeds the 64 MiB compatibility limit. Use streaming export.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  const destination = new WritableStream<Uint8Array>({
    write(chunk) {
      size += chunk.byteLength;
      if (size > MAX_BUFFERED_BACKUP_BYTES) throw new Error('Buffered backup exceeds the 64 MiB compatibility limit. Use streaming export.');
      chunks.push(chunk.slice());
    },
  });
  await writeBackupEntries(files, destination, options);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

export async function validateBackupZip(zipBytes: Uint8Array): Promise<{
  valid: boolean; error?: string; summary?: BackupValidationSummary; parsedSnapshot?: LibrarySnapshot;
}> {
  if (zipBytes.byteLength > MAX_BUFFERED_BACKUP_BYTES) return { valid: false, error: 'Buffered backup exceeds the 64 MiB compatibility limit.' };
  try {
    const index = await inspectBackupZip(new Blob([zipBytes.slice()]));
    if (index.uncompressedBytes > MAX_BUFFERED_BACKUP_BYTES) return { valid: false, error: 'Expanded backup exceeds the 64 MiB buffered compatibility limit.' };
    const stage = makeMemoryStage();
    try {
      const archive = await stageArchive(new Blob([zipBytes.slice()]), stage);
      const checked = await checkedStage(stage, archive);
      return { valid: true, summary: checked.report.summary, parsedSnapshot: checked.snapshot };
    } finally { await stage.discard(); }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Archive is invalid or corrupted.' };
  }
}

export async function restoreFullBackupZip(zipBytes: Uint8Array): Promise<BackupValidationSummary> {
  if (zipBytes.byteLength > MAX_BUFFERED_BACKUP_BYTES) throw new Error('Buffered backup exceeds the 64 MiB compatibility limit.');
  const baseline = await captureRestoreBaseline();
  const validation = await validateBackupZip(zipBytes);
  if (!validation.valid || !validation.parsedSnapshot || !validation.summary) throw new Error(validation.error || 'Invalid backup archive.');
  await replaceAllStoresTransactionally(validation.parsedSnapshot, { baseline });
  return validation.summary;
}

export async function verifyFullBackupFile(file: Blob, options?: ArchiveOptions): Promise<BackupFileReport> {
  const index = await inspectBackupZip(file, options);
  checkIndexedMediaLimits(index.entries);
  const stage = await newStage(index.uncompressedBytes);
  try {
    const archive = await stageArchive(file, stage, options);
    return (await checkedStage(stage, archive, options)).report;
  } finally { await stage.discard(); }
}

export async function prepareFullBackupRestore(file: Blob, options?: ArchiveOptions): Promise<PreparedBackupRestore> {
  const baseline = await captureRestoreBaseline();
  const index = await inspectBackupZip(file, options);
  checkIndexedMediaLimits(index.entries);
  if (index.uncompressedBytes > MAX_VERIFIED_RESTORE_BYTES) throw new Error(`Restore exceeds the ${MAX_VERIFIED_RESTORE_BYTES / 1024 / 1024} MiB verified restore limit.`);
  const stage = await newStage(index.uncompressedBytes);
  try {
    const archive = await stageArchive(file, stage, options);
    if (archive.uncompressedBytes > MAX_VERIFIED_RESTORE_BYTES) throw new Error(`Restore exceeds the ${MAX_VERIFIED_RESTORE_BYTES / 1024 / 1024} MiB verified restore limit.`);
    const checked = await checkedStage(stage, archive, options);
    await stage.markReady({ report: checked.report, baseline, hashes: archive.entries } satisfies StageMetadata);
    return { ...checked.report, stageId: stage.id, baseline };
  } catch (error) { await stage.discard(); throw error; }
}

async function getStage(id: string): Promise<RestoreStage> {
  if (id.startsWith('memory-')) {
    const stage = memoryStages.get(id);
    if (!stage) throw new Error('Restore stage is unavailable after this tab was closed.');
    return stage;
  }
  return openRestoreStage(id);
}

export async function resumeFullBackupRestore(id: string, options?: ArchiveOptions): Promise<PreparedBackupRestore> {
  const stage = await getStage(id);
  const checked = await recheckReadyStage(stage, options);
  return { ...checked.report, stageId: id, baseline: checked.baseline };
}

export async function commitPreparedBackupRestore(prepared: PreparedBackupRestore, options?: ArchiveOptions): Promise<BackupValidationSummary> {
  const stage = await getStage(prepared.stageId);
  const checked = await recheckReadyStage(stage, options);
  if (JSON.stringify(prepared.baseline) !== JSON.stringify(checked.baseline)) throw new Error('Restore preview baseline changed.');
  await replaceAllStoresTransactionally(checked.snapshot, {
    baseline: checked.baseline,
    signal: options?.signal,
    onProgress: (completed, total) => options?.onProgress?.({ phase: 'commit-records', completedBytes: completed, totalBytes: total }),
  });
  try { await stage.markCommitted(); }
  catch {
    // The live replacement already committed. A catalog fault cannot turn it into a failed restore.
    options?.onProgress?.({ phase: 'committed-stage-cleanup-required', completedBytes: checked.report.uncompressedBytes, totalBytes: checked.report.uncompressedBytes });
  }
  return checked.report.summary;
}

export async function discardPreparedBackupRestore(prepared: PreparedBackupRestore): Promise<void> {
  await (await getStage(prepared.stageId)).discard();
}
