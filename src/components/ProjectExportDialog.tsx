import React, { useMemo, useRef, useState } from 'react';
import type { Collection } from '../types/domain';
import { useLibrary } from '../context/LibraryContext';
import { buildProjectExport, planProjectExport, PROJECT_EXPORT_ENTRY_LIMIT, PROJECT_EXPORT_MEDIA_LIMIT, PROJECT_EXPORT_TEXT_LIMIT } from '../domain/projectExport';
import { getProjectShots } from '../domain/projectStoryboard';
import { downloadBlobAsFile } from '../hooks/useObjectUrl';
import { StudioDialog } from './StudioDialog';
import './projectExport.css';

type Props={collection:Collection;onClose:()=>void};
const slotLabels:Record<string,string>={cover:'Project cover',cast:'Character Bible reference',firstFrameMediaId:'First frame',lastFrameMediaId:'Last frame',character:'Character identity',wardrobe:'Outfit',environment:'Environment',action:'Action',camera:'Camera',lighting:'Lighting',style:'Style',result:'External result',legacy:'Saved reference'};
export const ProjectExportDialog:React.FC<Props>=({collection,onClose})=>{
 const {snapshot}=useLibrary();const [excluded,setExcluded]=useState<string[]>([]);const [generation,setGeneration]=useState(false);const [busy,setBusy]=useState(false);const busyRef=useRef(false);const controller=useRef<AbortController|null>(null);const [stage,setStage]=useState('');const [error,setError]=useState('');
 const planning=useMemo(()=>{if(!snapshot)return {plan:null,error:''};try{return {plan:planProjectExport(collection,snapshot,{excludedAssociationIds:excluded,includeGenerationJson:generation}),error:''};}catch(e){return {plan:null,error:e instanceof Error?e.message:String(e)};}},[collection,snapshot,excluded,generation]);
 const plan=planning.plan;
 const shots=useMemo(()=>new Map(getProjectShots(collection,snapshot?.scenes??[]).map(shot=>[shot.id,shot])),[collection,snapshot]);
 const associationLabel=(a:NonNullable<typeof plan>['associations'][number])=>{const shot=a.shotId?shots.get(a.shotId):undefined;const context=[slotLabels[a.sourceSlot??'']??'Media reference',shot?`Shot ${shot.code} · ${shot.title}`:undefined].filter(Boolean).join(' · ');return `${a.displayName} — ${context}${a.requestedFilename!==a.displayName?` · ${a.requestedFilename}`:''}${a.altText?` · ${a.altText}`:''}${a.missing?' — Missing original':''}${a.excluded?' — Excluded':''}`;};
 const limitError=plan?.estimatedMediaBytes&&plan.estimatedMediaBytes>PROJECT_EXPORT_MEDIA_LIMIT?'Project export exceeds 128 MiB selected media. Exclude associations to reduce it.':plan?.estimatedEntries&&plan.estimatedEntries>PROJECT_EXPORT_ENTRY_LIMIT?'Project export exceeds 2000 ZIP entries. Exclude associations to reduce it.':plan?.estimatedTextUpperBound&&plan.estimatedTextUpperBound>PROJECT_EXPORT_TEXT_LIMIT?'Project export exceeds the 16 MiB generated text limit.':planning.error;
 const close=()=>{if(busyRef.current)return;onClose();};
 const toggle=(id:string)=>setExcluded(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
 const run=async()=>{if(!snapshot||busyRef.current)return;busyRef.current=true;setBusy(true);setError('');const abort=new AbortController();controller.current=abort;const capturedSnapshot=snapshot;try{const result=await buildProjectExport(collection,capturedSnapshot,{excludedAssociationIds:excluded,includeGenerationJson:generation,signal:abort.signal,onProgress:setStage});if(abort.signal.aborted)return;downloadBlobAsFile(new Blob([result.bytes as BlobPart],{type:'application/zip'}),result.filename);setStage('Project ZIP downloaded.');}catch(e){setError(e instanceof Error?e.message:String(e));}finally{controller.current=null;busyRef.current=false;setBusy(false);}};
 return <StudioDialog title="Export project ZIP" onClose={close} className="project-export-dialog" footer={<div className="button-row"><button type="button" className="btn btn-secondary" onClick={busy?()=>{setStage('Cancelling…');controller.current?.abort();}:close}>{busy?'Cancel export':'Close'}</button><button type="button" className="btn btn-primary" disabled={busy||!plan||!!limitError} onClick={()=>void run()}>Export project ZIP</button></div>}>
  <p>This project ZIP contains selected project content. It is not a full library backup.</p>
  <p>Limits: {PROJECT_EXPORT_MEDIA_LIMIT/(1024*1024)} MiB selected media, {PROJECT_EXPORT_TEXT_LIMIT/(1024*1024)} MiB generated text, {PROJECT_EXPORT_ENTRY_LIMIT} ZIP entries. Exclude associations to fit or resolve missing originals.</p>
  {plan&&<p>Estimated media: {(plan.estimatedMediaBytes/(1024*1024)).toFixed(1)} MiB; text upper bound: {(plan.estimatedTextUpperBound/(1024*1024)).toFixed(1)} MiB; entries: {plan.estimatedEntries}.</p>}
  <label><input type="checkbox" checked={generation} disabled={busy} onChange={e=>setGeneration(e.target.checked)}/> Include Generation JSON for selected takes</label>
  {!!plan?.warnings.length&&<section aria-label="Project warnings"><h3>Planning warnings</h3><ul>{plan.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul></section>}
  <section aria-label="Media associations"><h3>Media associations</h3>{!plan?.associations.length?<p>No selected media associations.</p>:<div className="project-export-associations">{plan.associations.map(a=><label key={a.id} className={a.missing?'project-export-missing':''}><input type="checkbox" checked={!excluded.includes(a.id)} disabled={busy} onChange={()=>toggle(a.id)}/><span>{associationLabel(a)}</span></label>)}</div>}</section>
  {excluded.length>0&&<p>Excluded associations: {excluded.length}. Each exclusion is recorded in manifest.json.</p>}
  <p role="status" aria-live="polite">{stage}</p>{(error||limitError)&&<p role="alert" className="project-export-error">{error||limitError}</p>}
 </StudioDialog>;
};
