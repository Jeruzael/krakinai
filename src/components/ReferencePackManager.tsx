import {
  captureMediaNames,
  getMediaDisplayName,
  getDownloadFilename,
} from '../domain/mediaNaming';
import React, { useState } from 'react';
import type {
  MediaAsset,
  ReferencePack,
  ReferencePackEntry,
  SavedScene,
  SceneDraft,
} from '../types/domain';
import {
  buildReferencePackZip,
  collectReferenceCandidates,
  formatReferencePackChecklist,
} from '../domain/referencePack';
import { downloadBlobAsFile } from '../hooks/useObjectUrl';
import { StudioDialog } from './StudioDialog';
import { MediaPreviewDialog } from './MediaPreviewDialog';
import { MediaThumbnail } from './MediaThumbnail';
import { getActiveReferencePack, getSourceReferenceEntries } from '../domain/shotTypeRules';
import './referencePack.css';
const referenceGroups = [
  ['source', 'Original Source Media'],
  ['character', 'Character Identity'],
  ['wardrobe', 'Outfit'],
  ['environment', 'Environment'],
  ['action', 'Action'],
  ['camera', 'Camera'],
  ['lighting', 'Lighting'],
  ['style', 'Style'],
  ['result', 'External Results'],
  ['legacy', 'Legacy references'],
] as const;

