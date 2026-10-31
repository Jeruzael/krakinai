import { createRequire } from 'node:module';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
const bridgeRequire = createRequire(new URL('../bridge/package.json', import.meta.url));
const { Client } = bridgeRequire('@modelcontextprotocol/client');
export const mcpOrigin = 'http://127.0.0.1:4173';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function unusedPort() { const server = createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port; await new Promise(r => server.close(r)); return port; }

export async function isolatedMcpBrowser(viewport = { width: 1440, height: 900 }, deviceScaleFactor = 1, origin = mcpOrigin) {
  const profile = resolve('qa-results/local-mcp/profiles', randomUUID()); await mkdir(profile, { recursive: true });
  const context = await chromium.launchPersistentContext(profile, { headless: true, viewport, deviceScaleFactor, baseURL: origin, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  const page = context.pages()[0] ?? await context.newPage();
  return { context, page, profile }; // Deliberately retain the profile after close.
}
export async function enterPairingKey(page, secret) {
  const field = page.getByLabel('One-time pairing key', { exact: true }); await field.waitFor();
  // Avoid Playwright's input action logs containing the key if an action fails.
  await field.evaluate((input, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }, secret);
}
// Only called on freshly created synthetic profiles, never on a user library.
export async function syntheticMediaHashes(page) {
  return page.evaluate(async () => { const state=await(await import('/src/storage/db.ts')).getAllSnapshot(); return Promise.all(state.media.map(async media=>({id:media.id,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await media.blob.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('')}))); });
}
export async function nativeWindowDecision({ pid, entry, port, code, decision = 'Allow', origin = mcpOrigin }) {
  const powershell = resolve(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const child = spawn(powershell, ['-NoProfile','-NonInteractive','-STA','-WindowStyle','Hidden','-File',process.env.KRAKINAI_NATIVE_QA_DRIVER || resolve('scripts/qa/mcp-native-window.ps1'),'-BridgePid',String(pid),'-ExpectedBridge',entry,'-ExpectedOrigin',origin,'-ExpectedRelay',`http://127.0.0.1:${port}`,'-ExpectedCode',code,'-Decision',decision], { windowsHide: true, stdio: ['ignore','pipe','pipe'] });
  let output = '', failure = ''; child.stderr.on('data', bytes => { failure = (failure + String(bytes)).replace(/\0/g, '').replace(/[A-Za-z0-9_-]{43,}/g, '[redacted]').slice(0, 700); }); child.stdout.on('data', bytes => { output += bytes; if (output.length > 4096) child.kill(); });
  const timer = setTimeout(() => child.kill(), 25000);
  try { const code = await new Promise(r => child.once('exit', r)); if (code !== 0) throw new Error(`Owned native window verification failed (${code}): ${failure}`); return JSON.parse(output); } finally { clearTimeout(timer); output = ''; }
}

export async function ownedCliBridgePid(cliPid, port) {
  if (!Number.isSafeInteger(cliPid) || !Number.isSafeInteger(port)) throw new Error('Invalid owned process identity');
  const command = `Get-CimInstance Win32_Process -Filter 'ParentProcessId = ${cliPid}' | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*krakinai-mcp.mjs*' -and $_.CommandLine -like '*--port*${port}*' } | Select-Object -ExpandProperty ProcessId`;
  const { stdout } = await promisify(execFile)(resolve(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, timeout: 10000 });
  const pids = stdout.trim().split(/\s+/).filter(Boolean);
  if (pids.length !== 1 || !/^\d+$/.test(pids[0])) throw new Error('Actual CLI did not own exactly one expected production bridge');
  return Number(pids[0]);
}

export async function sdkBridge({ production = false } = {}) {
  const port = await unusedPort(), native = [], waiters = [];
  const entry = resolve(production ? 'bridge/dist/krakinai-mcp.mjs' : 'bridge/qa-results/synthetic-runtime/browser-server.mjs');
  const args = production ? [entry, '--app-origin', mcpOrigin, '--port', String(port)] : [entry, mcpOrigin, String(port)];
  const child = spawn(process.execPath, args, { stdio: production ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe', 'pipe'], windowsHide: true, env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, PATH: process.env.PATH, TEMP: process.env.TEMP, TMP: process.env.TMP } });
  let diagnostics = '', lastCall = 0, dropReply = false;
  child.stderr.on('data', part => { diagnostics = (diagnostics + part).slice(-4096); });
  child.stdin.on('error', () => {});
  if (!production) {
    const privateLines = createInterface({ input: child.stdio[3] });
    privateLines.on('line', line => { if (line.length > 8192) throw new Error('Synthetic private pipe exceeded its limit'); const info = JSON.parse(line); const waiter = waiters.shift(); if (waiter) waiter(info); else native.push(info); });
  }
  // SDK owns MCP negotiation, tool schemas and calls. This test-only transport
  // supplies an extra anonymous pipe; the production SDK transport is unchanged.
  const transport = {
    async start() { const lines = createInterface({ input: child.stdout }); lines.on('line', line => { if (line.length > 1310720) return this.onerror?.(new Error('Oversized SDK reply')); try { const message = JSON.parse(line); if (dropReply && message.result) { dropReply = false; child.kill(); return; } this.onmessage?.(message); } catch { this.onerror?.(new Error('Invalid SDK reply')); } }); child.once('exit', () => this.onclose?.()); child.on('error', error => this.onerror?.(error)); },
    async send(message) { await new Promise((resolve, reject) => child.stdin.write(`${JSON.stringify(message)}\n`, error => error ? reject(error) : resolve())); },
    async close() { child.stdin.end(); if (child.exitCode === null) await Promise.race([new Promise(r => child.once('exit', r)), delay(3000)]); if (child.exitCode === null) child.kill(); },
  };
  const client = new Client({ name: 'krakinai-isolated-browser-sdk', version: '1.0.0' }); await client.connect(transport);
  return { child, port, client, entry,
    async nativeVerification() { if (native.length) return native.shift(); return Promise.race([new Promise(r => waiters.push(r)), delay(15000).then(() => { throw new Error('Synthetic native verification did not arrive'); })]); },
    async call(name, args = {}) { const remaining = 2050 - (Date.now() - lastCall); if (remaining > 0) await delay(remaining); lastCall = Date.now(); const result = await client.callTool({ name, arguments: args }); return JSON.parse(result.content[0].text); },
    diagnosticsContain(value) { return diagnostics.includes(value); },
    dropNextReply() { dropReply = true; },
    async close() { await client.close(); },
  };
}

export async function pairSynthetic(page, bridge) {
  await page.getByLabel('Local bridge address', { exact: true }).fill(`http://127.0.0.1:${bridge.port}`);
  await page.getByRole('button', { name: 'Connect Codex', exact: true }).click();
  const verification = await bridge.nativeVerification();
  expect(verification.origin).toBe(mcpOrigin);
  await expect(page.locator('.ai-verification')).toHaveText(verification.verificationCode);
  await enterPairingKey(page, verification.secret);
  await page.getByRole('button', { name: 'Confirm pairing', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Disconnect Codex', exact: true })).toBeVisible();
  expect(bridge.diagnosticsContain(verification.secret)).toBe(false);
  verification.secret = '';
}

export async function selectMcpRecord(page, group, title) {
  const details = page.locator('details').filter({ has: page.locator(':scope > summary', { hasText: new RegExp(`^${group} \\(`) }) });
  await details.locator('summary').click();
  await page.getByRole('checkbox', { name: `Allow ${group}: ${title}`, exact: true }).check();
}
export async function approveMcpContent(page, { beforeApply } = {}) {
  for (const label of ['Approve storyboard changes', 'Approve new immutable scenes']) { const check = page.getByLabel(label, { exact: true }); if (await check.count()) { await check.check(); await expect(check).toBeChecked(); } }
  await page.getByLabel('I reviewed this exact proposal', { exact: true }).check();
  if (beforeApply) await beforeApply();
  await page.getByRole('button', { name: 'Apply reviewed batch', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Import receipt', exact: true })).toBeVisible();
}
