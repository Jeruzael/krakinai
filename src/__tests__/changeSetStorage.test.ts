import { beforeEach, it, expect, vi } from "vitest";
import {
  initializeDatabase,
  clearAllStoresForTesting,
  getAllSnapshot,
  openDatabase,
  createCollection,
  saveSceneDraft,
} from "../storage/db";
import {
  previewChangeSet,
  applyApprovedChangeSet,
} from "../storage/changeSets";
import { addProjectShot } from "../storage/projects";
import {
  createDirectPromptDraft,
  saveAuthoredScene,
} from "../storage/sceneAuthoring";
import {
  midoriChangeSet,
  allContentApproval,
  syntheticCamera,
  exactImportPrompt,
} from "./fixtures/changeSetFixture";
import type { ChangeSet } from "../types/changeSet";
beforeEach(async () => {
  vi.restoreAllMocks();
  await clearAllStoresForTesting();
  await initializeDatabase();
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").put(syntheticCamera());
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
});
const blockers = (p: Awaited<ReturnType<typeof previewChangeSet>>) =>
  p.plan.findings.filter((f) => f.severity === "blocking");
it("blocks a valid bounded package whose resulting records would exceed the existing full-backup metadata allowance", async () => {
  const input: ChangeSet = {
    schema: "krakinai.change-set.v1",
    changeSetId: "metadata-budget",
    source: { kind: "manual" },
    operations: Array.from({ length: 40 }, (_, i) => ({
      operationId: "s" + i,
      type: "scene.create_direct_prompt" as const,
      clientRef: "s" + i,
      title: "Synthetic large scene " + i,
      prompt: { version: 1 as const, text: "界".repeat(99950) + i },
    })),
  };
  expect(new TextEncoder().encode(JSON.stringify(input)).length).toBeLessThan(
    20 * 1024 * 1024,
  );
  const before = await getAllSnapshot(),
    p = await previewChangeSet(input, allContentApproval());
  const initialPreview = await previewChangeSet(input);
  expect(
    initialPreview.plan.findings.some(
      (f) => f.code === "BACKUP_METADATA_CAPACITY",
    ),
  ).toBe(true);
  expect(blockers(p).some((f) => f.code === "BACKUP_METADATA_CAPACITY")).toBe(
    true,
  );
  await expect(applyApprovedChangeSet(p, p.approvedDigest)).rejects.toThrow(
    /backup.*metadata|metadata.*backup/i,
  );
  expect(await getAllSnapshot()).toEqual(before);
}, 20000);
it("preview and cancel perform no writes; approval commits exactly the proposed project/scenes and durable receipt", async () => {
  const input = midoriChangeSet(),
    before = await getAllSnapshot();
  const pending = await previewChangeSet(input);
  expect(blockers(pending).length).toBeGreaterThan(0);
  expect(await getAllSnapshot()).toEqual(before);
  await expect(
    applyApprovedChangeSet(pending, pending.approvedDigest),
  ).rejects.toThrow(/approval/i);
  expect(await getAllSnapshot()).toEqual(before);
  const p = await previewChangeSet(input, allContentApproval());
  expect(blockers(p)).toEqual([]);
  expect(await getAllSnapshot()).toEqual(before);
  const receipt = await applyApprovedChangeSet(p, p.approvedDigest),
    after = await getAllSnapshot();
  expect(after.collections).toHaveLength(1);
  expect(after.scenes).toHaveLength(15);
  expect(after.assets).toEqual(before.assets);
  expect(after.media).toEqual(before.media);
  expect(after.drafts).toEqual(before.drafts);
  expect(after.preferences.activeDraftId).toBe(
    before.preferences.activeDraftId,
  );
  expect(receipt.operations).toHaveLength(input.operations.length);
  expect(after.preferences.aiImports?.receipts).toEqual([receipt]);
  expect(after.preferences.aiImports?.candidates).toHaveLength(2);
});
it("replay returns the prior receipt before stale checks and survives a fresh preview", async () => {
  const input = midoriChangeSet(),
    p = await previewChangeSet(input, allContentApproval()),
    first = await applyApprovedChangeSet(p, p.approvedDigest),
    after = await getAllSnapshot();
  expect(await applyApprovedChangeSet(p, p.approvedDigest)).toEqual(first);
  expect(await getAllSnapshot()).toEqual(after);
  const replay = await previewChangeSet(JSON.stringify(input));
  expect(replay.replay).toEqual(first);
  expect(await applyApprovedChangeSet(replay, replay.approvedDigest)).toEqual(
    first,
  );
  expect(await getAllSnapshot()).toEqual(after);
});
it("rejects reused IDs with altered content or approvals and rejects approval digest tampering", async () => {
  const input = midoriChangeSet(),
    p = await previewChangeSet(input, allContentApproval());
  await expect(applyApprovedChangeSet(p, "0".repeat(64))).rejects.toThrow(
    /digest/i,
  );
  const tampered = structuredClone(p);
  (tampered.changeSet.operations[2] as any).prompt.text = "tampered";
  await expect(
    applyApprovedChangeSet(tampered, p.approvedDigest),
  ).rejects.toThrow(/digest/i);
  await applyApprovedChangeSet(p, p.approvedDigest);
  const after = await getAllSnapshot();
  input.title = "Different";
  await expect(previewChangeSet(input)).rejects.toThrow(
    /already|different|reuse/i,
  );
  const approvals = allContentApproval();
  approvals.preferred = true;
  await expect(previewChangeSet(midoriChangeSet(), approvals)).rejects.toThrow(
    /approval|different/i,
  );
  expect(await getAllSnapshot()).toEqual(after);
});
it("rolls back all enqueued records and receipt on a late quota failure", async () => {
  const p = await previewChangeSet(midoriChangeSet(), allContentApproval()),
    before = await getAllSnapshot(),
    native = IDBObjectStore.prototype.add;
  let scenes = 0;
  const spy = vi
    .spyOn(IDBObjectStore.prototype, "add")
    .mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (this.name === "scenes" && ++scenes === 7)
        throw new DOMException("Synthetic quota failure", "QuotaExceededError");
      return native.apply(this, args);
    });
  await expect(applyApprovedChangeSet(p, p.approvedDigest)).rejects.toThrow(
    /quota/i,
  );
  spy.mockRestore();
  expect(await getAllSnapshot()).toEqual(before);
});
it("rolls back an explicit forced abort without changing preferences or previous records", async () => {
  const p = await previewChangeSet(midoriChangeSet(), allContentApproval()),
    before = await getAllSnapshot(),
    native = IDBObjectStore.prototype.add;
  const spy = vi
    .spyOn(IDBObjectStore.prototype, "add")
    .mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      const r = native.apply(this, args);
      if (this.name === "scenes") this.transaction.abort();
      return r;
    });
  await expect(applyApprovedChangeSet(p, p.approvedDigest)).rejects.toThrow();
  spy.mockRestore();
  expect(await getAllSnapshot()).toEqual(before);
});
it("two concurrent identical applies serialize to one receipt and one storyboard", async () => {
  const p = await previewChangeSet(midoriChangeSet(), allContentApproval());
  const [a, b] = await Promise.all([
    applyApprovedChangeSet(p, p.approvedDigest),
    applyApprovedChangeSet(p, p.approvedDigest),
  ]);
  expect(a).toEqual(b);
  expect((await getAllSnapshot()).scenes).toHaveLength(15);
});
it("rejects stale project preview, preserving the foreign write and creating nothing", async () => {
  let c = await createCollection({ name: "Existing MIDORI" });
  c = await addProjectShot({ collectionId: c.id, title: "Existing" });
  const input: ChangeSet = {
    schema: "krakinai.change-set.v1",
    changeSetId: "append",
    source: { kind: "codex" },
    operations: [
      {
        operationId: "a",
        type: "shot.create",
        clientRef: "new",
        project: { id: c.id, expectedRevision: c.project!.revision },
        code: "02",
        title: "Appended",
        plannedDurationSeconds: 4,
      },
    ],
  };
  const p = await previewChangeSet(input, allContentApproval());
  await addProjectShot({ collectionId: c.id, title: "Other tab" });
  const before = await getAllSnapshot();
  await expect(applyApprovedChangeSet(p, p.approvedDigest)).rejects.toThrow(
    /changed|stale|revision/i,
  );
  expect(await getAllSnapshot()).toEqual(before);
});
it("multiple operations use one original project revision and preserve existing order/preference", async () => {
  let d = await createDirectPromptDraft();
  d = await saveSceneDraft({
    ...d,
    title: "Existing original",
    directPrompt: { version: 1, text: exactImportPrompt },
  });
  const old = await saveAuthoredScene(d.id, {
    requestId: "original",
    expectedInputRevision: d.inputRevision,
  });
  let c = await createCollection({ name: "Existing" });
  c = await addProjectShot({
    collectionId: c.id,
    title: "Existing shot",
    sceneId: old.id,
  });
  const revision = c.project!.revision;
  const target = { id: c.id, expectedRevision: revision },
    input: ChangeSet = {
      schema: "krakinai.change-set.v1",
      changeSetId: "append-multiple",
      source: { kind: "codex" },
      operations: [
        {
          operationId: "shot",
          type: "shot.create",
          clientRef: "new-shot",
          project: target,
          code: "02",
          title: "New shot",
        },
        {
          operationId: "scene",
          type: "scene.create_direct_prompt",
          clientRef: "new-scene",
          project: target,
          shot: { ref: "new-shot" },
          title: "New prompt",
          prompt: { version: 1, text: "A complete new exact prompt." },
        },
      ],
    };
  const before = await getAllSnapshot(),
    p = await previewChangeSet(input, allContentApproval());
  expect(blockers(p)).toEqual([]);
  await applyApprovedChangeSet(p, p.approvedDigest);
  const after = await getAllSnapshot(),
    updated = after.collections.find((x) => x.id === c.id)!;
  expect(updated.project!.revision).toBe(revision + 1);
  expect(updated.project!.shots[0]).toEqual(c.project!.shots[0]);
  expect(updated.project!.shots[1].selectedSceneId).toBeUndefined();
  expect(after.scenes.find((s) => s.id === old.id)).toEqual(
    before.scenes.find((s) => s.id === old.id),
  );
});
it("stores deferred candidates and later creates only an explicitly approved unreviewed asset", async () => {
  const p = await previewChangeSet(midoriChangeSet(), allContentApproval());
  await applyApprovedChangeSet(p, p.approvedDigest);
  const before = await getAllSnapshot(),
    candidate = before.preferences.aiImports!.candidates.find(
      (c) => c.kind === "character",
    )!;
  const review: ChangeSet = {
    schema: "krakinai.change-set.v1",
    changeSetId: "review-one",
    source: { kind: "manual" },
    operations: [
      {
        operationId: "review",
        type: "asset.review_candidate",
        candidateId: candidate.id,
        expectedRevision: candidate.revision,
      },
    ],
  };
  const approval = allContentApproval();
  approval.assetDecisions.review = { action: "create" };
  const preview = await previewChangeSet(review, approval);
  expect(blockers(preview)).toEqual([]);
  await applyApprovedChangeSet(preview, preview.approvedDigest);
  const after = await getAllSnapshot();
  expect(after.assets).toHaveLength(before.assets.length + 1);
  expect(after.assets.find((a) => a.id !== before.assets[0].id)).toMatchObject({
    category: "characters",
    reviewStatus: "unreviewed",
    identityRevision: 1,
    provenance: { toolName: "Change-set proposal (chatgpt)" },
  });
  expect(after.assets.find((a) => a.id === before.assets[0].id)).toEqual(
    before.assets[0],
  );
});
it("reports a full durable ledger during preview rather than enabling an impossible apply", async () => {
  const input: ChangeSet = {
    schema: "krakinai.change-set.v1",
    changeSetId: "first",
    source: { kind: "manual" },
    operations: [
      {
        operationId: "p",
        type: "project.create",
        clientRef: "p",
        name: "Initial",
      },
    ],
  };
  const p = await previewChangeSet(input, allContentApproval()),
    receipt = await applyApprovedChangeSet(p, p.approvedDigest),
    snapshot = await getAllSnapshot(),
    db = await openDatabase();
  await new Promise<void>((resolve) => {
    const tx = db.transaction("preferences", "readwrite");
    tx.objectStore("preferences").put({
      ...snapshot.preferences,
      aiImports: {
        version: 1,
        receipts: Array.from({ length: 1000 }, (_, i) => ({
          ...receipt,
          changeSetId: "historical-" + i,
        })),
        candidates: [],
      },
    });
    tx.oncomplete = () => resolve();
  });
  const before = await getAllSnapshot(),
    preview = await previewChangeSet(
      { ...input, changeSetId: "capacity-next" },
      allContentApproval(),
    );
  expect(blockers(preview).some((f) => f.code === "LEDGER_CAPACITY")).toBe(
    true,
  );
  expect(await getAllSnapshot()).toEqual(before);
});
it("records actual application time after a review delay while preserving exact approved content", async () => {
  const input: ChangeSet = {
    schema: "krakinai.change-set.v1",
    changeSetId: "delayed-apply",
    source: { kind: "manual" },
    operations: [
      {
        operationId: "s",
        type: "scene.create_direct_prompt",
        clientRef: "s",
        title: "Delayed",
        prompt: { version: 1, text: exactImportPrompt },
      },
    ],
  };
  const p = await previewChangeSet(input, allContentApproval()),
    appliedMs = Date.parse(p.allocation.preparedAt) + 60000;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(appliedMs);
  try {
    const receipt = await applyApprovedChangeSet(p, p.approvedDigest),
      s = (await getAllSnapshot()).scenes[0];
    expect(receipt.appliedAt).toBe(new Date(appliedMs).toISOString());
    expect(s.createdAt).toBe(receipt.appliedAt);
    expect(s.outputs.full).toBe(exactImportPrompt);
  } finally {
    vi.useRealTimers();
  }
});
