import type {
  ChangeSet,
  ChangeSetState,
  RecipeSceneOperation,
} from '../types/changeSet';
import type { BuilderSlot, Collection, ComponentSnapshot, MediaAsset, PromptAsset, SavedScene, SceneDraft, Template, Variant } from '../types/domain';
import type { McpScope } from '../types/mcp';
import { McpError } from './mcpProtocol';
import { authorizedSceneIds, denyScope } from './mcpScope';
import { buildContinuityWorkspace } from './continuityWorkspace';
import { buildBlockingFinalReview } from './blockingReview';
import { applyBlockingPatch, NULL_BLOCKING_DIGEST } from './blockingPatch';
import { assembleScenePrompt, createSnapshotFromAsset } from './promptAssembler';
import { runScenePreflight } from './scenePreflight';
import { formatSelectedPrompts } from '../storage/projectBulk';
import { SHOT_TYPES, SHOT_TYPE_DESCRIPTIONS, SHOT_TYPE_LABELS, getShotTypeRules } from './shotTypeRules';
import { CATALOG_FAMILIES, CATALOG_TECHNIQUES } from './cinematographyCatalog';
import {
  EMOTIONS,
  EMOTIONAL_INTENSITIES,
  TECHNIQUES,
  VOICE_FIELDS,
  SPEECH_FIELDS,
  GESTURES,
} from './performanceCatalog';
import { DELIVERY_STYLES, SPEAKING_PACES, BODY_LANGUAGE } from './dialoguePerformance';

import { findCandidateMatches, normalize, normalizeBaseTitle } from './changeSetCandidates';

export type GranularSnapshot = ChangeSetState | {
  projects?: Collection[];
  collections?: Collection[];
  scenes: SavedScene[];
  assets: PromptAsset[];
  variants?: Variant[];
  templates?: Template[];
  media?: MediaAsset[];
  preferences?: Record<string, unknown>;
};

function getCollections(snapshot: GranularSnapshot): Collection[] {
  if ('collections' in snapshot && Array.isArray(snapshot.collections)) {
    return snapshot.collections;
  }
  if ('projects' in snapshot && Array.isArray(snapshot.projects)) {
    return snapshot.projects;
  }
  return [];
}

function cleanObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

export function readAssetDetail(
  snapshot: GranularSnapshot,
  scope: McpScope,
  args: { id: string },
): Record<string, unknown> {
  if (!scope.assetIds.includes(args.id)) {
    denyScope();
  }

  const asset = snapshot.assets.find((a) => a.id === args.id);
  if (!asset) {
    denyScope();
  }

  const linkedVariants = (snapshot.variants ?? []).filter(
    (v) => v.parentCharacterId === asset.id && scope.variantIds.includes(v.id),
  );

  const outfitVariants = linkedVariants.map((v) =>
    cleanObject({
      id: v.id,
      kind: 'outfit',
      title: v.title,
      tags: v.tags,
      revision: v.revision,
      promptText: scope.includeAssetText ? v.promptText : undefined,
      compactText: scope.includeAssetText ? v.compactText : undefined,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }),
  );

  let identityAnchor: unknown = undefined;
  if (asset.identityAnchor) {
    if (scope.includeCharacterIdentity) {
      identityAnchor = structuredClone(asset.identityAnchor);
    } else {
      const status = (asset.identityAnchor as unknown as { status?: string }).status ?? (asset.identityAnchor.approvedText ? 'approved' : 'draft');
      identityAnchor = { status, redacted: true };
    }
  }

  const rawAsset = asset as unknown as Record<string, unknown>;
  return cleanObject({
    id: asset.id,
    kind: asset.category || rawAsset.kind || 'characters',
    title: asset.title,
    tags: asset.tags,
    isFavorite: rawAsset.isFavorite ?? asset.favorite,
    revision: asset.revision,
    parentCharacterId: rawAsset.parentCharacterId,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    promptText: scope.includeAssetText ? asset.promptText : undefined,
    compactText: scope.includeAssetText ? asset.compactText : undefined,
    description: scope.includeAssetText ? asset.description : undefined,
    notes: scope.includeNotes ? asset.notes : undefined,
    identityAnchor,
    outfitVariants,
  });
}

