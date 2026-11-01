import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LAUNCHER_VERSION, LauncherLineDecoder, type LauncherFrame } from '../src/launcherProtocol';

async function unusedPort() { const s = createServer(); await new Promise<void>(r => s.listen(0, '127.0.0.1', r)); const port = (s.address() as { port: number }).port; await new Promise<void>(r => s.close(() => r())); return port; }
describe('production managed host process', () => {
  it('keeps its port free before activation, acknowledges the real relay, and shuts it down', async () => {
    const port = await unusedPort(), generation = randomBytes(16).toString('hex');
    const child = spawn(process.execPath, [resolve(process.env.KRAKINAI_TEST_BRIDGE_DIST ?? 'dist', 'krakinai-managed-host.mjs'), '--app-origin', 'http://localhost:4183', '--port', String(port), '--generation', generation], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const decoder = new LauncherLineDecoder('host-response'), frames: LauncherFrame[] = [];
    let protocolError: unknown;
    child.stdout.on('data', chunk => { try { frames.push(...decoder.push(chunk)); } catch (e) { protocolError = e; } }); child.stderr.resume(); child.stdin.on('error', () => {});
    const send = (kind: string, requestId: string, extra = {}) => child.stdin.write(JSON.stringify({ version: LAUNCHER_VERSION, generation, connectionId: 'host', requestId, kind, ...extra }) + '\n');
    const closed = new Promise<number | null>(r => child.once('exit', r));
    try {
      await new Promise(r => setTimeout(r, 150));
      const probe = createServer(); await new Promise<void>((r, j) => { probe.once('error', j); probe.listen(port, '127.0.0.1', r); }); await new Promise<void>(r => probe.close(() => r()));
      expect(frames).toEqual([]);
      send('activate', 'activate_1');
      await expect.poll(() => frames.some(f => f.kind === 'ready')).toBe(true);
      send('call', 'status_1', { tool: 'krakinai_connection_status', args: {} });
      await expect.poll(() => frames.some(f => f.kind === 'result')).toBe(true);
      expect(frames.find(f => f.kind === 'result')).toMatchObject({ generation, requestId: 'status_1', kind: 'result', result: { ok: true, data: { connected: false } } });
      send('shutdown', 'stop_1'); expect(await closed).toBe(0);
      expect(protocolError).toBeUndefined();
      expect(frames.at(-1)).toMatchObject({ kind: 'stopped', requestId: 'stop_1' });
      const after = createServer(); await new Promise<void>((r, j) => { after.once('error', j); after.listen(port, '127.0.0.1', r); }); await new Promise<void>(r => after.close(() => r()));
    } finally { if (child.exitCode === null) child.kill(); }
  });
  it('rejects a production verifier-bypass flag instead of exposing a test channel', async () => {
    const child = spawn(process.execPath, [resolve(process.env.KRAKINAI_TEST_BRIDGE_DIST ?? 'dist', 'krakinai-managed-host.mjs'), '--app-origin', 'http://localhost:4183', '--port', String(await unusedPort()), '--generation', randomBytes(16).toString('hex'), '--skip-native', 'true'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stderr.resume(); let out = ''; child.stdout.on('data', b => { out += String(b); });
    expect(await new Promise<number | null>(r => child.once('exit', r))).not.toBe(0); expect(out).toBe('');
  });
});
