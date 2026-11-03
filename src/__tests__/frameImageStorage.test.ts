import {expect,it,vi} from 'vitest';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {getAllSnapshot} from '../storage/db';
import {uploadFrameImage,applyFrameImageCommand,uploadDraftFrameImage,recordFrameVideoReview} from '../storage/frameImages';
import {getActiveFrameImage} from '../domain/frameImageAssociations';
import rasters from './fixtures/frame-raster-fixtures.json';
import type {FrameImageTarget} from '../types/frameProduction';
import {writeRecord} from './fixtures/ensembleStorageFixture';
import {MAX_TOTAL_MEDIA_BYTES} from '../domain/validation';
import {prepareKeyframeSources} from '../domain/keyframeChangeSet';
import {updateProjectFrames} from '../storage/projectContinuity';
const file=(row=rasters.files[0])=>new File([Uint8Array.from(atob(row.base64),c=>c.charCodeAt(0))],row.filename,{type:row.mime});
const target=(f:Awaited<ReturnType<typeof seedKeyframeStorage>>):FrameImageTarget=>({collectionId:f.projectId,expectedProjectRevision:f.state.collections[0].project!.revision,shotId:f.shotId,sceneId:f.parent.id,expectedSceneRevision:f.parent.revision,frameId:'middle',expectedVisualDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,expectedAssociationRevision:0});
it.each(rasters.files)('atomically uploads $format and records an exact take/frame association needing review',async row=>{
 const f=await seedKeyframeStorage(),before=await getAllSnapshot(),t=target(f),collection=await uploadFrameImage({target:t,file:file(row)}),event=getActiveFrameImage(collection.project!.frameProduction,t)!;
 expect(event).toEqual(expect.objectContaining({frameId:'middle',sceneId:f.parent.id,sha256:row.sha256,reviewStatus:'needs_review'}));
 const after=await getAllSnapshot();expect(after.media).toHaveLength(before.media.length+1);expect(after.scenes).toEqual(before.scenes);expect(after.collections[0].project!.shots[1].selectedSceneId).toBe(f.parent.id);
 const reviewed=await applyFrameImageCommand({kind:'review',target:{...t,expectedProjectRevision:collection.project!.revision,expectedAssociationRevision:1},reviewStatus:'approved',note:'Synthetic human review'});expect(getActiveFrameImage(reviewed.project!.frameProduction,t)?.reviewStatus).toBe('approved');
 const cleared=await applyFrameImageCommand({kind:'clear',target:{...t,expectedProjectRevision:reviewed.project!.revision,expectedAssociationRevision:2}});expect(getActiveFrameImage(cleared.project!.frameProduction,t)).toBeUndefined();expect((await getAllSnapshot()).media).toEqual(after.media);
});
it('aborts media insertion and all metadata when a late collection write fails',async()=>{
 const f=await seedKeyframeStorage(),before=await getAllSnapshot(),original=IDBObjectStore.prototype.put;
 const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,...args){if(this.name==='collections')throw Error('Synthetic late frame failure');return original.call(this,value,...args);});
 try{await expect(uploadFrameImage({target:target(f),file:file()})).rejects.toThrow('Synthetic late frame failure');}finally{spy.mockRestore();}expect(await getAllSnapshot()).toEqual(before);
});
it('rejects stale ownership and cancellation with zero orphan media writes',async()=>{
 const f=await seedKeyframeStorage(),before=await getAllSnapshot();await expect(uploadFrameImage({target:{...target(f),expectedSceneRevision:99},file:file()})).rejects.toThrow(/revision|changed/i);
 await expect(uploadFrameImage({target:{...target(f),shotId:'shot-before'},file:file()})).rejects.toThrow(/take|shot|target/i);
 const abort=new AbortController();abort.abort();await expect(uploadFrameImage({target:target(f),file:file(),signal:abort.signal})).rejects.toThrow(/abort|cancel/i);expect(await getAllSnapshot()).toEqual(before);
});
it('checks the current 5000 MiB allowance at commit and preserves all stores on quota failure',async()=>{
 const f=await seedKeyframeStorage(),old=f.state.media[0];
 // Metadata-only accounting fixture; not represented as a valid multi-GiB raster.
 await writeRecord('media',{...old,id:'synthetic-quota-meter',byteSize:MAX_TOTAL_MEDIA_BYTES-1});const before=await getAllSnapshot();
 await expect(uploadFrameImage({target:target(f),file:file()})).rejects.toThrow(/5000 MiB/);expect(await getAllSnapshot()).toEqual(before);
});
it('owns an uploaded draft image through an explicit draft/frame binding without reassigning the saved source',async()=>{
 const f=await seedKeyframeStorage(),before=await getAllSnapshot(),draft=await uploadDraftFrameImage({draftId:f.draft.id,expectedInputRevision:f.draft.inputRevision,frameId:'middle',expectedVisualDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,file:file()});
 expect(draft.inputRevision).toBe(f.draft.inputRevision+1);expect(draft.frameImageAssignments!.middle.sha256).toBe(rasters.files[0].sha256);
 const after=await getAllSnapshot();expect(after.media).toHaveLength(before.media.length+1);expect(after.scenes).toEqual(before.scenes);expect(after.collections).toEqual(before.collections);expect(after.drafts.find(d=>d.id===draft.id)!.frameImageAssignments).toEqual(draft.frameImageAssignments);
});
it('rolls back uploaded bytes when the draft metadata insert fails',async()=>{
 const f=await seedKeyframeStorage(),before=await getAllSnapshot(),original=IDBObjectStore.prototype.put;
 const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,...args){if(this.name==='drafts')throw Error('Synthetic draft association failure');return original.call(this,value,...args);});
 try{await expect(uploadDraftFrameImage({draftId:f.draft.id,expectedInputRevision:f.draft.inputRevision,frameId:'middle',expectedVisualDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,file:file()})).rejects.toThrow('Synthetic draft association failure');}finally{spy.mockRestore();}expect(await getAllSnapshot()).toEqual(before);
});
it('honors cancellation inside the active transaction before commit',async()=>{
 const f=await seedKeyframeStorage(),before=await getAllSnapshot(),controller=new AbortController(),original=IDBObjectStore.prototype.add;
 const spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,value,...args){const result=original.call(this,value,...args);if(this.name==='media')controller.abort();return result;});
 try{await expect(uploadFrameImage({target:target(f),file:file(),signal:controller.signal})).rejects.toThrow();}finally{spy.mockRestore();}expect(await getAllSnapshot()).toEqual(before);
});
it('records a human video review only against exact current plan and effective text digests without replacing prompts',async()=>{
 const f=await seedKeyframeStorage(),before=await getAllSnapshot(),basis=(await prepareKeyframeSources([f.parent],new Map(before.media.map(m=>[m.id,m])))).get(f.parent.id)!.videoBasis!;
 const input={collectionId:f.projectId,expectedProjectRevision:before.collections[0].project!.revision,shotId:f.shotId,sceneId:f.parent.id,expectedSceneRevision:f.parent.revision,expectedBasis:basis,note:'Synthetic human checked the intended motion.'};
 await expect(recordFrameVideoReview({...input,expectedBasis:{...basis,planDigest:'0'.repeat(64)}})).rejects.toThrow(/basis|changed/i);expect(await getAllSnapshot()).toEqual(before);
 const collection=await recordFrameVideoReview(input),after=await getAllSnapshot();expect(collection.project!.frameProduction!.videoReviews[0]).toMatchObject({kind:'reviewed',basis});expect(after.scenes).toEqual(before.scenes);expect(after.media).toEqual(before.media);
});
it('rechecks a source changed during image decode and preserves the foreign write without orphan media',async()=>{
 const f=await seedKeyframeStorage(),before=await getAllSnapshot(),original=createImageBitmap;let changed=false;
 const spy=vi.spyOn(globalThis,'createImageBitmap').mockImplementation(async(...args:Parameters<typeof createImageBitmap>)=>{if(!changed){changed=true;await writeRecord('scenes',{...f.parent,reviewNotes:'Foreign update during native preparation.'});}return original(...args);});
 try{await expect(uploadFrameImage({target:target(f),file:file()})).rejects.toThrow(/source|changed|revision/i);}finally{spy.mockRestore();}
 const after=await getAllSnapshot();expect(after.media).toEqual(before.media);expect(after.collections).toEqual(before.collections);expect(after.drafts).toEqual(before.drafts);expect(after.scenes.find(s=>s.id===f.parent.id)!.reviewNotes).toBe('Foreign update during native preparation.');
});
it('adopts an explicit legacy First image without clearing or reassigning legacy fields',async()=>{
 const f=await seedKeyframeStorage(),media=f.state.media[0],collection=await updateProjectFrames({collectionId:f.projectId,shotId:f.shotId,firstFrameMediaId:media.id}),t={...target(f),expectedProjectRevision:collection.project!.revision};
 const after=await applyFrameImageCommand({kind:'link',target:t,mediaId:media.id,provenance:{kind:'legacy_adoption'}});expect(after.project!.shots[1].firstFrameMediaId).toBe(media.id);expect(getActiveFrameImage(after.project!.frameProduction,t)).toMatchObject({mediaId:media.id,reviewStatus:'needs_review',provenance:{kind:'legacy_adoption'}});
});
