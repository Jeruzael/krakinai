import type { CameraMotionParameters } from "../types/cinematography";
export interface CameraParameterDefinition {
  key: keyof CameraMotionParameters;
  label: string;
  type: "text" | "number";
  unit?: string;
  min?: number;
  max?: number;
  exclusiveMin?: boolean;
  advanced?: boolean;
}
const text = (
  key: keyof CameraMotionParameters,
  label: string,
  advanced = false,
): CameraParameterDefinition => ({ key, label, type: "text", advanced });
const number = (
  key: keyof CameraMotionParameters,
  label: string,
  min: number,
  max: number,
  unit: string,
  exclusiveMin = false,
  advanced = false,
): CameraParameterDefinition => ({
  key,
  label,
  type: "number",
  min,
  max,
  unit,
  exclusiveMin,
  advanced,
});
export const CAMERA_PARAMETER_DEFINITIONS: CameraParameterDefinition[] = [
  text("direction", "Direction"),
  text("path", "Movement path"),
  text("startFraming", "Start framing"),
  text("endFraming", "End framing"),
  text("speed", "Speed"),
  text("acceleration", "Acceleration"),
  text("deceleration", "Deceleration"),
  text("easing", "Ease-in / ease-out"),
  number("travelDistanceMetres", "Travel distance", 0, 100000, "m"),
  number("rotationDegrees", "Rotation angle", -3600, 3600, "degrees"),
  number("arcRadiusMetres", "Arc radius", 0, 100000, "m", true),
  number("movementSeconds", "Movement duration", 0, 86400, "s"),
  number("initialHoldSeconds", "Initial hold", 0, 86400, "s"),
  number("finalHoldSeconds", "Final hold", 0, 86400, "s"),
  text("subjectTracking", "Subject tracking / target lock"),
  text("stabilization", "Stabilization"),
  text("parallax", "Parallax strength"),
  text("foregroundBackground", "Foreground / background relationship"),
  text("motivation", "Motivating subject or reveal"),
  text("primaryMovement", "Primary movement notes"),
  text("secondaryMovement", "Secondary movement notes"),
  number("focalLengthMm", "Starting focal length", 0, 3000, "mm", true, true),
  number(
    "endingFocalLengthMm",
    "Ending focal length",
    0,
    3000,
    "mm",
    true,
    true,
  ),
  text("sensorFormat", "Camera / sensor format", true),
  number("apertureFNumber", "Aperture", 0.1, 128, "f-number", false, true),
  number("iso", "Exposure index / ISO", 1, 10000000, "ISO", false, true),
  number("frameRate", "Capture frame rate", 0, 1000000, "fps", true, true),
  number("shutterAngleDegrees", "Shutter angle", 0, 360, "degrees", true, true),
  number("shutterSeconds", "Shutter exposure time", 0, 3600, "s", true, true),
  number("whiteBalanceKelvin", "White balance", 1000, 50000, "K", false, true),
  number(
    "exposureCompensationEV",
    "Exposure compensation",
    -20,
    20,
    "EV",
    false,
    true,
  ),
];
