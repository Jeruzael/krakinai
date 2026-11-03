import type {ContinuityWorkspaceModel,ContinuityShotRow} from '../../domain/continuityWorkspace';
import {useId,useState} from 'react';
import type {SavedScene} from '../../types/domain';
import type {ParticipantRef} from '../../types/blocking';
import {BlockingBoard,type BlockingPhaseName} from './BlockingBoard';
import {compareBlockingPair} from '../../domain/blockingContinuity';
import {buildBlockingDocument,formatBlockingDocument} from '../../domain/blockingDocument';
import {blockingParticipantSources,blockingParticipantKey,blockingBindingToken,validateSceneBlocking} from '../../domain/blockingValidation';
import {canonicalStringify} from '../../domain/changeSetCanonical';
import {human} from './BlockingFields';
export interface BlockingContinuityViewProps{model:ContinuityWorkspaceModel;selected?:ContinuityShotRow;onEditRecipe?:(sceneId:string,shotId:string)=>void}
type CapturedPair={projectRevision:number;previousShotId:string;currentShotId:string;previous:SavedScene;current:SavedScene;order:string[]};
export function BlockingContinuityView({model,selected,onEditRecipe}:BlockingContinuityViewProps){
 const [phase,setPhase]=useState<BlockingPhaseName>('start'),[participant,setParticipant]=useState<ParticipantRef>();
 const [captured,setCaptured]=useState<CapturedPair>(),[interpretation,setInterpretation]=useState('unclassified'),[confirmed,setConfirmed]=useState<string[]>([]);
 const tabsId=useId(),scene=selected?.scene,index=model.rows.findIndex(row=>row.shot.id===selected?.shot.id),previous=index>0?model.rows[index-1]:undefined;
 const invalid=scene?validateSceneBlocking(scene.blocking,scene,'assembly').filter(f=>f.severity==='blocking'):[];
 const pair=captured?compareBlockingPair(captured.previous,captured.current,{participantPairs:confirmed.map(key=>{const ref=blockingParticipantSources(captured.current).find(p=>blockingParticipantKey(p.ref)===key)!.ref;return{previous:ref,current:ref};})}):undefined;
 const oldRow=captured&&model.rows.find(row=>row.shot.id===captured.previousShotId),newRow=captured&&model.rows.find(row=>row.shot.id===captured.currentShotId);
 const stale=!!captured&&(captured.projectRevision!==model.projectRevision||selected?.shot.id!==captured.currentShotId||oldRow?.scene?.id!==captured.previous.id||newRow?.scene?.id!==captured.current.id||canonicalStringify(captured.order)!==canonicalStringify(model.rows.map(r=>r.shot.id))||oldRow?.scene&&canonicalStringify(oldRow.scene.blocking??null)!==canonicalStringify(captured.previous.blocking??null)||newRow?.scene&&canonicalStringify(newRow.scene.blocking??null)!==canonicalStringify(captured.current.blocking??null));
 const repeated=captured?blockingParticipantSources(captured.current).filter(person=>{
  const peers=blockingParticipantSources(captured.current).filter(p=>p.character.sourceType===person.character.sourceType&&p.character.sourceId===person.character.sourceId);
  const old=blockingParticipantSources(captured.previous).find(p=>blockingParticipantKey(p.ref)===blockingParticipantKey(person.ref));
  const oldPeers=old?blockingParticipantSources(captured.previous).filter(p=>p.character.sourceType===old.character.sourceType&&p.character.sourceId===old.character.sourceId):[];
  return (peers.length>1||oldPeers.length>1)&&old&&person.character.sourceType==='asset'&&blockingBindingToken(person.character)===blockingBindingToken(old.character);
 }):[];
 const capture=()=>{if(scene&&previous?.scene&&selected){setCaptured({projectRevision:model.projectRevision,previousShotId:previous.shot.id,currentShotId:selected.shot.id,previous:structuredClone(previous.scene),current:structuredClone(scene),order:model.rows.map(r=>r.shot.id)});setConfirmed([]);setInterpretation('unclassified');}};
 return <section className="pc-content card" aria-label="Saved blocking inspection"><h3>Blocking workspace</h3><p>Read-only selected-take inspection. Editing starts a separate managed recipe draft.</p>{!selected?<p>Select an available shot to inspect its saved blocking.</p>:!scene?<p>The selected take is unavailable. Select an existing take; no plan was created.</p>:<>
  <p>Shot {selected.shot.code} · {selected.shot.title}<br/>Take ID: <code>{scene.id}</code> · revision {scene.revision}</p>
  {!scene.blocking?<p>No authored blocking (optional). No positions are inferred.</p>:invalid.length?<section role="alert"><h4>Saved blocking needs review</h4><ul>{invalid.map((finding,i)=><li key={finding.path+i}>{finding.path}: {finding.message}</li>)}</ul></section>:<>
   <div className="blocking-tabs" role="tablist" aria-label="Saved blocking phases" onKeyDown={event=>{const names=['start','action','end']as const;let index=names.indexOf(phase);if(event.key==='ArrowRight')index=(index+1)%3;else if(event.key==='ArrowLeft')index=(index+2)%3;else if(event.key==='Home')index=0;else if(event.key==='End')index=2;else return;event.preventDefault();setPhase(names[index]);event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')[index]?.focus();}}>{(['start','action','end']as const).map(name=><button key={name} type="button" className="btn btn-secondary btn-sm" role="tab" id={`${tabsId}-${name}`} aria-selected={phase===name} aria-controls={`${tabsId}-panel`} tabIndex={phase===name?0:-1} onClick={()=>setPhase(name)}>{human(name)}</button>)}</div>
   <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${phase}`}><BlockingBoard source={scene} blocking={scene.blocking} phase={phase} participant={participant} onSelect={setParticipant}/></div>
   <details className="blocking-section"><summary>Complete saved blocking</summary><pre className="pc-prewrap">{formatBlockingDocument(buildBlockingDocument(scene)!,'full')}</pre></details>
  </>}
  {onEditRecipe&&<button type="button" className="btn btn-primary" onClick={()=>onEditRecipe(scene.id,selected.shot.id)}>{scene.authoringMode==='direct_prompt'?'Convert to Recipe for blocking':'Edit a recipe copy'}</button>}
  <div className="blocking-controls"><button type="button" className="btn btn-secondary" disabled={!previous?.scene} onClick={capture}>Compare previous shot</button>{previous&&<span className="muted-text">Whole storyboard neighbor: {previous.shot.code} · {previous.shot.title}</span>}</div>
 </>}
 {captured&&pair&&<section role="region" aria-label="Captured blocking comparison" className="blocking-item"><h4>End → Start · captured pair</h4><p><code>{captured.previousShotId}</code> / <code>{captured.previous.id}</code> → <code>{captured.currentShotId}</code> / <code>{captured.current.id}</code></p>{stale&&<p role="alert">This pair changed or was reordered. The captured take IDs are preserved below; compare the current selected pair again before relying on it.</p>}
  <p>{pair.comparable?'Comparable authored fields':'Not comparable'}{pair.basis.reason?` · ${human(pair.basis.reason)}`:''}. Unknown or unspecified fields are not evaluated.</p>
  <label className="blocking-field"><span>Comparison interpretation</span><select className="select" value={interpretation} onChange={e=>setInterpretation(e.target.value)}><option value="unclassified">Unclassified · review the cut</option><option value="intentional_cut">Intentional cut</option><option value="reverse_angle">Reverse angle</option><option value="time_jump">Time jump</option><option value="unknown_basis">Unknown spatial basis</option></select></label><p className="muted-text">Interpretation stays in this view. It does not change a take, transition or approval.</p>
  {repeated.length>0&&<fieldset><legend>Repeated appearances: confirm exact same-ID bindings only</legend>{repeated.map(person=>{const key=blockingParticipantKey(person.ref);return <label key={key} className="blocking-check"><input type="checkbox" checked={confirmed.includes(key)} onChange={e=>setConfirmed(e.target.checked?[...confirmed,key]:confirmed.filter(id=>id!==key))}/>Compare repeated participant {key} as the same exact binding ({person.character.sourceTitle})</label>;})}</fieldset>}
  {pair.findings.length?<ul>{pair.findings.map((finding,i)=><li key={finding.code+finding.path+i}><strong>Advisory · {finding.code}</strong> {finding.message}<details><summary>Exact authored values · {finding.path}</summary><pre className="pc-prewrap">{JSON.stringify({before:finding.before,after:finding.after},null,2)}</pre></details></li>)}</ul>:<p>No differences detected in the evaluated authored fields. This is not a completeness or physical-motion certification.</p>}
 </section>}
 </section>;
}
