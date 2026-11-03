import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readCliReply} from './mcp-cli-replies.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex'),clone=value=>structuredClone(value);
/** Finite actual-response verifier. A success string or a different call can never discharge a failed step. */
export function createBlockingWorkflow({target,changeSet,baseline,onReply}){
 assert(target?.projectId&&target.sceneId&&target.shotId);assert.equal(changeSet.schema,'krakinai.change-set.v5');assert.equal(changeSet.operations.length,1);assert.equal(typeof onReply,'function');
 const input=clone(changeSet),op=input.operations[0];assert.equal(op.type,'scene.revise_recipe');assert.equal(op.sceneId,target.sceneId);assert.equal(op.project.id,target.projectId);assert.equal(op.shot.id,target.shotId);
 const oldIds=new Set(baseline.sourceSceneIds??[target.sceneId]),replies=[],audit=[],started=Date.now();let proposal,receipt;
 const call=(step,suffix,args,error)=>({step,suffix,args,...(error?{error}:{})});
 const plan=[call('connected','krakinai_connection_status',{}),call('source','krakinai_get_scene',{sceneId:target.sceneId}),call('permission-denied','krakinai_submit_change_set',{changeSet:input},'PERMISSION_DENIED'),call('permissions-enabled','krakinai_connection_status',{}),call('preview','krakinai_preview_change_set',{changeSet:input}),call('submitted','krakinai_submit_change_set',{changeSet:input}),call('pending','krakinai_get_proposal_status',()=>({proposalId:proposal.proposalId})),call('applied','krakinai_get_proposal_status',()=>({proposalId:proposal.proposalId})),call('receipt','krakinai_get_import_receipt',()=>({changeSetId:input.changeSetId,packageDigest:proposal.packageDigest})),call('retried','krakinai_submit_change_set',{changeSet:input}),call('new-metadata','krakinai_get_scene',()=>({sceneId:receipt.idMappings[op.clientRef].id})),call('new-full-denied','krakinai_get_generation_prompt',()=>({sceneId:receipt.idMappings[op.clientRef].id}),'PERMISSION_DENIED'),call('disconnected','krakinai_connection_status',{}),call('read-denied','krakinai_get_scene',{sceneId:target.sceneId},'PAIRING_REQUIRED'),call('submit-denied','krakinai_submit_change_set',{changeSet:input},'PAIRING_REQUIRED')];
 function packet(data,status){assert.equal(data.changeSetId,input.changeSetId);assert.equal(data.status,status);assert.match(data.packageDigest,/^[a-f0-9]{64}$/);assert.equal(typeof data.proposalId,'string');if(proposal){assert.equal(data.proposalId,proposal.proposalId);assert.equal(data.packageDigest,proposal.packageDigest);}}
 function checkedReceipt(value){
  assert(value);assert.equal(value.version,2);assert.equal(value.changeSetSchema,'krakinai.change-set.v5');assert.equal(value.changeSetId,input.changeSetId);assert.equal(value.packageDigest,proposal.packageDigest);assert.match(value.approvedDigest,/^[a-f0-9]{64}$/);assert.equal(value.operations.length,1);
  const mapping=value.idMappings?.[op.clientRef],result=value.operations[0];assert.equal(mapping?.kind,'scene');assert.equal(typeof mapping.id,'string');assert(!oldIds.has(mapping.id));assert.equal(result.operationId,op.operationId);assert.equal(result.type,op.type);assert.equal(result.recordId,mapping.id);assert.equal(result.status,'created');assert(value.scenes.some(s=>s.id===mapping.id&&s.available===true));assert.deepEqual(value.projectRevisions[target.projectId],{before:op.project.expectedRevision,after:op.project.expectedRevision+1});
  assert.equal(value.reviewedContent,undefined,'Private browser review evidence reached CLI');return value;
 }
 function validate(tool,message){
  assert(message&&typeof message==='object'&&!Array.isArray(message),'Actual protocol response required');assert.equal(message.apiVersion,'krakinai.mcp.v1');
  for(const canary of baseline.excludedCanaries??[])assert(!JSON.stringify(message).includes(canary),'Excluded data reached actual CLI');
  if(tool.error){assert.equal(message.ok,false);assert.equal(message.error?.code,tool.error);return;}
  assert.equal(message.ok,true,tool.step+' did not succeed');const data=message.data;assert(data&&typeof data==='object');
  if(tool.step==='connected'||tool.step==='permissions-enabled'){assert.equal(data.connected,true);assert.equal(data.scopeVersion,2);assert.deepEqual(data.projectIds,[target.projectId]);assert.deepEqual(data.blockingSceneIds,[target.sceneId]);assert.equal(data.allowBlockingProposals,tool.step==='permissions-enabled');assert.equal(data.automaticApplication,false);}
  else if(tool.step==='source'){assert.equal(data.id,target.sceneId);assert.equal(data.expectedSourceRevision,op.expectedSourceRevision);assert.equal(data.expectedSourceRecipeDigest,op.expectedSourceRecipeDigest);assert.equal(data.expectedBlockingDigest,op.expectedBlockingDigest);assert.equal(data.blocking?.disclosure,'shared');assert.equal(data.blocking?.plan?.version,1);assert.equal(data.fullPrompt,undefined);}
  else if(tool.step==='preview'){assert.equal(data.changeSetId,input.changeSetId);assert.equal(data.operationCount,1);assert.equal(data.reviewRequired,true);assert.equal(data.blocking?.length,1);assert.equal(data.blocking[0].operationId,op.operationId);assert.equal(data.blocking[0].sourceSceneId,target.sceneId);assert.equal(data.blocking[0].outputDisclosure,'withheld');assert.equal(data.blocking[0].canonicalOutputs,undefined);assert(data.blocking[0].changedPaths.length>0);}
  else if(tool.step==='submitted'){packet(data,'review_required');proposal=clone(data);}
  else if(tool.step==='pending'){packet(data,'review_required');assert.equal(data.previewIsSnapshot,true);assert.equal(data.blocking?.[0]?.sourceSceneId,target.sceneId);assert.equal(data.receipt,undefined);}
  else if(tool.step==='applied'){packet(data,'applied');receipt=clone(checkedReceipt(data.receipt));}
  else if(tool.step==='receipt')assert.deepEqual(checkedReceipt(data),receipt);
  else if(tool.step==='retried')packet(data,'applied');
  else if(tool.step==='new-metadata'){assert.equal(data.id,receipt.idMappings[op.clientRef].id);assert.equal(data.blocking?.disclosure,'withheld');assert.equal(data.fullPrompt,undefined);assert.equal(data.expectedSourceRecipeDigest,undefined);}
  else if(tool.step==='disconnected'){assert.equal(data.connected,false);assert.equal(data.projectIds,undefined);}
  else assert.fail('Unvalidated actual Blocking step '+tool.step);
 }
 const api={plan,
  async accept({callId,tool,message}){
   const index=replies.length,next=plan[index];assert(next,'Unexpected extra actual reply');assert.equal(callId,'synthetic_cli_read_'+(index+1),'Actual reply call ID/order mismatch');assert.equal(tool,next.suffix,'Actual reply tool mismatch');validate(next,message);
   const args=typeof next.args==='function'?next.args():next.args;replies.push(clone(message));audit.push({callId,step:next.step,tool,ok:message.ok,errorCode:message.error?.code??null,argumentsSha256:hash(JSON.stringify(args)),replySha256:hash(JSON.stringify(message)),elapsedMs:Date.now()-started});
   await onReply({step:next.step,callId,tool,message:clone(message),reply:clone(message)});
  },
  async consume(messages){
   if(!messages.length){assert.equal(replies.length,0);return;}assert.equal(messages.length,replies.length+1,'Exactly one new actual CLI reply required');
   for(let i=0;i<messages.length;i++){const tool=plan[i];assert(tool);const callId='synthetic_cli_read_'+(i+1);assert.equal(messages[i].tool_call_id,callId);const message=readCliReply(messages,callId,tool.suffix,{allowError:!!tool.error});if(i<replies.length)assert.deepEqual(message,replies[i],'Historical actual response changed');else await api.accept({callId,tool:tool.suffix,message});}
  },
  summary(){assert.equal(replies.length,plan.length,'Incomplete actual Blocking workflow');return{workflowVerified:true,changeSetId:input.changeSetId,proposalId:proposal.proposalId,packageDigest:proposal.packageDigest,approvedDigest:receipt.approvedDigest,newSceneIds:[receipt.idMappings[op.clientRef].id],revoked:true,callAudit:clone(audit)};},
 };
 return api;
}
