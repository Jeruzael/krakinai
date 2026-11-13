import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { Story, StoryAct } from '../types/domain';
import type { ChangeSet, ChangeSetApproval } from '../types/changeSet';
import { emptyChangeSetApproval } from '../types/changeSet';
import { parseChangeSet } from '../domain/changeSetValidation';
import { planChangeSet } from '../domain/changeSetPlanner';
import { computeStoryDigest } from '../domain/storyValidator';
import { saveStory, getStory, clearStoriesStoreForTesting } from '../storage/stories';
import { getAllSnapshot, clearAllStoresForTesting, initializeDatabase } from '../storage/db';
import { previewChangeSet, applyApprovedChangeSet } from '../storage/changeSets';
import { emptyMcpScope, validateMcpScope, assertProposalScope } from '../domain/mcpScope';
import { permissionFingerprint } from '../domain/mcpPermissionDraft';

const sampleAct: StoryAct = {
  id: 'act-test-1',
  orderIndex: 0,
  title: 'Act 1: Beginning',
  sequences: [
    {
      id: 'seq-test-1',
      orderIndex: 0,
      title: 'Sequence 1: Departure',
      scenes: [
        {
          id: 'scene-test-1',
          orderIndex: 0,
          title: 'Scene 1: Leaving the Harbor',
          beats: [
            {
              id: 'beat-test-1',
              orderIndex: 0,
              title: 'Beat 1: Untying the ropes',
              content: 'The ship unties from the dock.',
            },
          ],
        },
      ],
    },
  ],
};

const sampleStory: Story = {
  id: 'story-existing-1',
  title: 'Chronicles of the Deep',
  author: 'Director AI',
  createdAt: '2026-11-11T00:00:00.000Z',
  updatedAt: '2026-11-11T00:00:00.000Z',
  archivedAt: null,
  favorite: false,
  revisionNumber: 1,
  tags: ['adventure', 'nautical'],
  logline: 'A vessel sets sail into uncharted mist.',
  premise: 'Beyond the horizon lies the ancient beacon.',
  synopsis: 'Three adventurers depart from port.',
  treatment: 'Full episodic breakdown.',
  fullBookText: 'Chapter 1: The Sea Wind blew hard.',
  referencePack: { assetIds: [], variantIds: [], mediaIds: [] },
  linkedCollectionId: null,
  colorScript: [],
  acts: [sampleAct],
};

