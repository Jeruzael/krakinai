import { beforeEach, expect, it } from 'vitest';
import { clearAllStoresForTesting, initializeDatabase, getAllSnapshot, openDatabase, createCollection } from '../storage/db';
import { previewChangeSet, applyApprovedChangeSet } from '../storage/changeSets';
import { midoriChangeSet, allContentApproval, syntheticCamera } from './fixtures/changeSetFixture';

beforeEach(async () => {
  await clearAllStoresForTesting(); await initializeDatabase();
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => { const tx = db.transaction('assets', 'readwrite'); tx.objectStore('assets').put(syntheticCamera()); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
});
it('aborts the whole batch if browser authorization is revoked before the pre-write boundary', async () => {
  const before = await getAllSnapshot(), p = await previewChangeSet(midoriChangeSet(), allContentApproval());
  await expect(applyApprovedChangeSet(p, p.approvedDigest, () => { throw new Error('Browser authorization revoked'); })).rejects.toThrow(/authorization revoked/i);
  expect(await getAllSnapshot()).toEqual(before);
});
it('checks current authorization before returning a durable replay receipt', async () => {
  const p = await previewChangeSet(midoriChangeSet(), allContentApproval());
  await applyApprovedChangeSet(p, p.approvedDigest);
  const before = await getAllSnapshot(), replay = await previewChangeSet(midoriChangeSet());
  await expect(applyApprovedChangeSet(replay, replay.approvedDigest, () => { throw new Error('Receipt authorization revoked'); })).rejects.toThrow(/authorization revoked/i);
  expect(await getAllSnapshot()).toEqual(before);
});
it('does not accept an asynchronous authorization check that would run after writes', async () => {
  const before = await getAllSnapshot(), p = await previewChangeSet(midoriChangeSet(), allContentApproval());
  await expect(applyApprovedChangeSet(p, p.approvedDigest, async () => {})).rejects.toThrow(/synchronous/i);
  expect(await getAllSnapshot()).toEqual(before);
});
it('supplies current transaction state so permission membership cannot use a stale snapshot', async () => {
  const p = await previewChangeSet(midoriChangeSet(), allContentApproval());
  const witness = await createCollection({ name: 'Synthetic authorization witness' });
  await applyApprovedChangeSet(p, p.approvedDigest, current => {
    if (!current || !current.collections.some(c => c.id === witness.id)) throw Error('Fresh authorization state was not supplied');
  });
  expect((await getAllSnapshot()).scenes).toHaveLength(15);
});
it('consumes one browser authorization once while preserving ordinary manual import behavior', async () => {
  const p = await previewChangeSet(midoriChangeSet(), allContentApproval()); let used = false;
  const authorize = () => { if (used) throw new Error('Authorization consumed'); used = true; };
  const receipt = await applyApprovedChangeSet(p, p.approvedDigest, authorize);
  await expect(applyApprovedChangeSet(p, p.approvedDigest, authorize)).rejects.toThrow(/consumed/i);
  expect((await getAllSnapshot()).scenes).toHaveLength(15);
  expect(await applyApprovedChangeSet(p, p.approvedDigest)).toEqual(receipt);
});
