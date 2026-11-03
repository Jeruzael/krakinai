import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {seedContinuityFixture} from '../../e2e/continuity-fixture.mjs';
// Own ephemeral Chromium contexts and a strict QA port; never attach to a live browser.
const out=resolve('.superpowers/sdd/2026-11-03-shot-blocking-spatial-continuity-b');
const server=await createServer({logLevel:'error',cacheDir:join(out,'vite-cache'),optimizeDeps:{entries:['index.html']},server:{host:'127.0.0.1',port:5191,strictPort:true,watch:{ignored:['**/qa-results/**','**/.superpowers/**']}}});
let browser;const screenshots=[];
try{
 await server.listen();await server.warmupRequest('/src/main.tsx');await server.waitForRequestsIdle();console.log('Synthetic before capture ready on 5191');browser=await chromium.launch();
 for(const [width,height,deviceScaleFactor]of [[1440,900,1],[768,1024,1],[390,844,1],[720,450,2]]){
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5191',viewport:{width,height},deviceScaleFactor}),page=await context.newPage();
  const ids=await seedContinuityFixture(page);
  console.log('Seeded synthetic context',width,height,deviceScaleFactor);
  await page.goto(`/#/collections/${ids.collectionId}?tab=continuity&shot=${ids.shotIds[0]}&continuity=blocking`);
  await expect(page.getByRole('heading',{name:'Blocking workspace',exact:true})).toBeVisible();
  await mkdir(join(out,'before'),{recursive:true});
  const file=join(out,'before',`continuity-${width}-dpr${deviceScaleFactor}.png`);await page.screenshot({path:file,fullPage:true});
  screenshots.push({file,width,height,deviceScaleFactor,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
  const draftId=await page.evaluate(async sceneId=>{const snap=await(await import('/src/storage/db.ts')).getAllSnapshot();return snap.scenes.find(scene=>scene.id===sceneId)?.sourceDraftId;},ids.sceneIds[0]);
  if(!draftId)throw Error('Synthetic fixture did not preserve a builder draft.');
  await page.goto('/#/builder/'+draftId);await expect(page.getByRole('button',{name:'Assemble Prompt',exact:true})).toBeVisible();
  const builder=join(out,'before',`builder-${width}-dpr${deviceScaleFactor}.png`);await page.screenshot({path:builder,fullPage:true});
  screenshots.push({file:builder,width,height,deviceScaleFactor,sha256:createHash('sha256').update(await readFile(builder)).digest('hex')});
  await context.close();
 }
 const inventory=[];async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=join(dir,entry.name);if(entry.isDirectory())await walk(file);else inventory.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});}}
 await walk(join(out,'frozen-base-build'));
 await writeFile(join(out,'before-evidence.json'),JSON.stringify({syntheticOnly:true,origin:'http://127.0.0.1:5191',screenshots,frozenBuild:inventory},null,2));
 console.log(JSON.stringify({screenshots:screenshots.length,frozenFiles:inventory.length}));
}finally{await browser?.close();await server.close();}
