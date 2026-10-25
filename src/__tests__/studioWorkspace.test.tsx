import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import {
  clearAllStoresForTesting,
  initializeDatabase,
  loadStarterLibrary,
  getAllSnapshot,
  saveSceneDraft,
} from '../storage/db';
import {
  createSnapshotFromAsset,
  ORDERED_BUILDER_SLOTS,
} from '../domain/promptAssembler';

const longIdentity =
  'Unique locked identity text that must stay out of compact recipe rows. '.repeat(
    30
  );
async function seedStudio() {
  await initializeDatabase();
  await loadStarterLibrary();
  const snap = await getAllSnapshot();
  const categories = [
    'characters',
    'wardrobe',
    'environments',
    'actions',
    'camera',
    'lighting',
    'styles',
  ];
  const slots = Object.fromEntries(
    ORDERED_BUILDER_SLOTS.map((slot, i) => [
      slot,
      createSnapshotFromAsset(
        snap.assets.find((a) => a.category === categories[i])!
      ),
    ])
  );
  slots.character.promptText = longIdentity;
  const draft = await saveSceneDraft({
    title: 'Studio keyboard scene',
    slots,
    extraRequiredSlots: [],
    sceneInstructions: '',
    settings: {},
    manualOutputs: {},
    resultMediaLinks: [],
    reviewNotes: '',
    reviewStatus: 'unreviewed',
  });
  window.location.hash = '#/builder/' + draft.id;
  return draft;
}

describe('Studio recipe workspace', () => {
  beforeEach(async () => {
    await clearAllStoresForTesting();
  });

  it('keeps all seven selections compact and reveals the complete locked identity on demand', async () => {
    await seedStudio();
    const user = userEvent.setup();
    render(<App />);
    const character = await screen.findByRole('button', {
      name: /^Open Character details:/,
    });
    expect(screen.queryByText(longIdentity.trim())).not.toBeInTheDocument();
    expect(screen.getAllByTestId('recipe-row')).toHaveLength(7);
    await user.click(character);
    const dialog = screen.getByRole('dialog', { name: 'Character details' });
    expect(within(dialog).getByText(longIdentity.trim())).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Identity text locked/)
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByLabelText(/Scene-Only Text Override/)
    ).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(character).toHaveFocus();
  });

  it('keeps scene-only edits in the selected snapshot without changing its library source', async () => {
    const draft = await seedStudio();
    const sourceId = draft.slots.wardrobe!.sourceId;
    const before = (await getAllSnapshot()).assets.find(
      (a) => a.id === sourceId
    )!.promptText;
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole('button', { name: /^Open Clothing details:/ })
    );
    const dialog = screen.getByRole('dialog', { name: 'Clothing details' });
    const override = within(dialog).getByLabelText(/Scene-Only Text Override/);
    await user.clear(override);
    await user.type(override, 'A scene-only emerald jacket.');
    await user.click(
      within(dialog).getByRole('button', { name: 'Apply Scene Override' })
    );
    await waitFor(async () => {
      const after = await getAllSnapshot();
      expect(
        after.drafts.find((d) => d.id === draft.id)?.slots.wardrobe
          ?.overrideText
      ).toBe('A scene-only emerald jacket.');
      expect(after.assets.find((a) => a.id === sourceId)?.promptText).toBe(
        before
      );
    });
  });

  it('collapses the desktop sidebar while preserving accessible route actions', async () => {
    window.location.hash = '#/';
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Your reusable video creation toolkit.');
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });
    await user.click(toggle);
    expect(
      screen.getByRole('button', { name: 'Expand sidebar' })
    ).toHaveAttribute('aria-expanded', 'false');
    await user.click(
      within(
        screen.getByRole('complementary', {
          name: 'Primary Sidebar Navigation',
        })
      ).getByRole('button', { name: /^Scene Builder$/ })
    );
    expect(
      await screen.findByRole('heading', { name: 'Scene Builder' })
    ).toBeInTheDocument();
  });
});
