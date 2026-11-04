import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
const name='krakinai_prompt_library_db';
const stores=['assets','variants','media','drafts','scenes','collections','templates','preferences'];
let factory:IDBFactory,compat:typeof import('../storage/libraryCompatibility');
const connections:IDBDatabase[]=[];
const request=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const done=(tx:IDBTransaction)=>new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});
async function raw(version:number){const r=factory.open(name,version);r.onupgradeneeded=e=>{if(e.oldVersion===0)for(const s of stores)r.result.createObjectStore(s,{keyPath:'id'});};const db=await request(r);connections.push(db);return db;}
async function seed(version:number){const db=await raw(version),tx=db.transaction(stores,'readwrite'),finished=done(tx);for(const s of stores)tx.objectStore(s).put({id:s+'-preserve',unknownHistoricalField:{value:'exact'},...(s==='media'?{blob:new Blob([new Uint8Array([1,2,3,4])],{type:'image/png'})}:{})});await finished;return db;}
async function snapshot(db:IDBDatabase){const tx=db.transaction(stores,'readonly'),finished=done(tx);const entries=await Promise.all(stores.map(async s=>[s,await request(tx.objectStore(s).getAll())]));await finished;return Object.fromEntries(entries);}
beforeEach(async()=>{vi.resetModules();factory=new IDBFactory();vi.stubGlobal('indexedDB',factory);compat=await import('../storage/libraryCompatibility');});
afterEach(()=>{for(const db of connections.splice(0))db.close();vi.restoreAllMocks();vi.unstubAllGlobals();});

it.each([1,2])('requires explicit consent for an existing version%i without changing any records',async version=>{
 const old=await seed(version),before=await snapshot(old);
 expect(await compat.inspectLibraryCompatibility()).toBe('legacy-v'+version);
 await expect(compat.openProtectedDatabase()).rejects.toThrow(/enable|upgrade|compatible/i);
 expect(old.version).toBe(version);expect(await snapshot(old)).toEqual(before);
});
it.each([1,2])('reads a complete pre-enable version%i backup without upgrading',async version=>{
 const old=await seed(version),before=await snapshot(old);old.close();
 expect(await compat.readLegacyRecordsForBackup()).toEqual(before);
 expect(await compat.inspectLibraryCompatibility()).toBe('legacy-v'+version);
});
it.each([1,2])('upgrades version%i to 4 with exact keys, unknown fields and original blob bytes',async version=>{
 const old=await seed(version),before=await snapshot(old);old.close();
 await compat.enableBlockingLibrary({onBlocked:()=>{throw Error('unexpected blocked');}});
 const current=await compat.openProtectedDatabase();connections.push(current);
 expect(current.version).toBe(4);expect([...current.objectStoreNames]).toEqual(stores.slice().sort());
 expect(await snapshot(current)).toEqual(before);
 expect(new Uint8Array(await (await snapshot(current)).media[0].blob.arrayBuffer())).toEqual(new Uint8Array([1,2,3,4]));
 for(const oldVersion of [1,2])await expect(request(factory.open(name,oldVersion))).rejects.toMatchObject({name:'VersionError'});
});
it('preserves a late B-tab write while a C upgrade waits for it to close',async()=>{
 const old=await seed(2);let unblock!:()=>void;const blocked=new Promise<void>(r=>{unblock=r;});
 const enabling=compat.enableBlockingLibrary({onBlocked:unblock});await blocked;
 const tx=old.transaction('drafts','readwrite'),finished=done(tx);tx.objectStore('drafts').put({id:'late-draft',text:'user work remains'});await finished;
 const before=await snapshot(old);old.close();await enabling;
 const current=await compat.openProtectedDatabase();connections.push(current);expect(current.version).toBe(4);expect(await snapshot(current)).toEqual(before);
});
it('cancels a blocked B upgrade and aborts it even when the old tab later closes',async()=>{
 const old=await seed(2),before=await snapshot(old),controller=new AbortController();let unblock!:()=>void;
 const blocked=new Promise<void>(r=>{unblock=r;});
 const enabling=compat.enableBlockingLibrary({signal:controller.signal,onBlocked:unblock}).then(()=> 'committed',(error:Error)=>error.name);
 await blocked;controller.abort();expect(await enabling).toBe('AbortError');old.close();
 const preserved=await raw(2);expect(await snapshot(preserved)).toEqual(before);expect(preserved.version).toBe(2);preserved.close();
 await compat.enableBlockingLibrary({onBlocked:()=>{}});expect(await compat.inspectLibraryCompatibility()).toBe('current-v4');
});
it('discards a rejected normal-open cache so explicit enable can be followed by a valid open',async()=>{
 const old=await seed(2);await expect(compat.openProtectedDatabase()).rejects.toThrow();old.close();
 await compat.enableBlockingLibrary({onBlocked:()=>{}});const current=await compat.openProtectedDatabase();connections.push(current);expect(current.version).toBe(4);
});
it('closes a C cached connection when a newer version opens and refuses to downgrade',async()=>{
 const current=await compat.openProtectedDatabase();connections.push(current);const future=await raw(5);
 expect(()=>current.transaction('assets','readwrite')).toThrow();expect(await compat.inspectLibraryCompatibility()).toBe('unsupported');
 await expect(compat.openProtectedDatabase()).rejects.toThrow(/newer|unsupported/i);future.close();
});
