import {it,expect}from'vitest';
import {planChangeSet}from'../domain/changeSetPlanner';
import {parseChangeSet}from'../domain/changeSetValidation';
import {allocationFor}from'./fixtures/changeSetFixture';
import{conversionScenario,conversionSourceText}from'./fixtures/recipeConversionFixture';
import{canonicalStringify}from'../domain/changeSetCanonical';
import{ensembleState}from'./fixtures/ensemblePlanningFixture';
import{buildRevisionDraft}from'../storage/sceneAuthoring';
const blocking=(plan:ReturnType<typeof planChangeSet>)=>plan.findings.filter(f=>f.severity==='blocking');
async function scenario(){const f=await conversionScenario();return{...f,plan:()=> (planChangeSet as any)(parseChangeSet(f.input),f.approval,f.state,allocationFor(f.input),f.proofs) as ReturnType<typeof planChangeSet>};}
it('assembles a new recipe root on the exact shot without changing the original or preference',async()=>{
 const f=await scenario(),before=canonicalStringify(f.state),p=f.plan();expect(blocking(p)).toEqual([]);
 const scene=p.scenes[0];expect(scene.authoringMode).toBe('recipe');expect(scene.directPrompt).toBeUndefined();expect(scene.manualOutputs).toEqual({});
 expect(scene.outputs.full).toContain('A quiet enclosed courtyard.');expect(scene.outputs.full).not.toContain('SOURCE_ONLY_DO_NOT_COPY');
 expect(scene.outputs.structured).toContain('=== ENVIRONMENT / LOCATION ===');expect(scene.outputs.compact).toContain('Enclosed courtyard.');
 expect(scene.sceneRevision).toMatchObject({rootSceneId:scene.id,sequence:1});expect(scene.sceneRevision?.parentSceneId).toBeUndefined();
 expect(scene.sourceSceneId).toBe('direct-source');expect((scene as any).conversionProvenance).toMatchObject({version:1,sourceSceneId:'direct-source',sourceTextSha256:f.input.operations[0].conversion.sourceTextSha256});
 expect(scene.saveDecision).toBe('take');expect(scene.separateTakeOfSceneId).toBe('direct-source');
 expect(scene.pendingInputs).toEqual(f.state.scenes[0].pendingInputs);
 expect(p.collections[0].project!.shots[0].takeSceneIds).toEqual(['direct-source',scene.id]);expect(p.collections[0].project!.shots[0].selectedSceneId).toBe('direct-source');
 expect(canonicalStringify(f.state)).toBe(before);expect(f.state.scenes[0].outputs.full).toBe(conversionSourceText);
});
it.each(['hash','head','membership','source type','source proof','component revision','project revision','span bounds'])("blocks changed %s",async kind=>{
 const f=await scenario(),op=f.input.operations[0];
 if(kind==='hash')op.conversion.sourceTextSha256='0'.repeat(64);
 if(kind==='head')op.expectedHeadId='wrong-head';
 if(kind==='membership')f.state.collections[0].project!.shots[0].takeSceneIds=[];
 if(kind==='source type')delete f.state.scenes[0].authoringMode;
 if(kind==='source proof')f.proofs.get('direct-source')!.text='different';
 if(kind==='component revision')op.assetRefs[0].expectedRevision=999;
 if(kind==='project revision')op.project.expectedRevision=999;
 if(kind==='span bounds')op.conversion.mappings[0].sourceSpan={start:1,end:999999};
 expect(blocking(f.plan()).length).toBeGreaterThan(0);
});
it('requires reviewed mappings and individual uncertain/omitted acknowledgements',async()=>{
 const f=await scenario(),op=f.input.operations[0];delete f.approval.conversionDecisions;expect(blocking(f.plan()).some(f=>f.code==='CONVERSION_MAPPING_REVIEW')).toBe(true);
 f.approval.conversionDecisions={convert:{reviewed:true,acknowledgedRowIds:[]}};op.conversion.mappings[0].assessment='uncertain';
 expect(blocking(f.plan()).some(f=>f.code==='CONVERSION_MAPPING_REVIEW')).toBe(true);
 f.approval.conversionDecisions.convert.acknowledgedRowIds=['environment-map'];expect(blocking(f.plan())).toEqual([]);
});
it('cannot waive an unassigned required component or hide a selected binding behind an omitted map',async()=>{
 const f=await scenario(),op=f.input.operations[0];op.assetRefs=[];op.conversion.mappings[0].assessment='unassigned';
 f.approval.conversionDecisions!.convert.acknowledgedRowIds=['environment-map'];expect(blocking(f.plan()).length).toBeGreaterThan(0);
});
it('requires coverage of every selected component and exact dialogue cue',async()=>{
 const f=await scenario(),op=f.input.operations[0];op.assetRefs.push({asset:{id:'camera'},slot:'camera',expectedRevision:1});
 expect(blocking(f.plan()).some(f=>/mapping/i.test(f.message))).toBe(true);
 op.conversion.mappings.push({id:'camera-map',target:{kind:'slot',slot:'camera'},assessment:'suggested'});expect(blocking(f.plan())).toEqual([]);
});
it('keeps unrelated memberships intact when the same source belongs to two projects',async()=>{
 const f=await scenario();const other=structuredClone(f.state.collections[0]);other.id='other';other.name='Other synthetic project';other.project!.shots[0].id='other-shot';f.state.collections.push(other);
 const p=f.plan();expect(blocking(p)).toEqual([]);expect(p.collections).toHaveLength(1);expect(f.state.collections[1]).toEqual(other);
});
it('keeps source settings and optional pending frames visible while an explicit new setting is assembled',async()=>{
 const f=await scenario();f.input.operations[0].settings={aspectRatio:'9:16',durationSeconds:7};const p=f.plan();expect(blocking(p)).toEqual([]);
 expect(p.scenes[0].settings).toEqual({aspectRatio:'9:16',durationSeconds:7});expect(f.state.scenes[0].settings).toEqual({aspectRatio:'16:9',durationSeconds:4});
 expect((p.operations[0].resolved as any).recipe.readiness).toBe('assembled_pending');
});
it('retains inactive original associations and appends actual component references without reassigning them',async()=>{
 const f=await scenario();const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGFEAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
 f.state.media=[{id:'guide',filename:'synthetic-guide.png',mimeType:'image/png',blob:new Blob([png],{type:'image/png'}),size:png.length,createdAt:'2026-11-01T00:00:00Z'}] as any;
 const original:any={associationId:'original-explicit',mediaId:'guide',sourceSlot:'legacy',sourceId:'direct-source',sourceTitle:'Original context',role:'sample',altText:'Original illustrative guide',purpose:'general',order:0};
 f.state.scenes[0].referencePack={version:1,entries:[original]};
 f.input.operations[0].conversion.mappings.push({id:'refs',target:{kind:'references'},assessment:'suggested'});
 const p=f.plan();expect(blocking(p)).toEqual([]);expect(p.scenes[0].referencePack?.entries).toContainEqual(original);expect(f.state.scenes[0].referencePack?.entries).toEqual([original]);
});
it('keeps compatible Outfit ownership and refuses an Outfit assigned to another participant',async()=>{
 const f=await scenario(),actors=ensembleState();f.state.assets=actors.assets;f.state.variants=actors.variants;
 const op=f.input.operations[0];op.shotType='character_scene';op.assetRefs.push({asset:{id:'action'},slot:'action',expectedRevision:1});
 op.ensemble={version:1,participantUpserts:[{id:'person',character:{asset:{id:'character'},expectedRevision:1},wardrobe:{variant:{id:'lucas-suit'},expectedRevision:1},presence:'on_camera'}],primaryParticipantId:'person',dialogueCues:[]};
 op.conversion.mappings.push({id:'act',target:{kind:'slot',slot:'action'},assessment:'suggested'},...(['character','wardrobe'] as const).map(field=>({id:field,target:{kind:'participant',participantId:'person',field},assessment:'suggested'})));
 expect(blocking(f.plan()).some(f=>/parent|wardrobe|outfit|another character/i.test(f.message))).toBe(true);
 op.ensemble.participantUpserts[0].wardrobe.variant.id='aya-outfit';expect(blocking(f.plan())).toEqual([]);
});
it('does not waive required Graphic/Motion originals when optional reference frames remain pending',async()=>{
 const f=await scenario(),op=f.input.operations[0];op.shotType='graphic_motion';op.assetRefs=[];op.conversion.mappings=op.conversion.mappings.filter((r:any)=>r.id!=='environment-map');
 const p=f.plan();expect(blocking(p).some(f=>/original|source image/i.test(f.message))).toBe(true);expect(p.scenes).toEqual([]);
});
it('preserves conversion provenance when starting later recipe revisions and alternate takes',async()=>{
 const f=await scenario(),p=f.plan();expect(blocking(p)).toEqual([]);f.state.scenes.push(...p.scenes);f.state.collections=p.collections;
 for(const alternateTake of[false,true]){
  const d=buildRevisionDraft(p.scenes[0].id,f.state,{alternateTake,target:{collectionId:'project',shotId:'shot',expectedProjectRevision:p.collections[0].project!.revision}});
  expect(d.conversionProvenance).toEqual(p.scenes[0].conversionProvenance);expect(d.slots).toEqual(p.scenes[0].slots);
 }
});
