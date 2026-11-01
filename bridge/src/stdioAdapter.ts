import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio, StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { BRIDGE_VERSION, MCP_LIMITS, McpError, resultData, resultError, validateOrigin, validateRelayAddress, validateToolArgs, type McpResult, type McpToolName } from '../../src/domain/mcpProtocol';
import { LAUNCHER_VERSION, validateLauncherFrame, type LauncherFrame, type LauncherStatus } from './launcherProtocol';
import { registerKrakinaiTools } from './registerTools';
import { StdioAdmission } from './admission';

export interface AdapterChannel {
  send(frame: LauncherFrame): void;
  onFrame(callback: (frame: LauncherFrame) => void): void;
  onClose(callback: () => void): void;
  close(): void;
}
export interface AdapterOptions { origin: string; relay: string; openChannel(): Promise<AdapterChannel>; onDiagnostic?(code: 'CLIENT_ALREADY_CONNECTED' | 'IPC_HANDSHAKE_REJECTED'): void }
interface Pending { generation: string; resolve(result: McpResult): void; timer: ReturnType<typeof setTimeout> }
const failure = (code: string) => resultError(new McpError(code, 'Check the KRAKINAI launcher and reconnect with fresh browser pairing when needed.', true));

/** Persistent SDK lifetime, ephemeral native channel. Reconnection never starts the bridge. */
export class PersistentAdapter {
  private channel?: AdapterChannel;
  private connectionId = 'none';
  private generation = 'none';
  private state?: LauncherStatus;
  private sdkInitialized = false;
  private helloComplete = false;
  private helloRequestId = 'none';
  private initializedSent = false;
  private stopped = false;
  private started = false;
  private retry?: ReturnType<typeof setTimeout>;
  private pulse?: ReturnType<typeof setInterval>;
  private deadline?: ReturnType<typeof setTimeout>;
  private lastStatus = 0;
  private pending = new Map<string, Pending>();
  private retired = new Map<string, string>();
  constructor(private options: AdapterOptions) { validateOrigin(options.origin); validateRelayAddress(options.relay); }
  start() { if (!this.started) { this.started = true; void this.connect(); } }
  initialized() { this.sdkInitialized = true; this.sendInitialized(); }
  private send(kind: 'hello' | 'initialized' | 'heartbeat') {
    const requestId = randomUUID(); if (kind === 'hello') this.helloRequestId = requestId;
    this.channel?.send({ version: LAUNCHER_VERSION, kind, generation: this.generation, connectionId: this.connectionId, requestId });
  }
  private sendInitialized() {
    if (this.channel && this.helloComplete && this.sdkInitialized && !this.initializedSent) {
      this.initializedSent = true; this.send('initialized');
    }
  }
  private async connect() {
    if (this.stopped) return;
    let channel: AdapterChannel;
    try { channel = await this.options.openChannel(); }
    catch { this.schedule(); return; }
    if (this.stopped) { channel.close(); return; }
    this.channel = channel; this.connectionId = randomUUID(); this.generation = 'none';
    this.helloComplete = this.initializedSent = false; this.lastStatus = Date.now();
    channel.onClose(() => { if (this.channel === channel) this.disconnect(); });
    channel.onFrame(frame => {
      if (this.channel !== channel) return;
      try { this.receive(validateLauncherFrame(frame, 'adapter-response')); } catch { this.disconnect(); }
    });
    this.deadline = setTimeout(() => this.disconnect(), 5000);
    this.pulse = setInterval(() => {
      if (Date.now() - this.lastStatus >= 15000) { this.disconnect(); return; }
      try { if (this.helloComplete) this.send('heartbeat'); } catch { this.disconnect(); }
    }, 5000);
    try { this.send('hello'); } catch { this.disconnect(); }
  }
  private receive(frame: LauncherFrame) {
    if (frame.connectionId !== this.connectionId) throw Error('identity');
    if (frame.kind === 'error' && !this.helloComplete && frame.requestId === this.helloRequestId) {
      if (frame.generation !== this.generation) throw Error('generation');
      try { this.options.onDiagnostic?.(frame.code === 'CLIENT_ALREADY_CONNECTED' ? frame.code : 'IPC_HANDSHAKE_REJECTED'); }
      finally { this.disconnect(); }
      return;
    }
    if (frame.kind === 'status') {
      if (frame.state.origin !== this.options.origin || frame.state.relay !== this.options.relay) throw Error('configuration');
      if (frame.generation !== this.generation) this.failPending('HOST_CHANGED');
      this.generation = frame.generation; this.state = frame.state; this.lastStatus = Date.now();
      this.helloComplete = true; clearTimeout(this.deadline); this.sendInitialized(); return;
    }
    const pending = this.pending.get(frame.requestId);
    if (!pending) {
      if (frame.kind === 'result' && this.retired.get(frame.requestId) === frame.generation) return;
      throw Error('correlation');
    }
    if (frame.generation !== pending.generation || frame.generation !== this.generation) throw Error('generation');
    if (frame.kind !== 'result' && frame.kind !== 'error') throw Error('response');
    this.finish(frame.requestId, frame.kind === 'result' ? frame.result : failure(frame.code));
  }
  private finish(id: string, result: McpResult) {
    const pending = this.pending.get(id); if (!pending) return;
    clearTimeout(pending.timer); this.pending.delete(id); this.retired.set(id, pending.generation);
    while (this.retired.size > 128) this.retired.delete(this.retired.keys().next().value!);
    pending.resolve(result);
  }
  private failPending(code: string) { for (const id of [...this.pending.keys()]) this.finish(id, failure(code)); }
  private schedule() { if (!this.stopped && !this.retry) this.retry = setTimeout(() => { this.retry = undefined; void this.connect(); }, 5000); }
  private disconnect() {
    const previous = this.channel; this.channel = undefined; this.state = undefined;
    this.helloComplete = this.initializedSent = false; this.generation = 'none';
    clearTimeout(this.deadline); clearInterval(this.pulse); this.failPending('DISCONNECTED'); previous?.close(); this.schedule();
  }
  async dispatch(name: McpToolName, input: unknown): Promise<McpResult> {
    let args: Record<string, unknown>;
    try { args = validateToolArgs(name, input); } catch (error) { return resultError(error); }
    if (!this.channel || !this.helloComplete || !this.initializedSent || this.state?.bridge !== 'running') {
      return name === 'krakinai_connection_status'
        ? resultData({ connected: false, state: 'disconnected', apiVersion: BRIDGE_VERSION, manualImportAvailable: true })
        : resultError(new McpError('PAIRING_REQUIRED', 'Connect and approve permissions in KRAKINAI first.', true));
    }
    if (this.pending.size >= 16) return failure('QUEUE_FULL');
    const requestId = randomUUID(), generation = this.generation;
    return new Promise(resolve => {
      const timer = setTimeout(() => this.finish(requestId, failure('REQUEST_TIMEOUT')), MCP_LIMITS.toolMs);
      this.pending.set(requestId, { generation, resolve, timer });
      try { this.channel!.send({ version: LAUNCHER_VERSION, kind: 'call', generation, connectionId: this.connectionId, requestId, tool: name, args }); }
      catch { this.disconnect(); }
    });
  }
  close() { if (this.stopped) return; this.stopped = true; clearTimeout(this.retry); this.disconnect(); }
}

