import type {
  ChangeOperation,
  ChangeSet,
  CandidateKind,
  ImportedAssetLink,
  ProjectTarget,
  RecordTarget,
  RecipeSceneOperation,
  StoryCreateOperation,
  StoryUpdateOperation,
  StoryStatusOperation,
  StoryStructurePatchOperation,
  StoryDramaticMetaPatchOperation,
  StoryReferencesPatchOperation,
} from '../types/changeSet';
import type {
  BuilderSlot,
  ProductionStatus,
  SceneSettings,
  ShotType,
  DialoguePerformanceDirectionV2,
  StoryAct,
  StoryReferencePack,
  StoryColorScriptEntry,
  StoryDramaticMeta,
} from '../types/domain';
import type { CameraCompositionChoice } from '../types/cinematography';
import type { DialogueCue } from '../types/ensemble';
import type { SceneBlockingV1 } from '../types/blocking';
import type { BlockingPatchV1 } from '../types/blockingChangeSet';
import type { KeyframePlanV1, KeyframePatchV1 } from '../types/keyframes';
import { NULL_BLOCKING_DIGEST } from './blockingPatch';
import { McpError } from './mcpProtocol';
import { CINEMATOGRAPHY_TECHNIQUES, getCinematographyTechnique } from './cinematographyRegistry';
import {
  EMOTIONS,
  EMOTIONAL_INTENSITIES,
  TECHNIQUES,
  VOICE_FIELDS,
  SPEECH_FIELDS,
  GESTURES,
  conflictingTechnique,
  type TechniqueId,
} from './performanceCatalog';
import { validatePerformanceDirection } from './dialoguePerformance';

import { getShotTypeRules } from './shotTypeRules';
import { SLOT_LABELS } from './validation';

export interface StagingWarning {
  code: 'SLOT_REQUIRED_MISSING' | 'SLOT_OPTIONAL_UNASSIGNED' | 'PERFORMANCE_NORMALIZED' | 'CUE_PARTICIPANT_UNLINKED';
  operationId: string;
  slot?: BuilderSlot;
  message: string;
}

export function sceneSlotCoverageWarnings(op: RecipeSceneOperation): StagingWarning[] {
  const warnings: StagingWarning[] = [];
  const rules = getShotTypeRules({ shotType: op.shotType, extraRequiredSlots: [] });
  const assignedSlots = new Set<BuilderSlot>();
  if (op.assetRefs) {
    for (const ref of op.assetRefs) {
      if (ref.slot && ref.asset && ('id' in ref.asset || 'ref' in ref.asset)) {
        assignedSlots.add(ref.slot);
      }
    }
  }
  if (op.variantRefs) {
    for (const ref of op.variantRefs) {
      if (ref.slot && ref.variantId) {
        assignedSlots.add(ref.slot);
      }
    }
  }

  for (const req of rules.requiredSlots) {
    if (!assignedSlots.has(req)) {
      const label = SLOT_LABELS[req] || req;
      warnings.push({
        code: 'SLOT_REQUIRED_MISSING',
        operationId: op.operationId,
        slot: req,
        message: `Scene "${op.operationId}": required slot "${req}" (${label}) is missing. Bind an existing ${label} record or propose a ${req} candidate via assetRefs.`,
      });
    }
  }

  if (op.shotType === 'character_scene' && !assignedSlots.has('lighting')) {
    const label = SLOT_LABELS.lighting;
    warnings.push({
      code: 'SLOT_OPTIONAL_UNASSIGNED',
      operationId: op.operationId,
      slot: 'lighting',
      message: `Scene "${op.operationId}": optional slot "lighting" (${label}) is unassigned. Consider binding a ${label} record or candidate.`,
    });
  }

  return warnings;
}

function findCatalogKey<T extends string>(
  input: unknown,
  catalog: Record<T, string>,
): T | undefined {
  if (input === undefined || input === null) return undefined;
  const str = String(input).trim();
  if (!str) return undefined;
  if (Object.hasOwn(catalog, str)) return str as T;
  const candidateKey = str.toLowerCase().replace(/[\s-]+/g, '_');
  if (Object.hasOwn(catalog, candidateKey)) return candidateKey as T;
  const lower = str.toLowerCase();
  for (const [key, label] of Object.entries<string>(catalog)) {
    if (label.toLowerCase() === lower || key.toLowerCase() === lower) {
      return key as T;
    }
  }
  return undefined;
}

export function normalizePerformanceDirection(raw: unknown): {
  value?: DialoguePerformanceDirectionV2;
  warnings: string[];
} {
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { value: undefined, warnings };
  }
  const p = raw as Record<string, unknown>;
  if (p.version === 1) {
    if (validatePerformanceDirection(p) === undefined) {
      return { value: p as any, warnings };
    }
  }

  const result: DialoguePerformanceDirectionV2 = { version: 2 };

  if (p.emotion && typeof p.emotion === 'object' && !Array.isArray(p.emotion)) {
    const e = p.emotion as Record<string, unknown>;
    const emotionObj: Record<string, unknown> = {};
    if (e.primary !== undefined) {
      const primary = findCatalogKey(e.primary, EMOTIONS);
      if (primary) {
        emotionObj.primary = primary;
      } else {
        warnings.push(`performanceDirection.emotion.primary: "${e.primary}" is not a catalog option.`);
      }
    }
    if (e.secondary !== undefined) {
      const secondary = findCatalogKey(e.secondary, EMOTIONS);
      if (secondary) {
        if (secondary === emotionObj.primary) {
          warnings.push('Dialogue performance emotions must be distinct; dropped duplicate secondary emotion.');
        } else {
          emotionObj.secondary = secondary;
        }
      } else {
        warnings.push(`performanceDirection.emotion.secondary: "${e.secondary}" is not a catalog option.`);
      }
    }
    if (e.intensity !== undefined) {
      const intensity = findCatalogKey(e.intensity, EMOTIONAL_INTENSITIES);
      if (intensity) {
        emotionObj.intensity = intensity;
      } else {
        warnings.push(`performanceDirection.emotion.intensity: "${e.intensity}" is not a catalog option.`);
      }
    }
    if (typeof e.custom === 'string') {
      if (e.custom.length > 1000) {
        warnings.push('performanceDirection.emotion.custom truncated to 1000 characters.');
        emotionObj.custom = e.custom.slice(0, 1000);
      } else {
        emotionObj.custom = e.custom;
      }
    }
    if (Object.keys(emotionObj).length > 0) {
      result.emotion = emotionObj as any;
    }
  }

  if (Array.isArray(p.techniques)) {
    const validTechs: TechniqueId[] = [];
    for (const item of p.techniques) {
      const match = findCatalogKey(item, TECHNIQUES);
      if (!match) {
        warnings.push(`performanceDirection.techniques: "${item}" is not a catalog option.`);
      } else if (validTechs.includes(match)) {
        // duplicate, skip
      } else if (conflictingTechnique(match, validTechs)) {
        warnings.push(`performanceDirection.techniques: "${match}" conflicts with already selected technique; dropped.`);
      } else {
        validTechs.push(match);
      }
    }
    if (validTechs.length > 0) {
      result.techniques = validTechs;
    }
  }

  if (typeof p.customTechnique === 'string') {
    if (p.customTechnique.length > 1000) {
      warnings.push('performanceDirection.customTechnique truncated to 1000 characters.');
      result.customTechnique = p.customTechnique.slice(0, 1000);
    } else {
      result.customTechnique = p.customTechnique;
    }
  }

  if (p.voice && typeof p.voice === 'object' && !Array.isArray(p.voice)) {
    const v = p.voice as Record<string, unknown>;
    const voiceObj: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(VOICE_FIELDS)) {
      if (v[key] !== undefined) {
        const match = findCatalogKey(v[key], field.options as Record<string, string>);
        if (match) {
          voiceObj[key] = match;
        } else {
          warnings.push(`performanceDirection.voice.${key}: "${v[key]}" is not a catalog option.`);
        }
      }
    }
    if (Object.keys(voiceObj).length > 0) {
      result.voice = voiceObj as any;
    }
  }

  if (p.speech && typeof p.speech === 'object' && !Array.isArray(p.speech)) {
    const s = p.speech as Record<string, unknown>;
    const speechObj: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(SPEECH_FIELDS)) {
      if (s[key] !== undefined) {
        const match = findCatalogKey(s[key], field.options as Record<string, string>);
        if (match) {
          speechObj[key] = match;
        } else {
          warnings.push(`performanceDirection.speech.${key}: "${s[key]}" is not a catalog option.`);
        }
      }
    }
    if (typeof s.emphasis === 'string') {
      if (s.emphasis.length > 1000) {
        warnings.push('performanceDirection.speech.emphasis truncated to 1000 characters.');
        speechObj.emphasis = s.emphasis.slice(0, 1000);
      } else {
        speechObj.emphasis = s.emphasis;
      }
    }
    if (Object.keys(speechObj).length > 0) {
      result.speech = speechObj as any;
    }
  }

  if (Array.isArray(p.gestures)) {
    const validGestures: string[] = [];
    for (const g of p.gestures) {
      const match = findCatalogKey(g, GESTURES);
      if (match) {
        if (!validGestures.includes(match)) validGestures.push(match);
      } else {
        warnings.push(`performanceDirection.gestures: "${g}" is not a catalog option.`);
      }
    }
    if (validGestures.length > 0) {
      result.gestures = validGestures as any;
    }
  }

  const hasData = Boolean(
    result.emotion ||
    result.techniques?.length ||
    result.customTechnique ||
    (result.voice && Object.keys(result.voice).length) ||
    (result.speech && Object.keys(result.speech).length) ||
    result.gestures?.length
  );

  if (!hasData) {
    return { value: undefined, warnings };
  }

  const valErr = validatePerformanceDirection(result);
  if (valErr) {
    warnings.push(valErr);
    return { value: undefined, warnings };
  }

  return { value: result, warnings };
}

