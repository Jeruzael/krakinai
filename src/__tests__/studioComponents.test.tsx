import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudioDialog } from '../components/StudioDialog';
import { ReferenceBoard } from '../components/ReferenceBoard';

describe('Studio visual controls', () => {
  it('allows native video controls into the dialog keyboard sequence', () => {
    render(
      <StudioDialog title="Video gallery" onClose={() => {}}>
        <video controls aria-label="Reference playback" />
      </StudioDialog>
    );
    const close = screen.getByRole('button', { name: 'Close Video gallery' });
    close.focus();
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    close.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('traps keyboard focus, closes on Escape, and returns to its trigger', async () => {
    const user = userEvent.setup();
    const Host = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open detail</button>
          {open && (
            <StudioDialog
              title="Test detail"
              onClose={() => setOpen(false)}
              footer={<button>Last action</button>}
            >
              <input aria-label="Detail field" />
            </StudioDialog>
          )}
        </>
      );
    };
    render(<Host />);
    const trigger = screen.getByRole('button', { name: 'Open detail' });
    await user.click(trigger);
    const close = screen.getByRole('button', { name: 'Close Test detail' });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Last action' })).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('shows every reference association in View All, including duplicate and missing blobs', async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 8 }, (_, index) => ({
      key: String(index),
      mediaId: 'missing-shared-blob',
      label: index === 0 ? 'Character' : 'Clothing',
      sourceTitle: `Reference association ${index + 1}`,
      filename: `original-${index}.png`,
      role: 'reference',
    }));
    render(<ReferenceBoard items={items} mediaMap={new Map()} downloadable />);
    expect(screen.getByText('8 references')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View All (8)' }));
    const gallery = screen.getByRole('dialog', { name: 'All references' });
    expect(within(gallery).getAllByRole('article')).toHaveLength(8);
    expect(within(gallery).getByText('original-7.png')).toBeInTheDocument();
    expect(
      within(gallery).getAllByRole('button', { name: /^Download/ })
    ).toHaveLength(8);
    within(gallery)
      .getAllByRole('button', { name: /^Download/ })
      .forEach((button) => expect(button).toBeDisabled());
  });
});
