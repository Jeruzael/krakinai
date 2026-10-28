import { expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { collectReferenceCandidates, buildReferencePackZip } from '../domain/referencePack';
import { buildProjectExport, planProjectExport } from '../domain/projectExport';
import { getActiveReferencePack } from '../domain/shotTypeRules';
import type { Collection, MediaAsset, SavedScene } from '../types/domain';
import type { LibrarySnapshot } from '../storage/db';

const original: MediaAsset = { id: 'floor-plan', filename: 'MIDORI source.png', safeFilename: 'MIDORI_source.png', mimeType: 'image/png', byteSize: 14, blob: new Blob(['original bytes'], { type: 'image/png' }), createdAt: '' };
const scene = (): SavedScene => ({ id: 'saved-floor-plan', title: 'MIDORI Floor Plan', shotType: 'graphic_motion', sourceMediaLinks: [{ mediaId: original.id, role: 'reference', altText: 'Original geometry', order: 0, filename: original.filename, mimeType: original.mimeType }], slots: { character: { slot: 'character', sourceType: 'asset', sourceId: 'inactive-person', sourceTitle: 'Inactive Person', sourceRevision: 1, promptText: 'Never include', mediaLinks: [{ mediaId: 'inactive-face', role: 'reference', altText: 'Face', order: 0 }] } }, extraRequiredSlots: [], sceneInstructions: 'Preserve geometry. Zoom subtly.', settings: { aspectRatio: '9:16', durationSeconds: 4 }, outputs: { full: 'Exact authored prompt', structured: 'Exact structured', compact: 'Exact compact' }, manualOutputs: {}, references: [{ mediaId: 'inactive-face', role: 'reference', altText: 'Face', order: 0 }], resultMediaLinks: [], reviewNotes: '', reviewStatus: 'unreviewed', revision: 1, createdAt: '', updatedAt: '', referencePack: { version: 1, entries: [{ associationId: 'old-face', mediaId: 'inactive-face', sourceSlot: 'character', sourceId: 'inactive-person', sourceTitle: 'Inactive Person', role: 'reference', purpose: 'identity', altText: 'Face', order: 0 }] } });
const project: Collection = { id: 'midori', name: 'MIDORI', description: '', members: [{ type: 'scene', id: 'saved-floor-plan', addedAt: '' }], createdAt: '', updatedAt: '', project: { version: 1, revision: 0, shots: [{ id: 'shot-03', order: 0, code: '03', title: 'Floor Plan', plannedShotType: 'property_environment', takeSceneIds: ['saved-floor-plan'], selectedSceneId: 'saved-floor-plan', status: 'prompt_ready' }] } };
const snapshot = (): LibrarySnapshot => ({ assets: [], variants: [], drafts: [], scenes: [scene()], media: [original], collections: [project], templates: [], preferences: { id: 'app_preferences', schemaVersion: 1, starterLoaded: false, updatedAt: '' } });

it('builds independent source reference candidates, omits inactive layers, and keeps original ZIP bytes', async () => {
  const source = scene(), media = new Map([[original.id, original]]);
  const entries = collectReferenceCandidates(source, media);
  expect(entries.map(entry => [entry.sourceSlot, entry.mediaId, entry.role])).toEqual([['source', original.id, 'reference']]);
  expect(entries[0].filename).toBe(original.filename);
  const before = entries[0].associationId; source.title = 'Renamed';
  expect(collectReferenceCandidates(source, media)[0].associationId).toBe(before);
  const pack = getActiveReferencePack(source)!;
  expect(pack.entries.map(entry => entry.mediaId)).toEqual([original.id]);
  const files = unzipSync(await buildReferencePackZip(pack, media));
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  expect(manifest.entries[0]).toMatchObject({ mediaId: original.id, filename: original.filename, sourceSlot: 'source' });
  expect(strFromU8(files[manifest.entries[0].binaryPath])).toBe('original bytes');
  await expect(buildReferencePackZip(pack, new Map())).rejects.toThrow(/missing original.*floor-plan/i);
});

it('exports required source associations from old packs, active shot metadata, filenames and hash-preserved originals', async () => {
  const data = snapshot();
  const plan = planProjectExport(project, data);
  expect(plan.associations.map(a => [a.sourceSlot, a.mediaId])).toEqual([['source', original.id]]);
  const result = await buildProjectExport(project, data, { includeGenerationJson: true });
  expect(result.manifest.shots[0].plannedShotType).toBe('property_environment');
  expect(result.manifest.shots[0].selectedTake).toMatchObject({ shotType: 'graphic_motion', sourceMediaLinks: [expect.objectContaining({ mediaId: original.id })], sources: [] });
  const association = result.manifest.associations[0];
  expect(association).toMatchObject({ mediaId: original.id, sourceSlot: 'source', role: 'reference', originalFilename: original.filename, missing: false });
  expect(association.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(strFromU8(unzipSync(result.bytes)[association.archivePath!])).toBe('original bytes');
});

it('requires explicit source exclusion when a project original is missing and retains the 128 MiB selected-media bound', async () => {
  const data = snapshot(); data.media = [];
  await expect(buildProjectExport(project, data)).rejects.toThrow(/Missing selected original media/);
  const associationId = planProjectExport(project, data).associations[0].id;
  const result = await buildProjectExport(project, data, { excludedAssociationIds: [associationId] });
  expect(result.manifest.associations[0]).toMatchObject({ excluded: true, missing: true, sourceSlot: 'source' });
  const oversize = snapshot(); oversize.media = [{ ...original, byteSize: 129 * 1024 * 1024 }];
  await expect(buildProjectExport(project, oversize)).rejects.toThrow(/128 MiB/);
});