describe('Change-Set v7 Story Validation & Planning', () => {
  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    await clearAllStoresForTesting();
    await initializeDatabase();
    await clearStoriesStoreForTesting();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses valid krakinai.change-set.v7 with story operations', () => {
    const changeSet: ChangeSet = {
      schema: 'krakinai.change-set.v7' as any,
      changeSetId: 'cs-story-v7-1',
      source: { kind: 'codex', label: 'Story Director' },
      title: 'New Story Draft',
      operations: [
        {
          operationId: 'op-story-create',
          type: 'story.create' as any,
          clientRef: 'story-draft-1',
          title: 'The Sunken Star',
          logline: 'An astronomer dives into the abyss.',
          premise: 'A fallen star rests under the trenches.',
        },
        {
          operationId: 'op-story-struct',
          type: 'story.patch_structure' as any,
          storyRef: { ref: 'story-draft-1' },
          acts: [sampleAct],
        },
      ],
    };

    const parsed = parseChangeSet(changeSet);
    expect(parsed.schema).toBe('krakinai.change-set.v7');
    expect(parsed.operations).toHaveLength(2);
  });

  it('plans story creation, clientRef resolution, and canonical ordering', async () => {
    const state = await getAllSnapshot();
    const changeSet: ChangeSet = {
      schema: 'krakinai.change-set.v7' as any,
      changeSetId: 'cs-story-v7-2',
      source: { kind: 'codex' },
      operations: [
        {
          operationId: 'op-create',
          type: 'story.create' as any,
          clientRef: 'story-ref-1',
          title: 'Echoes of Valhalla',
          author: 'Writer Agent',
          logline: 'A warrior seeks peace.',
        },
        {
          operationId: 'op-patch',
          type: 'story.patch_structure' as any,
          storyRef: { ref: 'story-ref-1' },
          acts: [sampleAct],
        },
      ],
    };

    const approval: ChangeSetApproval = {
      ...emptyChangeSetApproval(),
      stories: true,
    } as any;

    const allocation = {
      preparedAt: new Date().toISOString(),
      ids: {
        'op-create': 'story_generated_123',
        'op-patch': 'patch_generated_123',
      },
    };

    const plan = planChangeSet(changeSet, approval, state, allocation);
    expect(plan.findings.filter((f) => f.severity === 'blocking')).toHaveLength(0);
    expect(plan.stories).toBeDefined();
    expect(plan.stories).toHaveLength(1);
    expect(plan.stories![0].title).toBe('Echoes of Valhalla');
    expect(plan.stories![0].acts).toHaveLength(1);
  });

  it('rejects stale digest and revision with CONFLICT findings', async () => {
    await saveStory(sampleStory);
    const state = await getAllSnapshot();

    const staleDigest = '0000000000000000000000000000000000000000000000000000000000000000';
    const changeSet: ChangeSet = {
      schema: 'krakinai.change-set.v7' as any,
      changeSetId: 'cs-story-conflict',
      source: { kind: 'codex' },
      operations: [
        {
          operationId: 'op-update-conflict',
          type: 'story.update' as any,
          storyId: sampleStory.id,
          expectedRevision: 99, // mismatch
          expectedStoryDigest: staleDigest, // mismatch
          title: 'Modified Title',
        },
      ],
    };

    const approval: ChangeSetApproval = {
      ...emptyChangeSetApproval(),
      stories: true,
    } as any;

    const plan = planChangeSet(changeSet, approval, state, {
      preparedAt: new Date().toISOString(),
      ids: { 'op-update-conflict': 'update_1' },
    });

    const conflicts = plan.findings.filter((f) => f.code === 'CONFLICT');
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });

  it('applies approved story operations into storage atomically', async () => {
    await saveStory(sampleStory);
    const changeSet: ChangeSet = {
      schema: 'krakinai.change-set.v7' as any,
      changeSetId: 'cs-apply-story-1',
      source: { kind: 'codex' },
      operations: [
        {
          operationId: 'op-status',
          type: 'story.set_status' as any,
          storyId: sampleStory.id,
          expectedRevision: 1,
          favorite: true,
          archived: false,
        },
      ],
    };

    const approval: ChangeSetApproval = {
      ...emptyChangeSetApproval(),
      stories: true,
    } as any;

    const preview = await previewChangeSet(changeSet, approval);
    expect(preview.plan.findings.filter((f) => f.severity === 'blocking')).toHaveLength(0);

    const receipt = await applyApprovedChangeSet(preview, preview.approvedDigest);
    expect(receipt.changeSetId).toBe('cs-apply-story-1');

    const updated = await getStory(sampleStory.id);
    expect(updated?.favorite).toBe(true);
    expect(updated?.revisionNumber).toBe(2);
  });

  it('applies story.create atomically with fullBookText, Creator Mode acts, and directorBriefing without transaction premature closure', async () => {
    const changeSet: ChangeSet = {
      schema: 'krakinai.change-set.v7',
      changeSetId: 'cs-apply-story-create-atomic',
      source: { kind: 'codex', label: 'Story Create Atomic Test' },
      operations: [
        {
          operationId: 'op-create-story-atomic',
          type: 'story.create',
          clientRef: 'story-atomic-ref',
          title: 'Atomic Story',
          author: 'Director',
          fullBookText: '# Chapter 1\n\nBook mode continuous prose.',
          acts: [
            {
              id: 'act-1',
              orderIndex: 0,
              title: 'Act I',
              sequences: [],
            },
          ],
          directorBriefing: {
            pacingAuditSummary: 'Verified pacing',
            continuityLocks: [],
            lightingProgression: [],
            actionArchetypes: [],
            vocalRegister: [],
          },
        },
      ],
    };

    const approval: ChangeSetApproval = {
      ...emptyChangeSetApproval(),
      stories: true,
    } as any;

    const preview = await previewChangeSet(changeSet, approval);
    expect(preview.plan.findings.filter((f) => f.severity === 'blocking')).toHaveLength(0);

    const receipt = await applyApprovedChangeSet(preview, preview.approvedDigest);
    expect(receipt.changeSetId).toBe('cs-apply-story-create-atomic');

    const createdStoryId = receipt.idMappings['story-atomic-ref']?.id || preview.allocation.ids['op-create-story-atomic'];
    expect(createdStoryId).toBeDefined();

    const created = await getStory(createdStoryId);
    expect(created).toBeDefined();
    expect(created?.title).toBe('Atomic Story');
    expect(created?.fullBookText).toBe('# Chapter 1\n\nBook mode continuous prose.');
    expect(created?.acts).toHaveLength(1);
    expect(created?.acts[0].title).toBe('Act I');
    expect(created?.directorBriefing?.pacingAuditSummary).toBe('Verified pacing');
  });
});

describe('McpScope Story Governance', () => {
  it('validates storyIds, includeStoryText, and allowStoryProposals in McpScope', () => {
    const scope = {
      ...emptyMcpScope(),
      storyIds: ['story-1', 'story-2'],
      includeStoryText: true,
      allowStoryProposals: true,
    };

    const validated = validateMcpScope(scope as any);
    expect((validated as any).storyIds).toEqual(['story-1', 'story-2']);
    expect((validated as any).includeStoryText).toBe(true);
    expect((validated as any).allowStoryProposals).toBe(true);
  });

  it('preserves legacy permissionFingerprint output when story grants are empty', () => {
    const legacyScope = emptyMcpScope();
    const withEmptyStories = {
      ...legacyScope,
      storyIds: [],
      includeStoryText: false,
      allowStoryProposals: false,
    };

    expect(permissionFingerprint(withEmptyStories as any)).toBe(
      permissionFingerprint(legacyScope)
    );
  });

  it('enforces allowStoryProposals and storyIds during assertProposalScope', async () => {
    const state = await getAllSnapshot();
    const changeSet: ChangeSet = {
      schema: 'krakinai.change-set.v7' as any,
      changeSetId: 'cs-scope-test',
      source: { kind: 'codex' },
      operations: [
        {
          operationId: 'op-1',
          type: 'story.update' as any,
          storyId: 'story-forbidden',
          title: 'Hack',
        },
      ],
    };

    const noProposalScope = {
      ...emptyMcpScope(),
      allowStoryProposals: false,
    };

    expect(() =>
      assertProposalScope(changeSet, noProposalScope as any, state)
    ).toThrow(/outside the permissions/i);

    const wrongStoryScope = {
      ...emptyMcpScope(),
      allowProposals: true,
      allowStoryProposals: true,
      storyIds: ['story-allowed-only'],
    };

    expect(() =>
      assertProposalScope(changeSet, wrongStoryScope as any, state)
    ).toThrow(/outside the permissions/i);
  });
});
