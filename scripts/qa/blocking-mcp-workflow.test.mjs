import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlockingWorkflow} from './blocking-mcp-workflow.mjs';
const options=()=>({target:{projectId:'synthetic-project',sceneId:'synthetic-parent',shotId:'shot09'},changeSet:{schema:'krakinai.change-set.v5',changeSetId:'synthetic-blocking',operations:[{operationId:'turn',type:'scene.revise_recipe',clientRef:'new-turn',sceneId:'synthetic-parent',expectedSourceRevision:1,expectedSourceRecipeDigest:'a'.repeat(64),expectedBlockingDigest:'b'.repeat(64),project:{id:'synthetic-project',expectedRevision:1},shot:{id:'shot09'}}]},baseline:{sourceSceneIds:['synthetic-parent']},onReply:async()=>{}});
const status={apiVersion:'krakinai.mcp.v1',ok:true,data:{connected:true,scopeVersion:2,projectIds:['synthetic-project'],blockingSceneIds:['synthetic-parent'],allowBlockingProposals:false,automaticApplication:false}};
test('rejects swapped, skipped, duplicate and unrequested actual call IDs',async()=>{
 for(const callId of ['unrequested-call','synthetic_cli_read_2']){const w=createBlockingWorkflow(options());await assert.rejects(()=>w.accept({callId,tool:'krakinai_connection_status',message:status}));assert.throws(()=>w.summary());}
 const w=createBlockingWorkflow(options());await w.accept({callId:'synthetic_cli_read_1',tool:'krakinai_connection_status',message:status});await assert.rejects(()=>w.accept({callId:'synthetic_cli_read_1',tool:'krakinai_connection_status',message:status}));
});
test('never accepts prose or a later success as evidence for an earlier error',async()=>{
 const w=createBlockingWorkflow(options());await assert.rejects(()=>w.accept({callId:'synthetic_cli_read_1',tool:'krakinai_connection_status',message:'Success: connected and imported'}));await assert.rejects(()=>w.accept({callId:'synthetic_cli_read_1',tool:'krakinai_connection_status',message:{apiVersion:'krakinai.mcp.v1',ok:false,error:{code:'AUTH_FAILED',message:'success'}}}));await assert.rejects(()=>w.accept({callId:'synthetic_cli_read_2',tool:'krakinai_get_scene',message:status}));
});
test('rejects wrong tool, omitted failures, incomplete receipts and changed historical responses',async()=>{
 const w=createBlockingWorkflow(options());await assert.rejects(()=>w.accept({callId:'synthetic_cli_read_1',tool:'krakinai_get_scene',message:status}));await w.accept({callId:'synthetic_cli_read_1',tool:'krakinai_connection_status',message:status});
 await assert.rejects(()=>w.consume([{role:'tool',tool_call_id:'synthetic_cli_read_1',content:JSON.stringify({...status,data:{...status.data,connected:false}})},{role:'tool',tool_call_id:'synthetic_cli_read_2',content:JSON.stringify(status)}]));assert.throws(()=>w.summary());
 const bad=createBlockingWorkflow(options());await assert.rejects(()=>bad.accept({callId:'synthetic_cli_read_8',tool:'krakinai_get_proposal_status',message:{apiVersion:'krakinai.mcp.v1',ok:true,data:{status:'applied',receipt:{version:2}}}}));
});
const reply=data=>({apiVersion:'krakinai.mcp.v1',ok:true,data});
const proposal={changeSetId:'synthetic-blocking',proposalId:'proposal-one',packageDigest:'c'.repeat(64)};
async function throughPending(){
 const w=createBlockingWorkflow(options()),op=options().changeSet.operations[0],messages=[status,reply({id:'synthetic-parent',expectedSourceRevision:1,expectedSourceRecipeDigest:op.expectedSourceRecipeDigest,expectedBlockingDigest:op.expectedBlockingDigest,blocking:{disclosure:'shared',plan:{version:1}}}),{apiVersion:'krakinai.mcp.v1',ok:false,error:{code:'PERMISSION_DENIED'}},reply({...status.data,allowBlockingProposals:true}),reply({changeSetId:'synthetic-blocking',operationCount:1,reviewRequired:true,blocking:[{operationId:'turn',sourceSceneId:'synthetic-parent',outputDisclosure:'withheld',changedPaths:[{path:'blocking.participants'}]}]}),reply({...proposal,status:'review_required'}),reply({...proposal,status:'review_required',previewIsSnapshot:true,blocking:[{sourceSceneId:'synthetic-parent'}]})];
 for(let i=0;i<messages.length;i++)await w.accept({callId:'synthetic_cli_read_'+(i+1),tool:w.plan[i].suffix,message:messages[i]});return w;
}
const receipt=()=>({version:2,changeSetSchema:'krakinai.change-set.v5',changeSetId:proposal.changeSetId,packageDigest:proposal.packageDigest,approvedDigest:'d'.repeat(64),idMappings:{'new-turn':{kind:'scene',id:'synthetic-new'}},operations:[{operationId:'turn',type:'scene.revise_recipe',recordId:'synthetic-new',status:'created'}],projectRevisions:{'synthetic-project':{before:1,after:2}},scenes:[{id:'synthetic-new',available:true}]});
test('rejects malformed receipts at the actual expected receipt-bearing step',async()=>{
 for(const invalid of [{version:2},{...receipt(),version:1},{...receipt(),operations:[]},{...receipt(),scenes:[]},{...receipt(),idMappings:{'new-turn':{kind:'scene',id:'synthetic-parent'}}},{...receipt(),reviewedContent:'PRIVATE_CONTENT'}]){
  const w=await throughPending();await assert.rejects(()=>w.accept({callId:'synthetic_cli_read_8',tool:'krakinai_get_proposal_status',message:reply({...proposal,status:'applied',receipt:invalid})}));assert.throws(()=>w.summary());
 }
});
test('requires all fifteen correlated responses including denial and revocation, with argument/response hashes',async()=>{
 const w=await throughPending(),saved=receipt(),responses=[reply({...proposal,status:'applied',receipt:saved}),reply(saved),reply({...proposal,status:'applied'}),reply({id:'synthetic-new',blocking:{disclosure:'withheld'}}),{apiVersion:'krakinai.mcp.v1',ok:false,error:{code:'PERMISSION_DENIED'}},reply({connected:false}),{apiVersion:'krakinai.mcp.v1',ok:false,error:{code:'PAIRING_REQUIRED'}},{apiVersion:'krakinai.mcp.v1',ok:false,error:{code:'PAIRING_REQUIRED'}}];
 for(let i=0;i<responses.length;i++){const index=i+7;await w.accept({callId:'synthetic_cli_read_'+(index+1),tool:w.plan[index].suffix,message:responses[i]});}
 const result=w.summary();assert.equal(result.callAudit.length,15);assert.equal(result.revoked,true);assert(result.callAudit.every(c=>/^[a-f0-9]{64}$/.test(c.argumentsSha256)&&/^[a-f0-9]{64}$/.test(c.replySha256)));
});
