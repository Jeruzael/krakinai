import { openNativeChannel, readAdapterSettings } from './nativeChannel';
import { startStdioAdapter } from './stdioAdapter';

async function main() {
  const args = process.argv.slice(2);
  if (process.versions.node.split('.')[0] !== '22' || args.length !== 2 || args[0] !== '--config') throw Error('OPTIONS_REJECTED');
  const settings = await readAdapterSettings(args[1]);
  startStdioAdapter({ origin: settings.appOrigin, relay: 'http://127.0.0.1:' + settings.relayPort, openChannel: () => openNativeChannel(settings) });
}
void main().catch(() => { console.error('KRAKINAI_ADAPTER_CONFIGURATION_REJECTED'); process.exitCode = 1; process.stdin.destroy(); });
