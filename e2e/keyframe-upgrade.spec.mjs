import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
const name='krakinai_prompt_library_db';
async function seedOld(page,version){
 await page.goto('/__qa_ready');
 return page.evaluate(async({name,version})=>{
  const {makeBlockingFixture}=await import('/src/__tests__/fixtures/blockingFixture.ts');
  const {getStarterTemplates}=await import('/src/domain/starterData.ts');
  const {state}=makeBlockingFixture();if(version===1)delete state.drafts[0].blocking;state.templates=getStarterTemplates();
  const stores=['assets','variants','media','drafts','scenes','collections','templates','preferences'];
  const r=indexedDB.open(name,version);r.onupgradeneeded=()=>{for(const store of stores)r.result.createObjectStore(store,{keyPath:'id'});};
  const db=await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const tx=db.transaction(stores,'readwrite'),done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
  for(const store of stores)for(const row of store==='preferences'?[state.preferences]:state[store])tx.objectStore(store).put(row);
  await done;window.oldCUpgradeConnection=db;
 },{name,version});
}
async function proof(page){return page.evaluate(async name=>{
 const r=window.oldCUpgradeConnection?undefined:indexedDB.open(name);
 const db=window.oldCUpgradeConnection??await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const version=db.version,tx=db.transaction([...db.objectStoreNames],'readonly');
 const records=Object.fromEntries(await Promise.all([...db.objectStoreNames].map(async store=>{const r=tx.objectStore(store).getAll();return [store,await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);})];})));
 if(r)db.close();
 records.media=await Promise.all(records.media.map(async({blob,...record})=>({...record,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('')})));
 return {version,records};
},name);}
for(const version of [1,2]){
 test(`C explicit header-only upgrade preserves version${version} data and late writes`,async({page,context})=>{
  await seedOld(page,version);const before=await proof(page),app=await context.newPage();await app.goto('/#/');
  await expect(app.getByRole('heading',{name:'Enable the keyframe-compatible library?'})).toBeVisible();expect(await proof(page)).toEqual(before);
  const download=app.waitForEvent('download');await app.getByRole('button',{name:'Download pre-upgrade full backup'}).click();
  await expect(app.getByRole('status')).toContainText('media hashes checked');
  const archive=await readFile(await(await download).path()),manifest=JSON.parse(strFromU8(unzipSync(archive)['manifest.json']));
  expect(manifest.scenes).toEqual(before.records.scenes);expect(manifest.drafts).toEqual(before.records.drafts);expect(await proof(page)).toEqual(before);
  await app.getByRole('button',{name:'Enable keyframe-compatible library'}).click();await expect(app.getByRole('status')).toContainText('older KRAKINAI tabs');
  await page.evaluate(async()=>{const tx=window.oldCUpgradeConnection.transaction('drafts','readwrite'),r=tx.objectStore('drafts').get('blocking-draft');r.onsuccess=()=>tx.objectStore('drafts').put({...r.result,reviewNotes:'Preserved late old-build draft'});await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});});
  const late=await proof(page);await page.evaluate(()=>{window.oldCUpgradeConnection.close();window.oldCUpgradeConnection=null;});
  await expect(app.getByRole('heading',{name:'Enable the keyframe-compatible library?'})).toHaveCount(0);const after=await proof(app);
  expect(after.version).toBe(3);expect(after.records).toEqual(late.records);await app.reload();expect((await proof(app)).records).toEqual(late.records);
  for(const oldVersion of [1,2])expect(await app.evaluate(async({name,oldVersion})=>{const r=indexedDB.open(name,oldVersion);return new Promise(resolve=>{r.onerror=()=>resolve(r.error.name);r.onsuccess=()=>{r.result.close();resolve('unexpected-open');};});},{name,oldVersion})).toBe('VersionError');
 });
 test(`Cancel never upgrades version${version}, including a blocked request released later`,async({page,context})=>{
  await seedOld(page,version);const before=await proof(page),app=await context.newPage();await app.goto('/#/');
  await app.getByRole('button',{name:'Cancel',exact:true}).click();expect(await proof(page)).toEqual(before);
  await app.getByRole('button',{name:'Enable keyframe-compatible library'}).click();await expect(app.getByRole('status')).toContainText('older KRAKINAI tabs');
  await app.getByRole('button',{name:'Cancel',exact:true}).click();await expect(app.getByRole('status')).toContainText('not changed');
  await page.evaluate(()=>{window.oldCUpgradeConnection.close();window.oldCUpgradeConnection=null;});expect(await proof(page)).toEqual(before);
 });
}
