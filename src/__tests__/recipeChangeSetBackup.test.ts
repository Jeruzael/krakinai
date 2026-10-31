import { beforeEach, it, expect } from "vitest";
import { zipSync, unzipSync } from "fflate";
import type { SavedScene } from "../types/domain";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  openDatabase,
  getAllSnapshot,
  saveMediaAsset,
} from "../storage/db";
import {
  previewChangeSet,
  applyApprovedChangeSet,
} from "../storage/changeSets";
import {
  exportFullBackupZip,
  restoreFullBackupZip,
  validateBackupZip,
} from "../storage/backup";
import {
  recipeState,
  recipeChangeSet,
  recipeApproval,
} from "./fixtures/recipeChangeSetFixture";
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
  const state = recipeState(),
    db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["assets", "collections", "scenes"], "readwrite");
    for (const a of state.assets) tx.objectStore("assets").put(a);
    for (const c of state.collections) tx.objectStore("collections").put(c);
    const legacy: SavedScene = {
      id: "synthetic_legacy_recipe",
      title: "Synthetic legacy recipe",
      slots: {
        environment: {
          slot: "environment",
          sourceType: "asset",
          sourceId: "environment",
          sourceTitle: "Frozen historic courtyard",
          sourceRevision: 1,
          promptText: "The historic courtyard snapshot.",
          mediaLinks: [],
        },
        action: {
          slot: "action",
          sourceType: "asset",
          sourceId: "action",
          sourceTitle: "Frozen historic action",
          sourceRevision: 1,
          promptText: "Wait by the door.",
          mediaLinks: [],
        },
      },
      extraRequiredSlots: [],
      sceneInstructions: "Historic directions.",
      settings: { aspectRatio: "16:9", durationSeconds: 4 },
      manualOutputs: {},
      references: [],
      resultMediaLinks: [],
      reviewNotes:
        "Synthetic legacy-format fixture; no authoringMode or sceneRevision.",
      reviewStatus: "unreviewed",
      revision: 1,
      createdAt: "2026-10-25T00:00:00.000Z",
      updatedAt: "2026-10-25T00:00:00.000Z",
      outputs: {
        full: "  FROZEN LEGACY RECIPE FULL\r\n",
        structured: "FROZEN LEGACY STRUCTURED",
        compact: "FROZEN LEGACY COMPACT",
      },
    };
    tx.objectStore("scenes").put(legacy);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
});
const hash = async (blob: Blob) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
it("round trips mixed v1/v2 scenes, preferences, exact snapshots, receipts and decodable PNG bytes with unchanged SHA-256", async () => {
  const png = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGFEAAAAASUVORK5CYII=",
    ),
    (c) => c.charCodeAt(0),
  );
  const media = await saveMediaAsset({
    filename: "synthetic-b1-one-pixel.png",
    mimeType: "image/png",
    blob: new Blob([png], { type: "image/png" }),
  });
  const db = await openDatabase(),
    environment = (await getAllSnapshot()).assets.find(
      (a) => a.id === "environment",
    )!;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").put({
      ...environment,
      mediaLinks: [
        {
          mediaId: media.id,
          role: "reference",
          altText: "Synthetic environment reference",
          order: 0,
        },
      ],
    });
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  const originalHash = await hash(media.blob),
    direct: any = {
      schema: "krakinai.change-set.v1",
      changeSetId: "synthetic-old-direct",
      source: { kind: "manual" },
      operations: [
        {
          operationId: "old",
          type: "scene.create_direct_prompt",
          clientRef: "old",
          project: { id: "project", expectedRevision: 1 },
          shot: { id: "shot" },
          title: "Frozen legacy Direct Prompt",
          prompt: {
            version: 1,
            text: "  FROZEN legacy text\r\nKeep this exact.  ",
          },
          references: [
            {
              mediaId: media.id,
              role: "reference",
              altText: "Synthetic original PNG",
            },
          ],
        },
        {
          operationId: "preferred",
          type: "shot.select_take",
          project: { id: "project", expectedRevision: 1 },
          shot: { id: "shot" },
          scene: { ref: "old" },
          expectedSelectedSceneId: null,
        },
      ],
    };
  const oldPreview = await previewChangeSet(direct, {
      ...recipeApproval(),
      preferred: true,
    }),
    oldReceipt = await applyApprovedChangeSet(
      oldPreview,
      oldPreview.approvedDigest,
    ),
    old = structuredClone(
      (await getAllSnapshot()).scenes.find(
        (s) => s.id === oldReceipt.idMappings.old.id,
      )!,
    );
  const input: any = recipeChangeSet();
  input.operations[0].project.expectedRevision = 2;
  input.operations[0].references = [
    {
      mediaId: media.id,
      role: "sample",
      altText: "Illustrative synthetic guide",
    },
  ];
  const preview = await previewChangeSet(input, recipeApproval());
  expect(
    preview.plan.findings.filter((f) => f.severity === "blocking"),
  ).toEqual([]);
  const receipt = await applyApprovedChangeSet(preview, preview.approvedDigest),
    before = await getAllSnapshot(),
    bytes = await exportFullBackupZip();
  await clearAllStoresForTesting();
  await restoreFullBackupZip(bytes);
  const restored = await getAllSnapshot();
  expect(restored.scenes).toEqual(before.scenes);
  expect(restored.collections).toEqual(before.collections);
  expect(restored.assets).toEqual(before.assets);
  expect(restored.preferences).toEqual(before.preferences);
  expect(restored.scenes.find((s) => s.id === old.id)).toEqual(old);
  expect(restored.collections[0].project!.shots[0].selectedSceneId).toBe(
    old.id,
  );
  expect(await hash(restored.media[0].blob)).toBe(originalHash);
  expect(
    restored.scenes
      .find((s) => s.authoringMode === "recipe")!
      .referencePack!.entries.some(
        (e) => e.mediaId === media.id && e.role === "sample",
      ),
  ).toBe(true);
  expect(
    restored.scenes
      .find((s) => s.authoringMode === "recipe")!
      .references.some(
        (e) =>
          e.mediaId === media.id &&
          e.role === "sample" &&
          e.altText === "Illustrative synthetic guide",
      ),
  ).toBe(true);
  expect((await previewChangeSet(input)).replay).toEqual(receipt);
  expect((await previewChangeSet(direct)).replay).toEqual(oldReceipt);
  expect((await getAllSnapshot()).scenes).toHaveLength(3);
  expect(
    restored.scenes.find((s) => s.id === "synthetic_legacy_recipe")!.outputs,
  ).toEqual({
    full: "  FROZEN LEGACY RECIPE FULL\r\n",
    structured: "FROZEN LEGACY STRUCTURED",
    compact: "FROZEN LEGACY COMPACT",
  });
});
it("still restores a legacy full backup without an import ledger after B1 scenes have been saved", async () => {
  const legacy = zipSync(unzipSync(await exportFullBackupZip())),
    before = await getAllSnapshot(),
    p = await previewChangeSet(recipeChangeSet(), recipeApproval());
  await applyApprovedChangeSet(p, p.approvedDigest);
  expect((await validateBackupZip(legacy)).valid).toBe(true);
  await restoreFullBackupZip(legacy);
  expect(await getAllSnapshot()).toEqual(before);
});
