import { validatePhase5Metadata } from '../domain/phase5MetadataValidation';
import { validateProject } from '../domain/phase5ProjectValidation';
import {hasCBackupFeature,detectBackupFeatures,validateBackupFeatures,type BackupFeature} from '../domain/backupFeatures';
import {readLegacyRecordsForBackup} from './libraryCompatibility';
import {canonicalStringify} from '../domain/changeSetCanonical';
import { getShotTypeRules, validateShotSourceMedia } from '../domain/shotTypeRules';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { loadDictionaryLibrary, importDictionaryFromJson } from './dictionaryLibrary';
import {
  SCHEMA_VERSION,
  type Collection,
  type MediaAsset,
  type Preferences,
  type PromptAsset,
  type SavedScene,
  type SceneDraft,
  type Story,
  type Template,
  type Variant,
} from '../types/domain';
import {
  ALLOWED_IMAGE_MIMES,
  ALLOWED_VIDEO_MIMES,
  CATEGORY_TO_SLOT,
  MAX_BACKUP_ENTRIES,
  MAX_BACKUP_UNCOMPRESSED_BYTES,
  MAX_MANIFEST_BYTES,
  MAX_TOTAL_MEDIA_BYTES,
  VARIANT_TYPE_TO_SLOT,
} from '../domain/validation';
import { validatePhase4Record } from '../domain/phase4Validation';
import {isDirectPrompt,validateDirectAttachments} from '../domain/directPrompt';
import {validateSceneRevisionGraph} from '../domain/sceneRevisions';
import {validateImportLedger,prepareImportLedger} from '../domain/changeSetLedger';
import { ORDERED_BUILDER_SLOTS } from '../domain/promptAssembler';
import {
  collectReferencedMediaIds,
  getAllSnapshot,
  replaceAllStoresTransactionally,
  type LibrarySnapshot,
} from './db';

export interface SerializedMediaManifestEntry {
  sha256?:string;
  posterSha256?:string;
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
  width?: number;
  height?: number;
  durationSeconds?: number;
  isBundledIllustration?: boolean;
  createdAt: string;
}

interface BackupManifestBase {
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
  stories?: Story[];
}
export type BackupManifest=BackupManifestBase&({schemaVersion:1;requiredFeatures?:never}|{schemaVersion:2;requiredFeatures:BackupFeature[]});

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

function backupMediaMetadata(m:MediaAsset,byteSize=m.blob.size,posterByteSize=m.posterBlob?.size):SerializedMediaManifestEntry {
  return {id:m.id,filename:m.filename,safeFilename:m.safeFilename,displayName:m.displayName,exportFilename:m.exportFilename,mimeType:m.mimeType,byteSize,archivePath:`media/${m.id}.${extensionForMime(m.mimeType,m.safeFilename)}`,posterArchivePath:m.posterBlob?`posters/${m.id}.jpg`:undefined,posterByteSize,width:m.width,height:m.height,durationSeconds:m.durationSeconds,isBundledIllustration:m.isBundledIllustration,createdAt:m.createdAt};
}

/** Metadata only: never reads media bytes or compresses an archive. Shared with import capacity checks. */
export function buildBackupManifest(snap:LibrarySnapshot,exportedAt=new Date().toISOString(),mediaEntries=snap.media.map(m=>backupMediaMetadata(m))):BackupManifest {
  const requiredFeatures=detectBackupFeatures(snap),base={appVersion:'1.0.0',appName:'KRAKINAI',exportedAt,assets:snap.assets,variants:snap.variants,drafts:snap.drafts,scenes:snap.scenes,collections:snap.collections,templates:snap.templates,preferences:snap.preferences,media:mediaEntries,...(snap.stories?{stories:snap.stories}:{})};
  return requiredFeatures.length?{schemaVersion:2,...base,requiredFeatures}:{schemaVersion:SCHEMA_VERSION,...base};
}

export async function exportFullBackupZip(): Promise<Uint8Array> {
  return exportSnapshotBackupZip(await getAllSnapshot());
}

