import type {Collection,ProjectShot,ProductionStatus,SavedScene} from '../types/domain';
import {getProjectShots,projectMembersFromShots} from '../domain/projectStoryboard';
import {validateProject,validateShotChange} from '../domain/phase5ProjectValidation';
import {generateId,openDatabase} from './db';
import {beginLibraryWrite,libraryCaughtError,libraryTransactionError} from './libraryWrite';

function request<T>(req:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function done(tx:IDBTransaction):Promise<void>{return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(libraryTransactionError(tx,'Project transaction aborted.'));tx.onerror=()=>reject(libraryTransactionError(tx,'Project transaction failed.'));});}
function requireId(id:string,label:string):void{if(typeof id!=='string'||!id.trim())throw new Error(`Invalid ${label}.`);}
function renumber(shots:ProjectShot[]):ProjectShot[]{return shots.map((shot,order)=>({...shot,order}));}
function established(collection:Collection,scenes:SavedScene[]):Collection{
  return collection.project?collection:{...collection,project:{version:1,revision:0,shots:getProjectShots(collection,scenes)}};
}
async function mutate(collectionId:string,change:(collection:Collection,scenes:SavedScene[])=>Collection):Promise<Collection>{
  requireId(collectionId,'collection ID');
  const db=await openDatabase();const tx=beginLibraryWrite(db,['collections','scenes']);const completion=done(tx);
  try{
    const store=tx.objectStore('collections');const collection=await request<Collection|undefined>(store.get(collectionId));
    if(!collection)throw new Error('Collection not found.');
    const scenes=await request<SavedScene[]>(tx.objectStore('scenes').getAll());
    const result=change(collection,scenes);
    if(result!==collection){const error=validateProject(result,scenes);if(error)throw new Error(error);store.put(result);}
    await completion;return result;
  }catch(error){try{tx.abort();}catch{}await completion.catch(()=>undefined);throw libraryCaughtError(tx,error);}
}
function changed(collection:Collection,shots:ProjectShot[]):Collection{
  const project=collection.project!;
  const updatedAt=new Date().toISOString();
  return {...collection,project:{...project,revision:project.revision+1,shots},members:projectMembersFromShots({...collection,updatedAt},shots),updatedAt};
}
function findShot(collection:Collection,shotId:string):ProjectShot{requireId(shotId,'shot ID');const shot=collection.project!.shots.find(s=>s.id===shotId);if(!shot)throw new Error('Project shot not found.');return shot;}
export function initializeProject(collectionId:string):Promise<Collection>{return mutate(collectionId,(raw,scenes)=>raw.project?raw:established(raw,scenes));}
export function addProjectShot({collectionId,title,sceneId,beforeId,afterId}:{collectionId:string;title?:string;sceneId?:string;beforeId?:string;afterId?:string}):Promise<Collection>{
  return mutate(collectionId,(raw,scenes)=>{
    const c=established(raw,scenes);if(beforeId&&afterId)throw new Error('Choose before or after, not both.');
    if(sceneId&&!scenes.some(s=>s.id===sceneId))throw new Error('Saved scene not found.');
    const shots=[...c.project!.shots].sort((a,b)=>a.order-b.order);let index=shots.length;
    if(beforeId){index=shots.findIndex(s=>s.id===beforeId);if(index<0)throw new Error('Before shot not found.');}
    if(afterId){index=shots.findIndex(s=>s.id===afterId);if(index<0)throw new Error('After shot not found.');index++;}
    const shot:ProjectShot={id:generateId('shot'),order:index,code:String(shots.length+1).padStart(2,'0'),title:title?.trim()??'',takeSceneIds:sceneId?[sceneId]:[],selectedSceneId:sceneId,status:sceneId?'prompt_ready':'planned'};
    validateShotChange(shot);shots.splice(index,0,shot);return changed(c,renumber(shots));
  });
}
type ShotPatch={code?:string;title?:string;status?:ProductionStatus;plannedDurationSeconds?:number|null;continuityNotes?:string};
export function updateProjectShot({collectionId,shotId,patch}:{collectionId:string;shotId:string;patch:ShotPatch}):Promise<Collection>{return mutate(collectionId,(raw,scenes)=>{
  const c=established(raw,scenes);const old=findShot(c,shotId);if(Object.keys(patch).some(k=>!['code','title','status','plannedDurationSeconds','continuityNotes'].includes(k)))throw new Error('Unsupported shot patch field.');
  const next:ProjectShot={...old,...patch,plannedDurationSeconds:patch.plannedDurationSeconds===null?undefined:patch.plannedDurationSeconds??old.plannedDurationSeconds};validateShotChange(next);
  if(JSON.stringify(next)===JSON.stringify(old))return raw;
  return changed(c,c.project!.shots.map(s=>s.id===shotId?next:s));
});}
export function reorderProjectShots({collectionId,orderedShotIds,expectedRevision}:{collectionId:string;orderedShotIds:string[];expectedRevision?:number}):Promise<Collection>{return mutate(collectionId,(raw,scenes)=>{
  const c=established(raw,scenes);if(expectedRevision!==undefined&&expectedRevision!==c.project!.revision)throw new Error('Project revision conflict: refresh before saving shot order.');
  const shots=getProjectShots(c,scenes);if(orderedShotIds.length!==shots.length||new Set(orderedShotIds).size!==shots.length||orderedShotIds.some(id=>!shots.some(s=>s.id===id)))throw new Error('Ordered shot IDs must match current project shots.');
  if(orderedShotIds.every((id,i)=>shots[i].id===id))return raw;
  return changed(c,renumber(orderedShotIds.map(id=>shots.find(s=>s.id===id)!)));
});}
export function removeProjectShot({collectionId,shotId}:{collectionId:string;shotId:string}):Promise<Collection>{return mutate(collectionId,(raw,scenes)=>{
  const c=established(raw,scenes);findShot(c,shotId);const shots=renumber(getProjectShots(c,scenes).filter(s=>s.id!==shotId));
  const transitions=c.project!.transitions?.filter(t=>t.fromShotId!==shotId&&t.toShotId!==shotId);
  const result=changed(c,shots);if(transitions)result.project!.transitions=transitions;return result;
});}
export function addProjectTake({collectionId,shotId,sceneId}:{collectionId:string;shotId:string;sceneId:string}):Promise<Collection>{return mutate(collectionId,(raw,scenes)=>{
  const c=established(raw,scenes);const shot=findShot(c,shotId);if(!scenes.some(s=>s.id===sceneId))throw new Error('Saved scene not found.');if(shot.takeSceneIds.includes(sceneId))return raw;
  const next={...shot,takeSceneIds:[...shot.takeSceneIds,sceneId],selectedSceneId:shot.selectedSceneId??sceneId};return changed(c,c.project!.shots.map(s=>s.id===shotId?next:s));
});}
export function removeProjectTake({collectionId,shotId,sceneId}:{collectionId:string;shotId:string;sceneId:string}):Promise<Collection>{return mutate(collectionId,(raw,scenes)=>{
  const c=established(raw,scenes);const shot=findShot(c,shotId);if(!shot.takeSceneIds.includes(sceneId))return raw;
  const takeSceneIds=shot.takeSceneIds.filter(id=>id!==sceneId);const selectedSceneId=shot.selectedSceneId===sceneId?takeSceneIds.find(id=>scenes.some(scene=>scene.id===id)):shot.selectedSceneId;
  const takeNotes=shot.takeNotes?Object.fromEntries(Object.entries(shot.takeNotes).filter(([id])=>id!==sceneId)):undefined;
  return changed(c,c.project!.shots.map(s=>s.id===shotId?{...shot,takeSceneIds,selectedSceneId,takeNotes,status:takeSceneIds.length===0?'planned':shot.status}:s));
});}
export function selectProjectTake({collectionId,shotId,sceneId}:{collectionId:string;shotId:string;sceneId:string}):Promise<Collection>{return mutate(collectionId,(raw,scenes)=>{
  const c=established(raw,scenes);const shot=findShot(c,shotId);if(!shot.takeSceneIds.includes(sceneId)||!scenes.some(s=>s.id===sceneId))throw new Error('Selected take must be an existing shot take.');if(shot.selectedSceneId===sceneId)return raw;
  return changed(c,c.project!.shots.map(s=>s.id===shotId?{...shot,selectedSceneId:sceneId}:s));
});}
export function updateProjectTakeNote({collectionId,shotId,sceneId,note}:{collectionId:string;shotId:string;sceneId:string;note:string}):Promise<Collection>{return mutate(collectionId,(raw,scenes)=>{
  const c=established(raw,scenes);const shot=findShot(c,shotId);if(!shot.takeSceneIds.includes(sceneId)||!scenes.some(s=>s.id===sceneId))throw new Error('Project take not found.');if(typeof note!=='string'||note.length>10000)throw new Error('Invalid take note.');if((shot.takeNotes?.[sceneId]??'')===note)return raw;
  return changed(c,c.project!.shots.map(s=>s.id===shotId?{...shot,takeNotes:{...shot.takeNotes,[sceneId]:note}}:s));
});}
