import { it, expect } from "vitest";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { getAllSnapshot } from "../storage/db";
import { saveSceneDraft, saveDraftAsTemplate } from "../storage/db";
import { saveAuthoredScene } from "../storage/sceneAuthoring";
import {
  previewChangeSet,
  applyApprovedChangeSet,
} from "../storage/changeSets";
import {
  recipeChangeSet,
  recipeApproval,
} from "./fixtures/recipeChangeSetFixture";
import { ensembleLegacyDraft } from "./fixtures/ensembleFixture";
import { canonicalStringify } from "../domain/changeSetCanonical";
import {
  exportFullBackupZip,
  restoreFullBackupZip,
  validateBackupZip,
} from "../storage/backup";
import {
  buildProjectExport,
  PROJECT_EXPORT_MEDIA_LIMIT,
} from "../domain/projectExport";
import {
  buildReferencePackZip,
  collectReferenceCandidates,
} from "../domain/referencePack";
import {
  ensembleStorageFixture,
  writeRecord,
} from "./fixtures/ensembleStorageFixture";
import { assembleScenePrompt } from "../domain/promptAssembler";
import type { SavedScene } from "../types/domain";
const hash = async (v: Uint8Array) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", v as BufferSource)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
const blobBytes = (blob: Blob): Promise<Uint8Array> =>
  typeof blob.arrayBuffer === "function"
    ? blob.arrayBuffer().then((b) => new Uint8Array(b))
    : new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
      });
