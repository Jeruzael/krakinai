import{test}from'node:test';
import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{createRecipeWorkflow}from'./mcp-recipe-workflow.mjs';
// Protocol unit fixtures only. Certification never uses these fabricated replies.
const sha=s=>createHash('sha256').update(s).digest('hex'),projectId='synthetic-project',excludedProjectId='synthetic-excluded',durations=[6,7,7,8,8,7,7,6,7,7];
const input=()=>({schema:'krakinai.change-set.v4',changeSetId:'original-package',operations:[{type:'asset.propose',operationId:'camera-candidate',clientRef:'camera',kind:'camera',title:'Synthetic missing camera'},{type:'variant.propose',operationId:'outfit-candidate',clientRef:'outfit'},...durations.map((n,i)=>({type:'scene.convert_direct_to_recipe',operationId:'convert-'+i,clientRef:'recipe-'+i,sceneId:'old-'+i,expectedHeadId:'old-'+i,project:{id:projectId},shot:{id:'shot-'+i},settings:{aspectRatio:'9:16',durationSeconds:n},conversion:{sourceTextSha256:sha('source '+i)}}))]});
const ok=data=>({ok:true,data}),message=(i,data)=>({role:'tool',tool_call_id:`synthetic_cli_read_${i+1}`,content:JSON.stringify({isError:!data.ok,content:[{type:'text',text:JSON.stringify(data)}]})});
function protocol(){
 let main=input(),revision,selection,preview={},receipts={};const original=structuredClone(main),proposals={};
 const onReply=async({step,reply})=>{
  if(step==='submitted-original'){main={...main,changeSetId:'edited-package'};return{replacementChangeSet:main}}
  if(step==='applied-main'){revision={schema:main.schema,changeSetId:'revision-package',operations:[{type:'scene.revise_recipe',operationId:'revise',clientRef:'revision',sceneId:reply.data.receipt.idMappings['recipe-4'].id,expectedHeadId:reply.data.receipt.idMappings['recipe-4'].id,project:{id:projectId},shot:{id:'shot-4'}}]};return{revisionChangeSet:revision}}
  if(step==='receipt-revision'){selection={schema:main.schema,changeSetId:'select-package',operations:[{type:'shot.select_take',operationId:'select',project:{id:projectId},shot:{id:'shot-4'},scene:{id:reply.data.idMappings.revision.id}}]};return{selectionChangeSet:selection}}
 };
 const scenario=createRecipeWorkflow({projectId,excludedProjectId,changeSet:original,onReply});
 const packet=(pkg,status)=>({proposalId:'proposal-'+pkg.changeSetId,changeSetId:pkg.changeSetId,packageDigest:sha(pkg.changeSetId),status});
 const receipt=pkg=>{
  const mappings=Object.fromEntries(pkg.operations.filter(o=>o.clientRef).map(o=>[o.clientRef,o.type.startsWith('scene.')?{kind:'scene',id:'new-'+o.clientRef}:o.type.startsWith('variant.')?{kind:'variant_candidate',id:'candidate-'+o.clientRef,variantId:'new-'+o.clientRef}:{kind:'candidate',id:'candidate-'+o.clientRef,assetId:'new-'+o.clientRef}]));
  return{changeSetId:pkg.changeSetId,packageDigest:sha(pkg.changeSetId),approvedDigest:sha('approved-'+pkg.changeSetId),idMappings:mappings,operations:pkg.operations.map(o=>({operationId:o.operationId,type:o.type,recordId:o.clientRef?mappings[o.clientRef].id:o.scene.id,...(o.type==='asset.propose'?{status:'asset_created'}:o.type==='variant.propose'?{status:'variant_created'}:{})})),scenes:Object.values(mappings).filter(m=>m.kind==='scene').map(m=>({id:m.id,available:true,rootSceneId:m.id,sequence:1}))};
 };
 const response=(tool,args)=>{
  const step=tool.step;
  if(step==='connected')return ok({connected:true,projectIds:[projectId],allowProposals:true});
  if(step==='projects')return ok({items:[{id:projectId}],nextCursor:null});
  if(step==='project')return ok({id:projectId,shotCount:10});
  if(step==='storyboard')return ok({projectId,items:durations.map((n,i)=>({id:'shot-'+i,plannedDurationSeconds:n})),nextCursor:null});
  if(step.startsWith('source-')){const i=Number(step.slice(7));return ok({id:'old-'+i,expectedHeadId:'old-'+i,authoringMode:'direct_prompt',fullPrompt:'source '+i,sourceTextSha256:sha('source '+i)})}
  if(step==='assets'||step==='variants')return ok({items:[{id:'stored-'+step}],nextCursor:null});
  if(step==='shot-types')return ok({items:[{type:'character_scene'},{type:'graphic_motion'}]});
  if(step.startsWith('preview-'))return ok({conversions:main.operations.filter(o=>o.type==='scene.convert_direct_to_recipe').map(o=>({operationId:o.operationId,readiness:'blocked'}))});
  if(step.startsWith('submitted-')){const pkg=args.changeSet;proposals[pkg.changeSetId]=packet(pkg,'review_required');return ok(proposals[pkg.changeSetId])}
  if(step==='rejected-original')return ok(packet(original,'rejected'));
  if(step==='ready-main'){preview=Object.fromEntries(main.operations.filter(o=>o.type==='scene.convert_direct_to_recipe').map(o=>[o.operationId,{full:'FULL '+o.clientRef,structured:'STRUCTURED '+o.clientRef,compact:'COMPACT '+o.clientRef}]));return ok({...packet(main,'review_required'),conversions:Object.entries(preview).map(([operationId,outputs])=>({operationId,readiness:'ready',outputDisclosure:'shared',outputs}))})}
  if(step.startsWith('applied-')){const pkg=step.endsWith('main')?main:step.endsWith('revision')?revision:selection;receipts[pkg.changeSetId]=receipt(pkg);return ok({...packet(pkg,'applied'),receipt:receipts[pkg.changeSetId]})}
  if(step.startsWith('receipt-'))return ok(receipts[args.changeSetId]);
  if(step==='retried-main')return ok(packet(main,'applied'));
  if(step==='new-metadata')return ok({id:args.sceneId});
  if(step==='new-full-denied')return{ok:false,error:{code:'PERMISSION_DENIED'}};
  if(step==='new-asset-denied')return ok({items:[],nextCursor:null});
  if(step==='new-full-shared')return ok({id:args.sceneId,fullPrompt:preview[main.operations.filter(o=>o.type==='scene.convert_direct_to_recipe')[4].operationId].full});
  if(step==='library-updated')return ok({items:[{id:'new-camera',expectedRevision:2,promptText:'LIBRARY_ONLY_B3_REVISION'}],nextCursor:null});
  if(step==='disconnected')return ok({connected:false});
  if(step.endsWith('-denied'))return{ok:false,error:{code:'PAIRING_REQUIRED'}};
  throw Error('Unknown unit fixture step '+step);
 };
 return{scenario,response};
}
async function drive(mutate){const f=protocol(),messages=[];await f.scenario.consume([]);for(let i=0;i<f.scenario.plan.length;i++){const tool=f.scenario.plan[i],args=typeof tool.args==='function'?tool.args():tool.args;let value=f.response(tool,args);if(mutate)value=mutate(tool.step,value)??value;messages.push(message(i,value));await f.scenario.consume(messages)}return f.scenario.summary()}
test('requires the complete live-read, supersede, ten-conversion, revision, selection and revocation workflow',async()=>{const s=await drive();assert.equal(s.workflowVerified,true);assert.equal(s.convertedSceneIds.length,10);assert.equal(s.callAudit.length,41);assert.equal(s.revoked,true);assert.equal(new Set(s.callAudit.map(c=>c.callId)).size,41)});
for(const step of['submitted-original','submitted-main','ready-main','applied-main','receipt-main','retried-main','submitted-revision','receipt-selection'])test(`rejects failure at ${step} even if later fixture replies would succeed`,async()=>{await assert.rejects(drive((s,v)=>s===step?{ok:false,error:{code:'SYNTHETIC_FAILURE'}}:v))});
test('rejects a partial ten-scene receipt',async()=>{await assert.rejects(drive((s,v)=>{if(s==='applied-main')delete v.data.receipt.idMappings['recipe-9'];return v}))});
test('requires actual created asset/Outfit IDs rather than treating candidate IDs as saved reusable records',async()=>{for(const field of['assetId','variantId'])await assert.rejects(drive((s,v)=>{if(s==='applied-main')delete v.data.receipt.idMappings[field==='assetId'?'camera':'outfit'][field];return v}))});
test('rejects missing, wrong-ID, duplicate and reordered actual tool messages',async()=>{
 for(const kind of['missing','wrong-id','duplicate','reordered','assistant-string']){const f=protocol(),messages=[message(0,f.response(f.scenario.plan[0],{}))];await f.scenario.consume(messages);messages.push(message(1,f.response(f.scenario.plan[1],{})));if(kind==='missing')messages.pop();if(kind==='wrong-id')messages[1].tool_call_id='other';if(kind==='duplicate')messages[1].tool_call_id=messages[0].tool_call_id;if(kind==='reordered')messages.reverse();if(kind==='assistant-string')messages[1]={role:'assistant',content:'Everything succeeded'};await assert.rejects(f.scenario.consume(messages))}
});
test('does not accept altered historical replies',async()=>{const f=protocol(),first=message(0,f.response(f.scenario.plan[0],{}));await f.scenario.consume([first]);await assert.rejects(f.scenario.consume([message(0,ok({connected:false})),message(1,f.response(f.scenario.plan[1],{}))]))});
test('rejects source-text hash substitution, output truncation and unselected data',async()=>{
 for(const kind of['hash','truncated','foreign'])await assert.rejects(drive((s,v)=>{if(kind==='hash'&&s==='source-0')v.data.sourceTextSha256='0'.repeat(64);if(kind==='truncated'&&s==='ready-main')delete v.data.conversions[0].outputs.compact;if(kind==='foreign'&&s==='project')v.data.private=excludedProjectId;return v}));
});
test('does not mistake a rate-limit error for permission revocation',async()=>{await assert.rejects(drive((s,v)=>s==='read-denied'?{ok:false,error:{code:'RATE_LIMITED'}}:v))});
