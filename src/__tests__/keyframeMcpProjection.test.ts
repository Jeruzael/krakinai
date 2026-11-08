import {it,expect} from 'vitest';
import {keyframeChangeScenario} from './fixtures/keyframeChangeSetFixture';
import {emptyMcpScopeV3} from '../domain/mcpScope';
import {validateToolArgs,MCP_TOOL_NAMES,MCP_LIMITS,resultData} from '../domain/mcpProtocol';
import {readMcpTool} from '../domain/mcpReads';
import {prepareKeyframeChangeSet} from '../domain/keyframeChangeSet';
import {planChangeSet} from '../domain/changeSetPlanner';
import {allocationFor} from './fixtures/changeSetFixture';
import {keyframeMcpPreview} from '../domain/keyframeMcp';
import {ProposalBroker} from '../connections/proposalBroker';
import {MCP_KEYFRAME_CAPABILITIES} from '../domain/mcpCapabilities';
async function fixture(){const f=await keyframeChangeScenario(),scope={...emptyMcpScopeV3(),projectIds:[f.projectId],keyframeSceneIds:[f.parent.id],blockingSceneIds:[f.parent.id],assetIds:f.state.assets.map(a=>a.id),variantIds:f.state.variants.map(v=>v.id),includeCharacterIdentity:true,includeAssetText:true,includeNotes:true,includeMediaFilenames:true,allowImagePromptDerivation:true};const allocation=allocationFor(f.input),context=await prepareKeyframeChangeSet(f.input,f.approval,f.state,allocation,new Map(),f.proofs),plan=planChangeSet(f.input,f.approval,f.state,allocation,new Map(),f.proofs,context);return{...f,scope,preview:{version:1,changeSet:f.input,plan} as any};}
it('registers tools and rejects unknown nested image/projection controls',()=>{
 expect(MCP_TOOL_NAMES).toHaveLength(37);expect(()=>validateToolArgs('krakinai_get_generation_prompt',{sceneId:'scene',target:{kind:'image',keyframeId:'middle',mode:'full'}})).not.toThrow();
 for(const target of [{kind:'image',keyframeId:'middle',mode:'full',approved:true},{kind:'video'},{kind:'image',keyframeId:'middle',mode:'bad'}])expect(()=>validateToolArgs('krakinai_get_generation_prompt',{sceneId:'scene',target})).toThrow();
 expect(()=>validateToolArgs('krakinai_get_scene',{sceneId:'scene',projection:'keyframes'})).not.toThrow();
});
it('reads one saved image mode complete and preserves old video call bytes',async()=>{
 const f=await fixture(),scope={...f.scope,imagePromptFrameGrants:[{sceneId:f.parent.id,frameId:'middle'}],fullPromptSceneIds:[f.parent.id]};
 expect(await readMcpTool('krakinai_get_generation_prompt',{sceneId:f.parent.id,target:{kind:'image',keyframeId:'middle',mode:'full'}},scope,f.state)).toMatchObject({text:f.parent.imagePromptSnapshots!.middle.full});
 expect(await readMcpTool('krakinai_get_generation_prompt',{sceneId:f.parent.id},scope,f.state)).toEqual({sceneId:f.parent.id,format:'full',text:f.parent.outputs.full,trust:'untrusted_user_content'});
});
it('returns bounded summary and explicitly derived single proposed mode without a new saved grant',async()=>{
 const f=await fixture(),summary=await keyframeMcpPreview(f.preview,f.scope,f.state);expect(summary.operations).toHaveLength(1);expect(JSON.stringify(summary)).not.toContain(f.parent.ensemble!.participants[0].character.promptText);expect(summary.operations[0]).not.toHaveProperty('beforePlan');expect(summary.operations[0]).not.toHaveProperty('afterPlan');
 const selection={operationId:'revise',keyframeId:'middle',mode:'full' as const},projected:any=await keyframeMcpPreview(f.preview,f.scope,f.state,selection);expect(projected.frame).toMatchObject({keyframeId:'middle',mode:'full',disclosure:'shared'});expect(projected.frame.text).toContain('chapel door');expect(f.scope.imagePromptFrameGrants).toEqual([]);
 const denied:any=await keyframeMcpPreview(f.preview,{...f.scope,allowImagePromptDerivation:false},f.state,selection);expect(denied.frame.disclosure).toBe('withheld');expect(denied.frame).not.toHaveProperty('text');
});
it('provides only explicitly selected frame/media association metadata and never bytes',async()=>{
 const f=await fixture(),mediaId=f.state.media[0].id;
 f.state.collections[0].project!.frameProduction={version:1,revision:1,active:[{shotId:f.shotId,sceneId:f.parent.id,frameId:'middle',eventId:'event'}],imageEvents:[{id:'event',shotId:f.shotId,sceneId:f.parent.id,frameId:'middle',revision:1,kind:'linked',mediaId,sha256:'a'.repeat(64),promptDigest:'b'.repeat(64),visualDigest:'c'.repeat(64),bindingDigest:'d'.repeat(64),referenceDigest:'e'.repeat(64),provenance:{kind:'existing_media'},reviewStatus:'needs_review',createdAt:'2026-11-03T00:00:00Z'}],videoReviews:[]};
 const raw:any=await readMcpTool('krakinai_get_scene',{sceneId:f.parent.id,projection:'keyframes'},{...f.scope,imagePromptFrameGrants:[{sceneId:f.parent.id,frameId:'middle'}],mediaIds:[mediaId]},f.state);
 expect(raw.frameImages).toEqual([expect.objectContaining({frameId:'middle',mediaId,sha256:'a'.repeat(64),associationId:'event'})]);expect(JSON.stringify(raw.frameImages)).not.toMatch(/blob|base64/);
 const denied:any=await readMcpTool('krakinai_get_scene',{sceneId:f.parent.id,projection:'keyframes'},{...f.scope,imagePromptFrameGrants:[{sceneId:f.parent.id,frameId:'middle'}],mediaIds:[]},f.state);expect(denied.frameImages).toEqual([]);
});
it('rejects oversized complete results without truncation and keeps transport budgets',()=>{
 expect(MCP_LIMITS.result).toBe(512*1024);expect(MCP_LIMITS.package).toBe(1024*1024);expect(()=>resultData({text:'界'.repeat(180000)})).toThrow(/smaller|export/);
});
it('rechecks contributor grants against the resolved new Recipe instead of only the parent',async()=>{
 const f=await fixture(),newScene=f.preview.plan.scenes[0];expect(newScene).toBeDefined();newScene.slots.environment.sourceId='excluded-environment';
 const data:any=await keyframeMcpPreview(f.preview,f.scope,f.state,{operationId:'revise',keyframeId:'middle',mode:'full'});expect(data.frame.disclosure).toBe('withheld');expect(data.frame.missingDisclosures).toContain('component record grants');expect(data.frame).not.toHaveProperty('text');
});
it('runs read-only preview, submission and single-frame status through the real broker',async()=>{
 const f=await fixture(),before=structuredClone(f.state),scope={...f.scope,allowProposals:true,allowKeyframeProposals:true},preview={...f.preview,allocation:allocationFor(f.input),approvedDigest:'a'.repeat(64)};
 const broker=new ProposalBroker({readState:async()=>f.state,preview:async()=>preview,apply:async()=>{throw Error('Read-only regression must not apply.');}});broker.connect('synthetic',scope,Date.now()+60000,MCP_KEYFRAME_CAPABILITIES);
 const args={changeSet:f.input,projection:{operationId:'revise',keyframeId:'middle',mode:'full'}};
 const read:any=await broker.handle({requestId:'preview-call',tool:'krakinai_preview_change_set',args},'synthetic');expect(read).toMatchObject({ok:true,data:{keyframes:{frame:{disclosure:'shared'}}}});
 const submitted:any=await broker.handle({requestId:'submit-call',tool:'krakinai_submit_change_set',args:{changeSet:f.input}},'synthetic');expect(submitted.ok).toBe(true);
 const status:any=await broker.handle({requestId:'status-call',tool:'krakinai_get_proposal_status',args:{proposalId:submitted.data.proposalId,projection:args.projection}},'synthetic');expect(status).toMatchObject({ok:true,data:{status:'review_required',keyframes:{frame:{disclosure:'shared'}}}});expect(f.state).toEqual(before);broker.disconnect();
});
it('allows separately consented read-only derivation while proposal submission remains disabled',async()=>{
 const f=await fixture(),broker=new ProposalBroker({readState:async()=>f.state,preview:async()=>({...f.preview,allocation:allocationFor(f.input),approvedDigest:'a'.repeat(64)})});broker.connect('read-only',f.scope,Date.now()+60000,MCP_KEYFRAME_CAPABILITIES);
 const args={changeSet:f.input,projection:{operationId:'revise',keyframeId:'middle',mode:'full'}};
 expect(await broker.handle({requestId:'derive',tool:'krakinai_preview_change_set',args},'read-only')).toMatchObject({ok:true,data:{keyframes:{frame:{disclosure:'shared'}}}});
 expect(await broker.handle({requestId:'forbidden-submit',tool:'krakinai_submit_change_set',args:{changeSet:f.input}},'read-only')).toMatchObject({ok:false,error:{code:'PERMISSION_DENIED'}});expect(broker.getState().proposals).toEqual([]);broker.disconnect();
});
