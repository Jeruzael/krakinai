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
import { legacyDraft } from './fixtures/legacyScene';
import type { DialoguePerformanceDirectionV2 } from '../types/domain';
const direction: DialoguePerformanceDirectionV2 = {
  version: 2,
  emotion: {
    primary: 'angry',
    secondary: 'sad',
    intensity: 'strong',
    custom: '  mixed resolve  ',
  },
  techniques: ['lecturing'],
  voice: { tone: 'stern', pitch: 'mid' },
  speech: { pace: 'fast', intonation: 'emphatic', emphasis: '“tayo” 😊' },
  gestures: ['strong_pointing'],
};
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
  await loadStarterLibrary();
});
it('preserves v2 structured metadata, exact Filipino/English/Taglish, immutable outputs and existing records through draft/save/copy/backup/restore', async () => {
  const before = await getAllSnapshot();
  for (const line of [
    '  “Mahal kita.”\nHuwag kang umalis. 😊  ',
    '  “Stay here.”\nPlease—wait! 😊  ',
    '  “Sandali lang—wait!”\nTara na. 😊  ',
  ]) {
    const draft = await saveSceneDraft({
      ...structuredClone(legacyDraft),
      id: undefined,
      dialogue: {
        speaker: 'Mika',
        line,
        deliveryNotes: '  custom\nnotes  ',
        performanceDirection: structuredClone(direction),
      },
    });
    expect(draft.dialogue?.performanceDirection).toEqual(direction);
    const scene = await saveSceneFromDraft(draft.id),
      frozen = structuredClone(scene.outputs);
    const copy = await createDraftFromSavedScene(scene.id);
    expect(copy.dialogue).toEqual(draft.dialogue);
    const changed = {
      ...copy,
      dialogue: {
        ...copy.dialogue!,
        performanceDirection: {
          version: 2 as const,
          techniques: ['whispered' as const],
        },
      },
    };
    await saveSceneDraft(changed);
    expect(
      (await getAllSnapshot()).scenes.find((s) => s.id === scene.id)?.outputs
    ).toEqual(frozen);
    expect(scene.dialogue?.line).toBe(line);
  }
  const original = await getAllSnapshot(),
    zip = await exportFullBackupZip();
  expect((await validateBackupZip(zip)).valid).toBe(true);
  await restoreFullBackupZip(zip);
  expect(await getAllSnapshot()).toEqual(original);
  for (const key of [
    'assets',
    'variants',
    'media',
    'collections',
    'scenes',
  ] as const)
    for (const record of before[key])
      expect(original[key].find((r) => r.id === record.id)).toEqual(record);
});
it.each([
  { version: 2, techniques: ['whispered', 'screamed'] },
  { version: 2, voice: { pitch: 'ultra_high' } },
  { version: 2, speech: { emphasis: 7 } },
  { version: 2, emotion: { inferred: 'angry' } },
])('rejects malformed v2 writes and backups atomically: %j', async (bad) => {
  const draft = await saveSceneDraft(structuredClone(legacyDraft));
  const zip = await exportFullBackupZip(),
    before = await getAllSnapshot();
  await expect(
    saveSceneDraft({
      ...draft,
      dialogue: {
        speaker: 'Mika',
        line: 'Exact',
        performanceDirection: bad as never,
      },
    })
  ).rejects.toThrow(/Dialogue performance/);
  const entries = unzipSync(zip),
    manifest = JSON.parse(strFromU8(entries['manifest.json']));
  manifest.drafts[0].dialogue = {
    speaker: 'Mika',
    line: 'Exact',
    performanceDirection: bad,
  };
  entries['manifest.json'] = strToU8(JSON.stringify(manifest));
  const malformed = zipSync(entries);
  expect((await validateBackupZip(malformed)).valid).toBe(false);
  await expect(restoreFullBackupZip(malformed)).rejects.toThrow(
    /Dialogue performance/
  );
  expect(await getAllSnapshot()).toEqual(before);
});
