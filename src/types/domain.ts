import type {CameraComposition} from './cinematography';
import type {SceneEnsembleV1,EnsembleTemplateDefaultV1} from './ensemble';
import type {ImportLedger} from './changeSet';
import type {SceneBlockingV1} from './blocking';
import type {KeyframePlanV1,ImagePromptSnapshotV1,ManualImageOutputs} from './keyframes';
import type {FrameProductionV1,DraftFrameImageAssignment} from './frameProduction';
import type {DirectPromptContent, SceneAuthoringFields, SceneProjectTarget, SceneRevision, SceneRevisionIntent} from './sceneAuthoring';
export const SCHEMA_VERSION = 1;

export type PromptCategory =
  | 'characters'
  | 'wardrobe'
  | 'actions'
  | 'environments'
  | 'camera'
  | 'lighting'
  | 'styles';

export type BuilderSlot =
  | 'character'
  | 'wardrobe'
  | 'environment'
  | 'action'
  | 'camera'
  | 'lighting'
  | 'style';

export type VariantType =
  | 'Outfit'
  | 'Expression'
  | 'Pose'
  | 'Camera Angle'
  | 'Location'
  | 'Visual Style';

export type MediaRole = 'reference' | 'sample' | 'result';

export type ReviewStatus = 'unreviewed' | 'user-approved';

export type AspectRatioOption = '16:9' | '9:16' | '1:1';

export type OutputMode = 'full' | 'structured' | 'compact';

export type ShotType = 'character_scene' | 'property_environment' | 'graphic_motion' | 'existing_footage';

export interface ProvenanceMetadata {
  toolName?: string;
  modelLabel?: string;
  seed?: string;
  aspectRatio?: string;
  settingsNotes?: string;
}

export interface MediaAsset {
  displayName?: string;
  exportFilename?: string;
  id: string;
  filename: string;
  safeFilename: string;
  mimeType: string;
  byteSize: number;
  blob: Blob;
  posterBlob?: Blob;
  width?: number;
  height?: number;
  durationSeconds?: number;
  isBundledIllustration?: boolean;
  createdAt: string;
}

export interface MediaLink {
  displayName?: string;
  exportFilename?: string;
  namesCaptured?: true;
  mediaId: string;
  role: MediaRole;
  altText: string;
  viewLabel?: string;
  order: number;
  filename?: string;
  mimeType?: string;
}

export interface IdentityAnchor {
  text: string;
  approvedText?: string;
  approvedMasterIdentityRevision?: number;
  approvedAt?: string;
}

export interface SceneGenerationChoice {
  identitySource: 'master' | 'approved_anchor';
  anchor?: { text: string; approvedMasterIdentityRevision: number; approvedAt: string };
  fallbackReason?: string;
}

export interface ReferencePackEntry {
  participantId?: string;
  displayName?: string;
  exportFilename?: string;
  namesCaptured?: true;
  associationId: string;
  mediaId: string;
  sourceSlot: BuilderSlot | 'result' | 'legacy' | 'source';
  sourceId: string;
  sourceTitle: string;
  role: MediaRole;
  altText: string;
  filename?: string;
  mimeType?: string;
  purpose: 'identity' | 'outfit' | 'environment' | 'motion' | 'general';
  order: number;
}

export interface ReferencePack { version: 1; entries: ReferencePackEntry[] }

