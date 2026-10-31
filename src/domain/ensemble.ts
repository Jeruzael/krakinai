import type {
  BuilderSlot,
  ComponentSnapshot,
  DialogueConfig,
  SceneGenerationChoice,
  SceneSettings,
  ShotType,
} from "../types/domain";
import type { SceneEnsembleV1, SceneParticipant } from "../types/ensemble";
export interface EnsembleSource {
  ensemble?: SceneEnsembleV1;
  slots: Partial<Record<BuilderSlot, ComponentSnapshot>>;
  dialogue?: DialogueConfig;
  generation?: SceneGenerationChoice;
  settings: SceneSettings;
  shotType?: ShotType;
  authoringMode?: "recipe" | "direct_prompt";
}
export function enableSceneEnsemble<T extends EnsembleSource>(source: T): T {
  if (source.authoringMode === "direct_prompt")
    throw Error(
      "Direct Prompt conversion is outside ensemble authoring. Create a recipe separately.",
    );
  const next = structuredClone(source);
  if (next.ensemble) return next;
  const character = next.slots.character,
    dialogue = next.dialogue;
  if (!character && next.slots.wardrobe)
    throw Error(
      "Existing wardrobe has no Character. Assign a Character or explicitly clear the wardrobe before enabling participants; the draft is preserved.",
    );
  next.ensemble = {
    version: 1,
    primaryParticipantId: character ? "primary" : null,
    participants: character
      ? [
          {
            id: "primary",
            character: structuredClone(character),
            presence: "on_camera",
            ...(next.slots.wardrobe
              ? { wardrobe: structuredClone(next.slots.wardrobe) }
              : {}),
            ...(next.generation
              ? { generation: structuredClone(next.generation) }
              : {}),
          },
        ]
      : [],
    dialogueCues: dialogue
      ? [
          {
            ...structuredClone(dialogue),
            id: "legacy-dialogue",
            ...((dialogue.mode === undefined ||
              ["on_camera", "spoken"].includes(dialogue.mode)) &&
            character
              ? { participantId: "primary" }
              : {}),
          },
        ]
      : [],
  };
  delete next.dialogue;
  return syncEnsemblePrimary(next);
}
export function syncEnsemblePrimary<T extends EnsembleSource>(source: T): T {
  const next = structuredClone(source);
  if (!next.ensemble) return next;
  const primary = next.ensemble.participants.find(
    (p) =>
      p.id === next.ensemble!.primaryParticipantId &&
      p.presence === "on_camera",
  );
  delete next.slots.character;
  delete next.slots.wardrobe;
  delete next.generation;
  delete next.dialogue;
  if (primary) {
    next.slots.character = structuredClone(primary.character);
    if (primary.wardrobe)
      next.slots.wardrobe = structuredClone(primary.wardrobe);
    if (primary.generation)
      next.generation = structuredClone(primary.generation);
  }
  return next;
}
export function getVisualParticipants(
  source: Pick<EnsembleSource, "ensemble">,
): SceneParticipant[] {
  return (
    source.ensemble?.participants.filter((p) => p.presence === "on_camera") ??
    []
  );
}
