import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio, StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { MCP_LIMITS } from '../../src/domain/mcpProtocol';
import { createRelay, type RelayOptions } from './relay';
import { StdioAdmission } from './admission';
import { registerKrakinaiTools } from './registerTools';

/** Shared runtime. The production entry always supplies the Windows verifier. */
export async function startStdioBridge(options: RelayOptions) {
  const relay = await createRelay(options), admission = new StdioAdmission(); let stopped = false;
  let handle: ReturnType<typeof serveStdio> | undefined;
  const stop = async (code = 0) => { if (stopped) return; stopped = true; process.exitCode = code; process.stdin.unpipe(admission); process.stdin.pause(); await relay.close(); await handle?.close(); admission.destroy(); process.stdin.destroy(); };
  admission.on('error', () => { console.error('KRAKINAI_PROTOCOL_LIMIT'); void stop(1); });
  process.stdin.on('error', () => void stop(1)); process.stdin.on('end', () => void stop());
  const transport = new StdioServerTransport(process.stdin.pipe(admission), process.stdout, { maxBufferSize: MCP_LIMITS.frame });
  handle = serveStdio(() => {
    const server = new McpServer({ name: 'krakinai-local-codex', version: '1.0.0' });
    registerKrakinaiTools(server, (name, args) => relay.dispatch(name, args));
    server.server.onclose = () => void stop(); return server;
  }, { legacy: 'serve', transport, onerror: () => { console.error('KRAKINAI_PROTOCOL_ERROR'); void stop(1); }, maxSubscriptions: 0 });
  process.on('SIGINT', () => void stop()); process.on('SIGTERM', () => void stop());
  console.error(`KRAKINAI_BRIDGE_READY ${new URL(relay.url).port}`);
  return { stop };
}
