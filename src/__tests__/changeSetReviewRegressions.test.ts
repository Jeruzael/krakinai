import { beforeEach, it, expect } from "vitest";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  openDatabase,
  getAllSnapshot,
  savePromptAsset,
} from "../storage/db";
import { planAuthoredScene } from "../storage/sceneAuthoring";
import {
  previewChangeSet,
  applyApprovedChangeSet,
} from "../storage/changeSets";
import { planChangeSet } from "../domain/changeSetPlanner";
import { createSnapshotFromAsset } from "../domain/promptAssembler";
import { parseChangeSet } from "../domain/changeSetValidation";
import {
  emptyState,
  syntheticCamera,
  allContentApproval,
  allocationFor,
} from "./fixtures/changeSetFixture";
import type { ChangeSet } from "../types/changeSet";
import type { PromptAsset, SceneDraft, BuilderSlot } from "../types/domain";
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
});
function recipeFixture() {
  const state = emptyState(),
    now = "2026-10-30T00:00:00.000Z",
    character: PromptAsset = {
      ...syntheticCamera(),
      id: "character",
      title: "Synthetic character",
      category: "characters",
      promptText: "Full master identity",
      identityRevision: 1,
      identityAnchor: {
        text: "Short approved identity",
        approvedText: "Short approved identity",
        approvedMasterIdentityRevision: 1,
        approvedAt: now,
      },
    },
    environment: PromptAsset = {
      ...syntheticCamera(),
      id: "environment",
      category: "environments",
      promptText: "A blank synthetic studio.",
    },
    action: PromptAsset = {
      ...syntheticCamera(),
      id: "action",
      category: "actions",
      promptText: "Stand still.",
    };
  state.assets.push(character, environment, action);
  const draft: SceneDraft = {
    id: "draft",
    title: "Recipe",
    slots: Object.fromEntries(
      [character, environment, action].map((a) => {
        const s = createSnapshotFromAsset(a);
        return [s.slot, s];
      }),
    ),
    extraRequiredSlots: [],
    sceneInstructions: "Synthetic fixture",
    settings: {},
    manualOutputs: {},
    resultMediaLinks: [],
    reviewNotes: "",
    reviewStatus: "unreviewed",
    inputRevision: 1,
    updatedAt: now,
    generation: {
      identitySource: "approved_anchor",
      anchor: {
        text: "Short approved identity",
        approvedMasterIdentityRevision: 1,
        approvedAt: now,
      },
    },
  };
  state.drafts = [draft];
  state.scenes = [
    planAuthoredScene(
      draft,
      { requestId: "synthetic", expectedInputRevision: 1 },
      state,
      { id: "recipe", now },
    ).scene,
  ];
  const input: ChangeSet = {
    schema: "krakinai.change-set.v1",
    changeSetId: "restore-bound-master",
    source: { kind: "manual" },
    operations: [
      {
        operationId: "restore",
        type: "scene.restore",
        clientRef: "restored",
        sceneId: "recipe",
        expectedHeadId: "recipe",
        restoreFromSceneId: "recipe",
      },
    ],
  };
  return { state, character, input };
}
it("binds the live recipe-restore master and exposes the exact generation decision in preview", () => {
  const { state, character, input } = recipeFixture(),
    before = planChangeSet(
      input,
      allContentApproval(),
      state,
      allocationFor(input),
    );
  character.identityRevision = 2;
  character.revision = 2;
  const after = planChangeSet(
    input,
    allContentApproval(),
    state,
    allocationFor(input),
  );
  expect(before.scenes[0].generation!.identitySource).toBe("approved_anchor");
  expect(after.scenes[0].generation!.identitySource).toBe("master");
  expect(after.stateSignature).not.toBe(before.stateSignature);
  expect(before.operations[0].resolved).toMatchObject({
    generation: { identitySource: "approved_anchor" },
  });
});
for (const mutation of ["update", "delete"] as const)
  it(`rejects a recipe restore when its live character changes by ${mutation} after preview`, async () => {
    const { state, character, input } = recipeFixture(),
      db = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(["assets", "scenes", "drafts"], "readwrite");
      for (const a of state.assets) tx.objectStore("assets").put(a);
      for (const s of state.scenes) tx.objectStore("scenes").put(s);
      for (const d of state.drafts!) tx.objectStore("drafts").put(d);
      tx.oncomplete = () => resolve();
    });
    const preview = await previewChangeSet(input, allContentApproval());
    if (mutation === "update")
      await savePromptAsset({
        ...character,
        promptText: "A deliberately revised synthetic master identity.",
      });
    else
      await new Promise<void>((resolve) => {
        const tx = db.transaction("assets", "readwrite");
        tx.objectStore("assets").delete(character.id);
        tx.oncomplete = () => resolve();
      });
    const current = await getAllSnapshot();
    await expect(
      applyApprovedChangeSet(preview, preview.approvedDigest),
    ).rejects.toThrow(/changed|identity|character/i);
    expect(await getAllSnapshot()).toEqual(current);
  });
function convergingGraph(tails: number): ChangeSet {
  const operations: ChangeSet["operations"] = [
      {
        operationId: "s0",
        type: "scene.create_direct_prompt",
        clientRef: "s0",
        title: "Initial",
        prompt: { version: 1, text: "Initial synthetic text." },
      },
    ],
    slots: BuilderSlot[] = [
      "character",
      "wardrobe",
      "environment",
      "action",
      "camera",
      "lighting",
      "style",
    ],
    kinds = [
      "character",
      "wardrobe",
      "environment",
      "action",
      "camera",
      "lighting",
      "style",
    ] as const;
  let previous = "s0",
    refs: { asset: { ref: string }; slot: BuilderSlot }[] = [];
  for (let round = 1; round <= 7; round++) {
    refs = slots.map((slot, i) => ({ asset: { ref: `c${round}_${i}` }, slot }));
    for (let i = 0; i < 7; i++)
      operations.push({
        operationId: `c${round}_${i}`,
        type: "asset.propose",
        clientRef: `c${round}_${i}`,
        kind: kinds[i],
        title: "Synthetic candidate",
        promptText: "Only a bounded parser fixture.",
        tags: [],
        sourceScene: { ref: previous },
      });
    previous = "s" + round;
    operations.push({
      operationId: previous,
      type: "scene.create_direct_prompt",
      clientRef: previous,
      title: "Converging graph",
      prompt: { version: 1, text: "Unique round " + round },
      assetRefs: refs,
    });
  }
  for (let i = 0; i < tails; i++)
    operations.push({
      operationId: "tail" + i,
      type: "scene.create_direct_prompt",
      clientRef: "tail" + i,
      title: "Tail " + i,
      prompt: { version: 1, text: "Tail text " + i },
      assetRefs: refs,
    });
  return {
    schema: "krakinai.change-set.v1",
    changeSetId: "converging-graph",
    source: { kind: "manual" },
    operations,
  };
}
it("does not repeatedly traverse completed paths in a small converging dependency graph", () => {
  const input = convergingGraph(0),
    start = performance.now();
  expect(parseChangeSet(input).operations).toHaveLength(57);
  expect(performance.now() - start).toBeLessThan(200);
});
it("validates the full 149-operation converging graph within a bounded time", () => {
  const input = convergingGraph(92),
    start = performance.now();
  expect(parseChangeSet(input).operations).toHaveLength(149);
  expect(performance.now() - start).toBeLessThan(2000);
});
