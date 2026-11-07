import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProposalInbox } from '../connections/proposalInbox';
import { ProposalBroker } from '../connections/proposalBroker';
import { createEmptyDraftChangeSet, stageProjectOperation, stageShotOperation } from '../domain/mcpGranularStaging';
import { emptyMcpScope, emptyMcpScopeV2, emptyMcpScopeV3 } from '../domain/mcpScope';
import { MCP_BLOCKING_CAPABILITIES, MCP_KEYFRAME_CAPABILITIES } from '../domain/mcpCapabilities';
import type { ChangeSetState } from '../types/changeSet';
import type { ReviewDraftRecord, ReviewInbox, ReviewInboxContents } from '../types/proposalReview';

const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');

beforeAll(() => {
  Object.defineProperty(navigator, 'locks', {
    value: {
      request: async (_name: string, _options: unknown, work: (lock: object) => unknown) => work({ mode: 'exclusive' }),
    },
    configurable: true,
  });
});

afterAll(() => {
  if (originalLocks) {
    Object.defineProperty(navigator, 'locks', originalLocks);
  } else {
    Reflect.deleteProperty(navigator, 'locks');
  }
});

class MemoryReviewInbox implements ReviewInbox {
  public records = new Map<string, ReviewDraftRecord>();
  async list(): Promise<ReviewInboxContents> {
    return { records: [...this.records.values()], invalid: [] };
  }
  async create(record: ReviewDraftRecord): Promise<ReviewDraftRecord> {
    const saved = { ...record, revision: 1 };
    this.records.set(saved.id, saved);
    return saved;
  }
  async update(record: ReviewDraftRecord, expectedRevision: number, options?: any): Promise<ReviewDraftRecord> {
    const old = this.records.get(record.id);
    if (!old) throw new Error('Not found');
    if (!options?.allowPackageUpdate && old.packageDigest !== record.packageDigest) {
      throw new Error('Saved package identity cannot be changed.');
    }
    const saved = { ...record, revision: expectedRevision + 1 };
    this.records.set(saved.id, saved);
    return saved;
  }
  async remove(id: string): Promise<void> {
    this.records.delete(id);
  }
  async exportRaw(id: string): Promise<string> {
    return JSON.stringify(this.records.get(id));
  }
  async close(): Promise<void> {}
}

