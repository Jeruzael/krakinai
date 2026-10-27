import React from 'react';
import { expect, it, vi } from 'vitest';
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MediaAsset } from '../types/domain';
import { MediaPreviewDialog } from '../components/MediaPreviewDialog';
import { ReferenceBoard } from '../components/ReferenceBoard';
const image = {
  id: 'image',
  filename: '景色-long-original.png',
  mimeType: 'image/png',
  blob: new Blob(['synthetic']),
  byteSize: 9,
} as MediaAsset;
const snapshot = {
  assets: [
    {
      id: 'asset',
      title: 'Camera motion',
      category: 'camera',
      promptText: 'Track left.',
      tags: [],
      coverMediaId: 'image',
      mediaLinks: [],
    },
  ],
  variants: [
    {
      id: 'variant',
      title: 'Camera variant',
      parentCharacterId: 'character',
      targetSlot: 'camera',
      promptText: 'Push in.',
      tags: [],
      coverMediaId: 'image',
      mediaLinks: [],
    },
  ],
  media: [image],
};
vi.mock('../context/LibraryContext', () => ({
  useLibrary: () => ({ snapshot }),
}));
import { AssetPickerModal } from '../components/SharedModals';

it('provides bounded fit-relative zoom, native size and reset without starting video playback', async () => {
  const user = userEvent.setup();
  render(<MediaPreviewDialog media={image} title="Image" onClose={() => {}} />);
  const img = await screen.findByRole('img');
  Object.defineProperties(img, {
    naturalWidth: { value: 320 },
    naturalHeight: { value: 180 },
  });
  fireEvent.load(img);
  expect(screen.getByRole('button', { name: 'Zoom Out' })).toBeDisabled();
  for (let i = 0; i < 6; i++)
    await user.click(screen.getByRole('button', { name: 'Zoom In' }));
  expect(screen.getByRole('button', { name: 'Zoom In' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('400%');
  await user.click(screen.getByRole('button', { name: 'Actual Size' }));
  expect(screen.getByRole('status')).toHaveTextContent('320 × 180');
  await user.click(screen.getByRole('button', { name: 'Reset Zoom' }));
  expect(screen.getByRole('status')).toHaveTextContent('100%');
  expect(screen.queryByText('Play/Pause')).not.toBeInTheDocument();
});
it('bounds gallery associations, preserves duplicate roles and restores the exact preview trigger', async () => {
  const user = userEvent.setup(),
    items = Array.from({ length: 50 }, (_, i) => ({
      key: 'association-' + i,
      mediaId: image.id,
      label: i % 2 ? 'Camera' : 'Character',
      sourceTitle: 'Source ' + i,
      role: 'reference',
    })),
    before = structuredClone(items);
  render(
    <ReferenceBoard
      items={items}
      mediaMap={new Map([[image.id, image]])}
      downloadable
    />
  );
  await user.click(screen.getByRole('button', { name: 'View All (50)' }));
  const gallery = screen.getByRole('dialog', { name: 'All references' });
  expect(within(gallery).getAllByRole('article')).toHaveLength(12);
  const preview = within(gallery).getByRole('button', {
    name: 'Preview Camera: Source 1',
  });
  await user.click(preview);
  expect(
    screen.getByRole('dialog', { name: 'Media: Source 1' })
  ).toBeInTheDocument();
  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Preview Camera: Source 1' })
    ).toHaveFocus()
  );
  await user.click(
    screen.getByRole('button', { name: 'Next references page' })
  );
  expect(
    screen.getByRole('button', { name: 'Preview Character: Source 12' })
  ).toBeInTheDocument();
  expect(items).toEqual(before);
  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'View All (50)' })).toHaveFocus()
  );
});
it('keeps asset/variant preview independent from selection and retains picker search/focus', async () => {
  const user = userEvent.setup(),
    asset = vi.fn(),
    variant = vi.fn();
  render(
    <AssetPickerModal
      slot="camera"
      mediaMap={new Map([[image.id, image]])}
      onSelectAsset={asset}
      onSelectVariant={variant}
      onClose={() => {}}
    />
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Search Camera & Movement' }),
    'motion'
  );
  await user.click(
    screen.getByRole('button', { name: 'Preview media: Camera motion' })
  );
  expect(asset).not.toHaveBeenCalled();
  expect(variant).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Preview media: Camera motion' })
    ).toHaveFocus()
  );
  expect(
    screen.getByRole('textbox', { name: 'Search Camera & Movement' })
  ).toHaveValue('motion');
  await user.click(screen.getByRole('button', { name: /^Select$/ }));
  expect(asset).toHaveBeenCalledWith(snapshot.assets[0]);
  await user.clear(
    screen.getByRole('textbox', { name: 'Search Camera & Movement' })
  );
  await user.click(screen.getByRole('button', { name: /Character Variants/ }));
  await user.click(
    screen.getByRole('button', { name: 'Preview media: Camera variant' })
  );
  expect(variant).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Select Variant' }));
  expect(variant).toHaveBeenCalledWith(snapshot.variants[0]);
});
