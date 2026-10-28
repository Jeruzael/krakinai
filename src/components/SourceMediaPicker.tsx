import React, { useRef, useState } from 'react';
import type { MediaAsset, MediaLink } from '../types/domain';
import { ALLOWED_IMAGE_MIMES, ALLOWED_VIDEO_MIMES, validateMediaCandidate } from '../domain/validation';
import { validateShotSourceMedia } from '../domain/shotTypeRules';
import { saveMediaAsset } from '../storage/db';
import { MediaThumbnail } from './MediaThumbnail';
import { MediaPreviewDialog } from './MediaPreviewDialog';
import './sourceMediaPicker.css';

export const SourceMediaPicker: React.FC<{
  kind: 'image' | 'video';
  links: MediaLink[];
  mediaMap: ReadonlyMap<string, MediaAsset>;
  onChange: (links: MediaLink[]) => Promise<void>;
  onUploaded: () => Promise<void>;
  onError?: (message: string) => void;
}> = ({ kind, links, mediaMap, onChange, onUploaded, onError }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<MediaAsset>();
  const previewButton = useRef<HTMLButtonElement>(null);
  const allowed = kind === 'image' ? ALLOWED_IMAGE_MIMES : ALLOWED_VIDEO_MIMES;
  const candidates = [...mediaMap.values()].filter(media => allowed.has(media.mimeType));
  const sourceErrors = validateShotSourceMedia({ shotType: kind === 'image' ? 'graphic_motion' : 'existing_footage', sourceMediaLinks: links, sceneInstructions: 'Source selection' }, mediaMap);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'Could not save source media.'; setError(message); onError?.(message); }
    finally { setBusy(false); }
  };
  const replace = async (media: MediaAsset) => {
    await onChange([{ mediaId: media.id, role: 'reference', order: 0, filename: media.filename, mimeType: media.mimeType, altText: `Original source ${kind}` }, ...links.slice(1)]);
  };
  return <section className="source-media-picker" aria-labelledby="source-media-heading" data-preflight="source" tabIndex={-1}>
    <h3 id="source-media-heading">Source Media <span className="badge badge-warning">Original {kind} required</span></h3>
    <p className="muted-text">Use the original file as input. Copying a prompt does not upload or attach it to your external AI tool; attach the original there separately.</p>
    <div className="source-media-controls">
      <div className="form-group"><label htmlFor="builder-source-upload" className="form-label">{links.length ? 'Replace original source' : 'Upload original source'} {kind}</label><input id="builder-source-upload" className="input" type="file" accept={[...allowed].join(',')} disabled={busy} onChange={event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (!file) return;
        void run(async () => {
          const check = validateMediaCandidate({ name: file.name, type: file.type, size: file.size, existingCount: 0 });
          if (!check.valid) throw new Error(check.error || 'Invalid source file.');
          if (!allowed.has(file.type)) throw new Error(`Choose an original source ${kind} with a supported MIME type.`);
          const media = await saveMediaAsset({ filename: file.name, mimeType: file.type, blob: file });
          await onUploaded();
          await replace(media);
        });
      }} /></div>
      <div className="form-group"><label htmlFor="builder-source-existing" className="form-label">Existing source media</label><select id="builder-source-existing" className="select" value={links[0] && candidates.some(media => media.id === links[0].mediaId) ? links[0].mediaId : ''} disabled={busy} onChange={event => {
        const media = mediaMap.get(event.currentTarget.value); if (media) void run(() => replace(media));
      }}><option value="">Select an existing {kind}…</option>{candidates.map(media => <option key={media.id} value={media.id}>{media.filename}</option>)}</select><span className="muted-text">Reuses the stored original without duplicating its file.</span></div>
    </div>
    {links.map((link, index) => {
      const media = mediaMap.get(link.mediaId);
      const suffix = links.length > 1 ? ` ${index + 1}` : '';
      return <article className="source-media-original" key={`${link.mediaId}-${index}`}>
        <div className="source-media-thumbnail"><MediaThumbnail media={media} altText={link.altText || 'Original source'} showVideoControls /></div>
        <div className="source-media-caption"><strong>{media?.filename || link.filename || `Missing source (${link.mediaId})`}</strong><span className="muted-text">{media ? `${media.mimeType} · ${media.byteSize.toLocaleString()} bytes · Original input` : 'Original source file missing from storage'}</span><div className="studio-inline"><button ref={index === 0 ? previewButton : undefined} type="button" className="btn btn-secondary btn-sm" disabled={!media?.blob || busy} aria-label={`Preview original source${suffix}`} onClick={() => setPreview(media)}>Preview original</button><button type="button" className="btn btn-secondary btn-sm" disabled={busy} aria-label={`Remove source media${suffix}`} onClick={() => void run(() => onChange(links.filter((_, position) => position !== index)))}>Remove source</button></div></div>
      </article>;
    })}
    {(error || sourceErrors.length > 0) && <div className="source-media-errors" role="alert">{error && <p>{error}</p>}{sourceErrors.map(message => <p key={message}>{message}</p>)}</div>}
    {busy && <p role="status">Saving original source…</p>}
    {preview && <MediaPreviewDialog media={preview} title={preview.filename} onClose={() => { setPreview(undefined); requestAnimationFrame(() => previewButton.current?.focus()); }} />}
  </section>;
};
