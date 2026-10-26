import { beforeEach, expect, it, vi } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { clearAllStoresForTesting, getAllSnapshot, initializeDatabase, replaceAllStoresTransactionally } from '../storage/db';
import { exportFullBackupZip, restoreFullBackupZip, validateBackupZip } from '../storage/backup';

beforeEach(async () => { await clearAllStoresForTesting(); await initializeDatabase(); });
const date = '2026-10-26T00:00:00.000Z';
async function archiveWith(change: (manifest: any) => void) {
  const files = unzipSync(await exportFullBackupZip());
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  change(manifest);
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  return zipSync(files);
}
function optionalDraft() {
  return { id: 'draft_phase4', slots: { character: { identityRevision: 2, identityAnchor: { text: 'edited draft', approvedText: 'approved', approvedMasterIdentityRevision: 1, approvedAt: date } } }, generation: { identitySource: 'approved_anchor', anchor: { text: 'approved', approvedMasterIdentityRevision: 1, approvedAt: date } }, referencePack: { version: 1, entries: [{ associationId: 'association_one', mediaId: 'missing_media', sourceSlot: 'character', sourceId: 'missing_source', sourceTitle: 'Historical identity', role: 'reference', altText: 'Portrait', filename: 'portrait.png', mimeType: 'image/png', purpose: 'identity', order: 0 }] } };
}
it('preserves optional anchors, generation and missing reference pack metadata through full ZIP restore and export', async () => {
  const draft = optionalDraft();
  const asset = { id: 'character_phase4', title: 'Mika', category: 'characters', mediaLinks: [], promptText: 'Exact master identity.', revision: 3, identityRevision: 2, identityAnchor: draft.slots.character.identityAnchor };
  const scene = { ...draft, id: 'scene_phase4' };
  const archive = await archiveWith(m => { m.assets = [asset]; m.drafts = [draft]; m.scenes = [scene]; });
  expect((await validateBackupZip(archive)).valid).toBe(true);
  await restoreFullBackupZip(archive);
  const roundtrip = unzipSync(await exportFullBackupZip());
  const restored = JSON.parse(strFromU8(roundtrip['manifest.json']));
  expect(restored.drafts).toEqual([draft]);
  expect(restored.assets).toEqual([asset]);
  expect(restored.scenes).toEqual([scene]);
});
it('continues accepting legacy version 1 archives', async () => {
  expect((await validateBackupZip(await exportFullBackupZip())).valid).toBe(true);
});
it.each([
  ['oversized anchor', (d: any) => { d.slots.character.identityAnchor.text = 'x'.repeat(100001); }],
  ['fractional revision', (d: any) => { d.slots.character.identityRevision = 1.5; }],
  ['empty generation anchor', (d: any) => { d.generation.anchor.text = ' '; }],
  ['pack purpose', (d: any) => { d.referencePack.entries[0].purpose = 'automatic'; }],
  ['pack source', (d: any) => { d.referencePack.entries[0].sourceSlot = 'unknown'; }],
  ['pack filename type', (d: any) => { d.referencePack.entries[0].filename = 12; }],
  ['pack alt type', (d: any) => { d.referencePack.entries[0].altText = {}; }],
  ['revision', (d: any) => { d.slots.character.identityRevision = -1; }],
  ['anchor approval', (d: any) => { delete d.slots.character.identityAnchor.approvedAt; }],
  ['generation source', (d: any) => { d.generation.identitySource = 'automatic'; }],
  ['generation approval', (d: any) => { d.generation.anchor.approvedAt = 'yesterday'; }],
  ['pack version', (d: any) => { d.referencePack.version = 2; }],
  ['duplicate associations', (d: any) => { d.referencePack.entries.push({ ...d.referencePack.entries[0], order: 1 }); }],
  ['pack order', (d: any) => { d.referencePack.entries[0].order = -1; }],
  ['pack role', (d: any) => { d.referencePack.entries[0].role = 'automatic'; }],
  ['pack MIME', (d: any) => { d.referencePack.entries[0].mimeType = 'application/javascript'; }],
])('rejects invalid %s before any writes', async (_, change) => {
  const before = await getAllSnapshot();
  const archive = await archiveWith(m => { const draft = optionalDraft(); change(draft); m.drafts = [draft]; });
  await expect(restoreFullBackupZip(archive)).rejects.toThrow();
  expect(await getAllSnapshot()).toEqual(before);
});
it('rolls back queued clears when a put throws synchronously with DataCloneError', async () => {
  const before = await getAllSnapshot();
  const invalid = { ...before, assets: [{ id: 'bad', uncloneable: () => undefined }] };
  await expect(replaceAllStoresTransactionally(invalid as never)).rejects.toThrow();
  expect(await getAllSnapshot()).toEqual(before);
});
it('rolls back queued writes when an IndexedDB request fails asynchronously', async () => {
  const before = await getAllSnapshot();
  const original = IDBObjectStore.prototype.put;
  const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value: any, key?: IDBValidKey) {
    // add() of the same key queues a genuine asynchronous ConstraintError.
    if (this.name === 'preferences') { this.add(value); return this.add(value); }
    return key === undefined ? original.call(this, value) : original.call(this, value, key);
  });
  try { await expect(replaceAllStoresTransactionally(before)).rejects.toThrow(); } finally { spy.mockRestore(); }
  expect(await getAllSnapshot()).toEqual(before);
});
