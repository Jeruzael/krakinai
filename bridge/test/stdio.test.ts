import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

async function unusedPort() { const server = createServer(); await new Promise<void>(r => server.listen(0, '127.0.0.1', r)); const port = (server.address() as { port: number }).port; await new Promise<void>(r => server.close(() => r())); return port; }
describe('actual compiled SDK stdio process', () => {
  it('negotiates a legacy client, lists the allowlist and calls a real tool without a browser', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('dist/krakinai-mcp.mjs'), '--app-origin', 'http://127.0.0.1:4173', '--port', String(await unusedPort())], stderr: 'pipe' });
    let stderr = ''; transport.stderr?.on('data', part => { stderr += String(part); });
    const client = new Client({ name: 'krakinai-synthetic-sdk-client', version: '1.0.0' });
    try {
      await client.connect(transport);
      const tools = await client.listTools(); expect(tools.tools).toHaveLength(13);
      const versions=(tools.tools.find(t=>t.name==='krakinai_submit_change_set')!.inputSchema.properties!.changeSet as any).oneOf;
      expect(versions.map((v:any)=>v.properties.schema.const)).toEqual(['krakinai.change-set.v1','krakinai.change-set.v2','krakinai.change-set.v3']);
      for(const version of versions)expect(version.properties.operations.maxItems).toBe(250);
      const operationTypes=versions.map((v:any)=>v.properties.operations.items.oneOf.map((o:any)=>o.properties.type.const));
      expect(operationTypes[0]).not.toContain('scene.create_recipe');
      expect(operationTypes[1]).toEqual(expect.arrayContaining(['scene.create_recipe','scene.revise_recipe','scene.create_recipe_take']));
      expect(operationTypes[2]).toEqual(expect.arrayContaining(['scene.create_recipe','scene.revise_recipe','scene.create_recipe_take','variant.propose','variant.review_candidate']));
      expect(tools.tools.some(tool => /approve|apply|filesystem|shell/.test(tool.name))).toBe(false);
      const status = await client.callTool({ name: 'krakinai_connection_status', arguments: {} });
      expect(JSON.parse((status.content![0] as { text: string }).text)).toMatchObject({ ok: true, data: { connected: false } });
      const read = await client.callTool({ name: 'krakinai_get_project', arguments: { projectId: 'project_synthetic' } });
      expect(JSON.parse((read.content![0] as { text: string }).text)).toMatchObject({ ok: false, error: { code: 'PAIRING_REQUIRED' } });
      expect(stderr).not.toContain('project_synthetic');
    } finally { await client.close(); }
  });
  it('rejects LAN binding/options and oversized frames without protocol pollution', async () => {
    for (const args of [['--app-origin', 'http://evil.test', '--port', '4177'], ['--app-origin', 'http://127.0.0.1:4173', '--host', '0.0.0.0']]) {
      const child = spawn(process.execPath, [resolve('dist/krakinai-mcp.mjs'), ...args], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      let out = ''; child.stdout.on('data', part => out += String(part));
      expect(await new Promise<number | null>(r => child.once('exit', r))).not.toBe(0); expect(out).toBe('');
    }
    const child = spawn(process.execPath, [resolve('dist/krakinai-mcp.mjs'), '--app-origin', 'http://127.0.0.1:4173', '--port', String(await unusedPort())], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let out = ''; child.stdout.on('data', part => out += String(part)); child.stderr.resume(); child.stdin.on('error', () => {});
    child.stdin.write('x'.repeat(1310721));
    expect(await new Promise<number | null>(r => child.once('exit', r))).not.toBe(0); expect(out).toBe('');
  });
});
