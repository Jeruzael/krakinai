import { it, expect } from "vitest";
import { buildAiContext, serializeAiContext } from "../domain/aiContext";
import { emptyState, exactImportPrompt } from "./fixtures/changeSetFixture";
import type { SavedScene } from "../types/domain";
function state() {
  const s = emptyState();
  s.preferences = {
    ...s.preferences,
    secretCanary: "PREFERENCE_SECRET",
  } as any;
  s.assets.push({
    ...s.assets[0],
    id: "asset_private_character",
    category: "characters",
    title: "Selected Character",
    promptText: "CHARACTER_IDENTITY_SECRET",
    identityAnchor: { text: "ANCHOR_SECRET" },
    notes: "ASSET_NOTE_SECRET",
  });
  s.scenes = [
    {
      id: "scene_selected",
      title: "Selected",
      authoringMode: "direct_prompt",
      directPrompt: { version: 1, text: exactImportPrompt },
      slots: {},
      settings: {},
      extraRequiredSlots: [],
      sceneInstructions: "",
      manualOutputs: {},
      outputs: { full: exactImportPrompt },
      references: [
        {
          mediaId: "media_one",
          role: "reference",
          altText: "ALT_SECRET",
          filename: "PRIVATE_FILENAME.png",
          order: 0,
        },
      ],
      resultMediaLinks: [],
      reviewStatus: "unreviewed",
      reviewNotes: "REVIEW_SECRET",
      revision: 1,
      createdAt: "2026-10-30T00:00:00.000Z",
      updatedAt: "2026-10-30T00:00:00.000Z",
      pendingInputs: [
        {
          version: 1,
          id: "pending",
          kind: "source_image",
          label: "PENDING_LABEL_SECRET",
          notes: "PENDING_NOTE_SECRET",
        },
      ],
    } as SavedScene,
    {
      id: "scene_unselected",
      title: "Other",
      outputs: { full: "UNSELECTED_PROMPT_SECRET" },
    } as SavedScene,
  ];
  s.collections = [
    {
      id: "collection_selected",
      name: "Selected Project",
      description: "PROJECT_DESCRIPTION_SECRET",
      planningNotes: "PLANNING_SECRET",
      members: [{ type: "scene", id: "scene_selected", addedAt: "2026-10-30" }],
      project: {
        version: 1,
        revision: 3,
        shots: [
          {
            id: "shot_one",
            order: 0,
            code: "01",
            title: "First",
            takeSceneIds: ["scene_selected"],
            selectedSceneId: "scene_selected",
            status: "planned",
            plannedDurationSeconds: 4,
            continuityNotes: "CONTINUITY_SECRET",
          },
        ],
      },
      createdAt: "2026-10-30",
      updatedAt: "2026-10-30",
    },
    {
      id: "collection_other",
      name: "UNRELATED_PROJECT_SECRET",
      description: "",
      members: [],
      createdAt: "2026-10-30",
      updatedAt: "2026-10-30",
    },
  ];
  return s;
}
it("exports selected metadata with exact revisions/head IDs and no private text,filenames,preferences or unrelated projects", () => {
  const snapshot = state(),
    before = structuredClone(snapshot),
    doc = buildAiContext(snapshot, {
      projectIds: ["collection_selected"],
      assetIds: ["asset_private_character"],
    }),
    text = JSON.stringify(doc);
  expect(doc.schema).toBe("krakinai.ai-context.v1");
  expect(text).toContain('"expectedRevision":3');
  expect(text).toContain("scene_selected");
  for (const canary of ["SECRET", exactImportPrompt, "blob", "app_preferences"])
    expect(text).not.toContain(canary);
  expect(snapshot).toEqual(before);
});
it("requires independent explicit opt-ins for scene prompts,identities,notes and filenames", () => {
  const snapshot = state(),
    base = {
      projectIds: ["collection_selected"],
      assetIds: ["asset_private_character"],
    };
  expect(
    JSON.stringify(
      buildAiContext(snapshot, { ...base, includeAssetText: true }),
    ),
  ).not.toContain("CHARACTER_IDENTITY_SECRET");
  const doc = buildAiContext(snapshot, {
      ...base,
      fullPromptSceneIds: ["scene_selected"],
      includeCharacterIdentity: true,
      includeNotes: true,
      includeMediaFilenames: true,
    }),
    text = JSON.stringify(doc);
  expect(doc.scenes[0].fullPrompt).toBe(exactImportPrompt);
  for (const canary of [
    "CHARACTER_IDENTITY_SECRET",
    "ANCHOR_SECRET",
    "PRIVATE_FILENAME.png",
    "PENDING_LABEL_SECRET",
    "PLANNING_SECRET",
  ])
    expect(text).toContain(canary);
  expect(text).not.toContain("UNSELECTED_PROMPT_SECRET");
  expect(text).not.toContain("PREFERENCE_SECRET");
  expect(text).not.toContain("UNRELATED_PROJECT_SECRET");
});
it("rejects unknown selections,unselected full-prompt targets and oversized contexts rather than truncating", () => {
  expect(() => buildAiContext(state(), { projectIds: ["missing"] })).toThrow(
    /unavailable|unknown/i,
  );
  expect(() =>
    buildAiContext(state(), {
      projectIds: ["collection_selected"],
      fullPromptSceneIds: ["scene_unselected"],
    }),
  ).toThrow(/selected|scope/i);
  const s = state();
  s.collections[0].project!.shots = Array.from({ length: 251 }, (_, i) => ({
    ...s.collections[0].project!.shots[0],
    id: "shot_" + i,
    order: i,
  }));
  expect(() =>
    buildAiContext(s, { projectIds: ["collection_selected"] }),
  ).toThrow(/250|limit/i);
  const large = state();
  large.scenes[0].outputs.full = "x".repeat(5 * 1024 * 1024);
  if (large.scenes[0].authoringMode === "direct_prompt")
    large.scenes[0].directPrompt.text = large.scenes[0].outputs.full;
  expect(() =>
    serializeAiContext(large, {
      projectIds: ["collection_selected"],
      fullPromptSceneIds: ["scene_selected"],
    }),
  ).toThrow(/5 MiB|size/i);
});
it("applies the 500 reusable-record bound across assets and templates together", () => {
  const s = state();
  s.templates = Array.from({ length: 500 }, (_, i) => ({
    id: "template_" + i,
    name: "Template",
    description: "",
    category: "Custom",
    requiredSlots: [],
    defaults: {},
    isStarter: false,
    revision: 1,
    createdAt: "2026-10-30",
    updatedAt: "2026-10-30",
  }));
  expect(() =>
    buildAiContext(s, {
      assetIds: ["asset_private_character"],
      templateIds: s.templates.map((t) => t.id),
    }),
  ).toThrow(/500|limit/i);
});
it("does not leak private labels embedded inside an internal reference-pack association ID", () => {
  const s = state();
  s.scenes[0].referencePack = {
    version: 1,
    entries: [
      {
        associationId:
          '["character","asset_one","PRIVATE_ASSOCIATION_LABEL_SECRET.png"]',
        mediaId: "media_one",
        sourceSlot: "character",
        sourceId: "asset_one",
        sourceTitle: "PRIVATE_SOURCE_TITLE_SECRET",
        role: "reference",
        altText: "PRIVATE_ALT_SECRET",
        filename: "PRIVATE_FILE_SECRET.png",
        purpose: "identity",
        order: 0,
      },
    ],
  };
  const doc = buildAiContext(s, { projectIds: ["collection_selected"] });
  expect(JSON.stringify(doc)).not.toContain("SECRET");
});
