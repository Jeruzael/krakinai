import { MCP_API_VERSION, MCP_LIMITS, McpError, assertByteLimit, exactKeys, record, validateOrigin, validateRelayAddress, validateToolArgs, type McpResult, type McpToolName } from '../../src/domain/mcpProtocol';

export const LAUNCHER_VERSION = 'krakinai.launcher.v1' as const;
export const LAUNCHER_QUEUE_BYTES = 8388608;
export type LauncherDirection = 'adapter-request' | 'adapter-response' | 'host-request' | 'host-response';
export type BrowserPhase = 'not-paired' | 'pairing' | 'paired' | 'expired';
export interface LauncherStatus { bridge: 'stopped' | 'starting' | 'running' | 'stopping' | 'error'; browser: BrowserPhase; mcp: boolean; origin: string; relay: string; errorCode?: string }
interface Base { version: typeof LAUNCHER_VERSION; generation: string; connectionId: string; requestId: string }
export type LauncherFrame = Base & (
  | { kind: 'hello' | 'initialized' | 'heartbeat' | 'activate' | 'shutdown' | 'stopped' }
  | { kind: 'call'; tool: McpToolName; args: Record<string, unknown> }
  | { kind: 'result'; result: McpResult }
  | { kind: 'ready'; origin: string; relay: string }
  | { kind: 'state'; state: { browser: BrowserPhase } }
  | { kind: 'status'; state: LauncherStatus }
  | { kind: 'error'; code: string }
);
const roles: Record<LauncherDirection, readonly string[]> = {
  'adapter-request': ['hello', 'initialized', 'heartbeat', 'call'],
  'adapter-response': ['status', 'result', 'error'],
  'host-request': ['activate', 'shutdown', 'call'],
  'host-response': ['ready', 'state', 'result', 'error', 'stopped'],
};
const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const errorCode = /^[A-Z][A-Z0-9_]{1,63}$/;
const browsers = ['not-paired', 'pairing', 'paired', 'expired'];
function invalid(): never { throw new McpError('LAUNCHER_PROTOCOL', 'The local launcher protocol could not be validated.'); }

export function validateLauncherFrame(value: unknown, direction: LauncherDirection): LauncherFrame {
  record(value);
  if (value.version !== LAUNCHER_VERSION || typeof value.kind !== 'string' || !roles[direction].includes(value.kind)) invalid();
  for (const name of ['generation', 'connectionId', 'requestId']) if (typeof value[name] !== 'string' || !identifier.test(value[name] as string)) invalid();
  const extra = value.kind === 'call' ? ['tool', 'args'] : value.kind === 'result' ? ['result'] : value.kind === 'ready' ? ['origin', 'relay'] : ['state', 'status'].includes(value.kind) ? ['state'] : value.kind === 'error' ? ['code'] : [];
  exactKeys(value, ['version', 'kind', 'generation', 'connectionId', 'requestId', ...extra], ['version', 'kind', 'generation', 'connectionId', 'requestId', ...extra]);
  assertByteLimit(JSON.stringify(value) + '\n', MCP_LIMITS.frame);
  if (value.kind === 'call') validateToolArgs(value.tool as McpToolName, value.args);
  if (value.kind === 'result') {
    record(value.result);
    if (value.result.apiVersion !== MCP_API_VERSION || typeof value.result.ok !== 'boolean') invalid();
    const fields = value.result.ok ? ['apiVersion', 'ok', 'data'] : ['apiVersion', 'ok', 'error'];
    exactKeys(value.result, fields, fields);
    if (!value.result.ok) {
      record(value.result.error); exactKeys(value.result.error, ['code', 'message', 'retryable'], ['code', 'message', 'retryable']);
      if (typeof value.result.error.code !== 'string' || !errorCode.test(value.result.error.code) || typeof value.result.error.message !== 'string' || value.result.error.message.length > 2000 || typeof value.result.error.retryable !== 'boolean') invalid();
    }
    assertByteLimit(JSON.stringify(value.result), MCP_LIMITS.result);
  }
  if (value.kind === 'ready') { validateOrigin(String(value.origin)); validateRelayAddress(String(value.relay)); }
  if (value.kind === 'error' && (typeof value.code !== 'string' || !errorCode.test(value.code))) invalid();
  if (value.kind === 'state' || value.kind === 'status') {
    record(value.state);
    if (typeof value.state.browser !== 'string' || !browsers.includes(value.state.browser)) invalid();
    if (value.kind === 'state') exactKeys(value.state, ['browser'], ['browser']);
    else {
      exactKeys(value.state, ['bridge', 'browser', 'mcp', 'origin', 'relay', 'errorCode'], ['bridge', 'browser', 'mcp', 'origin', 'relay']);
      if (!['stopped', 'starting', 'running', 'stopping', 'error'].includes(String(value.state.bridge)) || typeof value.state.mcp !== 'boolean') invalid();
      validateOrigin(String(value.state.origin)); validateRelayAddress(String(value.state.relay));
      if (value.state.errorCode !== undefined && (typeof value.state.errorCode !== 'string' || !errorCode.test(value.state.errorCode))) invalid();
    }
  }
  return value as unknown as LauncherFrame;
}

/** Bound bytes before decoding/parsing; a protocol error poisons the channel. */
export class LauncherLineDecoder {
  private buffer = Buffer.alloc(MCP_LIMITS.frame);
  private used = 0;
  private failed = false;
  constructor(private direction: LauncherDirection) {}
  push(chunk: Uint8Array): LauncherFrame[] {
    if (this.failed) invalid();
    try {
      if (chunk.byteLength > LAUNCHER_QUEUE_BYTES) invalid();
      const bytes = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength), frames: LauncherFrame[] = [];
      let offset = 0;
      while (offset < bytes.length) {
        const newline = bytes.indexOf(10, offset), end = newline < 0 ? bytes.length : newline + 1, size = end - offset;
        if (this.used + size > this.buffer.length) invalid();
        bytes.copy(this.buffer, this.used, offset, end); this.used += size;
        if (newline >= 0) {
          const text = new TextDecoder('utf-8', { fatal: true }).decode(this.buffer.subarray(0, this.used - 1));
          frames.push(validateLauncherFrame(JSON.parse(text), this.direction)); this.used = 0;
          if (frames.length > 64) invalid();
        }
        offset = end;
      }
      return frames;
    } catch { this.failed = true; this.buffer.fill(0); this.used = 0; return invalid(); }
  }
}

export class LauncherQueueBudget {
  private used = 0;
  get bytes() { return this.used; }
  add(bytes: number) { if (!Number.isSafeInteger(bytes) || bytes < 0 || this.used + bytes > LAUNCHER_QUEUE_BYTES) invalid(); this.used += bytes; }
  release(bytes: number) { if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > this.used) invalid(); this.used -= bytes; }
}