export function startStdioAdapter(options: AdapterOptions) {
  const adapter = new PersistentAdapter({ ...options, onDiagnostic: code => {
    console.error(code === 'CLIENT_ALREADY_CONNECTED'
      ? 'KRAKINAI_CLIENT_ALREADY_CONNECTED: Close the other Codex MCP client before connecting this client.'
      : 'KRAKINAI_IPC_HANDSHAKE_REJECTED: Check the launcher identity and configuration.');
    options.onDiagnostic?.(code);
  } }), admission = new StdioAdmission();
  let closed = false, handle: ReturnType<typeof serveStdio> | undefined;
  const stop = async (code = 0) => {
    if (closed) return; closed = true; process.exitCode = code; adapter.close();
    process.stdin.unpipe(admission); await handle?.close(); admission.destroy(); process.stdin.destroy();
  };
  admission.on('error', () => { console.error('KRAKINAI_PROTOCOL_LIMIT'); void stop(1); });
  process.stdin.on('error', () => void stop(1)); process.stdin.on('end', () => void stop());
  const transport = new StdioServerTransport(process.stdin.pipe(admission), process.stdout, { maxBufferSize: MCP_LIMITS.frame });
  handle = serveStdio(() => {
    const server = new McpServer({ name: 'krakinai-local-codex', version: '1.0.0' });
    registerKrakinaiTools(server, (name, args) => adapter.dispatch(name, args));
    server.server.oninitialized = () => adapter.initialized(); server.server.onclose = () => void stop(); return server;
  }, { legacy: 'serve', transport, maxSubscriptions: 0, onerror: () => { console.error('KRAKINAI_PROTOCOL_ERROR'); void stop(1); } });
  process.on('SIGINT', () => void stop()); process.on('SIGTERM', () => void stop());
  adapter.start(); console.error('KRAKINAI_ADAPTER_READY'); return { stop };
}
