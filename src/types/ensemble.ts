import type {
  ComponentSnapshot,
  DialogueConfig,
  ReferencePack,
  SceneGenerationChoice,
} from "./domain";
export const ENSEMBLE_LOCAL_ID_PATTERN='^(?!(?:constructor|prototype|__proto__)$)[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$';
export const ENSEMBLE_LIMITS = Object.freeze({
  participants: 8,
  cues: 32,
  id: 64,
  role: 500,
  performanceNotes: 1000,
});
export interface SceneParticipant {
  id: string;
  character: ComponentSnapshot;
  wardrobe?: ComponentSnapshot;
  role?: string;
  presence: "on_camera" | "off_camera";
  performanceNotes?: string;
  generation?: SceneGenerationChoice;
}
export interface DialogueCue extends DialogueConfig {
  id: string;
  participantId?: string;
  timing?: { startSeconds: number; endSeconds: number };
}
export interface SceneEnsembleV1 {
  version: 1;
  primaryParticipantId: string | null;
  participants: SceneParticipant[];
  dialogueCues: DialogueCue[];
}
export interface EnsembleTemplateDefaultV1 {
  version: 1;
  ensemble: SceneEnsembleV1;
  referencePack?: ReferencePack;
}
