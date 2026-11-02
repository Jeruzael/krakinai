import assert from 'node:assert/strict';
import {relative,resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {createRevisionWorkflow} from './mcp-cli-workflow.mjs';
import {readCliReply} from './mcp-cli-replies.mjs';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function assertSyntheticTarget(target) {
  assert.equal(target?.syntheticOnly,true,'Only explicitly synthetic profiles are allowed');
  const url=new URL(target.origin);
  assert.equal(url.origin,target.origin);assert.equal(url.protocol,'http:');
  assert(['localhost','127.0.0.1'].includes(url.hostname)&&url.port&&url.port!=='5173','Real/nonlocal application origin rejected');
  assert(isAbsolute(target.workspaceRoot)&&isAbsolute(target.profilePath),'Absolute owned QA paths required');
  const child=relative(resolve(target.workspaceRoot),resolve(target.profilePath));
  assert(child&&!isAbsolute(child)&&child!=='..'&&!child.startsWith('..\\')&&!child.startsWith('../'),'Unrelated browser profile rejected');
}

/** Validates actual, individually correlated replies; unit fixtures do not certify a client. */
export function createSharedWorkflow({target,projectId,projectName,excludedProjectId,changeSet,baseline,onReply}) {
  assertSyntheticTarget(target);assert.equal(baseline?.syntheticOnly,true);assert.equal(baseline.origin,target.origin);
  const initial=structuredClone(baseline),op=changeSet.operations[0],events=new Set(),members=new Set(),audit=[],baseMessages=[];
  const base=createRevisionWorkflow({projectId,projectName,excludedProjectId,changeSet,scopedReads:true,onReply});
  const clients=['alpha','beta','gamma','alpha','beta','gamma','beta','gamma','beta','gamma','beta'];
  const plan=base.plan.map((p,index)=>({...p,client:clients[index],callId:`synthetic_cli_read_${index+1}`}));
  plan.splice(3,0,{step:'scope-denied',suffix:'krakinai_get_project',args:{projectId:excludedProjectId},client:'gamma',callId:'shared_scope_denied'});
  let cursor=0,applied,shared;
  return {
    plan,
    async consume(record) {
      const expected=plan[cursor];assert(expected,'Unexpected extra actual reply');
      assert.equal(record.client,expected.client,'Wrong actual client');assert.equal(record.callId,expected.callId,'Wrong actual call ID');assert.equal(record.tool,expected.suffix,'Wrong actual tool');
      const value=readCliReply([record.message],expected.callId,expected.suffix,{allowError:expected.step==='scope-denied'||expected.step.endsWith('-denied')});
      if(expected.step==='scope-denied') {
        assert.equal(value.ok,false);assert.equal(value.error?.code,'PERMISSION_DENIED');
        assert(Object.keys(value).every(k=>['apiVersion','ok','error'].includes(k)),'Denied response leaked data');
        assert(!JSON.stringify(value).includes(excludedProjectId),'Excluded project leaked');
      } else { baseMessages.push(structuredClone(record.message));await base.consume(baseMessages); }
      audit.push({client:record.client,callId:record.callId,step:expected.step,tool:expected.suffix,ok:value.ok,errorCode:value.error?.code??null,replySha256:hash(value)});
      cursor++;
    },
    observe(stage,snapshot) {
      assert(['submitted','preview','reviewed','applied','retried'].includes(stage),'Unknown browser evidence stage');assert(!events.has(stage),'Duplicate browser evidence');
      if(['submitted','preview','reviewed'].includes(stage))assert.deepEqual(snapshot,initial,'Database changed before approval');
      if(stage==='applied') {
        assert.equal(snapshot.scenes.length,initial.scenes.length+1,'Expected exactly one immutable new scene');
        const oldIds=new Set(initial.scenes.map(s=>s.id)),created=snapshot.scenes.filter(s=>!oldIds.has(s.id));assert.equal(created.length,1);
        assert.deepEqual(snapshot.scenes.filter(s=>oldIds.has(s.id)),initial.scenes,'Old scenes changed');
        assert.equal(created[0].sceneRevision?.parentSceneId,op.sceneId,'Wrong revision parent');
        if(op.prompt?.text!==undefined)assert.equal(created[0].outputs.full,op.prompt.text,'Saved output bytes changed');
        for(const key of ['assets','variants','drafts','templates','media'])assert.deepEqual(snapshot[key],initial[key],`${key} changed`);
        assert.deepEqual(snapshot.collections.filter(p=>p.id!==projectId),initial.collections.filter(p=>p.id!==projectId),'Excluded collections changed');
        const before=initial.collections.find(p=>p.id===projectId),after=snapshot.collections.find(p=>p.id===projectId);assert(before&&after);
        assert.equal(after.project.shots.length,before.project.shots.length);
        for(const shot of before.project.shots) {
          const updated=after.project.shots.find(s=>s.id===shot.id);assert(updated,'Original shot missing');
          assert.equal(updated.selectedSceneId,shot.selectedSceneId,'Preferred take changed');
          const takeIds=updated.takeSceneIds.filter(id=>id!==created[0].id);
          assert.deepEqual(takeIds,shot.takeSceneIds,'Old takes changed');
          assert.deepEqual({...updated,takeSceneIds:shot.takeSceneIds},shot,'Shot metadata changed');
        }
        assert.equal(after.project.shots.filter(s=>s.takeSceneIds.includes(created[0].id)).length,1,'New take was not attached once');
        const receipts=snapshot.preferences.aiImports.receipts,originalReceipts=initial.preferences.aiImports?.receipts??[];
        const matches=receipts.filter(r=>r.changeSetId===changeSet.changeSetId);assert.equal(matches.length,1,'Receipt must be committed exactly once');
        assert.equal(matches[0].idMappings[op.clientRef].id,created[0].id,'Saved ID differs from confirmed receipt');
        assert.deepEqual(receipts.filter(r=>r.changeSetId!==changeSet.changeSetId),originalReceipts,'Old receipts changed');
        applied=structuredClone(snapshot);
      }
      if(stage==='retried'){assert(applied,'Missing approval evidence');assert.deepEqual(snapshot,applied,'Replay duplicated or changed saved records');}
      events.add(stage);
    },
    membership(stage,value) {
      assert(['shared','one-left','browser-disconnected','last-client-lost'].includes(stage));assert(!members.has(stage));
      if(stage==='shared'){assert.equal(value.clients,3);assert.equal(value.bridge,'running');assert.equal(value.browser,'paired');shared=structuredClone(value);}
      if(stage==='one-left'){assert(shared);assert.equal(value.clients,2);assert.equal(value.bridge,'running');assert.equal(value.browser,'paired');assert.equal(value.generation,shared.generation);}
      if(stage==='browser-disconnected'){assert(value.clients>0&&value.clients<=8);assert.equal(value.browser,'not-paired');}
      if(stage==='last-client-lost'){
        assert.equal(value.before.clients,1);assert.equal(value.before.bridge,'running');assert.equal(value.before.browser,'paired');
        assert.equal(value.after.clients,0);assert.equal(value.after.bridge,'stopped');assert.equal(value.after.browser,'not-paired');assert.notEqual(value.after.generation,value.before.generation);
      }
      members.add(stage);
    },
    summary() {
      assert.equal(cursor,plan.length,'Incomplete actual client calls');
      assert.equal(events.size,5,'Incomplete browser evidence');assert.equal(members.size,4,'Incomplete shared-client/revocation evidence');
      const result=base.summary();
      const stored=applied.preferences.aiImports.receipts.find(r=>r.changeSetId===changeSet.changeSetId);
      assert.equal(stored.idMappings[op.clientRef].id,result.sceneId);assert.equal(stored.packageDigest,result.packageDigest);assert.equal(stored.approvedDigest,result.approvedDigest);
      return {...result,desktopVerified:false,callAudit:structuredClone(audit),beforeSha256:hash(initial),afterSha256:hash(applied),oldSceneSha256:hash(initial.scenes),mediaSha256:hash(initial.media)};
    },
  };
}
