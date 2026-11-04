import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
let factory:IDBFactory,compat:typeof import('../storage/libraryCompatibility');const connections:IDBDatabase[]=[];
const req=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
beforeEach(async()=>{vi.resetModules();factory=new IDBFactory();vi.stubGlobal('indexedDB',factory);compat=await import('../storage/libraryCompatibility');});
afterEach(()=>{connections.forEach(db=>db.close());connections.length=0;vi.unstubAllGlobals();});
it.each([1,2,3])('requires explicit protected v%i upgrade and preserves every store',async version=>{
 const r=factory.open(compat.DB_NAME,version);r.onupgradeneeded=()=>{for(const s of compat.STORE_NAMES)r.result.createObjectStore(s,{keyPath:'id'});};const old=await req(r);connections.push(old);
 const tx=old.transaction([...compat.STORE_NAMES],'readwrite');for(const store of compat.STORE_NAMES)tx.objectStore(store).put({id:store,text:'synthetic exact unknown historical fields',nested:{a:[1,2,3]}});await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve();});
 expect(await compat.inspectLibraryCompatibility()).toBe('legacy-v'+version);await expect(compat.openProtectedDatabase()).rejects.toThrow();old.close();const before=await compat.readLegacyRecordsForBackup();
 await compat.enableBlockingLibrary({onBlocked:()=>{throw Error('unexpected block');}});const current=await compat.openProtectedDatabase();connections.push(current);expect(current.version).toBe(4);expect([...current.objectStoreNames]).toHaveLength(8);
 const read=current.transaction([...compat.STORE_NAMES],'readonly');for(const store of compat.STORE_NAMES)expect(await req(read.objectStore(store).getAll())).toEqual(before[store]);
 for(const version of [1,2,3])await expect(req(factory.open(compat.DB_NAME,version))).rejects.toMatchObject({name:'VersionError'});
});
