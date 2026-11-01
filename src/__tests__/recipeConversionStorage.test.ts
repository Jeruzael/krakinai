import{beforeEach,it,expect}from'vitest';
import{clearAllStoresForTesting,initializeDatabase,openDatabase,getAllSnapshot}from'../storage/db';
import{previewChangeSet,applyApprovedChangeSet}from'../storage/changeSets';
import{conversionScenario}from'./fixtures/recipeConversionFixture';
const blocked=(p:Awaited<ReturnType<typeof previewChangeSet>>)=>p.plan.findings.filter(f=>f.severity==='blocking');
async function write(store:string,value:any){const db=await openDatabase();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)});}
beforeEach(async()=>{await clearAllStoresForTesting();await initializeDatabase();const{state}=await conversionScenario();for(const a of state.assets)await write('assets',a);for(const c of state.collections)await write('collections',c);for(const s of state.scenes)await write('scenes',s);});
it('previews without writes, atomically creates one immutable recipe and replays the exact receipt',async()=>{
 const f=await conversionScenario(),before=await getAllSnapshot(),p=await previewChangeSet(f.input,f.approval);expect(blocked(p)).toEqual([]);expect(await getAllSnapshot()).toEqual(before);
 const receipt=await applyApprovedChangeSet(p,p.approvedDigest),after=await getAllSnapshot(),created=after.scenes.find(s=>s.id===receipt.idMappings.converted.id)!;
 expect(after.scenes).toHaveLength(2);expect(after.scenes.find(s=>s.id==='direct-source')).toEqual(before.scenes[0]);
 expect(created.outputs).toEqual(p.plan.scenes[0].outputs);expect(after.collections[0].project!.shots[0].selectedSceneId).toBe('direct-source');
 expect(after.assets).toEqual(before.assets);expect(after.media).toEqual(before.media);expect(after.drafts).toEqual(before.drafts);
 expect(await applyApprovedChangeSet(p,p.approvedDigest)).toEqual(receipt);expect(await getAllSnapshot()).toEqual(after);
});
it('rejects a source edit after preview before writing anything',async()=>{
 const f=await conversionScenario(),p=await previewChangeSet(f.input,f.approval);expect(blocked(p)).toEqual([]);
 const source=(await getAllSnapshot()).scenes[0] as any;source.outputs.full+='changed';source.directPrompt.text=source.outputs.full;await write('scenes',source);
 const before=await getAllSnapshot();await expect(applyApprovedChangeSet(p,p.approvedDigest)).rejects.toThrow(/source|hash|changed/i);expect(await getAllSnapshot()).toEqual(before);
});
it('rejects tampered provenance or acknowledgements without any write',async()=>{
 const f=await conversionScenario(),p=await previewChangeSet(f.input,f.approval);expect(blocked(p)).toEqual([]);const before=await getAllSnapshot();
 (p.plan.scenes[0] as any).conversionProvenance.sourceSceneId='wrong';await expect(applyApprovedChangeSet(p,p.approvedDigest)).rejects.toThrow(/digest|preview/i);expect(await getAllSnapshot()).toEqual(before);
});
it('rolls back candidate creation, take attachment and receipt on a late transaction denial',async()=>{
 const f=await conversionScenario();f.input.operations.unshift({operationId:'new-camera',clientRef:'camera-candidate',type:'asset.propose',kind:'camera',title:'Synthetic B3 Camera',promptText:'A deliberate tripod composition.',tags:['synthetic']});
 f.approval.assetDecisions['new-camera']={action:'create'};const p=await previewChangeSet(f.input,f.approval);expect(blocked(p)).toEqual([]);const before=await getAllSnapshot();
 await expect(applyApprovedChangeSet(p,p.approvedDigest,()=>{throw Error('Synthetic late denial')})).rejects.toThrow(/late denial/);expect(await getAllSnapshot()).toEqual(before);
});
