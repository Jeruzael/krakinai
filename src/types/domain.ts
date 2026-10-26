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

export interface ProvenanceMetadata {
  toolName?: string;
  modelLabel?: string;
  seed?: string;
  aspectRatio?: string;
  settingsNotes?: string;
}

export interface MediaAsset {
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
  associationId: string;
  mediaId: string;
  sourceSlot: BuilderSlot | 'result' | 'legacy';
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

export interface DialogueConfig {
  speaker: string;
  line: string;
  mode?: 'spoken' | 'on_camera' | 'voiceover' | 'off_screen';
  deliveryNotes?: string;
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

export interface SceneDraft {
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

export interface SavedScene {
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
  outputs: Record<OutputMode, string>;
  manualOutputs: Partial<Record<OutputMode, ManualOutputOverride>>;
  references: MediaLink[];
  sourceSceneId?: string;
  resultMediaLinks: MediaLink[];
  reviewNotes: string;
  reviewStatus: ReviewStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export type CollectionMemberType = 'asset' | 'variant' | 'scene';

export interface CollectionMemberRef {
  type: CollectionMemberType;
  id: string;
  addedAt: string;
}

export interface Collection {
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
  id: 'app_preferences';
  schemaVersion: number;
  starterLoaded: boolean;
  activeDraftId?: string;
  lastCategorySort?: 'updated' | 'newest' | 'az';
  updatedAt: string;
}
