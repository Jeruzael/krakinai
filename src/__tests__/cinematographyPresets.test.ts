import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  CINEMATOGRAPHY_CORE_PRESETS as pack,
  previewCinematographyCorePresets as preview,
} from "../domain/cinematographyPresets";
import { installCinematographyCorePresets as install } from "../storage/cinematographyPresets";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  loadStarterLibrary,
  getAllSnapshot,
  savePromptAsset,
} from "../storage/db";
import type { PromptAsset } from "../types/domain";
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
  await loadStarterLibrary();
});
const asset = (
  title: string,
  promptText: string,
  tags: string[] = [],
): PromptAsset => ({
  id: "existing_camera",
  title,
  promptText,
  tags,
  category: "camera",
  description: "",
  mediaLinks: [],
  favorite: false,
  reviewStatus: "unreviewed",
  provenance: {},
  notes: "",
  revision: 1,
  createdAt: "",
  updatedAt: "",
});
describe("explicit versioned Camera core pack", () => {
  it("skips canonical and concurrent near/far sharpness equivalents under unrelated titles", () => {
    const deep = pack.find((p) => p.title === "Deep focus")!;
    for (const prompt of [
      deep.promptText.split("\n")[0],
      "Keep foreground and background sharp throughout the shot.",
      "Keep both near and far elements sharp.",
    ]) {
      expect(
        preview([asset("My all-depth scene", prompt)]).find(
          (r) => r.preset.title === "Deep focus",
        )?.state,
      ).toBe("existing");
    }
    expect(
      preview([
        asset(
          "Uncertain depth",
          "Foreground and background appear sharp; confirm the intended focus treatment.",
        ),
      ]).find((r) => r.preset.title === "Deep focus")?.state,
    ).not.toBe("available");
    expect(
      preview([
        asset(
          "Do not use this depth treatment",
          `Avoid ${deep.promptText.split("\n")[0]}`,
        ),
      ]).find((r) => r.preset.title === "Deep focus")?.state,
    ).toBe("ambiguous");
  });
  it("previews legacy Camera records with absent optional text without modifying them", () => {
    const legacy = asset("Legacy Camera", "A static viewpoint.");
    delete (legacy as Partial<PromptAsset>).description;
    delete (legacy as Partial<PromptAsset>).notes;
    const before = structuredClone(legacy);
    expect(preview([legacy])).toHaveLength(8);
    expect(legacy).toEqual(before);
  });
  it("offers eight bounded camera-only presets without writing anything during preview", async () => {
    const before = await getAllSnapshot();
    expect(pack).toHaveLength(8);
    expect(new Set(pack.map((p) => p.assetId)).size).toBe(8);
    expect(pack.every((p) => p.assetId.startsWith("asset_cine_core_v1_"))).toBe(
      true,
    );
    expect(preview(before.assets)).toHaveLength(8);
    expect(await getAllSnapshot()).toEqual(before);
  });
  it("finds equivalent positive directions in prompt text and tags even when titles differ", () => {
    const rows = preview([
      asset(
        "My unrelated title",
        "Position the subject using a three-by-three grid.",
      ),
      {
        ...asset("Another custom title", "Use the existing frame."),
        id: "tag_camera",
        tags: ["look room"],
      },
    ]);
    expect(
      rows.find((r) => r.preset.title.includes("Rule of thirds"))?.state,
    ).toBe("existing");
    expect(rows.find((r) => r.preset.title.includes("Look room"))?.state).toBe(
      "existing",
    );
  });
  it("treats negated-only mentions as ambiguous rather than positive coverage or automatic duplicates", () => {
    const rows = preview([
      asset("Do not use deep focus", "Never use deep focus for this shot."),
    ]);
    expect(rows.find((r) => r.preset.title.includes("Deep focus"))?.state).toBe(
      "ambiguous",
    );
  });
  it("does not confuse a rack focus transition with simultaneous deep focus", () => {
    const rows = preview([
      asset(
        "Rack focus",
        "Begin with a sharp foreground and softly defocused background. Pull focus from near to far until the background is sharp.",
      ),
    ]);
    expect(rows.find((r) => r.preset.title.includes("Deep focus"))?.state).toBe(
      "available",
    );
  });
  it("installs add-only in one transaction and is idempotent while preserving all prior records", async () => {
    const before = await getAllSnapshot(),
      selected = pack.map((p) => p.techniqueId),
      first = await install(selected);
    expect(first.added).toHaveLength(8);
    const after = await getAllSnapshot();
    expect(
      after.assets.filter((a) => before.assets.some((b) => b.id === a.id)),
    ).toEqual(before.assets);
    expect({ ...after, assets: before.assets }).toEqual(before);
    expect(
      first.added.every(
        (a) =>
          a.category === "camera" &&
          a.mediaLinks.length === 0 &&
          a.reviewStatus === "unreviewed",
      ),
    ).toBe(true);
    const again = await install(selected);
    expect(again.added).toHaveLength(0);
    expect(again.skipped).toHaveLength(8);
    expect(await getAllSnapshot()).toEqual(after);
  });
  it("installs only explicitly selected available entries", async () => {
    const before = await getAllSnapshot();
    await install(pack.slice(0, 2).map((p) => p.techniqueId));
    expect((await getAllSnapshot()).assets.length).toBe(
      before.assets.length + 2,
    );
  });
  it("rechecks equivalents inserted after preview and never replaces them", async () => {
    const selected = pack.find((p) => p.title.includes("Rule of thirds"))!;
    expect(
      preview([]).find((r) => r.preset.techniqueId === selected.techniqueId)
        ?.state,
    ).toBe("available");
    const existing = await savePromptAsset({
      title: "Camera custom after preview",
      category: "camera",
      promptText: "Use a rule of thirds composition.",
      tags: [],
    });
    const before = await getAllSnapshot(),
      result = await install([selected.techniqueId]);
    expect(result.added).toHaveLength(0);
    expect(result.skipped[0].matchingAssetIds).toContain(existing.id);
    expect(await getAllSnapshot()).toEqual(before);
  });
  it("rolls back all queued additions after an asynchronous IndexedDB failure", async () => {
    const before = await getAllSnapshot(),
      original = IDBObjectStore.prototype.add;
    let firstId = "",
      calls = 0;
    const spy = vi
      .spyOn(IDBObjectStore.prototype, "add")
      .mockImplementation(function (
        this: IDBObjectStore,
        value: PromptAsset,
        key?: IDBValidKey,
      ) {
        if (
          this.name === "assets" &&
          value.id.startsWith("asset_cine_core_v1_")
        ) {
          calls++;
          if (calls === 1) firstId = value.id;
          if (calls === 2)
            return original.call(this, { ...value, id: firstId });
        }
        return key === undefined
          ? original.call(this, value)
          : original.call(this, value, key);
      });
    try {
      await expect(install(pack.map((p) => p.techniqueId))).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(await getAllSnapshot()).toEqual(before);
  });
});