export interface ReferencePackManagerProps {
  source: SceneDraft | SavedScene;
  mediaMap: ReadonlyMap<string, MediaAsset>;
  onClose: () => void;
  onApply: (pack: ReferencePack) => void | Promise<void>;
  readOnly?: boolean;
  onEditCopy?: () => void;
  onCopyText?: (text: string) => void | Promise<void>;
}
export const ReferencePackManager: React.FC<ReferencePackManagerProps> = ({
  source,
  mediaMap,
  onClose,
  onApply,
  readOnly = false,
  onEditCopy,
  onCopyText,
}) => {
  const [selected, setSelected] = useState<ReferencePackEntry[]>(
    () =>
      getActiveReferencePack(source)?.entries
        .map((entry) => ({ ...entry }))
        .sort((a, b) => a.order - b.order) ?? getSourceReferenceEntries(source)
  );
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ReferencePackEntry | null>(null);
  const candidates = readOnly
    ? collectReferenceCandidates(source, mediaMap)
    : captureMediaNames(collectReferenceCandidates(source, mediaMap), mediaMap);
  const all = [
    ...selected,
    ...candidates.filter(
      (entry) =>
        !selected.some((item) => item.associationId === entry.associationId)
    ),
  ];
  const pack = (): ReferencePack => ({
    version: 1,
    entries: selected.map((entry, order) => ({ ...entry, order })),
  });
  const run = async (action: () => void | Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Reference pack action failed.'
      );
    } finally {
      setBusy(false);
    }
  };
  const move = (id: string, delta: number) =>
    setSelected((entries) => {
      const copy = [...entries];
      const i = copy.findIndex((entry) => entry.associationId === id);
      [copy[i], copy[i + delta]] = [copy[i + delta], copy[i]];
      return copy;
    });
  const suggest = () => {
    const chosen: ReferencePackEntry[] = candidates.filter(entry => entry.sourceSlot === 'source').map(entry => ({...entry}));
    for (const slot of ['character', 'wardrobe', 'environment']) {
      const entry = candidates.find(
        (item) =>
          item.sourceSlot === slot &&
          item.role === 'reference' &&
          mediaMap.has(item.mediaId) &&
          !mediaMap.get(item.mediaId)?.isBundledIllustration &&
          !/demo illustration|demo card/i.test(item.altText)
      );
      if (entry) chosen.push({ ...entry });
    }
    setSelected(chosen);
    setStatus('Suggestion selected locally. Apply Reference Pack to confirm.');
  };
  if (preview && mediaMap.get(preview.mediaId))
    return (
      <MediaPreviewDialog
        media={mediaMap.get(preview.mediaId)!}
        title={preview.sourceTitle}
        altText={preview.altText}
        onClose={() => setPreview(null)}
      />
    );
  return (
    <>
      <StudioDialog
        className="reference-pack-dialog"
        size="wide"
        title="Reference Pack Manager"
        onClose={onClose}
        footer={
          <>
            {readOnly ? (
              onEditCopy && (
                <button className="btn btn-primary" onClick={onEditCopy}>
                  Edit a Copy
                </button>
              )
            ) : (
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await onApply(pack());
                    onClose();
                  })
                }
              >
                Apply Reference Pack
              </button>
            )}
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </>
        }
      >
        <p>
          {readOnly
            ? 'Historical reference selection is read-only. Edit a Copy to change it.'
            : 'Choose associations, purpose, and attachment order. Changes remain local until you apply the pack.'}
        </p>
        {all.some(entry => entry.sourceSlot === 'source') && <p className="muted-text">Original source media is required input and stays included in this pack. Copying a checklist does not attach files to an external tool.</p>}
        <p role="status">
          {selected.length} selected{status ? ` · ${status}` : ''}
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="button-row">
          {!readOnly && (
            <button className="btn" onClick={suggest}>
              Apply Suggested Pack
            </button>
          )}
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const text = formatReferencePackChecklist(pack());
                await (onCopyText
                  ? onCopyText(text)
                  : navigator.clipboard.writeText(text));
                setStatus('Attachment checklist copied.');
              })
            }
          >
            Copy Attachment Checklist
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const bytes = await buildReferencePackZip(pack(), mediaMap);
                downloadBlobAsFile(
                  new Blob([bytes as BlobPart], { type: 'application/zip' }),
                  'reference-pack.zip'
                );
                setStatus('Reference ZIP downloaded.');
              })
            }
          >
            Download Reference ZIP
          </button>
        </div>
        {!all.length && <p>No linked reference associations.</p>}
        <div className="reference-pack-groups">
          {referenceGroups.map(
            ([slot, heading]) =>
              all.some((entry) => entry.sourceSlot === slot) && (
                <section key={slot} aria-label={heading}>
                  <h3>{heading}</h3>
                  <ul className="reference-pack-grid">
                    {all
                      .filter((entry) => entry.sourceSlot === slot)
                      .map((entry) => {
                        const index = selected.findIndex(
                          (item) => item.associationId === entry.associationId
                        );
                        const media = mediaMap.get(entry.mediaId);
                        const filename = getMediaDisplayName(
                          media,
                          entry,
                          true
                        );
                        const participant = source.ensemble?.participants.find(
                          (person) => person.id === entry.participantId
                        );
                        const participantLabel = entry.participantId
                          ? `Participant ${entry.participantId}${participant ? ` (${participant.character.sourceTitle})` : ''}: `
                          : '';
                        const label = `${participantLabel}${entry.sourceTitle}: ${filename} (${entry.role})`;
                        return (
                          <li
                            key={entry.associationId}
                            className="reference-pack-card"
                            data-selected={index >= 0}
                          >
                            <div className="reference-pack-media">
                              {media?.blob ? (
                                <button
                                  type="button"
                                  className="reference-pack-preview"
                                  aria-label={`Preview ${label}`}
                                  onClick={() => setPreview(entry)}
                                >
                                  <MediaThumbnail
                                    media={media}
                                    altText={entry.altText || entry.sourceTitle}
                                    enableHoverPreview={false}
                                  />
                                </button>
                              ) : (
                                <span className="muted-text">
                                  Missing preview
                                </span>
                              )}
                            </div>
                            <div className="reference-pack-details">
                              <label
                                className="reference-pack-selection"
                                title={label}
                              >
                                <input
                                  type="checkbox"
                                  aria-label={
                                    entry.altText
                                      ? `${label} — ${entry.altText}`
                                      : label
                                  }
                                  checked={index >= 0}
                                  disabled={readOnly || busy || entry.sourceSlot === 'source'}
                                  onChange={() =>
                                    setSelected((items) =>
                                      index >= 0
                                        ? items.filter(
                                            (item) =>
                                              item.associationId !==
                                              entry.associationId
                                          )
                                        : [...items, { ...entry }]
                                    )
                                  }
                                />{' '}
                                <span>{filename}</span>
                              </label>
                              <strong
                                className="reference-pack-source"
                                title={entry.sourceTitle}
                              >
                                {entry.sourceTitle}
                              </strong>
                              {entry.participantId && (
                                <p className="muted-text">
                                  Captured participant association: <code>{entry.participantId}</code>
                                  {participant
                                    ? ` · Current participant: ${participant.character.sourceTitle}`
                                    : ' · Participant is no longer in this ensemble'}
                                </p>
                              )}
                              <span
                                className={`badge ${index >= 0 ? 'badge-primary' : ''}`}
                              >
                                {index >= 0
                                  ? `Selected · Attachment ${index + 1}`
                                  : 'Not selected'}
                              </span>
                              <p className="muted-text">
                                {entry.sourceSlot} · {entry.role} ·{' '}
                                {entry.mimeType?.startsWith('video/')
                                  ? 'Video'
                                  : entry.mimeType?.startsWith('image/')
                                    ? 'Image'
                                    : 'Media'}
                                {media?.isBundledIllustration ||
                                /demo illustration|demo card/i.test(
                                  entry.altText
                                )
                                  ? ' · Demo illustration'
                                  : ''}
                                {!media?.blob ? ' · Missing original file' : ''}
                              </p>
                              {index >= 0 && (
                                <div className="button-row">
                                  <label>
                                    Purpose{' '}
                                    <select
                                      aria-label={`Purpose ${label}`}
                                      value={entry.purpose}
                                      disabled={readOnly || busy}
                                      onChange={(event) => {
                                        const purpose = event.target
                                          .value as ReferencePackEntry['purpose'];
                                        setSelected((items) =>
                                          items.map((item) =>
                                            item.associationId ===
                                            entry.associationId
                                              ? { ...item, purpose }
                                              : item
                                          )
                                        );
                                      }}
                                    >
                                      {[
                                        'identity',
                                        'outfit',
                                        'environment',
                                        'motion',
                                        'general',
                                      ].map((purpose) => (
                                        <option key={purpose}>{purpose}</option>
                                      ))}
                                    </select>
                                  </label>
                                  {!readOnly && (
                                    <>
                                      <button
                                        className="btn"
                                        aria-label={`Move up ${label}`}
                                        disabled={index === 0}
                                        onClick={() =>
                                          move(entry.associationId, -1)
                                        }
                                      >
                                        Move up
                                      </button>
                                      <button
                                        className="btn"
                                        aria-label={`Move down ${label}`}
                                        disabled={index === selected.length - 1}
                                        onClick={() =>
                                          move(entry.associationId, 1)
                                        }
                                      >
                                        Move down
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                              {media?.blob && (
                                <div className="button-row">
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    aria-label={`Preview ${label}`}
                                    title={filename}
                                    onClick={() => setPreview(entry)}
                                  >
                                    Preview
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    aria-label={`Download original ${filename}`}
                                    title={filename}
                                    onClick={() =>
                                      downloadBlobAsFile(
                                        media.blob,
                                        getDownloadFilename(media, entry, true)
                                      )
                                    }
                                  >
                                    Download
                                  </button>
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </section>
              )
          )}
        </div>
      </StudioDialog>
    </>
  );
};
