export const DB_NAME='krakinai_prompt_library_db';
export const DB_VERSION=2;
export const STORE_NAMES=['assets','variants','media','drafts','scenes','collections','templates','preferences'] as const;
export type StoreName=typeof STORE_NAMES[number];
export type LibraryCompatibility='absent'|'legacy-v1'|'current-v2'|'unsupported';
export class LibraryUpgradeRequiredError extends Error{
 constructor(){super('Enable the blocking-compatible library format before this build can open the existing library. Older builds will then be prevented from reopening it.');this.name='LibraryUpgradeRequiredError';}
}
const api=()=>{if(typeof indexedDB==='undefined')throw Error('IndexedDB is unavailable in this browser.');return indexedDB;};
const versionState=(version:number):LibraryCompatibility=>version===1?'legacy-v1':version===DB_VERSION?'current-v2':'unsupported';
const aborted=()=>new DOMException('Library upgrade cancelled before commit. Existing records are preserved.','AbortError');

/** Header-only inspection; abort a fallback probe before creating a missing DB. */
export async function inspectLibraryCompatibility():Promise<LibraryCompatibility>{
 const factory=api();
 if(typeof factory.databases==='function'){
  const info=(await factory.databases()).find(d=>d.name===DB_NAME);
  if(!info)return 'absent';if(typeof info.version==='number')return versionState(info.version);
 }
 return new Promise((resolve,reject)=>{
  let absent=false;const request=factory.open(DB_NAME);
  request.onupgradeneeded=event=>{if(event.oldVersion===0){absent=true;request.transaction!.abort();}};
  request.onsuccess=()=>{const db=request.result,state=versionState(db.version);db.close();resolve(state);};
  request.onerror=()=>{if(absent&&request.error?.name==='AbortError')resolve('absent');else reject(request.error??Error('Cannot inspect the local library.'));};
  request.onblocked=()=>reject(Error('Another window is updating the library. Finish that operation, then retry.'));
 });
}
function schema(db:IDBDatabase,transaction:IDBTransaction,oldVersion:number){
 if(oldVersion===0){for(const store of STORE_NAMES)db.createObjectStore(store,{keyPath:'id'});return;}
 if(db.objectStoreNames.length!==STORE_NAMES.length||STORE_NAMES.some(name=>!db.objectStoreNames.contains(name)||transaction.objectStore(name).keyPath!=='id'))throw Error('The legacy library has an unsupported store schema. No stores or records were repaired or removed.');
}
/** Read-only pre-enable backup input; never uses normal initialization or creates a DB. */
export async function readLegacyRecordsForBackup():Promise<Record<StoreName,unknown[]>>{
 if(await inspectLibraryCompatibility()!=='legacy-v1')throw Error('A pre-upgrade backup requires an existing version 1 legacy library.');
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{
  const request=api().open(DB_NAME,1);
  request.onupgradeneeded=()=>request.transaction!.abort();
  request.onerror=()=>reject(request.error??Error('Cannot read the existing legacy library.'));
  request.onsuccess=()=>resolve(request.result);
 });
 db.onversionchange=()=>db.close();
 try{
  const tx=db.transaction([...STORE_NAMES],'readonly');schema(db,tx,1);
  const done=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error??Error('Legacy backup read failed.'));});
  const entries=await Promise.all(STORE_NAMES.map(async name=>{const req=tx.objectStore(name).getAll();const rows=await new Promise<unknown[]>((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return[name,rows] as const;}));
  await done;return Object.fromEntries(entries) as Record<StoreName,unknown[]>;
 }finally{db.close();}
}
let dbPromise:Promise<IDBDatabase>|null=null;
/** All ordinary application readers/writers use this guarded, version-aware connection. */
export function openProtectedDatabase():Promise<IDBDatabase>{
 if(dbPromise)return dbPromise;
 const pending=(async()=>{
  const state=await inspectLibraryCompatibility();
  if(state==='legacy-v1')throw new LibraryUpgradeRequiredError();
  if(state==='unsupported')throw Error('This library uses a newer or unsupported database version. Open it with a compatible KRAKINAI build.');
  return new Promise<IDBDatabase>((resolve,reject)=>{
   const request=api().open(DB_NAME,DB_VERSION);let failure:Error|undefined,cancelled=false;
   request.onupgradeneeded=event=>{
    try{
     // Guard the inspect/open race: another old build may have created v1 meanwhile.
     if(cancelled||event.oldVersion!==0){failure=new LibraryUpgradeRequiredError();request.transaction!.abort();return;}
     schema(request.result,request.transaction!,event.oldVersion);
    }catch(error){failure=error as Error;request.transaction?.abort();}
   };
   request.onblocked=()=>{cancelled=true;failure=new LibraryUpgradeRequiredError();reject(failure);};
   request.onerror=()=>reject(failure??request.error??Error('Failed to open the local library.'));
   request.onsuccess=()=>{
    const db=request.result;if(cancelled){db.close();return;}
    try{schema(db,db.transaction([...STORE_NAMES],'readonly'),DB_VERSION);}catch(error){db.close();reject(error);return;}
    db.addEventListener('versionchange',()=>{db.close();if(dbPromise===pending)dbPromise=null;});resolve(db);
   };
  });
 })();
 dbPromise=pending;void pending.catch(()=>{if(dbPromise===pending)dbPromise=null;});return pending;
}

/** Explicit UI consent calls this; no record writes, cursor migration or forced close. */
export async function enableBlockingLibrary(options:{signal?:AbortSignal;onBlocked:()=>void}):Promise<void>{
 if(options.signal?.aborted)throw aborted();
 const state=await inspectLibraryCompatibility();
 if(options.signal?.aborted)throw aborted();
 if(state==='current-v2')return;
 if(state==='unsupported')throw Error('A newer or unsupported library cannot be downgraded.');
 await new Promise<void>((resolve,reject)=>{
  let cancelled=false,settled=false,transaction:IDBTransaction|undefined,failure:Error|undefined;
  const finish=(error?:unknown)=>{if(settled)return;settled=true;options.signal?.removeEventListener('abort',cancel);error?reject(error):resolve();};
  const cancel=()=>{
   if(settled)return;
   if(transaction){try{transaction.abort();}catch{return;}} // A completed commit wins; report success in onsuccess.
   cancelled=true;finish(aborted());
  };
  const request=api().open(DB_NAME,DB_VERSION);options.signal?.addEventListener('abort',cancel,{once:true});
  request.onblocked=()=>{if(!settled)try{options.onBlocked();}catch(error){failure=error as Error;cancel();}};
  request.onupgradeneeded=event=>{
   transaction=request.transaction!;
   if(cancelled||options.signal?.aborted){cancelled=true;transaction.abort();return;}
   try{schema(request.result,transaction,event.oldVersion);}catch(error){failure=error as Error;transaction.abort();}
  };
  request.onerror=()=>finish(failure??(cancelled?aborted():request.error??Error('Library upgrade failed. Existing records are preserved.')));
  request.onsuccess=()=>{request.result.close();if(cancelled)finish(aborted());else finish();};
  if(options.signal?.aborted)cancel();
 });
}
