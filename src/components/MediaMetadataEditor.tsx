import React, { useEffect, useRef, useState } from 'react';
import type { MediaAsset } from '../types/domain';
import { updateMediaNames } from '../storage/mediaMetadata';
import './mediaMetadata.css';
export const MediaMetadataEditor: React.FC<{
  media: MediaAsset;
  onSaved?: (media: MediaAsset) => void | Promise<void>;
}> = ({ media, onSaved }) => {
  const [displayName, setDisplayName] = useState(
    media.displayName ?? media.filename
  );
  const [exportFilename, setExportFilename] = useState(
    media.exportFilename ?? ''
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const saving = useRef(false);
  useEffect(() => {
    setDisplayName(media.displayName ?? media.filename);
    setExportFilename(media.exportFilename ?? '');
  }, [media.id, media.displayName, media.exportFilename, media.filename]);
  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const saved = await updateMediaNames({
        mediaId: media.id,
        displayName,
        exportFilename,
      });
      await onSaved?.(saved);
      setStatus('Media names saved.');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not save media names.'
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <details className="media-metadata-details">
      <summary>
        <span>Rename / Details</span>
        <span
          className="muted-text"
          title={media.displayName ?? media.filename}
        >
          {media.displayName ?? media.filename}
        </span>
      </summary>
      <fieldset disabled={busy}>
        <legend>Media names</legend>
        <label>
          Original Filename
          <input
            className="input"
            readOnly
            value={media.filename}
            title={media.filename}
          />
        </label>
        <label>
          Display Name
          <input
            className="input"
            value={displayName}
            maxLength={200}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label>
          Export Filename (optional)
          <input
            className="input"
            value={exportFilename}
            maxLength={200}
            placeholder="Leave empty to use original filename"
            onChange={(event) => setExportFilename(event.target.value)}
          />
        </label>
        <p className="muted-text">
          Names affect display and downloads. The original file and its identity
          stay unchanged. Accessibility descriptions belong to each attachment
          separately.
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void save()}
        >
          {busy ? 'Saving names…' : 'Save Media Names'}
        </button>
        {error && <p role="alert">{error}</p>}
        {status && <p role="status">{status}</p>}
      </fieldset>
    </details>
  );
};
