import {it,expect,vi} from 'vitest';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {writeRecord} from './fixtures/ensembleStorageFixture';
import {getAllSnapshot,saveMediaAsset,deleteSavedScene} from '../storage/db';
import {previewChangeSet,applyApprovedChangeSet} from '../storage/changeSets';
import {prepareBlockingSources} from '../domain/blockingPatch';
import {prepareKeyframeSources} from '../domain/keyframeChangeSet';
import {conversionKeyframePatch} from '../domain/keyframeConversionMapping';
import {prepareKeyframeChangeSet} from '../domain/keyframeChangeSet';
import {allocationFor} from './fixtures/changeSetFixture';
import {prepareStoredFrameImage} from '../domain/frameImageMedia';
async function addMiddle(){const f=await seedKeyframeStorage();f.parent.keyframePlan!.frames=f.parent.keyframePlan!.frames.filter(frame=>frame.id!=='middle');delete f.parent.imagePromptSnapshots!.middle;await writeRecord('scenes',f.parent);const b=(await prepareBlockingSources([f.parent])).get(f.parent.id)!,k=(await prepareKeyframeSources([f.parent],f.media)).get(f.parent.id)!;f.plan.frames[1].visualInstructions='Aya turns toward the chapel door; preserve her appearance and gown.';Object.assign(f.op,{expectedSourceRecipeDigest:b.recipeDigest,expectedBlockingDigest:b.blockingDigest,expectedKeyframeDigest:k.basis.planDigest,keyframes:conversionKeyframePatch(f.plan,k.basis.planDigest,f.parent.keyframePlan)});return f;}
it('atomically adds a complete middle frame as a new immutable take with actual receipt3 IDs',async()=>{
 const f=await addMiddle(),before=await getAllSnapshot(),p=await previewChangeSet(f.input,f.approval);expect(p.plan.findings.filter(f=>f.severity==='blocking')).toEqual([]);expect(await getAllSnapshot()).toEqual(before);
 await new Promise(resolve=>setTimeout(resolve,15));const receipt:any=await applyApprovedChangeSet(p,p.approvedDigest),after=await getAllSnapshot(),id=receipt.idMappings['new-take'].id,next=after.scenes.find(s=>s.id===id)!;
 expect(receipt).toMatchObject({version:3,changeSetSchema:'krakinai.change-set.v6',frameResults:[{operationId:'revise',sceneId:id,frameIds:['start','middle','end'],associationIds:[]}]});expect(next.id).not.toBe(f.parent.id);expect(next.imagePromptSnapshots!.middle.full).toContain('chapel door');expect(next.outputs).toEqual(f.parent.outputs);
 for(const frame of ['start','end'])expect(next.imagePromptSnapshots![frame]).toEqual(f.parent.imagePromptSnapshots![frame]);expect(after.scenes.find(s=>s.id===f.parent.id)).toEqual(before.scenes.find(s=>s.id===f.parent.id));expect(after.drafts).toEqual(before.drafts);expect(after.media).toEqual(before.media);expect(after.collections[0].project!.shots[1].selectedSceneId).toBe(f.parent.id);
 expect(await applyApprovedChangeSet(p,p.approvedDigest)).toEqual(receipt);expect(await getAllSnapshot()).toEqual(after);const replay=await previewChangeSet(f.input);expect(replay.replay).toEqual(receipt);expect(await applyApprovedChangeSet(replay,replay.approvedDigest)).toEqual(receipt);expect(await getAllSnapshot()).toEqual(after);
});
it.each(['project','scene','media','membership'])('rejects stale %s without partial take, image or receipt writes',async kind=>{
 const f=await seedKeyframeStorage(),p=await previewChangeSet(f.input,f.approval);expect(p.plan.findings.filter(f=>f.severity==='blocking')).toEqual([]);
 if(kind==='project'){const c=(await getAllSnapshot()).collections[0];c.project!.revision++;await writeRecord('collections',c);}
 if(kind==='scene'){const s=(await getAllSnapshot()).scenes.find(s=>s.id===f.parent.id)!;s.slots.environment!.promptText+=' foreign change';await writeRecord('scenes',s);}
 if(kind==='membership'){const c=(await getAllSnapshot()).collections[0];c.project!.shots[1].takeSceneIds=[];c.project!.shots[1].selectedSceneId=undefined;await writeRecord('collections',c);}
 if(kind==='media'){const m=(await getAllSnapshot()).media[0];m.blob=new Blob([new Uint8Array(m.byteSize)],{type:m.mimeType});await writeRecord('media',m);}
 const before=await getAllSnapshot();await expect(applyApprovedChangeSet(p,p.approvedDigest)).rejects.toThrow();expect(await getAllSnapshot()).toEqual(before);
});
it('revalidates exact human scope at the atomic boundary and rejects altered reviewed text',async()=>{
 const f=await seedKeyframeStorage(),p=await previewChangeSet(f.input,f.approval),before=await getAllSnapshot();expect(p.plan.findings.filter(f=>f.severity==='blocking')).toEqual([]);
 await expect(applyApprovedChangeSet(p,p.approvedDigest,()=>{throw Error('Synthetic permissions revoked at transaction boundary.');})).rejects.toThrow(/revoked/);expect(await getAllSnapshot()).toEqual(before);
 p.plan.scenes[0].imagePromptSnapshots!.middle.full+=' UNREVIEWED_CHANGE';await expect(applyApprovedChangeSet(p,p.approvedDigest)).rejects.toThrow(/digest|changed/);expect(await getAllSnapshot()).toEqual(before);
});
it('queues same-ID media replacement throughout v6 apply and saves exact original file hashes',async()=>{
 const f=await seedKeyframeStorage(),p=await previewChangeSet(f.input,f.approval),file=f.state.media[0],native=crypto.subtle.digest.bind(crypto.subtle);let release!:()=>void,entered!:()=>void,injected=false;
 const gate=new Promise<void>(resolve=>release=resolve),started=new Promise<void>(resolve=>entered=resolve);
 const spy=vi.spyOn(crypto.subtle,'digest').mockImplementation(async(algorithm,data)=>{if(!injected){injected=true;entered();await gate;}return native(algorithm,data);});
 try{const saving=applyApprovedChangeSet(p,p.approvedDigest);await started;let replaced=false;const replacement=saveMediaAsset({id:file.id,filename:file.filename,mimeType:file.mimeType,width:file.width,height:file.height,blob:new Blob([new Uint8Array(file.byteSize).fill(42)],{type:file.mimeType})}).then(()=>replaced=true);
 await new Promise(resolve=>setTimeout(resolve,20));expect(replaced).toBe(false);release();const receipt=await saving;await replacement;const saved=(await getAllSnapshot()).scenes.find(s=>s.id===receipt.idMappings['new-take'].id)!;expect(saved.imagePromptSnapshots!.start.referenceProvenance).toEqual(f.parent.imagePromptSnapshots!.start.referenceProvenance);
 }finally{release?.();spy.mockRestore();}
});
it('rolls back a late quota failure after scene writes have been scheduled',async()=>{
 const f=await seedKeyframeStorage(),p=await previewChangeSet(f.input,f.approval),before=await getAllSnapshot(),native=IDBObjectStore.prototype.put;
 const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['put']>){if(this.name==='preferences')throw new DOMException('Synthetic late quota failure','QuotaExceededError');return native.apply(this,args);});
 try{await expect(applyApprovedChangeSet(p,p.approvedDigest)).rejects.toThrow(/quota/);}finally{spy.mockRestore();}expect(await getAllSnapshot()).toEqual(before);
});
it('replays the exact receipt after deleting the synthetic saved target without recreating it',async()=>{
 const f=await seedKeyframeStorage(),p=await previewChangeSet(f.input,f.approval),receipt=await applyApprovedChangeSet(p,p.approvedDigest);await deleteSavedScene(receipt.idMappings['new-take'].id);const before=await getAllSnapshot(),replay=await previewChangeSet(f.input);expect(await applyApprovedChangeSet(replay,replay.approvedDigest)).toEqual(receipt);expect(await getAllSnapshot()).toEqual(before);
});
it('atomically links a same-batch new take and records exact scene/frame/association IDs',async()=>{
 const f=await seedKeyframeStorage(),allocation=allocationFor(f.input),prepared=await prepareKeyframeChangeSet(f.input,f.approval,f.state,allocation,new Map(),f.proofs);f.approval.frameImages=true;
 f.input.operations.push({operationId:'link-middle',type:'frame_image.link',project:f.op.project,shot:f.op.shot,scene:{ref:'new-take'},frameId:'middle',expectedFrameDigest:prepared.prepared.get('revise')!.basis.frames.middle.visualDigest,expectedAssociationRevision:0,mediaId:f.state.media[0].id});
 const p=await previewChangeSet(f.input,f.approval);expect(p.plan.findings.filter(f=>f.severity==='blocking')).toEqual([]);const before=await getAllSnapshot(),receipt:any=await applyApprovedChangeSet(p,p.approvedDigest),after=await getAllSnapshot(),id=receipt.idMappings['new-take'].id,event=after.collections[0].project!.frameProduction!.imageEvents[0];
 expect(event).toMatchObject({sceneId:id,frameId:'middle',mediaId:f.state.media[0].id,reviewStatus:'needs_review'});expect(receipt.frameResults).toContainEqual({operationId:'link-middle',sceneId:id,frameIds:['middle'],associationIds:[event.id]});expect(after.media).toEqual(before.media);expect(after.collections[0].project!.shots[1].selectedSceneId).toBe(f.parent.id);
});
it('carries only an explicitly reviewed unchanged image and resets approval in the atomic new take',async()=>{
 const f=await seedKeyframeStorage(),file=f.state.media[0],proof=f.sources.get(f.parent.id)!.frames.start,mediaProof=await prepareStoredFrameImage(file),collection=f.state.collections[0];
 collection.project!.frameProduction={version:1,revision:1,imageEvents:[{id:'old-frame-image',revision:1,kind:'reviewed',shotId:f.shotId,sceneId:f.parent.id,frameId:'start',mediaId:file.id,sha256:mediaProof.sha256,...proof,reviewStatus:'approved',provenance:{kind:'existing_media'},createdAt:f.parent.createdAt}],active:[{shotId:f.shotId,sceneId:f.parent.id,frameId:'start',eventId:'old-frame-image'}],videoReviews:[]};await writeRecord('collections',collection);
 f.op.imageCarryOver=[{frameId:'start',associationId:'old-frame-image',expectedRevision:1}];f.approval.frameImages=true;const p=await previewChangeSet(f.input,f.approval);expect(p.plan.findings.filter(f=>f.severity==='blocking')).toEqual([]);
 const before=await getAllSnapshot(),receipt:any=await applyApprovedChangeSet(p,p.approvedDigest),after=await getAllSnapshot(),events=after.collections[0].project!.frameProduction!.imageEvents;
 expect(events[0]).toEqual(before.collections[0].project!.frameProduction!.imageEvents[0]);expect(events[1]).toMatchObject({sceneId:receipt.idMappings['new-take'].id,frameId:'start',mediaId:file.id,sha256:mediaProof.sha256,reviewStatus:'needs_review',provenance:{kind:'carry_over',sourceEventId:'old-frame-image'}});expect(after.media).toEqual(before.media);expect(receipt.frameResults[0].associationIds).toEqual([events[1].id]);
});
