// Actual installed-client orchestration. The caller observes an owned synthetic browser
// through its real controls. This module never pairs, reveals keys or approves a write.
import assert from 'node:assert/strict';
import {createSharedWorkflow} from './shared-mcp-workflow.mjs';
import {startInstalledCodexClient} from './shared-codex-client.mjs';

export async function certifySharedInstalledClients({executable,directory,target,launcherConfig,baseline,projectId,projectName,excludedProjectId,changeSet,onPhase}) {
  assert.equal(typeof onPhase,'function','Explicit native/browser observation required');
  let client,workflow;
  workflow=createSharedWorkflow({target,projectId,projectName,excludedProjectId,changeSet,baseline,onReply:async({step,reply})=>{
    if(step==='submitted'){
      // The proposal must remain reviewable after its originating chat leaves.
      await client.closeThread('alpha');
      const evidence=await onPhase('review-and-apply',{proposal:structuredClone(reply),target});
      workflow.membership('one-left',evidence.native);
      for(const stage of ['submitted','preview','reviewed','applied'])workflow.observe(stage,evidence.snapshots[stage]);
    }
    if(step==='retried'){
      const evidence=await onPhase('verify-replay-and-disconnect',{reply:structuredClone(reply),target});
      workflow.observe('retried',evidence.snapshot);workflow.membership('browser-disconnected',evidence.native);
    }
  }});
  const actualCalls=[];
  try {
    client=await startInstalledCodexClient({executable,directory,target,launcherConfig});
    for(const label of ['alpha','beta','gamma'])await client.startThread(label);
    const paired=await onPhase('pair-browser',{target,metadata:client.metadata});
    assert.deepEqual(paired.snapshot,baseline,'Synthetic library changed during pairing');workflow.membership('shared',paired.native);
    for(const step of workflow.plan){
      const args=typeof step.args==='function'?step.args():step.args;
      const record=await client.invoke(step.client,step.suffix,args,step.callId);
      actualCalls.push(structuredClone(record));await workflow.consume(record);
      // Preserve the production relay's burst/minute limits across all clients.
      await new Promise(resolve=>setTimeout(resolve,2100));
    }
    // A second deliberate native pairing tests last-client loss while actually paired,
    // independently of the earlier explicit browser Disconnect.
    await onPhase('pair-again-for-last-client-loss',{target});
    await client.closeThread('beta');
    const before=await onPhase('observe-last-client-before',{target});
    await client.closeThread('gamma');
    const after=await onPhase('observe-last-client-after',{target});
    workflow.membership('last-client-lost',{before,after});
    return{...workflow.summary(),installedClient:client.summary(),actualCalls};
  }finally{await client?.close();}
}
