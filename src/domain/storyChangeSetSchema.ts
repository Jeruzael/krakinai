import type { JsonRule } from './changeSetSchema';
import { BLOCKING_DIGEST_RULE as digest } from './blockingChangeSetSchema';

const obj = (
  properties: Record<string, JsonRule>,
  required: string[] = []
): JsonRule => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const arr = (items: JsonRule, maxItems: number, minItems = 0): JsonRule => ({
  type: 'array',
  items,
  maxItems,
  minItems,
});

const text = (maxLength: number, minLength = 0): JsonRule => ({
  type: 'string',
  minLength,
  maxLength,
});

const nullable = (rule: JsonRule): JsonRule => ({
  oneOf: [rule, { type: 'null' }],
});

const localId: JsonRule = {
  type: 'string',
  minLength: 1,
  maxLength: 100,
  pattern: '^(?!(?:constructor|prototype|__proto__)$)[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$',
};

const revision: JsonRule = {
  type: 'integer',
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
};

const dramaticMetaRule: JsonRule = obj({
  setupForeshadowing: arr(text(2000), 100),
  incitingIncident: text(2000),
  subtext: text(4000),
  climax: text(2000),
  payoff: arr(text(2000), 100),
  characterArcs: arr(
    obj(
      {
        characterAssetId: localId,
        arcState: text(500),
        internalShift: text(1000),
      },
      ['characterAssetId', 'arcState']
    ),
    50
  ),
});

const beatRule: JsonRule = obj(
  {
    id: localId,
    orderIndex: { type: 'integer', minimum: 0 },
    title: text(200, 1),
    content: text(50000),
    dramaticMeta: dramaticMetaRule,
    linkedShotId: localId,
    linkedSceneId: localId,
  },
  ['id', 'orderIndex', 'title']
);

const sceneNodeRule: JsonRule = obj(
  {
    id: localId,
    orderIndex: { type: 'integer', minimum: 0 },
    title: text(200, 1),
    summary: text(5000),
    environmentAssetId: localId,
    dramaticMeta: dramaticMetaRule,
    linkedShotIds: arr(localId, 50),
    beats: arr(beatRule, 100),
  },
  ['id', 'orderIndex', 'title', 'beats']
);

const sequenceRule: JsonRule = obj(
  {
    id: localId,
    orderIndex: { type: 'integer', minimum: 0 },
    title: text(200, 1),
    summary: text(5000),
    dramaticMeta: dramaticMetaRule,
    scenes: arr(sceneNodeRule, 100),
  },
  ['id', 'orderIndex', 'title', 'scenes']
);

const actRule: JsonRule = obj(
  {
    id: localId,
    orderIndex: { type: 'integer', minimum: 0 },
    title: text(200, 1),
    summary: text(5000),
    dramaticMeta: dramaticMetaRule,
    sequences: arr(sequenceRule, 50),
  },
  ['id', 'orderIndex', 'title', 'sequences']
);

const colorScriptEntryRule: JsonRule = obj(
  {
    id: localId,
    orderIndex: { type: 'integer', minimum: 0 },
    label: text(200, 1),
    targetNodeId: localId,
    hexPalette: arr(text(9), 16),
    mediaId: localId,
    lightingAssetId: localId,
    styleAssetId: localId,
    notes: text(2000),
  },
  ['id', 'orderIndex', 'label', 'hexPalette']
);

const referencePackRule: JsonRule = obj({
  assetIds: arr(localId, 500),
  variantIds: arr(localId, 500),
  mediaIds: arr(localId, 2000),
});

const continuityLockRule: JsonRule = obj(
  {
    id: localId,
    assetType: { type: 'string', enum: ['character', 'wardrobe', 'environment', 'style', 'camera'] },
    candidateRefOrId: text(200, 1),
    description: text(2000, 1),
  },
  ['id', 'assetType', 'candidateRefOrId', 'description']
);

const lightingProgressionRule: JsonRule = obj(
  {
    id: localId,
    beatRange: text(100, 1),
    candidateRefOrId: text(200, 1),
    setupAndMood: text(4000, 1),
  },
  ['id', 'beatRange', 'candidateRefOrId', 'setupAndMood']
);

const actionArchetypeRule: JsonRule = obj(
  {
    id: localId,
    beatRange: text(100, 1),
    candidateRefOrId: text(200, 1),
    kinematicsAndIntensity: text(4000, 1),
  },
  ['id', 'beatRange', 'candidateRefOrId', 'kinematicsAndIntensity']
);

