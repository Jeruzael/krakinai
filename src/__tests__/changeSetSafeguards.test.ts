import { beforeEach, it, expect } from "vitest";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  saveSceneDraft,
  createCollection,
  getAllSnapshot,
  openDatabase,
  saveMediaAsset,
} from "../storage/db";
import { addProjectShot } from "../storage/projects";
import {
  createDirectPromptDraft,
  createSceneRevisionDraft,
  saveAuthoredScene,
} from "../storage/sceneAuthoring";
import {
  previewChangeSet,
  applyApprovedChangeSet,
} from "../storage/changeSets";
import { planChangeSet } from "../domain/changeSetPlanner";
import { parseChangeSet } from "../domain/changeSetValidation";
import {
  midoriChangeSet,
  allContentApproval,
  allocationFor,
  emptyState,
  syntheticCamera,
  exactImportPrompt,
} from "./fixtures/changeSetFixture";
import type { ChangeSet } from "../types/changeSet";
import type { Collection } from "../types/domain";
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
});
const commit = async (input: ChangeSet) => {
  const p = await previewChangeSet(input, allContentApproval());
  expect(p.plan.findings.filter((f) => f.severity === "blocking")).toEqual([]);
  const receipt = await applyApprovedChangeSet(p, p.approvedDigest);
  return { p, receipt };
};
it("requires storyboard approval when a scene operation attaches a new take to an existing shot", async () => {
  const { scene, c, shot } = await original(),
    input: ChangeSet = {
      schema: "krakinai.change-set.v1",
      changeSetId: "scene-attachment-approval",
      source: { kind: "manual" },
      operations: [
        {
          operationId: "v",
          type: "scene.revise",
          clientRef: "v",
          sceneId: scene.id,
          expectedHeadId: scene.id,
          project: { id: c.id, expectedRevision: c.project!.revision },
          shot: { id: shot.id },
          prompt: { version: 1, text: "Explicit revised text." },
        },
      ],
    };
  const before = await getAllSnapshot(),
    p = await previewChangeSet(input, {
      ...allContentApproval(),
      storyboard: false,
    });
  expect(p.plan.findings.some((f) => f.code === "APPROVAL_STORYBOARD")).toBe(
    true,
  );
  await expect(applyApprovedChangeSet(p, p.approvedDigest)).rejects.toThrow(
    /storyboard.*approval|approval.*storyboard/i,
  );
  expect(await getAllSnapshot()).toEqual(before);
});
async function original() {
  let d = await createDirectPromptDraft();
  d = await saveSceneDraft({
    ...d,
    title: "Original synthetic",
    directPrompt: { version: 1, text: exactImportPrompt },
  });
  const scene = await saveAuthoredScene(d.id, {
    requestId: "original",
    expectedInputRevision: d.inputRevision,
  });
  let c = await createCollection({ name: "MIDORI" });
  c = await addProjectShot({
    collectionId: c.id,
    title: "Opening",
    sceneId: scene.id,
  });
  return { scene, c, shot: c.project!.shots[0] };
}
it("imports immutable v2,restores old text as v3,and creates a distinct take without changing preference or old records", async () => {
  const { scene, c, shot } = await original(),
    before = await getAllSnapshot();
  const v2: ChangeSet = {
    schema: "krakinai.change-set.v1",
    changeSetId: "version-two",
    source: { kind: "chatgpt" },
    operations: [
      {
        operationId: "v2",
        type: "scene.revise",
        clientRef: "v2",
        sceneId: scene.id,
        expectedHeadId: scene.id,
        project: { id: c.id, expectedRevision: c.project!.revision },
        shot: { id: shot.id },
        prompt: {
          version: 1,
          text: exactImportPrompt + "\r\nNew explicit line.",
        },
      },
    ],
  };
  const second = (await commit(v2)).receipt.idMappings.v2.id;
  let state = await getAllSnapshot();
  expect(
    state.scenes.find((s) => s.id === second)!.sceneRevision,
  ).toMatchObject({
    sequence: 2,
    parentSceneId: scene.id,
    rootSceneId: scene.id,
  });
  expect(state.scenes.find((s) => s.id === scene.id)).toEqual(
    before.scenes.find((s) => s.id === scene.id),
  );
  expect(state.collections[0].project!.shots[0].selectedSceneId).toBe(scene.id);
  const restore: ChangeSet = {
    schema: "krakinai.change-set.v1",
    changeSetId: "restore-three",
    source: { kind: "manual" },
    operations: [
      {
        operationId: "v3",
        type: "scene.restore",
        clientRef: "v3",
        sceneId: second,
        expectedHeadId: second,
        restoreFromSceneId: scene.id,
        project: {
          id: c.id,
          expectedRevision: state.collections[0].project!.revision,
        },
        shot: { id: shot.id },
      },
    ],
  };
  const third = (await commit(restore)).receipt.idMappings.v3.id;
  state = await getAllSnapshot();
  expect(state.scenes.find((s) => s.id === third)).toMatchObject({
    outputs: { full: exactImportPrompt },
    sceneRevision: {
      sequence: 3,
      parentSceneId: second,
      restoredFromSceneId: scene.id,
    },
  });
  const take: ChangeSet = {
    schema: "krakinai.change-set.v1",
    changeSetId: "alternate",
    source: { kind: "codex" },
    operations: [
      {
        operationId: "take",
        type: "scene.create_take",
        clientRef: "take",
        sceneId: third,
        expectedHeadId: third,
        project: {
          id: c.id,
          expectedRevision: state.collections[0].project!.revision,
        },
        shot: { id: shot.id },
        prompt: { version: 1, text: "A separate complete take." },
      },
    ],
  };
  const id = (await commit(take)).receipt.idMappings.take.id;
  state = await getAllSnapshot();
  expect(state.scenes.find((s) => s.id === id)).toMatchObject({
    separateTakeOfSceneId: third,
    sceneRevision: { sequence: 1, rootSceneId: id },
  });
  expect(state.collections[0].project!.shots[0].selectedSceneId).toBe(scene.id);
});
it("rejects mismatched project/shot/source scene IDs as a complete batch", async () => {
  const { scene, c } = await original();
  let drama = await createCollection({ name: "Drama" });
  drama = await addProjectShot({ collectionId: drama.id, title: "Unrelated" });
  const before = await getAllSnapshot();
  const input: ChangeSet = {
    schema: "krakinai.change-set.v1",
    changeSetId: "bad-target",
    source: { kind: "codex" },
    operations: [
      {
        operationId: "v",
        type: "scene.revise",
        clientRef: "v",
        sceneId: scene.id,
        expectedHeadId: scene.id,
        project: { id: drama.id, expectedRevision: drama.project!.revision },
        shot: { id: drama.project!.shots[0].id },
        prompt: { version: 1, text: "Must never be saved." },
      },
    ],
  };
  const p = await previewChangeSet(input, allContentApproval());
  expect(p.plan.findings.some((f) => /does not belong/i.test(f.message))).toBe(
    true,
  );
  await expect(applyApprovedChangeSet(p, p.approvedDigest)).rejects.toThrow(
    /does not belong/i,
  );
  expect(await getAllSnapshot()).toEqual(before);
});
it("rejects a scene head changed after preview and preserves the foreign version", async () => {
  const { scene, c, shot } = await original(),
    input: ChangeSet = {
      schema: "krakinai.change-set.v1",
      changeSetId: "stale-head",
      source: { kind: "codex" },
      operations: [
        {
          operationId: "v",
          type: "scene.revise",
          clientRef: "v",
          sceneId: scene.id,
          expectedHeadId: scene.id,
          project: { id: c.id, expectedRevision: c.project!.revision },
          shot: { id: shot.id },
          prompt: { version: 1, text: "Stale proposal." },
        },
      ],
    };
  const p = await previewChangeSet(input, allContentApproval());
  let d = await createSceneRevisionDraft(scene.id);
  d = await saveSceneDraft({
    ...d,
    directPrompt: { version: 1, text: "Foreign new version." },
  });
  await saveAuthoredScene(d.id, {
    requestId: "foreign",
    expectedInputRevision: d.inputRevision,
  });
  const before = await getAllSnapshot();
  await expect(applyApprovedChangeSet(p, p.approvedDigest)).rejects.toThrow(
    /head|revision/i,
  );
  expect(await getAllSnapshot()).toEqual(before);
});
it("requires separate preference/status approvals and changes only the chosen shot", async () => {
  const { scene, c, shot } = await original(),
    input: ChangeSet = {
      schema: "krakinai.change-set.v1",
      changeSetId: "choose-version",
      source: { kind: "manual" },
      operations: [
        {
          operationId: "v",
          type: "scene.revise",
          clientRef: "v",
          sceneId: scene.id,
          expectedHeadId: scene.id,
          project: { id: c.id, expectedRevision: c.project!.revision },
          shot: { id: shot.id },
          prompt: { version: 1, text: "Explicit next version." },
        },
        {
          operationId: "prefer",
          type: "shot.select_take",
          project: { id: c.id, expectedRevision: c.project!.revision },
          shot: { id: shot.id },
          scene: { ref: "v" },
          expectedSelectedSceneId: scene.id,
        },
        {
          operationId: "status",
          type: "shot.set_status",
          project: { id: c.id, expectedRevision: c.project!.revision },
          shot: { id: shot.id },
          status: "generated",
          expectedStatus: shot.status,
        },
      ],
    };
  const before = await getAllSnapshot(),
    pending = await previewChangeSet(input, allContentApproval());
  await expect(
    applyApprovedChangeSet(pending, pending.approvedDigest),
  ).rejects.toThrow(/approval/i);
  expect(await getAllSnapshot()).toEqual(before);
  const approval = { ...allContentApproval(), preferred: true, statuses: true },
    p = await previewChangeSet(input, approval),
    receipt = await applyApprovedChangeSet(p, p.approvedDigest),
    after = await getAllSnapshot();
  expect(after.collections[0].project!.shots[0]).toMatchObject({
    selectedSceneId: receipt.idMappings.v.id,
    status: "generated",
  });
  expect(after.collections[0].project!.revision).toBe(c.project!.revision + 1);
});
it("current media deletion after preview blocks every proposed write", async () => {
  const media = await saveMediaAsset({
    filename: "synthetic.png",
    mimeType: "image/png",
    blob: new Blob(["opaque fixture"], { type: "image/png" }),
  });
  const input: ChangeSet = {
    schema: "krakinai.change-set.v1",
    changeSetId: "missing-media",
    source: { kind: "codex" },
    operations: [
      {
        operationId: "p",
        type: "project.create",
        clientRef: "p",
        name: "Never saved",
      },
      {
        operationId: "s",
        type: "scene.create_direct_prompt",
        clientRef: "s",
        title: "Reference",
        prompt: { version: 1, text: "Exact text." },
        references: [{ mediaId: media.id }],
      },
    ],
  };
  const p = await previewChangeSet(input, allContentApproval()),
    db = await openDatabase();
  await new Promise<void>((resolve) => {
    const tx = db.transaction("media", "readwrite");
    tx.objectStore("media").delete(media.id);
    tx.oncomplete = () => resolve();
  });
  const before = await getAllSnapshot();
  await expect(applyApprovedChangeSet(p, p.approvedDigest)).rejects.toThrow(
    /media|attachment/i,
  );
  expect(await getAllSnapshot()).toEqual(before);
});
it("detects a newly appearing candidate match after preview but permits unrelated project edits", async () => {
  const input: ChangeSet = {
    schema: "krakinai.change-set.v1",
    changeSetId: "proposal",
    source: { kind: "codex" },
    operations: [
      {
        operationId: "a",
        type: "asset.propose",
        clientRef: "a",
        kind: "camera",
        title: "Synthetic Studio Camera",
        promptText: "A matching title requires review.",
        tags: [],
      },
    ],
  };
  const p = await previewChangeSet(input, allContentApproval()),
    db = await openDatabase();
  await new Promise<void>((resolve) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").add(syntheticCamera());
    tx.oncomplete = () => resolve();
  });
  const before = await getAllSnapshot();
  await expect(applyApprovedChangeSet(p, p.approvedDigest)).rejects.toThrow(
    /changed/i,
  );
  expect(await getAllSnapshot()).toEqual(before);
  const fresh = await previewChangeSet(
    { ...input, changeSetId: "proposal-fresh" },
    allContentApproval(),
  );
  await createCollection({ name: "Unrelated project" });
  await expect(
    applyApprovedChangeSet(fresh, fresh.approvedDigest),
  ).resolves.toMatchObject({ changeSetId: "proposal-fresh" });
});
it("preserves stored order semantics when a valid project array is not already sorted", () => {
  const state = emptyState();
  state.collections = [
    {
      id: "collection_order",
      name: "Ordered",
      description: "",
      members: [],
      createdAt: "2026-10-30",
      updatedAt: "2026-10-30",
      project: {
        version: 1,
        revision: 1,
        shots: [
          {
            id: "shot_second",
            order: 1,
            code: "02",
            title: "Second",
            takeSceneIds: [],
            status: "planned",
          },
          {
            id: "shot_first",
            order: 0,
            code: "01",
            title: "First",
            takeSceneIds: [],
            status: "planned",
          },
        ],
      },
    },
  ];
  const input: ChangeSet = {
    schema: "krakinai.change-set.v1",
    changeSetId: "order",
    source: { kind: "codex" },
    operations: [
      {
        operationId: "s",
        type: "shot.create",
        clientRef: "s",
        project: { id: "collection_order", expectedRevision: 1 },
        code: "03",
        title: "Third",
      },
    ],
  };
  const p = planChangeSet(
    input,
    allContentApproval(),
    state,
    allocationFor(input),
  );
  expect(p.collections[0].project!.shots.map((s) => s.id)).toEqual([
    "shot_first",
    "shot_second",
    allocationFor(input).ids.s,
  ]);
});
it("surfaces a duplicate project name while keeping creation explicit", () => {
  const state = emptyState();
  state.collections = [
    {
      id: "collection_existing",
      name: "MIDORI",
      description: "",
      members: [],
      createdAt: "2026-10-30",
      updatedAt: "2026-10-30",
    },
  ];
  const input: ChangeSet = {
    schema: "krakinai.change-set.v1",
    changeSetId: "name",
    source: { kind: "codex" },
    operations: [
      {
        operationId: "p",
        type: "project.create",
        clientRef: "p",
        name: "Midori",
      },
    ],
  };
  expect(
    planChangeSet(
      input,
      allContentApproval(),
      state,
      allocationFor(input),
    ).findings.some((f) => f.code === "PROJECT_NAME"),
  ).toBe(true);
});
it("limits the total distinct targeted projects,not only project creation operations", () => {
  const input: ChangeSet = {
    schema: "krakinai.change-set.v1",
    changeSetId: "too-many-projects",
    source: { kind: "codex" },
    operations: Array.from({ length: 11 }, (_, i) => ({
      operationId: "p" + i,
      type: "project.update" as const,
      project: { id: "collection_" + i, expectedRevision: 1 },
      description: "Changed",
    })),
  };
  expect(() => parseChangeSet(input)).toThrow(/project|limit/i);
});
