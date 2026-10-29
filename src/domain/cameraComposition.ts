import type { ComponentSnapshot } from "../types/domain";
import type {
  CameraComposition,
  CameraCompositionChoice,
} from "../types/cinematography";
import {
  CINEMATOGRAPHY_TECHNIQUES,
  getCinematographyTechnique,
  type CameraDimension,
} from "./cinematographyRegistry";
import { CAMERA_PARAMETER_DEFINITIONS } from "./cameraCompositionParameters";
import { validateCameraComposition } from "./cameraCompositionValidation";
export { validateCameraComposition } from "./cameraCompositionValidation";
export { getCameraCompositionWarnings } from "./cameraCompositionWarnings";
export const BUILTIN_CAMERA_BLUEPRINT = "builtin:camera-composition:v1";
const dimensions: CameraDimension[] = [
  "shotSize",
  "height",
  "angle",
  "orientation",
  "framing",
  "lens",
  "focus",
  "composition",
  "movement",
  "rig",
  "capture",
  "specialized",
  "property",
  "graphics",
];
export const CAMERA_DIMENSION_LABELS: Record<CameraDimension, string> = {
  shotSize: "Shot size",
  height: "Physical camera height",
  angle: "Viewing angle",
  orientation: "Frame orientation",
  framing: "Framing and viewpoint",
  lens: "Lens and optics",
  focus: "Focus",
  composition: "Composition",
  movement: "Camera movement",
  rig: "Rig / support",
  capture: "Exposure and capture",
  specialized: "Specialized technique",
  property: "Property recipe",
  graphics: "Source-based graphics",
};
const order = new Map(CINEMATOGRAPHY_TECHNIQUES.map((t, i) => [t.id, i]));
export function composeCameraDirections(
  composition: CameraComposition,
): string {
  const error = validateCameraComposition(composition);
  if (error) throw new Error(error);
  const selectionOrder = new Map(
    composition.techniqueIds.map((id, index) => [id, index]),
  );
  const selected = composition.techniqueIds
    .map((id) => getCinematographyTechnique(id)!)
    .sort(
      (a, b) =>
        dimensions.indexOf(a.dimension!) - dimensions.indexOf(b.dimension!) ||
        (a.dimension === "movement"
          ? selectionOrder.get(a.id)! - selectionOrder.get(b.id)!
          : order.get(a.id)! - order.get(b.id)!),
    );
  let movementIndex = 0;
  const lines = selected.map((t) => {
    const label =
      t.dimension === "movement"
        ? (["Primary movement", "Secondary movement"][movementIndex++] ??
          `Additional movement ${movementIndex}`)
        : CAMERA_DIMENSION_LABELS[t.dimension!];
    return `${label} — ${t.name}: ${t.direction}`;
  });
  for (const definition of CAMERA_PARAMETER_DEFINITIONS) {
    const value = composition.parameters?.[definition.key];
    if (value === undefined || (typeof value === "string" && !value.trim()))
      continue;
    lines.push(
      `${definition.label}: ${typeof value === "string" ? value.trim() : value}${definition.unit ? ` ${definition.unit}` : ""}.`,
    );
  }
  if (!lines.length) return "";
  if (composition.arrangement === "sequence")
    lines.push(
      "Movement arrangement: perform the movement components in their listed order, preserving the stated holds and transitions.",
    );
  if (composition.arrangement === "compound")
    lines.push(
      "Movement arrangement: the specified components form one deliberate compound move.",
    );
  return ["Camera direction (scene only):", ...lines].join("\n");
}
export function applyCameraComposition(
  snapshot: ComponentSnapshot | undefined,
  choice: CameraCompositionChoice,
): ComponentSnapshot | undefined {
  const error = validateCameraComposition(choice);
  if (error) throw new Error(error);
  if (snapshot && snapshot.slot !== "camera")
    throw new Error("Camera composition can only change the Camera slot.");
  const original = structuredClone(snapshot),
    existing = original?.cameraComposition;
  const metadata: CameraComposition = {
    version: 1,
    techniqueIds: [...choice.techniqueIds],
    ...(choice.parameters
      ? { parameters: structuredClone(choice.parameters) }
      : {}),
    ...(choice.arrangement ? { arrangement: choice.arrangement } : {}),
    ...(choice.includeBaseText !== undefined
      ? { includeBaseText: choice.includeBaseText }
      : {}),
  };
  const direction = composeCameraDirections(metadata);
  if (!direction)
    return original ? resetCameraComposition(original) : undefined;
  const base =
    original ??
    ({
      slot: "camera",
      sourceType: "template",
      sourceId: BUILTIN_CAMERA_BLUEPRINT,
      sourceRevision: 1,
      sourceTitle: "Scene-only Camera composition",
      promptText: "",
      mediaLinks: [],
    } satisfies ComponentSnapshot);
  const baselineText = existing
      ? existing.baselineOverrideText
      : base.overrideText,
    baselineCompact = existing
      ? existing.baselineOverrideCompactText
      : base.overrideCompactText;
  if (baselineText !== undefined) metadata.baselineOverrideText = baselineText;
  if (baselineCompact !== undefined)
    metadata.baselineOverrideCompactText = baselineCompact;
  // Only a blueprint created by this composition is disposable on reset.
  // An existing manually authored blueprint has its own baseline to restore.
  if (!original || existing?.sceneOnly) metadata.sceneOnly = true;
  const fullBase = baselineText ?? base.promptText,
    compactBase = baselineText
      ? (baselineCompact ?? baselineText)
      : (base.compactText ?? base.promptText);
  const join = (text: string) =>
    [
      ...(metadata.includeBaseText === false ? [] : text ? [text] : []),
      direction,
    ].join("\n\n");
  return {
    ...base,
    cameraComposition: metadata,
    overrideText: join(fullBase),
    overrideCompactText: join(compactBase),
  };
}
export function resetCameraComposition(
  snapshot: ComponentSnapshot,
): ComponentSnapshot | undefined {
  const metadata = snapshot.cameraComposition;
  if (!metadata) return snapshot;
  const error = validateCameraComposition(metadata, snapshot.slot);
  if (error) throw new Error(error);
  if (metadata.sceneOnly && snapshot.sourceId === BUILTIN_CAMERA_BLUEPRINT)
    return;
  const result = structuredClone(snapshot);
  delete result.cameraComposition;
  delete result.overrideText;
  delete result.overrideCompactText;
  if (metadata.baselineOverrideText !== undefined)
    result.overrideText = metadata.baselineOverrideText;
  if (metadata.baselineOverrideCompactText !== undefined)
    result.overrideCompactText = metadata.baselineOverrideCompactText;
  return result;
}
export function rebaseCameraComposition(
  previous: ComponentSnapshot | undefined,
  next: ComponentSnapshot,
): ComponentSnapshot {
  const metadata = previous?.cameraComposition;
  if (!metadata) return next;
  return (
    applyCameraComposition(next, {
      version: 1,
      techniqueIds: metadata.techniqueIds,
      parameters: metadata.parameters,
      arrangement: metadata.arrangement,
      includeBaseText: metadata.includeBaseText,
    }) ?? next
  );
}
export function clearCameraComposition(
  snapshot: ComponentSnapshot,
): ComponentSnapshot {
  const result = { ...snapshot };
  delete result.cameraComposition;
  return result;
}
