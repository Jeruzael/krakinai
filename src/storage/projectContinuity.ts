import type { CharacterBibleEntry, Collection, MediaAsset, ProjectShot, ProjectTransition, PromptAsset, SavedScene, Variant, WardrobeIntentReason } from '../types/domain';
import { getProjectShots } from '../domain/projectStoryboard';
import { validateProject, type ProjectReferences } from '../domain/phase5ProjectValidation';
import { generateId, openDatabase } from './db';
import { validateMediaCandidate } from '../domain/validation';

function request<T>(req: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); }); }
function done(tx: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { tx.oncomplete=()=>resolve(); tx.onabort=()=>reject(tx.error ?? new Error('Project transaction aborted.')); tx.onerror=()=>reject(tx.error ?? new Error('Project transaction failed.')); }); }
function id(value: string, label: string): void { if(typeof value!=='string'||!value.trim()) throw new Error(`Invalid ${label}.`); }
async function mutate(collectionId: string, edit: (collection: Collection, references: ProjectReferences) => Collection): Promise<Collection> {
  id(collectionId,'collection ID');
  const db=await openDatabase();
  const tx=db.transaction(['collections','scenes','assets','variants','media'],'readwrite');
  const completion=done(tx);
  try {
    const store=tx.objectStore('collections');
    const collection=await request<Collection|undefined>(store.get(collectionId));
    if(!collection)throw new Error('Collection not found.');
    const [scenes,assets,variants,media]=await Promise.all([
      request<SavedScene[]>(tx.objectStore('scenes').getAll()),
      request<PromptAsset[]>(tx.objectStore('assets').getAll()),
      request<Variant[]>(tx.objectStore('variants').getAll()),
      request<MediaAsset[]>(tx.objectStore('media').getAll()),
    ]);
    const established=collection.project?collection:{...collection,project:{version:1 as const,revision:0,shots:getProjectShots(collection,scenes)}};
    const references={assets,variants,media,allowMissingCastSources:true};
    const next=edit(established,references);
    if(next!==established){
      const result={...next,project:{...next.project!,revision:next.project!.revision+1},updatedAt:new Date().toISOString()};
      const error=validateProject(result,scenes,true,references);
      if(error)throw new Error(error);
      store.put(result);
      await completion;return result;
    }
    if(established!==collection){store.put(established);await completion;return established;}
    await completion;return collection;
  }catch(error){try{tx.abort();}catch{}await completion.catch(()=>undefined);throw error;}
}
function shot(collection:Collection,shotId:string):ProjectShot { id(shotId,'shot ID');const result=collection.project!.shots.find(s=>s.id===shotId);if(!result)throw new Error('Project shot not found.');return result; }
function replaceShot(collection:Collection, replacement:ProjectShot):Collection {return {...collection,project:{...collection.project!,shots:collection.project!.shots.map(s=>s.id===replacement.id?replacement:s)}};}

