import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { probeLoopbackPort } from './launcher-port-probe.mjs';
test('a silent listener remains running without an HTTP response', async () => {
  const server = createServer(socket => socket.end()); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try { assert.equal(await probeLoopbackPort(port), true); } finally { await new Promise(r => server.close(r)); }
  assert.equal(await probeLoopbackPort(port), false);
});
test('invalid ports cannot turn this into address discovery', async () => {
  for (const port of [0, -1, 65536, '54183']) await assert.rejects(() => probeLoopbackPort(port));
});
