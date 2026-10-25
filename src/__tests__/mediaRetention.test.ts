import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllStoresForTesting,
  deletePromptAsset,
  deleteSavedScene,
  deleteVariant,
  getAllSnapshot,
  initializeDatabase,
  loadStarterLibrary,
  saveMediaAsset,
  savePromptAsset,
  saveSceneDraft,
  saveSceneFromDraft,
  saveVariant,
  updateSavedSceneReviewAndResults,
} from '../storage/db';
import { createSnapshotFromAsset } from '../domain/promptAssembler';
import { exportFullBackupZip, validateBackupZip } from '../storage/backup';

describe('Media retention across independent editors', () => {
  beforeEach(async () => {
    await clearAllStoresForTesting();
    await initializeDatabase();
    await loadStarterLibrary();
  });

  it.each(['save prompt', 'save variant', 'delete prompt', 'delete variant', 'delete scene'])(
    'preserves an unsaved upload and saved-scene-only media during %s',
    async (operation) => {
      const initial = await getAllSnapshot();
      const character = initial.assets.find((a) => a.id === 'asset_char_maya')!;
      const environment = initial.assets.find((a) => a.id === 'asset_env_cafe_day')!;
      const action = initial.assets.find((a) => a.id === 'asset_act_sitting_listening')!;
      const draft = await saveSceneDraft({
        title: 'Protected scene',
        slots: {
          character: createSnapshotFromAsset(character),
          environment: createSnapshotFromAsset(environment),
          action: createSnapshotFromAsset(action),
        },
        extraRequiredSlots: [],
        sceneInstructions: '',
        settings: {},
        manualOutputs: {},
        resultMediaLinks: [],
        reviewNotes: '',
        reviewStatus: 'unreviewed',
      });
      const protectedScene = await saveSceneFromDraft(draft.id);
      const otherScene = await saveSceneFromDraft(draft.id);
      const sceneMedia = await saveMediaAsset({
        filename: 'saved-scene-result.png',
        mimeType: 'image/png',
        blob: new Blob(['saved result'], { type: 'image/png' }),
      });
      await updateSavedSceneReviewAndResults({
        sceneId: protectedScene.id,
        resultMediaLinks: [{ mediaId: sceneMedia.id, role: 'result', altText: 'Saved result', order: 0 }],
        reviewNotes: '',
        reviewStatus: 'unreviewed',
      });

      // Editor A has uploaded a file, but its mediaLinks are still only in form state.
      const pending = await saveMediaAsset({
        filename: 'unsaved-editor.png',
        mimeType: 'image/png',
        blob: new Blob(['unsaved attachment'], { type: 'image/png' }),
      });

      // Editor B operates on the same database without knowing editor A's form state.
      if (operation === 'save prompt') {
        await savePromptAsset({ title: 'Other prompt', category: 'environments', promptText: 'A different room.', tags: [] });
      } else if (operation === 'save variant') {
        await saveVariant({ title: 'Other variant', parentCharacterId: character.id, type: 'Outfit', promptText: 'A blue jacket.', tags: [] });
      } else if (operation === 'delete prompt') {
        await deletePromptAsset(environment.id);
      } else if (operation === 'delete variant') {
        await deleteVariant(initial.variants[0].id);
      } else {
        await deleteSavedScene(otherScene.id);
      }

      const after = await getAllSnapshot();
      expect(after.media.find((m) => m.id === pending.id)).toBeDefined();
      expect(after.media.find((m) => m.id === sceneMedia.id)).toBeDefined();
      expect(after.media.find((m) => m.id === environment.coverMediaId)).toBeDefined();
      expect(after.scenes.find((s) => s.id === protectedScene.id)?.resultMediaLinks[0].mediaId).toBe(sceneMedia.id);

      await savePromptAsset({
        title: 'Editor A saved later', category: 'environments', promptText: 'The room from editor A.', tags: [],
        mediaLinks: [{ mediaId: pending.id, role: 'reference', altText: 'Pending upload', order: 0 }],
      });
      const validation = await validateBackupZip(await exportFullBackupZip());
      expect(validation.valid).toBe(true);
      const restoredPending = validation.parsedSnapshot?.media.find((m) => m.id === pending.id);
      expect(await restoredPending?.blob.text()).toBe('unsaved attachment');
    }
  );
});
