import { createConnection } from 'node:net';

/** Only connection refusal proves closed. HTTP status/slow replies/timeouts do not. */
export async function probeLoopbackPort(port) {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw Error('INVALID_TEST_PORT');
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(1500, () => { socket.destroy(); reject(Error('PORT_PROBE_INDETERMINATE')); });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', error => { socket.destroy(); if (error.code === 'ECONNREFUSED') resolve(false); else reject(Error('PORT_PROBE_INDETERMINATE')); });
  });
}
