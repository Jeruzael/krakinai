import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isolatedMcpBrowser, sdkBridge, pairSynthetic, openMcpPermissions, showMcpProposals, setMcpFlag, approveMcpContent, enterPairingKey } from './local-mcp-fixture.mjs';
import { seedPermissionWorkspace } from './ai-connections-fixture.mjs';
import { readChangeLibrary, changeSetSample } from './change-set-fixture.mjs';

test('permission workspace bulk selection covers hidden pages, preserves search selections and reflows', async () => {
  test.setTimeout(90000); const { context, page } = await isolatedMcpBrowser();
  try {
    await seedPermissionWorkspace(page); const before = await readChangeLibrary(page);
    await openMcpPermissions(page); await page.getByRole('button', { name: /^Reusable assets category,/ }).click();
    expect(await page.locator('.ai-record-row').filter({ visible: true }).first().evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(90);
    const applyBox = await page.getByRole('button', { name: 'Apply Permissions', exact: true }).boundingBox();
    expect(applyBox.y + applyBox.height).toBeLessThanOrEqual(900);
    const directory = resolve('qa-results/ai-connections/screenshots'); await mkdir(directory, { recursive: true });
    for (const [width, height] of [[1440,900],[1366,768],[768,1024],[390,844],[720,450]]) {
      await page.setViewportSize({width,height}); await page.evaluate(() => scrollTo(0,0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await expect(page.getByRole('textbox', { name: 'Search Reusable assets', exact: true })).toBeVisible();
      await page.screenshot({path:resolve(directory,'after-'+width+'x'+height+'.png'),fullPage:true,animations:'disabled'});
    }
    await page.setViewportSize({width:1440,height:900});
    await page.screenshot({path:resolve(directory,'after-1440x900-viewport.png'),animations:'disabled'});
    expect(await page.locator('.ai-record-content').evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(500);
    const search = page.getByRole('textbox', {name:'Search Reusable assets',exact:true});
    await search.fill('Hidden 79'); await page.getByRole('button',{name:'Select 1 Matching',exact:true}).click();
    await search.fill('Matching'); await page.getByRole('button',{name:'Select 65 Matching',exact:true}).click();
    await expect(page.getByText('66 of 80 selected',{exact:true})).toBeVisible();
    await search.fill(''); expect(await page.getByRole('checkbox',{name:'Select all matching Reusable assets',exact:true}).evaluate(el=>el.indeterminate)).toBe(true);
    await search.fill('Matching'); await page.getByRole('button',{name:'Clear Matching Selection',exact:true}).click();
    await expect(page.getByText('1 of 80 selected',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Full Access',exact:true}).click(); await page.keyboard.press('Escape');
    await expect(page.getByRole('button',{name:'Full Access',exact:true})).toBeFocused();
    await expect(page.getByLabel('Share Character identities and approved anchors',{exact:true})).not.toBeChecked();
    await page.getByRole('tab',{name:'Permissions',exact:true}).focus(); await page.keyboard.press('End');
    await expect(page.getByRole('tab',{name:'Incoming Proposals',exact:true})).toBeFocused();
    expect(await readChangeLibrary(page)).toEqual(before);
  } finally { await context.close(); }
});

test('oversized global and Full Access selections fail without a partial grant', async () => {
  const {context,page}=await isolatedMcpBrowser();
  try {
    await seedPermissionWorkspace(page,501); await openMcpPermissions(page);
    await page.getByRole('button',{name:'Select All Records',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('501'); await expect(page.getByRole('alert')).toContainText('500');
    const warningBox = await page.getByRole('alert').boundingBox();
    expect(warningBox.y + warningBox.height).toBeLessThanOrEqual(900);
    await expect(page.getByRole('button',{name:'Apply Permissions',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'Grant Full Access',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel('Allow change-set proposals',{exact:true})).not.toBeChecked();
    await expect(page.getByLabel('Share Character identities and approved anchors',{exact:true})).not.toBeChecked();
  } finally {await context.close();}
});

test('actual SDK observes no draft grants, then all 65 matches only after one explicit Apply', async () => {
  test.setTimeout(90000);const {context,page}=await isolatedMcpBrowser(),bridge=await sdkBridge();
  try {
    await seedPermissionWorkspace(page); const before=await readChangeLibrary(page); await pairSynthetic(page,bridge);
    const initial=await bridge.call('krakinai_connection_status');expect(initial).toMatchObject({ok:true,data:{connected:true,automaticApplication:false}});
    await openMcpPermissions(page);await page.getByRole('button',{name:/^Reusable assets category,/}).click();
    const query=page.getByRole('textbox',{name:'Search Reusable assets',exact:true});await query.fill('Matching');await page.getByRole('button',{name:'Select 65 Matching',exact:true}).click();
    expect((await bridge.call('krakinai_search_assets',{limit:50})).data.items).toEqual([]);
    expect((await bridge.call('krakinai_connection_status')).data.scopeEpoch).toBe(initial.data.scopeEpoch);
    await page.getByRole('button',{name:'Apply Permissions',exact:true}).click();
    const granted=await bridge.call('krakinai_connection_status');expect(granted.data.scopeEpoch).toBe(initial.data.scopeEpoch+1);
    const first=await bridge.call('krakinai_search_assets',{query:'Matching',limit:50});
    const second=await bridge.call('krakinai_search_assets',{query:'Matching',limit:50,cursor:first.data.nextCursor});
    expect(first.data.items).toHaveLength(50);expect(second.data.items).toHaveLength(15);
    expect([...first.data.items,...second.data.items].map(i=>i.id)).toContain('synthetic_bulk_64');
    expect(await readChangeLibrary(page)).toEqual(before);
    await page.getByRole('tab',{name:'Connection',exact:true}).click();await page.getByRole('button',{name:'Disconnect Codex',exact:true}).click();await page.getByRole('button',{name:'Disconnect now',exact:true}).click();
    await openMcpPermissions(page);await expect(page.getByRole('region',{name:'Applied permissions'})).toContainText('0 reusable assets');
    expect((await bridge.call('krakinai_search_assets',{})).ok).toBe(false);
  } finally {await bridge.close();await context.close();}
});

test('proposal arrival preserves permission focus and reviewed receipt grants are visible and revocable', async () => {
  test.setTimeout(90000);const {context,page}=await isolatedMcpBrowser(),bridge=await sdkBridge();
  try {
    await seedPermissionWorkspace(page);await setMcpFlag(page,'Allow change-set proposals');await pairSynthetic(page,bridge);
    const before=await readChangeLibrary(page);await openMcpPermissions(page);await page.getByRole('button',{name:/^Reusable assets category,/}).click();
    const search=page.getByRole('textbox',{name:'Search Reusable assets',exact:true});await search.fill('Unchanged work');await search.focus();
    const sample=await changeSetSample(),input={...sample,changeSetId:'synthetic-permission-receipt',operations:sample.operations.filter(op=>op.type==='asset.propose')};
    const submitted=await bridge.call('krakinai_submit_change_set',{changeSet:input});expect(submitted).toMatchObject({ok:true,data:{status:'review_required'}});
    await expect(search).toBeFocused();await expect(search).toHaveValue('Unchanged work');await expect(page.getByRole('tab',{name:'Permissions',exact:true})).toHaveAttribute('aria-selected','true');
    expect(await readChangeLibrary(page)).toEqual(before);
    await showMcpProposals(page);await page.getByRole('button',{name:'Review proposal',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Review incoming changes',exact:true})).toBeFocused();
    await page.getByRole('button',{name:'Back to proposals',exact:true}).click();
    await expect(page.getByRole('button',{name:'Review proposal',exact:true})).toBeFocused();
    await page.getByRole('button',{name:'Review proposal',exact:true}).click();await approveMcpContent(page);
    const applied=await bridge.call('krakinai_get_proposal_status',{proposalId:submitted.data.proposalId});expect(applied.data.status).toBe('applied');
    const receipt=applied.data.receipt,after=await readChangeLibrary(page);
    await openMcpPermissions(page);await expect(page.getByRole('region',{name:'Applied permissions'})).toContainText('1 approved-batch receipts');
    await page.getByRole('button',{name:'Apply Permissions',exact:true}).click();await expect(page.getByRole('region',{name:'Applied permissions'})).toContainText('0 approved-batch receipts');
    expect((await bridge.call('krakinai_get_import_receipt',{changeSetId:receipt.changeSetId,packageDigest:receipt.packageDigest})).ok).toBe(false);
    expect(await readChangeLibrary(page)).toEqual(after);
    expect(after.assets).toEqual(before.assets);expect(after.scenes).toEqual(before.scenes);
  } finally {await bridge.close();await context.close();}
});


test('permissions remain readable at 200-percent-equivalent reflow with DPR2', async()=>{
 const {context,page}=await isolatedMcpBrowser({width:720,height:450},2);
 try{
  await seedPermissionWorkspace(page);await openMcpPermissions(page);await page.getByRole('button',{name:/^Reusable assets category,/}).click();
  expect(await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth+1}))).toEqual({width:720,dpr:2,overflow:false});
  const search=page.getByRole('textbox',{name:'Search Reusable assets',exact:true});await search.fill('Matching');
  await page.getByRole('button',{name:'Select 65 Matching',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(page.getByText('65 of 80 selected',{exact:true})).toBeVisible();
  await page.screenshot({path:resolve('qa-results/ai-connections/screenshots/after-reflow-720-dpr2.png'),fullPage:true,animations:'disabled'});
 }finally{await context.close();}
});

test('delayed connection startup locks permission changes before the native challenge arrives', async () => {
 test.setTimeout(90000); const {context,page}=await isolatedMcpBrowser(), bridge=await sdkBridge();
 let releaseStart; const gate=new Promise(resolve=>{releaseStart=resolve;});
 let started; const requested=new Promise(resolve=>{started=resolve;});
 try {
  await seedPermissionWorkspace(page); const before=await readChangeLibrary(page);
  await setMcpFlag(page,'Allow change-set proposals',true);
  await page.route('**/v1/pair/start',async route=>{started();await gate;await route.continue();});
  await page.getByLabel('Local bridge address',{exact:true}).fill(`http://127.0.0.1:${bridge.port}`);
  await page.getByRole('button',{name:'Connect Codex',exact:true}).click();await requested;
  await openMcpPermissions(page);
  const proposal=page.getByLabel('Allow change-set proposals',{exact:true});
  await expect(proposal).toBeDisabled();await expect(proposal).toBeChecked();
  await expect(page.getByRole('button',{name:'Minimal Access',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Apply Permissions',exact:true})).toBeDisabled();
  releaseStart();await page.getByRole('tab',{name:'Connection',exact:true}).click();
  const verification=await bridge.nativeVerification();await enterPairingKey(page,verification.secret);
  await page.getByRole('button',{name:'Confirm pairing',exact:true}).click();
  await expect(page.getByRole('button',{name:'Disconnect Codex',exact:true})).toBeVisible();
  expect((await bridge.call('krakinai_connection_status')).data.connected).toBe(true);
  await openMcpPermissions(page);await expect(proposal).toBeChecked();await expect(proposal).toBeEnabled();
  expect(await readChangeLibrary(page)).toEqual(before);
 }finally{releaseStart();await bridge.close();await context.close();}
});
