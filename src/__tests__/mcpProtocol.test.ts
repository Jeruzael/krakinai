// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validateToolArgs, assertByteLimit, McpError, validateOrigin, validateRelayAddress } from '../domain/mcpProtocol';
import { createOffer, deriveHandshake, deriveEpoch, proof, checkProof, signMessage, verifyMessage, randomSecret } from '../domain/mcpCrypto';

describe('MCP strict contracts', () => {
  it('rejects approval flags and forged handles before dispatch', () => {
    for (const field of ['approved', 'approval', 'approvalHandle', 'approvedDigest', 'scope'])
      expect(() => validateToolArgs('krakinai_submit_change_set', { changeSet: {}, [field]: true })).toThrow(McpError);
  });
  it('requires exact identifiers and bounds pagination without wildcard access', () => {
    expect(validateToolArgs('krakinai_get_project', { projectId: 'project_midori' })).toEqual({ projectId: 'project_midori' });
    for (const args of [{}, { projectId: '*' }, { projectId: 'p', extra: true }])
      expect(() => validateToolArgs('krakinai_get_project', args)).toThrow(McpError);
    for (const limit of [0, 51, -1, 1.5]) expect(() => validateToolArgs('krakinai_list_projects', { limit })).toThrow();
    expect(validateToolArgs('krakinai_list_projects', { limit: 50 })).toEqual({ limit: 50 });
  });
  it('does not accept caller-controlled human transitions as tools', () => {
    expect(() => validateToolArgs('krakinai_apply_approved_change_set' as never, {})).toThrow(McpError);
    expect(() => validateToolArgs('krakinai_connection_status', { approved: true })).toThrow();
  });
  it('uses the existing wardrobe category rather than inventing clothing IDs', () => {
    expect(validateToolArgs('krakinai_search_assets', { category: 'wardrobe' })).toEqual({ category: 'wardrobe' });
    expect(() => validateToolArgs('krakinai_search_assets', { category: 'clothing' })).toThrow();
  });
  it('counts UTF-8 bytes rather than JavaScript character length', () => {
    expect(() => assertByteLimit('😀', 3)).toThrow();
    expect(() => assertByteLimit('😀', 4)).not.toThrow();
  });
  it('accepts only explicit loopback origins and literal relay addresses', () => {
    expect(validateOrigin('http://localhost:5173')).toBe('http://localhost:5173');
    for (const value of ['http://localhost:5173/', 'https://example.com', 'http://localhost:5173?x=1', 'null', 'http://user@localhost:5173'])
      expect(() => validateOrigin(value)).toThrow();
    expect(validateRelayAddress('http://127.0.0.1:4177')).toBe('http://127.0.0.1:4177');
    for (const value of ['http://localhost:4177', 'http://0.0.0.0:4177', 'http://127.0.0.1:4177/?token=x', 'http://127.0.0.1:4177/'])
      expect(() => validateRelayAddress(value)).toThrow();
  });
});

describe('MCP authenticated transcript and messages', () => {
  async function handshake() {
    const client = await createOffer(), server = await createOffer(), secret = randomSecret();
    const transcript = { version: 'krakinai.bridge.v1', instanceId: 'instance_1', challengeId: 'challenge_1', origin: 'http://localhost:5173', relay: 'http://127.0.0.1:4177', client: client.offer, server: server.offer };
    const c = await deriveHandshake(secret, client.privateKey, server.offer.publicKey, transcript);
    const s = await deriveHandshake(secret, server.privateKey, client.offer.publicKey, transcript);
    return { client, server, secret, transcript, c, s };
  }
  it('establishes matching keys only with the strong secret and both ephemeral keys', async () => {
    const { c, s } = await handshake();
    const clientProof = await proof(c, 'client');
    expect(await checkProof(s, 'client', clientProof)).toBe(true);
    expect(await checkProof(s, 'server', clientProof)).toBe(false);
    expect(c.master.extractable).toBe(false);
  });
  it('rejects a wrong secret and modified transcript', async () => {
    const { c, server, client, transcript, secret } = await handshake();
    const wrong = await deriveHandshake(randomSecret(), server.privateKey, client.offer.publicKey, transcript);
    expect(await checkProof(wrong, 'client', await proof(c, 'client'))).toBe(false);
    const tampered = await deriveHandshake(secret, server.privateKey, client.offer.publicKey, { ...transcript, origin: 'http://127.0.0.1:5173' });
    expect(await checkProof(tampered, 'client', await proof(c, 'client'))).toBe(false);
  });
  it('rejects invalid points, short secrets and malformed proofs', async () => {
    const local = await createOffer();
    await expect(deriveHandshake('short', local.privateKey, local.offer.publicKey, {})).rejects.toThrow();
    await expect(deriveHandshake(randomSecret(), local.privateKey, 'A'.repeat(87), {})).rejects.toThrow();
    const { c } = await handshake();
    expect(await checkProof(c, 'client', 'bad')).toBe(false);
  });
  it('binds signatures to body, path, direction, session and epoch', async () => {
    const { c, s } = await handshake();
    const sender = await deriveEpoch(c.master, 'session_1', 0, 'nonce_1');
    const receiver = await deriveEpoch(s.master, 'session_1', 0, 'nonce_1');
    const message = { sessionId: 'session_1', epoch: 0, seq: 1, requestId: 'req_1', method: 'POST', path: '/v1/session/result', body: { ok: true } };
    const mac = await signMessage(sender, 'request', message);
    expect(await verifyMessage(receiver, 'request', message, mac)).toBe(true);
    for (const altered of [{ ...message, body: { ok: false } }, { ...message, path: '/v1/session/revoke' }, { ...message, sessionId: 'session_2' }, { ...message, seq: 2 }, { ...message, epoch: 1 }])
      expect(await verifyMessage(receiver, 'request', altered, mac)).toBe(false);
    expect(await verifyMessage(receiver, 'response', message, mac)).toBe(false);
    const rotated = await deriveEpoch(s.master, 'session_1', 1, 'nonce_2');
    expect(await verifyMessage(rotated, 'request', message, mac)).toBe(false);
  });
});
