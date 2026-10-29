import React, { useId, useMemo, useState } from "react";
import type { ComponentSnapshot, PromptAsset, ShotType } from "../types/domain";
import type {
  CameraCompositionChoice,
  CameraMotionParameters,
} from "../types/cinematography";
import {
  CINEMATOGRAPHY_TECHNIQUES,
  getCinematographyTechnique,
  type CameraDimension,
} from "../domain/cinematographyRegistry";
import {
  applyCameraComposition,
  CAMERA_DIMENSION_LABELS,
  getCameraCompositionWarnings,
  BUILTIN_CAMERA_BLUEPRINT,
} from "../domain/cameraComposition";
import { CAMERA_PARAMETER_DEFINITIONS } from "../domain/cameraCompositionParameters";
import { createSnapshotFromAsset } from "../domain/promptAssembler";
import { StudioDialog } from "./StudioDialog";
import { CinematographyTabs } from "./CinematographyTabs";
import "./cinematography.css";
export interface CameraComposerProps {
  snapshot?: ComponentSnapshot;
  assets: PromptAsset[];
  shotType?: ShotType;
  durationSeconds?: number;
  sceneInstructions?: string;
  initialTechniqueId?: string;
  onApply: (snapshot: ComponentSnapshot | undefined) => Promise<void> | void;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement>;
}
export const CameraComposer: React.FC<CameraComposerProps> = ({
  snapshot,
  assets,
  shotType = "character_scene",
  durationSeconds,
  sceneInstructions,
  initialTechniqueId,
  onApply,
  onClose,
  returnFocusRef,
}) => {
  const tabId = useId();
  const [base, setBase] = useState(snapshot),
    [choice, setChoice] = useState<CameraCompositionChoice>(() => {
      const existing = snapshot?.cameraComposition;
      return {
        version: 1,
        techniqueIds: [
          ...new Set([
            ...(existing?.techniqueIds ?? []),
            ...(initialTechniqueId ? [initialTechniqueId] : []),
          ]),
        ],
        parameters: existing?.parameters,
        arrangement: existing?.arrangement,
        includeBaseText: existing?.includeBaseText,
      };
    }),
    [tab, setTab] = useState<"basics" | "motion" | "advanced">("basics"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const sourceBased =
    shotType === "graphic_motion" || shotType === "existing_footage";
  const preview = useMemo(() => {
    try {
      return { snapshot: applyCameraComposition(base, choice), error: "" };
    } catch (e) {
      return {
        snapshot: base,
        error:
          e instanceof Error ? e.message : "Cannot compose Camera directions.",
      };
    }
  }, [base, choice]);
  const priorOverride = base?.cameraComposition
    ? base.cameraComposition.baselineOverrideText
    : base?.overrideText;
  const text =
      preview.snapshot?.overrideText ?? preview.snapshot?.promptText ?? "",
    advice = getCameraCompositionWarnings(choice, {
      shotType,
      durationSeconds,
      sceneInstructions,
      baseCameraText: priorOverride ?? base?.promptText,
    });
  const options = (dimension: CameraDimension) =>
    CINEMATOGRAPHY_TECHNIQUES.filter(
      (t) =>
        t.dimension === dimension &&
        t.owner === "camera" &&
        t.kind === "technique" &&
        t.shotTypes.includes(shotType),
    );
  const selected = (dimension: CameraDimension) =>
    choice.techniqueIds.filter(
      (id) => getCinematographyTechnique(id)?.dimension === dimension,
    );
  const setDimension = (dimension: CameraDimension, value: string) =>
    setChoice((current) => ({
      ...current,
      techniqueIds: [
        ...current.techniqueIds.filter(
          (id) => getCinematographyTechnique(id)?.dimension !== dimension,
        ),
        ...(value ? [value] : []),
      ],
    }));
  const dimension = (
    name: CameraDimension,
    label = CAMERA_DIMENSION_LABELS[name],
  ) => {
    const current = selected(name)[0] ?? "",
      entries = options(name);
    return (
      <label className="cinema-field" key={name}>
        {label}
        <select
          className="select"
          value={current}
          onChange={(e) => setDimension(name, e.target.value)}
        >
          <option value="">Unspecified</option>
          {current && !entries.some((t) => t.id === current) && (
            <option value={current}>
              {getCinematographyTechnique(current)?.name ?? current} (review
              Shot Type)
            </option>
          )}
          {entries.map((t) => (
            <option value={t.id} key={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
    );
  };
  const movement = (secondary: boolean) => {
    const current = selected("movement")[secondary ? 1 : 0] ?? "",
      entries = options("movement");
    return (
      <label className="cinema-field">
        {secondary ? "Secondary movement" : "Primary movement"}
        <select
          className="select"
          value={current}
          onChange={(e) =>
            setChoice((prior) => {
              const moves = prior.techniqueIds.filter(
                  (id) =>
                    getCinematographyTechnique(id)?.dimension === "movement",
                ),
                others = prior.techniqueIds.filter(
                  (id) =>
                    getCinematographyTechnique(id)?.dimension !== "movement",
                );
              moves[secondary ? 1 : 0] = e.target.value;
              return {
                ...prior,
                techniqueIds: [...others, ...new Set(moves.filter(Boolean))],
              };
            })
          }
        >
          <option value="">Unspecified</option>
          {current && !entries.some((t) => t.id === current) && (
            <option value={current}>
              {getCinematographyTechnique(current)?.name} (review Shot Type)
            </option>
          )}
          {entries.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
    );
  };
  const setParameter = (
    key: keyof CameraMotionParameters,
    value: string,
    type: "text" | "number",
  ) =>
    setChoice((prior) => {
      const parameters = { ...prior.parameters };
      if (value === "") delete parameters[key];
      else if (type === "number")
        Object.assign(parameters, { [key]: Number(value) });
      else Object.assign(parameters, { [key]: value });
      return { ...prior, parameters };
    });
  const parameters = (advanced: boolean) =>
    CAMERA_PARAMETER_DEFINITIONS.filter(
      (d) =>
        Boolean(d.advanced) === advanced &&
        (!sourceBased ||
          !["travelDistanceMetres", "arcRadiusMetres"].includes(d.key)),
    ).map((d) => (
      <label className="cinema-field" key={d.key}>
        {d.label}
        {d.unit ? ` (${d.unit})` : ""}
        <input
          className="input"
          type={d.type === "number" ? "number" : "text"}
          value={choice.parameters?.[d.key] ?? ""}
          min={d.min}
          max={d.max}
          step={d.type === "number" ? "any" : undefined}
          maxLength={d.type === "text" ? 500 : undefined}
          placeholder="Unspecified"
          onChange={(e) => setParameter(d.key, e.target.value, d.type)}
        />
      </label>
    ));
  const apply = async () => {
    if (preview.error || busy) return;
    setBusy(true);
    setError("");
    try {
      await onApply(preview.snapshot);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save Camera directions. Your choices are still here.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <StudioDialog
      title="Compose Camera directions"
      size="wide"
      className="camera-composer"
      returnFocusRef={returnFocusRef}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => setChoice({ version: 1, techniqueIds: [] })}
          >
            Reset to Unspecified
          </button>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || Boolean(preview.error)}
            onClick={() => void apply()}
          >
            {busy ? "Saving Camera…" : "Apply Camera directions"}
          </button>
        </>
      }
    >
      <p className="muted-text">
        Scene-only directions. Your library preset, other recipe layers and
        source files stay unchanged. Technical values are descriptors for an
        external tool, not verified equipment controls.
      </p>
      {sourceBased && (
        <p className="cinema-source-note">
          A flat source is not a modeled 3D environment. Use source-preserving
          reframing or editing; do not invent physical parallax or new
          architecture.
        </p>
      )}
      <div className="camera-composer-layout">
        <div className="camera-composer-controls">
          <fieldset disabled={busy}>
            <legend>Camera preset and scene attributes</legend>
            <label className="cinema-field">
              Reusable Camera preset
              <select
                className="select"
                value={
                  base?.sourceType === "asset"
                    ? base.sourceId
                    : base && base.sourceId !== BUILTIN_CAMERA_BLUEPRINT
                      ? "current"
                      : "scene-only"
                }
                onChange={(e) => {
                  if (e.target.value === "current") setBase(snapshot);
                  else {
                    const asset = assets.find((a) => a.id === e.target.value);
                    setBase(asset ? createSnapshotFromAsset(asset) : undefined);
                  }
                }}
              >
                <option value="scene-only">
                  Unspecified — scene-only composition
                </option>
                {base?.sourceType !== "asset" &&
                  base &&
                  base.sourceId !== BUILTIN_CAMERA_BLUEPRINT && (
                    <option value="current">{base.sourceTitle}</option>
                  )}
                {base?.sourceType === "asset" &&
                  !assets.some((a) => a.id === base.sourceId) && (
                    <option value={base.sourceId}>{base.sourceTitle}</option>
                  )}
                {assets
                  .filter((a) => a.category === "camera")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
              </select>
            </label>
            <label className="cinema-inline-check">
              <input
                type="checkbox"
                checked={choice.includeBaseText !== false}
                onChange={(e) =>
                  setChoice((c) => ({
                    ...c,
                    includeBaseText: e.target.checked,
                  }))
                }
              />{" "}
              Include preset / prior Camera text
            </label>
            <CinematographyTabs
              id={tabId}
              label="Camera composer sections"
              value={tab}
              onChange={(value) => setTab(value as typeof tab)}
              tabs={[
                { value: "basics", label: "Framing" },
                { value: "motion", label: "Motion" },
                { value: "advanced", label: "Advanced" },
              ]}
            />
            {tab === "basics" && (
              <div
                role="tabpanel"
                id={`${tabId}-basics-panel`}
                aria-labelledby={`${tabId}-basics`}
                className="cinema-form-grid"
              >
                {sourceBased
                  ? dimension("graphics")
                  : [
                      "shotSize",
                      "height",
                      "angle",
                      "orientation",
                      "framing",
                      "lens",
                      "focus",
                    ].map((name) => dimension(name as CameraDimension))}
                <label className="cinema-field">
                  Add composition technique
                  <select
                    className="select"
                    value=""
                    onChange={(e) => {
                      if (e.target.value)
                        setChoice((c) => ({
                          ...c,
                          techniqueIds: [
                            ...new Set([...c.techniqueIds, e.target.value]),
                          ],
                        }));
                    }}
                  >
                    <option value="">Unspecified</option>
                    {options("composition")
                      .filter((t) => !choice.techniqueIds.includes(t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            )}
            {tab === "motion" && (
              <div
                role="tabpanel"
                id={`${tabId}-motion-panel`}
                aria-labelledby={`${tabId}-motion`}
              >
                <div className="cinema-form-grid">
                  {movement(false)}
                  {movement(true)}
                  <label className="cinema-field">
                    Movement arrangement
                    <select
                      className="select"
                      value={choice.arrangement ?? "simultaneous"}
                      onChange={(e) =>
                        setChoice((c) => ({
                          ...c,
                          arrangement: e.target
                            .value as CameraCompositionChoice["arrangement"],
                        }))
                      }
                    >
                      <option value="simultaneous">
                        Same phase — review conflicts
                      </option>
                      <option value="compound">
                        Intentional compound move
                      </option>
                      <option value="sequence">Sequential phases</option>
                    </select>
                  </label>
                </div>
                <details className="cinema-control-details">
                  <summary>Optional motion parameters</summary>
                  <div className="cinema-form-grid">{parameters(false)}</div>
                </details>
              </div>
            )}
            {tab === "advanced" && (
              <div
                role="tabpanel"
                id={`${tabId}-advanced-panel`}
                aria-labelledby={`${tabId}-advanced`}
              >
                <div className="cinema-form-grid">
                  {(
                    [
                      "rig",
                      "capture",
                      "specialized",
                      "property",
                      ...(sourceBased ? [] : ["graphics"]),
                    ] as CameraDimension[]
                  ).map((name) => dimension(name))}
                </div>
                <details className="cinema-control-details">
                  <summary>Optional lens and capture descriptors</summary>
                  <div className="cinema-form-grid">{parameters(true)}</div>
                </details>
              </div>
            )}
            {choice.techniqueIds.length > 0 && (
              <div
                className="cinema-selected"
                aria-label="Selected Camera techniques"
              >
                {choice.techniqueIds.map((id) => (
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    key={id}
                    aria-label={`Remove ${getCinematographyTechnique(id)?.name ?? id}`}
                    onClick={() =>
                      setChoice((c) => ({
                        ...c,
                        techniqueIds: c.techniqueIds.filter((v) => v !== id),
                      }))
                    }
                  >
                    {getCinematographyTechnique(id)?.name ?? id} ×
                  </button>
                ))}
              </div>
            )}
          </fieldset>
        </div>
        <div className="camera-composer-preview">
          <h3>Live Camera text</h3>
          <pre
            role="region"
            aria-label="Complete Camera text preview"
            tabIndex={0}
          >
            {text || "Unspecified — no scene Camera directions."}
          </pre>
          <details>
            <summary>Original preset and prior scene text</summary>
            <p className="muted-text">
              {base?.sourceTitle ?? "No reusable preset selected"}
            </p>
            <pre>{base?.promptText || "No original preset text."}</pre>
            {priorOverride !== undefined && <pre>{priorOverride}</pre>}
          </details>
          {advice.length > 0 && (
            <aside
              className="cinema-advice"
              aria-label="Camera compatibility advice"
            >
              <h3>Review these directions</h3>
              {advice.map((w) => (
                <div key={w.id}>
                  <strong>{w.title}</strong>
                  <p>{w.explanation}</p>
                </div>
              ))}
            </aside>
          )}
          <p className="muted-text">
            No advisory checks can guarantee a consistent result. Original media
            and required components are still checked by Preflight.
          </p>
        </div>
      </div>
      {(error || preview.error) && (
        <p role="alert" className="cinema-error">
          {error || preview.error}
        </p>
      )}
    </StudioDialog>
  );
};
