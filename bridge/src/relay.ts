import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { BRIDGE_VERSION, MCP_LIMITS, McpError, exactKeys, record, resultData, resultError, validateOrigin, validateToolArgs, type McpCommand, type McpResult, type McpToolName } from '../../src/domain/mcpProtocol';
import { createOffer, decode64, deriveEpoch, deriveHandshake, checkProof, proof, randomSecret, signMessage, verifyMessage, type AuthMessage, type EpochKeys, type HandshakeKeys, type KeyOffer } from '../../src/domain/mcpCrypto';

export interface VerificationRequest { bridgePath: string; version: string; origin: string; relay: string; challengeId: string; secret: string; verificationCode: string }
export interface NativeVerification { decision: Promise<boolean>; close(): void }
export interface RelayOptions { port: number; appOrigin: string; bridgePath: string; verifyNative(info: VerificationRequest): NativeVerification; now?: () => number; onState?(state: { browser: 'not-paired' | 'pairing' | 'paired' | 'expired' }): void }
export interface RelayHandle { url: string; dispatch(tool: McpToolName, args: unknown): Promise<McpResult>; close(): Promise<void> }
interface Challenge { id: string; created: number; attempts: number; secret: string; keys: HandshakeKeys; transcript: unknown; native: NativeVerification; allowed: boolean }
interface Session { id: string; epoch: number; nonce: string; master: CryptoKey; keys: EpochKeys; created: number; activity: number; seen: number; rotated: number; seq: number; confirmed: boolean; rotation?: { epoch: number; nonce: string } }
interface Pending { command: McpCommand; sessionId: string; delivered: boolean; finish(result: McpResult): void }
class HttpError extends McpError { constructor(public status: number, code: string) { super(code); } }
function fail(status: number, code: string): never { throw new HttpError(status, code); }
const paths = new Set(['/v1/pair/start', '/v1/pair/proof', '/v1/session/confirm', '/v1/session/poll', '/v1/session/result', '/v1/session/rotate', '/v1/session/revoke']);
function offer(value: unknown): KeyOffer { record(value); exactKeys(value, ['publicKey', 'nonce'], ['publicKey', 'nonce']); if (typeof value.publicKey !== 'string' || typeof value.nonce !== 'string') fail(400, 'INVALID_REQUEST'); decode64(value.publicKey, 65); decode64(value.nonce, 32); return value as unknown as KeyOffer; }