function expectRevision(collection:Collection,expectedRevision?:number):void {if(expectedRevision!==undefined&&expectedRevision!==collection.project!.revision)throw new Error('Project revision conflict: refresh/reopen editor.');}
export function upsertProjectCast({collectionId,entry,expectedRevision}:{collectionId:string;entry:CharacterBibleEntry;expectedRevision?:number}):Promise<Collection> {return mutate(collectionId,(c,refs)=>{
  expectRevision(c,expectedRevision);
  if(!entry||typeof entry!=='object')throw new Error('Invalid project cast entry.');id(entry.characterId,'character ID');
  if(!refs.assets.some(a=>a.id===entry.characterId&&a.category==='characters'))throw new Error('Project cast character is unavailable.');
  if(entry.approvedWardrobeVariantIds?.some(variantId=>!refs.variants.some(v=>v.id===variantId&&v.parentCharacterId===entry.characterId&&v.type==='Outfit'&&v.targetSlot==='wardrobe')))throw new Error('Project cast wardrobe variant is unavailable.');
  if(entry.referenceMediaIds?.some(mediaId=>!refs.media.some(m=>m.id===mediaId&&m.mimeType.startsWith('image/'))))throw new Error('Project cast reference must be an existing image.');
  const cast=c.project!.cast??[];const prior=cast.find(e=>e.characterId===entry.characterId);
  if(prior&&JSON.stringify(prior)===JSON.stringify(entry))return c;
  return {...c,project:{...c.project!,cast:prior?cast.map(e=>e.characterId===entry.characterId?entry:e):[...cast,entry]}};
});}
export function removeProjectCast({collectionId,characterId}:{collectionId:string;characterId:string}):Promise<Collection> {return mutate(collectionId,c=>{
  id(characterId,'character ID');const cast=c.project!.cast??[];if(!cast.some(e=>e.characterId===characterId))return c;
  return {...c,project:{...c.project!,cast:cast.filter(e=>e.characterId!==characterId)}};
});}
export function updateProjectFrames({collectionId,shotId,firstFrameMediaId,lastFrameMediaId}:{collectionId:string;shotId:string;firstFrameMediaId?:string|null;lastFrameMediaId?:string|null}):Promise<Collection> {return mutate(collectionId,c=>{
  const old=shot(c,shotId);const next={...old};
  if(firstFrameMediaId!==undefined){if(firstFrameMediaId!==null)id(firstFrameMediaId,'first frame media ID');next.firstFrameMediaId=firstFrameMediaId??undefined;}
  if(lastFrameMediaId!==undefined){if(lastFrameMediaId!==null)id(lastFrameMediaId,'last frame media ID');next.lastFrameMediaId=lastFrameMediaId??undefined;}
  if(next.firstFrameMediaId===old.firstFrameMediaId&&next.lastFrameMediaId===old.lastFrameMediaId)return c;
  return replaceShot(c,next);
});}
export async function uploadProjectFrame({collectionId,shotId,side,file}:{collectionId:string;shotId:string;side:'firstFrameMediaId'|'lastFrameMediaId';file:File}):Promise<Collection> {
  id(collectionId,'collection ID');id(shotId,'shot ID');
  if(side!=='firstFrameMediaId'&&side!=='lastFrameMediaId')throw new Error('Invalid frame side.');
  if(!file||typeof file.name!=='string'||typeof file.type!=='string'||typeof file.size!=='number')throw new Error('Invalid image file.');
  const db=await openDatabase();
  const tx=db.transaction(['collections','scenes','assets','variants','media'],'readwrite');
  const completion=done(tx);
  try{
    const collectionStore=tx.objectStore('collections');const mediaStore=tx.objectStore('media');
    const [collection,scenes,assets,variants,media]=await Promise.all([
      request<Collection|undefined>(collectionStore.get(collectionId)),
      request<SavedScene[]>(tx.objectStore('scenes').getAll()),
      request<PromptAsset[]>(tx.objectStore('assets').getAll()),
      request<Variant[]>(tx.objectStore('variants').getAll()),
      request<MediaAsset[]>(mediaStore.getAll()),
    ]);
    if(!collection)throw new Error('Collection not found.');
    const established=collection.project?collection:{...collection,project:{version:1 as const,revision:0,shots:getProjectShots(collection,scenes)}};
    const current=shot(established,shotId);
    const total=media.reduce((sum,item)=>sum+item.byteSize+(item.posterBlob?.size??0),0);
    const candidate=validateMediaCandidate({name:file.name,type:file.type,size:file.size,existingCount:0,currentTotalBytes:total});
    if(!candidate.valid||candidate.kind!=='image')throw new Error(candidate.error??'Choose a supported image.');
    const now=new Date().toISOString();const mediaId=generateId('media');
    const record:MediaAsset={id:mediaId,filename:file.name,safeFilename:file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,80)||'media_file',mimeType:file.type,byteSize:file.size,blob:file,createdAt:now};
    const shots=established.project!.shots.map(s=>s.id===shotId?{...current,[side]:mediaId}:s);
    const updated:Collection={...established,project:{...established.project!,revision:established.project!.revision+1,shots},updatedAt:now};
    const error=validateProject(updated,scenes,true,{assets,variants,media:[...media,record],allowMissingCastSources:true});
    if(error)throw new Error(error);
    mediaStore.put(record);collectionStore.put(updated);
    await completion;return updated;
  }catch(error){try{tx.abort();}catch{}await completion.catch(()=>undefined);throw error;}
}
export function updateWardrobeIntent({collectionId,shotId,reason,notes}:{collectionId:string;shotId:string;reason?:WardrobeIntentReason|null;notes?:string}):Promise<Collection> {return mutate(collectionId,c=>{
  const old=shot(c,shotId);
  if(notes!==undefined&&(typeof notes!=='string'||notes.length>10000))throw new Error('Invalid continuity notes.');
  const next={...old,intentionalWardrobeChange:reason===undefined?old.intentionalWardrobeChange:reason??undefined,continuityNotes:notes===undefined?old.continuityNotes:notes};
  if(JSON.stringify(next)===JSON.stringify(old))return c;
  return replaceShot(c,next);
});}
export function upsertProjectTransition({collectionId,transition,expectedRevision}:{collectionId:string;transition:Omit<ProjectTransition,'id'>&{id?:string};expectedRevision?:number}):Promise<Collection> {return mutate(collectionId,c=>{
  expectRevision(c,expectedRevision);
  if(!transition||typeof transition!=='object')throw new Error('Invalid transition.');
  const transitionId=transition.id??generateId('transition');id(transitionId,'transition ID');
  const value:ProjectTransition={...transition,id:transitionId};const existing=c.project!.transitions??[];
  const old=existing.find(t=>t.id===transitionId);if(old&&JSON.stringify(old)===JSON.stringify(value))return c;
  return {...c,project:{...c.project!,transitions:old?existing.map(t=>t.id===transitionId?value:t):[...existing,value]}};
});}
export function removeProjectTransition({collectionId,transitionId}:{collectionId:string;transitionId:string}):Promise<Collection> {return mutate(collectionId,c=>{
  id(transitionId,'transition ID');const transitions=c.project!.transitions??[];if(!transitions.some(t=>t.id===transitionId))return c;
  return {...c,project:{...c.project!,transitions:transitions.filter(t=>t.id!==transitionId)}};
});}
