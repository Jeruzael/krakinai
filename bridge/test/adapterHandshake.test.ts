import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
describe('actual SDK negotiation drives adapter connection evidence', () => {
  for (const mode of ['default', 'legacy'] as const) it(mode + ' negotiation establishes initialization through the real SDK', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('qa-results/synthetic-runtime/adapter-server.mjs')], stderr: 'pipe' });
    let metadata = ''; transport.stderr?.on('data', bytes => metadata += String(bytes));
    const client = new Client({ name: 'synthetic-handshake-' + mode, version: '1.0.0' }, mode === 'legacy' ? { versionNegotiation: { mode: 'legacy' } } : {});
    try {
      await client.connect(transport); expect((await client.listTools()).tools).toHaveLength(13);
      await vi.waitFor(() => expect(metadata).toContain('SYNTHETIC_ADAPTER_INITIALIZED'), { timeout: 1500 });
    } finally { await client.close(); }
  });
});
