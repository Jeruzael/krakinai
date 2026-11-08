import { describe, expect, it } from 'vitest';
import { findCandidateMatches } from '../domain/changeSetCandidates';
import { resolveLibraryAssets } from '../domain/mcpGranularReads';
import { buildSmartInitialApproval } from '../domain/proposalReview';
import {
  createEmptyDraftChangeSet,
  stageSceneRecipeOperation,
} from '../domain/mcpGranularStaging';
import { emptyMcpScope } from '../domain/mcpScope';
import type { ChangeSetState, ChangeSet } from '../types/changeSet';
import type { PromptAsset } from '../types/domain';

const mockCharacter: PromptAsset = {
  id: 'char_silvester_vale',
  category: 'characters',
  kind: 'asset',
  title: 'Silvester Vale',
  promptText: '16-year-old commoner youth with lean angular jaw and raven hair.',
  description: 'Hero',
  tags: ['character', 'hero', 'silvester'],
  notes: '',
  mediaLinks: [],
  favorite: false,
  reviewStatus: 'reviewed',
  revision: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockState: ChangeSetState = {
  collections: [],
  scenes: [],
  assets: [mockCharacter],
  variants: [],
  templates: [],
  media: [],
  preferences: {
    aiImports: {
      version: 1,
      candidates: [],
      receipts: [],
    },
  },
};

describe('candidateMatching & smart resolution', () => {
  it('matches candidates with parenthetical base descriptors to library records by base title', () => {
    const candidate = {
      kind: 'character' as const,
      title: 'Silvester Vale (Base Character)',
      promptText: '16-year-old commoner youth with dark eyes and worn clothes.',
      tags: ['hero', 'candidate'],
    };

    const matches = findCandidateMatches(candidate, mockState);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].id).toBe('char_silvester_vale');
    expect(matches[0].reason).toMatch(/base title|normalized title/i);
  });

  it('resolves library assets in a single batch query for agents', () => {
    const scope = { ...emptyMcpScope(), assetIds: ['char_silvester_vale'], includeAssetText: true };
    const result = resolveLibraryAssets(mockState, scope, {
      items: [
        {
          clientRef: 'char-silvester',
          kind: 'character',
          title: 'Silvester Vale (Base Character)',
          promptText: '16-year-old youth with raven hair.',
        },
        {
          clientRef: 'char-new-character',
          kind: 'character',
          title: 'Brand New Unknown NPC',
          promptText: 'A mysterious cloaked stranger.',
        },
      ],
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      clientRef: 'char-silvester',
      matchStatus: expect.stringMatching(/exact_match|title_match/),
      recommendedAction: 'reuse',
      matchedRecord: {
        id: 'char_silvester_vale',
        title: 'Silvester Vale',
        revision: 2,
      },
    });

    expect(result.items[1]).toMatchObject({
      clientRef: 'char-new-character',
      matchStatus: 'no_match',
      recommendedAction: 'create',
    });
  });

  it('buildSmartInitialApproval pre-selects reuse for matched assets and create for new assets', () => {
    const changeSet: ChangeSet = {
      schema: 'krakinai.change-set.v3',
      changeSetId: 'cs-smart-test',
      source: { kind: 'codex' },
      operations: [
        {
          operationId: 'op-char-silvester',
          type: 'asset.propose',
          clientRef: 'char-silvester',
          kind: 'character',
          title: 'Silvester Vale (Base Character)',
          promptText: '16-year-old commoner youth.',
          tags: ['hero'],
        },
        {
          operationId: 'op-char-unknown',
          type: 'asset.propose',
          clientRef: 'char-unknown',
          kind: 'character',
          title: 'Unknown Guard',
          promptText: 'Armored temple guard.',
          tags: ['guard'],
        },
      ],
    };

    const approval = buildSmartInitialApproval(changeSet, mockState);
    expect(approval.storyboard).toBe(true);
    expect(approval.scenes).toBe(true);
    expect(approval.assetDecisions['op-char-silvester']).toEqual({
      action: 'reuse',
      assetId: 'char_silvester_vale',
      expectedRevision: 2,
    });
    expect(approval.assetDecisions['op-char-unknown']).toMatchObject({
      action: 'create',
    });
  });

  it('auto-heals dialogue cues referencing participant IDs not cast in the shot', () => {
    let draft = createEmptyDraftChangeSet('cs-dialogue-heal');
    const { changeSet } = stageSceneRecipeOperation(draft, {
      clientRef: 'scene-shot-19',
      project: { ref: 'proj-1' },
      shot: { ref: 'shot-19' },
      title: 'Shot 19 Dialogue',
      participants: [
        { id: 'silvester', character: { asset: { id: 'char_silvester_vale' } } },
        { id: 'amber', character: { asset: { ref: 'char-amber' } } },
      ],
      dialogueCues: [
        // Exact cast match
        { id: 'cue-1', speaker: 'Silvester Vale', participantId: 'silvester', line: 'Hold on.' },
        // Mismatched ID pointing to uncast character -> should auto-heal to unlinked narration
        { id: 'cue-2', speaker: 'Pioneer Orin', participantId: 'orin', line: 'Silence!' },
      ],
    });

    const op = changeSet.operations.find(o => o.clientRef === 'scene-shot-19') as any;
    expect(op.ensemble.dialogueCues[0].participantId).toBe('silvester');
    expect(op.ensemble.dialogueCues[1].participantId).toBeUndefined();
  });
});
