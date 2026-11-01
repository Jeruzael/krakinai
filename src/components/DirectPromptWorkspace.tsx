import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLibrary } from "../context/LibraryContext";
import type {
  MediaLink,
  ReviewStatus,
  SavedScene,
  SceneDraft,
  ShotType,
} from "../types/domain";
import type { PromptOrigin, SceneProjectTarget } from "../types/sceneAuthoring";
import {
  saveSceneDraft,
  saveMediaAsset,
  updateSavedSceneReviewAndResults,
  SimilarSceneError,
} from "../storage/db";
import { saveAuthoredScene } from "../storage/sceneAuthoring";
import {
  getDirectPromptReadiness,
  isDirectPrompt,
  validateSceneAuthoring,
} from "../domain/directPrompt";
import { SHOT_TYPES, SHOT_TYPE_LABELS } from "../domain/shotTypeRules";
import { getSavedSceneProjectTarget } from "../domain/projectRoutes";
import {
  reconcilePromptEdit,
  replacePromptSelection,
} from "../domain/exactPromptText";
import { serializeSceneJson } from "../domain/sceneDocument";
import { serializeGenerationJson } from "../domain/generationDocument";
import { downloadBlobAsFile } from "../hooks/useObjectUrl";
import { SourceMediaPicker } from "./SourceMediaPicker";
import { MediaThumbnail } from "./MediaThumbnail";
import {
  SceneRevisionActions,
  SceneVersionComparison,
} from "./SceneRevisionHistory";
import {
  validateMediaCandidate,
  MAX_FILES_PER_RECORD,
} from "../domain/validation";
import "./directPrompt.css";

