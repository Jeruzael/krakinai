import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCP_LIMITS, resultData } from '../../src/domain/mcpProtocol';

async function protocol() {
  expect(existsSync(resolve('src/launcherProtocol.ts')), 'launcher protocol is implemented').toBe(true);
  return import('../src/launcherProtocol');
}
const base = { version: 'krakinai.launcher.v1', generation: 'generation_1', connectionId: 'client_1', requestId: 'request_1' };
const call = () => ({ ...base, kind: 'call', tool: 'krakinai_get_project', args: { projectId: 'synthetic_project' } });

describe('private launcher protocol boundary', () => {
  it('accepts an existing tool request without inventing another authorization path', async () => {
    const p = await protocol();
    expect(p.validateLauncherFrame(call(), 'adapter-request')).toEqual(call());
    expect(() => p.validateLauncherFrame({ ...call(), args: { projectId: 'p', approved: true } }, 'adapter-request')).toThrow();
  });
  it.each(['activate', 'shutdown', 'approve', 'start', 'stop'])('rejects model-side %s control messages', async kind => {
    const p = await protocol();
    expect(() => p.validateLauncherFrame({ ...base, kind }, 'adapter-request')).toThrow();
  });
  it('permits host activation only on the private parent input channel', async () => {
    const p = await protocol(), frame = { ...base, kind: 'activate' };
    expect(p.validateLauncherFrame(frame, 'host-request')).toEqual(frame);
    expect(() => p.validateLauncherFrame({ ...frame, approved: true }, 'host-request')).toThrow();
  });
  it('validates version, correlation identifiers and request result envelopes', async () => {
    const p = await protocol();
    for (const patch of [{ version: 'unknown' }, { requestId: '' }, { generation: 'bad\nvalue' }, { connectionId: 'x'.repeat(81) }]) {
      expect(() => p.validateLauncherFrame({ ...call(), ...patch }, 'adapter-request')).toThrow();
    }
    const frame = { ...base, kind: 'result', result: resultData({ exact: 'synthetic\ntext' }) };
    expect(p.validateLauncherFrame(frame, 'host-response')).toEqual(frame);
    expect(() => p.validateLauncherFrame({ ...frame, result: { ...frame.result, approved: true } }, 'host-response')).toThrow();
    expect(() => p.validateLauncherFrame({ ...frame, result: { apiVersion: 'krakinai.mcp.v1', ok: true, data: 'x'.repeat(MCP_LIMITS.result) } }, 'host-response')).toThrow();
  });
  it('keeps host telemetry content-free and rejects data-bearing status fields', async () => {
    const p = await protocol();
    expect(p.validateLauncherFrame({ ...base, kind: 'state', state: { browser: 'paired' } }, 'host-response')).toBeDefined();
    for (const extra of [{ secret: 'never-log-this' }, { projects: [] }, { prompt: 'private' }]) {
      expect(() => p.validateLauncherFrame({ ...base, kind: 'state', state: { browser: 'paired', ...extra } }, 'host-response')).toThrow();
    }
  });
  it('decodes split Unicode and multiple frames without changing exact text', async () => {
    const p = await protocol(), decoder = new p.LauncherLineDecoder('host-response');
    const frame = { ...base, kind: 'result', result: resultData({ text: 'synthetic 日本語\n🎬' }) };
    const wire = Buffer.from(JSON.stringify(frame) + '\n' + JSON.stringify(frame) + '\n');
    const found = [];
    for (let i = 0; i < wire.length; i += 3) found.push(...decoder.push(wire.subarray(i, i + 3)));
    expect(found).toEqual([frame, frame]);
  });
  it('rejects oversized unfinished frames before decoding or parsing them', async () => {
    const p = await protocol(), decoder = new p.LauncherLineDecoder('adapter-request');
    decoder.push(Buffer.alloc(MCP_LIMITS.frame - 1, 120));
    expect(() => decoder.push(Buffer.from('xx'))).toThrow();
  });
  it('rejects malformed UTF-8, malformed JSON and excessive batch bytes', async () => {
    const p = await protocol();
    for (const wire of [Buffer.from([0x7b, 0xff, 0x7d, 0x0a]), Buffer.from('not json\n'), Buffer.alloc(8388609, 32)]) {
      expect(() => new p.LauncherLineDecoder('adapter-request').push(wire)).toThrow();
    }
  });
  it('bounds queued output until the consumer drains it', async () => {
    const p = await protocol(), budget = new p.LauncherQueueBudget();
    budget.add(8388608);
    expect(() => budget.add(1)).toThrow();
    budget.release(8388608); budget.add(1);
    expect(budget.bytes).toBe(1);
    expect(() => budget.release(2)).toThrow();
  });
});
