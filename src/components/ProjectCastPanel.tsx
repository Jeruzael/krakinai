import React, { useState } from 'react';
import type { CharacterBibleEntry, Collection } from '../types/domain';
import { useLibrary } from '../context/LibraryContext';
import { getProjectCast } from '../domain/projectContinuity';
import { getIdentityAnchorStatus } from '../domain/identityAnchors';
import { getMediaDisplayName } from '../domain/mediaNaming';
import { upsertProjectCast, removeProjectCast } from '../storage/projectContinuity';
import { MediaThumbnail } from './MediaThumbnail';
import { StudioDialog } from './StudioDialog';
import './projectCast.css';

type Props = { collection: Collection; onChanged: () => Promise<unknown> };
type Dialog = { kind: 'edit' | 'remove'; characterId: string; expectedRevision: number } | null;
const fields: { key: keyof CharacterBibleEntry; label: string; multiline?: boolean }[] = [
  { key: 'name', label: 'Project name' }, { key: 'storyRole', label: 'Story role' },
  { key: 'voiceNotes', label: 'Voice notes', multiline: true }, { key: 'personality', label: 'Personality', multiline: true },
  { key: 'distinctiveFeatures', label: 'Distinctive features', multiline: true }, { key: 'accessories', label: 'Accessories', multiline: true },
  { key: 'relationships', label: 'Relationships', multiline: true }, { key: 'notes', label: 'Notes', multiline: true },
];

