import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {createSharedWorkflow,assertSyntheticTarget} from './shared-mcp-workflow.mjs';

// Unit-only fixtures. They never certify an installed client or browser.
const root=resolve('qa-results/shared-mcp-unit'),origin='http://localhost:5183';
const target=()=>({syntheticOnly:true,origin,workspaceRoot:root,profilePath:resolve(root,'fresh-profile')});
const projectId='synthetic-midori',excludedProjectId='synthetic-excluded',projectName='Synthetic MIDORI',digest='a'.repeat(64);
const changeSet={changeSetId:'synthetic-shared-revision',operations:[{operationId:'revision',clientRef:'revision',type:'scene.revise',sceneId:'old',project:{id:projectId}}]};
const receipt={changeSetId:changeSet.changeSetId,packageDigest:digest,approvedDigest:'b'.repeat(64),idMappings:{revision:{kind:'scene',id:'new'}},operations:[{operationId:'revision',recordId:'new'}]};
const baseline={syntheticOnly:true,origin,assets:[{id:'asset'}],variants:[],scenes:[{id:'old',outputs:{full:'immutable'}}],collections:[{id:projectId,project:{shots:[{id:'shot',selectedSceneId:'old',takeSceneIds:['old']}]}}],media:[{id:'media',sha256:'c'.repeat(64)}],drafts:[],templates:[],preferences:{aiImports:{receipts:[]}}};
const after=()=>{const value=structuredClone(baseline);value.scenes.push({id:'new',sceneRevision:{parentSceneId:'old'},outputs:{full:'new text'}});value.collections[0].project.shots[0].takeSceneIds.push('new');value.preferences.aiImports.receipts.push(receipt);return value;};
const ok=data=>({ok:true,data}),denied=code=>({ok:false,error:{code}});
const proposal=status=>({proposalId:'proposal',changeSetId:changeSet.changeSetId,packageDigest:digest,status});
function scenario(){return createSharedWorkflow({target:target(),projectId,projectName,excludedProjectId,changeSet,baseline,onReply:async()=>{}});}
function fixtures(s){return s.plan.map(p=>({client:p.client,callId:p.callId,tool:p.suffix,message:{role:'tool',tool_call_id:p.callId,content:JSON.stringify({content:[{type:'text',text:JSON.stringify((()=>{
 if(p.step==='scope-denied')return denied('PERMISSION_DENIED');
 if(p.step.endsWith('-denied'))return denied('PAIRING_REQUIRED');
 return ok(p.step==='connected'?{connected:true,projectIds:[projectId],allowProposals:true}:p.step==='project-list'?{items:[{id:projectId,name:projectName}],nextCursor:null}:p.step==='project-read'?{id:projectId,name:projectName}:p.step==='submitted'?proposal('review_required'):p.step==='applied'?{...proposal('applied'),receipt}:p.step==='receipt'?receipt:p.step==='retried'?proposal('applied'):{connected:false});
 })())}]})}}));}
function observations(s){
 for(const stage of ['submitted','preview','reviewed'])s.observe(stage,baseline);
 s.observe('applied',after());s.observe('retried',after());
 s.membership('shared',{clients:3,bridge:'running',browser:'paired',generation:'old'});
 s.membership('one-left',{clients:2,bridge:'running',browser:'paired',generation:'old'});
 s.membership('browser-disconnected',{clients:2,bridge:'running',browser:'not-paired',generation:'old'});
 s.membership('last-client-lost',{before:{clients:1,bridge:'running',browser:'paired',generation:'repaired'},after:{clients:0,bridge:'stopped',browser:'not-paired',generation:'none'}});
}
async function drive(change){const s=scenario(),values=fixtures(s);change?.(values,s);for(const value of values)await s.consume(value);observations(s);return s.summary();}
test('validates cross-client responses, immutable save evidence, replay and both revocation cases',async()=>{
 const result=await drive();assert.equal(result.workflowVerified,true);assert.equal(result.callAudit.length,12);assert.equal(result.sceneId,'new');assert.equal(result.desktopVerified,false);
});
test('requires exact client, tool and actual call ID for every reply',async()=>{
 for(const field of ['client','callId','tool'])await assert.rejects(drive(values=>{values[1][field]='wrong'}));
 await assert.rejects(drive(values=>{values[1].message.tool_call_id=values[0].callId}));
});
test('cannot substitute a later success for an earlier failed submission',async()=>{
 await assert.rejects(drive(values=>{const submitted=values.find(v=>v.tool==='krakinai_submit_change_set');submitted.message.content=JSON.stringify(denied('TOOL_TIMEOUT'));}));
});
test('assistant success strings and duplicated responses are rejected',async()=>{
 await assert.rejects(drive(values=>{values[0].message.role='assistant'}));
 await assert.rejects(drive(values=>{values.splice(1,0,structuredClone(values[0]));}));
});
test('does not certify an incomplete workflow or omit browser/last-client evidence',async()=>{
 const s=scenario();await s.consume(fixtures(s)[0]);assert.throws(()=>s.summary());
 const complete=scenario();for(const v of fixtures(complete))await complete.consume(v);assert.throws(()=>complete.summary(),/evidence/i);
});
test('rejects preapproval writes, old-scene changes, preferred-take changes and changed hashes',()=>{
 for(const stage of ['submitted','preview','reviewed']){const s=scenario(),changed=structuredClone(baseline);changed.scenes[0].outputs.full='changed';assert.throws(()=>s.observe(stage,changed));}
 for(const mutate of [v=>{v.scenes[0].outputs.full='changed'},v=>{v.collections[0].project.shots[0].selectedSceneId='new'},v=>{v.media[0].sha256='d'.repeat(64)}]){const s=scenario(),changed=after();mutate(changed);assert.throws(()=>s.observe('applied',changed));}
});
test('accepts the first actual import when preferences have no aiImports ledger yet',()=>{
 const initial=structuredClone(baseline);delete initial.preferences.aiImports;
 const s=createSharedWorkflow({target:target(),projectId,projectName,excludedProjectId,changeSet,baseline:initial,onReply:async()=>{}});
 for(const stage of ['submitted','preview','reviewed'])s.observe(stage,initial);
 assert.doesNotThrow(()=>s.observe('applied',after()));
 const missingReceipt=after();delete missingReceipt.preferences.aiImports;
 const invalid=createSharedWorkflow({target:target(),projectId,projectName,excludedProjectId,changeSet,baseline:initial,onReply:async()=>{}});
 assert.throws(()=>invalid.observe('applied',missingReceipt));
});
test('a client leaving cannot revoke surviving clients, and last-client loss must revoke paired access',()=>{
 const s=scenario();s.membership('shared',{clients:3,bridge:'running',browser:'paired',generation:'g'});
 assert.throws(()=>s.membership('one-left',{clients:2,bridge:'stopped',browser:'not-paired',generation:'none'}));
 assert.throws(()=>s.membership('last-client-lost',{before:{clients:1,bridge:'running',browser:'not-paired',generation:'g'},after:{clients:0,bridge:'stopped',browser:'not-paired',generation:'none'}}));
});
test('never accepts the real application origin or an unrelated browser profile',()=>{
 assert.doesNotThrow(()=>assertSyntheticTarget(target()));
 for(const changed of [{origin:'http://localhost:5173'},{syntheticOnly:false},{profilePath:resolve(root,'..','real-profile')},{origin:'https://example.com'}])assert.throws(()=>assertSyntheticTarget({...target(),...changed}));
});
