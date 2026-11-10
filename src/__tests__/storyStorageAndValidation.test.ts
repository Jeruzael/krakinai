import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { Story, StoryAct, Collection } from '../types/domain';
import {
  computeStoryDigest,
  validateStoryInput,
  validateStoryReferences,
} from '../domain/storyValidator';
import {
  openStoriesDatabase,
  saveStory,
  getStory,
  listStories,
  toggleStoryFavorite,
  setStoryArchived,
  deleteStory,
  clearStoriesStoreForTesting,
} from '../storage/stories';
import { getAllSnapshot, clearAllStoresForTesting } from '../storage/db';
import { emptyState } from './fixtures/changeSetFixture';

const sampleActs: StoryAct[] = [
  {
    id: 'act-1',
    orderIndex: 0,
    title: 'Act I: The Call',
    summary: 'The journey begins.',
    dramaticMeta: {
      incitingIncident: 'The discovery of the artifact',
      setupForeshadowing: ['The ancient prophecy mention'],
    },
    sequences: [
      {
        id: 'seq-1',
        orderIndex: 0,
        title: 'Sequence 1: Village Life',
        scenes: [
          {
            id: 'scene-1',
            orderIndex: 0,
            title: 'Morning Routine',
            beats: [
              {
                id: 'beat-1',
                orderIndex: 0,
                title: 'Waking up',
                content: 'Hero wakes up and checks the sky.',
                dramaticMeta: { subtext: 'Sense of impending dread' },
              },
            ],
          },
        ],
      },
    ],
  },
];

const sampleStory: Story = {
  id: 'story-1',
  title: 'The Starlight Chronicle',
  author: 'Director AI & Creator',
  createdAt: '2026-11-11T00:00:00.000Z',
  updatedAt: '2026-11-11T00:00:00.000Z',
  archivedAt: null,
  favorite: false,
  revisionNumber: 1,
  tags: ['fantasy', 'epic', 'awakening'],
  coverMediaId: null,
  heroBannerMediaId: null,
  logline: 'A forgotten apprentice awakens an astral titan.',
  premise: 'In a dying kingdom beneath two moons...',
  synopsis: 'Detailed three-paragraph synopsis...',
  treatment: 'Complete multi-scene treatment...',
  fullBookText: 'Chapter 1: The First Ember. The night air was crisp...',
  referencePack: {
    assetIds: [],
    variantIds: [],
    mediaIds: [],
  },
  linkedCollectionId: null,
  colorScript: [
    {
      id: 'cs-1',
      orderIndex: 0,
      label: 'Dawn awakening',
      hexPalette: ['#1a102f', '#42275a', '#734b6d'],
    },
  ],
  acts: sampleActs,
};

describe('Story Validator & Digest', () => {
  it('computes deterministic SHA-256 digest and detects content mutations', () => {
    const digest1 = computeStoryDigest(sampleStory);
    const digest2 = computeStoryDigest(structuredClone(sampleStory));
    expect(digest1).toMatch(/^[a-f0-9]{64}$/);
    expect(digest1).toBe(digest2);

    const modified = structuredClone(sampleStory);
    modified.fullBookText = 'Altered text.';
    expect(computeStoryDigest(modified)).not.toBe(digest1);

    const modifiedMeta = structuredClone(sampleStory);
    modifiedMeta.acts[0].dramaticMeta!.climax = 'New climax';
    expect(computeStoryDigest(modifiedMeta)).not.toBe(digest1);
  });

  it('validates story structure, titles, and ordering', () => {
    expect(() => validateStoryInput(sampleStory)).not.toThrow();

    const emptyTitle = { ...sampleStory, title: '   ' };
    expect(() => validateStoryInput(emptyTitle)).toThrow(/title/i);

    const invalidActs = structuredClone(sampleStory);
    invalidActs.acts[0].orderIndex = -1;
    expect(() => validateStoryInput(invalidActs)).toThrow(/orderIndex/i);
  });

  it('validates story references against database state', () => {
    const state = emptyState();
    expect(validateStoryReferences(sampleStory, state)).toEqual([]);

    const badRefs = structuredClone(sampleStory);
    badRefs.referencePack.assetIds = ['missing-asset'];
    badRefs.linkedCollectionId = 'missing-collection';
    const warnings = validateStoryReferences(badRefs, state);
    expect(warnings.some((w) => w.includes('missing-asset'))).toBe(true);
    expect(warnings.some((w) => w.includes('missing-collection'))).toBe(true);
  });
});

