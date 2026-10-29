import { describe, it, expect } from "vitest";
import {
  CINEMATOGRAPHY_FAMILIES as families,
  CINEMATOGRAPHY_TECHNIQUES as techniques,
  searchCinematography,
  getCinematographyTechnique,
  normalizeTechniqueSearch,
} from "../domain/cinematographyRegistry";
describe("cinematography registry and search", () => {
  it("covers all 15 requested families and 338 technique/control/planning coverage items", () => {
    expect(families).toHaveLength(15);
    expect(techniques).toHaveLength(338);
    expect(
      Object.fromEntries(
        families.map((f) => [
          f.id,
          techniques.filter((t) => t.family === f.id).length,
        ]),
      ),
    ).toEqual({
      A: 13,
      B: 21,
      C: 24,
      D: 30,
      E: 47,
      F: 20,
      G: 25,
      H: 19,
      I: 22,
      J: 22,
      K: 25,
      L: 18,
      M: 19,
      N: 21,
      O: 12,
    });
  });
  it("has stable unique IDs, globally unambiguous aliases and meaningful explanations", () => {
    expect(techniques.length).toBeGreaterThan(0);
    const ids = new Set<string>(),
      aliases = new Map<string, string>();
    for (const t of techniques) {
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
      expect(getCinematographyTechnique(t.id)).toBe(t);
      expect(t.description.length).toBeGreaterThan(25);
      expect(t.guidance.length).toBeGreaterThan(15);
      expect(t.shotTypes.length).toBeGreaterThan(0);
      for (const alias of [t.name, ...t.aliases]) {
        const key = normalizeTechniqueSearch(alias);
        expect(key).not.toBe("");
        expect(aliases.has(key), `duplicate alias ${alias}`).toBe(false);
        aliases.set(key, t.id);
        expect(
          searchCinematography(alias).some((found) => found.id === t.id),
        ).toBe(true);
      }
    }
  });
  it("finds common aliases without conflating physical travel, focus and rigs", () => {
    expect(searchCinematography("MCU")[0]?.family).toBe("A");
    expect(searchCinematography("Vertigo effect")[0]?.name).toMatch(
      /Dolly zoom/i,
    );
    expect(searchCinematography("focus pull")[0]?.family).toBe("H");
    expect(searchCinematography("OTS")[0]?.family).toBe("C");
    expect(
      searchCinematography("Steadicam", { family: "J" })[0]?.dimension,
    ).toBe("rig");
    expect(searchCinematography("rack focus", { family: "E" })).toEqual([]);
  });
  it("filters source-based recommendations and preserves cross-category ownership", () => {
    expect(
      searchCinematography("", { family: "O", shotType: "graphic_motion" }),
    ).toHaveLength(12);
    expect(
      searchCinematography("Dolly in", {
        family: "E",
        shotType: "graphic_motion",
      }),
    ).toEqual([]);
    expect(searchCinematography("three point lighting")[0]?.owner).toBe(
      "lighting",
    );
    expect(searchCinematography("180 degree rule")[0]?.owner).toBe(
      "storyboard",
    );
    expect(
      searchCinematography("", { propertyRecommended: true }).some(
        (t) => t.family === "N",
      ),
    ).toBe(true);
    expect(
      techniques
        .filter((t) => t.family === "F")
        .every((t) => t.kind === "parameter" && !t.dimension),
    ).toBe(true);
  });
  it("keeps physical height, viewing angle, optical focus and post-production distinct", () => {
    expect(searchCinematography("Shoulder-level")[0]?.dimension).toBe("height");
    expect(searchCinematography("Low angle")[0]?.dimension).toBe("angle");
    expect(searchCinematography("Macro focus")[0]?.dimension).toBe("focus");
    expect(searchCinematography("Digital crop")[0]?.method).toBe("editing");
    expect(searchCinematography("360 degree camera rig")[0]?.dimension).toBe(
      "rig",
    );
    expect(searchCinematography("Full 360-degree orbit")[0]?.dimension).toBe(
      "movement",
    );
  });
});
