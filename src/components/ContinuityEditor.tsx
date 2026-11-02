import React, { useEffect, useRef } from 'react';
import type { MediaAsset, ProjectShot, ProjectTransition, WardrobeIntentReason } from '../types/domain';
import type { FrameSide } from '../domain/continuityWorkspace';
import { getMediaDisplayName } from '../domain/mediaNaming';
import { MediaThumbnail } from './MediaThumbnail';
import { StudioDialog } from './StudioDialog';

export type ContinuityEditorState =
  | {kind:'wardrobe';shot:ProjectShot;reason:WardrobeIntentReason|'';notes:string}
  | {kind:'frame';shot:ProjectShot;side:FrameSide}
  | {kind:'transition';from:ProjectShot;to:ProjectShot;revision:number;draft:ProjectTransition}
  | {kind:'remove';transition:ProjectTransition};
export const WARDROBE_REASONS: {value:WardrobeIntentReason;label:string}[] = [
  {value:'new_day',label:'New day'},{value:'costume_change',label:'Costume change'},
  {value:'flashback',label:'Flashback'},{value:'timeline',label:'Timeline'},
  {value:'deliberate',label:'Deliberate'},{value:'other',label:'Other'},
];
const title=(shot:ProjectShot)=>`${shot.code} ${shot.title}`;
interface Props {
  editor:ContinuityEditorState; onChange:(editor:ContinuityEditorState)=>void;
  busy:boolean;error:string;mobile:boolean;onClose:()=>void;onSave:()=>void;
  images:MediaAsset[];onChoose:(mediaId:string|null)=>void;onUpload:(file:File)=>void;
  comparison:(shot:ProjectShot,side:FrameSide)=>React.ReactNode;
  transitionLabel:(transition:ProjectTransition)=>string;returnFocusRef:React.RefObject<HTMLElement>;
}
export function ContinuityEditor({editor,onChange,busy,error,mobile,onClose,onSave,images,onChoose,onUpload,comparison,transitionLabel,returnFocusRef}:Props) {
 const inline=useRef<HTMLElement>(null);
 useEffect(()=>{if(!mobile){inline.current?.querySelector<HTMLElement>('select,input,textarea,button')?.focus();}},[mobile]);
 const heading=editor.kind==='wardrobe'?`Wardrobe review — ${title(editor.shot)}`:editor.kind==='frame'?`${editor.side==='firstFrameMediaId'?'First':'Last'} frame — ${title(editor.shot)}`:editor.kind==='transition'?`Transition — ${title(editor.from)} → ${title(editor.to)}`:'Remove transition?';
 const footer=<><button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Cancel</button>{editor.kind!=='frame'&&<button type="button" className={`btn ${editor.kind==='remove'?'btn-danger':'btn-primary'}`} disabled={busy} onClick={onSave}>{busy?'Saving…':editor.kind==='wardrobe'?'Save review':editor.kind==='transition'?'Save transition':'Remove transition'}</button>}</>;
 const body=<>
  {editor.kind==='wardrobe'&&<><p className="muted-text">Shot-level review notes apply to the shot. Frozen Character and Outfit prompts stay unchanged.</p><div className="pc-form"><label className="pc-form-field">Intentional change reason<select disabled={busy} value={editor.reason} onChange={e=>onChange({...editor,reason:e.target.value as WardrobeIntentReason|''})}><option value="">No reason set</option>{WARDROBE_REASONS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></label><label className="pc-form-field">Continuity notes<textarea disabled={busy} rows={5} value={editor.notes} onChange={e=>onChange({...editor,notes:e.target.value})}/></label></div></>}
  {editor.kind==='frame'&&<><p className="muted-text">Legacy shot-level image; selecting a file does not approve it or bind it to a take.</p><label className="pc-form-field">Upload image<input disabled={busy} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)onUpload(f);e.target.value='';}}/></label>{editor.shot[editor.side]&&<button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>onChoose(null)}>Clear association</button>}<div className="pc-image-picker">{images.map(item=><button type="button" key={item.id} className="pc-image-choice" disabled={busy} aria-label={`Use ${getMediaDisplayName(item)} as ${editor.side==='firstFrameMediaId'?'first':'last'} frame`} onClick={()=>onChoose(item.id)}><span className="pc-image-choice-thumb"><MediaThumbnail media={item} altText={getMediaDisplayName(item)}/></span><span>{getMediaDisplayName(item)}</span></button>)}</div>{!images.length&&<p>No stored image records available. Upload an actual image when ready.</p>}</>}
  {editor.kind==='transition'&&<><div className="pc-frame-pair">{comparison(editor.from,'lastFrameMediaId')}{comparison(editor.to,'firstFrameMediaId')}</div><div className="pc-form"><label className="pc-form-field">Type<select disabled={busy} value={editor.draft.type} onChange={e=>onChange({...editor,draft:{...editor.draft,type:e.target.value as ProjectTransition['type']}})}>{['straight_cut','match_cut','dissolve','j_cut','l_cut','bridge_shot','custom'].map(type=><option key={type} value={type}>{type.replaceAll('_',' ')}</option>)}</select></label><label className="pc-form-field">Duration in seconds (optional)<input disabled={busy} type="number" min="0" max="86400" step="any" value={editor.draft.durationSeconds??''} onChange={e=>{const {durationSeconds:_,...rest}=editor.draft;onChange({...editor,draft:e.target.value===''?rest as ProjectTransition:{...editor.draft,durationSeconds:Number(e.target.value)}});}}/></label><label className="pc-form-field">Description<textarea disabled={busy} rows={3} value={editor.draft.description} onChange={e=>onChange({...editor,draft:{...editor.draft,description:e.target.value}})}/></label><label className="pc-form-field">Notes<textarea disabled={busy} rows={3} value={editor.draft.notes} onChange={e=>onChange({...editor,draft:{...editor.draft,notes:e.target.value}})}/></label></div></>}
  {editor.kind==='remove'&&<p>Remove metadata for {transitionLabel(editor.transition)}? The scenes and frame images are kept.</p>}
  {error&&<p role="alert">{error}</p>}
 </>;
 if(mobile||editor.kind==='remove')return <StudioDialog title={heading} onClose={onClose} footer={footer} returnFocusRef={returnFocusRef}>{body}</StudioDialog>;
 return <section ref={inline} className="pc-inline-editor" role="region" aria-label={heading}><h3>{heading}</h3>{body}<div className="pc-editor-actions">{footer}</div></section>;
}
