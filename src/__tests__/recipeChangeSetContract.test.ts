import { describe, it, expect } from "vitest";
import distributedV1 from "../../docs/change-set.schema.json?raw";
import distributedV2 from "../../docs/change-set-v2.schema.json?raw";
import {
  parseChangeSet,
  validateJsonRule,
} from "../domain/changeSetValidation";
import * as schemas from "../domain/changeSetSchema";
import { MCP_INPUT_SCHEMAS, validateToolArgs } from "../domain/mcpProtocol";
import { emptyChangeSetApproval } from "../types/changeSet";
import { validateChangeSetApproval } from "../domain/changeSetLedger";

// Missing v2 dispatch or permissive snapshot/text fields must break these cases.
export const recipePackage = (): any => ({
  schema: "krakinai.change-set.v2",
  changeSetId: "synthetic-recipe-contract",
  source: { kind: "codex" },
  operations: [
    {
      operationId: "recipe",
      type: "scene.create_recipe",
      clientRef: "recipe",
      project: { id: "project", expectedRevision: 1 },
      shot: { id: "shot" },
      title: "Synthetic courtyard",
      shotType: "property_environment",
      settings: { aspectRatio: "16:9", durationSeconds: 4 },
      assetRefs: [
        {
          asset: { id: "environment" },
          slot: "environment",
          expectedRevision: 2,
        },
      ],
      sceneInstructions: "  Keep the original geometry.\r\n",
    },
  ],
});
describe("versioned recipe contract", () => {
  it.each(["instructions", "line", "delivery"])(
    "advertises the existing assembler limit for %s without changing application limits",
    (field) => {
      const input = recipePackage(),
        op = input.operations[0];
      if (field === "instructions") op.sceneInstructions = "x".repeat(4001);
      else
        op.dialogue =
          field === "line"
            ? { speaker: "Narrator", line: "x".repeat(4001), mode: "voiceover" }
            : {
                speaker: "Narrator",
                line: "Hello.",
                mode: "voiceover",
                deliveryNotes: "x".repeat(1001),
              };
      expect(() => parseChangeSet(input)).toThrow(/limit/i);
    },
  );
  it.each([
    "scene.create_recipe",
    "scene.revise_recipe",
    "scene.create_recipe_take",
  ])(
    "accepts %s with explicit IDs and retains exact authoring text",
    (type) => {
      const input = recipePackage();
      input.operations[0].type = type;
      if (type !== "scene.create_recipe")
        Object.assign(input.operations[0], {
          sceneId: "old-recipe",
          expectedHeadId: "old-recipe",
        });
      expect(parseChangeSet(input)).toEqual(input);
      expect(
        validateToolArgs("krakinai_submit_change_set", { changeSet: input }),
      ).toEqual({ changeSet: input });
    },
  );
  it("does not extend the legacy v1 contract", () => {
    const input = recipePackage();
    input.schema = "krakinai.change-set.v1";
    expect(() => parseChangeSet(input)).toThrow();
    expect(() => validateJsonRule(schemas.CHANGE_SET_SCHEMA, input)).toThrow();
    expect(JSON.parse(distributedV1)).toEqual(schemas.CHANGE_SET_SCHEMA);
  });
  it("exports the exact v2 runtime rule and advertises both versions on the existing MCP tools", () => {
    const rule = (schemas as any).CHANGE_SET_V2_SCHEMA;
    expect(rule).toBeDefined();
    expect(JSON.parse(distributedV2)).toEqual(rule);
    expect(() =>
      validateJsonRule(
        MCP_INPUT_SCHEMAS.krakinai_preview_change_set.properties
          .changeSet as schemas.JsonRule,
        recipePackage(),
      ),
    ).not.toThrow();
  });
  it.each([
    [
      "raw prompt",
      (o: any) => {
        o.prompt = { version: 1, text: "injected" };
      },
    ],
    [
      "raw snapshots",
      (o: any) => {
        o.slots = {};
      },
    ],
    [
      "manual outputs",
      (o: any) => {
        o.manualOutputs = { full: "injected" };
      },
    ],
    [
      "Character override",
      (o: any) => {
        o.overrides = { character: { overrideText: "another identity" } };
      },
    ],
    [
      "anchor stamp",
      (o: any) => {
        o.generation = { identitySource: "approved_anchor", anchor: {} };
      },
    ],
    [
      "internal camera baseline",
      (o: any) => {
        o.cameraComposition = {
          version: 1,
          techniqueIds: [],
          baselineOverrideText: "injected",
        };
      },
    ],
    [
      "unsupported camera ID",
      (o: any) => {
        o.cameraComposition = { version: 1, techniqueIds: ["not-a-camera"] };
      },
    ],
    [
      "unknown dialogue field",
      (o: any) => {
        o.dialogue = { speaker: "Mika", line: "Hello", participants: [] };
      },
    ],
    [
      "conflicting performance",
      (o: any) => {
        o.dialogue = {
          speaker: "Mika",
          line: "Hello",
          performanceDirection: { version: 1, styles: ["angry", "calm"] },
        };
      },
    ],
    [
      "camera bounds",
      (o: any) => {
        o.cameraComposition = {
          version: 1,
          techniqueIds: [],
          parameters: { focalLengthMm: 0 },
        };
      },
    ],
    [
      "conflicting clear",
      (o: any) => {
        o.clearSlots = ["environment"];
      },
    ],
    [
      "missing expected revision",
      (o: any) => {
        delete o.assetRefs[0].expectedRevision;
      },
    ],
    [
      "missing project target",
      (o: any) => {
        delete o.project;
      },
    ],
  ])("rejects %s", (_label, mutate) => {
    const input = recipePackage();
    mutate(input.operations[0]);
    expect(() => parseChangeSet(input)).toThrow();
  });
  it("accepts nullable clear controls and bounded supported performance metadata", () => {
    const input = recipePackage();
    Object.assign(input.operations[0], {
      dialogue: {
        speaker: "Mika",
        line: "Dito tayo.",
        performanceDirection: {
          version: 2,
          emotion: { primary: "calm" },
          voice: { tone: "warm" },
        },
      },
      cameraComposition: null,
      identitySource: "master",
      overrides: {
        environment: { overrideText: "Only the scene lighting changes." },
      },
    });
    expect(parseChangeSet(input)).toEqual(input);
  });
  it("resolves dependency-first candidate references and rejects forward/wrong-kind references", () => {
    const input = recipePackage(),
      recipe = input.operations[0];
    recipe.assetRefs[0].asset = { ref: "candidate" };
    delete recipe.assetRefs[0].expectedRevision;
    const candidate = {
      operationId: "asset",
      type: "asset.propose",
      clientRef: "candidate",
      kind: "environment",
      title: "Synthetic garden",
      promptText: "A quiet garden.",
      tags: [],
    };
    input.operations = [candidate, recipe];
    expect(parseChangeSet(input)).toEqual(input);
    input.operations = [recipe, candidate];
    expect(() => parseChangeSet(input)).toThrow(/Forward/);
    input.operations = [
      {
        operationId: "project",
        type: "project.create",
        clientRef: "candidate",
        name: "Wrong kind",
      },
      recipe,
    ];
    expect(() => parseChangeSet(input)).toThrow(/Wrong/);
  });
  it("limits manual-output consent to exact recipe operation IDs and preserves legacy approval defaults", () => {
    const approval = emptyChangeSetApproval();
    expect(Object.hasOwn(approval, "discardManualOutputOperations")).toBe(
      false,
    );
    expect(() =>
      validateChangeSetApproval(
        { ...approval, discardManualOutputOperations: ["recipe"] },
        recipePackage().operations,
      ),
    ).not.toThrow();
    expect(() =>
      validateChangeSetApproval(
        { ...approval, discardManualOutputOperations: ["unrelated"] },
        recipePackage().operations,
      ),
    ).toThrow();
  });
});
