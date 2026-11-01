import type {
  ChangeSet,
  ChangeSetAllocation,
  ChangeSetState,
  RecipeSceneOperation,
  RecordTarget,
} from "../types/changeSet";
import type {
  BuilderSlot,
  SceneDraft,
  SavedScene,
  ReferencePackEntry,
} from "../types/domain";
import type { SceneProjectTarget } from "../types/sceneAuthoring";
import { buildRevisionDraft } from "../storage/sceneAuthoring";
import {
  resolveImportedBindings,
  validateImportedVariantOwnership,
} from "./changeSetReferences";
import {
  applyCameraComposition,
  clearCameraComposition,
  rebaseCameraComposition,
  resetCameraComposition,
} from "./cameraComposition";
import {
  getIdentityAnchorStatus,
  resolveGenerationIdentity,
} from "./identityAnchors";
import { getRevisionHead } from "./sceneRevisions";
import { isDirectPrompt } from "./directPrompt";
import {
  getShotTypeRules,
  getActiveSourceMediaLinks,
} from "./shotTypeRules";
import { collectReferenceCandidates } from "./referencePack";
import { captureMediaNames } from "./mediaNaming";
import { runScenePreflight } from "./scenePreflight";
import { getCameraCompositionWarnings } from "./cameraCompositionWarnings";
import type { ImportFinding } from "../types/changeSet";
import{applyRecipeEnsemblePatch}from'./changeSetEnsemble';
import{prepareEnsembleSource}from'./ensemblePersistence';
import{getSceneSnapshotEntries}from'./ensembleReferences';
const clone = <T>(value: T): T => structuredClone(value);

