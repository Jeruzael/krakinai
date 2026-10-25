import { beforeEach, describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  clearAllStoresForTesting,
  createCollection,
  createDraftFromSavedScene,
  createDraftFromTemplate,
  deleteCollection,
  deletePromptAsset,
  deleteVariant,
  getAllSnapshot,
  getAssetDeletionDependencies,
  initializeDatabase,
  loadStarterLibrary,
  saveMediaAsset,
  savePromptAsset,
  saveSceneDraft,
  saveSceneFromDraft,
  saveVariant,
  addMemberToCollection,
  checkVariantApplicationToDraft,
  checkCharacterReplacementInDraft,
} from '../storage/db';
import {
  exportFullBackupZip,
  restoreFullBackupZip,
  validateBackupZip,
} from '../storage/backup';
import { createSnapshotFromAsset, createSnapshotFromVariant } from '../domain/promptAssembler';

describe('IndexedDB Repository, Snapshots, Dependencies & Full ZIP Backup/Restore', () => {
  beforeEach(async () => {
    await clearAllStoresForTesting();
  });

  it('AT-01 & AT-02: launches with empty library (4 starter templates only) and loads starter library idempotently', async () => {
    await initializeDatabase();
    let snap = await getAllSnapshot();
    expect(snap.assets).toHaveLength(0);
    expect(snap.variants).toHaveLength(0);
    expect(snap.collections).toHaveLength(0);
    expect(snap.templates).toHaveLength(4);
    expect(snap.preferences.starterLoaded).toBe(false);

    await loadStarterLibrary();
    snap = await getAllSnapshot();
    expect(snap.assets).toHaveLength(21);
    expect(snap.variants).toHaveLength(6);
    expect(snap.collections).toHaveLength(3);
    expect(snap.preferences.starterLoaded).toBe(true);

    // Second call must not duplicate records
    await loadStarterLibrary();
    const snap2 = await getAllSnapshot();
    expect(snap2.assets).toHaveLength(21);
    expect(snap2.variants).toHaveLength(6);
    expect(snap2.collections).toHaveLength(3);
  });

  it('AT-03, AT-04, AT-06: creates, edits (incrementing revision & locking category), and duplicates prompt assets without duplicating media bytes', async () => {
    await initializeDatabase();
    const media = await saveMediaAsset({
      filename: 'maya-ref.png',
      mimeType: 'image/png',
      blob: new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }),
    });

    const created = await savePromptAsset({
      title: 'Maya Santos',
      category: 'characters',
      description: 'Base character',
      promptText: 'Adult Filipina woman, 28, oval face.',
      tags: ['Adult', 'Realistic'],
      mediaLinks: [
        {
          mediaId: media.id,
          role: 'reference',
          altText: 'Maya portrait',
          order: 0,
          filename: media.filename,
          mimeType: media.mimeType,
        },
      ],
      coverMediaId: media.id,
    });
    expect(created.revision).toBe(1);

    // Edit increments revision and keeps ID
    const updated = await savePromptAsset({
      id: created.id,
      title: 'Maya Santos Updated',
      category: 'characters',
      description: 'Base character v2',
      promptText: 'Adult Filipina woman, 28, oval face, shoulder-length wavy hair.',
      tags: ['Adult', 'Realistic'],
      mediaLinks: created.mediaLinks,
      coverMediaId: media.id,
    });
    expect(updated.id).toBe(created.id);
    expect(updated.revision).toBe(2);

    // Attempting to change category on existing asset throws
    await expect(
      savePromptAsset({
        id: created.id,
        title: 'Maya Santos Updated',
        category: 'wardrobe',
        promptText: 'Changed category attempt',
        tags: [],
      })
    ).rejects.toThrow(/category/i);

    // Duplicate creates new ID with revision 1 and shares media record
    const dup = await savePromptAsset({
      title: `${updated.title} (Copy)`,
      category: updated.category,
      description: updated.description,
      promptText: updated.promptText,
      tags: updated.tags,
      mediaLinks: updated.mediaLinks,
      coverMediaId: updated.coverMediaId,
    });
    expect(dup.id).not.toBe(created.id);
    expect(dup.revision).toBe(1);

    const snap = await getAllSnapshot();
    expect(snap.media).toHaveLength(1);
  });

  it('AT-09, AT-10, AT-31: checks character-variant parent mismatch and character replacement clearing', async () => {
    await initializeDatabase();
    await loadStarterLibrary();
    const snap = await getAllSnapshot();
    const maya = snap.assets.find((a) => a.id === 'asset_char_maya')!;
    const nico = snap.assets.find((a) => a.id === 'asset_char_nico')!;
    const mayaOutfit = snap.variants.find((v) => v.id === 'variant_maya_office_outfit')!;

    // Draft with Nico selected
    const draftWithNico = await saveSceneDraft({
      title: 'Office talk',
      slots: {
        character: createSnapshotFromAsset(nico),
      },
      extraRequiredSlots: [],
      sceneInstructions: '',
      settings: {},
      manualOutputs: {},
      resultMediaLinks: [],
      reviewNotes: '',
      reviewStatus: 'unreviewed',
    });

    const checkMismatch = checkVariantApplicationToDraft(
      draftWithNico,
      mayaOutfit,
      snap.assets
    );
    expect(checkMismatch.requiresConfirmation).toBe(true);
    expect(checkMismatch.currentCharacterTitle).toContain('Nico');
    expect(checkMismatch.parentCharacterTitle).toContain('Maya');

    // Draft with Maya + Maya's outfit variant
    const draftWithMayaAndVariant = await saveSceneDraft({
      title: 'Maya office',
      slots: {
        character: createSnapshotFromAsset(maya),
        wardrobe: createSnapshotFromVariant(mayaOutfit),
      },
      extraRequiredSlots: [],
      sceneInstructions: '',
      settings: {},
      manualOutputs: {},
      resultMediaLinks: [],
      reviewNotes: '',
      reviewStatus: 'unreviewed',
    });

    const replaceCheck = checkCharacterReplacementInDraft(
      draftWithMayaAndVariant,
      nico.id
    );
    expect(replaceCheck.requiresConfirmation).toBe(true);
    expect(replaceCheck.incompatibleSlots).toEqual(['wardrobe']);
  });

  it('AT-15, AT-19, AT-21, AT-22, AT-23: preserves saved scene snapshots after source edit or deletion, blocks character deletion when variants exist, and deletes collections safely', async () => {
    await initializeDatabase();
    await loadStarterLibrary();
    const snap = await getAllSnapshot();
    const maya = snap.assets.find((a) => a.id === 'asset_char_maya')!;
    const cafe = snap.assets.find((a) => a.id === 'asset_env_cafe_day')!;
    const sitting = snap.assets.find((a) => a.id === 'asset_act_sitting_listening')!;

    const draft = await saveSceneDraft({
      title: 'Maya at Cafe',
      slots: {
        character: createSnapshotFromAsset(maya),
        environment: createSnapshotFromAsset(cafe),
        action: createSnapshotFromAsset(sitting),
      },
      extraRequiredSlots: [],
      sceneInstructions: 'Keep warm tone.',
      settings: { aspectRatio: '16:9', durationSeconds: 8 },
      manualOutputs: {},
      resultMediaLinks: [],
      reviewNotes: '',
      reviewStatus: 'unreviewed',
    });

    const savedScene = await saveSceneFromDraft(draft.id);
    expect(savedScene.outputs.full).toContain(cafe.promptText);

    // Edit cafe asset in library
    await savePromptAsset({
      id: cafe.id,
      title: cafe.title,
      category: cafe.category,
      description: cafe.description,
      promptText: 'CHANGED CAFE PROMPT IN LIBRARY AFTER SCENE SAVE',
      tags: cafe.tags,
      mediaLinks: cafe.mediaLinks,
      coverMediaId: cafe.coverMediaId,
    });

    const afterEditSnap = await getAllSnapshot();
    const reloadedScene = afterEditSnap.scenes.find((s) => s.id === savedScene.id)!;
    // Saved scene snapshot must remain unchanged!
    expect(reloadedScene.outputs.full).toContain(cafe.promptText);
    expect(reloadedScene.outputs.full).not.toContain('CHANGED CAFE PROMPT');

    // Edit a Copy creates a separate draft linked via sourceSceneId
    const copyDraft = await createDraftFromSavedScene(savedScene.id);
    expect(copyDraft.sourceSceneId).toBe(savedScene.id);
    expect(copyDraft.id).not.toBe(draft.id);

    // Attempting to delete Maya while she has 6 variants must be blocked
    const mayaDeps = await getAssetDeletionDependencies(maya.id);
    expect(mayaDeps.blockedByVariants).toHaveLength(6);
    await expect(deletePromptAsset(maya.id)).rejects.toThrow(/variant/i);

    // Deleting cafe (which has no variants, but is used in savedScene and Drama Series collection)
    const cafeMediaId = cafe.coverMediaId!;
    await deletePromptAsset(cafe.id);

    const afterDeleteSnap = await getAllSnapshot();
    expect(afterDeleteSnap.assets.find((a) => a.id === cafe.id)).toBeUndefined();
    // Saved scene still exists and cafe's media is retained because savedScene references it!
    const sceneAfterDelete = afterDeleteSnap.scenes.find((s) => s.id === savedScene.id)!;
    expect(sceneAfterDelete.slots.environment?.promptText).toBe(cafe.promptText);
    expect(afterDeleteSnap.media.find((m) => m.id === cafeMediaId)).toBeDefined();

    // Deleting a collection does not delete its members
    const assetCountBefore = afterDeleteSnap.assets.length;
    await deleteCollection('collection_drama_series');
    const afterColDelete = await getAllSnapshot();
    expect(afterColDelete.collections.find((c) => c.id === 'collection_drama_series')).toBeUndefined();
    expect(afterColDelete.assets.length).toBe(assetCountBefore);
  });

  it('AT-25, AT-26, AT-32, AT-33: exports full ZIP backup, validates and restores atomically (including deleted provenance), and preserves existing data on invalid backup', async () => {
    await initializeDatabase();
    // AT-32: Use a starter template BEFORE loading starter library
    const tplDraft = await createDraftFromTemplate('template_talking_to_camera');
    expect(tplDraft.extraRequiredSlots).toContain('character');
    expect(tplDraft.slots.environment?.sourceType).toBe('template');

    await loadStarterLibrary();
    const initialSnap = await getAllSnapshot();
    const cafe = initialSnap.assets.find((a) => a.id === 'asset_env_cafe_day')!;
    const sitting = initialSnap.assets.find((a) => a.id === 'asset_act_sitting_listening')!;

    // Save a scene and then delete one of its source assets to test AT-33 provenance restore
    const d = await saveSceneDraft({
      title: 'Provenance Test Scene',
      slots: {
        environment: createSnapshotFromAsset(cafe),
        action: createSnapshotFromAsset(sitting),
      },
      extraRequiredSlots: [],
      sceneInstructions: '',
      settings: {},
      manualOutputs: {},
      resultMediaLinks: [],
      reviewNotes: '',
      reviewStatus: 'user-approved',
    });
    await saveSceneFromDraft(d.id);
    await deletePromptAsset(cafe.id);

    // Export full backup ZIP
    const zipBytes = await exportFullBackupZip();
    expect(zipBytes.byteLength).toBeGreaterThan(1000);

    const validation = await validateBackupZip(zipBytes);
    expect(validation.valid).toBe(true);
    expect(validation.summary?.assetsCount).toBe(20);
    expect(validation.summary?.variantsCount).toBe(6);
    expect(validation.summary?.scenesCount).toBe(1);

    // Clear database, add a canary item, then test invalid restore preserves canary
    await clearAllStoresForTesting();
    await initializeDatabase();
    const canary = await savePromptAsset({
      title: 'Canary Asset',
      category: 'styles',
      promptText: 'Must survive a failed restore.',
      tags: [],
    });

    const badZip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ schemaVersion: 999, invalid: true })),
    });
    await expect(restoreFullBackupZip(badZip)).rejects.toThrow(/schema|invalid/i);

    const afterFailedRestore = await getAllSnapshot();
    expect(afterFailedRestore.assets.find((a) => a.id === canary.id)).toBeDefined();

    // Now restore the valid backup ZIP and verify replacement
    await restoreFullBackupZip(zipBytes);
    const restored = await getAllSnapshot();
    expect(restored.assets.find((a) => a.id === canary.id)).toBeUndefined();
    expect(restored.assets).toHaveLength(20);
    expect(restored.variants).toHaveLength(6);
    expect(restored.scenes).toHaveLength(1);
    expect(restored.scenes[0].title).toBe('Provenance Test Scene');
    expect(restored.media.find((m) => m.id === 'media_asset_env_cafe_day')).toBeDefined();
  });
});
