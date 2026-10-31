import type {
  ChangeSetState,
  ImportedSceneFields,
  RecordTarget,
} from "../types/changeSet";
import type { ComponentSnapshot, MediaLink, SceneDraft } from "../types/domain";
import {
  createSnapshotFromAsset,
  createSnapshotFromVariant,
} from "./promptAssembler";
import { checkVariantApplicationToDraft } from "../storage/db";
const key = (link: MediaLink) =>
  JSON.stringify([link.mediaId, link.role, link.altText, link.viewLabel ?? ""]);
/** Explicit bindings retain their actual associations even when the Shot Type does not assemble that component. */
export function resolveImportedBindings(
  operation: ImportedSceneFields,
  state: ChangeSetState,
  resolveAsset: (target: RecordTarget) => string,
): ComponentSnapshot[] {
  const bindings: ComponentSnapshot[] = [];
  for (const link of operation.assetRefs ?? []) {
    const id = resolveAsset(link.asset),
      asset = state.assets.find((a) => a.id === id);
    if (
      !asset ||
      ("id" in link.asset && asset.revision !== link.expectedRevision)
    )
      throw Error("An explicit asset is unavailable or changed.");
    const snapshot = createSnapshotFromAsset(asset);
    if (snapshot.slot !== link.slot)
      throw Error(
        "Asset category does not match the requested component context.",
      );
    bindings.push(snapshot);
  }
  for (const link of operation.variantRefs ?? []) {
    const variant = state.variants?.find((v) => v.id === link.variantId);
    if (!variant || variant.revision !== link.expectedRevision)
      throw Error("An explicit variant is unavailable or changed.");
    const snapshot = createSnapshotFromVariant(variant);
    if (snapshot.slot !== link.slot)
      throw Error(
        "Variant category does not match the requested component context.",
      );
    bindings.push(snapshot);
  }
  return bindings;
}
export function validateImportedVariantOwnership(
  draft: SceneDraft,
  state: ChangeSetState,
): void {
  for (const snapshot of Object.values(draft.slots))
    if (snapshot?.sourceType === "variant" && snapshot.parentCharacterId) {
      if (
        checkVariantApplicationToDraft(
          draft,
          {
            parentCharacterId: snapshot.parentCharacterId,
            targetSlot: snapshot.slot,
          },
          state.assets,
        ).requiresConfirmation
      )
        throw Error(
          "Variant context belongs to another character. Choose a compatible variant or character explicitly; no identity was switched.",
        );
    }
}
export function applyImportedContexts(
  draft: SceneDraft,
  operation: ImportedSceneFields,
  state: ChangeSetState,
  resolveAsset: (target: RecordTarget) => string,
): void {
  const bindings = resolveImportedBindings(operation, state, resolveAsset),
    previous = structuredClone(draft.slots),
    mediaMap = new Map(state.media.map((m) => [m.id, m]));
  for (const snapshot of bindings) draft.slots[snapshot.slot] = snapshot;
  validateImportedVariantOwnership(draft, state);
  for (const snapshot of bindings) {
    let refs = [...(draft.directReferences ?? [])];
    const prior = previous[snapshot.slot];
    if (
      prior?.sourceId === snapshot.sourceId &&
      prior.sourceType === snapshot.sourceType
    )
      for (const link of prior.mediaLinks) {
        const index = refs.findIndex((r) => key(r) === key(link));
        if (index >= 0) refs.splice(index, 1);
      }
    refs.push(...structuredClone(snapshot.mediaLinks));
    draft.directReferences = refs;
    const retained = (draft.referencePack?.entries ?? []).filter(
      (e) => e.sourceSlot !== snapshot.slot || e.sourceId !== snapshot.sourceId,
    );
    const purpose =
      snapshot.slot === "character"
        ? "identity"
        : snapshot.slot === "wardrobe"
          ? "outfit"
          : snapshot.slot === "environment"
            ? "environment"
            : snapshot.slot === "action"
              ? "motion"
              : "general";
    const entries = [...snapshot.mediaLinks]
      .sort((a, b) => a.order - b.order)
      .map(
        (link, index) =>
          ({
            ...link,
            associationId: `import:${snapshot.slot}:${snapshot.sourceId}:${index}`,
            sourceSlot: snapshot.slot,
            sourceId: snapshot.sourceId,
            sourceTitle: snapshot.sourceTitle,
            purpose,
            filename: link.filename ?? mediaMap.get(link.mediaId)?.filename,
            mimeType: link.mimeType ?? mediaMap.get(link.mediaId)?.mimeType,
            order: retained.length + index,
          }) as const,
      );
    if (draft.referencePack || entries.length)
      draft.referencePack = { version: 1, entries: [...retained, ...entries] };
  }
}
