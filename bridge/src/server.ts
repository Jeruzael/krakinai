import { fileURLToPath } from 'node:url';
import { validateOrigin } from '../../src/domain/mcpProtocol';
import { windowsVerifier } from './nativeVerifier';
import { startStdioBridge } from './runtime';

async function main() {
  const raw = process.argv.slice(2), args: Record<string, string> = {};
  for (let index = 0; index < raw.length; index += 2) {
    if (!['--app-origin', '--port'].includes(raw[index]) || args[raw[index]] || !raw[index + 1]) throw new Error('STARTUP_REJECTED');
    args[raw[index]] = raw[index + 1];
  }
  const origin = validateOrigin(args['--app-origin'] ?? ''), port = Number(args['--port'] ?? '4177');
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('STARTUP_REJECTED');
  await startStdioBridge({ port, appOrigin: origin, bridgePath: fileURLToPath(import.meta.url), verifyNative: info => windowsVerifier(fileURLToPath(new URL('./native/verify.ps1', import.meta.url)), info) });
}
void main().catch(() => { console.error('KRAKINAI_STARTUP_REJECTED'); process.exitCode = 1; process.stdin.destroy(); });
