import { describe, it, expect } from "vitest";
import { searchCinematography } from "../domain/cinematographyRegistry";
import type { CinematographyFamilyId } from "../domain/cinematographyRegistry";
import {
  composeCameraDirections,
  applyCameraComposition,
  resetCameraComposition,
  rebaseCameraComposition,
  clearCameraComposition,
  validateCameraComposition,
  getCameraCompositionWarnings,
} from "../domain/cameraComposition";
import type { ComponentSnapshot } from "../types/domain";
import type { CameraCompositionChoice } from "../types/cinematography";
const id = (query: string, family?: CinematographyFamilyId) => {
  const result = searchCinematography(query, { family })[0];
  if (!result) throw new Error("Test technique missing: " + query);
  return result.id;
};
const choice = (...ids: string[]): CameraCompositionChoice => ({
  version: 1,
  techniqueIds: ids,
});
const snapshot: ComponentSnapshot = {
  slot: "camera",
  sourceType: "asset",
  sourceId: "camera_existing",
  sourceTitle: "Existing reusable preset",
  sourceRevision: 3,
  promptText: "Original reusable camera text.",
  compactText: "Original compact.",
  overrideText: "  My exact scene override.\nSecond line.  ",
  overrideCompactText: " My compact override. ",
  mediaLinks: [
    {
      mediaId: "image_existing",
      role: "reference",
      altText: "Keep this association",
      order: 0,
    },
  ],
};
describe("scene-only camera composition", () => {
  it("restores a manually authored built-in Camera after composing again and resetting", () => {
    const first = applyCameraComposition(undefined, choice(id("MCU")))!;
    const manual = clearCameraComposition({
      ...first,
      overrideText: "  My authored scene Camera.\nKeep exact spacing.  ",
      overrideCompactText: " My short Camera. ",
    });
    const composed = applyCameraComposition(
      manual,
      choice(id("Rule of thirds")),
    )!;
    expect(resetCameraComposition(composed)).toEqual(manual);
    expect(
      resetCameraComposition(
        applyCameraComposition(composed, choice(id("Centered composition")))!,
      ),
    ).toEqual(manual);
  });
  it("preserves primary/secondary movement roles and sequential execution order", () => {
    const dolly = id("Dolly in", "E"),
      hold = id("Locked-off / static camera", "E");
    const dollyThenHold = composeCameraDirections({
      ...choice(dolly, hold),
      arrangement: "sequence",
    });
    const holdThenDolly = composeCameraDirections({
      ...choice(hold, dolly),
      arrangement: "sequence",
    });
    expect(dollyThenHold).toContain("Primary movement — Dolly in / out");
    expect(dollyThenHold).toContain(
      "Secondary movement — Locked-off / static camera",
    );
    expect(dollyThenHold.indexOf("Primary movement")).toBeLessThan(
      dollyThenHold.indexOf("Secondary movement"),
    );
    expect(dollyThenHold).not.toBe(holdThenDolly);
  });
  it("explains lens alternatives without rejecting valid prime anamorphic lenses or separate phases", () => {
    const prime = id("Prime lens", "G"),
      zoom = id("Zoom lens", "G"),
      anamorphic = id("Anamorphic lens", "G");
    expect(
      getCameraCompositionWarnings(choice(prime, zoom)).map((w) => w.id),
    ).toContain("camera-lens-equipment");
    expect(getCameraCompositionWarnings(choice(prime, anamorphic))).toEqual([]);
    expect(
      getCameraCompositionWarnings({
        ...choice(prime, zoom),
        arrangement: "sequence",
      }),
    ).toEqual([]);
  });
  it("distinguishes focal-length changes from physical dolly and accepts a planned optical zoom", () => {
    const parameters = { focalLengthMm: 24, endingFocalLengthMm: 50 };
    expect(
      getCameraCompositionWarnings({
        ...choice(id("Dolly in", "E")),
        parameters,
      }).map((w) => w.id),
    ).toContain("camera-focal-endpoints");
    expect(
      getCameraCompositionWarnings({
        ...choice(id("Optical zoom", "E")),
        parameters,
      }),
    ).toEqual([]);
    expect(
      validateCameraComposition({
        ...choice(id("Arc shot", "E")),
        parameters: { arcRadiusMetres: 0 },
      }),
    ).toMatch(/Arc radius/);
  });
  it("explains confused pan and zoom wording but skips negated or quoted examples", () => {
    const selected = choice(id("Rule of thirds"));
    expect(
      getCameraCompositionWarnings(selected, {
        sceneInstructions: "Pan the camera sideways.",
      }).map((w) => w.id),
    ).toContain("camera-pan-truck");
    expect(
      getCameraCompositionWarnings(selected, {
        sceneInstructions: "Digital zoom creates physical parallax.",
      }).map((w) => w.id),
    ).toContain("camera-zoom-dolly");
    for (const sceneInstructions of [
      "Do not pan the camera sideways.",
      "Optical zoom does not move the camera or create physical parallax.",
      "Avoid digital zoom that creates physical parallax.",
      'Example: "Digital zoom creates physical parallax". Keep the source fixed.',
    ])
      expect(
        getCameraCompositionWarnings(selected, { sceneInstructions }),
      ).toEqual([]);
  });
  it("keeps unspecified controls inert and does not invent a Camera asset", () => {
    expect(composeCameraDirections(choice())).toBe("");
    expect(applyCameraComposition(undefined, choice())).toBeUndefined();
  });
  it("renders independent choices in a deterministic order regardless of selection order", () => {
    const a = choice(
      id("MCU"),
      id("Eye-level", "B"),
      id("Rule of thirds"),
      id("Dolly in", "E"),
    );
    expect(composeCameraDirections(a)).toBe(
      composeCameraDirections({
        ...a,
        techniqueIds: [...a.techniqueIds].reverse(),
      }),
    );
    expect(composeCameraDirections(a)).toContain("Medium close-up");
  });
  it("preserves the original preset, manual baseline, media and source identity, and resets exactly", () => {
    const before = structuredClone(snapshot),
      applied = applyCameraComposition(snapshot, choice(id("Rule of thirds")))!;
    expect(applied.promptText).toBe(snapshot.promptText);
    expect(applied.sourceId).toBe(snapshot.sourceId);
    expect(applied.mediaLinks).toEqual(snapshot.mediaLinks);
    expect(applied.overrideText).toContain(snapshot.overrideText);
    expect(applied.cameraComposition?.version).toBe(1);
    expect(resetCameraComposition(applied)).toEqual(snapshot);
    expect(snapshot).toEqual(before);
  });
  it("is idempotent and replaces prior composition instead of duplicating appended text", () => {
    const picks = choice(id("Rule of thirds")),
      once = applyCameraComposition(snapshot, picks)!;
    expect(applyCameraComposition(once, picks)).toEqual(once);
    const changed = applyCameraComposition(
      once,
      choice(id("Centered composition")),
    )!;
    expect(changed.overrideText).not.toContain("three-by-three");
    expect(resetCameraComposition(changed)).toEqual(snapshot);
  });
  it("can explicitly exclude contradictory base text while retaining the preset and exact reset baseline", () => {
    const applied = applyCameraComposition(snapshot, {
      ...choice(id("Dolly in", "E")),
      includeBaseText: false,
    })!;
    expect(applied.overrideText).not.toContain(snapshot.overrideText);
    expect(applied.promptText).toBe(snapshot.promptText);
    expect(resetCameraComposition(applied)).toEqual(snapshot);
  });
  it("uses an explicit built-in scene blueprint when no preset exists and removes it on reset", () => {
    const applied = applyCameraComposition(
      undefined,
      choice(id("2D zoom", "O")),
    )!;
    expect(applied.sourceType).toBe("template");
    expect(applied.sourceId).toBe("builtin:camera-composition:v1");
    expect(applied.cameraComposition?.sceneOnly).toBe(true);
    expect(resetCameraComposition(applied)).toBeUndefined();
  });
  it("rebases controls onto a newly selected Camera preset without retaining old base text", () => {
    const prior = applyCameraComposition(
      snapshot,
      choice(id("Rule of thirds")),
    )!;
    const next = {
      ...snapshot,
      sourceId: "camera_new",
      promptText: "A new reusable base.",
      overrideText: undefined,
      overrideCompactText: undefined,
    };
    const result = rebaseCameraComposition(prior, next);
    expect(result.overrideText).toContain("A new reusable base.");
    expect(result.overrideText).not.toContain("My exact scene override");
    expect(result.sourceId).toBe("camera_new");
    expect(resetCameraComposition(result)).toEqual(next);
  });
  it("exits structured composition when Camera text is authored manually, without changing the text", () => {
    const applied = applyCameraComposition(
      snapshot,
      choice(id("Rule of thirds")),
    )!;
    const manual = { ...applied, overrideText: "Exact new manual text" };
    expect(clearCameraComposition(manual).cameraComposition).toBeUndefined();
    expect(clearCameraComposition(manual).overrideText).toBe(
      "Exact new manual text",
    );
  });
  it("validates optional versioned metadata, ownership, bounds and known canonical IDs", () => {
    expect(validateCameraComposition(undefined)).toBeUndefined();
    expect(validateCameraComposition(choice(id("MCU")))).toBeUndefined();
    for (const bad of [
      { version: 2, techniqueIds: [] },
      { version: 1, techniqueIds: ["unknown"] },
      choice(id("Three-point lighting")),
      choice(id("Direction", "F")),
      {
        version: 1,
        techniqueIds: [],
        parameters: { travelDistanceMetres: -1 },
      },
      {
        version: 1,
        techniqueIds: [],
        parameters: { movementSeconds: Infinity },
      },
      { version: 1, techniqueIds: [], parameters: { invented: "x" } },
    ])
      expect(validateCameraComposition(bad)).toBeTypeOf("string");
    expect(
      validateCameraComposition(choice(id("MCU")), "character"),
    ).toBeTypeOf("string");
  });
  it("warns about simultaneous static/travel, but allows static camera with rack focus or optical zoom", () => {
    const staticId = id("Locked-off / static camera", "E"),
      travel = id("Dolly in", "E"),
      focus = id("focus pull", "H"),
      zoom = id("Optical zoom in", "E");
    expect(
      getCameraCompositionWarnings(choice(staticId, travel)).some(
        (w) => w.id === "camera-static-travel",
      ),
    ).toBe(true);
    expect(getCameraCompositionWarnings(choice(staticId, focus))).toEqual([]);
    expect(getCameraCompositionWarnings(choice(staticId, zoom))).toEqual([]);
  });
  it("permits deliberate dolly zoom, valid compound moves and staged transitions", () => {
    expect(
      getCameraCompositionWarnings(choice(id("Vertigo effect", "E"))),
    ).toEqual([]);
    expect(
      getCameraCompositionWarnings(choice(id("Combined dolly and pan", "E"))),
    ).toEqual([]);
    expect(
      getCameraCompositionWarnings({
        ...choice(id("Locked-off / static camera", "E"), id("Dolly in", "E")),
        arrangement: "sequence",
      }),
    ).toEqual([]);
  });
  it("distinguishes fixed focus from transitions and keeps recommendations advisory", () => {
    const warnings = getCameraCompositionWarnings(
      choice(id("Fixed focus", "H"), id("focus pull", "H")),
    );
    expect(warnings.some((w) => w.id === "camera-focus-conflict")).toBe(true);
    expect(warnings.map((w) => w.severity)).not.toContain("blocking");
  });
  it("warns about actual impossible timing and contradictory fixed framing endpoints", () => {
    const travel = {
      ...choice(id("Dolly in", "E")),
      parameters: {
        travelDistanceMetres: 2,
        movementSeconds: 0,
        initialHoldSeconds: 4,
        finalHoldSeconds: 4,
      },
    };
    const warnings = getCameraCompositionWarnings(travel, {
      durationSeconds: 6,
    });
    expect(warnings.some((w) => w.id === "camera-zero-travel-time")).toBe(true);
    expect(warnings.some((w) => w.id === "camera-timing-overflow")).toBe(true);
    expect(
      getCameraCompositionWarnings({
        ...choice(id("Locked-off / static camera", "E")),
        parameters: { startFraming: "wide", endFraming: "close-up" },
      }).some((w) => w.id === "camera-framing-endpoints"),
    ).toBe(true);
  });
  it("protects graphics/footage from inappropriate physical requirements without blocking unfinished planning", () => {
    const physical = getCameraCompositionWarnings(choice(id("Dolly in", "E")), {
      shotType: "graphic_motion",
    });
    expect(physical.some((w) => w.id === "camera-source-applicability")).toBe(
      true,
    );
    expect(
      physical.every(
        (w) => w.severity === "review" || w.severity === "information",
      ),
    ).toBe(true);
    expect(
      getCameraCompositionWarnings(choice(id("2D zoom", "O")), {
        shotType: "graphic_motion",
      }),
    ).toEqual([]);
  });
  it("detects explicit contradictory shot instructions but does not warn on negations or an illustrative quote", () => {
    const selected = choice(id("Dolly in", "E"));
    expect(
      getCameraCompositionWarnings(selected, {
        sceneInstructions: "Keep the camera locked off.",
      }).some((w) => w.id === "camera-instruction-conflict"),
    ).toBe(true);
    expect(
      getCameraCompositionWarnings(selected, {
        sceneInstructions: "Do not keep the camera locked off. Move forward.",
      }),
    ).toEqual([]);
    expect(
      getCameraCompositionWarnings(selected, {
        sceneInstructions:
          'Example: "keep the camera locked off". Move forward.',
      }),
    ).toEqual([]);
  });
});