const vocalPerformanceRule: JsonRule = obj(
  {
    id: localId,
    character: text(100, 1),
    beatId: text(100, 1),
    emotion: text(200, 1),
    deliveryTechnique: text(200),
    voiceCharacteristics: text(500),
    speechIntonation: text(500),
    bodyLanguage: text(1000),
  },
  ['id', 'character', 'beatId', 'emotion']
);

const directorBriefingRule: JsonRule = obj({
  pacingAuditSummary: text(20000),
  continuityLocks: arr(continuityLockRule, 100),
  lightingProgression: arr(lightingProgressionRule, 100),
  actionArchetypes: arr(actionArchetypeRule, 100),
  vocalRegister: arr(vocalPerformanceRule, 200),
});

export function createStoryChangeSetSchema(
  v6: JsonRule,
  nativeId: JsonRule
): JsonRule {
  const schema = structuredClone(v6);
  const ops = schema.properties!.operations.items!.oneOf!;

  schema.$id = 'https://krakinai.local/schemas/change-set-v7.json';
  schema.title = 'KRAKINAI Change Set v7';
  schema.properties!.schema = { const: 'krakinai.change-set.v7' };

  const storyTarget = {
    oneOf: [
      obj({ id: nativeId }, ['id']),
      obj({ ref: nativeId }, ['ref']),
    ],
  };

  // 1. story.create
  ops.push(
    obj(
      {
        operationId: nativeId,
        type: { const: 'story.create' },
        clientRef: nativeId,
        title: text(200, 1),
        author: text(100),
        tags: arr(text(50), 50),
        coverMediaId: nullable(nativeId),
        heroBannerMediaId: nullable(nativeId),
        logline: text(2000),
        premise: text(5000),
        synopsis: text(50000),
        treatment: text(200000),
        fullBookText: text(1000000),
        linkedCollectionId: nullable(nativeId),
        referencePack: referencePackRule,
        colorScript: arr(colorScriptEntryRule, 100),
        acts: arr(actRule, 50),
        directorBriefing: directorBriefingRule,
      },
      ['operationId', 'type', 'title']
    )
  );

  // 2. story.update
  ops.push(
    obj(
      {
        operationId: nativeId,
        type: { const: 'story.update' },
        storyId: nativeId,
        storyRef: storyTarget,
        expectedRevision: revision,
        expectedStoryDigest: digest,
        title: text(200, 1),
        author: text(100),
        tags: arr(text(50), 50),
        coverMediaId: nullable(nativeId),
        heroBannerMediaId: nullable(nativeId),
        logline: text(2000),
        premise: text(5000),
        synopsis: text(50000),
        treatment: text(200000),
        fullBookText: text(1000000),
        directorBriefing: directorBriefingRule,
      },
      ['operationId', 'type']
    )
  );

  // 3. story.set_status
  ops.push(
    obj(
      {
        operationId: nativeId,
        type: { const: 'story.set_status' },
        storyId: nativeId,
        storyRef: storyTarget,
        clientRef: nativeId,
        expectedRevision: revision,
        expectedStoryDigest: digest,
        status: { type: 'string', enum: ['active', 'archived'] },
        archived: { type: 'boolean' },
        favorite: { type: 'boolean' },
      },
      ['operationId', 'type']
    )
  );

  // 4. story.patch_structure
  ops.push(
    obj(
      {
        operationId: nativeId,
        type: { const: 'story.patch_structure' },
        storyId: nativeId,
        storyRef: storyTarget,
        clientRef: nativeId,
        expectedRevision: revision,
        expectedStoryDigest: digest,
        acts: arr(actRule, 50),
      },
      ['operationId', 'type', 'acts']
    )
  );

  // 5. story.patch_dramatic_meta
  ops.push(
    obj(
      {
        operationId: nativeId,
        type: { const: 'story.patch_dramatic_meta' },
        storyId: nativeId,
        storyRef: storyTarget,
        clientRef: nativeId,
        targetNodeId: nativeId,
        targetNode: obj(
          {
            kind: { type: 'string', enum: ['act', 'sequence', 'scene', 'beat'] },
            id: nativeId,
          },
          ['kind', 'id']
        ),
        expectedRevision: revision,
        expectedStoryDigest: digest,
        dramaticMeta: dramaticMetaRule,
      },
      ['operationId', 'type', 'dramaticMeta']
    )
  );

  // 6. story.patch_references
  ops.push(
    obj(
      {
        operationId: nativeId,
        type: { const: 'story.patch_references' },
        storyId: nativeId,
        storyRef: storyTarget,
        clientRef: nativeId,
        expectedRevision: revision,
        expectedStoryDigest: digest,
        referencePack: referencePackRule,
        linkedCollectionId: nullable(nativeId),
        colorScript: arr(colorScriptEntryRule, 100),
      },
      ['operationId', 'type']
    )
  );

  return schema;
}
