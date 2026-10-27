import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaDropZone } from '../components/MediaDropZone';
afterEach(cleanup);
it.each([
  ['photo.jpg', 'image/jpeg'],
  ['photo.png', 'image/png'],
  ['photo.webp', 'image/webp'],
  ['clip.mp4', 'video/mp4'],
  ['clip.webm', 'video/webm'],
])('delivers supported external file type %s to validation', (name, type) => {
  const onFiles = vi.fn(),
    file = new File(['synthetic MIME delivery fixture'], name, { type });
  render(<MediaDropZone onFiles={onFiles} count={0} />);
  fireEvent.drop(screen.getByRole('region', { name: 'Upload media' }), {
    dataTransfer: { types: ['Files'], files: [file] },
  });
  expect(onFiles).toHaveBeenCalledWith([file]);
});
it('delivers external files through drop and the keyboard-accessible file button', async () => {
  const onFiles = vi.fn(),
    user = userEvent.setup();
  render(<MediaDropZone onFiles={onFiles} count={0} />);
  const file = new File(['image'], 'portrait.png', { type: 'image/png' }),
    zone = screen.getByRole('region', { name: 'Upload media' });
  fireEvent.dragEnter(zone, {
    dataTransfer: {
      types: ['Files'],
      items: [{ kind: 'file', type: 'image/png' }],
    },
  });
  expect(zone).toHaveAttribute('data-drag-active', 'true');
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { types: ['Files'], files: [file] },
  });
  fireEvent(zone, event);
  expect(event.defaultPrevented).toBe(true);
  expect(onFiles).toHaveBeenCalledWith([file]);
  expect(zone).toHaveAttribute('data-drag-active', 'false');
  await user.upload(screen.getByLabelText(/Choose Image or Video Files/), file);
  expect(onFiles).toHaveBeenCalledTimes(2);
  expect(
    screen.getByRole('button', { name: /Choose Image or Video Files/ })
  ).toBeEnabled();
});
it('blocks file navigation outside the zone while mounted and ignores internal reorder drags', () => {
  const onFiles = vi.fn();
  const view = render(<MediaDropZone onFiles={onFiles} count={0} />);
  const fileDrop = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(fileDrop, 'dataTransfer', {
    value: { types: ['Files'], files: [] },
  });
  document.body.dispatchEvent(fileDrop);
  expect(fileDrop.defaultPrevented).toBe(true);
  fireEvent.drop(screen.getByRole('region', { name: 'Upload media' }), {
    dataTransfer: { types: ['application/x-krakinai-media-order'], files: [] },
  });
  expect(onFiles).not.toHaveBeenCalled();
  view.unmount();
  const after = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(after, 'dataTransfer', { value: { types: ['Files'] } });
  document.body.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
});
it('does not highlight unsupported files and disables delivery while uploading', () => {
  const onFiles = vi.fn();
  render(<MediaDropZone onFiles={onFiles} count={6} busy />);
  const zone = screen.getByRole('region', { name: 'Upload media' });
  fireEvent.dragEnter(zone, {
    dataTransfer: {
      types: ['Files'],
      items: [{ kind: 'file', type: 'application/zip' }],
    },
  });
  expect(zone).toHaveAttribute('data-drag-active', 'false');
  fireEvent.drop(zone, {
    dataTransfer: {
      types: ['Files'],
      files: [new File(['x'], 'test.png', { type: 'image/png' })],
    },
  });
  expect(onFiles).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: /Choose Image or Video Files/ })
  ).toBeDisabled();
});
