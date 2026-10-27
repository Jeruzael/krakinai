import { beforeEach, expect, it } from 'vitest';
import {
  clearAllStoresForTesting,
  initializeDatabase,
  loadStarterLibrary,
  getAllSnapshot,
  saveSceneDraft,
  saveSceneFromDraft,
  createDraftFromSavedScene,
} from '../storage/db';
import {
  exportFullBackupZip,
  validateBackupZip,
  restoreFullBackupZip,
} from '../storage/backup';
import { strToU8, strFromU8, unzipSync, zipSync } from 'fflate';
import { legacyDraft, legacyScene } from './fixtures/legacyScene';
import type { DialoguePerformanceDirection } from '../types/domain';

const performanceDirection: DialoguePerformanceDirection = {
  version: 1,
  styles: ['angry', 'energetic', 'lecturing'],
  pace: 'fast',
  gestures: 'strong_pointing',
};
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
  await loadStarterLibrary();
});
it('retains explicit selections, exact Taglish/custom text, frozen outputs and legacy backups through save/copy/ZIP restore', async () => {
  const input = {
    ...structuredClone(legacyDraft),
    dialogue: {
      speaker: 'Mika',
      line: '“Tara na!”\nWait lang—sandali. 😊',
      deliveryNotes: '  Keep this\ncustom text. ',
      performanceDirection: structuredClone(performanceDirection),
    },
  };
  const savedDraft = await saveSceneDraft(input);
  input.dialogue.performanceDirection.styles.push('urgent');
  expect(savedDraft.dialogue?.performanceDirection).toEqual(
    performanceDirection
  );
  const scene = await saveSceneFromDraft(savedDraft.id);
  expect(scene.outputs.full).toContain(
    'Angry, energetic and lecturing delivery.'
  );
  const copy = await createDraftFromSavedScene(scene.id);
  expect(copy.dialogue).toEqual(savedDraft.dialogue);
  copy.dialogue!.performanceDirection!.styles.push('urgent');
  expect(scene.dialogue?.performanceDirection).toEqual(performanceDirection);
  const before = await getAllSnapshot();
  const zip = await exportFullBackupZip();
  expect((await validateBackupZip(zip)).valid).toBe(true);
  await restoreFullBackupZip(zip);
  const after = await getAllSnapshot();
  expect(after.scenes).toEqual(before.scenes);
  expect(after.drafts).toEqual(before.drafts);
  expect(after.assets).toEqual(before.assets);
  expect(after.scenes.find((s) => s.id === scene.id)?.dialogue).toEqual(
    savedDraft.dialogue
  );
  const legacy = { ...structuredClone(legacyScene), id: 'legacy-no-presets' };
  const entries = unzipSync(zip);
  const manifest = JSON.parse(strFromU8(entries['manifest.json']));
  manifest.scenes.push(legacy);
  entries['manifest.json'] = strToU8(JSON.stringify(manifest));
  const oldAndNew = zipSync(entries);
  expect((await validateBackupZip(oldAndNew)).valid).toBe(true);
  await restoreFullBackupZip(oldAndNew);
  expect(
    (await getAllSnapshot()).scenes.find((s) => s.id === legacy.id)?.outputs
  ).toEqual(legacyScene.outputs);
});
it('rejects malformed optional metadata before writes or restore while preserving the existing library', async () => {
  const draft = await saveSceneDraft(structuredClone(legacyDraft));
  const zip = await exportFullBackupZip();
  const before = await getAllSnapshot();
  await expect(
    saveSceneDraft({
      ...draft,
      dialogue: {
        speaker: 'Mika',
        line: 'Hello',
        performanceDirection: {
          ...performanceDirection,
          styles: ['unknown' as never],
        },
      },
    })
  ).rejects.toThrow(/Dialogue performance/);
  const entries = unzipSync(zip),
    manifest = JSON.parse(strFromU8(entries['manifest.json']));
  manifest.drafts[0].dialogue = {
    speaker: 'Mika',
    line: 'Hello',
    performanceDirection: { version: 1, styles: ['calm', 'angry'] },
  };
  entries['manifest.json'] = strToU8(JSON.stringify(manifest));
  const bad = zipSync(entries);
  expect((await validateBackupZip(bad)).valid).toBe(false);
  await expect(restoreFullBackupZip(bad)).rejects.toThrow(
    /Dialogue performance/
  );
  expect(await getAllSnapshot()).toEqual(before);
});
