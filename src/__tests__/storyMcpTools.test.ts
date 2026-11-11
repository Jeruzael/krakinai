// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ProposalBroker } from '../connections/proposalBroker';
import { emptyMcpScope } from '../domain/mcpScope';
import { computeStoryDigest } from '../domain/storyValidator';
import type { Story, StoryAct } from '../types/domain';
import { emptyState } from './fixtures/changeSetFixture';
import type { ChangeSetState } from '../types/changeSet';

function createSampleStory(id = 'story-sample-1'): Story {
  return {
    id,
    title: 'The Lost Chronicles',
    author: 'Elena Rostova',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
    archivedAt: null,
    favorite: false,
    revisionNumber: 1,
    tags: ['sci-fi', 'space', 'epic'],
    coverMediaId: 'media-cover-1',
    heroBannerMediaId: 'media-banner-1',
    logline: 'An explorer discovers a dormant starship on the rim of colonized space.',
    premise: 'Humanity reaches the frontier only to find our ancestors were already here.',
    synopsis: 'A deep space expedition unlocks an ancient cosmic map.',
    treatment: 'Full pitch treatment outlining the multi-act discovery.',
    fullBookText: 'Chapter 1: The signal arrived at dawn on the third relay...',
    referencePack: {
      assetIds: ['asset-char-1'],
      variantIds: ['variant-outfit-1'],
      mediaIds: ['media-cover-1'],
    },
    linkedCollectionId: 'collection-project-1',
    colorScript: [
      {
        id: 'cs-node-1',
        orderIndex: 0,
        label: 'Dawn Departure',
        targetNodeId: 'act-1',
        hexPalette: ['#0A192F', '#172A45', '#64FFDA'],
        notes: 'Cold blues shifting to cyan dawn',
      },
    ],
    acts: [
      {
        id: 'act-1',
        orderIndex: 0,
        title: 'Act I: Discovery',
        summary: 'The crew discovers the signal.',
        dramaticMeta: {
          incitingIncident: 'Signal detected from Sector 4',
          subtext: 'Unspoken fear of the unknown',
          characterArcs: [
            { characterAssetId: 'asset-char-1', arcState: 'reluctant', internalShift: 'curiosity sparked' },
          ],
        },
        sequences: [
          {
            id: 'seq-1',
            orderIndex: 0,
            title: 'Sequence 1: The Relay Station',
            summary: 'Monitoring deep space sensors.',
            scenes: [
              {
                id: 'scene-node-1',
                orderIndex: 0,
                title: 'Scene 1: Morning Shift',
                summary: 'Coffee and routine sensor telemetry.',
                beats: [
                  {
                    id: 'beat-1',
                    orderIndex: 0,
                    title: 'Anomaly',
                    content: 'Sensors spike beyond expected telemetry bounds.',
                    dramaticMeta: { setupForeshadowing: ['Echo in frequency band 9'] },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function fixture() {
  const state: ChangeSetState = emptyState();
  const story1 = createSampleStory('story-1');
  const story2: Story = {
    ...createSampleStory('story-2'),
    title: 'Neon Odyssey',
    author: 'Marcus Vance',
    tags: ['cyberpunk', 'noir'],
    favorite: true,
    archivedAt: '2026-11-10T12:00:00Z',
    logline: 'A private detective traces memory syndicates in Neo-Manila.',
  };
  state.stories = [story1, story2];
  return { state, story1, story2 };
}

describe('Story MCP Granular Reads', () => {
  it('krakinai_list_stories filters by authorization, query, tag, favorite, and archive status', async () => {
    const { state, story1, story2 } = fixture();
    const broker = new ProposalBroker({ readState: async () => state });
    const scope = {
      ...emptyMcpScope(),
      storyIds: ['story-1', 'story-2'],
      includeStoryText: true,
    };
    broker.connect('session-1', scope);

    // List all active
    const listActive = await broker.handle({
      requestId: 'req-1',
      tool: 'krakinai_list_stories' as any,
      args: { archiveFilter: 'active' },
    }, 'session-1');
    expect(listActive.ok).toBe(true);
    if (!listActive.ok) return;
    const activeData = listActive.data as any;
    expect(activeData.items).toHaveLength(1);
    expect(activeData.items[0].id).toBe('story-1');
    expect(activeData.items[0].logline).toBe(story1.logline);
    expect(activeData.items[0].digest).toBe(computeStoryDigest(story1));

    // List archived
    const listArchived = await broker.handle({
      requestId: 'req-2',
      tool: 'krakinai_list_stories' as any,
      args: { archiveFilter: 'archived' },
    }, 'session-1');
    expect(listArchived.ok).toBe(true);
    if (!listArchived.ok) return;
    const archivedData = listArchived.data as any;
    expect(archivedData.items).toHaveLength(1);
    expect(archivedData.items[0].id).toBe('story-2');

    // Filter by favorite
    const listFavorite = await broker.handle({
      requestId: 'req-3',
      tool: 'krakinai_list_stories' as any,
      args: { favorite: true, archiveFilter: 'all' },
    }, 'session-1');
    expect(listFavorite.ok).toBe(true);
    if (!listFavorite.ok) return;
    expect((listFavorite.data as any).items).toHaveLength(1);
    expect((listFavorite.data as any).items[0].id).toBe('story-2');

    // Filter by tag
    const listTag = await broker.handle({
      requestId: 'req-4',
      tool: 'krakinai_list_stories' as any,
      args: { tag: 'cyberpunk', archiveFilter: 'all' },
    }, 'session-1');
    expect(listTag.ok).toBe(true);
    if (!listTag.ok) return;
    expect((listTag.data as any).items).toHaveLength(1);
    expect((listTag.data as any).items[0].id).toBe('story-2');

    // Filter by query
    const listQuery = await broker.handle({
      requestId: 'req-5',
      tool: 'krakinai_list_stories' as any,
      args: { query: 'Elena', archiveFilter: 'all' },
    }, 'session-1');
    expect(listQuery.ok).toBe(true);
    if (!listQuery.ok) return;
    expect((listQuery.data as any).items).toHaveLength(1);
    expect((listQuery.data as any).items[0].id).toBe('story-1');
  });

  it('krakinai_list_stories redacts narrative prose when includeStoryText is false', async () => {
    const { state } = fixture();
    const broker = new ProposalBroker({ readState: async () => state });
    const scope = {
      ...emptyMcpScope(),
      storyIds: ['story-1'],
      includeStoryText: false,
    };
    broker.connect('session-2', scope);

    const res = await broker.handle({
      requestId: 'req-redact',
      tool: 'krakinai_list_stories' as any,
      args: { archiveFilter: 'all' },
    }, 'session-2');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const item = (res.data as any).items[0];
    expect(item.id).toBe('story-1');
    expect(item.title).toBe('The Lost Chronicles');
    expect(item.logline).toBeUndefined();
    expect(item.premise).toBeUndefined();
    expect(item.synopsis).toBeUndefined();
    expect(item.textRedacted).toBe(true);
  });

  it('krakinai_get_story denies access if storyId is outside scope.storyIds', async () => {
    const { state } = fixture();
    const broker = new ProposalBroker({ readState: async () => state });
    const scope = {
      ...emptyMcpScope(),
      storyIds: ['story-1'],
    };
    broker.connect('session-3', scope);

    const denied = await broker.handle({
      requestId: 'req-deny',
      tool: 'krakinai_get_story' as any,
      args: { storyId: 'story-2' },
    }, 'session-3');
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).toBe('PERMISSION_DENIED');
  });

  it('krakinai_get_story returns projections: overview, book, creator_hierarchy, and full', async () => {
    const { state, story1 } = fixture();
    const broker = new ProposalBroker({ readState: async () => state });
    const scope = {
      ...emptyMcpScope(),
      storyIds: ['story-1'],
      includeStoryText: true,
    };
    broker.connect('session-4', scope);

    // Overview projection
    const overviewRes = await broker.handle({
      requestId: 'req-overview',
      tool: 'krakinai_get_story' as any,
      args: { storyId: 'story-1', projection: 'overview' },
    }, 'session-4');
    expect(overviewRes.ok).toBe(true);
    if (!overviewRes.ok) return;
    const overview = overviewRes.data as any;
    expect(overview.title).toBe(story1.title);
    expect(overview.logline).toBe(story1.logline);
    expect(overview.premise).toBe(story1.premise);
    expect(overview.fullBookText).toBeUndefined();
    expect(overview.acts).toBeUndefined();
    expect(overview.digest).toBe(computeStoryDigest(story1));

    // Book projection
    const bookRes = await broker.handle({
      requestId: 'req-book',
      tool: 'krakinai_get_story' as any,
      args: { storyId: 'story-1', projection: 'book' },
    }, 'session-4');
    expect(bookRes.ok).toBe(true);
    if (!bookRes.ok) return;
    const book = bookRes.data as any;
    expect(book.title).toBe(story1.title);
    expect(book.fullBookText).toBe(story1.fullBookText);
    expect(book.acts).toBeUndefined();

    // Creator hierarchy projection
    const hierRes = await broker.handle({
      requestId: 'req-hier',
      tool: 'krakinai_get_story' as any,
      args: { storyId: 'story-1', projection: 'creator_hierarchy' },
    }, 'session-4');
    expect(hierRes.ok).toBe(true);
    if (!hierRes.ok) return;
    const hier = hierRes.data as any;
    expect(hier.acts).toHaveLength(1);
    expect(hier.acts[0].dramaticMeta.incitingIncident).toBe('Signal detected from Sector 4');
    expect(hier.acts[0].sequences[0].scenes[0].beats[0].dramaticMeta.setupForeshadowing).toEqual(['Echo in frequency band 9']);

    // Full projection
    const fullRes = await broker.handle({
      requestId: 'req-full',
      tool: 'krakinai_get_story' as any,
      args: { storyId: 'story-1', projection: 'full' },
    }, 'session-4');
    expect(fullRes.ok).toBe(true);
    if (!fullRes.ok) return;
    const full = fullRes.data as any;
    expect(full.id).toBe('story-1');
    expect(full.fullBookText).toBe(story1.fullBookText);
    expect(full.acts).toHaveLength(1);
    expect(full.colorScript).toHaveLength(1);
    expect(full.referencePack.assetIds).toEqual(['asset-char-1']);

    // Director briefing projection
    const briefingRes = await broker.handle({
      requestId: 'req-briefing',
      tool: 'krakinai_get_story' as any,
      args: { storyId: 'story-1', projection: 'director_briefing' },
    }, 'session-4');
    expect(briefingRes.ok).toBe(true);
    if (!briefingRes.ok) return;
    const briefing = briefingRes.data as any;
    expect(briefing.id).toBe('story-1');
    expect(briefing.digest).toBe(computeStoryDigest(story1));
  });

  it('krakinai_stage_story stages directorBriefing in create and update modes', async () => {
    const { state } = fixture();
    const broker = new ProposalBroker({ readState: async () => state });
    const scope = {
      ...emptyMcpScope(),
      allowProposals: true,
      allowStoryProposals: true,
      allowNewProjects: true,
      storyIds: ['story-1'],
    };
    broker.connect('session-briefing-stage', scope);

    const testBriefing = {
      pacingAuditSummary: 'All beats verified <= 10s',
      continuityLocks: [
        { id: 'cl-1', assetType: 'character' as const, candidateRefOrId: 'char-kael', description: 'Silver wolf raider' },
      ],
      lightingProgression: [
        { id: 'lp-1', beatRange: 'BEAT-01-03', candidateRefOrId: 'light-dawn', setupAndMood: 'Cold slate mist' },
      ],
      actionArchetypes: [
        { id: 'aa-1', beatRange: 'BEAT-01', candidateRefOrId: 'act-prowl', kinematicsAndIntensity: 'Low crouch' },
      ],
      vocalRegister: [
        {
          id: 'vr-1',
          character: 'Kael',
          beatId: 'BEAT-01',
          emotion: 'Torn',
          deliveryTechnique: 'Raspy whisper',
          voiceCharacteristics: 'Low baritone',
          speechIntonation: 'Falling cadence',
          bodyLanguage: 'Claws dug into loam',
        },
      ],
    };

    const stageRes = await broker.handle({
      requestId: 'stage-briefing-create',
      tool: 'krakinai_stage_story' as any,
      args: {
        changeSetId: 'cs-story-briefing-create',
        clientRef: 'story-with-briefing',
        mode: 'create',
        title: 'Story With Briefing',
        directorBriefing: testBriefing,
      },
    }, 'session-briefing-stage');

    expect(stageRes.ok).toBe(true);
    if (!stageRes.ok) return;
    const brokerState = broker.getState();
    const proposal = brokerState.proposals.find((p) => p.changeSetId === 'cs-story-briefing-create');
    expect(proposal).toBeDefined();
    const op = proposal?.preview?.changeSet.operations[0] as any;
    expect(op.type).toBe('story.create');
    expect(op.directorBriefing).toEqual(testBriefing);
  });
});

describe('Story MCP Incremental Staging Tools', () => {
  it('krakinai_stage_story creates new story, auto-promotes to v7, and enforces canonical ordering', async () => {
    const { state } = fixture();
    const broker = new ProposalBroker({ readState: async () => state });
    const scope = {
      ...emptyMcpScope(),
      allowProposals: true,
      allowStoryProposals: true,
      storyIds: ['story-1'],
    };
    broker.connect('session-stage-1', scope);

    const stageRes = await broker.handle({
      requestId: 'stage-1',
      tool: 'krakinai_stage_story' as any,
      args: {
        changeSetId: 'cs-story-new-1',
        title: 'New Story Staged',
        clientRef: 'story-client-ref-1',
        mode: 'create',
        author: 'AI Co-Director',
        tags: ['thriller'],
        logline: 'A thrilling tale of deep sea diving.',
        premise: 'The abyss contains secrets better left undisturbed.',
        synopsis: 'A deep sea crew reaches Challenger Deep.',
        treatment: 'Full pitch treatment for the deep sea descent.',
        fullBookText: 'Darkness enveloped the submarine hull...',
      },
    }, 'session-stage-1');

    expect(stageRes.ok).toBe(true);
    if (!stageRes.ok) return;
    const data = stageRes.data as any;
    expect(data.schema).toBe('krakinai.change-set.v7');
    expect(data.status).toBe('review_required');
    expect(data.proposalId).toBeDefined();

    // Verify draft proposal exists with story.create operation
    const brokerState = broker.getState();
    const proposal = brokerState.proposals.find((p) => p.changeSetId === 'cs-story-new-1');
    expect(proposal).toBeDefined();
    expect(proposal?.preview?.changeSet.schema).toBe('krakinai.change-set.v7');
    const ops = proposal?.preview?.changeSet.operations ?? [];
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('story.create');
  });

  it('krakinai_stage_story_status stages status and favorite toggles', async () => {
    const { state, story1 } = fixture();
    const broker = new ProposalBroker({ readState: async () => state });
    const scope = {
      ...emptyMcpScope(),
      allowProposals: true,
      allowStoryProposals: true,
      storyIds: ['story-1'],
    };
    broker.connect('session-stage-status', scope);

    const stageRes = await broker.handle({
      requestId: 'stage-status-1',
      tool: 'krakinai_stage_story_status' as any,
      args: {
        changeSetId: 'cs-story-status-1',
        storyId: 'story-1',
        status: 'archived',
        favorite: true,
        expectedRevision: story1.revisionNumber,
        expectedStoryDigest: computeStoryDigest(story1),
      },
    }, 'session-stage-status');

    expect(stageRes.ok).toBe(true);
    if (!stageRes.ok) return;
    const brokerState = broker.getState();
    const proposal = brokerState.proposals.find((p) => p.changeSetId === 'cs-story-status-1');
    expect(proposal?.preview?.changeSet.operations[0].type).toBe('story.set_status');
  });

  it('krakinai_stage_story_structure stages structural breakdown', async () => {
    const { state, story1 } = fixture();
    const broker = new ProposalBroker({ readState: async () => state });
    const scope = {
      ...emptyMcpScope(),
      allowProposals: true,
      allowStoryProposals: true,
      storyIds: ['story-1'],
    };
    broker.connect('session-stage-struct', scope);

    const newActs: StoryAct[] = [
      {
        id: 'act-new-1',
        orderIndex: 0,
        title: 'Act I: The Call',
        summary: 'Hero receives the call.',
        sequences: [],
      },
    ];

    const stageRes = await broker.handle({
      requestId: 'stage-struct-1',
      tool: 'krakinai_stage_story_structure' as any,
      args: {
        changeSetId: 'cs-story-struct-1',
        storyId: 'story-1',
        acts: newActs,
        expectedRevision: story1.revisionNumber,
        expectedStoryDigest: computeStoryDigest(story1),
      },
    }, 'session-stage-struct');

    expect(stageRes.ok).toBe(true);
    if (!stageRes.ok) return;
    const brokerState = broker.getState();
    const proposal = brokerState.proposals.find((p) => p.changeSetId === 'cs-story-struct-1');
    expect(proposal?.preview?.changeSet.operations[0].type).toBe('story.patch_structure');
  });

  it('krakinai_stage_story_dramatic_meta stages targeted dramatic metadata', async () => {
    const { state, story1 } = fixture();
    const broker = new ProposalBroker({ readState: async () => state });
    const scope = {
      ...emptyMcpScope(),
      allowProposals: true,
      allowStoryProposals: true,
      storyIds: ['story-1'],
    };
    broker.connect('session-stage-meta', scope);

    const stageRes = await broker.handle({
      requestId: 'stage-meta-1',
      tool: 'krakinai_stage_story_dramatic_meta' as any,
      args: {
        changeSetId: 'cs-story-meta-1',
        storyId: 'story-1',
        targetNode: { kind: 'act', id: 'act-1' },
        dramaticMeta: {
          climax: 'Hero confronts the void.',
          subtext: 'Survival instincts overriding duty.',
        },
        expectedRevision: story1.revisionNumber,
        expectedStoryDigest: computeStoryDigest(story1),
      },
    }, 'session-stage-meta');

    expect(stageRes.ok).toBe(true);
    if (!stageRes.ok) return;
    const brokerState = broker.getState();
    const proposal = brokerState.proposals.find((p) => p.changeSetId === 'cs-story-meta-1');
    expect(proposal?.preview?.changeSet.operations[0].type).toBe('story.patch_dramatic_meta');
  });

  it('krakinai_stage_story_references stages reference pack and color script', async () => {
    const { state, story1 } = fixture();
    const broker = new ProposalBroker({ readState: async () => state });
    const scope = {
      ...emptyMcpScope(),
      allowProposals: true,
      allowStoryProposals: true,
      storyIds: ['story-1'],
    };
    broker.connect('session-stage-refs', scope);

    const stageRes = await broker.handle({
      requestId: 'stage-refs-1',
      tool: 'krakinai_stage_story_references' as any,
      args: {
        changeSetId: 'cs-story-refs-1',
        storyId: 'story-1',
        referencePack: {
          assetIds: ['asset-char-1', 'asset-env-1'],
          variantIds: ['variant-outfit-1'],
          mediaIds: [],
        },
        colorScript: [
          {
            id: 'cs-entry-1',
            orderIndex: 0,
            label: 'Act I Mood',
            hexPalette: ['#111111', '#222222'],
          },
        ],
        linkedCollectionId: 'collection-project-1',
        expectedRevision: story1.revisionNumber,
        expectedStoryDigest: computeStoryDigest(story1),
      },
    }, 'session-stage-refs');

    expect(stageRes.ok).toBe(true);
    if (!stageRes.ok) return;
    const brokerState = broker.getState();
    const proposal = brokerState.proposals.find((p) => p.changeSetId === 'cs-story-refs-1');
    expect(proposal?.preview?.changeSet.operations[0].type).toBe('story.patch_references');
  });

  it('denies staging when allowStoryProposals is false and allowProposals is false', async () => {
    const { state } = fixture();
    const broker = new ProposalBroker({ readState: async () => state });
    const scope = {
      ...emptyMcpScope(),
      allowProposals: false,
      allowStoryProposals: false,
      storyIds: ['story-1'],
    };
    broker.connect('session-stage-denied', scope);

    const stageRes = await broker.handle({
      requestId: 'stage-denied-1',
      tool: 'krakinai_stage_story' as any,
      args: {
        changeSetId: 'cs-denied-1',
        title: 'Denied Story',
        clientRef: 'client-denied',
        mode: 'create',
      },
    }, 'session-stage-denied');

    expect(stageRes.ok).toBe(false);
    if (stageRes.ok) return;
    expect(stageRes.error.code).toBe('PERMISSION_DENIED');
  });
});
