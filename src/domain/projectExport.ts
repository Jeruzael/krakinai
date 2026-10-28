import { strToU8, Zip, AsyncZipDeflate } from 'fflate';
import type { Collection, MediaAsset, SavedScene, MediaRole, ShotType, MediaLink } from '../types/domain';
import type { LibrarySnapshot } from '../storage/db';
import { getProjectShots, getProjectRuntime, selectedSceneForShot } from './projectStoryboard';
import { formatProjectScript, getWardrobeContinuity } from './projectContinuity';
import { serializeSceneJson } from './sceneDocument';
import { serializeGenerationJson } from './generationDocument';
import { resolveGenerationIdentity } from './identityAnchors';
import { collectReferenceCandidates, getGenerationPackReferences } from './referencePack';
import { getActiveReferencePack, getActiveSceneSlots, getActiveSourceMediaLinks, resolveShotType } from './shotTypeRules';
import { getDownloadFilename, getMediaDisplayName, validateExportFilename } from './mediaNaming';

export const PROJECT_EXPORT_MEDIA_LIMIT = 128 * 1024 * 1024;
export const PROJECT_EXPORT_TEXT_LIMIT = 16 * 1024 * 1024;
export const PROJECT_EXPORT_ENTRY_LIMIT = 2000;
export interface ProjectExportOptions { excludedAssociationIds?: string[]; includeGenerationJson?: boolean; onProgress?: (stage:string)=>void; signal?: AbortSignal }
export interface ProjectExportAssociation { id:string; shotId?:string; sceneId?:string; associationId:string; mediaId:string; role?:MediaRole; purpose?:string; sourceSlot?:string; sourceId?:string; sourceTitle?:string; order:number; altText?:string; displayName:string; requestedFilename:string; capturedFilename?:string; capturedExportFilename?:string; namesCaptured?:true; originalFilename?:string; mimeType?:string; missing:boolean; excluded:boolean; archivePath?:string; sha256?:string }
export interface ProjectExportManifest { schema:'krakinai.project-export.v1'; project:{id:string;name:string;description:string;coverMediaId?:string;createdAt:string;updatedAt:string;revision?:number}; runtime:ReturnType<typeof getProjectRuntime>; documents:{readme:string;storyboard:string;script:string;continuity:string}; shots:Array<{id:string;order:number;code:string;title:string;takeSceneIds:string[];selectedSceneId?:string;status:string;plannedDurationSeconds?:number;plannedShotType?:ShotType;takeNotes?:Record<string,string>;continuityNotes?:string;intentionalWardrobeChange?:string;firstFrameMediaId?:string;lastFrameMediaId?:string;files?:{prompt:string;structured:string;compact:string;scene:string;generation?:string};selectedTake?:{id:string;title:string;revision:number;createdAt:string;updatedAt:string;sourceDraftId?:string;sourceDraftInputRevision?:number;sourceSceneId?:string;versionOfSceneId?:string;separateTakeOfSceneId?:string;reviewStatus:string;shotType?:ShotType;sourceMediaLinks?:MediaLink[];settings:SavedScene['settings'];sources:Array<{slot:string;sourceType:string;sourceId:string;sourceRevision:number;sourceTitle:string;parentCharacterId?:string;identityRevision?:number}>}}>; cast:NonNullable<NonNullable<Collection['project']>['cast']>; transitions:NonNullable<NonNullable<Collection['project']>['transitions']>; associations:ProjectExportAssociation[]; warnings:string[] }
export interface ProjectExportPlan { associations:ProjectExportAssociation[]; warnings:string[]; estimatedMediaBytes:number; estimatedTextUpperBound:number; estimatedEntries:number }