/** Existing archive implementation, shared with the read-only compatibility gate. */
export async function exportSnapshotBackupZip(snap:LibrarySnapshot):Promise<Uint8Array>{
  if(snap.preferences.aiImports)await prepareImportLedger(snap.preferences.aiImports);
  const files: Record<string, Uint8Array> = {};
  const mediaEntries: SerializedMediaManifestEntry[] = [];
  const cChecksums=hasCBackupFeature(detectBackupFeatures(snap));
  let totalUncompressed = 0;

  for (const m of snap.media) {
    const ext = extensionForMime(m.mimeType, m.safeFilename);
    const archivePath = `media/${m.id}.${ext}`;
    const bytes = await blobToUint8Array(m.blob);
    files[archivePath] = bytes;
    totalUncompressed += bytes.byteLength;

    let posterByteSize: number | undefined,posterSha256:string|undefined;
    if (m.posterBlob) {
      const posterArchivePath = `posters/${m.id}.jpg`;
      const pBytes = await blobToUint8Array(m.posterBlob);
      files[posterArchivePath] = pBytes;
      posterByteSize = pBytes.byteLength;if(cChecksums)posterSha256=await backupSha256(pBytes);
      totalUncompressed += pBytes.byteLength;
    }

    mediaEntries.push({...backupMediaMetadata(m,bytes.byteLength,posterByteSize),...(cChecksums?{sha256:await backupSha256(bytes),...(posterSha256?{posterSha256}:{})}:{})});
  }

  const manifest=buildBackupManifest(snap,new Date().toISOString(),mediaEntries);

  const manifestBytes = strToU8(JSON.stringify(manifest, null, 2));
  totalUncompressed += manifestBytes.byteLength;

  files['manifest.json'] = manifestBytes;

  // Bundle Qwen Dictionary Library if words are cached in localStorage
  try {
    const dictLibrary = loadDictionaryLibrary();
    if (dictLibrary && Object.keys(dictLibrary).length > 0) {
      const dictBytes = strToU8(JSON.stringify(dictLibrary, null, 2));
      files['qwen_dictionary.json'] = dictBytes;
      totalUncompressed += dictBytes.byteLength;
    }
  } catch {
    // ignore dictionary read failure in non-browser or sandbox environments
  }

  if (totalUncompressed > MAX_BACKUP_UNCOMPRESSED_BYTES) {
    throw new Error(`Backup exceeds the configured ${MAX_BACKUP_UNCOMPRESSED_BYTES/(1024*1024)} MiB uncompressed limit.`);
  }

  return zipSync(files, { level: 6 });
}

