import { beforeEach, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  saveSceneDraft,
  getAllSnapshot,
  saveMediaAsset,
  createCollection,
} from "../storage/db";
import {
  createDirectPromptDraft,
  createSceneRevisionDraft,
  saveAuthoredScene,
} from "../storage/sceneAuthoring";
import {
  exportFullBackupZip,
  restoreFullBackupZip,
  validateBackupZip,
} from "../storage/backup";
import { addProjectShot } from "../storage/projects";
const exact =
  '  MIDORI\r\n\r\n“Huwag baguhin ang layout.” 😊 e\u0301\n {"x": 1}  ';
const hash = async (value: string | Uint8Array) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        typeof value === "string"
          ? new TextEncoder().encode(value)
          : Uint8Array.from(value),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
});
it("round trips immutable direct versions, pending sources, relationships and original media bytes", async () => {
  const media = await saveMediaAsset({
    filename: "original guide.png",
    mimeType: "image/png",
    blob: new Blob(["synthetic bytes"], { type: "image/png" }),
  });
  let draft = await createDirectPromptDraft();
  draft = await saveSceneDraft({
    ...draft,
    title: "MIDORI",
    shotType: "graphic_motion",
    directPrompt: { version: 1, text: exact },
    directReferences: [
      { mediaId: media.id, role: "reference", altText: "Guide", order: 0 },
    ],
    pendingInputs: [
      {
        version: 1,
        id: "original",
        kind: "source_image",
        label: "Actual floor plan",
      },
    ],
  });
  const first = await saveAuthoredScene(draft.id, {
    requestId: "first",
    expectedInputRevision: draft.inputRevision,
  });
  let next = await createSceneRevisionDraft(first.id);
  next = await saveSceneDraft({
    ...next,
    directPrompt: { version: 1, text: exact + "\nRevised zoom." },
  });
  const second = await saveAuthoredScene(next.id, {
    requestId: "second",
    expectedInputRevision: next.inputRevision,
  });
  const c = await createCollection({ name: "MIDORI" });
  await addProjectShot({ collectionId: c.id, title: "05", sceneId: first.id });
  await addProjectShot({ collectionId: c.id, title: "Still planned" });
  const before = await getAllSnapshot();
  const bytes = await exportFullBackupZip();
  expect((await validateBackupZip(bytes)).valid).toBe(true);
  await clearAllStoresForTesting();
  await restoreFullBackupZip(bytes);
  const restored = await getAllSnapshot();
  expect(restored.scenes).toEqual(before.scenes);
  expect(restored.collections).toEqual(before.collections);
  expect(restored.drafts).toEqual(before.drafts);
  expect(
    await hash(restored.scenes.find((s) => s.id === first.id)!.outputs.full),
  ).toBe(await hash(exact));
  expect(
    restored.scenes.find((s) => s.id === second.id)!.versionOfSceneId,
  ).toBe(first.id);
  expect(restored.media[0].filename).toBe(media.filename);
  expect(
    await hash(new Uint8Array(await restored.media[0].blob.arrayBuffer())),
  ).toBe(await hash(new Uint8Array(await media.blob.arrayBuffer())));
});
it("rejects future direct metadata before replacing any existing records", async () => {
  let draft = await createDirectPromptDraft();
  draft = await saveSceneDraft({
    ...draft,
    title: "Keep",
    directPrompt: { version: 1, text: exact },
  });
  await saveAuthoredScene(draft.id, {
    requestId: "keep",
    expectedInputRevision: draft.inputRevision,
  });
  const before = await getAllSnapshot();
  const entries = unzipSync(await exportFullBackupZip());
  const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
  manifest.scenes[0].directPrompt.version = 99;
  entries["manifest.json"] = strToU8(JSON.stringify(manifest));
  const invalid = zipSync(entries);
  await expect(restoreFullBackupZip(invalid)).rejects.toThrow(/version/i);
  expect((await getAllSnapshot()).scenes).toEqual(before.scenes);
});
