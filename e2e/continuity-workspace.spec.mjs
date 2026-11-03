import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { seedContinuityFixture } from './continuity-fixture.mjs';
import { storedProof } from './storyboard-fixture.mjs';

const route=(ids,view='overview')=>`/#/collections/${ids.collectionId}?tab=continuity&view=grid&sort=updated&filter=&shot=${ids.shotIds[0]}&continuity=${view}`;
test('focused continuity views inspect frozen records and restore exact return context without writes',async({page})=>{
 const ids=await seedContinuityFixture(page),before=await storedProof(page);
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`/#/collections/${ids.collectionId}?tab=storyboard`);
 await page.getByRole('tab',{name:'Continuity',exact:true}).click();
 for(const view of ['Overview','Wardrobe','Frames & Prompts','Blocking','Transitions']){
  await page.getByRole('tab',{name:view,exact:true}).click();
  await expect(page.getByRole('tab',{name:view,exact:true})).toHaveAttribute('aria-selected','true');
 }
 await page.getByRole('searchbox',{name:'Find a shot',exact:true}).fill('Shot 2');
 await expect(page.getByRole('status').filter({hasText:'selected shot is outside'})).toBeVisible();
 await expect(page.getByRole('complementary',{name:'Selected shot inspector'})).toContainText('01 Arrival at the station');
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 expect(await storedProof(page)).toEqual(before);
 await page.goto(route(ids,'wardrobe'));
 const url=page.url();await page.getByRole('button',{name:'Open saved take',exact:true}).click();
 await expect(page).toHaveURL(new RegExp('/output/'+ids.sceneIds[0]));
 await page.getByRole('button',{name:/Back to Collection/}).click();
 await expect(page.getByRole('tab',{name:'Wardrobe',exact:true})).toHaveAttribute('aria-selected','true');
 expect(new URL(page.url()).hash).toBe(new URL(url).hash);
 expect(await storedProof(page)).toEqual(before);
});
test('dirty desktop edits retain text on cancelled discard and only change explicit shot review metadata',async({page})=>{
 const ids=await seedContinuityFixture(page);await page.setViewportSize({width:1440,height:900});await page.goto(route(ids));
 const before=await storedProof(page);
 await page.getByRole('button',{name:'Review wardrobe',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Intentional change reason',exact:true})).toBeFocused();
 await page.getByRole('textbox',{name:'Continuity notes',exact:true}).fill('Synthetic intentional continuity note');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Continuity notes',exact:true})).toHaveValue('Synthetic intentional continuity note');
 await page.getByRole('button',{name:'Save review',exact:true}).click();
 await expect(page.getByRole('button',{name:'Review wardrobe',exact:true})).toBeVisible();
 const after=await storedProof(page);expect(after.scenes).toEqual(before.scenes);expect(after.media).toEqual(before.media);
 const old=before.collections.find(c=>c.id===ids.collectionId),saved=after.collections.find(c=>c.id===ids.collectionId);
 expect(saved.project.revision).toBe(old.project.revision+1);
 expect(saved.project.shots[0]).toEqual({...old.project.shots[0],continuityNotes:'Synthetic intentional continuity note'});
 expect(saved.project.shots.slice(1)).toEqual(old.project.shots.slice(1));
});
test('refresh, browser history and explicit global discard preserve exact context and source records',async({page})=>{
 const ids=await seedContinuityFixture(page);await page.setViewportSize({width:1440,height:900});await page.goto(route(ids));
 const before=await storedProof(page);
 await page.getByRole('tab',{name:'Wardrobe',exact:true}).click();const wardrobeUrl=page.url();
 await page.reload();await expect(page.getByRole('tab',{name:'Wardrobe',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:'Review wardrobe',exact:true}).click();
 await page.getByRole('textbox',{name:'Continuity notes',exact:true}).fill('Recover on browser Back');
 await page.goBack();await page.goForward();
 await expect(page).toHaveURL(wardrobeUrl);
 await expect(page.getByRole('textbox',{name:'Continuity notes',exact:true})).toHaveValue('Recover on browser Back');
 await page.getByRole('button',{name:'Back to Collections',exact:true}).click();
 await page.getByRole('button',{name:'Stay on Page',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Continuity notes',exact:true})).toHaveValue('Recover on browser Back');
 await page.getByRole('button',{name:'Back to Collections',exact:true}).click();
 await page.getByRole('button',{name:'Discard Changes',exact:true}).click();
 await page.goBack();
 await expect(page.getByRole('button',{name:'Review wardrobe',exact:true})).toBeVisible();
 expect(await storedProof(page)).toEqual(before);
});
test('frame Clear after browser Back requires explicit discard of a dirty wardrobe review',async({page})=>{
 const ids=await seedContinuityFixture(page);await page.setViewportSize({width:1440,height:900});await page.goto(route(ids,'frames'));
 const before=await storedProof(page);
 await page.getByRole('tab',{name:'Wardrobe',exact:true}).click();
 await page.getByRole('button',{name:'Review wardrobe',exact:true}).click();
 await page.getByRole('textbox',{name:'Continuity notes',exact:true}).fill('Keep this unrelated review');
 await page.goBack();await expect(page.getByRole('tab',{name:'Frames & Prompts',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByText('Legacy First / Last images',{exact:true}).click();
 await page.getByRole('button',{name:'Clear',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Discard unsaved review?',exact:true})).toBeVisible();
 expect(await storedProof(page)).toEqual(before);
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Continuity notes',exact:true})).toHaveValue('Keep this unrelated review');
 await page.getByRole('button',{name:'Clear',exact:true}).click();
 await page.getByRole('button',{name:'Discard changes',exact:true}).click();
 await expect(page.getByRole('button',{name:'Clear',exact:true})).toHaveCount(0);
 const after=await storedProof(page);expect(after.scenes).toEqual(before.scenes);expect(after.media).toEqual(before.media);
 const saved=after.collections.find(c=>c.id===ids.collectionId);
 expect(saved.project.shots[0].lastFrameMediaId).toBeUndefined();
 expect(saved.project.shots[0].continuityNotes).toBe(before.collections.find(c=>c.id===ids.collectionId).project.shots[0].continuityNotes);
});
for(const [width,height]of[[1440,900],[768,1024],[390,844],[720,450]]){
 test(`continuity workspace keyboard, original preview and reflow at ${width}`,async({page})=>{
  const ids=await seedContinuityFixture(page);await page.setViewportSize({width,height});await page.goto(route(ids));
  const before=await storedProof(page);
  const tabs=page.getByRole('tablist',{name:'Continuity views'});
  await tabs.getByRole('tab',{name:'Overview',exact:true}).focus();await page.keyboard.press('End');
  await expect(tabs.getByRole('tab',{name:'Transitions',exact:true})).toBeFocused();
  await expect(page.getByRole('tablist',{name:'Project sections'}).getByRole('tab',{name:'Continuity',exact:true})).toHaveAttribute('aria-selected','true');
  const original=page.getByRole('button',{name:/Enlarge .*last frame/}).first();await original.click();
  await expect(page.getByRole('dialog')).toHaveCount(1);await page.keyboard.press('Escape');await expect(original).toBeFocused();
  await page.getByRole('tab',{name:'Wardrobe',exact:true}).click();
  const trigger=page.getByRole('button',{name:'Review wardrobe',exact:true});await trigger.click();
  await page.getByLabel('Continuity notes',{exact:true}).fill('Unsaved synthetic text');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard changes',exact:true}).click();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const dir='docs/screenshots/continuity-workspace-a/after';await mkdir(dir,{recursive:true});
  for(const [view,name]of[['Overview','overview'],['Wardrobe','wardrobe'],['Frames & Prompts','frames'],['Transitions','transitions']]){
   await page.getByRole('tab',{name:view,exact:true}).click();
   if(name==='frames')await page.getByText('Legacy First / Last images',{exact:true}).click();
   await page.locator('.pc-inspector,.pc-content-scroll').evaluateAll(els=>els.forEach(el=>el.scrollTop=0));
   for(const img of await page.locator('.pc-frame-preview img').all()){
    await expect(img).toBeVisible();await expect.poll(()=>img.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
   }
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:`${dir}/${name}-${width}.png`,fullPage:width<=1000});
  }
  expect(await storedProof(page)).toEqual(before);
 });
}
test.describe('continuity at DPR2 reflow',()=>{
 test.use({deviceScaleFactor:2});
 test('outer and inner tab keys stay scoped at 720 CSS pixels',async({page})=>{
  const ids=await seedContinuityFixture(page);await page.setViewportSize({width:720,height:450});await page.goto(route(ids));
  const before=await storedProof(page),sections=page.getByRole('tablist',{name:'Project sections'});
  await sections.getByRole('tab',{name:'Continuity',exact:true}).focus();await page.keyboard.press('End');
  await expect(sections.getByRole('tab',{name:'Project Details',exact:true})).toBeFocused();
  await page.keyboard.press('Home');await expect(sections.getByRole('tab',{name:'Storyboard',exact:true})).toBeFocused();
  await page.keyboard.press('ArrowRight');await expect(sections.getByRole('tab',{name:'Continuity',exact:true})).toBeFocused();
  const views=page.getByRole('tablist',{name:'Continuity views'});
  await views.getByRole('tab',{name:'Overview',exact:true}).focus();await page.keyboard.press('End');
  await expect(views.getByRole('tab',{name:'Transitions',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>devicePixelRatio)).toBe(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(await storedProof(page)).toEqual(before);
 });
});
