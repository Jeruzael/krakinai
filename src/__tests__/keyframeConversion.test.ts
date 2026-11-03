import {expect,it} from 'vitest';
import {conversionScenario} from './fixtures/recipeConversionFixture';
import {enableKeyframeMapping,conversionKeyframePatch} from '../domain/keyframeConversionMapping';
import {parseChangeSet} from '../domain/changeSetValidation';
import {prepareConversionSources} from '../domain/recipeConversion';
import {prepareBlockingSources,NULL_BLOCKING_DIGEST} from '../domain/blockingPatch';
import {prepareKeyframeChangeSet} from '../domain/keyframeChangeSet';
import {planChangeSet} from '../domain/changeSetPlanner';
import {allocationFor} from './fixtures/changeSetFixture';
import {applyKeyframePatch} from '../domain/keyframePatch';
import {assembleImagePrompt} from '../domain/imagePromptDocument';
import {makeKeyframeFixture} from './fixtures/keyframeFixture';
import {clearAllStoresForTesting,initializeDatabase,saveSceneDraft,getAllSnapshot} from '../storage/db';
import {writeRecord} from './fixtures/ensembleStorageFixture';
it('promotes once to v6 and preserves stale source proof on download/resume',async()=>{
 const f=await conversionScenario(),input=await enableKeyframeMapping(f.input,f.state);expect(input.schema).toBe('krakinai.change-set.v6');expect(parseChangeSet(input)).toEqual(input);
 const before=structuredClone(input);f.state.scenes[0].reviewNotes='Changed after mapping';expect(await enableKeyframeMapping(input,f.state)).toEqual(before);
});
it('serializes a frame plan as targeted v6 edits without rewriting authored instants or IDs',()=>{
 const f=makeKeyframeFixture(),patch=conversionKeyframePatch(f.plan,NULL_BLOCKING_DIGEST);
 expect(applyKeyframePatch(undefined,patch,f.draft,NULL_BLOCKING_DIGEST)).toEqual(f.plan);
});
it('keeps incomplete Direct Prompt planning downloadable while blocking conversion until actual required Recipe inputs exist',async()=>{
 const f=await conversionScenario(),input=await enableKeyframeMapping(f.input,f.state),op=input.operations[0] as any;
 op.keyframes={version:1,expectedBaseDigest:op.expectedKeyframeDigest,id:'pending-plan',frameUpserts:[{id:'start',label:'Start',role:'start',participantRefs:[],referenceAssociationIds:[],visualInstructions:'Authored chapel view.'}],frameOrder:['start']};op.videoDecision='keep_exact_unverified';op.clearSlots=['environment'];op.assetRefs=[];
 const parsed=parseChangeSet(JSON.stringify(input)),allocation=allocationFor(parsed),proofs=await prepareBlockingSources(f.state.scenes),conversion=await prepareConversionSources(parsed,f.state.scenes),approval={...f.approval,keyframes:true,frameVideo:true};
 const prepared=await prepareKeyframeChangeSet(parsed,approval,f.state,allocation,conversion,proofs),plan=planChangeSet(parsed,approval,f.state,allocation,conversion,proofs,prepared);
 expect(plan.scenes).toHaveLength(0);expect(plan.findings).toEqual(expect.arrayContaining([expect.objectContaining({severity:'blocking',message:expect.stringMatching(/environment/i)})]));
 const direct={...f.state.scenes[0],inputRevision:1,keyframePlan:{version:1 as const,id:'pending-plan',frames:[]}} as any;
 expect((await assembleImagePrompt(direct,'start',new Map())).ready).toBe(false);expect(f.state.scenes[0].outputs.full).toContain('SOURCE_ONLY_DO_NOT_COPY');
});
it('durably retains incomplete Direct Prompt frame planning without creating a scene or claiming a complete image prompt',async()=>{
 await clearAllStoresForTesting();await initializeDatabase();const f=await conversionScenario(),source=f.state.scenes[0];
 for(const store of ['assets','variants','media','scenes','collections'] as const)for(const record of f.state[store]??[])await writeRecord(store,record);
 const before=await getAllSnapshot(),plan={version:1 as const,id:'direct-planning',frames:[{id:'start',label:'Start',role:'start' as const,participantRefs:[],referenceAssociationIds:[],visualInstructions:'Chapel planning only; the actual source image remains unresolved.'}]};
 const draft=await saveSceneDraft({...source,id:'direct-frame-draft',sourceSceneId:source.id,keyframePlan:plan,inputRevision:1});
 expect((await getAllSnapshot()).drafts.find(row=>row.id===draft.id)!.keyframePlan).toEqual(plan);expect((await getAllSnapshot()).scenes).toEqual(before.scenes);expect((await assembleImagePrompt(draft,'start',new Map())).ready).toBe(false);
});
