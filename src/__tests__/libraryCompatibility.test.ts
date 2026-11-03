import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
const name='krakinai_prompt_library_db',stores=['assets','variants','media','drafts','scenes','collections','templates','preferences'];
let factory:IDBFactory,compat:typeof import('../storage/libraryCompatibility');
const owned:IDBDatabase[]=[];
const request=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const complete=(tx:IDBTransaction)=>new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error);});
async function raw(version:number,omitted?:string){const r=factory.open(name,version);r.onupgradeneeded=event=>{if(event.oldVersion===0)for(const store of stores.filter(s=>s!==omitted))r.result.createObjectStore(store,{keyPath:'id'});};const db=await request(r);owned.push(db);return db;}
async function legacy(omitted?:string){const db=await raw(1,omitted),tx=db.transaction([...db.objectStoreNames],'readwrite'),done=complete(tx);for(const store of db.objectStoreNames)tx.objectStore(store).put({id:store+'_opaque_record',value:'Preserve even unknown historical fields.',...(store==='media'?{blob:new Blob([new Uint8Array([137,80,78,71,1,2,3])],{type:'image/png'})}:{})});await done;return db;}
async function snapshot(db:IDBDatabase){const tx=db.transaction([...db.objectStoreNames],'readonly'),done=complete(tx);const rows=await Promise.all([...db.objectStoreNames].map(async store=>[store,await request(tx.objectStore(store).getAll())]));await done;return Object.fromEntries(rows);}
beforeEach(async()=>{vi.resetModules();factory=new IDBFactory();vi.stubGlobal('indexedDB',factory);compat=await import('../storage/libraryCompatibility');});
afterEach(()=>{for(const db of owned.splice(0))db.close();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('does not create a database when inspecting an absent library, including the no-databases fallback',async()=>{
 expect(await compat.inspectLibraryCompatibility()).toBe('absent');expect(await factory.databases()).toEqual([]);
 const inventory=factory.databases.bind(factory);Object.defineProperty(factory,'databases',{value:undefined});
 expect(await compat.inspectLibraryCompatibility()).toBe('absent');expect(await inventory()).toEqual([]);
});
it('refuses normal B opens on v1 without changing records or the database header',async()=>{
 const db=await legacy(),before=await snapshot(db);
 expect(await compat.inspectLibraryCompatibility()).toBe('legacy-v1');
 await expect(compat.openProtectedDatabase()).rejects.toThrow(/enable|upgrade|compatible/i);
 expect(await snapshot(db)).toEqual(before);expect(db.version).toBe(1);
});
it('reads every legacy store in one read-only backup snapshot without enabling or initializing',async()=>{
 const db=await legacy(),before=await snapshot(db);db.close();
 expect(await compat.readLegacyRecordsForBackup()).toEqual(before);expect(await compat.inspectLibraryCompatibility()).toBe('legacy-v1');
 const reopened=await raw(1);expect(await snapshot(reopened)).toEqual(before);
});
it('does not create an absent library just to offer a pre-upgrade backup',async()=>{
 await expect(compat.readLegacyRecordsForBackup()).rejects.toThrow(/existing|legacy|version/i);expect(await factory.databases()).toEqual([]);
});
it('guards the actual application openDatabase entry point rather than only a separate helper',async()=>{
 const old=await legacy(),before=await snapshot(old),{openDatabase}=await import('../storage/db');
 await expect(openDatabase()).rejects.toThrow(/enable|upgrade|compatible/i);expect(await snapshot(old)).toEqual(before);
});
it('upgrades only the header and keeps all eight stores, keys, unknown fields and blob bytes',async()=>{
 const old=await legacy(),before=await snapshot(old),oldBlob=new Uint8Array(await before.media[0].blob.arrayBuffer());old.close();
 await compat.enableBlockingLibrary({onBlocked:()=>{throw Error('Unexpected blocking');}});
 const db=await compat.openProtectedDatabase();owned.push(db);expect(db.version).toBe(3);expect([...db.objectStoreNames]).toEqual(stores.slice().sort());
 const after=await snapshot(db);expect(after).toEqual(before);expect(new Uint8Array(await after.media[0].blob.arrayBuffer())).toEqual(oldBlob);
 await expect(request(factory.open(name,1))).rejects.toMatchObject({name:'VersionError'});
});
it('waits for an old tab and preserves its late write before the upgrade commits',async()=>{
 const old=await legacy();let sawBlocked!:()=>void;const blocked=new Promise<void>(resolve=>{sawBlocked=resolve});
 const upgrade=compat.enableBlockingLibrary({onBlocked:sawBlocked});await blocked;
 const tx=old.transaction('assets','readwrite'),done=complete(tx);tx.objectStore('assets').put({id:'late-old-tab',value:'Do not lose this.'});await done;
 const before=await snapshot(old);old.close();await upgrade;
 const db=await compat.openProtectedDatabase();owned.push(db);expect(await snapshot(db)).toEqual(before);
});
it('aborts a cancelled blocked request when it later receives the upgrade transaction',async()=>{
 const old=await legacy(),before=await snapshot(old),controller=new AbortController();let sawBlocked!:()=>void;
 const blocked=new Promise<void>(resolve=>{sawBlocked=resolve});const outcome=compat.enableBlockingLibrary({signal:controller.signal,onBlocked:sawBlocked}).then(()=> 'success',(error:Error)=>error.name);
 await blocked;controller.abort();expect(await outcome).toBe('AbortError');old.close();
 const reopened=await raw(1);expect(reopened.version).toBe(1);expect(await snapshot(reopened)).toEqual(before);
});
it('does not open an already-cancelled upgrade and can retry after cancellation',async()=>{
 const old=await legacy(),controller=new AbortController();old.close();controller.abort();
 await expect(compat.enableBlockingLibrary({signal:controller.signal,onBlocked:()=>{}})).rejects.toMatchObject({name:'AbortError'});
 expect(await compat.inspectLibraryCompatibility()).toBe('legacy-v1');await compat.enableBlockingLibrary({onBlocked:()=>{}});expect(await compat.inspectLibraryCompatibility()).toBe('current-v3');
});
it('reports success if commit wins a late cancellation rather than claiming the header stayed v1',async()=>{
 const old=await legacy();old.close();const controller=new AbortController(),open=factory.open.bind(factory);
 vi.spyOn(factory,'open').mockImplementation((...args:Parameters<IDBFactory['open']>)=>{const r=open(...args);if(args[1]===3)r.addEventListener('upgradeneeded',()=>r.transaction!.addEventListener('complete',()=>controller.abort()));return r;});
 await expect(compat.enableBlockingLibrary({signal:controller.signal,onBlocked:()=>{}})).resolves.toBeUndefined();expect(await compat.inspectLibraryCompatibility()).toBe('current-v3');
});
it('closes a B connection on versionchange, discards its cache and rejects a newer library',async()=>{
 const [db,same]=await Promise.all([compat.openProtectedDatabase(),compat.openProtectedDatabase()]);owned.push(db);expect(db).toBe(same);
 const r=factory.open(name,4);r.onblocked=()=>{throw Error('B failed to close its cached connection.');};const future=await request(r);owned.push(future);
 expect(()=>db.transaction('assets','readwrite')).toThrow();expect(await compat.inspectLibraryCompatibility()).toBe('unsupported');await expect(compat.openProtectedDatabase()).rejects.toThrow(/newer|unsupported/i);
});
it('creates only the existing eight stores in a genuinely fresh v3 library',async()=>{
 const db=await compat.openProtectedDatabase();owned.push(db);expect(db.version).toBe(3);const snap=await snapshot(db);expect(Object.keys(snap)).toHaveLength(8);expect(Object.values(snap).flat()).toEqual([]);
});
it('preserves an inconsistent legacy schema instead of silently recreating missing stores',async()=>{
 const old=await legacy('media'),before=await snapshot(old);old.close();
 await expect(compat.enableBlockingLibrary({onBlocked:()=>{}})).rejects.toThrow(/store|schema/i);
 const reopened=await raw(1,'media');expect(await snapshot(reopened)).toEqual(before);
});
it('rejects an inconsistent v2 schema without creating or repairing stores',async()=>{
 const old=await raw(2,'media'),before=await snapshot(old);old.close();
 await expect(compat.openProtectedDatabase()).rejects.toThrow(/enable|upgrade/i);
 await expect(compat.enableBlockingLibrary({onBlocked:()=>{}})).rejects.toThrow(/store|schema/i);
 const reopened=await raw(2,'media');expect(await snapshot(reopened)).toEqual(before);
});
