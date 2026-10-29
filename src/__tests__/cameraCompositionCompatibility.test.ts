import { beforeEach, describe, it, expect } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  loadStarterLibrary,
  getAllSnapshot,
  saveSceneDraft,
  saveSceneFromDraft,
  createDraftFromSavedScene,
} from "../storage/db";
import { applyCameraComposition } from "../domain/cameraComposition";
import { searchCinematography } from "../domain/cinematographyRegistry";
import { validatePhase4Record } from "../domain/phase4Validation";
import { createSnapshotFromAsset } from "../domain/promptAssembler";
import { serializeSceneJson } from "../domain/sceneDocument";
import { serializeGenerationJson } from "../domain/generationDocument";
import { exportFullBackupZip, restoreFullBackupZip } from "../storage/backup";
import {
  buildProjectExport,
  PROJECT_EXPORT_MEDIA_LIMIT,
} from "../domain/projectExport";
import type { Collection, SceneDraft } from "../types/domain";
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
  await loadStarterLibrary();
});
async function input(composed = true) {
  const snap = await getAllSnapshot(),
    environment = createSnapshotFromAsset(
      snap.assets.find((a) => a.category === "environments")!,
    ),
    camera = createSnapshotFromAsset(
      snap.assets.find((a) => a.category === "camera")!,
    );
  return {
    title: "Synthetic composition compatibility",
    shotType: "property_environment",
    slots: {
      environment,
      camera: composed
        ? applyCameraComposition(camera, {
            version: 1,
            techniqueIds: [searchCinematography("Rule of thirds")[0].id],
          })
        : camera,
    },
    extraRequiredSlots: [],
    sceneInstructions: "Keep the established environment and source geometry.",
    settings: { aspectRatio: "16:9", durationSeconds: 5 },
    manualOutputs: {},
    resultMediaLinks: [],
    reviewNotes: "Synthetic tests only",
    reviewStatus: "unreviewed",
  } satisfies Parameters<typeof saveSceneDraft>[0];
}
describe("optional Camera metadata and existing storage/export contracts", () => {
  it("rejects malformed optional metadata and wrong-slot ownership at record validation", () => {
    expect(
      validatePhase4Record({
        slots: {
          camera: {
            slot: "camera",
            cameraComposition: { version: 99, techniqueIds: [] },
          },
        },
      }),
    ).toMatch(/Camera composition version/);
    expect(
      validatePhase4Record({
        slots: {
          character: { cameraComposition: { version: 1, techniqueIds: [] } },
        },
      }),
    ).toMatch(/Camera slot/);
    expect(
      validatePhase4Record({ slots: { camera: { slot: "camera" } } }),
    ).toBeUndefined();
  });
  it("rejects malformed draft metadata before any existing store changes", async () => {
    const before = await getAllSnapshot(),
      value = await input();
    value.slots.camera!.cameraComposition = {
      version: 99,
      techniqueIds: [],
    } as never;
    await expect(saveSceneDraft(value)).rejects.toThrow(/Camera/);
    expect(await getAllSnapshot()).toEqual(before);
  });
  it("exports optional versioned Camera controls through Project JSON and Generation JSON", async () => {
    const value = await input(),
      metadata = value.slots.camera!.cameraComposition;
    expect(
      JSON.parse(serializeSceneJson(value)).components.camera.snapshot
        .cameraComposition,
    ).toEqual(metadata);
    expect(
      JSON.parse(serializeGenerationJson(value)).cameraComposition,
    ).toEqual(metadata);
    const legacy = await input(false);
    expect(serializeSceneJson(legacy)).not.toContain("cameraComposition");
    expect(serializeGenerationJson(legacy)).not.toContain("cameraComposition");
  });
  it("freezes composition with saved takes, preserves existing outputs and copies controls to a new draft", async () => {
    const original = await saveSceneFromDraft(
        (await saveSceneDraft(await input(false))).id,
      ),
      originalBytes = JSON.stringify(original);
    const draft = await saveSceneDraft(await input()),
      saved = await saveSceneFromDraft(draft.id),
      copy = await createDraftFromSavedScene(saved.id);
    expect(copy.slots.camera?.cameraComposition).toEqual(
      saved.slots.camera?.cameraComposition,
    );
    expect(saved.slots.camera?.cameraComposition?.version).toBe(1);
    expect(
      JSON.stringify(
        (await getAllSnapshot()).scenes.find((s) => s.id === original.id),
      ),
    ).toBe(originalBytes);
  });
  it("roundtrips new Camera metadata and untouched legacy output strings in a full backup", async () => {
    const legacy = await saveSceneFromDraft(
      (await saveSceneDraft(await input(false))).id,
    );
    const saved = await saveSceneFromDraft(
        (await saveSceneDraft(await input())).id,
      ),
      before = await getAllSnapshot(),
      bytes = await exportFullBackupZip();
    await restoreFullBackupZip(bytes);
    const after = await getAllSnapshot();
    expect(after.drafts).toEqual(before.drafts);
    expect(
      after.scenes.find((s) => s.id === saved.id)?.slots.camera
        ?.cameraComposition,
    ).toEqual(saved.slots.camera?.cameraComposition);
    expect(after.scenes.find((s) => s.id === legacy.id)?.outputs).toEqual(
      legacy.outputs,
    );
  });
  it("rejects unsupported Camera metadata in a backup before replacing any existing records", async () => {
    await saveSceneDraft(await input());
    const before = await getAllSnapshot(),
      files = unzipSync(await exportFullBackupZip()),
      manifest = JSON.parse(strFromU8(files["manifest.json"]));
    manifest.drafts[0].slots.camera.cameraComposition.version = 99;
    files["manifest.json"] = strToU8(JSON.stringify(manifest));
    await expect(restoreFullBackupZip(zipSync(files))).rejects.toThrow(
      /Camera/,
    );
    expect(await getAllSnapshot()).toEqual(before);
  });
  it("retains complete Camera text and metadata in project exports without changing the 128 MiB limit", async () => {
    const saved = await saveSceneFromDraft(
        (await saveSceneDraft(await input())).id,
      ),
      date = new Date().toISOString();
    const collection: Collection = {
      id: "project_synthetic_camera",
      name: "Synthetic Camera film",
      description: "QA only",
      members: [{ type: "scene", id: saved.id, addedAt: date }],
      createdAt: date,
      updatedAt: date,
      project: {
        version: 1,
        revision: 0,
        shots: [
          {
            id: "shot_camera",
            order: 0,
            code: "01",
            title: "Camera test",
            status: "prompt_ready",
            takeSceneIds: [saved.id],
            selectedSceneId: saved.id,
          },
        ],
      },
    };
    const result = await buildProjectExport(
        collection,
        { ...(await getAllSnapshot()), collections: [collection] },
        { includeGenerationJson: true },
      ),
      files = unzipSync(result.bytes),
      entry = result.manifest.shots[0].files!;
    expect(strFromU8(files[entry.prompt])).toBe(saved.outputs.full);
    expect(
      JSON.parse(strFromU8(files[entry.scene])).components.camera.snapshot
        .cameraComposition,
    ).toEqual(saved.slots.camera?.cameraComposition);
    expect(
      JSON.parse(strFromU8(files[entry.generation!])).cameraComposition,
    ).toEqual(saved.slots.camera?.cameraComposition);
    expect(PROJECT_EXPORT_MEDIA_LIMIT).toBe(128 * 1024 * 1024);
  });
});