export function readCatalogPresets(args: {
  catalog: 'cinematography' | 'performance' | 'shot_types';
}): Record<string, unknown> {
  if (args.catalog === 'cinematography') {
    const shotSizes = CATALOG_TECHNIQUES.filter((t) => t.dimension === 'shotSize').map((t) => ({
      id: t.id,
      name: t.name,
      aliases: t.aliases,
    }));
    const angles = CATALOG_TECHNIQUES.filter((t) => t.dimension === 'angle').map((t) => ({
      id: t.id,
      name: t.name,
      aliases: t.aliases,
    }));
    const movements = CATALOG_TECHNIQUES.filter((t) => t.dimension === 'movement').map((t) => ({
      id: t.id,
      name: t.name,
      aliases: t.aliases,
    }));

    return {
      catalog: 'cinematography',
      families: CATALOG_FAMILIES,
      shotSizes,
      angles,
      movements,
      totalTechniques: CATALOG_TECHNIQUES.length,
    };
  }

  if (args.catalog === 'performance') {
    return {
      catalog: 'performance',
      emotions: Object.keys(EMOTIONS),
      emotionalIntensities: Object.keys(EMOTIONAL_INTENSITIES),
      deliveryStyles: DELIVERY_STYLES,
      speakingPaces: Object.keys(SPEAKING_PACES),
      bodyLanguage: Object.keys(BODY_LANGUAGE),
      techniques: Object.keys(TECHNIQUES),
      voiceFields: Object.keys(VOICE_FIELDS),
      speechFields: Object.keys(SPEECH_FIELDS),
      gestures: Object.keys(GESTURES),
    };
  }

  return {
    catalog: 'shot_types',
    items: SHOT_TYPES.map((type) => ({
      type,
      label: SHOT_TYPE_LABELS[type],
      description: SHOT_TYPE_DESCRIPTIONS[type],
      rules: getShotTypeRules({ shotType: type }),
    })),
  };
}

export function readProjectContinuity(
  snapshot: GranularSnapshot,
  scope: McpScope,
  args: { projectId: string },
): Record<string, unknown> {
  if (!scope.projectIds.includes(args.projectId)) {
    denyScope();
  }

  const collections = getCollections(snapshot);
  const collection = collections.find((c) => c.id === args.projectId);
  if (!collection) {
    denyScope();
  }

  const ws = buildContinuityWorkspace(collection, snapshot.scenes, snapshot.media ?? []);
  return {
    projectId: ws.projectId,
    projectRevision: ws.projectRevision,
    cast: ws.matrix,
    rows: ws.rows,
    transitions: ws.pairs,
    detachedTransitions: ws.detached,
    summary: ws.summary,
  };
}

function buildStagedRecipeDraft(
  op: RecipeSceneOperation,
  snapshot: GranularSnapshot,
  stagedChangeSet?: ChangeSet,
): { draft: SceneDraft; referencedExistingAssetIds: string[] } {
  const slots: Partial<Record<BuilderSlot, ComponentSnapshot>> = {};
  const referencedExistingAssetIds: string[] = [];

  for (const link of op.assetRefs ?? []) {
    if ('id' in link.asset) {
      const targetId = link.asset.id;
      referencedExistingAssetIds.push(targetId);
      const asset = snapshot.assets.find((a) => a.id === targetId);
      if (asset) {
        slots[link.slot] = createSnapshotFromAsset(asset);
      }
    } else if ('ref' in link.asset && stagedChangeSet) {
      const targetRef = link.asset.ref;
      const candidate = stagedChangeSet.operations.find(
        (c) => c.type === 'asset.propose' && (c.clientRef === targetRef || c.operationId === targetRef),
      );
      if (candidate && candidate.type === 'asset.propose') {
        slots[link.slot] = {
          slot: link.slot,
          sourceType: 'asset',
          sourceId: candidate.clientRef || candidate.operationId,
          sourceRevision: 1,
          sourceTitle: candidate.title,
          promptText: candidate.promptText,
          mediaLinks: [],
        };
      }
    }
  }

  const draft: SceneDraft = {
    id: `staged_${op.clientRef || op.operationId}`,
    inputRevision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    authoringMode: 'recipe',
    title: op.title || 'Staged Scene Recipe',
    shotType: op.shotType || 'character_scene',
    slots,
    extraRequiredSlots: [],
    sceneInstructions: op.sceneInstructions || '',
    avoidText: op.avoidText,
    settings: op.settings || { aspectRatio: '16:9', durationSeconds: 8 },
    dialogue: op.dialogue ?? undefined,
    manualOutputs: {},
    resultMediaLinks: [],
    reviewNotes: '',
    reviewStatus: 'unreviewed',
  };

  if (op.blocking) {
    try {
      draft.blocking = applyBlockingPatch(undefined, op.blocking, draft, NULL_BLOCKING_DIGEST);
    } catch {
      // Keep draft without blocking if patch cannot bind yet during incremental authoring
    }
  }

  return { draft, referencedExistingAssetIds };
}

