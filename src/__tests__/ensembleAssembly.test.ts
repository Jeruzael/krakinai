import { describe, it, expect } from "vitest";
import { assembleScenePrompt } from "../domain/promptAssembler";
import {
  buildSceneDocument,
  formatSceneDocumentText,
  serializeSceneJson,
} from "../domain/sceneDocument";
import {
  buildGenerationDocument,
  serializeGenerationJson,
} from "../domain/generationDocument";
import { formatGenerationText } from "../domain/exportPresets";
import { runScenePreflight } from "../domain/scenePreflight";
import { enableSceneEnsemble, syncEnsemblePrimary } from "../domain/ensemble";
import { resolveEnsembleGenerationIdentities } from "../domain/ensembleDocument";
import { actor, ensembleLegacyDraft } from "./fixtures/ensembleFixture";
function two() {
  const s = enableSceneEnsemble(ensembleLegacyDraft());
  s.ensemble!.participants.push({
    id: "lucas",
    character: actor("lucas", "Lucas"),
    wardrobe: {
      slot: "wardrobe",
      sourceType: "variant",
      sourceId: "lucas-suit",
      sourceRevision: 1,
      sourceTitle: "Lucas suit",
      parentCharacterId: "lucas",
      promptText: "A charcoal groom suit.",
      compactText: "Charcoal suit.",
      mediaLinks: [],
    },
    presence: "on_camera",
    performanceNotes: "Speak with quiet determination.",
  });
  s.ensemble!.dialogueCues = [
    {
      id: "officiant",
      speaker: "Officiant",
      mode: "off_screen",
      line: "Lucas, do you take Aya as your wife?",
    },
    {
      id: "lucas-reply",
      speaker: "Lucas",
      participantId: "lucas",
      mode: "on_camera",
      line: "  I do.\r\n😊  ",
      performanceDirection: { version: 1, styles: ["calm"] },
    },
  ];
  return s;
}
describe("authoritative ensemble documents and output", () => {
  it("keeps three identities/outfits distinct and honors independent performance directions", () => {
    const s = two();
    s.ensemble!.participants.push({
      id: "marco",
      character: actor("marco", "Marco"),
      wardrobe: {
        slot: "wardrobe",
        sourceType: "asset",
        sourceId: "formal",
        sourceRevision: 2,
        sourceTitle: "Best man wardrobe",
        promptText: "A navy best man suit.",
        mediaLinks: [],
      },
      presence: "on_camera",
      performanceNotes: "Wait silently behind the groom.",
    });
    for (const mode of ["full", "structured", "compact"] as const) {
      const text = assembleScenePrompt(s).outputs[mode];
      expect(text).toContain(s.ensemble!.participants[2].character.promptText);
      expect(text).toContain("A navy best man suit.");
      expect(text).toContain("Wait silently behind the groom.");
    }
    expect(buildGenerationDocument(s).participants).toHaveLength(3);
  });
  it("resolves each participant through existing anchor freshness rules", () => {
    const s = two(),
      p = s.ensemble!.participants[1],
      at = "2026-11-01T00:00:00.000Z";
    p.character.identityAnchor = {
      text: "Approved Lucas.",
      approvedText: "Approved Lucas.",
      approvedAt: at,
      approvedMasterIdentityRevision: 1,
    };
    p.generation = {
      identitySource: "approved_anchor",
      anchor: {
        text: "Approved Lucas.",
        approvedAt: at,
        approvedMasterIdentityRevision: 1,
      },
    };
    const n = syncEnsemblePrimary(s);
    expect(resolveEnsembleGenerationIdentities(n).lucas.source).toBe("master");
    expect(
      resolveEnsembleGenerationIdentities(n, undefined, true).lucas,
    ).toEqual({ source: "approved_anchor", description: "Approved Lucas." });
    expect(
      resolveEnsembleGenerationIdentities(n, undefined, true).primary.source,
    ).toBe("master");
    p.character.sourceType = "template";
    expect(
      resolveEnsembleGenerationIdentities(
        syncEnsemblePrimary(s),
        undefined,
        true,
      ).lucas.source,
    ).toBe("master");
  });
  it("validates original stored source bytes as well as ensemble narration", () => {
    const s = enableSceneEnsemble(ensembleLegacyDraft());
    s.ensemble = {
      version: 1,
      participants: [],
      primaryParticipantId: null,
      dialogueCues: [
        {
          id: "narration",
          speaker: "Narrator",
          mode: "voiceover",
          line: "Read this exact plan.",
        },
      ],
    };
    s.shotType = "graphic_motion";
    s.sceneInstructions = "Gently reveal the plan labels.";
    s.sourceMediaLinks = [
      {
        mediaId: "original-plan",
        role: "reference",
        altText: "Original image",
        order: 0,
        mimeType: "image/png",
        filename: "plan.png",
      },
    ];
    const n = syncEnsemblePrimary(s);
    expect(assembleScenePrompt(n).valid).toBe(true);
    const missing = runScenePreflight(n, new Map());
    expect(
      missing.some(
        (f) =>
          f.severity === "blocking" &&
          /Original source file is missing/i.test(f.title) &&
          f.components.includes("references"),
      ),
    ).toBe(true);
    expect(
      missing.filter((f) => ["P001", "P004", "P005"].includes(f.ruleId)),
    ).toEqual([]);
  });
  it("builds explicit v2 documents with separate participants and cues, never duplicate primary components", () => {
    const s = two(),
      d: any = buildSceneDocument(s);
    expect(d.schema).toBe("krakinai.scene-prompt.v2");
    expect(d.participants.map((p: any) => p.id)).toEqual(["primary", "lucas"]);
    expect(d.components.character).toBeNull();
    expect(d.components.wardrobe).toBeNull();
    expect(d.dialogue).toBeNull();
    expect(d.dialogueCues.map((c: any) => [c.id, c.exactLine])).toEqual(
      s.ensemble!.dialogueCues.map((c) => [c.id, c.line]),
    );
    expect(JSON.parse(serializeSceneJson(s))).toEqual(d);
  });
  it.each(["full", "structured", "compact"] as const)(
    "preserves every identity and exact ordered cue once in %s",
    (mode) => {
      const s = two(),
        r = assembleScenePrompt(s);
      expect(r.errors).toEqual([]);
      expect(r.valid).toBe(true);
      const text = r.outputs[mode];
      for (const p of s.ensemble!.participants)
        expect(text.split(p.character.promptText)).toHaveLength(2);
      for (const c of s.ensemble!.dialogueCues)
        expect(text.split(c.line)).toHaveLength(2);
      expect(text.indexOf("Lucas, do you take Aya as your wife?")).toBeLessThan(
        text.indexOf("  I do.\r\n😊  "),
      );
      expect(text).toContain(
        mode === "compact" ? "Charcoal suit." : "A charcoal groom suit.",
      );
      expect(text).toContain("Speak with quiet determination.");
      expect(text).toBe(formatSceneDocumentText(buildSceneDocument(s), mode));
    },
  );
  it("keeps independent identity choices only in generation views and honors approved participant options", () => {
    const s = two();
    const d: any = buildGenerationDocument(s, {
      participantIdentities: {
        lucas: {
          source: "approved_anchor",
          description: "Approved fictional Lucas anchor.",
        },
      },
    } as any);
    expect(d.schema).toBe("krakinai.generation-prompt.v2");
    expect(d.character).toBeNull();
    expect(d.participants.find((p: any) => p.id === "lucas").identity).toEqual({
      source: "approved_anchor",
      description: "Approved fictional Lucas anchor.",
    });
    expect(d.dialogueCues.map((c: any) => c.exactLine)).toEqual(
      s.ensemble!.dialogueCues.map((c) => c.line),
    );
    expect(assembleScenePrompt(s).outputs.full).toContain(
      s.ensemble!.participants[1].character.promptText,
    );
    expect(JSON.parse(serializeGenerationJson(s))).toHaveProperty(
      "participants",
    );
  });
  it.each(["generic_structured", "gemini_omni_flash", "custom"] as const)(
    "keeps all participants and cues in %s export",
    (preset) => {
      const s = two(),
        text = formatGenerationText(s, preset);
      expect(text).toContain(s.ensemble!.participants[1].character.promptText);
      expect(text).toContain("A charcoal groom suit.");
      for (const c of s.ensemble!.dialogueCues) expect(text).toContain(c.line);
      expect(text.indexOf("Lucas, do you take Aya")).toBeLessThan(
        text.indexOf("  I do."),
      );
    },
  );
  it("excludes off-camera visual identities/outfits but retains their explicitly linked voice", () => {
    const s = two();
    s.ensemble!.participants[1].presence = "off_camera";
    s.ensemble!.dialogueCues[1].mode = "voiceover";
    const r = assembleScenePrompt(s);
    expect(r.valid).toBe(true);
    for (const text of Object.values(r.outputs)) {
      expect(text).not.toContain(
        s.ensemble!.participants[1].character.promptText,
      );
      expect(text).not.toContain("A charcoal groom suit.");
      expect(text).toContain(s.ensemble!.dialogueCues[1].line);
    }
    const d: any = buildGenerationDocument(s);
    expect(
      d.participants.find((p: any) => p.id === "lucas").identity,
    ).toBeNull();
  });
  it("blocks invalid cue relationships and surfaces actionable blocking Preflight", () => {
    const s = two();
    s.ensemble!.dialogueCues[1].participantId = "missing";
    const r = assembleScenePrompt(s);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/cue.*participant/i);
    expect(
      runScenePreflight(s).some(
        (f) => f.severity === "blocking" && /participant/i.test(f.title),
      ),
    ).toBe(true);
  });
  it("checks speaker identity against the linked participant rather than always the primary", () => {
    const s = two();
    expect(runScenePreflight(s).filter((f) => f.ruleId === "P005")).toEqual([]);
    s.ensemble!.dialogueCues[1].speaker = "Aya";
    const findings = runScenePreflight(s).filter((f) => f.ruleId === "P005");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      participantId: "lucas",
      cueId: "lucas-reply",
      severity: "review",
    });
  });
  it("captures participant negatives once across frozen saved and reopened inputs", () => {
    const s = two();
    s.ensemble!.participants[0].character.avoidText = "Do not change Aya.";
    s.ensemble!.participants[1].character.avoidText = "Do not change Lucas.";
    s.avoidText = "Avoid invented jewelry.";
    const n = syncEnsemblePrimary(s),
      first = assembleScenePrompt(n);
    expect(first.avoidText).toContain("Do not change Lucas.");
    const saved = {
      ...n,
      references: first.references,
      avoidText: first.avoidText,
      inheritedAvoidPrefix: "Do not change Aya., Do not change Lucas.",
    };
    expect(assembleScenePrompt(saved).avoidText).toBe(first.avoidText);
    const d: any = buildGenerationDocument(saved);
    expect(d.negativeInstructions).toEqual([
      "Do not change Aya.",
      "Do not change Lucas.",
      "Avoid invented jewelry.",
    ]);
  });
  it("rejects visual actors on a graphic source shot without inventing source media", () => {
    const s = two();
    s.shotType = "graphic_motion";
    s.sceneInstructions = "Animate the original.";
    const r = assembleScenePrompt(s);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/visual Character|visual participant/i);
  });
});
