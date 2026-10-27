import React, { useRef, useState } from 'react';
import type { Collection, MediaAsset, ProjectShot, ProjectTransition, WardrobeIntentReason } from '../types/domain';
import { useLibrary } from '../context/LibraryContext';
import { getProjectShots, selectedSceneForShot } from '../domain/projectStoryboard';
import { getWardrobeContinuity } from '../domain/projectContinuity';
import { validateMediaCandidate } from '../domain/validation';
import { getMediaDisplayName } from '../domain/mediaNaming';
import { removeProjectTransition, updateProjectFrames, updateWardrobeIntent, uploadProjectFrame, upsertProjectTransition } from '../storage/projectContinuity';
import { MediaPreviewDialog } from './MediaPreviewDialog';
import { MediaThumbnail } from './MediaThumbnail';
import { StudioDialog } from './StudioDialog';
import './projectContinuity.css';

type Props = { collection: Collection; onChanged: () => Promise<unknown> };
type FrameSide = 'firstFrameMediaId' | 'lastFrameMediaId';
type Editor =
  | { kind: 'wardrobe'; shot: ProjectShot; reason: WardrobeIntentReason | ''; notes: string }
  | { kind: 'frame'; shot: ProjectShot; side: FrameSide }
  | { kind: 'transition'; from: ProjectShot; to: ProjectShot; revision: number; draft: ProjectTransition }
  | { kind: 'remove'; transition: ProjectTransition };
const reasons: { value: WardrobeIntentReason; label: string }[] = [
  { value: 'new_day', label: 'New day' }, { value: 'costume_change', label: 'Costume change' },
  { value: 'flashback', label: 'Flashback' }, { value: 'timeline', label: 'Timeline' },
  { value: 'deliberate', label: 'Deliberate' }, { value: 'other', label: 'Other' },
];
const transitionTypes: ProjectTransition['type'][] = ['straight_cut', 'match_cut', 'dissolve', 'j_cut', 'l_cut', 'bridge_shot', 'custom'];
const title = (shot: ProjectShot) => `${shot.code} ${shot.title}`;