export const DirectPromptWorkspace: React.FC<{
  id: string;
  preview?: boolean;
}> = ({ id, preview = false }) => {
  const {
    snapshot,
    hashPath,
    navigate,
    refreshSnapshot,
    showToast,
    copyText,
    setDirtyFormGuard,
    openCollectionModal,
  } = useLibrary();
  const draft = snapshot?.drafts.find((d) => d.id === id),
    saved = snapshot?.scenes.find((s) => s.id === id);
  const [form, setForm] = useState<SceneDraft | null>(
    draft ? structuredClone(draft) : null,
  );
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [duplicate, setDuplicate] = useState(false);
  const [tab, setTab] = useState<"prompt" | "references" | "review">("prompt");
  const [notes, setNotes] = useState(
      saved?.reviewNotes ?? draft?.reviewNotes ?? "",
    ),
    [reviewStatus, setReviewStatus] = useState<ReviewStatus>(
      saved?.reviewStatus ?? draft?.reviewStatus ?? "unreviewed",
    );
  const guard = useRef(false),
    token = useRef<{ binding: string; id: string }>(),
    editor = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    setForm(draft ? structuredClone(draft) : null);
    setDirty(false);
    setError("");
    token.current = undefined;
    setNotes(saved?.reviewNotes ?? draft?.reviewNotes ?? "");
    setReviewStatus(saved?.reviewStatus ?? draft?.reviewStatus ?? "unreviewed");
  }, [id, draft?.id, saved?.id]);
  useEffect(() => {
    if (draft && !dirty && !busy && draft.inputRevision !== form?.inputRevision)
      setForm(structuredClone(draft));
  }, [draft?.inputRevision, dirty, busy]);
  useEffect(() => {
    setDirtyFormGuard(dirty);
    return () => setDirtyFormGuard(false);
  }, [dirty, setDirtyFormGuard]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const mediaMap = useMemo(
    () => new Map((snapshot?.media ?? []).map((media) => [media.id, media])),
    [snapshot?.media],
  );
  const record = saved ?? form ?? draft;
  if (!snapshot || !record)
    return (
      <div className="card" role="status">
        Loading direct prompt…
      </div>
    );
  if (!isDirectPrompt(record))
    return (
      <div className="card" role="alert">
        This record uses Build from Assets.{" "}
        <button
          className="btn btn-secondary"
          onClick={() => navigate(`/builder/${id}`)}
        >
          Open Scene Builder
        </button>
      </div>
    );
  const editing = !saved && !preview;
  const original = record.directPrompt.text;
  const readiness = getDirectPromptReadiness(record, mediaMap);
  const target = form?.authoredProjectTarget;
  const routeContext = saved
    ? getSavedSceneProjectTarget(hashPath, saved, snapshot.collections)
    : { requested: false };
  const savedTarget = routeContext.requested
    ? routeContext.target
    : saved?.saveProjectTarget;
  const collection = snapshot.collections.find(
    (c) => c.id === (target?.collectionId ?? savedTarget?.collectionId),
  );
  const shot = collection?.project?.shots.find(
    (s) => s.id === (target?.shotId ?? savedTarget?.shotId),
  );
  const sourceScene = form?.revisionIntent
    ? snapshot.scenes.find((s) => s.id === form.revisionIntent!.parentSceneId)
    : undefined;
  const comparisonScene: SavedScene | undefined =
    sourceScene && form
      ? {
          ...sourceScene,
          authoringMode: "direct_prompt",
          directPrompt: record.directPrompt,
          outputs: { full: original },
          slots: form.slots,
          settings: form.settings,
          shotType: form.shotType,
          referencePack: form.referencePack,
          references: form.directReferences ?? [],
          sourceMediaLinks: form.sourceMediaLinks,
          pendingInputs: form.pendingInputs,
        }
      : undefined;
  const change = (patch: Partial<SceneDraft>) => {
    setForm((previous) => (previous ? { ...previous, ...patch } : previous));
    setDirty(true);
    setError("");
  };
  const changePrompt = (text: string) => {
    if (form?.directPrompt)
      change({ directPrompt: { ...form.directPrompt, text } });
  };
  const run = async (action: () => Promise<void>) => {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "The operation failed. Your draft is preserved.";
      setError(message);
      if (cause instanceof SimilarSceneError) setDuplicate(true);
    } finally {
      guard.current = false;
      setBusy(false);
    }
  };
  const persist = async () => {
    if (!form)
      throw new Error("This saved scene is immutable. Edit as New Version.");
    if (!dirty) return form;
    const stored = await saveSceneDraft({
      ...form,
      expectedInputRevision: form.inputRevision,
    });
    setForm(stored);
    setDirty(false);
    await refreshSnapshot();
    return stored;
  };
  const saveScene = (allowDuplicate = false) =>
    run(async () => {
      const stored = await persist();
      const binding = JSON.stringify([stored, allowDuplicate]);
      if (token.current?.binding !== binding)
        token.current = { binding, id: crypto.randomUUID() };
      const scene = await saveAuthoredScene(stored.id, {
        requestId: token.current.id,
        expectedInputRevision: stored.inputRevision,
        ...(stored.authoredProjectTarget
          ? { target: stored.authoredProjectTarget }
          : {}),
        ...(allowDuplicate ? { allowDuplicate: true } : {}),
      });
      await refreshSnapshot();
      setDirty(false);
      showToast(
        "Saved immutable prompt. Previous versions and preferred takes are preserved.",
      );
      navigate(
        `/output/${scene.id}${scene.saveProjectTarget ? `?collection=${encodeURIComponent(scene.saveProjectTarget.collectionId)}&shot=${encodeURIComponent(scene.saveProjectTarget.shotId)}` : ""}`,
        true,
      );
    });
  const review = () =>
    run(async () => {
      const issue = validateSceneAuthoring(
        { ...form, outputs: { full: original } },
        true,
      );
      if (issue) throw new Error(issue);
      const stored = await persist();
      const query = hashPath.split("?")[1];
      navigate(`/output/${stored.id}${query ? `?${query}` : ""}`, true);
    });
  const download = (kind: "txt" | "scene" | "generation") => {
    const value =
      kind === "txt"
        ? original
        : kind === "scene"
          ? serializeSceneJson(record)
          : serializeGenerationJson(record);
    const filename = `${record.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50) || "direct_prompt"}_${kind === "txt" ? "original" : kind}.${kind === "txt" ? "txt" : "json"}`;
    downloadBlobAsFile(
      new Blob([new TextEncoder().encode(value)], {
        type:
          kind === "txt"
            ? "text/plain;charset=utf-8"
            : "application/json;charset=utf-8",
      }),
      filename,
    );
    showToast("Downloaded complete original content.");
  };
  const references = saved?.references ?? [
    ...(form?.directReferences ?? []),
    ...(form?.sourceMediaLinks ?? []),
  ];
  const setTarget = (collectionId: string) => {
    if (!collectionId) {
      change({ authoredProjectTarget: undefined });
      return;
    }
    const chosen = snapshot.collections.find((c) => c.id === collectionId)!;
    change({
      authoredProjectTarget: {
        collectionId,
        expectedProjectRevision: chosen.project?.revision ?? 0,
        newShot: { title: form?.title || "New shot" },
      },
    });
  };
  const removeReference = (link: MediaLink, index: number) => {
    if (!form) return;
    change({
      directReferences: (form.directReferences ?? []).filter(
        (_, i) => i !== index,
      ),
      ...(form.referencePack
        ? {
            referencePack: {
              ...form.referencePack,
              entries: form.referencePack.entries
                .filter(
                  (entry) =>
                    !(
                      entry.mediaId === link.mediaId &&
                      entry.role === link.role &&
                      entry.altText === link.altText
                    ),
                )
                .map((entry, order) => ({ ...entry, order })),
            },
          }
        : {}),
    });
  };
  return (
    <div className="direct-workspace">
      <header className="direct-heading">
        {saved&&<button type="button" className="btn btn-secondary btn-sm" onClick={()=>navigate('/recipes/ai?'+new URLSearchParams({scene:saved.id,...(target?.collectionId&&target.shotId?{collection:target.collectionId,shot:target.shotId}:{})}).toString())}>Convert to Recipe</button>}
        <div>
          <span className="studio-eyebrow">
            {saved ? "IMMUTABLE SAVED SCENE" : "SCENE AUTHORING"}
          </span>
          <h1 className="page-title">
            {saved
              ? record.title
              : preview
                ? "Review Direct Prompt"
                : "Direct Prompt"}
          </h1>
          <p className="muted-text">
            {saved
              ? "Original authored text and previous versions remain preserved."
              : "Paste a complete prompt. Component selections are optional and are not required to save."}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const next = await saveSceneDraft({
                title: "Untitled Scene Draft",
                authoringMode: "recipe",
                slots: {},
                extraRequiredSlots: [],
                sceneInstructions: "",
                settings: { aspectRatio: "16:9", durationSeconds: 8 },
                manualOutputs: {},
                resultMediaLinks: [],
                reviewNotes: "",
                reviewStatus: "unreviewed",
              });
              await refreshSnapshot();
              navigate(`/builder/${next.id}`);
            })
          }
        >
          Build from Assets
        </button>
        <span className="badge">
          {record.directPrompt.origin ?? "manual"} ·{" "}
          {original.length.toLocaleString()} characters
        </span>
      </header>
      <div className="direct-context">
        <span>
          {collection
            ? `${collection.name} / ${shot ? `${shot.code} ${shot.title}` : (target?.newShot?.title ?? "New shot")}`
            : "Standalone scene"}
        </span>
        <span>{saved ? "Saved" : dirty ? "Unsaved edits" : "Draft saved"}</span>
        {collection && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              navigate(
                `/collections/${encodeURIComponent(collection.id)}?tab=storyboard${shot ? `&shot=${encodeURIComponent(shot.id)}` : ""}`,
              )
            }
          >
            Back to Storyboard
          </button>
        )}
      </div>
      {routeContext.error && (
        <p role="alert" className="error-message">
          {routeContext.error}
        </p>
      )}
      {error && (
        <div role="alert" className="error-message">
          {error}
          <p>
            Your original text remains available. Check the target and
            References / Source Media, or save a draft and retry.
          </p>
          {duplicate && (
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void saveScene(true)}
            >
              Save as Separate Original
            </button>
          )}
        </div>
      )}
      {saved && (
        <SceneRevisionActions
          scene={saved}
          target={
            shot && collection
              ? {
                  collectionId: collection.id,
                  shotId: shot.id,
                  expectedProjectRevision: collection.project!.revision,
                }
              : undefined
          }
        />
      )}
      <div
        role="tablist"
        aria-label="Direct prompt workspace"
        className="tabs-bar"
      >
        {(["prompt", "references", "review"] as const).map((value) => (
          <button
            key={value}
            id={`direct-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls={`direct-panel-${value}`}
            tabIndex={tab === value ? 0 : -1}
            className={`tab-btn ${tab === value ? "active" : ""}`}
            onClick={() => setTab(value)}
            onKeyDown={(event) => {
              const tabs = ["prompt", "references", "review"] as const;
              let index = tabs.indexOf(value);
              if (
                ["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                index =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? 2
                      : (index + (event.key === "ArrowLeft" ? 2 : 1)) % 3;
                setTab(tabs[index]);
                requestAnimationFrame(() =>
                  document.getElementById(`direct-tab-${tabs[index]}`)?.focus(),
                );
              }
            }}
          >
            {value === "prompt"
              ? "Prompt"
              : value === "references"
                ? `References (${references.length})`
                : "Review"}
          </button>
        ))}
      </div>
      {tab === "prompt" && (
        <section
          id="direct-panel-prompt"
          role="tabpanel"
          aria-labelledby="direct-tab-prompt"
          className="direct-main"
        >
          <div className="card direct-prompt-card">
            {editing ? (
              <>
                <label className="direct-label">
                  Title
                  <input
                    className="input"
                    maxLength={100}
                    value={form?.title ?? ""}
                    onChange={(event) => change({ title: event.target.value })}
                  />
                </label>
                <label className="direct-label">
                  Complete Prompt
                  <textarea
                    ref={editor}
                    className="input direct-editor"
                    value={original}
                    spellCheck={false}
                    onChange={(event) =>
                      changePrompt(
                        reconcilePromptEdit(original, event.target.value),
                      )
                    }
                    onPaste={(event) => {
                      event.preventDefault();
                      const input = event.currentTarget,
                        pasted = event.clipboardData.getData("text/plain"),
                        start = input.selectionStart,
                        end = input.selectionEnd;
                      changePrompt(
                        replacePromptSelection(original, start, end, pasted),
                      );
                      requestAnimationFrame(() => {
                        const position =
                          start + pasted.replace(/\r\n?/g, "\n").length;
                        editor.current?.setSelectionRange(position, position);
                      });
                    }}
                  />
                </label>
                <p className="muted-text">
                  Original whitespace, dialogue and formatting are retained.
                  Save Draft before leaving or reloading.
                </p>
              </>
            ) : (
              <>
                <div className="direct-format-bar">
                  <strong>Original Prompt</strong>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled
                    title="Unavailable: this prompt was directly authored."
                  >
                    Structured
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled
                    title="Unavailable: this prompt was directly authored."
                  >
                    Compact
                  </button>
                </div>
                <pre
                  tabIndex={0}
                  role="region"
                  aria-label="Original prompt text"
                  className="direct-original"
                >
                  {original}
                </pre>
                <p className="muted-text">
                  Structured, Compact and provider-derived presets are
                  unavailable for directly authored text.
                </p>
              </>
            )}
            <div className="studio-inline">
              <details className="direct-export-menu">
                <summary>JSON exports</summary>
                <div className="studio-inline">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => download("scene")}
                  >
                    Scene JSON
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => download("generation")}
                  >
                    Generation JSON
                  </button>
                </div>
              </details>
            </div>
            {sourceScene && comparisonScene && (
              <details className="direct-version-review">
                <summary>Compare Versions before saving</summary>
                <SceneVersionComparison
                  before={sourceScene}
                  after={comparisonScene}
                />
              </details>
            )}
          </div>
          <aside className="card direct-details">
            <h2>Scene details</h2>
            {editing ? (
              <>
                <label className="direct-label">
                  Shot Type
                  <select
                    className="select"
                    value={form?.shotType ?? ""}
                    onChange={(event) =>
                      change({
                        shotType: event.target.value
                          ? (event.target.value as ShotType)
                          : undefined,
                      })
                    }
                  >
                    <option value="">Not specified</option>
                    {SHOT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {SHOT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="direct-setting-row">
                  <label className="direct-label">
                    Duration (seconds)
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={60}
                      step={1}
                      value={form?.settings.durationSeconds ?? ""}
                      onChange={(event) =>
                        change({
                          settings: {
                            ...form!.settings,
                            durationSeconds:
                              event.target.value === ""
                                ? undefined
                                : Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label className="direct-label">
                    Aspect ratio
                    <select
                      className="select"
                      value={form?.settings.aspectRatio ?? ""}
                      onChange={(event) =>
                        change({
                          settings: {
                            ...form!.settings,
                            aspectRatio: event.target.value
                              ? (event.target.value as "16:9" | "9:16" | "1:1")
                              : undefined,
                          },
                        })
                      }
                    >
                      <option value="">Not specified</option>
                      {["16:9", "9:16", "1:1"].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="direct-label">
                  Prompt source
                  <select
                    className="select"
                    value={record.directPrompt.origin ?? "manual"}
                    onChange={(event) =>
                      change({
                        directPrompt: {
                          ...record.directPrompt,
                          origin: event.target.value as PromptOrigin,
                        },
                      })
                    }
                  >
                    {["manual", "chatgpt", "codex", "external"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label className="direct-label">
                  Source label (optional)
                  <input
                    className="input"
                    maxLength={100}
                    value={record.directPrompt.originLabel ?? ""}
                    onChange={(event) =>
                      change({
                        directPrompt: {
                          ...record.directPrompt,
                          originLabel: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label className="direct-label">
                  Notes
                  <textarea
                    className="input"
                    value={form?.settings.toolNotes ?? ""}
                    maxLength={10000}
                    onChange={(event) =>
                      change({
                        settings: {
                          ...form!.settings,
                          toolNotes: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                {form?.revisionIntent && (
                  <label className="direct-label">
                    Revision reason
                    <textarea
                      className="input"
                      value={form.revisionIntent.reason ?? ""}
                      maxLength={10000}
                      onChange={(event) =>
                        change({
                          revisionIntent: {
                            ...form.revisionIntent!,
                            reason: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                )}
                <details>
                  <summary>Save destination</summary>
                  <label className="direct-label">
                    Project
                    <select
                      aria-label="Project"
                      className="select"
                      value={target?.collectionId ?? ""}
                      onChange={(event) => setTarget(event.target.value)}
                    >
                      <option value="">Standalone scene</option>
                      {snapshot.collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {target && collection && (
                    <>
                      <label className="direct-label">
                        Storyboard shot
                        <select
                          aria-label="Storyboard shot"
                          className="select"
                          value={target.shotId ?? "new"}
                          onChange={(event) =>
                            change({
                              authoredProjectTarget:
                                event.target.value === "new"
                                  ? {
                                      collectionId: collection.id,
                                      expectedProjectRevision:
                                        collection.project?.revision ?? 0,
                                      newShot: {
                                        title: form?.title || "New shot",
                                      },
                                    }
                                  : {
                                      collectionId: collection.id,
                                      expectedProjectRevision:
                                        collection.project?.revision ?? 0,
                                      shotId: event.target.value,
                                    },
                            })
                          }
                        >
                          <option value="new">Create NEW planned shot</option>
                          {collection.project?.shots.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} — {s.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      {target.newShot && (
                        <label className="direct-label">
                          New shot title
                          <input
                            className="input"
                            value={target.newShot.title}
                            maxLength={240}
                            onChange={(event) =>
                              change({
                                authoredProjectTarget: {
                                  ...target,
                                  newShot: {
                                    ...target.newShot!,
                                    title: event.target.value,
                                  },
                                },
                              })
                            }
                          />
                        </label>
                      )}
                      <p className="muted-text">
                        Saving adds a version/take. Preferred selection and
                        production status stay unchanged.
                      </p>
                    </>
                  )}
                </details>
                <label className="direct-label">
                  Unverified claims / source fact notes
                  <textarea
                    className="input"
                    value={form?.claimNotes ?? ""}
                    maxLength={10000}
                    placeholder="Flag claims that need source verification. Nothing is automatically verified."
                    onChange={(event) =>
                      change({ claimNotes: event.target.value })
                    }
                  />
                </label>
              </>
            ) : (
              <>
                <div className="studio-inline">
                  <span className="badge">
                    {record.shotType
                      ? SHOT_TYPE_LABELS[record.shotType]
                      : "Shot Type unspecified"}
                  </span>
                  {record.settings.durationSeconds && (
                    <span className="badge">
                      {record.settings.durationSeconds}s
                    </span>
                  )}
                  {record.settings.aspectRatio && (
                    <span className="badge">{record.settings.aspectRatio}</span>
                  )}
                </div>
                <p>{record.settings.toolNotes || "No additional notes."}</p>
                {record.claimNotes && (
                  <p>
                    Unverified claims / source fact notes: {record.claimNotes}
                  </p>
                )}
              </>
            )}
            <div className="direct-readiness" role="status">
              <h3>Generation input readiness</h3>
              {readiness.length ? (
                <>
                  <strong>Inputs need review</strong>
                  <ul>
                    {readiness.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>
                  No missing inputs detected among declared associations. This
                  does not verify prompt facts or external generation.
                </p>
              )}
              <p className="muted-text">
                Prompt text can be saved now. Original files must be supplied
                separately to your generation tool.
              </p>
            </div>
          </aside>
        </section>
      )}
      {tab === "references" && (
        <section
          id="direct-panel-references"
          role="tabpanel"
          aria-labelledby="direct-tab-references"
          className="card"
        >
          <h2>References / Source Media</h2>
          {editing && (
            <>
              <label className="direct-label">
                Attach existing reference
                <select
                  className="select"
                  value=""
                  disabled={
                    (form?.directReferences?.length ?? 0) >=
                    MAX_FILES_PER_RECORD
                  }
                  onChange={(event) => {
                    const media = mediaMap.get(event.target.value);
                    if (media)
                      change({
                        directReferences: [
                          ...(form?.directReferences ?? []),
                          {
                            mediaId: media.id,
                            role: "reference",
                            altText: media.filename,
                            filename: media.filename,
                            mimeType: media.mimeType,
                            order: form?.directReferences?.length ?? 0,
                          },
                        ],
                      });
                  }}
                >
                  <option value="">Select a stored file…</option>
                  {snapshot.media.map((media) => (
                    <option key={media.id} value={media.id}>
                      {media.filename}
                    </option>
                  ))}
                </select>
              </label>
              {(record.shotType === "graphic_motion" ||
                record.shotType === "existing_footage") && (
                <SourceMediaPicker
                  kind={
                    record.shotType === "graphic_motion" ? "image" : "video"
                  }
                  links={form?.sourceMediaLinks ?? []}
                  mediaMap={mediaMap}
                  onChange={async (links) =>
                    change({ sourceMediaLinks: links })
                  }
                  onUploaded={async () => {
                    await refreshSnapshot();
                  }}
                />
              )}
              <details>
                <summary>
                  Pending inputs ({form?.pendingInputs?.length ?? 0})
                </summary>
                {form?.pendingInputs?.map((input, index) => (
                  <div key={input.id} className="direct-pending">
                    <span>
                      {input.kind.replaceAll("_", " ")}: {input.label}
                    </span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        change({
                          pendingInputs: form.pendingInputs?.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      Remove pending requirement
                    </button>
                  </div>
                ))}
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={(form?.pendingInputs?.length ?? 0) >= 100}
                  onClick={() => {
                    const label = window.prompt(
                      "Describe the missing input. No media association will be invented.",
                    );
                    if (label?.trim())
                      change({
                        pendingInputs: [
                          ...(form?.pendingInputs ?? []),
                          {
                            version: 1,
                            id: crypto.randomUUID(),
                            kind: "other",
                            label: label.slice(0, 240),
                          },
                        ],
                      });
                  }}
                >
                  Add pending input
                </button>
              </details>
            </>
          )}
          <div className="direct-reference-grid">
            {references.map((link, index) => {
              const media = mediaMap.get(link.mediaId);
              return (
                <article key={`${link.mediaId}:${index}`}>
                  <MediaThumbnail
                    media={media}
                    altText={link.altText}
                    showVideoControls
                  />
                  <strong>
                    {link.filename ??
                      media?.filename ??
                      `Missing: ${link.mediaId}`}
                  </strong>
                  <span className="muted-text">
                    {link.role} · {link.viewLabel ?? link.altText}
                  </span>
                  {media && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        downloadBlobAsFile(
                          media.blob,
                          link.exportFilename ??
                            link.filename ??
                            media.exportFilename ??
                            media.safeFilename,
                        )
                      }
                    >
                      Download reference
                    </button>
                  )}
                  {editing && index < (form?.directReferences?.length ?? 0) && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => removeReference(link, index)}
                    >
                      Detach reference
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          {references.length === 0 && (
            <p>
              No files attached. Missing future inputs remain unresolved; no
              dummy files are created.
            </p>
          )}
          {saved && (
            <p>
              To attach or replace references, choose Edit as New Version. This
              saved scene remains immutable.
            </p>
          )}
        </section>
      )}
      {tab === "review" && (
        <section
          id="direct-panel-review"
          role="tabpanel"
          aria-labelledby="direct-tab-review"
          className="card"
        >
          <h2>Review and external results</h2>
          <p className="muted-text">
            User review does not automatically verify factual claims. Result
            files belong to this saved version only.
          </p>
          <label className="direct-label">
            Review notes
            <textarea
              className="input"
              value={notes}
              maxLength={10000}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <label className="direct-label">
            Review status
            <select
              className="select"
              value={reviewStatus}
              onChange={(event) =>
                setReviewStatus(event.target.value as ReviewStatus)
              }
            >
              <option value="unreviewed">Unreviewed</option>
              <option value="user-approved">User reviewed / approved</option>
            </select>
          </label>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (saved) {
                  await updateSavedSceneReviewAndResults({
                    sceneId: saved.id,
                    resultMediaLinks: saved.resultMediaLinks,
                    reviewNotes: notes,
                    reviewStatus,
                  });
                  await refreshSnapshot();
                } else if (form) {
                  const next = await saveSceneDraft({
                    ...form,
                    reviewNotes: notes,
                    reviewStatus,
                    expectedInputRevision: form.inputRevision,
                  });
                  setForm(next);
                  setDirty(false);
                  await refreshSnapshot();
                }
                showToast("Review saved.");
              })
            }
          >
            Save Review
          </button>
          <label className="direct-label">
            Upload external result
            <input
              className="input"
              type="file"
              accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void run(async () => {
                  const check = validateMediaCandidate({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    existingCount: record.resultMediaLinks.length,
                  });
                  if (!check.valid) throw new Error(check.error);
                  const media = await saveMediaAsset({
                    filename: file.name,
                    mimeType: file.type,
                    blob: file,
                  });
                  const links = [
                    ...record.resultMediaLinks,
                    {
                      mediaId: media.id,
                      role: "result" as const,
                      order: record.resultMediaLinks.length,
                      altText: `External result for ${record.title}`,
                      filename: media.filename,
                      mimeType: media.mimeType,
                    },
                  ];
                  if (saved)
                    await updateSavedSceneReviewAndResults({
                      sceneId: saved.id,
                      resultMediaLinks: links,
                      reviewNotes: notes,
                      reviewStatus,
                    });
                  else if (form) {
                    const next = await saveSceneDraft({
                      ...form,
                      resultMediaLinks: links,
                      expectedInputRevision: form.inputRevision,
                    });
                    setForm(next);
                    setDirty(false);
                  }
                  await refreshSnapshot();
                });
              }}
            />
          </label>
          <div className="direct-reference-grid">
            {record.resultMediaLinks.map((link, index) => (
              <article key={`${link.mediaId}:${index}`}>
                <MediaThumbnail
                  media={mediaMap.get(link.mediaId)}
                  altText={link.altText}
                  showVideoControls
                />
                <span>{link.filename ?? link.mediaId}</span>
              </article>
            ))}
          </div>
        </section>
      )}
      <footer className="direct-actions">
        <div>
          <strong>
            {saved
              ? "Immutable saved prompt"
              : form?.revisionIntent
                ? "New immutable version"
                : "Direct Prompt draft"}
          </strong>
          <span className="muted-text">
            {dirty
              ? "Save your edits before leaving."
              : "Exact original text · no automatic rewriting"}
          </span>
        </div>
        <div className="studio-inline">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void copyText(original, "Original prompt copied.")}
          >
            Copy Original Prompt
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => download("txt")}
          >
            Download Original Prompt
          </button>
          {saved ? (
            <button
              className="btn btn-secondary"
              onClick={() =>
                openCollectionModal({
                  type: "scene",
                  id: saved.id,
                  title: saved.title,
                })
              }
            >
              Add to Collection / Storyboard
            </button>
          ) : (
            <>
              {preview ? (
                <button
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    navigate(
                      `/builder/${id}${hashPath.includes("?") ? `?${hashPath.split("?")[1]}` : ""}`,
                    )
                  }
                >
                  Edit Draft
                </button>
              ) : (
                <button
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await persist();
                      showToast("Direct prompt draft saved.");
                    })
                  }
                >
                  Save Draft
                </button>
              )}
              {editing ? (
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void review()}
                >
                  Review Prompt
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void saveScene()}
                >
                  {form?.revisionIntent?.kind === "take"
                    ? "Save Alternate Take"
                    : form?.revisionIntent
                      ? "Save New Version"
                      : "Save Immutable Scene"}
                </button>
              )}
            </>
          )}
        </div>
      </footer>
    </div>
  );
};