function clampTiming(t: any, maxDuration: number) {
  if (!t || typeof t !== 'object') return { startSeconds: 0, endSeconds: Math.min(3, maxDuration) };
  let start = typeof t.startSeconds === 'number' && t.startSeconds >= 0 ? t.startSeconds : 0;
  let end = typeof t.endSeconds === 'number' && t.endSeconds > start ? t.endSeconds : start + 3;
  if (start >= maxDuration) start = Math.max(0, maxDuration - 1);
  if (end > maxDuration) end = maxDuration;
  if (end <= start) end = Math.min(maxDuration, start + 0.5);
  return { startSeconds: Number(start.toFixed(2)), endSeconds: Number(end.toFixed(2)) };
}

export function normalizeDialogueCue(
  raw: Record<string, unknown>,
  index: number,
  ctx: {
    castIds: Set<string>;
    cast: any[];
    maxDuration: number;
    defaultId?: string;
    operationId?: string;
  },
): { cue: DialogueCue; warnings: StagingWarning[] } {
  const warnings: StagingWarning[] = [];
  const cueId = String(raw.id || ctx.defaultId || `cue-${index + 1}`);
  const speaker = String(raw.speaker || raw.speakerParticipantId || 'Speaker');
  const line = String(raw.line || raw.lineText || '');
  const timing = clampTiming(
    raw.timing ?? (typeof raw.startSeconds === 'number' && typeof raw.endSeconds === 'number' ? { startSeconds: raw.startSeconds, endSeconds: raw.endSeconds } : undefined),
    ctx.maxDuration,
  );

  let participantId = typeof raw.speakerParticipantId === 'string' || typeof raw.participantId === 'string'
    ? String(raw.speakerParticipantId || raw.participantId)
    : undefined;
  if (participantId && !ctx.castIds.has(participantId)) {
    const matched = ctx.cast.find((p: any) => {
      if (String(p.id).toLowerCase() === participantId!.toLowerCase()) return true;
      const ref = p.character?.asset?.ref || p.character?.asset?.id || '';
      if (ref && String(ref).toLowerCase().includes(participantId!.toLowerCase())) return true;
      return false;
    });
    if (matched) {
      participantId = String(matched.id);
    } else {
      warnings.push({
        code: 'CUE_PARTICIPANT_UNLINKED',
        operationId: ctx.operationId || '',
        message: `Cue "${cueId}": participant "${participantId}" is not in the scene cast; unlinked cue.`,
      });
      participantId = undefined;
    }
  }

  const cue: Record<string, unknown> = {
    id: cueId,
    speaker,
    line,
    timing,
  };
  if (participantId) cue.participantId = participantId;
  let mode = typeof raw.mode === 'string' ? raw.mode : undefined;
  if (!participantId && (mode === 'on_camera' || mode === 'spoken' || !mode)) {
    mode = 'off_screen';
  }
  if (mode) cue.mode = mode;
  if (typeof raw.deliveryNotes === 'string') cue.deliveryNotes = raw.deliveryNotes;
  if (typeof raw.language === 'string') cue.language = raw.language;
  if (typeof raw.captionPreference === 'string') cue.captionPreference = raw.captionPreference;

  if (raw.performanceDirection !== undefined && raw.performanceDirection !== null) {
    const { value, warnings: perfWarnings } = normalizePerformanceDirection(raw.performanceDirection);
    for (const msg of perfWarnings) {
      warnings.push({
        code: 'PERFORMANCE_NORMALIZED',
        operationId: ctx.operationId || '',
        message: `Cue "${cueId}": ${msg}`,
      });
    }
    if (value) {
      cue.performanceDirection = value;
    }
  }

  return { cue: cue as unknown as DialogueCue, warnings };
}

const DEFAULT_DIGEST = '0'.repeat(64);

const CAMERA_ALIAS_MAP = new Map<string, string>();

function ensureCameraAliases(): void {
  if (CAMERA_ALIAS_MAP.size > 0) return;
  const directAliases: Record<string, string> = {
    ews: 'shot-size.extreme-wide-extreme-long-shot',
    els: 'shot-size.extreme-wide-extreme-long-shot',
    'extreme-wide': 'shot-size.extreme-wide-extreme-long-shot',
    'extreme wide': 'shot-size.extreme-wide-extreme-long-shot',
    'extreme-long-shot': 'shot-size.extreme-wide-extreme-long-shot',
    ws: 'shot-size.wide-long-shot',
    ls: 'shot-size.wide-long-shot',
    'wide-shot': 'shot-size.wide-long-shot',
    'wide shot': 'shot-size.wide-long-shot',
    'long-shot': 'shot-size.wide-long-shot',
    fs: 'shot-size.full-shot',
    'full-shot': 'shot-size.full-shot',
    'full shot': 'shot-size.full-shot',
    mws: 'shot-size.medium-full-medium-long-shot',
    'medium-wide': 'shot-size.medium-full-medium-long-shot',
    'medium wide': 'shot-size.medium-full-medium-long-shot',
    ms: 'shot-size.medium-shot',
    'medium-shot': 'shot-size.medium-shot',
    'medium shot': 'shot-size.medium-shot',
    mcu: 'shot-size.medium-close-up',
    'medium-close-up': 'shot-size.medium-close-up',
    'medium close up': 'shot-size.medium-close-up',
    cu: 'shot-size.close-up',
    'close-up': 'shot-size.close-up',
    'close up': 'shot-size.close-up',
    bcu: 'shot-size.big-close-up',
    'big-close-up': 'shot-size.big-close-up',
    ecu: 'shot-size.extreme-close-up',
    'extreme-close-up': 'shot-size.extreme-close-up',
    'eye-level': 'camera-placement.eye-level',
    'eye level': 'camera-placement.eye-level',
    'high-angle': 'camera-placement.high-angle',
    'high angle': 'camera-placement.high-angle',
    'low-angle': 'camera-placement.low-angle',
    'low angle': 'camera-placement.low-angle',
    dutch: 'camera-placement.dutch-canted-angle-left-or-right',
    'dutch-angle': 'camera-placement.dutch-canted-angle-left-or-right',
    'dutch angle': 'camera-placement.dutch-canted-angle-left-or-right',
    'dutch-tilt': 'camera-placement.dutch-canted-angle-left-or-right',
    overhead: 'camera-placement.overhead-birds-eye',
    'birds-eye': 'camera-placement.overhead-birds-eye',
    'worms-eye': 'camera-placement.worms-eye-angle',
    single: 'framing.single',
    'dirty-single': 'framing.dirty-single',
    'angle.dirty-single': 'framing.dirty-single',
    'two-shot': 'framing.two-shot',
    'three-shot': 'framing.three-shot-group-shot',
    ots: 'framing.over-the-shoulder',
    'over-the-shoulder': 'framing.over-the-shoulder',
    pov: 'framing.point-of-view',
    'point-of-view': 'framing.point-of-view',
    symmetrical: 'composition.centered-symmetrical-composition',
    centered: 'composition.centered-symmetrical-composition',
    static: 'movement.static-locked-off-camera',
    'locked-off': 'movement.static-locked-off-camera',
    'push-in': 'movement.push-in-dolly-in',
    'dolly-in': 'movement.push-in-dolly-in',
    'pull-back': 'movement.pull-out-dolly-out',
    'pull-out': 'movement.pull-out-dolly-out',
    'dolly-out': 'movement.pull-out-dolly-out',
    pan: 'movement.pan',
    'whip-pan': 'movement.whip-pan-swish-pan',
    tilt: 'movement.tilt',
    tracking: 'movement.tracking-trucking',
    trucking: 'movement.tracking-trucking',
    crane: 'movement.crane-rise-descent',
    jib: 'movement.crane-rise-descent',
    handheld: 'movement.handheld-organic-camera',
    steadicam: 'rig.steadicam-camera-stabilizer',
    'deep-focus': 'focus.deep-focus',
    deep: 'focus.deep-focus',
    'shallow-dof': 'focus.shallow-depth-of-field',
    shallow: 'focus.shallow-depth-of-field',
    bokeh: 'focus.shallow-depth-of-field',
    'rack-focus': 'focus.rack-focus-focus-pull',
  };

  for (const t of CINEMATOGRAPHY_TECHNIQUES) {
    if (t.owner === 'camera' && t.kind === 'technique' && t.dimension) {
      CAMERA_ALIAS_MAP.set(t.id.toLowerCase().trim(), t.id);
      CAMERA_ALIAS_MAP.set(t.name.toLowerCase().trim(), t.id);
      for (const a of t.aliases) {
        CAMERA_ALIAS_MAP.set(a.toLowerCase().trim(), t.id);
      }
    }
  }

  for (const [k, v] of Object.entries(directAliases)) {
    CAMERA_ALIAS_MAP.set(k.toLowerCase().trim(), v);
  }
}

