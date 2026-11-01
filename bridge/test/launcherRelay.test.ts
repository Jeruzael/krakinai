import { describe, expect, it } from 'vitest';
import { createRelay } from '../src/relay';
import { BRIDGE_VERSION } from '../../src/domain/mcpProtocol';
import { createOffer } from '../../src/domain/mcpCrypto';

describe('launcher relay lifecycle projection', () => {
  it('reports native pairing without emitting bootstrap keys or library contents', async () => {
    const states: unknown[] = [];
    let deny: ((value: boolean) => void) | undefined;
    const relay = await createRelay({ port: 0, appOrigin: 'http://localhost:4183', bridgePath: 'synthetic',
      verifyNative: () => ({ decision: new Promise<boolean>(resolve => { deny = resolve; }), close() {} }),
      onState: state => states.push(state),
    });
    try {
      expect(states).toEqual([{ browser: 'not-paired' }]);
      const client = await createOffer();
      const response = await fetch(relay.url + '/v1/pair/start', { method: 'POST', headers: { origin: 'http://localhost:4183', 'content-type': 'application/json' }, body: JSON.stringify({ version: BRIDGE_VERSION, client: client.offer }) });
      expect(response.status).toBe(200);
      expect(states.at(-1)).toEqual({ browser: 'pairing' });
      deny!(false); await new Promise(resolve => setTimeout(resolve, 0));
      expect(states.at(-1)).toEqual({ browser: 'not-paired' });
      expect(JSON.stringify(states)).not.toMatch(/secret|transcript|project|challenge|code/i);
    } finally { await relay.close(); }
  });
  it('does not let an unavailable status consumer break the relay or grant access', async () => {
    const relay = await createRelay({ port: 0, appOrigin: 'http://localhost:4183', bridgePath: 'synthetic', verifyNative: () => ({ decision: Promise.resolve(false), close() {} }), onState: () => { throw Error('consumer gone'); } });
    try { expect(await relay.dispatch('krakinai_get_project', { projectId: 'synthetic' })).toMatchObject({ ok: false, error: { code: 'PAIRING_REQUIRED' } }); }
    finally { await relay.close(); }
  });
});
