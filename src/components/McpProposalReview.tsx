import React from 'react';
import { useAiConnection } from '../connections/AiConnectionContext';
import { useLibrary } from '../context/LibraryContext';
import { ImportReceipt } from './ImportReceipt';
import {stageRecipePackage}from'../domain/recipePackageHandoff';
import {ProposalReviewWorkspace} from './aiConnections/ProposalReviewWorkspace';
import {ProposalRejectionDialog} from './aiConnections/ProposalRejectionDialog';
import {downloadBlobAsFile} from '../hooks/useObjectUrl';
export function McpProposalReview({ proposalId, onClose }: { proposalId: string; onClose(): void }) {
  const { broker, view } = useAiConnection(), { snapshot,navigate } = useLibrary();
  const proposal = view.proposals.find(p => p.id === proposalId);
  const [error, setError] = React.useState('');
  const [rejecting,setRejecting]=React.useState(false);
  if (!proposal || !snapshot) return <p role="status">This proposal is no longer in the current queue.</p>;
  const preview = proposal.preview, busy = ['received', 'approved', 'applying'].includes(proposal.status), terminal = ['rejected', 'expired', 'disconnected', 'applied'].includes(proposal.status);
  const bound=view.connected&&proposal.sessionId===view.sessionId&&proposal.scopeEpoch===view.scope.epoch;
  const run=(operation:()=>Promise<unknown>)=>{setError('');void operation().catch(cause=>{const current=broker.getState().proposals.find(p=>p.id===proposalId),message=cause&&typeof cause==='object'&&'message'in cause&&typeof cause.message==='string'?cause.message:'The review could not be updated.';setError(current?.error?.includes(message)?current.error:message);});};
  const download=()=>{const pkg=preview?.changeSet??proposal.draft?.changeSet;if(pkg)downloadBlobAsFile(new Blob([JSON.stringify(pkg,null,2)+'\n'],{type:'application/json'}),`krakinai-recipe-${pkg.changeSetId.replace(/[^a-zA-Z0-9._-]/g,'_')}.json`);};
  return <section className="ai-proposal-review" aria-label="Incoming change review">
    {error&&<p className="banner banner-warning" role="alert">{error}</p>}
    {!busy&&!terminal&&preview?.changeSet.operations.some(o=>o.type==='scene.convert_direct_to_recipe')&&<div className="banner banner-info"><p>Editing makes a new local package and rejects this proposal. Its existing consent cannot be reused; the new package gets its own receipt after review.</p><button className="btn btn-secondary" onClick={()=>run(async()=>{await broker.reject(proposal.id);stageRecipePackage(preview.changeSet);navigate('/recipes/ai');})}>Edit mapping as new package</button></div>}
    {proposal.status==='applied'&&proposal.receipt?<>{proposal.error&&!error&&<p className="banner banner-warning" role="alert">{proposal.error}</p>}<ImportReceipt receipt={proposal.receipt} replay={!!preview?.replay} onNew={onClose} newLabel="Review another proposal"/><div className="pr-committed-actions"><button type="button" className="btn btn-secondary" onClick={download}>Download recipe package (JSON)</button><button type="button" className="btn btn-secondary" onClick={event=>run(async()=>{await broker.removeDraft(proposal.id,event.nativeEvent);onClose();})}>Remove local review draft</button><p className="muted-text">These actions affect only the local review package. Saved records and the confirmed import receipt are preserved.</p></div></>:<>{preview?.replay&&<p className="banner banner-info">This exact package already committed. Confirming shares its historical receipt; it does not create the records again.</p>}<ProposalReviewWorkspace proposal={error?{...proposal,error:undefined}:proposal} snapshot={snapshot} connected={view.connected} bound={bound} reviewed={broker.isReviewed(proposal.id)} onApproval={approval=>run(()=>broker.review(proposal.id,approval))} onConfirmReview={(checked,event)=>{try{broker.confirmReview(proposal.id,checked,event);setError('');}catch(cause){setError(cause instanceof Error?cause.message:'Review must be confirmed here.');}}} onApply={event=>run(()=>broker.applyFromUserEvent(proposal.id,event))} onRevalidate={(event,options)=>run(()=>broker.resumeDraft(proposal.id,event,options))} onRemove={event=>run(async()=>{await broker.removeDraft(proposal.id,event);onClose();})} onProgress={value=>broker.saveProgress(proposal.id,value)} onReject={()=>setRejecting(true)} onBack={onClose}/></>}
    {rejecting&&<ProposalRejectionDialog title={preview?.changeSet.title??proposal.draft?.changeSet.title??proposal.changeSetId} canShare={bound&&!proposal.needsRevalidation} onClose={()=>setRejecting(false)} onReject={async(text,share,event)=>{await broker.rejectWithFeedback(proposal.id,text,share,event);setRejecting(false);}}/>}
  </section>;
}
