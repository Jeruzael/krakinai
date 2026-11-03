import {it,expect} from 'vitest';
import {blockingChangeScenario} from './fixtures/blockingChangeSetFixture';
import {emptyMcpScope,emptyMcpScopeV2,assertProposalScope} from '../domain/mcpScope';
import {readMcpTool,receiptProjection} from '../domain/mcpReads';
import {blockingMcpPreview} from '../domain/blockingMcp';
import {buildAiContext} from '../domain/aiContext';
import {planChangeSet} from '../domain/changeSetPlanner';
import {allocationFor} from './fixtures/changeSetFixture';
import {parseChangeSet} from '../domain/changeSetValidation';
import {emptyChangeSetApproval} from '../types/changeSet';
const secret={blocking:'PRIVATE_BLOCKING_MOVEMENT_CANARY',identity:'PRIVATE_IDENTITY_CANARY',asset:'PRIVATE_ASSET_PROMPT_CANARY',notes:'PRIVATE_NOTES_CANARY',filename:'PRIVATE_FILENAME_CANARY.png',full:'PRIVATE_FULL_OUTPUT_CANARY'};
async function scenario(){const f=await blockingChangeScenario();f.parent.blocking!.participants[0].action!.text=secret.blocking;f.parent.ensemble!.participants[0].character.promptText=secret.identity;f.parent.slots.character!.promptText=secret.identity;f.parent.slots.environment!.promptText=secret.asset;f.parent.reviewNotes=secret.notes;f.parent.settings.toolNotes=secret.notes;f.parent.references[0]={...f.parent.references[0],filename:secret.filename};f.parent.outputs.full=secret.full;const scope={...emptyMcpScopeV2(),projectIds:[f.projectId],blockingSceneIds:[f.parent.id],allowProposals:true,allowBlockingProposals:true};return{...f,scope};}
it('reveals only Blocking availability to project/scene metadata grants',async()=>{
 const f=await scenario(),scope={...emptyMcpScope(),projectIds:[f.projectId]},data=await readMcpTool('krakinai_get_scene',{sceneId:f.parent.id},scope,f.state),text=JSON.stringify(data);
 expect(data).toMatchObject({blocking:{available:true,version:1,disclosure:'withheld'}});for(const canary of Object.values(secret))expect(text).not.toContain(canary);
});
it('discloses complete Blocking only under the exact separate grant and keeps other text private',async()=>{
 const f=await scenario(),data=await readMcpTool('krakinai_get_scene',{sceneId:f.parent.id},f.scope,f.state),text=JSON.stringify(data);expect(text).toContain(secret.blocking);for(const key of ['identity','asset','notes','filename','full'] as const)expect(text).not.toContain(secret[key]);
 expect(data).toMatchObject({blocking:{disclosure:'shared',plan:f.parent.blocking},expectedSourceRevision:f.parent.revision});expect((data as any).expectedSourceRecipeDigest).toMatch(/^[a-f0-9]{64}$/);
 const denied={...f.scope,blockingSceneIds:[]};expect(JSON.stringify(await readMcpTool('krakinai_get_scene',{sceneId:f.parent.id},denied,f.state))).not.toContain(secret.blocking);
});
it('requires both exact Full and Blocking grants for the entire saved Full output',async()=>{
 const f=await scenario();for(const scope of [{...f.scope,blockingSceneIds:[],fullPromptSceneIds:[f.parent.id]},{...f.scope,fullPromptSceneIds:[]}])await expect(readMcpTool('krakinai_get_generation_prompt',{sceneId:f.parent.id},scope,f.state)).rejects.toMatchObject({code:'PERMISSION_DENIED'});
 expect(await readMcpTool('krakinai_get_generation_prompt',{sceneId:f.parent.id},{...f.scope,fullPromptSceneIds:[f.parent.id]},f.state)).toMatchObject({text:secret.full});
 const doc=await readMcpTool('krakinai_get_scene',{sceneId:f.parent.id},{...f.scope,blockingSceneIds:[],fullPromptSceneIds:[f.parent.id]},f.state);expect(JSON.stringify(doc)).not.toContain(secret.full);
});
it('does not turn capability advertisement or ordinary proposals into Blocking write permission',async()=>{
 const f=await scenario(),input=parseChangeSet(f.input);for(const scope of [{...emptyMcpScope(),projectIds:[f.projectId],allowProposals:true},{...f.scope,allowBlockingProposals:false},{...f.scope,allowProposals:false},{...f.scope,blockingSceneIds:[]}])expect(()=>assertProposalScope(input,scope,f.state)).toThrow();expect(()=>assertProposalScope(input,f.scope,f.state)).not.toThrow();
});
it('requires the same explicit Blocking opt-in for manual context export',async()=>{
 const f=await scenario();expect(JSON.stringify(buildAiContext(f.state,{sceneIds:[f.parent.id]}))).not.toContain(secret.blocking);expect(JSON.stringify(buildAiContext(f.state,{sceneIds:[f.parent.id],blockingSceneIds:[f.parent.id]} as any))).toContain(secret.blocking);
 expect(()=>buildAiContext(f.state,{sceneIds:[f.parent.id],fullPromptSceneIds:[f.parent.id]})).toThrow(/blocking/i);expect(()=>buildAiContext(f.state,{sceneIds:[f.parent.id],blockingSceneIds:['unselected']} as any)).toThrow();
});
it('withholds new canonical/effective video unless every contributing disclosure is authorized',async()=>{
 const f=await blockingChangeScenario(),input=parseChangeSet(f.input),plan=planChangeSet(input,{...emptyChangeSetApproval(),storyboard:true,scenes:true,blocking:true},f.state,allocationFor(input),new Map(),f.proofs),preview:any={version:1,changeSet:input,plan};
 const scope={...emptyMcpScopeV2(),projectIds:[f.projectId],blockingSceneIds:[f.parent.id],allowProposals:true,allowBlockingProposals:true},result=blockingMcpPreview(preview,scope,f.state);
 expect(result[0].outputDisclosure).toBe('withheld');expect(result[0]).not.toHaveProperty('canonicalOutputs');expect(result[0].changedPaths.length).toBeGreaterThan(0);expect(JSON.stringify(result)).not.toContain(f.parent.ensemble!.participants[0].character.promptText);
});
it('receipt-only recovery never includes reviewedContent, prompts or newly saved Blocking grants',async()=>{
 const f=await scenario(),receipt:any={version:2,changeSetSchema:'krakinai.change-set.v5',changeSetId:'receipt',packageDigest:'a'.repeat(64),approvedDigest:'b'.repeat(64),appliedAt:'2026-11-03T00:00:00Z',approval:{},reviewedContent:JSON.stringify(secret),operations:[],projectRevisions:{},idMappings:{saved:{kind:'scene',id:f.parent.id}}};
 const data=receiptProjection(receipt,f.state),text=JSON.stringify(data);for(const canary of Object.values(secret))expect(text).not.toContain(canary);expect(data).not.toHaveProperty('reviewedContent');expect(data).toMatchObject({version:2,changeSetSchema:'krakinai.change-set.v5'});
});
it('shares complete proposed video only under all contributing grants and never truncates it',async()=>{
 const f=await blockingChangeScenario(),input=parseChangeSet(f.input),plan=planChangeSet(input,{...emptyChangeSetApproval(),storyboard:true,scenes:true,blocking:true},f.state,allocationFor(input),new Map(),f.proofs),preview:any={version:1,changeSet:input,plan};
 const scope={...emptyMcpScopeV2(),projectIds:[f.projectId],blockingSceneIds:[f.parent.id],fullPromptSceneIds:[f.parent.id],assetIds:f.state.assets.map(a=>a.id),variantIds:f.state.variants.map(v=>v.id),includeCharacterIdentity:true,includeAssetText:true,includeNotes:true,includeMediaFilenames:true};
 const result=blockingMcpPreview(preview,scope,f.state)[0];expect(result.outputDisclosure).toBe('shared');expect(result.canonicalOutputs).toEqual((plan.operations[0].resolved as any).blocking.canonicalOutputs);
 expect(blockingMcpPreview(preview,{...scope,includeCharacterIdentity:false},f.state)[0]).toMatchObject({outputDisclosure:'withheld',missingDisclosures:['includeCharacterIdentity']});
 f.parent.outputs.full='界'.repeat(200000);await expect(readMcpTool('krakinai_get_generation_prompt',{sceneId:f.parent.id},scope,f.state)).rejects.toMatchObject({code:'PAYLOAD_TOO_LARGE'});
});
