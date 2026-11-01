import { validateCliToolCalls } from './mcp-cli-replies.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCliResults,createCliWorkflow } from './mcp-codex-cli.mjs';
import * as cliModule from './mcp-codex-cli.mjs';
import { resolve } from 'node:path';

test('launcher CLI certification uses only the production adapter and the explicitly scoped origin',()=>{
 const settings={formatVersion:1,appOrigin:'http://localhost:4173',relayPort:54184,bridgeDirectory:resolve('qa-results/reviewed/bridge')},path=resolve('qa-results/private/settings.json');
 const launch=cliModule.resolveCliLaunch({appOrigin:settings.appOrigin,port:1,launcher:{settings,path}});
 assert.equal(launch.entry,resolve(settings.bridgeDirectory,'krakinai-stdio-adapter.mjs'));assert.deepEqual(launch.args,[launch.entry,'--config',path]);assert.equal(launch.port,54184);
 assert.throws(()=>cliModule.resolveCliLaunch({appOrigin:'http://127.0.0.1:4173',port:1,launcher:{settings,path}}));
 assert.throws(()=>cliModule.resolveCliLaunch({appOrigin:settings.appOrigin,port:1,launcher:{settings:{...settings,relayPort:0},path}}));
 const direct=cliModule.resolveCliLaunch({appOrigin:settings.appOrigin,port:4199});assert.deepEqual(direct.args,[direct.entry,'--app-origin',settings.appOrigin,'--port','4199']);
});

const project = { projectId: 'synthetic-selected', projectName: 'MIDORI', excludedProjectId: 'synthetic-private' };
const plan = ['krakinai_connection_status', 'krakinai_list_projects', 'krakinai_get_project'].map(suffix => ({ suffix }));
const message = (index, payload) => ({ role: 'tool', tool_call_id: `synthetic_cli_read_${index + 1}`, content: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(payload) }], isError: false }) });
const success = () => [message(0, { ok: true, data: { connected: true, projectIds: [project.projectId] } }), message(1, { ok: true, data: { items: [{ id: project.projectId, name: project.projectName }], nextCursor: null } }), message(2, { ok: true, data: { id: project.projectId, name: project.projectName } })];
test('routes the new recipe scenario explicitly while preserving the strict legacy revision scenario',()=>{
 const context={projectId:project.projectId,excludedProjectId:project.excludedProjectId},onReply=async()=>{},changeSet={schema:'krakinai.change-set.v4',operations:[{type:'asset.propose',kind:'camera',title:'Synthetic camera'},{type:'variant.propose'},...[6,7,7,8,8,7,7,6,7,7].map((n,i)=>({type:'scene.convert_direct_to_recipe',sceneId:'old-'+i,project:{id:project.projectId},settings:{aspectRatio:'9:16',durationSeconds:n}}))]};
 assert.equal(createCliWorkflow({...context,workflow:{kind:'recipe_conversion',changeSet,onReply}}).plan.length,41);
 const legacy={changeSetId:'legacy',operations:[{type:'scene.revise',sceneId:'old',project:{id:project.projectId}}]};assert.equal(createCliWorkflow({...context,workflow:{changeSet:legacy,onReply}}).plan.length,9);assert.throws(()=>createCliWorkflow({...context,workflow:{changeSet,onReply}}));assert.throws(()=>createCliWorkflow({...context,workflow:{kind:'unknown',changeSet,onReply}}));
});

test('accepts correlated successful status/list/project MCP replies', () => {
  assert.deepEqual(analyzeCliResults(success(), plan, project), { connectedTrue: true, connectedFalse: false, projectListMatches: true, projectReadMatches: true, foreignProjectAbsent: true });
});
test('rejects a CLI truncation marker even when the clipped payload happens to remain valid JSON',()=>{
 const messages=success();messages[0]=message(0,{ok:true,data:{connected:true,projectIds:[project.projectId],notice:'\u202676020 chars truncated\u2026'}});assert.throws(()=>analyzeCliResults(messages,plan,project),/truncat/i);
});
test('keeps actual unpaired status certification supported', () => {
  assert.equal(analyzeCliResults([message(0, { ok: true, data: { connected: false } })], plan.slice(0, 1)).connectedFalse, true);
});
test('rejects a timed-out listing even when status and final project succeed', () => {
  const input=success();input[1]=message(1,{ok:false,error:{code:'TOOL_TIMEOUT'}});
  assert.throws(()=>analyzeCliResults(input,plan,project),/krakinai_list_projects/);
});
test('rejects an empty successful listing', () => {
  const input=success();input[1]=message(1,{ok:true,data:{items:[],nextCursor:null}});
  assert.throws(()=>analyzeCliResults(input,plan,project),/project list/);
});
test('rejects an additional unselected project', () => {
  const input=success();input[1]=message(1,{ok:true,data:{items:[{id:project.projectId,name:project.projectName},{id:project.excludedProjectId,name:'Private'}],nextCursor:null}});
  assert.throws(()=>analyzeCliResults(input,plan,project),/project list/);
});
test('rejects a failed final project read', () => {
  const input=success();input[2]=message(2,{ok:false,error:{code:'PERMISSION_DENIED'}});
  assert.throws(()=>analyzeCliResults(input,plan,project),/krakinai_get_project/);
});
test('rejects replies that cannot be correlated with the emitted call IDs', () => {
  const input=success();input[1].tool_call_id='wrong-call';
  assert.throws(()=>analyzeCliResults(input,plan,project),/correlat/);
});

const emitted=[{id:'synthetic_cli_read_1',name:'mcp__krakinai__krakinai_get_project',args:{projectId:'synthetic-selected'}}];
const echoed=()=>[{role:'assistant',tool_calls:emitted.map(e=>({id:e.id,type:'function',function:{name:e.name,arguments:JSON.stringify(e.args)}}))}];
test('correlates actual CLI function-call names and arguments, separately from reply validation',()=>{const audit=validateCliToolCalls(echoed(),emitted);assert.equal(audit[0].callId,emitted[0].id);assert.match(audit[0].argumentsSha256,/^[a-f0-9]{64}$/)});
test('rejects missing/duplicated/wrong-ID/wrong-tool/altered-argument actual CLI calls',()=>{
 for(const mutate of[m=>m[0].tool_calls.pop(),m=>m[0].tool_calls.push(m[0].tool_calls[0]),m=>m[0].tool_calls[0].id='wrong',m=>m[0].tool_calls[0].function.name='other_tool',m=>m[0].tool_calls[0].function.arguments='{"projectId":"foreign"}']){const m=echoed();mutate(m);assert.throws(()=>validateCliToolCalls(m,emitted))}
});
