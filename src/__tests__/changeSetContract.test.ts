import { describe, it, expect } from "vitest";
import { parseChangeSet } from "../domain/changeSetValidation";
import {
  canonicalStringify,
  changeSetDigest,
} from "../domain/changeSetCanonical";
import distributedSchema from "../../docs/change-set.schema.json?raw";
import { CHANGE_SET_SCHEMA } from "../domain/changeSetSchema";
const exact =
  '  # MIDORI\r\n“Dito tayo.” 😊 e\u0301\r\n\t{"negative":"Keep exact."}  ';
const valid = () => ({
  schema: "krakinai.change-set.v1",
  changeSetId: "synthetic-001",
  source: { kind: "chatgpt" },
  operations: [
    {
      operationId: "p",
      type: "project.create",
      clientRef: "project",
      name: "Synthetic MIDORI",
    },
    {
      operationId: "s",
      type: "shot.create",
      clientRef: "shot",
      project: { ref: "project" },
      code: "01",
      title: "Opening",
      plannedShotType: "property_environment",
      plannedDurationSeconds: 4,
    },
    {
      operationId: "scene",
      type: "scene.create_direct_prompt",
      clientRef: "prompt",
      project: { ref: "project" },
      shot: { ref: "shot" },
      title: "Opening",
      prompt: { version: 1, text: exact },
    },
  ],
});
describe("canonical change-set contract", () => {
  it("accepts a complete project/shot/exact prompt without rewriting", () => {
    const input = valid();
    expect(parseChangeSet(JSON.stringify(input))).toEqual(input);
    expect((parseChangeSet(input).operations[2] as any).prompt.text).toBe(
      exact,
    );
  });
  it("canonicalizes object keys but preserves values and operation order", async () => {
    expect(canonicalStringify({ z: exact, a: { y: 1, x: 2 } })).toBe(
      canonicalStringify({ a: { x: 2, y: 1 }, z: exact }),
    );
    expect(await changeSetDigest(valid())).toMatch(/^[a-f0-9]{64}$/);
    expect(await changeSetDigest(valid())).not.toBe(
      await changeSetDigest({ ...valid(), title: "changed" }),
    );
  });
  for (const [label, mutate] of [
    ["schema", (v: any) => (v.schema = "krakinai.change-set.v99")],
    [
      "unknown operation",
      (v: any) => (v.operations[0].type = "identity.replace"),
    ],
    ["imported approval", (v: any) => (v.approvals = { all: true })],
    [
      "internal overwrite ID",
      (v: any) => (v.operations[0].id = "collection_existing"),
    ],
    ["executable field", (v: any) => (v.operations[0].script = "alert(1)")],
    ["duplicate operation", (v: any) => (v.operations[1].operationId = "p")],
    [
      "duplicate reference",
      (v: any) => (v.operations[1].clientRef = "project"),
    ],
    [
      "unknown reference",
      (v: any) => (v.operations[1].project.ref = "missing"),
    ],
    [
      "wrong reference type",
      (v: any) => (v.operations[2].project.ref = "shot"),
    ],
    [
      "forward dependency",
      (v: any) => (v.operations = [v.operations[1], v.operations[0]]),
    ],
    [
      "invalid type",
      (v: any) => (v.operations[1].plannedShotType = "invented"),
    ],
    [
      "invalid duration",
      (v: any) => (v.operations[1].plannedDurationSeconds = 0),
    ],
    [
      "missing revision",
      (v: any) => (v.operations[1].project = { id: "collection_existing" }),
    ],
    [
      "negative revision",
      (v: any) =>
        (v.operations[1].project = {
          id: "collection_existing",
          expectedRevision: -1,
        }),
    ],
    ["malformed Unicode", (v: any) => (v.operations[2].prompt.text = "\ud800")],
    ["blank prompt", (v: any) => (v.operations[2].prompt.text = "  ")],
    [
      "overlong prompt",
      (v: any) => (v.operations[2].prompt.text = "x".repeat(100001)),
    ],
    [
      "unverified claim override",
      (v: any) =>
        (v.operations[2].claims = [
          { kind: "property", text: "Unverified", verified: true },
        ]),
    ],
    [
      "too many operations",
      (v: any) =>
        (v.operations = Array.from({ length: 251 }, (_, i) => ({
          operationId: "p" + i,
          type: "project.create",
          clientRef: "r" + i,
          name: "Project",
        }))),
    ],
  ] as const)
    it(`rejects ${label}`, () => {
      const v = valid();
      mutate(v);
      expect(() => parseChangeSet(v)).toThrow(
        /change.set|operation|reference|revision|Unicode|prompt|duration|claim|schema|limit|field|type|approval/i,
      );
    });
  it("rejects forbidden prototype keys at any depth", () => {
    expect(() =>
      parseChangeSet(
        '{"schema":"krakinai.change-set.v1","__proto__":{},"operations":[]}',
      ),
    ).toThrow(/forbidden|key/i);
  });
  it("rejects byte-oversize input before parsing", () =>
    expect(() => parseChangeSet(" ".repeat(20 * 1024 * 1024 + 1))).toThrow(
      /20 MiB|size/i,
    ));
  it("accepts literal HTML-like prompt text without executing it", () => {
    const v = valid();
    v.operations[2].prompt = {
      version: 1,
      text: "<script>literal, never evaluated</script>",
    } as any;
    expect((parseChangeSet(v).operations[2] as any).prompt.text).toContain(
      "<script>",
    );
  });
  it("rejects invalid library candidate bounds rather than changing application limits", () => {
    const v: any = valid();
    v.operations.push({
      operationId: "a",
      type: "asset.propose",
      clientRef: "candidate",
      kind: "camera",
      title: "Camera",
      promptText: "x".repeat(12001),
      tags: [],
    });
    expect(() => parseChangeSet(v)).toThrow(/12000|limit|length/i);
  });
  it("requires project and shot as a pair, including a shot without a project", () => {
    const v: any = valid();
    delete v.operations[2].project;
    expect(() => parseChangeSet(v)).toThrow(/both project and shot/i);
  });
  it("rejects whitespace-only names and unsafe identifiers", () => {
    for (const name of [" ", "__proto__", "a/b", " leading"]) {
      const v = valid();
      v.changeSetId = name;
      expect(() => parseChangeSet(v)).toThrow(/identifier/i);
    }
    const v = valid();
    v.operations[0].name = " ";
    expect(() => parseChangeSet(v)).toThrow(/nonblank|name/i);
  });
  it("rejects a real scene/candidate dependency cycle", () => {
    const v: any = valid();
    v.operations = [
      {
        operationId: "a",
        type: "asset.propose",
        clientRef: "asset",
        kind: "camera",
        title: "Camera",
        promptText: "Locked",
        tags: [],
        sourceScene: { ref: "scene" },
      },
      {
        operationId: "b",
        type: "scene.create_direct_prompt",
        clientRef: "scene",
        title: "Scene",
        prompt: { version: 1, text: exact },
        assetRefs: [{ slot: "camera", asset: { ref: "asset" } }],
      },
    ];
    expect(() => parseChangeSet(v)).toThrow(/cyclic/i);
  });
  it("keeps the distributable JSON Schema equal to the runtime contract", () => {
    expect(JSON.parse(distributedSchema)).toEqual(CHANGE_SET_SCHEMA);
  });
});
