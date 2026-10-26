import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdentityAnchorPanel } from '../components/IdentityAnchorPanel';
import { clearAllStoresForTesting, getAllSnapshot, savePromptAsset } from '../storage/db';

beforeEach(async () => { await clearAllStoresForTesting(); });
it('saves draft text separately and approves only on an explicit action, preserving the master', async () => {
  const user = userEvent.setup();
  const character = await savePromptAsset({title:'Mika',category:'characters',promptText:'Complete original master identity.',tags:[]});
  const onSaved = vi.fn();
  render(<IdentityAnchorPanel character={character} onSaved={onSaved} onCopy={vi.fn()} />);
  await user.click(screen.getByText('Identity Anchor'));
  await user.type(screen.getByLabelText('Identity Anchor text'), 'User-written concise identity.');
  await user.click(screen.getByRole('button',{name:'Save Draft Anchor'}));
  await screen.findByText('Draft anchor saved. Approval is a separate action.');
  let current = (await getAllSnapshot()).assets[0];
  expect(current.identityAnchor?.text).toBe('User-written concise identity.');
  expect(current.identityAnchor?.approvedText).toBeUndefined();
  await user.click(screen.getByRole('button',{name:'Approve Anchor'}));
  await screen.findByText('Anchor explicitly approved for this master revision.');
  current = (await getAllSnapshot()).assets[0];
  expect(current.identityAnchor?.approvedText).toBe('User-written concise identity.');
  expect(current.promptText).toBe(character.promptText);
  expect(onSaved).toHaveBeenCalledTimes(2);
});
