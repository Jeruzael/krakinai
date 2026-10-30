import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCliResults } from './mcp-codex-cli.mjs';

const project = { projectId: 'synthetic-selected', projectName: 'MIDORI', excludedProjectId: 'synthetic-private' };
const plan = ['krakinai_connection_status', 'krakinai_list_projects', 'krakinai_get_project'].map(suffix => ({ suffix }));
const message = (index, payload) => ({ role: 'tool', tool_call_id: `synthetic_cli_read_${index + 1}`, content: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(payload) }], isError: false }) });
const success = () => [message(0, { ok: true, data: { connected: true, projectIds: [project.projectId] } }), message(1, { ok: true, data: { items: [{ id: project.projectId, name: project.projectName }], nextCursor: null } }), message(2, { ok: true, data: { id: project.projectId, name: project.projectName } })];

test('accepts correlated successful status/list/project MCP replies', () => {
  assert.deepEqual(analyzeCliResults(success(), plan, project), { connectedTrue: true, connectedFalse: false, projectListMatches: true, projectReadMatches: true, foreignProjectAbsent: true });
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
