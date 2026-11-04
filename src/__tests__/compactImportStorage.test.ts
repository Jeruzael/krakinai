import {it,expect,vi} from 'vitest';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {writeRecord} from './fixtures/ensembleStorageFixture';
import {getAllSnapshot,initializeDatabase} from '../storage/db';
import {previewChangeSet,applyApprovedChangeSet} from '../storage/changeSets';
import {keyframeReviewedProjection} from '../domain/keyframeChangeSet';
import {canonicalStringify} from '../domain/changeSetCanonical';
import {verifyImportEvidence} from '../domain/importEvidence';
import * as ledger from '../domain/changeSetLedger';
it('previews compact capacity then atomically saves exact evidence and replay',async()=>{
 const f=await seedKeyframeStorage(),before=await getAllSnapshot(),p=await previewChangeSet(f.input,f.approval);
 expect(p.capacity?.status).toBe('checked');expect(await getAllSnapshot()).toEqual(before);
 const r:any=await applyApprovedChangeSet(p,p.approvedDigest),after=await getAllSnapshot();
 expect(r.version).toBe(4);expect(await verifyImportEvidence(r.reviewedEvidence)).toBe(canonicalStringify(keyframeReviewedProjection(p.plan)));
 expect(p.capacity?.prospective?.storedBytes).toBe(new TextEncoder().encode(JSON.stringify(after.preferences.aiImports)).length);
 expect(await applyApprovedChangeSet(p,p.approvedDigest)).toEqual(r);expect(await getAllSnapshot()).toEqual(after);
});
it('rejects corrupt stored evidence before replay or any new write',async()=>{
 const f=await seedKeyframeStorage(),p=await previewChangeSet(f.input,f.approval);await applyApprovedChangeSet(p,p.approvedDigest);
 const state=await getAllSnapshot(),prefs:any=state.preferences;prefs.aiImports.receipts[0].reviewedEvidence.sha256='0'.repeat(64);await writeRecord('preferences',prefs);
 const before=await getAllSnapshot();await expect(previewChangeSet(f.input)).rejects.toThrow(/hash/i);await expect(applyApprovedChangeSet(p,p.approvedDigest)).rejects.toThrow(/hash/i);expect(await getAllSnapshot()).toEqual(before);
 await expect(initializeDatabase()).rejects.toThrow(/hash/i);expect(await getAllSnapshot()).toEqual(before);
});
it('detects a concurrent ledger append between asynchronous verification and the write boundary',async()=>{
 const f=await seedKeyframeStorage(),p=await previewChangeSet(f.input,f.approval),real=ledger.prepareImportLedger;let raced=false;
 const spy=vi.spyOn(ledger,'prepareImportLedger').mockImplementation(async value=>{const verified=await real(value);
  if(!raced){raced=true;const state=await getAllSnapshot();await writeRecord('preferences',{...state.preferences,aiImports:{version:4,receipts:[{version:1,changeSetId:'concurrent',packageDigest:'a'.repeat(64),approvedDigest:'b'.repeat(64),source:{kind:'codex'},appliedAt:'2026-11-05T00:00:00Z',approval:{storyboard:true,scenes:false,preferred:false,statuses:false,assetDecisions:{},allowDuplicateSceneOperations:[]},idMappings:{},operations:[{operationId:'other',type:'project.update',status:'updated'}],projectRevisions:{}}],candidates:[]}});}
  return verified;});
 try{await expect(applyApprovedChangeSet(p,p.approvedDigest)).rejects.toThrow(/history changed|ledger changed/i);}finally{spy.mockRestore();}
 const after=await getAllSnapshot();expect(after.scenes).toHaveLength(f.state.scenes.length);expect(after.preferences.aiImports?.receipts).toHaveLength(1);
});
it('aborts staged scene writes if writing the compact receipt fails',async()=>{
 const f=await seedKeyframeStorage(),p=await previewChangeSet(f.input,f.approval),before=await getAllSnapshot(),real=IDBObjectStore.prototype.put;
 const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value:any,key?:IDBValidKey){if(this.name==='preferences')throw Error('synthetic receipt failure');return real.call(this,value,key);});
 try{await expect(applyApprovedChangeSet(p,p.approvedDigest)).rejects.toThrow(/synthetic receipt failure/);}finally{spy.mockRestore();}
 expect(await getAllSnapshot()).toEqual(before);
});
it('returns an existing receipt after exactly one consumptive browser authorization',async()=>{
 const f=await seedKeyframeStorage(),p=await previewChangeSet(f.input,f.approval),receipt=await applyApprovedChangeSet(p,p.approvedDigest),before=await getAllSnapshot();
 let consumed=0;const authorize=()=>{if(++consumed!==1)throw Error('Synthetic one-time consent already consumed');};
 let result;let failure;try{result=await applyApprovedChangeSet(p,p.approvedDigest,authorize);}catch(error){failure=(error as Error).message;}
 expect(failure).toBeUndefined();expect(consumed).toBe(1);expect(result).toEqual(receipt);expect(await getAllSnapshot()).toEqual(before);
});
