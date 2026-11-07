import React,{useRef,useState} from 'react';
import {useLibrary} from '../context/LibraryContext';
import {downloadBlobAsFile} from '../hooks/useObjectUrl';
import {bulkAddScenesToCollection,bulkAssignSceneStatus,bulkDeleteSavedScenes,bulkSetScenesArchived,formatSelectedPrompts} from '../storage/projectBulk';
import type {ProductionStatus,SavedScene} from '../types/domain';
import {StudioDialog} from './StudioDialog';
import './projectBulkActions.css';

const statuses:ProductionStatus[]=['planned','prompt_ready','generated','reviewed','final'];
type Props={selectedSceneIds:string[];onClear:()=>void;onChanged:()=>Promise<unknown>};
export const SceneBulkActions:React.FC<Props>=({selectedSceneIds,onClear,onChanged})=>{
 const {snapshot,copyText,showToast}=useLibrary();const [target,setTarget]=useState(''),[status,setStatus]=useState<ProductionStatus>('planned');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmDelete,setConfirmDelete]=useState(false);const busyRef=useRef(false);const collections=snapshot?.collections??[];
 const scenes=():SavedScene[]=>{const map=new Map((snapshot?.scenes??[]).map(s=>[s.id,s]));if(selectedSceneIds.some(id=>!map.has(id)))throw new Error('Selected saved scene is no longer available. Refresh the library.');return [...new Set(selectedSceneIds)].map(id=>map.get(id)!);};
 const run=async(action:()=>Promise<unknown>,message:string,refresh=true)=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');try{await action();if(refresh)await onChanged();onClear();setConfirmDelete(false);showToast(message,'success');}catch(cause){setError(cause instanceof Error?cause.message:'Bulk action failed.');}finally{busyRef.current=false;setBusy(false);}};
 const prompts=()=>formatSelectedPrompts(scenes());
 if(!selectedSceneIds.length)return null;
 const selectedRecords=(snapshot?.scenes??[]).filter(s=>selectedSceneIds.includes(s.id));
 const hasActive=selectedRecords.some(s=>!s.archivedAt);
 const hasArchived=selectedRecords.some(s=>Boolean(s.archivedAt));
 return <section className="project-bulk-actions" aria-label="Selected saved scene actions">
  <div className="project-bulk-heading"><strong>{selectedSceneIds.length} scene{selectedSceneIds.length===1?'':'s'} selected</strong><button type="button" className="btn btn-secondary btn-sm" onClick={onClear} disabled={busy}>Clear Selection</button></div>
  <div className="project-bulk-row"><label>Target project <select aria-label="Target project" value={target} disabled={busy} onChange={event=>setTarget(event.target.value)}><option value="">Choose project</option>{collections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <button type="button" className="btn btn-secondary btn-sm" disabled={busy||!target||!selectedSceneIds.length} onClick={()=>void run(()=>bulkAddScenesToCollection({collectionId:target,sceneIds:scenes().map(s=>s.id)}),'Scenes added to project.')}>Add to Collection</button>
   <label>Status <select aria-label="Scene project status" value={status} disabled={busy} onChange={event=>setStatus(event.target.value as ProductionStatus)}>{statuses.map(value=><option key={value} value={value}>{value.replace('_',' ')}</option>)}</select></label>
   <button type="button" className="btn btn-secondary btn-sm" disabled={busy||!target||!selectedSceneIds.length} onClick={()=>void run(()=>bulkAssignSceneStatus({collectionId:target,sceneIds:scenes().map(s=>s.id),status}),'Project shot statuses updated.')}>Assign Status</button>
  </div>
  <p className="muted-text">Status applies only to matching shots in the chosen project. Add unlinked scenes to that project first.</p>
  <div className="project-bulk-row"><button type="button" className="btn btn-secondary btn-sm" disabled={busy||!selectedSceneIds.length} onClick={()=>void run(async()=>downloadBlobAsFile(new Blob([prompts()],{type:'text/plain;charset=utf-8'}),'selected-scene-prompts.txt'),'Selected prompts downloaded.',false)}>Export Prompts .txt</button>
   <button type="button" className="btn btn-secondary btn-sm" disabled={busy||!selectedSceneIds.length} onClick={()=>void run(async()=>{if(!await copyText(prompts(),'Selected prompts copied.'))throw new Error('Could not copy selected prompts.');},'Selected prompts copied.',false)}>Copy Prompts</button>
   {hasActive&&<button type="button" className="btn btn-secondary btn-sm" disabled={busy||!selectedSceneIds.length} onClick={()=>void run(()=>bulkSetScenesArchived({sceneIds:scenes().map(s=>s.id),archived:true}),'Selected scenes archived.')}>Archive Selected</button>}
   {hasArchived&&<button type="button" className="btn btn-secondary btn-sm" disabled={busy||!selectedSceneIds.length} onClick={()=>void run(()=>bulkSetScenesArchived({sceneIds:scenes().map(s=>s.id),archived:false}),'Selected scenes unarchived.')}>Unarchive Selected</button>}
   <button type="button" className="btn btn-danger btn-sm" disabled={busy||!selectedSceneIds.length} onClick={()=>setConfirmDelete(true)}>Delete Selected</button>
  </div>
  {error&&<p role="alert" className="project-bulk-error">{error}</p>}
  {confirmDelete&&<StudioDialog title="Delete Selected Scenes?" onClose={()=>{if(!busy)setConfirmDelete(false);}} footer={<><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>setConfirmDelete(false)}>Cancel</button><button type="button" className="btn btn-danger" disabled={busy} onClick={()=>void run(()=>bulkDeleteSavedScenes({sceneIds:scenes().map(s=>s.id)}),'Selected scenes deleted.')}>Confirm Delete Selected Scenes</button></>}><p>Permanently delete {selectedSceneIds.length} saved scene{selectedSceneIds.length===1?'':'s'}? Linked shot takes will be removed from existing projects. Source library assets and media remain intact.</p></StudioDialog>}
 </section>;
};
