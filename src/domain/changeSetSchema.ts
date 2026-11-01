import { RECIPE_SCENE_FIELDS } from "./recipeChangeSetSchema";
import{createEnsembleChangeSetSchema}from'./ensembleChangeSetSchema';
import{createConversionChangeSetSchema}from'./recipeConversionSchema';
export interface JsonRule {
  type?: string | string[];
  const?: unknown;
  enum?: readonly unknown[];
  properties?: Record<string, JsonRule>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonRule;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  oneOf?: JsonRule[];
  [key: string]: unknown;
}
const str = (max: number, min = 0): JsonRule => ({
  type: "string",
  minLength: min,
  maxLength: max,
});
const obj = (
  properties: Record<string, JsonRule>,
  required = Object.keys(properties),
): JsonRule => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const arr = (items: JsonRule, max: number, min = 0): JsonRule => ({
  type: "array",
  items,
  minItems: min,
  maxItems: max,
});
const en = (...values: string[]): JsonRule => ({
  type: "string",
  enum: values,
});
const revision: JsonRule = {
  type: "integer",
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
};
export const CHANGE_SET_ID_SCHEMA: JsonRule = {
  ...str(200, 1),
  pattern:
    "^(?!(?:constructor|prototype|__proto__)$)[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$",
};
const id = CHANGE_SET_ID_SCHEMA;
export const RECORD_TARGET_SCHEMA: JsonRule = {
  oneOf: [obj({ id }), obj({ ref: id })],
};
const project: JsonRule = {
  oneOf: [obj({ id, expectedRevision: revision }), obj({ ref: id })],
};
const shotType = en(
  "character_scene",
  "property_environment",
  "graphic_motion",
  "existing_footage",
);
const statuses = en(
  "planned",
  "prompt_ready",
  "generated",
  "reviewed",
  "final",
);
const kind = en(
  "character",
  "wardrobe",
  "environment",
  "action",
  "camera",
  "lighting",
  "style",
  "template",
);
const source = obj(
  { kind: en("manual", "chatgpt", "codex", "external"), label: str(100) },
  ["kind"],
);
const prompt = obj(
  {
    version: { const: 1 },
    text: str(100000, 1),
    origin: en("manual", "chatgpt", "codex", "external"),
    originLabel: str(100),
  },
  ["version", "text"],
);
const settings = obj(
  {
    aspectRatio: en("16:9", "9:16", "1:1"),
    durationSeconds: { type: "number", minimum: 1, maximum: 60 },
    toolNotes: str(10000),
  },
  [],
);
const media = obj(
  {
    mediaId: id,
    role: en("reference", "sample"),
    altText: str(10000),
    mimeType: str(100),
  },
  ["mediaId"],
);
const pending = obj(
  {
    version: { const: 1 },
    id,
    kind: en("reference_image", "source_image", "source_video", "other"),
    label: str(240, 1),
    notes: str(10000),
  },
  ["version", "id", "kind", "label"],
);
const asset = obj(
  {
    asset: RECORD_TARGET_SCHEMA,
    slot: en(
      "character",
      "wardrobe",
      "environment",
      "action",
      "camera",
      "lighting",
      "style",
    ),
    expectedRevision: revision,
  },
  ["asset", "slot"],
);
const variant = obj({
  variantId: id,
  expectedRevision: revision,
  slot: en("wardrobe", "environment", "action", "camera", "lighting", "style"),
});
const claims = obj({
  kind: en(
    "property",
    "financial",
    "payment",
    "travel_time",
    "location",
    "other",
  ),
  text: str(1000, 1),
  verified: { const: false },
});
const metadata = {
  code: str(40, 1),
  title: str(240, 1),
  plannedShotType: shotType,
  plannedDurationSeconds: {
    type: "number",
    minimum: Number.MIN_VALUE,
    maximum: 86400,
  },
  continuityNotes: str(10000),
};
const sceneFields = {
  title: str(100, 1),
  prompt,
  shotType,
  settings,
  references: arr(media, 100),
  sourceMedia: arr(
    { ...media, properties: { ...media.properties, role: en("reference") } },
    100,
  ),
  assetRefs: arr(asset, 7),
  variantRefs: arr(variant, 7),
  pendingInputs: arr(pending, 100),
  claimNotes: str(10000),
  claims: arr(claims, 100),
  reason: str(10000),
};
const ops: JsonRule[] = [];
function op(
  type: string,
  fields: Record<string, JsonRule>,
  required: string[],
) {
  ops.push(
    obj({ operationId: id, type: { const: type }, ...fields }, [
      "operationId",
      "type",
      ...required,
    ]),
  );
}
op(
  "project.create",
  {
    clientRef: id,
    name: str(100, 1),
    description: str(500),
    planningNotes: str(10000),
  },
  ["clientRef", "name"],
);
op(
  "project.update",
  {
    project,
    name: str(100, 1),
    description: str(500),
    planningNotes: str(10000),
  },
  ["project"],
);
op("shot.create", { project, clientRef: id, ...metadata }, [
  "project",
  "clientRef",
  "code",
  "title",
]);
op("shot.update", { project, shot: RECORD_TARGET_SCHEMA, ...metadata }, [
  "project",
  "shot",
]);
op("shot.reorder", { project, shots: arr(RECORD_TARGET_SCHEMA, 250, 1) }, [
  "project",
  "shots",
]);
op(
  "scene.create_direct_prompt",
  { clientRef: id, project, shot: RECORD_TARGET_SCHEMA, ...sceneFields },
  ["clientRef", "title", "prompt"],
);
for (const type of ["scene.revise", "scene.create_take"])
  op(
    type,
    {
      clientRef: id,
      sceneId: id,
      expectedHeadId: id,
      project,
      shot: RECORD_TARGET_SCHEMA,
      ...sceneFields,
    },
    ["clientRef", "sceneId", "expectedHeadId", "prompt"],
  );
