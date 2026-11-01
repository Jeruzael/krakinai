import React, { useState } from "react";
import type {
  ChangeSet,
  ChangeSetApproval,
  ChangeSetPlan,
} from "../types/changeSet";
import type { LibrarySnapshot } from "../storage/db";
export function OutfitReviewDecisions({
  changeSet,
  approval,
  plan,
  snapshot,
  disabled,
  onApproval,
}: {
  changeSet: ChangeSet;
  approval: ChangeSetApproval;
  plan: ChangeSetPlan;
  snapshot: LibrarySnapshot;
  disabled: boolean;
  onApproval: (approval: ChangeSetApproval) => void;
}) {
  const [reuseIntent, setReuseIntent] = useState<Record<string, boolean>>({});
  const operations = changeSet.operations.filter(
    (o) =>
      o.type === "variant.propose" || o.type === "variant.review_candidate",
  );
  if (!operations.length) return null;
  const choice = (
    id: string,
    value: NonNullable<ChangeSetApproval["variantDecisions"]>[string],
  ) =>
    onApproval({
      ...approval,
      variantDecisions: { ...approval.variantDecisions, [id]: value },
    });
  return (
    <details className="import-group">
      <summary>Outfit variant decisions ({operations.length})</summary>
      <p className="muted-text">
        Deferred Outfits stay candidates. Creating or reusing an Outfit requires
        your explicit choice and the exact existing parent Character. Nothing is
        installed during preview.
      </p>
      {operations.map((op) => {
        const candidate =
            op.type === "variant.propose"
              ? op
              : snapshot.preferences.aiImports?.variantCandidates?.find(
                  (c) => c.id === op.candidateId,
                ),
          current = approval.variantDecisions?.[op.operationId] ?? {
            action: "defer",
          },
          matches =
            plan.operations.find((r) => r.operationId === op.operationId)
              ?.matches ?? [];
        const parent = snapshot.assets.find(
          (a) =>
            a.id === candidate?.parentCharacterId &&
            a.category === "characters",
        );
        const available = snapshot.variants.filter(
          (v) =>
            !!parent &&
            v.type === "Outfit" &&
            v.targetSlot === "wardrobe" &&
            v.parentCharacterId === parent.id,
        );
        return (
          <div className="import-candidate-decision" key={op.operationId}>
            <strong>{candidate?.title ?? op.operationId}</strong>
            <p>
              Parent: {parent?.title ?? "Unavailable Character"} ·{" "}
              <code>{candidate?.parentCharacterId}</code> · expected rev{" "}
              {candidate?.expectedParentRevision}
            </p>
            <details>
              <summary>Proposed Outfit prompt and provenance</summary>
              <pre>{candidate?.promptText}</pre>
              <p>{candidate?.description}</p>
              <p>{candidate?.tags.join(", ")}</p>
              <p>{candidate?.notes}</p>
              <code>
                {op.type === "variant.review_candidate"
                  ? op.candidateId
                  : changeSet.changeSetId}
              </code>
            </details>
            <label>
              Outfit decision {op.operationId}
              <select
                disabled={disabled}
                value={reuseIntent[op.operationId] ? "reuse" : current.action}
                onChange={(event) => {
                  const action = event.target.value as typeof current.action;
                  setReuseIntent({
                    ...reuseIntent,
                    [op.operationId]: action === "reuse",
                  });
                  if (action !== "reuse") choice(op.operationId, { action });
                }}
              >
                <option value="defer">Defer / keep pending</option>
                <option value="create">Create new unreviewed Outfit</option>
                <option value="reuse">
                  Reuse exact parent-compatible Outfit
                </option>
              </select>
            </label>
            {(current.action === "reuse" || reuseIntent[op.operationId]) && (
              <>
                <label>
                  Reuse Outfit {op.operationId}
                  <select
                    disabled={disabled}
                    value={
                      current.action === "reuse"
                        ? (current.variantId ?? "")
                        : ""
                    }
                    onChange={(event) => {
                      const variant = available.find(
                        (v) => v.id === event.target.value,
                      );
                      choice(
                        op.operationId,
                        variant
                          ? {
                              action: "reuse",
                              variantId: variant.id,
                              expectedRevision: variant.revision,
                            }
                          : { action: "defer" },
                      );
                    }}
                  >
                    <option value="">Choose exact existing Outfit</option>
                    {available.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} · {v.id} · rev {v.revision}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="muted-text">
                  No reuse is approved until you select an exact Outfit. Current
                  batch decision: {current.action}.
                </p>
              </>
            )}
            {matches.length > 0 && (
              <details>
                <summary>Possible Outfit matches ({matches.length})</summary>
                {matches.map((m) => (
                  <p key={m.id}>
                    <code>{m.id}</code> · {m.title} · rev {m.revision}
                  </p>
                ))}
              </details>
            )}
            {current.action === "create" && matches.length > 0 && (
              <label className="import-check">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={!!current.acknowledgeDuplicate}
                  onChange={(event) =>
                    choice(op.operationId, {
                      ...current,
                      acknowledgeDuplicate: event.target.checked,
                    })
                  }
                />
                Create separate Outfit despite matches ({op.operationId})
              </label>
            )}
          </div>
        );
      })}
    </details>
  );
}
