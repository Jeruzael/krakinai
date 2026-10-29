import React, { useMemo, useState } from "react";
import type { PromptAsset } from "../types/domain";
import type { CinematographyInstallResult } from "../storage/cinematographyPresets";
import {
  previewCinematographyCorePresets,
  CINEMATOGRAPHY_CORE_PACK_VERSION,
} from "../domain/cinematographyPresets";
import { StudioDialog } from "./StudioDialog";
export interface CinematographyPackDialogProps {
  assets: PromptAsset[];
  onInstall: (ids: string[]) => Promise<CinematographyInstallResult>;
  onClose: () => void;
}
export const CinematographyPackDialog: React.FC<
  CinematographyPackDialogProps
> = ({ assets, onInstall, onClose }) => {
  const rows = useMemo(
      () => previewCinematographyCorePresets(assets),
      [assets],
    ),
    [selected, setSelected] = useState(() =>
      rows
        .filter((r) => r.state === "available")
        .map((r) => r.preset.techniqueId),
    ),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<CinematographyInstallResult | null>(null);
  const chosen = rows
    .filter(
      (r) => r.state === "available" && selected.includes(r.preset.techniqueId),
    )
    .map((r) => r.preset.techniqueId);
  const install = async () => {
    if (busy || !ack || !chosen.length || result) return;
    setBusy(true);
    setError("");
    try {
      setResult(await onInstall(chosen));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Installation failed. Existing assets were preserved.",
      );
      setAck(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <StudioDialog
      title="Review cinematography core pack"
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={onClose}
          >
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              className="btn btn-primary"
              disabled={busy || !ack || !chosen.length}
              onClick={() => void install()}
            >
              Install selected missing presets
            </button>
          )}
        </>
      }
    >
      <p>
        Optional core pack v{CINEMATOGRAPHY_CORE_PACK_VERSION}. This preview
        compares existing Camera title, prompt, compact text, tags, description
        and notes. Only selected missing entries can be added; equivalent or
        ambiguous records are skipped.
      </p>
      <p className="muted-text">
        Existing IDs, prompts, media and scene snapshots are preserved. No image
        or video is created. These planning descriptors are untested in external
        generators.
      </p>
      <div className="cinema-pack-rows">
        {rows.map((row) => (
          <article className="cinema-pack-row" key={row.preset.techniqueId}>
            <label className="cinema-inline-check">
              <input
                type="checkbox"
                aria-label={`Install ${row.preset.title}`}
                disabled={busy || Boolean(result) || row.state !== "available"}
                checked={
                  row.state === "available" &&
                  selected.includes(row.preset.techniqueId)
                }
                onChange={(e) =>
                  setSelected((current) =>
                    e.target.checked
                      ? [...current, row.preset.techniqueId]
                      : current.filter((id) => id !== row.preset.techniqueId),
                  )
                }
              />
              <strong>{row.preset.title}</strong>
              <span className="badge">{row.state}</span>
            </label>
            <p className="muted-text">{row.reason}</p>
            <details>
              <summary>Review preset and matching IDs</summary>
              <pre>{row.preset.promptText}</pre>
              {row.matchingAssetIds.length > 0 && (
                <p>Existing asset IDs: {row.matchingAssetIds.join(", ")}</p>
              )}
            </details>
          </article>
        ))}
      </div>
      {!result && (
        <label className="cinema-inline-check cinema-pack-ack">
          <input
            type="checkbox"
            checked={ack}
            disabled={busy}
            onChange={(e) => setAck(e.target.checked)}
          />{" "}
          I reviewed the missing entries and want to add them without replacing
          existing records.
        </label>
      )}
      {result && (
        <p role="status">
          Complete. Added {result.added.length} preset(s); skipped{" "}
          {result.skipped.length} existing or ambiguous match(es). Existing
          records were preserved. Reopening this preview will not automatically
          install anything.
        </p>
      )}
      {error && (
        <p role="alert" className="cinema-error">
          {error} No preset was overwritten. Review the current preview before
          retrying.
        </p>
      )}
    </StudioDialog>
  );
};
