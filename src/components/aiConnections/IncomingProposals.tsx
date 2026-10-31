import React, { useEffect, useRef } from 'react';
import type { McpProposalView } from '../../types/mcp';
import { McpProposalReview } from '../McpProposalReview';

export function IncomingProposals({ selected, proposals, onSelect }: { selected?: string; proposals: readonly McpProposalView[]; onSelect(id?: string): void }) {
  const panel = useRef<HTMLDivElement>(null), previous = useRef<string>();
  useEffect(() => {
    const old = previous.current; previous.current = selected;
    const target = selected ? panel.current?.querySelector<HTMLElement>('h2[tabindex]') : old ? [...(panel.current?.querySelectorAll<HTMLButtonElement>('button[data-proposal-id]') ?? [])].find(button => button.dataset.proposalId === old) ?? panel.current?.querySelector<HTMLElement>('.ai-queue-heading') : undefined;
    if (target) { target.scrollIntoView?.({ block: 'nearest' }); target.focus({ preventScroll: true }); }
  }, [selected]);
  return <div ref={panel}>{selected ? proposals.some(p => p.id === selected) ? <McpProposalReview key={selected} proposalId={selected} onClose={() => onSelect(undefined)}/> : <section className="card ai-connect-card"><h2 tabIndex={-1}>Proposal unavailable</h2><p role="status">This proposal is no longer in the current queue. Saved records and confirmed receipts are preserved.</p><button className="btn btn-secondary" onClick={() => onSelect(undefined)}>Back to proposals</button></section> : <section className="card ai-connect-card"><div className="ai-section-heading"><div><h2 className="ai-queue-heading" tabIndex={-1}>Incoming proposals</h2><p className="muted-text">Review exact prompts, project and shot targets, conflicts and asset candidates here.</p></div></div>
    <p role="status" aria-live="polite">{proposals.length ? proposals.length + ' proposal(s) in this browser session.' : 'No incoming proposals. Your library changes only after your review.'}</p>
    {proposals.map(p => <article className="ai-proposal-row" key={p.id}><div><strong>{p.preview?.changeSet.title ?? p.changeSetId}</strong><small>{p.status.replaceAll('_', ' ')} · {p.preview?.changeSet.operations.length ?? 0} operations</small><small>{p.preview?.plan.summary.projects ?? 0} project(s) · {p.preview?.plan.summary.shots ?? 0} shot(s) · {p.preview?.plan.summary.scenes ?? 0} scene(s)</small>{p.error && <p className="muted-text">{p.error}</p>}</div><button data-proposal-id={p.id} className="btn btn-secondary btn-sm" onClick={() => onSelect(p.id)}>Review proposal</button></article>)}
    <p className="muted-text">Proposal arrival never changes your current view or keyboard focus. Every save requires separate browser approval.</p>
  </section>}</div>;
}
