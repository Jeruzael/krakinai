import {beforeEach,it,expect,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {ProposalBroker} from '../connections/proposalBroker';
import {ReviewInboxRepository} from '../storage/proposalReviewInbox';
import {REVIEW_WINDOW_MS} from '../domain/proposalReview';
import {emptyMcpScope} from '../domain/mcpScope';
import {clearAllStoresForTesting,initializeDatabase,getAllSnapshot,openDatabase} from '../storage/db';
import {midoriChangeSet,syntheticCamera} from './fixtures/changeSetFixture';
import {type McpCommand, MCP_LIMITS} from '../domain/mcpProtocol';
let now:number,inbox:ReviewInboxRepository;
const allowed=()=>({...emptyMcpScope(),assetIds:['asset_synthetic_camera'],allowNewProjects:true,allowProposals:true});
const submit=(changeSet=midoriChangeSet()):McpCommand=>({requestId:crypto.randomUUID(),tool:'krakinai_submit_change_set',args:{changeSet}});
const make=(overrides:Record<string,unknown>={})=>new ProposalBroker({inbox,origin:'http://localhost:5173',now:()=>now,reviewLock:async(_id,work)=>work(),...overrides});
beforeEach(async()=>{
 now=1000;inbox=new ReviewInboxRepository({factory:new IDBFactory()});
 await clearAllStoresForTesting();await initializeDatabase();const db=await openDatabase();
 await new Promise<void>(yes=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(syntheticCamera());tx.oncomplete=()=>yes();});
});
it('saves original packages separately without changing any library record',async()=>{
 const broker=make();await broker.initializeInbox();broker.connect('first',allowed());const before=await getAllSnapshot();
 expect(await broker.handle(submit(),'first')).toMatchObject({ok:true,data:{status:'review_required'}});
 const view=broker.getState().proposals[0];expect(view.expiresAt-now).toBe(REVIEW_WINDOW_MS);expect(view.persisted).toBe(true);
 expect((await inbox.list()).records[0].changeSet).toEqual(midoriChangeSet());expect(await getAllSnapshot()).toEqual(before);
});
it('restores packages without a session, grant, receipt permission or approval',async()=>{
 const first=make();first.connect('first',allowed());await first.handle(submit(),'first');first.disconnect();
 const restored=make();await restored.initializeInbox();
 expect(restored.getState().connected).toBe(false);expect(restored.getState().scope.allowProposals).toBe(false);
 expect(restored.getState().proposals[0]).toMatchObject({status:'disconnected',sessionId:'',needsRevalidation:true,persisted:true});
 expect(restored.getState().proposals[0].preview).toBeUndefined();expect(restored.isReviewed(restored.getState().proposals[0].id)).toBe(false);
});
it('revalidates a matching authorized resubmission without extending its window or restoring approvals',async()=>{
 const first=make();first.connect('first',allowed());await first.handle(submit(),'first');const deadline=first.getState().proposals[0].expiresAt;first.disconnect();now+=600001;
 const restored=make();await restored.initializeInbox();restored.connect('second',allowed());
 expect(await restored.handle(submit(),'second')).toMatchObject({ok:true,data:{status:'review_required'}});
 const p=restored.getState().proposals[0];expect(p.expiresAt).toBe(deadline);expect(p.sessionId).toBe('second');expect(p.preview?.approval.scenes).toBe(false);expect(restored.isReviewed(p.id)).toBe(false);
});
it('does not disclose saved status to a fresh session with insufficient scope',async()=>{
 const first=make();first.connect('first',allowed());await first.handle(submit(),'first');first.disconnect();
 const restored=make();await restored.initializeInbox();restored.connect('second',emptyMcpScope());
 expect(await restored.handle(submit(),'second')).toMatchObject({ok:false,error:{code:'PERMISSION_DENIED'}});
 expect(restored.getState().proposals[0].sessionId).toBe('');
});
it('does not replace saved content when a change-set ID is resubmitted with different content',async()=>{
 const first=make();first.connect('first',allowed());await first.handle(submit(),'first');first.disconnect();
 const restored=make();await restored.initializeInbox();restored.connect('second',allowed());const changed=midoriChangeSet();changed.title='Changed identity';
 expect(await restored.handle(submit(changed),'second')).toMatchObject({ok:false,error:{code:'CONFLICT'}});
 expect((await inbox.list()).records[0].changeSet).toEqual(midoriChangeSet());
});
it('leaves rejected saved packages rejected rather than implicitly reconsidering them',async()=>{
 const first=make();first.connect('first',allowed());await first.handle(submit(),'first');first.disconnect();const r=(await inbox.list()).records[0];
 await inbox.update({...r,disposition:'rejected',feedback:{text:'Needs a different setting.',rejectedAt:now,sharedPreviously:false}},r.revision);
 const restored=make();await restored.initializeInbox();restored.connect('second',allowed());
 expect(await restored.handle(submit(),'second')).toMatchObject({ok:true,data:{status:'rejected'}});
 expect(restored.getState().proposals[0].status).toBe('rejected');expect(restored.isReviewed(r.id)).toBe(false);
});
it('keeps ten-minute review available while retaining the independent session idle limit',async()=>{
 const broker=make();broker.connect('first',allowed());await broker.handle(submit(),'first');now+=600001;broker.expire();
 expect(broker.getState().proposals[0].status).toBe('review_required');now+=MCP_LIMITS.idleMs+1;broker.expire();
 expect(broker.getState().connected).toBe(false);expect((await inbox.list()).records).toHaveLength(1);
});
it('shows expiry after a day even when disconnected, without deleting the package',async()=>{
 const broker=make();broker.connect('first',allowed());await broker.handle(submit(),'first');broker.disconnect();now+=REVIEW_WINDOW_MS;broker.expire();
 expect(broker.getState().proposals[0].status).toBe('expired');expect((await inbox.list()).records[0].changeSet).toEqual(midoriChangeSet());
});
it('never lets synthetic events resume, renew, reconsider or remove a draft',async()=>{
 const broker=make();broker.connect('first',allowed());await broker.handle(submit(),'first');const id=broker.getState().proposals[0].id,before=await inbox.list();
 for(const options of[{}, {renew:true},{reconsider:true}])await expect(broker.resumeDraft(id,new Event('click'),options)).rejects.toThrow(/actual|review|human/i);
 await expect(broker.removeDraft(id,new Event('click'))).rejects.toThrow();expect(await inbox.list()).toEqual(before);
});
it('reports unexpected cache admission failure as an explicit in-memory draft',async()=>{
 const repo={list:async()=>({records:[],invalid:[]}),create:async()=>{throw new DOMException('Synthetic storage quota exhausted','QuotaExceededError');}};
 const broker=make({inbox:repo});broker.connect('first',allowed());
 expect(await broker.handle(submit(),'first')).toMatchObject({ok:true,data:{status:'review_required'}});
 expect(broker.getState().proposals[0]).toMatchObject({persisted:false,cacheError:expect.stringMatching(/quota/i)});
});
it('does not treat a cached applied/applying hint as proof of a committed scene',async()=>{
 const first=make();first.connect('first',allowed());await first.handle(submit(),'first');first.disconnect();const r=(await inbox.list()).records[0];
 await inbox.update({...r,disposition:'applying'},r.revision);
 const restored=make();await restored.initializeInbox();expect(restored.getState().proposals[0].status).toBe('disconnected');
 expect(restored.getState().proposals[0].error).toMatch(/outcome|receipt/i);expect((await getAllSnapshot()).scenes).toHaveLength(0);
 restored.connect('second',allowed());expect(await restored.handle(submit(),'second')).toMatchObject({ok:true,data:{status:'review_required'}});
 expect((await getAllSnapshot()).scenes).toHaveLength(0);
});
it('does not resurrect a draft removed by another tab through a late progress update',async()=>{
 const broker=make();broker.connect('first',allowed());await broker.handle(submit(),'first');const p=broker.getState().proposals[0],r=(await inbox.list()).records[0];await inbox.remove(r.id,r.revision);
 await expect(broker.saveProgress(p.id,{selectedTab:'frames'})).rejects.toThrow(/removed|missing|changed/i);
 expect((await inbox.list()).records).toHaveLength(0);
});
it('does not accept a ninth saved package after browser restart',async()=>{
 const first=make();first.connect('first',allowed());for(let i=0;i<8;i++){const input=midoriChangeSet();input.changeSetId='synthetic-cached-'+i;expect((await first.handle(submit(input),'first')).ok).toBe(true);}first.disconnect();
 const restored=make();await restored.initializeInbox();restored.connect('second',allowed());
 expect(await restored.handle(submit(),'second')).toMatchObject({ok:false,error:{code:'QUEUE_FULL'}});expect((await inbox.list()).records).toHaveLength(8);
});
it('does not adopt a newer scope epoch while awaiting the local inbox',async()=>{
 let release!:(value:{records:never[];invalid:never[]})=>void;
 const repo={...inbox,list:()=>new Promise<{records:never[];invalid:never[]}>(yes=>{release=yes;})};
 const broker=make({inbox:repo});broker.connect('first',allowed());const pending=broker.handle(submit(),'first');
 broker.setScope(allowed());release({records:[],invalid:[]});
 expect(await pending).toMatchObject({ok:false,error:{code:'PERMISSION_DENIED'}});
 expect(broker.getState().proposals).toHaveLength(0);
});
it('keeps cached resolution choices as hints rather than new-session reuse authority',async()=>{
 const first=make();first.connect('first',allowed());await first.handle(submit(),'first');first.disconnect();const r=(await inbox.list()).records[0];
 await inbox.update({...r,progress:{...r.progress,draftDecisions:{assetDecisions:{old_operation:{action:'reuse',assetId:'not_authorized_in_new_session'}}}}},r.revision);
 const restored=make();await restored.initializeInbox();restored.connect('second',allowed());
 expect(await restored.handle(submit(),'second')).toMatchObject({ok:true,data:{status:'review_required'}});
 expect(restored.getState().proposals[0].preview?.approval.assetDecisions).toEqual({});
});
it('merges rapid navigation and viewed progress after earlier queued writes finish',async()=>{
 const broker=make();broker.connect('first',allowed());await broker.handle(submit(),'first');const id=broker.getState().proposals[0].id;
 await Promise.all([broker.saveProgress(id,{selectedOperationId:'scene-01'}),broker.saveProgress(id,{selectedTab:'video'}),broker.saveProgress(id,{viewedOperations:{'scene-01':'a'.repeat(64)}})]);
 expect((await inbox.list()).records[0].progress).toMatchObject({selectedOperationId:'scene-01',selectedTab:'video',viewedOperations:{'scene-01':'a'.repeat(64)}});
});
it('recovers the actual ledger receipt with its original approval rather than empty cached choices',async()=>{
 const {previewChangeSet,applyApprovedChangeSet}=await import('../storage/changeSets'),{allContentApproval}=await import('./fixtures/changeSetFixture');
 const first=make();first.connect('first',allowed());await first.handle(submit(),'first');const record=(await inbox.list()).records[0];
 const prepared=await previewChangeSet(midoriChangeSet(),allContentApproval()),receipt=await applyApprovedChangeSet(prepared,prepared.approvedDigest),before=await getAllSnapshot();
 await inbox.update({...record,disposition:'applying'},record.revision);first.disconnect();const restored=make();await restored.initializeInbox();restored.connect('second',{...allowed(),receiptGrants:[{changeSetId:receipt.changeSetId,packageDigest:receipt.packageDigest}]});
 expect(await restored.handle(submit(),'second')).toMatchObject({ok:true,data:{status:'applied',receipt:{changeSetId:receipt.changeSetId}}});expect(restored.getState().proposals[0].receipt?.idMappings).toEqual(receipt.idMappings);expect(await getAllSnapshot()).toEqual(before);
});
it('shows the actual review-cache failure and clears authority instead of a generic preview error',async()=>{
 const broker=make();broker.connect('first',allowed());await broker.handle(submit(),'first');const id=broker.getState().proposals[0].id;
 vi.spyOn(inbox,'update').mockRejectedValueOnce(new DOMException('Saved review metadata exceeds 64 KiB. Request a smaller batch.','QuotaExceededError'));
 await broker.review(id);expect(broker.getState().proposals[0].status).toBe('conflict');expect(broker.getState().proposals[0].error).toContain('metadata exceeds 64 KiB');expect(broker.isReviewed(id)).toBe(false);
});
