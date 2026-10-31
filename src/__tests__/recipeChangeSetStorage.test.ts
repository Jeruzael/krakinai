import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  openDatabase,
  getAllSnapshot,
} from "../storage/db";
import {
  previewChangeSet,
  applyApprovedChangeSet,
} from "../storage/changeSets";
import {
  recipeState,
  recipeChangeSet,
  recipeApproval,
} from "./fixtures/recipeChangeSetFixture";
import { canonicalStringify } from "../domain/changeSetCanonical";
import * as assembler from "../domain/promptAssembler";
const blocked = (p: Awaited<ReturnType<typeof previewChangeSet>>) =>
  p.plan.findings.filter((f) => f.severity === "blocking");
async function write(store: string, record: any) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(record);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
  const state = recipeState();
  for (const a of state.assets) await write("assets", a);
  for (const c of state.collections) await write("collections", c);
});
afterEach(() => vi.restoreAllMocks());
it("previews without writes and atomically saves the exact three outputs and durable IDs once", async () => {
  const before = await getAllSnapshot(),
    p = await previewChangeSet(recipeChangeSet(), recipeApproval());
  expect(blocked(p)).toEqual([]);
  expect(await getAllSnapshot()).toEqual(before);
  const r = await applyApprovedChangeSet(p, p.approvedDigest),
    after = await getAllSnapshot();
  expect(after.scenes).toHaveLength(1);
  expect(after.scenes[0].id).toBe(r.idMappings.recipe.id);
  expect(after.scenes[0].outputs).toEqual(p.plan.scenes[0].outputs);
  expect(after.assets).toEqual(before.assets);
  expect(after.media).toEqual(before.media);
  expect(after.drafts).toEqual(before.drafts);
  expect(await applyApprovedChangeSet(p, p.approvedDigest)).toEqual(r);
  expect((await getAllSnapshot()).scenes).toHaveLength(1);
  expect((await previewChangeSet(recipeChangeSet())).replay).toEqual(r);
  expect(after.preferences.aiImports!.receipts).toHaveLength(1);
});
it.each([
  "snapshot",
  "rendered output",
  "resolved metadata",
  "displayed target",
  "raw operation",
])(
  "rejects tampered %s before writes even when inputs and original digest remain unchanged",
  async (kind) => {
    const p = await previewChangeSet(recipeChangeSet(), recipeApproval());
    expect(blocked(p)).toEqual([]);
    const before = await getAllSnapshot();
    if (kind === "snapshot")
      p.plan.scenes[0].slots.environment!.promptText = "Injected identity text";
    if (kind === "rendered output")
      p.plan.operations[0].proposedPrompt = "Wrong text shown for approval";
    if (kind === "resolved metadata")
      (p.plan.operations[0].resolved as any).recipe.outputs.full =
        "Wrong resolved preview";
    if (kind === "displayed target")
      p.plan.operations[0].projectId = "wrong-project";
    if (kind === "raw operation")
      (p.plan.operations[0].details as any).title =
        "Wrong displayed source JSON";
    await expect(applyApprovedChangeSet(p, p.approvedDigest)).rejects.toThrow(
      /digest|preview|content/i,
    );
    expect(await getAllSnapshot()).toEqual(before);
  },
);
it("blocks a newly stale adopted asset at the atomic write boundary", async () => {
  const p = await previewChangeSet(recipeChangeSet(), recipeApproval());
  expect(blocked(p)).toEqual([]);
  const state = await getAllSnapshot(),
    a = state.assets.find((a) => a.id === "environment")!;
  await write("assets", {
    ...a,
    revision: 3,
    promptText: "Changed after preview.",
  });
  const before = await getAllSnapshot();
  await expect(applyApprovedChangeSet(p, p.approvedDigest)).rejects.toThrow(
    /changed|stale|unavailable/i,
  );
  expect(await getAllSnapshot()).toEqual(before);
});
it.each(["quota", "abort"])(
  "rolls back all new recipe and candidate records on a late %s failure",
  async (kind) => {
    const input: any = recipeChangeSet();
    input.operations.unshift({
      operationId: "candidate",
      type: "asset.propose",
      clientRef: "candidate",
      kind: "lighting",
      title: "Synthetic Late Lighting",
      promptText: "Soft directional window light.",
      tags: ["synthetic"],
    });
    const approval = recipeApproval();
    approval.assetDecisions.candidate = { action: "create" };
    const p = await previewChangeSet(input, approval);
    expect(blocked(p)).toEqual([]);
    const before = await getAllSnapshot(),
      put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "preferences") {
        if (kind === "quota")
          throw new DOMException(
            "Synthetic quota failure",
            "QuotaExceededError",
          );
        this.transaction.abort();
      }
      return put.apply(this, args);
    });
    await expect(applyApprovedChangeSet(p, p.approvedDigest)).rejects.toThrow();
    vi.restoreAllMocks();
    expect(await getAllSnapshot()).toEqual(before);
  },
);
it("blocks an incomplete compound package without partially persisting its project, candidate or shot", async () => {
  const input: any = recipeChangeSet();
  input.operations[0].project = { ref: "new-project" };
  input.operations[0].shot = { ref: "new-shot" };
  input.operations[0].assetRefs = [];
  input.operations.unshift(
    {
      operationId: "new-project",
      type: "project.create",
      clientRef: "new-project",
      name: "Synthetic incomplete project",
    },
    {
      operationId: "new-shot",
      type: "shot.create",
      clientRef: "new-shot",
      project: { ref: "new-project" },
      code: "01",
      title: "Unresolved shot",
    },
    {
      operationId: "candidate",
      type: "asset.propose",
      clientRef: "candidate",
      kind: "camera",
      title: "Synthetic Independent Camera",
      promptText: "A low-angle static shot.",
      tags: ["synthetic"],
    },
  );
  const approval = recipeApproval();
  approval.assetDecisions.candidate = { action: "create" };
  const before = await getAllSnapshot(),
    p = await previewChangeSet(input, approval);
  expect(blocked(p).length).toBeGreaterThan(0);
  await expect(applyApprovedChangeSet(p, p.approvedDigest)).rejects.toThrow();
  expect(await getAllSnapshot()).toEqual(before);
  expect(canonicalStringify(p.changeSet)).toBe(canonicalStringify(input));
});
it("rejects changed assembler results between reviewed preview and the synchronous save replan", async () => {
  const p = await previewChangeSet(recipeChangeSet(), recipeApproval());
  expect(blocked(p)).toEqual([]);
  const before = await getAllSnapshot(),
    assemble = assembler.assembleScenePrompt;
  vi.spyOn(assembler, "assembleScenePrompt").mockImplementation((draft) => {
    const result = assemble(draft);
    return {
      ...result,
      outputs: {
        ...result.outputs,
        compact: result.outputs.compact + "\nUNREVIEWED DRIFT",
      },
    };
  });
  await expect(applyApprovedChangeSet(p, p.approvedDigest)).rejects.toThrow(
    /changed|preview/i,
  );
  expect(await getAllSnapshot()).toEqual(before);
});