/** A transient authoring draft, never an assertion that a stored draft exists. */
export function buildRecipeChangeDraft(
  operation: RecipeSceneOperation,
  state: ChangeSetState,
  allocation: ChangeSetAllocation,
  target: SceneProjectTarget,
  resolveAsset: (target: RecordTarget) => string,
  resolveVariant?: (target:RecordTarget)=>string,
): SceneDraft {
  let draft: SceneDraft;
  const identity = {
    id: `draft_${allocation.ids[operation.operationId]}`,
    inputRevision: 1,
    updatedAt: allocation.preparedAt,
  };
  if (operation.type === "scene.create_recipe") {
    draft = {
      ...identity,
      title: operation.title,
      slots: {},
      extraRequiredSlots: [],
      sceneInstructions: "",
      settings: {},
      manualOutputs: {},
      resultMediaLinks: [],
      reviewNotes: "",
      reviewStatus: "unreviewed",
    };
  } else {
    const parent = state.scenes.find((s) => s.id === operation.sceneId);
    if (!parent) throw Error("The explicit recipe parent is unavailable.");
    if (isDirectPrompt(parent))
      throw Error(
        "Choose a recipe parent. Direct Prompt conversion is outside B1; create a new recipe on this shot instead.",
      );
    if (getRevisionHead(parent, state.scenes).id !== operation.expectedHeadId)
      throw Error("Scene revision head changed; preview again.");
    draft = {
      ...buildRevisionDraft(parent.id, state, {
        target,
        alternateTake: operation.type === "scene.create_recipe_take",
      }),
      ...identity,
    };
    if (operation.reason && draft.revisionIntent)
      draft.revisionIntent.reason = operation.reason;
  }
  draft.authoringMode = "recipe";
  if(draft.ensemble&&(Object.hasOwn(operation,'dialogue')||Object.hasOwn(operation,'identitySource')||operation.assetRefs?.some(r=>['character','wardrobe'].includes(r.slot))||operation.variantRefs?.some(r=>['character','wardrobe'].includes(r.slot))||operation.clearSlots?.some(s=>['character','wardrobe'].includes(s))||['character','wardrobe'].some(s=>Object.hasOwn(operation.overrides??{},s))))throw Error('Use a v3 ensemble participant patch for Character, wardrobe, identity source or dialogue changes.');
  delete draft.directPrompt;
  delete draft.directReferences;
  // Browser-owned consent is checked in the planner; every new output is assembled.
  draft.manualOutputs = {};
  for (const key of [
    "title",
    "shotType",
    "sceneInstructions",
    "avoidText",
    "claimNotes",
  ] as const)
    if (operation[key] !== undefined)
      Object.assign(draft, { [key]: operation[key] });
  if (operation.settings)
    draft.settings = { ...draft.settings, ...clone(operation.settings) };
  if (operation.dialogue !== undefined)
    draft.dialogue =
      operation.dialogue === null ? undefined : clone(operation.dialogue);
  if (operation.pendingInputs !== undefined)
    draft.pendingInputs = clone(operation.pendingInputs);
  if (operation.claims?.length)
    draft.claimNotes = [
      draft.claimNotes ?? "",
      ...operation.claims.map((c) => `UNVERIFIED ${c.kind}: ${c.text}`),
    ]
      .filter(Boolean)
      .join("\n");
  for (const slot of operation.clearSlots ?? []) delete draft.slots[slot];
  const rules = getShotTypeRules(draft);
  const requestedSlots = [
    ...(operation.assetRefs ?? []),
    ...(operation.variantRefs ?? []),
  ].map((r) => r.slot);
  requestedSlots.push(
    ...(Object.keys(operation.overrides ?? {}) as BuilderSlot[]),
  );
  if (requestedSlots.some((slot) => rules.inapplicableSlots.includes(slot)))
    throw Error(
      "An explicitly requested component is inapplicable to this Shot Type. Remove that binding/override or change Shot Type.",
    );
  for (const snapshot of resolveImportedBindings(
    operation,
    state,
    resolveAsset,
  ))
    draft.slots[snapshot.slot] =
      snapshot.slot === "camera"
        ? rebaseCameraComposition(draft.slots.camera, snapshot)
        : snapshot;
  if(operation.ensemble)draft=applyRecipeEnsemblePatch(draft,operation.ensemble,state,(kind,target)=>{if(kind==='asset')return resolveAsset(target);if('id'in target)return target.id;if(!resolveVariant)throw Error('An Outfit candidate requires an approved typed variant result.');return resolveVariant(target)});
  validateImportedVariantOwnership(draft, state);
  if (operation.cameraComposition === null && draft.slots.camera)
    draft.slots.camera = resetCameraComposition(draft.slots.camera);
  for (const [name, override] of Object.entries(operation.overrides ?? {})) {
    const slot = name as Exclude<BuilderSlot, "character">;
    let snapshot = draft.slots[slot];
    if (!snapshot)
      throw Error(
        `Select a stored ${slot} component before applying a scene-only text override.`,
      );
    if (slot === "camera") snapshot = clearCameraComposition(snapshot);
    for (const field of ["overrideText", "overrideCompactText"] as const)
      if (override?.[field] !== undefined) {
        if (override[field] === null) delete snapshot[field];
        else snapshot[field] = override[field];
      }
    draft.slots[slot] = snapshot;
  }
  if (operation.cameraComposition)
    draft.slots.camera = applyCameraComposition(
      draft.slots.camera,
      operation.cameraComposition,
    );
  if (operation.sourceMedia !== undefined)
    draft.sourceMediaLinks = operation.sourceMedia.map((link, order) => ({
      ...link,
      role: "reference",
      altText: link.altText ?? "",
      order,
      filename: state.media.find((m) => m.id === link.mediaId)?.filename,
      mimeType:
        link.mimeType ??
        state.media.find((m) => m.id === link.mediaId)?.mimeType,
    }));
  if (operation.identitySource !== undefined) {
    const character = draft.slots.character,
      anchor = character?.identityAnchor;
    draft.generation =
      operation.identitySource === "master"
        ? { identitySource: "master" }
        : {
            identitySource: "approved_anchor",
            ...(character &&
            anchor &&
            getIdentityAnchorStatus(character) === "approved"
              ? {
                  anchor: {
                    text: anchor.approvedText!,
                    approvedMasterIdentityRevision:
                      anchor.approvedMasterIdentityRevision!,
                    approvedAt: anchor.approvedAt!,
                  },
                }
              : {}),
          };
  }
  if(draft.ensemble)draft=prepareEnsembleSource(draft,state.assets);
  else draft.generation = resolveGenerationIdentity(
    draft,
    state.assets.find((a) => a.id === draft.slots.character?.sourceId),
  ).generation;
  if (operation.references !== undefined) {
    const mediaMap = new Map(state.media.map((m) => [m.id, m]));
    const activeIds = new Set(
      [
        ...getSceneSnapshotEntries(draft,{activeOnly:true}).flatMap(e=>e.snapshot.mediaLinks),
        ...getActiveSourceMediaLinks(draft),
      ].map((l) => l.mediaId),
    );
    if (
      rules.shotType !== "character_scene" &&
      operation.references.some((l) => !activeIds.has(l.mediaId))
    )
      throw Error(
        "This reference is outside the active components/originals for this Shot Type. Keep it as a pending input or select its actual stored component; no reference was silently removed.",
      );
    // Explicit extra references replace only prior B1 extras. Existing pack
    // selections and snapshot associations remain present unless explicitly cleared.
    const retained = (
      draft.referencePack?.entries.filter(
        (e) => !e.associationId.startsWith("change-set:reference:"),
      ) ?? collectReferenceCandidates(draft, mediaMap)
    )
      .sort((a, b) => a.order - b.order)
      .map((entry, order) => ({ ...entry, order }));
    const extras: ReferencePackEntry[] = operation.references.map(
      (link, index) => ({
        ...link,
        associationId: `change-set:reference:${index}`,
        sourceSlot: "legacy",
        sourceId: allocation.ids[operation.operationId],
        sourceTitle: draft.title,
        purpose: "general",
        role: link.role ?? "reference",
        altText: link.altText ?? "",
        order: retained.length + index,
      }),
    );
    draft.referencePack = {
      version: 1,
      entries: captureMediaNames([...retained, ...extras], mediaMap),
    };
  }
  return draft;
}