op(
  "scene.restore",
  {
    clientRef: id,
    sceneId: id,
    expectedHeadId: id,
    restoreFromSceneId: id,
    project,
    shot: RECORD_TARGET_SCHEMA,
    reason: str(10000),
  },
  ["clientRef", "sceneId", "expectedHeadId", "restoreFromSceneId"],
);
op(
  "shot.attach_take",
  { project, shot: RECORD_TARGET_SCHEMA, scene: RECORD_TARGET_SCHEMA },
  ["project", "shot", "scene"],
);
op(
  "shot.select_take",
  {
    project,
    shot: RECORD_TARGET_SCHEMA,
    scene: RECORD_TARGET_SCHEMA,
    expectedSelectedSceneId: { type: ["string", "null"], maxLength: 200 },
  },
  ["project", "shot", "scene", "expectedSelectedSceneId"],
);
op(
  "shot.set_status",
  {
    project,
    shot: RECORD_TARGET_SCHEMA,
    status: statuses,
    expectedStatus: statuses,
  },
  ["project", "shot", "status", "expectedStatus"],
);
op(
  "asset.propose",
  {
    clientRef: id,
    kind,
    title: str(100, 1),
    promptText: str(12000, 1),
    description: str(500),
    tags: arr(str(30, 1), 12),
    notes: str(4000),
    sourceScene: RECORD_TARGET_SCHEMA,
  },
  ["clientRef", "kind", "title", "promptText", "tags"],
);
op("asset.review_candidate", { candidateId: id, expectedRevision: revision }, [
  "candidateId",
  "expectedRevision",
]);
export const CHANGE_SET_SCHEMA: JsonRule = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://krakinai.local/schemas/change-set-v1.json",
  title: "KRAKINAI Change Set v1",
  ...obj(
    {
      schema: { const: "krakinai.change-set.v1" },
      changeSetId: id,
      source,
      title: str(100),
      description: str(10000),
      operations: arr({ oneOf: ops }, 250, 1),
    },
    ["schema", "changeSetId", "source", "operations"],
  ),
};

// Do not append to `ops`: the distributed v1 contract remains byte-identical.
const { prompt: _directPrompt, ...recipeContextFields } = sceneFields;
const recipeOps = [
  "scene.create_recipe",
  "scene.revise_recipe",
  "scene.create_recipe_take",
].map((type) =>
  obj(
    {
      operationId: id,
      type: { const: type },
      clientRef: id,
      project,
      shot: RECORD_TARGET_SCHEMA,
      ...recipeContextFields,
      ...RECIPE_SCENE_FIELDS,
      ...(type === "scene.create_recipe"
        ? {
            settings: {
              ...settings,
              required: ["aspectRatio", "durationSeconds"],
            },
          }
        : { sceneId: id, expectedHeadId: id }),
    },
    [
      "operationId",
      "type",
      "clientRef",
      "project",
      "shot",
      ...(type === "scene.create_recipe"
        ? ["title", "shotType", "settings"]
        : ["sceneId", "expectedHeadId"]),
    ],
  ),
);
export const CHANGE_SET_V2_SCHEMA: JsonRule = {
  ...CHANGE_SET_SCHEMA,
  $id: "https://krakinai.local/schemas/change-set-v2.json",
  title: "KRAKINAI Change Set v2",
  properties: {
    ...CHANGE_SET_SCHEMA.properties,
    schema: { const: "krakinai.change-set.v2" },
    operations: arr({ oneOf: [...ops, ...recipeOps] }, 250, 1),
  },
};
export const CHANGE_SET_V3_SCHEMA:JsonRule=createEnsembleChangeSetSchema(CHANGE_SET_V2_SCHEMA,CHANGE_SET_ID_SCHEMA);
export const CHANGE_SET_V4_SCHEMA:JsonRule=createConversionChangeSetSchema(CHANGE_SET_V3_SCHEMA,CHANGE_SET_ID_SCHEMA);
export const SUPPORTED_CHANGE_SET_SCHEMA: JsonRule = {
  type: "object",
  oneOf: [CHANGE_SET_SCHEMA, CHANGE_SET_V2_SCHEMA,CHANGE_SET_V3_SCHEMA,CHANGE_SET_V4_SCHEMA],
};