export interface PromptAsset {
  identityRevision?: number;
  identityAnchor?: IdentityAnchor;
  id: string;
  title: string;
  category: PromptCategory;
  description: string;
  promptText: string;
  compactText?: string;
  avoidText?: string;
  tags: string[];
  mediaLinks: MediaLink[];
  coverMediaId?: string;
  favorite: boolean;
  reviewStatus: ReviewStatus;
  provenance: ProvenanceMetadata;
  notes: string;
  isStarter?: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface Variant {
  id: string;
  parentCharacterId: string;
  type: VariantType;
  targetSlot: BuilderSlot;
  title: string;
  description?: string;
  promptText: string;
  compactText?: string;
  avoidText?: string;
  tags: string[];
  mediaLinks: MediaLink[];
  coverMediaId?: string;
  favorite: boolean;
  reviewStatus: ReviewStatus;
  notes?: string;
  isStarter?: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export type SnapshotSourceType = 'asset' | 'variant' | 'template';

export interface ComponentSnapshot {
  cameraComposition?: CameraComposition;
  identityRevision?: number;
  identityAnchor?: IdentityAnchor;
  slot: BuilderSlot;
  sourceType: SnapshotSourceType;
  sourceId: string;
  sourceRevision: number;
  sourceTitle: string;
  parentCharacterId?: string;
  promptText: string;
  compactText?: string;
  avoidText?: string;
  mediaLinks: MediaLink[];
  overrideText?: string;
  overrideCompactText?: string;
}

export type DialogueDeliveryStyle = 'calm' | 'angry' | 'sad' | 'happy' | 'nervous' | 'confident' | 'apologetic' | 'sarcastic' | 'energetic' | 'playful' | 'urgent' | 'lecturing' | 'whispering';
export type DialogueSpeakingPace = 'slow' | 'natural' | 'fast';
export type DialogueBodyLanguage = 'subtle' | 'natural' | 'expressive' | 'strong_pointing';
export interface DialoguePerformanceDirectionV1 {
  version: 1;
  styles: DialogueDeliveryStyle[];
  pace?: DialogueSpeakingPace;
  gestures?: DialogueBodyLanguage;
}

export interface DialoguePerformanceDirectionV2 {
  version: 2;
  emotion?: {
    primary?: import('../domain/performanceCatalog').EmotionId;
    secondary?: import('../domain/performanceCatalog').EmotionId;
    intensity?: 'subtle' | 'mild' | 'moderate' | 'strong' | 'extreme';
    custom?: string;
  };
  techniques?: import('../domain/performanceCatalog').TechniqueId[];
  customTechnique?: string;
  voice?: import('../domain/performanceCatalog').VoiceDirection;
  speech?: import('../domain/performanceCatalog').SpeechDirection;
  gestures?: import('../domain/performanceCatalog').BodyGesture[];
}
export type DialoguePerformanceDirection = DialoguePerformanceDirectionV1 | DialoguePerformanceDirectionV2;

export interface DialogueConfig {
  speaker: string;
  line: string;
  mode?: 'spoken' | 'on_camera' | 'voiceover' | 'off_screen';
  deliveryNotes?: string;
  performanceDirection?: DialoguePerformanceDirection;
  language?: string;
  captionPreference?: 'unspecified' | 'none' | 'requested';
}

export interface SceneSettings {
  aspectRatio?: AspectRatioOption;
  durationSeconds?: number;
  toolNotes?: string;
}

export interface ManualOutputOverride {
  text: string;
  basedOnInputRevision: number;
  updatedAt: string;
}

export interface SceneDraft extends SceneAuthoringFields {
  frameImageAssignments?:Record<string,DraftFrameImageAssignment>;
  keyframePlan?:KeyframePlanV1;
  imagePromptSnapshots?:Record<string,ImagePromptSnapshotV1>;
  manualImageOutputs?:ManualImageOutputs;
  blocking?:SceneBlockingV1;
  ensemble?:SceneEnsembleV1;
  revisionIntent?: SceneRevisionIntent;
  authoredProjectTarget?: SceneProjectTarget;
  inheritedAvoidPrefix?: string;
  shotType?: ShotType;
  sourceMediaLinks?: MediaLink[];
  generation?: SceneGenerationChoice;
  referencePack?: ReferencePack;
  id: string;
  title: string;
  slots: Partial<Record<BuilderSlot, ComponentSnapshot>>;
  extraRequiredSlots: BuilderSlot[];
  sceneInstructions: string;
  avoidText?: string;
  dialogue?: DialogueConfig;
  settings: SceneSettings;
  sourceSceneId?: string;
  templateId?: string;
  inputRevision: number;
  manualOutputs: Partial<Record<OutputMode, ManualOutputOverride>>;
  resultMediaLinks: MediaLink[];
  reviewNotes: string;
  reviewStatus: ReviewStatus;
  updatedAt: string;
}

interface SavedSceneBase extends Omit<SceneAuthoringFields, 'authoringMode' | 'directPrompt'> {
  keyframePlan?:KeyframePlanV1;
  imagePromptSnapshots?:Record<string,ImagePromptSnapshotV1>;
  manualImageOutputs?:ManualImageOutputs;
  blocking?:SceneBlockingV1;
  ensemble?:SceneEnsembleV1;
  sceneRevision?: SceneRevision;
  authoredSaveFingerprint?: string;
  inheritedAvoidPrefix?: string;
  shotType?: ShotType;
  sourceMediaLinks?: MediaLink[];
  saveProjectTarget?: { collectionId: string; shotId: string };
  sourceDraftId?: string;
  sourceDraftInputRevision?: number;
  saveRequestId?: string;
  saveDecision?: 'version' | 'take';
  versionOfSceneId?: string;
  separateTakeOfSceneId?: string;
  generation?: SceneGenerationChoice;
  referencePack?: ReferencePack;
  id: string;
  title: string;
  slots: Partial<Record<BuilderSlot, ComponentSnapshot>>;
  extraRequiredSlots: BuilderSlot[];
  sceneInstructions: string;
  avoidText?: string;
  dialogue?: DialogueConfig;
  settings: SceneSettings;
  manualOutputs: Partial<Record<OutputMode, ManualOutputOverride>>;
  references: MediaLink[];
  sourceSceneId?: string;
  resultMediaLinks: MediaLink[];
  reviewNotes: string;
  reviewStatus: ReviewStatus;
  archivedAt?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export type SavedScene = SavedSceneBase & (
  | {authoringMode?: 'recipe'; directPrompt?: never; outputs: Record<OutputMode, string>}
  | {authoringMode: 'direct_prompt'; directPrompt: DirectPromptContent; outputs: {full: string; structured?: never; compact?: never}}
);

export type CollectionMemberType = 'asset' | 'variant' | 'scene';

export interface CollectionMemberRef {
  type: CollectionMemberType;
  id: string;
  addedAt: string;
}

export type ProductionStatus = 'planned' | 'prompt_ready' | 'generated' | 'reviewed' | 'final';
export type WardrobeIntentReason = 'new_day' | 'costume_change' | 'flashback' | 'timeline' | 'deliberate' | 'other';

export interface CharacterBibleEntry {
  characterId: string;
  name?: string;
  storyRole?: string;
  voiceNotes?: string;
  personality?: string;
  distinctiveFeatures?: string;
  accessories?: string;
  relationships?: string;
  notes?: string;
  approvedWardrobeVariantIds?: string[];
  referenceMediaIds?: string[];
}

export interface ProjectTransition {
  id: string;
  fromShotId: string;
  toShotId: string;
  type: 'straight_cut' | 'match_cut' | 'dissolve' | 'j_cut' | 'l_cut' | 'bridge_shot' | 'custom';
  durationSeconds?: number;
  description: string;
  notes: string;
}

export interface ProjectShot {
  plannedShotType?: ShotType;
  id: string;
  order: number;
  code: string;
  title: string;
  takeSceneIds: string[];
  selectedSceneId?: string;
  status: ProductionStatus;
  plannedDurationSeconds?: number;
  takeNotes?: Record<string, string>;
  continuityNotes?: string;
  intentionalWardrobeChange?: WardrobeIntentReason;
  firstFrameMediaId?: string;
  lastFrameMediaId?: string;
}

export interface Collection {
  planningNotes?: string;
  project?: { version: 1; revision: number; shots: ProjectShot[]; cast?: CharacterBibleEntry[]; transitions?: ProjectTransition[];frameProduction?:FrameProductionV1 };
  id: string;
  name: string;
  description: string;
  members: CollectionMemberRef[];
  coverMediaId?: string;
  isStarter?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TemplateCategory = 'Character' | 'Product' | 'B-roll' | 'Custom';

export interface TemplateSlotDefault {
  slot: BuilderSlot;
  title: string;
  promptText: string;
  compactText?: string;
  avoidText?: string;
}

export interface Template {
  ensembleDefault?:EnsembleTemplateDefaultV1;
  shotType?: ShotType;
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  requiredSlots: BuilderSlot[];
  defaults: Partial<Record<BuilderSlot, TemplateSlotDefault>>;
  sceneInstructionsDefault?: string;
  settingsDefault?: SceneSettings;
  includedCharacterSnapshot?: ComponentSnapshot;
  illustrationSvg?: string;
  isStarter: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface Preferences {
  aiImports?: ImportLedger;
  id: 'app_preferences';
  schemaVersion: number;
  starterLoaded: boolean;
  activeDraftId?: string;
  lastCategorySort?: 'updated' | 'newest' | 'az';
  updatedAt: string;
}

export interface StoryDramaticMeta {
  setupForeshadowing?: string[];
  incitingIncident?: string;
  subtext?: string;
  climax?: string;
  payoff?: string[];
  characterArcs?: Array<{
    characterAssetId: string;
    arcState: string;
    internalShift?: string;
  }>;
}

export interface StoryBeat {
  id: string;
  orderIndex: number;
  title: string;
  content: string;
  dramaticMeta?: StoryDramaticMeta;
  linkedShotId?: string;
  linkedSceneId?: string;
}

export interface StorySceneNode {
  id: string;
  orderIndex: number;
  title: string;
  summary?: string;
  environmentAssetId?: string;
  dramaticMeta?: StoryDramaticMeta;
  linkedShotIds?: string[];
  linkedSceneId?: string;
  beats: StoryBeat[];
}

export interface StorySequence {
  id: string;
  orderIndex: number;
  title: string;
  summary?: string;
  dramaticMeta?: StoryDramaticMeta;
  scenes: StorySceneNode[];
}

export interface StoryAct {
  id: string;
  orderIndex: number;
  title: string;
  summary?: string;
  dramaticMeta?: StoryDramaticMeta;
  sequences: StorySequence[];
}

export interface StoryColorScriptEntry {
  id: string;
  orderIndex: number;
  label: string;
  targetNodeId?: string;
  hexPalette: string[];
  mediaId?: string;
  lightingAssetId?: string;
  styleAssetId?: string;
  notes?: string;
}

export interface StoryReferencePack {
  assetIds: string[];
  variantIds: string[];
  mediaIds: string[];
}

export type StoryBriefingAssetKind = 'character' | 'wardrobe' | 'environment' | 'style' | 'camera';

export interface StoryContinuityLockEntry {
  id: string;
  assetType: StoryBriefingAssetKind;
  candidateRefOrId: string;
  description: string;
}

export interface StoryLightingProgressionEntry {
  id: string;
  beatRange: string;
  candidateRefOrId: string;
  setupAndMood: string;
}

export interface StoryActionArchetypeEntry {
  id: string;
  beatRange: string;
  candidateRefOrId: string;
  kinematicsAndIntensity: string;
}

export interface StoryVocalPerformanceEntry {
  id: string;
  character: string;
  beatId: string;
  emotion: string;
  deliveryTechnique: string;
  voiceCharacteristics: string;
  speechIntonation: string;
  bodyLanguage: string;
}

export interface StoryDirectorBriefing {
  pacingAuditSummary?: string;
  continuityLocks: StoryContinuityLockEntry[];
  lightingProgression: StoryLightingProgressionEntry[];
  actionArchetypes: StoryActionArchetypeEntry[];
  vocalRegister: StoryVocalPerformanceEntry[];
}

export interface Story {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  favorite: boolean;
  revisionNumber: number;
  tags: string[];
  coverMediaId?: string | null;
  heroBannerMediaId?: string | null;
  logline: string;
  premise: string;
  synopsis: string;
  treatment: string;
  fullBookText: string;
  referencePack: StoryReferencePack;
  linkedCollectionId?: string | null;
  colorScript: StoryColorScriptEntry[];
  acts: StoryAct[];
  directorBriefing?: StoryDirectorBriefing;
}

