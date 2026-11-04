import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import {seedBlocking} from './blocking-fixture.mjs';
import {selectMcpRecord,setMcpFlag,applyMcpPermissions,showMcpProposals} from './local-mcp-fixture.mjs';
export async function freshBlockingNativeBrowser(origin,{manual=false}={}){
 if(!['http://127.0.0.1:4173','http://localhost:4173'].includes(origin))throw Error('Unapproved native QA origin');
 const workspaceRoot=resolve(process.env.USERPROFILE,'.codex/qa-blocking-b'),profilePath=resolve(workspaceRoot,'native-'+randomUUID()),child=relative(workspaceRoot,profilePath);if(!child||isAbsolute(child)||child.startsWith('..'))throw Error('Unowned synthetic profile');await mkdir(profilePath,{recursive:true});
 const context=await chromium.launchPersistentContext(profilePath,{headless:!manual,baseURL:origin,viewport:{width:1440,height:900},executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});return{context,page:context.pages()[0]??await context.newPage(),target:{syntheticOnly:true,origin,workspaceRoot,profilePath}};
}
export const readBlockingNativeLibrary=page=>page.evaluate(async()=>{const s=await(await import('/src/storage/db.ts')).getAllSnapshot();return{...s,media:s.media.map(({blob,posterBlob,...record})=>record)};});
export async function seedBlockingNative(page){
 const ids=await seedBlocking(page,{saved:true,sequence:true}),extra=await page.evaluate(async ids=>{
  const {getAllSnapshot}=await import('/src/storage/db.ts'),{writeRecord}=await import('/src/__tests__/fixtures/ensembleStorageFixture.ts'),{validatePhase4Record}=await import('/src/domain/phase4Validation.ts'),{blockingSourceTokens}=await import('/src/domain/blockingMcp.ts');
  const state=await getAllSnapshot(),scene=state.scenes.find(s=>s.id===ids.sceneId),project=state.collections.find(c=>c.id===ids.projectId);
  scene.manualOutputs.full={text:'SYNTHETIC ORIGINAL MANUAL VIDEO.\r\nPreserve every byte in this immutable source. ✨',basedOnInputRevision:1,updatedAt:scene.updatedAt};scene.outputs.full=scene.manualOutputs.full.text;const error=validatePhase4Record(scene);if(error)throw Error(error);await writeRecord('scenes',scene);
  project.name='SYNTHETIC MIDORI - Blocking certification';await writeRecord('collections',project);const excluded=structuredClone(project);excluded.id='blocking-excluded-project';excluded.name='PRIVATE_BLOCKING_EXCLUDED_PROJECT';excluded.members=[];excluded.project.shots=[];excluded.project.revision=1;await writeRecord('collections',excluded);
  return{projectName:project.name,excludedProjectId:excluded.id,tokens:await blockingSourceTokens(scene),sourceRevision:scene.revision,sourceHeadId:scene.id,projectRevision:project.project.revision,sourceSceneIds:state.scenes.map(s=>s.id)};
 },ids);await page.reload();await page.getByRole('heading',{level:1}).first().waitFor();return{...ids,...extra};
}
export function blockingNativePackage(ids,label){return{schema:'krakinai.change-set.v5',changeSetId:'synthetic-blocking-native-'+label,source:{kind:'codex',label:'Actual installed CLI / isolated Blocking acceptance'},operations:[{operationId:'turn',type:'scene.revise_recipe',clientRef:'new-turn',project:{id:ids.projectId,expectedRevision:ids.projectRevision},shot:{id:ids.shotId},sceneId:ids.sceneId,expectedHeadId:ids.sourceHeadId,...ids.tokens,blocking:{version:1,expectedBaseDigest:ids.tokens.expectedBlockingDigest,participantUpserts:[{participant:{kind:'ensemble',participantId:'primary'},end:{headDirection:{kind:'target',target:{kind:'landmark',landmarkId:'door'}},eyeline:{kind:'landmark',landmarkId:'door'},pose:'Aya turns toward the chapel door. Preserve her original appearance, wedding gown, bouquet and chapel.'}}]}}]};}
export async function configureBlockingNative(page,ids){
 await page.goto('/#/connections/ai');await selectMcpRecord(page,'Projects',ids.projectName);await setMcpFlag(page,'Allow change-set proposals',true);await page.getByRole('tab',{name:'Permissions',exact:true}).click();await page.getByLabel('Enable Blocking permission format',{exact:true}).check();
 const picker=page.getByRole('region',{name:'Blocking authoring text record selection',exact:true});await picker.getByLabel('Search Blocking authoring text',{exact:true}).fill(ids.sceneId);await picker.locator('.ai-record-row').filter({hasText:ids.sceneId}).getByRole('checkbox').check();await applyMcpPermissions(page);await page.getByRole('tab',{name:'Connection',exact:true}).click();
}
export async function approveBlockingNative(page,proposalId,{beforeDecision}={}){
 await showMcpProposals(page);await page.locator('button[data-proposal-id="'+proposalId+'"]').click();if(await page.locator('.pr-workspace').count()){await page.getByRole('button',{name:'Review turn',exact:true}).click();await page.getByRole('tab',{name:'Video',exact:true}).click();}await page.getByRole('region',{name:'Blocking proposal turn',exact:true}).waitFor();
 await expect(page.getByRole('combobox',{name:'Full output decision',exact:true})).toHaveValue('');await expect(page.getByLabel('I reviewed this exact proposal',{exact:true})).not.toBeChecked();
 if(beforeDecision)await beforeDecision();
 await page.getByRole('combobox',{name:'Full output decision',exact:true}).selectOption('canonical');await expect(page.getByRole('combobox',{name:'Full output decision',exact:true})).toBeEnabled();
 if(!await page.getByLabel('Approve storyboard changes',{exact:true}).isVisible())await page.getByRole('button',{name:'Issues & approvals',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Issues and approvals',exact:true}),controls=await dialog.isVisible()?dialog:page;
 for(const label of ['Approve storyboard changes','Approve new immutable scenes','Approve blocking changes']){await controls.getByLabel(label,{exact:true}).check();await expect(controls.getByLabel(label,{exact:true})).toBeEnabled();}
 await controls.getByLabel('I reviewed this exact proposal',{exact:true}).check();if(await dialog.isVisible())await page.keyboard.press('Escape');await page.getByRole('button',{name:'Apply reviewed batch',exact:true}).click();await expect(page.getByRole('heading',{name:'Import receipt',exact:true})).toBeVisible();
}
