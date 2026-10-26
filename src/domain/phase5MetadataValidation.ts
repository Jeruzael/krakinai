import { validateDisplayName, validateExportFilename } from './mediaNaming';
/** Validate optional metadata only, leaving all historical canonical fields untouched. */
export function validatePhase5Metadata(value: unknown, mediaMimes: ReadonlyMap<string,string>, mediaRecord=false): string | null {
 if(!value || typeof value!=='object')return null;
 const record=value as Record<string,unknown>;
 try{
  if(record.displayName!==undefined)validateDisplayName(record.displayName as string);
  if(record.namesCaptured!==undefined && record.namesCaptured!==true)throw new Error('Invalid captured media name marker.');
  if(record.exportFilename!==undefined){const mime=typeof record.mediaId==='string'?mediaMimes.get(record.mediaId):typeof record.mimeType==='string'?record.mimeType:undefined;if(!mime)throw new Error('Export Filename has no matching media MIME.');validateExportFilename(record.exportFilename as string,mime);}
  if(!mediaRecord)for(const child of Object.values(record)){if(Array.isArray(child)){for(const item of child){const error=validatePhase5Metadata(item,mediaMimes);if(error)return error;}}else if(child && typeof child==='object'){const error=validatePhase5Metadata(child,mediaMimes);if(error)return error;}}
  return null;
 }catch(error){return error instanceof Error?error.message:'Invalid media naming metadata.';}
}
