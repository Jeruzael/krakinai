import { randomUUID } from 'node:crypto';
import { MCP_LIMITS, McpError, resultError } from '../../src/domain/mcpProtocol';
import { createRelay, type RelayHandle, type RelayOptions } from './relay';
import { LAUNCHER_VERSION, validateLauncherFrame, type LauncherFrame } from './launcherProtocol';

export interface ManagedHostIO { send(frame: LauncherFrame): void | Promise<void> }
/** No relay is bound until the native owner has contained the process in its job. */
export function runManagedHost(options: RelayOptions & { generation: string }, io: ManagedHostIO) {
  let relay: RelayHandle | undefined, activation: Promise<void> | undefined, closing = false, closed: Promise<void> | undefined;
  const pending = new Set<string>();
  const header = () => ({ version: LAUNCHER_VERSION, generation: options.generation, connectionId: 'host', requestId: randomUUID() });
  function close(): Promise<void> {
    if (closed) return closed;
    closing = true;
    return closed = (async () => { await activation?.catch(() => undefined); await relay?.close(); relay = undefined; pending.clear(); })();
  }
  async function receive(input: unknown): Promise<void> {
    const frame = validateLauncherFrame(input, 'host-request');
    if (frame.generation !== options.generation || (frame.kind !== 'call' && frame.connectionId !== 'host')) throw new McpError('LAUNCHER_PROTOCOL');
    if (frame.kind === 'activate') {
      if (activation || closing) throw new McpError('LAUNCHER_PROTOCOL');
      activation = (async () => {
        const created = await createRelay({ ...options, onState: state => {
          if (closing) return;
          try { Promise.resolve(io.send({ ...header(), kind: 'state', state })).catch(() => { void close(); }); }
          catch { void close(); }
        } });
        if (closing) { await created.close(); return; }
        relay = created;
        await io.send({ ...frame, kind: 'ready', origin: options.appOrigin, relay: created.url });
      })();
      await activation; return;
    }
    if (frame.kind === 'shutdown') { await close(); await io.send({ ...frame, kind: 'stopped' }); return; }
    if (frame.kind !== 'call') throw new McpError('LAUNCHER_PROTOCOL');
    const key = frame.connectionId + ':' + frame.requestId;
    if (pending.has(key) || pending.size >= MCP_LIMITS.requests) throw new McpError('QUEUE_FULL');
    const current = relay;
    if (closing || !current) { await io.send({ version: frame.version, generation: frame.generation, connectionId: frame.connectionId, requestId: frame.requestId, kind: 'result', result: resultError(new McpError('DISCONNECTED', 'Start the bridge in the desktop launcher, then pair in KRAKINAI.', true)) }); return; }
    pending.add(key);
    try {
      const result = await current.dispatch(frame.tool, frame.args);
      if (!closing && relay === current) await io.send({ version: frame.version, generation: frame.generation, connectionId: frame.connectionId, requestId: frame.requestId, kind: 'result', result });
    } finally { pending.delete(key); }
  }
  return { receive, close };
}
