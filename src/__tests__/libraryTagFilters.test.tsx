import React, { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryTagFilters } from '../components/LibraryTagFilters';
afterEach(cleanup);
const assets = [
  {
    tags: [
      'Portrait',
      'portrait',
      'common',
      ...Array.from({ length: 12 }, (_, i) => `tag-${i}`),
    ],
  },
  { tags: ['PORTRAIT', 'common'] },
  { tags: ['common'] },
];
it('ranks eight unique tags by record usage without changing source tags', () => {
  const original = structuredClone(assets);
  render(
    <LibraryTagFilters assets={assets} selectedTags={[]} onToggle={() => {}} />
  );
  expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(8);
  expect(screen.getAllByRole('button')[0]).toHaveTextContent('common');
  expect(
    screen.getByRole('button', { name: /Portrait.*2/ })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: '+ 6 more tags' })
  ).toBeInTheDocument();
  expect(assets).toEqual(original);
});
it('searches the remaining tags, supports multi selection and restores picker focus', async () => {
  const user = userEvent.setup();
  const Host = () => {
    const [selected, setSelected] = useState<string[]>([]);
    return (
      <LibraryTagFilters
        assets={assets}
        selectedTags={selected}
        onToggle={(tag) =>
          setSelected((old) =>
            old.includes(tag) ? old.filter((t) => t !== tag) : [...old, tag]
          )
        }
      />
    );
  };
  render(<Host />);
  const trigger = screen.getByRole('button', { name: '+ 6 more tags' });
  await user.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Filter by tags' });
  await user.type(
    within(dialog).getByRole('searchbox', { name: 'Search tags' }),
    'tag-9'
  );
  expect(within(dialog).getAllByRole('checkbox')).toHaveLength(1);
  await user.click(within(dialog).getByRole('checkbox'));
  await user.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
  expect(
    screen.getByRole('button', { name: /tag-9.*1/, pressed: true })
  ).toBeVisible();
  await user.click(screen.getByRole('button', { name: /common.*3/ }));
  expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(2);
});
