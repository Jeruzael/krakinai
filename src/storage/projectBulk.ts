import type {Collection,ProductionStatus,ProjectShot,SavedScene} from '../types/domain';
import {getProjectShots,projectMembersFromShots} from '../domain/projectStoryboard';
import {validateProject,validateShotChange} from '../domain/phase5ProjectValidation';
import {generateId,openDatabase} from './db';

const statuses=new Set<ProductionStatus>(['planned','prompt_ready','generated','reviewed','final']);
const limit=16*1024*1024;
function selected(ids:string[],label:string):string[]{
 if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string'||!id.trim()))throw new Error(`Select at least one valid ${label}.`);
 return [...new Set(ids)];
}
function request<T>(req:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function done(tx:IDBTransaction):Promise<void>{return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??new Error('Bulk transaction aborted.'));tx.onerror=()=>reject(tx.error??new Error('Bulk transaction failed.'));});}
function materialize(c:Collection,scenes:SavedScene[]):Collection{return c.project?c:{...c,project:{version:1,revision:0,shots:getProjectShots(c,scenes)}};}
function changed(c:Collection,shots:ProjectShot[],transitions=c.project!.transitions):Collection{
 const updatedAt=new Date().toISOString();const project={...c.project!,revision:c.project!.revision+1,shots,transitions};
 return {...c,project,members:projectMembersFromShots({...c,updatedAt},shots),updatedAt};
}
async function mutate(collectionId:string,change:(c:Collection,scenes:SavedScene[])=>Collection):Promise<Collection>{
 if(typeof collectionId!=='string'||!collectionId.trim())throw new Error('Invalid collection ID.');
 const db=await openDatabase();const tx=db.transaction(['collections','scenes'],'readwrite');const completion=done(tx);
 try{
  const store=tx.objectStore('collections');const raw=await request<Collection|undefined>(store.get(collectionId));if(!raw)throw new Error('Collection not found.');
  const scenes=await request<SavedScene[]>(tx.objectStore('scenes').getAll());const result=change(raw,scenes);
  if(result!==raw){const error=validateProject(result,scenes);if(error)throw new Error(error);store.put(result);}
  await completion;return result;
 }catch(error){try{tx.abort();}catch{}await completion.catch(()=>undefined);throw error;}
}
function reordered(shots:ProjectShot[],chosen:Set<string>,direction:'up'|'down'):ProjectShot[]{
 const next=[...shots];
 if(direction==='up')for(let i=1;i<next.length;i++)if(chosen.has(next[i].id)&&!chosen.has(next[i-1].id))[next[i-1],next[i]]=[next[i],next[i-1]];
 if(direction==='down')for(let i=next.length-2;i>=0;i--)if(chosen.has(next[i].id)&&!chosen.has(next[i+1].id))[next[i],next[i+1]]=[next[i+1],next[i]];
 return next.map((shot,order)=>({...shot,order}));
}
export function bulkUpdateProjectShots({collectionId,shotIds,status,move,remove,expectedRevision}:{collectionId:string;shotIds:string[];status?:ProductionStatus;move?:'up'|'down';remove?:boolean;expectedRevision?:number}):Promise<Collection>{
 return mutate(collectionId,(raw,scenes)=>{
  const ids=selected(shotIds,'shot');const c=materialize(raw,scenes);const shots=getProjectShots(c,scenes);
  if(ids.some(id=>!shots.some(s=>s.id===id)))throw new Error('One or more selected project shots no longer exist. Refresh the project.');
  if([status!==undefined,move!==undefined,remove===true].filter(Boolean).length!==1)throw new Error('Choose exactly one bulk shot action.');
  if(status!==undefined&&!statuses.has(status))throw new Error('Invalid production status.');
  if(move!==undefined&&move!=='up'&&move!=='down')throw new Error('Invalid move direction.');
  if(move&&expectedRevision!==undefined&&expectedRevision!==c.project!.revision)throw new Error('Project revision conflict: refresh before moving shots.');
  const chosen=new Set(ids);let next:ProjectShot[];let transitions=c.project!.transitions;
  if(remove){next=shots.filter(s=>!chosen.has(s.id)).map((s,order)=>({...s,order}));transitions=transitions?.filter(t=>!chosen.has(t.fromShotId)&&!chosen.has(t.toShotId));}
  else if(move)next=reordered(shots,chosen,move);
  else next=shots.map(s=>chosen.has(s.id)?{...s,status:status!}:s);
  if(next.length===shots.length&&next.every((s,i)=>s.id===shots[i].id&&s.status===shots[i].status))return raw;
  return changed(c,next,transitions);
 });
}
export function bulkAddScenesToCollection({collectionId,sceneIds}:{collectionId:string;sceneIds:string[]}):Promise<Collection>{
 return mutate(collectionId,(raw,scenes)=>{
  const ids=selected(sceneIds,'scene');const sceneMap=new Map(scenes.map(s=>[s.id,s]));
  if(ids.some(id=>!sceneMap.has(id)))throw new Error('One or more selected saved scenes no longer exist. Refresh the library.');
  const c=materialize(raw,scenes);const shots=getProjectShots(c,scenes);const linked=new Set(shots.flatMap(s=>s.takeSceneIds));
  for(const id of ids){if(linked.has(id))continue;const shot:ProjectShot={id:generateId('shot'),order:shots.length,code:String(shots.length+1).padStart(2,'0'),title:sceneMap.get(id)!.title,takeSceneIds:[id],selectedSceneId:id,status:'prompt_ready'};validateShotChange(shot);shots.push(shot);linked.add(id);}
  return shots.length===c.project!.shots.length?raw:changed(c,shots);
 });
}
export function bulkAssignSceneStatus({collectionId,sceneIds,status}:{collectionId:string;sceneIds:string[];status:ProductionStatus}):Promise<Collection>{
 return mutate(collectionId,(raw,scenes)=>{
  const ids=selected(sceneIds,'scene');if(!statuses.has(status))throw new Error('Invalid production status.');
  const sceneSet=new Set(scenes.map(s=>s.id));if(ids.some(id=>!sceneSet.has(id)))throw new Error('One or more selected saved scenes no longer exist. Refresh the library.');
  const c=materialize(raw,scenes);const chosen=new Set(ids);const shots=getProjectShots(c,scenes);const matching=shots.filter(s=>s.takeSceneIds.some(id=>chosen.has(id)));
  if(ids.some(id=>!matching.some(s=>s.takeSceneIds.includes(id))))throw new Error('Selected scene is not a shot in this project. Add it to the project first.');
  if(matching.every(s=>s.status===status))return raw;
  return changed(c,shots.map(s=>matching.includes(s)?{...s,status}:s));
 });
}
export function formatSelectedPrompts(scenes:SavedScene[]):string{
 if(!scenes.length)throw new Error('Select at least one saved scene.');
 const encoder=new TextEncoder();let bytes=0;const parts:string[]=[];
 for(const scene of scenes){if(!scene||typeof scene.outputs?.full!=='string')throw new Error('Selected scene has no full prompt output.');
  const header=`${scene.title}\n`;const output=scene.outputs.full;
  if(bytes+header.length+output.length+2>limit)throw new Error('Selected prompt export is too large (16 MiB maximum).');
  bytes+=encoder.encode(header).byteLength+encoder.encode(output).byteLength+2;
  if(bytes>limit)throw new Error('Selected prompt export is too large (16 MiB maximum).');parts.push(header+output);
 }
 return parts.join('\n\n');
}
