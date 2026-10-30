import { describe, expect, it } from "vitest";
import {
  compareSceneVersions,
  getRevisionFamily,
  getRevisionHead,
  getRevisionLabel,
  validateSceneRevisionGraph,
} from "../domain/sceneRevisions";
import type { SavedScene } from "../types/domain";
const scene = (id: string, text: string, extra: object = {}): SavedScene => ({
  id,
  title: id,
  authoringMode: "direct_prompt",
  directPrompt: { version: 1, text },
  slots: {},
  extraRequiredSlots: [],
  sceneInstructions: "",
  settings: {},
  outputs: { full: text },
  manualOutputs: {},
  references: [],
  resultMediaLinks: [],
  reviewNotes: "",
  reviewStatus: "unreviewed",
  revision: 1,
  createdAt: "2026-10-30T00:00:00.000Z",
  updatedAt: "2026-10-30T00:00:00.000Z",
  ...extra,
});
describe("scene versions", () => {
  it("keeps alternate-take identity visible alongside its version number", () => {
    const take = scene("take", "text", {
      separateTakeOfSceneId: "original",
      sceneRevision: {
        version: 1,
        rootSceneId: "take",
        sequence: 1,
        createdAt: "2026-10-30T00:00:00Z",
      },
    });
    expect(getRevisionLabel(take)).toBe("Alternate take · Version 1");
  });
  it("does not adopt legacy branches into a managed root", () => {
    const legacy = scene("old", "first"),
      branch = scene("branch", "other", { versionOfSceneId: "old" }),
      v2 = scene("new", "second", {
        sceneRevision: {
          version: 1,
          rootSceneId: "old",
          parentSceneId: "old",
          sequence: 2,
          createdAt: legacy.createdAt,
        },
      });
    expect(
      getRevisionFamily(v2, [legacy, branch, v2]).map((s) => s.id),
    ).toEqual(["old", "new"]);
    expect(getRevisionHead(legacy, [legacy, branch, v2]).id).toBe("new");
    expect(getRevisionLabel(v2)).toBe("Version 2");
    expect(branch.versionOfSceneId).toBe("old");
  });
  it("shows exact full text and explicit metadata changes, without guessing identity", () => {
    const before = scene("one", "  Static\n\nExact 😊  "),
      after = scene("two", "  Slow push\n\nExact 😊  ", {
        settings: { aspectRatio: "9:16", durationSeconds: 8 },
        shotType: "property_environment",
      });
    const diff = compareSceneVersions(before, after);
    expect(diff.beforeText).toBe(before.outputs.full);
    expect(diff.afterText).toBe(after.outputs.full);
    expect(
      diff.lines.some((l) => l.kind === "removed" && l.text.includes("Static")),
    ).toBe(true);
    expect(
      diff.lines.some(
        (l) => l.kind === "added" && l.text.includes("Slow push"),
      ),
    ).toBe(true);
    expect(diff.changes.join(" ")).toMatch(
      /aspect ratio.*duration.*Shot Type/i,
    );
  });
  it("bounds highlighting while keeping complete large originals", () => {
    const before = scene("one", "x\n".repeat(4000)),
      after = scene("two", "y\n".repeat(4000));
    const diff = compareSceneVersions(before, after);
    expect(diff.limited).toBe(true);
    expect(diff.beforeText).toBe(before.outputs.full);
    expect(diff.afterText).toBe(after.outputs.full);
  });
  it("rejects corrupted managed roots, sequence collisions and cycles while retaining legacy branches", () => {
    const root = scene("root", "one", {
        sceneRevision: {
          version: 1,
          rootSceneId: "root",
          sequence: 1,
          createdAt: "2026-10-30T00:00:00Z",
        },
      }),
      second = scene("second", "two", {
        sceneRevision: {
          version: 1,
          rootSceneId: "root",
          parentSceneId: "root",
          sequence: 2,
          createdAt: root.createdAt,
        },
      }),
      duplicate = scene("duplicate", "three", {
        sceneRevision: { ...second.sceneRevision },
      });
    expect(validateSceneRevisionGraph([root, second])).toBeUndefined();
    expect(validateSceneRevisionGraph([root, second, duplicate])).toMatch(
      /sequence|branch/i,
    );
    expect(
      validateSceneRevisionGraph([
        {
          ...root,
          sceneRevision: { ...root.sceneRevision!, rootSceneId: "unrelated" },
        },
      ]),
    ).toMatch(/root/i);
    expect(
      validateSceneRevisionGraph([
        scene("legacy-a", "x"),
        scene("legacy-b", "x", { versionOfSceneId: "legacy-a" }),
        scene("legacy-c", "x", { versionOfSceneId: "legacy-a" }),
      ]),
    ).toBeUndefined();
  });
});
