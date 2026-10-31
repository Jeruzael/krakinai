import { it, expect } from "vitest";
import { planChangeSet } from "../domain/changeSetPlanner";
import { parseChangeSet } from "../domain/changeSetValidation";
import { buildRevisionDraft } from "../storage/sceneAuthoring";
import { canonicalStringify } from "../domain/changeSetCanonical";
import { allocationFor } from "./fixtures/changeSetFixture";
import {
  recipeChangeSet,
  recipeState,
  recipeApproval,
} from "./fixtures/recipeChangeSetFixture";
import type { ChangeSetState, ChangeSetApproval } from "../types/changeSet";
import { CINEMATOGRAPHY_TECHNIQUES } from "../domain/cinematographyRegistry";
const blocking = (p: ReturnType<typeof planChangeSet>) =>
  p.findings.filter((f) => f.severity === "blocking");
const plan = (
  input: any = recipeChangeSet(),
  state: ChangeSetState = recipeState(),
  approval: ChangeSetApproval = recipeApproval(),
) =>
  planChangeSet(parseChangeSet(input), approval, state, allocationFor(input));
function parentFixture() {
  const state = recipeState(),
    p = plan();
  state.scenes = p.scenes;
  state.collections = p.collections;
  return state;
}
function revision(state: ChangeSetState, type = "scene.revise_recipe"): any {
  const input: any = recipeChangeSet();
  input.changeSetId = "synthetic-revision";
  input.operations = [
    {
      operationId: "revision",
      type,
      clientRef: "revision",
      project: {
        id: "project",
        expectedRevision: state.collections[0].project!.revision,
      },
      shot: { id: "shot" },
      sceneId: state.scenes[0].id,
      expectedHeadId: state.scenes[0].id,
      overrides: { camera: { overrideText: "A slow scene-only push in." } },
    },
  ];
  return input;
}
it("assembles existing exact bindings as a genuine recipe with all three outputs and real provenance", () => {
  const state = recipeState(),
    before = canonicalStringify(state),
    p = plan();
  expect(blocking(p)).toEqual([]);
  expect(p.scenes).toHaveLength(1);
  const s = p.scenes[0];
  expect(s.authoringMode).toBe("recipe");
  expect(s.directPrompt).toBeUndefined();
  expect(s.manualOutputs).toEqual({});
  expect(s.slots.environment).toMatchObject({
    sourceType: "asset",
    sourceId: "environment",
    sourceRevision: 2,
    promptText: "A quiet enclosed courtyard.",
    compactText: "Enclosed courtyard.",
  });
  expect(s.outputs.full).toBe(
    "# Synthetic Courtyard\nScene Type: Single-shot video\nShot Type: Property / Environment\nAspect Ratio: 16:9\nIntended Duration: 4s\n\n## Environment / Location\nA quiet enclosed courtyard.\n\n## Additional Scene Instructions\nKeep the original geometry.",
  );
  expect(s.outputs.structured).toContain(
    "=== ENVIRONMENT / LOCATION ===\nA quiet enclosed courtyard.",
  );
  expect(s.outputs.compact).toContain("Enclosed courtyard.");
  expect(s.sceneRevision).toMatchObject({
    origin: "codex",
    originLabel: "Synthetic B1",
  });
  expect(s.sourceDraftId).toBeUndefined();
  expect(p.collections[0].project!.shots[0].takeSceneIds).toEqual([s.id]);
  expect(p.collections[0].project!.shots[0].selectedSceneId).toBeUndefined();
  expect(canonicalStringify(state)).toBe(before);
});
it.each(["create", "reuse", "defer"])(
  "resolves same-batch candidate via approved %s decision",
  (action) => {
    const input: any = recipeChangeSet(),
      op = input.operations[0],
      state = recipeState(),
      approval = recipeApproval();
    op.assetRefs = [{ asset: { ref: "candidate" }, slot: "environment" }];
    input.operations.unshift({
      operationId: "candidate",
      type: "asset.propose",
      clientRef: "candidate",
      kind: "environment",
      title: "Synthetic New Garden",
      promptText: "A new synthetic garden with a fountain.",
      tags: ["synthetic"],
    });
    approval.assetDecisions.candidate =
      action === "reuse"
        ? { action: "reuse", assetId: "environment", expectedRevision: 2 }
        : { action: action as "create" | "defer" };
    const p = plan(input, state, approval);
    if (action === "defer") {
      expect(blocking(p).some((f) => f.operationId === "recipe")).toBe(true);
      expect(p.scenes).toEqual([]);
      expect(p.idMappings.recipe).toBeUndefined();
    } else {
      expect(blocking(p)).toEqual([]);
      expect(p.scenes[0].slots.environment!.sourceId).toBe(
        action === "reuse" ? "environment" : p.assets[0].id,
      );
      if (action === "create") {
        expect(p.assets[0].reviewStatus).toBe("unreviewed");
        expect(p.assets[0].identityAnchor).toBeUndefined();
      }
    }
  },
);
it.each(["stale", "wrong category", "missing"])(
  "blocks %s existing binding without fabricating a record",
  (kind) => {
    const input: any = recipeChangeSet();
    if (kind === "stale") input.operations[0].assetRefs[0].expectedRevision = 1;
    if (kind === "wrong category")
      input.operations[0].assetRefs[0] = {
        asset: { id: "camera" },
        slot: "environment",
        expectedRevision: 1,
      };
    if (kind === "missing")
      input.operations[0].assetRefs[0].asset.id = "deleted";
    const p = plan(input);
    expect(blocking(p).length).toBeGreaterThan(0);
    expect(p.scenes).toEqual([]);
  },
);
it("preserves frozen non-camera slots across a camera-only revision after a global asset edit", () => {
  const state = parentFixture();
  expect(state.scenes).toHaveLength(1);
  const parent = structuredClone(state.scenes[0]);
  state.assets.find((a) => a.id === "environment")!.promptText =
    "New library environment must not replace frozen text.";
  state.assets.find((a) => a.id === "environment")!.revision = 3;
  const input = revision(state);
  input.operations[0].assetRefs = [
    { asset: { id: "camera" }, slot: "camera", expectedRevision: 1 },
  ];
  const p = plan(input, state);
  expect(blocking(p)).toEqual([]);
  const s = p.scenes[0];
  expect(s.slots.environment).toEqual(parent.slots.environment);
  expect(s.sceneInstructions).toBe(parent.sceneInstructions);
  expect(s.settings).toEqual(parent.settings);
  expect(s.slots.camera!.promptText).toContain("Static eye-level");
  expect(s.slots.camera!.overrideText).toBe("A slow scene-only push in.");
  expect(s.outputs.full).toContain("A quiet enclosed courtyard.");
  expect(s.outputs.full).not.toContain("New library");
  expect(state.scenes[0]).toEqual(parent);
  const reopened = buildRevisionDraft(s.id, {
    scenes: [...state.scenes, s],
    collections: p.collections,
  });
  expect(reopened.authoringMode).not.toBe("direct_prompt");
  expect(reopened.slots.camera!.overrideText).toBe(
    "A slow scene-only push in.",
  );
});
it("creates an alternate recipe take without altering the old root or preferred take", () => {
  const state = parentFixture();
  expect(state.scenes).toHaveLength(1);
  state.collections[0].project!.shots[0].selectedSceneId = state.scenes[0].id;
  const input = revision(state, "scene.create_recipe_take");
  input.operations[0].sceneInstructions = "Alternate synthetic framing.";
  delete input.operations[0].overrides;
  const p = plan(input, state);
  expect(blocking(p)).toEqual([]);
  expect(p.scenes[0].sceneRevision!.rootSceneId).toBe(p.scenes[0].id);
  expect(p.scenes[0].separateTakeOfSceneId).toBe(state.scenes[0].id);
  expect(p.collections[0].project!.shots[0].selectedSceneId).toBe(
    state.scenes[0].id,
  );
});
it("requires human acknowledgement before reassembling a parent with manual output overrides", () => {
  const state = parentFixture();
  expect(state.scenes).toHaveLength(1);
  state.scenes[0].manualOutputs = {
    full: {
      text: "MANUAL OLD OUTPUT",
      basedOnInputRevision: 1,
      updatedAt: "2026-10-31T00:00:00.000Z",
    },
  };
  state.scenes[0].outputs.full = "MANUAL OLD OUTPUT";
  const input = revision(state);
  delete input.operations[0].overrides;
  input.operations[0].sceneInstructions = "Explicit new directions.";
  const p = plan(input, state);
  expect(blocking(p).some((f) => f.code === "RECIPE_MANUAL_OUTPUTS")).toBe(
    true,
  );
  const accepted = plan(input, state, {
    ...recipeApproval(),
    discardManualOutputOperations: ["revision"],
  });
  expect(blocking(accepted)).toEqual([]);
  expect(accepted.scenes[0].manualOutputs).toEqual({});
  expect(accepted.scenes[0].outputs.full).not.toContain("MANUAL OLD OUTPUT");
  expect(state.scenes[0].outputs.full).toBe("MANUAL OLD OUTPUT");
});
it("keeps incomplete recipes inspectable and unsaved rather than converting to Direct Prompt", () => {
  const input: any = recipeChangeSet();
  delete input.operations[0].assetRefs;
  const p = plan(input);
  expect(
    blocking(p).some((f) => /environment.*required/i.test(f.message)),
  ).toBe(true);
  expect(p.scenes).toEqual([]);
  expect(p.idMappings.recipe).toBeUndefined();
  expect(p.operations[0].details).toEqual(input.operations[0]);
  expect(p.operations[0].resolved).toMatchObject({
    recipe: { readiness: "blocked" },
  });
});
it("allows optional pending production references with honest readiness warnings", () => {
  const input: any = recipeChangeSet();
  input.operations[0].pendingInputs = [
    {
      version: 1,
      id: "reference-pending",
      kind: "reference_image",
      label: "Approved facade reference pending",
    },
  ];
  const p = plan(input);
  expect(blocking(p)).toEqual([]);
  expect(p.scenes).toHaveLength(1);
  expect(
    p.findings.some(
      (f) => f.severity === "advisory" && /pending/i.test(f.message),
    ),
  ).toBe(true);
  expect(p.scenes[0].pendingInputs).toEqual(input.operations[0].pendingInputs);
});
it.each(["graphic_motion", "existing_footage"])(
  "blocks %s without an actual original and rejects explicitly inapplicable components",
  (shotType) => {
    const input: any = recipeChangeSet();
    input.operations[0].shotType = shotType;
    delete input.operations[0].assetRefs;
    const p = plan(input);
    expect(blocking(p).some((f) => /source|original/i.test(f.message))).toBe(
      true,
    );
    expect(p.scenes).toEqual([]);
    input.operations[0].assetRefs = [
      {
        asset: { id: "environment" },
        slot: "environment",
        expectedRevision: 2,
      },
    ];
    expect(
      blocking(plan(input)).some((f) => /inapplicable/i.test(f.message)),
    ).toBe(true);
  },
);
it("blocks implicit Direct Prompt conversion for recipe revision", () => {
  const state = parentFixture();
  expect(state.scenes).toHaveLength(1);
  const parent: any = state.scenes[0];
  parent.authoringMode = "direct_prompt";
  parent.directPrompt = { version: 1, text: parent.outputs.full };
  const input = revision(state);
  expect(
    blocking(plan(input, state)).some((f) =>
      /recipe parent|conversion/i.test(f.message),
    ),
  ).toBe(true);
});
it("allows a deliberate unchanged alternate take but rejects an empty revision", () => {
  const state = parentFixture();
  const input = revision(state, "scene.create_recipe_take");
  delete input.operations[0].overrides;
  expect(() => parseChangeSet(input)).not.toThrow();
  expect(blocking(plan(input, state))).toEqual([]);
  input.operations[0].type = "scene.revise_recipe";
  expect(() => parseChangeSet(input)).toThrow(/empty/i);
});
it("binds a same-character stored variant without inferring or rewriting identity", () => {
  const state = recipeState(),
    input: any = recipeChangeSet();
  Object.assign(input.operations[0], {
    shotType: "character_scene",
    assetRefs: [
      ...input.operations[0].assetRefs,
      { asset: { id: "action" }, slot: "action", expectedRevision: 1 },
      { asset: { id: "character" }, slot: "character", expectedRevision: 1 },
    ],
    variantRefs: [
      { variantId: "variant", slot: "wardrobe", expectedRevision: 1 },
    ],
    dialogue: {
      speaker: "Mika",
      line: "Dito tayo. 😊",
      mode: "on_camera",
      performanceDirection: {
        version: 2,
        emotion: { primary: "calm" },
        voice: { tone: "warm" },
      },
    },
  });
  state.variants = [
    {
      id: "variant",
      parentCharacterId: "character",
      targetSlot: "wardrobe",
      type: "Outfit",
      title: "Synthetic linen outfit",
      promptText: "A linen overshirt.",
      tags: [],
      mediaLinks: [],
      favorite: false,
      reviewStatus: "unreviewed",
      revision: 1,
      createdAt: "2026-10-31",
      updatedAt: "2026-10-31",
    },
  ];
  const before = canonicalStringify(state),
    p = plan(input, state);
  expect(blocking(p)).toEqual([]);
  expect(p.scenes[0].slots.wardrobe).toMatchObject({
    sourceId: "variant",
    sourceType: "variant",
    sourceRevision: 1,
    parentCharacterId: "character",
  });
  expect(p.scenes[0].outputs.full).toContain('"Dito tayo. 😊"');
  expect(canonicalStringify(state)).toBe(before);
  state.variants[0].parentCharacterId = "another-character";
  expect(
    blocking(plan(input, state)).some((f) =>
      /another character|mismatch/i.test(f.message),
    ),
  ).toBe(true);
  state.variants[0].revision = 2;
  expect(
    blocking(plan(input, state)).some((f) =>
      /variant.*changed/i.test(f.message),
    ),
  ).toBe(true);
});
it("uses only an actually approved fresh anchor and falls back honestly without modifying it", () => {
  const state = recipeState(),
    input: any = recipeChangeSet(),
    character = state.assets.find((a) => a.id === "character")!;
  character.identityAnchor = {
    text: "Approved short identity.",
    approvedText: "Approved short identity.",
    approvedAt: "2026-10-31T00:00:00.000Z",
    approvedMasterIdentityRevision: 1,
  };
  input.operations[0].assetRefs.push({
    asset: { id: "character" },
    slot: "character",
    expectedRevision: 1,
  });
  input.operations[0].identitySource = "approved_anchor";
  const p = plan(input, state);
  expect(blocking(p)).toEqual([]);
  expect(p.scenes[0].generation).toMatchObject({
    identitySource: "approved_anchor",
    anchor: { text: "Approved short identity." },
  });
  expect(p.scenes[0].slots.character!.promptText).toBe(
    "An adult synthetic presenter named Mika.",
  );
  character.identityRevision = 2;
  const stale = plan(input, state);
  expect(blocking(stale)).toEqual([]);
  expect(stale.scenes[0].generation!.identitySource).toBe("master");
  expect(
    stale.findings.some((f) => f.code === "GENERATION_IDENTITY_REVIEW"),
  ).toBe(true);
  expect(character.identityAnchor.approvedMasterIdentityRevision).toBe(1);
});
it("applies and resets a scene-only camera blueprint using the existing composer", () => {
  const input: any = recipeChangeSet();
  input.operations[0].cameraComposition = {
    version: 1,
    techniqueIds: [],
    parameters: { focalLengthMm: 50 },
  };
  const first = plan(input);
  expect(blocking(first)).toEqual([]);
  expect(first.assets).toEqual([]);
  expect(first.scenes[0].slots.camera).toMatchObject({
    sourceType: "template",
    sourceId: "builtin:camera-composition:v1",
  });
  expect(first.scenes[0].outputs.full).toContain("50");
  const state = recipeState();
  state.scenes = first.scenes;
  state.collections = first.collections;
  const patch = revision(state);
  delete patch.operations[0].overrides;
  patch.operations[0].cameraComposition = null;
  const next = plan(patch, state);
  expect(blocking(next)).toEqual([]);
  expect(next.scenes[0].slots.camera).toBeUndefined();
  expect(first.scenes[0].slots.camera!.cameraComposition).toBeDefined();
});
it("merges named settings and clears dialogue without altering frozen components", () => {
  const state = parentFixture();
  state.scenes[0].settings.toolNotes = "Keep these provider notes.";
  state.scenes[0].dialogue = {
    speaker: "Narrator",
    line: "Existing words.",
    mode: "voiceover",
  };
  const input = revision(state);
  delete input.operations[0].overrides;
  input.operations[0].settings = { durationSeconds: 6 };
  input.operations[0].dialogue = null;
  const p = plan(input, state);
  expect(blocking(p)).toEqual([]);
  expect(p.scenes[0].settings).toEqual({
    aspectRatio: "16:9",
    durationSeconds: 6,
    toolNotes: "Keep these provider notes.",
  });
  expect(p.scenes[0].dialogue).toBeUndefined();
  expect(p.scenes[0].slots).toEqual(state.scenes[0].slots);
  expect(state.scenes[0].dialogue!.line).toBe("Existing words.");
});
it.each(["valid", "missing", "unsupported", "bytes", "metadata"])(
  "checks actual original image storage: %s",
  (kind) => {
    const state = recipeState(),
      input: any = recipeChangeSet();
    Object.assign(input.operations[0], {
      shotType: "graphic_motion",
      assetRefs: [],
      sourceMedia: [
        {
          mediaId: "original",
          role: "reference",
          mimeType: kind === "metadata" ? "image/jpeg" : "image/png",
        },
      ],
      sceneInstructions: "Animate only the original graphic.",
    });
    // Opaque unit fixture exercises metadata validation, not image decoding.
    if (kind !== "missing")
      state.media = [
        {
          id: "original",
          filename: "opaque-unit-fixture.png",
          safeFilename: "opaque-unit-fixture.png",
          mimeType: kind === "unsupported" ? "video/mp4" : "image/png",
          byteSize: kind === "bytes" ? 99 : 6,
          blob: new Blob(["opaque"], {
            type: kind === "unsupported" ? "video/mp4" : "image/png",
          }),
          createdAt: "2026-10-31",
        },
      ];
    const p = plan(input, state);
    if (kind === "valid") {
      expect(blocking(p)).toEqual([]);
      expect(p.scenes[0].sourceMediaLinks![0].filename).toBe(
        "opaque-unit-fixture.png",
      );
      expect(p.scenes[0].sourceMediaLinks![0].mediaId).toBe("original");
      expect(p.scenes[0].outputs.full).toContain(
        "Animate only the original graphic.",
      );
    } else {
      expect(blocking(p).length).toBeGreaterThan(0);
      expect(p.scenes).toEqual([]);
    }
  },
);
it("blocks explicit extra references that the selected Shot Type would filter rather than silently losing them", () => {
  const input: any = recipeChangeSet();
  input.operations[0].references = [
    {
      mediaId: "unbound-guide",
      role: "sample",
      altText: "Pending unbound visual guide",
    },
  ];
  const p = plan(input);
  expect(
    blocking(p).some((f) => /reference.*active|pending input/i.test(f.message)),
  ).toBe(true);
  expect(p.scenes).toEqual([]);
});
it("keeps implicit legacy Character Scene semantics when adding explicit reference associations", () => {
  const state = parentFixture();
  delete state.scenes[0].shotType;
  state.scenes[0].slots.action = {
    slot: "action",
    sourceType: "asset",
    sourceId: "action",
    sourceTitle: "Historic action",
    sourceRevision: 1,
    promptText: "Wait by the door.",
    mediaLinks: [],
  };
  state.media = [
    {
      id: "legacy-guide",
      filename: "opaque-legacy-unit.png",
      safeFilename: "opaque-legacy-unit.png",
      mimeType: "image/png",
      byteSize: 6,
      blob: new Blob(["opaque"], { type: "image/png" }),
      createdAt: "2026-10-31",
    },
  ];
  const input = revision(state);
  delete input.operations[0].overrides;
  input.operations[0].references = [
    {
      mediaId: "legacy-guide",
      role: "sample",
      altText: "A retained general reference",
    },
  ];
  const p = plan(input, state);
  expect(blocking(p)).toEqual([]);
  expect(
    p.scenes[0].referencePack!.entries.some(
      (e) => e.mediaId === "legacy-guide",
    ),
  ).toBe(true);
});
it("reports a missing optional reference once through canonical Preflight and leaves assembly saveable", () => {
  const state = recipeState();
  state.assets.find((a) => a.id === "environment")!.mediaLinks = [
    {
      mediaId: "missing-guide",
      role: "sample",
      altText: "Missing optional guide",
      order: 0,
    },
  ];
  const p = plan(recipeChangeSet(), state);
  expect(blocking(p)).toEqual([]);
  expect(
    p.findings.filter(
      (f) =>
        f.code === "RECIPE_PREFLIGHT_P008" ||
        f.code === "RECIPE_GENERATION_PENDING",
    ),
  ).toHaveLength(1);
  expect((p.operations[0].resolved as any).recipe.readiness).toBe(
    "assembled_pending",
  );
});
it.each(["replace", "clear"])(
  "keeps unique reference order when %s follows a user-reordered parent pack",
  (mode) => {
    const state = recipeState();
    state.media = [
      {
        id: "guide",
        filename: "opaque-order-unit.png",
        safeFilename: "opaque-order-unit.png",
        mimeType: "image/png",
        byteSize: 6,
        blob: new Blob(["opaque"], { type: "image/png" }),
        createdAt: "2026-10-31",
      },
    ];
    state.assets.find((a) => a.id === "environment")!.mediaLinks = [
      {
        mediaId: "guide",
        role: "reference",
        altText: "Frozen environment reference",
        order: 0,
      },
    ];
    const input: any = recipeChangeSet();
    input.operations[0].references = [
      { mediaId: "guide", role: "sample", altText: "Original extra" },
    ];
    const first = plan(input, state);
    expect(blocking(first)).toEqual([]);
    state.scenes = first.scenes;
    state.collections = first.collections;
    const parent = state.scenes[0],
      component = parent.referencePack!.entries.find(
        (e) => !e.associationId.startsWith("change-set:reference:"),
      )!,
      extra = parent.referencePack!.entries.find((e) =>
        e.associationId.startsWith("change-set:reference:"),
      )!;
    parent.referencePack!.entries = [
      { ...extra, order: 0 },
      { ...component, order: 1 },
    ];
    const frozen = structuredClone(parent),
      next = revision(state);
    delete next.operations[0].overrides;
    next.operations[0].references =
      mode === "clear"
        ? []
        : [{ mediaId: "guide", role: "sample", altText: "Replacement extra" }];
    const result = plan(next, state);
    expect(blocking(result)).toEqual([]);
    const entries = result.scenes[0].referencePack!.entries;
    expect(entries.map((e) => e.order)).toEqual(
      mode === "clear" ? [0] : [0, 1],
    );
    expect(entries[0]).toEqual({
      ...frozen.referencePack!.entries[1],
      order: 0,
    });
    expect(state.scenes[0]).toEqual(frozen);
    expect(result.scenes[0].slots.environment).toEqual(
      frozen.slots.environment,
    );
  },
);
it("retains existing Scene Preflight review/information warnings without making them blockers or exposing evidence text", () => {
  const state = recipeState(),
    input: any = recipeChangeSet();
  state.assets.find((a) => a.id === "character")!.title =
    "Mika / Base Identity";
  state.assets.find((a) => a.id === "character")!.promptText =
    "A photorealistic adult identity. PRIVATE_IDENTITY_EVIDENCE";
  state.assets.find((a) => a.id === "camera")!.promptText =
    "Position the camera about 135 degrees from the subject's forward axis, toward the left-rear side.";
  state.assets.find((a) => a.id === "action")!.promptText =
    "Maintain direct eye contact with the camera lens.";
  state.assets.push({
    ...state.assets[0],
    id: "style",
    category: "styles",
    revision: 1,
    title: "Synthetic feature animation",
    promptText: "High-craft stylized 3D feature animation",
  });
  Object.assign(input.operations[0], {
    shotType: "character_scene",
    assetRefs: [
      ...input.operations[0].assetRefs,
      ...["character", "action", "camera", "style"].map((slot) => ({
        asset: { id: slot },
        slot,
        expectedRevision: 1,
      })),
    ],
    dialogue: { speaker: "Mika", line: "Dito tayo.", mode: "on_camera" },
  });
  const p = plan(input, state);
  expect(blocking(p)).toEqual([]);
  expect(
    p.findings.some(
      (f) => f.code === "RECIPE_PREFLIGHT_P001" && f.severity === "advisory",
    ),
  ).toBe(true);
  expect(
    p.findings.some(
      (f) => f.code === "RECIPE_PREFLIGHT_P004" && f.severity === "advisory",
    ),
  ).toBe(true);
  expect(p.findings.some((f) => f.code === "RECIPE_PREFLIGHT_P005")).toBe(
    false,
  );
  expect(JSON.stringify(p.findings)).not.toContain("PRIVATE_IDENTITY_EVIDENCE");
});
it("surfaces canonical camera combination advice in recipe preview", () => {
  const input: any = recipeChangeSet(),
    moves = CINEMATOGRAPHY_TECHNIQUES.filter(
      (t) =>
        t.owner === "camera" &&
        t.kind === "technique" &&
        t.dimension === "movement",
    ),
    staticMove = moves.find((t) => t.motionKind === "static")!,
    travel = moves.find((t) => t.motionKind === "translation")!;
  input.operations[0].cameraComposition = {
    version: 1,
    techniqueIds: [staticMove.id, travel.id],
  };
  const p = plan(input);
  expect(blocking(p)).toEqual([]);
  expect(
    p.findings.some(
      (f) => f.code.startsWith("RECIPE_CAMERA_") && /static/i.test(f.message),
    ),
  ).toBe(true);
});
it("builds a single-character recipe from newly approved Character, Environment and Action candidates in one atomic plan", () => {
  const input: any = recipeChangeSet(),
    scene = input.operations[0],
    approval = recipeApproval();
  scene.shotType = "character_scene";
  scene.assetRefs = ["character", "environment", "action"].map((slot) => ({
    slot,
    asset: { ref: "new-" + slot },
  }));
  scene.dialogue = {
    speaker: "Mika",
    line: "Welcome to the courtyard.",
    mode: "on_camera",
  };
  input.operations = [
    ...(["character", "environment", "action"] as const).map((kind) => ({
      operationId: "new-" + kind,
      type: "asset.propose",
      clientRef: "new-" + kind,
      kind,
      title: "Synthetic proposed " + kind,
      promptText:
        kind === "character"
          ? "A fictional adult guide wearing round glasses."
          : kind === "environment"
            ? "A sunken conservatory lined with ferns."
            : "Welcome the visitor with an open palm.",
      tags: ["synthetic"],
    })),
    scene,
  ];
  for (const kind of ["character", "environment", "action"])
    approval.assetDecisions["new-" + kind] = {
      action: "create",
      acknowledgeDuplicate: true,
    };
  const p = plan(input, recipeState(), approval);
  expect(blocking(p)).toEqual([]);
  expect(p.assets).toHaveLength(3);
  expect(p.scenes).toHaveLength(1);
  for (const slot of ["character", "environment", "action"] as const) {
    expect(p.scenes[0].slots[slot]!.sourceId).toBe(
      p.idMappings["new-" + slot].assetId,
    );
    expect(
      p.assets.find((a) => a.id === p.scenes[0].slots[slot]!.sourceId)!
        .reviewStatus,
    ).toBe("unreviewed");
  }
  expect(p.scenes[0].slots.character!.identityAnchor).toBeUndefined();
});