it("retains optional ensemble metadata and PNG hashes through a full ZIP restore", async () => {
  const input = await ensembleStorageFixture(true);
  await writeRecord("drafts", input);
  const before = await getAllSnapshot(),
    bytes = await exportFullBackupZip(),
    files = unzipSync(bytes),
    manifest = JSON.parse(strFromU8(files["manifest.json"]));
  expect((await validateBackupZip(bytes)).valid).toBe(true);
  const mediaPath = Object.keys(files).find((p) => p.startsWith("media/"))!;
  const originalHash = await hash(files[mediaPath]);
  await restoreFullBackupZip(bytes);
  const after = await getAllSnapshot();
  expect(after.drafts).toEqual(before.drafts);
  expect(await hash(await blobBytes(after.media[0].blob))).toBe(originalHash);
  expect(
    JSON.parse(
      strFromU8(unzipSync(await exportFullBackupZip())["manifest.json"]),
    ).drafts[0].ensemble,
  ).toEqual(manifest.drafts[0].ensemble);
  expect(await hash(unzipSync(await exportFullBackupZip())[mediaPath])).toBe(
    originalHash,
  );
});
it("rejects malformed nested outfit ownership before replacing any existing data", async () => {
  const input = await ensembleStorageFixture(true);
  await writeRecord("drafts", input);
  const files = unzipSync(await exportFullBackupZip()),
    manifest = JSON.parse(strFromU8(files["manifest.json"]));
  manifest.drafts[0].ensemble.participants[1].wardrobe.parentCharacterId =
    "character";
  files["manifest.json"] = strToU8(JSON.stringify(manifest));
  const bad = zipSync(files),
    before = await getAllSnapshot();
  expect((await validateBackupZip(bad)).valid).toBe(false);
  await expect(restoreFullBackupZip(bad)).rejects.toThrow(/parent/i);
  expect(await getAllSnapshot()).toEqual(before);
});
it("restores mixed legacy, B1 and B2 immutable scenes and ensemble templates with exact outputs", async () => {
  const input = await ensembleStorageFixture(true),
    draft = await saveSceneDraft(input);
  await saveAuthoredScene(draft.id, {
    requestId: "mixed-b2",
    expectedInputRevision: draft.inputRevision,
  });
  await saveDraftAsTemplate({
    draft,
    name: "Mixed full ensemble",
    description: "Synthetic only",
    includeCharacterIdentity: false,
    ensembleMode: "full",
  });
  const legacy = await saveSceneDraft({
    ...ensembleLegacyDraft(),
    id: "mixed-legacy-draft",
    title: "Mixed legacy",
  });
  await saveAuthoredScene(legacy.id, {
    requestId: "mixed-legacy",
    expectedInputRevision: legacy.inputRevision,
  });
  const preview = await previewChangeSet(recipeChangeSet(), recipeApproval());
  expect(
    preview.plan.findings.filter((f) => f.severity === "blocking"),
  ).toEqual([]);
  await applyApprovedChangeSet(preview, preview.approvedDigest);
  const before = await getAllSnapshot(),
    bytes = await exportFullBackupZip();
  expect((await validateBackupZip(bytes)).valid).toBe(true);
  await restoreFullBackupZip(bytes);
  const after = await getAllSnapshot();
  expect(canonicalStringify(after.scenes)).toBe(
    canonicalStringify(before.scenes),
  );
  expect(canonicalStringify(after.templates)).toBe(
    canonicalStringify(before.templates),
  );
  expect(canonicalStringify(after.preferences.aiImports)).toBe(
    canonicalStringify(before.preferences.aiImports),
  );
  expect(after.scenes.filter((s) => s.ensemble)).toHaveLength(1);
  expect(after.scenes.filter((s) => !s.ensemble)).toHaveLength(2);
});
it("rejects malformed ensemble template defaults before replacement", async () => {
  const input = await ensembleStorageFixture(),
    snap = await getAllSnapshot();
  await writeRecord("templates", {
    ...snap.templates[0],
    id: "ensemble-template",
    ensembleDefault: { version: 1, ensemble: input.ensemble },
  });
  const files = unzipSync(await exportFullBackupZip()),
    manifest = JSON.parse(strFromU8(files["manifest.json"]));
  manifest.templates.find(
    (t: any) => t.id === "ensemble-template",
  ).ensembleDefault.version = 2;
  files["manifest.json"] = strToU8(JSON.stringify(manifest));
  const before = await getAllSnapshot();
  expect((await validateBackupZip(zipSync(files))).valid).toBe(false);
  await expect(restoreFullBackupZip(zipSync(files))).rejects.toThrow(
    /template|ensemble/i,
  );
  expect(await getAllSnapshot()).toEqual(before);
});
it("exports participant associations separately with shared PNG bytes once and the Project allowance unchanged", async () => {
  const input = await ensembleStorageFixture(true),
    snap = await getAllSnapshot(),
    refs = collectReferenceCandidates(
      input,
      new Map(snap.media.map((m) => [m.id, m])),
    ),
    pack = { version: 1 as const, entries: refs };
  const referenceFiles = unzipSync(
    await buildReferencePackZip(
      pack,
      new Map(snap.media.map((m) => [m.id, m])),
    ),
  );
  expect(
    Object.keys(referenceFiles).filter((p) => p.startsWith("media/")),
  ).toHaveLength(1);
  expect(
    JSON.parse(strFromU8(referenceFiles["manifest.json"])).entries.map(
      (r: any) => r.participantId,
    ),
  ).toEqual(["primary", "lucas"]);
  const result = assembleScenePrompt(input),
    scene = {
      ...input,
      id: "ensemble-take",
      outputs: result.outputs,
      references: result.references,
      referencePack: pack,
      revision: 1,
      createdAt: input.updatedAt,
    } as SavedScene;
  const collection = structuredClone(snap.collections[0]);
  collection.project!.shots[0].takeSceneIds = [scene.id];
  collection.project!.shots[0].selectedSceneId = scene.id;
  const exported = await buildProjectExport(
      collection,
      { ...snap, scenes: [scene] },
      { includeGenerationJson: true },
    ),
    files = unzipSync(exported.bytes);
  expect(PROJECT_EXPORT_MEDIA_LIMIT).toBe(128 * 1024 * 1024);
  expect(
    exported.manifest.associations.map((r: any) => r.participantId),
  ).toEqual(["primary", "lucas"]);
  expect(
    new Set(exported.manifest.associations.map((r) => r.archivePath)).size,
  ).toBe(1);
  expect(Object.keys(files).filter((p) => p.endsWith(".png"))).toHaveLength(1);
  expect(
    await hash(files[exported.manifest.associations[0].archivePath!]),
  ).toBe(
    await hash(
      referenceFiles[
        Object.keys(referenceFiles).find((p) => p.startsWith("media/"))!
      ],
    ),
  );
  const shot = exported.manifest.shots[0];
  expect(JSON.parse(strFromU8(files[shot.files!.scene])).schema).toBe(
    "krakinai.scene-prompt.v2",
  );
  expect(
    JSON.parse(strFromU8(files[shot.files!.generation!])).participants,
  ).toHaveLength(2);
  expect(strFromU8(files[exported.manifest.documents.script])).toContain(
    "  I do.\r\n😊  ",
  );
});