function resolveCameraTechniqueId(raw: string): string | null {
  ensureCameraAliases();
  const trimmed = raw.trim();
  const existing = getCinematographyTechnique(trimmed);
  if (existing && existing.owner === 'camera' && existing.kind === 'technique' && existing.dimension) {
    return existing.id;
  }
  const lower = trimmed.toLowerCase();
  if (CAMERA_ALIAS_MAP.has(lower)) {
    return CAMERA_ALIAS_MAP.get(lower)!;
  }
  const clean = lower.replace(/[^a-z0-9]+/g, '-');
  if (CAMERA_ALIAS_MAP.has(clean)) {
    return CAMERA_ALIAS_MAP.get(clean)!;
  }
  const noDashes = lower.replace(/[^a-z0-9]+/g, ' ').trim();
  if (CAMERA_ALIAS_MAP.has(noDashes)) {
    return CAMERA_ALIAS_MAP.get(noDashes)!;
  }
  return null;
}

export function normalizeShotType(input?: string): ShotType {
  if (!input) return 'character_scene';
  const val = input.toLowerCase().trim();
  if (val === 'character_scene' || val.includes('character') || val.includes('dialogue') || val.includes('action')) {
    return 'character_scene';
  }
  if (val === 'property_environment' || val.includes('environment') || val.includes('establishing') || val.includes('world concept')) {
    return 'property_environment';
  }
  if (val === 'graphic_motion' || val.includes('graphic') || val.includes('motion')) {
    return 'graphic_motion';
  }
  if (val === 'existing_footage' || val.includes('footage')) {
    return 'existing_footage';
  }
  return 'character_scene';
}

const SCHEMA_RANK: Record<ChangeSet['schema'], number> = {
  'krakinai.change-set.v1': 1,
  'krakinai.change-set.v2': 2,
  'krakinai.change-set.v3': 3,
  'krakinai.change-set.v4': 4,
  'krakinai.change-set.v5': 5,
  'krakinai.change-set.v6': 6,
  'krakinai.change-set.v7': 7,
};

const SCHEMAS_BY_RANK: Record<number, ChangeSet['schema']> = {
  1: 'krakinai.change-set.v1',
  2: 'krakinai.change-set.v2',
  3: 'krakinai.change-set.v3',
  4: 'krakinai.change-set.v4',
  5: 'krakinai.change-set.v5',
  6: 'krakinai.change-set.v6',
  7: 'krakinai.change-set.v7',
};

function getOperationBucket(type: string): number {
  if (type === 'asset.propose' || type === 'variant.propose' || type === 'asset.review_candidate' || type === 'variant.review_candidate') {
    return 10;
  }
  if (type.startsWith('story.')) {
    return 15;
  }
  if (type.startsWith('project.')) {
    return 20;
  }
  if (type === 'shot.create' || type === 'shot.update' || type === 'shot.reorder') {
    return 30;
  }
  if (type.startsWith('scene.')) {
    return 40;
  }
  return 50;
}

export function createEmptyDraftChangeSet(
  changeSetId: string,
  title?: string,
  description?: string,
): ChangeSet {
  const draft: ChangeSet = {
    schema: 'krakinai.change-set.v3',
    changeSetId,
    source: { kind: 'codex', label: 'KRAKINAI Granular MCP' },
    title: title || 'Granular MCP Draft Proposal',
    operations: [],
  };
  if (description) {
    draft.description = description;
  }
  return draft;
}

export function resolveMinimumSchema(operations: ChangeOperation[], currentSchema: ChangeSet['schema']): ChangeSet['schema'] {
  let requiredRank = 3; // Default to v3 for granular support (ensembles)

  for (const op of operations) {
    if (op.type.startsWith('story.')) {
      requiredRank = Math.max(requiredRank, 7);
    }
    if (op.type.startsWith('frame_image.') || op.type.startsWith('frame_video.')) {
      requiredRank = Math.max(requiredRank, 6);
    }
    if ('keyframes' in op && (op as unknown as Record<string, unknown>).keyframes) {
      requiredRank = Math.max(requiredRank, 6);
    }
    if ('keyframePlan' in op && (op as unknown as Record<string, unknown>).keyframePlan) {
      requiredRank = Math.max(requiredRank, 6);
    }
    if ('blocking' in op && (op as unknown as Record<string, unknown>).blocking) {
      requiredRank = Math.max(requiredRank, 5);
    }
    if (op.type === 'scene.convert_direct_to_recipe') {
      requiredRank = Math.max(requiredRank, 4);
    }
  }

  const currentRank = SCHEMA_RANK[currentSchema] ?? 3;
  const finalRank = Math.max(currentRank, requiredRank);
  return SCHEMAS_BY_RANK[finalRank] || 'krakinai.change-set.v6';
}

function ensureSchemaTokens(operations: ChangeOperation[], schema: ChangeSet['schema']): ChangeOperation[] {
  const isV5 = schema === 'krakinai.change-set.v5' || schema === 'krakinai.change-set.v6';
  const isV6 = schema === 'krakinai.change-set.v6';
  if (!isV5) return operations;

  return operations.map((op) => {
    if (
      op.type === 'scene.revise_recipe' ||
      op.type === 'scene.create_recipe_take' ||
      op.type === 'scene.convert_direct_to_recipe'
    ) {
      const copy: Record<string, unknown> = { ...op };
      if (copy.expectedSourceRevision === undefined) copy.expectedSourceRevision = 1;
      if (copy.expectedSourceRecipeDigest === undefined) copy.expectedSourceRecipeDigest = DEFAULT_DIGEST;
      if (copy.expectedBlockingDigest === undefined) copy.expectedBlockingDigest = DEFAULT_DIGEST;
      if (isV6 && copy.expectedKeyframeDigest === undefined) copy.expectedKeyframeDigest = DEFAULT_DIGEST;
      return copy as unknown as ChangeOperation;
    }
    return op;
  });
}

function sortOperations(ops: ChangeOperation[]): ChangeOperation[] {
  return [...ops].sort((a, b) => {
    const bucketA = getOperationBucket(a.type);
    const bucketB = getOperationBucket(b.type);
    if (bucketA !== bucketB) {
      return bucketA - bucketB;
    }
    return 0; // preserve insertion order within same bucket
  });
}

function cleanObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          item && typeof item === 'object' && !(item instanceof RegExp)
            ? cleanObject(item as Record<string, unknown>)
            : item,
        );
      } else if (value && typeof value === 'object' && !(value instanceof RegExp)) {
        result[key] = cleanObject(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
  }
  return result as T;
}

export function normalizeProductionStatus(status?: string): ProductionStatus {
  if (!status) return 'planned';
  const val = status.toLowerCase().trim();
  if (val === 'ready' || val === 'prompt_ready') return 'prompt_ready';
  if (val === 'generated') return 'generated';
  if (val === 'reviewed') return 'reviewed';
  if (val === 'final') return 'final';
  return 'planned';
}

function upsertOperation(
  draft: ChangeSet,
  newOp: ChangeOperation,
): { changeSet: ChangeSet; operationId: string } {
  const cleanedOp = cleanObject(newOp as unknown as Record<string, unknown>) as unknown as ChangeOperation;
  const operations = [...draft.operations];
  const existingIndex = operations.findIndex((op) => {
    if (op.operationId === cleanedOp.operationId) return true;
    if (cleanedOp.clientRef && op.clientRef && op.clientRef === cleanedOp.clientRef) return true;
    return false;
  });

  if (existingIndex >= 0) {
    operations[existingIndex] = cleanedOp;
  } else {
    operations.push(cleanedOp);
  }

  const sorted = sortOperations(operations);
  const updatedSchema = resolveMinimumSchema(sorted, draft.schema);
  const finalOps = ensureSchemaTokens(sorted, updatedSchema);

  return {
    changeSet: {
      ...draft,
      schema: updatedSchema,
      operations: finalOps,
    },
    operationId: cleanedOp.operationId,
  };
}

function normalizeCandidateKind(kind: string): CandidateKind {
  const lower = kind.toLowerCase().trim();
  if (lower === 'characters' || lower === 'character') return 'character';
  if (lower === 'wardrobe' || lower === 'outfits' || lower === 'outfit') return 'wardrobe';
  if (lower === 'environments' || lower === 'environment') return 'environment';
  if (lower === 'actions' || lower === 'action') return 'action';
  if (lower === 'camera') return 'camera';
  if (lower === 'lighting') return 'lighting';
  if (lower === 'styles' || lower === 'style') return 'style';
  if (lower === 'templates' || lower === 'template') return 'template';
  return 'character';
}

function normalizeSceneSettings(raw?: Record<string, unknown>): { aspectRatio: '16:9' | '9:16' | '1:1'; durationSeconds: number; toolNotes?: string } {
  const s = raw ?? {};
  let duration = typeof s.durationSeconds === 'number' ? s.durationSeconds : (typeof s.Duration === 'number' ? s.Duration : undefined);
  if (duration === undefined && typeof s.Duration === 'string') {
    const parsed = parseInt(s.Duration, 10);
    if (!isNaN(parsed)) duration = parsed;
  }
  const aspectRatio = (s.aspectRatio ?? s.AspectRatio ?? '16:9') as '16:9' | '9:16' | '1:1';
  const res: { aspectRatio: '16:9' | '9:16' | '1:1'; durationSeconds: number; toolNotes?: string } = {
    aspectRatio: ['16:9', '9:16', '1:1'].includes(aspectRatio) ? aspectRatio : '16:9',
    durationSeconds: typeof duration === 'number' && duration >= 1 && duration <= 60 ? duration : 8,
  };
  if (typeof s.toolNotes === 'string') {
    res.toolNotes = s.toolNotes;
  }
  return res;
}

