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

    // Asserts cover elements are rendered for story cards
    const covers = screen.getAllByTestId('story-card-cover');
    expect(covers.length).toBeGreaterThan(0);

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

  it('clicking "New Story" persists an initial story record and navigates to its workspace', async () => {
    const { saveStory } = await import('../storage/stories');
    render(<StoriesScreen />);
    const newBtn = screen.getByRole('button', { name: /New Story/i });
    fireEvent.click(newBtn);

    await waitFor(() => {
      expect(saveStory).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/stories\/story_/));
    });
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

  it('provides an explicit Edit button that routes directly to story workspace', () => {
    const onClose = vi.fn();
    render(<StoryCardModal story={sampleStory} onClose={onClose} />);

    const editBtn = screen.getByRole('button', { name: /Edit Story/i });
    fireEvent.click(editBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/stories/story-alpha');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('StoryWorkspaceScreen Component', () => {
  it('renders hero banner, treatment, reference pack, color script, and toggles Book vs Creator modes', async () => {
    render(<StoryWorkspaceScreen storyId="story-alpha" />);

    // Wait for async load to finish
    await waitFor(() => {
      expect(screen.getByText('Chronicles of the Deep')).toBeInTheDocument();
    });

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
    await waitFor(() => {
      expect(screen.getByText('Act I: The Descent')).toBeInTheDocument();
    });
    expect(screen.getByText('Sequence 1: The Pressure Test')).toBeInTheDocument();
    expect(screen.getByText('Scene 1: Midnight Zone')).toBeInTheDocument();
    expect(screen.getByText('Depth Gauge Warning')).toBeInTheDocument();
  });

  it('allows authoring linear prose in Book Mode via Edit Manuscript toggle', async () => {
    const { saveStory } = await import('../storage/stories');
    render(<StoryWorkspaceScreen storyId="story-alpha" />);

    await waitFor(() => {
      expect(screen.getByText(/Chapter 1: The Descent Begins/i)).toBeInTheDocument();
    });

    // Toggle edit mode
    const editBtn = screen.getByRole('button', { name: /Edit Manuscript/i });
    fireEvent.click(editBtn);

    const textarea = screen.getByPlaceholderText(/Write or paste full-length manuscript/i);
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'Updated Chapter 1 text with new revelations.' } });

    const saveBtn = screen.getByRole('button', { name: /Save Manuscript/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(saveStory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'story-alpha',
          fullBookText: 'Updated Chapter 1 text with new revelations.',
        })
      );
    });
  });

  it('provides cover, hero banner, reference pack, and color script management controls', async () => {
    render(<StoryWorkspaceScreen storyId="story-alpha" />);

    await waitFor(() => {
      expect(screen.getByText('Chronicles of the Deep')).toBeInTheDocument();
    });

    // Cover & Hero Banner management buttons
    expect(screen.getByRole('button', { name: /Change Cover/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Change Hero Banner/i })).toBeInTheDocument();

    // Manage References button
    expect(screen.getByRole('button', { name: /Manage References/i })).toBeInTheDocument();

    // Add Color Beat button
    expect(screen.getByRole('button', { name: /Add Color Beat/i })).toBeInTheDocument();
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

  it('provides structural authoring controls (Add Act, Add Sequence, Add Scene, Add Beat, Edit, Delete)', () => {
    const onUpdate = vi.fn();
    render(<StoryCreatorMode acts={sampleStory.acts} onUpdateActs={onUpdate} />);

    // Add Act button in header
    const addActBtn = screen.getByRole('button', { name: /Add Act/i });
    expect(addActBtn).toBeInTheDocument();

    // Add Sequence button inside Act
    expect(screen.getByRole('button', { name: /Add Sequence/i })).toBeInTheDocument();

    // Add Scene button inside Sequence
    expect(screen.getByRole('button', { name: /Add Scene/i })).toBeInTheDocument();

    // Add Beat button inside Scene
    expect(screen.getByRole('button', { name: /Add Beat/i })).toBeInTheDocument();

    // Edit and Delete buttons
    expect(screen.getAllByRole('button', { name: /^Edit Act/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Delete Act/i }).length).toBeGreaterThan(0);
  });

  it('triggers onUpdateActs when adding and editing an act in Creator Mode', () => {
    const onUpdate = vi.fn();
    render(<StoryCreatorMode acts={sampleStory.acts} onUpdateActs={onUpdate} />);

    // Click Add Act
    const addActBtn = screen.getByRole('button', { name: /Add Act/i });
    fireEvent.click(addActBtn);

    // Dialog is open
    expect(screen.getByRole('dialog', { name: /Add ACT/i })).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText(/Enter act title/i);
    fireEvent.change(titleInput, { target: { value: 'Act II: The Ancient Core' } });

    const saveBtn = screen.getByRole('button', { name: /Save ACT/i });
    fireEvent.click(saveBtn);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Act II: The Ancient Core' }),
      ])
    );
  });

  it('triggers onUpdateActs when deleting an act in Creator Mode', () => {
    const onUpdate = vi.fn();
    render(<StoryCreatorMode acts={sampleStory.acts} onUpdateActs={onUpdate} />);

    const deleteBtn = screen.getAllByRole('button', { name: /^Delete Act/i })[0];
    fireEvent.click(deleteBtn);

    expect(onUpdate).toHaveBeenCalledWith([]);
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
