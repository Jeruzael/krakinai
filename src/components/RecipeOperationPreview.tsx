import React, { useState } from "react";
import type { OutputMode } from "../types/domain";
import type {
  ChangeSet,
  ChangeSetApproval,
  ChangeSetPlan,
  ImportFinding,
  ImportOperationPreview,
  RecipeSceneOperation,
  CandidateDecision,
} from "../types/changeSet";
import type { LibrarySnapshot } from "../storage/db";
import type { RecipeResolvedPreview } from "../domain/changeSetRecipe";
import { ORDERED_BUILDER_SLOTS } from "../domain/promptAssembler";
import { SLOT_LABELS } from "../domain/validation";
import { CinematographyTabs } from "./CinematographyTabs";
import { EnsembleSummary } from './EnsembleSummary';
import {
  analyzeProposalCandidateBlockers,
  buildBulkCreateApproval,
  applyCandidateDecisionWithSafeguards,
} from "../domain/proposalReadiness";
const modes = [
  { value: "full", label: "Full" },
  { value: "structured", label: "Structured" },
  { value: "compact", label: "Compact" },
];
export function RecipeOperationPreview({
  row,
  changeSet,
  approval,
  plan,
  findings,
  view='all',
  snapshot,
  disabled = false,
  onApproval,
  onSelectOperation,
}: {
  row: ImportOperationPreview;
  changeSet: ChangeSet;
  approval: ChangeSetApproval;
  plan?: ChangeSetPlan;
  findings: ImportFinding[];
  view?:'all'|'components'|'outputs';
  snapshot?: LibrarySnapshot;
  disabled?: boolean;
  onApproval?: (value: ChangeSetApproval) => void;
  onSelectOperation?: (operationId: string) => void;
}) {
  const [mode, setMode] = useState<OutputMode>("full"),
    [status, setStatus] = useState("");
  const operation = row.details as RecipeSceneOperation,
    resolved = (row.resolved as { recipe?: RecipeResolvedPreview } | undefined)
      ?.recipe;
  const outputs = resolved?.outputs,
    label = modes.find((m) => m.value === mode)!.label,
    id = `recipe-output-${row.operationId}`;

  const effectivePreview = { changeSet, approval, plan: plan ?? { operations: [] } } as any;
  const candidateAnalysis = analyzeProposalCandidateBlockers(effectivePreview, snapshot);
  const sceneCandidateOpIds = candidateAnalysis.referencedCandidateOpIdsByScene[operation.operationId] ?? [];
  const sceneCandidates = sceneCandidateOpIds.map(opId => candidateAnalysis.byOperationId[opId]).filter(Boolean);
  const deferredSceneCandidates = sceneCandidates.filter(c => c.decision.action === 'defer');
  const bulkCreatableForScene = deferredSceneCandidates.filter(c => c.canBulkCreate);
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
      {deferredSceneCandidates.length > 0 && (
        <div className="banner banner-warning pr-scene-dependency-banner">
          <div>
            <strong>This scene depends on {deferredSceneCandidates.length} deferred candidate proposal(s).</strong>
            <p className="muted-text">Approve or reuse them to unblock assembly for this scene.</p>
          </div>
          {bulkCreatableForScene.length > 0 && onApproval && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={disabled}
              onClick={() => onApproval(buildBulkCreateApproval(effectivePreview, snapshot, bulkCreatableForScene.map(c => c.operationId)))}
            >
              Approve scene candidates ({bulkCreatableForScene.length})
            </button>
          )}
        </div>
      )}
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
      {view!=='outputs'&&<><div className="import-recipe-components">
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
                    ) : ((slot === 'character' || slot === 'wardrobe') && !requested && !variant && !!operation.ensemble) ? (
                      <span>
                        Managed by Ensemble Cast ({operation.ensemble?.participantUpserts?.length ?? (resolved?.ensemble as any)?.participants?.length ?? 0} participant(s))
                      </span>
                    ) : (requested && 'ref' in requested.asset && (candidateAnalysis.byClientRef[requested.asset.ref] ?? candidateAnalysis.byOperationId[requested.asset.ref])) ? (() => {
                      const producer = candidateAnalysis.byClientRef[(requested.asset as { ref: string }).ref] ?? candidateAnalysis.byOperationId[(requested.asset as { ref: string }).ref];
                      return (
                        <div className="pr-inline-candidate-cell">
                          <strong>{producer.title}</strong>
                          <code>ref:{(requested.asset as { ref: string }).ref}</code>
                          {onApproval && (
                            <div className="pr-inline-candidate-controls">
                              {producer.canBulkCreate && producer.decision.action === 'defer' && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  disabled={disabled}
                                  onClick={() => onApproval(buildBulkCreateApproval(effectivePreview, snapshot, [producer.operationId]))}
                                >
                                  Approve Create
                                </button>
                              )}
                              {onSelectOperation && (!producer.canBulkCreate || producer.decision.action === 'reuse') && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => onSelectOperation(producer.operationId)}
                                >
                                  Review {producer.operationId}
                                </button>
                              )}
                              <select
                                aria-label={`Inline decision for ${producer.operationId}`}
                                className="select select-sm"
                                disabled={disabled}
                                value={producer.decision.action}
                                onChange={e => {
                                  const act = e.target.value as CandidateDecision['action'];
                                  if (act === 'reuse') {
                                    if (onSelectOperation) onSelectOperation(producer.operationId);
                                    return;
                                  }
                                  const nextAsset = { ...approval.assetDecisions, [producer.operationId]: { action: act } };
                                  onApproval(applyCandidateDecisionWithSafeguards(changeSet, approval, nextAsset, approval.variantDecisions));
                                }}
                              >
                                <option value="defer">Keep pending</option>
                                <option value="create">Create new</option>
                                <option value="reuse">Reuse existing (in rail)</option>
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })() : requested ? (
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
                      : ((slot === 'character' || slot === 'wardrobe') && !component && !requested && !variant && !!operation.ensemble)
                        ? "Ensemble active"
                        : (requested && 'ref' in requested.asset && (candidateAnalysis.byClientRef[requested.asset.ref] ?? candidateAnalysis.byOperationId[requested.asset.ref]))
                          ? (() => {
                              const producer = candidateAnalysis.byClientRef[(requested.asset as { ref: string }).ref] ?? candidateAnalysis.byOperationId[(requested.asset as { ref: string }).ref];
                              return producer.decision.action === 'create'
                                ? "Will create"
                                : producer.decision.action === 'reuse'
                                  ? "Will reuse"
                                  : "Unresolved candidate";
                            })()
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
      {operation.ensemble?.participantUpserts && operation.ensemble.participantUpserts.length > 0 && (
        <section className="pr-ensemble-candidates" aria-label="Ensemble candidate bindings">
          <h4>Ensemble candidate bindings</h4>
          <p className="muted-text">
            Review character identities and wardrobe bindings for each participant in this scene.
          </p>
          <table className="table" aria-label="Ensemble participant bindings">
            <thead>
              <tr>
                <th scope="col">Participant</th>
                <th scope="col">Character target</th>
                <th scope="col">Wardrobe target</th>
              </tr>
            </thead>
            <tbody>
              {operation.ensemble.participantUpserts.map(p => {
                const charRef = p.character?.asset && 'ref' in p.character.asset ? p.character.asset.ref : undefined;
                const charCand = charRef ? (candidateAnalysis.byClientRef[charRef] ?? candidateAnalysis.byOperationId[charRef]) : undefined;
                const wardRef = p.wardrobe ? ('asset' in p.wardrobe && p.wardrobe.asset && 'ref' in p.wardrobe.asset ? p.wardrobe.asset.ref : 'variant' in p.wardrobe && p.wardrobe.variant && 'ref' in p.wardrobe.variant ? p.wardrobe.variant.ref : 'ref' in p.wardrobe ? (p.wardrobe as any).ref : undefined) : undefined;
                const wardCand = wardRef ? (candidateAnalysis.byClientRef[wardRef] ?? candidateAnalysis.byOperationId[wardRef]) : undefined;

                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.id}</strong>
                      {p.role && <small>{p.role}</small>}
                      {p.presence && <span className="badge badge-secondary">{p.presence}</span>}
                    </td>
                    <td>
                      {charCand ? (
                        <div className="pr-inline-candidate-cell">
                          <strong>{charCand.title}</strong>
                          <code>ref:{charRef}</code>
                          {onApproval && (
                            <div className="pr-inline-candidate-controls">
                              {charCand.canBulkCreate && charCand.decision.action === 'defer' && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  disabled={disabled}
                                  onClick={() => onApproval(buildBulkCreateApproval(effectivePreview, snapshot, [charCand.operationId]))}
                                >
                                  Approve Create
                                </button>
                              )}
                              {onSelectOperation && (!charCand.canBulkCreate || charCand.decision.action === 'reuse') && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => onSelectOperation(charCand.operationId)}
                                >
                                  Review {charCand.operationId}
                                </button>
                              )}
                              <select
                                aria-label={`Inline decision for ${charCand.operationId}`}
                                className="select select-sm"
                                disabled={disabled}
                                value={charCand.decision.action}
                                onChange={e => {
                                  const act = e.target.value as CandidateDecision['action'];
                                  if (act === 'reuse') {
                                    if (onSelectOperation) onSelectOperation(charCand.operationId);
                                    return;
                                  }
                                  const nextAsset = { ...approval.assetDecisions, [charCand.operationId]: { action: act } };
                                  onApproval(applyCandidateDecisionWithSafeguards(changeSet, approval, nextAsset, approval.variantDecisions));
                                }}
                              >
                                <option value="defer">Keep pending</option>
                                <option value="create">Create new</option>
                                <option value="reuse">Reuse existing (in rail)</option>
                              </select>
                            </div>
                          )}
                        </div>
                      ) : (
                        <code>{p.character?.asset && 'id' in p.character.asset ? p.character.asset.id : 'Unassigned'}</code>
                      )}
                    </td>
                    <td>
                      {wardCand ? (
                        <div className="pr-inline-candidate-cell">
                          <strong>{wardCand.title}</strong>
                          <code>ref:{wardRef}</code>
                          {onApproval && (
                            <div className="pr-inline-candidate-controls">
                              {wardCand.canBulkCreate && wardCand.decision.action === 'defer' && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  disabled={disabled}
                                  onClick={() => onApproval(buildBulkCreateApproval(effectivePreview, snapshot, [wardCand.operationId]))}
                                >
                                  Approve Create
                                </button>
                              )}
                              {onSelectOperation && (!wardCand.canBulkCreate || wardCand.decision.action === 'reuse') && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => onSelectOperation(wardCand.operationId)}
                                >
                                  Review {wardCand.operationId}
                                </button>
                              )}
                              <select
                                aria-label={`Inline decision for ${wardCand.operationId}`}
                                className="select select-sm"
                                disabled={disabled}
                                value={wardCand.decision.action}
                                onChange={e => {
                                  const act = e.target.value as CandidateDecision['action'];
                                  if (act === 'reuse') {
                                    if (onSelectOperation) onSelectOperation(wardCand.operationId);
                                    return;
                                  }
                                  if (wardCand.kind === 'variant') {
                                    const nextVar = { ...(approval.variantDecisions ?? {}), [wardCand.operationId]: { action: act } };
                                    onApproval(applyCandidateDecisionWithSafeguards(changeSet, approval, approval.assetDecisions, nextVar));
                                  } else {
                                    const nextAsset = { ...approval.assetDecisions, [wardCand.operationId]: { action: act } };
                                    onApproval(applyCandidateDecisionWithSafeguards(changeSet, approval, nextAsset, approval.variantDecisions));
                                  }
                                }}
                              >
                                <option value="defer">Keep pending</option>
                                <option value="create">Create new</option>
                                <option value="reuse">Reuse existing (in rail)</option>
                              </select>
                            </div>
                          )}
                        </div>
                      ) : (
                        <code>{p.wardrobe ? ('asset' in p.wardrobe && p.wardrobe.asset && 'id' in p.wardrobe.asset ? p.wardrobe.asset.id : 'variant' in p.wardrobe && p.wardrobe.variant && 'id' in p.wardrobe.variant ? p.wardrobe.variant.id : 'None') : 'None'}</code>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
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
      </>}
      {view!=='components'&&outputs && (
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
