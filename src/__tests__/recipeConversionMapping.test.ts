import{it,expect}from'vitest';
import{conversionScenario}from'./fixtures/recipeConversionFixture';
import{prepareConversionDraft}from'../domain/recipeConversion';
import{reconcileConversionMappings}from'../domain/recipeConversionRequest';
import{planChangeSet}from'../domain/changeSetPlanner';
import{allocationFor}from'./fixtures/changeSetFixture';
const link={mediaId:'synthetic-guide',role:'sample' as const,altText:'Illustrative demo, not an identity reference',order:0};
it('preserves a Direct Prompt checklist without a referencePack and keeps its media role and label',async()=>{
 const f=await conversionScenario(),source=f.state.scenes[0];source.references=[link];source.directReferences=[link];delete source.referencePack;
 const draft=prepareConversionDraft(f.input.operations[0],source,{id:'transient',inputRevision:1,updatedAt:source.updatedAt});expect(draft.referencePack?.entries).toHaveLength(1);expect(draft.referencePack!.entries[0]).toMatchObject(link);
 expect(reconcileConversionMappings(f.input.operations[0],source,f.state).conversion.mappings).toContainEqual(expect.objectContaining({target:{kind:'references'},assessment:'suggested'}));
});
it('adds a visible references mapping when an active selected component contributes media',async()=>{
 const f=await conversionScenario();f.state.assets.find(a=>a.id==='environment')!.mediaLinks=[link];
 expect(reconcileConversionMappings(f.input.operations[0],f.state.scenes[0],f.state).conversion.mappings).toContainEqual(expect.objectContaining({target:{kind:'references'},assessment:'suggested'}));
});
it('maps the primary participant instead of requiring a second top-level Character after enabling an ensemble',async()=>{
 const f=await conversionScenario(),source=f.state.scenes[0],op=f.input.operations[0];op.shotType='character_scene';op.assetRefs!.push({slot:'action',asset:{id:'action'},expectedRevision:f.state.assets.find(a=>a.id==='action')!.revision});
 op.ensemble={version:1,primaryParticipantId:'iris',participantOrder:['iris'],participantUpserts:[{id:'iris',character:{asset:{id:'character'},expectedRevision:f.state.assets.find(a=>a.id==='character')!.revision},presence:'on_camera'}],dialogueCues:[]};
 op.conversion.mappings.push({id:'old-character',target:{kind:'slot',slot:'character'},assessment:'unassigned'});const mapped=reconcileConversionMappings(op,source,f.state);f.input.operations[0]=mapped;
 expect(mapped.conversion.mappings.find(r=>r.id==='old-character')?.assessment).toBe('omitted');f.approval.conversionDecisions!.convert.acknowledgedRowIds=['old-character'];
 const plan=planChangeSet(f.input,f.approval,f.state,allocationFor(f.input),f.proofs);expect(plan.findings.filter(f=>f.severity==='blocking')).toEqual([]);
});

async function editableEnsemble(){const f=await conversionScenario(),op=f.input.operations[0],character=f.state.assets.find(a=>a.id==='character')!;f.state.assets.push({...character,id:'guest-character',title:'Synthetic Guest',promptText:'A second fictional adult.'});op.shotType='character_scene';op.assetRefs.push({slot:'action',asset:{id:'action'},expectedRevision:1});op.ensemble={version:1,primaryParticipantId:'lead',participantOrder:['lead','guest'],participantUpserts:[{id:'lead',character:{asset:{id:'character'},expectedRevision:1},presence:'on_camera'},{id:'guest',character:{asset:{id:'guest-character'},expectedRevision:1},presence:'on_camera'}],dialogueCues:[{id:'voice',mode:'voiceover',speaker:'External narrator',line:'Exact synthetic line.'}]};f.input.operations[0]=reconcileConversionMappings(op,f.state.scenes[0],f.state);return f}
for(const removed of['cue','participant']as const)it('guided reconciliation drops removed '+removed+' targets and requires a new complete mapping review',async()=>{
 const f=await editableEnsemble(),op=f.input.operations[0];if(removed==='cue')op.ensemble.dialogueCues=[];else{op.ensemble.participantUpserts=op.ensemble.participantUpserts.filter((p:any)=>p.id!=='guest');op.ensemble.participantOrder=['lead']}
 const mapped=reconcileConversionMappings(op,f.state.scenes[0],f.state);f.input.operations[0]=mapped;expect(mapped.conversion.mappings.some(r=>removed==='cue'?r.target.kind==='cue'&&r.target.cueId==='voice':r.target.kind==='participant'&&r.target.participantId==='guest')).toBe(false);
 f.approval.conversionDecisions!.convert={reviewed:true,acknowledgedRowIds:mapped.conversion.mappings.filter(r=>r.assessment!=='suggested').map(r=>r.id)};expect(planChangeSet(f.input,f.approval,f.state,allocationFor(f.input),f.proofs).findings.filter(f=>f.severity==='blocking')).toEqual([]);f.approval.conversionDecisions!.convert.reviewed=false;expect(planChangeSet(f.input,f.approval,f.state,allocationFor(f.input),f.proofs).findings.some(f=>f.code==='CONVERSION_MAPPING_REVIEW')).toBe(true);
});
it('still rejects manually forged omitted cue targets that do not exist',async()=>{const f=await conversionScenario();f.input.operations[0].conversion.mappings.push({id:'forged',target:{kind:'cue',cueId:'does-not-exist'},assessment:'omitted'});f.approval.conversionDecisions!.convert.acknowledgedRowIds=['forged'];expect(planChangeSet(f.input,f.approval,f.state,allocationFor(f.input),f.proofs).findings.some(f=>f.code==='CONVERSION_MAPPING_TARGET')).toBe(true)});
