import type {
  BuilderSlot,
  DialogueConfig,
  Collection,
  MediaAsset,
  Preferences,
  ProductionStatus,
  PromptAsset,
  SavedScene,
  SceneDraft,
  SceneSettings,
  ShotType,
  Template,
  Variant,
} from "./domain";
import type {
  DirectPromptContent,
  PendingSceneInput,
  PromptOrigin,
} from "./sceneAuthoring";
import type { CameraCompositionChoice } from "./cinematography";
export type RecordTarget = { id: string } | { ref: string };
export type ProjectTarget =
  { id: string; expectedRevision: number } | { ref: string };
export type CandidateKind =
  | "character"
  | "wardrobe"
  | "environment"
  | "action"
  | "camera"
  | "lighting"
  | "style"
  | "template";
export interface OperationBase {
  operationId: string;
  type: string;
  clientRef?: string;
}
export interface ShotMetadata {
  code?: string;
  title?: string;
  plannedShotType?: ShotType;
  plannedDurationSeconds?: number;
  continuityNotes?: string;
}
export interface ImportedMediaLink {
  mediaId: string;
  role?: "reference" | "sample";
  altText?: string;
  mimeType?: string;
}
export interface ImportedAssetLink {
  asset: RecordTarget;
  slot: BuilderSlot;
  expectedRevision?: number;
}
export interface ImportedClaim {
  kind:
    "property" | "financial" | "payment" | "travel_time" | "location" | "other";
  text: string;
  verified: false;
}
export interface ImportedSceneFields {
  title?: string;
  prompt?: DirectPromptContent;
  shotType?: ShotType;
  settings?: SceneSettings;
  references?: ImportedMediaLink[];
  sourceMedia?: ImportedMediaLink[];
  assetRefs?: ImportedAssetLink[];
  variantRefs?: {
    variantId: string;
    expectedRevision: number;
    slot: BuilderSlot;
  }[];
  pendingInputs?: PendingSceneInput[];
  claimNotes?: string;
  claims?: ImportedClaim[];
  reason?: string;
}
type ProjectCreate = OperationBase & {
  type: "project.create";
  clientRef: string;
  name: string;
  description?: string;
  planningNotes?: string;
};
type ProjectUpdate = OperationBase & {
  type: "project.update";
  project: ProjectTarget;
  name?: string;
  description?: string;
  planningNotes?: string;
};
type ShotCreate = OperationBase &
  ShotMetadata & {
    type: "shot.create";
    clientRef: string;
    project: ProjectTarget;
    code: string;
    title: string;
  };
type ShotUpdate = OperationBase &
  ShotMetadata & {
    type: "shot.update";
    project: ProjectTarget;
    shot: RecordTarget;
  };
type ShotReorder = OperationBase & {
  type: "shot.reorder";
  project: ProjectTarget;
  shots: RecordTarget[];
};
type SceneCreate = OperationBase &
  ImportedSceneFields & {
    type: "scene.create_direct_prompt";
    clientRef: string;
    title: string;
    prompt: DirectPromptContent;
    project?: ProjectTarget;
    shot?: RecordTarget;
  };
type SceneVersion = OperationBase &
  ImportedSceneFields & {
    type: "scene.revise" | "scene.create_take" | "scene.restore";
    clientRef: string;
    sceneId: string;
    expectedHeadId: string;
    restoreFromSceneId?: string;
    project?: ProjectTarget;
    shot?: RecordTarget;
  };
type Attach = OperationBase & {
  type: "shot.attach_take";
  project: ProjectTarget;
  shot: RecordTarget;
  scene: RecordTarget;
};
type Select = OperationBase & {
  type: "shot.select_take";
  project: ProjectTarget;
  shot: RecordTarget;
  scene: RecordTarget;
  expectedSelectedSceneId: string | null;
};
type Status = OperationBase & {
  type: "shot.set_status";
  project: ProjectTarget;
  shot: RecordTarget;
  status: ProductionStatus;
  expectedStatus: ProductionStatus;
};
type Propose = OperationBase & {
  type: "asset.propose";
  clientRef: string;
  kind: CandidateKind;
  title: string;
  promptText: string;
  description?: string;
  tags: string[];
  notes?: string;
  sourceScene?: RecordTarget;
};
type Review = OperationBase & {
  type: "asset.review_candidate";
  candidateId: string;
  expectedRevision: number;
};
export interface RecipeSceneFields extends Omit<ImportedSceneFields, "prompt"> {
  sceneInstructions?: string;
  avoidText?: string;
  clearSlots?: BuilderSlot[];
  overrides?: Partial<
    Record<
      Exclude<BuilderSlot, "character">,
      {
        overrideText?: string | null;
        overrideCompactText?: string | null;
      }
    >
  >;
  dialogue?: DialogueConfig | null;
  cameraComposition?: CameraCompositionChoice | null;
  identitySource?: "master" | "approved_anchor";
}
export type RecipeSceneOperation = OperationBase &
  RecipeSceneFields & {
    clientRef: string;
    project: ProjectTarget;
    shot: RecordTarget;
  } & (
    | {
        type: "scene.create_recipe";
        title: string;
        shotType: ShotType;
        settings: SceneSettings;
      }
    | {
        type: "scene.revise_recipe" | "scene.create_recipe_take";
        sceneId: string;
        expectedHeadId: string;
      }
  );
