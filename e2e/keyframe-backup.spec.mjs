import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const root=resolve('qa-results/keyframe-archives',Date.now()+'-'+randomUUID());
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function seed(page){await page.goto('/__qa_ready');return page.evaluate(async()=>{
 const bitmap=createImageBitmap,locks=navigator.locks;
 const {seedKeyframeStorage}=await import('/src/__tests__/fixtures/keyframeStorageFixture.ts'),f=await seedKeyframeStorage();
 if(bitmap!==createImageBitmap||locks!==navigator.locks)throw Error('Native browser media APIs changed.');
 const images=await import('/src/storage/frameImages.ts'),row=(await import('/src/__tests__/fixtures/frame-raster-fixtures.json')).default.files[0];
 await images.uploadFrameImage({target:{collectionId:f.projectId,expectedProjectRevision:f.state.collections[0].project.revision,shotId:f.shotId,sceneId:f.parent.id,expectedSceneRevision:f.parent.revision,frameId:'middle',expectedVisualDigest:f.parent.imagePromptSnapshots.middle.visualDigest,expectedAssociationRevision:0},file:new File([Uint8Array.from(atob(row.base64),c=>c.charCodeAt(0))],row.filename,{type:row.mime})});
 return{sceneId:f.parent.id,projectId:f.projectId};
});}
async function proof(page){return page.evaluate(async()=>{
 const r=indexedDB.open('krakinai_prompt_library_db'),db=await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const version=db.version,tx=db.transaction([...db.objectStoreNames],'readonly');
 const rows=await Promise.all([...db.objectStoreNames].map(async name=>{const r=tx.objectStore(name).getAll();return[name,await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);})];}));db.close();const records=Object.fromEntries(rows);
 const sha=async blob=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');
 records.media=await Promise.all(records.media.map(async({blob,posterBlob,...m})=>({...m,sha256:await sha(blob),...(posterBlob?{posterSha256:await sha(posterBlob)}:{})})));return JSON.parse(JSON.stringify({version,records}));
});}
test('C backup restores through actual confirmation controls with exact records, hashes and frame files',async({page})=>{
 const ids=await seed(page);await page.goto('/#/');await page.getByRole('button',{name:'Open Settings and ZIP Backup'}).click();const before=await proof(page);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export Full Backup (.zip)',exact:true}).click();const file=await download;await mkdir(root,{recursive:true});const backupPath=join(root,'full.zip');await file.saveAs(backupPath);
 await page.locator('#restore-zip-input').setInputFiles(backupPath);await expect(page.getByRole('button',{name:'Confirm & Replace Current Library'})).toBeVisible();expect(await proof(page)).toEqual(before);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await proof(page)).toEqual(before);await page.locator('#restore-zip-input').setInputFiles(backupPath);await page.getByRole('button',{name:'Confirm & Replace Current Library'}).click();await expect(page.getByText('Library restored from full ZIP backup.',{exact:true})).toBeVisible();expect(await proof(page)).toEqual(before);
 await page.reload();await expect(page.getByRole('button',{name:'Open Settings and ZIP Backup'})).toBeVisible();expect(await proof(page)).toEqual(before);
 const project=await page.evaluate(async projectId=>{const db=await import('/src/storage/db.ts'),exporter=await import('/src/domain/projectExport.ts'),state=await db.getAllSnapshot(),result=await exporter.buildProjectExport(state.collections.find(c=>c.id===projectId),state,{includeGenerationJson:true});return{bytes:Array.from(result.bytes),manifest:result.manifest};},ids.projectId);
 await writeFile(join(root,'project.zip'),Buffer.from(project.bytes));const bytes=await readFile(backupPath),expectations={syntheticOnly:true,archives:{'full.zip':{sha256:hash(bytes),records:before.records},'project.zip':{sha256:hash(Buffer.from(project.bytes)),manifest:project.manifest}}};await writeFile(join(root,'expectations.json'),JSON.stringify(expectations,null,2));
 await writeFile(join(root,'browser-results.json'),JSON.stringify({syntheticOnly:true,success:true,backupPath,projectPath:join(root,'project.zip'),exactRecordsAndHashes:true,explicitConfirmation:true,cancelPreserved:true,reloadPreserved:true},null,2));console.log('SYNTHETIC_KEYFRAME_ARCHIVE_DIRECTORY',root);
});
test('frozen pre-C production build rejects actual C archive through its restore input before writes',async({page,browser})=>{
 test.skip(!process.env.KRAKINAI_FROZEN_C_BASE_BUILD,'Requires the retained pre-C production build; no current-source substitute is accepted.');
 await seed(page);const bytes=await page.evaluate(async()=>Array.from(await(await import('/src/storage/backup.ts')).exportFullBackupZip()));await mkdir(root,{recursive:true});const zipPath=join(root,'frozen-reader-input.zip');await writeFile(zipPath,Buffer.from(bytes));
 const oldRoot=resolve(process.env.KRAKINAI_FROZEN_C_BASE_BUILD),server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),path=resolve(oldRoot,'.'+(name==='/'?'/index.html':name));if(!path.startsWith(oldRoot+sep)){res.writeHead(403).end();return;}res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(path)]??'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404).end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const context=await browser.newContext();
 try{const old=await context.newPage();await old.goto(`http://127.0.0.1:${server.address().port}/`);await old.getByRole('button',{name:'Open Settings and ZIP Backup'}).click();const before=await proof(old);expect(before.version).toBe(2);
  await old.locator('#restore-zip-input').setInputFiles(zipPath);const rejection=old.getByText('Unsupported, missing or inconsistent full-backup requiredFeatures.',{exact:true});await expect(rejection).toBeVisible();await expect(old.getByRole('button',{name:'Confirm & Replace Current Library'})).toHaveCount(0);expect(await proof(old)).toEqual(before);await rejection.scrollIntoViewIfNeeded();const screenshot=join(root,'frozen-old-reader-rejection.png');await old.screenshot({path:screenshot});
  await writeFile(join(root,'frozen-old-reader-results.json'),JSON.stringify({syntheticOnly:true,success:true,oldBuild:oldRoot,indexSha256:hash(await readFile(join(oldRoot,'index.html'))),archiveSha256:hash(Buffer.from(bytes)),oldLibraryHeader:before.version,unchangedRecordsAndMedia:true,screenshot},null,2));
 }finally{await context.close();await new Promise(resolve=>server.close(resolve));}
});
