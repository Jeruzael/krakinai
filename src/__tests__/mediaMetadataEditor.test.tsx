import React from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaMetadataEditor } from '../components/MediaMetadataEditor';
import {
  clearAllStoresForTesting,
  getAllSnapshot,
  saveMediaAsset,
} from '../storage/db';
beforeEach(clearAllStoresForTesting);
afterEach(cleanup);
it('starts names collapsed and keeps original bytes, ID and filename when explicit names are saved', async () => {
  const user = userEvent.setup(),
    media = await saveMediaAsset({
      filename: 'original.png',
      mimeType: 'image/png',
      blob: new Blob(['original bytes'], { type: 'image/png' }),
    }),
    onSaved = vi.fn();
  render(<MediaMetadataEditor media={media} onSaved={onSaved} />);
  expect(screen.getByLabelText('Display Name')).not.toBeVisible();
  await user.click(screen.getByText('Rename / Details'));
  expect(screen.getByLabelText('Original Filename')).toHaveAttribute(
    'readonly'
  );
  await user.clear(screen.getByLabelText('Display Name'));
  await user.type(screen.getByLabelText('Display Name'), 'Ari portrait');
  await user.type(
    screen.getByLabelText('Export Filename (optional)'),
    'ari.png'
  );
  await user.click(screen.getByRole('button', { name: 'Save Media Names' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  const saved = (await getAllSnapshot()).media[0];
  expect(saved).toMatchObject({
    id: media.id,
    filename: 'original.png',
    displayName: 'Ari portrait',
    exportFilename: 'ari.png',
    createdAt: media.createdAt,
  });
  expect(await saved.blob.text()).toBe('original bytes');
});
