import { test, expect } from '@playwright/test';
import { isolatedMcpBrowser, sdkBridge, pairSynthetic, selectMcpRecord, setMcpFlag, showMcpProposals, openMcpPermissions, selectMcpReceipt } from './local-mcp-fixture.mjs';
import { seedChangeSet, changeSetSample, readChangeLibrary } from './change-set-fixture.mjs';
async function prepared(page, bridge) {
  await seedChangeSet(page); await page.goto('/#/connections/ai');
  await setMcpFlag(page, 'Allow change-set proposals', true); await setMcpFlag(page, 'Allow new project creation', true);
  await selectMcpRecord(page, 'Reusable assets', 'Synthetic Studio Camera · camera'); await pairSynthetic(page, bridge);
}
async function reviewed(page, bridge) {
  expect((await bridge.call('krakinai_submit_change_set', { changeSet: await changeSetSample() })).ok).toBe(true);
  await showMcpProposals(page); await page.getByRole('button', { name: 'Review proposal', exact: true }).click();
  for (const label of ['Approve storyboard changes','Approve new immutable scenes']) { await page.getByLabel(label, { exact: true }).check(); await expect(page.getByLabel(label, { exact: true })).toBeChecked(); }
  await page.getByLabel('I reviewed this exact proposal', { exact: true }).check();
}
test('revoking permissions while the apply digest is paused prevents every write', async () => {
  test.setTimeout(60000); const { context, page } = await isolatedMcpBrowser(), bridge = await sdkBridge();
  try {
    await prepared(page, bridge); await reviewed(page, bridge); const before = await readChangeLibrary(page);
    await page.evaluate(() => { const original = crypto.subtle.digest.bind(crypto.subtle); crypto.subtle.digest = async (...args) => { const result = await original(...args); if (new TextDecoder().decode(args[1]).includes('krakinai.change-set.v1')) { crypto.subtle.digest = original; return new Promise(resolve => { window.syntheticDigestWaiting = true; window.releaseSyntheticDigest = () => resolve(result); }); } return result; }; });
    await page.getByRole('button', { name: 'Apply reviewed batch', exact: true }).click();
    await expect.poll(() => page.evaluate(() => !!window.syntheticDigestWaiting)).toBe(true);
    await setMcpFlag(page, 'Allow change-set proposals', false);
    await page.evaluate(() => window.releaseSyntheticDigest());
    await expect(page.locator('.ai-proposal-review')).toContainText('Nothing was applied');
    expect(await readChangeLibrary(page)).toEqual(before);
  } finally { await bridge.close(); await context.close(); }
});
test('an injected quota error after initial writes rolls back the complete MCP batch and receipt', async () => {
  test.setTimeout(60000); const { context, page } = await isolatedMcpBrowser(), bridge = await sdkBridge();
  try {
    await prepared(page, bridge); await reviewed(page, bridge); const before = await readChangeLibrary(page);
    await page.evaluate(() => { const original = IDBObjectStore.prototype.add; IDBObjectStore.prototype.add = function(...args) { if (this.name === 'scenes') { IDBObjectStore.prototype.add = original; throw new DOMException('Synthetic quota fault', 'QuotaExceededError'); } return original.apply(this,args); }; });
    await page.getByRole('button', { name: 'Apply reviewed batch', exact: true }).click();
    await expect(page.locator('.ai-proposal-review')).toContainText('Nothing was applied');
    expect(await readChangeLibrary(page)).toEqual(before);
  } finally { await bridge.close(); await context.close(); }
});
test('background arrival preserves the active draft and focus; disconnect restores dialog focus and revokes reads', async () => {
  test.setTimeout(60000); const { context, page } = await isolatedMcpBrowser(), bridge = await sdkBridge();
  try {
    await prepared(page, bridge);
    await page.evaluate(() => { location.hash = '/builder'; });
    const instructions = page.getByRole('textbox', { name: 'Complete Prompt', exact: true });
    await instructions.fill('Synthetic unsaved production instructions — preserve focus and wording.'); await instructions.focus();
    const activeValue = await instructions.inputValue(), hash = await page.evaluate(() => location.hash);
    expect((await bridge.call('krakinai_submit_change_set', { changeSet: await changeSetSample() })).ok).toBe(true);
    await expect(instructions).toBeFocused(); await expect(instructions).toHaveValue(activeValue); expect(await page.evaluate(() => location.hash)).toBe(hash);
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await page.evaluate(() => { location.hash = '/connections/ai'; });
    const disconnect = page.getByRole('button', { name: 'Disconnect Codex', exact: true });
    await disconnect.click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape'); await expect(disconnect).toBeFocused();
    await disconnect.click(); await page.getByRole('button', { name: 'Disconnect now', exact: true }).click();
    expect((await bridge.call('krakinai_list_projects')).ok).toBe(false);
    await expect(page.getByRole('button', { name: 'Connect Codex', exact: true })).toBeVisible();
  } finally { await bridge.close(); await context.close(); }
});
