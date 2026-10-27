import React from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectCastPanel } from '../components/ProjectCastPanel';
import { clearAllStoresForTesting, createCollection, deleteVariant, getAllSnapshot, savePromptAsset, saveVariant } from '../storage/db';
import { upsertProjectCast } from '../storage/projectContinuity';

const { library } = vi.hoisted(() => ({ library: { snapshot: null as unknown, navigate: vi.fn(), showToast: vi.fn() } }));
vi.mock('../context/LibraryContext', () => ({ useLibrary: () => library }));
beforeEach(clearAllStoresForTesting);
afterEach(cleanup);

it('saves Bible metadata through the repository while preserving the master asset', async () => {
  const master = await savePromptAsset({ title: 'Aya', category: 'characters', promptText: 'Original full identity', tags: [] });
  const collection = await createCollection({ name: 'Film' });
  library.snapshot = await getAllSnapshot();
  const onChanged = vi.fn().mockResolvedValue(undefined);
  const { rerender } = render(<ProjectCastPanel collection={collection} onChanged={onChanged} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Add existing character' }), { target: { value: master.id } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to cast' }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
  const updated = (await getAllSnapshot()).collections.find(item => item.id === collection.id)!;
  library.snapshot = await getAllSnapshot();
  rerender(<ProjectCastPanel collection={updated} onChanged={onChanged} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Bible for Aya' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Personality' }), { target: { value: 'Careful listener' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Bible' }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2));
  const snapshot = await getAllSnapshot();
  expect(snapshot.collections.find(item => item.id === collection.id)?.project?.cast?.[0].personality).toBe('Careful listener');
  expect(snapshot.assets.find(item => item.id === master.id)).toEqual(master);
});

it('rejects stale Add to cast without erasing Bible notes written in another tab', async () => {
  const master = await savePromptAsset({ title: 'Aya', category: 'characters', promptText: 'Original identity', tags: [] });
  const staleCollection = await createCollection({ name: 'Film' });
  library.snapshot = await getAllSnapshot();
  render(<ProjectCastPanel collection={staleCollection} onChanged={vi.fn().mockResolvedValue(undefined)} />);
  await upsertProjectCast({ collectionId: staleCollection.id, entry: { characterId: master.id, notes: 'Other tab note' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Add existing character' }), { target: { value: master.id } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to cast' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Project revision conflict'));
  const latest = await getAllSnapshot();
  expect(latest.collections.find(item => item.id === staleCollection.id)?.project?.cast?.[0].notes).toBe('Other tab note');
  expect(latest.assets.find(item => item.id === master.id)).toEqual(master);
});

it('lets a user remove a deleted wardrobe choice and save other Bible text', async () => {
  const master = await savePromptAsset({ title: 'Aya', category: 'characters', promptText: 'Original identity', tags: [] });
  const wardrobe = await saveVariant({ title: 'Blue coat', parentCharacterId: master.id, type: 'Outfit', promptText: 'Blue coat', tags: [] });
  const collection = await createCollection({ name: 'Film' });
  const withCast = await upsertProjectCast({ collectionId: collection.id, entry: { characterId: master.id, notes: 'Keep this', approvedWardrobeVariantIds: [wardrobe.id] } });
  await deleteVariant(wardrobe.id);
  library.snapshot = await getAllSnapshot();
  const onChanged = vi.fn().mockResolvedValue(undefined);
  render(<ProjectCastPanel collection={withCast} onChanged={onChanged} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Bible for Aya' }));
  const unavailable = screen.getByRole('checkbox', { name: new RegExp(`Unavailable wardrobe variant \\(${wardrobe.id}\\)`) });
  expect(unavailable).toBeChecked();
  fireEvent.click(unavailable);
  fireEvent.change(screen.getByRole('textbox', { name: 'Story role' }), { target: { value: 'Lead' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Bible' }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
  const latest = await getAllSnapshot();
  expect(latest.collections.find(item => item.id === collection.id)?.project?.cast?.[0]).toMatchObject({ notes: 'Keep this', storyRole: 'Lead', approvedWardrobeVariantIds: [] });
  expect(latest.assets.find(item => item.id === master.id)).toEqual(master);
});
