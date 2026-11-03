import type {ChangeSetPreview,ChangeSetApproval} from '../../types/changeSet';
import type {LibrarySnapshot} from '../../storage/db';
import type {PreparedFrameAuthoring} from '../../domain/frameAuthoring';
import {BlockingOutputReview} from '../blocking/BlockingOutputReview';
import type {FrameImageEvent,FrameVideoReviewEvent} from '../../types/frameProduction';
export function KeyframeProposalReview({preview,snapshot,disabled,onApproval}:{preview:ChangeSetPreview;snapshot:LibrarySnapshot;disabled:boolean;onApproval(value:ChangeSetApproval):void}){
 if(preview.changeSet.schema!=='krakinai.change-set.v6')return null;
 const {approval}=preview,rows=preview.plan.operations.map(row=>({row,data:row.resolved as {keyframes?:PreparedFrameAuthoring;frameImage?:FrameImageEvent;videoReview?:FrameVideoReviewEvent}|undefined}));
 const edited=(next:ChangeSetApproval)=>onApproval({...next,keyframes:false,frameImages:false,frameVideo:false,blocking:false});
 const requiresPlans=rows.some(r=>r.data?.keyframes?.beforePlan||r.data?.keyframes?.afterPlan);
 const requiresBlocking=rows.some(r=>r.data?.keyframes?.beforeBlocking||r.data?.keyframes?.afterBlocking);
 const requiresImages=preview.changeSet.operations.some(op=>op.type.startsWith('frame_image.')||'imageCarryOver'in op&&!!op.imageCarryOver?.length);
 const requiresVideo=requiresPlans||preview.changeSet.operations.some(op=>op.type==='frame_video.request_review');
 return <section className="keyframe-proposal-review" aria-label="Frame proposal review">
  <h3>Frame and video changes</h3><p>The original saved take remains immutable. Only this reviewed new take or exact image association changes. Other takes, frame IDs and the preferred take remain preserved unless separately proposed.</p>
  {rows.map(({row,data})=>{
   const value=data?.keyframes,op=preview.changeSet.operations.find(o=>o.operationId===row.operationId),source=op&&'sceneId'in op?snapshot.scenes.find(s=>s.id===op.sceneId):undefined;
   if(!value)return data?.frameImage||data?.videoReview?<details className="card" key={row.operationId}><summary>Exact {row.type} · {row.operationId}</summary><pre>{JSON.stringify(data.frameImage??data.videoReview,null,2)}</pre><p>No image or video is automatically approved.</p></details>:null;
   const ids=[...new Set([...(value.beforePlan?.frames.map(f=>f.id)??[]),...(value.afterPlan?.frames.map(f=>f.id)??[])])];
   return <section key={row.operationId} className="card" aria-label={`Frame changes ${row.operationId}`}><h4>{row.operationId}</h4><p><code>{row.projectId} / {row.shotId} / {source?.id??'new Recipe'}</code></p>
    {value.differences.addedFrameIds.map(id=><p key={'add'+id}>Added frame: {id}</p>)}{value.differences.removedFrameIds.map(id=><p key={'remove'+id}>Removed frame: {id}</p>)}
    <details><summary>Exact frame order, timing and dependency changes</summary><pre>{JSON.stringify({before:value.beforePlan?.frames.map(f=>({id:f.id,label:f.label,relativePosition:f.relativePosition,timeSeconds:f.timeSeconds})),after:value.afterPlan?.frames.map(f=>({id:f.id,label:f.label,relativePosition:f.relativePosition,timeSeconds:f.timeSeconds})),differences:value.differences},null,2)}</pre></details>
    {ids.map(id=><details key={id}><summary>{value.afterPlan?.frames.find(f=>f.id===id)?.label??value.beforePlan?.frames.find(f=>f.id===id)?.label} · {id} · {value.differences.visuallyChangedFrameIds.includes(id)?'visual change':value.differences.addedFrameIds.includes(id)?'added':value.differences.removedFrameIds.includes(id)?'removed':'unchanged visual basis'}</summary>
     <pre aria-label={`${id} original frame setup`}>{JSON.stringify(value.beforePlan?.frames.find(f=>f.id===id)??null,null,2)}</pre><pre aria-label={`${id} proposed frame setup`}>{JSON.stringify(value.afterPlan?.frames.find(f=>f.id===id)??null,null,2)}</pre>
     {(['full','compact'] as const).map(mode=>{
      const manual=source?.manualImageOutputs?.[id]?.[mode],choices=approval.frameOutputDecisions?.[row.operationId]??{};
      return <div key={mode}><h5>{mode} image prompt</h5><pre aria-label={`${id} ${mode} original image prompt`}>{manual?.text??source?.imagePromptSnapshots?.[id]?.[mode]??'Unavailable'}</pre><pre aria-label={`${id} ${mode} proposed image prompt`}>{value.images.effectiveOutputs[id]?.[mode]??'Incomplete; complete the required inputs before canonical assembly.'}</pre>
       {manual&&value.afterPlan?.frames.some(f=>f.id===id)&&<fieldset disabled={disabled}><legend>{id} {mode} manual decision</legend><pre aria-label={`${id} ${mode} manual image buffer`}>{manual.text}</pre>{(['canonical','keep_manual_unverified'] as const).map(choice=><label key={choice}><input type="radio" name={`${row.operationId}-${id}-${mode}`} aria-label={`${id} ${mode}: ${choice==='canonical'?'use canonical image prompt':'keep exact manual text, unverified'}`} checked={choices[id]?.[mode]===choice} onChange={()=>edited({...approval,frameOutputDecisions:{...approval.frameOutputDecisions,[row.operationId]:{...choices,[id]:{...choices[id],[mode]:choice}}}})}/>{choice==='canonical'?'Use canonical image prompt':'Keep exact manual text; correspondence unverified'}</label>)}</fieldset>}
      </div>;
     })}
    </details>)}
    <details><summary>Complete original and proposed Blocking</summary><pre aria-label="Original Blocking">{JSON.stringify(value.beforeBlocking??null,null,2)}</pre><pre aria-label="Proposed Blocking">{JSON.stringify(value.afterBlocking??null,null,2)}</pre></details>
    <details><summary>Separate complete video prompts · {op&&'videoDecision'in op?op.videoDecision:'review required'}</summary>{(['full','structured','compact'] as const).map(mode=><div key={mode}><pre aria-label={`${mode} original video prompt`}>{source?.manualOutputs[mode]?.text??source?.outputs[mode]??'New Recipe'}</pre><pre aria-label={`${mode} proposed video prompt`}>{value.video.outputs[mode]}</pre></div>)}<p>Video correspondence: {value.video.reviewStatus}. No automatic semantic approval.</p></details>
    {value.video.canonicalOutputs&&source&&<fieldset disabled={disabled}><BlockingOutputReview source={{blocking:value.afterBlocking,manualOutputs:source.manualOutputs}} canonical={value.video.canonicalOutputs} decisions={approval.blockingOutputDecisions?.[row.operationId]??{}} requireReview={true} onChange={choices=>edited({...approval,blockingOutputDecisions:{...approval.blockingOutputDecisions,[row.operationId]:choices}})}/></fieldset>}
    {op&&'imageCarryOver'in op&&!!op.imageCarryOver?.length&&<details><summary>Exact image carry-over; review resets</summary><pre>{JSON.stringify(op.imageCarryOver,null,2)}</pre><pre>{JSON.stringify(preview.plan.collections.flatMap(c=>c.project?.frameProduction?.imageEvents.filter(e=>e.provenance.kind==='carry_over'&&e.sceneId===preview.plan.results.find(r=>r.operationId===row.operationId)?.recordId)??[]),null,2)}</pre><p>Unchanged bytes are reused only for selected stable frames. Every new association needs review again.</p></details>}
   </section>;
  })}
  <fieldset className="card" disabled={disabled}><legend>Approve exact frame changes</legend>{([{field:'blocking',label:'Approve Blocking changes',needed:requiresBlocking},{field:'keyframes',label:'Approve keyframe and image-prompt changes',needed:requiresPlans},{field:'frameImages',label:'Approve image associations and carry-over',needed:requiresImages},{field:'frameVideo',label:'Approve frame video decision',needed:requiresVideo}] as const).filter(item=>item.needed).map(item=><label className="import-check" key={item.field}><input type="checkbox" aria-label={item.label} checked={!!approval[item.field]} onChange={event=>onApproval({...approval,[item.field]:event.target.checked})}/><span>{item.label}</span></label>)}</fieldset>
 </section>;
}
