import {expect,it} from 'vitest';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {saveDraftAsTemplate,createDraftFromTemplate,getAllSnapshot} from '../storage/db';
it('requires separate explicit frame/image and Blocking omission before saving a reusable template',async()=>{
 const f=await seedKeyframeStorage(),before=await getAllSnapshot(),params={draft:f.draft,name:'Synthetic frame template',description:'QA',includeCharacterIdentity:false,ensembleMode:'full' as const,confirmBlockingOmission:true};
 await expect(saveDraftAsTemplate(params)).rejects.toThrow(/keyframe|image|frame plan/i);expect(await getAllSnapshot()).toEqual(before);
 const template=await saveDraftAsTemplate({...params,confirmKeyframeOmission:true}),draft=await createDraftFromTemplate(template.id);
 expect(draft.keyframePlan).toBeUndefined();expect(draft.imagePromptSnapshots).toBeUndefined();expect(draft.manualImageOutputs).toBeUndefined();expect(draft.blocking).toBeUndefined();expect((await getAllSnapshot()).drafts.find(d=>d.id===f.draft.id)!.keyframePlan).toEqual(f.draft.keyframePlan);
});
