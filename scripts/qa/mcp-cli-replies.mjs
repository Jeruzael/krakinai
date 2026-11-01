import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
// Validate the function calls echoed by the installed CLI, not just our emitted fixture plan.
export function validateCliToolCalls(messages,expected){
 const calls=messages.filter(m=>m.role==='assistant').flatMap(m=>m.tool_calls??[]);
 assert.equal(calls.length,expected.length,'Actual CLI function-call count differs');
 return calls.map((call,i)=>{const wanted=expected[i];assert.equal(call.id,wanted.id);assert.equal(call.type,'function');assert.equal(call.function?.name,wanted.name);const args=JSON.parse(call.function.arguments);assert.deepEqual(args,wanted.args,'Actual CLI function-call arguments differ');return{callId:call.id,argumentsSha256:createHash('sha256').update(JSON.stringify(args)).digest('hex')}});
}
// Parse actual CLI tool messages only; assistant success text is never evidence.
export function readCliReply(messages, callId, tool, { allowError = false } = {}) {
  const matches = messages.filter(m => m.role === 'tool' && m.tool_call_id === callId);
  if (matches.length !== 1) throw new Error(`Cannot correlate ${tool} reply.`);
  let value = matches[0].content;
  for (let depth = 0; depth < 6; depth++) {
    if (typeof value === 'string') { if (/(?:\u2026|\\u2026)\d+ chars truncated(?:\u2026|\\u2026)/i.test(value)) throw new Error(`Truncated actual CLI reply for ${tool}.`); try { value = JSON.parse(value); } catch { throw new Error(`Invalid JSON reply for ${tool}.`); } continue; }
    if (Array.isArray(value) && value.length === 1 && value[0]?.type === 'text') { value = value[0].text; continue; }
    if (value?.isError === true && !allowError) throw new Error(`MCP transport error for ${tool}.`);
    if (value && typeof value.ok === 'boolean') {
      if ((!value.ok || !value.data) && !allowError) throw new Error(`Unsuccessful ${tool} reply.`);
      return value;
    }
    if (value && Array.isArray(value.content)) { value = value.content; continue; }
    throw new Error(`Unsupported reply representation for ${tool}.`);
  }
  throw new Error(`Excessive reply wrapping for ${tool}.`);
}
