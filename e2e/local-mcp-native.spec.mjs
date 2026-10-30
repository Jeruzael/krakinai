import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { isolatedMcpBrowser, sdkBridge, nativeWindowDecision, enterPairingKey, selectMcpRecord, syntheticMediaHashes } from './local-mcp-fixture.mjs';
import { seedChangeSet, readChangeLibrary } from './change-set-fixture.mjs';
import { certifyInstalledCli } from '../scripts/qa/mcp-codex-cli.mjs';
const run = promisify(execFile);
function requireNativeWindows() { test.skip(process.platform !== 'win32' || process.env.KRAKINAI_NATIVE_QA !== '1', 'Opt-in signed real Windows verifier and installed CLI; no substitute verifier.'); }

async function ownedCliBridgePid(cliPid, port) {
  if (!Number.isSafeInteger(cliPid) || !Number.isSafeInteger(port)) throw new Error('Invalid owned process identity');
  const command = `Get-CimInstance Win32_Process -Filter 'ParentProcessId = ${cliPid}' | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*krakinai-mcp.mjs*' -and $_.CommandLine -like '*--port*${port}*' } | Select-Object -ExpandProperty ProcessId`;
  const { stdout } = await run(resolve(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, timeout: 10000 });
  const pids = stdout.trim().split(/\s+/).filter(Boolean);
  if (pids.length !== 1 || !/^\d+$/.test(pids[0])) throw new Error('Actual CLI did not own exactly one expected production bridge');
  return Number(pids[0]);
}
test('Windows production launcher pairs only after the real owned WPF verification window allows it', async () => {
  test.skip(process.platform !== 'win32' || process.env.KRAKINAI_NATIVE_QA !== '1', 'Opt-in real WPF certification: KRAKINAI_NATIVE_QA=1 on Windows, with scripts trusted under the existing execution policy.'); test.setTimeout(90000);
  const { context, page } = await isolatedMcpBrowser(), bridge = await sdkBridge({ production: true });
  try {
    await page.goto('/#/connections/ai');
    await page.getByLabel('Local bridge address', { exact: true }).fill(`http://127.0.0.1:${bridge.port}`);
    await page.getByRole('button', { name: 'Connect Codex', exact: true }).click();
    const code = await page.locator('.ai-verification').textContent();
    const native = await nativeWindowDecision({ pid: bridge.child.pid, entry: bridge.entry, port: bridge.port, code });
    expect(native.verified && native.allowed).toBe(true);
    await enterPairingKey(page, native.secret);
    expect(bridge.diagnosticsContain(native.secret)).toBe(false); native.secret = '';
    await page.getByRole('button', { name: 'Confirm pairing', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Disconnect Codex', exact: true })).toBeVisible();
    expect(await bridge.call('krakinai_connection_status')).toMatchObject({ ok: true, data: { connected: true, automaticApplication: false, projectIds: [] } });
  } finally { await bridge.close(); await context.close(); }
});

test('native Windows Deny leaves the production bridge unpaired and the synthetic library unchanged', async () => {
  requireNativeWindows(); test.setTimeout(90000);
  const { context, page } = await isolatedMcpBrowser(), bridge = await sdkBridge({ production: true });
  try {
    await seedChangeSet(page); const before = await readChangeLibrary(page);
    await page.goto('/#/connections/ai');
    await page.getByLabel('Local bridge address', { exact: true }).fill(`http://127.0.0.1:${bridge.port}`);
    await page.getByRole('button', { name: 'Connect Codex', exact: true }).click();
    const code = await page.locator('.ai-verification').textContent();
    const native = await nativeWindowDecision({ pid: bridge.child.pid, entry: bridge.entry, port: bridge.port, code, decision: 'Deny' });
    expect(native.denied && native.verified).toBe(true);
    await enterPairingKey(page, native.secret); expect(bridge.diagnosticsContain(native.secret)).toBe(false); native.secret = '';
    await page.getByRole('button', { name: 'Confirm pairing', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disconnect Codex', exact: true })).toHaveCount(0);
    expect(await bridge.call('krakinai_connection_status')).toMatchObject({ ok: true, data: { connected: false } });
    expect(await bridge.call('krakinai_list_projects')).toMatchObject({ ok: false, error: { code: 'PAIRING_REQUIRED' } });
    await page.getByRole('button', { name: 'Cancel pairing', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Connect Codex', exact: true })).toBeVisible();
    expect(await readChangeLibrary(page)).toEqual(before);
  } finally { await bridge.close(); await context.close(); }
});

test('actual installed Codex CLI pairs through the signed Windows window and reads only the selected project', async () => {
  requireNativeWindows(); test.setTimeout(120000);
  const { context, page } = await isolatedMcpBrowser();
  try {
    const ids = await seedChangeSet(page), before = await readChangeLibrary(page), hashes = await syntheticMediaHashes(page);
    await page.goto('/#/connections/ai'); await selectMcpRecord(page, 'Projects', 'MIDORI');
    const result = await certifyInstalledCli({ projectId: ids.collectionId, projectName: 'MIDORI', excludedProjectId: ids.dramaId, onReady: async ({ cliPid, port, entry }) => {
      const pid = await ownedCliBridgePid(cliPid, port);
      await page.getByLabel('Local bridge address', { exact: true }).fill(`http://127.0.0.1:${port}`);
      await page.getByRole('button', { name: 'Connect Codex', exact: true }).click();
      const code = await page.locator('.ai-verification').textContent();
      const native = await nativeWindowDecision({ pid, entry, port, code });
      expect(native.verified && native.allowed).toBe(true);
      await enterPairingKey(page, native.secret); native.secret = '';
      await page.getByRole('button', { name: 'Confirm pairing', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Disconnect Codex', exact: true })).toBeVisible();
    } });
    expect(result).toMatchObject({ cliVersion: '0.73.0', exitCode: 0, connectedTrue: true, projectListMatches: true, projectReadMatches: true, foreignProjectAbsent: true, providerFailure: '', requests: 4 });
    expect(result.selectedTools.map(name => name.split('__').at(-1))).toEqual(['krakinai_connection_status', 'krakinai_list_projects', 'krakinai_get_project']);
    expect(await readChangeLibrary(page)).toEqual(before); expect(await syntheticMediaHashes(page)).toEqual(hashes);
  } finally { await context.close(); }
});
