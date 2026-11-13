import React,{useState} from 'react';
import type {ChangeSetPreview,ChangeSetApproval,ImportOperationPreview,CandidateDecision} from '../../types/changeSet';
import {isRecipeOperation} from '../../types/changeSet';
import type {LibrarySnapshot} from '../../storage/db';
import type {PreparedFrameAuthoring} from '../../domain/frameAuthoring';
import type {OutputMode} from '../../types/domain';
import {
  analyzeProposalCandidateBlockers,
  buildBulkCreateApproval,
  applyCandidateDecisionWithSafeguards,
  type ProposalDetailTab,
} from '../../domain/proposalReadiness';
import {RecipeOperationPreview} from '../RecipeOperationPreview';
import {RecipeConversionReview} from '../RecipeConversionReview';
import {KeyframeProposalReview} from '../keyframes/KeyframeProposalReview';
import {BlockingProposalReview} from '../blocking/BlockingProposalReview';
import {ReviewPromptText} from './ReviewPromptText';

export function ProposalOperationDetail({row,preview,snapshot,tab,disabled,onApproval,onSelectOperation,onSelectTab}:{row:ImportOperationPreview;preview:ChangeSetPreview|undefined;snapshot:LibrarySnapshot;tab:ProposalDetailTab;disabled:boolean;onApproval(value:ChangeSetApproval):void;onSelectOperation?:(operationId:string)=>void;onSelectTab?:(tab:ProposalDetailTab)=>void}){
  const [selectedFrame,setSelectedFrame]=useState(''),[imageMode,setImageMode]=useState<'full'|'compact'>('full'),[videoMode,setVideoMode]=useState<OutputMode>('full');
  const data=(row.resolved as {keyframes?:PreparedFrameAuthoring}|undefined)?.keyframes;
  const frames=[...new Map([...(data?.afterPlan?.frames??[]),...(data?.beforePlan?.frames??[])].map(frame=>[frame.id,frame])).values()];
  const frameId=frames.find(f=>f.id===selectedFrame)?.id??frames[0]?.id;
  const sourceId=(row.details as {sceneId?:string}).sceneId,source=snapshot.scenes.find(s=>s.id===sourceId);
  const candidateAnalysis=analyzeProposalCandidateBlockers(preview,snapshot);
  const candidateItem=candidateAnalysis.byOperationId[row.operationId];
  const sceneCandidateOpIds=candidateAnalysis.referencedCandidateOpIdsByScene[row.operationId]??[];
  const deferredSceneCandidates=sceneCandidateOpIds.map(id=>candidateAnalysis.byOperationId[id]).filter(c=>c&&c.decision.action==='defer');
  const bulkCreatableForScene=deferredSceneCandidates.filter(c=>c.canBulkCreate);
  const modes=<div className="pr-mode-buttons" aria-label="Video prompt format">{(['full','structured','compact'] as const).map(mode=><button type="button" className="btn btn-secondary btn-sm" key={mode} aria-pressed={videoMode===mode} onClick={()=>setVideoMode(mode)}>{mode[0].toUpperCase()+mode.slice(1)}</button>)}</div>;
  if(tab==='data')return <><h3>Exact submitted operation</h3><pre tabIndex={0} aria-label="Exact selected operation JSON">{JSON.stringify(row.details,null,2)}</pre>{row.resolved!==undefined&&<details><summary>Complete resolved record and media metadata</summary><pre>{JSON.stringify(row.resolved,null,2)}</pre></details>}{row.matches?.map(match=><p key={match.id}>{match.title} · {match.id} · rev {match.revision} · {match.reason} <a href={match.kind==='template'?'/#/templates':`/#/prompts/${encodeURIComponent(match.id)}`} target="_blank" rel="noreferrer">Open existing record</a></p>)}</>;
  if(tab==='summary')return <>
    {candidateItem&&preview&&(
      <div className={'pr-candidate-summary-card '+(candidateItem.decision.action==='defer'?'banner banner-warning':'banner banner-info')}>
        <div className="pr-scene-dependency-banner">
          <div>
            <strong>
              {candidateItem.title} ({candidateItem.candidateKind}{candidateItem.clientRef?` · ref:${candidateItem.clientRef}`:''})
            </strong>
            <p className="muted-text">
              {candidateItem.isBlocking
                ? `Currently deferred — blocks ${candidateItem.dependentSceneIds.length} scene(s) from assembling.`
                : candidateItem.decision.action === 'create'
                  ? 'Approved to create as a new library item on Apply.'
                  : candidateItem.decision.action === 'reuse'
                    ? 'Configured to reuse an existing library item on Apply.'
                    : 'Currently deferred (pending decision).'}
            </p>
          </div>
          <div className="pr-inline-candidate-controls">
            {candidateItem.canBulkCreate&&candidateItem.decision.action==='defer'&&(
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={disabled}
                onClick={()=>onApproval(buildBulkCreateApproval(preview,snapshot,[candidateItem.operationId]))}
              >
                Approve Create
              </button>
            )}
            <select
              aria-label={`Inline decision for ${candidateItem.operationId}`}
              className="select select-sm"
              disabled={disabled}
              value={candidateItem.decision.action}
              onChange={e=>{
                const act=e.target.value as CandidateDecision['action'];
                if(act==='reuse'){
                  const matches = preview.plan.operations.find(r => r.operationId === candidateItem.operationId)?.matches ?? [];
                  if (matches.length > 0) {
                    if (candidateItem.kind === 'variant') {
                      const nextVar = { ...(preview.approval.variantDecisions ?? {}), [candidateItem.operationId]: { action: 'reuse' as const, variantId: matches[0].id, expectedRevision: matches[0].revision } };
                      onApproval(applyCandidateDecisionWithSafeguards(preview.changeSet, preview.approval, preview.approval.assetDecisions, nextVar));
                    } else {
                      const nextAsset = { ...preview.approval.assetDecisions, [candidateItem.operationId]: { action: 'reuse' as const, assetId: matches[0].id, expectedRevision: matches[0].revision } };
                      onApproval(applyCandidateDecisionWithSafeguards(preview.changeSet, preview.approval, nextAsset, preview.approval.variantDecisions));
                    }
                  }
                  if(onSelectOperation)onSelectOperation(candidateItem.operationId);
                  return;
                }
                if(candidateItem.kind==='variant'){
                  const nextVar={...(preview.approval.variantDecisions??{}),[candidateItem.operationId]:{action:act}};
                  onApproval(applyCandidateDecisionWithSafeguards(preview.changeSet,preview.approval,preview.approval.assetDecisions,nextVar));
                }else{
                  const nextAsset={...preview.approval.assetDecisions,[candidateItem.operationId]:{action:act}};
                  onApproval(applyCandidateDecisionWithSafeguards(preview.changeSet,preview.approval,nextAsset,preview.approval.variantDecisions));
                }
              }}
            >
              <option value="defer">Keep pending</option>
              <option value="create">Create new</option>
              <option value="reuse">Reuse existing (in rail)</option>
            </select>
          </div>
        </div>
      </div>
    )}
    {deferredSceneCandidates.length>0&&preview&&(
      <div className="banner banner-warning pr-scene-dependency-banner">
        <div>
          <strong>This scene depends on {deferredSceneCandidates.length} deferred candidate proposal(s).</strong>
          <p className="muted-text">Approve or reuse them to unblock assembly for this scene.</p>
        </div>
        <div className="pr-inline-candidate-controls">
          {bulkCreatableForScene.length>0&&(
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={disabled}
              onClick={()=>onApproval(buildBulkCreateApproval(preview,snapshot,bulkCreatableForScene.map(c=>c.operationId)))}
            >
              Approve scene candidates ({bulkCreatableForScene.length})
            </button>
          )}
          {onSelectTab&&(
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={()=>onSelectTab('recipe')}
            >
              Inspect Recipe components →
            </button>
          )}
        </div>
      </div>
    )}
    {row.proposedPrompt!==undefined&&candidateItem&&(
      <ReviewPromptText label={'Complete proposed text '+row.operationId} text={row.proposedPrompt}/>
    )}
    <h3>Proposed change</h3>
    <p>{row.summary}</p>
    <dl className="pr-facts"><div><dt>Operation</dt><dd>{row.type}</dd></div><div><dt>Exact operation ID</dt><dd>{row.operationId}</dd></div>{row.projectId&&<div><dt>Planned project target</dt><dd>{row.projectId}</dd></div>}{row.shotId&&<div><dt>Planned shot target</dt><dd>{row.shotId}</dd></div>}</dl>
    {data&&<><h3>Frame changes</h3><p>{data.differences.addedFrameIds.length} added · {data.differences.removedFrameIds.length} removed · {data.differences.visuallyChangedFrameIds.length} visually changed</p><p>Image prompts and the video decision are reviewed separately in their tabs.</p></>}
    <div className="banner banner-info">Inspect one item at a time. Apply saves the complete reviewed batch together; selected items are not a partial import.</div>
    <p className="muted-text">No existing immutable take is replaced. Check any explicit preferred-take, status or project changes separately. Proposed IDs are not confirmed saved IDs.</p>
    {!preview&&<p className="banner banner-warning">Original package only. Revalidate before relying on a resolved preview.</p>}
  </>;
  if(!preview)return <><p className="banner banner-info">This saved package has no current resolved preview. Pair and revalidate before approving.</p><pre>{JSON.stringify(row.details,null,2)}</pre></>;
  if(tab==='recipe')return isRecipeOperation(row)?<>{row.type==='scene.convert_direct_to_recipe'&&<RecipeConversionReview row={row} source={source} approval={preview.approval} disabled={disabled} onApproval={onApproval}/>}<RecipeOperationPreview row={row} changeSet={preview.changeSet} approval={preview.approval} plan={preview.plan} findings={preview.plan.findings.filter(f=>f.operationId===row.operationId)} view="components" snapshot={snapshot} disabled={disabled} onApproval={onApproval} onSelectOperation={onSelectOperation}/></>:<><ReviewPromptText label={'Complete proposed text '+row.operationId} text={row.proposedPrompt}/><p className="muted-text">See Exact data for the full candidate, project or storyboard operation. Decisions for the selected item are in the approval panel.</p></>;
  if(tab==='frames')return <>{frames.length>0&&<><label className="pr-frame-picker">Stable frame<select className="select" aria-label="Selected planned frame" value={frameId} onChange={event=>setSelectedFrame(event.target.value)}>{frames.map(frame=><option key={frame.id} value={frame.id}>{frame.label} · {frame.id}</option>)}</select></label><div className="pr-mode-buttons" aria-label="Image prompt format">{(['full','compact'] as const).map(mode=><button type="button" key={mode} className="btn btn-secondary btn-sm" aria-pressed={imageMode===mode} onClick={()=>setImageMode(mode)}>{mode==='full'?'Complete':'Concise'}</button>)}</div></>}<KeyframeProposalReview preview={preview} snapshot={snapshot} operationId={row.operationId} section="frames" frameId={frameId} imageMode={imageMode} showApprovals={false} disabled={disabled} onApproval={onApproval}/>{!data&&<p className="muted-text">No prepared keyframe plan is available for this item. Review its findings and exact operation; no still prompt is invented.</p>}</>;
  if(tab==='blocking')return <>{preview.changeSet.schema==='krakinai.change-set.v6'?<KeyframeProposalReview preview={preview} snapshot={snapshot} operationId={row.operationId} section="blocking" showApprovals={false} disabled={disabled} onApproval={onApproval}/>:preview.changeSet.schema==='krakinai.change-set.v5'?<BlockingProposalReview preview={preview} snapshot={snapshot} operationId={row.operationId} section="blocking" disabled={disabled} onApproval={onApproval}/>:<p className="muted-text">This item has no structured Blocking operation. See the original instructions in Recipe or Exact data.</p>}</>;
  return <>{modes}{preview.changeSet.schema==='krakinai.change-set.v6'&&data?<KeyframeProposalReview preview={preview} snapshot={snapshot} operationId={row.operationId} section="video" videoMode={videoMode} showApprovals={false} disabled={disabled} onApproval={onApproval}/>:preview.changeSet.schema==='krakinai.change-set.v5'?<BlockingProposalReview preview={preview} snapshot={snapshot} operationId={row.operationId} section="video" videoMode={videoMode} disabled={disabled} onApproval={onApproval}/>:isRecipeOperation(row)?<RecipeOperationPreview row={row} changeSet={preview.changeSet} approval={preview.approval} plan={preview.plan} findings={preview.plan.findings.filter(f=>f.operationId===row.operationId)} view="outputs" snapshot={snapshot} disabled={disabled} onApproval={onApproval} onSelectOperation={onSelectOperation}/>:<><ReviewPromptText label={'Complete existing prompt '+row.operationId} text={row.currentPrompt}/><ReviewPromptText label={'Complete proposed prompt '+row.operationId} text={row.proposedPrompt}/></>}</>;
}