export function isRecipeOperation(
  op: Pick<OperationBase, "type">,
): op is RecipeSceneOperation {
  return [
    "scene.create_recipe",
    "scene.revise_recipe",
    "scene.create_recipe_take",
  ].includes(op.type);
}
export type ChangeOperation =
  | ProjectCreate
  | ProjectUpdate
  | ShotCreate
  | ShotUpdate
  | ShotReorder
  | SceneCreate
  | SceneVersion
  | Attach
  | Select
  | Status
  | Propose
  | Review
  | RecipeSceneOperation;
export interface ChangeSet {
  schema: "krakinai.change-set.v1" | "krakinai.change-set.v2";
  changeSetId: string;
  source: { kind: PromptOrigin; label?: string };
  title?: string;
  description?: string;
  operations: ChangeOperation[];
}
export interface CandidateDecision {
  action: "defer" | "create" | "reuse";
  assetId?: string;
  expectedRevision?: number;
  acknowledgeDuplicate?: boolean;
}
export interface ChangeSetApproval {
  storyboard: boolean;
  scenes: boolean;
  preferred: boolean;
  statuses: boolean;
  assetDecisions: Record<string, CandidateDecision>;
  allowDuplicateSceneOperations: string[];
  /** Browser-owned consent; never a caller-supplied operation flag. */
  discardManualOutputOperations?: string[];
}
export const emptyChangeSetApproval = (): ChangeSetApproval => ({
  storyboard: false,
  scenes: false,
  preferred: false,
  statuses: false,
  assetDecisions: {},
  allowDuplicateSceneOperations: [],
});
export interface ImportCandidate {
  id: string;
  revision: number;
  kind: CandidateKind;
  title: string;
  promptText: string;
  description: string;
  tags: string[];
  notes: string;
  source: ChangeSet["source"];
  changeSetId: string;
  operationId: string;
  sourceSceneId?: string;
  status: "pending" | "created" | "reused";
  assetId?: string;
  createdAt: string;
  updatedAt: string;
}
export interface ImportMapping {
  kind: "project" | "shot" | "scene" | "candidate";
  id: string;
  assetId?: string;
}
export interface ImportOperationResult {
  operationId: string;
  type: ChangeOperation["type"];
  recordId?: string;
  status:
    | "created"
    | "updated"
    | "candidate_pending"
    | "asset_created"
    | "asset_reused"
    | "unchanged";
}
export interface ChangeSetReceipt {
  version: 1;
  changeSetId: string;
  packageDigest: string;
  approvedDigest: string;
  source: ChangeSet["source"];
  title?: string;
  preparedAt?: string;
  appliedAt: string;
  approval: ChangeSetApproval;
  idMappings: Record<string, ImportMapping>;
  operations: ImportOperationResult[];
  projectRevisions: Record<string, { before: number; after: number }>;
}
export interface ImportLedger {
  version: 1;
  receipts: ChangeSetReceipt[];
  candidates: ImportCandidate[];
}
export interface ImportFinding {
  operationId?: string;
  severity: "blocking" | "advisory";
  code: string;
  message: string;
}
export interface CandidateMatch {
  id: string;
  title: string;
  revision: number;
  reason: string;
  kind: CandidateKind;
}
export interface ImportOperationPreview {
  operationId: string;
  type: ChangeOperation["type"];
  summary: string;
  projectId?: string;
  shotId?: string;
  currentPrompt?: string;
  proposedPrompt?: string;
  matches?: CandidateMatch[];
  details: unknown;
  resolved?: unknown;
}
export interface ChangeSetAllocation {
  preparedAt: string;
  ids: Record<string, string>;
}
export interface ChangeSetPlan {
  findings: ImportFinding[];
  operations: ImportOperationPreview[];
  idMappings: Record<string, ImportMapping>;
  results: ImportOperationResult[];
  collections: Collection[];
  scenes: SavedScene[];
  assets: PromptAsset[];
  templates: Template[];
  candidates: ImportCandidate[];
  projectRevisions: ChangeSetReceipt["projectRevisions"];
  stateSignature: string;
  summary: {
    projects: number;
    shots: number;
    scenes: number;
    candidates: number;
    pendingInputs: number;
    plannedSeconds: number;
  };
}
export interface ChangeSetPreview {
  version: 1;
  changeSet: ChangeSet;
  approval: ChangeSetApproval;
  packageDigest: string;
  approvedDigest: string;
  allocation: ChangeSetAllocation;
  plan: ChangeSetPlan;
  replay?: ChangeSetReceipt;
}
export interface ChangeSetState {
  collections: Collection[];
  scenes: SavedScene[];
  assets: PromptAsset[];
  variants?: Variant[];
  drafts?: SceneDraft[];
  templates: Template[];
  media: MediaAsset[];
  preferences: Preferences;
}
