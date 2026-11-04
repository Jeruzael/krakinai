import {it,expect} from 'vitest';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {previewChangeSet} from '../storage/changeSets';
import {ProposalBroker} from '../connections/proposalBroker';
import {emptyMcpScopeV3} from '../domain/mcpScope';
import {MCP_KEYFRAME_CAPABILITIES} from '../domain/mcpCapabilities';
it('reports a batch blocker on preview, submission and status even when frame derivation succeeds',async()=>{
 const f=await seedKeyframeStorage(),preview=await previewChangeSet(f.input,f.approval);
 preview.plan.findings.push({code:'LEDGER_CAPACITY',severity:'blocking',message:'PRIVATE_HISTORY_CANARY'});
 const scope={...emptyMcpScopeV3(),projectIds:[f.projectId],assetIds:f.state.assets.map(a=>a.id),variantIds:f.state.variants.map(v=>v.id),blockingSceneIds:[f.parent.id],keyframeSceneIds:[f.parent.id],includeCharacterIdentity:true,includeAssetText:true,includeNotes:true,includeMediaFilenames:true,allowProposals:true,allowBlockingProposals:true,allowKeyframeProposals:true,allowImagePromptDerivation:true};
 const broker=new ProposalBroker({readState:async()=>f.state,preview:async()=>preview});broker.connect('synthetic-capacity',scope,undefined,MCP_KEYFRAME_CAPABILITIES);
 const first:any=await broker.handle({requestId:'capacity-preview',tool:'krakinai_preview_change_set',args:{changeSet:f.input,projection:{operationId:'revise',keyframeId:'middle',mode:'full'}}},'synthetic-capacity');
 expect(first.ok).toBe(true);expect(first.data.keyframes.frame.disclosure).toBe('shared');expect(first.data.batchChecks).toMatchObject({version:1,readiness:'blocked',findings:[{code:'LEDGER_CAPACITY',severity:'blocking'}]});
 const submitted:any=await broker.handle({requestId:'capacity-submit',tool:'krakinai_submit_change_set',args:{changeSet:f.input}},'synthetic-capacity');expect(submitted.ok).toBe(true);expect(submitted.data.batchChecks.readiness).toBe('blocked');
 const status:any=await broker.handle({requestId:'capacity-status',tool:'krakinai_get_proposal_status',args:{proposalId:submitted.data.proposalId}},'synthetic-capacity');expect(status.data.batchChecks.readiness).toBe('blocked');
 const projection=JSON.stringify([first.data.batchChecks,submitted.data.batchChecks,status.data.batchChecks]);for(const hidden of ['PRIVATE_HISTORY_CANARY','storedBytes','expandedBytes','receipts','comparison','reviewedEvidence'])expect(projection).not.toContain(hidden);
 broker.disconnect();const denied:any=await broker.handle({requestId:'capacity-revoked',tool:'krakinai_get_proposal_status',args:{proposalId:submitted.data.proposalId}},'synthetic-capacity');expect(denied.ok).toBe(false);
});
