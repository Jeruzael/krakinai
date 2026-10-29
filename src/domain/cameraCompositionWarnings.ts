import type { ShotType } from "../types/domain";
import type {
  CameraComposition,
  CameraCompositionAdvice,
} from "../types/cinematography";
import { getCinematographyTechnique } from "./cinematographyRegistry";
import { validateCameraComposition } from "./cameraCompositionValidation";
function positive(text: string, pattern: RegExp): boolean {
  return text
    .replace(/[“"][^”"]*[”"]/g, "")
    .split(/[.;\n]|\bbut\b/i)
    .some((clause) => {
      const match = pattern.exec(clause);
      return (
        match !== null &&
        !/\b(?:no|not|never|without|avoid|don't|doesn't|isn't)\b/i.test(
          clause.slice(0, match.index + match[0].length),
        )
      );
    });
}
export function getCameraCompositionWarnings(
  composition: CameraComposition,
  context: {
    shotType?: ShotType;
    durationSeconds?: number;
    sceneInstructions?: string;
    baseCameraText?: string;
  } = {},
): CameraCompositionAdvice[] {
  const warnings: CameraCompositionAdvice[] = [],
    add = (
      id: string,
      title: string,
      explanation: string,
      severity: "review" | "information" = "review",
    ) => {
      if (!warnings.some((w) => w.id === id))
        warnings.push({ id, severity, title, explanation });
    };
  const error = validateCameraComposition(composition);
  if (error) {
    add("camera-metadata", "Review Camera composition metadata", error);
    return warnings;
  }
  const selected = composition.techniqueIds.map(
      (id) => getCinematographyTechnique(id)!,
    ),
    moves = selected.filter((t) => t.dimension === "movement"),
    parameters = composition.parameters ?? {};
  const sequence = composition.arrangement === "sequence",
    compound = composition.arrangement === "compound",
    hasStatic = moves.some((t) => t.motionKind === "static"),
    hasTravel = moves.some(
      (t) => t.motionKind === "translation" || t.motionKind === "compound",
    ),
    hasRotation = moves.some((t) => t.motionKind === "rotation"),
    hasZoom = moves.some(
      (t) => t.motionKind === "optical" || t.name.startsWith("Dolly zoom"),
    );
  if (!sequence && hasStatic && hasTravel)
    add(
      "camera-static-travel",
      "Static camera and physical travel overlap",
      "A locked camera body and physical translation cannot be the same phase. Choose a staged sequence or remove the contradictory move.",
    );
  if (!sequence && hasStatic && hasRotation)
    add(
      "camera-static-rotation",
      "Locked viewing direction and rotation overlap",
      "A held locked orientation and pan, tilt or roll conflict in the same phase. A fixed tripod can still support rotation when it is intentional.",
    );
  if (
    !sequence &&
    !compound &&
    moves.filter((t) => t.motionKind !== "static").length > 1
  )
    add(
      "camera-multiple-moves",
      "Confirm multiple movement components",
      "Choose Intentional compound or Sequential phases when these directions form a deliberate combination; otherwise select one primary move.",
    );
  if (
    !sequence &&
    selected.some((t) => t.focusKind === "fixed") &&
    selected.some((t) => t.focusKind === "transition")
  )
    add(
      "camera-focus-conflict",
      "Fixed focus and focus transition overlap",
      "A fixed focus distance conflicts with a simultaneous focus pull. Camera-body stability alone does not conflict with changing focus.",
    );
  if (!sequence) {
    const names = selected
      .filter((t) => t.family === "G")
      .map((t) => t.name.toLowerCase());
    if (
      (names.some((n) => n === "prime lens") &&
        names.some((n) => n === "zoom lens")) ||
      (names.some((n) => n === "fisheye lens") &&
        names.some((n) => n === "rectilinear lens")) ||
      (names.some((n) => n === "spherical lens") &&
        names.some((n) => n === "anamorphic lens"))
    )
      add(
        "camera-lens-equipment",
        "Review incompatible optical declarations",
        "The selected optical designs are alternatives for one capture path. Specify separate phases or choose the intended lens configuration.",
      );
    if (
      parameters.focalLengthMm !== undefined &&
      parameters.endingFocalLengthMm !== undefined &&
      parameters.focalLengthMm !== parameters.endingFocalLengthMm &&
      !hasZoom
    )
      add(
        "camera-focal-endpoints",
        "Focal length changes without a zoom plan",
        "Starting and ending focal lengths differ. Specify an intentional optical transition or keep the focal length fixed. A physical dolly does not change lens focal length.",
      );
  }
  if (
    parameters.movementSeconds === 0 &&
    (hasTravel || (parameters.travelDistanceMetres ?? 0) > 0)
  )
    add(
      "camera-zero-travel-time",
      "Travel has zero movement time",
      "A nonzero physical move needs a positive movement interval. Revise distance or duration before relying on this plan.",
    );
  const allocated =
    (parameters.movementSeconds ?? 0) +
    (parameters.initialHoldSeconds ?? 0) +
    (parameters.finalHoldSeconds ?? 0);
  if (
    context.durationSeconds !== undefined &&
    allocated > context.durationSeconds
  )
    add(
      "camera-timing-overflow",
      "Movement and holds exceed shot duration",
      `The specified intervals total ${allocated}s, while the shot is ${context.durationSeconds}s. Revise the intervals or intended shot duration.`,
    );
  if (
    !sequence &&
    hasStatic &&
    !hasZoom &&
    !selected.some((t) => t.family === "O" && /zoom|crop|pan/i.test(t.name)) &&
    parameters.startFraming?.trim() &&
    parameters.endFraming?.trim() &&
    parameters.startFraming.trim().toLowerCase() !==
      parameters.endFraming.trim().toLowerCase()
  )
    add(
      "camera-framing-endpoints",
      "Fixed framing has different endpoints",
      "A fully fixed view needs matching start/end framing, or an explicit optical/digital reframe or subsequent movement phase.",
    );
  const shotType = context.shotType ?? "character_scene",
    inapplicable = selected.filter((t) => !t.shotTypes.includes(shotType));
  if (inapplicable.length)
    add(
      "camera-source-applicability",
      "Review Camera choices for this Shot Type",
      `${inapplicable.map((t) => t.name).join(", ")} are not recommended for ${shotType.replaceAll("_", " ")}. Original graphics and footage do not provide new physical viewpoints. Use source-preserving editing directions or adequate actual spatial source.`,
    );
  if (
    shotType === "graphic_motion" &&
    selected.some((t) => /layer.*parallax|parallax.*layer/i.test(t.name))
  )
    add(
      "camera-graphic-layers",
      "Parallax requires actual source layers",
      "Use only supplied separate depth layers. Do not treat a flat floor-plan image as a three-dimensional modeled environment.",
      "information",
    );
  const authored = [
    context.sceneInstructions ?? "",
    ...(composition.includeBaseText === false
      ? []
      : [context.baseCameraText ?? ""]),
  ].join("\n");
  if (
    !sequence &&
    hasTravel &&
    positive(
      authored,
      /(?:\bcamera\b[^.;\n]{0,45}\b(?:locked[- ]off|static|stationary)|\b(?:locked[- ]off|static)\s+camera\b)/i,
    )
  )
    add(
      "camera-instruction-conflict",
      "Camera travel contradicts authored directions",
      "The authored shot or included preset explicitly fixes the camera, while the composition requests travel. Review the base text, omit it explicitly, or specify separate phases.",
    );
  if (
    !compound &&
    !sequence &&
    positive(
      authored,
      /\bpan\s+(?:the\s+)?(?:camera\s+)?(?:physically\s+)?(?:sideways|laterally)\b/i,
    )
  )
    add(
      "camera-pan-truck",
      "Pan and lateral travel need separate wording",
      "A pan rotates the viewing direction; a truck translates the camera. Describe a deliberate compound move explicitly when both are intended.",
    );
  if (
    positive(
      authored,
      /\b(?:optical|digital)\s+zoom\b[^.;\n]{0,45}\b(?:physical\s+parallax|moves?\s+the\s+camera)\b/i,
    )
  )
    add(
      "camera-zoom-dolly",
      "Zoom and physical viewpoint change are different",
      "Optical or digital zoom does not physically translate the camera. Specify a separate dolly move when real changing viewpoint or parallax is intended.",
    );
  return warnings;
}
