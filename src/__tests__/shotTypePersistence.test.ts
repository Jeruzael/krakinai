import { beforeEach, expect, it, vi } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { clearAllStoresForTesting, collectReferencedMediaIds, createDraftFromSavedScene, createDraftFromTemplate, getAllSnapshot, initializeDatabase, replaceAllStoresTransactionally, saveDraftAsTemplate, saveMediaAsset, saveSceneDraft, saveSceneFromDraft } from '../storage/db';
import { exportFullBackupZip, restoreFullBackupZip, validateBackupZip } from '../storage/backup';
import { sceneDuplicateKey } from '../domain/sceneDuplicates';
import { validateProject, validateShotChange } from '../domain/phase5ProjectValidation';
import type { Collection, MediaLink, SavedScene, SceneDraft } from '../types/domain';

const link = (mediaId: string, mimeType = 'image/png'): MediaLink => ({ mediaId, mimeType, role: 'reference', altText: 'Original floor plan', order: 0 });
const draft = (links: MediaLink[] = []): Omit<SceneDraft, 'id'|'inputRevision'|'updatedAt'> => ({ title: 'MIDORI / 03 — Floor Plan', shotType: 'graphic_motion', sourceMediaLinks: links, slots: { character: { slot: 'character', sourceType: 'asset', sourceId: 'inactive-person', sourceRevision: 1, sourceTitle: 'Inactive', promptText: 'Never include me.', mediaLinks: [] } }, extraRequiredSlots: ['environment','action'], sceneInstructions: 'Preserve the original geometry. Subtle zoom.', settings: { aspectRatio: '9:16', durationSeconds: 4 }, manualOutputs: {}, resultMediaLinks: [], reviewNotes: '', reviewStatus: 'unreviewed' });
const project = (): Collection => ({ id: 'project-midori', name: 'MIDORI', description: '', members: [], createdAt: '', updatedAt: '', project: { version: 1, revision: 0, shots: [{ id: 'shot-floorplan', order: 0, code: '03', title: 'Floor Plan', status: 'planned', takeSceneIds: [], plannedShotType: 'graphic_motion' }] } });
beforeEach(async () => { await clearAllStoresForTesting(); await initializeDatabase(); });
async function source() { return saveMediaAsset({ filename: 'MIDORI original floor plan.png', mimeType: 'image/png', blob: new Blob(['exact original PNG bytes'], { type: 'image/png' }) }); }
async function rewriteArchive(change: (manifest: any) => void) { const files = unzipSync(await exportFullBackupZip()); const manifest = JSON.parse(strFromU8(files['manifest.json'])); change(manifest); files['manifest.json'] = strToU8(JSON.stringify(manifest)); return zipSync(files); }

it('retains draft source associations and inactive selections, freezes only active inputs, and copies the saved type and source', async () => {
  const media = await source(), input = draft([link(media.id)]);
  const savedDraft = await saveSceneDraft(input);
  input.sourceMediaLinks![0].altText = 'Changed outside';
  expect(savedDraft.sourceMediaLinks?.[0].altText).toBe('Original floor plan');
  expect((await getAllSnapshot()).drafts[0].shotType).toBe('graphic_motion');
  const scene = await saveSceneFromDraft(savedDraft.id);
  expect(scene.shotType).toBe('graphic_motion');
  expect(scene.slots).toEqual({});
  expect(scene.sourceMediaLinks).toEqual([expect.objectContaining({ mediaId: media.id, filename: media.filename, namesCaptured: true })]);
  expect(scene.outputs.structured).toContain(media.filename);
  expect((await getAllSnapshot()).drafts[0].slots.character).toBeDefined();
  const copy = await createDraftFromSavedScene(scene.id);
  expect(copy.shotType).toBe(scene.shotType);
  expect(copy.sourceMediaLinks).toEqual(scene.sourceMediaLinks);
  copy.sourceMediaLinks![0].altText = 'Changed copy';
  expect((await getAllSnapshot()).scenes[0].sourceMediaLinks![0].altText).toBe('Original floor plan');
});

