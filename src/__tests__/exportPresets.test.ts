import { describe, expect, it } from "vitest";
import {
  EXPORT_PRESETS,
  formatGenerationText,
  getProviderNotices,
} from "../domain/exportPresets";
import { legacyDraft } from "./fixtures/legacyScene";

describe("provider export views", () => {
  it("preserves components and exact dialogue without decorative quotes or source mutations", () => {
    const source = structuredClone(legacyDraft);
    source.dialogue = {
      speaker: "Mika",
      line: '“Hello!” I said "yes". 😊',
      mode: "on_camera",
    };
    const before = structuredClone(source);
    for (const preset of [
      "generic_structured",
      "gemini_omni_flash",
      "custom",
    ] as const) {
      const text = formatGenerationText(source, preset);
      expect(text).toContain(source.slots.character!.promptText);
      expect(text).toContain(source.slots.camera!.overrideText);
      expect(text).toContain(source.dialogue.line);
    }
    expect(formatGenerationText(source, "gemini_omni_flash")).toContain(
      `Mika speaks on camera: ${source.dialogue.line}`,
    );
    expect(source).toEqual(before);
  });
  it("keeps voiceover and off-screen speech audio-only", () => {
    for (const mode of ["voiceover", "off_screen"] as const) {
      const text = formatGenerationText(
        {
          ...legacyDraft,
          dialogue: { speaker: "Narrator", line: "Exact line", mode },
        },
        "gemini_omni_flash",
      );
      expect(text).toContain(
        mode === "voiceover"
          ? "Narrator delivers voiceover: Exact line"
          : "Narrator speaks off screen: Exact line",
      );
      expect(text).not.toMatch(/lip.sync|speaks on camera/);
    }
  });
  it("records dated official guidance and unknown general limits without invented contracts", () => {
    const preset = EXPORT_PRESETS.find((p) => p.id === "gemini_omni_flash")!;
    expect(preset.verifiedAt).toBe("2026-10-26");
    expect(preset.sources).toHaveLength(4);
    expect(preset.limits.attachmentCount).toBeNull();
    expect(preset.limits.durationSeconds).toBeNull();
    expect(
      getProviderNotices(legacyDraft, "gemini_omni_flash").join(" "),
    ).toMatch(/not.*request.*contract/i);
    expect(
      formatGenerationText(legacyDraft, "gemini_omni_flash"),
    ).not.toContain("negativePrompt");
  });
});
