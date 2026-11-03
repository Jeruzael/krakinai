import {it,expect} from 'vitest';
import {blockingChangeScenario} from './fixtures/blockingChangeSetFixture';
import {allocationFor} from './fixtures/changeSetFixture';
import {parseChangeSet} from '../domain/changeSetValidation';
import {planChangeSet} from '../domain/changeSetPlanner';
import {emptyChangeSetApproval,type ChangeSetApproval} from '../types/changeSet';
import {canonicalStringify} from '../domain/changeSetCanonical';
import {prepareBlockingSources} from '../domain/blockingPatch';
const blocks=(p:ReturnType<typeof planChangeSet>)=>p.findings.filter(f=>f.severity==='blocking');
async function scenario(){const f=await blockingChangeScenario(),approval:ChangeSetApproval={...emptyChangeSetApproval(),storyboard:true,scenes:true,preferred:true,blocking:true};return{...f,approval,plan:()=>{const input=parseChangeSet(f.input);return planChangeSet(input,approval,f.state,allocationFor(input),new Map(),f.proofs)}};}
it('creates an immutable reviewed recipe revision with unchanged unrelated tracks, references and preference',async()=>{
 const f=await scenario(),before=canonicalStringify(f.state),p=f.plan();expect(blocks(p)).toEqual([]);expect(p.scenes).toHaveLength(1);
 const next=p.scenes[0];expect(next.blocking?.participants[1]).toEqual(f.parent.blocking!.participants[1]);expect(next.slots).toEqual(f.parent.slots);expect(next.ensemble).toEqual(f.parent.ensemble);expect(next.references).toEqual(f.parent.references);expect(next.outputs.full).toContain('Aya keeps her original gown');expect(next.id).not.toBe(f.parent.id);
 expect(p.collections[0].project!.shots[1].selectedSceneId).toBe(f.parent.id);expect(canonicalStringify(f.state)).toBe(before);
 expect((p.operations[0].resolved as any).blocking.changedPaths.length).toBeGreaterThan(0);
});
it.each(['source','sourceRevision','recipeDigest','blockingDigest','patchDigest','membership','approval'])('blocks changed %s',async kind=>{
 const f=await scenario();if(kind==='source')f.parent.outputs.full+='changed';if(kind==='sourceRevision')f.op.expectedSourceRevision++;if(kind==='recipeDigest')f.op.expectedSourceRecipeDigest='0'.repeat(64);if(kind==='blockingDigest')f.op.expectedBlockingDigest='0'.repeat(64);if(kind==='patchDigest')f.op.blocking.expectedBaseDigest='0'.repeat(64);if(kind==='membership')f.state.collections[0].project!.shots[1].takeSceneIds=[];if(kind==='approval')f.approval.blocking=false;
 expect(blocks(f.plan()).length).toBeGreaterThan(0);
});
it('retains exact manual buffers for explicit per-mode decisions instead of the legacy discard consent',async()=>{
 const f=await scenario();f.parent.manualOutputs={full:{text:'Exact manual\r\nSOURCE',updatedAt:f.parent.updatedAt,inputRevision:1}} as any;f.parent.outputs.full='Exact manual\r\nSOURCE';f.proofs.clear();for(const [id,proof]of await prepareBlockingSources(f.state.scenes))f.proofs.set(id,proof);Object.assign(f.op,{expectedSourceRecipeDigest:f.proofs.get(f.parent.id)!.recipeDigest});
 let p=f.plan();expect(blocks(p).some(f=>f.code==='BLOCKING_OUTPUT_DECISION_REQUIRED')).toBe(true);expect((p.operations[0].resolved as any).blocking.manualOutputs.full.text).toBe('Exact manual\r\nSOURCE');expect((p.operations[0].resolved as any).blocking.canonicalOutputs.full).toContain('Aya keeps her original gown');
 f.approval.blockingOutputDecisions={revise:{full:'keep_manual_unverified'}};p=f.plan();expect(blocks(p)).toEqual([]);expect(p.scenes[0].outputs.full).toBe('Exact manual\r\nSOURCE');expect(p.scenes[0].manualOutputs.full?.text).toBe('Exact manual\r\nSOURCE');
 f.approval.blockingOutputDecisions.revise.full='canonical';p=f.plan();expect(blocks(p)).toEqual([]);expect(p.scenes[0].manualOutputs).toEqual({});expect(p.scenes[0].outputs.full).toContain('Aya keeps her original gown');
});
it('allows explicit whole-plan removal only in the new take and rejects unresolved target deletion',async()=>{
 const f=await scenario();(f.op as any).blocking=null;const p=f.plan();expect(blocks(p)).toEqual([]);expect(p.scenes[0].blocking).toBeUndefined();expect(f.parent.blocking).toBeDefined();
 (f.op as any).blocking={version:1,expectedBaseDigest:f.op.expectedBlockingDigest,removeLandmarkIds:['door']};expect(blocks(f.plan()).length).toBeGreaterThan(0);
});
it('rejects older reconstruction of a blocking parent while permitting unrelated metadata updates',async()=>{
 const f=await scenario();for(const schema of ['v2','v3','v4']){const old:any={...f.input,schema:`krakinai.change-set.${schema}`,operations:[{operationId:'revise',type:'scene.revise_recipe',clientRef:'copy',project:f.op.project,shot:f.op.shot,sceneId:f.parent.id,expectedHeadId:f.parent.id,title:'New title'}]};expect(blocks(planChangeSet(parseChangeSet(old),f.approval,f.state,allocationFor(old))).some(f=>/v5|blocking/i.test(f.message))).toBe(true);}
});
it('binds final storyboard order and separates unselected candidate comparisons',async()=>{
 const f=await scenario();(f.input.operations as any[]).push({operationId:'reorder',type:'shot.reorder',project:f.op.project,shots:[{id:f.shotId},{id:'shot-after'},{id:'shot-before'}]});
 const p=f.plan();expect(blocks(p)).toEqual([]);const review=(p as any).blockingContinuity;expect(review[0].finalShotOrder).toEqual([f.shotId,'shot-after','shot-before']);expect(review[0].comparisons.some((c:any)=>c.kind==='proposed_unselected_take'&&c.currentSceneId===p.scenes[0].id)).toBe(true);
 const signature=p.stateSignature;f.state.scenes.find(s=>s.id==='blocking-after')!.outputs.full+='stale neighbor';expect(f.plan().stateSignature).not.toBe(signature);
});
it('resolves explicitly approved same-batch candidates and binds only the named resulting participant',async()=>{
 const f=await scenario();(f.input.operations as any[]).unshift({operationId:'new-character',type:'asset.propose',clientRef:'new-character-ref',kind:'character',title:'Synthetic usher',promptText:'An explicitly authored fictional usher identity.',tags:['synthetic']});
 f.approval.assetDecisions['new-character']={action:'create'};
 (f.op as any).ensemble={version:1,participantUpserts:[{id:'usher',character:{asset:{ref:'new-character-ref'}},presence:'on_camera',identitySource:'master'}]};
 (f.op.blocking.participantUpserts as any[]).push({participant:{kind:'ensemble',participantId:'usher'},bindToRecipe:true,start:{visibility:'on_screen',zone:'left'},end:{visibility:'on_screen',zone:'left'}});
 const p=f.plan();expect(blocks(p)).toEqual([]);const scene=p.scenes[0],person=scene.ensemble!.participants.find(p=>p.id==='usher')!,track=scene.blocking!.participants.find(p=>p.participant.kind==='ensemble'&&p.participant.participantId==='usher')!;
 expect(person.character.sourceId).toBe(p.assets[0].id);expect(track.bindingToken).toContain(p.assets[0].id);expect(scene.blocking!.participants[1]).toEqual(f.parent.blocking!.participants[1]);
 f.approval.assetDecisions['new-character']={action:'defer'};expect(blocks(f.plan()).some(f=>f.code==='DEPENDENCY_BLOCKED')).toBe(true);
});
it('repairs all exact landmark dependencies in the same reviewed removal patch',async()=>{
 const f=await scenario();(f.op as any).blocking={version:1,expectedBaseDigest:f.op.expectedBlockingDigest,removeLandmarkIds:['door'],space:{originLandmarkId:'aisle'},participantUpserts:[{participant:{kind:'ensemble',participantId:'primary'},end:{headDirection:null,eyeline:{kind:'landmark',landmarkId:'altar'}}},{participant:{kind:'ensemble',participantId:'lucas'},start:{bodyDirection:null},end:{bodyDirection:null}}]};
 const p=f.plan();expect(blocks(p)).toEqual([]);expect(p.scenes[0].blocking!.landmarks.some(l=>l.id==='door')).toBe(false);expect(f.parent.blocking!.landmarks.some(l=>l.id==='door')).toBe(true);
});