it.each(['missing', 'wrong MIME', 'missing blob', 'mismatched blob MIME', 'size limit'] as const)('rejects %s stored sources without a scene or project membership', async failure => {
  const media = await source(); const snapshot = await getAllSnapshot(); snapshot.collections = [project()];
  if (failure === 'missing') snapshot.media = [];
  if (failure === 'wrong MIME') snapshot.media[0] = { ...media, mimeType: 'video/mp4', blob: new Blob(['video'], { type: 'video/mp4' }), byteSize: 5 };
  if (failure === 'missing blob') snapshot.media[0] = { ...media, blob: undefined as never };
  if (failure === 'mismatched blob MIME') snapshot.media[0] = { ...media, blob: new Blob(['exact original PNG bytes'], { type: 'video/mp4' }) };
  if (failure === 'size limit') snapshot.media[0] = { ...media, byteSize: 11 * 1024 * 1024 };
  await replaceAllStoresTransactionally(snapshot);
  const savedDraft = await saveSceneDraft(draft([link(media.id)]));
  await expect(saveSceneFromDraft(savedDraft.id, { projectTarget: { collectionId: 'project-midori', shotId: 'shot-floorplan' } })).rejects.toThrow(/source/i);
  const after = await getAllSnapshot();
  expect(after.scenes).toEqual([]); expect(after.collections).toEqual(snapshot.collections);
});

it('rolls back a queued project update when the scene write fails asynchronously', async () => {
  const media = await source(), savedDraft = await saveSceneDraft(draft([link(media.id)]));
  const snapshot = await getAllSnapshot(); snapshot.collections = [project()]; await replaceAllStoresTransactionally(snapshot);
  const original = IDBObjectStore.prototype.put;
  const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, value: any, key?: IDBValidKey) { if (this.name === 'scenes') { this.add(value); return this.add(value); } return key === undefined ? original.call(this, value) : original.call(this, value, key); });
  try { await expect(saveSceneFromDraft(savedDraft.id, { projectTarget: { collectionId: 'project-midori', shotId: 'shot-floorplan' } })).rejects.toThrow(); } finally { spy.mockRestore(); }
  expect((await getAllSnapshot()).scenes).toEqual([]); expect((await getAllSnapshot()).collections).toEqual(snapshot.collections);
});

it('tracks inactive draft sources and includes effective type and active original IDs in duplicate identity', async () => {
  const savedDraft = await saveSceneDraft({ ...draft([link('inactive-original')]), shotType: 'character_scene' });
  expect(collectReferencedMediaIds(await getAllSnapshot()).has('inactive-original')).toBe(true);
  const base = { ...savedDraft, slots: {}, extraRequiredSlots: [], references: [], outputs: { full: 'same', structured: 'same', compact: 'same' }, revision: 1, createdAt: '' } as SavedScene;
  expect(sceneDuplicateKey({ ...base, shotType: undefined, sourceMediaLinks: undefined })).toBe(sceneDuplicateKey({ ...base, shotType: 'character_scene' }));
  const graphic = { ...base, shotType: 'graphic_motion' as const };
  expect(sceneDuplicateKey(graphic)).not.toBe(sceneDuplicateKey(base));
  expect(sceneDuplicateKey(graphic)).not.toBe(sceneDuplicateKey({ ...graphic, sourceMediaLinks: [link('different-original')] }));
});

it('roundtrips original source bytes and metadata while leaving legacy optional fields absent', async () => {
  const media = await source(), savedDraft = await saveSceneDraft(draft([link(media.id)]));
  await saveSceneFromDraft(savedDraft.id);
  const legacy = await saveSceneDraft({ ...draft(), shotType: undefined, sourceMediaLinks: undefined });
  expect(Object.hasOwn(legacy, 'shotType')).toBe(false); expect(Object.hasOwn(legacy, 'sourceMediaLinks')).toBe(false);
  const zip = await exportFullBackupZip(); expect((await validateBackupZip(zip)).valid).toBe(true);
  await clearAllStoresForTesting(); await restoreFullBackupZip(zip);
  const restored = await getAllSnapshot(); expect(restored.scenes[0].sourceMediaLinks![0].mediaId).toBe(media.id);
  expect(restored.media[0].filename).toBe(media.filename); expect(await restored.media[0].blob.text()).toBe('exact original PNG bytes');
});

