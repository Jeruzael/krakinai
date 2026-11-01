import React,{useRef,useState}from'react';
import type{SavedScene,PromptCategory}from'../types/domain';
import{useLibrary}from'../context/LibraryContext';
import{getSceneSnapshotEntries}from'../domain/ensembleReferences';
import{SLOT_TO_CATEGORY,SLOT_LABELS}from'../domain/validation';
import{ORDERED_BUILDER_SLOTS}from'../domain/promptAssembler';
import{StudioDialog}from'./StudioDialog';
export function RecipeRevisionChoices({scene,onRevise}:{scene:SavedScene;onRevise():void}){
 const{snapshot,navigate}=useLibrary(),[open,setOpen]=useState(false),[selected,setSelected]=useState('new'),[category,setCategory]=useState<PromptCategory>('environments');
 const trigger=useRef<HTMLButtonElement>(null);
 const records=getSceneSnapshotEntries(scene).filter((e,i,all)=>all.findIndex(other=>other.snapshot.sourceId===e.snapshot.sourceId&&other.snapshot.sourceType===e.snapshot.sourceType)===i);
 const available=(kind:string,id:string)=>kind==='asset'?snapshot?.assets.some(a=>a.id===id):kind==='variant'?snapshot?.variants.some(v=>v.id===id):snapshot?.templates.some(t=>t.id===id);
 const launch=()=>{
  if(selected==='new'){navigate('/prompts/new?category='+category);return}
  const entry=records.find(e=>JSON.stringify([e.snapshot.sourceType,e.snapshot.sourceId])===selected);if(!entry||!available(entry.snapshot.sourceType,entry.snapshot.sourceId))return;
  navigate(entry.snapshot.sourceType==='asset'?`/prompts/${encodeURIComponent(entry.snapshot.sourceId)}/edit`:entry.snapshot.sourceType==='variant'?`/variants/${encodeURIComponent(entry.snapshot.sourceId)}/edit`:'/templates');
 };
 return <><details className="recipe-revision-choices"><summary className="btn btn-secondary btn-sm">Scene or reusable asset</summary><p>Scene revisions preserve other frozen components. Library edits affect future selections and require explicit adoption.</p><div className="studio-inline"><button type="button" className="btn btn-secondary btn-sm" onClick={onRevise}>Revise This Scene</button><button ref={trigger} type="button" className="btn btn-secondary btn-sm" onClick={()=>setOpen(true)}>Create or Revise Reusable Asset</button></div></details>
 {open&&<StudioDialog title="Create or Revise Reusable Asset" returnFocusRef={trigger} onClose={()=>setOpen(false)} footer={<><button className="btn btn-secondary" onClick={()=>setOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={launch}>Open library editor</button></>}><p>Saved scene snapshots stay unchanged. A library edit changes the reusable record for future selections; return to Scene Builder and explicitly adopt its updated revision to make a new scene version.</p><label>Reusable component to edit<select className="select" value={selected} onChange={e=>setSelected(e.target.value)}><option value="new">Create a new reusable asset…</option>{records.map(({snapshot:s})=><option key={JSON.stringify([s.sourceType,s.sourceId])} value={JSON.stringify([s.sourceType,s.sourceId])} disabled={!available(s.sourceType,s.sourceId)}>{s.sourceTitle} · saved rev {s.sourceRevision}{available(s.sourceType,s.sourceId)?'':' — unavailable'}</option>)}</select></label>{selected==='new'&&<label>New asset category<select className="select" value={category} onChange={e=>setCategory(e.target.value as PromptCategory)}>{ORDERED_BUILDER_SLOTS.map(slot=><option key={slot} value={SLOT_TO_CATEGORY[slot]}>{SLOT_LABELS[slot]}</option>)}</select></label>}</StudioDialog>}
 </>;
}
