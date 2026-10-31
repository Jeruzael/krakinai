import type {
  ChangeSet,
  ChangeSetAllocation,
  ChangeSetApproval,
  ChangeSetState,
  ImportVariantCandidate,
  OutfitProposalOperation,
  OutfitReviewOperation,
  RecordTarget,
} from "../types/changeSet";
import type { PromptAsset, Variant } from "../types/domain";
import { findContentCandidateMatches } from "./changeSetCandidates";
import { buildVariantRecord } from "./variantRecord";
export function findOutfitCandidateMatches(
  candidate: Pick<
    ImportVariantCandidate,
    "title" | "promptText" | "tags" | "parentCharacterId"
  >,
  state: Pick<ChangeSetState, "variants">,
) {
  return findContentCandidateMatches(
    candidate,
    (state.variants ?? [])
      .filter(
        (v) =>
          v.type === "Outfit" &&
          v.targetSlot === "wardrobe" &&
          v.parentCharacterId === candidate.parentCharacterId,
      )
      .map((v) => ({
        id: v.id,
        title: v.title,
        text: v.promptText,
        tags: v.tags,
        revision: v.revision,
      })),
    "outfit",
  );
}
/** Computes one candidate outcome; the existing transaction remains the only writer. */
export function planOutfitCandidate(
  op: OutfitProposalOperation | OutfitReviewOperation,
  input: ChangeSet,
  approval: ChangeSetApproval,
  state: ChangeSetState,
  existingParents: readonly PromptAsset[],
  allocation: ChangeSetAllocation,
  candidates: ImportVariantCandidate[],
  resolveScene: (target: RecordTarget) => string,
) {
  let candidate: ImportVariantCandidate;
  if (op.type === "variant.propose") {
    candidate = {
      version: 1,
      id: allocation.ids[op.operationId],
      revision: 1,
      variantType: "Outfit",
      parentCharacterId: op.parentCharacterId,
      expectedParentRevision: op.expectedParentRevision,
      title: op.title,
      promptText: op.promptText,
      description: op.description ?? "",
      tags: structuredClone(op.tags),
      notes: op.notes ?? "",
      source: structuredClone(input.source),
      changeSetId: input.changeSetId,
      operationId: op.operationId,
      status: "pending",
      createdAt: allocation.preparedAt,
      updatedAt: allocation.preparedAt,
      ...(op.sourceScene
        ? { sourceSceneId: resolveScene(op.sourceScene) }
        : {}),
    };
    if (
      candidates.some((c) => c.id === candidate.id) ||
      state.preferences.aiImports?.candidates.some((c) => c.id === candidate.id)
    )
      throw Error("Allocated Outfit candidate ID already exists.");
    if (
      candidate.sourceSceneId &&
      !state.scenes.some((s) => s.id === candidate.sourceSceneId)
    )
      throw Error("Outfit source scene is unavailable.");
  } else {
    const existing = candidates.find((c) => c.id === op.candidateId);
    if (
      !existing ||
      existing.status !== "pending" ||
      existing.revision !== op.expectedRevision
    )
      throw Error(
        "Outfit candidate is missing, already resolved or changed; preview its current state.",
      );
    candidate = structuredClone(existing);
  }
  const parent = existingParents.find(
    (a) => a.id === candidate.parentCharacterId && a.category === "characters",
  );
  if (!parent)
    throw Error(
      "Outfit proposals require an existing stored parent Character. Create the Character in a separate approved batch first.",
    );
  if (parent.revision !== candidate.expectedParentRevision)
    throw Error(
      "The Outfit parent Character revision changed. Review its current state and propose against the exact revision.",
    );
  const proposed = structuredClone(candidate),
    decision = structuredClone(
      approval.variantDecisions?.[op.operationId] ?? {
        action: "defer" as const,
      },
    ),
    matches = findOutfitCandidateMatches(candidate, state);
  let variant: Variant | undefined, variantId: string | undefined;
  if (decision.action === "create") {
    if (matches.length && !decision.acknowledgeDuplicate)
      throw Error(
        "Possible duplicate same-parent Outfit: reuse an exact match or explicitly acknowledge separate unreviewed creation.",
      );
    variantId = `variant_${allocation.ids[op.operationId]}`;
    if (state.variants?.some((v) => v.id === variantId))
      throw Error("Allocated Outfit variant ID already exists.");
    variant = buildVariantRecord(
      {
        parentCharacterId: parent.id,
        type: "Outfit",
        title: candidate.title,
        description: candidate.description,
        promptText: candidate.promptText,
        tags: candidate.tags,
        notes: candidate.notes,
        mediaLinks: [],
        reviewStatus: "unreviewed",
        favorite: false,
      },
      parent,
      undefined,
      { id: variantId, now: allocation.preparedAt },
    );
    candidate.status = "created";
  } else if (decision.action === "reuse") {
    const current = state.variants?.find((v) => v.id === decision.variantId);
    if (
      !current ||
      current.type !== "Outfit" ||
      current.targetSlot !== "wardrobe" ||
      current.parentCharacterId !== parent.id ||
      current.revision !== decision.expectedRevision
    )
      throw Error(
        "Reuse requires the exact current same-parent Outfit variant and revision; no reparenting or type conversion is allowed.",
      );
    variantId = current.id;
    candidate.status = "reused";
  }
  if (variantId) {
    candidate.variantId = variantId;
    candidate.revision++;
    candidate.updatedAt = allocation.preparedAt;
  }
  return {
    candidate,
    proposed,
    decision,
    matches,
    variant,
    variantId,
    status:
      candidate.status === "pending"
        ? ("candidate_pending" as const)
        : candidate.status === "created"
          ? ("variant_created" as const)
          : ("variant_reused" as const),
  };
}
