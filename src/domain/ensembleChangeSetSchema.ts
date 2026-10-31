import type { JsonRule } from "./changeSetSchema";
import { RECIPE_SCENE_FIELDS } from "./recipeChangeSetSchema";
import { ENSEMBLE_LIMITS, ENSEMBLE_LOCAL_ID_PATTERN } from "../types/ensemble";
import type { RecipeSceneOperation } from "../types/changeSet";
import { validateDialogueCueTiming } from "./ensembleValidation";
import { validatePerformanceDirection } from "./dialoguePerformance";
const object = (
  properties: Record<string, JsonRule>,
  required: string[] = [],
): JsonRule => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const array = (items: JsonRule, maxItems: number): JsonRule => ({
  type: "array",
  items,
  maxItems,
});
const text = (maxLength: number, minLength = 0): JsonRule => ({
  type: "string",
  minLength,
  maxLength,
});
const nullable = (r: JsonRule): JsonRule => ({ oneOf: [r, { type: "null" }] });
export const ENSEMBLE_LOCAL_ID_SCHEMA: JsonRule = {
  ...text(ENSEMBLE_LIMITS.id, 1),
  pattern: ENSEMBLE_LOCAL_ID_PATTERN,
};
export function createEnsembleChangeSetSchema(
  v2: JsonRule,
  id: JsonRule,
): JsonRule {
  const revision: JsonRule = {
    type: "integer",
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  };
  const target = (kind: "asset" | "variant"): JsonRule => ({
    oneOf: [
      object({ [kind]: object({ id }, ["id"]), expectedRevision: revision }, [
        kind,
        "expectedRevision",
      ]),
      object({ [kind]: object({ ref: id }, ["ref"]) }, [kind]),
    ],
  });
  const dialogue = structuredClone(RECIPE_SCENE_FIELDS.dialogue.oneOf![0]);
  const cue = object(
    {
      ...dialogue.properties,
      id: ENSEMBLE_LOCAL_ID_SCHEMA,
      participantId: ENSEMBLE_LOCAL_ID_SCHEMA,
      timing: object(
        {
          startSeconds: { type: "number", minimum: 0, maximum: 60 },
          endSeconds: { type: "number", minimum: 0, maximum: 60 },
        },
        ["startSeconds", "endSeconds"],
      ),
    },
    ["id", "speaker", "line"],
  );
  const participant = object(
    {
      id: ENSEMBLE_LOCAL_ID_SCHEMA,
      character: target("asset"),
      wardrobe: nullable({ oneOf: [target("asset"), target("variant")] }),
      role: text(ENSEMBLE_LIMITS.role),
      presence: { enum: ["on_camera", "off_camera"] },
      performanceNotes: text(ENSEMBLE_LIMITS.performanceNotes),
      identitySource: { enum: ["master", "approved_anchor"] },
    },
    ["id"],
  );
  const patch = object(
    {
      version: { const: 1 },
      participantUpserts: array(participant, ENSEMBLE_LIMITS.participants),
      removeParticipantIds: {
        ...array(ENSEMBLE_LOCAL_ID_SCHEMA, ENSEMBLE_LIMITS.participants),
        uniqueItems: true,
      },
      participantOrder: {
        ...array(ENSEMBLE_LOCAL_ID_SCHEMA, ENSEMBLE_LIMITS.participants),
        uniqueItems: true,
      },
      primaryParticipantId: nullable(ENSEMBLE_LOCAL_ID_SCHEMA),
      dialogueCues: array(cue, ENSEMBLE_LIMITS.cues),
    },
    ["version"],
  );
  const v3 = structuredClone(v2);
  v3.$id = "https://krakinai.local/schemas/change-set-v3.json";
  v3.title = "KRAKINAI Change Set v3";
  v3.properties!.schema = { const: "krakinai.change-set.v3" };
  const candidateFields = v3.properties!.operations.items!.oneOf!.find(
    (o) => o.properties!.type.const === "asset.propose",
  )!.properties!;
  for (const op of v3.properties!.operations.items!.oneOf!)
    if (
      [
        "scene.create_recipe",
        "scene.revise_recipe",
        "scene.create_recipe_take",
      ].includes(op.properties!.type.const as string)
    )
      op.properties!.ensemble = patch;
  v3.properties!.operations.items!.oneOf!.push(
    object(
      {
        operationId: id,
        type: { const: "variant.propose" },
        clientRef: id,
        variantType: { const: "Outfit" },
        parentCharacterId: id,
        expectedParentRevision: revision,
        ...Object.fromEntries(
          [
            "title",
            "promptText",
            "description",
            "tags",
            "notes",
            "sourceScene",
          ].map((key) => [key, candidateFields[key]]),
        ),
      },
      [
        "operationId",
        "type",
        "clientRef",
        "variantType",
        "parentCharacterId",
        "expectedParentRevision",
        "title",
        "promptText",
        "tags",
      ],
    ),
    object(
      {
        operationId: id,
        type: { const: "variant.review_candidate" },
        clientRef: id,
        candidateId: id,
        expectedRevision: revision,
      },
      ["operationId", "type", "candidateId", "expectedRevision"],
    ),
  );
  return v3;
}
export function validateEnsembleRecipePatch(op: RecipeSceneOperation): void {
  const e = op.ensemble;
  if (!e) return;
  const owned = ["character", "wardrobe"];
  if (
    Object.hasOwn(op, "dialogue") ||
    Object.hasOwn(op, "identitySource") ||
    op.assetRefs?.some((r) => owned.includes(r.slot)) ||
    op.variantRefs?.some((r) => owned.includes(r.slot)) ||
    op.clearSlots?.some((s) => owned.includes(s)) ||
    owned.some((s) => Object.hasOwn(op.overrides ?? {}, s))
  )
    throw Error(
      "Conflicting global Character/wardrobe/identity/dialogue fields with an ensemble patch.",
    );
  if (
    !e.participantUpserts?.length &&
    !e.removeParticipantIds?.length &&
    e.participantOrder === undefined &&
    e.primaryParticipantId === undefined &&
    e.dialogueCues === undefined
  )
    throw Error("Empty ensemble patch.");
  const unique = (ids: string[], label: string) => {
    if (new Set(ids).size !== ids.length)
      throw Error(`Duplicate ensemble ${label} IDs.`);
  };
  unique(
    (e.participantUpserts ?? []).map((p) => p.id),
    "participant",
  );
  unique(e.removeParticipantIds ?? [], "removal");
  unique(e.participantOrder ?? [], "order");
  unique(
    (e.dialogueCues ?? []).map((c) => c.id),
    "cue",
  );
  if (e.participantUpserts?.some((p) => e.removeParticipantIds?.includes(p.id)))
    throw Error("Conflicting participant upsert/removal instructions.");
  for (const p of e.participantUpserts ?? [])
    if (Object.keys(p).length === 1)
      throw Error("Empty ensemble participant upsert.");
  for (const cue of e.dialogueCues ?? []) {
    const error =
      validatePerformanceDirection(cue.performanceDirection) ??
      validateDialogueCueTiming(cue.timing, op.settings?.durationSeconds);
    if (error) throw Error(error);
  }
}
