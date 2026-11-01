export function ensembleChangeSet(): any {
  return {
    schema: "krakinai.change-set.v3",
    changeSetId: "synthetic-ensemble-import",
    source: { kind: "codex", label: "Synthetic B2 fixture" },
    operations: [
      {
        operationId: "ensemble",
        type: "scene.create_recipe",
        clientRef: "scene",
        project: { id: "project", expectedRevision: 1 },
        shot: { id: "shot" },
        title: "Synthetic two-person scene",
        shotType: "character_scene",
        settings: { aspectRatio: "16:9", durationSeconds: 8 },
        assetRefs: [
          {
            asset: { id: "environment" },
            expectedRevision: 2,
            slot: "environment",
          },
          { asset: { id: "action" }, expectedRevision: 1, slot: "action" },
        ],
        sceneInstructions: "Keep each participant distinct.",
        ensemble: {
          version: 1,
          participantUpserts: [
            {
              id: "aya",
              character: { asset: { id: "character" }, expectedRevision: 1 },
              presence: "on_camera",
            },
            {
              id: "lucas",
              character: { asset: { id: "lucas" }, expectedRevision: 1 },
              presence: "on_camera",
              performanceNotes: "Speak with quiet determination.",
            },
          ],
          primaryParticipantId: "aya",
          dialogueCues: [
            {
              id: "officiant",
              speaker: "Officiant",
              line: "Lucas, do you take Aya as your wife?",
              mode: "off_screen",
            },
            {
              id: "lucas-reply",
              participantId: "lucas",
              speaker: "Lucas",
              line: "  I do.\r\n😊  ",
              mode: "on_camera",
            },
          ],
        },
      },
    ],
  };
}
export function outfitProposal(
  operationId = "outfit",
  parentCharacterId = "character",
): any {
  return {
    operationId,
    type: "variant.propose",
    clientRef: operationId,
    variantType: "Outfit",
    parentCharacterId,
    expectedParentRevision: 1,
    title: "Synthetic formal outfit",
    promptText: "A charcoal formal suit.",
    description: "Synthetic QA only.",
    tags: ["formal"],
    notes: "",
  };
}