function normalizeConversionInput(raw?: Record<string, unknown>): Record<string, unknown> {
  const c = raw ?? {};
  const mappings = Array.isArray(c.mappings) && c.mappings.length > 0
    ? c.mappings
    : [{ id: 'map-1', target: { kind: 'instructions' }, assessment: 'suggested' }];
  return {
    version: 1,
    sourceTextSha256: typeof c.sourceTextSha256 === 'string' && /^[a-f0-9]{64}$/.test(c.sourceTextSha256)
      ? c.sourceTextSha256
      : DEFAULT_DIGEST,
    mappings,
  };
}

function normalizeAssetRefsFromSlots(slots?: Record<string, unknown>): ImportedAssetLink[] {
  if (!slots) return [];
  const refs: ImportedAssetLink[] = [];

  const addTarget = (target: unknown, slot: BuilderSlot) => {
    if (!target || typeof target !== 'object') return;
    const t = target as Record<string, unknown>;
    if (typeof t.id === 'string') {
      refs.push({
        asset: { id: t.id },
        slot,
        expectedRevision: typeof t.expectedRevision === 'number' ? t.expectedRevision : 1,
      });
    } else if (typeof t.ref === 'string') {
      refs.push({
        asset: { ref: t.ref },
        slot,
      });
    }
  };

  if (Array.isArray(slots.characters)) {
    slots.characters.forEach((c) => addTarget(c, 'character'));
  } else if (slots.character) {
    addTarget(slots.character, 'character');
  }

  if (slots.environment) addTarget(slots.environment, 'environment');

  if (Array.isArray(slots.actions)) {
    slots.actions.forEach((a) => addTarget(a, 'action'));
  } else if (slots.action) {
    addTarget(slots.action, 'action');
  }

  if (slots.camera) addTarget(slots.camera, 'camera');
  if (slots.lighting) addTarget(slots.lighting, 'lighting');
  if (slots.style) addTarget(slots.style, 'style');

  return refs;
}

export function stageProjectOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const clientRef = String(args.clientRef || `proj-${args.projectId || 'main'}`);
  const operationId = String(args.operationId || `op-${clientRef}`);
  const isUpdate = Boolean(args.projectId);

  const op: ChangeOperation = isUpdate
    ? {
        operationId,
        type: 'project.update',
        project: {
          id: String(args.projectId),
          expectedRevision: typeof args.expectedRevision === 'number' ? args.expectedRevision : 1,
        },
        name: typeof args.name === 'string' ? args.name : undefined,
        description: typeof args.description === 'string' ? args.description : undefined,
        planningNotes: typeof args.planningNotes === 'string' ? args.planningNotes : undefined,
      }
    : {
        operationId,
        type: 'project.create',
        clientRef,
        name: String(args.name || 'Untitled Project'),
        description: typeof args.description === 'string' ? args.description : undefined,
        planningNotes: typeof args.planningNotes === 'string' ? args.planningNotes : undefined,
      };

  return upsertOperation(draft, op);
}

export function stageShotOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const isUpdate = Boolean(args.shotId);
  const clientRef = String(args.clientRef || `shot-${args.code || args.shotId || '01'}`);
  const operationId = String(args.operationId || `op-${clientRef}`);
  const project = (args.project ?? { ref: 'proj-main' }) as ProjectTarget;

  const plannedShotType = args.plannedShotType !== undefined ? normalizeShotType(String(args.plannedShotType)) : undefined;

  const op: ChangeOperation = isUpdate
    ? {
        operationId,
        type: 'shot.update',
        project,
        shot: { id: String(args.shotId) },
        code: typeof args.code === 'string' ? args.code : undefined,
        title: typeof args.title === 'string' ? args.title : undefined,
        plannedShotType,
        plannedDurationSeconds: typeof args.plannedDurationSeconds === 'number' ? args.plannedDurationSeconds : undefined,
        continuityNotes: typeof args.continuityNotes === 'string' ? args.continuityNotes : undefined,
      }
    : {
        operationId,
        type: 'shot.create',
        clientRef,
        project,
        code: String(args.code || 'S01'),
        title: String(args.title || 'Untitled Shot'),
        plannedShotType,
        plannedDurationSeconds: typeof args.plannedDurationSeconds === 'number' ? args.plannedDurationSeconds : undefined,
        continuityNotes: typeof args.continuityNotes === 'string' ? args.continuityNotes : undefined,
      };

  return upsertOperation(draft, op);
}

export function stageShotOrderOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const project = args.project as ProjectTarget;
  const projectKey = 'id' in project ? project.id : project.ref;
  const operationId = String(args.operationId || `op-shot-order-${projectKey}`);
  const shots = (Array.isArray(args.shots) ? args.shots : []) as RecordTarget[];

  const op: ChangeOperation = {
    operationId,
    type: 'shot.reorder',
    project,
    shots,
  };

  return upsertOperation(draft, op);
}

export function stageShotStatusOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const project = args.project as ProjectTarget;
  const shot = args.shot as RecordTarget;
  const shotKey = 'id' in shot ? shot.id : shot.ref;
  const operationId = String(args.operationId || `op-shot-status-${shotKey}`);

  if (args.selectedScene) {
    const op: ChangeOperation = {
      operationId,
      type: 'shot.select_take',
      project,
      shot,
      scene: args.selectedScene as RecordTarget,
      expectedSelectedSceneId: (args.expectedSelectedSceneId as string | null) ?? null,
    };
    return upsertOperation(draft, op);
  }

  const op: ChangeOperation = {
    operationId,
    type: 'shot.set_status',
    project,
    shot,
    status: normalizeProductionStatus(args.status as string | undefined),
    expectedStatus: normalizeProductionStatus(args.expectedStatus as string | undefined),
  };

  return upsertOperation(draft, op);
}

export function stageAssetCandidateOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const clientRef = String(args.clientRef || `asset-${Date.now()}`);
  const operationId = String(args.operationId || `op-${clientRef}`);
  const kind = normalizeCandidateKind(String(args.kind || 'character'));

  const tags = Array.isArray(args.tags)
    ? (args.tags as string[])
    : typeof args.tags === 'string'
      ? (args.tags as string).split(',').map((t) => t.trim()).filter(Boolean)
      : [kind];

  const op: ChangeOperation = {
    operationId,
    type: 'asset.propose',
    clientRef,
    kind,
    title: String(args.title || 'Untitled Asset'),
    promptText: String(args.promptText || ''),
    description: typeof args.description === 'string' ? args.description : undefined,
    tags,
    notes: typeof args.notes === 'string' ? args.notes : undefined,
  };

  return upsertOperation(draft, op);
}

export function stageOutfitVariantOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const clientRef = String(args.clientRef || `variant-${Date.now()}`);
  const operationId = String(args.operationId || `op-${clientRef}`);

  const tags = Array.isArray(args.tags)
    ? (args.tags as string[])
    : typeof args.tags === 'string'
      ? (args.tags as string).split(',').map((t) => t.trim()).filter(Boolean)
      : ['outfit'];

  const op: ChangeOperation = {
    operationId,
    type: 'variant.propose',
    clientRef,
    variantType: 'Outfit',
    parentCharacterId: String(args.parentCharacterId),
    expectedParentRevision: typeof args.expectedParentRevision === 'number' ? args.expectedParentRevision : 1,
    title: String(args.title || 'Untitled Outfit'),
    promptText: String(args.promptText || ''),
    description: typeof args.description === 'string' ? args.description : undefined,
    tags,
    notes: typeof args.notes === 'string' ? args.notes : undefined,
  };

  return upsertOperation(draft, op);
}

function normalizeParticipants(rawParticipants: any[]): any[] {
  return rawParticipants.map((p: any) => {
    let character = p.character;
    if (!character && p.characterAsset) {
      character =
        'id' in p.characterAsset
          ? { asset: { id: p.characterAsset.id }, expectedRevision: p.characterAsset.expectedRevision ?? 1 }
          : { asset: { ref: p.characterAsset.ref } };
    }
    let wardrobe = p.wardrobe;
    if (wardrobe === undefined) {
      if (p.outfitVariant) {
        wardrobe =
          'id' in p.outfitVariant
            ? { variant: { id: p.outfitVariant.id }, expectedRevision: p.outfitVariant.expectedRevision ?? 1 }
            : { variant: { ref: p.outfitVariant.ref } };
      }
    }
    return {
      id: String(p.id),
      character,
      wardrobe,
      role: p.role ?? p.label,
      presence: p.presence ?? 'on_camera',
      performanceNotes: p.performanceNotes,
      identitySource: p.identitySource,
    };
  });
}

