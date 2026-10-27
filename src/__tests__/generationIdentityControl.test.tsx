import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GenerationIdentityControl } from '../components/GenerationIdentityControl';
import { legacyDraft } from './fixtures/legacyScene';
import type { PromptAsset } from '../types/domain';
afterEach(cleanup);
it('labels a saved master source as frozen and never promotes its unselected stale anchor', () => {
  const { draft, master } = fixture();
  draft.slots.character!.identityRevision = 3;
  const original = structuredClone(draft);
  render(
    <GenerationIdentityControl
      source={draft}
      liveMaster={{ ...master, identityRevision: 4 }}
      saved
      onChange={vi.fn()}
    />
  );
  expect(screen.getByText('Master Identity in saved snapshot')).toBeVisible();
  expect(screen.queryByText('Approved and current')).not.toBeInTheDocument();
  expect(
    screen.getByRole('option', { name: 'Approved Identity Anchor' })
  ).toBeDisabled();
  expect(screen.getByLabelText('Character Identity Source')).toHaveValue(
    'master'
  );
  expect(draft).toEqual(original);
});
const fixture = () => {
  const draft = structuredClone(legacyDraft),
    anchor = {
      text: 'Explicit approved short identity.',
      approvedText: 'Explicit approved short identity.',
      approvedAt: '2026-10-27T00:00:00Z',
      approvedMasterIdentityRevision: 2,
    };
  draft.slots.character = {
    ...draft.slots.character!,
    sourceId: 'character-ui',
    sourceRevision: 7,
    identityRevision: 2,
    identityAnchor: anchor,
  };
  const master = {
    id: 'character-ui',
    category: 'characters',
    promptText: draft.slots.character.promptText,
    revision: 7,
    identityRevision: 2,
    identityAnchor: structuredClone(anchor),
  } as PromptAsset;
  return { draft, master };
};
it('offers only a current approved anchor and reports the selected snapshot revision separately', () => {
  const { draft, master } = fixture(),
    onChange = vi.fn(),
    original = structuredClone(draft);
  const view = render(
    <GenerationIdentityControl
      source={draft}
      liveMaster={master}
      onChange={onChange}
    />
  );
  expect(
    screen.getByRole('option', { name: 'Approved Identity Anchor' })
  ).toBeEnabled();
  expect(screen.getByText(/Master revision 2/)).toBeVisible();
  expect(screen.getByText(/record revision 7/)).toBeVisible();
  fireEvent.change(screen.getByLabelText('Character Identity Source'), {
    target: { value: 'approved_anchor' },
  });
  expect(onChange).toHaveBeenCalledWith({
    identitySource: 'approved_anchor',
    anchor: {
      text: 'Explicit approved short identity.',
      approvedAt: '2026-10-27T00:00:00Z',
      approvedMasterIdentityRevision: 2,
    },
  });
  expect(draft).toEqual(original);
  view.rerender(
    <GenerationIdentityControl
      source={draft}
      liveMaster={{ ...master, identityRevision: 3 }}
      onChange={onChange}
    />
  );
  expect(
    screen.getByRole('option', { name: 'Approved Identity Anchor' })
  ).toBeDisabled();
  expect(screen.getByLabelText('Character Identity Source')).toHaveValue(
    'master'
  );
});
it('keeps a saved generation identity frozen when the live master changes', () => {
  const { draft, master } = fixture();
  draft.generation = {
    identitySource: 'approved_anchor',
    anchor: {
      text: 'Explicit approved short identity.',
      approvedAt: '2026-10-27T00:00:00Z',
      approvedMasterIdentityRevision: 2,
    },
  };
  const original = structuredClone(draft),
    onChange = vi.fn();
  render(
    <GenerationIdentityControl
      source={draft}
      liveMaster={{ ...master, identityRevision: 8 }}
      saved
      onChange={onChange}
    />
  );
  expect(screen.getByLabelText('Character Identity Source')).toBeDisabled();
  expect(screen.getByLabelText('Character Identity Source')).toHaveValue(
    'approved_anchor'
  );
  expect(draft).toEqual(original);
  expect(onChange).not.toHaveBeenCalled();
});
