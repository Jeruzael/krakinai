import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  getAllSnapshot,
  clearAllStoresForTesting,
  initializeDatabase,
  openDatabase,
} from "../storage/db";
import {
  previewChangeSet,
  applyApprovedChangeSet,
} from "../storage/changeSets";
import { exportFullBackupZip, restoreFullBackupZip } from "../storage/backup";
import { canonicalStringify } from "../domain/changeSetCanonical";
it("binds off-primary frozen attachment metadata to the transactional review proof", async () => {
  const state = ensembleParentState(),
    scene = state.scenes[0];
  // Opaque one-byte fixture tests metadata invalidation only, not image decoding.
  const media = {
    id: "metadata-only-fixture",
    filename: "metadata-only.png",
    safeFilename: "metadata-only.png",
    mimeType: "image/png",
    byteSize: 1,
    blob: new Blob(["x"], { type: "image/png" }),
    createdAt: "2026-11-01T00:00:00Z",
    width: 1,
    height: 1,
  };
  scene.ensemble!.participants[1].character.mediaLinks = [
    {
      mediaId: media.id,
      role: "reference",
      altText: "Metadata-only synthetic fixture",
      order: 0,
    },
  ];
  await writeRecord("media", media);
  await writeRecord("scenes", scene);
  await writeRecord("collections", state.collections[0]);
  const p = ensembleChangeSet();
  p.operations = [
    {
      operationId: "revision",
      clientRef: "revision",
      type: "scene.revise_recipe",
      sceneId: scene.id,
      expectedHeadId: scene.id,
      project: { id: "project", expectedRevision: 1 },
      shot: { id: "shot" },
      assetRefs: [
        { asset: { id: "camera" }, expectedRevision: 1, slot: "camera" },
      ],
    },
  ];
  const preview = await previewChangeSet(p, recipeApproval());
  expect(blocked(preview)).toEqual([]);
  await writeRecord("media", { ...media, width: 2 });
  const before = await getAllSnapshot();
  await expect(
    applyApprovedChangeSet(preview, preview.approvedDigest),
  ).rejects.toThrow(/changed|preview/i);
  expect(await getAllSnapshot()).toEqual(before);
});
import { ensembleState } from "./fixtures/ensemblePlanningFixture";
import {
  ensembleChangeSet,
  outfitProposal,
} from "./fixtures/ensembleChangeSetFixture";
import { recipeApproval } from "./fixtures/recipeChangeSetFixture";
import { writeRecord } from "./fixtures/ensembleStorageFixture";
import { ensembleParentState } from "./fixtures/ensemblePlanningFixture";
const blocked = (p: Awaited<ReturnType<typeof previewChangeSet>>) =>
  p.plan.findings.filter((f) => f.severity === "blocking");
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
  const s = ensembleState();
  for (const a of s.assets) await writeRecord("assets", a);
  for (const v of s.variants ?? []) await writeRecord("variants", v);
  for (const c of s.collections) await writeRecord("collections", c);
});
afterEach(() => vi.restoreAllMocks());
function compound() {
  const p = ensembleChangeSet(),
    approval: any = recipeApproval();
  p.operations[0].ensemble.participantUpserts[1].wardrobe = {
    variant: { ref: "outfit" },
  };
  p.operations.unshift(outfitProposal("outfit", "lucas"));
  approval.variantDecisions = { outfit: { action: "create" } };
  return { p, approval };
}
it("previews without writes then atomically saves Outfit, exact ensemble, project and receipt once across a backup restore", async () => {
  const { p, approval } = compound(),
    before = await getAllSnapshot(),
    preview = await previewChangeSet(p, approval);
  expect(blocked(preview)).toEqual([]);
  expect(await getAllSnapshot()).toEqual(before);
  expect(preview.plan.scenes[0].ensemble).toBeDefined();
  const receipt = await applyApprovedChangeSet(preview, preview.approvedDigest),
    after = await getAllSnapshot(),
    variantId = receipt.idMappings.outfit.variantId;
  expect(after.variants.find((v) => v.id === variantId)).toMatchObject({
    parentCharacterId: "lucas",
    type: "Outfit",
    reviewStatus: "unreviewed",
  });
  expect(after.scenes[0].ensemble!.participants[1].wardrobe?.sourceId).toBe(
    variantId,
  );
  expect(after.scenes[0].outputs).toEqual(preview.plan.scenes[0].outputs);
  expect(
    after.collections.find((c) => c.id === "project")!.project!.shots[0]
      .selectedSceneId,
  ).toBeUndefined();
  expect(await applyApprovedChangeSet(preview, preview.approvedDigest)).toEqual(
    receipt,
  );
  expect(await getAllSnapshot()).toEqual(after);
  await restoreFullBackupZip(await exportFullBackupZip());
  const restored = await getAllSnapshot();
  expect(canonicalStringify(restored.scenes)).toBe(
    canonicalStringify(after.scenes),
  );
  expect(canonicalStringify(restored.variants)).toBe(
    canonicalStringify(after.variants),
  );
  expect(await applyApprovedChangeSet(preview, preview.approvedDigest)).toEqual(
    receipt,
  );
});
it("makes no partial writes for a deferred required Outfit", async () => {
  const { p, approval } = compound();
  approval.variantDecisions.outfit = { action: "defer" };
  const before = await getAllSnapshot(),
    preview = await previewChangeSet(p, approval);
  expect(blocked(preview).length).toBeGreaterThan(0);
  await expect(
    applyApprovedChangeSet(preview, preview.approvedDigest),
  ).rejects.toThrow();
  expect(await getAllSnapshot()).toEqual(before);
  expect(canonicalStringify(preview.changeSet)).toBe(canonicalStringify(p));
});
it("persists a pending Outfit alone and later reviews that same candidate without duplicating the first receipt", async () => {
  const p = ensembleChangeSet();
  p.operations = [outfitProposal("outfit", "lucas")];
  const a = recipeApproval(),
    first = await previewChangeSet(p, a);
  expect(blocked(first)).toEqual([]);
  expect(first.plan.variantCandidates).toHaveLength(1);
  const original = await applyApprovedChangeSet(first, first.approvedDigest),
    snapshot = await getAllSnapshot(),
    candidate = snapshot.preferences.aiImports!.variantCandidates![0];
  expect(candidate.status).toBe("pending");
  const later = {
      ...p,
      changeSetId: "review-outfit",
      operations: [
        {
          operationId: "review",
          type: "variant.review_candidate",
          candidateId: candidate.id,
          expectedRevision: candidate.revision,
        },
      ],
    },
    approval: any = recipeApproval();
  approval.variantDecisions = { review: { action: "create" } };
  const reviewed = await previewChangeSet(later, approval);
  expect(blocked(reviewed)).toEqual([]);
  await applyApprovedChangeSet(reviewed, reviewed.approvedDigest);
  const after = await getAllSnapshot();
  expect(after.preferences.aiImports!.variantCandidates![0]).toMatchObject({
    id: candidate.id,
    status: "created",
    variantId: expect.any(String),
  });
  expect(await applyApprovedChangeSet(first, first.approvedDigest)).toEqual(
    original,
  );
  expect(await getAllSnapshot()).toEqual(after);
});
it.each(["variant quota", "scene add", "receipt quota", "receipt abort"])(
  "rolls back every write after %s failure",
  async (kind) => {
    const { p, approval } = compound(),
      preview = await previewChangeSet(p, approval);
    expect(blocked(preview)).toEqual([]);
    const before = await getAllSnapshot(),
      add = IDBObjectStore.prototype.add,
      put = IDBObjectStore.prototype.put;
    let injected = 0;
    const intercept = function (
      this: IDBObjectStore,
      method: "add" | "put",
      args: any[],
    ) {
      if (
        (kind === "variant quota" && this.name === "variants") ||
        (kind === "scene add" && this.name === "scenes") ||
        (kind.startsWith("receipt") && this.name === "preferences")
      ) {
        injected++;
        if (kind === "receipt abort") this.transaction.abort();
        else
          throw new DOMException(
            "Synthetic late failure",
            "QuotaExceededError",
          );
      }
      return (method === "add" ? add : put).apply(this, args as any);
    };
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
      this: IDBObjectStore,
      ...args
    ) {
      return intercept.call(this, "add", args);
    });
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args
    ) {
      return intercept.call(this, "put", args);
    });
    await expect(
      applyApprovedChangeSet(preview, preview.approvedDigest),
    ).rejects.toThrow();
    expect(injected).toBeGreaterThan(0);
    vi.restoreAllMocks();
    expect(await getAllSnapshot()).toEqual(before);
  },
);
it.each([
  "secondary identity",
  "cue order",
  "performance notes",
  "visible candidate",
  "output",
])("rejects changed reviewed %s before writing", async (which) => {
  const { p, approval } = compound(),
    preview = await previewChangeSet(p, approval);
  expect(blocked(preview)).toEqual([]);
  const before = await getAllSnapshot();
  if (which === "secondary identity")
    preview.plan.scenes[0].ensemble!.participants[1].character.promptText +=
      " UNREVIEWED";
  if (which === "cue order")
    preview.plan.scenes[0].ensemble!.dialogueCues.reverse();
  if (which === "performance notes")
    preview.plan.scenes[0].ensemble!.participants[1].performanceNotes =
      "UNREVIEWED";
  if (which === "visible candidate")
    preview.plan.operations[0].proposedPrompt = "UNREVIEWED";
  if (which === "output")
    preview.plan.scenes[0].outputs.compact += " UNREVIEWED";
  await expect(
    applyApprovedChangeSet(preview, preview.approvedDigest),
  ).rejects.toThrow(/changed|preview|review/i);
  expect(await getAllSnapshot()).toEqual(before);
});
it("rejects a parent Character edit after preview without changing the old library", async () => {
  const { p, approval } = compound(),
    preview = await previewChangeSet(p, approval);
  expect(blocked(preview)).toEqual([]);
  const snapshot = await getAllSnapshot(),
    parent = snapshot.assets.find((a) => a.id === "lucas")!;
  await writeRecord("assets", { ...parent, revision: parent.revision + 1 });
  const before = await getAllSnapshot();
  await expect(
    applyApprovedChangeSet(preview, preview.approvedDigest),
  ).rejects.toThrow(/changed|preview|stale/i);
  expect(await getAllSnapshot()).toEqual(before);
});
it.each(["source", "head", "project", "variant"])(
  "rejects stale ensemble %s data at the transaction boundary",
  async (which) => {
    const state = ensembleParentState();
    for (const scene of state.scenes) await writeRecord("scenes", scene);
    for (const c of state.collections) await writeRecord("collections", c);
    const p = ensembleChangeSet();
    p.changeSetId = `stale-${which}`;
    p.operations = [
      {
        operationId: "revision",
        clientRef: "revision",
        type: "scene.revise_recipe",
        sceneId: "ensemble-parent",
        expectedHeadId: "ensemble-parent",
        project: { id: "project", expectedRevision: 1 },
        shot: { id: "shot" },
        ensemble: {
          version: 1,
          participantUpserts: [
            {
              id: "lucas",
              wardrobe: { variant: { id: "lucas-suit" }, expectedRevision: 1 },
            },
          ],
        },
      },
    ];
    const preview = await previewChangeSet(p, recipeApproval());
    expect(blocked(preview)).toEqual([]);
    if (which === "source") {
      const source = structuredClone(state.scenes[0]);
      source.ensemble!.participants[1].performanceNotes =
        "Changed frozen source";
      await writeRecord("scenes", source);
    }
    if (which === "head") {
      const head = structuredClone(state.scenes[0]);
      head.id = "external-head";
      head.sceneRevision = {
        version: 1,
        rootSceneId: "ensemble-parent",
        sequence: 2,
        parentSceneId: "ensemble-parent",
        createdAt: head.createdAt,
      };
      await writeRecord("scenes", head);
    }
    if (which === "project")
      await writeRecord("collections", {
        ...state.collections[0],
        project: { ...state.collections[0].project!, revision: 2 },
      });
    if (which === "variant") {
      const v = state.variants!.find((v) => v.id === "lucas-suit")!;
      await writeRecord("variants", {
        ...v,
        promptText: "Changed current variant",
        revision: 2,
      });
    }
    const before = await getAllSnapshot();
    await expect(
      applyApprovedChangeSet(preview, preview.approvedDigest),
    ).rejects.toThrow(/changed|preview|head/i);
    expect(await getAllSnapshot()).toEqual(before);
  },
);
it.each(["revoked", "async"])(
  "rejects %s browser authorization before any v3 writes and checks replay authorization too",
  async (mode) => {
    const { p, approval } = compound(),
      preview = await previewChangeSet(p, approval);
    expect(blocked(preview)).toEqual([]);
    const before = await getAllSnapshot(),
      authorize =
        mode === "async"
          ? async () => {}
          : () => {
              throw Error("Authorization revoked");
            };
    await expect(
      applyApprovedChangeSet(preview, preview.approvedDigest, authorize),
    ).rejects.toThrow(/synchronous|revoked/i);
    expect(await getAllSnapshot()).toEqual(before);
    const receipt = await applyApprovedChangeSet(
        preview,
        preview.approvedDigest,
      ),
      after = await getAllSnapshot();
    await expect(
      applyApprovedChangeSet(preview, receipt.approvedDigest, () => {
        throw Error("Replay authorization revoked");
      }),
    ).rejects.toThrow(/revoked/i);
    expect(await getAllSnapshot()).toEqual(after);
  },
);