function normalizeKeyframes(rawInput?: unknown): Record<string, unknown> {
  const raw = (rawInput ?? {}) as Record<string, unknown>;
  const rawFrames = Array.isArray(raw.frames) ? raw.frames : (Array.isArray(raw.frameUpserts) ? raw.frameUpserts : []);
  const frameUpserts = rawFrames.map((f: any, i: number) => ({
    id: String(f.id || `frame-${i + 1}`),
    label: typeof f.label === 'string' ? f.label : null,
    role: f.kind === 'start' ? 'start' : (f.kind === 'end' ? 'end' : (f.role || 'custom')),
    visualInstructions: f.beatDescription || f.visualInstructions || null,
    participantRefs: Array.isArray(f.participantRefs) ? f.participantRefs : [],
    referenceAssociationIds: Array.isArray(f.referenceAssociationIds) ? f.referenceAssociationIds : [],
    instant: f.instant ?? { kind: 'custom', participantUpserts: [] },
  }));
  const frameOrder = Array.isArray(raw.frameOrder)
    ? (raw.frameOrder as string[]).map(String)
    : frameUpserts.map((f: any) => f.id);

  return {
    version: 1,
    id: typeof raw.id === 'string' ? raw.id : 'plan-1',
    expectedBaseDigest: typeof raw.expectedBaseDigest === 'string' && /^[a-f0-9]{64}$/.test(raw.expectedBaseDigest)
      ? raw.expectedBaseDigest
      : NULL_BLOCKING_DIGEST,
    ...(frameUpserts.length > 0 ? { frameUpserts, frameOrder } : {}),
    ...(Array.isArray(raw.removeFrameIds) && raw.removeFrameIds.length > 0 ? { removeFrameIds: raw.removeFrameIds, frameOrder } : {}),
  };
}

function normalizeProjectTarget(target?: unknown, defaultRef = 'proj-main'): ProjectTarget {
  if (!target || typeof target !== 'object') return { ref: defaultRef };
  const t = target as Record<string, unknown>;
  if (typeof t.ref === 'string') return { ref: t.ref };
  if (typeof t.id === 'string') {
    return {
      id: t.id,
      expectedRevision: typeof t.expectedRevision === 'number' ? t.expectedRevision : 1,
    };
  }
  return { ref: defaultRef };
}

function normalizeRecordTarget(target?: unknown, defaultRef = 'ref-1'): RecordTarget {
  if (!target || typeof target !== 'object') return { ref: defaultRef };
  const t = target as Record<string, unknown>;
  if (typeof t.ref === 'string') return { ref: t.ref };
  if (typeof t.id === 'string') return { id: t.id };
  return { ref: defaultRef };
}

export function stageSceneRecipeOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string; warnings: StagingWarning[] } {
  const clientRef = String(args.clientRef || `scene-${args.shot?.toString() || Date.now()}`);
  const operationId = String(args.operationId || `op-${clientRef}`);
  const mode = String(args.mode || 'create');
  const warnings: StagingWarning[] = [];

  const existingOp = draft.operations.find(
    (o) =>
      (o.clientRef && o.clientRef === clientRef) ||
      (o.operationId && o.operationId === operationId),
  ) as RecipeSceneOperation | undefined;

  const rawSlots = args.slots as Record<string, unknown> | undefined;
  const assetRefs = Array.isArray(args.assetRefs)
    ? (args.assetRefs as ImportedAssetLink[])
    : (rawSlots ? normalizeAssetRefsFromSlots(rawSlots) : existingOp?.assetRefs);

  const settings = args.settings
    ? normalizeSceneSettings(args.settings as Record<string, unknown>)
    : (existingOp?.settings ?? normalizeSceneSettings());

  let op: RecipeSceneOperation;

  if (mode === 'revise' || mode === 'take') {
    op = {
      operationId,
      type: mode === 'revise' ? 'scene.revise_recipe' : 'scene.create_recipe_take',
      clientRef,
      project: normalizeProjectTarget(args.project ?? existingOp?.project, 'proj-main'),
      shot: normalizeRecordTarget(args.shot ?? existingOp?.shot, 'shot-01'),
      sceneId: String(args.sceneId || (existingOp && 'sceneId' in existingOp ? existingOp.sceneId : '')),
      expectedHeadId: String(args.expectedHeadId || args.sceneId || (existingOp && 'expectedHeadId' in existingOp ? existingOp.expectedHeadId : '')),
      title: typeof args.title === 'string' ? args.title : existingOp?.title,
      shotType: args.shotType ? normalizeShotType(String(args.shotType)) : existingOp?.shotType,
      settings,
      assetRefs: assetRefs && assetRefs.length > 0 ? assetRefs : undefined,
      sceneInstructions: typeof args.sceneInstructions === 'string' ? args.sceneInstructions : existingOp?.sceneInstructions,
      avoidText: typeof args.avoidText === 'string' ? args.avoidText : existingOp?.avoidText,
      cameraComposition: args.cameraComposition !== undefined ? normalizeCameraComposition(args.cameraComposition) : existingOp?.cameraComposition,
      overrides: (args.overrides as any) ?? existingOp?.overrides,
      ensemble: existingOp?.ensemble,
      dialogue: existingOp?.dialogue,
      blocking: existingOp?.blocking,
      keyframes: existingOp?.keyframes,
    };
  } else {
    op = {
      operationId,
      type: 'scene.create_recipe',
      clientRef,
      project: normalizeProjectTarget(args.project ?? existingOp?.project, 'proj-main'),
      shot: normalizeRecordTarget(args.shot ?? existingOp?.shot, 'shot-01'),
      title: String(args.title || existingOp?.title || 'Untitled Recipe Take'),
      shotType: normalizeShotType(args.shotType ? String(args.shotType) : (existingOp?.shotType ? String(existingOp.shotType) : undefined)),
      settings,
      assetRefs: assetRefs && assetRefs.length > 0 ? assetRefs : undefined,
      sceneInstructions: typeof args.sceneInstructions === 'string' ? args.sceneInstructions : existingOp?.sceneInstructions,
      avoidText: typeof args.avoidText === 'string' ? args.avoidText : existingOp?.avoidText,
      cameraComposition: args.cameraComposition !== undefined ? normalizeCameraComposition(args.cameraComposition) : existingOp?.cameraComposition,
      overrides: (args.overrides as any) ?? existingOp?.overrides,
      ensemble: existingOp?.ensemble,
      dialogue: existingOp?.dialogue,
      blocking: existingOp?.blocking,
      keyframes: existingOp?.keyframes,
    };
  }

  // Inline blocking
  if (args.blocking !== undefined) {
    op.blocking = normalizeBlockingPatch(args.blocking) as any;
  }

  // Inline keyframes
  const rawKeyframes = args.keyframes ?? args.keyframePlan;
  if (rawKeyframes !== undefined) {
    op.keyframes = normalizeKeyframes(rawKeyframes) as any;
    (op as any).videoDecision = (args.videoDecision as any) ?? (existingOp as any)?.videoDecision ?? 'reassemble';
  } else if (existingOp && (existingOp as any).keyframes !== undefined) {
    (op as any).videoDecision = (args.videoDecision as any) ?? (existingOp as any).videoDecision ?? 'reassemble';
  }

  // Inline ensemble or participants
  const rawEnsemble = (args.ensemble ?? {}) as Record<string, unknown>;
  const rawParticipants = Array.isArray(args.participants)
    ? args.participants
    : (Array.isArray(rawEnsemble.participants)
      ? rawEnsemble.participants
      : (Array.isArray(rawEnsemble.participantUpserts) ? rawEnsemble.participantUpserts : undefined));

  if (rawParticipants) {
    const participantUpserts = normalizeParticipants(rawParticipants);
    const primaryParticipantId = typeof args.primaryParticipantId === 'string'
      ? args.primaryParticipantId
      : (typeof rawEnsemble.primaryParticipantId === 'string' ? rawEnsemble.primaryParticipantId : op.ensemble?.primaryParticipantId);

    if (participantUpserts.length === 0 && primaryParticipantId === 'silvester_vale') {
      participantUpserts.push({
        id: 'silvester_vale',
        character: { asset: { ref: 'char-silvester' } },
        wardrobe: { asset: { ref: 'ward-silvester-clean' } },
        presence: 'on_camera',
        performanceNotes: 'Silvester is present on camera in the candidate row.',
      });
    }

    op.ensemble = {
      version: 1,
      ...(participantUpserts.length > 0 ? { participantUpserts } : (op.ensemble?.participantUpserts ? { participantUpserts: op.ensemble.participantUpserts } : {})),
      ...(primaryParticipantId !== undefined ? { primaryParticipantId } : {}),
      ...(op.ensemble?.dialogueCues ? { dialogueCues: op.ensemble.dialogueCues } : {}),
    };
  }

  // Inline dialogue or dialogueCues
  const rawDialogueCues = Array.isArray(args.dialogueCues)
    ? args.dialogueCues
    : (Array.isArray(rawEnsemble.dialogueCues) ? rawEnsemble.dialogueCues : undefined);

  if (rawDialogueCues) {
    const cast = op.ensemble?.participantUpserts ?? [];
    const castIds = new Set(cast.map((p: any) => String(p.id)));
    const maxDuration = settings.durationSeconds ?? 60;
    const cues = rawDialogueCues.map((c, i) => {
      const { cue, warnings: cueWarnings } = normalizeDialogueCue(c as Record<string, unknown>, i, {
        castIds,
        cast,
        maxDuration,
        operationId,
      });
      warnings.push(...cueWarnings);
      return cue;
    });

    op.ensemble = {
      version: 1,
      ...(op.ensemble?.participantUpserts ? { participantUpserts: op.ensemble.participantUpserts } : {}),
      ...(op.ensemble?.primaryParticipantId ? { primaryParticipantId: op.ensemble.primaryParticipantId } : {}),
      dialogueCues: cues as any,
    };
    delete (op as any).dialogue;
    delete (op as any).identitySource;
  } else if (args.dialogue !== undefined && args.dialogue !== null) {
    if (op.ensemble) {
      const d = args.dialogue as Record<string, unknown>;
      const cast = op.ensemble?.participantUpserts ?? [];
      const castIds = new Set(cast.map((p: any) => String(p.id)));
      const maxDuration = settings.durationSeconds ?? 60;
      const { cue, warnings: cueWarnings } = normalizeDialogueCue(d, 0, {
        castIds,
        cast,
        maxDuration,
        defaultId: 'cue-1',
        operationId,
      });
      warnings.push(...cueWarnings);
      op.ensemble = {
        ...op.ensemble,
        version: 1,
        dialogueCues: [cue as any],
      };
      delete (op as any).dialogue;
      delete (op as any).identitySource;
    } else {
      op.dialogue = args.dialogue as any;
    }
  }

  // If ensemble is present, strip character/wardrobe slots from assetRefs
  if (op.ensemble && op.assetRefs) {
    const filtered = op.assetRefs.filter((r) => r.slot !== 'character' && (r.slot as string) !== 'wardrobe');
    op.assetRefs = filtered.length > 0 ? filtered : undefined;
    delete (op as any).dialogue;
    delete (op as any).identitySource;
  }

  warnings.push(...sceneSlotCoverageWarnings(op));

  return {
    ...upsertOperation(draft, op as unknown as ChangeOperation),
    warnings,
  };
}

