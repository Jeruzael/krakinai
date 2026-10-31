import React, { useState } from "react";
import type { OutputMode } from "../types/domain";
import type {
  ChangeSet,
  ChangeSetApproval,
  ImportFinding,
  ImportOperationPreview,
  RecipeSceneOperation,
} from "../types/changeSet";
import type { RecipeResolvedPreview } from "../domain/changeSetRecipe";
import { ORDERED_BUILDER_SLOTS } from "../domain/promptAssembler";
import { SLOT_LABELS } from "../domain/validation";
import { CinematographyTabs } from "./CinematographyTabs";
import { EnsembleSummary } from './EnsembleSummary';
const modes = [
  { value: "full", label: "Full" },
  { value: "structured", label: "Structured" },
  { value: "compact", label: "Compact" },
];
export function RecipeOperationPreview({
  row,
  changeSet,
  approval,
  findings,
}: {
  row: ImportOperationPreview;
  changeSet: ChangeSet;
  approval: ChangeSetApproval;
  findings: ImportFinding[];
}) {
  const [mode, setMode] = useState<OutputMode>("full"),
    [status, setStatus] = useState("");
  const operation = row.details as RecipeSceneOperation,
    resolved = (row.resolved as { recipe?: RecipeResolvedPreview } | undefined)
      ?.recipe;
  const outputs = resolved?.outputs,
    label = modes.find((m) => m.value === mode)!.label,
    id = `recipe-output-${row.operationId}`;
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw Error();
      await navigator.clipboard.writeText(outputs?.[mode] ?? "");
      setStatus(`${label} recipe copied in full.`);
    } catch {
      setStatus(
        "Copy failed. Select the complete text below and copy it manually.",
      );
    }
  };
  const sourceFor = (slot: string) => {
    const link = operation.assetRefs?.find((l) => l.slot === slot);
    if (link && "ref" in link.asset) {
      const ref = link.asset.ref,
        producer = changeSet.operations.find((o) => o.clientRef === ref),
        decision = producer && approval.assetDecisions[producer.operationId];
      return decision?.action === "create"
        ? "Candidate → create on Apply"
        : decision?.action === "reuse"
          ? "Candidate → reuse on Apply"
          : "Deferred candidate";
    }
    if (operation.variantRefs?.some((l) => l.slot === slot))
      return "Stored variant";
    if (link) return "Stored asset";
    return "sceneId" in operation
      ? "Frozen parent snapshot"
      : "Scene-only component";
  };
  return (
    <section
      className="import-recipe-preview"
      aria-label="Recipe operation details"
    >
      <p className={outputs ? "banner banner-info" : "banner banner-warning"}>
        {outputs
          ? resolved?.readiness === "assembled_pending"
            ? "Assembled with pending production inputs."
            : resolved?.readiness === "blocked"
              ? "Assembled; explicit manual-output acknowledgement is required before Apply."
              : "Assembled recipe ready for your review."
          : "Assembly blocked. No scene will be saved. Download this package to complete it later."}
      </p>
      {resolved?.previousEnsemble&&<details><summary>Previous frozen participants and cues (unchanged)</summary><EnsembleSummary ensemble={resolved.previousEnsemble} label="Previous ensemble"/></details>}
      {resolved?.ensemble&&<EnsembleSummary ensemble={resolved.ensemble}/>}
      {!resolved?.ensemble&&operation.ensemble&&<details><summary>Unresolved participant and cue requests</summary><pre>{JSON.stringify(operation.ensemble,null,2)}</pre></details>}
      <div className="import-recipe-components">
        <table aria-label="Resolved recipe components">
          <thead>
            <tr>
              <th scope="col">Component</th>
              <th scope="col">Source / revision</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {ORDERED_BUILDER_SLOTS.map((slot) => {
              const component = resolved?.components[slot],
                requested = operation.assetRefs?.find((l) => l.slot === slot),
                variant = operation.variantRefs?.find((l) => l.slot === slot);
              return (
                <tr key={slot}>
                  <th scope="row">{SLOT_LABELS[slot]}</th>
                  <td>
                    {component ? (
                      <>
                        <strong>{component.sourceTitle}</strong>
                        <code>
                          {component.sourceId} · rev {component.sourceRevision}
                        </code>
                        <small>{sourceFor(slot)}</small>
                        <details>
                          <summary>{SLOT_LABELS[slot]} prompt details</summary>
                          <label>
                            {SLOT_LABELS[slot]} base prompt
                            <textarea
                              readOnly
                              rows={4}
                              value={component.promptText}
                            />
                          </label>
                          {component.overrideText !== undefined && (
                            <label>
                              {SLOT_LABELS[slot]} scene override
                              <textarea
                                readOnly
                                rows={4}
                                value={component.overrideText}
                              />
                            </label>
                          )}
                          {component.overrideCompactText !== undefined && (
                            <label>
                              {SLOT_LABELS[slot]} compact override
                              <textarea
                                readOnly
                                rows={3}
                                value={component.overrideCompactText}
                              />
                            </label>
                          )}
                          {component.mediaLinks.map((link, index) => (
                            <p key={index}>
                              <code>{link.mediaId}</code> · {link.role} ·{" "}
                              {link.altText}
                            </p>
                          ))}
                        </details>
                      </>
                    ) : requested ? (
                      <code>
                        {"id" in requested.asset
                          ? requested.asset.id
                          : `ref:${requested.asset.ref}`}{" "}
                        · unresolved
                      </code>
                    ) : variant ? (
                      <code>{variant.variantId} · unresolved</code>
                    ) : (
                      "Unassigned"
                    )}
                  </td>
                  <td>
                    {resolved?.inactiveSlots.includes(slot)
                      ? "Inactive for Shot Type"
                      : component?.overrideText !== undefined ||
                          component?.cameraComposition
                        ? "Scene override"
                        : component
                          ? "Selected"
                          : requested || variant
                            ? "Unresolved"
                            : "Not selected"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {resolved?.inactiveSlots.length ? (
        <p className="banner banner-warning">
          Shot Type makes these inherited components inactive in the new scene:{" "}
          {resolved.inactiveSlots.map((s) => SLOT_LABELS[s]).join(", ")}. The
          old scene keeps its snapshots.
        </p>
      ) : null}
      {resolved?.manualOutputsDiscarded && (
        <p className="banner banner-warning">
          The proposed outputs reassemble the recipe and discard manual output
          overrides. The saved parent remains unchanged.
        </p>
      )}
      {findings.length > 0 && (
        <ul aria-label="Recipe readiness findings">
          {findings.map((finding, index) => (
            <li key={index}>{finding.message}</li>
          ))}
        </ul>
      )}
      {resolved && (
        <details>
          <summary>Instructions, dialogue and shot settings</summary>
          <pre>
            {JSON.stringify(
              {
                shotType: resolved.shotType,
                settings: resolved.settings,
                sceneInstructions: resolved.sceneInstructions,
                avoidText: resolved.avoidText,
                dialogue: resolved.dialogue,
                generation: resolved.generation,
              },
              null,
              2,
            )}
          </pre>
        </details>
      )}
      <details>
        <summary>Originals and pending production inputs</summary>
        <pre>
          {JSON.stringify(
            {
              sourceMedia: resolved?.sourceMediaLinks ?? operation.sourceMedia,
              pendingInputs: resolved?.pendingInputs ?? operation.pendingInputs,
              references: operation.references,
              referencePack: resolved?.referencePack,
            },
            null,
            2,
          )}
        </pre>
        <p className="muted-text">
          Required originals must exist in Source Media before assembly. Add the
          actual file, update its sourceMedia ID in this package and preview
          again. Optional reference guides never replace a required original.
        </p>
      </details>
      {outputs && (
        <div className="import-recipe-outputs">
          <CinematographyTabs
            id={id}
            label="Recipe assembled outputs"
            value={mode}
            tabs={modes}
            onChange={(value) => {
              setMode(value as OutputMode);
              setStatus("");
            }}
          />
          {modes.map((tab) => (
            <section
              key={tab.value}
              role="tabpanel"
              hidden={mode !== tab.value}
              id={`${id}-${tab.value}-panel`}
              aria-labelledby={`${id}-${tab.value}`}
            >
              <div className="import-buttons">
                <p className="muted-text">
                  Complete assembler text; the viewer scrolls without truncating
                  the copy.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void copy()}
                >
                  Copy {tab.label} recipe
                </button>
              </div>
              <label>
                Recipe {tab.label} output {row.operationId}
                <textarea
                  readOnly
                  rows={10}
                  value={outputs[tab.value as OutputMode] ?? ""}
                />
              </label>
              <p role="status">{mode === tab.value ? status : ""}</p>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
