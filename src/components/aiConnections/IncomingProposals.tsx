import React, { useEffect, useRef, useState } from 'react';
import type { McpProposalView } from '../../types/mcp';
import { McpProposalReview } from '../McpProposalReview';
import {useAiConnection} from '../../connections/AiConnectionContext';
import {downloadBlobAsFile} from '../../hooks/useObjectUrl';

export function IncomingProposals({ selected, proposals, onSelect }: { selected?: string; proposals: readonly McpProposalView[]; onSelect(id?: string): void }) {
  const {view,broker}=useAiConnection(),[error,setError]=useState('');
  const panel = useRef<HTMLDivElement>(null), previous = useRef<string>();
  useEffect(() => {
    const old = previous.current; previous.current = selected;
    const target = selected ? panel.current?.querySelector<HTMLElement>('h2[tabindex]') : old ? [...(panel.current?.querySelectorAll<HTMLButtonElement>('button[data-proposal-id]') ?? [])].find(button => button.dataset.proposalId === old) ?? panel.current?.querySelector<HTMLElement>('.ai-queue-heading') : undefined;
    if (target) { target.scrollIntoView?.({ block: 'nearest' }); target.focus({ preventScroll: true }); }
  }, [selected]);
  return <div ref={panel}>{selected ? proposals.some(p => p.id === selected) ? <McpProposalReview key={selected} proposalId={selected} onClose={() => onSelect(undefined)}/> : <section className="card ai-connect-card"><h2 tabIndex={-1}>Proposal unavailable</h2><p role="status">This proposal is no longer in the current queue. Saved records and confirmed receipts are preserved.</p><button className="btn btn-secondary" onClick={() => onSelect(undefined)}>Back to proposals</button></section> : <section className="card ai-connect-card"><div className="ai-section-heading"><div><h2 className="ai-queue-heading" tabIndex={-1}>Incoming proposals</h2><p className="muted-text">Review exact prompts, project and shot targets, conflicts and asset candidates here.</p></div></div>
    <p role="status" aria-live="polite">{proposals.length ? proposals.length + ' local review package(s). Saved drafts survive closing this browser.' : 'No incoming proposals. Your library changes only after your review.'}</p>
    <p className="muted-text">Review drafts are separate from library records and are not included in library backups. Download a package if you need a portable copy. Pair and revalidate before saving; earlier permissions and approval are never restored.</p>
    {view.inboxError&&<p role="alert" className="banner banner-warning">Local review drafts could not be loaded: {view.inboxError}. Existing drafts are not deleted. Resolve storage access before submitting more packages.</p>}
    {error&&<p role="alert" className="banner banner-warning">{error}</p>}
    {view.invalidDrafts?.map(draft=><article className="banner banner-warning" key={draft.id}><strong>Unavailable saved review · {draft.id}</strong><p>{draft.error}</p><button type="button" className="btn btn-secondary btn-sm" onClick={()=>{void broker.exportInvalidDraft(draft.id).then(raw=>downloadBlobAsFile(new Blob([raw],{type:'application/json'}),'krakinai-unavailable-review.json')).catch(cause=>setError(cause instanceof Error?cause.message:'Cannot export this record.'));}}>Download quarantined review record</button><button type="button" className="btn btn-secondary btn-sm" onClick={event=>{void broker.removeInvalidDraft(draft.id,event.nativeEvent).catch(cause=>setError(cause instanceof Error?cause.message:'Cannot remove this record.'));}}>Remove unavailable local review</button></article>)}
    {proposals.map(p => <article className="ai-proposal-row" key={p.id}><div><strong>{p.preview?.changeSet.title ?? p.draft?.changeSet.title ?? p.changeSetId}</strong><small>{p.status.replaceAll('_', ' ')} · {p.preview?.changeSet.operations.length ?? p.draft?.changeSet.operations.length ?? 0} operations</small>{p.preview?<small>{p.preview.plan.summary.projects} project(s) · {p.preview.plan.summary.shots} shot(s) · {p.preview.plan.summary.scenes} scene(s)</small>:<small>Saved original package · resolved preview required</small>}<small>{p.persisted?'Saved locally':'Not saved for later'} · Review window ends {new Date(p.expiresAt).toLocaleString()}</small>{p.error && <p className="muted-text">{p.error}</p>}</div><button data-proposal-id={p.id} className="btn btn-secondary btn-sm" onClick={() => onSelect(p.id)}>Review proposal</button></article>)}
    <p className="muted-text">Proposal arrival never changes your current view or keyboard focus. Every save requires separate browser approval.</p>
  </section>}</div>;
}
