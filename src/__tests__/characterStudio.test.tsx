import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryProvider, useLibrary } from '../context/LibraryContext';
import { PromptDetailScreen } from '../screens/PromptDetailScreen';
import { VariantsScreen } from '../screens/VariantsScreen';
import {
  clearAllStoresForTesting,
  getAllSnapshot,
  initializeDatabase,
  saveMediaAsset,
  savePromptAsset,
  saveVariant,
} from '../storage/db';

const IDENTITY = [
  'Synthetic adult character.  Preserve this double space.',
  ...Array.from(
    { length: 24 },
    (_, index) =>
      `Identity reference line ${index + 1}: the source description remains verbatim.`
  ),
  'Last identity sentence: preserve the exact source, punctuation, and line breaks.',
].join('\n');
const LAYER = [
  'Wears an indigo jacket with a stitched collar.  Keep this double space.',
  ...Array.from(
    { length: 8 },
    (_, index) =>
      `Layer detail ${index + 1}: a user-entered clothing description.`
  ),
  'Last variant sentence: this is clothing only, with no identity replacement.',
].join('\n');

function FixtureRoute() {
  const { hashPath } = useLibrary();
  if (hashPath === '/prompts/studio-character') {
    return <PromptDetailScreen id="studio-character" kind="asset" />;
  }
  if (hashPath === '/variants/studio-outfit') {
    return <PromptDetailScreen id="studio-outfit" kind="variant" />;
  }
  return <VariantsScreen characterId="studio-character" />;
}

async function createFixture() {
  await initializeDatabase();
  const media = await saveMediaAsset({
    filename: 'synthetic-reference.svg',
    mimeType: 'image/svg+xml',
    blob: new Blob(
      ['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'],
      { type: 'image/svg+xml' }
    ),
  });
  const mediaLinks = [
    {
      mediaId: media.id,
      role: 'reference' as const,
      altText: 'Synthetic visual reference',
      order: 0,
    },
  ];
  await savePromptAsset({
    id: 'studio-character',
    title: 'Studio Character',
    category: 'characters',
    description: 'A synthetic identity for the studio layout.',
    promptText: IDENTITY,
    tags: ['synthetic'],
    mediaLinks,
  });
  await saveVariant({
    id: 'studio-outfit',
    parentCharacterId: 'studio-character',
    type: 'Outfit',
    title: 'Indigo Jacket',
    promptText: LAYER,
    compactText: 'Indigo jacket.',
    avoidText: 'No identity changes.',
    tags: ['jacket'],
    mediaLinks,
  });
}

