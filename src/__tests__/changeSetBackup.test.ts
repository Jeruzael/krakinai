import { beforeEach, it, expect } from "vitest";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import {
  initializeDatabase,
  clearAllStoresForTesting,
  getAllSnapshot,
  openDatabase,
  saveMediaAsset,
} from "../storage/db";
import {
  exportFullBackupZip,
  restoreFullBackupZip,
  validateBackupZip,
} from "../storage/backup";
import {
  previewChangeSet,
  applyApprovedChangeSet,
} from "../storage/changeSets";
import {
  midoriChangeSet,
  syntheticCamera,
  allContentApproval,
} from "./fixtures/changeSetFixture";
import { validateImportLedger } from "../domain/changeSetLedger";
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
  const db = await openDatabase();
  await new Promise<void>((resolve) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").add(syntheticCamera());
    tx.oncomplete = () => resolve();
  });
});
it("round trips receipts,candidates,exact prompts,planning notes and real PNG bytes then replays without duplication", async () => {
  const png = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGFEAAAAASUVORK5CYII=",
    ),
    (c) => c.charCodeAt(0),
  );
  const media = await saveMediaAsset({
    filename: "synthetic-one-pixel.png",
    mimeType: "image/png",
    blob: new Blob([png], { type: "image/png" }),
  });
  const input = midoriChangeSet();
  (input.operations[2] as any).references = [
    {
      mediaId: media.id,
      role: "reference",
      altText: "Decodable synthetic PNG",
    },
  ];
  const p = await previewChangeSet(input, allContentApproval()),
    receipt = await applyApprovedChangeSet(p, p.approvedDigest),
    before = await getAllSnapshot(),
    bytes = await exportFullBackupZip();
  await clearAllStoresForTesting();
  await restoreFullBackupZip(bytes);
  const after = await getAllSnapshot();
  expect(after.preferences).toEqual(before.preferences);
  expect(after.scenes).toEqual(before.scenes);
  expect(after.collections).toEqual(before.collections);
  expect(new Uint8Array(await after.media[0].blob.arrayBuffer())).toEqual(png);
  const replay = await previewChangeSet(input);
  expect(await applyApprovedChangeSet(replay, replay.approvedDigest)).toEqual(
    receipt,
  );
  expect((await getAllSnapshot()).scenes).toHaveLength(15);
});
it("rejects invalid ledger metadata before replacing a valid library and still accepts a legacy backup", async () => {
  const legacy = await exportFullBackupZip(),
    p = await previewChangeSet(midoriChangeSet(), allContentApproval());
  await applyApprovedChangeSet(p, p.approvedDigest);
  const before = await getAllSnapshot(),
    entries = unzipSync(await exportFullBackupZip()),
    manifest = JSON.parse(strFromU8(entries["manifest.json"]));
  manifest.preferences.aiImports.version = 999;
  entries["manifest.json"] = strToU8(JSON.stringify(manifest));
  const bad = zipSync(entries);
  expect((await validateBackupZip(bad)).valid).toBe(false);
  await expect(restoreFullBackupZip(bad)).rejects.toThrow(
    /ledger|version|schema/i,
  );
  expect(await getAllSnapshot()).toEqual(before);
  expect((await validateBackupZip(legacy)).valid).toBe(true);
});
it("rejects ledger exhaustion without evicting receipts", () => {
  expect(() =>
    validateImportLedger({
      version: 1,
      receipts: Array.from({ length: 1001 }, () => ({})),
      candidates: [],
    }),
  ).toThrow(/limit/i);
  expect(() =>
    validateImportLedger({
      version: 1,
      receipts: [],
      candidates: Array.from({ length: 251 }, () => ({})),
    }),
  ).toThrow(/limit/i);
});
