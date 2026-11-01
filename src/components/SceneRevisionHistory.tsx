import React, { useRef, useState } from "react";
import type { SavedScene } from "../types/domain";
import type { SceneProjectTarget } from "../types/sceneAuthoring";
import { useLibrary } from "../context/LibraryContext";
import { StudioDialog } from "./StudioDialog";
import {
  compareSceneVersions,
  getRevisionFamily,
  getRevisionHead,
  getRevisionLabel,
} from "../domain/sceneRevisions";
import { createSceneRevisionDraft } from "../storage/sceneAuthoring";
import { selectProjectTake } from "../storage/projects";
import { isDirectPrompt } from "../domain/directPrompt";
import { getSavedSceneProjectTarget } from "../domain/projectRoutes";
import "./sceneRevisions.css";
import {RecipeRevisionChoices}from'./RecipeRevisionChoices';

export const SceneVersionComparison: React.FC<{
  before: SavedScene;
  after: SavedScene;
}> = ({ before, after }) => {
  const comparison = compareSceneVersions(before, after);
  return (
    <section className="scene-version-compare" aria-label="Version comparison">
      <h3>Changes between versions</h3>
      <p>
        {comparison.changes.length
          ? `Metadata changed: ${comparison.changes.join(", ")}.`
          : "No captured reference, identity, duration, aspect ratio or Shot Type changes."}
      </p>
      <p className="muted-text">
        Identity changes inside prose are not automatically detected. Review the
        complete prompts. Factual claims are not automatically verified.
      </p>
      <div className="scene-version-panes">
        <section>
          <h4>Previous prompt</h4>
          <pre tabIndex={0} role="region" aria-label="Previous prompt">
            {comparison.beforeText}
          </pre>
        </section>
        <section>
          <h4>Current prompt</h4>
          <pre tabIndex={0} role="region" aria-label="Current prompt">
            {comparison.afterText}
          </pre>
        </section>
      </div>
      {comparison.limited ? (
        <p role="status">
          Highlighting is limited for this large comparison. Both complete
          original prompts are available above.
        </p>
      ) : (
        <details>
          <summary>Highlighted line changes</summary>
          <div className="scene-line-diff" aria-label="Text differences">
            {comparison.lines.map((line, index) => (
              <div key={index} className={`scene-diff-${line.kind}`}>
                <span aria-hidden="true">
                  {line.kind === "added"
                    ? "+ "
                    : line.kind === "removed"
                      ? "- "
                      : "  "}
                </span>
                <span className="sr-only">
                  {line.kind === "added"
                    ? "Added: "
                    : line.kind === "removed"
                      ? "Removed: "
                      : "Unchanged: "}
                </span>
                {line.text || "\u00a0"}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
};

export const SceneRevisionActions: React.FC<{
  scene: SavedScene;
  target?: SceneProjectTarget;
}> = ({ scene, target }) => {
  const { snapshot, hashPath, navigate, refreshSnapshot, showToast } =
    useLibrary();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null),
    guard = useRef(false);
  const scenes = snapshot?.scenes ?? [];
  const family = getRevisionFamily(scene, scenes),
    head = getRevisionHead(scene, scenes);
  const [leftId, setLeftId] = useState(family[0]?.id ?? scene.id),
    [rightId, setRightId] = useState(scene.id);
  const routeContext = getSavedSceneProjectTarget(
    hashPath,
    scene,
    snapshot?.collections ?? [],
  );
  const resolvedTarget = routeContext.requested ? routeContext.target : target;
  const run = async (action: () => Promise<void>) => {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not complete this version action.",
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  };
  const edit = (
    asDirect = false,
    restoreFromSceneId?: string,
    alternateTake = false,
  ) =>
    run(async () => {
      if (routeContext.error) throw new Error(routeContext.error);
      const draft = await createSceneRevisionDraft(scene.id, {
        asDirect,
        alternateTake,
        ...(restoreFromSceneId ? { restoreFromSceneId } : {}),
        ...(resolvedTarget ? { target: resolvedTarget } : {}),
      });
      await refreshSnapshot();
      setOpen(false);
      const query = resolvedTarget
        ? `?${new URLSearchParams({ collection: resolvedTarget.collectionId, shot: resolvedTarget.shotId!, takeTarget: "1", tab: "storyboard" })}`
        : "";
      navigate(`/builder/${draft.id}${query}`, true);
    });
  const left = scenes.find((s) => s.id === leftId),
    right = scenes.find((s) => s.id === rightId);
  const legacyRelated = scenes.filter(
    (s) =>
      !family.some((f) => f.id === s.id) &&
      (s.versionOfSceneId === scene.id || scene.versionOfSceneId === s.id),
  );
  return (
    <div className="scene-revision-actions">
      {!isDirectPrompt(scene)&&<RecipeRevisionChoices scene={scene} onRevise={()=>void edit()}/>}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={busy}
        onClick={() => void edit()}
      >
        Edit as New Version
      </button>
      {!isDirectPrompt(scene) && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy||!!scene.ensemble}
          title={scene.ensemble?'Ensemble scenes keep structured participants and cues. Use Edit as New Version.':undefined}
          onClick={() => void edit(true)}
        >
          Edit Full Prompt
        </button>
      )}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => {
          setLeftId(family[0]?.id ?? scene.id);
          setRightId(scene.id);
          setOpen(true);
        }}
      >
        Compare Versions
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={busy}
        onClick={() => void edit(false, undefined, true)}
      >
        Create Alternate Take
      </button>
      <button
        ref={trigger}
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => {
          setLeftId(family[0]?.id ?? scene.id);
          setRightId(scene.id);
          setOpen(true);
        }}
      >
        View Revision History
      </button>
      {error && !open && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {open && (
        <StudioDialog
          title="Revision History"
          size="wide"
          returnFocusRef={trigger}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
          footer={
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          }
        >
          <p>
            Saved content is immutable. Restoring creates a new version;
            choosing a preferred take is a separate action.
          </p>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <ol className="scene-history-list">
            {family.map((version) => (
              <li key={version.id}>
                <div>
                  <strong>
                    {getRevisionLabel(version)} · {version.title}
                  </strong>
                  <small>
                    {version.id} · {version.createdAt} ·{" "}
                    {version.directPrompt?.origin ?? "Recipe / legacy source"}
                  </small>
                  {version.sceneRevision?.reason && (
                    <p>{version.sceneRevision.reason}</p>
                  )}
                  {version.sceneRevision?.restoredFromSceneId && (
                    <p>
                      Restored from {version.sceneRevision.restoredFromSceneId}
                    </p>
                  )}
                </div>
                <div className="studio-inline">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setOpen(false);
                      navigate(
                        `/output/${version.id}${resolvedTarget ? `?collection=${encodeURIComponent(resolvedTarget.collectionId)}&shot=${encodeURIComponent(resolvedTarget.shotId!)}` : ""}`,
                      );
                    }}
                  >
                    Review Prompt
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => void edit(false, version.id)}
                  >
                    Restore as New Version
                  </button>
                  {snapshot?.collections.flatMap((c) =>
                    (c.project?.shots ?? [])
                      .filter((s) => s.takeSceneIds.includes(version.id))
                      .map((s) => (
                        <button
                          key={`${c.id}:${s.id}`}
                          className="btn btn-secondary btn-sm"
                          disabled={busy || s.selectedSceneId === version.id}
                          onClick={() =>
                            void run(async () => {
                              await selectProjectTake({
                                collectionId: c.id,
                                shotId: s.id,
                                sceneId: version.id,
                                expectedRevision: c.project!.revision,
                              });
                              await refreshSnapshot();
                              showToast("Preferred version selected.");
                            })
                          }
                        >
                          {s.selectedSceneId === version.id
                            ? `Preferred · ${c.name} / ${s.code}`
                            : `Set as Preferred · ${c.name} / ${s.code}`}
                        </button>
                      )),
                  )}
                </div>
              </li>
            ))}
          </ol>
          {legacyRelated.length > 0 && (
            <details>
              <summary>
                Related legacy versions (original branches preserved)
              </summary>
              {legacyRelated.map((s) => (
                <p key={s.id}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setOpen(false);
                      navigate(`/output/${s.id}`);
                    }}
                  >
                    {s.title} · {s.id}
                  </button>
                </p>
              ))}
            </details>
          )}
          {scene.sceneRevision?.parentSceneId &&
            !scenes.some(
              (s) => s.id === scene.sceneRevision!.parentSceneId,
            ) && (
              <p role="status">
                Earlier saved scene unavailable:{" "}
                {scene.sceneRevision.parentSceneId}. Its relationship is
                preserved.
              </p>
            )}
          {family.length > 1 && (
            <>
              <div className="scene-compare-controls">
                <label>
                  Previous version
                  <select
                    className="select"
                    value={leftId}
                    onChange={(event) => setLeftId(event.target.value)}
                  >
                    {family.map((s) => (
                      <option key={s.id} value={s.id}>
                        {getRevisionLabel(s)} · {s.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Current version
                  <select
                    className="select"
                    value={rightId}
                    onChange={(event) => setRightId(event.target.value)}
                  >
                    {family.map((s) => (
                      <option key={s.id} value={s.id}>
                        {getRevisionLabel(s)} · {s.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {left && right && (
                <SceneVersionComparison before={left} after={right} />
              )}
            </>
          )}
        </StudioDialog>
      )}
    </div>
  );
};
