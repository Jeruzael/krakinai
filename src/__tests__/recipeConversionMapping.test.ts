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
