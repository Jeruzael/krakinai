import type { MediaLink, ShotType } from "./domain";
import type {ConversionProvenance} from './recipeConversion';

export type SceneAuthoringMode = "recipe" | "direct_prompt";
export type PromptOrigin = "manual" | "chatgpt" | "codex" | "external";
export interface DirectPromptContent {
  version: 1;
  text: string;
  origin?: PromptOrigin;
  originLabel?: string;
  importedAt?: string;
}
export interface PendingSceneInput {
  version: 1;
  id: string;
  kind: "reference_image" | "source_image" | "source_video" | "other";
  label: string;
  notes?: string;
}
export interface SceneRevision {
  version: 1;
  rootSceneId: string;
  parentSceneId?: string;
  sequence: number;
  createdAt: string;
  origin?: PromptOrigin;
  originLabel?: string;
  reason?: string;
  restoredFromSceneId?: string;
}
export interface SceneProjectTarget {
  collectionId: string;
  shotId?: string;
  newShot?: { title: string; plannedShotType?: ShotType };
  expectedProjectRevision: number;
}
export interface SceneRevisionIntent {
  version: 1;
  kind: "revision" | "take";
  parentSceneId: string;
  rootSceneId: string;
  expectedHeadId: string;
  /** The saved scene explicitly opened in the target shot, distinct from restore content/head. */
  contextSceneId?: string;
  reason?: string;
  restoredFromSceneId?: string;
}
export interface SceneAuthoringFields {
  conversionProvenance?:ConversionProvenance;
  authoringMode?: SceneAuthoringMode;
  directPrompt?: DirectPromptContent;
  directReferences?: MediaLink[];
  pendingInputs?: PendingSceneInput[];
  /** User-entered flags only; this is not automatic factual verification. */
  claimNotes?: string;
}

/** Future extraction contract only. No automatic extraction or asset writes. */
export interface ReusableAssetCandidateV1 {
  version: 1;
  id: string;
  sourceSceneId: string;
  kind:
    | "character"
    | "wardrobe"
    | "environment"
    | "action"
    | "camera"
    | "lighting"
    | "style"
    | "template";
  proposedText: string;
  origin: PromptOrigin;
  approval: "pending";
}
