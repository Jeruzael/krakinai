import type {
  ChangeSet,
  ChangeSetApproval,
  ChangeSetAllocation,
  ChangeSetState,
} from "../../types/changeSet";
import type { PromptAsset } from "../../types/domain";
export const exactImportPrompt =
  '  # MIDORI — Synthetic\r\n\r\n“Dito tayo, tara na!” 😊 e\u0301\r\n\t{"negative":"Do not invent facts."}  ';
export function syntheticCamera(): PromptAsset {
  return {
    id: "asset_synthetic_camera",
    title: "Synthetic Studio Camera",
    category: "camera",
    description: "Synthetic reusable camera fixture.",
    promptText:
      "Static eye-level camera. Stable wide composition with no invented movement.",
    tags: ["synthetic", "camera"],
    mediaLinks: [],
    favorite: false,
    reviewStatus: "unreviewed",
    provenance: {},
    notes: "",
    revision: 1,
    createdAt: "2026-10-30T00:00:00.000Z",
    updatedAt: "2026-10-30T00:00:00.000Z",
  };
}
export function midoriChangeSet(): ChangeSet {
  const operations: ChangeSet["operations"] = [
    {
      operationId: "project",
      type: "project.create",
      clientRef: "midori",
      name: "Synthetic MIDORI — 60-second plan",
      description:
        "Fictional test planning only; no verified commercial claims.",
      planningNotes:
        "Review every property claim against approved source material.",
    },
  ];
  for (let i = 0; i < 15; i++) {
    const code = String(i + 1).padStart(2, "0"),
      shotType =
        i < 2
          ? "character_scene"
          : i < 11
            ? "property_environment"
            : "graphic_motion";
    operations.push({
      operationId: `shot-${code}`,
      type: "shot.create",
      clientRef: `shot-${code}`,
      project: { ref: "midori" },
      code,
      title: `Synthetic shot ${code}`,
      plannedShotType: shotType,
      plannedDurationSeconds: 4,
      continuityNotes:
        "Planning metadata only. Verify source details before generation.",
    });
    operations.push({
      operationId: `prompt-${code}`,
      type: "scene.create_direct_prompt",
      clientRef: `scene-${code}`,
      project: { ref: "midori" },
      shot: { ref: `shot-${code}` },
      title: `MIDORI ${code}`,
      shotType,
      settings: { aspectRatio: "9:16", durationSeconds: 4 },
      prompt: {
        version: 1,
        text: `${exactImportPrompt}\r\nShot ${code}: ${i < 2 ? "Presenter introduction; approved identity remains to be selected." : i < 11 ? "Show only the supplied property details." : "Animate the approved original graphic without changing its contents."}`,
        origin: "chatgpt",
      },
      ...(i === 0
        ? {
            assetRefs: [
              {
                asset: { id: "asset_synthetic_camera" },
                slot: "camera",
                expectedRevision: 1,
              },
            ],
          }
        : {}),
      ...(i >= 11
        ? {
            pendingInputs: [
              {
                version: 1,
                id: `original-${code}`,
                kind: "source_image",
                label: `Approved original graphic ${code}`,
                notes: "Upload and associate manually before generation.",
              },
            ],
          }
        : {}),
      claims: [
        {
          kind: "property",
          text: "All property information is unverified until checked against approved source material.",
          verified: false,
        },
      ],
    });
  }
  operations.push({
    operationId: "camera-candidate",
    type: "asset.propose",
    clientRef: "camera-candidate",
    kind: "camera",
    title: "Synthetic gentle push-in",
    promptText:
      "A slow physical push-in along a clear path, preserving the supplied composition.",
    tags: ["synthetic", "push-in"],
  });
  operations.push({
    operationId: "character-candidate",
    type: "asset.propose",
    clientRef: "character-candidate",
    kind: "character",
    title: "Synthetic presenter proposal",
    promptText:
      "Unreviewed proposed presenter description. A human must supply and approve all identity details.",
    tags: ["synthetic", "proposal"],
  });
  return {
    schema: "krakinai.change-set.v1",
    changeSetId: "synthetic-midori-60s-v1",
    source: { kind: "chatgpt", label: "Synthetic MIDORI planning" },
    title: "Synthetic MIDORI — 15 shots / 60 seconds",
    operations,
  };
}
export const allContentApproval = (): ChangeSetApproval => ({
  storyboard: true,
  scenes: true,
  preferred: false,
  statuses: false,
  assetDecisions: {},
  allowDuplicateSceneOperations: [],
});
export function allocationFor(input: ChangeSet): ChangeSetAllocation {
  return {
    preparedAt: "2026-10-30T00:00:00.000Z",
    ids: Object.fromEntries(
      input.operations.map((o) => [
        o.operationId,
        `${o.type.startsWith("project.") ? "collection" : o.type.startsWith("shot.") ? "shot" : o.type.startsWith("scene.") ? "scene" : "candidate"}_import_${o.operationId.replaceAll("-", "_")}`,
      ]),
    ),
  };
}
export function emptyState(): ChangeSetState {
  return {
    assets: [syntheticCamera()],
    collections: [],
    scenes: [],
    media: [],
    templates: [],
    preferences: {
      id: "app_preferences",
      schemaVersion: 1,
      starterLoaded: false,
      updatedAt: "2026-10-30T00:00:00.000Z",
    },
  };
}
