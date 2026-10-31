// Synthetic-only verifier for CI. Pairing secrets travel only through inherited
// anonymous fd3, never through MCP, stdout, stderr, files, arguments or URLs.
import { writeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startStdioBridge } from '../src/runtime';
const origin = process.argv[2], port = Number(process.argv[3]);
if (!origin || !Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('SYNTHETIC_SETUP_ERROR');
await startStdioBridge({ port, appOrigin: origin, bridgePath: fileURLToPath(import.meta.url), verifyNative(info) { writeSync(3, `${JSON.stringify(info)}\n`); return { decision: Promise.resolve(true), close() {} }; } });
