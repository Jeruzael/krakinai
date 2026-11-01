import type { ComponentSnapshot, SceneDraft } from "../../types/domain";
import { createSnapshotFromAsset } from "../../domain/promptAssembler";
import { recipeState, recipeTime } from "./recipeChangeSetFixture";
import { enableSceneEnsemble } from "../../domain/ensemble";
export function actor(id = "character", name = "Aya"): ComponentSnapshot {
  const base = recipeState().assets.find((a) => a.category === "characters")!;
  return createSnapshotFromAsset({
    ...base,
    id,
    title: `${name} / Base Identity`,
    promptText: `  ${name} is a fictional adult. Preserve this exact identity.  `,
    identityRevision: 1,
  });
}
export function ensembleLegacyDraft(): SceneDraft {
  const state = recipeState();
  return {
    id: "ensemble-unit-draft",
    title: "Synthetic ensemble",
    slots: {
      character: actor(),
      environment: createSnapshotFromAsset(state.assets[0]),
      action: createSnapshotFromAsset(state.assets[1]),
      wardrobe: {
        slot: "wardrobe",
        sourceType: "variant",
        sourceId: "aya-outfit",
        sourceRevision: 1,
        sourceTitle: "Synthetic bridal gown",
        parentCharacterId: "character",
        promptText: "A white bridal gown.",
        mediaLinks: [],
      },
    },
    extraRequiredSlots: [],
    sceneInstructions: "Preserve each person independently.",
    dialogue: {
      speaker: "Aya",
      line: "  I do.\r\n😊  ",
      mode: "on_camera",
      language: "Filipino",
      deliveryNotes: "Speak softly.",
      performanceDirection: { version: 1, styles: ["calm"] },
      captionPreference: "none",
    },
    settings: { aspectRatio: "16:9", durationSeconds: 8 },
    inputRevision: 1,
    manualOutputs: {},
    resultMediaLinks: [],
    reviewNotes: "",
    reviewStatus: "unreviewed",
    updatedAt: recipeTime,
  };
}
export function ensembleDraft(): SceneDraft {
  const s = enableSceneEnsemble(ensembleLegacyDraft());
  s.ensemble!.participants.push({
    id: "lucas",
    character: actor("lucas", "Lucas"),
    wardrobe: {
      slot: "wardrobe",
      sourceType: "variant",
      sourceId: "lucas-suit",
      sourceRevision: 1,
      sourceTitle: "Lucas suit",
      parentCharacterId: "lucas",
      promptText: "A charcoal groom suit.",
      compactText: "Charcoal suit.",
      mediaLinks: [],
    },
    presence: "on_camera",
    performanceNotes: "Speak with quiet determination.",
  });
  s.ensemble!.dialogueCues = [
    {
      id: "officiant",
      speaker: "Officiant",
      mode: "off_screen",
      line: "Lucas, do you take Aya as your wife?",
    },
    {
      id: "lucas-reply",
      speaker: "Lucas",
      participantId: "lucas",
      mode: "on_camera",
      line: "  I do.\r\n😊  ",
      performanceDirection: { version: 1, styles: ["calm"] },
    },
  ];
  return s;
}
