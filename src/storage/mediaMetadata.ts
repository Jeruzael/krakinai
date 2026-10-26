import type { MediaAsset } from '../types/domain';
import { validateDisplayName, validateExportFilename } from '../domain/mediaNaming';
import { openDatabase } from './db';
export async function updateMediaNames(input: {mediaId: string; displayName?: string; exportFilename?: string}): Promise<MediaAsset> {
 const db=await openDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['media'],'readwrite'); const store=tx.objectStore('media'); let result:MediaAsset; let failure:unknown;
  tx.oncomplete=()=>resolve(result); tx.onerror=()=>reject(failure ?? tx.error ?? new Error('Media metadata save failed.')); tx.onabort=()=>reject(failure ?? tx.error ?? new Error('Media metadata save aborted.'));
  const req=store.get(input.mediaId);
  req.onsuccess=()=>{try{
   const current=req.result as MediaAsset|undefined;if(!current)throw new Error('Media file no longer exists.');
   result={...current};
   if(input.displayName!==undefined) result.displayName=validateDisplayName(input.displayName);
   if(input.exportFilename!==undefined){if(input.exportFilename==='')delete result.exportFilename;else result.exportFilename=validateExportFilename(input.exportFilename,current.mimeType);}
   store.put(result);
  }catch(error){failure=error;tx.abort();}};
 });
}
