import { it, expect } from "vitest";
import { planChangeSet } from "../domain/changeSetPlanner";
import { parseChangeSet } from "../domain/changeSetValidation";
import {
  midoriChangeSet,
  allContentApproval,
  allocationFor,
  emptyState,
  exactImportPrompt,
} from "./fixtures/changeSetFixture";
const blocked = (p: ReturnType<typeof planChangeSet>) =>
  p.findings.filter((f) => f.severity === "blocking");
it("plans fifteen ordered shots,60seconds,types2/9/4 and four pending originals without writes or dummy assets", () => {
  const input = parseChangeSet(midoriChangeSet()),
    state = emptyState(),
    before = structuredClone(state);
  const p = planChangeSet(
    input,
    allContentApproval(),
    state,
    allocationFor(input),
  );
  expect(blocked(p)).toEqual([]);
  expect(state).toEqual(before);
  expect(p.collections).toHaveLength(1);
  expect(p.scenes).toHaveLength(15);
  expect(p.assets).toHaveLength(0);
  expect(p.templates).toHaveLength(0);
  expect(p.candidates).toHaveLength(2);
  const shots = p.collections[0].project!.shots;
  expect(shots.map((s) => s.order)).toEqual(
    Array.from({ length: 15 }, (_, i) => i),
  );
  expect(shots.map((s) => s.code)).toEqual(
    Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(2, "0")),
  );
  expect(shots.reduce((n, s) => n + s.plannedDurationSeconds!, 0)).toBe(60);
  expect(
    shots.filter((s) => s.plannedShotType === "character_scene"),
  ).toHaveLength(2);
  expect(
    shots.filter((s) => s.plannedShotType === "property_environment"),
  ).toHaveLength(9);
  expect(
    shots.filter((s) => s.plannedShotType === "graphic_motion"),
  ).toHaveLength(4);
  expect(
    shots.every(
      (s) => s.status === "planned" && s.selectedSceneId === undefined,
    ),
  ).toBe(true);
  expect(p.scenes.reduce((n, s) => n + (s.pendingInputs?.length ?? 0), 0)).toBe(
    4,
  );
  expect(p.scenes[0].outputs.full.startsWith(exactImportPrompt)).toBe(true);
  expect(p.scenes[0].slots.camera?.sourceId).toBe("asset_synthetic_camera");
  expect(p.scenes.every((s) => s.reviewStatus === "unreviewed")).toBe(true);
});
it("requires distinct storyboard and scene approval groups", () => {
  const input = midoriChangeSet(),
    state = emptyState(),
    approval = allContentApproval();
  approval.scenes = false;
  approval.storyboard = false;
  const p = planChangeSet(input, approval, state, allocationFor(input));
  expect(blocked(p).some((f) => f.code === "APPROVAL_STORYBOARD")).toBe(true);
  expect(blocked(p).some((f) => f.code === "APPROVAL_SCENES")).toBe(true);
});
it("does not create a library asset from a deferred candidate", () => {
  const input = midoriChangeSet();
  const p = planChangeSet(
    input,
    allContentApproval(),
    emptyState(),
    allocationFor(input),
  );
  expect(p.candidates.every((c) => c.status === "pending" && !c.assetId)).toBe(
    true,
  );
  expect(p.assets).toEqual([]);
});
it("requires duplicate acknowledgement before explicitly creating an equivalent camera", () => {
  const input = midoriChangeSet();
  const candidate = input.operations.find(
    (o) => o.type === "asset.propose",
  )! as any;
  candidate.title = "Synthetic Studio Camera";
  candidate.promptText = emptyState().assets[0].promptText;
  const approval = allContentApproval();
  approval.assetDecisions[candidate.operationId] = { action: "create" };
  const p = planChangeSet(input, approval, emptyState(), allocationFor(input));
  expect(blocked(p).some((f) => f.code === "DUPLICATE_ASSET")).toBe(true);
  approval.assetDecisions[candidate.operationId].acknowledgeDuplicate = true;
  expect(
    blocked(planChangeSet(input, approval, emptyState(), allocationFor(input))),
  ).toEqual([]);
});
it("blocks missing asserted media but allows honest pending filename descriptions", () => {
  const input = midoriChangeSet();
  (input.operations[2] as any).references = [
    { mediaId: "media_missing", role: "reference" },
  ];
  const p = planChangeSet(
    input,
    allContentApproval(),
    emptyState(),
    allocationFor(input),
  );
  expect(blocked(p).some((f) => /media|attachment/i.test(f.message))).toBe(
    true,
  );
});
