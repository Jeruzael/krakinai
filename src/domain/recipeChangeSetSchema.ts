import type { JsonRule } from "./changeSetSchema";
import { CAMERA_PARAMETER_DEFINITIONS } from "./cameraCompositionParameters";
import { CINEMATOGRAPHY_TECHNIQUES } from "./cinematographyRegistry";
import {
  DELIVERY_STYLES,
  SPEAKING_PACES,
  BODY_LANGUAGE,
} from "./dialoguePerformance";
import {
  EMOTIONS,
  EMOTIONAL_INTENSITIES,
  TECHNIQUES,
  VOICE_FIELDS,
  SPEECH_FIELDS,
  GESTURES,
} from "./performanceCatalog";

const text = (max: number): JsonRule => ({ type: "string", maxLength: max });
const enumeration = (values: readonly string[]): JsonRule => ({
  type: "string",
  enum: values,
});
const object = (
  properties: Record<string, JsonRule>,
  required: string[] = [],
): JsonRule => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const selections = (values: readonly string[]): JsonRule => ({
  type: "array",
  items: enumeration(values),
  maxItems: values.length,
  uniqueItems: true,
});
const nullable = (rule: JsonRule): JsonRule => ({
  oneOf: [rule, { type: "null" }],
});
const catalogFields = (fields: Record<string, { options: object }>) =>
  Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [
      key,
      enumeration(Object.keys(field.options)),
    ]),
  );

// Structural rules derive from the same catalogs as the authoring UI. Existing
// semantic validators additionally reject incompatible choices and duplicates.
const performance: JsonRule = {
  oneOf: [
    object(
      {
        version: { const: 1 },
        styles: selections(DELIVERY_STYLES.map((s) => s.id)),
        pace: enumeration(Object.keys(SPEAKING_PACES)),
        gestures: enumeration(Object.keys(BODY_LANGUAGE)),
      },
      ["version", "styles"],
    ),
    object(
      {
        version: { const: 2 },
        emotion: object({
          primary: enumeration(Object.keys(EMOTIONS)),
          secondary: enumeration(Object.keys(EMOTIONS)),
          intensity: enumeration(Object.keys(EMOTIONAL_INTENSITIES)),
          custom: text(1000),
        }),
        techniques: selections(Object.keys(TECHNIQUES)),
        customTechnique: text(1000),
        voice: object(catalogFields(VOICE_FIELDS)),
        speech: object({
          ...catalogFields(SPEECH_FIELDS),
          emphasis: text(1000),
        }),
        gestures: selections(Object.keys(GESTURES)),
      },
      ["version"],
    ),
  ],
};
const camera = object(
  {
    version: { const: 1 },
    techniqueIds: {
      type: "array",
      items: enumeration(
        CINEMATOGRAPHY_TECHNIQUES.filter(
          (t) => t.owner === "camera" && t.kind === "technique" && t.dimension,
        ).map((t) => t.id),
      ),
      maxItems: 40,
      uniqueItems: true,
    },
    parameters: object(
      Object.fromEntries(
        CAMERA_PARAMETER_DEFINITIONS.map((d) => [
          d.key,
          d.type === "text"
            ? text(500)
            : {
                type: "number",
                ...(d.exclusiveMin
                  ? { exclusiveMinimum: d.min }
                  : { minimum: d.min }),
                maximum: d.max,
              },
        ]),
      ),
    ),
    arrangement: enumeration(["simultaneous", "sequence", "compound"]),
    includeBaseText: { type: "boolean" },
  },
  ["version", "techniqueIds"],
);
const slots = [
  "character",
  "wardrobe",
  "environment",
  "action",
  "camera",
  "lighting",
  "style",
];
const override = object({
  overrideText: nullable(text(100000)),
  overrideCompactText: nullable(text(100000)),
});
export const RECIPE_SCENE_FIELDS: Record<string, JsonRule> = {
  sceneInstructions: text(4000),
  avoidText: text(100000),
  clearSlots: {
    type: "array",
    items: enumeration(slots),
    maxItems: 7,
    uniqueItems: true,
  },
  overrides: object(
    Object.fromEntries(
      slots.filter((s) => s !== "character").map((s) => [s, override]),
    ),
  ),
  dialogue: nullable(
    object(
      {
        speaker: text(100),
        line: text(4000),
        mode: enumeration(["spoken", "on_camera", "voiceover", "off_screen"]),
        deliveryNotes: text(1000),
        performanceDirection: performance,
        language: text(100),
        captionPreference: enumeration(["unspecified", "none", "requested"]),
      },
      ["speaker", "line"],
    ),
  ),
  cameraComposition: nullable(camera),
  identitySource: enumeration(["master", "approved_anchor"]),
};
