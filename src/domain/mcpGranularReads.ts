import type {
  ChangeSet,
  ChangeSetState,
} from '../types/changeSet';
import type { Collection, MediaAsset, PromptAsset, SavedScene, Template, Variant } from '../types/domain';
import type { McpScope } from '../types/mcp';
import { McpError } from './mcpProtocol';
import { authorizedSceneIds, denyScope } from './mcpScope';
import { buildContinuityWorkspace } from './continuityWorkspace';
import { buildBlockingFinalReview } from './blockingReview';
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

export function readSpatialContinuity(
  snapshot: GranularSnapshot,
  scope: McpScope,
  args: { projectId: string },
  _stagedChangeSet?: ChangeSet,
): Record<string, unknown> {
  if (!scope.projectIds.includes(args.projectId)) {
    denyScope();
  }

  const collections = getCollections(snapshot);
  const collection = collections.find((c) => c.id === args.projectId);
  if (!collection) {
    denyScope();
  }

  const review = buildBlockingFinalReview([collection], snapshot.scenes, []);
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
  _stagedChangeSet?: ChangeSet,
): Record<string, unknown> {
  if (!args.sceneId) {
    throw new McpError('INVALID_REQUEST', 'sceneId is required for assembly preview.');
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
