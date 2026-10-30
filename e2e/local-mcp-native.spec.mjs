import { test, expect } from '@playwright/test';
import { isolatedMcpBrowser, sdkBridge, nativeWindowDecision, enterPairingKey } from './local-mcp-fixture.mjs';
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