it.each(['shotType', 'source list', 'source role', 'source ID', 'source MIME', 'source order', 'source pack MIME', 'template shotType', 'planned shotType', 'missing original'] as const)('rejects malformed %s in backups before restore writes', async field => {
  const media = await source(); await saveSceneDraft(draft([link(media.id)]));
  const before = await getAllSnapshot();
  const zip = await rewriteArchive(manifest => { const value = manifest.drafts[0]; value.shotType = 'graphic_motion'; value.sourceMediaLinks = [link(media.id)];
    if (field === 'shotType') value.shotType = 'automatic';
    if (field === 'source list') value.sourceMediaLinks = {};
    if (field === 'source role') value.sourceMediaLinks[0].role = 'result';
    if (field === 'source ID') value.sourceMediaLinks[0].mediaId = 7;
    if (field === 'source MIME') { value.sourceMediaLinks[0].mimeType = 'video/mp4'; }
    if (field === 'source order') value.sourceMediaLinks[0].order = -1;
    if (field === 'source pack MIME') value.referencePack = { version: 1, entries: [{ ...link(media.id, 'video/mp4'), associationId: 'source-pack', sourceSlot: 'source', sourceId: value.id, sourceTitle: value.title, purpose: 'general' }] };
    if (field === 'template shotType') manifest.templates[0].shotType = 'automatic';
    if (field === 'planned shotType') { const c = project(); c.project!.shots[0].plannedShotType = 'automatic' as never; manifest.collections = [c]; }
    if (field === 'missing original') manifest.media = [];
  });
  expect((await validateBackupZip(zip)).valid).toBe(false);
  await expect(restoreFullBackupZip(zip)).rejects.toThrow(); expect(await getAllSnapshot()).toEqual(before);
});

it('validates planned shot types through both project validation entry points', () => {
  const c = project(); c.project!.shots[0].plannedShotType = 'automatic' as never;
  expect(validateProject(c, [])).toMatch(/shot type/i);
  expect(() => validateShotChange(c.project!.shots[0])).toThrow(/shot type/i);
});

it('treats identical originals in separately saved drafts as duplicates', async () => {
  const media = await source();
  const first = await saveSceneDraft({ ...draft([link(media.id)]), referencePack: { version: 1, entries: [] } });
  const saved = await saveSceneFromDraft(first.id);
  const second = await saveSceneDraft({ ...draft([link(media.id)]), referencePack: { version: 1, entries: [] } });
  await expect(saveSceneFromDraft(second.id)).rejects.toMatchObject({ name: 'SimilarSceneError', matches: [expect.objectContaining({ id: saved.id })] });
});

it('creates Shot Type templates without inactive identity, defaults or unrelated slot requirements', async () => {
  const savedDraft = await saveSceneDraft(draft());
  const template = await saveDraftAsTemplate({ draft: savedDraft, name: 'Floor Plan Motion', description: '', includeCharacterIdentity: true });
  expect(template.shotType).toBe('graphic_motion'); expect(template.requiredSlots).toEqual([]); expect(template.defaults).toEqual({}); expect(template.includedCharacterSnapshot).toBeUndefined();
  const fromTemplate = await createDraftFromTemplate(template.id);
  expect(fromTemplate.shotType).toBe('graphic_motion'); expect(fromTemplate.slots).toEqual({}); expect(fromTemplate.extraRequiredSlots).toEqual([]);
});

it('preserves a temporarily mismatched original after a reversible Shot Type switch through full backup', async () => {
  const media = await source();
  const imageDraft = await saveSceneDraft(draft([link(media.id)]));
  const footageDraft = await saveSceneDraft({ ...imageDraft, shotType: 'existing_footage' });
  const backup = await exportFullBackupZip();
  expect((await validateBackupZip(backup)).valid).toBe(true);
  await restoreFullBackupZip(backup);
  expect((await getAllSnapshot()).drafts[0]).toEqual(footageDraft);
  await expect(saveSceneFromDraft(footageDraft.id)).rejects.toThrow(/source.*video/i);
  expect((await getAllSnapshot()).scenes).toEqual([]);
});
