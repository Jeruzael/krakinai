// Parse actual CLI tool messages only; assistant success text is never evidence.
export function readCliReply(messages, callId, tool, { allowError = false } = {}) {
  const matches = messages.filter(m => m.role === 'tool' && m.tool_call_id === callId);
  if (matches.length !== 1) throw new Error(`Cannot correlate ${tool} reply.`);
  let value = matches[0].content;
  for (let depth = 0; depth < 6; depth++) {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch { throw new Error(`Invalid JSON reply for ${tool}.`); } continue; }
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
