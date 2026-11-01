import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { describe, expect, it } from 'vitest';
const entry = () => resolve(process.env.KRAKINAI_TEST_BRIDGE_DIST ?? 'dist', 'krakinai-stdio-adapter.mjs');
describe('compiled persistent adapter SDK process', () => {
  it.skipIf(process.platform !== 'win32')('registers all thirteen tools while the configured native launcher is absent', async () => {
    const parent = resolve(process.env.KRAKINAI_PRIVATE_CONFIG_TEST_ROOT ?? 'qa-results/desktop-launcher-adapter', 'sdk'); await mkdir(parent, { recursive: true });
    const directory = await mkdtemp(resolve(parent, 'sdk-')), config = resolve(directory, 'settings.json');
    await writeFile(config, JSON.stringify({ formatVersion: 1, installationId: '1234567890abcdef1234567890abcdef', nativeExecutable: resolve(directory, 'absent.exe'), approvedSignerThumbprint: 'A'.repeat(40), appOrigin: 'http://localhost:5173', relayPort: 4180 }));
    const transport = new StdioClientTransport({ command: process.execPath, args: [entry(), '--config', config], stderr: 'pipe' });
    let diagnostic = ''; transport.stderr?.on('data', bytes => diagnostic += String(bytes));
    const client = new Client({ name: 'synthetic-launcher-sdk', version: '1.0.0' });
    try {
      await client.connect(transport); const tools = await client.listTools(); expect(tools.tools).toHaveLength(13);
      expect(tools.tools.some(tool => /start|stop|approve|shell|filesystem/.test(tool.name))).toBe(false);
      const status = await client.callTool({ name: 'krakinai_connection_status', arguments: {} });
      expect(JSON.parse((status.content![0] as { text: string }).text)).toMatchObject({ ok: true, data: { connected: false } });
      const read = await client.callTool({ name: 'krakinai_get_project', arguments: { projectId: 'synthetic-secret-not-a-log' } });
      expect(JSON.parse((read.content![0] as { text: string }).text)).toMatchObject({ ok: false, error: { code: 'PAIRING_REQUIRED' } });
      expect(diagnostic).toContain('KRAKINAI_ADAPTER_READY'); expect(diagnostic).not.toContain('synthetic-secret-not-a-log');
    } finally { await client.close(); }
  });
  it('rejects startup/bypass flags without emitting non-MCP stdout', async () => {
    for (const option of ['--start', '--verifier', '--port']) {
      const child = spawn(process.execPath, [entry(), option, 'synthetic'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = ''; child.stdout.on('data', bytes => stdout += String(bytes)); child.stderr.resume();
      expect(await new Promise(r => child.once('exit', r))).not.toBe(0); expect(stdout).toBe('');
    }
  });
});
