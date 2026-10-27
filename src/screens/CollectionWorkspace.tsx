import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import { StudioDialog } from '../components/StudioDialog';
import { CollectionCoverPicker } from '../components/CollectionCoverPicker';
import { CollectionMediaPreview } from '../components/CollectionMediaPreview';
import { ShotActions } from '../components/ShotActions';
import { ProjectTakeManager } from '../components/ProjectTakeManager';
import { ProjectCastPanel } from '../components/ProjectCastPanel';
import { ProjectScriptPanel } from '../components/ProjectScriptPanel';
import { ProjectContinuityPanel } from '../components/ProjectContinuityPanel';
import { ProjectBulkActions } from '../components/ProjectBulkActions';
import { ProjectExportDialog } from '../components/ProjectExportDialog';
import { collectionRoute, collectionSceneRoute, collectionViewState, getCollectionScroll, rememberCollectionScroll } from '../domain/collectionNavigation';
import { getProjectRuntime, getProjectShots, selectedSceneForShot } from '../domain/projectStoryboard';
import { startProjectShotDraft } from '../domain/projectRoutes';
import { getCollectionCoverMediaIds } from '../domain/collectionCoverMedia';
import { downloadBlobAsFile } from '../hooks/useObjectUrl';
import { getDownloadFilename, getMediaDisplayName } from '../domain/mediaNaming';
import { deleteCollection, updateCollection } from '../storage/db';
import { addProjectShot, removeProjectShot, reorderProjectShots, updateProjectShot } from '../storage/projects';
import type { Collection, MediaAsset, ProductionStatus, ProjectShot, SavedScene } from '../types/domain';
import './collectionWorkspace.css';

const statuses: ProductionStatus[] = ['planned', 'prompt_ready', 'generated', 'reviewed', 'final'];
const tabs = ['storyboard', 'characters', 'assets', 'results', 'details'] as const;
type WorkspaceTab = typeof tabs[number];
type Dialog = { kind: 'edit' | 'remove'; shotId: string } | { kind: 'takes'; shotId: string; returnToEdit?: boolean } | { kind: 'insert'; shotId: string; position: 'before' | 'after' } | { kind: 'add' | 'existing' | 'details' | 'cover' } | null;
const statusLabel = (status: ProductionStatus) => status.replace('_', ' ');
const durationLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const byOrder = (a: ProjectShot, b: ProjectShot) => a.order - b.order;

function chosenMedia(shot: ProjectShot, scene: SavedScene | undefined, media: MediaAsset[]) {
  const ids = [...(scene?.resultMediaLinks ?? []), ...(scene?.references ?? [])].map(link => link.mediaId);
  return ids.map(id => media.find(item => item.id === id)).find(Boolean);
}