const mockState: ChangeSetState = {
  collections: [
    {
      id: 'proj-1',
      name: 'Test Project',
      description: 'Pilot',
      members: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      project: {
        version: 1,
        revision: 1,
        shots: [
          {
            id: 'shot-1',
            code: 'S01',
            title: 'Shot 1',
            order: 0,
            takeSceneIds: ['scene-1'],
            selectedSceneId: 'scene-1',
            status: 'planned',
          },
        ],
      },
    },
  ],
  assets: [
    {
      id: 'char-1',
      category: 'characters',
      kind: 'asset',
      title: 'Silvester',
      promptText: 'Silver tabby cat',
      tags: ['cat'],
      revision: 1,
      isFavorite: true,
      mediaLinks: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as any,
  ],
  variants: [],
  scenes: [
    {
      id: 'scene-1',
      headId: 'scene-1',
      versionNumber: 1,
      title: 'Scene 1',
      authoringMode: 'recipe',
      shotType: 'character_scene',
      references: [],
      referencePack: { entries: [] },
      sourceMediaLinks: [],
      settings: { outputType: 'Video Prompts', quantity: 1, aspectRatio: '16:9', durationSeconds: 8 },
      slots: {
        character: {
          slot: 'character',
          sourceType: 'asset',
          sourceId: 'char-1',
          sourceRevision: 1,
          sourceTitle: 'Silvester',
          promptText: 'Silver tabby cat.',
          mediaLinks: [],
        },
      },
      outputs: {
        full: 'Full scene prompt',
        structured: 'Full scene prompt',
        compact: 'Full scene prompt',
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as any,
  ],
  templates: [],
  media: [],
  preferences: {
    importLedger: { version: 4, receipts: [], candidates: [] },
  } as any,
};

describe('ProposalInbox granular draft upsert & discard', () => {
  it('updates an unapplied draft ChangeSet in place, recomputes packageDigest, and resets prior progress decisions', async () => {
    const repo = new MemoryReviewInbox();
    const inbox = new ProposalInbox(repo, 'http://localhost:3000', () => Date.now());

    let draft = createEmptyDraftChangeSet('cs-live-1', 'Live Storyboard');
    draft = stageProjectOperation(draft, { clientRef: 'proj-1', name: 'Project 1' }).changeSet;

    const first = await inbox.upsertDraftChangeSet(draft);
    expect(first.changeSet.operations).toHaveLength(1);
    const firstDigest = first.packageDigest;

    // Simulate review progress
    await inbox.update(first.id, {
      progress: {
        viewedOperations: { op1: '0'.repeat(64) },
        draftDecisions: { assetDecisions: { a1: { action: 'create' } } as any },
      },
    });

    // Agent stages a second operation on the same changeSetId
    draft = stageShotOperation(draft, {
      clientRef: 'shot-1',
      project: { ref: 'proj-1' },
      code: 'S01',
      title: 'Opening Shot',
    }).changeSet;

    const second = await inbox.upsertDraftChangeSet(draft);
    expect(second.id).toBe(first.id);
    expect(second.changeSet.operations).toHaveLength(2);
    expect(second.packageDigest).not.toBe(firstDigest);
    expect(second.progress.draftDecisions).toBeUndefined();

    // Discard removes the draft from the inbox
    const discarded = await inbox.discard(first.id);
    expect(discarded).toEqual({ discarded: true, proposalId: first.id });
    expect(inbox.record(first.id)).toBeUndefined();
  });
});

describe('ProposalBroker end-to-end granular tools routing', () => {
  it('routes granular staging tools, updates draft proposal, lists proposals, and discards proposal', async () => {
    const repo = new MemoryReviewInbox();
    const inbox = new ProposalInbox(repo, 'http://localhost:3000', () => Date.now());
    const broker = new ProposalBroker({
      readState: async () => mockState,
      now: () => Date.now(),
      inbox,
    });

    const scope = {
      ...emptyMcpScope(),
      allowProposals: true,
      allowNewProjects: true,
      projectIds: ['proj-1'],
      assetIds: ['char-1'],
      sceneIds: ['scene-1'],
      fullPromptSceneIds: ['scene-1'],
    };

    broker.connect('test-session', scope);

    // 1. Stage project
    const p1 = await broker.handle(
      {
        requestId: 'r1',
        tool: 'krakinai_stage_project',
        args: {
          changeSetId: 'cs-broker-1',
          clientRef: 'proj-1',
          name: 'Granular Project',
        },
      },
      'test-session',
    );
    expect(p1.ok).toBe(true);
    if (!p1.ok) return;
    expect((p1.data as any).operationCount).toBe(1);

    // 2. Stage asset candidate
    const p2 = await broker.handle(
      {
        requestId: 'r2',
        tool: 'krakinai_stage_asset_candidate',
        args: {
          changeSetId: 'cs-broker-1',
          clientRef: 'char-hero',
          kind: 'character',
          title: 'Hero Cat',
          promptText: 'Silver cat with bright green eyes',
        },
      },
      'test-session',
    );
    expect(p2.ok).toBe(true);
    if (!p2.ok) return;
    expect((p2.data as any).operationCount).toBe(2);

    // 3. Stage shot
    const p3 = await broker.handle(
      {
        requestId: 'r3',
        tool: 'krakinai_stage_shot',
        args: {
          changeSetId: 'cs-broker-1',
          project: { ref: 'proj-1' },
          clientRef: 'shot-s01',
          code: 'S01',
          title: 'Cold Open',
        },
      },
      'test-session',
    );
    expect(p3.ok).toBe(true);

    // 4. Stage scene recipe
    const p4 = await broker.handle(
      {
        requestId: 'r4',
        tool: 'krakinai_stage_scene_recipe',
        args: {
          changeSetId: 'cs-broker-1',
          clientRef: 'scene-s01',
          project: { ref: 'proj-1' },
          shot: { ref: 'shot-s01' },
          title: 'Opening Recipe',
          shotType: 'character_scene',
          settings: { aspectRatio: '16:9', durationSeconds: 8 },
        },
      },
      'test-session',
    );
    expect(p4.ok).toBe(true);

    // 4b. Stage scene ensemble, dialogue, and camera composition
    const p4Ensemble = await broker.handle(
      {
        requestId: 'r4-ens',
        tool: 'krakinai_stage_scene_ensemble',
        args: {
          changeSetId: 'cs-broker-1',
          sceneClientRef: 'scene-s01',
          primaryParticipantId: 'p-hero',
          participants: [
            { id: 'p-hero', characterAsset: { ref: 'char-hero' }, label: 'Hero Cat' },
          ],
        },
      },
      'test-session',
    );
    expect(p4Ensemble.ok).toBe(true);

    const p4Dialogue = await broker.handle(
      {
        requestId: 'r4-dlg',
        tool: 'krakinai_stage_scene_dialogue',
        args: {
          changeSetId: 'cs-broker-1',
          sceneClientRef: 'scene-s01',
          dialogueCues: [
            { id: 'cue-1', speakerParticipantId: 'p-hero', lineText: 'Meow.', startSeconds: 1, endSeconds: 3 },
          ],
        },
      },
      'test-session',
    );
    expect(p4Dialogue.ok).toBe(true);

    const p4Cam = await broker.handle(
      {
        requestId: 'r4-cam',
        tool: 'krakinai_stage_camera_composition',
        args: {
          changeSetId: 'cs-broker-1',
          sceneClientRef: 'scene-s01',
          cameraComposition: { shotSize: 'medium_close_up' },
        },
      },
      'test-session',
    );
    expect(p4Cam.ok).toBe(true);

    // 5. List proposals
    const listRes = await broker.handle(
      {
        requestId: 'r5',
        tool: 'krakinai_list_proposals',
        args: {},
      },
      'test-session',
    );
    expect(listRes.ok).toBe(true);
    if (!listRes.ok) return;
    expect((listRes.data as any).items).toHaveLength(1);
    expect(typeof (listRes.data as any).items[0].blockingFindingCount).toBe('number');

    // 6. All 7 granular read tools through broker.handle
    const assetRes = await broker.handle(
      {
        requestId: 'r6',
        tool: 'krakinai_get_asset',
        args: { id: 'char-1' },
      },
      'test-session',
    );
    expect(assetRes.ok).toBe(true);

    const catalogRes = await broker.handle(
      {
        requestId: 'r7',
        tool: 'krakinai_list_catalog_presets',
        args: { catalog: 'cinematography' },
      },
      'test-session',
    );
    expect(catalogRes.ok).toBe(true);

    const scenesRes = await broker.handle(
      {
        requestId: 'r8',
        tool: 'krakinai_list_saved_scenes',
        args: { archiveFilter: 'active' },
      },
      'test-session',
    );
    expect(scenesRes.ok).toBe(true);

    const contRes = await broker.handle(
      {
        requestId: 'r8-cont',
        tool: 'krakinai_get_project_continuity',
        args: { projectId: 'proj-1' },
      },
      'test-session',
    );
    expect(contRes.ok).toBe(true);

    const spatialRes = await broker.handle(
      {
        requestId: 'r8-spat',
        tool: 'krakinai_check_spatial_continuity',
        args: { projectId: 'proj-1', changeSetId: 'cs-broker-1' },
      },
      'test-session',
    );
    expect(spatialRes.ok).toBe(true);

    const assemblyExistingRes = await broker.handle(
      {
        requestId: 'r8-asm-1',
        tool: 'krakinai_preview_scene_assembly',
        args: { sceneId: 'scene-1' },
      },
      'test-session',
    );
    expect(assemblyExistingRes.ok).toBe(true);

    const assemblyStagedRes = await broker.handle(
      {
        requestId: 'r8-asm-2',
        tool: 'krakinai_preview_scene_assembly',
        args: { changeSetId: 'cs-broker-1', sceneClientRef: 'scene-s01' },
      },
      'test-session',
    );
    expect(assemblyStagedRes.ok).toBe(true);

    const exportRes = await broker.handle(
      {
        requestId: 'r8-exp',
        tool: 'krakinai_export_scene_prompts',
        args: { sceneIds: ['scene-1'] },
      },
      'test-session',
    );
    expect(exportRes.ok).toBe(true);

    // 7. Discard proposal
    const discardRes = await broker.handle(
      {
        requestId: 'r9',
        tool: 'krakinai_discard_proposal',
        args: { proposalId: (p1.data as any).proposalId },
      },
      'test-session',
    );
    expect(discardRes.ok).toBe(true);

    const listAfter = await broker.handle(
      {
        requestId: 'r10',
        tool: 'krakinai_list_proposals',
        args: {},
      },
      'test-session',
    );
    expect(listAfter.ok).toBe(true);
    if (!listAfter.ok) return;
    expect((listAfter.data as any).items).toHaveLength(0);
  });

  it('rejects krakinai_stage_* and krakinai_discard_proposal with CONFLICT when proposal disposition is applied', async () => {
    const repo = new MemoryReviewInbox();
    const inbox = new ProposalInbox(repo, 'http://localhost:3000', () => Date.now());
    const broker = new ProposalBroker({
      readState: async () => mockState,
      now: () => Date.now(),
      inbox,
    });

    const scope = {
      ...emptyMcpScope(),
      allowProposals: true,
      allowNewProjects: true,
      projectIds: ['proj-1'],
    };
    broker.connect('session-applied', scope);

    const staged = await broker.handle(
      {
        requestId: 'ap-1',
        tool: 'krakinai_stage_project',
        args: {
          changeSetId: 'cs-applied-1',
          clientRef: 'proj-ap',
          name: 'Applied Project',
        },
      },
      'session-applied',
    );
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    const proposalId = (staged.data as any).proposalId;

    // Mark record as applied in inbox
    await inbox.update(proposalId, { disposition: 'applied' }, { finishApply: true });

    const stageAfterApplied = await broker.handle(
      {
        requestId: 'ap-2',
        tool: 'krakinai_stage_project',
        args: {
          changeSetId: 'cs-applied-1',
          clientRef: 'proj-ap',
          name: 'Mutated After Applied',
        },
      },
      'session-applied',
    );
    expect(stageAfterApplied.ok).toBe(false);
    if (!stageAfterApplied.ok) {
      expect(stageAfterApplied.error.code).toBe('CONFLICT');
    }

    const discardAfterApplied = await broker.handle(
      {
        requestId: 'ap-3',
        tool: 'krakinai_discard_proposal',
        args: { proposalId },
      },
      'session-applied',
    );
    expect(discardAfterApplied.ok).toBe(false);
    if (!discardAfterApplied.ok) {
      expect(discardAfterApplied.error.code).toBe('CONFLICT');
    }
  });

  it('enforces v5 blocking and v6 keyframe capability gates on granular staging tools', async () => {
    const repo = new MemoryReviewInbox();
    const inbox = new ProposalInbox(repo, 'http://localhost:3000', () => Date.now());
    const broker = new ProposalBroker({
      readState: async () => mockState,
      now: () => Date.now(),
      inbox,
    });

    // Connect with v1 scope (no blocking or keyframe grants)
    const scopeV1 = {
      ...emptyMcpScope(),
      allowProposals: true,
      projectIds: ['proj-1'],
      sceneIds: ['scene-1'],
    };
    broker.connect('session-v1', scopeV1);

    // Initial stage recipe
    await broker.handle(
      {
        requestId: 'g1',
        tool: 'krakinai_stage_scene_recipe',
        args: {
          changeSetId: 'cs-gating',
          clientRef: 'scene-g1',
          project: { id: 'proj-1', expectedRevision: 1 },
          shot: { id: 'shot-1' },
          title: 'Scene',
          shotType: 'character_scene',
        },
      },
      'session-v1',
    );

    // Attempt staging blocking on v1 session -> PERMISSION_DENIED / CAPABILITY_REQUIRED
    const blockFail = await broker.handle(
      {
        requestId: 'g2',
        tool: 'krakinai_stage_scene_blocking',
        args: {
          changeSetId: 'cs-gating',
          sceneClientRef: 'scene-g1',
          blocking: { version: 1, expectedBaseDigest: '0'.repeat(64), landmarks: [] },
        },
      },
      'session-v1',
    );
    expect(blockFail.ok).toBe(false);

    // Disconnect and connect with v2 scope + blocking capabilities
    broker.disconnect();
    const scopeV2 = {
      ...emptyMcpScopeV2(),
      allowProposals: true,
      allowBlockingProposals: true,
      projectIds: ['proj-1'],
      sceneIds: ['scene-1'],
      blockingSceneIds: ['scene-1'],
    };
    broker.connect('session-v2', scopeV2, Date.now() + 60000, MCP_BLOCKING_CAPABILITIES);

    const blockOk = await broker.handle(
      {
        requestId: 'g3',
        tool: 'krakinai_stage_scene_blocking',
        args: {
          changeSetId: 'cs-gating',
          sceneClientRef: 'scene-g1',
          blocking: { version: 1, expectedBaseDigest: '0'.repeat(64), landmarks: [] },
        },
      },
      'session-v2',
    );
    expect(blockOk.ok).toBe(true);

    // Attempt staging keyframe plan on v2 session -> fails
    const kfFail = await broker.handle(
      {
        requestId: 'g4',
        tool: 'krakinai_stage_keyframe_plan',
        args: {
          changeSetId: 'cs-gating',
          sceneClientRef: 'scene-g1',
          keyframePlan: { version: 1, expectedBaseDigest: '0'.repeat(64), frames: [] },
        },
      },
      'session-v2',
    );
    expect(kfFail.ok).toBe(false);

    // Disconnect and connect with v3 scope + keyframe capabilities
    broker.disconnect();
    const scopeV3 = {
      ...emptyMcpScopeV3(),
      allowProposals: true,
      allowBlockingProposals: true,
      allowKeyframeProposals: true,
      projectIds: ['proj-1'],
      sceneIds: ['scene-1'],
      blockingSceneIds: ['scene-1'],
      keyframeSceneIds: ['scene-1'],
    };
    broker.connect('session-v3', scopeV3, Date.now() + 60000, MCP_KEYFRAME_CAPABILITIES);

    const kfOk = await broker.handle(
      {
        requestId: 'g5',
        tool: 'krakinai_stage_keyframe_plan',
        args: {
          changeSetId: 'cs-gating',
          sceneClientRef: 'scene-g1',
          keyframePlan: { version: 1, expectedBaseDigest: '0'.repeat(64), frames: [] },
        },
      },
      'session-v3',
    );
    expect(kfOk.ok).toBe(true);
  });
});
