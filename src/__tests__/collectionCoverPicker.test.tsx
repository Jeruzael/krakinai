import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollectionCoverPicker } from '../components/CollectionCoverPicker';
import { saveMediaAsset } from '../storage/db';
import type { MediaAsset } from '../types/domain';
vi.mock('../storage/db', () => ({ saveMediaAsset: vi.fn() }));
const image = (id: string, extra: Partial<MediaAsset> = {}): MediaAsset => ({
  id,
  filename: `${id}.png`,
  safeFilename: `${id}.png`,
  mimeType: 'image/png',
  blob: new Blob(['synthetic']),
  byteSize: 9,
  createdAt: '',
  ...extra,
});
const media = [
  image('project', { displayName: 'Project sunset' }),
  image('unrelated', {
    filename: '景色-'.repeat(80) + '.png',
    displayName: 'Unrelated illustration',
  }),
  image('cover'),
];
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
function setup(overrides: Record<string, unknown> = {}) {
  const select = vi.fn(),
    close = vi.fn(),
    uploaded = vi.fn().mockResolvedValue(undefined);
  render(
    <CollectionCoverPicker
      media={media}
      currentId="cover"
      onSelect={select}
      onClose={close}
      onUploaded={uploaded}
      {...{
        projectMediaIds: ['project'],
        coverMediaIds: ['cover'],
        ...overrides,
      }}
    />
  );
  return { select, close, uploaded };
}
it('starts with relationship-filtered Project Media, searches all images and exposes full Unicode filename information', () => {
  setup();
  expect(screen.getByRole('tab', { name: /Project Media/ })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  expect(
    screen.getByRole('button', { name: 'Use Project sunset as cover' })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', {
      name: 'Use Unrelated illustration as cover',
    })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: /All Images/ }));
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search cover images' }),
    { target: { value: '景色' } }
  );
  const card = screen.getByRole('button', {
    name: 'Use Unrelated illustration as cover',
  });
  expect(card).toHaveAccessibleDescription(
    expect.stringContaining(media[1].filename)
  );
  expect(
    screen.queryByRole('button', { name: 'Use Project sunset as cover' })
  ).not.toBeInTheDocument();
});
it('stages choices locally, leaves selection alone on cancel and applies only on Use Cover', () => {
  const { select, close } = setup();
  fireEvent.click(
    screen.getByRole('button', { name: 'Use Project sunset as cover' })
  );
  expect(select).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Use Project sunset as cover' })
  ).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Use Cover' }));
  expect(select).toHaveBeenCalledWith('project');
});
it('bounds rendering to 24 images per page and retains all unrelated images through pagination', () => {
  setup({
    media: Array.from({ length: 61 }, (_, i) => image(`image-${i}`)),
    projectMediaIds: [],
  });
  fireEvent.click(screen.getByRole('tab', { name: /All Images/ }));
  const gallery = screen.getByRole('list', { name: 'Cover images' });
  expect(within(gallery).getAllByRole('button')).toHaveLength(24);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(within(gallery).getAllByRole('button')).toHaveLength(24);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(within(gallery).getAllByRole('button')).toHaveLength(13);
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
});
it('keeps a missing cover explicit, supports removal and keeps uploaded media staged rather than applying it', async () => {
  const { select, uploaded } = setup({ currentId: 'missing' });
  expect(screen.getByRole('status')).toHaveTextContent(
    'Current cover is missing'
  );
  expect(screen.getByRole('button', { name: 'Use Cover' })).toBeDisabled();
  vi.mocked(saveMediaAsset).mockResolvedValue(image('new-cover'));
  const file = new File(['synthetic'], 'new-cover.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Upload new cover image'), {
    target: { files: [file] },
  });
  await waitFor(() => expect(uploaded).toHaveBeenCalled());
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Use new-cover.png as cover' })
    ).toHaveAttribute('aria-pressed', 'true')
  );
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Cover' }));
  expect(select).toHaveBeenCalledWith(null);
});
it('restores focus on Escape and supports tab arrow navigation', async () => {
  const user = userEvent.setup();
  let visible = true;
  const close = vi.fn(() => {
    visible = false;
    view.rerender(<button>Open picker</button>);
  });
  const view = render(<button>Open picker</button>);
  const trigger = screen.getByRole('button');
  trigger.focus();
  view.rerender(
    <>
      <button>Open picker</button>
      <CollectionCoverPicker
        media={media}
        onSelect={() => {}}
        onClose={close}
        onUploaded={async () => {}}
      />
    </>
  );
  const tab = screen.getByRole('tab', { name: /Project Media/ });
  tab.focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: /All Images/ })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(visible).toBe(false);
  expect(screen.getByRole('button', { name: 'Open picker' })).toHaveFocus();
});

it.each([
  { name: 'bad.txt', type: 'text/plain', size: 3 },
  { name: 'large.png', type: 'image/png', size: 10 * 1024 * 1024 + 1 },
  { name: 'empty.png', type: 'image/png', size: 0 },
])(
  'rejects unsupported, oversize or empty uploads without changing selection: $name',
  (file) => {
    const { select } = setup();
    fireEvent.change(screen.getByLabelText('Upload new cover image'), {
      target: { files: [file] },
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(saveMediaAsset).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  }
);

it('reports failed upload and restores actions without applying another cover', async () => {
  const { select } = setup();
  vi.mocked(saveMediaAsset).mockRejectedValueOnce(
    new Error('Synthetic quota failure')
  );
  fireEvent.change(screen.getByLabelText('Upload new cover image'), {
    target: {
      files: [new File(['synthetic'], 'valid.png', { type: 'image/png' })],
    },
  });
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Synthetic quota failure'
    )
  );
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  expect(select).not.toHaveBeenCalled();
});