export const CollectionWorkspace: React.FC<{ collectionId: string }> = ({ collectionId }) => {
  const { snapshot, hashPath, navigate, refreshSnapshot, showToast, openConfirmDialog, closeConfirmDialog } = useLibrary();
  const pathState = collectionViewState(hashPath);
  const hasExplicitTab = new URLSearchParams(hashPath.split('?')[1] ?? '').has('tab');
  const collection = snapshot?.collections.find(item => item.id === collectionId);
  const tab: WorkspaceTab = !hasExplicitTab
    ? collection?.members.some(member => member.type === 'scene') ? 'storyboard' : 'assets'
    : pathState.tab === 'scenes' ? 'storyboard'
    : pathState.tab === 'variants' ? 'assets'
    : tabs.includes(pathState.tab as WorkspaceTab) ? pathState.tab as WorkspaceTab : 'assets';
  const state = { ...pathState, tab };
  const [dialog, setDialog] = useState<Dialog>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ code: '', title: '', duration: '', status: 'planned' as ProductionStatus, continuityNotes: '' });
  const [editBaseline, setEditBaseline] = useState(edit);
  const [newTitle, setNewTitle] = useState('');
  const [existingSearch, setExistingSearch] = useState('');
  const [detailName, setDetailName] = useState('');
  const [detailDescription, setDetailDescription] = useState('');
  const [coverId, setCoverId] = useState<string | null | undefined>();
  const coverTriggerRef=useRef<HTMLButtonElement>(null),restoreCoverFocus=useRef(false);
  useEffect(()=>{if(!dialog)restoreCoverFocus.current=false;if(dialog?.kind==='details' && restoreCoverFocus.current){const frame=requestAnimationFrame(()=>{coverTriggerRef.current?.focus();restoreCoverFocus.current=false;});return()=>cancelAnimationFrame(frame);}},[dialog]);
  const [selectedShotIds, setSelectedShotIds] = useState<Set<string>>(new Set());
  const [showExport, setShowExport] = useState(false);
  useEffect(() => { setSelectedShotIds(new Set()); setShowExport(false); }, [collectionId]);

  useEffect(() => {
    if (!collection) return;
    const route = collectionRoute(collection.id, state);
    const frame = requestAnimationFrame(() => window.scrollTo(0, getCollectionScroll(route)));
    return () => cancelAnimationFrame(frame);
  // Scroll is restored for a new route or collection, not on each snapshot refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, hashPath]);

  const shots = useMemo(() => collection && snapshot ? [...getProjectShots(collection, snapshot.scenes)].sort(byOrder) : [], [collection, snapshot]);
  useEffect(() => { setSelectedShotIds(previous => { const ids=new Set(shots.map(shot=>shot.id)); const next=[...previous].filter(id=>ids.has(id)); return next.length===previous.size ? previous : new Set(next); }); }, [shots]);
  const sceneMap = useMemo(() => new Map((snapshot?.scenes ?? []).map(scene => [scene.id, scene])), [snapshot]);
  const shotForDialog = dialog && 'shotId' in dialog ? shots.find(shot => shot.id === dialog.shotId) : undefined;
  const runtime = collection && snapshot ? getProjectRuntime(collection, snapshot.scenes) : undefined;
  const resultVideoDuration = (shot: ProjectShot) => {
    const scene = selectedSceneForShot(shot, snapshot?.scenes ?? []);
    const video = scene?.resultMediaLinks.map(link => snapshot?.media.find(media => media.id === link.mediaId)).find(media => media?.mimeType.startsWith('video/') && media.durationSeconds !== undefined);
    return video?.durationSeconds;
  };
  const actualSeconds = shots.reduce((total, shot) => total + (resultVideoDuration(shot) ?? 0), 0);
  const knownActual = shots.filter(shot => resultVideoDuration(shot) !== undefined).length;
  const complete = shots.filter(shot => shot.status === 'final').length;

  if (!snapshot) return null;
  if (!collection) return <div className="card"><h1 className="section-title">Collection not found</h1><p>This collection is no longer available.</p><button className="btn btn-primary" onClick={() => navigate('/collections')}>Back to Collections</button></div>;

  const navigateState = (changes: Partial<typeof state>) => navigate(collectionRoute(collection.id, { ...state, ...changes }));
  const run = async (action: () => Promise<unknown>, message: string) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); await refreshSnapshot(); setDialog(null); showToast(message, 'success'); }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'Could not update project.'; setError(message); showToast(message, 'error'); await refreshSnapshot(); }
    finally { setBusy(false); }
  };
  const openScene = (shot: ProjectShot) => {
    const scene = selectedSceneForShot(shot, snapshot.scenes);
    if (!scene) return;
    const from = { ...state, shot: shot.id };
    rememberCollectionScroll(collectionRoute(collection.id, from), window.scrollY);
    navigate(collectionSceneRoute(scene.id, collection.id, from));
  };
  const move = (shotId: string, targetId: string) => {
    const from = shots.findIndex(shot => shot.id === shotId);
    const to = shots.findIndex(shot => shot.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const ordered = shots.map(shot => shot.id);
    ordered.splice(from, 1);
    ordered.splice(to, 0, shotId);
    void run(() => reorderProjectShots({ collectionId, orderedShotIds: ordered, expectedRevision: collection.project?.revision }), 'Shot order updated.');
  };
  const openEdit = (shot: ProjectShot) => {
    const fields = { code: shot.code, title: shot.title, duration: shot.plannedDurationSeconds?.toString() ?? '', status: shot.status, continuityNotes: shot.continuityNotes ?? '' };
    setEdit(fields);
    setEditBaseline(fields);
    setError(''); setDialog({ kind: 'edit', shotId: shot.id });
  };
  const editPatch = () => {
    const patch: { code?: string; title?: string; plannedDurationSeconds?: number | null; status?: ProductionStatus; continuityNotes?: string } = {};
    if (edit.code !== editBaseline.code) patch.code = edit.code;
    if (edit.title !== editBaseline.title) patch.title = edit.title;
    const duration = edit.duration.trim() === '' ? null : Number(edit.duration);
    if (edit.duration !== editBaseline.duration) patch.plannedDurationSeconds = duration;
    if (edit.status !== editBaseline.status) patch.status = edit.status;
    if (edit.continuityNotes !== editBaseline.continuityNotes) patch.continuityNotes = edit.continuityNotes;
    return patch;
  };
  const beginDraft = (shot: ProjectShot) => void run(async () => { const route = await startProjectShotDraft(collectionId, shot.id); navigate(route); }, 'New take draft opened.');
  const cover = snapshot.media.find(media => media.id === collection.coverMediaId) ?? shots.map(shot => chosenMedia(shot, selectedSceneForShot(shot, snapshot.scenes), snapshot.media)).find(Boolean);
  const filtered = shots.filter(shot => {
    const selected = selectedSceneForShot(shot, snapshot.scenes);
    return (!state.filter || state.filter === 'all' || state.filter === shot.status) &&
      (!query.trim() || `${shot.code} ${shot.title} ${selected?.title ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  });
  const displayed = [...filtered].sort(state.sort === 'title' || state.sort === 'title-asc' ? (a, b) => a.title.localeCompare(b.title) : state.sort === 'status' ? (a, b) => statuses.indexOf(a.status) - statuses.indexOf(b.status) : byOrder);
  const canMove = !query.trim() && (!state.filter || state.filter === 'all') && (state.sort === 'order' || state.sort === 'updated');
  const insertion = dialog?.kind === 'insert' ? (dialog.position === 'before' ? { beforeId: dialog.shotId } : { afterId: dialog.shotId }) : {};
  const insertionTitle = dialog?.kind === 'insert' ? `Insert ${dialog.position === 'before' ? 'Before' : 'After'} ${shotForDialog?.title ?? 'Shot'}` : '';

  return <div className="collection-workspace">
    <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/collections')}><ArrowLeft size={15} /> Back to Collections</button>
    <header className="cw-hero">
      <div className="cw-cover"><CollectionMediaPreview media={cover} title={`${collection.name} cover`} emptyLabel="Project cover" /></div>
      <div className="cw-hero-copy"><span className="cw-eyebrow">Production project</span><h1>{collection.name}</h1><p>{collection.description || 'No project description yet.'}</p>
        <div className="cw-metrics"><span><strong>{shots.length}</strong> shots</span><span><strong>{runtime ? durationLabel(runtime.plannedSeconds) : '0:00'}</strong> planned{runtime?.unknownShots ? ` · ${runtime.unknownShots} unknown` : ''}</span><span><strong>{durationLabel(actualSeconds)}</strong> result video runtime{shots.length > knownActual ? ` · ${shots.length - knownActual} unknown` : ''}</span><span><strong>{complete}/{shots.length}</strong> final</span></div>
        <div className="cw-actions"><button className="btn btn-primary" onClick={() => { setNewTitle(''); setDialog({ kind: 'add' }); }}><Plus size={16} /> Add Planned Shot</button><button className="btn btn-secondary" onClick={() => { setExistingSearch(''); setDialog({ kind: 'existing' }); }}>Add Existing Scene</button><button className="btn btn-secondary" onClick={() => { setDetailName(collection.name); setDetailDescription(collection.description); setCoverId(collection.coverMediaId); setDialog({ kind: 'details' }); }}>Edit Project</button></div>
      </div>
    </header>
    <div className="tabs-bar cw-tabs" role="tablist" aria-label="Project sections">{tabs.map(item => <button key={item} type="button" role="tab" aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} className={`tab-btn ${tab === item ? 'active' : ''}`} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const next = tabs[(tabs.indexOf(item) + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; navigateState({ tab: next }); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[role="tab"][data-tab="${next}"]`)?.focus()); } }} data-tab={item} onClick={() => navigateState({ tab: item })}>{item === 'details' ? 'Project Details' : item[0].toUpperCase() + item.slice(1)}</button>)}</div>
    {tab === 'storyboard' && <section role="tabpanel" aria-label="Storyboard">
      <ProjectBulkActions collection={collection} selectedShotIds={[...selectedShotIds]} onClear={() => setSelectedShotIds(new Set())} onChanged={refreshSnapshot} />
      <label className="cw-select-visible"><input type="checkbox" aria-label="Select all visible shots" checked={displayed.length>0 && displayed.every(shot=>selectedShotIds.has(shot.id))} onChange={event=>setSelectedShotIds(previous=>{ const next=new Set(previous); displayed.forEach(shot=>event.target.checked?next.add(shot.id):next.delete(shot.id)); return next; })} /> Select all visible shots</label>
      <div className="cw-toolbar"><label>Search shots<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Code or title" /></label><label>Status<select aria-label="Filter status" value={state.filter || 'all'} onChange={event => navigateState({ filter: event.target.value })}><option value="all">All ({shots.length})</option>{statuses.map(status => <option key={status} value={status}>{statusLabel(status)} ({shots.filter(shot => shot.status === status).length})</option>)}</select></label><label>Sort<select aria-label="Sort shots" value={state.sort === 'title' || state.sort === 'title-asc' ? 'title' : 'order'} onChange={event => navigateState({ sort: event.target.value })}><option value="order">Storyboard order</option><option value="title">Title</option></select></label><div className="cw-view-toggle"><button className="btn btn-secondary btn-sm" aria-pressed={state.view === 'grid'} onClick={() => navigateState({ view: 'grid' })}>Grid</button><button className="btn btn-secondary btn-sm" aria-pressed={state.view === 'list'} onClick={() => navigateState({ view: 'list' })}>List</button></div></div>
      {!canMove && <p className="muted-text">Clear search and status filter, then choose Storyboard order to move shots.</p>}
      {displayed.length === 0 ? <div className="card"><p>{shots.length ? 'No shots match these filters.' : 'No shots yet. Add a planned shot or an existing scene.'}</p></div> : <div className={`cw-shot-grid ${state.view === 'list' ? 'cw-list' : ''}`}>{displayed.map(shot => {
        const selected = selectedSceneForShot(shot, snapshot.scenes);
        const missingId = (shot.selectedSceneId && !selected ? shot.selectedSceneId : undefined) ?? shot.takeSceneIds.find(id => !sceneMap.has(id));
        const shotTitle = shot.title || `Shot ${shot.code}`;
        const media = chosenMedia(shot, selected, snapshot.media);
        const index = shots.findIndex(item => item.id === shot.id);
        const character = selected?.slots.character;
        return <article className="cw-shot-card" key={shot.id} onDragOver={event => { if (canMove && draggedId && event.dataTransfer.types.includes('application/x-krakinai-storyboard-shot')) event.preventDefault(); }} onDrop={event => { if(!canMove || !draggedId || !event.dataTransfer.types.includes('application/x-krakinai-storyboard-shot')) return; event.preventDefault(); move(draggedId, shot.id); setDraggedId(null); }}>
          <div className="cw-shot-topline"><label className="cw-shot-selection"><input type="checkbox" aria-label={`Select shot ${shotTitle}`} checked={selectedShotIds.has(shot.id)} onChange={event=>setSelectedShotIds(previous=>{const next=new Set(previous); if(event.target.checked)next.add(shot.id);else next.delete(shot.id);return next;})} /> Select shot</label><button type="button" className="icon-btn cw-drag-grip" draggable={canMove && !busy} disabled={!canMove || busy} aria-label={`Drag ${shotTitle} to reorder`} title="Drag to reorder; keyboard ordering is in More Actions" onDragStart={event=>{setDraggedId(shot.id);event.dataTransfer.setData('application/x-krakinai-storyboard-shot',shot.id);event.dataTransfer.effectAllowed='move';}} onDragEnd={()=>setDraggedId(null)}><GripVertical size={17} aria-hidden="true"/></button></div>
          <div className="cw-shot-content"><div className="cw-shot-image"><CollectionMediaPreview media={media} title={shotTitle} altText={`${shotTitle} preview`} emptyLabel={missingId ? 'Saved scene missing' : 'No image or video yet'} /></div>
            <div className="cw-shot-body"><div className="cw-shot-heading"><span className="cw-code">{shot.code}</span><h2>{shotTitle}</h2></div><p className="cw-shot-meta">{missingId ? `Saved scene missing (${missingId})` : selected ? `Selected take: ${selected.title}` : 'Planned shot · no saved take'}{character ? ` · ${character.sourceTitle}` : ''}</p><div className="cw-badges"><span className="badge">{(shot.plannedDurationSeconds ?? selected?.settings.durationSeconds) ? `${durationLabel(shot.plannedDurationSeconds ?? selected!.settings.durationSeconds!)} planned` : 'Duration unknown'}</span>{selected?.dialogue?.line && <span className="badge">Dialogue</span>}{selected?.reviewStatus === 'user-approved' && <span className="badge badge-success">Reviewed scene</span>}<span className="badge">{shot.takeSceneIds.length} take{shot.takeSceneIds.length === 1 ? '' : 's'}</span></div>
            <label className="cw-status-label">Status<select aria-label={`Status for ${shot.title}`} value={shot.status} disabled={busy} onChange={event => void run(() => updateProjectShot({ collectionId, shotId: shot.id, patch: { status: event.target.value as ProductionStatus } }), 'Shot status updated.')} >{statuses.map(status => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label>
            <div className="cw-card-actions"><button className="btn btn-primary btn-sm" disabled={!selected || busy} aria-label={`Open ${shot.title}`} onClick={() => openScene(shot)}>Open</button><button className="btn btn-secondary btn-sm" aria-label={`Manage takes for ${shot.title}`} disabled={busy} onClick={() => setDialog({ kind: 'takes', shotId: shot.id })}>Manage Takes</button></div>
            <ShotActions title={shotTitle}><button className="btn btn-secondary btn-sm" disabled={busy} aria-label={`Edit ${shot.title}`} onClick={() => openEdit(shot)}>Edit</button><button className="btn btn-secondary btn-sm" disabled={busy} aria-label={`${selected ? 'New take' : 'Create prompt'} for ${shot.title}`} onClick={() => beginDraft(shot)}>{selected ? 'New Take' : 'Create Prompt'}</button><button className="btn btn-secondary btn-sm" aria-label={`Move ${shot.title} up`} disabled={!canMove || index === 0 || busy} onClick={() => move(shot.id, shots[index - 1].id)}>Move Up</button><button className="btn btn-secondary btn-sm" aria-label={`Move ${shot.title} down`} disabled={!canMove || index === shots.length - 1 || busy} onClick={() => move(shot.id, shots[index + 1].id)}>Move Down</button><button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { setNewTitle(''); setDialog({ kind: 'insert', shotId: shot.id, position: 'before' }); }}>Insert Before</button><button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { setNewTitle(''); setDialog({ kind: 'insert', shotId: shot.id, position: 'after' }); }}>Insert After</button><button className="btn btn-danger btn-sm" disabled={busy} aria-label={`Remove ${shot.title}`} onClick={() => setDialog({ kind: 'remove', shotId: shot.id })}>Remove</button></ShotActions>
          </div></div>
        </article>;
      })}</div>}
      <details className="card cw-continuity-review"><summary>Continuity Review — wardrobe, frames and transitions</summary><ProjectContinuityPanel collection={collection} onChanged={refreshSnapshot} /></details>
    </section>}
    {tab === 'characters' && <section role="tabpanel" aria-label="Characters" className="cw-panel"><h2>Characters and Script</h2><ProjectCastPanel collection={collection} onChanged={refreshSnapshot} /><div className="cw-resource-grid">{shots.flatMap(shot => { const scene=selectedSceneForShot(shot,snapshot.scenes); const character=scene?.slots.character; return character && character.sourceType !== 'asset' ? [character] : []; }).filter((character,index,all) => all.findIndex(other => other.sourceType===character.sourceType && other.sourceId===character.sourceId)===index).map(character => <article className="card" key={`${character.sourceType}:${character.sourceId}`}><h3>{character.sourceTitle}</h3><p>Frozen {character.sourceType} character snapshot</p><details><summary>Read full saved identity</summary><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{character.promptText}</p></details></article>)}</div><ProjectScriptPanel collection={collection} onChanged={refreshSnapshot} /></section>}
    {tab === 'assets' && <section role="tabpanel" aria-label="Assets" className="cw-panel"><h2>Assets</h2><div className="cw-resource-grid">{collection.members.filter(member => member.type !== 'scene').map(member => { const item = member.type === 'variant' ? snapshot.variants.find(value => value.id === member.id) : snapshot.assets.find(value => value.id === member.id); return <article className="card" key={`${member.type}:${member.id}`}><span className="badge">{member.type === 'asset' ? 'Prompt' : 'Variant'}</span><h3>{item?.title ?? `Missing ${member.type} (${member.id})`}</h3><p>{item?.description || 'Open the original item to read its full text.'}</p>{item && <button className="btn btn-primary btn-sm" onClick={() => navigate(member.type === 'asset' ? `/prompts/${item.id}` : `/variants/${item.id}`)}>Open Original</button>}</article>; })}</div>{!collection.members.some(member => member.type !== 'scene') && <p>No prompt or variant members yet.</p>}</section>}
    {tab === 'results' && <section role="tabpanel" aria-label="Results" className="cw-panel"><h2>Results</h2><div className="cw-resource-grid">{shots.flatMap(shot => { const selected = selectedSceneForShot(shot, snapshot.scenes); return (selected?.resultMediaLinks ?? []).map(link => { const media = snapshot.media.find(item => item.id === link.mediaId); return <article className="card" key={`${shot.id}:${link.mediaId}:${link.order}`}><div className="cw-result-preview"><CollectionMediaPreview media={media} title={`${shot.code} · ${shot.title} result`} altText={link.altText || shot.title}/></div><h3>{shot.code} · {shot.title}</h3><p>{link.viewLabel || link.altText || (media && getMediaDisplayName(media, link, true)) || `Missing media (${link.mediaId})`}</p>{media && <button className="btn btn-secondary btn-sm" onClick={() => downloadBlobAsFile(media.blob, getDownloadFilename(media, link, true))}>Download</button>}</article>; }); })}</div>{!shots.some(shot => selectedSceneForShot(shot, snapshot.scenes)?.resultMediaLinks.length) && <p>No saved scene results yet.</p>}</section>}
    {tab === 'details' && <section role="tabpanel" aria-label="Project Details" className="cw-panel"><h2>Project Details</h2><dl><dt>Name</dt><dd>{collection.name}</dd><dt>Description</dt><dd>{collection.description || 'No description'}</dd><dt>Cover</dt><dd>{collection.coverMediaId ? (snapshot.media.find(media => media.id === collection.coverMediaId)?.filename ?? `Missing media (${collection.coverMediaId})`) : 'Automatic from first available scene media'}</dd></dl><div className="cw-actions"><button className="btn btn-primary" onClick={() => { setDetailName(collection.name); setDetailDescription(collection.description); setCoverId(collection.coverMediaId); setDialog({ kind: 'details' }); }}>Edit Project Details</button><button type="button" className="btn btn-danger" onClick={() => openConfirmDialog({ title: 'Delete Collection?', message: 'Delete this collection? Its prompts and scenes will be kept in your library.', confirmLabel: 'Delete Collection', danger: true, onConfirm: async () => { try { await deleteCollection(collection.id); await refreshSnapshot(); closeConfirmDialog(); showToast('Deleted collection.', 'info'); navigate('/collections'); } catch (cause) { showToast(cause instanceof Error ? cause.message : 'Could not delete collection.', 'error'); } } })}><Trash2 size={15} /> Delete Collection</button></div></section>}
    <div className="cw-project-actions"><button type="button" className="btn btn-primary" onClick={() => setShowExport(true)}>Export Project</button></div>
    {showExport && <ProjectExportDialog collection={collection} onClose={() => setShowExport(false)} />}
    {error && !dialog && <p role="alert">{error}</p>}
    {dialog?.kind === 'cover' && <CollectionCoverPicker media={snapshot.media} currentId={coverId} projectMediaIds={getCollectionCoverMediaIds(collection,snapshot)} coverMediaIds={snapshot.collections.flatMap(item=>item.coverMediaId?[item.coverMediaId]:[])} onSelect={setCoverId} onClose={() => {restoreCoverFocus.current=true;setDialog({ kind: 'details' });}} onUploaded={refreshSnapshot} />}
    {dialog?.kind === 'takes' && shotForDialog && <ProjectTakeManager collection={collection} shot={shotForDialog} onClose={() => setDialog(dialog.returnToEdit ? { kind: 'edit', shotId: shotForDialog.id } : null)} onChanged={refreshSnapshot} />}
    {dialog?.kind === 'edit' && shotForDialog && <StudioDialog title={`Edit ${shotForDialog.title}`} onClose={() => setDialog(null)} footer={<><button className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={() => { const patch = editPatch(); if (Object.keys(patch).length) void run(() => updateProjectShot({ collectionId, shotId: shotForDialog.id, patch }), 'Shot updated.'); else setDialog(null); }}>Save Shot</button></>}><div className="cw-form"><label>Code<input value={edit.code} onChange={event => setEdit({ ...edit, code: event.target.value })} /></label><label>Title<input value={edit.title} onChange={event => setEdit({ ...edit, title: event.target.value })} /></label><label>Planned duration (seconds)<input type="number" min="1" max="86400" value={edit.duration} onChange={event => setEdit({ ...edit, duration: event.target.value })} /></label><label>Status<select value={edit.status} onChange={event => setEdit({ ...edit, status: event.target.value as ProductionStatus })}>{statuses.map(status => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label><label>Continuity note<textarea value={edit.continuityNotes} onChange={event => setEdit({ ...edit, continuityNotes: event.target.value })} /></label></div>{error && <p role="alert">{error}</p>}<button className="btn btn-secondary" onClick={() => setDialog({ kind: 'takes', shotId: shotForDialog.id, returnToEdit: true })}>Manage Takes</button></StudioDialog>}
    {(dialog?.kind === 'add' || dialog?.kind === 'insert') && <StudioDialog title={dialog.kind === 'add' ? 'Add Planned Shot' : insertionTitle} onClose={() => setDialog(null)} footer={<><button className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={() => void run(() => addProjectShot({ collectionId, title: newTitle.trim() || undefined, ...insertion }), 'Planned shot added.')}>Add Shot</button></>}><label className="cw-form">Shot title<input autoFocus value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="Planned shot" /></label><p>Code and status can be edited after adding.</p>{error && <p role="alert">{error}</p>}</StudioDialog>}
    {dialog?.kind === 'existing' && <StudioDialog title="Add Existing Scene" onClose={() => setDialog(null)}><label className="cw-form">Search saved scenes<input value={existingSearch} onChange={event => setExistingSearch(event.target.value)} /></label><div className="cw-picker-list">{snapshot.scenes.filter(scene => scene.title.toLowerCase().includes(existingSearch.toLowerCase())).map(scene => <div key={scene.id}><span>{scene.title}</span><button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(() => addProjectShot({ collectionId, sceneId: scene.id }), 'Saved scene added to storyboard.')}>Add Scene</button></div>)}</div>{error && <p role="alert">{error}</p>}</StudioDialog>}
    {dialog?.kind === 'remove' && shotForDialog && <StudioDialog title={`Remove ${shotForDialog.title}?`} onClose={() => setDialog(null)} footer={<><button className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button><button className="btn btn-danger" disabled={busy} onClick={() => void run(() => removeProjectShot({ collectionId, shotId: shotForDialog.id }), 'Shot removed from project.')}>Remove Shot</button></>}><p>This removes the shot from this project. Source saved scenes and their prompts are kept in your library.</p>{error && <p role="alert">{error}</p>}</StudioDialog>}
    {dialog?.kind === 'details' && <StudioDialog title="Edit Project Details" onClose={() => setDialog(null)} footer={<><button className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={() => void run(() => updateCollection({ id: collectionId, name: detailName, description: detailDescription, coverMediaId: coverId }), 'Project details updated.')}>Save Project</button></>}><div className="cw-form"><label>Name<input value={detailName} onChange={event => setDetailName(event.target.value)} /></label><label>Description<textarea value={detailDescription} onChange={event => setDetailDescription(event.target.value)} /></label><div><button ref={coverTriggerRef} className="btn btn-secondary" onClick={() => setDialog({ kind: 'cover' })}>Choose Cover</button>{coverId && <p>{snapshot.media.find(media => media.id === coverId)?.filename || `Missing cover (${coverId})`}</p>}</div></div>{error && <p role="alert">{error}</p>}</StudioDialog>}
  </div>;
};
