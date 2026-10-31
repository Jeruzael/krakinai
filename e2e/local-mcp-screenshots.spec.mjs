import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isolatedMcpBrowser, sdkBridge, pairSynthetic, selectMcpRecord, approveMcpContent, setMcpFlag, showMcpProposals, openMcpPermissions, selectMcpReceipt } from './local-mcp-fixture.mjs';
import { seedChangeSet, changeSetSample } from './change-set-fixture.mjs';
test('AI Connections retains readable controls at four viewports in disconnected, connected, review and applied states', async () => {
  test.setTimeout(120000); const { context, page } = await isolatedMcpBrowser(), bridge = await sdkBridge();
  const directory = resolve('qa-results/local-mcp/screenshots'); await mkdir(directory, { recursive: true });
  const capture = async state => { for (const [width,height] of [[1440,900],[1366,768],[768,1024],[390,844]]) { await page.setViewportSize({width,height}); await page.evaluate(() => { scrollTo(0,0); const controls=document.querySelector('.ai-connection-controls'); if(controls) controls.scrollTop=0; }); await expect(page.getByRole('heading',{name:'AI Connections',exact:true})).toBeVisible(); if(width<768) await expect.poll(()=>page.locator('.app-sidebar').evaluate(e=>e.getBoundingClientRect().right)).toBeLessThanOrEqual(1); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.screenshot({ path: resolve(directory,`${state}-${width}x${height}.png`),fullPage:true,animations:'disabled' }); } };
  try {
    await seedChangeSet(page); await page.goto('/#/connections/ai'); await capture('disconnected');
    await page.setViewportSize({width:1440,height:900});
    await setMcpFlag(page, 'Allow change-set proposals', true); await setMcpFlag(page, 'Allow new project creation', true); await selectMcpRecord(page,'Reusable assets','Synthetic Studio Camera · camera');
    await pairSynthetic(page,bridge); await capture('connected');
    expect((await bridge.call('krakinai_submit_change_set',{changeSet:await changeSetSample()})).ok).toBe(true);
    await showMcpProposals(page); await page.getByRole('button',{name:'Review proposal',exact:true}).click(); await capture('review');
    await approveMcpContent(page); await capture('applied');
  } finally { await bridge.close(); await context.close(); }
});
test('200 percent equivalent reflow and keyboard focus remain usable at 720 CSS pixels and DPR2', async () => {
  const { context,page } = await isolatedMcpBrowser({width:720,height:450},2);
  try { await page.goto('/#/connections/ai'); await expect(page.getByRole('heading',{name:'AI Connections',exact:true})).toBeVisible(); expect(await page.evaluate(() => ({width:innerWidth,dpr:devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth+1}))).toEqual({width:720,dpr:2,overflow:false}); const address=page.getByLabel('Local bridge address',{exact:true}); await address.focus(); await page.keyboard.press('Tab'); await expect(page.getByRole('button',{name:'Connect Codex',exact:true})).toBeFocused(); await page.screenshot({path:resolve('qa-results/local-mcp/screenshots/reflow-720-dpr2.png'),fullPage:true}); } finally { await context.close(); }
});
