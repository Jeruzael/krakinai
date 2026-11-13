import type { Collection, PromptAsset, SavedScene, SceneDraft } from '../types/domain';
import { assembleScenePrompt, createSnapshotFromAsset } from './promptAssembler';
import { isDirectPrompt } from './directPrompt';
import { getProjectShots, selectedSceneForShot } from './projectStoryboard';

export type ProjectStyleSkipReason = 'missing_preferred' | 'direct_prompt' | 'requires_review';

export interface ProjectStyleShotRef {
  shotId: string;
  shotCode?: string;
  shotTitle?: string;
}

export interface ProjectStyleChangeCandidate extends ProjectStyleShotRef {
  source: SavedScene;
}

export interface ProjectStyleSkippedShot extends ProjectStyleShotRef {
  reason: ProjectStyleSkipReason;
}

export interface ProjectStyleBatchClassification {
  changed: ProjectStyleChangeCandidate[];
  unchanged: ProjectStyleShotRef[];
  skipped: ProjectStyleSkippedShot[];
}

function validateStyleAsset(styleAsset: PromptAsset): void {
  if (!styleAsset || styleAsset.category !== 'styles' || !styleAsset.id?.trim()) {
    throw new Error('Select a valid Style library asset.');
  }
  if (!styleAsset.promptText?.trim()) {
    throw new Error('The selected Style asset has no prompt text.');
  }
}

function requiresSeparateReview(scene: SavedScene): boolean {
  return Boolean(
    scene.blocking !== undefined ||
    scene.ensemble !== undefined ||
    scene.keyframePlan !== undefined ||
    scene.imagePromptSnapshots !== undefined ||
    scene.manualImageOutputs !== undefined ||
    Object.keys(scene.manualOutputs ?? {}).length > 0,
  );
}

export function classifyProjectStyleBatch(
  collection: Collection,
  scenes: SavedScene[],
  shotIds: string[],
  styleAsset: PromptAsset,
): ProjectStyleBatchClassification {
  validateStyleAsset(styleAsset);
  if (!Array.isArray(shotIds) || shotIds.some(id => typeof id !== 'string' || !id.trim())) {
    throw new Error('Select valid project shots.');
  }

  const uniqueIds = [...new Set(shotIds)];
  const shotMap = new Map(getProjectShots(collection, scenes).map(shot => [shot.id, shot]));
  const result: ProjectStyleBatchClassification = { changed: [], unchanged: [], skipped: [] };
  const sceneMap = new Map(scenes.map(scene => [scene.id, scene]));

  for (const shotId of uniqueIds) {
    const shot = shotMap.get(shotId);
    if (!shot) {
      result.skipped.push({ shotId, reason: 'missing_preferred' });
      continue;
    }

    const ref: ProjectStyleShotRef = {
      shotId: shot.id,
      shotCode: shot.code,
      shotTitle: shot.title,
    };
    const source = selectedSceneForShot(shot, scenes);
    if (!source || !sceneMap.has(source.id)) {
      result.skipped.push({ ...ref, reason: 'missing_preferred' });
      continue;
    }
    if (isDirectPrompt(source)) {
      result.skipped.push({ ...ref, reason: 'direct_prompt' });
      continue;
    }
    if (requiresSeparateReview(source)) {
      result.skipped.push({ ...ref, reason: 'requires_review' });
      continue;
    }

    const currentStyle = source.slots.style;
    if (
      currentStyle?.sourceType === 'asset' &&
      currentStyle.sourceId === styleAsset.id &&
      currentStyle.sourceRevision === styleAsset.revision
    ) {
      result.unchanged.push(ref);
      continue;
    }

    result.changed.push({ ...ref, source });
  }

  return result;
}

export function buildProjectStyleTake(
  source: SavedScene,
  styleAsset: PromptAsset,
  options: { id: string; now: string; inheritedAvoidPrefix: string },
): SavedScene {
  validateStyleAsset(styleAsset);
  if (!options.id?.trim() || !Number.isFinite(Date.parse(options.now))) {
    throw new Error('A valid new scene ID and timestamp are required.');
  }
  if (isDirectPrompt(source)) {
    throw new Error('Direct Prompt scenes require a separate guided conversion.');
  }
  if (requiresSeparateReview(source)) {
    throw new Error('This Recipe needs its own review flow before changing Style.');
  }

  const sourceRecipe = structuredClone(source) as Exclude<SavedScene, { authoringMode: 'direct_prompt' }>;
  const slots = {
    ...structuredClone(sourceRecipe.slots),
    style: createSnapshotFromAsset(styleAsset),
  };
  const draft: SceneDraft = {
    ...sourceRecipe,
    id: options.id,
    title: sourceRecipe.title,
    slots,
    sourceSceneId: sourceRecipe.id,
    inheritedAvoidPrefix: options.inheritedAvoidPrefix,
    inputRevision: 1,
    updatedAt: options.now,
    manualOutputs: {},
    resultMediaLinks: [],
    reviewNotes: '',
    reviewStatus: 'unreviewed',
  };
  const assembled = assembleScenePrompt(draft);
  if (!assembled.valid) throw new Error(assembled.errors.join(' '));

  const {
    id: _sourceId,
    sceneRevision: _sceneRevision,
    authoredSaveFingerprint: _authoredSaveFingerprint,
    saveProjectTarget: _saveProjectTarget,
    sourceDraftId: _sourceDraftId,
    sourceDraftInputRevision: _sourceDraftInputRevision,
    saveRequestId: _saveRequestId,
    saveDecision: _saveDecision,
    versionOfSceneId: _versionOfSceneId,
    separateTakeOfSceneId: _separateTakeOfSceneId,
    archivedAt: _archivedAt,
    ...base
  } = sourceRecipe;

  return {
    ...base,
    id: options.id,
    title: sourceRecipe.title,
    slots,
    outputs: assembled.outputs,
    avoidText: assembled.avoidText,
    references: assembled.references.map(link => ({ ...link })),
    manualOutputs: {},
    resultMediaLinks: [],
    reviewNotes: '',
    reviewStatus: 'unreviewed',
    sourceSceneId: sourceRecipe.id,
    separateTakeOfSceneId: sourceRecipe.id,
    revision: 1,
    createdAt: options.now,
    updatedAt: options.now,
  } as SavedScene;
}
