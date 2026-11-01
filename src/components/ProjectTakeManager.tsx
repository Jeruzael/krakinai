import React, { useEffect, useRef, useState } from 'react';
import type {
  Collection,
  MediaAsset,
  ProjectShot,
  SavedScene,
} from '../types/domain';
import { useLibrary } from '../context/LibraryContext';
import { buildSceneDocument } from '../domain/sceneDocument';
import {
  addProjectTake,
  removeProjectTake,
  selectProjectTake,
  updateProjectTakeNote,
} from '../storage/projects';
import { MediaThumbnail } from './MediaThumbnail';
import { MediaPreviewDialog } from './MediaPreviewDialog';
import { StudioDialog } from './StudioDialog';
import {isDirectPrompt} from '../domain/directPrompt';
import {getRevisionLabel} from '../domain/sceneRevisions';
import {SceneVersionComparison} from './SceneRevisionHistory';
import {EnsembleSummary} from './EnsembleSummary';
import './projectTakes.css';

type Props = {
  collection: Collection;
  shot: ProjectShot;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
};
type View = 'list' | 'compare';

const resultLink = (scene: SavedScene) =>
  scene.resultMediaLinks?.[0] ?? scene.references?.[0];

export const ProjectTakeManager: React.FC<Props> = ({
  collection,
  shot,
  onClose,
  onChanged,
}) => {
  const { snapshot, showToast } = useLibrary();
  const [currentShot, setCurrentShot] = useState(shot);
  const [view, setView] = useState<View>('list');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    media: MediaAsset;
    title: string;
    altText?: string;
  } | null>(null);
  const [leftId, setLeftId] = useState(currentShot.takeSceneIds[0] ?? '');
  const [rightId, setRightId] = useState(currentShot.takeSceneIds[1] ?? '');
  const [notes, setNotes] = useState<Record<string, string>>(
    currentShot.takeNotes ?? {}
  );
  const scenes = snapshot?.scenes ?? [];
  const media = snapshot?.media ?? [];
  const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]));
  const mediaMap = new Map(media.map((item) => [item.id, item]));
  const takeIds = [...new Set(currentShot.takeSceneIds)];

  useEffect(() => {
    setCurrentShot(shot);
    setNotes(shot.takeNotes ?? {});
  }, [shot]);

  const run = async (action: () => Promise<Collection>, success: string) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const updated = await action();
      const changedShot = updated.project?.shots.find(
        (item) => item.id === shot.id
      );
      if (changedShot) {
        setCurrentShot(changedShot);
        setNotes(changedShot.takeNotes ?? {});
      }
      await onChanged();
      showToast(success, 'success');
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      showToast(message, 'error');
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const saveNote = (sceneId: string) => {
    const note = notes[sceneId] ?? '';
    if (note === (currentShot.takeNotes?.[sceneId] ?? '')) return;
    void run(
      () =>
        updateProjectTakeNote({
          collectionId: collection.id,
          shotId: shot.id,
          sceneId,
          note,
        }),
      'Take note saved.'
    );
  };

  const imageFor = (scene: SavedScene) => {
    const link = resultLink(scene);
    const item = link ? mediaMap.get(link.mediaId) : undefined;
    return (
      <>
        <div className="project-take-visual">
          <MediaThumbnail
            media={item}
            altText={link?.altText || scene.title}
            emptyLabel={
              link && !item
                ? `Missing media ${link.mediaId}`
                : 'No result or reference image'
            }
          />
        </div>
        {item && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label={`View media for ${scene.title}`}
            title={scene.title}
            onClick={() =>
              setPreview({
                media: item,
                title: scene.title,
                altText: link?.altText,
              })
            }
          >
            Preview
          </button>
        )}
      </>
    );
  };

  const detailsFor = (sceneId: string, label: string) => {
    const scene = sceneMap.get(sceneId);
    if (!scene)
      return (
        <section className="project-take-pane" role="region" aria-label={label}>
          <p>
            Missing saved scene: <code>{sceneId}</code>
          </p>
        </section>
      );
    const document = isDirectPrompt(scene)?null:buildSceneDocument(scene);
    const fields = document ? [
      ['Camera', document.components.camera?.prompt],
      ['Action', document.components.action?.prompt],
      ['Dialogue', document.dialogueCues?.map(cue => `${cue.speaker}: ${cue.exactLine}`).join('\n\n') ?? document.dialogue?.exactLine],
      ['Scene instructions', document.scene.instructions],
      ['Aspect ratio', document.settings.aspectRatio],
      ['Duration seconds', document.settings.durationSeconds],
      ['Tool notes', document.settings.toolNotes],
      ['Review status', scene.reviewStatus],
      ['Review notes', scene.reviewNotes],
      ['Project take note', notes[sceneId]],
    ] as const : [['Original Prompt',scene.outputs.full],['Aspect ratio',scene.settings.aspectRatio],['Duration seconds',scene.settings.durationSeconds],['Review notes',scene.reviewNotes]] as const;
    return (
      <section className="project-take-pane" role="region" aria-label={label}>
        <h3>{scene.title}</h3>
        <div className="project-take-image">{imageFor(scene)}</div>
        <p className="muted-text">
          Saved scene ID: <code>{scene.id}</code> · Revision {scene.revision}
          {scene.sourceSceneId && (
            <>
              {' '}
              · Source scene: <code>{scene.sourceSceneId}</code>
            </>
          )}
        </p>
        <p className="muted-text">
          Source draft: <code>{scene.sourceDraftId ?? 'Unknown'}</code> · Input
          revision: {scene.sourceDraftInputRevision ?? 'Unknown'}
        </p>
        <details>
          <summary>Complete take details</summary>
          <dl>
            {fields.map(([name, value]) => (
              <React.Fragment key={name}>
                <dt>{name}</dt>
                <dd className="project-take-exact">
                  {value ?? 'Not specified'}
                </dd>
              </React.Fragment>
            ))}
          </dl>
          <h4>{document?.participants ? 'Shared component prompts and sources' : 'All component prompts and sources'}</h4>
          <dl>
            {Object.entries(document?.components??{}).filter(([slot]) => !document?.participants || (slot !== 'character' && slot !== 'wardrobe')).map(([slot, component]) => (
              <React.Fragment key={slot}>
                <dt>{slot}</dt>
                <dd className="project-take-exact">
                  {component ? (
                    <>
                      {component.prompt}
                      <br />
                      <small>
                        Source {component.source.type}{' '}
                        <code>{component.source.id}</code> · Revision{' '}
                        {component.source.revision}
                      </small>
                    </>
                  ) : (
                    'Not specified'
                  )}
                </dd>
              </React.Fragment>
            ))}
          </dl>
          <h4>Complete dialogue and settings</h4>
          <pre className="project-take-exact">
            {JSON.stringify(
              {
                ...(document?.participants ? { primaryParticipantId: document.primaryParticipantId, participants: document.participants, dialogueCues: document.dialogueCues } : { dialogue: document?.dialogue??null }),
                settings: document?.settings??scene.settings,
                reviewStatus: scene.reviewStatus,
                reviewNotes: scene.reviewNotes,
                projectNote: notes[sceneId] ?? '',
              },
              null,
              2
            )}
          </pre>
        </details>
        {scene.ensemble && <EnsembleSummary ensemble={scene.ensemble} label={`${label} ensemble participants and cues`} />}
      </section>
    );
  };

  if (preview)
    return <MediaPreviewDialog {...preview} onClose={() => setPreview(null)} />;

  return (
    <StudioDialog
      title={`Takes for ${shot.code}`}
      size="wide"
      className="project-takes-dialog"
      onClose={() => {
        if (!busyRef.current) onClose();
      }}
      footer={
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={onClose}
        >
          Close
        </button>
      }
    >
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {view === 'compare' ? (
        <>
          <div className="project-take-toolbar">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setView('list')}
            >
              Back to takes
            </button>
          </div>
          <div className="project-take-compare-controls">
            <label>
              Take A{' '}
              <select
                className="select"
                aria-label="Take A"
                value={leftId}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === rightId) setRightId(leftId);
                  setLeftId(next);
                }}
              >
                {takeIds.map((id) => (
                  <option key={id} value={id}>
                    {sceneMap.get(id)?.title ?? `Missing scene ${id}`} ({id})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Take B{' '}
              <select
                className="select"
                aria-label="Take B"
                value={rightId}
                onChange={(event) => setRightId(event.target.value)}
              >
                {takeIds
                  .filter((id) => id !== leftId)
                  .map((id) => (
                    <option key={id} value={id}>
                      {sceneMap.get(id)?.title ?? `Missing scene ${id}`} ({id})
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="project-take-compare">
            {detailsFor(leftId, 'Take A')}
            {detailsFor(rightId, 'Take B')}
          </div>
        </>
      ) : (
        <>
          <p className="muted-text">
            Each take is a distinct saved scene. Preference and notes belong to
            this project shot.
          </p>
          <div className="project-take-toolbar">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || takeIds.length < 2}
              onClick={() => {
                setLeftId(takeIds[0]);
                setRightId(takeIds[1]);
                setView('compare');
              }}
            >
              Compare takes
            </button>
          </div>
          <div className="project-take-list">
            {takeIds.length === 0 && (
              <p>No takes yet. Add an existing scene below.</p>
            )}
            {takeIds.map((sceneId) => {
              const scene = sceneMap.get(sceneId);
              return (
                <article className="project-take-card" key={sceneId}>
                  <div className="project-take-image">
                    {scene ? (
                      imageFor(scene)
                    ) : (
                      <p>
                        Missing saved scene: <code>{sceneId}</code>
                      </p>
                    )}
                  </div>
                  <div className="project-take-details">
                    <h3>{scene?.title ?? `Missing scene ${sceneId}`}</h3>
                    <p className="muted-text">
                      ID: <code>{sceneId}</code>
                      {scene && (
                        <>
                          {' '}
                          · Revision {scene.revision} · Review:{' '}
                          {scene.reviewStatus}
                          {' · '}{getRevisionLabel(scene)}{isDirectPrompt(scene)?' · Direct Prompt':''}
                        </>
                      )}
                    </p>
                    {sceneId === currentShot.selectedSceneId ? (
                      <strong className="badge badge-success">
                        Preferred take
                      </strong>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        aria-label={`Select ${scene?.title ?? sceneId} as preferred`}
                        disabled={busy || !scene}
                        onClick={() =>
                          void run(
                            () =>
                              selectProjectTake({
                                collectionId: collection.id,
                                shotId: shot.id,
                                sceneId,
                              }),
                            'Preferred take selected.'
                          )
                        }
                      >
                        Select preferred
                      </button>
                    )}
                    <label className="project-take-note">
                      Project note for {scene?.title ?? sceneId}
                      <textarea
                        aria-label={`Project note for ${scene?.title ?? sceneId}`}
                        value={notes[sceneId] ?? ''}
                        disabled={busy || !scene}
                        onChange={(event) =>
                          setNotes((previous) => ({
                            ...previous,
                            [sceneId]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={
                        busy ||
                        !scene ||
                        (notes[sceneId] ?? '') ===
                          (currentShot.takeNotes?.[sceneId] ?? '')
                      }
                      onClick={() => saveNote(sceneId)}
                    >
                      Save note
                    </button>
                    {confirmRemove === sceneId ? (
                      <div className="project-take-confirm">
                        <p>
                          Remove this take from this shot? The source scene is
                          preserved.
                        </p>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                removeProjectTake({
                                  collectionId: collection.id,
                                  shotId: shot.id,
                                  sceneId,
                                }),
                              'Take removed from shot.'
                            ).then((removed) => {
                              if (removed) setConfirmRemove(null);
                            })
                          }
                        >
                          Confirm remove take
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          onClick={() => setConfirmRemove(null)}
                        >
                          Cancel removal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        aria-label={`Remove ${scene?.title ?? sceneId} from shot`}
                        disabled={busy}
                        onClick={() => setConfirmRemove(sceneId)}
                      >
                        Remove take
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <section className="project-take-add">
            <h3>Add existing take</h3>
            <label>
              Find existing scene{' '}
              <input
                className="input"
                type="search"
                aria-label="Find existing scene"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title or scene ID"
              />
            </label>
            <div className="project-take-picker">
              {scenes
                .filter(
                  (scene) =>
                    !takeIds.includes(scene.id) &&
                    `${scene.title} ${scene.id}`
                      .toLocaleLowerCase()
                      .includes(query.toLocaleLowerCase())
                )
                .map((scene) => (
                  <div key={scene.id}>
                    <span>
                      {scene.title} <code>{scene.id}</code>
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      aria-label={`Add ${scene.title}`}
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            addProjectTake({
                              collectionId: collection.id,
                              shotId: shot.id,
                              sceneId: scene.id,
                            }),
                          'Take added to shot.'
                        )
                      }
                    >
                      Add take
                    </button>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}
    </StudioDialog>
  );
};
