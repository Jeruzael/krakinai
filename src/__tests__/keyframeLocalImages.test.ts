import {expect,it,vi} from 'vitest';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {getAllSnapshot,saveSceneDraft} from '../storage/db';
import {uploadDraftFrameImage,uploadFrameImage} from '../storage/frameImages';
import {saveAuthoredScene} from '../storage/sceneAuthoring';
import rasters from './fixtures/frame-raster-fixtures.json';
const file=()=>new File([Uint8Array.from(atob(rasters.files[0].base64),c=>c.charCodeAt(0))],'synthetic.png',{type:'image/png'});
it('transfers only explicitly selected draft images into the same new-take transaction; retry never duplicates',async()=>{
 const f=await seedKeyframeStorage(),draft=await uploadDraftFrameImage({draftId:f.draft.id,expectedInputRevision:f.draft.inputRevision,frameId:'middle',expectedVisualDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,file:file()}),before=await getAllSnapshot();
 const options={requestId:'explicit-draft-images',expectedInputRevision:draft.inputRevision,frameVideoDecision:'keep_exact_unverified' as const,frameImageChoices:{draftFrameIds:['middle'],carryOverEventIds:[]}};
 const saved=await saveAuthoredScene(draft.id,options),after=await getAllSnapshot(),event=after.collections[0].project!.frameProduction!.imageEvents[0];
 expect(event).toMatchObject({sceneId:saved.id,frameId:'middle',sha256:rasters.files[0].sha256,reviewStatus:'needs_review'});expect(after.media).toEqual(before.media);expect(after.drafts).toEqual(before.drafts);expect(after.scenes.find(s=>s.id===f.parent.id)).toEqual(f.parent);
 expect((await saveAuthoredScene(draft.id,options)).id).toBe(saved.id);expect((await getAllSnapshot()).collections).toEqual(after.collections);
 await expect(saveAuthoredScene(draft.id,{...options,frameImageChoices:{draftFrameIds:[],carryOverEventIds:[]}})).rejects.toThrow(/different operation/);
});
it('defaults to no carry-over and resets explicit unchanged-image carry to needs_review',async()=>{
 for(const carry of [false,true]){
 const f=await seedKeyframeStorage(),collection=await uploadFrameImage({target:{collectionId:f.projectId,expectedProjectRevision:f.state.collections[0].project!.revision,shotId:f.shotId,sceneId:f.parent.id,expectedSceneRevision:f.parent.revision,frameId:'middle',expectedVisualDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,expectedAssociationRevision:0},file:file()}),source=collection.project!.frameProduction!.imageEvents[0];
 const draft=await saveSceneDraft({...f.draft,authoredProjectTarget:{...f.draft.authoredProjectTarget!,expectedProjectRevision:collection.project!.revision}});
 const saved=await saveAuthoredScene(draft.id,{expectedInputRevision:draft.inputRevision,frameVideoDecision:'keep_exact_unverified',requestId:'carry-'+carry,...(carry?{frameImageChoices:{draftFrameIds:[],carryOverEventIds:[source.id]}}:{})}),events=(await getAllSnapshot()).collections[0].project!.frameProduction!.imageEvents;
 if(carry)expect(events.at(-1)).toMatchObject({sceneId:saved.id,reviewStatus:'needs_review',provenance:{kind:'carry_over',sourceEventId:source.id}});else expect(events.some(e=>e.sceneId===saved.id)).toBe(false);
 }
});
it('rolls back carried image associations when the immutable scene insert fails',async()=>{
 const f=await seedKeyframeStorage(),draft=await uploadDraftFrameImage({draftId:f.draft.id,expectedInputRevision:f.draft.inputRevision,frameId:'middle',expectedVisualDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,file:file()}),before=await getAllSnapshot(),original=IDBObjectStore.prototype.add;
 const spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,value,...args){if(this.name==='scenes')throw Error('Synthetic late scene failure');return original.call(this,value,...args);});
 try{await expect(saveAuthoredScene(draft.id,{requestId:'rollback-images',expectedInputRevision:draft.inputRevision,frameVideoDecision:'keep_exact_unverified',frameImageChoices:{draftFrameIds:['middle'],carryOverEventIds:[]}})).rejects.toThrow('Synthetic late scene failure');}finally{spy.mockRestore();}expect(await getAllSnapshot()).toEqual(before);
});
