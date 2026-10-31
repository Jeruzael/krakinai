import type {
  BuilderSlot,
  ComponentSnapshot,
  MediaLink,
} from "../types/domain";
import type { SceneEnsembleV1 } from "../types/ensemble";
import { SCENE_COMPONENT_ORDER } from "./sceneDocument";
import { getActiveSceneSlots, getShotTypeRules } from "./shotTypeRules";

export interface SnapshotEntry {
  slot: BuilderSlot;
  snapshot: ComponentSnapshot;
  participantId?: string;
}
type Source = {
  slots?: Partial<Record<BuilderSlot, ComponentSnapshot>>;
  ensemble?: SceneEnsembleV1;
  shotType?: import("../types/domain").ShotType;
};
export const getReferenceLinkIdentity = (link: MediaLink) =>
  JSON.stringify([link.mediaId, link.role, link.viewLabel ?? "", link.altText]);
export const getReferenceAssociationId = (
  slot: string,
  sourceId: string,
  key: string,
  occurrence: number,
  participantId?: string,
) =>
  JSON.stringify(
    participantId
      ? ["participant", participantId, slot, sourceId, key, occurrence]
      : [slot, sourceId, key, occurrence],
  );
/** Storage callers retain every frozen attachment; visual callers opt into active-only. */
export function getSceneSnapshotEntries(
  source: Source,
  options: { activeOnly?: boolean } = {},
): SnapshotEntry[] {
  const slots = options.activeOnly
    ? getActiveSceneSlots(source)
    : (source.slots ?? {});
  if (!source.ensemble)
    return SCENE_COMPONENT_ORDER.flatMap((slot) =>
      slots[slot] ? [{ slot, snapshot: slots[slot]! }] : [],
    );
  const participants = source.ensemble.participants.filter(
    (p) =>
      !options.activeOnly ||
      (p.presence === "on_camera" && !getShotTypeRules(source).sourceKind),
  );
  return [
    ...participants.flatMap((p) =>
      (["character", "wardrobe"] as const).flatMap((slot) =>
        p[slot] ? [{ slot, snapshot: p[slot]!, participantId: p.id }] : [],
      ),
    ),
    ...SCENE_COMPONENT_ORDER.filter(
      (slot) => slot !== "character" && slot !== "wardrobe",
    ).flatMap((slot) =>
      slots[slot] ? [{ slot, snapshot: slots[slot]! }] : [],
    ),
  ];
}
export function getEnsembleAvoidParts(source: Source): string[] {
  return getSceneSnapshotEntries(source, { activeOnly: true }).flatMap((e) =>
    e.snapshot.avoidText?.trim() ? [e.snapshot.avoidText] : [],
  );
}
