import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LAUNCHER_VERSION, validateLauncherFrame, type LauncherFrame } from '../src/launcherProtocol';

const header = { version: LAUNCHER_VERSION, generation: 'synthetic_generation', connectionId: 'host', requestId: 'request_1' };
async function setup() {
  expect(existsSync(resolve('src/managedHost.ts')), 'managed host is implemented').toBe(true);
  const { runManagedHost } = await import('../src/managedHost');
  const sent: LauncherFrame[] = []; let nativeCalls = 0;
  const host = runManagedHost({ generation: header.generation, port: 0, appOrigin: 'http://localhost:4183', bridgePath: 'synthetic', verifyNative() { nativeCalls++; return { decision: Promise.resolve(false), close() {} }; } }, { send(frame) { sent.push(frame); } });
  return { host, sent, nativeCalls: () => nativeCalls };
}
describe('managed bridge host uses the existing relay', () => {
  it('does not activate a relay/native helper merely because a tool arrives', async () => {
    const env = await setup();
    try {
      await env.host.receive({ ...header, kind: 'call', tool: 'krakinai_get_project', args: { projectId: 'synthetic' } });
      expect(env.nativeCalls()).toBe(0);
      expect(env.sent).not.toContainEqual(expect.objectContaining({ kind: 'ready' }));
      expect(env.sent.at(-1)).toMatchObject({ kind: 'result', result: { ok: false, error: { code: 'DISCONNECTED' } } });
      expect(() => validateLauncherFrame(env.sent.at(-1), 'host-response')).not.toThrow();
    } finally { await env.host.close(); }
  });
  it('only becomes running after parent activation and still requires browser pairing', async () => {
    const env = await setup();
    try {
      await env.host.receive({ ...header, kind: 'activate' });
      const ready = env.sent.find(frame => frame.kind === 'ready'); expect(ready?.kind).toBe('ready');
      if (ready?.kind !== 'ready') throw Error('No host acknowledgement');
      const response = await fetch(ready.relay + '/unknown', { headers: { origin: 'http://localhost:4183' } });
      expect(response.status).toBe(404);
      await env.host.receive({ ...header, requestId: 'call_1', kind: 'call', tool: 'krakinai_get_project', args: { projectId: 'synthetic' } });
      expect(env.sent.at(-1)).toMatchObject({ generation: header.generation, requestId: 'call_1', kind: 'result', result: { ok: false, error: { code: 'PAIRING_REQUIRED' } } });
      await env.host.receive({ ...header, requestId: 'stop_1', kind: 'shutdown' });
      expect(env.sent.at(-1)).toMatchObject({ requestId: 'stop_1', kind: 'stopped' });
      await expect(fetch(ready.relay + '/unknown')).rejects.toThrow();
    } finally { await env.host.close(); }
  });
  it('rejects a wrong host generation and control frames from an adapter identity', async () => {
    const env = await setup();
    try {
      await expect(env.host.receive({ ...header, generation: 'old_generation', kind: 'activate' })).rejects.toThrow();
      await expect(env.host.receive({ ...header, connectionId: 'model_client', kind: 'activate' })).rejects.toThrow();
      expect(env.nativeCalls()).toBe(0); expect(env.sent).toEqual([]);
    } finally { await env.host.close(); }
  });
  it('does not publish running after shutdown wins an activation race', async () => {
    const env = await setup();
    const start = env.host.receive({ ...header, kind: 'activate' });
    await env.host.close(); await start;
    expect(env.sent.some(frame => frame.kind === 'ready')).toBe(false);
    await expect(env.host.receive({ ...header, requestId: 'second', kind: 'activate' })).rejects.toThrow();
  });
});
