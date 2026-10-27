import React, { useEffect, useId, useRef, useState } from 'react';
import type { PromptAsset } from '../types/domain';
import {
  getIdentityAnchorStatus,
  getIdentityRevision,
} from '../domain/identityAnchors';
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
  const [error, setError] = useState('');
  const saving = useRef(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    setStored(character);
  }, [character]);
  useEffect(() => {
    setText(character.identityAnchor?.text ?? '');
    setMessage('');
  }, [character.id]);
  const status =
    text !== (stored.identityAnchor?.text ?? '')
      ? 'draft'
      : getIdentityAnchorStatus(stored);
  const statusLabel =
    status === 'approved' ? 'Approved' : status === 'stale' ? 'Stale' : 'Draft';
  const save = async (approve: boolean) => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const result = approve
        ? await approveIdentityAnchor(
            character.id,
            text,
            getIdentityRevision(stored)
          )
        : await saveIdentityAnchorDraft(
            character.id,
            text,
            getIdentityRevision(stored)
          );
      setStored(result);
      await onSaved();
      setMessage(
        approve
          ? 'Anchor explicitly approved for this master revision.'
          : 'Draft anchor saved. Approval is a separate action.'
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not save anchor.'
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <details className="studio-disclosure identity-anchor-panel">
      <summary>
        <span>Identity Anchor</span>{' '}
        <span
          className={`badge ${status === 'approved' ? 'badge-success' : 'badge-warning'}`}
        >
          {statusLabel}
        </span>
      </summary>
      <dl className="identity-explanation">
        <dt>Master Identity</dt>
        <dd>Complete authoritative character description.</dd>
        <dt>Identity Anchor</dt>
        <dd>Optional shorter, user-approved description for generation.</dd>
      </dl>
      <p className="muted-text">
        Record revision {stored.revision} · Master Identity revision{' '}
        {getIdentityRevision(stored)}
      </p>
      <p className="muted-text identity-counter-help">
        Record Revision counts saved record edits, including anchor changes.
        Master Identity Revision tracks changes to the authoritative identity.
        The counters can differ.
      </p>
      <label htmlFor={id} className="form-label">
        Identity Anchor text
      </label>
      <textarea
        id={id}
        className="textarea"
        rows={5}
        value={text}
        disabled={busy}
        maxLength={12000}
        aria-describedby={`${id}-approval`}
        onChange={(event) => setText(event.target.value)}
      />
      <p className="muted-text" id={`${id}-approval`} role="status">
        {stored.identityAnchor?.approvedAt
          ? `Last approval: ${stored.identityAnchor.approvedAt} · Approved source: master revision ${stored.identityAnchor.approvedMasterIdentityRevision}.`
          : 'No approval recorded. Write or paste your own anchor; it is never generated automatically.'}
        {status === 'stale'
          ? ' The master has changed. Review the text and explicitly approve again before using this anchor.'
          : status !== 'approved'
            ? ' Draft text is not an active generation identity.'
            : ' This anchor is approved for the current master.'}
      </p>
      <div className="studio-inline">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy}
          onClick={() => void save(false)}
        >
          Save Draft Anchor
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || !text.trim()}
          onClick={() => void save(true)}
        >
          Approve Anchor
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!text}
          onClick={() => void onCopy(text)}
        >
          Copy Anchor
        </button>
      </div>
      {message && (
        <p role="status" className="muted-text">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <details
        className="studio-disclosure"
        onToggle={(event) => setCompareOpen(event.currentTarget.open)}
      >
        <summary>Compare with Master</summary>
        {compareOpen && (
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {stored.promptText}
          </p>
        )}
      </details>
    </details>
  );
};
