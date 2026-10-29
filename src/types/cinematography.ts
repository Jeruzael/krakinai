export interface CameraMotionParameters {
  direction?: string;
  path?: string;
  startFraming?: string;
  endFraming?: string;
  speed?: string;
  acceleration?: string;
  deceleration?: string;
  easing?: string;
  subjectTracking?: string;
  stabilization?: string;
  parallax?: string;
  foregroundBackground?: string;
  motivation?: string;
  primaryMovement?: string;
  secondaryMovement?: string;
  travelDistanceMetres?: number;
  rotationDegrees?: number;
  arcRadiusMetres?: number;
  movementSeconds?: number;
  initialHoldSeconds?: number;
  finalHoldSeconds?: number;
  focalLengthMm?: number;
  endingFocalLengthMm?: number;
  sensorFormat?: string;
  apertureFNumber?: number;
  iso?: number;
  frameRate?: number;
  shutterAngleDegrees?: number;
  shutterSeconds?: number;
  whiteBalanceKelvin?: number;
  exposureCompensationEV?: number;
}
export interface CameraComposition {
  version: 1;
  techniqueIds: string[];
  parameters?: CameraMotionParameters;
  arrangement?: "simultaneous" | "sequence" | "compound";
  includeBaseText?: boolean;
  baselineOverrideText?: string;
  baselineOverrideCompactText?: string;
  sceneOnly?: true;
}
export type CameraCompositionChoice = Pick<
  CameraComposition,
  "version" | "techniqueIds" | "parameters" | "arrangement" | "includeBaseText"
>;
export interface CameraCompositionAdvice {
  id: string;
  severity: "review" | "information";
  title: string;
  explanation: string;
}