const pad=(n:number)=>String(n).padStart(4,'0');
const slug=(value:string,max=48)=>Array.from(value.normalize('NFKC').replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g,'-').replace(/[^\p{L}\p{N}._ -]+/gu,'-').replace(/\s+/g,'-').replace(/^[. -]+|[. -]+$/g,'')).slice(0,max).join('').replace(/[. -]+$/g,'') || 'item';
const stable=(value:string)=>Array.from(value).map(char=>char.codePointAt(0)!.toString(16)).join('-').slice(0,80) || 'id';
const truncateUtf8=(value:string,maxBytes:number)=>{let output='',used=0;for(const char of value){const bytes=new TextEncoder().encode(char).length;if(used+bytes>maxBytes)break;output+=char;used+=bytes;}return output.replace(/[. -]+$/g,'')||'item';};
const stableComponent=(prefix:string,id:string)=>{const suffix=stable(id);return `${truncateUtf8(prefix,240-new TextEncoder().encode(suffix).length-1)}-${suffix}`;};
const mimeExtension:Record<string,string>={'image/jpeg':'jpg','image/jpg':'jpg','image/png':'png','image/webp':'webp','image/svg+xml':'svg','video/mp4':'mp4','video/webm':'webm'};
const boundedName=(name:string,mime:string)=>{ try { validateExportFilename(name,mime); if(new TextEncoder().encode(name).length<=120) return name; } catch { /* legacy originals may have unsafe names */ } const ext=mimeExtension[mime];if(!ext) throw new Error(`Unsupported media MIME type for project export: ${mime}.`);let base=truncateUtf8(slug(name.replace(/\.[^.]*$/,''),48),100);if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base))base=`file-${base}`;return `${base}.${ext}`; };
const textBound=(value:unknown,limit:number):number=>{ let bound=4096; const add=(n:number)=>{bound+=n;if(bound>limit) throw new Error('Project export exceeds the 16 MiB generated text limit.');};const walk=(v:unknown)=>{ if(typeof v==='string') add(v.length*24+8); else if(Array.isArray(v)){add(v.length*32+16);v.forEach(walk);} else if(v && typeof v==='object' && !(v instanceof Blob)){const entries=Object.entries(v);add(entries.length*64+16);for(const [key,item] of entries){add(key.length*24);walk(item);}} else add(32);}; walk(value); return bound; };
const aborted=(signal?:AbortSignal)=>{if(signal?.aborted) throw new DOMException('Project export cancelled.','AbortError');};

function collect(collection:Collection,snapshot:LibrarySnapshot,options:ProjectExportOptions={},availableSceneIds=new Set(snapshot.scenes.map(scene=>scene.id))) {
 const shots=getProjectShots(collection,snapshot.scenes); const media=new Map(snapshot.media.map(m=>[m.id,m])); const excluded=new Set(options.excludedAssociationIds??[]); const associations:ProjectExportAssociation[]=[]; const warnings:string[]=[];
 const add=(mediaId:string,associationId:string,source:{shotId?:string;sceneId?:string;associationIndex?:number;role?:MediaRole;purpose?:string;sourceSlot?:string;sourceId?:string;sourceTitle?:string;order?:number;altText?:string;displayName?:string;filename?:string;exportFilename?:string;namesCaptured?:true})=>{
  const id=JSON.stringify([source.shotId??'',source.sceneId??'',associationId,source.associationIndex??0]); const file=media.get(mediaId); if(file&&source.exportFilename) getDownloadFilename(file,source,true);
  const requestedFilename=source.exportFilename??source.filename??file?.safeFilename??file?.filename??mediaId;
  associations.push({id,shotId:source.shotId,sceneId:source.sceneId,associationId,mediaId,role:source.role,purpose:source.purpose,sourceSlot:source.sourceSlot,sourceId:source.sourceId,sourceTitle:source.sourceTitle,order:source.order??0,altText:source.altText,displayName:source.displayName??(file?getMediaDisplayName(file,source,true):requestedFilename),requestedFilename,capturedFilename:source.filename,capturedExportFilename:source.exportFilename,namesCaptured:source.namesCaptured,originalFilename:file?.filename??source.filename,mimeType:file?.mimeType??undefined,missing:!file?.blob,excluded:excluded.has(id)});
 };
 if(collection.coverMediaId) add(collection.coverMediaId,'cover',{sourceSlot:'cover'});
 for(const cast of collection.project?.cast??[]) for(const [i,id] of (cast.referenceMediaIds??[]).entries()) add(id,`cast:${cast.characterId}:${i}`,{sourceSlot:'cast',order:i});
 for(const shot of shots){
  const scene=selectedSceneForShot(shot,snapshot.scenes);
  if(!shot.selectedSceneId) warnings.push(`${shot.code} ${shot.title}: no selected take.`);
  else if(!scene) warnings.push(`${shot.code} ${shot.title}: selected scene ${shot.selectedSceneId} is missing.`);
  for(const takeId of shot.takeSceneIds) if(!availableSceneIds.has(takeId) && takeId!==shot.selectedSceneId) warnings.push(`${shot.code} ${shot.title}: saved take ${takeId} is missing.`);
  if(shot.status==='planned') warnings.push(`${shot.code} ${shot.title}: planned shot.`);
  for(const field of ['firstFrameMediaId','lastFrameMediaId'] as const) if(shot[field]) add(shot[field]!,field,{shotId:shot.id,sourceSlot:field});
  if(!scene) continue;
  const entries=getActiveReferencePack(scene)?.entries ?? (resolveShotType(scene)!=='character_scene'?collectReferenceCandidates(scene,media).filter(entry=>entry.sourceSlot!=='result'):undefined);
  if(entries) for(const [i,entry] of [...entries].sort((a,b)=>a.order-b.order).entries()) add(entry.mediaId,entry.associationId||`pack:${i}`,{...entry,shotId:shot.id,sceneId:scene.id,associationIndex:i});
  else for(const [i,link] of scene.references.entries()) add(link.mediaId,`legacy:${i}`,{...link,shotId:shot.id,sceneId:scene.id,sourceSlot:'legacy',purpose:'general'});
 }
 return {shots,media,associations,warnings};
}
export function planProjectExport(collection:Collection,snapshot:LibrarySnapshot,options:ProjectExportOptions={}):ProjectExportPlan {
 const {shots,media,associations,warnings}=collect(collection,snapshot,options);
 const ids=new Set(associations.filter(a=>!a.excluded).map(a=>a.mediaId)); let estimatedMediaBytes=0;
 for(const id of ids) estimatedMediaBytes+=media.get(id)?.byteSize??0;
 const sources=shots.map(s=>selectedSceneForShot(s,snapshot.scenes)).filter(Boolean);
 const estimatedEntries=5+sources.length*(options.includeGenerationJson?5:4)+ids.size;
 let estimatedTextUpperBound:number;
 try { estimatedTextUpperBound=textBound([collection,sources,associations,warnings],PROJECT_EXPORT_TEXT_LIMIT); }
 catch { estimatedTextUpperBound=PROJECT_EXPORT_TEXT_LIMIT+1; }
 return {associations,warnings,estimatedMediaBytes,estimatedTextUpperBound,estimatedEntries};
}

