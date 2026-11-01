import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readCliReply } from './mcp-cli-replies.mjs';

export function createRevisionWorkflow({ projectId, excludedProjectId, projectName, scopedReads = false, changeSet, onReply }) {
  const input=structuredClone(changeSet),op=input?.operations?.[0];
  assert(input?.operations?.length===1&&op.type==='scene.revise'&&op.project.id===projectId,'Workflow requires one scoped scene revision');
  assert(typeof excludedProjectId==='string'&&excludedProjectId&&typeof onReply==='function','Workflow needs an excluded project and browser observer');
  assert(!scopedReads||(typeof projectName==='string'&&projectName),'Scoped reads require the selected synthetic project name');
  const replies=[],audit=[];let submitted,receipt;
  const plan=[
    {step:'connected',suffix:'krakinai_connection_status',args:{}},
    ...(scopedReads?[
      {step:'project-list',suffix:'krakinai_list_projects',args:{}},
      {step:'project-read',suffix:'krakinai_get_project',args:{projectId}},
    ]:[]),
    {step:'submitted',suffix:'krakinai_submit_change_set',args:()=>({changeSet:structuredClone(input)})},
    {step:'applied',suffix:'krakinai_get_proposal_status',args:()=>({proposalId:submitted.proposalId})},
    {step:'receipt',suffix:'krakinai_get_import_receipt',args:()=>({changeSetId:input.changeSetId,packageDigest:submitted.packageDigest})},
    {step:'retried',suffix:'krakinai_submit_change_set',args:()=>({changeSet:structuredClone(input)})},
    {step:'disconnected',suffix:'krakinai_connection_status',args:{}},
    {step:'read-denied',suffix:'krakinai_get_project',args:{projectId}},
    {step:'proposal-denied',suffix:'krakinai_get_proposal_status',args:()=>({proposalId:submitted.proposalId})},
    {step:'submit-denied',suffix:'krakinai_submit_change_set',args:()=>({changeSet:structuredClone(input)})},
  ];
  function checkReceipt(value) {
    assert.equal(value.changeSetId,input.changeSetId,'Receipt change-set ID mismatch');
    assert.equal(value.packageDigest,submitted.packageDigest,'Receipt digest mismatch');
    assert.match(value.approvedDigest,/^[a-f0-9]{64}$/i,'Missing approved digest');
    const mapping=value.idMappings?.[op.clientRef];
    assert(mapping?.kind==='scene'&&typeof mapping.id==='string'&&mapping.id&&mapping.id!==op.sceneId,'Receipt must identify a new immutable scene');
    assert.equal(value.operations.length,1,'Unexpected receipt operation count');
    assert.equal(value.operations[0].operationId,op.operationId,'Receipt operation mismatch');
    assert.equal(value.operations[0].recordId,mapping.id,'Receipt saved ID mismatch');
  }
  function validate(index,value) {
    const step=plan[index].step;
    assert(!JSON.stringify(value).includes(excludedProjectId),'Unselected project reached actual CLI');
    if(step==='read-denied'||step==='proposal-denied'||step==='submit-denied'){
      assert.equal(value.ok,false,'Disconnected call must fail');assert.equal(value.error?.code,'PAIRING_REQUIRED','Wrong revocation error');
      assert(Object.keys(value).every(k=>['ok','error','apiVersion'].includes(k)),'Unexpected disconnected error envelope');
      assert(Object.keys(value.error).every(k=>['code','message','retryable'].includes(k)),'Unexpected disconnected error fields');
      if(Object.hasOwn(value,'apiVersion'))assert.equal(value.apiVersion,'krakinai.mcp.v1','Unexpected denial version');
      if(Object.hasOwn(value.error,'message'))assert.equal(value.error.message,'Connect and approve permissions in KRAKINAI first.','Unexpected denial message');
      if(Object.hasOwn(value.error,'retryable'))assert.equal(typeof value.error.retryable,'boolean','Unexpected denial retryable type');
      return;
    }
    assert.equal(value.ok,true,`${plan[index].suffix} must succeed`);const data=value.data;assert(data,'Missing actual tool data');
    if(step==='connected'){
      assert.equal(data.connected,true);assert.deepEqual(data.projectIds,[projectId],'Unexpected project permissions');assert.equal(data.allowProposals,true);
    }else if(step==='project-list'){
      assert(Array.isArray(data.items)&&data.items.length===1&&data.items[0].id===projectId&&data.items[0].name===projectName&&data.nextCursor===null,'Unexpected selected project list');
    }else if(step==='project-read'){
      assert.equal(data.id,projectId,'Unexpected selected project read ID');assert.equal(data.name,projectName,'Unexpected selected project read name');
    }else if(step==='submitted'){
      assert.equal(data.changeSetId,input.changeSetId);assert.equal(data.status,'review_required');assert(typeof data.proposalId==='string'&&data.proposalId);assert.match(data.packageDigest,/^[a-f0-9]{64}$/i);submitted=structuredClone(data);
    }else if(step==='applied'||step==='retried'){
      assert.equal(data.proposalId,submitted.proposalId,'Retry/status proposal ID changed');assert.equal(data.changeSetId,input.changeSetId);assert.equal(data.packageDigest,submitted.packageDigest);assert.equal(data.status,'applied');
      if(step==='applied'){checkReceipt(data.receipt);receipt=structuredClone(data.receipt);}
    }else if(step==='receipt'){
      checkReceipt(data);assert.deepEqual(data,receipt,'Confirmed receipt differs from proposal receipt');
    }else if(step==='disconnected'){
      assert.equal(data.connected,false,'Permissions must be revoked before the next call');assert.equal(Object.hasOwn(data,'projectIds'),false,'Disconnected response exposed old scope');
    }
  }
  return {
    plan,
    async consume(messages) {
      if(!messages.length){assert.equal(replies.length,0);return;}
      assert.equal(messages.length,replies.length+1,'Expected one new correlated actual tool reply');
      for(let index=0;index<messages.length;index++){
        const tool=plan[index];assert(tool,'Unexpected tool response');
        const reply=readCliReply(messages,`synthetic_cli_read_${index+1}`,tool.suffix,{allowError:tool.step.endsWith('-denied')});
        if(index<replies.length)assert.deepEqual(reply,replies[index],'Earlier actual CLI reply changed');
        else{
          validate(index,reply);replies.push(structuredClone(reply));
          audit.push({callId:`synthetic_cli_read_${index+1}`,tool:tool.suffix,ok:reply.ok,errorCode:reply.error?.code??null,replySha256:createHash('sha256').update(JSON.stringify(reply)).digest('hex')});
          await onReply({step:tool.step,reply:structuredClone(reply)});
        }
      }
    },
    summary() {
      assert.equal(replies.length,plan.length,'Workflow ended before every actual call was validated');
      return {workflowVerified:true,scopedReadsVerified:scopedReads,proposalId:submitted.proposalId,changeSetId:input.changeSetId,packageDigest:submitted.packageDigest,sceneId:receipt.idMappings[op.clientRef].id,approvedDigest:receipt.approvedDigest,revoked:true,callAudit:structuredClone(audit)};
    },
  };
}
