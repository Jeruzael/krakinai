import { describe, it, expect } from "vitest";
import v1 from "../../docs/change-set.schema.json?raw";
import v2 from "../../docs/change-set-v2.schema.json?raw";
import v3 from '../../docs/change-set-v3.schema.json?raw';
import {
  parseChangeSet,
  validateJsonRule,
} from "../domain/changeSetValidation";
import * as schemas from "../domain/changeSetSchema";
import { MCP_INPUT_SCHEMAS, validateToolArgs } from "../domain/mcpProtocol";
import {
  validateChangeSetApproval,
  validateImportLedger,
  readImportLedger,
} from "../domain/changeSetLedger";
import { emptyChangeSetApproval } from "../types/changeSet";
import {
  ensembleChangeSet,
  outfitProposal,
} from "./fixtures/ensembleChangeSetFixture";
function variantLedger(): any {
  const op = outfitProposal(),
    date = "2026-11-01T00:00:00.000Z",
    source = { kind: "codex" },
    changeSetId = "synthetic-outfit-ledger";
  return {
    version: 1,
    candidates: [],
    variantCandidates: [
      {
        version: 1,
        id: "outfit-candidate",
        revision: 1,
        variantType: "Outfit",
        parentCharacterId: op.parentCharacterId,
        expectedParentRevision: 1,
        title: op.title,
        promptText: op.promptText,
        description: op.description,
        tags: op.tags,
        notes: op.notes,
        source,
        changeSetId,
        operationId: "outfit",
        status: "pending",
        createdAt: date,
        updatedAt: date,
      },
    ],
    receipts: [
      {
        version: 1,
        changeSetId,
        packageDigest: "a".repeat(64),
        approvedDigest: "b".repeat(64),
        source,
        appliedAt: date,
        approval: {
          ...emptyChangeSetApproval(),
          variantDecisions: { outfit: { action: "defer" } },
        },
        idMappings: {
          outfit: { kind: "variant_candidate", id: "outfit-candidate" },
        },
        operations: [
          {
            operationId: "outfit",
            type: "variant.propose",
            recordId: "outfit-candidate",
            status: "candidate_pending",
          },
        ],
        projectRevisions: {},
      },
    ],
  };
}
describe("v3 ensemble and Outfit contracts", () => {
  it("accepts exact versioned participant/cue data through actual preview/submit MCP schemas", () => {
    const p = ensembleChangeSet();
    expect(parseChangeSet(p)).toEqual(p);
    for (const name of [
      "krakinai_preview_change_set",
      "krakinai_submit_change_set",
    ] as const) {
      expect(validateToolArgs(name, { changeSet: p })).toEqual({
        changeSet: p,
      });
      expect(() =>
        validateJsonRule(MCP_INPUT_SCHEMAS[name] as any, { changeSet: p }),
      ).not.toThrow();
    }
  });
  it("keeps exported v1/v2 schemas and historical default approval/ledger shapes exact", () => {
    expect(schemas.CHANGE_SET_SCHEMA).toEqual(JSON.parse(v1));
    expect(schemas.CHANGE_SET_V2_SCHEMA).toEqual(JSON.parse(v2));
    expect(schemas.CHANGE_SET_V3_SCHEMA).toEqual(JSON.parse(v3));
    expect(emptyChangeSetApproval()).toEqual({
      storyboard: false,
      scenes: false,
      preferred: false,
      statuses: false,
      assetDecisions: {},
      allowDuplicateSceneOperations: [],
    });
    expect(readImportLedger({} as any)).toEqual({
      version: 1,
      receipts: [],
      candidates: [],
    });
    expect((schemas as any).CHANGE_SET_V3_SCHEMA.properties.schema.const).toBe(
      "krakinai.change-set.v3",
    );
  });
  it.each(["krakinai.change-set.v1", "krakinai.change-set.v2"])(
    "does not add ensemble fields to %s",
    (schema) => {
      const p = ensembleChangeSet();
      p.schema = schema;
      expect(() => parseChangeSet(p)).toThrow();
    },
  );
  it("accepts 8 participants and 32 cues, rejects the next entry of either", () => {
    const p = ensembleChangeSet(),
      e = p.operations[0].ensemble;
    e.participantUpserts = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`,
      character: { asset: { id: `character-${i}` }, expectedRevision: 1 },
    }));
    e.primaryParticipantId = "p0";
    e.dialogueCues = Array.from({ length: 32 }, (_, i) => ({
      id: `c${i}`,
      speaker: "Narrator",
      line: `Exact ${i}`,
      mode: "voiceover",
    }));
    expect(() => parseChangeSet(p)).not.toThrow();
    const tooMany = structuredClone(p);
    tooMany.operations[0].ensemble.participantUpserts.push({ id: "p8" });
    expect(() => parseChangeSet(tooMany)).toThrow(/limit/i);
    e.dialogueCues.push({
      id: "c32",
      speaker: "Narrator",
      line: "extra",
      mode: "voiceover",
    });
    expect(() => parseChangeSet(p)).toThrow(/limit/i);
  });
  it.each([
    "dialogue",
    "identitySource",
    "assetRefs",
    "variantRefs",
    "clearSlots",
    "overrides",
  ])("rejects conflicting global %s with an ensemble patch", (field) => {
    const p = ensembleChangeSet(),
      op = p.operations[0];
    if (field === "dialogue") op.dialogue = null;
    if (field === "identitySource") op.identitySource = "master";
    if (field === "assetRefs")
      op.assetRefs.push({
        asset: { id: "character" },
        expectedRevision: 1,
        slot: "character",
      });
    if (field === "variantRefs")
      op.variantRefs = [
        { variantId: "old-outfit", expectedRevision: 1, slot: "wardrobe" },
      ];
    if (field === "clearSlots") op.clearSlots = ["character"];
    if (field === "overrides")
      op.overrides = { wardrobe: { overrideText: "Unowned suit." } };
    expect(() => parseChangeSet(p)).toThrow(/conflict|ensemble/i);
  });
  it.each([
    "promptText",
    "identityAnchor",
    "generation",
    "snapshot",
    "approved",
    "outputs",
  ])("rejects caller-supplied participant %s", (field) => {
    const p = ensembleChangeSet();
    p.operations[0].ensemble.participantUpserts[0][field] = {
      text: "Forged identity/approval.",
    };
    expect(() => parseChangeSet(p)).toThrow(/Unsupported|invalid/i);
  });
  it.each([
    "duplicate participant",
    "duplicate cue",
    "duplicate order",
    "upsert removal conflict",
    "empty patch",
    "bad timing",
    "bad performance",
    "long line",
    "unsafe ID",
  ])("rejects %s without resolving library data", (which) => {
    const p = ensembleChangeSet(),
      e = p.operations[0].ensemble;
    if (which === "duplicate participant")
      e.participantUpserts.push(structuredClone(e.participantUpserts[0]));
    if (which === "duplicate cue")
      e.dialogueCues.push(structuredClone(e.dialogueCues[0]));
    if (which === "duplicate order") e.participantOrder = ["aya", "aya"];
    if (which === "upsert removal conflict") e.removeParticipantIds = ["aya"];
    if (which === "empty patch") p.operations[0].ensemble = { version: 1 };
    if (which === "bad timing")
      e.dialogueCues[0].timing = { startSeconds: 4, endSeconds: 2 };
    if (which === "bad performance")
      e.dialogueCues[0].performanceDirection = {
        version: 1,
        styles: ["invented-style"],
      };
    if (which === "long line") e.dialogueCues[0].line = "x".repeat(4001);
    if (which === "unsafe ID") e.participantUpserts[0].id = "constructor";
    expect(() => parseChangeSet(p)).toThrow();
  });
  it("allows explicit cue clearing, participant removal and complete reorder as patches", () => {
    const p = ensembleChangeSet();
    p.operations[0] = {
      ...p.operations[0],
      type: "scene.revise_recipe",
      sceneId: "parent",
      expectedHeadId: "parent",
      ensemble: {
        version: 1,
        removeParticipantIds: ["lucas"],
        participantOrder: ["aya"],
        primaryParticipantId: "aya",
        dialogueCues: [],
      },
    };
    expect(() => parseChangeSet(p)).not.toThrow();
  });
  it("accepts Outfit proposals/review with exact stored parent IDs and rejects other variant types or parent refs", () => {
    const p = ensembleChangeSet();
    p.operations = [
      outfitProposal(),
      {
        operationId: "review",
        type: "variant.review_candidate",
        candidateId: "pending-outfit",
        expectedRevision: 1,
      },
    ];
    expect(() => parseChangeSet(p)).not.toThrow();
    for (const patch of [
      { variantType: "Expression" },
      { parentCharacterId: { ref: "new-character" } },
      { expectedParentRevision: 0 },
      { approved: true },
    ]) {
      const bad = structuredClone(p);
      Object.assign(bad.operations[0], patch);
      expect(() => parseChangeSet(bad)).toThrow();
    }
  });
  it("validates typed dependency-first Character and Outfit candidate refs", () => {
    const p = ensembleChangeSet(),
      op = p.operations[0];
    op.ensemble.participantUpserts[1].wardrobe = { variant: { ref: "outfit" } };
    p.operations.unshift(outfitProposal("outfit", "lucas"));
    expect(() => parseChangeSet(p)).not.toThrow();
    const wrong = structuredClone(p);
    wrong.operations[1].ensemble.participantUpserts[0].character = {
      asset: { ref: "outfit" },
    };
    expect(() => parseChangeSet(wrong)).toThrow(/reference.*type|kind/i);
    const forward = structuredClone(p);
    forward.operations.reverse();
    expect(() => parseChangeSet(forward)).toThrow(/forward|order/i);
  });
  it("does not accept a wardrobe asset candidate as a new Character", () => {
    const p = ensembleChangeSet();
    p.operations.unshift({
      operationId: "wardrobe",
      type: "asset.propose",
      clientRef: "wardrobe",
      kind: "wardrobe",
      title: "Coat",
      promptText: "A coat.",
      tags: [],
    });
    p.operations[1].ensemble.participantUpserts[0].character = {
      asset: { ref: "wardrobe" },
    };
    expect(() => parseChangeSet(p)).toThrow(/kind|character|reference.*type/i);
  });
  it("keeps the 50 candidate operation limit shared across assets and variants", () => {
    const p = ensembleChangeSet();
    p.operations = Array.from({ length: 50 }, (_, i) =>
      outfitProposal(`outfit-${i}`),
    );
    expect(() => parseChangeSet(p)).not.toThrow();
    p.operations.push({
      operationId: "asset-51",
      clientRef: "asset-51",
      type: "asset.propose",
      kind: "wardrobe",
      title: "Extra",
      promptText: "Extra coat.",
      tags: [],
    });
    expect(() => parseChangeSet(p)).toThrow(/limit/i);
  });
  it("uses separate explicit variant decisions and never accepts asset IDs in them", () => {
    const p = ensembleChangeSet();
    p.operations = [outfitProposal()];
    const a = {
      ...emptyChangeSetApproval(),
      variantDecisions: {
        outfit: {
          action: "reuse",
          variantId: "existing-outfit",
          expectedRevision: 1,
        },
      },
    };
    expect(() => validateChangeSetApproval(a, p.operations)).not.toThrow();
    expect(() =>
      validateChangeSetApproval(
        {
          ...a,
          variantDecisions: {
            outfit: {
              action: "reuse",
              assetId: "character",
              expectedRevision: 1,
            },
          },
        },
        p.operations,
      ),
    ).toThrow();
    expect(() =>
      validateChangeSetApproval(
        { ...a, variantDecisions: { unknown: { action: "create" } } },
        p.operations,
      ),
    ).toThrow();
  });
  it.each([
    [0, 251],
    [125, 126],
    [250, 1],
  ])(
    "keeps combined ledger capacity for %i assets / %i variants without adding historical defaults",
    (assets, variants) => {
      const ledger = {
        version: 1,
        receipts: [],
        candidates: Array.from({ length: assets }, () => ({})),
        variantCandidates: Array.from({ length: variants }, () => ({})),
      };
      expect(() => validateImportLedger(ledger)).toThrow(/limit|250|capacity/i);
    },
  );
  it("retains versioned pending Outfit candidates, typed receipts and exact old/new ledger serialization", () => {
    const ledger = variantLedger();
    expect(() => validateImportLedger(ledger)).not.toThrow();
    expect(readImportLedger({ aiImports: ledger } as any)).toEqual(ledger);
    const created = structuredClone(ledger);
    created.variantCandidates[0].status = "created";
    created.variantCandidates[0].variantId = "stored-outfit";
    created.receipts[0].idMappings.outfit.variantId = "stored-outfit";
    created.receipts[0].operations[0].status = "variant_created";
    expect(() => validateImportLedger(created)).not.toThrow();
  });
  it.each(["version", "parent", "approval", "mapping", "state", "provenance"])(
    "rejects invalid %s in a versioned Outfit candidate/receipt",
    (field) => {
      const ledger = variantLedger(),
        c = ledger.variantCandidates[0];
      if (field === "version") c.version = 2;
      if (field === "parent") c.expectedParentRevision = 0;
      if (field === "approval") c.approvedAt = "2026-11-01";
      if (field === "mapping")
        ledger.receipts[0].idMappings.outfit.assetId = "confused-asset";
      if (field === "state") c.variantId = "not-pending";
      if (field === "provenance") c.operationId = "unknown-source";
      expect(() => validateImportLedger(ledger)).toThrow();
    },
  );
  it.each(["promptText", "description", "notes", "tags"])(
    "preserves existing candidate %s limits for Outfits",
    (field) => {
      const p = ensembleChangeSet(),
        op = outfitProposal();
      p.operations = [op];
      if (field === "promptText") op.promptText = "x".repeat(12001);
      if (field === "description") op.description = "x".repeat(501);
      if (field === "notes") op.notes = "x".repeat(4001);
      if (field === "tags")
        op.tags = Array.from({ length: 13 }, (_, i) => `tag-${i}`);
      expect(() => parseChangeSet(p)).toThrow(/limit/i);
    },
  );
});
