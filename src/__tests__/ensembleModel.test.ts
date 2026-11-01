import { describe, it, expect } from "vitest";
import {
  enableSceneEnsemble,
  syncEnsemblePrimary,
  getVisualParticipants,
} from "../domain/ensemble";
import { validateSceneEnsemble } from "../domain/ensembleValidation";
import { actor, ensembleLegacyDraft } from "./fixtures/ensembleFixture";
const enabled = () => enableSceneEnsemble(ensembleLegacyDraft());
describe("ensemble opt-in and frozen projections", () => {
  it("does not migrate or repair a legacy source during validation", () => {
    const s = ensembleLegacyDraft(),
      before = structuredClone(s);
    expect(validateSceneEnsemble(s)).toEqual([]);
    expect(s).toEqual(before);
    expect(s).not.toHaveProperty("ensemble");
  });
  it("seeds the exact primary and legacy dialogue once without mutating the original", () => {
    const s = ensembleLegacyDraft(),
      before = structuredClone(s),
      n = enableSceneEnsemble(s);
    expect(n).toMatchObject({
      ensemble: { version: 1, primaryParticipantId: "primary" },
    });
    expect(n.ensemble!.participants[0].character).toEqual(s.slots.character);
    expect(n.ensemble!.participants[0].wardrobe).toEqual(s.slots.wardrobe);
    expect(n.ensemble!.dialogueCues[0]).toEqual({
      ...s.dialogue,
      id: "legacy-dialogue",
      participantId: "primary",
    });
    expect(n.dialogue).toBeUndefined();
    expect(enableSceneEnsemble(n)).toEqual(n);
    expect(s).toEqual(before);
    expect(validateSceneEnsemble(n)).toEqual([]);
  });
  it("keeps an unlinked off-camera officiant distinct from the on-camera exact reply", () => {
    const s = enabled();
    s.ensemble!.dialogueCues = [
      {
        id: "officiant",
        speaker: "Officiant",
        line: "Lucas, do you take Aya as your wife?",
        mode: "off_screen",
      },
      {
        id: "reply",
        speaker: "Lucas",
        line: "I do.",
        mode: "on_camera",
        participantId: "lucas",
      },
    ];
    s.ensemble!.participants.push({
      id: "lucas",
      character: actor("lucas", "Lucas"),
      presence: "on_camera",
    });
    expect(validateSceneEnsemble(s)).toEqual([]);
    expect(s.ensemble!.participants.map((p) => p.id)).toEqual([
      "primary",
      "lucas",
    ]);
    expect(s.ensemble!.dialogueCues.map((c) => c.line)).toEqual([
      "Lucas, do you take Aya as your wife?",
      "I do.",
    ]);
  });
  it("preserves a frozen legacy template identity and wardrobe without invented assets", () => {
    const s = ensembleLegacyDraft();
    s.slots.character = {
      ...actor(),
      sourceType: "template",
      sourceId: "real-template",
    };
    s.slots.wardrobe = {
      ...s.slots.wardrobe!,
      sourceType: "template",
      sourceId: "real-template",
      parentCharacterId: undefined,
    };
    const n = enableSceneEnsemble(s);
    expect(n.ensemble!.participants[0].character).toEqual(s.slots.character);
    expect(n.ensemble!.participants[0].wardrobe).toEqual(s.slots.wardrobe);
    expect(validateSceneEnsemble(n)).toEqual([]);
  });
  it("synchronizes a chosen primary without changing the frozen other participant", () => {
    const s = enabled(),
      old = structuredClone(s.ensemble!.participants[0]);
    s.ensemble!.participants.push({
      id: "lucas",
      character: actor("lucas", "Lucas"),
      presence: "on_camera",
    });
    s.ensemble!.primaryParticipantId = "lucas";
    const n = syncEnsemblePrimary(s);
    expect(n.slots.character).toEqual(actor("lucas", "Lucas"));
    expect(n.slots.wardrobe).toBeUndefined();
    expect(n.ensemble!.participants[0]).toEqual(old);
    expect(s.slots.character).not.toEqual(n.slots.character);
    expect(validateSceneEnsemble(n)).toEqual([]);
  });
  it("validates mismatched stored mirrors without repairing the record", () => {
    const s = enabled();
    s.slots.character = { ...actor(), promptText: "Changed independently." };
    const before = structuredClone(s);
    expect(validateSceneEnsemble(s).join(" ")).toMatch(/primary.*mirror/i);
    expect(s).toEqual(before);
  });
  it("allows off-camera narration without a visual identity on source shots", () => {
    const s = enabled();
    s.shotType = "graphic_motion";
    s.ensemble!.participants = [];
    s.ensemble!.primaryParticipantId = null;
    s.ensemble!.dialogueCues = [
      {
        id: "narration",
        speaker: "Narrator",
        line: "Welcome.",
        mode: "voiceover",
      },
    ];
    const n = syncEnsemblePrimary(s);
    expect(getVisualParticipants(n)).toEqual([]);
    expect(n.slots.character).toBeUndefined();
    expect(validateSceneEnsemble(n)).toEqual([]);
  });
  it("does not link a legacy voiceover to an on-camera identity automatically", () => {
    const s = ensembleLegacyDraft();
    s.dialogue!.mode = "voiceover";
    expect(
      enableSceneEnsemble(s).ensemble!.dialogueCues[0].participantId,
    ).toBeUndefined();
  });
  it("does not discard an existing unassigned wardrobe when enabling narration-only participants", () => {
    const s = ensembleLegacyDraft();
    delete s.slots.character;
    s.shotType = "property_environment";
    s.dialogue!.mode = "voiceover";
    const before = structuredClone(s);
    expect(() => enableSceneEnsemble(s)).toThrow(
      /wardrobe.*assign|wardrobe.*clear/i,
    );
    expect(s).toEqual(before);
  });
  it("preserves an incomplete cue in drafts but blocks assembly until its speaker and exact line are entered", () => {
    const s = enabled();
    s.ensemble!.dialogueCues[0].speaker = "";
    s.ensemble!.dialogueCues[0].line = "";
    expect(validateSceneEnsemble(s)).toEqual([]);
    expect(validateSceneEnsemble(s, { forAssembly: true }).join(" ")).toMatch(
      /speaker|line/i,
    );
  });
});
describe("ensemble validation at new field and relationship boundaries", () => {
  it.each([8, 9])("bounds participant count at %i", (count) => {
    const s = enabled();
    s.ensemble!.participants = Array.from({ length: count }, (_, i) => ({
      id: i ? "p" + i : "primary",
      character: actor("actor" + i, "Person" + i),
      presence: "on_camera" as const,
    }));
    const n = syncEnsemblePrimary(s);
    expect(validateSceneEnsemble(n).length === 0).toBe(count === 8);
  });
  it.each([32, 33])("bounds cue count at %i", (count) => {
    const s = enabled();
    s.ensemble!.dialogueCues = Array.from({ length: count }, (_, i) => ({
      id: "cue" + i,
      speaker: "Aya",
      line: "Line" + i,
      mode: "on_camera" as const,
      participantId: "primary",
    }));
    expect(validateSceneEnsemble(s).length === 0).toBe(count === 32);
  });
  it.each([
    "duplicateParticipant",
    "duplicateCharacter",
    "duplicateCue",
    "unknownSpeaker",
    "wrongParent",
    "templateParent",
    "dualDialogue",
    "identityOverride",
    "rawVersion",
    "badPrimary",
    "sourceVisual",
    "nonvisualPrimary",
    "badTiming",
    "unknownField",
    "invalidPerformance",
    "longLine",
    "unsafeId",
  ])("rejects %s without repairing", (kind) => {
    const s = enabled(),
      e = s.ensemble!,
      p = e.participants[0];
    switch (kind) {
      case "duplicateParticipant":
        e.participants.push(structuredClone(p));
        break;
      case "duplicateCharacter":
        e.participants.push({ ...structuredClone(p), id: "other" });
        break;
      case "duplicateCue":
        e.dialogueCues.push(structuredClone(e.dialogueCues[0]));
        break;
      case "unknownSpeaker":
        e.dialogueCues[0].participantId = "missing";
        break;
      case "wrongParent":
        p.wardrobe!.parentCharacterId = "someone-else";
        s.slots.wardrobe = structuredClone(p.wardrobe);
        break;
      case "templateParent":
        p.character = { ...p.character, sourceType: "template" };
        s.slots.character = structuredClone(p.character);
        break;
      case "dualDialogue":
        s.dialogue = { speaker: "Aya", line: "Duplicate." };
        break;
      case "identityOverride":
        p.character.overrideText = "Different identity";
        s.slots.character = structuredClone(p.character);
        break;
      case "rawVersion":
        (e as any).version = 2;
        break;
      case "badPrimary":
        e.primaryParticipantId = "missing";
        break;
      case "sourceVisual":
        s.shotType = "graphic_motion";
        break;
      case "nonvisualPrimary":
        p.presence = "off_camera";
        break;
      case "badTiming":
        e.dialogueCues[0].timing = { startSeconds: 5, endSeconds: 9 };
        break;
      case "unknownField":
        (p as any).approved = true;
        break;
      case "invalidPerformance":
        (e.dialogueCues[0].performanceDirection as any) = { version: 99 };
        break;
      case "longLine":
        e.dialogueCues[0].line = "x".repeat(4001);
        break;
      case "unsafeId":
        p.id = "__proto__";
        break;
    }
    const before = structuredClone(s);
    expect(validateSceneEnsemble(s).length).toBeGreaterThan(0);
    expect(s).toEqual(before);
  });
  it("rejects ensemble metadata on Direct Prompt authoring", () => {
    const s: any = enabled();
    s.authoringMode = "direct_prompt";
    s.directPrompt = { version: 1, text: "Original" };
    expect(validateSceneEnsemble(s).join(" ")).toMatch(/Direct Prompt/i);
  });
});
