import {downloadBlobAsFile} from '../../hooks/useObjectUrl';
import type {SceneDraft} from '../../types/domain';
import type {ImagePromptSnapshotV1,FrameOutputDecisions as Decisions} from '../../types/keyframes';
import {useState,useRef} from 'react';
import './keyframes.css';
export interface FrameOutputDecisionsProps {source:Pick<SceneDraft,'imagePromptSnapshots'|'manualImageOutputs'>;frameId:string;canonical?:ImagePromptSnapshotV1;decisions:Decisions;onChange(value:Decisions):void;disabled?:boolean}
export function FrameOutputDecisions({source,frameId,canonical,decisions,onChange,disabled}:FrameOutputDecisionsProps){
 const [mode,setMode]=useState<'full'|'compact'>('full'),[status,setStatus]=useState(''),viewer=useRef<HTMLTextAreaElement>(null);
 const captured=canonical??source.imagePromptSnapshots?.[frameId],manual=source.manualImageOutputs?.[frameId]?.[mode],choice=decisions[frameId]?.[mode];
 const text=manual&&choice!=='canonical'?manual.text:captured?.[mode],manualSelected=!!manual&&choice!=='canonical';
 return <section className="frame-output-controls" aria-label="Selected frame image prompt">
  <div className="keyframe-control-row"><label>Image prompt mode<select aria-label="Image prompt mode" className="select" value={mode} onChange={e=>{setMode(e.target.value as typeof mode);setStatus('');}}><option value="full">Complete</option><option value="compact">Concise</option></select></label><span>{text===undefined?'Incomplete':`${text.length.toLocaleString()} characters · complete text`} · {manualSelected?'Manual · unverified':canonical?'Current canonical preview':'Captured canonical text'}</span></div>
  {manual&&<label>Image output decision<select aria-label="Image output decision" className="select" disabled={disabled} value={choice??''} onChange={event=>{const next={...decisions,[frameId]:{...decisions[frameId]}};if(event.target.value)next[frameId][mode]=event.target.value as 'canonical'|'keep_manual_unverified';else delete next[frameId][mode];onChange(next);setStatus('');}}><option value="">Choose before saving this changed mode</option><option value="canonical">Use canonical image prompt</option><option value="keep_manual_unverified">Keep exact manual text; unverified</option></select></label>}
  <textarea ref={viewer} aria-label="Complete image prompt" className="textarea frame-complete-text" readOnly value={text??''} placeholder="Complete the frame inputs, then preview its canonical still prompt."/>
  <div className="keyframe-control-row"><button className="btn btn-secondary btn-sm" disabled={text===undefined} onClick={()=>{void Promise.resolve().then(()=>navigator.clipboard.writeText(text!)).then(()=>setStatus(`Complete ${mode} image prompt for ${frameId} copied.`)).catch(()=>setStatus('Copy unavailable. Select the complete text below and copy it manually.'));}}>Copy complete image prompt</button><button className="btn btn-ghost btn-sm" disabled={text===undefined} onClick={()=>{viewer.current?.focus();viewer.current?.select();}}>Select complete text</button><button className="btn btn-secondary btn-sm" disabled={text===undefined} onClick={()=>downloadBlobAsFile(new Blob([text!],{type:"text/plain;charset=utf-8"}),`frame_${frameId}_${mode}.txt`)}>Download complete image prompt</button></div><p role="status" aria-live="polite">{status}</p>
 </section>;
}