export const ProjectCastPanel: React.FC<Props> = ({ collection, onChanged }) => {
  const { snapshot, navigate, showToast } = useLibrary();
  const [pickerId, setPickerId] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [draft, setDraft] = useState<CharacterBibleEntry>({ characterId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scenes = snapshot?.scenes ?? [];
  const assets = snapshot?.assets ?? [];
  const variants = snapshot?.variants ?? [];
  const media = snapshot?.media ?? [];
  const cast = getProjectCast(collection, scenes, assets);
  const selected = cast.find(row => row.characterId === dialog?.characterId);
  const available = assets.filter(asset => asset.category === 'characters' && !cast.some(row => row.characterId === asset.id));
  const open = (kind: 'edit' | 'remove', characterId: string) => {
    const entry = collection.project?.cast?.find(item => item.characterId === characterId);
    setDraft(entry ? structuredClone(entry) : { characterId });
    setError('');
    setDialog({ kind, characterId, expectedRevision: collection.project?.revision ?? 0 });
  };
  const run = async (action: () => Promise<Collection>, message: string) => {
    if (busy) return false;
    setBusy(true); setError('');
    try { await action(); await onChanged(); setDialog(null); showToast(message, 'success'); return true; }
    catch (cause) { const text = cause instanceof Error ? cause.message : String(cause); setError(text); showToast(text, 'error'); return false; }
    finally { setBusy(false); }
  };
  const add = async () => {
    if (!pickerId || busy) return;
    const added = await run(() => upsertProjectCast({ collectionId: collection.id, entry: { characterId: pickerId }, expectedRevision: collection.project?.revision ?? 0 }), 'Character added to project cast.');
    if (added) setPickerId('');
  };
  const toggleId = (key: 'approvedWardrobeVariantIds' | 'referenceMediaIds', id: string) => {
    setDraft(current => {
      const values = current[key] ?? [];
      return { ...current, [key]: values.includes(id) ? values.filter(value => value !== id) : [...values, id] };
    });
  };
  return <section className="project-cast" aria-label="Project Cast">
    <div className="project-cast-heading"><div><h3>Characters</h3><p className="muted-text">Project Bible notes are manual. Master identities and approved anchors remain read only here.</p></div><span className="badge">{cast.length} cast</span></div>
    <div className="project-cast-add"><label htmlFor={`cast-picker-${collection.id}`}>Add existing character</label><select id={`cast-picker-${collection.id}`} value={pickerId} onChange={event => setPickerId(event.target.value)}><option value="">Choose a character</option>{available.map(asset => <option key={asset.id} value={asset.id}>{asset.title}</option>)}</select><button type="button" className="btn btn-secondary btn-sm" disabled={!pickerId || busy} onClick={() => void add()}>Add to cast</button></div>
    {error && !dialog && <p role="alert">{error}</p>}
    {cast.length === 0 && <p className="muted-text">No characters linked yet. Add a library character or select a shot containing one.</p>}
    <div className="project-cast-grid">{cast.map(row => {
      const asset = row.asset;
      const cover = media.find(item => item.id === asset?.coverMediaId) ?? media.find(item => asset?.mediaLinks.some(link => link.mediaId === item.id));
      const title = row.name || asset?.title || `Missing character (${row.characterId})`;
      return <article className="project-cast-card" key={row.characterId}>
        <div className="project-cast-visual"><MediaThumbnail media={cover} altText={title} emptyLabel={asset ? 'No character image' : 'Character record unavailable'} /></div>
        <div className="project-cast-content"><div className="project-cast-title"><h4>{title}</h4><span className="badge">{row.derived ? 'Derived from selected shot' : 'Manually added'}</span></div>
          <p className="muted-text">{row.storyRole || (asset ? 'No project role entered' : `Missing original asset: ${row.characterId}`)}</p>
          {asset && <a href={`#/prompts/${encodeURIComponent(asset.id)}`} onClick={event => { event.preventDefault(); navigate(`/prompts/${encodeURIComponent(asset.id)}`); }}>Open original character</a>}
          <details><summary>Identity and Bible details</summary>
            {asset ? <><p><strong>Master identity · read only</strong></p><p className="project-cast-long">{asset.promptText}</p><p>Anchor status: {getIdentityAnchorStatus(asset)}</p>{asset.identityAnchor?.approvedText && <><p><strong>Approved anchor · read only</strong></p><p className="project-cast-long">{asset.identityAnchor.approvedText}</p></>}</> : <p>Original character record is unavailable. This project reference remains visible.</p>}
            {fields.filter(field => row[field.key]).map(field => <p key={field.key}><strong>{field.label}:</strong> <span className="project-cast-long">{String(row[field.key])}</span></p>)}
            {row.approvedWardrobeVariantIds?.map(id => <p key={id}>Wardrobe: {variants.find(item => item.id === id)?.title ?? `Missing variant (${id})`}</p>)}
            {row.referenceMediaIds?.map(id => <p key={id}>Reference: {media.find(item => item.id === id) ? getMediaDisplayName(media.find(item => item.id === id)) : `Missing image (${id})`}</p>)}
          </details>
          <div className="project-cast-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={() => open('edit', row.characterId)} disabled={!asset}>Edit Bible for {title}</button>{!row.derived && <button type="button" className="btn btn-secondary btn-sm" onClick={() => open('remove', row.characterId)}>Remove Bible for {title}</button>}</div>
        </div>
      </article>;
    })}</div>
    {dialog && selected && <StudioDialog title={dialog.kind === 'edit' ? `Character Bible: ${selected.asset?.title ?? selected.name ?? selected.characterId}` : `Remove Bible for ${selected.asset?.title ?? selected.name ?? selected.characterId}?`} onClose={() => { if (!busy) setDialog(null); }} className="project-cast-dialog" footer={<><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</button>{dialog.kind === 'edit' ? <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(() => upsertProjectCast({ collectionId: collection.id, entry: draft, expectedRevision: dialog.expectedRevision }), 'Character Bible saved.')}>Save Bible</button> : <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void run(() => removeProjectCast({ collectionId: collection.id, characterId: dialog.characterId }), 'Project Bible removed.')}>Confirm remove Bible</button>}</>}>
      {dialog.kind === 'remove' ? <p>This removes project Bible metadata only. The original character and saved scenes remain. If a selected shot uses this character, it may still appear as derived cast.</p> : <div className="project-cast-form">
        <p className="muted-text">Enter only details you have chosen for this project. The original identity and approved anchor stay read only.</p>
        {fields.map(field => <label key={field.key}>{field.label}{field.multiline ? <textarea value={String(draft[field.key] ?? '')} onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))} /> : <input value={String(draft[field.key] ?? '')} onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))} />}</label>)}
        <fieldset><legend>Approved wardrobe variants</legend>{variants.filter(item => item.parentCharacterId === dialog.characterId && item.type === 'Outfit' && item.targetSlot === 'wardrobe').map(item => <label key={item.id}><input type="checkbox" checked={draft.approvedWardrobeVariantIds?.includes(item.id) ?? false} onChange={() => toggleId('approvedWardrobeVariantIds', item.id)} />{item.title}</label>)}{draft.approvedWardrobeVariantIds?.filter(id => !variants.some(item => item.id === id && item.parentCharacterId === dialog.characterId && item.type === 'Outfit' && item.targetSlot === 'wardrobe')).map(id => <label key={id}><input type="checkbox" checked onChange={() => toggleId('approvedWardrobeVariantIds', id)} />Unavailable wardrobe variant ({id}) — uncheck to remove</label>)}<p className="muted-text">Select existing approved wardrobe choices for this character. Unavailable saved choices are kept until you remove them.</p></fieldset>
        <fieldset><legend>Reference images</legend>{media.filter(item => item.mimeType.startsWith('image/')).map(item => <label key={item.id}><input type="checkbox" checked={draft.referenceMediaIds?.includes(item.id) ?? false} onChange={() => toggleId('referenceMediaIds', item.id)} />{getMediaDisplayName(item)}</label>)}</fieldset>
      </div>}
      {error && <p role="alert">{error}</p>}
    </StudioDialog>}
  </section>;
};
