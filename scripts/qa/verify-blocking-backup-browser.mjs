// Synthetic only. Retains its dedicated profiles and archives; never attaches to a browser.
import {createServer as httpServer} from 'node:http';
import {createServer as viteServer} from 'vite';
import {chromium,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
if(!args.includes('--old-build')||!args.includes('--output'))throw Error('Pass --old-build FROZEN_BASE_BUILD --output NEW_SYNTHETIC_DIRECTORY.');
const oldRoot=resolve(option('--old-build')),out=resolve(option('--output')),profileRoot=args.includes('--profile-root')?resolve(option('--profile-root')):out;
await readFile(join(oldRoot,'index.html'));await mkdir(out,{recursive:false});
const id=randomUUID(),profile=join(profileRoot,`v2-${id}`),oldProfile=join(profileRoot,`v1-${id}`);
if(process.platform==='win32'&&join(profile,'Default/IndexedDB/http_127.0.0.1_5191.indexeddb.leveldb/MANIFEST-000001').length>=250)throw Error('Use --profile-root with a short, new synthetic QA location for Windows Chromium backing-store paths.');
await mkdir(profileRoot,{recursive:true});
const log={syntheticOnly:true,profilesRetained:[profile,oldProfile],cases:[],startedAt:new Date().toISOString()};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let context,oldContext,source,oldServer;
const proof=page=>page.evaluate(async()=>{
 const r=indexedDB.open('krakinai_prompt_library_db'),db=await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const tx=db.transaction([...db.objectStoreNames],'readonly'),entries=await Promise.all([...db.objectStoreNames].map(async name=>{const r=tx.objectStore(name).getAll();return[name,await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);})];}));
 const version=db.version;db.close();const records=Object.fromEntries(entries);
 const hash=async blob=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');
 records.media=await Promise.all(records.media.map(async({blob,posterBlob,...rest})=>({...rest,sha256:await hash(blob),...(posterBlob?{posterSha256:await hash(posterBlob)}:{})})));
 return JSON.parse(JSON.stringify({version,records}));
});
try{
 source=await viteServer({logLevel:'error',cacheDir:join(out,'vite-cache'),optimizeDeps:{entries:['index.html']},server:{host:'127.0.0.1',port:5191,strictPort:true,watch:{ignored:['**/.superpowers/**','**/qa-results/**']}}});
 await source.listen();await source.warmupRequest('/src/main.tsx');await source.waitForRequestsIdle();
 oldServer=httpServer(async(req,res)=>{try{
  if(req.url==='/__qa_ready'){res.end('synthetic ready');return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1:5192').pathname),file=resolve(oldRoot,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(oldRoot+sep)){res.writeHead(403).end();return;}
  res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]??'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404).end();}});
 await new Promise((resolve,reject)=>{oldServer.once('error',reject);oldServer.listen(5192,'127.0.0.1',resolve);});
 context=await chromium.launchPersistentContext(profile,{headless:true});let page=await context.newPage();await page.goto('http://127.0.0.1:5191/');await expect(page.getByRole('button',{name:'Open Settings and ZIP Backup'})).toBeVisible();
 const data=await page.evaluate(async()=>{
  const {seedBlockingStorage}=await import('/src/__tests__/fixtures/blockingStorageFixture.ts');await seedBlockingStorage({saveScene:true,select:true});
  const {exportFullBackupZip}=await import('/src/storage/backup.ts');const zip=await exportFullBackupZip();
  const {makeBlockingFixture}=await import('/src/__tests__/fixtures/blockingFixture.ts');const legacy=makeBlockingFixture().state;delete legacy.drafts[0].blocking;
  const {getStarterTemplates}=await import('/src/domain/starterData.ts');legacy.templates=getStarterTemplates();
  const media=await Promise.all(legacy.media.map(async({blob,posterBlob,...rest})=>({...rest,bytes:[...new Uint8Array(await blob.arrayBuffer())]})));
  return{zip:[...zip],legacy:JSON.parse(JSON.stringify({...legacy,media}))};
 });
 await page.reload();await expect(page.getByRole('button',{name:'Open Settings and ZIP Backup'})).toBeVisible();
 const original=await proof(page),zipPath=join(out,'synthetic-blocking-v2.zip');await writeFile(zipPath,Uint8Array.from(data.zip));log.archive={path:zipPath,bytes:data.zip.length,sha256:sha(Uint8Array.from(data.zip))};
 await page.getByRole('button',{name:'Open Settings and ZIP Backup'}).click();await page.locator('#restore-zip-input').setInputFiles(zipPath);
 await expect(page.getByRole('button',{name:'Confirm & Replace Current Library'})).toBeVisible();assert.deepEqual(await proof(page),original);
 await page.getByRole('button',{name:'Confirm & Replace Current Library'}).click();await expect(page.getByText('Library restored from full ZIP backup.',{exact:true})).toBeVisible();assert.deepEqual(await proof(page),original);
 log.cases.push({name:'v2 actual restore controls: validation, explicit confirmation, replacement, records and media SHA-256',pass:true});
 await context.close();context=await chromium.launchPersistentContext(profile,{headless:true});page=await context.newPage();await page.goto('http://127.0.0.1:5191/');await expect(page.getByRole('button',{name:'Open Settings and ZIP Backup'})).toBeVisible();assert.deepEqual(await proof(page),original);log.cases.push({name:'v2 full browser-process restart: exact records, saved IDs, outputs and hashes',pass:true});
 log.restored={version:original.version,counts:Object.fromEntries(Object.entries(original.records).map(([key,rows])=>[key,rows.length])),sceneIds:original.records.scenes.map(s=>s.id),media:original.records.media};
 oldContext=await chromium.launchPersistentContext(oldProfile,{headless:true});const oldPage=await oldContext.newPage();await oldPage.goto('http://127.0.0.1:5192/__qa_ready');
 await oldPage.evaluate(async legacy=>{
  const stores=['assets','variants','media','drafts','scenes','collections','templates','preferences'],r=indexedDB.open('krakinai_prompt_library_db',1);r.onupgradeneeded=()=>{for(const store of stores)r.result.createObjectStore(store,{keyPath:'id'});};
  const db=await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}),tx=db.transaction(stores,'readwrite');
  for(const store of stores)for(const row of store==='preferences'?[legacy.preferences]:legacy[store]){if(store==='media'){const {bytes,...metadata}=row;tx.objectStore(store).put({...metadata,blob:new Blob([Uint8Array.from(bytes)],{type:row.mimeType})});}else tx.objectStore(store).put(row);}
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();
 },data.legacy);
 await oldPage.goto('http://127.0.0.1:5192/');await oldPage.getByRole('button',{name:'Open Settings and ZIP Backup'}).click();const beforeOld=await proof(oldPage);
 await oldPage.locator('#restore-zip-input').setInputFiles(zipPath);await expect(oldPage.getByText('Unsupported or missing schemaVersion (expected 1).',{exact:true})).toBeVisible();await expect(oldPage.getByRole('button',{name:'Confirm & Replace Current Library'})).toHaveCount(0);assert.deepEqual(await proof(oldPage),beforeOld);
 await oldPage.getByText('Unsupported or missing schemaVersion (expected 1).',{exact:true}).scrollIntoViewIfNeeded();
 await oldPage.screenshot({path:join(out,'frozen-old-reader-rejection.png')});
 log.cases.push({name:'frozen old production build rejects v2 via actual restore file control; v1 library and media unchanged',pass:true});log.frozenIndexHash=sha(await readFile(join(oldRoot,'index.html')));log.success=true;
 console.log(JSON.stringify(log));
}catch(error){log.success=false;log.error={name:error.name,message:error.message};console.error(error);process.exitCode=1;}
finally{await oldContext?.close();await context?.close();await source?.close();if(oldServer)await new Promise(resolve=>oldServer.close(resolve));log.finishedAt=new Date().toISOString();await writeFile(join(out,'results.json'),JSON.stringify(log,null,2));}
