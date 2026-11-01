import { fileURLToPath } from 'node:url';
import { validateOrigin } from '../../src/domain/mcpProtocol';
import { LauncherLineDecoder, LauncherQueueBudget, validateLauncherFrame } from './launcherProtocol';
import { runManagedHost } from './managedHost';
import { windowsVerifier } from './nativeVerifier';

async function main() {
  const raw = process.argv.slice(2), args: Record<string, string> = {};
  for (let i = 0; i < raw.length; i += 2) {
    if (!['--app-origin', '--port', '--generation'].includes(raw[i]) || args[raw[i]] || !raw[i + 1]) throw Error('STARTUP_REJECTED');
    args[raw[i]] = raw[i + 1];
  }
  const appOrigin = validateOrigin(args['--app-origin'] ?? ''), port = Number(args['--port']), generation = args['--generation'];
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535 || !/^[a-f0-9]{32}$/.test(generation ?? '')) throw Error('STARTUP_REJECTED');
  const budget = new LauncherQueueBudget(), decoder = new LauncherLineDecoder('host-request');
  let stopped = false;
  const host = runManagedHost({ appOrigin, port, generation, bridgePath: fileURLToPath(import.meta.url), verifyNative: info => windowsVerifier(fileURLToPath(new URL('./native/verify.ps1', import.meta.url)), info) }, {
    send(frame) {
      validateLauncherFrame(frame, 'host-response');
      const bytes = Buffer.from(JSON.stringify(frame) + '\n'); budget.add(bytes.length);
      return new Promise<void>((resolve, reject) => {
        try { process.stdout.write(bytes, error => { budget.release(bytes.length); if (error) reject(Error('CHANNEL_CLOSED')); else resolve(); }); }
        catch { budget.release(bytes.length); reject(Error('CHANNEL_CLOSED')); }
      });
    },
  });
  const stop = async (code = 0) => { if (stopped) return; stopped = true; clearTimeout(activateDeadline); process.exitCode = code; process.stdin.pause(); await host.close(); process.stdin.destroy(); };
  const activateDeadline = setTimeout(() => { void stop(1); }, 5000); activateDeadline.unref();
  process.stdin.on('data', chunk => {
    try {
      for (const frame of decoder.push(chunk)) {
        if (frame.kind === 'activate') clearTimeout(activateDeadline);
        void host.receive(frame).then(() => { if (frame.kind === 'shutdown') void stop(); }, async error => {
          const code = (error as NodeJS.ErrnoException)?.code === 'EADDRINUSE' ? 'PORT_IN_USE' : 'HOST_PROTOCOL_ERROR';
          const message = { version: frame.version, generation, connectionId: 'host', requestId: frame.requestId, kind: 'error', code };
          try { await new Promise<void>(resolve => { process.stdout.write(JSON.stringify(message) + '\n', () => resolve()); }); }
          finally { await stop(1); }
        });
      }
    } catch { void stop(1); }
  });
  process.stdin.on('end', () => { void stop(); }); process.stdin.on('error', () => { void stop(1); }); process.stdout.on('error', () => { void stop(1); });
  process.on('SIGINT', () => { void stop(); }); process.on('SIGTERM', () => { void stop(); });
}
void main().catch(() => { console.error('KRAKINAI_MANAGED_STARTUP_REJECTED'); process.exitCode = 1; process.stdin.destroy(); });
