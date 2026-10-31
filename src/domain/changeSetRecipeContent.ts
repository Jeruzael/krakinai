import type { SavedScene } from "../types/domain";
import type { ChangeSetPlan } from "../types/changeSet";
import { isRecipeOperation } from "../types/changeSet";
/** Includes authored/resolved content, excludes applied/created timestamps. */
export function recipeContentProjection(scene: SavedScene) {
  const {
    id,
    title,
    authoringMode,
    slots,
    extraRequiredSlots,
    shotType,
    settings,
    sceneInstructions,
    avoidText,
    inheritedAvoidPrefix,
    dialogue,
    generation,
    referencePack,
    references,
    sourceMediaLinks,
    pendingInputs,
    claimNotes,
    manualOutputs,
    outputs,
    saveProjectTarget,
    sourceSceneId,
  } = scene;
  return {
    id,
    title,
    authoringMode,
    slots,
    extraRequiredSlots,
    shotType,
    settings,
    sceneInstructions,
    avoidText,
    inheritedAvoidPrefix,
    dialogue,
    generation,
    referencePack,
    references,
    sourceMediaLinks,
    pendingInputs,
    claimNotes,
    manualOutputs,
    outputs,
    saveProjectTarget,
    sourceSceneId,
  };
}
export function recipeReviewedProjection(plan: ChangeSetPlan) {
  const rows = plan.operations.filter(isRecipeOperation),
    ids = new Set(rows.map((r) => r.operationId));
  const sceneIds = new Set(
    plan.results.filter((r) => ids.has(r.operationId)).map((r) => r.recordId),
  );
  return {
    findings: plan.findings.filter(
      (f) => ids.has(f.operationId ?? "") && !f.code.startsWith("APPROVAL_"),
    ),
    scenes: plan.scenes
      .filter((s) => sceneIds.has(s.id))
      .map(recipeContentProjection),
    operations: rows.map((r) => ({
      operationId: r.operationId,
      type: r.type,
      summary: r.summary,
      projectId: r.projectId,
      shotId: r.shotId,
      details: r.details,
      currentPrompt: r.currentPrompt,
      proposedPrompt: r.proposedPrompt,
      resolved: r.resolved,
    })),
  };
}
