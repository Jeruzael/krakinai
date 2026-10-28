import { getDownloadFilename } from './mediaNaming';
import { strToU8, zipSync } from 'fflate';
import type { BuilderSlot, MediaAsset, MediaLink, ReferencePack, ReferencePackEntry, SavedScene, SceneDraft } from '../types/domain';
import type { GenerationReference } from './generationDocument';
import { SCENE_COMPONENT_ORDER } from './sceneDocument';
import { getActiveSceneSlots, getSourceReferenceEntries, resolveShotType } from './shotTypeRules';

const identity = (link: MediaLink) => JSON.stringify([link.mediaId, link.role, link.viewLabel ?? '', link.altText]);
const purposeFor = (slot: ReferencePackEntry['sourceSlot']): ReferencePackEntry['purpose'] => slot === 'character' ? 'identity' : slot === 'wardrobe' ? 'outfit' : slot === 'environment' ? 'environment' : slot === 'action' ? 'motion' : 'general';
export function collectReferenceCandidates(source: SceneDraft | SavedScene, mediaMap: ReadonlyMap<string, MediaAsset>): ReferencePackEntry[] {
 const entries: ReferencePackEntry[] = [];
 const add = (links: MediaLink[], slot: ReferencePackEntry['sourceSlot'], sourceId: string, sourceTitle: string) => {
  const occurrences = new Map<string, number>();
  for (const link of [...links].sort((a,b)=>a.order-b.order)) {
   const key=identity(link); const occurrence=occurrences.get(key) ?? 0; occurrences.set(key,occurrence+1);
   const media=mediaMap.get(link.mediaId);
   entries.push({associationId:JSON.stringify([slot,sourceId,key,occurrence]),mediaId:link.mediaId,sourceSlot:slot,sourceId,sourceTitle,role:link.role,altText:link.altText,filename:link.filename ?? media?.filename,mimeType:link.mimeType ?? media?.mimeType,displayName:link.displayName,exportFilename:link.exportFilename,namesCaptured:link.namesCaptured,purpose:purposeFor(slot),order:entries.length});
  }
 };
 const activeSlots=getActiveSceneSlots(source);
 for (const slot of SCENE_COMPONENT_ORDER) { const snapshot=activeSlots[slot as BuilderSlot]; if(snapshot) add(snapshot.mediaLinks,slot,snapshot.sourceId,snapshot.sourceTitle); }
 const sourceEntries=getSourceReferenceEntries(source);
 for(const entry of sourceEntries) { const media=mediaMap.get(entry.mediaId); entries.push({...entry,filename:entry.filename??media?.filename,mimeType:entry.mimeType??media?.mimeType,order:entries.length}); }
 // Legacy saved checklists can repeat snapshot associations. Consume matching occurrences only.
 const matched = new Map<string,number>();
 for(const slot of SCENE_COMPONENT_ORDER) for(const link of source.slots[slot]?.mediaLinks ?? []) { const key=identity(link); matched.set(key,(matched.get(key)??0)+1); }
 for(const link of source.sourceMediaLinks??[]) {const key=identity(link);matched.set(key,(matched.get(key)??0)+1);}
 if('references' in source) add(source.references.filter(link=>{const key=identity(link);const count=matched.get(key)??0;if(count){matched.set(key,count-1);return false;}return resolveShotType(source)==='character_scene' || Object.values(activeSlots).some(slot=>slot?.mediaLinks.some(active=>identity(active)===key));}),'legacy',source.id,source.title);
 add(source.resultMediaLinks,'result',source.id,source.title);
 return entries;
}
export function getGenerationPackReferences(pack: ReferencePack): GenerationReference[] {
 return [...pack.entries].sort((a,b)=>a.order-b.order).map(entry=>({associationId:entry.associationId,mediaId:entry.mediaId,sourceSlot:entry.sourceSlot,purpose:entry.purpose,order:entry.order,filename:entry.filename?.split(/[\\/]/).pop() || null,mimeType:entry.mimeType ?? null,role:entry.role,altText:entry.altText || null}));
}
export function formatReferencePackChecklist(pack: ReferencePack): string {
 return [...pack.entries].sort((a,b)=>a.order-b.order).map((entry,index)=>`${index+1}. ${entry.filename || entry.mediaId} — ${entry.sourceSlot}: ${entry.sourceTitle} | ${entry.role} | ${entry.purpose}${entry.altText ? ` | ${entry.altText}` : ''}`).join('\n');
}
const basename = (name: string) => (name.split(/[\\/]/).pop() || 'reference').replace(/[^a-zA-Z0-9._-]/g,'_').replace(/^\.+/,'').slice(0,100) || 'reference';
const readBlob = async (blob: Blob): Promise<Uint8Array> => {
 if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(new Uint8Array(reader.result as ArrayBuffer));reader.onerror=()=>reject(reader.error);reader.readAsArrayBuffer(blob);});
};
export async function buildReferencePackZip(pack: ReferencePack, mediaMap: ReadonlyMap<string, MediaAsset>): Promise<Uint8Array> {
 const ordered=[...pack.entries].sort((a,b)=>a.order-b.order);
 const missing=ordered.filter(entry=>!mediaMap.get(entry.mediaId)?.blob);
 if(missing.length) throw new Error(`Cannot export reference pack: missing original files for ${missing.map(entry=>`${entry.filename || entry.mediaId} (${entry.mediaId}, ${entry.sourceSlot}, ${entry.role})`).join('; ')}.`);
 const files: Record<string,Uint8Array>={}; const paths=new Map<string,string>();
 for(const entry of ordered) if(!paths.has(entry.mediaId)) {const media=mediaMap.get(entry.mediaId)!;const requested=getDownloadFilename(media,entry,true);const path=`media/${String(paths.size+1).padStart(3,'0')}-${entry.exportFilename ? requested : basename(requested)}`;paths.set(entry.mediaId,path);files[path]=await readBlob(media.blob);}
 files['manifest.json']=strToU8(JSON.stringify({schema:'krakinai.reference-pack.v1',version:1,entries:ordered.map(entry=>({...entry,binaryPath:paths.get(entry.mediaId)}))},null,2));
 return zipSync(files);
}