export const ProjectContinuityPanel: React.FC<Props> = ({ collection, onChanged }) => {
  const { snapshot } = useLibrary();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [preview, setPreview] = useState<{ media: MediaAsset; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const scenes = snapshot?.scenes ?? [];
  const media = snapshot?.media ?? [];
  const images = media.filter(item => item.mimeType.startsWith('image/'));
  const mediaMap = new Map(media.map(item => [item.id, item]));
  const shots = getProjectShots(collection, scenes);
  const shotMap = new Map(shots.map(shot => [shot.id, shot]));
  const wardrobe = getWardrobeContinuity(collection, scenes);
  const transitions = collection.project?.transitions ?? [];
  const adjacentPairs = shots.slice(0, -1).map((from, index) => ({ from, to: shots[index + 1] }));
  const adjacentKeys = new Set(adjacentPairs.map(({ from, to }) => `${from.id}\u0000${to.id}`));
  const detached = transitions.filter(item => !adjacentKeys.has(`${item.fromShotId}\u0000${item.toShotId}`));

  const run = async (action: () => Promise<unknown>, close = true) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await action(); await onChanged(); if (close) setEditor(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const openTransition = (from: ProjectShot, to: ProjectShot) => {
    const existing = transitions.find(item => item.fromShotId === from.id && item.toShotId === to.id);
    setEditor({ kind: 'transition', from, to, revision: collection.project?.revision ?? 0,
      draft: existing ? { ...existing } : { id: '', fromShotId: from.id, toShotId: to.id, type: 'straight_cut', description: '', notes: '' } });
    setError('');
  };
  const saveFrame = (shot: ProjectShot, side: FrameSide, mediaId: string | null) =>
    run(() => updateProjectFrames({ collectionId: collection.id, shotId: shot.id, [side]: mediaId }));
  const uploadFrame = async (shot: ProjectShot, side: FrameSide, file: File) => {
    const check = validateMediaCandidate({ name: file.name, type: file.type, size: file.size, existingCount: 0,
      currentTotalBytes: media.reduce((total, item) => total + item.byteSize + (item.posterBlob?.size ?? 0), 0) });
    if (!check.valid || check.kind !== 'image') { setError(check.error ?? 'Choose a supported image.'); return; }
    await run(() => uploadProjectFrame({ collectionId: collection.id, shotId: shot.id, side, file }));
  };
  const frame = (shot: ProjectShot, side: FrameSide) => {
    const id = shot[side];
    const item = id ? mediaMap.get(id) : undefined;
    const label = side === 'firstFrameMediaId' ? 'First frame' : 'Last frame';
    return <div className="pc-frame" key={`${shot.id}-${side}`}>
      <strong>{label}</strong>
      {item ? <button type="button" className="pc-frame-preview" onClick={() => setPreview({ media: item, title: `${title(shot)} — ${label}` })} aria-label={`Enlarge ${label.toLowerCase()} for ${title(shot)}`}>
        <MediaThumbnail media={item} altText={`${label} for ${title(shot)}`} />
      </button> : <span className="pc-missing" role="status">{id ? `Missing image (${id})` : 'No frame assigned'}</span>}
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setEditor({ kind: 'frame', shot, side }); setError(''); }}>Choose image</button>
      {id && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void saveFrame(shot, side, null)}>Clear</button>}
    </div>;
  };
  const comparisonFrame = (shot: ProjectShot, side: FrameSide) => {
    const id = shot[side];
    const item = id ? mediaMap.get(id) : undefined;
    const label = `${title(shot)} ${side === 'firstFrameMediaId' ? 'first' : 'last'} frame`;
    return <div className="pc-comparison-frame"><strong>{label}</strong>
      {item ? <button type="button" className="pc-frame-preview" aria-label={`Enlarge ${label}`} onClick={() => setPreview({ media: item, title: label })}><MediaThumbnail media={item} altText={label} /></button>
        : <span className="pc-missing">{id ? `Missing image (${id})` : 'No frame assigned'}</span>}
    </div>;
  };
  const transitionLabel = (item: ProjectTransition) => `${shotMap.get(item.fromShotId) ? title(shotMap.get(item.fromShotId)!) : `Missing shot (${item.fromShotId})`} → ${shotMap.get(item.toShotId) ? title(shotMap.get(item.toShotId)!) : `Missing shot (${item.toShotId})`}`;

  return <div className="pc-panel">
    <h2>Wardrobe continuity</h2>
    <p className="muted-text">Saved take clothing is shown for review. Changes are advisory; outfits stay as saved.</p>
    {wardrobe.length === 0 ? <p>No selected character takes yet.</p> : <div className="pc-list">{wardrobe.map(row => {
      const shot = shotMap.get(row.shotId);
      if (!shot) return null;
      return <article className="pc-row" key={`${row.shotId}-${row.characterId}`}>
        <div className="pc-wardrobe-heading"><strong>{row.characterName}</strong><span>{title(shot)}</span></div>
        <div className="pc-source">{row.wardrobeSourceId ? <>Wardrobe source: {selectedSceneForShot(shot,scenes)?.slots.wardrobe?.sourceTitle || row.wardrobeSourceId}</> : <span className="pc-missing">Wardrobe unknown</span>}</div>
        <div>{!row.wardrobeSourceId ? 'Change unknown' : row.changed ? <span className="pc-warning">Clothing changed from previous appearance</span> : 'No detected change'}{row.intentionalReason && <> · Intentional: {reasons.find(reason => reason.value === row.intentionalReason)?.label}</>}</div>
        <details className="pc-wardrobe-details"><summary>Details</summary>{row.wardrobeSourceId && <><p className="pc-source">Source ID: {row.wardrobeSourceId}</p><p className="pc-prewrap">{row.wardrobeDescription || 'Description unavailable'}</p></>}{shot.continuityNotes && <p className="pc-prewrap">{shot.continuityNotes}</p>}</details>
        <button type="button" className="btn btn-secondary" onClick={() => { setEditor({ kind: 'wardrobe', shot, reason: shot.intentionalWardrobeChange ?? '', notes: shot.continuityNotes ?? '' }); setError(''); }}>Review wardrobe</button>
      </article>;
    })}</div>}
    <h2>Frame comparisons</h2>
    <p className="muted-text">First and last frames are manually selected images. Open a thumbnail to inspect the original.</p>
    {shots.length === 0 ? <p>No shots yet.</p> : <div className="pc-list">{shots.map((shot, index) => <article className="pc-row" key={shot.id}>
      <h3>{title(shot)}</h3><div className="pc-frame-pair">{frame(shot, 'firstFrameMediaId')}{frame(shot, 'lastFrameMediaId')}</div>
      {index < shots.length - 1 && <p className="pc-comparison">Compare last frame of {title(shot)} with first frame of {title(shots[index + 1])}.</p>}
    </article>)}</div>}
    <h2>Transitions</h2>
    {adjacentPairs.length === 0 ? <p>Add a second shot to review transitions.</p> : <div className="pc-list">{adjacentPairs.map(({ from, to }) => {
      const current = transitions.find(item => item.fromShotId === from.id && item.toShotId === to.id);
      return <article className="pc-row" key={`${from.id}-${to.id}`}><div><strong>{title(from)} → {title(to)}</strong></div>
        <div className="pc-frame-pair" aria-label={`Frame comparison ${title(from)} to ${title(to)}`}>{comparisonFrame(from, 'lastFrameMediaId')}{comparisonFrame(to, 'firstFrameMediaId')}</div>
        {current ? <><p className="pc-transition-meta">{current.type.replaceAll('_', ' ')}{current.durationSeconds !== undefined ? ` · ${current.durationSeconds} s` : ''}</p><details className="pc-wardrobe-details"><summary>Transition details</summary><p className="pc-prewrap">{current.description}</p><p className="pc-prewrap">{current.notes}</p></details></> : <p>No transition metadata.</p>}
        <div className="pc-row-actions"><button type="button" className="btn btn-secondary" onClick={() => openTransition(from, to)}>{current ? 'Edit transition' : 'Add transition'}</button>
        {current && <button type="button" className="btn btn-secondary" onClick={() => { setEditor({ kind: 'remove', transition: current }); setError(''); }}>Remove transition</button>}</div>
      </article>;
    })}</div>}
    {detached.length > 0 && <section className="pc-detached"><h3>Transitions to review after reorder</h3>{detached.map(item => <article className="pc-row" key={item.id}>
      <strong>{transitionLabel(item)}</strong><p className="pc-transition-meta">{item.type.replaceAll('_', ' ')}</p><details className="pc-wardrobe-details"><summary>Transition details</summary><p className="pc-prewrap">{item.description}</p><p className="pc-prewrap">{item.notes}</p></details>
      <button type="button" className="btn btn-secondary" onClick={() => { setEditor({ kind: 'remove', transition: item }); setError(''); }}>Remove transition</button>
    </article>)}</section>}
    {!editor && error && <p role="alert">{error}</p>}
    {editor?.kind === 'wardrobe' && !preview && <StudioDialog title={`Wardrobe review — ${title(editor.shot)}`} onClose={() => { if (!busy) setEditor(null); }} footer={<><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setEditor(null)}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy} onClick={() => {
      const reason = editor.reason === (editor.shot.intentionalWardrobeChange ?? '') ? undefined : (editor.reason || null);
      const notes = editor.notes === (editor.shot.continuityNotes ?? '') ? undefined : editor.notes;
      void run(() => updateWardrobeIntent({ collectionId: collection.id, shotId: editor.shot.id, reason, notes }));
    }}>Save review</button></>}>
      <div className="pc-form"><label className="pc-form-field">Intentional change reason<select disabled={busy} value={editor.reason} onChange={event => setEditor({ ...editor, reason: event.target.value as WardrobeIntentReason | '' })}><option value="">No reason set</option>{reasons.map(reason => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label>
      <label className="pc-form-field">Continuity notes<textarea disabled={busy} value={editor.notes} onChange={event => setEditor({ ...editor, notes: event.target.value })} rows={5} /></label></div>
      {error && <p role="alert">{error}</p>}
    </StudioDialog>}
    {editor?.kind === 'frame' && !preview && <StudioDialog title={`${editor.side === 'firstFrameMediaId' ? 'First' : 'Last'} frame — ${title(editor.shot)}`} onClose={() => { if (!busy) setEditor(null); }}>
      <div className="pc-form"><label className="pc-form-field">Upload image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadFrame(editor.shot, editor.side, file); }} /></label></div>
      {error && <p role="alert">{error}</p>}
      {editor.shot[editor.side] && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void saveFrame(editor.shot, editor.side, null)}>Clear association</button>}
      <div className="pc-image-picker">{images.map(item => <button type="button" className="pc-image-choice" key={item.id} aria-label={`Use ${getMediaDisplayName(item)} as ${editor.side === 'firstFrameMediaId' ? 'first' : 'last'} frame`} disabled={busy} onClick={() => void saveFrame(editor.shot, editor.side, item.id)}>
        <span className="pc-image-choice-thumb"><MediaThumbnail media={item} altText={getMediaDisplayName(item)} /></span><span>{getMediaDisplayName(item)}</span>
      </button>)}</div>
    </StudioDialog>}
    {editor?.kind === 'transition' && !preview && <StudioDialog title={`Transition — ${title(editor.from)} → ${title(editor.to)}`} onClose={() => { if (!busy) setEditor(null); }} footer={<><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setEditor(null)}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(() => upsertProjectTransition({ collectionId: collection.id, expectedRevision: editor.revision, transition: { ...editor.draft, id: editor.draft.id || undefined } }))}>Save transition</button></>}>
      <div className="pc-frame-pair">{comparisonFrame(editor.from, 'lastFrameMediaId')}{comparisonFrame(editor.to, 'firstFrameMediaId')}</div>
      <div className="pc-form"><label className="pc-form-field">Type<select disabled={busy} value={editor.draft.type} onChange={event => setEditor({ ...editor, draft: { ...editor.draft, type: event.target.value as ProjectTransition['type'] } })}>{transitionTypes.map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label>
      <label className="pc-form-field">Duration in seconds (optional)<input disabled={busy} type="number" min="0" max="86400" step="any" value={editor.draft.durationSeconds ?? ''} onChange={event => { const { durationSeconds: _, ...rest } = editor.draft; setEditor({ ...editor, draft: event.target.value === '' ? rest as ProjectTransition : { ...editor.draft, durationSeconds: Number(event.target.value) } }); }} /></label>
      <label className="pc-form-field">Description<textarea disabled={busy} value={editor.draft.description} onChange={event => setEditor({ ...editor, draft: { ...editor.draft, description: event.target.value } })} rows={3} /></label>
      <label className="pc-form-field">Notes<textarea disabled={busy} value={editor.draft.notes} onChange={event => setEditor({ ...editor, draft: { ...editor.draft, notes: event.target.value } })} rows={3} /></label></div>
      {error && <p role="alert">{error}</p>}
    </StudioDialog>}
    {editor?.kind === 'remove' && !preview && <StudioDialog title="Remove transition?" onClose={() => { if (!busy) setEditor(null); }} footer={<><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setEditor(null)}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(() => removeProjectTransition({ collectionId: collection.id, transitionId: editor.transition.id }))}>Remove transition</button></>}>
      <p>Remove metadata for {transitionLabel(editor.transition)}?</p>{error && <p role="alert">{error}</p>}
    </StudioDialog>}
    {preview && <MediaPreviewDialog media={preview.media} title={preview.title} onClose={() => setPreview(null)} />}
  </div>;
};
