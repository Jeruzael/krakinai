import {beforeEach,describe,it,expect,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {ReviewInboxRepository,REVIEW_INBOX_DB} from '../storage/proposalReviewInbox';
import {createReviewDraft} from '../domain/proposalReview';
import {midoriChangeSet} from './fixtures/changeSetFixture';
let factory:IDBFactory,repo:ReviewInboxRepository;
beforeEach(()=>{factory=new IDBFactory();repo=new ReviewInboxRepository({factory});});
const draft=async()=>createReviewDraft(midoriChangeSet(),1000,'http://localhost:5173');
describe('separate bounded review inbox',()=>{
 it('survives repository restart without creating the library DB',async()=>{
  const original=await draft(),saved=await repo.create(original);expect(saved.revision).toBe(1);
  await repo.close();repo=new ReviewInboxRepository({factory});
  expect((await repo.list()).records).toEqual([saved]);
  expect((await factory.databases()).map(x=>x.name)).toEqual([REVIEW_INBOX_DB]);
 });
 it('rejects a stale update and cannot resurrect a removed draft',async()=>{
  const first=await repo.create(await draft());
  const next=await repo.update({...first,progress:{...first.progress,selectedTab:'frames'}},first.revision);
  await expect(repo.update(first,first.revision)).rejects.toThrow(/changed|stale|conflict/i);
  await repo.remove(next.id,next.revision);
  await expect(repo.update(next,next.revision)).rejects.toThrow(/removed|missing|changed/i);
  expect((await repo.list()).records).toHaveLength(0);
 });
 it('cannot overwrite rejection with an old progress callback or implicit reconsideration',async()=>{
  const first=await repo.create(await draft());
  const rejected=await repo.update({...first,disposition:'rejected',feedback:{text:'Keep the old take.',rejectedAt:1001,sharedPreviously:false}},first.revision);
  await expect(repo.update(first,first.revision)).rejects.toThrow();
  await expect(repo.update({...rejected,disposition:'review'},rejected.revision)).rejects.toThrow(/reconsider|rejected/i);
  expect((await repo.list()).records[0].feedback?.text).toBe('Keep the old take.');
 });
 it('protects an applying record from removal or rejection until outcome recovery',async()=>{
  const first=await repo.create(await draft()),applying=await repo.update({...first,disposition:'applying'},first.revision);
  await expect(repo.remove(applying.id,applying.revision)).rejects.toThrow(/applying/i);
  await expect(repo.update({...applying,disposition:'rejected'},applying.revision)).rejects.toThrow(/applying/i);
  const finished=await repo.update({...applying,disposition:'applied'},applying.revision,{finishApply:true});
  expect(finished.disposition).toBe('applied');
 });
 it('bounds admission to eight packages without deleting saved rejections',async()=>{
  for(let i=0;i<8;i++){const input=midoriChangeSet();input.changeSetId='synthetic-review-'+i;await repo.create(await createReviewDraft(input,1000,'http://localhost:5173'));}
  const input=midoriChangeSet();input.changeSetId='synthetic-review-ninth';
  await expect(repo.create(await createReviewDraft(input,1000,'http://localhost:5173'))).rejects.toThrow(/full|eight|8/i);
  expect((await repo.list()).records).toHaveLength(8);
 });
 it('does not admit a concurrent second package under the same change-set identity',async()=>{
  await repo.create(await draft());await expect(repo.create(await draft())).rejects.toThrow(/already|duplicate|identity/i);
 });
 it('preserves changed-ID and digest bindings during update',async()=>{
  const first=await repo.create(await draft());
  await expect(repo.update({...first,origin:'http://127.0.0.1:5173'},first.revision)).rejects.toThrow();
 });
 it('loads malformed cached records as unavailable without executing or deleting them',async()=>{
  await repo.create(await draft());
  const db=await new Promise<IDBDatabase>((yes,no)=>{const r=factory.open(REVIEW_INBOX_DB);r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});
  await new Promise<void>((yes,no)=>{const tx=db.transaction('packages','readwrite');tx.objectStore('packages').put({id:'broken',version:999});tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});db.close();
  const loaded=await repo.list();expect(loaded.records).toHaveLength(1);expect(loaded.invalid.map(x=>x.id)).toContain('broken');
  expect(await repo.exportRaw('broken')).toContain('999');
 });
 it('allows an explicit removal of a malformed record that claims the current version',async()=>{
  await repo.create(await draft());
  const db=await new Promise<IDBDatabase>((yes,no)=>{const r=factory.open(REVIEW_INBOX_DB);r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});
  await new Promise<void>(yes=>{const tx=db.transaction('packages','readwrite');tx.objectStore('packages').put({id:'broken-current',version:1,revision:1});tx.oncomplete=()=>yes();});db.close();
  await repo.remove('broken-current',null);expect((await repo.list()).invalid).toHaveLength(0);
 });
 it('reports a quota/open failure and permits a later recovery attempt',async()=>{
  vi.spyOn(factory,'open').mockImplementationOnce(()=>{throw new DOMException('Synthetic quota exhausted','QuotaExceededError');});
  await expect(repo.create(await draft())).rejects.toThrow(/quota/i);
  expect((await repo.list()).records).toHaveLength(0);
  expect((await repo.create(await draft())).revision).toBe(1);
 });
});
it('removes a fingerprint-matched malformed applying row without trusting its disposition',async()=>{
 const factory=new IDBFactory(),repo=new ReviewInboxRepository({factory});await repo.list();const db=await new Promise<IDBDatabase>(yes=>{const r=factory.open(REVIEW_INBOX_DB);r.onsuccess=()=>yes(r.result);});
 await new Promise<void>(yes=>{const tx=db.transaction('packages','readwrite');tx.objectStore('packages').put({id:'malformed-applying',version:999,disposition:'applying'});tx.oncomplete=()=>yes();});db.close();
 await repo.remove('malformed-applying',null);expect((await repo.list()).invalid).toHaveLength(0);
});
