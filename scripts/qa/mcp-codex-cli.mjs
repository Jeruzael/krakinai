// Actual installed Codex CLI, fresh configuration/home, loopback model fixture.
// No paid/provider request, existing credential, global configuration or browser.
import { createServer } from 'node:http';
import { createServer as tcpServer } from 'node:net';
import { spawn,execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readCliReply,validateCliToolCalls } from './mcp-cli-replies.mjs';
import { createRevisionWorkflow } from './mcp-cli-workflow.mjs';
import { createRecipeWorkflow } from './mcp-recipe-workflow.mjs';
export function createCliWorkflow({workflow,projectId,excludedProjectId}){
  if(!workflow)return undefined;
  if(workflow.kind==='recipe_conversion')return createRecipeWorkflow({projectId,excludedProjectId,...workflow});
  if(workflow.kind!==undefined)throw Error('Unknown synthetic CLI workflow');
  return createRevisionWorkflow({projectId,excludedProjectId,...workflow});
}

export function analyzeCliResults(messages, plan, { projectId, projectName, excludedProjectId } = {}) {
  if (messages.length !== plan.length) throw new Error('Cannot correlate every expected CLI reply.');
  const replies = plan.map((tool,index)=>readCliReply(messages,`synthetic_cli_read_${index+1}`,tool.suffix));
  const status = replies[0].data, paired = Boolean(projectId);
  const connectedTrue = status.connected === true, connectedFalse = status.connected === false;
  if (!paired) { if (!connectedFalse) throw new Error('Expected an unpaired CLI status.'); return { connectedTrue, connectedFalse, projectListMatches: false, projectReadMatches: false, foreignProjectAbsent: true }; }
  const items = replies[1].data.items, current = replies[2].data;
  if (!connectedTrue || !Array.isArray(status.projectIds) || status.projectIds.length !== 1 || status.projectIds[0] !== projectId) throw new Error('Unexpected CLI project scope.');
  if (!Array.isArray(items) || items.length !== 1 || items[0].id !== projectId || items[0].name !== projectName || replies[1].data.nextCursor !== null) throw new Error('Unexpected selected project list.');
  if (current.id !== projectId || current.name !== projectName) throw new Error('Unexpected selected project read.');
  if (JSON.stringify(replies).includes(excludedProjectId)) throw new Error('Unselected project data reached the CLI.');
  return { connectedTrue, connectedFalse, projectListMatches: true, projectReadMatches: true, foreignProjectAbsent: true };
}

