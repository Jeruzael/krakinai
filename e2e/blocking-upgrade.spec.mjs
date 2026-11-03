import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {strFromU8,unzipSync} from 'fflate';
const database='krakinai_prompt_library_db';
async function legacy(page){
 await page.goto('/__qa_ready');
 return page.evaluate(async name=>{
  const {makeBlockingFixture}=await import('/src/__tests__/fixtures/blockingFixture.ts');
  const {getStarterTemplates}=await import('/src/domain/starterData.ts');
  const {state}=makeBlockingFixture();delete state.drafts[0].blocking;state.templates=getStarterTemplates();
  const stores=['assets','variants','media','drafts','scenes','collections','templates','preferences'];
  const request=indexedDB.open(name,1);request.onupgradeneeded=()=>{for(const store of stores)request.result.createObjectStore(store,{keyPath:'id'});};
  const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const tx=db.transaction(stores,'readwrite'),done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
  for(const store of stores)for(const record of store==='preferences'?[state.preferences]:state[store])tx.objectStore(store).put(record);
  await done;window.legacyConnection=db;return {counts:Object.fromEntries(stores.map(store=>[store,store==='preferences'?1:state[store].length]))};
 },database);
}
async function proof(page){return page.evaluate(async name=>{
 const r=window.legacyConnection?null:indexedDB.open(name),db=window.legacyConnection??await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const tx=db.transaction([...db.objectStoreNames],'readonly');
 const entries=await Promise.all([...db.objectStoreNames].map(async store=>{const req=tx.objectStore(store).getAll(),rows=await new Promise(resolve=>{req.onsuccess=()=>resolve(req.result);});return [store,rows];}));
 if(r)db.close();const records=Object.fromEntries(entries);
 records.media=await Promise.all(records.media.map(async({blob,posterBlob,...record})=>({...record,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join(''),...(posterBlob?{posterSize:posterBlob.size}:{})})));
 return {version:db.version,records};
},database);}
test('explicit header upgrade preserves real legacy records, late old-tab writes and media hashes',async({page,context})=>{
 await legacy(page);const initial=await proof(page),app=await context.newPage();await app.goto('/#/');
 await expect(app.getByRole('heading',{name:'Enable the blocking-compatible library?'})).toBeVisible();
 expect(await proof(page)).toEqual(initial);
 const downloaded=app.waitForEvent('download');await app.getByRole('button',{name:'Download pre-upgrade full backup'}).click();
 await expect(app.getByRole('status')).toContainText('media hashes checked');
 const bytes=await readFile(await(await downloaded).path()),manifest=JSON.parse(strFromU8(unzipSync(bytes)['manifest.json']));
 expect(manifest.schemaVersion).toBe(1);expect(manifest.scenes).toEqual(initial.records.scenes);expect(manifest.drafts).toEqual(initial.records.drafts);expect(manifest.preferences).toEqual(initial.records.preferences[0]);expect(await proof(page)).toEqual(initial);
 await app.getByRole('button',{name:'Enable blocking-compatible library'}).click();await expect(app.getByRole('status')).toContainText('older KRAKINAI tabs');
 await page.evaluate(async()=>{const db=window.legacyConnection,tx=db.transaction('assets','readwrite'),r=tx.objectStore('assets').get('environment');r.onsuccess=()=>tx.objectStore('assets').put({...r.result,notes:'Late legacy-tab write must remain.'});await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});});
 const before=await proof(page);await page.evaluate(()=>{window.legacyConnection.close();window.legacyConnection=null;});
 await expect(app.getByRole('heading',{name:'Enable the blocking-compatible library?'})).toHaveCount(0);
 const after=await proof(app);expect(after.version).toBe(2);expect(after.records).toEqual(before.records);
 await app.reload();await expect(app.getByRole('button',{name:'Scene Builder',exact:true}).first()).toBeVisible();expect((await proof(app)).records).toEqual(before.records);
 expect(await app.evaluate(async name=>{const r=indexedDB.open(name,1);return new Promise(resolve=>{r.onerror=()=>resolve(r.error.name);r.onsuccess=()=>{r.result.close();resolve('unexpected-open');};});},database)).toBe('VersionError');
});
test('Cancel before consent and during blocked enable leaves version 1 writable and never upgrades later',async({page,context})=>{
 await legacy(page);const before=await proof(page),app=await context.newPage();await app.goto('/#/');
 await app.getByRole('button',{name:'Cancel',exact:true}).click();expect(await proof(page)).toEqual(before);
 await app.getByRole('button',{name:'Enable blocking-compatible library'}).click();await expect(app.getByRole('status')).toContainText('older KRAKINAI tabs');
 await app.getByRole('button',{name:'Cancel',exact:true}).click();await expect(app.getByRole('status')).toContainText('not changed');
 await page.evaluate(()=>{window.legacyConnection.close();window.legacyConnection=null;});expect(await proof(page)).toEqual(before);
 await app.reload();await expect(app.getByRole('heading',{name:'Enable the blocking-compatible library?'})).toBeVisible();expect(await proof(page)).toEqual(before);
});
