import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { LAUNCHER_VERSION, type LauncherFrame } from '../src/launcherProtocol';
class SyntheticChannel extends EventEmitter {
  sent: LauncherFrame[] = []; closed = false;
  send(frame: LauncherFrame) { this.sent.push(frame); }
  onFrame(callback: (frame: LauncherFrame) => void) { this.on('frame', callback); }
  onClose(callback: () => void) { this.on('closed', callback); }
  close() { if (!this.closed) { this.closed = true; this.emit('closed'); } }
  status(generation = 'none', bridge = 'stopped') {
    this.emit('frame', { version: LAUNCHER_VERSION, kind: 'status', generation, connectionId: this.sent[0].connectionId, requestId: this.sent[0].requestId,
      state: { bridge, browser: 'not-paired', mcp: false, origin: 'http://localhost:5173', relay: 'http://127.0.0.1:4180' } });
  }
}
async function implementation() {
  expect(existsSync('src/stdioAdapter.ts'), 'persistent adapter implemented').toBe(true);
  return import('../src/stdioAdapter');
}
describe('persistent launcher MCP adapter', () => {
  it('correlates hello rejection and reports a safe conflict diagnostic without changing tool envelopes', async () => {
    const { PersistentAdapter } = await implementation(); const channel = new SyntheticChannel(), onDiagnostic = vi.fn();
    const adapter = new PersistentAdapter({ origin: 'http://localhost:5173', relay: 'http://127.0.0.1:4180', openChannel: async () => channel, onDiagnostic });
    try {
      adapter.start(); adapter.initialized(); await vi.waitFor(() => expect(channel.sent).toHaveLength(1));
      const hello = channel.sent[0];
      channel.emit('frame', { version: LAUNCHER_VERSION, kind: 'error', generation: hello.generation, connectionId: hello.connectionId, requestId: hello.requestId, code: 'CLIENT_ALREADY_CONNECTED' });
      expect(onDiagnostic).toHaveBeenCalledTimes(1); expect(onDiagnostic).toHaveBeenCalledWith('CLIENT_ALREADY_CONNECTED');
      expect(channel.closed).toBe(true);
      expect(await adapter.dispatch('krakinai_get_project', { projectId: 'synthetic' })).toMatchObject({ ok: false, error: { code: 'PAIRING_REQUIRED' } });
    } finally { adapter.close(); }
  });
  it('never presents an uncorrelated hello error as an operator diagnostic', async () => {
    const { PersistentAdapter } = await implementation(); const channel = new SyntheticChannel(), onDiagnostic = vi.fn();
    const adapter = new PersistentAdapter({ origin: 'http://localhost:5173', relay: 'http://127.0.0.1:4180', openChannel: async () => channel, onDiagnostic });
    try {
      adapter.start(); await vi.waitFor(() => expect(channel.sent).toHaveLength(1)); const hello = channel.sent[0];
      channel.emit('frame', { version: LAUNCHER_VERSION, kind: 'error', generation: hello.generation, connectionId: hello.connectionId, requestId: 'wrong-request', code: 'CLIENT_ALREADY_CONNECTED' });
      expect(onDiagnostic).not.toHaveBeenCalled(); expect(channel.closed).toBe(true);
    } finally { adapter.close(); }
  });
  it('returns existing disconnected envelopes immediately while launcher is absent and bounds retries', async () => {
    const { PersistentAdapter } = await implementation(); vi.useFakeTimers();
    const openChannel = vi.fn().mockRejectedValue(Error('absent'));
    const adapter = new PersistentAdapter({ origin: 'http://localhost:5173', relay: 'http://127.0.0.1:4180', openChannel });
    try {
      adapter.start(); adapter.initialized(); await vi.advanceTimersByTimeAsync(0);
      expect(await adapter.dispatch('krakinai_connection_status', {})).toMatchObject({ ok: true, data: { connected: false, state: 'disconnected' } });
      expect(await adapter.dispatch('krakinai_get_project', { projectId: 'synthetic' })).toMatchObject({ ok: false, error: { code: 'PAIRING_REQUIRED' } });
      await vi.advanceTimersByTimeAsync(4999); expect(openChannel).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1); expect(openChannel).toHaveBeenCalledTimes(2);
    } finally { adapter.close(); vi.useRealTimers(); }
  });
  it('uses actual SDK initialization separately from pipe hello and never sends activation', async () => {
    const { PersistentAdapter } = await implementation(); const channel = new SyntheticChannel();
    const adapter = new PersistentAdapter({ origin: 'http://localhost:5173', relay: 'http://127.0.0.1:4180', openChannel: async () => channel });
    try {
      adapter.start(); await vi.waitFor(() => expect(channel.sent).toHaveLength(1)); channel.status();
      expect(channel.sent.map(frame => frame.kind)).toEqual(['hello']);
      adapter.initialized(); expect(channel.sent.map(frame => frame.kind)).toEqual(['hello', 'initialized']);
      channel.status('generation1', 'running');
      const call = adapter.dispatch('krakinai_connection_status', {}); const request = channel.sent.at(-1)!;
      expect(request).toMatchObject({ kind: 'call', generation: 'generation1' });
      channel.emit('frame', { version: LAUNCHER_VERSION, kind: 'result', generation: request.generation, connectionId: request.connectionId, requestId: request.requestId,
        result: { apiVersion: 'krakinai.mcp.v1', ok: true, data: { connected: false, exact: '日本語 🎬\r\n' } } });
      expect(await call).toMatchObject({ ok: true, data: { exact: '日本語 🎬\r\n' } });
      expect(channel.sent.some(frame => ['activate', 'shutdown', 'approve'].includes(frame.kind))).toBe(false);
    } finally { adapter.close(); }
  });
  it('fails old calls on generation change and never substitutes a later call response', async () => {
    const { PersistentAdapter } = await implementation(); const channel = new SyntheticChannel();
    const adapter = new PersistentAdapter({ origin: 'http://localhost:5173', relay: 'http://127.0.0.1:4180', openChannel: async () => channel });
    try {
      adapter.start(); adapter.initialized(); await vi.waitFor(() => expect(channel.sent.length).toBeGreaterThan(0)); channel.status('generation1', 'running');
      const first = adapter.dispatch('krakinai_get_project', { projectId: 'first' }); const old = channel.sent.at(-1)!;
      channel.status('generation2', 'running'); expect(await first).toMatchObject({ ok: false, error: { code: 'HOST_CHANGED' } });
      channel.emit('frame', { version: LAUNCHER_VERSION, kind: 'result', generation: old.generation, connectionId: old.connectionId, requestId: old.requestId,
        result: { apiVersion: 'krakinai.mcp.v1', ok: true, data: { wrong: true } } });
      expect(channel.closed).toBe(false);
      const second = adapter.dispatch('krakinai_get_project', { projectId: 'second' }); const next = channel.sent.at(-1)!;
      expect(next.requestId).not.toBe(old.requestId); channel.close();
      expect(await second).toMatchObject({ ok: false, error: { code: 'DISCONNECTED' } });
    } finally { adapter.close(); }
  });
  it('refuses mismatched application configuration and unknown response IDs', async () => {
    const { PersistentAdapter } = await implementation(); const channel = new SyntheticChannel();
    const adapter = new PersistentAdapter({ origin: 'http://localhost:5173', relay: 'http://127.0.0.1:4180', openChannel: async () => channel });
    try {
      adapter.start(); await vi.waitFor(() => expect(channel.sent.length).toBeGreaterThan(0));
      channel.emit('frame', { version: LAUNCHER_VERSION, kind: 'status', generation: 'none', connectionId: channel.sent[0].connectionId, requestId: 'status1',
        state: { bridge: 'stopped', browser: 'not-paired', mcp: false, origin: 'http://127.0.0.1:5173', relay: 'http://127.0.0.1:4180' } });
      expect(channel.closed).toBe(true);
    } finally { adapter.close(); }
  });
});
