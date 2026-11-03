import {test,expect} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
import {seedBlocking} from './blocking-fixture.mjs';
import {storedProof} from './storyboard-fixture.mjs';
async function observeClipboard(page){await page.evaluate(()=>{const write=navigator.clipboard.writeText.bind(navigator.clipboard);window.syntheticClipboardCalls=[];navigator.clipboard.writeText=async text=>{window.syntheticClipboardCalls.push(text);return write(text);};});}
async function expectCopied(page,expected){const actual=await page.evaluate(async()=>({argument:window.syntheticClipboardCalls.at(-1),native:await navigator.clipboard.readText(),platform:navigator.platform}));expect(actual.argument).toBe(expected);if(actual.platform.startsWith('Win'))expect(actual.native.replace(/\r\n/g,'\n')).toBe(expected.replace(/\r\n/g,'\n'));else expect(actual.native).toBe(expected);}
test('blocking keyboard edits preserve saved records and copy/download complete canonical outputs',async({page,context})=>{
 const ids=await seedBlocking(page),before=await storedProof(page);await context.grantPermissions(['clipboard-read','clipboard-write']);await observeClipboard(page);
 const trigger=page.getByRole('button',{name:'Edit blocking',exact:true});await trigger.click();
 const dialog=page.getByRole('dialog',{name:'Shot blocking'});await dialog.getByRole('tab',{name:'Start',exact:true}).focus();await page.keyboard.press('End');await expect(dialog.getByRole('tab',{name:'End',exact:true})).toBeFocused();
 await dialog.getByRole('combobox',{name:'Head direction',exact:true}).selectOption(JSON.stringify({kind:'screen',direction:'screen_left'}));await dialog.getByRole('button',{name:'Save blocking draft'}).click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 const changed=await storedProof(page);expect(changed.scenes).toEqual(before.scenes);expect(changed.media).toEqual(before.media);expect(changed.collections).toEqual(before.collections);
 await page.getByRole('button',{name:'Assemble Prompt',exact:true}).click();await expect(page).toHaveURL(new RegExp('/output/'+ids.draftId));
 const expected=await page.evaluate(async id=>{const snapshot=await(await import('/src/storage/db.ts')).getAllSnapshot();return(await import('/src/domain/promptAssembler.ts')).assembleScenePrompt(snapshot.drafts.find(d=>d.id===id)).outputs;},ids.draftId);
 for(const [label,mode]of[['Narrative','full'],['Structured','structured'],['Compact','compact']]){
  await page.getByRole('tab',{name:label,exact:label!=='Structured'}).click();await page.getByRole('button',{name:'Copy Prompt',exact:true}).click();await expectCopied(page,expected[mode]);
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download selected .txt',exact:true}).click();expect(await readFile(await(await downloaded).path(),'utf8')).toBe(expected[mode]);
 }
});
test('blocking preflight blocks assembly until the exact stale binding is explicitly repaired',async({page})=>{
 const ids=await seedBlocking(page,{stale:true}),before=await storedProof(page);await page.getByRole('button',{name:/^Preflight ·/}).click();
 const preflight=page.getByRole('dialog',{name:'Scene Preflight'});await expect(preflight.getByRole('region',{name:'Blocking findings'})).toContainText(/binding|Character/);await preflight.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Assemble Prompt',exact:true}).click();await expect(page.getByRole('alert')).toContainText(/binding|Character/);await expect(page).toHaveURL(new RegExp('/builder/'+ids.draftId));expect((await storedProof(page)).scenes).toEqual(before.scenes);
 await page.getByRole('button',{name:'Edit blocking',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Shot blocking'});await dialog.getByText('Binding and track controls',{exact:true}).click();await dialog.getByRole('button',{name:'Refresh track binding'}).click();await dialog.getByRole('button',{name:'Confirm track binding refresh'}).click();await dialog.getByRole('button',{name:'Save blocking draft'}).click();await expect(dialog).toHaveCount(0);await page.getByRole('button',{name:'Assemble Prompt',exact:true}).click();await expect(page).toHaveURL(new RegExp('/output/'+ids.draftId));expect((await storedProof(page)).scenes).toEqual(before.scenes);
});
test('manual output choice creates one immutable take and retains its exact unverified text',async({page})=>{
 const ids=await seedBlocking(page,{manual:true}),before=await storedProof(page);await page.getByRole('button',{name:'Assemble Prompt',exact:true}).click();await expect(page).toHaveURL(new RegExp('/output/'+ids.draftId));
 const save=page.getByRole('button',{name:'Save Scene',exact:true});await expect(save).toBeDisabled();await page.getByRole('combobox',{name:'Full output decision'}).selectOption('keep_manual_unverified');await save.click();await expect(page).toHaveURL(/\/output\/scene_/);
 const after=await storedProof(page),added=after.scenes.filter(s=>!before.scenes.some(old=>old.id===s.id));expect(added).toHaveLength(1);expect(added[0].outputs.full).toBe(ids.manual);expect(added[0].manualOutputs.full.text).toBe(ids.manual);expect(after.scenes.filter(s=>s.id!==added[0].id)).toEqual(before.scenes);expect(after.collections[0].project.shots[1].selectedSceneId).toBe(before.collections[0].project.shots[1].selectedSceneId);
 await page.getByRole('tab',{name:'Narrative',exact:true}).click();await expect(page.getByText('Manual · blocking correspondence unverified',{exact:true})).toBeVisible();
});
test('legacy Character scene behavior and output bytes remain unchanged without blocking',async({page,context})=>{
 const ids=await seedBlocking(page,{legacy:true}),before=await storedProof(page);await context.grantPermissions(['clipboard-read','clipboard-write']);await observeClipboard(page);await page.getByRole('button',{name:'Assemble Prompt',exact:true}).click();await expect(page).toHaveURL(new RegExp('/output/'+ids.draftId));await page.getByRole('tab',{name:'Narrative',exact:true}).click();await page.getByRole('button',{name:'Copy Prompt',exact:true}).click();await expectCopied(page,ids.outputs.full);expect((await storedProof(page)).scenes).toEqual(before.scenes);
});
test.describe('touch blocking authoring',()=>{
 test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 test('places a participant with taps and saves only the explicit draft',async({page})=>{
  const ids=await seedBlocking(page),before=await storedProof(page);
  await page.getByRole('button',{name:'Edit blocking',exact:true}).tap();const dialog=page.getByRole('dialog',{name:'Shot blocking'});
  await dialog.getByRole('tab',{name:'End',exact:true}).tap();await dialog.getByRole('button',{name:'Place selected participant right foreground',exact:true}).tap();
  await expect(dialog.getByRole('combobox',{name:'Screen zone',exact:true})).toHaveValue('right');await expect(dialog.getByRole('combobox',{name:'Screen depth',exact:true})).toHaveValue('foreground');
  await dialog.getByRole('button',{name:'Save blocking draft',exact:true}).tap();await expect(dialog).toHaveCount(0);
  await expect.poll(async()=>{const s=await storedProof(page);return s.drafts.find(d=>d.id===ids.draftId)?.blocking?.participants[0]?.end?.zone;}).toBe('right');
  const after=await storedProof(page);expect(after.scenes).toEqual(before.scenes);expect(after.collections).toEqual(before.collections);expect(after.media).toEqual(before.media);
 });
});
for(const [width,height,dpr]of [[1440,900,1],[768,1024,1],[390,844,1],[720,450,2]])test.describe(`blocking authoring ${width} dpr${dpr}`,()=>{
 test.use({viewport:{width,height},deviceScaleFactor:dpr});
 test('board, forms, focus and long-text reflow',async({page})=>{
  await seedBlocking(page,{long:true});await mkdir('qa-results/blocking-authoring',{recursive:true});
  await expect(page.getByRole('button',{name:'Assemble Prompt',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`qa-results/blocking-authoring/builder-${width}-dpr${dpr}.png`,fullPage:true});
  const trigger=page.getByRole('button',{name:'Edit blocking',exact:true});await trigger.click();const dialog=page.getByRole('dialog',{name:'Shot blocking'});await expect(dialog.getByRole('figure',{name:'Editorial staging board'})).toBeVisible();
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await page.screenshot({path:`qa-results/blocking-authoring/editor-${width}-dpr${dpr}.png`});
  await dialog.getByRole('tab',{name:'Action',exact:true}).click();await dialog.getByRole('textbox',{name:'Movement instructions'}).fill('Synthetic unsaved movement');await page.keyboard.press('Escape');await dialog.getByRole('button',{name:'Keep editing'}).click();await expect(dialog.getByRole('textbox',{name:'Movement instructions'})).toHaveValue('Synthetic unsaved movement');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.getByRole('button',{name:'Discard edits'}).click();await expect(trigger).toBeFocused();
  if(width===1440||width===390){
   await trigger.click();await dialog.getByRole('combobox',{name:'Participant',exact:true}).selectOption('ensemble:marco');await dialog.getByRole('button',{name:'Add participant track',exact:true}).click();
   await expect(dialog.getByText('Off-camera-only binding',{exact:false})).toBeVisible();await page.screenshot({path:`qa-results/blocking-authoring/off-camera-${width}.png`});
   await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.getByRole('button',{name:'Discard edits'}).click();
   await page.evaluate(async()=>{const{getAllSnapshot}=await import('/src/storage/db.ts'),{writeRecord}=await import('/src/__tests__/fixtures/ensembleStorageFixture.ts'),draft=(await getAllSnapshot()).drafts.find(d=>d.id==='blocking-draft');if(!draft)throw Error('Missing owned fixture');delete draft.blocking;await writeRecord('drafts',draft);});await page.reload();await page.getByRole('button',{name:'Edit blocking',exact:true}).click();
   await expect(dialog.getByText('Blocking is optional. No plan is created by opening this view.',{exact:true})).toBeVisible();await page.screenshot({path:`qa-results/blocking-authoring/empty-${width}.png`});await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  }
 });
});
