import type {
  ChangeSetState,
  RecipeEnsemblePatch,
  ParticipantAssetBinding,
  ParticipantWardrobeBinding,
  RecordTarget,
} from "../types/changeSet";
import type { SceneDraft, SceneGenerationChoice } from "../types/domain";
import type { SceneParticipant } from "../types/ensemble";
import { enableSceneEnsemble, syncEnsemblePrimary } from "./ensemble";
import {
  createSnapshotFromAsset,
  createSnapshotFromVariant,
} from "./promptAssembler";
import {
  getIdentityAnchorStatus,
  resolveGenerationIdentity,
} from "./identityAnchors";
import { validateSceneEnsemble } from "./ensembleValidation";
export type ResolveEnsembleBinding = (
  kind: "asset" | "variant",
  target: RecordTarget,
) => string;
export function selectParticipantIdentity(
  p: SceneParticipant,
  source: "master" | "approved_anchor",
  state: Pick<ChangeSetState, "assets">,
): void {
  const anchor = p.character.identityAnchor;
  const choice: SceneGenerationChoice =
    source === "master"
      ? { identitySource: "master" }
      : {
          identitySource: "approved_anchor",
          ...(anchor && getIdentityAnchorStatus(p.character) === "approved"
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
  p.generation = resolveGenerationIdentity(
    { slots: { character: p.character }, generation: choice },
    p.character.sourceType === "asset"
      ? state.assets.find((a) => a.id === p.character.sourceId)
      : undefined,
  ).generation;
}
export function applyRecipeEnsemblePatch(
  source: SceneDraft,
  patch: RecipeEnsemblePatch,
  state: Pick<ChangeSetState, 'assets' | 'variants'>,
  resolve: ResolveEnsembleBinding,
): SceneDraft {
  const next = enableSceneEnsemble(source),
    e = next.ensemble!;
  for (const id of patch.removeParticipantIds ?? [])
    if (!e.participants.some((p) => p.id === id))
      throw Error(
        `Cannot remove unknown participant ${id}; review the current participant IDs.`,
      );
  e.participants = e.participants.filter(
    (p) => !patch.removeParticipantIds?.includes(p.id),
  );
  const assetSnapshot = (
    binding: ParticipantAssetBinding,
    category: "characters" | "wardrobe",
  ) => {
    const id = resolve("asset", binding.asset),
      asset = state.assets.find((a) => a.id === id);
    if (
      !asset ||
      asset.category !== category ||
      ("id" in binding.asset &&
        (!("expectedRevision" in binding) ||
          asset.revision !== binding.expectedRevision))
    )
      throw Error(
        `The selected ${category} asset is missing, changed or has the wrong category. Refresh and select its exact current revision.`,
      );
    return createSnapshotFromAsset(asset);
  };
  const wardrobeSnapshot = (
    binding: ParticipantWardrobeBinding,
    p: SceneParticipant,
  ) => {
    if ("asset" in binding) return assetSnapshot(binding, "wardrobe");
    const id = resolve("variant", binding.variant),
      v = state.variants?.find((v) => v.id === id);
    if (
      !v ||
      v.type !== "Outfit" ||
      v.targetSlot !== "wardrobe" ||
      ("id" in binding.variant &&
        (!("expectedRevision" in binding) ||
          v.revision !== binding.expectedRevision))
    )
      throw Error(
        "The selected Outfit variant is missing, changed or has the wrong type.",
      );
    if (
      p.character.sourceType !== "asset" ||
      v.parentCharacterId !== p.character.sourceId
    )
      throw Error(
        "Outfit parent must match this participant’s actual stored Character. Select a compatible Outfit; no identity was switched.",
      );
    return createSnapshotFromVariant(v);
  };
  for (const upsert of patch.participantUpserts ?? []) {
    const index = e.participants.findIndex((p) => p.id === upsert.id),
      old = index < 0 ? undefined : e.participants[index];
    if (!old && !upsert.character)
      throw Error(
        `New participant ${upsert.id} requires an actual stored Character or approved Character candidate.`,
      );
    const p: SceneParticipant = old
      ? structuredClone(old)
      : {
          id: upsert.id,
          character: assetSnapshot(upsert.character!, "characters"),
          presence: "on_camera",
        };
    if (upsert.character) {
      const character = assetSnapshot(upsert.character, "characters");
      if (
        p.character.sourceId !== character.sourceId ||
        p.character.sourceType !== "asset"
      )
        delete p.generation;
      p.character = character;
    }
    if (upsert.wardrobe === null) delete p.wardrobe;
    else if (upsert.wardrobe !== undefined)
      p.wardrobe = wardrobeSnapshot(upsert.wardrobe, p);
    for (const key of ["role", "presence", "performanceNotes"] as const)
      if (upsert[key] !== undefined) Object.assign(p, { [key]: upsert[key] });
    if (upsert.identitySource !== undefined)
      selectParticipantIdentity(p, upsert.identitySource, state);
    if (index < 0) e.participants.push(p);
    else e.participants[index] = p;
  }
  if (patch.participantOrder !== undefined) {
    const order = patch.participantOrder;
    if (
      order.length !== e.participants.length ||
      new Set(order).size !== order.length ||
      order.some((id) => !e.participants.some((p) => p.id === id))
    )
      throw Error(
        "Participant order must contain every remaining participant ID exactly once.",
      );
    e.participants = order.map((id) =>
      e.participants.find((p) => p.id === id)!,
    );
  }
  if (patch.primaryParticipantId !== undefined)
    e.primaryParticipantId = patch.primaryParticipantId;
  if (patch.dialogueCues !== undefined)
    e.dialogueCues = structuredClone(patch.dialogueCues);
  const synchronized = syncEnsemblePrimary(next),
    error = validateSceneEnsemble(synchronized)[0];
  if (error) throw Error(error);
  return synchronized;
}
