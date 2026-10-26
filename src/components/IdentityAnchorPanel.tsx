import React, { useEffect, useId, useState } from 'react';
import type { PromptAsset } from '../types/domain';
import { getIdentityAnchorStatus, getIdentityRevision } from '../domain/identityAnchors';
import { approveIdentityAnchor, saveIdentityAnchorDraft } from '../storage/db';
import './generationIdentity.css';

export const IdentityAnchorPanel: React.FC<{
  character: PromptAsset;
  onSaved: () => unknown | Promise<unknown>;
  onCopy: (text: string) => unknown | Promise<unknown>;
}> = ({ character, onSaved, onCopy }) => {
  const [stored, setStored] = useState(character);
  const [text, setText] = useState(character.identityAnchor?.text ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [compareOpen, setCompareOpen] = useState(false);
  const id = useId();
  useEffect(() => { setStored(character); }, [character]);
  useEffect(() => { setText(character.identityAnchor?.text ?? ''); setMessage(''); }, [character.id]);
  const status = text !== stored.identityAnchor?.text ? 'draft' : getIdentityAnchorStatus(stored);
  const save = async (approve: boolean) => {
    setBusy(true); setMessage('');
    try {
      const result = approve
        ? await approveIdentityAnchor(character.id, text, getIdentityRevision(stored))
        : await saveIdentityAnchorDraft(character.id, text, getIdentityRevision(stored));
      setStored(result);
      await onSaved();
      setMessage(approve ? 'Anchor explicitly approved for this master revision.' : 'Draft anchor saved. Approval is a separate action.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save anchor.'); }
    finally { setBusy(false); }
  };
  return <details className="studio-disclosure identity-anchor-panel">
    <summary>Identity Anchor <span className="badge">{status}</span></summary>
    <p className="muted-text">Master Identity revision {getIdentityRevision(stored)}. Write or paste a concise identity; approval never changes the full master.</p>
    <label htmlFor={id} className="form-label">Identity Anchor text</label>
    <textarea id={id} className="textarea" rows={5} value={text} onChange={event => setText(event.target.value)} />
    <p className="muted-text" role="status">Approval status: {status}{stored.identityAnchor?.approvedAt ? ` · Last approved ${stored.identityAnchor.approvedAt}, master revision ${stored.identityAnchor.approvedMasterIdentityRevision}` : ''}</p>
    <div className="studio-inline">
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void save(false)}>Save Draft Anchor</button>
      <button type="button" className="btn btn-primary btn-sm" disabled={busy || !text.trim()} onClick={() => void save(true)}>Approve Anchor</button>
      <button type="button" className="btn btn-secondary btn-sm" disabled={!text} onClick={() => void onCopy(text)}>Copy Anchor</button>
    </div>
    {message && <p role="status" className="muted-text">{message}</p>}
    <details className="studio-disclosure" onToggle={event => setCompareOpen(event.currentTarget.open)}><summary>Compare with Master</summary>{compareOpen && <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{stored.promptText}</p>}</details>
  </details>;
};