export async function createRelay(options: RelayOptions): Promise<RelayHandle> {
  const appOrigin = validateOrigin(options.appOrigin), now = options.now ?? Date.now, instanceId = randomUUID();
  let url = '', closing = false, starting = false, challenge: Challenge | undefined, session: Session | undefined;
  let nativeAt = -Infinity, burstAt = now(), burstTokens = 8; const pairingStarts: number[] = [], transportTimes: number[] = [], toolTimes: number[] = [];
  const pending = new Map<string, Pending>(), queue: string[] = [];
  let poll: { sessionId: string; finish(command: McpCommand | null): void } | undefined;
  function notify(browser: 'not-paired' | 'pairing' | 'paired' | 'expired') { try { options.onState?.({ browser }); } catch { /* Status delivery must never alter authorization. */ } }
  function rate(times: number[], maximum: number, interval: number) { const cutoff = now() - interval; while (times.length && times[0] <= cutoff) times.shift(); if (times.length >= maximum) fail(429, 'RATE_LIMITED'); times.push(now()); }
  function clearChallenge() { const old = challenge; challenge = undefined; old?.native.close(); if (old) { old.secret = ''; if (!session) notify('not-paired'); } }
  function clearSession(code = 'DISCONNECTED') { session = undefined; for (const item of [...pending.values()]) item.finish(resultError(new McpError(code, 'The browser connection is no longer authorized. Pair again if needed.', true))); queue.length = 0; const old = poll; poll = undefined; old?.finish(null); notify(code === 'SESSION_EXPIRED' ? 'expired' : 'not-paired'); }
  function expire() {
    if (challenge && now() - challenge.created >= MCP_LIMITS.challengeMs) clearChallenge();
    if (session && (now() - session.created >= MCP_LIMITS.sessionMs || now() - session.activity >= MCP_LIMITS.idleMs)) clearSession('SESSION_EXPIRED');
    else if (session && now() - session.seen >= MCP_LIMITS.staleMs) clearSession('DISCONNECTED');
  }
  function nextCommand(): McpCommand | null { while (queue.length) { const item = pending.get(queue.shift()!); if (item && session?.id === item.sessionId) { item.delivered = true; return item.command; } } return null; }
  function flush() { if (poll) { const command = nextCommand(); if (command) { const old = poll; poll = undefined; old.finish(command); } } }
  function json(res: ServerResponse, status: number, value: unknown) { if (!res.writableEnded && !res.destroyed) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(value)); } }
  async function read(req: IncomingMessage): Promise<unknown> {
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json' || (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity')) fail(415, 'UNSUPPORTED_CONTENT');
    if (Number(req.headers['content-length'] ?? 0) > MCP_LIMITS.frame) fail(413, 'PAYLOAD_TOO_LARGE');
    const buffers: Buffer[] = []; let length = 0;
    for await (const part of req) { const bytes = Buffer.from(part); length += bytes.length; if (length > MCP_LIMITS.frame) fail(413, 'PAYLOAD_TOO_LARGE'); buffers.push(bytes); }
    try { return JSON.parse(Buffer.concat(buffers).toString('utf8')); } catch { return fail(400, 'INVALID_REQUEST'); }
  }
  async function authenticate(value: unknown, path: string): Promise<{ current: Session; message: AuthMessage }> {
    expire(); if (!session) fail(401, 'AUTH_FAILED');
    record(value); exactKeys(value, ['sessionId', 'epoch', 'seq', 'requestId', 'body', 'mac'], ['sessionId', 'epoch', 'seq', 'requestId', 'body', 'mac']);
    const current = session!;
    if (value.sessionId !== current.id || value.epoch !== current.epoch || !Number.isSafeInteger(value.seq) || (value.seq as number) <= current.seq || (value.seq as number) > current.seq + 32 || typeof value.requestId !== 'string' || !/^[A-Za-z0-9._:-]{1,200}$/.test(value.requestId) || typeof value.mac !== 'string') fail(401, 'AUTH_FAILED');
    const message: AuthMessage = { sessionId: current.id, epoch: current.epoch, seq: value.seq as number, requestId: value.requestId as string, method: 'POST', path, body: value.body };
    if (!await verifyMessage(current.keys, 'request', message, value.mac as string)) fail(401, 'AUTH_FAILED');
    expire();
    if (session !== current || message.epoch !== current.epoch || message.seq <= current.seq || message.seq > current.seq + 32) fail(401, 'AUTH_FAILED');
    current.seq = message.seq; current.seen = now(); return { current, message };
  }
  async function handler(req: IncomingMessage, res: ServerResponse) {
    try {
      if (closing) fail(503, 'DISCONNECTED');
      if (req.headers.host !== new URL(url).host || req.headers.origin !== appOrigin) fail(403, 'ORIGIN_DENIED');
      if (!req.url || !paths.has(req.url)) fail(404, 'UNKNOWN_ROUTE');
      res.setHeader('access-control-allow-origin', appOrigin); res.setHeader('vary', 'Origin');
      rate(transportTimes, 120, 60000); expire();
      if (req.method === 'OPTIONS') {
        if (req.headers['access-control-request-method'] !== 'POST' || String(req.headers['access-control-request-headers'] ?? '').toLowerCase().split(',').some(h => h.trim() && h.trim() !== 'content-type')) fail(403, 'ORIGIN_DENIED');
        res.writeHead(204, { 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', 'cache-control': 'no-store' }); res.end(); return;
      }
      if (req.method !== 'POST') fail(405, 'METHOD_DENIED');
      const path = req.url, value = await read(req);
      if (path === '/v1/pair/start') {
        record(value); exactKeys(value, ['version', 'client'], ['version', 'client']);
        if (value.version !== BRIDGE_VERSION) fail(400, 'PROTOCOL_VERSION');
        if (session || challenge || starting) fail(409, 'PAIRING_BUSY');
        if (now() - nativeAt < 30000) fail(429, 'RATE_LIMITED'); rate(pairingStarts, 5, 300000);
        const client = offer(value.client); starting = true; nativeAt = now();
        try {
          const server = await createOffer(), secret = randomSecret(), challengeId = randomUUID();
          const transcript = { version: BRIDGE_VERSION, instanceId, challengeId, origin: appOrigin, relay: url, client, server: server.offer };
          const keys = await deriveHandshake(secret, server.privateKey, client.publicKey, transcript);
          const native = options.verifyNative({ bridgePath: options.bridgePath, version: '1.0.0', origin: appOrigin, relay: url, challengeId, secret, verificationCode: keys.transcriptDigest.slice(0, 12) });
          const current: Challenge = { id: challengeId, created: now(), attempts: 0, secret, keys, transcript, native, allowed: false }; challenge = current; notify('pairing');
          void native.decision.then(allowed => { if (challenge === current) { if (allowed) current.allowed = true; else clearChallenge(); } }, () => { if (challenge === current) clearChallenge(); });
          json(res, 200, { transcript, expiresAt: new Date(current.created + MCP_LIMITS.challengeMs).toISOString(), verificationCode: keys.transcriptDigest.slice(0, 12) });
        } finally { starting = false; }
        return;
      }
      if (path === '/v1/pair/proof') {
        record(value); exactKeys(value, ['challengeId', 'proof'], ['challengeId', 'proof']);
        const current = challenge;
        if (!current || value.challengeId !== current.id || typeof value.proof !== 'string') fail(401, 'AUTH_FAILED');
        if (++current.attempts > 5) { clearChallenge(); fail(401, 'AUTH_FAILED'); }
        const verified = await checkProof(current.keys, 'client', value.proof as string);
        expire(); if (!verified || challenge !== current) { if (current.attempts >= 5) clearChallenge(); fail(401, 'AUTH_FAILED'); }
        if (!current.allowed) fail(409, 'NATIVE_APPROVAL_PENDING');
        const sessionId = randomUUID(), epochNonce = randomSecret(), keys = await deriveEpoch(current.keys.master, sessionId, 0, epochNonce), serverProof = await proof(current.keys, 'server');
        expire(); if (challenge !== current || session) fail(401, 'AUTH_FAILED');
        session = { id: sessionId, epoch: 0, nonce: epochNonce, master: current.keys.master, keys, created: now(), activity: now(), seen: now(), rotated: now(), seq: 0, confirmed: false };
        clearChallenge(); json(res, 200, { sessionId, epochNonce, proof: serverProof, expiresAt: new Date(session.created + MCP_LIMITS.sessionMs).toISOString() }); return;
      }
      const { current, message } = await authenticate(value, path); record(message.body); let body: unknown;
      const responseKeys = current.keys;
      if (path === '/v1/session/confirm') { exactKeys(message.body, []); current.confirmed = true; notify('paired'); body = { connected: true, expiresAt: new Date(current.created + MCP_LIMITS.sessionMs).toISOString() }; }
      else {
        if (!current.confirmed) fail(401, 'AUTH_FAILED');
        if (path === '/v1/session/revoke') { exactKeys(message.body, []); clearSession(); body = { disconnected: true }; }
        else if (path === '/v1/session/result') {
          exactKeys(message.body, ['requestId', 'result'], ['requestId', 'result']);
          const item = pending.get(String(message.body.requestId));
          if (!item || !item.delivered || item.sessionId !== current.id) fail(400, 'INVALID_RESULT');
          const result = message.body.result; record(result);
          if (result.apiVersion !== 'krakinai.mcp.v1' || typeof result.ok !== 'boolean' || Buffer.byteLength(JSON.stringify(result)) > MCP_LIMITS.result) fail(400, 'INVALID_RESULT');
          exactKeys(result, result.ok ? ['apiVersion', 'ok', 'data'] : ['apiVersion', 'ok', 'error'], result.ok ? ['apiVersion', 'ok', 'data'] : ['apiVersion', 'ok', 'error']);
          item.finish(result as McpResult); current.activity = now(); body = { received: true };
        } else if (path === '/v1/session/poll') {
          exactKeys(message.body, []); if (poll) fail(409, 'POLL_BUSY');
          let command = nextCommand();
          if (!command) command = await new Promise<McpCommand | null>(resolve => {
            const timer = setTimeout(() => { if (poll?.sessionId === current.id) poll = undefined; resolve(null); }, MCP_LIMITS.pollMs);
            poll = { sessionId: current.id, finish(value) { clearTimeout(timer); resolve(value); } };
            res.once('close', () => { if (poll?.sessionId === current.id) { poll = undefined; clearTimeout(timer); resolve(null); } });
          });
          if (session !== current) fail(401, 'AUTH_FAILED');
          if (now() - current.rotated >= MCP_LIMITS.rotateMs) current.rotation ??= { epoch: current.epoch + 1, nonce: randomSecret() };
          body = { command, ...(current.rotation ? { rotation: current.rotation } : {}) };
        } else if (path === '/v1/session/rotate') {
          exactKeys(message.body, ['epoch', 'nonce'], ['epoch', 'nonce']);
          const target = current.rotation;
          if (!target || target.epoch !== message.body.epoch || target.nonce !== message.body.nonce) fail(401, 'AUTH_FAILED');
          const keys = await deriveEpoch(current.master, current.id, target.epoch, target.nonce);
          if (session !== current) fail(401, 'AUTH_FAILED');
          current.keys = keys; current.epoch = target.epoch; current.nonce = target.nonce; current.rotation = undefined; current.rotated = now(); body = { rotated: true };
        } else fail(404, 'UNKNOWN_ROUTE');
      }
      const mac = await signMessage(responseKeys, 'response', { ...message, body });
      json(res, 200, { body, mac });
    } catch (error) {
      const e = error instanceof McpError ? error : new McpError('REQUEST_FAILED');
      res.setHeader('connection', 'close'); req.resume(); json(res, error instanceof HttpError ? error.status : 400, resultError(e));
    }
  }
  const server = createServer({ maxHeaderSize: 8192, connectionsCheckingInterval: 1000 }, (req, res) => { void handler(req, res); });
  server.maxConnections = 32;
  server.headersTimeout = 5000; server.requestTimeout = 10000; server.keepAliveTimeout = 5000;
  server.on('clientError', (_error, socket) => { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(options.port, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
  const address = server.address(); if (!address || typeof address === 'string') throw new McpError('STARTUP_FAILED');
  url = `http://127.0.0.1:${address.port}`;
  notify('not-paired');
  const expiryTimer = setInterval(expire, 1000); expiryTimer.unref();
  return {
    url,
    async dispatch(tool, raw) {
      try {
        expire();
        burstTokens = Math.min(8, burstTokens + Math.max(0, now() - burstAt) / 2000); burstAt = now();
        if (burstTokens < 1) throw new McpError('RATE_LIMITED', 'The local tool burst limit was reached. Retry shortly.', true);
        burstTokens--; rate(toolTimes, 30, 60000); const args = validateToolArgs(tool, raw);
        if (!session?.confirmed) { if (tool === 'krakinai_connection_status') return resultData({ connected: false, state: 'disconnected', apiVersion: BRIDGE_VERSION, manualImportAvailable: true }); throw new McpError('PAIRING_REQUIRED', 'Connect and approve permissions in KRAKINAI first.', true); }
        if (pending.size >= MCP_LIMITS.requests) throw new McpError('QUEUE_FULL', 'The local request queue is full. Retry after pending requests finish.', true);
        const command: McpCommand = { requestId: randomUUID(), tool, args }, sessionId = session.id;
        return await new Promise<McpResult>(resolve => {
          const timer = setTimeout(() => { pending.get(command.requestId)?.finish(resultError(new McpError('TOOL_TIMEOUT', 'The browser did not answer in time. No application success is confirmed.', true))); }, MCP_LIMITS.toolMs);
          pending.set(command.requestId, { command, sessionId, delivered: false, finish(value) { clearTimeout(timer); pending.delete(command.requestId); const index = queue.indexOf(command.requestId); if (index >= 0) queue.splice(index, 1); resolve(value); } });
          queue.push(command.requestId); flush();
        });
      } catch (error) { return resultError(error); }
    },
    async close() { if (closing) return; closing = true; clearInterval(expiryTimer); clearChallenge(); clearSession(); await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); },
  };
}
