import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { EditorScreen } from '../screens/EditorScreen';
import {
  clearAllStoresForTesting,
  getAllSnapshot,
  initializeDatabase,
  saveMediaAsset,
  savePromptAsset,
  saveVariant,
} from '../storage/db';
import type { LibrarySnapshot } from '../storage/db';
const { library } = vi.hoisted(() => ({
  library: {
    snapshot: null as LibrarySnapshot | null,
    navigate: vi.fn(),
    setDirtyFormGuard: vi.fn(),
    refreshSnapshot: vi.fn(),
    showToast: vi.fn(),
  },
}));
vi.mock('../context/LibraryContext', () => ({ useLibrary: () => library }));
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
  vi.clearAllMocks();
});
afterEach(cleanup);
async function setup(variant = false) {
  const media = await saveMediaAsset({
    filename: 'old.png',
    mimeType: 'image/png',
    blob: new Blob(['old'], { type: 'image/png' }),
  });
  const asset = await savePromptAsset({
    title: 'Original master',
    category: 'characters',
    promptText: 'Original master identity.',
    tags: [],
    mediaLinks: [
      {
        mediaId: media.id,
        role: 'sample',
        altText: 'Original description',
        order: 0,
      },
    ],
    coverMediaId: media.id,
  });
  const record = variant
    ? await saveVariant({
        parentCharacterId: asset.id,
        type: 'Outfit',
        title: 'Jacket',
        promptText: 'Navy jacket.',
        tags: [],
        mediaLinks: asset.mediaLinks,
        coverMediaId: media.id,
      })
    : asset;
  library.snapshot = await getAllSnapshot();
  const element = (
    <EditorScreen
      mode={variant ? 'edit-variant' : 'edit-asset'}
      targetId={record.id}
    />
  );
  const view = render(element);
  library.refreshSnapshot.mockImplementation(async () => {
    library.snapshot = await getAllSnapshot();
    view.rerender(element);
  });
  return { media, asset, record };
}
const drop = (files: File[]) =>
  fireEvent.drop(screen.getByRole('region', { name: 'Upload media' }), {
    dataTransfer: { types: ['Files'], files },
  });
it('shares validation between drop/button, rejects invalid media per file and skips duplicate bytes', async () => {
  const { media } = await setup();
  const file = new File(['new image'], 'new.png', { type: 'image/png' });
  drop([
    file,
    new File(['x'], 'bad.exe', { type: 'application/octet-stream' }),
  ]);
  await waitFor(() =>
    expect(
      screen.getAllByRole('button', { name: /Move sample .* up/ })
    ).toHaveLength(2)
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /Choose Image or Video Files/ })
    ).toBeEnabled()
  );
  expect(screen.getByRole('alert')).toHaveTextContent('bad.exe');
  drop([new File(['new image'], 'renamed.png', { type: 'image/png' })]);
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(/already attached/i)
  );
  expect((await getAllSnapshot()).media).toHaveLength(2);
  expect(screen.getAllByLabelText('Media role')[0]).toHaveValue('sample');
  expect(
    screen.getByRole('button', { name: 'Cover Image' })
  ).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'Save Prompt' })[0]);
  await waitFor(() => expect(library.navigate).toHaveBeenCalled());
  const saved = (await getAllSnapshot()).assets[0];
  expect(saved.coverMediaId).toBe(media.id);
  expect(saved.promptText).toBe('Original master identity.');
});
it('keeps the six attachment limit and prevents overlapping duplicate uploads', async () => {
  await setup();
  drop(
    Array.from(
      { length: 7 },
      (_, i) => new File([String(i)], `new-${i}.png`, { type: 'image/png' })
    )
  );
  drop([new File(['0'], 'new-0.png', { type: 'image/png' })]);
  await waitFor(() =>
    expect(
      screen.getAllByRole('button', { name: /Move sample .* up/ })
    ).toHaveLength(6)
  );
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(/new-5.png/)
  );
  expect((await getAllSnapshot()).media).toHaveLength(6);
});
it('reorders only on the separate handle, persists variant order and preserves the cover', async () => {
  const { media, record } = await setup(true);
  drop([new File(['new'], 'new.png', { type: 'image/png' })]);
  await waitFor(() =>
    expect(
      screen.getAllByRole('button', { name: /Move sample .* up/ })
    ).toHaveLength(2)
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /Choose Image or Video Files/ })
    ).toBeEnabled()
  );
  const data = new Map<string, string>(),
    transfer = {
      types: ['application/x-krakinai-media-order'],
      setData: (key: string, value: string) => data.set(key, value),
      getData: (key: string) => data.get(key) ?? '',
      effectAllowed: '',
      dropEffect: '',
    };
  fireEvent.dragStart(
    screen.getByRole('button', { name: 'Drag sample 2 to reorder' }),
    { dataTransfer: transfer }
  );
  fireEvent.drop(
    screen.getAllByRole('article', { name: /Attached media/ })[0],
    { dataTransfer: transfer }
  );
  fireEvent.click(screen.getAllByRole('button', { name: 'Save Variant' })[0]);
  await waitFor(() => expect(library.navigate).toHaveBeenCalled());
  const saved = (await getAllSnapshot()).variants.find(
    (item) => item.id === record.id
  )!;
  expect(saved.mediaLinks.map((item) => item.order)).toEqual([0, 1]);
  expect(saved.mediaLinks[1].mediaId).toBe(media.id);
  expect(saved.coverMediaId).toBe(media.id);
});