describe('Story Storage (IndexedDB)', () => {
  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    await clearAllStoresForTesting();
    await clearStoriesStoreForTesting();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves, retrieves, and updates stories', async () => {
    await saveStory(sampleStory);
    const retrieved = await getStory(sampleStory.id);
    expect(retrieved).toEqual(sampleStory);

    const updated = { ...sampleStory, title: 'Updated Title', revisionNumber: 2 };
    await saveStory(updated);
    expect((await getStory(sampleStory.id))?.title).toBe('Updated Title');
  });

  it('lists stories with filters for query, tag, favorite, and archive state', async () => {
    await saveStory(sampleStory);
    const archivedStory: Story = {
      ...sampleStory,
      id: 'story-2',
      title: 'Ancient Archives',
      archivedAt: '2026-11-11T01:00:00.000Z',
      favorite: true,
      tags: ['history'],
    };
    await saveStory(archivedStory);

    const activeList = await listStories({ archiveFilter: 'active' });
    expect(activeList.map((s) => s.id)).toEqual(['story-1']);

    const archivedList = await listStories({ archiveFilter: 'archived' });
    expect(archivedList.map((s) => s.id)).toEqual(['story-2']);

    const allList = await listStories({ archiveFilter: 'all' });
    expect(allList).toHaveLength(2);

    const searchList = await listStories({ query: 'chronicle' });
    expect(searchList.map((s) => s.id)).toEqual(['story-1']);

    const favList = await listStories({ favorite: true });
    expect(favList.map((s) => s.id)).toEqual(['story-2']);
  });

  it('toggles favorite and archive flags cleanly', async () => {
    await saveStory(sampleStory);
    const fav = await toggleStoryFavorite(sampleStory.id);
    expect(fav.favorite).toBe(true);

    const unarchived = await setStoryArchived(sampleStory.id, true);
    expect(unarchived.archivedAt).toBeTruthy();

    const restored = await setStoryArchived(sampleStory.id, false);
    expect(restored.archivedAt).toBeNull();
  });

  it('guards deletion when story is linked to an active storyboard project', async () => {
    const mockCollection: Collection = {
      id: 'collection-active-1',
      name: 'Active Project',
      description: 'Project collection',
      members: [],
      createdAt: '2026-11-11T00:00:00.000Z',
      updatedAt: '2026-11-11T00:00:00.000Z',
    };
    const collections = [mockCollection];
    const linkedStory: Story = {
      ...sampleStory,
      id: 'story-linked',
      linkedCollectionId: mockCollection.id,
    };
    await saveStory(linkedStory);

    await expect(deleteStory(linkedStory.id, collections)).rejects.toThrow(
      /linked to active collection/i
    );

    // After unlinking, delete succeeds
    const unlinked = { ...linkedStory, linkedCollectionId: null };
    await saveStory(unlinked);
    await expect(deleteStory(linkedStory.id, collections)).resolves.not.toThrow();
    expect(await getStory(linkedStory.id)).toBeUndefined();
  });

  it('hydrates stories into getAllSnapshot() without mutating v4 compatibility', async () => {
    await saveStory(sampleStory);
    const snapshot = await getAllSnapshot();
    expect(snapshot.stories).toBeDefined();
    expect(snapshot.stories).toHaveLength(1);
    expect(snapshot.stories![0].id).toBe('story-1');
  });
});
