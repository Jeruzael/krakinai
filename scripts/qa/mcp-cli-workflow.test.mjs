import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRevisionWorkflow } from './mcp-cli-workflow.mjs';

// Unit-only protocol fixtures. Real certification uses actual CLI replies.
const projectId='synthetic-midori',excludedProjectId='synthetic-other',digest='a'.repeat(64),approved='b'.repeat(64);
const changeSet={changeSetId:'synthetic-revision',operations:[{type:'scene.revise',operationId:'revise05',clientRef:'revision',sceneId:'old-scene',project:{id:projectId}}]};
const receipt=()=>({changeSetId:changeSet.changeSetId,packageDigest:digest,approvedDigest:approved,idMappings:{revision:{kind:'scene',id:'new-scene'}},operations:[{operationId:'revise05',recordId:'new-scene'}]});
const proposal=status=>({proposalId:'actual-proposal',changeSetId:changeSet.changeSetId,packageDigest:digest,status});
const message=(index,payload)=>({role:'tool',tool_call_id:`synthetic_cli_read_${index+1}`,content:JSON.stringify({isError:!payload.ok,content:[{type:'text',text:JSON.stringify(payload)}]})});
const ok=data=>({ok:true,data});
const fixture=()=>[
  message(0,ok({connected:true,projectIds:[projectId],allowProposals:true})),
  message(1,ok(proposal('review_required'))),
  message(2,ok({...proposal('applied'),receipt:receipt()})),
  message(3,ok(receipt())),
  message(4,ok(proposal('applied'))),
  message(5,ok({connected:false})),
  message(6,{ok:false,error:{code:'PAIRING_REQUIRED'}}),
  message(7,{ok:false,error:{code:'PAIRING_REQUIRED'}}),
  message(8,{ok:false,error:{code:'PAIRING_REQUIRED'}}),
];
const scenario=onReply=>createRevisionWorkflow({projectId,excludedProjectId,changeSet,onReply:onReply??(async()=>{})});
async function drive(messages){const s=scenario();await s.consume([]);for(let i=1;i<=messages.length;i++)await s.consume(messages.slice(0,i));return s.summary();}

test('validates every named actual-call slot, receipt and revocation before completion',async()=>{
  const result=await drive(fixture());assert.equal(result.workflowVerified,true);assert.equal(result.sceneId,'new-scene');assert.equal(result.callAudit.length,9);assert.deepEqual(result.callAudit.map(c=>c.ok),[true,true,true,true,true,true,false,false,false]);
});
test('an earlier failed submit is not rescued by later successful status and receipt',async()=>{
  const values=fixture();values[1]=message(1,{ok:false,error:{code:'TOOL_TIMEOUT'}});await assert.rejects(drive(values),/krakinai_submit_change_set/);
});
test('rejects a proposal status that is not applied',async()=>{
  const values=fixture();values[2]=message(2,ok({...proposal('review_required'),receipt:receipt()}));await assert.rejects(drive(values),/applied/);
});
test('rejects changed proposal IDs on an identical retry',async()=>{
  const values=fixture();values[4]=message(4,ok({...proposal('applied'),proposalId:'fabricated-later-id'}));await assert.rejects(drive(values),/proposal ID changed/);
});
test('receipt operation IDs must agree with the confirmed new scene mapping',async()=>{
  const values=fixture(),wrong=receipt();wrong.operations[0].recordId='other-scene';values[2]=message(2,ok({...proposal('applied'),receipt:wrong}));await assert.rejects(drive(values),/saved ID mismatch/);
});
test('explicit receipt must equal the confirmed status receipt',async()=>{
  const values=fixture();values[3]=message(3,ok({...receipt(),approvedDigest:'c'.repeat(64)}));await assert.rejects(drive(values),/Confirmed receipt differs/);
});
test('a timeout is not evidence of permission revocation',async()=>{
  const values=fixture();values[6]=message(6,{ok:false,error:{code:'TOOL_TIMEOUT'}});await assert.rejects(drive(values),/Wrong revocation error/);
});
test('a successful stale read after disconnect is rejected',async()=>{
  const values=fixture();values[6]=message(6,ok({id:projectId}));await assert.rejects(drive(values),/Disconnected call must fail/);
});
test('revoked read, status and submit errors must not contain even selected-project data',async()=>{
  for(const index of [6,7,8]){const values=fixture();values[index]=message(index,{ok:false,error:{code:'PAIRING_REQUIRED'},data:{projectId,privatePrompt:'must not leak'}});await assert.rejects(drive(values),/disconnected error envelope/i);}
});
test('revoked errors must not hide data in additional error details',async()=>{
  const values=fixture();values[7]=message(7,{ok:false,error:{code:'PAIRING_REQUIRED',details:{privatePrompt:'must not leak'}}});await assert.rejects(drive(values),/disconnected error fields/i);
});
test('excluded-project disclosure is rejected in a denied response as well',async()=>{
  const values=fixture();values[8]=message(8,{ok:false,error:{code:'PAIRING_REQUIRED',message:excludedProjectId}});await assert.rejects(drive(values),/Unselected project/);
});
test('allowed denial fields cannot hide structured data or unsanitized messages',async()=>{
  const payloads=[{ok:false,error:{code:'PAIRING_REQUIRED',message:{privatePrompt:'leak'}}},{ok:false,error:{code:'PAIRING_REQUIRED',retryable:{privatePrompt:'leak'}}},{ok:false,error:{code:'PAIRING_REQUIRED'},apiVersion:{privatePrompt:'leak'}},{ok:false,error:{code:'PAIRING_REQUIRED',message:'private prompt hidden in error text'}}];
  for(const payload of payloads){const values=fixture();values[8]=message(8,payload);await assert.rejects(drive(values),/denial (message|retryable|version)/i);}
});
test('duplicate or substituted call IDs cannot satisfy another tool',async()=>{
  const values=fixture();values[1].tool_call_id=values[0].tool_call_id;await assert.rejects(drive(values),/correlat/);
});
test('later model requests cannot silently replace earlier actual tool replies',async()=>{
  const s=scenario(),values=fixture();await s.consume([]);await s.consume(values.slice(0,1));const altered=structuredClone(values.slice(0,2));altered[0]=message(0,ok({connected:true,projectIds:[excludedProjectId],allowProposals:true}));await assert.rejects(s.consume(altered),/Earlier actual CLI reply changed/);
});
test('fabricated assistant success JSON is not a tool response',async()=>{
  const values=fixture();values[1].role='assistant';await assert.rejects(drive(values),/correlat/);
});
test('a final success string cannot complete a truncated workflow',async()=>{
  const s=scenario(),values=fixture();await s.consume([]);await s.consume(values.slice(0,1));assert.throws(()=>s.summary(),/before every actual call/);
});
