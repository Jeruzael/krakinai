import { requiresStoryboardApproval } from "../domain/changeSetLedger";
import React, { useState } from "react";
import type {
  ChangeSetApproval,
  ChangeSetPreview as Preview,
  CandidateDecision,
} from "../types/changeSet";
import type { LibrarySnapshot } from "../storage/db";
import { CANDIDATE_CATEGORY } from "../domain/changeSetCandidates";
import { StudioDialog } from "./StudioDialog";
import { isRecipeOperation } from "../types/changeSet";
import { RecipeOperationPreview } from "./RecipeOperationPreview";
import { downloadBlobAsFile } from "../hooks/useObjectUrl";
export function ChangeSetPreview({
  preview,
  snapshot,
  disabled,
  onApproval,
  headingRef,
}: {
  preview: Preview;
  snapshot: LibrarySnapshot;
  disabled: boolean;
  onApproval: (value: ChangeSetApproval) => void;
  headingRef?: React.RefObject<HTMLHeadingElement>;
}) {
  const [detail, setDetail] = useState<string>();
  const [downloadStatus, setDownloadStatus] = useState("");
  const { plan, approval, changeSet } = preview;
  const conflicts = plan.findings.filter(
    (f) => f.severity === "blocking" && !f.code.startsWith("APPROVAL_"),
  );
  const advisories = plan.findings.filter((f) => f.severity === "advisory");
  const requires = {
    storyboard: changeSet.operations.some(requiresStoryboardApproval),
    scenes: changeSet.operations.some((o) => o.type.startsWith("scene.")),
    preferred: changeSet.operations.some((o) => o.type === "shot.select_take"),
    statuses: changeSet.operations.some((o) => o.type === "shot.set_status"),
  };
  const assetOps = changeSet.operations.filter((o) =>
    o.type.startsWith("asset."),
  );
  const choice = (id: string, value: CandidateDecision) =>
    onApproval({
      ...approval,
      assetDecisions: { ...approval.assetDecisions, [id]: value },
    });
  const groups = [
    ["Projects", (t: string) => t.startsWith("project.")],
    [
      "Storyboard",
      (t: string) =>
        t.startsWith("shot.") &&
        !["shot.select_take", "shot.set_status"].includes(t),
    ],
    ["Scenes", (t: string) => t.startsWith("scene.")],
    ["Reusable candidates", (t: string) => t.startsWith("asset.")],
    [
      "Preference and status",
      (t: string) => ["shot.select_take", "shot.set_status"].includes(t),
    ],
  ] as const;
  const selected = plan.operations.find((o) => o.operationId === detail);
  const downloadPackage = () => {
    try {
      downloadBlobAsFile(
        new Blob([JSON.stringify(changeSet, null, 2) + "\n"], {
          type: "application/json",
        }),
        `krakinai-recipe-${changeSet.changeSetId.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`,
      );
      setDownloadStatus(
        "Recipe package download requested. It contains the complete versioned inputs and candidate proposals.",
      );
    } catch {
      setDownloadStatus(
        "Could not start the download. Your package remains in this preview; copy its JSON from the operation details or original editor.",
      );
    }
  };
  return (
    <>
      <section
        className="card import-summary"
        aria-label="Computed import summary"
      >
        <div>
          <h2 ref={headingRef} tabIndex={-1}>
            Change-set preview
          </h2>
          <p className="muted-text">
            {changeSet.title ?? changeSet.changeSetId}
          </p>
        </div>
        <dl>
          <div>
            <dt>New projects</dt>
            <dd>{plan.summary.projects}</dd>
          </div>
          <div>
            <dt>New shots</dt>
            <dd>{plan.summary.shots}</dd>
          </div>
          <div>
            <dt>New scenes</dt>
            <dd>{plan.summary.scenes}</dd>
          </div>
          <div>
            <dt>Planned runtime</dt>
            <dd>{plan.summary.plannedSeconds}s</dd>
          </div>
          <div>
            <dt>Pending inputs</dt>
            <dd>{plan.summary.pendingInputs}</dd>
          </div>
        </dl>
        <p
          className={conflicts.length ? "banner banner-warning" : "muted-text"}
        >
          {conflicts.length
            ? `${conflicts.length} blocking conflict(s). Resolve them before approval.`
            : "No blocking data conflicts."}{" "}
          Importing JSON does not approve it.
        </p>
        {changeSet.operations.some(isRecipeOperation) && (
          <div className="import-package-download">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={disabled}
              onClick={downloadPackage}
            >
              Download recipe package (JSON)
            </button>
            <p className="muted-text">
              A blocked package stays reviewable here. Download and re-import it
              after resolving missing inputs; no partial project, draft or scene
              is saved.
            </p>
            <p role="status">{downloadStatus}</p>
          </div>
        )}
      </section>
      <div className="import-preview-grid">
        <section
          className="card import-operations"
          aria-label="Proposed operations"
        >
          <h3>Review proposed changes</h3>
          {groups.map(([name, filter]) => {
            const rows = plan.operations.filter((o) => filter(o.type));
            return rows.length ? (
              <details className="import-group" key={name}>
                <summary>
                  {name} <span className="badge">{rows.length}</span>
                </summary>
                <div>
                  {rows.map((row) => (
                    <div className="import-operation" key={row.operationId}>
                      <div>
                        <strong>{row.summary}</strong>
                        <small>
                          {row.operationId}
                          {row.projectId ? ` · ${row.projectId}` : ""}
                          {row.shotId ? ` / ${row.shotId}` : ""}
                        </small>
                        {plan.findings.some(
                          (f) =>
                            f.operationId === row.operationId &&
                            f.severity === "blocking" &&
                            !f.code.startsWith("APPROVAL_"),
                        ) && (
                          <span className="badge badge-warning">Conflict</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setDetail(row.operationId)}
                      >
                        Review {row.operationId}
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            ) : null;
          })}
          {conflicts.length > 0 && (
            <section aria-label="Blocking conflicts">
              <h3>Conflicts</h3>
              <ul>
                {conflicts.map((f, i) => (
                  <li key={i}>
                    <strong>{f.operationId ?? "Batch"}:</strong> {f.message}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {advisories.length > 0 && (
            <details className="import-group">
              <summary>
                Advisories and missing future inputs ({advisories.length})
              </summary>
              <ul>
                {advisories.map((f, i) => (
                  <li key={i}>
                    {f.operationId}: {f.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
        <section
          className="card import-approvals"
          aria-label="Explicit import approvals"
        >
          <h3>Approve separately</h3>
          <p className="muted-text">
            These choices come from you. New prompts and library assets remain
            unreviewed.
          </p>
          {requires.storyboard && (
            <label className="import-check">
              <input
                type="checkbox"
                disabled={disabled}
                checked={approval.storyboard}
                onChange={(e) =>
                  onApproval({ ...approval, storyboard: e.target.checked })
                }
              />
              Approve storyboard changes
            </label>
          )}
          {requires.scenes && (
            <label className="import-check">
              <input
                type="checkbox"
                disabled={disabled}
                checked={approval.scenes}
                onChange={(e) =>
                  onApproval({ ...approval, scenes: e.target.checked })
                }
              />
              Approve new immutable scenes
            </label>
          )}
          {requires.preferred && (
            <label className="import-check">
              <input
                type="checkbox"
                disabled={disabled}
                checked={approval.preferred}
                onChange={(e) =>
                  onApproval({ ...approval, preferred: e.target.checked })
                }
              />
              Approve preferred take changes
            </label>
          )}
          {requires.statuses && (
            <label className="import-check">
              <input
                type="checkbox"
                disabled={disabled}
                checked={approval.statuses}
                onChange={(e) =>
                  onApproval({ ...approval, statuses: e.target.checked })
                }
              />
              Approve production status changes
            </label>
          )}
          {assetOps.length > 0 && (
            <details className="import-group">
              <summary>Reusable asset decisions ({assetOps.length})</summary>
              <p className="muted-text">
                Deferred proposals never install a library asset.
              </p>
              {assetOps.map((op) => {
                const candidate =
                  op.type === "asset.propose"
                    ? op
                    : op.type === "asset.review_candidate"
                      ? snapshot.preferences.aiImports?.candidates.find(
                          (c) => c.id === op.candidateId,
                        )
                      : undefined;
                const current = approval.assetDecisions[op.operationId] ?? {
                    action: "defer",
                  },
                  matches =
                    plan.operations.find(
                      (r) => r.operationId === op.operationId,
                    )?.matches ?? [];
                const available =
                  candidate?.kind === "template"
                    ? snapshot.templates.map((t) => ({
                        id: t.id,
                        title: t.name,
                        revision: t.revision,
                      }))
                    : snapshot.assets
                        .filter(
                          (a) =>
                            candidate &&
                            candidate.kind !== "template" &&
                            a.category === CANDIDATE_CATEGORY[candidate.kind],
                        )
                        .map((a) => ({
                          id: a.id,
                          title: a.title,
                          revision: a.revision,
                        }));
                return (
                  <div className="import-candidate" key={op.operationId}>
                    <strong>{candidate?.title ?? op.operationId}</strong>
                    <label>
                      Decision for {op.operationId}
                      <select
                        disabled={disabled}
                        value={current.action}
                        onChange={(e) =>
                          choice(op.operationId, {
                            action: e.target
                              .value as CandidateDecision["action"],
                          })
                        }
                      >
                        <option value="defer">Keep as pending proposal</option>
                        <option value="create">
                          Create new unreviewed library asset
                        </option>
                        <option value="reuse">Reuse an existing asset</option>
                      </select>
                    </label>
                    {current.action === "reuse" && (
                      <label>
                        Existing asset for {op.operationId}
                        <select
                          disabled={disabled}
                          value={current.assetId ?? ""}
                          onChange={(e) => {
                            const a = available.find(
                              (a) => a.id === e.target.value,
                            );
                            choice(op.operationId, {
                              action: "reuse",
                              assetId: a?.id,
                              expectedRevision: a?.revision,
                            });
                          }}
                        >
                          <option value="">Choose exact existing record</option>
                          {available.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.title} · {a.id} · rev {a.revision}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {matches.length > 0 && (
                      <p className="muted-text">
                        {matches.length} possible existing match(es). Review
                        their IDs and descriptions.
                      </p>
                    )}
                    {current.action === "create" && matches.length > 0 && (
                      <label className="import-check">
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={!!current.acknowledgeDuplicate}
                          onChange={(e) =>
                            choice(op.operationId, {
                              ...current,
                              acknowledgeDuplicate: e.target.checked,
                            })
                          }
                        />
                        Create separate asset despite matches ({op.operationId})
                      </label>
                    )}
                  </div>
                );
              })}
            </details>
          )}
          {changeSet.operations
            .filter(
              (o) =>
                ["scene.create_direct_prompt", "scene.create_recipe"].includes(
                  o.type,
                ) &&
                (plan.findings.some(
                  (f) =>
                    f.operationId === o.operationId &&
                    f.code === "DUPLICATE_SCENE",
                ) ||
                  approval.allowDuplicateSceneOperations.includes(
                    o.operationId,
                  )),
            )
            .map((o) => (
              <label className="import-check" key={o.operationId}>
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={approval.allowDuplicateSceneOperations.includes(
                    o.operationId,
                  )}
                  onChange={(e) =>
                    onApproval({
                      ...approval,
                      allowDuplicateSceneOperations: e.target.checked
                        ? [
                            ...approval.allowDuplicateSceneOperations,
                            o.operationId,
                          ]
                        : approval.allowDuplicateSceneOperations.filter(
                            (id) => id !== o.operationId,
                          ),
                    })
                  }
                />
                Allow separate identical scene ({o.operationId})
              </label>
            ))}
          {plan.operations
            .filter(
              (row) =>
                isRecipeOperation(row) &&
                ((
                  row.resolved as
                    | { recipe?: { manualOutputsDiscarded?: boolean } }
                    | undefined
                )?.recipe?.manualOutputsDiscarded ||
                  plan.findings.some(
                    (f) =>
                      f.operationId === row.operationId &&
                      f.code === "RECIPE_MANUAL_OUTPUTS",
                  )),
            )
            .map((row) => (
              <label className="import-check" key={`manual-${row.operationId}`}>
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={
                    approval.discardManualOutputOperations?.includes(
                      row.operationId,
                    ) ?? false
                  }
                  onChange={(event) =>
                    onApproval({
                      ...approval,
                      discardManualOutputOperations: event.target.checked
                        ? [
                            ...(approval.discardManualOutputOperations ?? []),
                            row.operationId,
                          ]
                        : (approval.discardManualOutputOperations ?? []).filter(
                            (id) => id !== row.operationId,
                          ),
                    })
                  }
                />
                Discard manual output overrides and reassemble (
                {row.operationId})
              </label>
            ))}
        </section>
      </div>
      {selected && (
        <StudioDialog
          title={`Review operation ${selected.operationId}`}
          onClose={() => setDetail(undefined)}
          size="wide"
          footer={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDetail(undefined)}
            >
              Close operation
            </button>
          }
        >
          <div className="import-operation-detail">
            <p>{selected.summary}</p>
            {selected.projectId && (
              <p>
                Target project: <code>{selected.projectId}</code>
                {selected.shotId && (
                  <>
                    {" "}
                    · Shot: <code>{selected.shotId}</code>
                  </>
                )}
              </p>
            )}
            {selected.currentPrompt !== undefined && (
              <label>
                Existing prompt {selected.operationId}
                <textarea readOnly rows={7} value={selected.currentPrompt} />
              </label>
            )}
            {isRecipeOperation(selected) ? (
              <RecipeOperationPreview
                row={selected}
                changeSet={changeSet}
                approval={approval}
                findings={plan.findings.filter(
                  (f) =>
                    f.operationId === selected.operationId &&
                    !f.code.startsWith("APPROVAL_"),
                )}
              />
            ) : (
              selected.proposedPrompt !== undefined && (
                <label>
                  Proposed prompt {selected.operationId}
                  <textarea readOnly rows={7} value={selected.proposedPrompt} />
                </label>
              )
            )}
            {selected.resolved !== undefined && (
              <details>
                <summary>Resolved record and media metadata</summary>
                <pre>{JSON.stringify(selected.resolved, null, 2)}</pre>
              </details>
            )}
            {selected.matches?.map((match) => (
              <div key={match.id}>
                <strong>{match.title}</strong>
                <p>
                  {match.id} · rev {match.revision} · {match.reason}
                </p>
                <a
                  href={
                    match.kind === "template"
                      ? "/#/templates"
                      : `/#/prompts/${encodeURIComponent(match.id)}`
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Open existing record
                </a>
              </div>
            ))}
            <details>
              <summary>Exact operation JSON</summary>
              <pre>{JSON.stringify(selected.details, null, 2)}</pre>
            </details>
          </div>
        </StudioDialog>
      )}
    </>
  );
}
