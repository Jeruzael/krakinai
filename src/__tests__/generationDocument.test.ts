import { describe, expect, it } from "vitest";
import {
  buildGenerationDocument,
  serializeGenerationJson,
} from "../domain/generationDocument";
import { serializeSceneJson } from "../domain/sceneDocument";
import type { MediaLink } from "../types/domain";
import { legacyDraft } from "./fixtures/legacyScene";

describe("generation documents", () => {
  it("preserves complete effective text, ordered schema, exact dialogue and canonical project bytes", () => {
    const source = structuredClone(legacyDraft) as typeof legacyDraft & { references?: MediaLink[] };
    source.dialogue = {
      speaker: " Mika ",
      line: '  “Kumusta?”\nI said "hello" 😊  ',
      mode: "on_camera",
    };
    const before = structuredClone(source);
    const project = serializeSceneJson(source);
    const doc = buildGenerationDocument(source);
    expect(Object.keys(doc)).toEqual([
      "schema",
      "scene",
      "character",
      "wardrobe",
      "environment",
      "action",
      "camera",
      "lighting",
      "style",
      "dialogue",
      "negativeInstructions",
      "references",
    ]);
    expect(doc.character!.description).toBe(source.slots.character!.promptText);
    expect(doc.camera).toBe(source.slots.camera!.overrideText);
    expect(doc.dialogue!.exactLine).toBe(source.dialogue.line);
    expect(JSON.parse(serializeGenerationJson(source))).toEqual(doc);
    expect(source).toEqual(before);
    expect(serializeSceneJson(source)).toBe(project);
    expect(serializeGenerationJson(source)).not.toMatch(
      /compactPrompt|sourceRevision|snapshot/,
    );
  });
  it("uses explicit resolved identity once and explicit empty references", () => {
    const doc = buildGenerationDocument(legacyDraft, {
      identity: {
        source: "approved_anchor",
        description: "Approved exact identity",
      },
      references: [],
    });
    expect(doc.character).toEqual({
      name: legacyDraft.slots.character!.sourceTitle,
      identitySource: "approved_anchor",
      description: "Approved exact identity",
    });
    expect(doc.references).toEqual([]);
    expect(JSON.stringify(doc).split("Approved exact identity")).toHaveLength(
      2,
    );
  });
  it("deduplicates whole fields and recognizes only exact saved joined prefixes", () => {
    const source = structuredClone(legacyDraft) as typeof legacyDraft & { references?: MediaLink[] };
    for (const snap of Object.values(source.slots)) delete snap!.avoidText;
    source.slots.character!.avoidText = "  No café, no hats.  ";
    source.slots.camera!.avoidText = "no cafe\u0301, NO hats.";
    source.avoidText = "Other, meaningful phrase";
    expect(buildGenerationDocument(source).negativeInstructions).toEqual([
      "  No café, no hats.  ",
      "Other, meaningful phrase",
    ]);
    source.references = [];
    source.avoidText =
      "  No café, no hats.  , no cafe\u0301, NO hats., Saved remainder, intact";
    expect(buildGenerationDocument(source).negativeInstructions).toEqual([
      "  No café, no hats.  ",
      "Saved remainder, intact",
    ]);
    source.avoidText = "Unrecognized combined text, intact";
    expect(buildGenerationDocument(source).negativeInstructions.at(-1)).toBe(
      source.avoidText,
    );
  });
  it("represents missing fields and strips references down to safe metadata while retaining associations", () => {
    const source = {
      title: "Empty",
      slots: {},
      sceneInstructions: "",
      settings: {},
    };
    const doc = buildGenerationDocument(source, {
      references: [
        {
          associationId: "a",
          mediaId: "m",
          filename: "C:\\private\\file.png",
          mimeType: "image/png",
          role: "reference",
          altText: "Exact description",
          order: 0,
        },
      ],
    });
    expect(doc.character).toBeNull();
    expect(doc.camera).toBeNull();
    expect(doc.scene.durationSeconds).toBeNull();
    expect(doc.references[0].filename).toBe("file.png");
    expect(doc.references[0].associationId).toBe("a");
    expect(doc.dialogue).toBeNull();
  });
});
