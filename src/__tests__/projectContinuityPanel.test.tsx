import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Collection, MediaAsset, ProjectShot, SavedScene } from '../types/domain';
import { ProjectContinuityPanel } from '../components/ProjectContinuityPanel';
import * as continuity from '../storage/projectContinuity';

const { library } = vi.hoisted(() => ({ library: { snapshot: null as unknown } }));
vi.mock('../context/LibraryContext', () => ({ useLibrary: () => library }));
vi.mock('../storage/projectContinuity', () => ({ updateWardrobeIntent: vi.fn(), updateProjectFrames: vi.fn(), uploadProjectFrame: vi.fn(), upsertProjectTransition: vi.fn(), removeProjectTransition: vi.fn() }));

const shot = (id: string, order: number, extra: Partial<ProjectShot> = {}): ProjectShot => ({ id, order, code: id.toUpperCase(), title: `Shot ${id}`, takeSceneIds: [`scene-${id}`], selectedSceneId: `scene-${id}`, status: 'reviewed', ...extra });
const scene = (id: string, wardrobeId?: string): SavedScene => ({ id: `scene-${id}`, title: `Scene ${id}`, slots: { character: { slot: 'character', sourceType: 'asset', sourceId: 'aya', sourceRevision: 1, sourceTitle: 'Aya', promptText: 'Aya identity', mediaLinks: [] }, ...(wardrobeId ? { wardrobe: { slot: 'wardrobe' as const, sourceType: 'variant' as const, sourceId: wardrobeId, sourceRevision: 1, sourceTitle: wardrobeId, promptText: `Clothes ${wardrobeId}`, mediaLinks: [] } } : {}) }, extraRequiredSlots: [], sceneInstructions: '', settings: {}, outputs: { full: '', structured: '', compact: '' }, manualOutputs: {}, references: [], resultMediaLinks: [], reviewNotes: '', reviewStatus: 'unreviewed', revision: 1, createdAt: '', updatedAt: '' });
const image = (id: string): MediaAsset => ({ id, filename: `${id}.png`, safeFilename: `${id}.png`, mimeType: 'image/png', byteSize: 2, blob: new Blob(['ok'], { type: 'image/png' }), createdAt: '' });
const base = (shots = [shot('a', 0), shot('b', 1)]): Collection => ({ id: 'project', name: 'Film', description: '', members: [], createdAt: '', updatedAt: '', project: { version: 1, revision: 7, shots } });
function setup(collection = base(), media: MediaAsset[] = []) {
  library.snapshot = { scenes: [scene('a', 'coat'), scene('b', 'dress'), scene('c')], media };
  const onChanged = vi.fn().mockResolvedValue(undefined);
  render(<ProjectContinuityPanel collection={collection} onChanged={onChanged} />);
  return onChanged;
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('keeps full wardrobe text collapsed and uses dedicated stacked form fields without changing records', () => {
  const collection = base();
  const original = structuredClone(collection);
  setup(collection);
  const description = screen.getByText('Clothes coat');
  expect(description).not.toBeVisible();
  fireEvent.click(description.closest('details')!.querySelector('summary')!);
  expect(description).toBeVisible();
  fireEvent.click(screen.getAllByRole('button', { name: 'Review wardrobe' })[0]);
  const dialog = screen.getByRole('dialog');
  expect(screen.getByRole('combobox', { name: 'Intentional change reason' }).closest('.pc-form-field')).toBeTruthy();
  expect(screen.getByRole('textbox', { name: 'Continuity notes' }).closest('.pc-form-field')).toBeTruthy();
  expect(dialog.querySelector('.pc-form')).toBeTruthy();
  expect(collection).toEqual(original);
});

it('shows advisory clothing changes and unknown wardrobe, and saves intentional reason with only changed notes', async () => {
  vi.mocked(continuity.updateWardrobeIntent).mockResolvedValue(base());
  const collection = base([shot('a', 0), shot('b', 1, { continuityNotes: 'Keep scarf' }), shot('c', 2)]);
  const original = structuredClone(collection);
  setup(collection);
  expect(screen.getByText('Clothing changed from previous appearance')).toBeInTheDocument();
  expect(screen.getByText('Wardrobe unknown')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'Review wardrobe' })[1]);
  fireEvent.change(screen.getByRole('combobox', { name: 'Intentional change reason' }), { target: { value: 'costume_change' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save review' }));
  await waitFor(() => expect(continuity.updateWardrobeIntent).toHaveBeenCalledWith({ collectionId: 'project', shotId: 'b', reason: 'costume_change', notes: undefined }));
  expect(collection).toEqual(original);
});

it('selects, uploads, and clears the correct first or last frame ID', async () => {
  const media = image('existing');
  const onChanged = setup(base([shot('a', 0), shot('b', 1, { lastFrameMediaId: 'missing' })]), [media]);
  vi.mocked(continuity.updateProjectFrames).mockResolvedValue(base());
  vi.mocked(continuity.uploadProjectFrame).mockResolvedValue(base());
  expect(screen.getByText('Missing image (missing)')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'Choose image' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Use existing.png as first frame' }));
  await waitFor(() => expect(continuity.updateProjectFrames).toHaveBeenCalledWith({ collectionId: 'project', shotId: 'a', firstFrameMediaId: 'existing' }));
  expect(onChanged).toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole('button', { name: 'Choose image' })[1]);
  const file = new File(['abc'], 'new.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Upload image'), { target: { files: [file] } });
  await waitFor(() => expect(continuity.uploadProjectFrame).toHaveBeenCalledWith({ collectionId: 'project', shotId: 'a', side: 'lastFrameMediaId', file }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  await waitFor(() => expect(continuity.updateProjectFrames).toHaveBeenCalledWith({ collectionId: 'project', shotId: 'b', lastFrameMediaId: null }));
});

it('reuses exact-pair transition ID and revision, then confirms removal', async () => {
  const transition = { id: 'edge-1', fromShotId: 'a', toShotId: 'b', type: 'match_cut' as const, description: 'Match shape', notes: 'Keep timing' };
  const collection = base(); collection.project!.transitions = [transition];
  setup(collection);
  expect(screen.getByText(/Match shape/)).not.toBeVisible();
  fireEvent.click(screen.getByText(/Match shape/).closest('details')!.querySelector('summary')!);
  expect(screen.getByText(/Match shape/)).toBeVisible();
  vi.mocked(continuity.upsertProjectTransition).mockResolvedValue(collection);
  vi.mocked(continuity.removeProjectTransition).mockResolvedValue(collection);
  fireEvent.click(screen.getByRole('button', { name: 'Edit transition' }));
  expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('Keep timing');
  fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), { target: { value: 'Exact edit' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save transition' }));
  await waitFor(() => expect(continuity.upsertProjectTransition).toHaveBeenCalledWith({ collectionId: 'project', expectedRevision: 7, transition: { ...transition, description: 'Exact edit' } }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove transition' }));
  expect(continuity.removeProjectTransition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove transition' }));
  await waitFor(() => expect(continuity.removeProjectTransition).toHaveBeenCalledWith({ collectionId: 'project', transitionId: 'edge-1' }));
});

it('keeps detached pair metadata visible after reorder and restores focus on Escape', async () => {
  const collection = base([shot('b', 0), shot('a', 1), shot('c', 2)]);
  collection.project!.transitions = [{ id: 'edge-1', fromShotId: 'a', toShotId: 'b', type: 'straight_cut', description: 'Old pair', notes: 'Do not retarget' }];
  setup(collection);
  expect(screen.getByText('Transitions to review after reorder')).toBeInTheDocument();
  expect(screen.getByText(/Old pair/)).toBeInTheDocument();
  const open = screen.getAllByRole('button', { name: 'Add transition' })[0];
  open.focus();
  await userEvent.setup().click(open);
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  await userEvent.setup().keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(open).toHaveFocus();
});

it('swaps one original preview dialog and retains transition draft text', async () => {
  const collection = base([shot('a', 0, { lastFrameMediaId: 'existing' }), shot('b', 1, { firstFrameMediaId: 'existing' })]);
  setup(collection, [image('existing')]);
  fireEvent.click(screen.getByRole('button', { name: 'Add transition' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), { target: { value: 'Preserved draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enlarge A Shot a last frame' }));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog', { name: /Media: A Shot a last frame/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Close Media: A Shot a last frame/ }));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Preserved draft');
});
