import { canonicalStringify } from './changeSetCanonical';
import { McpError } from './mcpProtocol';

const utf8 = (value: string) => new TextEncoder().encode(value);
export function base64url(bytes: Uint8Array): string { return btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function decode64(value: string, length: number): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length !== Math.ceil(length * 8 / 6)) throw new McpError('AUTH_FAILED');
  try { const bytes = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0)); if (bytes.length !== length || base64url(bytes) !== value) throw new Error(); return bytes; } catch { throw new McpError('AUTH_FAILED'); }
}
export function randomSecret(): string { return base64url(crypto.getRandomValues(new Uint8Array(32))); }
export interface KeyOffer { publicKey: string; nonce: string }
export async function createOffer(): Promise<{ offer: KeyOffer; privateKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  return { offer: { publicKey: base64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))), nonce: randomSecret() }, privateKey: pair.privateKey };
}
export interface HandshakeKeys { master: CryptoKey; clientProofKey: CryptoKey; serverProofKey: CryptoKey; transcriptDigest: string }
export interface EpochKeys { request: CryptoKey; response: CryptoKey }
async function hmacKey(bytes: Uint8Array<ArrayBuffer>): Promise<CryptoKey> { return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
async function deriveMac(master: CryptoKey, salt: Uint8Array<ArrayBuffer>, info: unknown): Promise<CryptoKey> { return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: utf8(canonicalStringify(info)) }, master, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign', 'verify']); }
export async function deriveHandshake(secret: string, privateKey: CryptoKey, remotePublicKey: string, transcript: unknown): Promise<HandshakeKeys> {
  const secretBytes = decode64(secret, 32); let shared: ArrayBuffer | undefined, derived: ArrayBuffer | undefined;
  try {
    const remote = await crypto.subtle.importKey('raw', decode64(remotePublicKey, 65), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: remote }, privateKey, 256);
    const transcriptBytes = utf8(canonicalStringify(transcript));
    const salt = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secretBytes), transcriptBytes));
    const ikm = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
    derived = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: utf8('krakinai.bridge.v1/master') }, ikm, 256);
    const master = await crypto.subtle.importKey('raw', derived, 'HKDF', false, ['deriveKey']);
    return { master, transcriptDigest: base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', transcriptBytes))), clientProofKey: await deriveMac(master, salt, 'krakinai.bridge.v1/client-proof'), serverProofKey: await deriveMac(master, salt, 'krakinai.bridge.v1/server-proof') };
  } catch { throw new McpError('AUTH_FAILED', 'Pairing proof could not be established. Pair again with the trusted local bridge.'); }
  finally { secretBytes.fill(0); if(shared)new Uint8Array(shared).fill(0); if(derived)new Uint8Array(derived).fill(0); }
}
export async function proof(keys: HandshakeKeys, side: 'client' | 'server'): Promise<string> { return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', side === 'client' ? keys.clientProofKey : keys.serverProofKey, utf8(keys.transcriptDigest)))); }
export async function checkProof(keys: HandshakeKeys, side: 'client' | 'server', value: string): Promise<boolean> { try { return await crypto.subtle.verify('HMAC', side === 'client' ? keys.clientProofKey : keys.serverProofKey, decode64(value, 32), utf8(keys.transcriptDigest)); } catch { return false; } }
export async function deriveEpoch(master: CryptoKey, sessionId: string, epoch: number, nonce: string): Promise<EpochKeys> {
  const salt = utf8(nonce), context = { version: 'krakinai.bridge.v1', sessionId, epoch };
  return { request: await deriveMac(master, salt, { ...context, purpose: 'request' }), response: await deriveMac(master, salt, { ...context, purpose: 'response' }) };
}
export interface AuthMessage { sessionId: string; epoch: number; seq: number; requestId: string; method: string; path: string; body: unknown }
async function signedBytes(message: AuthMessage): Promise<Uint8Array<ArrayBuffer>> {
  const { body, ...metadata } = message;
  const bodyDigest = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(canonicalStringify(body)))));
  return utf8(canonicalStringify({ version: 'krakinai.bridge.v1', ...metadata, bodyDigest }));
}
export async function signMessage(keys: EpochKeys, direction: 'request' | 'response', message: AuthMessage): Promise<string> { return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', keys[direction], await signedBytes(message)))); }
export async function verifyMessage(keys: EpochKeys, direction: 'request' | 'response', message: AuthMessage, mac: string): Promise<boolean> { try { return await crypto.subtle.verify('HMAC', keys[direction], decode64(mac, 32), await signedBytes(message)); } catch { return false; } }
