import {it,expect} from 'vitest';
import {keyframeChangeScenario} from './fixtures/keyframeChangeSetFixture';
import {emptyMcpScope,emptyMcpScopeV2,emptyMcpScopeV3,assertProposalScope} from '../domain/mcpScope';
import {readMcpTool,receiptProjection} from '../domain/mcpReads';
import {keyframeSceneProjection,keyframeSavedImage} from '../domain/keyframeMcp';
const secret={plan:'PRIVATE_FRAME_PLAN_CANARY',image:'PRIVATE_FRAME_IDENTITY_CANARY',manual:'PRIVATE_MANUAL_FRAME_CANARY',video:'PRIVATE_VIDEO_CANARY',reference:'PRIVATE_REFERENCE_NOTE_CANARY'};
async function fixture(){const f=await keyframeChangeScenario();f.parent.keyframePlan!.frames[1].visualInstructions=secret.plan;f.parent.imagePromptSnapshots!.middle.full=secret.image;f.parent.outputs.full=secret.video;const scope={...emptyMcpScopeV3(),projectIds:[f.projectId],keyframeSceneIds:[f.parent.id],imagePromptFrameGrants:[{sceneId:f.parent.id,frameId:'middle'}],assetIds:f.state.assets.map(a=>a.id),variantIds:f.state.variants.map(v=>v.id),blockingSceneIds:[f.parent.id],includeCharacterIdentity:true,includeAssetText:true,includeNotes:true,includeMediaFilenames:true,allowProposals:true,allowKeyframeProposals:true,allowFrameImageProposals:true};return{...f,scope};}
it('withholds C authoring text from old scopes and metadata-only reads',async()=>{
 const f=await fixture();for(const scope of [emptyMcpScope(),emptyMcpScopeV2(),emptyMcpScopeV3()]){scope.projectIds=[f.projectId];const result=await readMcpTool('krakinai_get_scene',{sceneId:f.parent.id},scope,f.state);for(const canary of Object.values(secret))expect(JSON.stringify(result)).not.toContain(canary);expect(keyframeSceneProjection(f.parent,scope)).toMatchObject({available:true,disclosure:'withheld'});}
});
it('shares a complete plan only with exact plan and linked Blocking grants',async()=>{
 const f=await fixture();expect(keyframeSceneProjection(f.parent,f.scope)).toMatchObject({disclosure:'shared',plan:f.parent.keyframePlan});
 expect(JSON.stringify(keyframeSceneProjection(f.parent,{...f.scope,blockingSceneIds:[]}))).not.toContain(secret.plan);
 f.parent.keyframePlan!.frames[1].referenceAssociationIds=[JSON.stringify(['id',secret.reference])];expect(JSON.stringify(keyframeSceneProjection(f.parent,{...f.scope,includeNotes:false}))).not.toContain(secret.reference);
});
it('requires exact image, plan, contributor and privacy grants independently of Video Full',async()=>{
 const f=await fixture();for(const scope of [{...f.scope,imagePromptFrameGrants:[]},{...f.scope,keyframeSceneIds:[]},{...f.scope,assetIds:[]},{...f.scope,includeCharacterIdentity:false},{...f.scope,includeAssetText:false},{...f.scope,includeNotes:false},{...f.scope,includeMediaFilenames:false},{...f.scope,blockingSceneIds:[]}])expect(()=>keyframeSavedImage(f.parent,'middle','full',scope)).toThrow();
 expect(keyframeSavedImage(f.parent,'middle','full',f.scope)).toMatchObject({text:secret.image,sceneId:f.parent.id,keyframeId:'middle'});
 await expect(readMcpTool('krakinai_get_generation_prompt',{sceneId:f.parent.id},f.scope,f.state)).rejects.toMatchObject({code:'PERMISSION_DENIED'});
 expect(await readMcpTool('krakinai_get_generation_prompt',{sceneId:f.parent.id},{...f.scope,fullPromptSceneIds:[f.parent.id]},f.state)).toMatchObject({text:secret.video});
});
it('rejects v6 under legacy, missing plan or missing proposal grants',async()=>{
 const f=await fixture();for(const scope of [{...emptyMcpScopeV2(),projectIds:[f.projectId],allowProposals:true},{...f.scope,keyframeSceneIds:[]},{...f.scope,allowKeyframeProposals:false},{...f.scope,allowProposals:false}])expect(()=>assertProposalScope(f.input,scope,f.state)).toThrow();expect(()=>assertProposalScope(f.input,f.scope,f.state)).not.toThrow();
});
it('never exposes internal receipt content or expands frame grants',async()=>{
 const f=await fixture(),receipt:any={version:2,changeSetSchema:'krakinai.change-set.v5',changeSetId:'receipt',packageDigest:'a'.repeat(64),approvedDigest:'b'.repeat(64),appliedAt:'2026-11-03T00:00:00Z',approval:{},reviewedContent:JSON.stringify(secret),operations:[],projectRevisions:{},idMappings:{saved:{kind:'scene',id:f.parent.id}}};const result=JSON.stringify(receiptProjection(receipt,f.state));for(const canary of Object.values(secret))expect(result).not.toContain(canary);expect(result).not.toContain('imagePromptFrameGrants');
});
it('allows an explicit same-batch image link without granting reads of the new take',async()=>{
 const f=await fixture(),link:any={operationId:'attach-frame',type:'frame_image.link',project:f.op.project,shot:f.op.shot,scene:{ref:'new-take'},frameId:'middle',expectedFrameDigest:'a'.repeat(64),expectedAssociationRevision:0,mediaId:f.state.media[0].id};f.input.operations.push(link);f.scope.mediaIds=[link.mediaId];
 expect(()=>assertProposalScope(f.input,f.scope,f.state)).not.toThrow();expect(f.scope.imagePromptFrameGrants).toEqual([{sceneId:f.parent.id,frameId:'middle'}]);
 link.scene={ref:'unrelated-reference'};expect(()=>assertProposalScope(f.input,f.scope,f.state)).toThrow();
});
