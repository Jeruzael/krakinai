import { getCinematographyTechnique } from "./cinematographyRegistry";
import { CAMERA_PARAMETER_DEFINITIONS } from "./cameraCompositionParameters";
const record = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);
export function validateCameraCompositionSlots(
  slots: unknown,
): string | undefined {
  if (!record(slots)) return;
  for (const [slot, snapshot] of Object.entries(slots))
    if (record(snapshot)) {
      const error = validateCameraComposition(snapshot.cameraComposition, slot);
      if (error) return error;
    }
}
export function validateCameraComposition(
  value: unknown,
  slot = "camera",
): string | undefined {
  if (value === undefined) return;
  if (slot !== "camera")
    return "Camera composition metadata is only valid in the Camera slot.";
  if (!record(value) || value.version !== 1)
    return "Unsupported Camera composition version. Use a KRAKINAI build that supports this version.";
  const allowed = [
    "version",
    "techniqueIds",
    "parameters",
    "arrangement",
    "includeBaseText",
    "baselineOverrideText",
    "baselineOverrideCompactText",
    "sceneOnly",
  ];
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    return "Unsupported Camera composition field.";
  if (
    !Array.isArray(value.techniqueIds) ||
    value.techniqueIds.length > 40 ||
    new Set(value.techniqueIds).size !== value.techniqueIds.length
  )
    return "Invalid or duplicate Camera technique IDs.";
  for (const id of value.techniqueIds) {
    if (typeof id !== "string") return "Invalid Camera technique ID.";
    const technique = getCinematographyTechnique(id);
    if (
      !technique ||
      technique.owner !== "camera" ||
      technique.kind !== "technique" ||
      !technique.dimension
    )
      return "Unknown or inapplicable Camera technique ID. Lighting, Style, planning and parameter entries are not Camera selections.";
  }
  if (
    value.arrangement !== undefined &&
    !["simultaneous", "sequence", "compound"].includes(
      value.arrangement as string,
    )
  )
    return "Invalid Camera movement arrangement.";
  if (
    value.includeBaseText !== undefined &&
    typeof value.includeBaseText !== "boolean"
  )
    return "Invalid Camera base-text preference.";
  if (value.sceneOnly !== undefined && value.sceneOnly !== true)
    return "Invalid scene-only Camera blueprint marker.";
  for (const key of ["baselineOverrideText", "baselineOverrideCompactText"])
    if (
      value[key] !== undefined &&
      (typeof value[key] !== "string" || value[key].length > 100000)
    )
      return "Camera reset baseline must be text of at most 100000 characters.";
  if (value.parameters !== undefined) {
    if (!record(value.parameters))
      return "Camera parameters must be an object.";
    for (const [key, parameter] of Object.entries(value.parameters)) {
      const definition = CAMERA_PARAMETER_DEFINITIONS.find(
        (d) => d.key === key,
      );
      if (!definition) return `Unknown Camera parameter: ${key}.`;
      if (parameter === undefined) continue;
      if (definition.type === "text") {
        if (typeof parameter !== "string" || parameter.length > 500)
          return `${definition.label} must be text of at most 500 characters.`;
      } else if (
        typeof parameter !== "number" ||
        !Number.isFinite(parameter) ||
        parameter < definition.min! ||
        (definition.exclusiveMin && parameter === definition.min) ||
        parameter > definition.max!
      )
        return `${definition.label} is outside the supported planning range.`;
    }
  }
}
