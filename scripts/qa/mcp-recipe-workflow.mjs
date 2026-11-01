import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{readCliReply}from'./mcp-cli-replies.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const clone=value=>structuredClone(value);
const conversions=input=>input.operations.filter(o=>o.type==='scene.convert_direct_to_recipe');
/** Actual CLI replies only. UI callbacks operate solely on owned synthetic profiles. */
export function createRecipeWorkflow({projectId,excludedProjectId,changeSet,onReply}){
 const original=clone(changeSet),sourceOps=conversions(original),camera=original.operations.find(o=>o.type==='asset.propose'&&o.kind==='camera');
 assert.equal(original.schema,'krakinai.change-set.v4');assert.equal(sourceOps.length,10);assert(camera);assert(original.operations.some(o=>o.type==='variant.propose'));assert.equal(typeof onReply,'function');assert(excludedProjectId&&excludedProjectId!==projectId);
 assert.equal(new Set(sourceOps.map(o=>o.sceneId)).size,10);assert(sourceOps.every(o=>o.project.id===projectId&&o.settings.aspectRatio==='9:16'));assert.equal(sourceOps.reduce((n,o)=>n+o.settings.durationSeconds,0),70);
 let main,revision,selection,originalProposal,mainProposal,revisionProposal,selectionProposal,mainReceipt,revisionReceipt,selectionReceipt,readyOutputs;
 const replies=[],audit=[],started=Date.now();
 const revisedSource=()=>mainReceipt.idMappings[sourceOps[4].clientRef].id;
 const call=(step,suffix,args,error)=>({step,suffix,args,...(error?{error}:{})});
 const plan=[
  call('connected','krakinai_connection_status',{}),call('projects','krakinai_list_projects',{}),call('project','krakinai_get_project',{projectId}),call('storyboard','krakinai_get_storyboard',{projectId,limit:20}),
  ...sourceOps.map((op,i)=>call('source-'+i,'krakinai_get_scene',{sceneId:op.sceneId})),
  call('assets','krakinai_search_assets',{query:'',kind:'asset',limit:50}),call('variants','krakinai_search_assets',{query:'',kind:'variant',limit:50}),call('shot-types','krakinai_get_shot_types',{}),
  call('preview-original','krakinai_preview_change_set',()=>({changeSet:clone(original)})),call('submitted-original','krakinai_submit_change_set',()=>({changeSet:clone(original)})),call('rejected-original','krakinai_get_proposal_status',()=>({proposalId:originalProposal.proposalId})),
  call('preview-main','krakinai_preview_change_set',()=>({changeSet:clone(main)})),call('submitted-main','krakinai_submit_change_set',()=>({changeSet:clone(main)})),call('ready-main','krakinai_get_proposal_status',()=>({proposalId:mainProposal.proposalId})),call('applied-main','krakinai_get_proposal_status',()=>({proposalId:mainProposal.proposalId})),call('receipt-main','krakinai_get_import_receipt',()=>({changeSetId:main.changeSetId,packageDigest:mainProposal.packageDigest})),call('retried-main','krakinai_submit_change_set',()=>({changeSet:clone(main)})),
  call('new-metadata','krakinai_get_scene',()=>({sceneId:revisedSource()})),call('new-full-denied','krakinai_get_generation_prompt',()=>({sceneId:revisedSource()}),'PERMISSION_DENIED'),call('new-asset-denied','krakinai_search_assets',{query:camera.title,kind:'asset'}),call('new-full-shared','krakinai_get_scene',()=>({sceneId:revisedSource()})),
  call('submitted-revision','krakinai_submit_change_set',()=>({changeSet:clone(revision)})),call('applied-revision','krakinai_get_proposal_status',()=>({proposalId:revisionProposal.proposalId})),call('receipt-revision','krakinai_get_import_receipt',()=>({changeSetId:revision.changeSetId,packageDigest:revisionProposal.packageDigest})),call('library-updated','krakinai_search_assets',{query:camera.title,kind:'asset'}),
  call('submitted-selection','krakinai_submit_change_set',()=>({changeSet:clone(selection)})),call('applied-selection','krakinai_get_proposal_status',()=>({proposalId:selectionProposal.proposalId})),call('receipt-selection','krakinai_get_import_receipt',()=>({changeSetId:selection.changeSetId,packageDigest:selectionProposal.packageDigest})),
  call('disconnected','krakinai_connection_status',{}),call('read-denied','krakinai_get_project',{projectId},'PAIRING_REQUIRED'),call('proposal-denied','krakinai_get_proposal_status',()=>({proposalId:mainProposal.proposalId}),'PAIRING_REQUIRED'),call('submit-denied','krakinai_submit_change_set',()=>({changeSet:clone(main)}),'PAIRING_REQUIRED'),
 ];
 function packet(data,pkg,expected,status){
  assert.equal(data.changeSetId,pkg.changeSetId);assert.equal(data.status,status);assert.match(data.packageDigest,/^[a-f0-9]{64}$/i);assert(data.proposalId);
  if(expected){assert.equal(data.proposalId,expected.proposalId);assert.equal(data.packageDigest,expected.packageDigest)}
 }
 function receipt(value,pkg,proposal){
  assert.equal(value.changeSetId,pkg.changeSetId);assert.equal(value.packageDigest,proposal.packageDigest);assert.match(value.approvedDigest,/^[a-f0-9]{64}$/i);assert.equal(value.operations.length,pkg.operations.length);
  const newIds=[];for(const op of pkg.operations){const records=value.operations.filter(r=>r.operationId===op.operationId);assert.equal(records.length,1);assert.equal(records[0].type,op.type);assert(records[0].recordId);if(op.clientRef){const m=value.idMappings[op.clientRef];assert(m?.id);assert.equal(records[0].recordId,m.id);assert.equal(m.kind,op.type.startsWith('scene.')?'scene':op.type.startsWith('variant.')?'variant_candidate':'candidate');if(m.kind==='candidate'){assert(m.assetId);assert.notEqual(m.assetId,m.id);assert.equal(records[0].status,'asset_created')}if(m.kind==='variant_candidate'){assert(m.variantId);assert.notEqual(m.variantId,m.id);assert.equal(records[0].status,'variant_created')}if(m.kind==='scene'){assert(!sourceOps.some(s=>s.sceneId===m.id));newIds.push(m.id)}}}
  assert.equal(new Set(newIds).size,newIds.length);
  for(const id of newIds)assert(value.scenes.some(s=>s.id===id&&s.available===true),'Receipt lacks an actually available new scene');
  if(pkg===main)assert.equal(newIds.length,10);
 }
 function validate(tool,value){
  assert(!JSON.stringify(value).includes(excludedProjectId),'Excluded project reached CLI');assert(!JSON.stringify(value).includes('PRIVATE_B3_NOTES'),'Private notes reached CLI');
  if(tool.error){assert.equal(value.ok,false);assert.equal(value.error?.code,tool.error);assert(Object.keys(value).every(k=>['ok','error','apiVersion'].includes(k)));return}
  assert.equal(value.ok,true,tool.step+' failed');const d=value.data;assert(d);
  const s=tool.step;
  if(s==='connected'){assert.equal(d.connected,true);assert.deepEqual(d.projectIds,[projectId]);assert.equal(d.allowProposals,true)}
  else if(s==='projects'){assert.deepEqual(d.items.map(p=>p.id),[projectId]);assert.equal(d.nextCursor,null)}
  else if(s==='project'){assert.equal(d.id,projectId);assert.equal(d.shotCount,10)}
  else if(s==='storyboard'){assert.equal(d.projectId,projectId);assert.equal(d.items.length,10);assert.equal(d.items.reduce((n,o)=>n+o.plannedDurationSeconds,0),70);assert.equal(d.nextCursor,null);assert.deepEqual(d.items.map(o=>o.id),sourceOps.map(o=>o.shot.id))}
  else if(s.startsWith('source-')){const op=sourceOps[Number(s.slice(7))];assert.equal(d.id,op.sceneId);assert.equal(d.expectedHeadId,op.expectedHeadId);assert.equal(typeof d.fullPrompt,'string');assert.equal(hash(d.fullPrompt),d.sourceTextSha256);assert.equal(d.sourceTextSha256,op.conversion.sourceTextSha256)}
  else if(s==='assets'||s==='variants'){assert(d.items.length>0);assert.equal(d.nextCursor,null)}
  else if(s==='shot-types')assert(d.items.some(t=>t.type==='character_scene')&&d.items.some(t=>t.type==='graphic_motion'));
  else if(s.startsWith('preview-')){assert.equal(d.conversions.length,10);assert.deepEqual(d.conversions.map(c=>c.operationId),sourceOps.map(o=>o.operationId))}
  else if(s==='submitted-original'){packet(d,original,undefined,'review_required');originalProposal=clone(d)}
  else if(s==='rejected-original'){packet(d,original,originalProposal,'rejected');assert.equal(d.receipt,undefined)}
  else if(s==='submitted-main'){packet(d,main,undefined,'review_required');assert.notEqual(d.proposalId,originalProposal.proposalId);mainProposal=clone(d)}
  else if(s==='ready-main'){
   packet(d,main,mainProposal,'review_required');assert.equal(d.conversions.length,10);readyOutputs={};
   for(const op of conversions(main)){const matches=d.conversions.filter(c=>c.operationId===op.operationId);assert.equal(matches.length,1);const c=matches[0];assert(['ready','assembled_pending'].includes(c.readiness));assert.equal(c.outputDisclosure,'shared');for(const k of['full','structured','compact'])assert.equal(typeof c.outputs?.[k],'string');assert(Object.values(c.outputs).every(v=>v.length>0));readyOutputs[op.operationId]=clone(c.outputs)}
  }else if(s==='applied-main'){packet(d,main,mainProposal,'applied');receipt(d.receipt,main,mainProposal);mainReceipt=clone(d.receipt)}
  else if(s==='receipt-main'){receipt(d,main,mainProposal);assert.deepEqual(d,mainReceipt)}
  else if(s==='retried-main')packet(d,main,mainProposal,'applied');
  else if(s==='new-metadata'){assert.equal(d.id,revisedSource());assert.equal(d.fullPrompt,undefined)}
  else if(s==='new-asset-denied'){assert.deepEqual(d.items,[]);assert.equal(d.nextCursor,null)}
  else if(s==='new-full-shared'){assert.equal(d.id,revisedSource());assert.equal(d.fullPrompt,readyOutputs[conversions(main)[4].operationId].full)}
  else if(s==='submitted-revision'){packet(d,revision,undefined,'review_required');revisionProposal=clone(d)}
  else if(s==='applied-revision'){packet(d,revision,revisionProposal,'applied');receipt(d.receipt,revision,revisionProposal);revisionReceipt=clone(d.receipt)}
  else if(s==='receipt-revision'){receipt(d,revision,revisionProposal);assert.deepEqual(d,revisionReceipt)}
  else if(s==='library-updated'){assert.equal(d.items.length,1);assert.equal(d.items[0].id,mainReceipt.idMappings[camera.clientRef].assetId);assert.equal(d.items[0].expectedRevision,2);assert(JSON.stringify(d.items[0]).includes('LIBRARY_ONLY_B3_REVISION'))}
  else if(s==='submitted-selection'){packet(d,selection,undefined,'review_required');selectionProposal=clone(d)}
  else if(s==='applied-selection'){packet(d,selection,selectionProposal,'applied');receipt(d.receipt,selection,selectionProposal);selectionReceipt=clone(d.receipt)}
  else if(s==='receipt-selection'){receipt(d,selection,selectionProposal);assert.deepEqual(d,selectionReceipt)}
  else if(s==='disconnected'){assert.equal(d.connected,false);assert.equal(Object.hasOwn(d,'projectIds'),false)}
  else assert.fail('Unvalidated tool step '+s);
 }
 return{plan,
  async consume(messages){
   if(!messages.length){assert.equal(replies.length,0);return}assert.equal(messages.length,replies.length+1,'Exactly one new correlated reply is required');
   for(let i=0;i<messages.length;i++){
    const tool=plan[i],callId='synthetic_cli_read_'+(i+1);assert(tool);assert.equal(messages[i].tool_call_id,callId,'Actual CLI reply order/ID changed');
    const value=readCliReply(messages,callId,tool.suffix,{allowError:!!tool.error});
    if(i<replies.length){assert.deepEqual(value,replies[i],'Historical actual CLI reply changed');continue}
    validate(tool,value);replies.push(clone(value));audit.push({callId,step:tool.step,tool:tool.suffix,ok:value.ok,errorCode:value.error?.code??null,replySha256:hash(JSON.stringify(value)),elapsedMs:Date.now()-started});
    const observed=await onReply({step:tool.step,callId,reply:clone(value)});
    if(tool.step==='submitted-original'){main=clone(observed?.replacementChangeSet);assert(main&&main.changeSetId!==original.changeSetId);assert.deepEqual(conversions(main).map(o=>o.sceneId),sourceOps.map(o=>o.sceneId))}
    if(tool.step==='applied-main'){revision=clone(observed?.revisionChangeSet);assert.equal(revision?.operations.length,1);assert.equal(revision.operations[0].type,'scene.revise_recipe');assert.equal(revision.operations[0].sceneId,revisedSource());assert.equal(revision.operations[0].project.id,projectId)}
    if(tool.step==='receipt-revision'){selection=clone(observed?.selectionChangeSet);assert.equal(selection?.operations.length,1);assert.equal(selection.operations[0].type,'shot.select_take');assert.equal(selection.operations[0].project.id,projectId)}
   }
  },
  summary(){assert.equal(replies.length,plan.length,'Incomplete actual CLI workflow');return{workflowVerified:true,originalProposalId:originalProposal.proposalId,rejectedOriginal:true,proposalId:mainProposal.proposalId,changeSetId:main.changeSetId,packageDigest:mainProposal.packageDigest,approvedDigest:mainReceipt.approvedDigest,convertedSceneIds:conversions(main).map(o=>mainReceipt.idMappings[o.clientRef].id),readyOutputSha256:Object.fromEntries(Object.entries(readyOutputs).map(([id,modes])=>[id,Object.fromEntries(Object.entries(modes).map(([mode,text])=>[mode,hash(text)]))])),revisionSceneId:revisionReceipt.idMappings[revision.operations[0].clientRef].id,selectionChangeSetId:selection.changeSetId,revoked:true,callAudit:clone(audit)}}
 };
}
