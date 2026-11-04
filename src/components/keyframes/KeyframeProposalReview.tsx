import type {ChangeSetPreview,ChangeSetApproval} from '../../types/changeSet';
import type {OutputMode} from '../../types/domain';
import type {LibrarySnapshot} from '../../storage/db';
import type {PreparedFrameAuthoring} from '../../domain/frameAuthoring';
import {BlockingOutputReview} from '../blocking/BlockingOutputReview';
import type {FrameImageEvent,FrameVideoReviewEvent} from '../../types/frameProduction';
import {KeyframeProposalApprovals} from './KeyframeProposalApprovals';
import {ReviewPromptText} from '../aiConnections/ReviewPromptText';

interface Props {
  preview:ChangeSetPreview;snapshot:LibrarySnapshot;disabled:boolean;onApproval(value:ChangeSetApproval):void;
  operationId?:string;section?:'all'|'frames'|'blocking'|'video';frameId?:string;imageMode?:'full'|'compact';videoMode?:OutputMode;showApprovals?:boolean;
}
export function KeyframeProposalReview({preview,snapshot,disabled,onApproval,operationId,section='all',frameId,imageMode,videoMode,showApprovals=true}:Props){
  if(preview.changeSet.schema!=='krakinai.change-set.v6')return null;
  const {approval}=preview,rows=preview.plan.operations.filter(row=>!operationId||row.operationId===operationId).map(row=>({row,data:row.resolved as {keyframes?:PreparedFrameAuthoring;frameImage?:FrameImageEvent;videoReview?:FrameVideoReviewEvent}|undefined}));
  const edited=(next:ChangeSetApproval)=>onApproval({...next,keyframes:false,frameImages:false,frameVideo:false,blocking:false});
  const frames=section==='all'||section==='frames',blocking=section==='all'||section==='blocking',video=section==='all'||section==='video';
  return <section className="keyframe-proposal-review" aria-label="Frame proposal review">
    {!operationId&&<><h3>Frame and video changes</h3><p>The original saved take remains immutable. Only this reviewed new take or exact image association changes. Other takes, frame IDs and the preferred take remain preserved unless separately proposed.</p></>}
    {rows.map(({row,data})=>{
      const value=data?.keyframes,op=preview.changeSet.operations.find(o=>o.operationId===row.operationId),source=op&&'sceneId'in op?snapshot.scenes.find(s=>s.id===op.sceneId):undefined;
      if(!value)return data?.frameImage||data?.videoReview?<details className="card" key={row.operationId}><summary>Exact {row.type} · {row.operationId}</summary><pre>{JSON.stringify(data.frameImage??data.videoReview,null,2)}</pre><p>No image or video is automatically approved.</p></details>:null;
      const ids=[...new Set([...(value.beforePlan?.frames.map(f=>f.id)??[]),...(value.afterPlan?.frames.map(f=>f.id)??[])])];
      return <section key={row.operationId} className="card" aria-label={`Frame changes ${row.operationId}`}><h4>{row.operationId}</h4><p><code>{row.projectId} / {row.shotId} / {source?.id??'new Recipe'}</code></p>
        {frames&&<>
          {value.differences.addedFrameIds.map(id=><p key={'add'+id}>Added frame: {id}</p>)}{value.differences.removedFrameIds.map(id=><p key={'remove'+id}>Removed frame: {id}</p>)}
          <details><summary>Exact frame order, timing and dependency changes</summary><pre>{JSON.stringify({before:value.beforePlan?.frames.map(f=>({id:f.id,label:f.label,relativePosition:f.relativePosition,timeSeconds:f.timeSeconds})),after:value.afterPlan?.frames.map(f=>({id:f.id,label:f.label,relativePosition:f.relativePosition,timeSeconds:f.timeSeconds})),differences:value.differences},null,2)}</pre></details>
          {ids.filter(id=>!frameId||id===frameId).map(id=><details key={id} open={frameId!==undefined}><summary>{value.afterPlan?.frames.find(f=>f.id===id)?.label??value.beforePlan?.frames.find(f=>f.id===id)?.label} · {id} · {value.differences.visuallyChangedFrameIds.includes(id)?'visual change':value.differences.addedFrameIds.includes(id)?'added':value.differences.removedFrameIds.includes(id)?'removed':'unchanged visual basis'}</summary>
            <details><summary>Exact original and proposed frame setup</summary><pre aria-label={`${id} original frame setup`}>{JSON.stringify(value.beforePlan?.frames.find(f=>f.id===id)??null,null,2)}</pre><pre aria-label={`${id} proposed frame setup`}>{JSON.stringify(value.afterPlan?.frames.find(f=>f.id===id)??null,null,2)}</pre></details>
            {(['full','compact'] as const).filter(mode=>!imageMode||imageMode===mode).map(mode=>{
              const manual=source?.manualImageOutputs?.[id]?.[mode],choices=approval.frameOutputDecisions?.[row.operationId]??{};
              return <div key={mode}><h5>{mode} image prompt</h5>{imageMode?<><ReviewPromptText label={`${id} ${mode} original image prompt`} text={manual?.text??source?.imagePromptSnapshots?.[id]?.[mode]}/><ReviewPromptText label={`${id} ${mode} proposed image prompt`} text={value.images.effectiveOutputs[id]?.[mode]}/></>:<><pre aria-label={`${id} ${mode} original image prompt`}>{manual?.text??source?.imagePromptSnapshots?.[id]?.[mode]??'Unavailable'}</pre><pre aria-label={`${id} ${mode} proposed image prompt`}>{value.images.effectiveOutputs[id]?.[mode]??'Incomplete; complete the required inputs before canonical assembly.'}</pre></>}
                {manual&&value.afterPlan?.frames.some(f=>f.id===id)&&<fieldset disabled={disabled}><legend>{id} {mode} manual decision</legend><pre aria-label={`${id} ${mode} manual image buffer`}>{manual.text}</pre>{(['canonical','keep_manual_unverified'] as const).map(choice=><label key={choice}><input type="radio" name={`${row.operationId}-${id}-${mode}`} aria-label={`${id} ${mode}: ${choice==='canonical'?'use canonical image prompt':'keep exact manual text, unverified'}`} checked={choices[id]?.[mode]===choice} onChange={()=>edited({...approval,frameOutputDecisions:{...approval.frameOutputDecisions,[row.operationId]:{...choices,[id]:{...choices[id],[mode]:choice}}}})}/>{choice==='canonical'?'Use canonical image prompt':'Keep exact manual text; correspondence unverified'}</label>)}</fieldset>}
              </div>;
            })}
          </details>)}
        </>}
        {blocking&&<details open={operationId!==undefined}><summary>Complete original and proposed Blocking</summary><pre aria-label="Original Blocking">{JSON.stringify(value.beforeBlocking??null,null,2)}</pre><pre aria-label="Proposed Blocking">{JSON.stringify(value.afterBlocking??null,null,2)}</pre></details>}
        {video&&<><details open={operationId!==undefined}><summary>Separate complete video prompts · {op&&'videoDecision'in op?op.videoDecision:'review required'}</summary>{(['full','structured','compact'] as const).filter(mode=>!videoMode||videoMode===mode).map(mode=><div key={mode}>{videoMode?<><ReviewPromptText label={`${mode} original video prompt`} text={source?.manualOutputs[mode]?.text??source?.outputs[mode]}/><ReviewPromptText label={`${mode} proposed video prompt`} text={value.video.outputs[mode]}/></>:<><pre aria-label={`${mode} original video prompt`}>{source?.manualOutputs[mode]?.text??source?.outputs[mode]??'New Recipe'}</pre><pre aria-label={`${mode} proposed video prompt`}>{value.video.outputs[mode]}</pre></>}</div>)}<p>Video correspondence: {value.video.reviewStatus}. No automatic semantic approval.</p></details>
          {value.video.canonicalOutputs&&source&&<fieldset disabled={disabled}><BlockingOutputReview source={{blocking:value.afterBlocking,manualOutputs:source.manualOutputs}} canonical={value.video.canonicalOutputs} decisions={approval.blockingOutputDecisions?.[row.operationId]??{}} requireReview={true} mode={videoMode} compact={operationId!==undefined} onChange={choices=>edited({...approval,blockingOutputDecisions:{...approval.blockingOutputDecisions,[row.operationId]:choices}})}/></fieldset>}
        </>}
        {frames&&op&&'imageCarryOver'in op&&!!op.imageCarryOver?.length&&<details><summary>Exact image carry-over; review resets</summary><pre>{JSON.stringify(op.imageCarryOver,null,2)}</pre><pre>{JSON.stringify(preview.plan.collections.flatMap(c=>c.project?.frameProduction?.imageEvents.filter(e=>e.provenance.kind==='carry_over'&&e.sceneId===preview.plan.results.find(r=>r.operationId===row.operationId)?.recordId)??[]),null,2)}</pre><p>Unchanged bytes are reused only for selected stable frames. Every new association needs review again.</p></details>}
      </section>;
    })}
    {showApprovals&&<KeyframeProposalApprovals preview={preview} disabled={disabled} onApproval={onApproval}/>}
  </section>;
}
