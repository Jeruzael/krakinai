// Actual installed Codex CLI, fresh configuration/home, loopback model fixture.
// No paid/provider request, existing credential, global configuration or browser.
import { createServer } from 'node:http';
import { createServer as tcpServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export async function certifyInstalledCli() {
  if (process.platform !== 'win32') throw new Error('This installed-CLI driver targets the existing Windows installation.');
  const installation = resolve(process.env.APPDATA, 'npm/node_modules/@openai/codex'), metadata = JSON.parse(await readFile(resolve(installation, 'package.json'), 'utf8'));
  const executable = resolve(installation, 'vendor', process.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc', 'codex/codex.exe');
  const directory = resolve('qa-results/local-mcp/cli', randomUUID()), isolatedHome = resolve(directory, 'home'), cwd = resolve(directory, 'workspace');
  await mkdir(isolatedHome, { recursive: true }); await mkdir(cwd, { recursive: true });
  const probe = tcpServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const bridgePort = probe.address().port; await new Promise(r => probe.close(r));
  const toolResults = [], selectedTools = [], paths = []; let requests = 0, providerFailure = '';
  const server = createServer(async (request, response) => {
    try {
      paths.push(request.url); if (request.method !== 'POST' || request.url !== '/v1/chat/completions') throw Error('Unexpected local model request');
      let text = ''; for await (const bytes of request) { text += bytes; if (text.length > 8388608) throw Error('Fixture body exceeds limit'); }
      const body = JSON.parse(text); requests++;
      const tool = (body.tools ?? []).find(t => (t.function?.name ?? t.name)?.endsWith('krakinai_connection_status'));
      if (!tool) throw Error('Actual CLI did not advertise the KRAKINAI status tool');
      const messages = body.messages ?? [], results = messages.filter(m => m.role === 'tool');
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
      const send = (delta, finish_reason = null) => response.write(`data: ${JSON.stringify({ id: 'chatcmpl-krakinai-synthetic', object: 'chat.completion.chunk', created: 0, model: 'krakinai-synthetic', choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      if (!results.length) { const name = tool.function?.name ?? tool.name; selectedTools.push(name); send({ role: 'assistant', tool_calls: [{ index: 0, id: 'synthetic_cli_status_1', type: 'function', function: { name, arguments: '{}' } }] }); send({}, 'tool_calls'); }
      else { for (const result of results) toolResults.push(typeof result.content === 'string' ? result.content : JSON.stringify(result.content)); send({ role: 'assistant', content: 'Synthetic KRAKINAI MCP status was read successfully.' }); send({}, 'stop'); }
      response.end('data: [DONE]\n\n');
    } catch { providerFailure = 'LOCAL_FIXTURE_PROTOCOL_ERROR'; response.writeHead(400); response.end('{}'); }
  });
  server.on('connect', (_request, socket) => { providerFailure = 'UNEXPECTED_EXTERNAL_PROXY_REQUEST'; socket.destroy(); });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${server.address().port}`;
  const config = {
    model: 'krakinai-synthetic', model_provider: 'krakinai_synthetic', approval_policy: 'never',
    'model_providers.krakinai_synthetic.name': 'KRAKINAI loopback synthetic fixture',
    'model_providers.krakinai_synthetic.base_url': `${origin}/v1`, 'model_providers.krakinai_synthetic.wire_api': 'chat',
    'model_providers.krakinai_synthetic.env_key': 'KRAKINAI_SYNTHETIC_MODEL_KEY', 'model_providers.krakinai_synthetic.requires_openai_auth': false,
    'mcp_servers.krakinai.command': process.execPath,
    'mcp_servers.krakinai.args': [resolve('bridge/dist/krakinai-mcp.mjs'), '--app-origin', 'http://127.0.0.1:4173', '--port', String(bridgePort)],
    'mcp_servers.krakinai.startup_timeout_sec': 20, 'mcp_servers.krakinai.tool_timeout_sec': 20,
  };
  const args = Object.entries(config).flatMap(([key, value]) => ['-c', `${key}=${JSON.stringify(value)}`]);
  args.push('exec','--skip-git-repo-check','--sandbox','read-only','--json','--cd',cwd,'Call only the KRAKINAI connection status tool once. Do not use shell, files, network tools or any mutation tool. Then finish.');
  const child = spawn(executable, args, { cwd, windowsHide: true, stdio: ['ignore','pipe','pipe'], env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, PATH: process.env.PATH, TEMP: process.env.TEMP, TMP: process.env.TMP, USERPROFILE: cwd, LOCALAPPDATA: resolve(directory,'local'), APPDATA: resolve(directory,'roaming'), CODEX_HOME: isolatedHome, KRAKINAI_SYNTHETIC_MODEL_KEY: 'synthetic-fixture-only', HTTP_PROXY: origin, HTTPS_PROXY: origin, ALL_PROXY: origin, NO_PROXY: '127.0.0.1,localhost', DO_NOT_TRACK: '1' } });
  let output = '', diagnostic = ''; child.stdout.on('data', b => { output += b; if (output.length > 2097152) child.kill(); }); child.stderr.on('data', b => { diagnostic = (diagnostic + b).slice(-8192); });
  const timer = setTimeout(() => child.kill(), 75000);
  try {
    const exitCode = await new Promise((r,j) => { child.once('exit', r); child.once('error', j); });
    const connectedFalse = toolResults.some(s => /connected[\\]*"\s*:\s*false/.test(s));
    const result = { implementation: 'actual installed Codex CLI / production SDK stdio server', cliVersion: metadata.version, exitCode, requests, selectedTools, connectedFalse, providerFailure, modelProvider: 'loopback synthetic Chat Completions SSE; no external AI provider', nativePairing: 'not exercised: AllSigned blocks unsigned native helper', isolatedHome: directory, warning: /deprecated/i.test(diagnostic) ? 'Installed CLI reported a deprecation warning.' : null };
    await writeFile(resolve(directory, 'result.json'), JSON.stringify(result, null, 2));
    if (exitCode !== 0 || !connectedFalse || selectedTools.length !== 1 || requests !== 2 || providerFailure) { await writeFile(resolve(directory,'diagnostic.txt'), diagnostic); throw new Error(`Installed CLI fixture failed; sanitized synthetic evidence: ${directory}`); }
    return result;
  } finally { clearTimeout(timer); if (child.exitCode === null) child.kill(); await new Promise(r => server.close(r)); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) certifyInstalledCli().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
