import type {
  ChangeOperation,
  ChangeSet,
  CandidateKind,
  ImportedAssetLink,
  ProjectTarget,
  RecordTarget,
  RecipeSceneOperation,
} from '../types/changeSet';
import type { BuilderSlot, ProductionStatus, SceneSettings, ShotType } from '../types/domain';
import type { CameraCompositionChoice } from '../types/cinematography';
import type { DialogueCue } from '../types/ensemble';
import type { SceneBlockingV1 } from '../types/blocking';
import type { BlockingPatchV1 } from '../types/blockingChangeSet';
import type { KeyframePlanV1, KeyframePatchV1 } from '../types/keyframes';
import { NULL_BLOCKING_DIGEST } from './blockingPatch';
import { McpError } from './mcpProtocol';

const DEFAULT_DIGEST = '0'.repeat(64);

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
};

const SCHEMAS_BY_RANK: Record<number, ChangeSet['schema']> = {
  1: 'krakinai.change-set.v1',
  2: 'krakinai.change-set.v2',
  3: 'krakinai.change-set.v3',
  4: 'krakinai.change-set.v4',
  5: 'krakinai.change-set.v5',
  6: 'krakinai.change-set.v6',
};

function getOperationBucket(type: string): number {
  if (type === 'asset.propose' || type === 'variant.propose' || type === 'asset.review_candidate' || type === 'variant.review_candidate') {
    return 10;
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

export function stageSceneRecipeOperation(
  draft: ChangeSet,
  args: Record<string, unknown>,
): { changeSet: ChangeSet; operationId: string } {
  const clientRef = String(args.clientRef || `scene-${args.shot?.toString() || Date.now()}`);
  const operationId = String(args.operationId || `op-${clientRef}`);
  const mode = String(args.mode || 'create');

  const assetRefs = Array.isArray(args.assetRefs)
    ? (args.assetRefs as ImportedAssetLink[])
    : normalizeAssetRefsFromSlots(args.slots as Record<string, unknown> | undefined);

  let op: ChangeOperation;

  if (mode === 'revise' || mode === 'take') {
    op = {
      operationId,
      type: mode === 'revise' ? 'scene.revise_recipe' : 'scene.create_recipe_take',
      clientRef,
      project: args.project as ProjectTarget,
      shot: args.shot as RecordTarget,
      sceneId: String(args.sceneId),
      expectedHeadId: String(args.expectedHeadId || args.sceneId),
      title: typeof args.title === 'string' ? args.title : undefined,
      shotType: args.shotType ? normalizeShotType(String(args.shotType)) : undefined,
      settings: args.settings ? normalizeSceneSettings(args.settings as Record<string, unknown>) : undefined,
      assetRefs: assetRefs.length > 0 ? assetRefs : undefined,
      sceneInstructions: typeof args.sceneInstructions === 'string' ? args.sceneInstructions : undefined,
      avoidText: typeof args.avoidText === 'string' ? args.avoidText : undefined,
    };
  } else {
    op = {
      operationId,
      type: 'scene.create_recipe',
      clientRef,
      project: args.project as ProjectTarget,
      shot: args.shot as RecordTarget,
      title: String(args.title || 'Untitled Recipe Take'),
      shotType: normalizeShotType(args.shotType ? String(args.shotType) : undefined),
      settings: normalizeSceneSettings(args.settings as Record<string, unknown>),
      assetRefs: assetRefs.length > 0 ? assetRefs : undefined,
      sceneInstructions: typeof args.sceneInstructions === 'string' ? args.sceneInstructions : undefined,
      avoidText: typeof args.avoidText === 'string' ? args.avoidText : undefined,
    };
  }

  return upsertOperation(draft, op);
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
): { changeSet: ChangeSet; operationId: string } {
  const sceneClientRef = String(args.sceneClientRef || '');
  const { op, index } = findStagedRecipeOperation(draft, sceneClientRef);

  let updatedOp: RecipeSceneOperation = { ...op };

  if (Array.isArray(args.dialogueCues)) {
    const dialogueCues = (args.dialogueCues as Array<Record<string, unknown>>).map((c, i) => {
      const line = String(c.lineText || c.line || '');
      const speaker = String(c.speaker || c.speakerParticipantId || 'Speaker');
      const cueObj: Record<string, unknown> = {
        id: String(c.id || `cue-${i + 1}`),
        speaker,
        line,
      };
      if (typeof c.speakerParticipantId === 'string' || typeof c.participantId === 'string') {
        cueObj.participantId = c.speakerParticipantId || c.participantId;
      }
      if (typeof c.startSeconds === 'number' && typeof c.endSeconds === 'number') {
        cueObj.timing = { startSeconds: c.startSeconds, endSeconds: c.endSeconds };
      } else if (c.timing && typeof c.timing === 'object') {
        cueObj.timing = c.timing;
      }
      if (typeof c.mode === 'string') {
        cueObj.mode = c.mode;
      }
      if (typeof c.deliveryNotes === 'string') {
        cueObj.deliveryNotes = c.deliveryNotes;
      }
      if (typeof c.language === 'string') {
        cueObj.language = c.language;
      }
      if (typeof c.captionPreference === 'string') {
        cueObj.captionPreference = c.captionPreference;
      }
      if (c.performanceDirection) {
        cueObj.performanceDirection = c.performanceDirection;
      }
      return cueObj;
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
  }

  if (args.dialogue !== undefined) {
    updatedOp = {
      ...updatedOp,
      dialogue: args.dialogue as any,
    };
  }

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

function normalizeCameraComposition(input?: unknown): CameraCompositionChoice | null {
  if (!input || typeof input !== 'object') return null;
  const c = input as Record<string, unknown>;
  if (c.version === 1 && Array.isArray(c.techniqueIds)) {
    return c as unknown as CameraCompositionChoice;
  }
  const techniqueIds: string[] = Array.isArray(c.techniqueIds) ? [...(c.techniqueIds as string[])] : [];

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

  return {
    version: 1,
    techniqueIds,
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

  const raw = (args.keyframePlan ?? args.keyframes ?? {}) as Record<string, unknown>;
  const rawFrames = Array.isArray(raw.frames) ? raw.frames : (Array.isArray(raw.frameUpserts) ? raw.frameUpserts : []);
  const frameUpserts = rawFrames.map((f: any, i: number) => ({
    id: String(f.id || `frame-${i + 1}`),
    label: typeof f.label === 'string' ? f.label : null,
    role: f.kind === 'start' ? 'start' : (f.kind === 'end' ? 'end' : (f.role || 'custom')),
    visualInstructions: f.beatDescription || f.visualInstructions || null,
  }));

  const keyframes: Record<string, unknown> = {
    version: 1,
    expectedBaseDigest: typeof raw.expectedBaseDigest === 'string' && /^[a-f0-9]{64}$/.test(raw.expectedBaseDigest)
      ? raw.expectedBaseDigest
      : NULL_BLOCKING_DIGEST,
    ...(frameUpserts.length > 0 ? { frameUpserts } : {}),
  };

  const updatedOp: RecipeSceneOperation = {
    ...op,
    keyframes: keyframes as any,
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
