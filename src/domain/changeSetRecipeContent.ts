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
    ensemble,
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
    ...(ensemble?{ensemble}:{}),
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
/** Every displayed/resolved v3 row is bound, including standalone Outfit review. */
export function ensembleReviewedProjection(plan:ChangeSetPlan){return withoutGeneratedTimes({
 findings:plan.findings.filter(f=>!f.code.startsWith('APPROVAL_')),
 operations:plan.operations.map(r=>({operationId:r.operationId,type:r.type,summary:r.summary,projectId:r.projectId,shotId:r.shotId,currentPrompt:r.currentPrompt,proposedPrompt:r.proposedPrompt,matches:r.matches,details:r.details,resolved:r.resolved})),
 scenes:plan.scenes.map(recipeContentProjection),assets:plan.assets,templates:plan.templates,variants:plan.variants??[],candidates:plan.candidates,variantCandidates:plan.variantCandidates??[],collections:plan.collections,idMappings:plan.idMappings,results:plan.results,projectRevisions:plan.projectRevisions,
})}
function withoutGeneratedTimes(value:unknown):unknown{
 if(Array.isArray(value))return value.map(withoutGeneratedTimes);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['createdAt','updatedAt','addedAt'].includes(key)).map(([key,v])=>[key,withoutGeneratedTimes(v)]));
 return value;
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
