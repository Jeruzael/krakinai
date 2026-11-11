import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Story, StoryAct } from '../types/domain';

const { sampleStory, sampleArchivedStory, libraryState, mockNavigate, mockRefreshSnapshot, mockShowToast, mockOpenConfirmDialog } = vi.hoisted(() => {
  const mockNavigate = vi.fn();
  const mockRefreshSnapshot = vi.fn(async () => undefined);
  const mockShowToast = vi.fn();
  const mockOpenConfirmDialog = vi.fn();

  const sampleStory: any = {
    id: 'story-alpha',
    title: 'Chronicles of the Deep',
    author: 'Maya Lin',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
    archivedAt: null,
    favorite: false,
    revisionNumber: 2,
    tags: ['sci-fi', 'submersible', 'exploration'],
    coverMediaId: 'media-cover-1',
    heroBannerMediaId: 'media-banner-1',
    logline: 'An oceanographer discovers an alien structure in the Mariana Trench.',
    premise: 'What if humanity was not the first civilization on Earth?',
    synopsis: 'A deep sea vessel descends past the abyss into an ancient luminous biosphere.',
    treatment: 'Complete pitch treatment detailing the 3-act descent and discovery.',
    fullBookText: 'Chapter 1: The Descent Begins.\nPressure gauges groaned as the submersible slipped below 5,000 meters...',
    referencePack: {
      assetIds: ['asset-char-1', 'asset-env-1'],
      variantIds: ['variant-outfit-1'],
      mediaIds: ['media-cover-1'],
    },
    linkedCollectionId: 'collection-project-1',
    colorScript: [
      {
        id: 'cs-node-1',
        orderIndex: 0,
        label: 'Abyssal Zone',
        targetNodeId: 'act-1',
        hexPalette: ['#03071E', '#0A1128', '#001F54'],
        notes: 'Deep cold blues and pitch black void',
      },
      {
        id: 'cs-node-2',
        orderIndex: 1,
        label: 'Luminous Biome',
        targetNodeId: 'act-2',
        hexPalette: ['#00F5D4', '#7B2CBF', '#9D4EDD'],
        notes: 'Bioluminescent cyan and ultraviolet flora',
      },
    ],
    acts: [
      {
        id: 'act-1',
        orderIndex: 0,
        title: 'Act I: The Descent',
        summary: 'Preparation and launch into the trench.',
        dramaticMeta: {
          incitingIncident: 'Sonar anomaly detected at 10,000 meters',
          subtext: 'Maya hides her claustrophobia from the corporate sponsor',
          characterArcs: [
            { characterAssetId: 'asset-char-1', arcState: 'driven', internalShift: 'fear masked by determination' },
          ],
        },
        sequences: [
          {
            id: 'seq-1',
            orderIndex: 0,
            title: 'Sequence 1: The Pressure Test',
            summary: 'Descending through twilight and midnight zones.',
            scenes: [
              {
                id: 'scene-1',
                orderIndex: 0,
                title: 'Scene 1: Midnight Zone',
                summary: 'External hull groans under pressure.',
                beats: [
                  {
                    id: 'beat-1',
                    orderIndex: 0,
                    title: 'Depth Gauge Warning',
                    content: 'Hull seals compress; silence falls over the cockpit.',
                    dramaticMeta: { setupForeshadowing: ['Cracked gauge glass'] },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const sampleArchivedStory: any = {
    ...sampleStory,
    id: 'story-beta-archived',
    title: 'Sunken Relic',
    favorite: true,
    archivedAt: '2026-11-10T12:00:00Z',
    tags: ['history'],
    logline: 'An archived tale of naval salvage.',
  };

  const libraryState = {
    snapshot: {
      assets: [
        { id: 'asset-char-1', category: 'characters', title: 'Dr. Maya Lin', tags: [] },
        { id: 'asset-env-1', category: 'environments', title: 'Mariana Trench', tags: [] },
      ],
      variants: [
        { id: 'variant-outfit-1', title: 'Pressure Dive Suit', parentCharacterId: 'asset-char-1', tags: [] },
      ],
      media: [
        { id: 'media-cover-1', filename: 'trench_cover.jpg', safeFilename: 'trench_cover.jpg' },
        { id: 'media-banner-1', filename: 'trench_banner.jpg', safeFilename: 'trench_banner.jpg' },
      ],
      collections: [
        { id: 'collection-project-1', name: 'Mariana Expedition Film', project: { shots: [] } },
      ],
      scenes: [],
      templates: [],
      drafts: [],
      stories: [sampleStory, sampleArchivedStory],
      preferences: { activeDraftId: undefined },
    } as any,
    hashPath: '/stories',
    toasts: [],
    navigate: mockNavigate,
    refreshSnapshot: mockRefreshSnapshot,
    showToast: mockShowToast,
    openConfirmDialog: mockOpenConfirmDialog,
    closeConfirmDialog: vi.fn(),
  };

  return { sampleStory, sampleArchivedStory, libraryState, mockNavigate, mockRefreshSnapshot, mockShowToast, mockOpenConfirmDialog };
});

vi.mock('../context/LibraryContext', () => ({
  useLibrary: () => libraryState,
}));

vi.mock('../storage/stories', () => ({
  listStories: vi.fn(async (filter?: any) => {
    let list = [sampleStory, sampleArchivedStory];
    if (filter?.archiveFilter === 'active') list = list.filter((s) => !s.archivedAt);
    if (filter?.archiveFilter === 'archived') list = list.filter((s) => !!s.archivedAt);
    if (filter?.favorite !== undefined) list = list.filter((s) => s.favorite === filter.favorite);
    return list;
  }),
  getStory: vi.fn(async (id: string) => {
    if (id === sampleStory.id) return sampleStory;
    if (id === sampleArchivedStory.id) return sampleArchivedStory;
    return null;
  }),
  saveStory: vi.fn(async (story: Story) => story),
  deleteStory: vi.fn(async () => undefined),
  toggleStoryFavorite: vi.fn(async (id: string) => undefined),
  archiveStory: vi.fn(async (id: string, arch: boolean) => undefined),
  activeCollectionReferencingStory: vi.fn((id: string, cols: any[]) => {
    return cols.find((c) => c.id === 'collection-project-1');
  }),
}));

import { StoriesScreen } from '../screens/StoriesScreen';
import { StoryCardModal } from '../components/stories/StoryCardModal';
import { StoryWorkspaceScreen } from '../screens/StoryWorkspaceScreen';
import { StoryCreatorMode } from '../components/stories/StoryCreatorMode';
import { AppShell } from '../components/AppShell';

beforeEach(() => {
  vi.clearAllMocks();
  libraryState.hashPath = '/stories';
  libraryState.snapshot.stories = [sampleStory, sampleArchivedStory];
});

describe('StoriesScreen Component', () => {
  it('renders story cards, grid/list view toggle, and search filter', async () => {
    render(<StoriesScreen />);

    // Header & Title
    expect(screen.getByText('Stories & Creator Mode')).toBeInTheDocument();
    expect(screen.getByText('Chronicles of the Deep')).toBeInTheDocument();
    expect(screen.getByText(/An oceanographer discovers an alien structure/)).toBeInTheDocument();
    expect(screen.getByText('Maya Lin')).toBeInTheDocument();

    // Toggle Grid to List view
    const listBtn = screen.getByRole('button', { name: /List View/i });
    fireEvent.click(listBtn);
    expect(screen.getByTestId('stories-container')).toHaveClass('stories-list-view');

    // Search filter
    const searchInput = screen.getByPlaceholderText(/Search stories/i);
    fireEvent.change(searchInput, { target: { value: 'Nonexistent query' } });
    expect(screen.queryByText('Chronicles of the Deep')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Maya' } });
    expect(screen.getByText('Chronicles of the Deep')).toBeInTheDocument();
  });

  it('filters by favorite and active/archived state', async () => {
    render(<StoriesScreen />);

    // Toggle favorite filter
    const favToggle = screen.getByRole('button', { name: /Favorites Only/i });
    fireEvent.click(favToggle);
    // Only Sunken Relic is favorited
    expect(screen.queryByText('Chronicles of the Deep')).not.toBeInTheDocument();

    // Reset favorites
    fireEvent.click(favToggle);

    // Filter by archived
    const archiveSelect = screen.getByLabelText(/Archive filter/i);
    fireEvent.change(archiveSelect, { target: { value: 'archived' } });
    expect(screen.getByText('Sunken Relic')).toBeInTheDocument();
    expect(screen.queryByText('Chronicles of the Deep')).not.toBeInTheDocument();
  });

  it('clicking a story card opens the quick-inspect StoryCardModal', async () => {
    render(<StoriesScreen />);
    const card = screen.getByText('Chronicles of the Deep');
    fireEvent.click(card);

    // Modal should be open
    expect(screen.getByRole('dialog', { name: /Chronicles of the Deep/i })).toBeInTheDocument();
    expect(screen.getByText(/What if humanity was not the first civilization/)).toBeInTheDocument();
  });
});

describe('StoryCardModal Component', () => {
  it('displays story preview and navigates to full story workspace on CTA click', () => {
    const onClose = vi.fn();
    render(<StoryCardModal story={sampleStory} onClose={onClose} />);

    expect(screen.getByText('Chronicles of the Deep')).toBeInTheDocument();
    expect(screen.getByText(sampleStory.premise)).toBeInTheDocument();
    expect(screen.getByText(sampleStory.synopsis)).toBeInTheDocument();

    const readBtn = screen.getByRole('button', { name: /Read Full Story/i });
    fireEvent.click(readBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/stories/story-alpha');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('StoryWorkspaceScreen Component', () => {
  it('renders hero banner, treatment, reference pack, color script, and toggles Book vs Creator modes', () => {
    render(<StoryWorkspaceScreen storyId="story-alpha" />);

    // Hero metadata
    expect(screen.getByText('Chronicles of the Deep')).toBeInTheDocument();
    expect(screen.getByText(/By Maya Lin/i)).toBeInTheDocument();
    expect(screen.getByText(/Rev 2/i)).toBeInTheDocument();

    // Collapsible treatment
    expect(screen.getByText(/Complete pitch treatment detailing the 3-act descent/i)).toBeInTheDocument();

    // Reference pack gallery
    expect(screen.getByText('Dr. Maya Lin')).toBeInTheDocument();
    expect(screen.getByText('Mariana Trench')).toBeInTheDocument();
    expect(screen.getByText('Pressure Dive Suit')).toBeInTheDocument();

    // Color script timeline
    expect(screen.getByText('Abyssal Zone')).toBeInTheDocument();
    expect(screen.getByText('Luminous Biome')).toBeInTheDocument();

    // Paired Storyboard Project link
    expect(screen.getByText(/Mariana Expedition Film/i)).toBeInTheDocument();

    // Book Mode is default or active
    expect(screen.getByText(/Chapter 1: The Descent Begins/i)).toBeInTheDocument();

    // Switch to Creator Mode
    const creatorModeTab = screen.getByRole('tab', { name: /Creator Mode/i });
    fireEvent.click(creatorModeTab);

    // Creator Mode tree
    expect(screen.getByText('Act I: The Descent')).toBeInTheDocument();
    expect(screen.getByText('Sequence 1: The Pressure Test')).toBeInTheDocument();
    expect(screen.getByText('Scene 1: Midnight Zone')).toBeInTheDocument();
    expect(screen.getByText('Depth Gauge Warning')).toBeInTheDocument();
  });
});

describe('StoryCreatorMode Component', () => {
  it('displays structural hierarchy with dramatic metadata notes', () => {
    const onUpdate = vi.fn();
    render(<StoryCreatorMode acts={sampleStory.acts} onUpdateActs={onUpdate} />);

    expect(screen.getByText('Act I: The Descent')).toBeInTheDocument();
    expect(screen.getByText(/Sonar anomaly detected at 10,000 meters/i)).toBeInTheDocument();
    expect(screen.getByText(/Maya hides her claustrophobia/i)).toBeInTheDocument();
    expect(screen.getByText(/Cracked gauge glass/i)).toBeInTheDocument();
  });
});

describe('AppShell Sidebar Navigation', () => {
  it('includes Stories primary navigation link with story count badge', () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const storiesNavBtn = screen.getByRole('button', { name: /^Stories/i });
    expect(storiesNavBtn).toBeInTheDocument();
    fireEvent.click(storiesNavBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/stories');
  });
});
