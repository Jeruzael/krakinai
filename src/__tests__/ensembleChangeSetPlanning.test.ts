import { it, expect } from "vitest";
import { planChangeSet } from "../domain/changeSetPlanner";
import { parseChangeSet } from "../domain/changeSetValidation";
import { canonicalStringify } from "../domain/changeSetCanonical";
import { changeSetStateSignature } from "../domain/changeSetState";
import { recipeContentProjection } from "../domain/changeSetRecipeContent";
import { validateChangeSetBackupCapacity } from "../domain/changeSetCapacity";
import { buildGenerationDocument } from "../domain/generationDocument";
import { resolveEnsembleGenerationIdentities } from "../domain/ensembleDocument";
import { allocationFor } from "./fixtures/changeSetFixture";
import { recipeApproval } from "./fixtures/recipeChangeSetFixture";
import {
  ensembleChangeSet,
  outfitProposal,
} from "./fixtures/ensembleChangeSetFixture";
import {
  ensembleState,
  ensembleParentState,
} from "./fixtures/ensemblePlanningFixture";
import type { ChangeSetState, ChangeSetApproval } from "../types/changeSet";
const blocked = (p: ReturnType<typeof planChangeSet>) =>
  p.findings.filter((f) => f.severity === "blocking");
const plan = (
  p = ensembleChangeSet(),
  state = ensembleState(),
  approval: ChangeSetApproval = recipeApproval(),
) => planChangeSet(parseChangeSet(p), approval, state, allocationFor(p));
function revise(state: ChangeSetState, ensemble?: unknown): any {
  return {
    schema: "krakinai.change-set.v3",
    changeSetId: "synthetic-ensemble-revision",
    source: { kind: "codex" },
    operations: [
      {
        operationId: "revision",
        type: "scene.revise_recipe",
        clientRef: "revision",
        sceneId: state.scenes[0].id,
        expectedHeadId: state.scenes[0].id,
        project: {
          id: "project",
          expectedRevision: state.collections[0].project!.revision,
        },
        shot: { id: "shot" },
        assetRefs: [
          { asset: { id: "camera" }, expectedRevision: 1, slot: "camera" },
        ],
        ...(ensemble !== undefined ? { ensemble } : {}),
      },
    ],
  };
}
it("assembles stored actors and per-person Outfits into one genuine immutable scene with exact cue order", () => {
  const p = ensembleChangeSet(),
    s = ensembleState(),
    before = canonicalStringify(s);
  p.operations[0].ensemble.participantUpserts[0].wardrobe = {
    variant: { id: "aya-outfit" },
    expectedRevision: 1,
  };
  p.operations[0].ensemble.participantUpserts[1].wardrobe = {
    variant: { id: "lucas-suit" },
    expectedRevision: 1,
  };
  const result = plan(p, s);
  expect(blocked(result)).toEqual([]);
  expect(
    result.scenes[0].ensemble?.participants.map((p) => [
      p.id,
      p.character.sourceId,
      p.wardrobe?.parentCharacterId,
    ]),
  ).toEqual([
    ["aya", "character", "character"],
    ["lucas", "lucas", "lucas"],
  ]);
  expect(result.scenes[0].outputs.full).toContain("  I do.\r\n😊  ");
  expect(result.scenes[0].ensemble?.dialogueCues.map((c) => c.id)).toEqual([
    "officiant",
    "lucas-reply",
  ]);
  expect(result.scenes[0].slots.character?.sourceId).toBe("character");
  expect(canonicalStringify(s)).toBe(before);
});
it("preserves frozen participants/cues and the preferred take on a shared Camera-only revision after live identity changes", () => {
  const s = ensembleParentState(),
    original = structuredClone(s.scenes[0].ensemble);
  s.assets.find((a) => a.id === "lucas")!.promptText = "CHANGED LIVE MASTER";
  const result = plan(revise(s), s);
  expect(blocked(result)).toEqual([]);
  expect(result.scenes[0].ensemble).toEqual(original);
  expect(result.scenes[0].outputs.full).not.toContain("CHANGED LIVE MASTER");
  expect(result.collections[0].project!.shots[0].selectedSceneId).toBe(
    "ensemble-parent",
  );
  expect(s.scenes[0].ensemble).toEqual(original);
});
it("adds a third participant and explicitly changes primary without refreshing or removing the others", () => {
  const s = ensembleParentState(),
    patch = {
      version: 1,
      participantUpserts: [
        {
          id: "marco",
          character: { asset: { id: "marco" }, expectedRevision: 1 },
          wardrobe: { variant: { id: "marco-suit" }, expectedRevision: 1 },
          presence: "on_camera",
        },
      ],
      participantOrder: ["lucas", "primary", "marco"],
      primaryParticipantId: "lucas",
    };
  const result = plan(revise(s, patch), s);
  expect(blocked(result)).toEqual([]);
  const scene = result.scenes[0];
  expect(scene.ensemble!.participants.map((p) => p.id)).toEqual(
    patch.participantOrder,
  );
  expect(scene.ensemble!.participants.find((p) => p.id === "primary")).toEqual(
    s.scenes[0].ensemble!.participants[0],
  );
  expect(scene.ensemble!.dialogueCues).toEqual(
    s.scenes[0].ensemble!.dialogueCues,
  );
  expect(scene.slots.character).toEqual(
    scene.ensemble!.participants[0].character,
  );
});
it.each([
  "unknown removal",
  "incomplete order",
  "duplicate identity",
  "wrong Outfit parent",
  "missing actor",
  "stale actor",
  "wrong category",
  "source-kind visual",
])("blocks %s without changing state", (which) => {
  const s = ensembleParentState(),
    patch: any = {
      version: 1,
      participantUpserts: [{ id: "lucas", role: "Groom" }],
    };
  if (which === "unknown removal") {
    delete patch.participantUpserts;
    patch.removeParticipantIds = ["unknown"];
  }
  if (which === "incomplete order") patch.participantOrder = ["primary"];
  if (which === "duplicate identity")
    patch.participantUpserts = [
      {
        id: "duplicate",
        character: { asset: { id: "character" }, expectedRevision: 1 },
      },
    ];
  if (which === "wrong Outfit parent")
    patch.participantUpserts[0].wardrobe = {
      variant: { id: "aya-outfit" },
      expectedRevision: 1,
    };
  if (which === "missing actor")
    patch.participantUpserts[0].character = {
      asset: { id: "missing" },
      expectedRevision: 1,
    };
  if (which === "stale actor")
    patch.participantUpserts[0].character = {
      asset: { id: "lucas" },
      expectedRevision: 999,
    };
  if (which === "wrong category")
    patch.participantUpserts[0].character = {
      asset: { id: "environment" },
      expectedRevision: 2,
    };
  const p = revise(s, patch);
  if (which === "source-kind visual") {
    p.operations[0].shotType = "graphic_motion";
    p.operations[0].sceneInstructions = "Animate the original.";
  }
  const before = canonicalStringify(s);
  expect(blocked(plan(p, s)).length).toBeGreaterThan(0);
  expect(canonicalStringify(s)).toBe(before);
});
it("seeds a legacy parent dialogue once on explicit opt-in while preserving frozen template sources", () => {
  const s = ensembleParentState(),
    parent = s.scenes[0];
  delete parent.ensemble;
  parent.slots.character!.sourceType = "template";
  parent.slots.character!.sourceId = "old-template";
  parent.slots.wardrobe!.sourceType = "template";
  delete parent.slots.wardrobe!.parentCharacterId;
  parent.dialogue = {
    speaker: "Aya",
    line: "  Original\r\n😊  ",
    mode: "on_camera",
  };
  const result = plan(
    revise(s, {
      version: 1,
      participantUpserts: [{ id: "primary", role: "Presenter" }],
    }),
    s,
  );
  expect(blocked(result)).toEqual([]);
  expect(result.scenes[0].ensemble!.participants[0].character).toEqual(
    parent.slots.character,
  );
  expect(result.scenes[0].ensemble!.participants[0].wardrobe).toEqual(
    parent.slots.wardrobe,
  );
  expect(result.scenes[0].ensemble!.dialogueCues.map((c) => c.line)).toEqual([
    parent.dialogue.line,
  ]);
  expect(result.scenes[0].dialogue).toBeUndefined();
});
it.each(["krakinai.change-set.v1", "krakinai.change-set.v2"])(
  "requires v3 when %s reconstructs an ensemble parent but keeps metadata-only take operations available",
  (schema) => {
    const s = ensembleParentState(),
      p = revise(s);
    p.schema = schema;
    if (schema === "krakinai.change-set.v1")
      p.operations[0] = {
        ...p.operations[0],
        type: "scene.revise",
        prompt: { version: 1, text: "Cannot flatten an ensemble." },
      };
    const result = plan(p, s);
    expect(blocked(result).some((f) => /v3/i.test(f.message))).toBe(true);
    p.operations = [
      {
        operationId: "attach",
        type: "shot.attach_take",
        project: { id: "project", expectedRevision: 1 },
        shot: { id: "shot" },
        scene: { id: "ensemble-parent" },
      },
    ];
    expect(blocked(plan(p, s))).toEqual([]);
  },
);
it("resolves separately approved Character and Outfit candidate kinds, keeping their IDs distinct", () => {
  const p = ensembleChangeSet(),
    newActor = {
      operationId: "new-character",
      type: "asset.propose",
      clientRef: "new-character",
      kind: "character",
      title: "Fictional third actor",
      promptText: "A fictional adult third actor.",
      tags: [],
    };
  p.operations[0].ensemble.participantUpserts[1].wardrobe = {
    variant: { ref: "groom-outfit" },
  };
  p.operations[0].ensemble.participantUpserts.push({
    id: "third",
    character: { asset: { ref: "new-character" } },
    presence: "on_camera",
  });
  p.operations.unshift(newActor, outfitProposal("groom-outfit", "lucas"));
  const approval: any = recipeApproval();
  approval.assetDecisions["new-character"] = { action: "create" };
  approval.variantDecisions = { "groom-outfit": { action: "create" } };
  const result = plan(p, ensembleState(), approval);
  expect(blocked(result)).toEqual([]);
  const mapping = result.idMappings["groom-outfit"];
  expect(mapping).toMatchObject({
    kind: "variant_candidate",
    variantId: expect.any(String),
  });
  expect(mapping.assetId).toBeUndefined();
  expect(result.variants).toHaveLength(1);
  expect(result.variants![0]).toMatchObject({
    id: mapping.variantId,
    type: "Outfit",
    targetSlot: "wardrobe",
    parentCharacterId: "lucas",
    reviewStatus: "unreviewed",
  });
  expect(result.scenes[0].ensemble!.participants[1].wardrobe?.sourceId).toBe(
    mapping.variantId,
  );
  expect(result.scenes[0].ensemble!.participants[2].character.sourceId).toBe(
    result.idMappings["new-character"].assetId,
  );
});
it("keeps a deferred required Outfit blocking the dependent recipe and preserves the full package", () => {
  const p = ensembleChangeSet();
  p.operations[0].ensemble.participantUpserts[1].wardrobe = {
    variant: { ref: "outfit" },
  };
  p.operations.unshift(outfitProposal("outfit", "lucas"));
  const result = plan(p);
  expect(blocked(result).some((f) => /defer|depend/i.test(f.message))).toBe(
    true,
  );
  expect(result.scenes).toEqual([]);
  expect(result.variantCandidates).toHaveLength(1);
  expect(result.variantCandidates![0].status).toBe("pending");
  expect(result.variants ?? []).toEqual([]);
});
it.each([
  "wrong parent",
  "stale parent",
  "wrong variant type",
  "stale variant",
])("rejects %s for Outfit reuse", (which) => {
  const p = ensembleChangeSet();
  p.operations = [outfitProposal("outfit", "lucas")];
  const s = ensembleState(),
    approval: any = recipeApproval();
  approval.variantDecisions = {
    outfit: { action: "reuse", variantId: "lucas-suit", expectedRevision: 1 },
  };
  if (which === "wrong parent")
    approval.variantDecisions.outfit.variantId = "aya-outfit";
  if (which === "stale parent") p.operations[0].expectedParentRevision = 999;
  if (which === "wrong variant type")
    s.variants!.find((v) => v.id === "lucas-suit")!.type = "Expression";
  if (which === "stale variant")
    approval.variantDecisions.outfit.expectedRevision = 999;
  expect(blocked(plan(p, s, approval)).length).toBeGreaterThan(0);
});
it("binds reviewed content to all participant/cue fields and binds live parent/variant reads to the state proof", () => {
  const s = ensembleParentState(),
    p = revise(s, {
      version: 1,
      participantUpserts: [
        {
          id: "lucas",
          wardrobe: { variant: { id: "lucas-suit" }, expectedRevision: 1 },
        },
      ],
    }),
    approval = recipeApproval(),
    before = changeSetStateSignature(parseChangeSet(p), approval, s),
    projection = recipeContentProjection(s.scenes[0]) as any;
  expect(projection.ensemble).toEqual(s.scenes[0].ensemble);
  s.variants!.find((v) => v.id === "lucas-suit")!.promptText =
    "Changed variant body";
  expect(changeSetStateSignature(parseChangeSet(p), approval, s)).not.toBe(
    before,
  );
});
it("retains an explicitly selected earlier guide as its original association when that participant changes Character", () => {
  const s = ensembleParentState(),
    scene = s.scenes[0];
  scene.referencePack = {
    version: 1,
    entries: [
      {
        associationId: "captured-old-guide",
        participantId: "lucas",
        mediaId: "guide",
        sourceSlot: "character",
        sourceId: "lucas",
        sourceTitle: "Lucas original guide",
        role: "reference",
        altText: "Earlier independent selection",
        purpose: "identity",
        order: 0,
      },
    ],
  };
  s.media = [
    {
      id: "guide",
      filename: "guide.png",
      safeFilename: "guide.png",
      mimeType: "image/png",
      byteSize: 1,
      blob: new Blob(["x"], { type: "image/png" }),
      createdAt: "2026-11-01T00:00:00Z",
    },
  ];
  const p = revise(s, {
      version: 1,
      participantUpserts: [
        {
          id: "lucas",
          character: { asset: { id: "marco" }, expectedRevision: 1 },
          wardrobe: null,
        },
      ],
    }),
    result = plan(p, s);
  expect(blocked(result)).toEqual([]);
  expect(result.scenes[0].ensemble!.participants[1].character.sourceId).toBe(
    "marco",
  );
  expect(result.scenes[0].referencePack).toEqual(scene.referencePack);
  expect(result.scenes[0].references.some((r) => r.mediaId === "guide")).toBe(
    true,
  );
  expect(scene.referencePack.entries[0].sourceId).toBe("lucas");
});
it("reuses only a same-parent Outfit and leaves the original variant untouched", () => {
  const p = ensembleChangeSet();
  p.operations[0].ensemble.participantUpserts[1].wardrobe = {
    variant: { ref: "outfit" },
  };
  p.operations.unshift(outfitProposal("outfit", "lucas"));
  const approval: any = recipeApproval();
  approval.variantDecisions = {
    outfit: { action: "reuse", variantId: "lucas-suit", expectedRevision: 1 },
  };
  const state = ensembleState(),
    before = canonicalStringify(state.variants),
    result = plan(p, state, approval);
  expect(blocked(result)).toEqual([]);
  expect(result.idMappings.outfit.variantId).toBe("lucas-suit");
  expect(result.variants ?? []).toEqual([]);
  expect(result.variantCandidates![0].status).toBe("reused");
  expect(canonicalStringify(state.variants)).toBe(before);
});
it("requires a separately stored parent even if a same-batch Character has an already allocated ID", () => {
  const p = ensembleChangeSet();
  p.operations = [
    {
      operationId: "new",
      type: "asset.propose",
      clientRef: "new",
      kind: "character",
      title: "Separate synthetic parent",
      promptText: "Another fictional adult.",
      tags: [],
    },
  ];
  const allocated = allocationFor(p).ids.new;
  p.operations.push(outfitProposal("outfit", `asset_${allocated}`));
  const approval: any = recipeApproval();
  approval.assetDecisions.new = { action: "create" };
  approval.variantDecisions = { outfit: { action: "create" } };
  expect(
    blocked(plan(p, ensembleState(), approval)).some((f) =>
      /existing.*parent|parent.*existing|separate.*batch/i.test(f.message),
    ),
  ).toBe(true);
});
it("accounts for approved variant writes in the unchanged full-backup metadata budget", () => {
  const p = ensembleChangeSet();
  p.operations = [outfitProposal("outfit", "lucas")];
  const approval: any = recipeApproval();
  approval.variantDecisions = { outfit: { action: "create" } };
  const state = ensembleState(),
    result = plan(p, state, approval),
    ledger = { version: 1 as const, receipts: [], candidates: [] },
    date = "2026-11-01T00:00:00.000Z";
  expect(result.variants).toHaveLength(1);
  expect(
    validateChangeSetBackupCapacity(state, result, ledger, date),
  ).toBeGreaterThan(
    validateChangeSetBackupCapacity(
      state,
      { ...result, variants: [] },
      ledger,
      date,
    ),
  );
});
it("restores a previous ensemble version as a new immutable revision through v3 without changing old scenes", () => {
  const state = ensembleParentState(),
    old = structuredClone(state.scenes[0]),
    first = plan(
      revise(state, {
        version: 1,
        dialogueCues: [
          {
            id: "changed",
            speaker: "Lucas",
            participantId: "lucas",
            mode: "on_camera",
            line: "Changed exact line.",
          },
        ],
      }),
      state,
    );
  expect(blocked(first)).toEqual([]);
  state.scenes.push(first.scenes[0]);
  state.collections = first.collections;
  const before = canonicalStringify(state.scenes),
    p = revise(state);
  p.operations = [
    {
      operationId: "restore",
      clientRef: "restored",
      type: "scene.restore",
      sceneId: first.scenes[0].id,
      expectedHeadId: first.scenes[0].id,
      restoreFromSceneId: old.id,
      project: {
        id: "project",
        expectedRevision: state.collections[0].project!.revision,
      },
      shot: { id: "shot" },
      reason: "Restore exact ensemble.",
    },
  ];
  const restored = plan(p, state);
  expect(blocked(restored)).toEqual([]);
  expect(restored.scenes[0].ensemble).toEqual(old.ensemble);
  expect(restored.scenes[0].sceneRevision).toMatchObject({
    restoredFromSceneId: old.id,
    sequence: 3,
  });
  expect(canonicalStringify(state.scenes)).toBe(before);
});
it("uses a genuinely approved secondary anchor only for generation and reports a stale secondary fallback", () => {
  const state = ensembleState(),
    lucas = state.assets.find((a) => a.id === "lucas")!,
    at = "2026-11-01T00:00:00.000Z";
  lucas.identityAnchor = {
    text: "Approved synthetic Lucas anchor.",
    approvedText: "Approved synthetic Lucas anchor.",
    approvedAt: at,
    approvedMasterIdentityRevision: 1,
  };
  const p = ensembleChangeSet();
  p.operations[0].ensemble.participantUpserts[1].identitySource =
    "approved_anchor";
  const result = plan(p, state);
  expect(blocked(result)).toEqual([]);
  const scene = result.scenes[0];
  expect(scene.ensemble!.participants[1].generation).toMatchObject({
    identitySource: "approved_anchor",
    anchor: { text: lucas.identityAnchor.text },
  });
  expect(scene.outputs.full).toContain(lucas.promptText);
  expect(scene.outputs.full).not.toContain(lucas.identityAnchor.text);
  expect(
    buildGenerationDocument(scene, {
      participantIdentities: resolveEnsembleGenerationIdentities(
        scene,
        undefined,
        true,
      ),
    }).participants![1].identity?.description,
  ).toBe(lucas.identityAnchor.text);
  state.scenes = result.scenes;
  state.collections = result.collections;
  lucas.identityRevision = 2;
  const next = plan(revise(state), state);
  expect(blocked(next)).toEqual([]);
  expect(next.scenes[0].ensemble!.participants[1].character).toEqual(
    scene.ensemble!.participants[1].character,
  );
  expect(
    next.scenes[0].ensemble!.participants[1].generation?.identitySource,
  ).toBe("master");
  expect(
    next.findings.some(
      (f) =>
        f.severity === "advisory" &&
        /Lucas.*stale|Lucas.*unavailable/i.test(f.message),
    ),
  ).toBe(true);
});