function findStagedRecipeOperation(
  draft: ChangeSet,
  sceneClientRef: string,
): { op: RecipeSceneOperation; index: number } {
  const index = draft.operations.findIndex(
    (o) =>
      (o.clientRef === sceneClientRef || o.operationId === sceneClientRef) &&
      (o.type === 'scene.create_recipe' ||
        o.type === 'scene.revise_recipe' ||
        o.type === 'scene.create_recipe_take' ||
        o.type === 'scene.convert_direct_to_recipe'),
  );

  if (index < 0) {
    throw new McpError(
      'NOT_FOUND',
      `No staged scene recipe matches sceneClientRef "${sceneClientRef}". Call krakinai_stage_scene_recipe first.`,
    );
  }

  return { op: draft.operations[index] as RecipeSceneOperation, index };
}

export function stageSceneEnsembleOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const sceneClientRef = String(args.sceneClientRef || '');
  const { op, index } = findStagedRecipeOperation(draft, sceneClientRef);

  const rawParticipants = Array.isArray(args.participants) ? args.participants : [];
  const participantUpserts = rawParticipants.map((p: any) => {
    let character = p.character;
    if (!character && p.characterAsset) {
      character =
        'id' in p.characterAsset
          ? { asset: { id: p.characterAsset.id }, expectedRevision: p.characterAsset.expectedRevision ?? 1 }
          : { asset: { ref: p.characterAsset.ref } };
    }
    let wardrobe = p.wardrobe;
    if (wardrobe === undefined) {
      if (p.outfitVariant) {
        wardrobe =
          'id' in p.outfitVariant
            ? { variant: { id: p.outfitVariant.id }, expectedRevision: p.outfitVariant.expectedRevision ?? 1 }
            : { variant: { ref: p.outfitVariant.ref } };
      }
    }
    return {
      id: String(p.id),
      character,
      wardrobe,
      role: p.role ?? p.label,
      presence: p.presence ?? 'on_camera',
      performanceNotes: p.performanceNotes,
      identitySource: p.identitySource,
    };
  });

  const removeParticipantIds = Array.isArray(args.removeParticipantIds) ? (args.removeParticipantIds as string[]) : undefined;
  const primaryParticipantId = typeof args.primaryParticipantId === 'string' ? args.primaryParticipantId : undefined;

  const updatedAssetRefs = op.assetRefs?.filter((r) => r.slot !== 'character' && (r.slot as string) !== 'wardrobe');
  const updatedOp: RecipeSceneOperation = {
    ...op,
    assetRefs: updatedAssetRefs && updatedAssetRefs.length > 0 ? updatedAssetRefs : undefined,
    ensemble: {
      version: 1,
      ...(participantUpserts.length > 0 ? { participantUpserts } : {}),
      ...(removeParticipantIds ? { removeParticipantIds } : {}),
      ...(primaryParticipantId !== undefined ? { primaryParticipantId } : {}),
      ...(op.ensemble?.dialogueCues ? { dialogueCues: op.ensemble.dialogueCues } : {}),
    },
  };
  delete (updatedOp as any).dialogue;
  delete (updatedOp as any).identitySource;

  const operations = [...draft.operations];
  operations[index] = cleanObject(updatedOp as unknown as Record<string, unknown>) as unknown as RecipeSceneOperation;

  return {
    changeSet: {
      ...draft,
      operations,
    },
    operationId: updatedOp.operationId,
  };
}

export function stageSceneDialogueOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string; warnings: StagingWarning[] } {
  const sceneClientRef = String(args.sceneClientRef || '');
  const { op, index } = findStagedRecipeOperation(draft, sceneClientRef);

  let updatedOp: RecipeSceneOperation = { ...op };
  const durationSeconds = op.settings?.durationSeconds ?? 8;
  const operationId = op.operationId;
  const warnings: StagingWarning[] = [];

  if (Array.isArray(args.dialogueCues)) {
    const cast = updatedOp.ensemble?.participantUpserts ?? [];
    const castIds = new Set(cast.map((p: any) => String(p.id)));
    const dialogueCues = (args.dialogueCues as Array<Record<string, unknown>>).map((c, i) => {
      const { cue, warnings: cueWarnings } = normalizeDialogueCue(c, i, {
        castIds,
        cast,
        maxDuration: durationSeconds,
        operationId,
      });
      warnings.push(...cueWarnings);
      return cue;
    });

    updatedOp = {
      ...updatedOp,
      ensemble: {
        version: 1,
        ...(updatedOp.ensemble?.participantUpserts ? { participantUpserts: updatedOp.ensemble.participantUpserts } : {}),
        ...(updatedOp.ensemble?.primaryParticipantId ? { primaryParticipantId: updatedOp.ensemble.primaryParticipantId } : {}),
        dialogueCues: dialogueCues as any,
      },
    };
    delete (updatedOp as any).dialogue;
    delete (updatedOp as any).identitySource;
  } else if (args.dialogue !== undefined && args.dialogue !== null) {
    if (updatedOp.ensemble) {
      const d = args.dialogue as Record<string, unknown>;
      const cast = updatedOp.ensemble?.participantUpserts ?? [];
      const castIds = new Set(cast.map((p: any) => String(p.id)));
      const { cue, warnings: cueWarnings } = normalizeDialogueCue(d, 0, {
        castIds,
        cast,
        maxDuration: durationSeconds,
        defaultId: 'cue-1',
        operationId,
      });
      warnings.push(...cueWarnings);
      updatedOp = {
        ...updatedOp,
        ensemble: {
          ...updatedOp.ensemble,
          version: 1,
          dialogueCues: [cue as any],
        },
      };
      delete (updatedOp as any).dialogue;
      delete (updatedOp as any).identitySource;
    } else {
      updatedOp = {
        ...updatedOp,
        dialogue: args.dialogue as any,
      };
    }
  }

  const operations = [...draft.operations];
  operations[index] = cleanObject(updatedOp as unknown as Record<string, unknown>) as unknown as RecipeSceneOperation;

  return {
    changeSet: {
      ...draft,
      operations,
    },
    operationId: updatedOp.operationId,
    warnings,
  };
}

function normalizeCameraComposition(input?: unknown): CameraCompositionChoice | null {
  if (!input || typeof input !== 'object') return null;
  const c = input as Record<string, unknown>;
  let techniqueIds: string[] = [];

  if (Array.isArray(c.techniqueIds)) {
    techniqueIds = (c.techniqueIds as string[])
      .map(resolveCameraTechniqueId)
      .filter((id): id is string => Boolean(id));
  }

  if (techniqueIds.length === 0) {
    if (typeof c.shotSize === 'string') {
      const s = c.shotSize.toLowerCase();
      if (s.includes('close') || s === 'mcu' || s === 'cu' || s.includes('medium_close')) {
        techniqueIds.push('shot-size.medium-close-up');
      } else if (s.includes('wide') || s === 'ws') {
        techniqueIds.push('shot-size.wide-long-shot');
      } else {
        techniqueIds.push('shot-size.full-shot');
      }
    } else {
      techniqueIds.push('shot-size.wide-long-shot');
    }
  }

  const unique = Array.from(new Set(techniqueIds));

  return {
    version: 1,
    techniqueIds: unique,
    ...(c.parameters && typeof c.parameters === 'object' ? { parameters: c.parameters as any } : {}),
    ...(typeof c.arrangement === 'string' ? { arrangement: c.arrangement as any } : {}),
    ...(typeof c.includeBaseText === 'boolean' ? { includeBaseText: c.includeBaseText } : {}),
  };
}

