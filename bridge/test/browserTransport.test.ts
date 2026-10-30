import { afterEach, expect, it } from 'vitest';
import { createRelay, type RelayHandle, type VerificationRequest } from '../src/relay';
import { BrowserTransport } from '../../src/connections/browserTransport';
import { resultData } from '../../src/domain/mcpProtocol';
const origin = 'http://127.0.0.1:4173';
const relays: RelayHandle[] = [], clients: BrowserTransport[] = [];
afterEach(async () => { await Promise.all(clients.splice(0).map(c => c.disconnect())); await Promise.all(relays.splice(0).map(c => c.close())); });
async function setup(tamper = false) {
  let native: VerificationRequest | undefined, connected = false, disconnected = false, commands = 0, now = Date.now();
  const relay = await createRelay({ port: 0, appOrigin: origin, bridgePath: 'C:/synthetic/server.mjs', now: () => now, verifyNative(info) { native = info; return { decision: Promise.resolve(true), close() {} }; } }); relays.push(relay);
  const transport = new BrowserTransport({ relayAddress: relay.url, appOrigin: origin, now: () => now,
    fetcher: async (url, init) => { const res = await fetch(url, { ...init, headers: { ...init?.headers, origin } }); if (tamper && String(url).endsWith('/v1/session/poll') && res.ok) { const body = await res.json(); body.mac = 'A'.repeat(43); return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }); } return res; },
    onConnected() { connected = true; }, onDisconnected() { disconnected = true; },
    async onCommand(command) { commands++; return resultData({ id: command.args.projectId, synthetic: true }); },
  }); clients.push(transport);
  return { relay, transport, secret: () => native!.secret, connected: () => connected, disconnected: () => disconnected, commands: () => commands, advance: (ms: number) => now += ms };
}
it('pairs through real authenticated HTTP, handles an MCP command and revokes locally before network completion', async () => {
  const env = await setup(); await env.transport.startPairing(); await env.transport.finishPairing(env.secret());
  expect(env.connected()).toBe(true);
  expect(await env.relay.dispatch('krakinai_get_project', { projectId: 'synthetic_project' })).toMatchObject({ ok: true, data: { id: 'synthetic_project' } });
  const disconnecting = env.transport.disconnect(); expect(env.disconnected()).toBe(true); await disconnecting;
  expect(await env.relay.dispatch('krakinai_get_project', { projectId: 'synthetic_project' })).toMatchObject({ ok: false, error: { code: 'PAIRING_REQUIRED' } });
});
it('does not start a browser controller with the wrong bootstrap secret', async () => {
  const env = await setup(); await env.transport.startPairing();
  await expect(env.transport.finishPairing('A'.repeat(43))).rejects.toThrow(); expect(env.connected()).toBe(false); expect(env.commands()).toBe(0);
});
it('verifies a response before dispatching any command to application code', async () => {
  const env = await setup(true); await env.transport.startPairing(); await env.transport.finishPairing(env.secret());
  const result = await env.relay.dispatch('krakinai_get_project', { projectId: 'synthetic_project' });
  expect(result.ok).toBe(false); expect(env.commands()).toBe(0); expect(env.disconnected()).toBe(true);
});
it('expires browser authority locally without waiting for the next network poll', async () => {
  const env = await setup(); await env.transport.startPairing(); const sessionId = await env.transport.finishPairing(env.secret());
  expect(env.transport.isSessionLive(sessionId)).toBe(true);
  env.advance(3600001); expect(env.transport.isSessionLive(sessionId)).toBe(false);
});
