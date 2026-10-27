import React,{useRef,useState} from 'react';
import {useLibrary} from '../context/LibraryContext';
import {getProjectShots} from '../domain/projectStoryboard';
import {downloadBlobAsFile} from '../hooks/useObjectUrl';
import {bulkAddScenesToCollection,bulkUpdateProjectShots,formatSelectedPrompts} from '../storage/projectBulk';
import type {Collection,ProductionStatus,SavedScene} from '../types/domain';
import {StudioDialog} from './StudioDialog';
import './projectBulkActions.css';

const statuses:ProductionStatus[]=['planned','prompt_ready','generated','reviewed','final'];
type Props={collection:Collection;selectedShotIds:string[];onClear:()=>void;onChanged:()=>Promise<unknown>};
export const ProjectBulkActions:React.FC<Props>=({collection,selectedShotIds,onClear,onChanged})=>{
 const {snapshot,copyText,showToast}=useLibrary();const [status,setStatus]=useState<ProductionStatus>('planned');const [destination,setDestination]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);const busyRef=useRef(false);
 const shots=getProjectShots(collection,snapshot?.scenes??[]);const selected=new Set(selectedShotIds);const chosen=shots.filter(s=>selected.has(s.id));
 const missing=chosen.filter(s=>!s.selectedSceneId||!snapshot?.scenes.some(scene=>scene.id===s.selectedSceneId)).length;
 const destinations=(snapshot?.collections??[]).filter(c=>c.id!==collection.id);
 const preferred=():SavedScene[]=>{if(chosen.length!==selected.size)throw new Error('Selection changed. Refresh the project.');if(missing)throw new Error(`${missing} selected shot${missing===1?' has':'s have'} no available preferred scene. Select a preferred take or deselect the shot.`);return chosen.map(shot=>snapshot!.scenes.find(scene=>scene.id===shot.selectedSceneId)!);};
 const run=async(action:()=>Promise<unknown>,message:string,refresh=true)=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');try{await action();if(refresh)await onChanged();onClear();setConfirm(false);showToast(message,'success');}catch(cause){setError(cause instanceof Error?cause.message:'Bulk action failed.');}finally{busyRef.current=false;setBusy(false);}};
 const prompts=()=>formatSelectedPrompts(preferred());
 if(!selectedShotIds.length)return null;
 return <section className="project-bulk-actions" aria-label="Selected project shot actions">
  <div className="project-bulk-heading"><strong>{selectedShotIds.length} shot{selectedShotIds.length===1?'':'s'} selected</strong><button type="button" className="btn btn-secondary btn-sm" onClick={onClear} disabled={busy}>Clear Selection</button></div>
  {missing>0&&<p className="muted-text">{missing} selected shot{missing===1?' has':'s have'} no available preferred scene. Add to another project and prompt export require a preferred scene for every selected shot.</p>}
  <div className="project-bulk-row"><label>Status <select aria-label="Bulk shot status" value={status} disabled={busy} onChange={event=>setStatus(event.target.value as ProductionStatus)}>{statuses.map(value=><option key={value} value={value}>{value.replace('_',' ')}</option>)}</select></label>
   <button type="button" className="btn btn-secondary btn-sm" disabled={busy||!selectedShotIds.length} onClick={()=>void run(()=>bulkUpdateProjectShots({collectionId:collection.id,shotIds:selectedShotIds,status}),'Shot statuses updated.')}>Apply Status</button>
   <button type="button" className="btn btn-secondary btn-sm" disabled={busy||!selectedShotIds.length} onClick={()=>void run(()=>bulkUpdateProjectShots({collectionId:collection.id,shotIds:selectedShotIds,move:'up',expectedRevision:collection.project?.revision??0}),'Shots moved up.')}>Move Selected Up</button>
   <button type="button" className="btn btn-secondary btn-sm" disabled={busy||!selectedShotIds.length} onClick={()=>void run(()=>bulkUpdateProjectShots({collectionId:collection.id,shotIds:selectedShotIds,move:'down',expectedRevision:collection.project?.revision??0}),'Shots moved down.')}>Move Selected Down</button>
  </div>
  <div className="project-bulk-row"><label>Destination project <select aria-label="Destination project" value={destination} disabled={busy} onChange={event=>setDestination(event.target.value)}><option value="">Choose project</option>{destinations.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <button type="button" className="btn btn-secondary btn-sm" disabled={busy||!destination||!selectedShotIds.length} onClick={()=>void run(()=>bulkAddScenesToCollection({collectionId:destination,sceneIds:preferred().map(s=>s.id)}),'Preferred scenes added to project.')}>Add Preferred Scenes</button>
   <button type="button" className="btn btn-secondary btn-sm" disabled={busy||!selectedShotIds.length} onClick={()=>void run(async()=>{downloadBlobAsFile(new Blob([prompts()],{type:'text/plain;charset=utf-8'}),`${collection.name.replace(/[^\p{L}\p{N}._ -]+/gu,'_').trim()||'project'}-selected-prompts.txt`);},'Selected prompts downloaded.',false)}>Export Prompts .txt</button>
   <button type="button" className="btn btn-secondary btn-sm" disabled={busy||!selectedShotIds.length} onClick={()=>void run(async()=>{if(!await copyText(prompts(),'Selected prompts copied.'))throw new Error('Could not copy selected prompts.');},'Selected prompts copied.',false)}>Copy Prompts</button>
  </div>
  <button type="button" className="btn btn-secondary btn-sm" disabled={busy||!selectedShotIds.length} onClick={()=>setConfirm(true)}>Remove Selected Shots</button>
  {error&&<p role="alert" className="project-bulk-error">{error}</p>}
  {confirm&&<StudioDialog title="Remove Selected Shots?" onClose={()=>{if(!busy)setConfirm(false);}} footer={<><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>setConfirm(false)}>Cancel</button><button type="button" className="btn btn-danger" disabled={busy} onClick={()=>void run(()=>bulkUpdateProjectShots({collectionId:collection.id,shotIds:selectedShotIds,remove:true}),'Selected shots removed.')}>Confirm Remove Selected Shots</button></>}><p>Remove {selectedShotIds.length} shot association{selectedShotIds.length===1?'':'s'} from this project? Saved scenes remain in the library. This does not delete source scenes or media.</p></StudioDialog>}
 </section>;
};