export function readSpatialContinuity(
  snapshot: GranularSnapshot,
  scope: McpScope,
  args: { projectId: string; changeSetId?: string },
  stagedChangeSet?: ChangeSet,
): Record<string, unknown> {
  if (!scope.projectIds.includes(args.projectId)) {
    denyScope();
  }

  const collections = getCollections(snapshot);
  const collection = collections.find((c) => c.id === args.projectId);
  if (!collection) {
    denyScope();
  }

  const newScenes: SavedScene[] = [];
  let effectiveCollection = collection;

  if (stagedChangeSet && collection.project) {
    const clonedCollection = structuredClone(collection);
    for (const op of stagedChangeSet.operations) {
      if (
        (op.type === 'scene.create_recipe' ||
          op.type === 'scene.revise_recipe' ||
          op.type === 'scene.create_recipe_take' ||
          op.type === 'scene.convert_direct_to_recipe') &&
        'id' in op.project &&
        op.project.id === collection.id &&
        op.blocking
      ) {
        const { draft } = buildStagedRecipeDraft(op, snapshot, stagedChangeSet);
        const shotId = 'id' in op.shot ? op.shot.id : op.shot.ref;
        const shot = clonedCollection.project?.shots.find((s) => s.id === shotId);
        const stagedScene = {
          ...draft,
          id: draft.id,
          createdAt: draft.updatedAt,
          revision: 1,
          outputs: { full: '', structured: '', compact: '' },
          references: [],
        } as unknown as SavedScene;
        newScenes.push(stagedScene);
        if (shot && !shot.takeSceneIds.includes(stagedScene.id)) {
          shot.takeSceneIds.push(stagedScene.id);
        }
      }
    }
    effectiveCollection = clonedCollection;
  }

  const review = buildBlockingFinalReview([effectiveCollection], snapshot.scenes, newScenes);
  const comparisons = review[0]?.comparisons ?? [];
  const findings = comparisons.flatMap((c) => c.comparison?.findings ?? []);

  return {
    projectId: collection.id,
    findings,
    comparisons,
  };
}

export function readSceneAssemblyPreview(
  snapshot: GranularSnapshot,
  scope: McpScope,
  args: { sceneId?: string; changeSetId?: string; sceneClientRef?: string },
  stagedChangeSet?: ChangeSet,
): Record<string, unknown> {
  if (!args.sceneId && args.changeSetId && args.sceneClientRef) {
    if (!stagedChangeSet || stagedChangeSet.changeSetId !== args.changeSetId) {
      throw new McpError('NOT_FOUND', `Staged proposal "${args.changeSetId}" was not found.`);
    }
    const op = stagedChangeSet.operations.find(
      (o) =>
        (o.clientRef === args.sceneClientRef || o.operationId === args.sceneClientRef) &&
        (o.type === 'scene.create_recipe' ||
          o.type === 'scene.revise_recipe' ||
          o.type === 'scene.create_recipe_take' ||
          o.type === 'scene.convert_direct_to_recipe'),
    ) as RecipeSceneOperation | undefined;
    if (!op) {
      throw new McpError('NOT_FOUND', `No staged scene recipe matches sceneClientRef "${args.sceneClientRef}".`);
    }

    const { draft, referencedExistingAssetIds } = buildStagedRecipeDraft(op, snapshot, stagedChangeSet);
    const allAssetsAuthorized = referencedExistingAssetIds.every((id) => scope.assetIds.includes(id));
    if (!allAssetsAuthorized) {
      denyScope();
    }

    const assembled = assembleScenePrompt(draft);
    const preflightFindings = runScenePreflight(draft as any);
    const canReadFullPrompt = Boolean(scope.includeAssetText && allAssetsAuthorized);

    return {
      changeSetId: stagedChangeSet.changeSetId,
      sceneClientRef: args.sceneClientRef,
      title: draft.title,
      shotType: draft.shotType,
      authoringMode: draft.authoringMode,
      valid: assembled.valid,
      assemblyErrors: assembled.errors,
      preflightFindings,
      assembledPrompt: canReadFullPrompt ? assembled.outputs.full : undefined,
      fullPromptDisclosure: canReadFullPrompt ? 'disclosed' : 'withheld',
    };
  }

  if (!args.sceneId) {
    throw new McpError('INVALID_REQUEST', 'Provide either sceneId or both changeSetId and sceneClientRef for assembly preview.');
  }

  const authorized = authorizedSceneIds(scope, snapshot as ChangeSetState);
  if (!authorized.has(args.sceneId)) {
    denyScope();
  }

  const scene = snapshot.scenes.find((s) => s.id === args.sceneId);
  if (!scene) {
    denyScope();
  }

  const sceneForPreflight = {
    ...scene,
    sceneInstructions: scene.sceneInstructions ?? '',
    slots: scene.slots ?? {},
    settings: scene.settings ?? { outputType: 'Video Prompts', quantity: 1, aspectRatio: '16:9', durationSeconds: 8 },
  };

  const preflightFindings = runScenePreflight(sceneForPreflight as any);
  const canReadFullPrompt = scope.fullPromptSceneIds.includes(scene.id);
  const fullPrompt = scene.outputs?.full ?? (scene as any).finalPrompt;

  return {
    sceneId: scene.id,
    title: scene.title,
    shotType: scene.shotType,
    authoringMode: scene.authoringMode,
    preflightFindings,
    assembledPrompt: canReadFullPrompt ? fullPrompt : undefined,
    fullPromptDisclosure: canReadFullPrompt ? 'disclosed' : 'withheld',
  };
}

