import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Collection, MediaAsset, ProjectShot, ProjectTransition } from '../types/domain';
import { useLibrary } from '../context/LibraryContext';
import { buildContinuityWorkspace, CONTINUITY_LABELS, CONTINUITY_VIEWS, type ContinuityView, type FrameSide } from '../domain/continuityWorkspace';
import { validateMediaCandidate } from '../domain/validation';
import { removeProjectTransition, updateProjectFrames, updateWardrobeIntent, uploadProjectFrame, upsertProjectTransition } from '../storage/projectContinuity';
import { MediaPreviewDialog } from './MediaPreviewDialog';
import { MediaThumbnail } from './MediaThumbnail';
import { StudioDialog } from './StudioDialog';
import { appearanceLabel, ContinuityViews, type ContinuityPair } from './ContinuityViews';
import { ContinuityEditor, WARDROBE_REASONS, type ContinuityEditorState } from './ContinuityEditor';
import './projectContinuity.css';
import {createSceneRevisionDraft} from '../storage/sceneAuthoring';
import {collectionBuilderRoute,collectionViewState} from '../domain/collectionNavigation';

interface Props {
 collection:Collection;onChanged:()=>Promise<unknown>;view?:ContinuityView;shotId?:string;
 onNavigate?:(state:{continuity:ContinuityView;shot?:string})=>void;
 onOpenTake?:(shot:ProjectShot)=>void;onManageTakes?:(shot:ProjectShot)=>void;
}
const title=(shot:ProjectShot)=>`${shot.code} ${shot.title}`;
// In-memory recovery only: browser Back must not discard an unsaved review.
// No Blob, approval, database record or prompt output is persisted here.
type HeldReview={editor:ContinuityEditorState;baseline:string;owner:{id:string;revision:number}};
const heldReviews=new Map<string,HeldReview>();
export const ProjectContinuityPanel:React.FC<Props>=({collection,onChanged,view,shotId,onNavigate,onOpenTake,onManageTakes})=>{
 const {snapshot,setDirtyFormGuard,hashPath,navigate:routeNavigate}=useLibrary();
 const recovered=useRef(heldReviews.get(collection.id));
 const model=useMemo(()=>buildContinuityWorkspace(collection,snapshot?.scenes??[],snapshot?.media??[]),[collection,snapshot]);
 const [localView,setLocalView]=useState<ContinuityView>('overview'),[localShot,setLocalShot]=useState<string>();
 const activeView=view??localView,activeShotId=shotId??localShot??model.rows[0]?.shot.id;
 const selected=model.rows.find(r=>r.shot.id===activeShotId);
 const [query,setQuery]=useState(''),[attention,setAttention]=useState(false),[appearanceKey,setAppearanceKey]=useState<string>();
 const [pairTarget,setPairTarget]=useState<{fromId:string;toId:string}>();
 const [editor,setEditor]=useState<ContinuityEditorState|null>(recovered.current?.editor??null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [preview,setPreview]=useState<{media:MediaAsset;title:string;key:string}|null>(null);
 const [discard,setDiscard]=useState<null|(()=>void)>(null);
 const [mobile,setMobile]=useState(()=>window.innerWidth<=1000);
 const busyRef=useRef(false),baseline=useRef(recovered.current?.baseline??''),owner=useRef(recovered.current?.owner??{id:collection.id,revision:collection.project?.revision??0}),discarded=useRef(false);
 const trigger=useRef<HTMLElement|null>(null),previewTriggers=useRef(new Map<string,HTMLButtonElement>()),root=useRef<HTMLDivElement>(null);
 const uid=useId();
 const dirty=!!editor&&JSON.stringify(editor)!==baseline.current;
 const held=useRef({editor,dirty,baseline:baseline.current,owner:owner.current});held.current={editor,dirty,baseline:baseline.current,owner:owner.current};
 const clearDraft=useCallback(()=>{discarded.current=true;heldReviews.delete(owner.current.id);setEditor(null);setError('');},[]);
 useEffect(()=>{setDirtyFormGuard?.(dirty,clearDraft);return()=>setDirtyFormGuard?.(false);},[dirty,setDirtyFormGuard,clearDraft]);
 useEffect(()=>()=>{const latest=held.current;if(!discarded.current&&latest.dirty&&latest.editor)heldReviews.set(latest.owner.id,{editor:latest.editor,baseline:latest.baseline,owner:latest.owner});},[collection.id]);
 useEffect(()=>{const resize=()=>setMobile(window.innerWidth<=1000);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 useEffect(()=>{
  const panel=root.current,grid=panel?.querySelector<HTMLElement>('.pc-workspace-grid');if(!panel||!grid)return;
  const size=()=>{if(window.innerWidth>1000)panel.style.setProperty('--pc-work-height',`${Math.max(240,window.innerHeight-grid.getBoundingClientRect().top-100)}px`);};
  const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(size);observer?.observe(panel);window.addEventListener('resize',size);size();
  return()=>{observer?.disconnect();window.removeEventListener('resize',size);};
 },[]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 const media=snapshot?.media??[],images=media.filter(m=>m.mimeType.startsWith('image/'));
 const visible=model.rows.filter(r=>(!attention||r.attention)&&(!query.trim()||`${r.shot.code} ${r.shot.title} ${r.scene?.title??''}`.toLowerCase().includes(query.trim().toLowerCase())));
 const selectedAppearance=selected?.wardrobe.find(a=>a.key===appearanceKey)??selected?.wardrobe[0];
 const defaultPair=model.pairs.find(p=>p.from.id===activeShotId)??model.pairs[0];
 const target=pairTarget??(defaultPair?{fromId:defaultPair.from.id,toId:defaultPair.to.id}:undefined);
 const transition=target?collection.project?.transitions?.find(t=>t.fromShotId===target.fromId&&t.toShotId===target.toId):undefined;
 const pair:ContinuityPair|undefined=target?{...target,from:model.rows.find(r=>r.shot.id===target.fromId)?.shot,to:model.rows.find(r=>r.shot.id===target.toId)?.shot,transition,detached:!model.pairs.some(p=>p.from.id===target.fromId&&p.to.id===target.toId)}:undefined;
 const restoreFocus=()=>requestAnimationFrame(()=>{if(trigger.current?.isConnected)trigger.current.focus();});
 const closeEditor=()=>{clearDraft();setDirtyFormGuard?.(false);restoreFocus();};
 const guard=(action:()=>void)=>{if(busyRef.current)return;if(dirty)setDiscard(()=>action);else action();};
 const openEditor=(next:ContinuityEditorState)=>guard(()=>{discarded.current=false;trigger.current=document.activeElement as HTMLElement;baseline.current=JSON.stringify(next);owner.current={id:collection.id,revision:collection.project?.revision??0};setEditor(next);setError('');});
 const navigate=(nextView:ContinuityView,nextShot=activeShotId,focusTab=false)=>guard(()=>{closeEditor();setAppearanceKey(undefined);setLocalView(nextView);setLocalShot(nextShot);onNavigate?.({continuity:nextView,shot:nextShot});if(focusTab)requestAnimationFrame(()=>document.getElementById(`${uid}-${nextView}`)?.focus());});
 const pick=(id:string,key?:string)=>guard(()=>{closeEditor();setAppearanceKey(key);setLocalShot(id);setPairTarget(undefined);onNavigate?.({continuity:activeView,shot:id});});
 const run=async(action:()=>Promise<unknown>)=>{
  if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
  try{await action();await onChanged();closeEditor();}catch(cause){setError(cause instanceof Error?cause.message:String(cause));}finally{busyRef.current=false;setBusy(false);}
 };
 const verifyEditor=()=>{
  if(owner.current.id!==collection.id)throw new Error('Collection changed while this review was open. Keep or copy your notes, then reopen the intended shot.');
  if(owner.current.revision!==(collection.project?.revision??0))throw new Error('Project changed while this review was open. Keep or copy your notes, then reopen this review.');
 };
 const save=()=>{if(!editor)return;void run(async()=>{
  verifyEditor();
  if(editor.kind==='wardrobe')return updateWardrobeIntent({collectionId:owner.current.id,shotId:editor.shot.id,reason:editor.reason===(editor.shot.intentionalWardrobeChange??'')?undefined:editor.reason||null,notes:editor.notes===(editor.shot.continuityNotes??'')?undefined:editor.notes});
  if(editor.kind==='transition')return upsertProjectTransition({collectionId:owner.current.id,expectedRevision:editor.revision,transition:{...editor.draft,id:editor.draft.id||undefined}});
  if(editor.kind==='remove')return removeProjectTransition({collectionId:owner.current.id,transitionId:editor.transition.id});
 });};
 const choose=(id:string|null)=>{if(editor?.kind!=='frame')return;void run(async()=>{verifyEditor();return updateProjectFrames({collectionId:owner.current.id,shotId:editor.shot.id,[editor.side]:id});});};
 const upload=(file:File)=>{if(editor?.kind!=='frame')return;const check=validateMediaCandidate({name:file.name,type:file.type,size:file.size,existingCount:0,currentTotalBytes:media.reduce((n,m)=>n+m.byteSize+(m.posterBlob?.size??0),0)});if(!check.valid||check.kind!=='image'){setError(check.error??'Choose a supported image.');return;}void run(async()=>{verifyEditor();return uploadProjectFrame({collectionId:owner.current.id,shotId:editor.shot.id,side:editor.side,file});});};
 const openTransition=()=>{if(!pair?.from||!pair.to)return;const existing=pair.transition;openEditor({kind:'transition',from:pair.from,to:pair.to,revision:collection.project?.revision??0,draft:existing?{...existing}:{id:'',fromShotId:pair.fromId,toShotId:pair.toId,type:'straight_cut',description:'',notes:''}});};
 const transitionLabel=(t:ProjectTransition)=>`${model.rows.find(r=>r.shot.id===t.fromShotId)?title(model.rows.find(r=>r.shot.id===t.fromShotId)!.shot):`Missing shot (${t.fromShotId})`} → ${model.rows.find(r=>r.shot.id===t.toShotId)?title(model.rows.find(r=>r.shot.id===t.toShotId)!.shot):`Missing shot (${t.toShotId})`}`;
 const imageFor=(shot:ProjectShot,side:FrameSide,editable=false)=>{
  const id=shot[side],record=id?media.find(m=>m.id===id):undefined,item=record?.mimeType.startsWith('image/')?record:undefined,label=side==='firstFrameMediaId'?'First frame':'Last frame',key=JSON.stringify([shot.id,side,editable]);
  return <div className={editable?'pc-frame':'pc-comparison-frame'} key={key}><strong>{editable?label:`${title(shot)} ${label.toLowerCase()}`}</strong>{item?<button type="button" className="pc-frame-preview" ref={el=>{if(el)previewTriggers.current.set(key,el);else previewTriggers.current.delete(key);}} aria-label={`Enlarge ${editable?label.toLowerCase()+' for '+title(shot):title(shot)+' '+label.toLowerCase()}`} onClick={()=>setPreview({media:item,title:editable?`${title(shot)} — ${label}`:`${title(shot)} ${label.toLowerCase()}`,key})}><MediaThumbnail media={item} altText={`${label} for ${title(shot)}`}/></button>:<span className="pc-missing">{id?`${record?'Invalid image record':'Missing image'} (${id})`:'No frame assigned (optional)'}</span>}{editable&&<div className="pc-row-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>openEditor({kind:'frame',shot,side})}>Choose image</button>{id&&<button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>guard(()=>void run(()=>updateProjectFrames({collectionId:collection.id,shotId:shot.id,[side]:null})))}>Clear</button>}</div>}</div>;
 };
 const inspectTake=(action:((shot:ProjectShot)=>void)|undefined)=>{if(selected&&action)guard(()=>{closeEditor();action(selected.shot);});};
 const editBlockingCopy=(sceneId:string,shotId:string)=>guard(()=>{void(async()=>{
  if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
  try{
   const source=snapshot?.scenes.find(scene=>scene.id===sceneId);if(!source)throw Error('The selected take is unavailable. Refresh before creating a recipe copy.');
   if(source.authoringMode==='direct_prompt'){routeNavigate('/recipes/ai?'+new URLSearchParams({scene:sceneId,collection:collection.id,shot:shotId}).toString());return;}
   const draft=await createSceneRevisionDraft(sceneId,{target:{collectionId:collection.id,shotId,expectedProjectRevision:collection.project?.revision??0}});
   await onChanged();routeNavigate(collectionBuilderRoute(draft.id,collection.id,{...collectionViewState(hashPath),tab:'continuity',continuity:'blocking',shot:shotId}));
  }catch(cause){setError(cause instanceof Error?cause.message:String(cause));}finally{busyRef.current=false;setBusy(false);}
 })();});
 const reviewWardrobe=()=>{if(selected)openEditor({kind:'wardrobe',shot:selected.shot,reason:selected.shot.intentionalWardrobeChange??'',notes:selected.shot.continuityNotes??''});};
 const selectedIndex=visible.findIndex(r=>r.shot.id===activeShotId);
 const editorElement=editor&&<ContinuityEditor editor={editor} onChange={setEditor} busy={busy} error={error} mobile={mobile} onClose={()=>guard(closeEditor)} onSave={save} images={images} onChoose={choose} onUpload={upload} comparison={(shot,side)=>imageFor(shot,side)} transitionLabel={transitionLabel} returnFocusRef={trigger}/>;
 useEffect(()=>{if(!editor||mobile||preview||discard)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();guard(closeEditor);}};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[editor,mobile,preview,discard,dirty]);
 return <div className="pc-panel" ref={root}>
  {recovered.current&&editor&&<p role="status">Recovered unsaved review. Its original shot/pair and source revision are retained; no changes have been saved.</p>}
  <div className="pc-workspace-tools"><label>Find a shot<input type="search" aria-label="Find a shot" value={query} onChange={e=>{const value=e.target.value;guard(()=>setQuery(value));}} placeholder="Shot code, title or selected take"/></label><label>Show<select aria-label="Continuity filter" value={attention?'attention':'all'} onChange={e=>{const value=e.target.value;guard(()=>setAttention(value==='attention'));}}><option value="all">All shots</option><option value="attention">Needs attention</option></select></label></div>
  <nav className="pc-shot-strip" aria-label="Continuity shot sequence">{visible.map(r=><button type="button" key={r.shot.id} className="pc-shot-choice" aria-pressed={r.shot.id===activeShotId} onClick={()=>pick(r.shot.id)}><strong>{title(r.shot)}</strong><span>{r.scene?.title??(r.shot.selectedSceneId?'Selected take unavailable':'No selected take')}</span></button>)}</nav>
  {!visible.length&&<p role="status">{model.rows.length?'No shots match these filters.':'No shots yet. Add a planned shot from Storyboard.'}</p>}
  {selected&&!visible.some(r=>r.shot.id===selected.shot.id)&&<p role="status">The selected shot is outside these filters. Its exact selection is retained. <button type="button" className="btn btn-secondary btn-sm" onClick={()=>guard(()=>{setQuery('');setAttention(false);})}>Clear filters</button></p>}
  <div className="pc-view-tabs" role="tablist" aria-label="Continuity views">{CONTINUITY_VIEWS.map((v,index)=><button type="button" key={v} id={`${uid}-${v}`} role="tab" aria-controls={`${uid}-content`} aria-selected={activeView===v} tabIndex={activeView===v?0:-1} onClick={()=>navigate(v)} onKeyDown={e=>{let next:number|undefined;if(e.key==='ArrowRight')next=(index+1)%CONTINUITY_VIEWS.length;if(e.key==='ArrowLeft')next=(index+CONTINUITY_VIEWS.length-1)%CONTINUITY_VIEWS.length;if(e.key==='Home')next=0;if(e.key==='End')next=CONTINUITY_VIEWS.length-1;if(next!==undefined){e.preventDefault();navigate(CONTINUITY_VIEWS[next],activeShotId,true);}}}>{CONTINUITY_LABELS[v]}</button>)}</div>
  <div className="pc-workspace-grid"><div id={`${uid}-content`} role="tabpanel" aria-labelledby={`${uid}-${activeView}`} className="pc-content-scroll"><ContinuityViews model={model} rows={visible} view={activeView} selected={selected} onPick={pick} onPair={(fromId,toId)=>guard(()=>{closeEditor();setPairTarget({fromId,toId});})} selectedPair={pair} onEditRecipe={editBlockingCopy} renderFrames={shot=><div className="pc-frame-pair">{imageFor(shot,'firstFrameMediaId',true)}{imageFor(shot,'lastFrameMediaId',true)}</div>}/></div>
   <aside className="pc-inspector card" aria-label="Selected shot inspector"><div className="pc-inspector-summary" hidden={!!editor&&!mobile}>
    {selected?<><span className="pc-eyebrow">Selected shot</span><h3>{title(selected.shot)}</h3><p>{selected.scene?`Selected take: ${selected.scene.title}`:selected.shot.selectedSceneId?`Selected take unavailable (${selected.shot.selectedSceneId})`:'No selected take'}</p>{selected.scene&&<p className="pc-source">Take ID: {selected.scene.id}</p>}<div className="pc-row-actions"><button type="button" className="btn btn-secondary btn-sm" disabled={busy||selectedIndex<=0} onClick={()=>pick(visible[selectedIndex-1].shot.id)}>Previous</button><button type="button" className="btn btn-secondary btn-sm" disabled={busy||selectedIndex<0||selectedIndex>=visible.length-1} onClick={()=>pick(visible[selectedIndex+1].shot.id)}>Next</button></div>
    {activeView==='transitions'?pair?<><h4>{pair.transition?transitionLabel(pair.transition):`${pair.from?title(pair.from):pair.fromId} → ${pair.to?title(pair.to):pair.toId}`}</h4>{pair.detached&&<p className="pc-warning">Detached historical pair</p>}<div className="pc-frame-pair">{pair.from&&imageFor(pair.from,'lastFrameMediaId')}{pair.to&&imageFor(pair.to,'firstFrameMediaId')}</div>{pair.transition?<><p className="pc-transition-meta">{pair.transition.type.replaceAll('_',' ')}{pair.transition.durationSeconds!==undefined?` · ${pair.transition.durationSeconds} s`:''}</p><details className="pc-wardrobe-details"><summary>Transition details</summary><p className="pc-prewrap">{pair.transition.description}</p><p className="pc-prewrap">{pair.transition.notes}</p></details>{!pair.detached&&<button type="button" className="btn btn-secondary" onClick={openTransition}>Edit transition</button>}<button type="button" className="btn btn-secondary" onClick={()=>openEditor({kind:'remove',transition:pair.transition!})}>Remove transition</button></>:pair.from&&pair.to&&!pair.detached?<button type="button" className="btn btn-secondary" onClick={openTransition}>Add transition</button>:<p>Pair unavailable. Choose an exact current or detached pair.</p>}</>:<p>No pair selected.</p>:activeView==='frames'?<p className="muted-text">Legacy images belong to this shot, not this take. Ordered keyframes and image prompts arrive in C.</p>:activeView==='blocking'?<p className="muted-text">Inspect exact Start to Action to End plans. Positions are authored and unknown values stay unspecified.</p>:<>{selected.wardrobe.length>1&&<label>Participant<select aria-label="Inspect participant" value={selectedAppearance?.key??''} onChange={e=>setAppearanceKey(e.target.value)}>{selected.wardrobe.map(a=><option key={a.key} value={a.key}>{a.characterName}{a.participantId?` · ${a.participantId}`:''}{a.offCamera?' · off-camera':''}</option>)}</select></label>}{selectedAppearance?<article><h4>{selectedAppearance.characterName}</h4><p className="pc-source">Wardrobe source: {selectedAppearance.wardrobeSourceTitle||selectedAppearance.wardrobeSourceId||'Wardrobe unknown'}</p><p className={selectedAppearance.changed?'pc-warning':'muted-text'}>{appearanceLabel(selectedAppearance)}</p><details className="pc-wardrobe-details"><summary>Frozen wardrobe description</summary><p className="pc-source">Source ID: {selectedAppearance.wardrobeSourceId??'Unassigned'}</p><p className="pc-prewrap">{selectedAppearance.wardrobeDescription||'Description unavailable'}</p></details></article>:<p>Wardrobe unknown / not applicable for this take.</p>}{selected.shot.intentionalWardrobeChange&&<p>Intentional: {WARDROBE_REASONS.find(r=>r.value===selected.shot.intentionalWardrobeChange)?.label}</p>}{selected.shot.continuityNotes&&<details className="pc-wardrobe-details"><summary>Continuity notes</summary><p className="pc-prewrap">{selected.shot.continuityNotes}</p></details>}<button type="button" className="btn btn-primary" onClick={reviewWardrobe}>Review wardrobe</button></>}
    {onOpenTake&&<button type="button" className="btn btn-secondary" disabled={!selected.scene} onClick={()=>inspectTake(onOpenTake)}>Open saved take</button>}{onManageTakes&&<button type="button" className="btn btn-secondary" onClick={()=>inspectTake(onManageTakes)}>Manage takes</button>}<p className="pc-source">Inspection never changes the preferred take.</p></>:<p>{activeShotId?`Selected shot unavailable (${activeShotId}). Choose an existing shot.`:'Select a shot to inspect its continuity.'}</p>}
   </div>{!mobile&&!discard&&editorElement}</aside>
  </div>
  {mobile&&editor&&!preview&&!discard&&editorElement}
  {!editor&&error&&<p role="alert">{error}</p>}
  {discard&&<StudioDialog title="Discard unsaved review?" onClose={()=>setDiscard(null)} footer={<><button type="button" className="btn btn-secondary" onClick={()=>{setDiscard(null);requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>('.pc-inline-editor select,.pc-inline-editor input,.pc-inline-editor textarea')?.focus());}}>Keep editing</button><button type="button" className="btn btn-danger" onClick={()=>{const action=discard;setDiscard(null);clearDraft();setDirtyFormGuard?.(false);action();}}>Discard changes</button></>}><p>Your unsaved review text will be discarded. Stored scenes and images are unchanged.</p></StudioDialog>}
  {preview&&<MediaPreviewDialog media={preview.media} title={preview.title} onClose={()=>{const key=preview.key;setPreview(null);requestAnimationFrame(()=>previewTriggers.current.get(key)?.focus());}}/>}
 </div>;
};
