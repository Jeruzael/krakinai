// Synthetic SDK handshake fixture, never a production entry or native verifier bypass.
import { startStdioAdapter, type AdapterChannel } from '../src/stdioAdapter';
import { LAUNCHER_VERSION, type LauncherFrame } from '../src/launcherProtocol';
let received: ((frame: LauncherFrame) => void) | undefined;
const channel: AdapterChannel = {
  onFrame(callback) { received = callback; }, onClose() {}, close() {},
  send(frame) {
    if (frame.kind === 'initialized') console.error('SYNTHETIC_ADAPTER_INITIALIZED');
    if (frame.kind === 'hello' || frame.kind === 'heartbeat' || frame.kind === 'initialized') queueMicrotask(() => received?.({ version: LAUNCHER_VERSION, kind: 'status', generation: 'none', connectionId: frame.connectionId, requestId: frame.requestId, state: { bridge: 'stopped', browser: 'not-paired', mcp: frame.kind === 'initialized', origin: 'http://localhost:5183', relay: 'http://127.0.0.1:54183' } }));
  },
};
startStdioAdapter({ origin: 'http://localhost:5183', relay: 'http://127.0.0.1:54183', openChannel: async () => channel });
