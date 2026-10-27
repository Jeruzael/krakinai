import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdentityAnchorPanel } from '../components/IdentityAnchorPanel';
import {
  clearAllStoresForTesting,
  getAllSnapshot,
  savePromptAsset,
  approveIdentityAnchor,
} from '../storage/db';

beforeEach(async () => {
  await clearAllStoresForTesting();
});
afterEach(cleanup);
it('saves draft text separately and approves only on an explicit action, preserving the master', async () => {
  const user = userEvent.setup();
  const character = await savePromptAsset({
    title: 'Mika',
    category: 'characters',
    promptText: 'Complete original master identity.',
    tags: [],
  });
  const onSaved = vi.fn();
  render(
    <IdentityAnchorPanel
      character={character}
      onSaved={onSaved}
      onCopy={vi.fn()}
    />
  );
  await user.click(
    screen.getByText('Identity Anchor', { selector: 'summary > span' })
  );
  await user.type(
    screen.getByLabelText('Identity Anchor text'),
    'User-written concise identity.'
  );
  await user.click(screen.getByRole('button', { name: 'Save Draft Anchor' }));
  await screen.findByText('Draft anchor saved. Approval is a separate action.');
  let current = (await getAllSnapshot()).assets[0];
  expect(current.identityAnchor?.text).toBe('User-written concise identity.');
  expect(current.identityAnchor?.approvedText).toBeUndefined();
  await user.click(screen.getByRole('button', { name: 'Approve Anchor' }));
  await screen.findByText(
    'Anchor explicitly approved for this master revision.'
  );
  current = (await getAllSnapshot()).assets[0];
  expect(current.identityAnchor?.approvedText).toBe(
    'User-written concise identity.'
  );
  expect(current.promptText).toBe(character.promptText);
  expect(onSaved).toHaveBeenCalledTimes(2);
});
it('distinguishes revision counters, approved and stale text, and copies only user-written anchor text', async () => {
  const user = userEvent.setup(),
    copy = vi.fn();
  let character = await savePromptAsset({
    title: 'Mika',
    category: 'characters',
    promptText: 'Complete authoritative master identity.',
    tags: [],
  });
  character = await approveIdentityAnchor(
    character.id,
    'User-authored short identity.',
    character.identityRevision
  );
  const view = render(
    <IdentityAnchorPanel
      character={character}
      onSaved={vi.fn()}
      onCopy={copy}
    />
  );
  await user.click(
    screen.getByText('Identity Anchor', { selector: 'summary > span' })
  );
  expect(screen.getByText(/Record revision 2/)).toBeVisible();
  expect(screen.getByText(/Master Identity revision 1/)).toBeVisible();
  expect(
    screen.getByText(/Complete authoritative character description/)
  ).toBeVisible();
  expect(
    screen.getByText(/Optional shorter, user-approved description/)
  ).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Copy Anchor' }));
  expect(copy).toHaveBeenCalledWith('User-authored short identity.');
  character = await savePromptAsset({
    ...character,
    promptText: 'User explicitly revised the master identity.',
  });
  view.rerender(
    <IdentityAnchorPanel
      character={character}
      onSaved={vi.fn()}
      onCopy={copy}
    />
  );
  expect(screen.getByText('Stale', { exact: true })).toBeVisible();
  expect(screen.getByLabelText('Identity Anchor text')).toHaveValue(
    'User-authored short identity.'
  );
  expect((await getAllSnapshot()).assets[0].promptText).toBe(
    'User explicitly revised the master identity.'
  );
});