const sha256=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const readBlob=async(blob:Blob):Promise<Uint8Array>=>typeof blob.arrayBuffer==='function'?new Uint8Array(await blob.arrayBuffer()):new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(new Uint8Array(reader.result as ArrayBuffer));reader.onerror=()=>reject(reader.error);reader.readAsArrayBuffer(blob);});

export async function buildProjectExport(collection:Collection,snapshot:LibrarySnapshot,options:ProjectExportOptions={}):Promise<{bytes:Uint8Array;filename:string;manifest:ProjectExportManifest}> {
 aborted(options.signal); options.onProgress?.('Checking project export limits');
 const initialPlan=planProjectExport(collection,snapshot,options);
 if(initialPlan.estimatedMediaBytes>PROJECT_EXPORT_MEDIA_LIMIT) throw new Error('Project export exceeds 128 MiB selected media. Exclude associations to reduce it.');
 if(initialPlan.estimatedEntries>PROJECT_EXPORT_ENTRY_LIMIT) throw new Error('Project export exceeds 2000 ZIP entries.');
 if(initialPlan.estimatedTextUpperBound>PROJECT_EXPORT_TEXT_LIMIT) throw new Error('Project export exceeds the 16 MiB generated text limit.');
 const initial=collect(collection,snapshot,options);
 const selectedSceneIds=new Set(initial.shots.map(shot=>shot.selectedSceneId).filter(Boolean));
 const selectedMediaIds=new Set(initial.associations.map(a=>a.mediaId));
 const captured={collection:structuredClone(collection),scenes:structuredClone(snapshot.scenes.filter(scene=>selectedSceneIds.has(scene.id))),media:snapshot.media.filter(item=>selectedMediaIds.has(item.id)).map(item=>({...item}))};
 const source={...snapshot,...captured}; const {shots,media,associations,warnings}=collect(captured.collection,source,options,new Set(snapshot.scenes.map(scene=>scene.id)));
 const plan=initialPlan;
 if(plan.estimatedMediaBytes>PROJECT_EXPORT_MEDIA_LIMIT) throw new Error('Project export exceeds 128 MiB selected media. Exclude associations to reduce it.');
 if(plan.estimatedEntries>PROJECT_EXPORT_ENTRY_LIMIT) throw new Error('Project export exceeds 2000 ZIP entries.');
 if(plan.estimatedTextUpperBound>PROJECT_EXPORT_TEXT_LIMIT) throw new Error('Project export exceeds the 16 MiB generated text limit.');
 const missing=associations.filter(a=>a.missing&&!a.excluded);
 if(missing.length) throw new Error(`Missing selected original media: ${missing.map(a=>`${a.id} (${a.mediaId})`).join('; ')}. Exclude each missing association explicitly to continue.`);
 const root=stableComponent(slug(captured.collection.name),captured.collection.id);
 const files:Record<string,Uint8Array>={}; let textBytes=0; const paths=new Set<string>();
 const addText=(path:string,value:string)=>{ const lower=path.toLowerCase();if(paths.has(lower)) throw new Error(`Duplicate ZIP path: ${path}`);paths.add(lower);const bytes=strToU8(value);textBytes+=bytes.length;if(textBytes>PROJECT_EXPORT_TEXT_LIMIT) throw new Error('Project export exceeds the 16 MiB generated text limit.');files[path]=bytes;};
 const records:ProjectExportManifest['shots']=[];
 const storyboard=[`# ${captured.collection.name}`,'',captured.collection.description,''];
 for(const [index,shot] of shots.entries()){
  aborted(options.signal); const scene=selectedSceneForShot(shot,source.scenes);
  const dir=scene?`${root}/shots/${stableComponent(`${pad(index+1)}-${slug(shot.code,16)}-${slug(shot.title,40)}`,shot.id)}`:undefined;
  const shotFiles=dir?{prompt:`${dir}/prompt.txt`,structured:`${dir}/structured.txt`,compact:`${dir}/compact.txt`,scene:`${dir}/scene.json`,...(options.includeGenerationJson?{generation:`${dir}/generation.json`}:{})}:undefined;
  records.push({...shot,files:shotFiles,selectedTake:scene?{id:scene.id,title:scene.title,revision:scene.revision,createdAt:scene.createdAt,updatedAt:scene.updatedAt,sourceDraftId:scene.sourceDraftId,sourceDraftInputRevision:scene.sourceDraftInputRevision,sourceSceneId:scene.sourceSceneId,versionOfSceneId:scene.versionOfSceneId,separateTakeOfSceneId:scene.separateTakeOfSceneId,reviewStatus:scene.reviewStatus,...(scene.shotType!==undefined?{shotType:scene.shotType}:{}),...(scene.sourceMediaLinks!==undefined?{sourceMediaLinks:getActiveSourceMediaLinks(scene)}:{}),settings:scene.settings,sources:Object.entries(getActiveSceneSlots(scene)).filter((entry):entry is [string,NonNullable<typeof entry[1]>]=>Boolean(entry[1])).map(([slot,value])=>({slot,sourceType:value.sourceType,sourceId:value.sourceId,sourceRevision:value.sourceRevision,sourceTitle:value.sourceTitle,parentCharacterId:value.parentCharacterId,identityRevision:value.identityRevision}))}:undefined});
  storyboard.push(`## ${shot.code} ${shot.title}`,`Status: ${shot.status}`,`Selected take: ${scene?.id??shot.selectedSceneId??'none'}`,`Planned duration: ${shot.plannedDurationSeconds??scene?.settings.durationSeconds??'unknown'}`,shot.continuityNotes??'','');
  if(!scene) continue;
  addText(shotFiles!.prompt,scene.outputs.full); addText(shotFiles!.structured,scene.outputs.structured);addText(shotFiles!.compact,scene.outputs.compact);
  addText(shotFiles!.scene,serializeSceneJson(scene));
  if(options.includeGenerationJson) addText(shotFiles!.generation!,serializeGenerationJson(scene,{identity:resolveGenerationIdentity(scene,undefined,true).identity,...(getActiveReferencePack(scene)?{references:getGenerationPackReferences(getActiveReferencePack(scene)!)}:{})}));
 }
 const documents={readme:`${root}/README.md`,storyboard:`${root}/storyboard.md`,script:`${root}/dialogue-script.md`,continuity:`${root}/continuity.md`};
 const manifest:ProjectExportManifest={schema:'krakinai.project-export.v1',project:{id:captured.collection.id,name:captured.collection.name,description:captured.collection.description,coverMediaId:captured.collection.coverMediaId,createdAt:captured.collection.createdAt,updatedAt:captured.collection.updatedAt,revision:captured.collection.project?.revision},runtime:getProjectRuntime(captured.collection,source.scenes),documents,shots:records,cast:captured.collection.project?.cast??[],transitions:captured.collection.project?.transitions??[],associations,warnings};
 addText(`${root}/README.md`,`# ${captured.collection.name}\n\nProject export. This ZIP is not a full library backup.\n\nSee manifest.json for source IDs, media hashes, exclusions and warnings.\n`);
 addText(`${root}/storyboard.md`,storyboard.join('\n'));
 addText(`${root}/dialogue-script.md`,formatProjectScript(captured.collection,source.scenes));
 addText(`${root}/continuity.md`,getWardrobeContinuity(captured.collection,source.scenes).map(r=>`${r.code} ${r.characterName}: ${r.wardrobeDescription??''}${r.intentionalReason?` (${r.intentionalReason})`:''}`).join('\n'));
 const selected=associations.filter(a=>!a.excluded);const unique=[...new Set(selected.map(a=>a.mediaId))];
 const actualMediaBytes=unique.reduce((total,id)=>total+media.get(id)!.blob.size,0);
 if(actualMediaBytes>PROJECT_EXPORT_MEDIA_LIMIT) throw new Error('Project export exceeds 128 MiB actual media size.');
 for(let i=0;i<unique.length;i+=2){
  aborted(options.signal);options.onProgress?.(`Reading media ${Math.min(i+2,unique.length)} of ${unique.length}`);
  await Promise.all(unique.slice(i,i+2).map(async(id,offset)=>{const record=media.get(id)!;const bytes=await readBlob(record.blob);aborted(options.signal);if(bytes.length!==record.blob.size) throw new Error(`Media size changed while reading ${id}.`);const first=selected.find(a=>a.mediaId===id)!;const name=boundedName(first.requestedFilename,record.mimeType);const path=`${root}/media/${pad(i+offset+1)}-${stable(id)}-${name}`;const lower=path.toLowerCase();if(paths.has(lower)) throw new Error(`Duplicate ZIP path: ${path}`);paths.add(lower);files[path]=bytes;const hash=await sha256(bytes);for(const a of selected.filter(a=>a.mediaId===id)){a.archivePath=path;a.sha256=hash;}}));
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 if(Object.keys(files).length+1>PROJECT_EXPORT_ENTRY_LIMIT) throw new Error('Project export exceeds 2000 ZIP entries.');
 addText(`${root}/manifest.json`,JSON.stringify(manifest,null,2));
 if(Object.keys(files).length>PROJECT_EXPORT_ENTRY_LIMIT) throw new Error('Project export exceeds 2000 ZIP entries.');
 aborted(options.signal);options.onProgress?.('Compressing project ZIP');
 const bytes=await new Promise<Uint8Array>((resolve,reject)=>{
  let done=false,total=0;const chunks:Uint8Array[]=[];const entries=Object.entries(files);
  const finish=(error?:unknown)=>{if(done)return;done=true;options.signal?.removeEventListener('abort',cancel);if(error){archive.terminate();reject(error);return;}const output=new Uint8Array(total);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}resolve(output);};
  const archive=new Zip((error,chunk,final)=>{if(done)return;if(error){finish(error);return;}if(chunk){chunks.push(chunk);total+=chunk.length;}if(final)finish();});
  const cancel=()=>finish(new DOMException('Project export cancelled.','AbortError'));
  const next=(index:number)=>{if(done)return;if(options.signal?.aborted){cancel();return;}if(index===entries.length){archive.end();return;}try{const [path,data]=entries[index];const stream=new AsyncZipDeflate(path,{level:6});archive.add(stream);const original=stream.ondata;stream.ondata=(error,chunk,final)=>{original(error,chunk,final);if(error){finish(error);return;}if(final&&!done)queueMicrotask(()=>next(index+1));};stream.push(data,true);}catch(error){finish(error);}};
  options.signal?.addEventListener('abort',cancel,{once:true});next(0);
 });
 return {bytes,filename:`${root}.zip`,manifest};
}
