import {beforeEach,it,expect,vi} from 'vitest';
import {blockingChangeScenario} from './fixtures/blockingChangeSetFixture';
import {writeRecord} from './fixtures/ensembleStorageFixture';
import {clearAllStoresForTesting,initializeDatabase,getAllSnapshot,openDatabase} from '../storage/db';
import {previewChangeSet,applyApprovedChangeSet} from '../storage/changeSets';
import {emptyChangeSetApproval} from '../types/changeSet';
import {exportFullBackupZip,restoreFullBackupZip,validateBackupZip} from '../storage/backup';
import {detectBackupFeatures} from '../domain/backupFeatures';
let fixture:Awaited<ReturnType<typeof blockingChangeScenario>>;
const approval=()=>({...emptyChangeSetApproval(),storyboard:true,scenes:true,blocking:true});
const blocked=(p:Awaited<ReturnType<typeof previewChangeSet>>)=>p.plan.findings.filter(f=>f.severity==='blocking');
beforeEach(async()=>{await clearAllStoresForTesting();await initializeDatabase();fixture=await blockingChangeScenario();for(const store of ['assets','variants','scenes','collections','media'] as const)for(const row of fixture.state[store])await writeRecord(store,row);});
it('previews without writes, atomically commits receipt2/ledger2, and replays without duplication',async()=>{
 const before=await getAllSnapshot(),p=await previewChangeSet(fixture.input,approval());expect(blocked(p)).toEqual([]);expect(await getAllSnapshot()).toEqual(before);
 const receipt=await applyApprovedChangeSet(p,p.approvedDigest),after=await getAllSnapshot();expect(receipt).toMatchObject({version:2,changeSetSchema:'krakinai.change-set.v5'});expect(after.preferences.aiImports?.version).toBe(2);
 expect(after.scenes.filter(s=>s.id!==receipt.idMappings['new-take'].id)).toEqual(before.scenes);expect(after.assets).toEqual(before.assets);expect(after.variants).toEqual(before.variants);expect(after.media).toEqual(before.media);expect(after.drafts).toEqual(before.drafts);expect(after.collections[0].project!.shots[1].selectedSceneId).toBe(fixture.parent.id);
 expect(await applyApprovedChangeSet(p,p.approvedDigest)).toEqual(receipt);expect(await getAllSnapshot()).toEqual(after);expect((await previewChangeSet(fixture.input)).replay).toEqual(receipt);
 const changed=structuredClone(fixture.input);changed.operations[0].blocking.participantUpserts[0].end.pose='Different';await expect(previewChangeSet(changed,approval())).rejects.toThrow(/already|different/);
 await expect(previewChangeSet(fixture.input,{...approval(),blocking:false})).rejects.toThrow(/already|different/);
});
it.each(['head','project','source','selection','order','binding','media'])('rejects stale %s and preserves the foreign write',async kind=>{
 const p=await previewChangeSet(fixture.input,approval());expect(blocked(p)).toEqual([]);const state=await getAllSnapshot(),parent=state.scenes.find(s=>s.id===fixture.parent.id)!,project=state.collections[0];
 if(kind==='head'){const head={...structuredClone(parent),id:'foreign-head',versionOfSceneId:parent.id,sceneRevision:{...parent.sceneRevision!,rootSceneId:parent.sceneRevision!.rootSceneId,parentSceneId:parent.id,sequence:2}};await writeRecord('scenes',head);}
 if(kind==='source'){parent.outputs.full+='foreign';await writeRecord('scenes',parent);}
 if(kind==='binding'){state.assets[0].revision++;await writeRecord('assets',state.assets[0]);}
 if(kind==='media'){state.media[0].filename='foreign-name.png';await writeRecord('media',state.media[0]);}
 if(kind==='project')project.project!.revision++;
 if(kind==='selection')project.project!.shots[1].selectedSceneId=undefined;
 if(kind==='order')project.project!.shots.reverse();
 if(['project','selection','order'].includes(kind))await writeRecord('collections',project);
 const before=await getAllSnapshot();await expect(applyApprovedChangeSet(p,p.approvedDigest)).rejects.toThrow();expect(await getAllSnapshot()).toEqual(before);expect(before.preferences.aiImports).toBeUndefined();
});
it('rejects changed reviewed content, decisions and revoked authorization without a ledger upgrade',async()=>{
 const p=await previewChangeSet(fixture.input,approval());expect(blocked(p)).toEqual([]);const before=await getAllSnapshot();
 const tampered=structuredClone(p);tampered.plan.scenes[0].blocking!.participants[0].end!.pose='Unreviewed';await expect(applyApprovedChangeSet(tampered,p.approvedDigest)).rejects.toThrow(/digest|preview/);
 const decisions=structuredClone(p);decisions.approval.blocking=false;await expect(applyApprovedChangeSet(decisions,p.approvedDigest)).rejects.toThrow(/digest|preview/);
 await expect(applyApprovedChangeSet(p,p.approvedDigest,()=>{throw Error('Synthetic revoked session/epoch')})).rejects.toThrow(/revoked/);expect(await getAllSnapshot()).toEqual(before);
});
it.each(['abort','quota'])('rolls back after a queued scene write on %s',async kind=>{
 const p=await previewChangeSet(fixture.input,approval());expect(blocked(p)).toEqual([]);const before=await getAllSnapshot(),original=IDBObjectStore.prototype.put;
 const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,...args){if(this.name==='preferences')throw new DOMException('Synthetic final failure',kind==='quota'?'QuotaExceededError':'AbortError');return original.call(this,value,...args);});
 try{await expect(applyApprovedChangeSet(p,p.approvedDigest)).rejects.toThrow(/Synthetic final failure/);}finally{spy.mockRestore();}expect(await getAllSnapshot()).toEqual(before);
});
it('retains mixed legacy receipts and v2 backup/replay after blocking scenes are removed',async()=>{
 const legacy={schema:'krakinai.change-set.v1',changeSetId:'legacy',source:{kind:'codex'},operations:[{operationId:'metadata',type:'project.update',project:fixture.op.project,name:'Legacy metadata'}]},oldPreview=await previewChangeSet(legacy,{...emptyChangeSetApproval(),storyboard:true}),oldReceipt=await applyApprovedChangeSet(oldPreview,oldPreview.approvedDigest);
 fixture.op.project.expectedRevision=(await getAllSnapshot()).collections[0].project!.revision;
 const p=await previewChangeSet(fixture.input,approval());expect(blocked(p)).toEqual([]);const receipt=await applyApprovedChangeSet(p,p.approvedDigest),db=await openDatabase();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('scenes','readwrite');tx.objectStore('scenes').clear();tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});
 const project=(await getAllSnapshot()).collections[0];for(const shot of project.project!.shots){shot.takeSceneIds=[];delete shot.selectedSceneId;}project.members=[];await writeRecord('collections',project);
 const before=await getAllSnapshot();expect(detectBackupFeatures(before)).toEqual(['change-set.v5-ledger']);expect(before.preferences.aiImports?.receipts[0]).toEqual(oldReceipt);const zip=await exportFullBackupZip();expect(await validateBackupZip(zip)).toMatchObject({valid:true});await restoreFullBackupZip(zip);expect((await getAllSnapshot()).preferences.aiImports).toEqual(before.preferences.aiImports);expect(await applyApprovedChangeSet(p,p.approvedDigest)).toEqual(receipt);
});
