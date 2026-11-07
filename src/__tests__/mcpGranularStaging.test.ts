import { describe, expect, it } from 'vitest';
import {
  createEmptyDraftChangeSet,
  stageAssetCandidateOperation,
  stageCameraCompositionOperation,
  stageDirectToRecipeOperation,
  stageFrameImageOperation,
  stageKeyframePlanOperation,
  stageOutfitVariantOperation,
  stageProjectOperation,
  stageSceneBlockingOperation,
  stageSceneDialogueOperation,
  stageSceneEnsembleOperation,
  stageSceneRecipeOperation,
  stageShotOperation,
  stageShotOrderOperation,
  stageShotStatusOperation,
} from '../domain/mcpGranularStaging';
import { parseChangeSet } from '../domain/changeSetValidation';

describe('mcpGranularStaging', () => {
  it('builds a valid ChangeSet in canonical dependency order across granular calls', () => {
    let draft = createEmptyDraftChangeSet('cs-ep1', 'Episode 1 Draft');

    draft = stageSceneRecipeOperation(draft, {
      clientRef: 'scene-s01',
      project: { ref: 'proj-ep1' },
      shot: { ref: 'shot-s01' },
      title: 'S01 Opening',
      shotType: 'Establishing / World Concept',
      settings: { outputType: 'Video Prompts', quantity: 1, AspectRatio: '16:9', Duration: '8s' },
      slots: {
        character: { ref: 'char-hero' },
        environment: { ref: 'env-lab' },
        action: { ref: 'act-wake' },
      },
      sceneInstructions: 'Slow awakening.',
    }).changeSet;

    draft = stageShotOperation(draft, {
      clientRef: 'shot-s01',
      project: { ref: 'proj-ep1' },
      code: 'S01',
      title: 'Cold Open',
      plannedShotType: 'Establishing / World Concept',
      plannedDurationSeconds: 8,
    }).changeSet;

    draft = stageProjectOperation(draft, {
      clientRef: 'proj-ep1',
      name: 'Episode 1',
      description: 'Pilot episode',
    }).changeSet;

    draft = stageAssetCandidateOperation(draft, {
      clientRef: 'char-hero',
      kind: 'Characters',
      title: 'Silvester',
      promptText: 'A tall silver-furred tabby cat with amber eyes.',
    }).changeSet;

    draft = stageAssetCandidateOperation(draft, {
      clientRef: 'env-lab',
      kind: 'Environments',
      title: 'Bedroom',
      promptText: 'Sunlit hardwood bedroom.',
    }).changeSet;

    draft = stageAssetCandidateOperation(draft, {
      clientRef: 'act-wake',
      kind: 'Actions',
      title: 'Waking Up',
      promptText: 'Blinks slowly and stretches.',
    }).changeSet;

    draft = stageOutfitVariantOperation(draft, {
      clientRef: 'outfit-collar',
      parentCharacterId: 'asset-existing-char',
      expectedParentRevision: 2,
      title: 'Red Collar',
      promptText: 'Wears a stitched crimson leather collar.',
    }).changeSet;

    // Verify canonical dependency order: assets/variants -> project -> shot -> scene
    expect(draft.operations.map((op) => op.type)).toEqual([
      'asset.propose',
      'asset.propose',
      'asset.propose',
      'variant.propose',
      'project.create',
      'shot.create',
      'scene.create_recipe',
    ]);

    const parsed = parseChangeSet(draft);
    expect(parsed.operations).toHaveLength(7);
  });

  it('patches ensemble, dialogue, cameraComposition, blocking (v5), and keyframePlan (v6) onto a staged scene recipe', () => {
    let draft = createEmptyDraftChangeSet('cs-patch', 'Patch Test');
    draft = stageSceneRecipeOperation(draft, {
      clientRef: 'scene-s01',
      project: { id: 'proj-1', expectedRevision: 1 },
      shot: { id: 'shot-1' },
      title: 'S01',
      shotType: 'Dialogue / Duo Scene',
      settings: { aspectRatio: '16:9', durationSeconds: 8 },
      assetRefs: [{ asset: { id: 'char-1' }, expectedRevision: 1, slot: 'character' }],
    }).changeSet;

    expect(draft.schema).toBe('krakinai.change-set.v3');

    draft = stageSceneEnsembleOperation(draft, {
      sceneClientRef: 'scene-s01',
      primaryParticipantId: 'p-1',
      participants: [
        { id: 'p-1', characterAsset: { id: 'char-1' }, outfitVariant: null, label: 'Hero', order: 0 },
      ],
    }).changeSet;

    draft = stageSceneDialogueOperation(draft, {
      sceneClientRef: 'scene-s01',
      dialogueCues: [
        { id: 'cue-1', speakerParticipantId: 'p-1', lineText: 'Where am I?', order: 0, startSeconds: 1, endSeconds: 3 },
      ],
    }).changeSet;

    draft = stageCameraCompositionOperation(draft, {
      sceneClientRef: 'scene-s01',
      cameraComposition: { shotSize: 'medium_close_up', angle: 'eye_level', movement: 'slow_push_in' },
    }).changeSet;

    // Staging blocking promotes schema to v5
    draft = stageSceneBlockingOperation(draft, {
      sceneClientRef: 'scene-s01',
      blocking: {
        version: 1,
        landmarks: [{ id: 'lm-bed', label: 'Bed', zone: 'center', depth: 'midground' }],
        participants: [
          {
            participantId: 'p-1',
            start: { zone: 'center', depth: 'midground', posture: 'lying', facing: 'camera' },
            action: { verb: 'rises slowly' },
            end: { zone: 'center', depth: 'midground', posture: 'sitting', facing: 'camera' },
          },
        ],
      },
    }).changeSet;
    expect(draft.schema).toBe('krakinai.change-set.v5');

    // Staging keyframePlan promotes schema to v6
    draft = stageKeyframePlanOperation(draft, {
      sceneClientRef: 'scene-s01',
      keyframePlan: {
        version: 1,
        frames: [
          { id: 'frame-start', label: 'Start Frame', kind: 'start', order: 0, beatDescription: 'Eyes closed on bed' },
          { id: 'frame-end', label: 'End Frame', kind: 'end', order: 1, beatDescription: 'Sitting upright looking at paws' },
        ],
      },
    }).changeSet;
    expect(draft.schema).toBe('krakinai.change-set.v6');

    const parsed = parseChangeSet(draft);
    expect(parsed.schema).toBe('krakinai.change-set.v6');
  });

  it('throws NOT_FOUND when patching a sceneClientRef that does not exist in the draft', () => {
    const draft = createEmptyDraftChangeSet('cs-missing');
    expect(() =>
      stageSceneEnsembleOperation(draft, {
        sceneClientRef: 'nonexistent',
        participants: [],
      }),
    ).toThrow(/sceneClientRef/i);
  });

  it('promotes schema to v4 for direct-to-recipe conversion and supports shot order, status, and frame_image ops', () => {
    let draft = createEmptyDraftChangeSet('cs-v4');
    draft = stageDirectToRecipeOperation(draft, {
      clientRef: 'scene-conv-1',
      project: { id: 'proj-1', expectedRevision: 1 },
      shot: { id: 'shot-1' },
      sceneId: 'scene-legacy-1',
      expectedHeadId: 'scene-legacy-1',
      conversion: { sourceSceneId: 'scene-legacy-1', sourceMode: 'direct', selectConvertedTake: false, preserveDirectTake: true },
      title: 'Converted S01',
      shotType: 'Action / Motion Beat',
      settings: { aspectRatio: '16:9', durationSeconds: 6 },
    }).changeSet;
    expect(draft.schema).toBe('krakinai.change-set.v4');

    draft = stageShotOrderOperation(draft, {
      project: { id: 'proj-1', expectedRevision: 1 },
      shots: [{ id: 'shot-1' }, { id: 'shot-2' }],
    }).changeSet;

    draft = stageShotStatusOperation(draft, {
      project: { id: 'proj-1', expectedRevision: 1 },
      shot: { id: 'shot-1' },
      status: 'ready',
      expectedStatus: 'planned',
    }).changeSet;

    draft = stageFrameImageOperation(draft, {
      project: { id: 'proj-1', expectedRevision: 1 },
      shot: { id: 'shot-1' },
      scene: { ref: 'scene-conv-1' },
      frameId: 'frame-1',
      mediaId: 'media-1',
      expectedAssociationRevision: 0,
    }).changeSet;
    expect(draft.schema).toBe('krakinai.change-set.v6');

    const parsed = parseChangeSet(draft);
    expect(parsed.schema).toBe('krakinai.change-set.v6');
  });
});