describe('Character studio disclosure and source preservation', () => {
  beforeEach(async () => {
    await clearAllStoresForTesting();
    await createFixture();
  });

  it('keeps long character identity behind an explicit disclosure while Copy Prompt uses the complete source', async () => {
    const user = userEvent.setup();
    // jsdom FileReader cannot read the Node Blob used by the repository test setup.
    // Capture only the external clipboard boundary; screens and persistence stay real.
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);
    window.location.hash = '#/prompts/studio-character';
    render(
      <LibraryProvider>
        <FixtureRoute />
      </LibraryProvider>
    );

    await screen.findByRole('heading', { name: 'Studio Character' });
    const identity = screen.getByText(/Last identity sentence:/);
    expect(identity).not.toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Copy Prompt' }));
    expect(writeText).toHaveBeenLastCalledWith(IDENTITY);
    await user.click(screen.getByText('View full identity prompt'));
    expect(identity).toBeVisible();
    expect(identity.textContent).toBe(IDENTITY);
    await user.click(screen.getByText('View full identity prompt'));
    expect(identity).not.toBeVisible();
  });

  it('keeps the base identity and full variant text out of the visual grid until their dedicated details are opened', async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);
    window.location.hash = '#/characters/studio-character/variants';
    render(
      <LibraryProvider>
        <FixtureRoute />
      </LibraryProvider>
    );

    await screen.findByRole('heading', { name: 'Variants' });
    const identity = screen.getByText(/Last identity sentence:/);
    expect(identity).not.toBeVisible();
    await user.click(screen.getByText('View full base identity'));
    expect(identity).toBeVisible();
    expect(identity.textContent).toBe(IDENTITY);

    const card = screen.getByRole('article', { name: 'Indigo Jacket' });
    expect(within(card).getByText(/Wears an indigo jacket/)).toBeVisible();
    expect(
      within(card).queryByText(/Last variant sentence:/)
    ).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenLastCalledWith(LAYER);
    await user.click(within(card).getByRole('button', { name: 'Open Prompt' }));

    await screen.findByRole('heading', { name: 'Indigo Jacket' });
    expect(window.location.hash).toBe('#/variants/studio-outfit');
    const fullLayer = screen.getByText(/Last variant sentence:/);
    expect(fullLayer).not.toBeVisible();
    await user.click(screen.getByText('View full variant prompt'));
    expect(fullLayer).toBeVisible();
    expect(fullLayer.textContent).toBe(LAYER);
    expect(screen.getByText('Indigo jacket.')).toBeVisible();
    expect(screen.getByText('No identity changes.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Copy Prompt' }));
    expect(writeText).toHaveBeenLastCalledWith(LAYER);
  });

  it('applies a visual variant card with the unchanged full character identity and changed layer source', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/characters/studio-character/variants';
    render(
      <LibraryProvider>
        <FixtureRoute />
      </LibraryProvider>
    );

    const card = await screen.findByRole('article', { name: 'Indigo Jacket' });
    await user.click(
      within(card).getByRole('button', { name: 'Use in Scene' })
    );

    await waitFor(() => expect(window.location.hash).toMatch(/^#\/builder\//));
    const snapshot = await getAllSnapshot();
    expect(snapshot.drafts).toHaveLength(1);
    expect(snapshot.drafts[0].slots.character?.promptText).toBe(IDENTITY);
    expect(snapshot.drafts[0].slots.character?.sourceId).toBe(
      'studio-character'
    );
    expect(snapshot.drafts[0].slots.wardrobe?.promptText).toBe(LAYER);
    expect(snapshot.drafts[0].slots.wardrobe?.sourceId).toBe('studio-outfit');
    expect(snapshot.drafts[0].slots.wardrobe?.parentCharacterId).toBe(
      'studio-character'
    );
    expect(
      snapshot.assets.find((asset) => asset.id === 'studio-character')
        ?.promptText
    ).toBe(IDENTITY);
  });

  it('supports keyboard navigation between detail tabs without exposing the collapsed identity', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/prompts/studio-character';
    render(
      <LibraryProvider>
        <FixtureRoute />
      </LibraryProvider>
    );

    const promptTab = await screen.findByRole('tab', { name: 'Prompt' });
    promptTab.focus();
    await user.keyboard('{End}');
    const relatedTab = screen.getByRole('tab', { name: 'Related (0)' });
    expect(relatedTab).toHaveFocus();
    expect(relatedTab).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(promptTab).toHaveFocus();
    const promptPanel = screen.getByRole('tabpanel', { name: 'Prompt' });
    expect(promptTab).toHaveAttribute('aria-controls', promptPanel.id);
    expect(
      within(promptPanel).getByText(/Last identity sentence:/)
    ).not.toBeVisible();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Variants (1)' })).toHaveFocus();
  });

  it('keeps ordinary environment prompt text directly visible on its detail page', async () => {
    const environment = await savePromptAsset({
      title: 'Studio Environment',
      category: 'environments',
      promptText: 'A sunlit studio with an oak counter.',
      tags: [],
    });
    render(
      <LibraryProvider>
        <PromptDetailScreen id={environment.id} kind="asset" />
      </LibraryProvider>
    );
    expect(
      await screen.findByText('A sunlit studio with an oak counter.')
    ).toBeVisible();
  });
});
