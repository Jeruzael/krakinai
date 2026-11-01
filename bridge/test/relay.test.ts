import { afterEach, describe, expect, it } from 'vitest';
import { request as rawRequest } from 'node:http';
import { connect, type Socket } from 'node:net';
import { createRelay, type RelayHandle, type VerificationRequest } from '../src/relay';
import { createOffer, deriveHandshake, proof, checkProof, deriveEpoch, signMessage, verifyMessage, randomSecret, type EpochKeys } from '../../src/domain/mcpCrypto';
import { BRIDGE_VERSION, MCP_LIMITS, resultData } from '../../src/domain/mcpProtocol';

const origin = 'http://127.0.0.1:4173';
const handles: RelayHandle[] = [];
afterEach(async () => { await Promise.all(handles.splice(0).map(h => h.close())); });
async function setup(allowed = true) {
  let verification: VerificationRequest | undefined, time = Date.now();
  const relay = await createRelay({ port: 0, appOrigin: origin, bridgePath: 'C:/synthetic/krakinai-mcp.mjs', now: () => time, verifyNative: info => { verification = info; return { decision: Promise.resolve(allowed), close() {} }; } });
  handles.push(relay);
  return { relay, secret: () => verification!.secret, advance: (ms: number) => time += ms };
}
async function post(url: string, path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(url + path, { method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
async function pair(env: Awaited<ReturnType<typeof setup>>) {
  const offer = await createOffer();
  const response = await post(env.relay.url, '/v1/pair/start', { version: BRIDGE_VERSION, client: offer.offer });
  expect(response.status).toBe(200); const start = await response.json();
  const keys = await deriveHandshake(env.secret(), offer.privateKey, start.transcript.server.publicKey, start.transcript);
  const result = await (await post(env.relay.url, '/v1/pair/proof', { challengeId: start.transcript.challengeId, proof: await proof(keys, 'client') })).json();
  expect(await checkProof(keys, 'server', result.proof)).toBe(true);
  let epoch = await deriveEpoch(keys.master, result.sessionId, 0, result.epochNonce), epochNumber = 0;
  let seq = 0;
  async function request(path: string, body: unknown = {}, useKeys: EpochKeys = epoch) {
    const message = { sessionId: result.sessionId, epoch: epochNumber, seq: ++seq, requestId: crypto.randomUUID(), method: 'POST', path, body };
    const { method, path: ignored, ...wire } = message;
    const mac = await signMessage(useKeys, 'request', message);
    const response = await post(env.relay.url, path, { ...wire, mac });
    const data = await response.json();
    if (response.ok) expect(await verifyMessage(useKeys, 'response', { ...message, body: data.body }, data.mac)).toBe(true);
    return { response, data, wire: { ...wire, mac } };
  }
  expect((await request('/v1/session/confirm')).response.status).toBe(200);
  return { request, start, sessionId: result.sessionId, initialEpoch: epoch, async acceptRotation(target: { epoch: number; nonce: string }) { epoch = await deriveEpoch(keys.master, result.sessionId, target.epoch, target.nonce); epochNumber = target.epoch; } };
}

describe('loopback relay boundaries', () => {
  it('caps unparsed TCP connections before an attacker can occupy unlimited header readers', async () => {
    const { relay } = await setup(), port = Number(new URL(relay.url).port), sockets: Socket[] = [];
    try {
      for (let i = 0; i < 32; i++) { const socket = connect(port, '127.0.0.1'); sockets.push(socket); socket.on('error', () => {}); await new Promise<void>(resolve => socket.once('connect', resolve)); }
      const extra = connect(port, '127.0.0.1'); sockets.push(extra); extra.on('error', () => {}); extra.resume();
      expect(await Promise.race([new Promise<boolean>(resolve => extra.once('close', () => resolve(true))), new Promise<boolean>(resolve => setTimeout(() => resolve(false), 500))])).toBe(true);
    } finally { for (const socket of sockets) socket.destroy(); }
  });
  it('requires pairing and never claims an unconnected write succeeded', async () => {
    const { relay } = await setup();
    expect((await relay.dispatch('krakinai_connection_status', {})).ok).toBe(true);
    expect(await relay.dispatch('krakinai_get_project', { projectId: 'project_1' })).toMatchObject({ ok: false, error: { code: 'PAIRING_REQUIRED' } });
    expect((await post(relay.url, '/v1/session/poll', {})).status).toBe(401);
  });
  it('rejects missing/cross origins, forged Host and unknown routes before pairing', async () => {
    const { relay } = await setup();
    for (const headers of [{ origin: 'https://evil.test' }, { origin: 'null' }]) expect((await post(relay.url, '/v1/pair/start', {}, headers)).status, JSON.stringify(headers)).toBe(403);
    const forgedHost = await new Promise<number>(resolve => { const req = rawRequest(new URL('/v1/pair/start', relay.url), { method: 'POST', headers: { Host: 'rebind.test', Origin: origin, 'Content-Type': 'application/json' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)); }); req.end('{}'); });
    expect(forgedHost).toBe(403);
    expect((await fetch(relay.url + '/v1/pair/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(403);
    expect((await post(relay.url, '/anything', {})).status).toBe(404);
    expect((await post(relay.url, '/v1/pair/start?token=secret', {})).status).toBe(404);
  });
  it('does not expose the bootstrap secret in pairing responses', async () => {
    const env = await setup(); const local = await createOffer();
    const response = await post(env.relay.url, '/v1/pair/start', { version: BRIDGE_VERSION, client: local.offer });
    const text = await response.text(); expect(response.status).toBe(200); expect(text).not.toContain(env.secret());
    expect(text).not.toContain('C:/synthetic');
    const value = JSON.parse(text);
    expect((await post(env.relay.url, '/v1/pair/proof', { challengeId: value.transcript.challengeId, proof: randomSecret() })).status).toBe(401);
  });
  it('expires challenges and rejects replayed pairing proofs', async () => {
    const env = await setup(); const paired = await pair(env);
    expect((await post(env.relay.url, '/v1/pair/proof', { challengeId: paired.start.transcript.challengeId, proof: randomSecret() })).status).toBe(401);
    await paired.request('/v1/session/revoke'); env.advance(31000);
    const local = await createOffer(); const start = await (await post(env.relay.url, '/v1/pair/start', { version: BRIDGE_VERSION, client: local.offer })).json();
    env.advance(120001);
    expect((await post(env.relay.url, '/v1/pair/proof', { challengeId: start.transcript.challengeId, proof: randomSecret() })).status).toBe(401);
  });
  it('forwards one authenticated command and verifies its response before returning data', async () => {
    const env = await setup(); const paired = await pair(env);
    const pending = env.relay.dispatch('krakinai_get_project', { projectId: 'project_1' });
    const polled = await paired.request('/v1/session/poll');
    const command = polled.data.body.command;
    expect(command).toMatchObject({ tool: 'krakinai_get_project', args: { projectId: 'project_1' } });
    await paired.request('/v1/session/result', { requestId: command.requestId, result: resultData({ id: 'project_1', revision: 4 }) });
    expect(await pending).toMatchObject({ ok: true, data: { id: 'project_1', revision: 4 } });
  });
  it('rejects replayed session requests and immediately denies after revocation', async () => {
    const env = await setup(), paired = await pair(env);
    const once = await paired.request('/v1/session/result', { requestId: 'missing', result: resultData({}) });
    expect((await post(env.relay.url, '/v1/session/result', once.wire)).status).toBe(401);
    await paired.request('/v1/session/revoke');
    expect(await env.relay.dispatch('krakinai_get_project', { projectId: 'project_1' })).toMatchObject({ ok: false, error: { code: 'PAIRING_REQUIRED' } });
  });
  it('expires sessions before dispatch and releases every queued request', async () => {
    const env = await setup(); await pair(env);
    const pending = env.relay.dispatch('krakinai_get_project', { projectId: 'p' });
    env.advance(3600001);
    expect(await env.relay.dispatch('krakinai_get_project', { projectId: 'p' })).toMatchObject({ ok: false });
    expect(await pending).toMatchObject({ ok: false, error: { code: 'SESSION_EXPIRED' } });
  });
  it('rejects oversized and compressed HTTP inputs without trusting CORS', async () => {
    const { relay } = await setup();
    // Exercise declared-length rejection without racing a large upload against Connection: close.
    let oversizedRequest: ReturnType<typeof rawRequest> | undefined;
    const oversized = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = oversizedRequest = rawRequest(new URL('/v1/pair/start', relay.url), { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'Content-Length': MCP_LIMITS.frame + 1 } }, res => {
        let body = ''; res.setEncoding('utf8');
        res.on('data', part => { body += part; if (body.length > 8192) req.destroy(Error('Unexpected rejection response size')); });
        res.on('error', reject); res.on('end', () => resolve({ status: res.statusCode!, body }));
      });
      req.on('error', reject); req.setTimeout(3000, () => req.destroy(Error('Oversized header rejection timed out'))); req.flushHeaders();
    }).finally(() => oversizedRequest?.destroy());
    expect(oversized.status).toBe(413); expect(JSON.parse(oversized.body)).toMatchObject({ ok: false, error: { code: 'PAYLOAD_TOO_LARGE' } });
    expect((await post(relay.url, '/v1/pair/start', {}, { 'content-encoding': 'gzip' })).status).toBe(415);
    const options = await fetch(relay.url + '/v1/pair/start', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
    expect(options.headers.get('access-control-allow-origin')).toBe(origin);
    expect(options.headers.get('access-control-allow-credentials')).toBeNull();
  });
  it('requires the separate native approval even with a correct pairing secret', async () => {
    const env = await setup(false), client = await createOffer();
    const start = await (await post(env.relay.url, '/v1/pair/start', { version: BRIDGE_VERSION, client: client.offer })).json();
    const keys = await deriveHandshake(env.secret(), client.privateKey, start.transcript.server.publicKey, start.transcript);
    expect((await post(env.relay.url, '/v1/pair/proof', { challengeId: start.transcript.challengeId, proof: await proof(keys, 'client') })).status).toBe(401);
    expect(await env.relay.dispatch('krakinai_get_project', { projectId: 'project_1' })).toMatchObject({ ok: false });
  });
  it('bounds tool bursts before work is queued', async () => {
    const { relay, advance } = await setup();
    for (let i = 0; i < 8; i++) expect((await relay.dispatch('krakinai_connection_status', {})).ok).toBe(true);
    expect(await relay.dispatch('krakinai_connection_status', {})).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
    advance(2001); expect((await relay.dispatch('krakinai_connection_status', {})).ok).toBe(true);
  });
  it('rotates authenticated epochs and rejects retired MAC keys', async () => {
    const env = await setup(), paired = await pair(env);
    for (let i = 0; i < 10; i++) { env.advance(30000); await paired.request('/v1/session/result', { requestId: 'absent', result: resultData({}) }); }
    env.advance(1);
    const pending = env.relay.dispatch('krakinai_get_project', { projectId: 'p' });
    const response = await paired.request('/v1/session/poll');
    const target = response.data.body.rotation; expect(target.epoch).toBe(1);
    await paired.request('/v1/session/result', { requestId: response.data.body.command.requestId, result: resultData({ id: 'p' }) });
    expect((await pending).ok).toBe(true);
    expect((await paired.request('/v1/session/rotate', target)).response.status).toBe(200);
    expect((await paired.request('/v1/session/result', { requestId: 'absent', result: resultData({}) })).response.status).toBe(401);
    await paired.acceptRotation(target);
    expect((await paired.request('/v1/session/result', { requestId: 'absent', result: resultData({}) }, paired.initialEpoch)).response.status).toBe(401);
    expect((await paired.request('/v1/session/revoke')).response.status).toBe(200);
  });
});
