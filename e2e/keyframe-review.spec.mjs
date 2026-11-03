import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {seedKeyframes,readKeyframeLibrary} from './keyframe-fixture.mjs';

for(const control of ['manual','clear','plan'])test(`Output ${control} rejects an intervening draft write and preserves local work`,async({page})=>{
 const ids=await seedKeyframes(page);await page.goto('/#/output/'+ids.draftId+'?outputTab=frames&frame=middle');
 if(control==='clear'){
  const row=JSON.parse(await readFile('src/__tests__/fixtures/frame-raster-fixtures.json','utf8')).files[0],input=page.getByLabel('Upload draft frame image',{exact:true});await expect(input).toBeEnabled();await input.setInputFiles({name:'synthetic.png',mimeType:row.mime,buffer:Buffer.from(row.base64,'base64')});await expect(page.getByText('Draft image retained · needs review',{exact:true})).toBeVisible();await expect(input).toBeEnabled();
 }
 if(control==='manual'){const edit=page.getByRole('button',{name:'Edit manual image prompt',exact:true});await expect(edit).toBeEnabled();await edit.click();await page.getByRole('textbox',{name:'Manual full image prompt',exact:true}).fill('Preserve my unsaved image text');}
 if(control==='plan'){await page.getByRole('button',{name:'Edit frame plan',exact:true}).click();await page.getByLabel('Frame label',{exact:true}).fill('Preserve my unsaved label');}
 await page.evaluate(async id=>{const db=await import('/src/storage/db.ts'),d=(await db.getAllSnapshot()).drafts.find(d=>d.id===id);await db.saveSceneDraft({...d,title:'Newer other-tab title',expectedInputRevision:d.inputRevision});},ids.draftId);const newer=await readKeyframeLibrary(page);
 await page.getByRole('button',{name:control==='manual'?'Save manual image text':control==='clear'?'Clear draft frame image association':'Save frame plan',exact:true}).click();await expect(page.getByText(/This draft changed in another tab/)).toBeVisible();expect(await readKeyframeLibrary(page)).toEqual(newer);
 if(control==='manual')await expect(page.getByRole('textbox',{name:'Manual full image prompt',exact:true})).toHaveValue('Preserve my unsaved image text');
 if(control==='plan')await expect(page.getByLabel('Frame label',{exact:true})).toHaveValue('Preserve my unsaved label');
});
test('Output explicitly removes the optional plan while retaining immutable scenes, references and media',async({page})=>{
 const ids=await seedKeyframes(page),before=await readKeyframeLibrary(page);await page.goto('/#/output/'+ids.draftId+'?outputTab=frames');await page.getByRole('button',{name:'Edit frame plan',exact:true}).click();await page.getByRole('button',{name:'Remove frame plan',exact:true}).click();await page.getByRole('button',{name:'Confirm remove frame plan',exact:true}).click();await page.getByRole('button',{name:'Save frame plan',exact:true}).click();await expect(page.getByRole('dialog',{name:'Image frame plan',exact:true})).not.toBeVisible();const after=await readKeyframeLibrary(page);expect(after.drafts.find(d=>d.id===ids.draftId).keyframePlan).toBeUndefined();expect(after.scenes).toEqual(before.scenes);expect(after.media).toEqual(before.media);expect(after.collections).toEqual(before.collections);
});
