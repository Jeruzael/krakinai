import type {PlannedKeyframeV1,KeyframeFinding} from '../../types/keyframes';
export function KeyframeTimeline({frames,selectedId,onSelect,findings,panelId}:{frames:PlannedKeyframeV1[];selectedId?:string;onSelect(id:string):void;findings:KeyframeFinding[];panelId:string}){
 return <div className="keyframe-timeline" role="tablist" aria-label="Planned image frames">{frames.map((frame,index)=>{
  const issues=findings.filter(f=>f.path.startsWith(`keyframePlan.frames[${index}]`));
  return <button type="button" role="tab" id={`${panelId}-${frame.id}`} aria-controls={panelId} aria-selected={selectedId===frame.id} tabIndex={selectedId===frame.id||!selectedId&&index===0?0:-1} key={frame.id} onClick={()=>onSelect(frame.id)} onKeyDown={event=>{
   const next=event.key==='ArrowRight'?Math.min(index+1,frames.length-1):event.key==='ArrowLeft'?Math.max(index-1,0):event.key==='Home'?0:event.key==='End'?frames.length-1:undefined;
   if(next!==undefined){event.preventDefault();onSelect(frames[next].id);document.getElementById(`${panelId}-${frames[next].id}`)?.focus();}
  }}><strong>{frame.label}</strong><small>{frame.id} · {frame.role} · {issues.length?'Needs setup':'Planned'}</small></button>;
 })}</div>;
}
