import { describe, expect, it } from "vitest";
import {
  getDirectPromptReadiness,
  getSceneOutput,
  isDirectPrompt,
  validateSceneAuthoring,
} from "../domain/directPrompt";
import { runScenePreflight } from "../domain/scenePreflight";

const exact =
  '  # MIDORI\r\n\r\n“Dito tayo, di ba?” 😊 e\u0301\r\n{"negative":"Huwag baguhin."}  ';
const direct = () => ({
  authoringMode: "direct_prompt" as const,
  directPrompt: {
    version: 1 as const,
    text: exact,
    origin: "chatgpt" as const,
  },
  title: "MIDORI",
  slots: {},
  settings: {},
  manualOutputs: {},
  outputs: { full: exact },
});
describe("direct prompt contract", () => {
  it("preserves exact original text and makes derived modes unavailable", () => {
    const scene = direct();
    expect(isDirectPrompt(scene)).toBe(true);
    expect(getSceneOutput(scene, "full")).toBe(exact);
    expect(getSceneOutput(scene, "structured")).toBeUndefined();
    expect(getSceneOutput(scene, "compact")).toBeUndefined();
    expect(validateSceneAuthoring(scene, true)).toBeUndefined();
  });
  it("does not reinterpret legacy recipes", () => {
    const legacy = {
      outputs: { full: "one", structured: "two", compact: "three" },
    };
    expect(isDirectPrompt(legacy)).toBe(false);
    expect(getSceneOutput(legacy, "structured")).toBe("two");
    expect(validateSceneAuthoring(legacy)).toBeUndefined();
  });
  it.each([
    [{ authoringMode: "future" }, /mode/i],
    [
      { authoringMode: "recipe", directPrompt: { version: 1, text: "x" } },
      /recipe/i,
    ],
    [{ ...direct(), directPrompt: { version: 2, text: "x" } }, /version/i],
    [
      {
        ...direct(),
        directPrompt: { version: 1, text: " ".repeat(3) },
        outputs: { full: "   " },
      },
      /nonempty/i,
    ],
    [
      { ...direct(), directPrompt: { version: 1, text: "a".repeat(100001) } },
      /100,000/i,
    ],
    [{ ...direct(), directPrompt: { version: 1, text: "\ud800" } }, /unicode/i],
    [{ ...direct(), outputs: { full: "changed" } }, /exact/i],
    [
      { ...direct(), outputs: { full: exact, compact: "invented" } },
      /unavailable/i,
    ],
    [
      { ...direct(), manualOutputs: { full: { text: "override" } } },
      /override/i,
    ],
    [{ ...direct(), settings: { durationSeconds: 61 } }, /duration/i],
    [{ ...direct(), settings: { aspectRatio: "2:1" } }, /aspect/i],
    [
      {
        ...direct(),
        pendingInputs: [
          {
            version: 1,
            id: "pending",
            kind: "source_image",
            label: "Original",
            mediaId: "invented",
          },
        ],
      },
      /pending/i,
    ],
  ])("rejects invalid metadata without coercion %#", (value, pattern) =>
    expect(validateSceneAuthoring(value, true)).toMatch(pattern),
  );
  it("allows empty unfinished draft content and validates it on final save", () => {
    const record = { ...direct(), directPrompt: { version: 1, text: "" } };
    expect(validateSceneAuthoring(record)).toBeUndefined();
    expect(validateSceneAuthoring(record, true)).toMatch(/nonempty/i);
  });
  it("keeps text saveable with unresolved generation input", () => {
    const record = {
      ...direct(),
      shotType: "graphic_motion" as const,
      sourceMediaLinks: [],
    };
    expect(validateSceneAuthoring(record, true)).toBeUndefined();
    expect(getDirectPromptReadiness(record, new Map()).join(" ")).toMatch(
      /source image/i,
    );
  });
  it("does not apply recipe component requirements to direct Preflight", () => {
    const source = {
      ...direct(),
      shotType: "graphic_motion" as const,
      sceneInstructions: "",
      extraRequiredSlots: [],
    };
    const findings = runScenePreflight(source, new Map());
    expect(findings.some((f) => f.severity === "blocking")).toBe(false);
    expect(findings.some((f) => /source image/i.test(f.title))).toBe(true);
  });
});
