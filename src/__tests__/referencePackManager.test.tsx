import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ReferencePackManager } from '../components/ReferencePackManager';
import { collectReferenceCandidates } from '../domain/referencePack';
import { legacyDraft } from './fixtures/legacyScene';
import type { MediaAsset } from '../types/domain';
afterEach(cleanup);
it('uses short visible media actions and retains the full filename in accessible labels', () => {
  const source = fixture(),
    media = {
      id: 'face',
      filename: 'a-very-long-original-reference-name.png',
      mimeType: 'image/png',
      blob: new Blob(['face']),
    } as MediaAsset;
  render(
    <ReferencePackManager
      source={source}
      mediaMap={new Map([['face', media]])}
      onClose={() => {}}
      onApply={() => {}}
    />
  );
  const preview = screen
    .getAllByRole('button', {
      name: /Preview .*a-very-long-original-reference-name/,
    })
    .find((button) => button.textContent === 'Preview');
  expect(preview).toBeDefined();
  expect(
    screen.getByRole('button', {
      name: /Download original .*a-very-long-original-reference-name/,
    })
  ).toHaveTextContent(/^Download$/);
});
const fixture = () => {
  const s = structuredClone(legacyDraft);
  s.slots = {
    character: {
      ...s.slots.character!,
      mediaLinks: [
        {
          mediaId: 'face',
          role: 'reference',
          altText: 'Face reference',
          order: 0,
        },
        {
          mediaId: 'demo',
          role: 'reference',
          altText: 'Demo illustration',
          order: 1,
        },
      ],
    },
  };
  s.resultMediaLinks = [
    {
      mediaId: 'result',
      role: 'result',
      altText: 'Generated result',
      order: 0,
    },
  ];
  return s;
};
it('starts with no selections and keeps suggestion distinct from final application', async () => {
  const source = fixture();
  const apply = vi.fn();
  const media = {
    id: 'face',
    filename: 'face.png',
    mimeType: 'image/png',
    blob: new Blob(['face']),
  } as MediaAsset;
  render(
    <ReferencePackManager
      source={source}
      mediaMap={new Map([['face', media]])}
      onClose={() => {}}
      onApply={apply}
    />
  );
  expect(screen.getByRole('status')).toHaveTextContent('0 selected');
  fireEvent.click(screen.getByRole('button', { name: 'Apply Suggested Pack' }));
  expect(apply).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('1 selected');
  fireEvent.click(screen.getByRole('button', { name: 'Apply Reference Pack' }));
  await waitFor(() => expect(apply).toHaveBeenCalledOnce());
  expect(apply.mock.calls[0][0].entries[0].mediaId).toBe('face');
  expect(source).not.toHaveProperty('referencePack');
});
it('keeps missing selections visible, blocks ZIP and preserves read-only historical choices', async () => {
  const source = fixture();
  source.referencePack = {
    version: 1,
    entries: collectReferenceCandidates(source, new Map()).slice(0, 1),
  };
  const edit = vi.fn();
  render(
    <ReferencePackManager
      source={source}
      mediaMap={new Map()}
      onClose={() => {}}
      onApply={vi.fn()}
      readOnly
      onEditCopy={edit}
    />
  );
  expect(
    screen.getByRole('checkbox', { name: /Face reference/ })
  ).toBeChecked();
  expect(
    screen.getByRole('checkbox', { name: /Face reference/ })
  ).toBeDisabled();
  expect(screen.getAllByText(/Missing original file/).length).toBeGreaterThan(
    0
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Download Reference ZIP' })
  );
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('face')
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit a Copy' }));
  expect(edit).toHaveBeenCalledOnce();
});
it('allows local purpose edits, removal, reordering and copying the matching checklist', async () => {
  const source = fixture();
  source.referencePack = {
    version: 1,
    entries: collectReferenceCandidates(source, new Map()).slice(0, 2),
  };
  const apply = vi.fn();
  const copy = vi.fn();
  render(
    <ReferencePackManager
      source={source}
      mediaMap={new Map()}
      onClose={() => {}}
      onApply={apply}
      onCopyText={copy}
    />
  );
  fireEvent.click(screen.getAllByRole('button', { name: /Move down/ })[0]);
  fireEvent.change(screen.getAllByRole('combobox')[0], {
    target: { value: 'general' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Copy Attachment Checklist' })
  );
  await waitFor(() => expect(copy).toHaveBeenCalled());
  expect(copy.mock.calls[0][0]).toMatch(/^1\..*Demo illustration/);
  fireEvent.click(screen.getByRole('button', { name: 'Apply Reference Pack' }));
  await waitFor(() => expect(apply).toHaveBeenCalled());
  expect(apply.mock.calls[0][0].entries[0]).toMatchObject({
    mediaId: 'demo',
    purpose: 'general',
    order: 0,
  });
  expect(source.referencePack.entries[0].mediaId).toBe('face');
});
it('groups visual origins and keeps selected missing legacy entries visible', () => {
  const source = fixture();
  source.referencePack = {
    version: 1,
    entries: [
      {
        associationId: 'unavailable',
        mediaId: 'missing',
        sourceSlot: 'legacy',
        sourceId: 'old',
        sourceTitle: 'Preserved legacy',
        role: 'sample',
        altText: 'Archived association',
        purpose: 'general',
        order: 0,
      },
    ],
  };
  render(
    <ReferencePackManager
      source={source}
      mediaMap={new Map()}
      onClose={() => {}}
      onApply={() => {}}
    />
  );
  expect(
    screen.getByRole('heading', { name: 'Character Identity' })
  ).toBeVisible();
  expect(
    screen.getByRole('heading', { name: 'External Results' })
  ).toBeVisible();
  expect(
    screen.getByRole('heading', { name: 'Legacy references' })
  ).toBeVisible();
  expect(
    screen.getByRole('checkbox', { name: /Archived association/ })
  ).toBeChecked();
});