export function recipeDraftPreview(draft: SceneDraft, parent?: SavedScene) {
  return {
    readiness: "blocked" as "blocked" | "assembled_pending" | "ready",
    components: clone(draft.slots),
    ...(draft.ensemble?{ensemble:clone(draft.ensemble)}:{}),
    settings: clone(draft.settings),
    shotType: draft.shotType,
    sceneInstructions: draft.sceneInstructions,
    avoidText: draft.avoidText,
    dialogue: clone(draft.dialogue),
    sourceMediaLinks: clone(draft.sourceMediaLinks),
    referencePack: clone(draft.referencePack),
    pendingInputs: clone(draft.pendingInputs),
    generation: clone(draft.generation),
    inactiveSlots: getShotTypeRules(draft).inapplicableSlots.filter(
      (s) => draft.slots[s],
    ),
    manualOutputsDiscarded: Boolean(
      parent && Object.keys(parent.manualOutputs).length,
    ),
    parentOutputs: clone(parent?.outputs),
    ...(parent?.ensemble?{previousEnsemble:clone(parent.ensemble)}:{}),
    outputs: undefined as SavedScene["outputs"] | undefined,
  };
}
export type RecipeResolvedPreview = ReturnType<typeof recipeDraftPreview>;
export function recipeAdvisories(
  operationId: string,
  draft: SceneDraft,
  state: ChangeSetState,
): ImportFinding[] {
  const findings: ImportFinding[] = runScenePreflight(
    draft,
    new Map(state.media.map((m) => [m.id, m])),
  )
    .filter((f) => f.severity !== "blocking")
    .map((f) => ({
      operationId,
      severity: "advisory",
      code: `RECIPE_PREFLIGHT_${f.ruleId}`,
      message: `[${f.severity === "information" ? "Information" : "Review"}] ${f.title}. ${f.explanation}`,
    }));
  const camera = draft.slots.camera;
  if (camera?.cameraComposition)
    for (const warning of getCameraCompositionWarnings(
      camera.cameraComposition,
      {
        shotType: draft.shotType,
        durationSeconds: draft.settings.durationSeconds,
        sceneInstructions: draft.sceneInstructions,
        baseCameraText: camera.promptText,
      },
    ))
      findings.push({
        operationId,
        severity: "advisory",
        code: `RECIPE_CAMERA_${warning.id}`,
        message: `[${warning.severity === "information" ? "Information" : "Review"}] ${warning.title}. ${warning.explanation}`,
      });
  return findings;
}
export function recipeWarnings(draft: SceneDraft): string[] {
  const warnings = (draft.pendingInputs ?? []).map(
    (p) => `Pending ${p.kind}: ${p.label}`,
  );
  return warnings;
}
export function finishRecipeScene(scene: SavedScene, input: ChangeSet): void {
  scene.authoringMode = "recipe";
  for (const entry of scene.referencePack?.entries ?? [])
    if (
      (scene.ensemble||entry.associationId.startsWith("change-set:reference:")) &&
      !scene.references.some(
        (l) =>
          l.mediaId === entry.mediaId &&
          l.role === entry.role &&
          l.altText === entry.altText &&
          !(l.viewLabel ?? ""),
      )
    ) {
      const {
        mediaId,
        role,
        altText,
        filename,
        mimeType,
        displayName,
        exportFilename,
        namesCaptured,
      } = entry;
      scene.references.push({
        mediaId,
        role,
        altText,
        filename,
        mimeType,
        displayName,
        exportFilename,
        namesCaptured,
        order: scene.references.length,
      });
    }
  if (scene.sceneRevision) {
    scene.sceneRevision.origin = input.source.kind;
    if (input.source.label)
      scene.sceneRevision.originLabel = input.source.label;
  }
  delete scene.sourceDraftId;
  delete scene.sourceDraftInputRevision;
  delete scene.saveRequestId;
  delete scene.authoredSaveFingerprint;
}
