import React from 'react';
import { useAiConnection } from '../connections/AiConnectionContext';
import { useLibrary } from '../context/LibraryContext';
import { ChangeSetPreview } from './ChangeSetPreview';
import { ImportReceipt } from './ImportReceipt';
export function McpProposalReview({ proposalId, onClose }: { proposalId: string; onClose(): void }) {
  const { broker, view } = useAiConnection(), { snapshot } = useLibrary();
  const proposal = view.proposals.find(p => p.id === proposalId);
  const [error, setError] = React.useState('');
  if (!proposal || !snapshot) return <p role="status">This proposal is no longer in the current queue.</p>;
  const preview = proposal.preview, busy = ['received', 'approved', 'applying'].includes(proposal.status), terminal = ['rejected', 'expired', 'disconnected', 'applied'].includes(proposal.status);
  return <section className="ai-proposal-review" aria-label="Incoming change review">
    <div className="import-heading"><div><h2 tabIndex={-1}>Review incoming changes</h2><p>Client: Local MCP · session {proposal.sessionId.slice(0, 8)}</p></div><button className="btn btn-secondary btn-sm" onClick={onClose}>Back to proposals</button></div>
    <p className="muted-text ai-break">{proposal.changeSetId} · {proposal.packageDigest.slice(0, 12)} · <strong>{proposal.status.replaceAll('_', ' ')}</strong></p>
    {(proposal.error || error) && <p className="banner banner-warning" role="alert">{proposal.error || error}</p>}
    {proposal.status === 'applied' && proposal.receipt ? <ImportReceipt receipt={proposal.receipt} replay={!!preview?.replay} onNew={onClose} newLabel="Review another proposal"/> : preview ? <>
      {preview.replay && <p className="banner banner-info">This exact package already committed. Confirming shares its historical receipt; it does not create the records again.</p>}
      <ChangeSetPreview preview={preview} snapshot={snapshot} disabled={busy || terminal} onApproval={approval => { setError(''); void broker.review(proposal.id, approval).catch(() => setError('Preview could not be updated.')); }}/>
      {!terminal && <div className="card ai-approval">
        <p>Review the exact prompts, target IDs, candidates and unresolved media above. Confirmed result IDs will be sent to this local MCP connection.</p>
        <label className="import-check"><input type="checkbox" aria-label="I reviewed this exact proposal" checked={broker.isReviewed(proposal.id)} disabled={busy || proposal.status !== 'review_required'} onChange={event => { try { broker.confirmReview(proposal.id, event.target.checked, event.nativeEvent); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Review must be confirmed here.'); } }}/><span>I reviewed this exact proposal</span></label>
        <div className="import-buttons"><button className="btn btn-secondary" disabled={busy} onClick={() => broker.reject(proposal.id)}>Reject proposal</button><button className="btn btn-primary" disabled={busy || proposal.status !== 'review_required' || !broker.isReviewed(proposal.id) || preview.plan.findings.some(f => f.severity === 'blocking')} onClick={event => { setError(''); void broker.applyFromUserEvent(proposal.id, event.nativeEvent).catch(e => setError(e instanceof Error ? e.message : 'Nothing was applied. Review again.')); }}>{preview.replay ? 'Share confirmed receipt' : 'Apply reviewed batch'}</button></div>
        {proposal.status === 'conflict' && <button className="btn btn-secondary" onClick={() => void broker.review(proposal.id)}>Preview again</button>}
        <p role="status" aria-live="polite">{busy ? 'Validating or applying the reviewed batch…' : 'Automatic application: Never'}</p>
      </div>}
    </> : <p>No preview is available.</p>}
  </section>;
}