export async function certifyInstalledCli({ projectId, projectName, excludedProjectId, onReady, appOrigin = 'http://127.0.0.1:4173', workflow } = {}) {
  if (process.platform !== 'win32') throw new Error('This installed-CLI driver targets the existing Windows installation.');
  const paired = typeof projectId === 'string' && projectId.length > 0;
  if (paired && (typeof projectName !== 'string' || typeof excludedProjectId !== 'string' || !excludedProjectId || typeof onReady !== 'function')) throw new Error('Paired CLI certification requires selected/excluded synthetic projects and browser authorization callback.');
  const applicationUrl=new URL(appOrigin);
  if(applicationUrl.origin!==appOrigin||applicationUrl.protocol!=='http:'||!['127.0.0.1','localhost'].includes(applicationUrl.hostname)||!applicationUrl.port)throw new Error('Use an exact loopback application origin.');
  if(workflow&&!paired)throw new Error('Revision workflow requires explicit project permissions.');
  const scenario=createCliWorkflow({workflow,projectId,excludedProjectId});
  const installation = resolve(process.env.APPDATA, 'npm/node_modules/@openai/codex'), metadata = JSON.parse(await readFile(resolve(installation, 'package.json'), 'utf8'));
  const executable = resolve(installation, 'vendor', process.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc', 'codex/codex.exe');
  const directory = resolve('qa-results/local-mcp/cli', randomUUID()), isolatedHome = resolve(directory, 'home'), cwd = resolve(directory, 'workspace');
  await mkdir(isolatedHome, { recursive: true }); await mkdir(cwd, { recursive: true });
  const versionEnv={SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,TEMP:process.env.TEMP,TMP:process.env.TMP,USERPROFILE:cwd,APPDATA:resolve(directory,'roaming'),LOCALAPPDATA:resolve(directory,'local'),CODEX_HOME:isolatedHome};
  const cliVersionOutput=await new Promise((accept,reject)=>execFile(executable,['--version'],{cwd,env:versionEnv,windowsHide:true,timeout:10000},(error,stdout)=>error?reject(error):accept(stdout.trim())));
  if(cliVersionOutput!==`codex-cli ${metadata.version}`)throw Error('Installed CLI executable version differs from its package metadata.');
  const cliExecutableSha256=createHash('sha256').update(await readFile(executable)).digest('hex');
  const probe = tcpServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const bridgePort = probe.address().port; await new Promise(r => probe.close(r));
  const toolMessages = [], selectedTools = [], paths = [], emittedCalls=[];let observedCallAudit=[]; let requests = 0, providerFailure = '', child, readinessError, lastScenarioToolAt = 0;
  const entry = resolve('bridge/dist/krakinai-mcp.mjs');
  const plan = scenario?.plan ?? [{ suffix: 'krakinai_connection_status', args: {} }, ...(paired ? [{ suffix: 'krakinai_list_projects', args: {} }, { suffix: 'krakinai_get_project', args: { projectId } }] : [])];
  const server = createServer(async (request, response) => {
    try {
      paths.push(request.url); if (request.method !== 'POST' || request.url !== '/v1/chat/completions') throw Error('Unexpected local model request');
      let text = ''; for await (const bytes of request) { text += bytes; if (text.length > 8388608) throw Error('Fixture body exceeds limit'); }
      const body = JSON.parse(text); requests++;
      const messages = body.messages ?? [], results = messages.filter(m => m.role === 'tool');
      toolMessages.splice(0,toolMessages.length,...results);
      if(workflow?.kind==='recipe_conversion')observedCallAudit=validateCliToolCalls(messages,emittedCalls);
      if (requests === 1 && paired) {
        try { await onReady({ cliPid: child.pid, port: bridgePort, entry }); }
        catch (error) { readinessError = error; child.kill(); throw error; }
      }
      if(scenario){try{await scenario.consume(results);}catch(error){readinessError=error;child.kill();throw error;}}
      // Respect the production 30/minute budget and eight-call burst; a rate
      // error is never accepted as evidence that disconnect revoked access.
      if(scenario&&results.length<plan.length){const remaining=2100-(Date.now()-lastScenarioToolAt);if(remaining>0)await new Promise(r=>setTimeout(r,remaining));lastScenarioToolAt=Date.now();}
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
      const send = (delta, finish_reason = null) => response.write(`data: ${JSON.stringify({ id: 'chatcmpl-krakinai-synthetic', object: 'chat.completion.chunk', created: 0, model: 'krakinai-synthetic', choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      if (results.length < plan.length) {
        const next = plan[results.length], tool = (body.tools ?? []).find(t => (t.function?.name ?? t.name)?.endsWith(next.suffix));
        if (!tool) throw Error('Actual CLI did not advertise the required KRAKINAI tool');
        const name = tool.function?.name ?? tool.name; selectedTools.push(name);
        const callId=`synthetic_cli_read_${results.length+1}`,argumentsText=JSON.stringify(typeof next.args==='function'?next.args():next.args);emittedCalls.push({id:callId,name,args:JSON.parse(argumentsText)});
        send({ role: 'assistant', tool_calls: [{ index: 0, id: `synthetic_cli_read_${results.length + 1}`, type: 'function', function: { name, arguments: argumentsText } }] }); send({}, 'tool_calls');
      } else { send({ role: 'assistant', content: 'Synthetic KRAKINAI MCP scenario completed.' }); send({}, 'stop'); }
      response.end('data: [DONE]\n\n');
    } catch { providerFailure = 'LOCAL_FIXTURE_PROTOCOL_ERROR'; if (!response.headersSent) response.writeHead(400); response.end('{}'); }
  });
  server.on('connect', (_request, socket) => { providerFailure = 'UNEXPECTED_EXTERNAL_PROXY_REQUEST'; socket.destroy(); });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${server.address().port}`;
  const config = {
    model: 'krakinai-synthetic', model_provider: 'krakinai_synthetic', approval_policy: 'never',
    'model_providers.krakinai_synthetic.name': 'KRAKINAI loopback synthetic fixture',
    'model_providers.krakinai_synthetic.base_url': `${origin}/v1`, 'model_providers.krakinai_synthetic.wire_api': 'chat',
    'model_providers.krakinai_synthetic.env_key': 'KRAKINAI_SYNTHETIC_MODEL_KEY', 'model_providers.krakinai_synthetic.requires_openai_auth': false,
    'mcp_servers.krakinai.command': process.execPath,
    'mcp_servers.krakinai.args': [entry, '--app-origin', appOrigin, '--port', String(bridgePort)],
    'mcp_servers.krakinai.startup_timeout_sec': 20, 'mcp_servers.krakinai.tool_timeout_sec': 20,
    // This owned fixture must receive all ten complete three-mode previews.
    // No user configuration, application byte limit or production permission is changed.
    ...(workflow?.kind==='recipe_conversion'?{tool_output_token_limit:100000}:{}),
  };
  const args = Object.entries(config).flatMap(([key, value]) => ['-c', `${key}=${JSON.stringify(value)}`]);
  args.push('exec','--skip-git-repo-check','--sandbox','read-only','--json','--cd',cwd,workflow?'Follow the finite synthetic KRAKINAI revision scenario using only the specified MCP calls. Browser approval is separate. Do not use shell, files or external network tools.':paired ? 'Read KRAKINAI connection status, list selected projects, then read the selected synthetic project. Do not use shell, files, network tools or any mutation tool. Then finish.' : 'Call only the KRAKINAI connection status tool once. Do not use shell, files, network tools or any mutation tool. Then finish.');
  child = spawn(executable, args, { cwd, windowsHide: true, stdio: ['ignore','pipe','pipe'], env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, PATH: process.env.PATH, TEMP: process.env.TEMP, TMP: process.env.TMP, USERPROFILE: cwd, LOCALAPPDATA: resolve(directory,'local'), APPDATA: resolve(directory,'roaming'), CODEX_HOME: isolatedHome, KRAKINAI_SYNTHETIC_MODEL_KEY: 'synthetic-fixture-only', HTTP_PROXY: origin, HTTPS_PROXY: origin, ALL_PROXY: origin, NO_PROXY: '127.0.0.1,localhost', DO_NOT_TRACK: '1' } });
  let output = '', diagnostic = ''; child.stdout.on('data', b => { output += b; if (output.length > 2097152) child.kill(); }); child.stderr.on('data', b => { diagnostic = (diagnostic + b).slice(-8192); });
  const timer = setTimeout(() => child.kill(), workflow?.kind==='recipe_conversion'?300000:workflow?150000:75000);
  try {
    const exitCode = await new Promise((r,j) => { child.once('exit', r); child.once('error', j); });
    // Only synthetic metadata from this isolated fixture; never pairing keys or credentials.
    await writeFile(resolve(directory, 'tool-messages.json'), JSON.stringify(toolMessages, null, 2));
    if (readinessError) throw readinessError;
    const evidence = scenario?scenario.summary():analyzeCliResults(toolMessages, plan, { projectId, projectName, excludedProjectId });
    if(workflow?.kind==='recipe_conversion')evidence.callAudit=evidence.callAudit.map(row=>({...row,...observedCallAudit.find(call=>call.callId===row.callId)}));
    const result = { implementation: 'actual installed Codex CLI / production SDK stdio server', cliVersion: metadata.version,cliVersionOutput,cliExecutable:executable,cliExecutableSha256, toolOutputTokenLimit:config.tool_output_token_limit??null, applicationOrigin:appOrigin, exitCode, requests, selectedTools, ...evidence, providerFailure, modelProvider: 'loopback synthetic Chat Completions SSE; no external AI provider', nativePairing: paired ? 'Signed production Windows verifier; browser callback must finish pairing and select project before model tools run.' : 'not exercised: unpaired status-only certification', isolatedHome: directory, warning: /deprecated/i.test(diagnostic) ? 'Installed CLI reported a deprecation warning.' : null };
    await writeFile(resolve(directory, 'result.json'), JSON.stringify(result, null, 2));
    if (exitCode !== 0 || selectedTools.length !== plan.length || requests !== plan.length + 1 || providerFailure) { await writeFile(resolve(directory,'diagnostic.txt'), diagnostic); throw new Error(`Installed CLI fixture failed; sanitized synthetic evidence: ${directory}`); }
    return result;
  } finally { clearTimeout(timer); if (child.exitCode === null) child.kill(); await new Promise(r => server.close(r)); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) certifyInstalledCli().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