/** A checked legacy backup before consent; no library write or format upgrade. */
export async function exportLegacyBackupBeforeUpgrade():Promise<Uint8Array>{
 const rows=await readLegacyRecordsForBackup();
 if(rows.preferences.length!==1||(rows.preferences[0] as Preferences)?.id!=='app_preferences')throw Error('The normal full-backup format cannot preserve these unexpected preference records. Use the previous build’s backup tools before enabling.');
 const snapshot={...rows,preferences:rows.preferences[0]} as LibrarySnapshot;
 const bytes=await exportSnapshotBackupZip(snapshot),checked=await validateBackupZip(bytes);
 if(!checked.valid||!checked.parsedSnapshot)throw Error(`Pre-upgrade backup validation failed: ${checked.error??'No restored snapshot.'} The library was not changed.`);
 const metadata=(value:LibrarySnapshot)=>({...value,media:value.media.map(({blob,posterBlob,...rest})=>rest)});
 if(canonicalStringify(metadata(snapshot))!==canonicalStringify(metadata(checked.parsedSnapshot)))throw Error('Pre-upgrade backup did not round trip every record’s metadata. The library was not changed; use the previous build’s backup tools.');
 const digest=async(blob:Blob)=>canonicalStringify([...new Uint8Array(await crypto.subtle.digest('SHA-256',await blobToUint8Array(blob) as BufferSource))]);
 const restored=new Map(checked.parsedSnapshot.media.map(record=>[record.id,record]));
 for(const original of snapshot.media){const copy=restored.get(original.id)!;
  if(await digest(original.blob)!==await digest(copy.blob)||Boolean(original.posterBlob)!==Boolean(copy.posterBlob)||original.posterBlob&&await digest(original.posterBlob)!==await digest(copy.posterBlob!))throw Error('Pre-upgrade media hash verification failed. The library was not changed.');
 }
 return bytes;
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
    if (p !== 'manifest.json' && p !== 'qwen_dictionary.json' && !p.startsWith('media/') && !p.startsWith('posters/')) {
      return { valid: false, error: `Unexpected archive entry rejected: ${p}` };
    }
    totalUncompressed += entries[p].byteLength;
    if (totalUncompressed > MAX_BACKUP_UNCOMPRESSED_BYTES) {
      return { valid: false, error: `Archive uncompressed size exceeds the configured ${MAX_BACKUP_UNCOMPRESSED_BYTES/(1024*1024)} MiB limit.` };
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

  const featureError=validateBackupFeatures(manifest);
  if (featureError) {
    return {
      valid: false,
      error: featureError,
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

  if(manifest.preferences?.aiImports!==undefined){
    try{validateImportLedger(manifest.preferences.aiImports);await prepareImportLedger(manifest.preferences.aiImports);}catch(error){return {valid:false,error:`Invalid import ledger: ${(error as Error).message}`};}
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
    if (scene.archivedAt !== undefined && (typeof scene.archivedAt !== 'string' || !scene.archivedAt.trim() || scene.archivedAt.length > 100 || !Number.isFinite(Date.parse(scene.archivedAt)))) return { valid: false, error: 'Invalid scene archivedAt.' };
  }
  const revisionGraphError=validateSceneRevisionGraph(manifest.scenes);
  if(revisionGraphError)return {valid:false,error:revisionGraphError};

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
  let totalMediaBytes = 0;

  const allowedBackupMimes = new Set<string>([
    ...ALLOWED_IMAGE_MIMES,
    ...ALLOWED_VIDEO_MIMES,
    'image/svg+xml',
  ]);

  for (const mEntry of manifest.media) {
    const err = checkUniqueId(mEntry.id, 'media');
    if (err) return { valid: false, error: err };

    if (!mEntry.mimeType || !allowedBackupMimes.has(mEntry.mimeType)) {
      return {
        valid: false,
        error: `Unsupported or disallowed media MIME type in backup: ${mEntry.mimeType}`,
      };
    }

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

    if(manifest.schemaVersion===2&&hasCBackupFeature(manifest.requiredFeatures)&&(!/^[a-f0-9]{64}$/.test(mEntry.sha256??'')||await backupSha256(rawBytes)!==mEntry.sha256))return{valid:false,error:`C backup media SHA-256 checksum is missing or mismatched: ${mEntry.id}.`};
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
      if(manifest.schemaVersion===2&&hasCBackupFeature(manifest.requiredFeatures)&&(!/^[a-f0-9]{64}$/.test(mEntry.posterSha256??'')||await backupSha256(pBytes)!==mEntry.posterSha256))return{valid:false,error:`C backup poster SHA-256 checksum is missing or mismatched: ${mEntry.id}.`};
      totalMediaBytes += pBytes.byteLength;
      posterBlob = new Blob([pBytes as unknown as BlobPart], { type: 'image/jpeg' });
    }

    if (totalMediaBytes > MAX_TOTAL_MEDIA_BYTES) {
      return {
        valid: false,
        error: `Backup media exceeds the configured ${MAX_TOTAL_MEDIA_BYTES/(1024*1024)} MiB total stored media limit.`,
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

  const storedMedia = new Map(mediaRecords.map(media => [media.id, media]));
  for (const value of [...manifest.drafts, ...manifest.scenes]) {
    if(isDirectPrompt(value)){
      const errors=validateDirectAttachments(value,storedMedia);
      if(errors.length)return {valid:false,error:errors.join(' ')};
      continue;
    }
    const links = [...(value.sourceMediaLinks ?? []), ...(value.referencePack?.entries.filter(entry => entry.sourceSlot === 'source') ?? [])];
    // Drafts can be incomplete. Existing associations must still resolve to valid original bytes.
    if (links?.length) {
      for (const link of links) {
        const original = storedMedia.get(link.mediaId);
        const shotType = original?.mimeType.startsWith('video/') ? 'existing_footage' : 'graphic_motion';
        const errors = validateShotSourceMedia({ shotType, sourceMediaLinks: [link], sceneInstructions: 'Validate original source association.' }, storedMedia);
        if (errors.length) return { valid: false, error: errors.join(' ') };
      }
    }
    if (manifest.scenes.includes(value as SavedScene) && getShotTypeRules(value).sourceKind) {
      const errors = validateShotSourceMedia(value, storedMedia);
      if (errors.length) return { valid: false, error: errors.join(' ') };
    }
  }

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
    stories: manifest.stories,
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

  // Restore bundled Qwen Dictionary Library to localStorage if present in backup archive
  try {
    const zip = unzipSync(zipBytes);
    const dictBytes = zip['qwen_dictionary.json'];
    if (dictBytes) {
      const rawJson = strFromU8(dictBytes);
      importDictionaryFromJson(rawJson, 'merge');
    }
  } catch (err) {
    console.warn('[Backup] Failed to restore bundled qwen_dictionary.json:', err);
  }

  return validation.summary;
}

const backupSha256=async(bytes:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))].map(n=>n.toString(16).padStart(2,'0')).join('');