export function readSavedScenesList(
  snapshot: GranularSnapshot,
  scope: McpScope,
  args: {
    query?: string;
    archiveFilter?: 'active' | 'archived' | 'all';
    shotType?: string;
    reviewStatus?: string;
    cursor?: string;
    limit?: number;
  },
): Record<string, unknown> {
  const authorized = authorizedSceneIds(scope, snapshot as ChangeSetState);
  const archiveFilter = args.archiveFilter || 'active';
  const query = args.query ? args.query.toLowerCase().trim() : '';

  const filtered = snapshot.scenes.filter((s) => {
    if (!authorized.has(s.id)) return false;
    if (archiveFilter === 'active' && s.archivedAt) return false;
    if (archiveFilter === 'archived' && !s.archivedAt) return false;
    if (args.shotType && s.shotType !== args.shotType) return false;
    if (args.reviewStatus && s.reviewStatus !== args.reviewStatus) return false;
    if (query && !s.title.toLowerCase().includes(query)) return false;
    return true;
  });

  const limit = Math.min(Math.max(Number(args.limit ?? 20), 1), 50);
  const offset = args.cursor ? Number(args.cursor) || 0 : 0;
  const page = filtered.slice(offset, offset + limit);
  const nextCursor = offset + limit < filtered.length ? String(offset + limit) : null;

  const items = page.map((s) => ({
    id: s.id,
    headId: (s as unknown as Record<string, unknown>).headId ?? s.sceneRevision?.parentSceneId ?? s.id,
    title: s.title,
    authoringMode: s.authoringMode,
    shotType: s.shotType,
    reviewStatus: s.reviewStatus,
    archivedAt: s.archivedAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));

  return {
    items,
    total: filtered.length,
    nextCursor,
  };
}

export function readExportedScenePrompts(
  snapshot: GranularSnapshot,
  scope: McpScope,
  args: { sceneIds: string[] },
): { text: string; sceneCount: number } {
  if (!Array.isArray(args.sceneIds) || args.sceneIds.length === 0) {
    throw new McpError('INVALID_REQUEST', 'Select at least one sceneId to export.');
  }

  const authorized = authorizedSceneIds(scope, snapshot as ChangeSetState);

  for (const id of args.sceneIds) {
    if (!authorized.has(id)) {
      denyScope();
    }
    if (!scope.fullPromptSceneIds.includes(id)) {
      throw new McpError(
        'PERMISSION_DENIED',
        `Full prompt disclosure is not enabled for scene "${id}". Add full-prompt permissions in AI Connections.`,
      );
    }
  }

  const scenes = args.sceneIds.map((id) => {
    const s = snapshot.scenes.find((sc) => sc.id === id);
    if (!s) denyScope();
    // Ensure outputs.full is populated
    if (!s.outputs?.full && (s as any).finalPrompt) {
      return {
        ...s,
        outputs: {
          full: (s as any).finalPrompt,
          structured: (s as any).finalPrompt,
          compact: (s as any).finalPrompt,
        },
      };
    }
    return s;
  });

  const text = formatSelectedPrompts(scenes);
  return {
    text,
    sceneCount: scenes.length,
  };
}

export interface ResolveLibraryAssetInput {
  items: Array<{
    clientRef: string;
    kind: string;
    title: string;
    promptText?: string;
    tags?: string[];
    parentAssetId?: string;
  }>;
}

export interface ResolveLibraryAssetResultItem {
  clientRef: string;
  kind: string;
  title: string;
  matchStatus: 'exact_match' | 'title_match' | 'similar_match' | 'no_match';
  recommendedAction: 'reuse' | 'create';
  matchedRecord?: {
    id: string;
    title: string;
    revision: number;
    parentAssetId?: string;
    matchReason?: string;
  };
}

export function resolveLibraryAssets(
  snapshot: GranularSnapshot,
  scope: McpScope,
  args: ResolveLibraryAssetInput,
): { items: ResolveLibraryAssetResultItem[] } {
  if (!Array.isArray(args?.items)) {
    throw new McpError('INVALID_REQUEST', 'Items array is required for library resolution.');
  }

  const authorizedAssets = (snapshot.assets ?? []).filter((a) => scope.assetIds.includes(a.id));
  const authorizedVariants = (snapshot.variants ?? []).filter((v) => scope.variantIds.includes(v.id));
  const authorizedTemplates = (snapshot.templates ?? []).filter((t) => (scope.templateIds ?? []).includes(t.id));

  const items: ResolveLibraryAssetResultItem[] = args.items.map((item) => {
    // 1. Variant matching for wardrobe
    if (item.kind === 'wardrobe' && item.parentAssetId) {
      const parentVariants = authorizedVariants.filter((v) => v.parentCharacterId === item.parentAssetId);
      const itemTitleNorm = normalize(item.title);
      const itemBaseTitleNorm = normalizeBaseTitle(item.title);

      const matchedVariant = parentVariants.find(
        (v) => normalize(v.title) === itemTitleNorm || normalizeBaseTitle(v.title) === itemBaseTitleNorm,
      );

      if (matchedVariant) {
        const isExact = normalize(matchedVariant.title) === itemTitleNorm;
        return {
          clientRef: item.clientRef,
          kind: item.kind,
          title: item.title,
          matchStatus: isExact ? 'exact_match' : 'title_match',
          recommendedAction: 'reuse',
          matchedRecord: {
            id: matchedVariant.id,
            title: matchedVariant.title,
            revision: matchedVariant.revision,
            parentAssetId: matchedVariant.parentCharacterId,
            matchReason: isExact ? 'Matching variant title' : 'Matching base title',
          },
        };
      }
    }

    // 2. Candidate matching for assets & templates
    const candidate = {
      kind: item.kind as any,
      title: item.title,
      promptText: item.promptText ?? '',
      tags: item.tags ?? [],
    };

    const matches = findCandidateMatches(candidate, {
      assets: authorizedAssets,
      templates: authorizedTemplates,
    });

    if (matches.length > 0) {
      const top = matches[0];
      const normTitle = normalize(top.title);
      const itemNormTitle = normalize(item.title);
      let matchStatus: 'exact_match' | 'title_match' | 'similar_match' = 'similar_match';
      if (normTitle === itemNormTitle) {
        matchStatus = 'exact_match';
      } else if (
        top.reason?.toLowerCase().includes('base title') ||
        top.reason?.toLowerCase().includes('normalized title')
      ) {
        matchStatus = 'title_match';
      }

      return {
        clientRef: item.clientRef,
        kind: item.kind,
        title: item.title,
        matchStatus,
        recommendedAction: 'reuse',
        matchedRecord: {
          id: top.id,
          title: top.title,
          revision: top.revision,
          matchReason: top.reason,
        },
      };
    }

    // 3. No match
    return {
      clientRef: item.clientRef,
      kind: item.kind,
      title: item.title,
      matchStatus: 'no_match',
      recommendedAction: 'create',
    };
  });

  return { items };
}
