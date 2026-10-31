import { canonicalStringify } from '../domain/changeSetCanonical';
import { BRIDGE_VERSION, MCP_LIMITS, McpError, exactKeys, record, resultError, validateOrigin, validateRelayAddress, validateToolArgs, type McpCommand, type McpResult } from '../domain/mcpProtocol';
import { createOffer, deriveHandshake, checkProof, proof, decode64, deriveEpoch, signMessage, verifyMessage, type AuthMessage, type EpochKeys, type KeyOffer } from '../domain/mcpCrypto';

export interface PairingView { verificationCode: string; expiresAt: string; origin: string; relay: string }
interface BrowserTransportOptions {
  relayAddress: string; appOrigin: string; fetcher?: typeof fetch; now?: () => number;
  onConnected(sessionId: string, grant: { expiresAt: number }): void; onDisconnected(reason: string): void;
  onCommand(command: McpCommand, sessionId: string): Promise<McpResult>;
}
interface Credentials { id: string; epoch: number; seq: number; master: CryptoKey; keys: EpochKeys; expiresAt: number }
interface PendingPair { privateKey: CryptoKey; transcript: Record<string, unknown>; view: PairingView }

/** Owns ephemeral credentials; nothing is stored in preferences, storage or URLs. */
export class BrowserTransport {
  #auth?: Credentials; #pair?: PendingPair; #generation = 0; #working = false;
  #requests = new Set<AbortController>();
  readonly relayAddress: string; readonly appOrigin: string;
  constructor(private options: BrowserTransportOptions) {
    this.relayAddress = validateRelayAddress(options.relayAddress); this.appOrigin = validateOrigin(options.appOrigin);
    if (typeof window !== 'undefined' && window.location.origin !== this.appOrigin) throw new McpError('ORIGIN_MISMATCH', 'Keep KRAKINAI open at its existing browser origin.');
  }
  isSessionLive(sessionId: string): boolean { return this.#auth?.id === sessionId && (this.options.now ?? Date.now)() < this.#auth.expiresAt; }
  async #json(path: string, body: unknown, timeout = 25000): Promise<Record<string, unknown>> {
    const controller = new AbortController(); this.#requests.add(controller);
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await (this.options.fetcher ?? fetch)(this.relayAddress + path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
      if (response.headers.get('content-type')?.split(';')[0] !== 'application/json' || Number(response.headers.get('content-length') ?? 0) > MCP_LIMITS.frame || !response.body) throw new McpError('INVALID_RESPONSE');
      const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true }); let bytes = 0, text = '';
      try { while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.byteLength; if (bytes > MCP_LIMITS.frame) throw new McpError('PAYLOAD_TOO_LARGE'); text += decoder.decode(next.value, { stream: true }); } text += decoder.decode(); }
      finally { await reader.cancel().catch(() => undefined); }
      const data: unknown = JSON.parse(text); record(data);
      if (!response.ok) {
        const error = data.error as { code?: unknown } | undefined;
        if (error?.code === 'NATIVE_APPROVAL_PENDING') throw new McpError('NATIVE_APPROVAL_PENDING', 'Allow the matching native verification window, then confirm pairing again.');
        if (response.status === 409) throw new McpError('PAIRING_BUSY', 'A connection or pairing is already active. Disconnect it or deny its native window before pairing again.');
        if (response.status === 429) throw new McpError('RATE_LIMITED', 'The local connection limit was reached. Wait briefly and retry.');
        throw new McpError('DISCONNECTED', 'The bridge is unavailable, expired or denied this origin. Check its configured origin and pair again.');
      }
      return data;
    } catch (error) { if (error instanceof McpError) throw error; throw new McpError('DISCONNECTED', 'The local bridge did not return a valid response. No application success is confirmed.'); }
    finally { clearTimeout(timer); this.#requests.delete(controller); }
  }
  async startPairing(): Promise<PairingView> {
    if (this.#working || this.#auth) throw new McpError('PAIRING_BUSY');
    this.#working = true; const generation = ++this.#generation;
    try {
      const local = await createOffer();
      const response = await this.#json('/v1/pair/start', { version: BRIDGE_VERSION, client: local.offer });
      exactKeys(response, ['transcript', 'expiresAt', 'verificationCode'], ['transcript', 'expiresAt', 'verificationCode']); record(response.transcript);
      const transcript = response.transcript;
      exactKeys(transcript, ['version', 'instanceId', 'challengeId', 'origin', 'relay', 'client', 'server'], ['version', 'instanceId', 'challengeId', 'origin', 'relay', 'client', 'server']);
      if (generation !== this.#generation || transcript.version !== BRIDGE_VERSION || transcript.origin !== this.appOrigin || transcript.relay !== this.relayAddress || canonicalStringify(transcript.client) !== canonicalStringify(local.offer) || typeof transcript.challengeId !== 'string' || typeof transcript.instanceId !== 'string' || typeof response.expiresAt !== 'string' || typeof response.verificationCode !== 'string') throw new McpError('AUTH_FAILED');
      record(transcript.server); exactKeys(transcript.server, ['publicKey', 'nonce'], ['publicKey', 'nonce']);
      decode64(String(transcript.server.publicKey), 65); decode64(String(transcript.server.nonce), 32);
      const view = { verificationCode: response.verificationCode, expiresAt: response.expiresAt, origin: this.appOrigin, relay: this.relayAddress };
      this.#pair = { privateKey: local.privateKey, transcript, view }; return view;
    } finally { this.#working = false; }
  }
  async finishPairing(secret: string): Promise<string> {
    const pending = this.#pair, generation = this.#generation; if (!pending || this.#working || this.#auth) throw new McpError('PAIRING_REQUIRED'); this.#working = true;
    try {
      const server = pending.transcript.server as unknown as KeyOffer;
      const handshake = await deriveHandshake(secret, pending.privateKey, server.publicKey, pending.transcript);
      if (handshake.transcriptDigest.slice(0, 12) !== pending.view.verificationCode || generation !== this.#generation) throw new McpError('AUTH_FAILED');
      const response = await this.#json('/v1/pair/proof', { challengeId: pending.transcript.challengeId, proof: await proof(handshake, 'client') });
      exactKeys(response, ['sessionId', 'epochNonce', 'proof', 'expiresAt'], ['sessionId', 'epochNonce', 'proof', 'expiresAt']);
      if (generation !== this.#generation || typeof response.sessionId !== 'string' || !/^[A-Za-z0-9._:-]{1,200}$/.test(response.sessionId) || typeof response.proof !== 'string' || typeof response.epochNonce !== 'string' || !await checkProof(handshake, 'server', response.proof)) throw new McpError('AUTH_FAILED');
      decode64(response.epochNonce, 32);
      const keys = await deriveEpoch(handshake.master, response.sessionId, 0, response.epochNonce);
      if (generation !== this.#generation) throw new McpError('DISCONNECTED');
      const auth: Credentials = { id: response.sessionId, epoch: 0, seq: 0, master: handshake.master, keys, expiresAt: (this.options.now ?? Date.now)() + MCP_LIMITS.sessionMs }; this.#auth = auth;
      const confirmation = await this.#request(auth, '/v1/session/confirm', {});
      exactKeys(confirmation, ['connected', 'expiresAt'], ['connected', 'expiresAt']);
      const expiresAt = typeof confirmation.expiresAt === 'string' ? Date.parse(confirmation.expiresAt) : NaN;
      if (confirmation.connected !== true || !Number.isFinite(expiresAt) || expiresAt <= (this.options.now ?? Date.now)() || expiresAt > (this.options.now ?? Date.now)() + MCP_LIMITS.sessionMs + 1000) throw new McpError('AUTH_FAILED');
      auth.expiresAt = expiresAt;
      if (this.#auth !== auth || generation !== this.#generation) throw new McpError('DISCONNECTED');
      this.#pair = undefined; this.options.onConnected(auth.id, { expiresAt }); void this.#loop(auth); return auth.id;
    } catch (error) { if (this.#auth) await this.disconnect('Pairing could not be confirmed.'); throw error; }
    finally { this.#working = false; }
  }
  async #request(auth: Credentials, path: string, body: unknown, detached = false): Promise<Record<string, unknown>> {
    if (!detached && (this.#auth !== auth || !this.isSessionLive(auth.id))) throw new McpError('DISCONNECTED');
    const message: AuthMessage = { sessionId: auth.id, epoch: auth.epoch, seq: ++auth.seq, requestId: crypto.randomUUID(), method: 'POST', path, body }, keys = auth.keys;
    const mac = await signMessage(keys, 'request', message);
    if (!detached && this.#auth !== auth) throw new McpError('DISCONNECTED');
    const { method, path: unused, ...wire } = message;
    const response = await this.#json(path, { ...wire, mac }, detached ? 2000 : 25000);
    exactKeys(response, ['body', 'mac'], ['body', 'mac']);
    if (typeof response.mac !== 'string' || !await verifyMessage(keys, 'response', { ...message, body: response.body }, response.mac) || (!detached && this.#auth !== auth)) throw new McpError('AUTH_FAILED');
    record(response.body); return response.body;
  }
  async #loop(auth: Credentials): Promise<void> {
    try {
      while (this.#auth === auth) {
        const response = await this.#request(auth, '/v1/session/poll', {});
        exactKeys(response, ['command', 'rotation'], ['command']);
        if (response.command !== null) {
          record(response.command); exactKeys(response.command, ['requestId', 'tool', 'args'], ['requestId', 'tool', 'args']);
          const command = response.command as unknown as McpCommand;
          if (typeof command.requestId !== 'string' || command.requestId.length > 200) throw new McpError('INVALID_RESPONSE');
          validateToolArgs(command.tool, command.args);
          let result: McpResult; try { result = await this.options.onCommand(command, auth.id); } catch (error) { result = resultError(error); }
          if (this.#auth !== auth) return;
          await this.#request(auth, '/v1/session/result', { requestId: command.requestId, result });
        }
        if (response.rotation) {
          record(response.rotation); exactKeys(response.rotation, ['epoch', 'nonce'], ['epoch', 'nonce']);
          if (response.rotation.epoch !== auth.epoch + 1 || typeof response.rotation.nonce !== 'string') throw new McpError('AUTH_FAILED'); decode64(response.rotation.nonce, 32);
          const keys = await deriveEpoch(auth.master, auth.id, auth.epoch + 1, response.rotation.nonce);
          await this.#request(auth, '/v1/session/rotate', response.rotation);
          if (this.#auth !== auth) return; auth.epoch++; auth.keys = keys;
        }
      }
    } catch { if (this.#auth === auth) await this.disconnect('The connection ended or failed authentication. Pair again to continue.'); }
  }
  async disconnect(reason = 'Disconnected. Pending approvals are no longer valid.'): Promise<void> {
    const auth = this.#auth; this.#auth = undefined; this.#pair = undefined; this.#generation++;
    for (const controller of this.#requests) controller.abort(); this.#requests.clear();
    this.options.onDisconnected(reason);
    if (auth) try { await this.#request(auth, '/v1/session/revoke', {}, true); } catch { /* Browser authority is already revoked, even if the relay cannot be reached. */ }
  }
}
