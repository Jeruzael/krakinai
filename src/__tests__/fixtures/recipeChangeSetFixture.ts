import type {
  ChangeSet,
  ChangeSetState,
  ChangeSetApproval,
} from "../../types/changeSet";
import type { PromptAsset } from "../../types/domain";
import {
  emptyState,
  syntheticCamera,
  allContentApproval,
} from "./changeSetFixture";
export const recipeTime = "2026-10-31T00:00:00.000Z";
export function recipeState(): ChangeSetState {
  const state = emptyState(),
    base = syntheticCamera();
  state.assets = [
    {
      ...base,
      id: "environment",
      category: "environments",
      title: "Synthetic Courtyard",
      promptText: "A quiet enclosed courtyard.",
      compactText: "Enclosed courtyard.",
      revision: 2,
    },
    {
      ...base,
      id: "action",
      category: "actions",
      title: "Synthetic Greeting",
      promptText: "Greet the arriving guest.",
    },
    {
      ...base,
      id: "character",
      category: "characters",
      title: "Synthetic Mika / Base Identity",
      promptText: "An adult synthetic presenter named Mika.",
      identityRevision: 1,
    },
    { ...base, id: "camera", title: "Synthetic Static Camera" },
  ] as PromptAsset[];
  state.collections = [
    {
      id: "project",
      name: "Synthetic MIDORI recipe project",
      description: "Synthetic QA only.",
      members: [],
      createdAt: recipeTime,
      updatedAt: recipeTime,
      project: {
        version: 1,
        revision: 1,
        shots: [
          {
            id: "shot",
            code: "01",
            title: "Synthetic opening",
            order: 0,
            takeSceneIds: [],
            status: "planned",
            plannedShotType: "property_environment",
            plannedDurationSeconds: 4,
          },
        ],
      },
    },
  ];
  state.variants = [];
  return state;
}
export const recipeApproval = (): ChangeSetApproval => allContentApproval();
export function recipeChangeSet(): ChangeSet {
  return {
    schema: "krakinai.change-set.v2",
    changeSetId: "synthetic-recipe",
    source: { kind: "codex", label: "Synthetic B1" },
    operations: [
      {
        operationId: "recipe",
        type: "scene.create_recipe",
        clientRef: "recipe",
        project: { id: "project", expectedRevision: 1 },
        shot: { id: "shot" },
        title: "Synthetic Courtyard",
        shotType: "property_environment",
        settings: { aspectRatio: "16:9", durationSeconds: 4 },
        assetRefs: [
          {
            asset: { id: "environment" },
            slot: "environment",
            expectedRevision: 2,
          },
        ],
        sceneInstructions: "Keep the original geometry.",
      },
    ],
  };
}
