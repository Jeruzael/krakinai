import {expect,it,vi} from 'vitest';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {getAllSnapshot,saveSceneDraft,saveSceneFromDraft,createDraftFromSavedScene} from '../storage/db';
import {buildRevisionDraft,saveAuthoredScene} from '../storage/sceneAuthoring';
import {sceneDuplicateKey} from '../domain/sceneDuplicates';
import {writeRecord} from './fixtures/ensembleStorageFixture';
it('durably saves and reopens exact frame plans, snapshots and manual modes with independent draft revisions',async()=>{
 const f=await seedKeyframeStorage();expect(f.draft.keyframePlan).toEqual(f.plan);expect(f.draft.imagePromptSnapshots).toEqual(f.parent.imagePromptSnapshots);
 const input={...f.draft,manualImageOutputs:{middle:{full:{text:' Exact manual frame\r\n✨ ',basedOnVisualDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,updatedAt:f.draft.updatedAt}}}},draft=await saveSceneDraft(input);
 expect(draft.inputRevision).toBe(f.draft.inputRevision+1);expect((await getAllSnapshot()).drafts[0].manualImageOutputs).toEqual(input.manualImageOutputs);
 await expect(saveSceneDraft({...draft,keyframePlan:undefined,imagePromptSnapshots:undefined,manualImageOutputs:undefined})).rejects.toThrow(/confirm|keyframe|frame plan/i);
});
it('creates an immutable C take through both save entry points and preserves existing scene/media/preference',async()=>{
 for(const legacy of [false,true]){
  const f=await seedKeyframeStorage(),before=await getAllSnapshot(),options={requestId:'frame-save-'+legacy,expectedInputRevision:f.draft.inputRevision,frameVideoDecision:'keep_exact_unverified' as const};
  const saved=legacy?await saveSceneFromDraft(f.draft.id,options):await saveAuthoredScene(f.draft.id,options);
  expect(saved.keyframePlan).toEqual(f.draft.keyframePlan);expect(saved.imagePromptSnapshots).toEqual(f.parent.imagePromptSnapshots);expect(saved.outputs).toEqual(f.parent.outputs);
  const after=await getAllSnapshot();expect(after.scenes.filter(s=>s.id!==saved.id)).toEqual(before.scenes);expect(after.media).toEqual(before.media);expect(after.collections[0].project!.shots[1].selectedSceneId).toBe(f.parent.id);
  expect((await saveAuthoredScene(f.draft.id,options)).id).toBe(saved.id);
 }
});
it('copy/revision/alternate preserve C data and duplicate detection includes per-frame authorship',async()=>{
 const f=await seedKeyframeStorage(),state=await getAllSnapshot();
 for(const options of [{},{alternateTake:true}]){const draft=buildRevisionDraft(f.parent.id,state,options);expect(draft.keyframePlan).toEqual(f.parent.keyframePlan);expect(draft.imagePromptSnapshots).toEqual(f.parent.imagePromptSnapshots);}
 const copy=await createDraftFromSavedScene(f.parent.id);expect(copy.keyframePlan).toEqual(f.parent.keyframePlan);expect(copy.imagePromptSnapshots).toEqual(f.parent.imagePromptSnapshots);
 const changed=structuredClone(f.parent);changed.keyframePlan!.frames[1].visualInstructions+=' New pose.';expect(sceneDuplicateKey(changed)).not.toBe(sceneDuplicateKey(f.parent));
});
it('requires explicit stale manual decisions and never discards a manual video for keep-exact',async()=>{
 const f=await seedKeyframeStorage();f.draft.keyframePlan!.frames[1].visualInstructions='Aya looks back at the entrance.';
 const manual={text:'Exact manual image\r\n',basedOnVisualDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,updatedAt:f.draft.updatedAt};
 f.draft.manualImageOutputs={middle:{full:manual}};f.draft.manualOutputs={full:{text:'Exact manual video\r\n',basedOnInputRevision:1,updatedAt:f.draft.updatedAt}};
 const draft=await saveSceneDraft(f.draft),options={requestId:'manual-frame',expectedInputRevision:draft.inputRevision,frameVideoDecision:'keep_exact_unverified' as const};
 const before=await getAllSnapshot();await expect(saveAuthoredScene(draft.id,options)).rejects.toThrow(/manual|decision|choose/i);expect(await getAllSnapshot()).toEqual(before);
 const saved=await saveAuthoredScene(draft.id,{...options,frameOutputDecisions:{middle:{full:'keep_manual_unverified'}}});expect(saved.manualImageOutputs!.middle.full).toEqual(manual);expect(saved.outputs.full).toBe('Exact manual video\r\n');expect(saved.manualOutputs).toEqual(draft.manualOutputs);
});
it('rolls back every store if the final immutable C scene insert fails',async()=>{
 const f=await seedKeyframeStorage(),before=await getAllSnapshot(),original=IDBObjectStore.prototype.add;
 const spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,value,...args){if(this.name==='scenes')throw Error('Synthetic C insert failure');return original.call(this,value,...args);});
 try{await expect(saveAuthoredScene(f.draft.id,{requestId:'failed-c',expectedInputRevision:f.draft.inputRevision,frameVideoDecision:'keep_exact_unverified'})).rejects.toThrow('Synthetic C insert failure');}finally{spy.mockRestore();}
 expect(await getAllSnapshot()).toEqual(before);
});
it('does not certify a raw edited buffer as canonical merely because its copied visual digest still matches',async()=>{
 const f=await seedKeyframeStorage();f.draft.imagePromptSnapshots!.middle.full='A raw replacement that did not come from the canonical assembler.';
 const draft=await saveSceneDraft(f.draft),before=await getAllSnapshot();
 await expect(saveAuthoredScene(draft.id,{requestId:'raw-canonical',expectedInputRevision:draft.inputRevision,frameVideoDecision:'keep_exact_unverified'})).rejects.toThrow(/canonical|manual/i);expect(await getAllSnapshot()).toEqual(before);
});
it('rechecks exact current source and media metadata after asynchronous hash preparation',async()=>{
 for(const changed of ['source','media'] as const){
  const f=await seedKeyframeStorage(),before=await getAllSnapshot(),original=crypto.subtle.digest.bind(crypto.subtle);let injected=false;
  const spy=vi.spyOn(crypto.subtle,'digest').mockImplementation(async(algorithm,data)=>{if(!injected){injected=true;if(changed==='source')await writeRecord('scenes',{...f.parent,reviewNotes:'A different tab changed this source.'});else await writeRecord('media',{...f.state.media[0],byteSize:f.state.media[0].byteSize+1});}return original(algorithm,data);});
  try{await expect(saveAuthoredScene(f.draft.id,{requestId:'late-'+changed,expectedInputRevision:f.draft.inputRevision,frameVideoDecision:'keep_exact_unverified'})).rejects.toThrow(/changed|media|source/i);}finally{spy.mockRestore();}
  const after=await getAllSnapshot();expect(after.scenes).toHaveLength(before.scenes.length);expect(after.collections).toEqual(before.collections);expect(after.drafts).toEqual(before.drafts);expect(injected).toBe(true);
 }
});
