import React, { useMemo, useState } from "react";
import { useLibrary } from "../context/LibraryContext";
import { getProjectShots } from "../domain/projectStoryboard";
import { serializeAiContext } from "../domain/aiContext";
import type { AiContextSelection } from "../types/aiContext";
import { downloadBlobAsFile } from "../hooks/useObjectUrl";
import "./changeSets.css";
function Choices({
  label,
  items,
  selected,
  onChange,
  prefix,
}: {
  label: string;
  items: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  prefix: string;
}) {
  const [query, setQuery] = useState(""),
    [limit, setLimit] = useState(60);
  const visible = items.filter((i) =>
    `${i.label} ${i.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <details className="import-group">
      <summary>
        {label} ({selected.length} selected)
      </summary>
      <label>
        Search {label.toLowerCase()}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(60);
          }}
        />
      </label>
      <div className="context-choice-list">
        {visible.slice(0, limit).map((item) => (
          <label className="import-check" key={item.id}>
            <input
              type="checkbox"
              aria-label={`${prefix} ${item.label}`}
              checked={selected.includes(item.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, item.id]
                    : selected.filter((id) => id !== item.id),
                )
              }
            />
            <span>
              {item.label}
              <small>{item.id}</small>
            </span>
          </label>
        ))}
        {visible.length > limit && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setLimit(limit + 60)}
          >
            Show more choices ({visible.length - limit})
          </button>
        )}
      </div>
    </details>
  );
}
export function AiContextScreen() {
  const { snapshot, hashPath, navigate, copyText } = useLibrary();
  const [selection, setSelection] = useState<AiContextSelection>(() => {
    const id = new URLSearchParams(hashPath.split("?")[1] ?? "").get("project");
    return {
      projectIds: id ? [id] : [],
      assetIds: [],
      sceneIds: [],
      templateIds: [],
      fullPromptSceneIds: [],
    };
  });
  const output = useMemo(() => {
    if (!snapshot) return { text: "", error: "" };
    try {
      return { text: serializeAiContext(snapshot, selection), error: "" };
    } catch (error) {
      return { text: "", error: (error as Error).message };
    }
  }, [snapshot, selection]);
  if (!snapshot) return null;
  const scope = [
    ...new Set([
      ...snapshot.collections
        .filter((c) => selection.projectIds?.includes(c.id))
        .flatMap((c) =>
          getProjectShots(c, snapshot.scenes).flatMap((s) => s.takeSceneIds),
        ),
      ...(selection.sceneIds ?? []),
    ]),
  ];
  const selectedScenes = snapshot.scenes.filter((s) => scope.includes(s.id));
  const update = (next: Partial<AiContextSelection>) =>
    setSelection((previous) => ({ ...previous, ...next }));
  const controls = [
    ["includeAssetText", "Include ordinary asset and template prompt text"],
    ["includeCharacterIdentity", "Include selected character identity details"],
    ["includeNotes", "Include notes and pending descriptions"],
    ["includeMediaFilenames", "Include associated media filenames"],
  ] as const;
  return (
    <div className="change-set-workspace has-context">
      <header className="import-heading">
        <div>
          <span className="import-eyebrow">Read-only selected context</span>
          <h1>Export Context for AI</h1>
          <p className="muted-text">
            Choose what to share manually. Nothing is sent to an AI service.
          </p>
        </div>
        <div className="import-buttons">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/imports/ai")}
          >
            Import AI Change Set
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/collections")}
          >
            Back to Collections
          </button>
        </div>
      </header>
      <div className="context-grid">
        <section
          className="card context-controls"
          aria-label="AI context selection"
        >
          <h2>Metadata by default</h2>
          <p className="muted-text">
            Names and tags may be private too. Select only relevant records.
            Full text, identity details, notes and filenames are off until you
            choose them.
          </p>
          <Choices
            label="Projects"
            items={snapshot.collections.map((c) => ({
              id: c.id,
              label: c.name,
            }))}
            selected={selection.projectIds ?? []}
            prefix="Select project"
            onChange={(ids) =>
              update({ projectIds: ids, fullPromptSceneIds: [] })
            }
          />
          <Choices
            label="Saved scene metadata"
            items={snapshot.scenes.map((s) => ({ id: s.id, label: s.title }))}
            selected={selection.sceneIds ?? []}
            prefix="Select scene metadata"
            onChange={(ids) =>
              update({ sceneIds: ids, fullPromptSceneIds: [] })
            }
          />
          <Choices
            label="Reusable assets"
            items={snapshot.assets.map((a) => ({ id: a.id, label: a.title }))}
            selected={selection.assetIds ?? []}
            prefix="Select asset"
            onChange={(ids) => update({ assetIds: ids })}
          />
          <Choices
            label="Existing variants"
            items={snapshot.variants.map((v) => ({ id: v.id, label: v.title }))}
            selected={selection.variantIds ?? []}
            prefix="Select variant"
            onChange={(ids) => update({ variantIds: ids })}
          />
          <Choices
            label="Templates"
            items={snapshot.templates.map((t) => ({ id: t.id, label: t.name }))}
            selected={selection.templateIds ?? []}
            prefix="Select template"
            onChange={(ids) => update({ templateIds: ids })}
          />
          <details className="import-group">
            <summary>
              Include specific full scene prompts (
              {selection.fullPromptSceneIds?.length ?? 0})
            </summary>
            <p className="muted-text">
              A Full prompt can contain identity or private property details.
              Only checked scenes are included.
            </p>
            <div className="context-choice-list">
              {selectedScenes.map((s) => (
                <label className="import-check" key={s.id}>
                  <input
                    type="checkbox"
                    checked={
                      selection.fullPromptSceneIds?.includes(s.id) ?? false
                    }
                    onChange={(e) =>
                      update({
                        fullPromptSceneIds: e.target.checked
                          ? [...(selection.fullPromptSceneIds ?? []), s.id]
                          : (selection.fullPromptSceneIds ?? []).filter(
                              (id) => id !== s.id,
                            ),
                      })
                    }
                  />
                  Include full prompt: {s.title} ({s.id})
                </label>
              ))}
            </div>
            {selectedScenes.length === 0 && (
              <p>Select project or scene metadata first.</p>
            )}
          </details>
          {controls.map(([key, label]) => (
            <label className="import-check" key={key}>
              <input
                type="checkbox"
                checked={selection[key] ?? false}
                onChange={(e) => update({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              setSelection({
                projectIds: [],
                sceneIds: [],
                assetIds: [],
                templateIds: [],
                fullPromptSceneIds: [],
              })
            }
          >
            Reset selections and privacy options
          </button>
        </section>
        <section className="card context-output">
          <h2>Exact JSON to share</h2>
          {output.error ? (
            <p role="alert" className="banner banner-warning">
              {output.error}
            </p>
          ) : (
            <pre role="region" aria-label="AI context JSON" tabIndex={0}>
              {output.text}
            </pre>
          )}
          <p className="muted-text">
            This selected context is neither a backup nor an import package.
            Maximum 5 MiB; nothing is truncated.
          </p>
        </section>
      </div>
      <footer className="card import-action-area">
        <p>
          {output.text
            ? `${new TextEncoder().encode(output.text).length.toLocaleString()} bytes · local preview`
            : "Fix the selection to export context."}
        </p>
        <div className="import-buttons">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!output.text}
            onClick={() =>
              void copyText(output.text, "Selected AI context copied.")
            }
          >
            Copy context JSON
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!output.text}
            onClick={() =>
              downloadBlobAsFile(
                new Blob([output.text], {
                  type: "application/json;charset=utf-8",
                }),
                "krakinai-ai-context-v1.json",
              )
            }
          >
            Download context JSON
          </button>
        </div>
      </footer>
    </div>
  );
}