export function stageCameraCompositionOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const sceneClientRef = String(args.sceneClientRef || '');
  const { op, index } = findStagedRecipeOperation(draft, sceneClientRef);

  const updatedOp: RecipeSceneOperation = {
    ...op,
    cameraComposition: normalizeCameraComposition(args.cameraComposition),
  };

  const operations = [...draft.operations];
  operations[index] = cleanObject(updatedOp as unknown as Record<string, unknown>) as unknown as RecipeSceneOperation;

  return {
    changeSet: {
      ...draft,
      operations,
    },
    operationId: updatedOp.operationId,
  };
}

export function stageDirectToRecipeOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const clientRef = String(args.clientRef || `scene-${Date.now()}`);
  const operationId = String(args.operationId || `op-${clientRef}`);

  const assetRefs = Array.isArray(args.assetRefs)
    ? (args.assetRefs as ImportedAssetLink[])
    : normalizeAssetRefsFromSlots(args.slots as Record<string, unknown> | undefined);

  const op: ChangeOperation = {
    operationId,
    type: 'scene.convert_direct_to_recipe',
    clientRef,
    project: args.project as ProjectTarget,
    shot: args.shot as RecordTarget,
    sceneId: String(args.sceneId),
    expectedHeadId: String(args.expectedHeadId || args.sceneId),
    conversion: normalizeConversionInput(args.conversion as Record<string, unknown> | undefined) as any,
    title: String(args.title || 'Converted Recipe'),
    shotType: normalizeShotType(args.shotType ? String(args.shotType) : undefined),
    settings: normalizeSceneSettings(args.settings as Record<string, unknown>),
    assetRefs: assetRefs.length > 0 ? assetRefs : undefined,
    sceneInstructions: typeof args.sceneInstructions === 'string' ? args.sceneInstructions : undefined,
  };

  return upsertOperation(draft, op);
}

function normalizePhase(raw?: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const res: Record<string, unknown> = {};
  if (p.zone !== undefined) res.zone = p.zone;
  if (p.depth !== undefined) res.depth = p.depth;
  if (p.visibility !== undefined) res.visibility = p.visibility;
  if (p.scenePlacement !== undefined) res.scenePlacement = p.scenePlacement;
  if (p.eyeline !== undefined) res.eyeline = p.eyeline;
  if (p.pose !== undefined || p.posture !== undefined) {
    res.pose = typeof p.pose === 'string' ? p.pose : (typeof p.posture === 'string' ? p.posture : null);
  }
  if (p.bodyDirection && typeof p.bodyDirection === 'object') {
    res.bodyDirection = p.bodyDirection;
  } else if (typeof p.bodyDirection === 'string' || typeof p.facing === 'string') {
    const f = String(p.bodyDirection || p.facing);
    const dir = f.includes('camera') ? 'toward_camera' : (f.includes('left') ? 'screen_left' : (f.includes('right') ? 'screen_right' : 'toward_camera'));
    res.bodyDirection = { kind: 'screen', direction: dir };
  }
  if (p.headDirection && typeof p.headDirection === 'object') {
    res.headDirection = p.headDirection;
  }
  return res;
}

function normalizeAction(raw?: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const text = typeof a.text === 'string' ? a.text : (typeof a.verb === 'string' ? a.verb : null);
  const kind = typeof a.kind === 'string' && ['hold', 'move', 'enter', 'exit', 'custom', 'unspecified'].includes(a.kind)
    ? a.kind
    : 'custom';
  return {
    kind,
    text,
    ...(a.waypointLandmarkIds ? { waypointLandmarkIds: a.waypointLandmarkIds } : {}),
    ...(a.interactionUpserts ? { interactionUpserts: a.interactionUpserts } : {}),
  };
}

function normalizeBlockingPatch(raw?: unknown): Record<string, unknown> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const rawParticipants = Array.isArray(b.participantUpserts)
    ? b.participantUpserts
    : Array.isArray(b.participants)
      ? b.participants
      : [];

  const participantUpserts = rawParticipants.map((p: any) => ({
    participant: p.participant ?? (p.participantId ? { kind: 'ensemble', participantId: p.participantId } : { kind: 'primary' }),
    ...(p.start ? { start: normalizePhase(p.start) } : {}),
    ...(p.action ? { action: normalizeAction(p.action) } : {}),
    ...(p.end ? { end: normalizePhase(p.end) } : {}),
  }));

  const rawLandmarks = Array.isArray(b.landmarkUpserts)
    ? b.landmarkUpserts
    : Array.isArray(b.landmarks)
      ? b.landmarks
      : [];

  const landmarkUpserts = rawLandmarks.map((l: any) => ({
    id: String(l.id),
    label: String(l.label || l.id),
    description: typeof l.description === 'string' ? l.description : null,
    screen: l.screen || (l.zone || l.depth ? { zone: l.zone || null, depth: l.depth || null } : null),
  }));

  return {
    version: 1,
    expectedBaseDigest: typeof b.expectedBaseDigest === 'string' && /^[a-f0-9]{64}$/.test(b.expectedBaseDigest)
      ? b.expectedBaseDigest
      : NULL_BLOCKING_DIGEST,
    ...(participantUpserts.length > 0 ? { participantUpserts } : {}),
    ...(landmarkUpserts.length > 0 ? { landmarkUpserts } : {}),
  };
}

export function stageSceneBlockingOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const sceneClientRef = String(args.sceneClientRef || '');
  const { op, index } = findStagedRecipeOperation(draft, sceneClientRef);

  const blocking = normalizeBlockingPatch(args.blocking);

  const updatedOp: RecipeSceneOperation = {
    ...op,
    blocking: blocking as unknown as BlockingPatchV1,
  };

  const operations = [...draft.operations];
  operations[index] = cleanObject(updatedOp as unknown as Record<string, unknown>) as unknown as RecipeSceneOperation;
  const updatedSchema = resolveMinimumSchema(operations, draft.schema);
  const finalOps = ensureSchemaTokens(operations, updatedSchema);

  return {
    changeSet: {
      ...draft,
      schema: updatedSchema,
      operations: finalOps,
    },
    operationId: updatedOp.operationId,
  };
}

export function stageKeyframePlanOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const sceneClientRef = String(args.sceneClientRef || '');
  const { op, index } = findStagedRecipeOperation(draft, sceneClientRef);

  const keyframes = normalizeKeyframes(args.keyframePlan ?? args.keyframes);

  const updatedOp: RecipeSceneOperation = {
    ...op,
    keyframes: keyframes as any,
    videoDecision: (args.videoDecision as any) ?? (op as any).videoDecision ?? 'reassemble',
  };

  const operations = [...draft.operations];
  operations[index] = cleanObject(updatedOp as unknown as Record<string, unknown>) as unknown as RecipeSceneOperation;
  const updatedSchema = resolveMinimumSchema(operations, draft.schema);
  const finalOps = ensureSchemaTokens(operations, updatedSchema);

  return {
    changeSet: {
      ...draft,
      schema: updatedSchema,
      operations: finalOps,
    },
    operationId: updatedOp.operationId,
  };
}

export function stageFrameImageOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const scene = args.scene as RecordTarget;
  const sceneKey = 'id' in scene ? scene.id : scene.ref;
  const frameId = String(args.frameId);
  const operationId = String(args.operationId || `op-frame-image-${sceneKey}-${frameId}`);
  const isClear = args.mediaId === null || args.mediaId === undefined;

  const expectedFrameDigest = typeof args.expectedFrameDigest === 'string' ? args.expectedFrameDigest : DEFAULT_DIGEST;

  const op: ChangeOperation = isClear
    ? {
        operationId,
        type: 'frame_image.clear',
        project: args.project as ProjectTarget,
        shot: args.shot as RecordTarget,
        scene,
        frameId,
        expectedFrameDigest,
        expectedAssociationRevision: typeof args.expectedAssociationRevision === 'number' ? args.expectedAssociationRevision : 0,
      }
    : {
        operationId,
        type: 'frame_image.link',
        project: args.project as ProjectTarget,
        shot: args.shot as RecordTarget,
        scene,
        frameId,
        mediaId: String(args.mediaId),
        expectedFrameDigest,
        expectedAssociationRevision: typeof args.expectedAssociationRevision === 'number' ? args.expectedAssociationRevision : 0,
      };

  return upsertOperation(draft, op);
}

export function stageStoryboardBatchOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): {
  changeSet: ChangeSet;
  operationId: string;
  stagedCounts: { assets: number; variants: number; projects: number; shots: number; scenes: number };
  warnings: StagingWarning[];
} {
  let currentDraft = structuredClone(draft);
  const changeSetId = String(args.changeSetId);
  if (typeof args.title === 'string') currentDraft.title = args.title;
  if (typeof args.description === 'string') currentDraft.description = args.description;

  const warnings: StagingWarning[] = [];
  let assets = 0;
  let variants = 0;
  let projects = 0;
  let shots = 0;
  let scenes = 0;

  for (const a of (Array.isArray(args.assets) ? args.assets : [])) {
    const res = stageAssetCandidateOperation(currentDraft, { ...a, changeSetId });
    currentDraft = res.changeSet;
    assets++;
  }

  for (const v of (Array.isArray(args.variants) ? args.variants : [])) {
    const res = stageOutfitVariantOperation(currentDraft, { ...v, changeSetId });
    currentDraft = res.changeSet;
    variants++;
  }

  let defaultProjectTarget: ProjectTarget | undefined;
  if (args.project && typeof args.project === 'object') {
    const p = args.project as Record<string, unknown>;
    const res = stageProjectOperation(currentDraft, { ...p, changeSetId });
    currentDraft = res.changeSet;
    defaultProjectTarget = normalizeProjectTarget(p, String(p.clientRef || 'proj-main'));
    projects++;
  }

  for (const s of (Array.isArray(args.shots) ? args.shots : [])) {
    const shotObj = { ...s, changeSetId };
    if (!shotObj.project && defaultProjectTarget) {
      shotObj.project = defaultProjectTarget;
    }
    const res = stageShotOperation(currentDraft, shotObj);
    currentDraft = res.changeSet;
    shots++;
  }

  for (const sc of (Array.isArray(args.scenes) ? args.scenes : [])) {
    const sceneObj = { ...sc, changeSetId };
    if (!sceneObj.project && defaultProjectTarget) {
      sceneObj.project = defaultProjectTarget;
    }
    const res = stageSceneRecipeOperation(currentDraft, sceneObj);
    currentDraft = res.changeSet;
    warnings.push(...res.warnings);
    scenes++;
  }

  return {
    changeSet: currentDraft,
    operationId: `op-batch-${changeSetId}`,
    stagedCounts: { assets, variants, projects, shots, scenes },
    warnings,
  };
}

function normalizeStoryTarget(storyId?: string, storyRefRaw?: unknown): RecordTarget | undefined {
  if (storyRefRaw && typeof storyRefRaw === 'object') {
    const r = storyRefRaw as Record<string, unknown>;
    if (typeof r.id === 'string' && r.id) return { id: r.id };
    if (typeof r.ref === 'string' && r.ref) return { ref: r.ref };
  }
  if (storyId) return { id: storyId };
  return undefined;
}

export function stageStoryOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const isCreate = args.mode === 'create' || (!args.storyId && !args.storyRef);
  const clientRef = String(args.clientRef || args.storyId || `story-${Date.now()}`);
  const operationId = `op-story-${clientRef}`;

  if (isCreate) {
    const op: StoryCreateOperation = {
      operationId,
      type: 'story.create',
      clientRef,
      title: typeof args.title === 'string' && args.title.trim() ? args.title.trim() : 'Untitled Story',
      author: typeof args.author === 'string' ? args.author : undefined,
      tags: Array.isArray(args.tags) ? (args.tags as string[]) : undefined,
      coverMediaId: typeof args.coverMediaId === 'string' ? args.coverMediaId : undefined,
      heroBannerMediaId: typeof args.heroBannerMediaId === 'string' ? args.heroBannerMediaId : undefined,
      logline: typeof args.logline === 'string' ? args.logline : undefined,
      premise: typeof args.premise === 'string' ? args.premise : undefined,
      synopsis: typeof args.synopsis === 'string' ? args.synopsis : undefined,
      treatment: typeof args.treatment === 'string' ? args.treatment : undefined,
      fullBookText: typeof args.fullBookText === 'string' ? args.fullBookText : undefined,
      acts: Array.isArray(args.acts) ? (args.acts as StoryAct[]) : undefined,
      referencePack: args.referencePack && typeof args.referencePack === 'object' ? (args.referencePack as StoryReferencePack) : undefined,
      linkedCollectionId: typeof args.linkedCollectionId === 'string' ? args.linkedCollectionId : undefined,
      colorScript: Array.isArray(args.colorScript) ? (args.colorScript as StoryColorScriptEntry[]) : undefined,
    };
    return upsertOperation(draft, op as unknown as ChangeOperation);
  } else {
    const storyId = typeof args.storyId === 'string' ? args.storyId : undefined;
    const storyRef = normalizeStoryTarget(storyId, args.storyRef);
    const op: StoryUpdateOperation = {
      operationId,
      type: 'story.update',
      storyId,
      storyRef,
      clientRef: args.clientRef ? String(args.clientRef) : undefined,
      title: typeof args.title === 'string' ? args.title : undefined,
      author: typeof args.author === 'string' ? args.author : undefined,
      tags: Array.isArray(args.tags) ? (args.tags as string[]) : undefined,
      coverMediaId: typeof args.coverMediaId === 'string' ? args.coverMediaId : undefined,
      heroBannerMediaId: typeof args.heroBannerMediaId === 'string' ? args.heroBannerMediaId : undefined,
      logline: typeof args.logline === 'string' ? args.logline : undefined,
      premise: typeof args.premise === 'string' ? args.premise : undefined,
      synopsis: typeof args.synopsis === 'string' ? args.synopsis : undefined,
      treatment: typeof args.treatment === 'string' ? args.treatment : undefined,
      fullBookText: typeof args.fullBookText === 'string' ? args.fullBookText : undefined,
      expectedRevision: typeof args.expectedRevision === 'number' ? args.expectedRevision : undefined,
      expectedStoryDigest: typeof args.expectedStoryDigest === 'string' ? args.expectedStoryDigest : undefined,
    };
    return upsertOperation(draft, op as unknown as ChangeOperation);
  }
}

export function stageStoryStatusOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const storyId = typeof args.storyId === 'string' ? args.storyId : undefined;
  const storyRef = normalizeStoryTarget(storyId, args.storyRef);
  const clientRef = args.clientRef ? String(args.clientRef) : (storyId || `story-${Date.now()}`);
  const operationId = `op-story-status-${clientRef}`;

  const op: StoryStatusOperation = {
    operationId,
    type: 'story.set_status',
    storyId,
    storyRef,
    clientRef: args.clientRef ? String(args.clientRef) : undefined,
    status: args.status === 'active' || args.status === 'archived' ? args.status : undefined,
    archived: typeof args.archived === 'boolean' ? args.archived : (args.status === 'archived' ? true : args.status === 'active' ? false : undefined),
    favorite: typeof args.favorite === 'boolean' ? args.favorite : undefined,
    expectedRevision: typeof args.expectedRevision === 'number' ? args.expectedRevision : undefined,
    expectedStoryDigest: typeof args.expectedStoryDigest === 'string' ? args.expectedStoryDigest : undefined,
  };
  return upsertOperation(draft, op as unknown as ChangeOperation);
}

export function stageStoryStructureOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const storyId = typeof args.storyId === 'string' ? args.storyId : undefined;
  const storyRef = normalizeStoryTarget(storyId, args.storyRef);
  const clientRef = args.clientRef ? String(args.clientRef) : (storyId || `story-${Date.now()}`);
  const operationId = `op-story-struct-${clientRef}`;

  const op: StoryStructurePatchOperation = {
    operationId,
    type: 'story.patch_structure',
    storyId,
    storyRef,
    clientRef: args.clientRef ? String(args.clientRef) : undefined,
    acts: Array.isArray(args.acts) ? (args.acts as StoryAct[]) : [],
    expectedRevision: typeof args.expectedRevision === 'number' ? args.expectedRevision : undefined,
    expectedStoryDigest: typeof args.expectedStoryDigest === 'string' ? args.expectedStoryDigest : undefined,
  };
  return upsertOperation(draft, op as unknown as ChangeOperation);
}

export function stageStoryDramaticMetaOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const storyId = typeof args.storyId === 'string' ? args.storyId : undefined;
  const storyRef = normalizeStoryTarget(storyId, args.storyRef);
  const clientRef = args.clientRef ? String(args.clientRef) : (storyId || `story-${Date.now()}`);
  const operationId = `op-story-dramatic-${clientRef}`;

  const targetNodeId = (args.targetNode as any)?.id || (typeof args.targetNodeId === 'string' ? args.targetNodeId : undefined);
  const op: StoryDramaticMetaPatchOperation = {
    operationId,
    type: 'story.patch_dramatic_meta',
    storyId,
    storyRef,
    clientRef: args.clientRef ? String(args.clientRef) : undefined,
    targetNodeId: String(targetNodeId || 'node-root'),
    targetNode: args.targetNode as { kind: 'act' | 'sequence' | 'scene' | 'beat'; id: string },
    dramaticMeta: args.dramaticMeta as StoryDramaticMeta,
    expectedRevision: typeof args.expectedRevision === 'number' ? args.expectedRevision : undefined,
    expectedStoryDigest: typeof args.expectedStoryDigest === 'string' ? args.expectedStoryDigest : undefined,
  };
  return upsertOperation(draft, op as unknown as ChangeOperation);
}

export function stageStoryReferencesOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const storyId = typeof args.storyId === 'string' ? args.storyId : undefined;
  const storyRef = normalizeStoryTarget(storyId, args.storyRef);
  const clientRef = args.clientRef ? String(args.clientRef) : (storyId || `story-${Date.now()}`);
  const operationId = `op-story-refs-${clientRef}`;

  const op: StoryReferencesPatchOperation = {
    operationId,
    type: 'story.patch_references',
    storyId,
    storyRef,
    clientRef: args.clientRef ? String(args.clientRef) : undefined,
    referencePack: args.referencePack && typeof args.referencePack === 'object' ? (args.referencePack as StoryReferencePack) : undefined,
    colorScript: Array.isArray(args.colorScript) ? (args.colorScript as StoryColorScriptEntry[]) : undefined,
    linkedCollectionId: typeof args.linkedCollectionId === 'string' ? args.linkedCollectionId : undefined,
    expectedRevision: typeof args.expectedRevision === 'number' ? args.expectedRevision : undefined,
    expectedStoryDigest: typeof args.expectedStoryDigest === 'string' ? args.expectedStoryDigest : undefined,
  };
  return upsertOperation(draft, op as unknown as ChangeOperation);
}
