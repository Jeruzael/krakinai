import React, { useRef, useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScenePromptViewerDialog } from '../components/ScenePromptViewerDialog';

const exact =
  '  Preserved opening.\r\n\r\n=== CHARACTER IDENTITY ===\r\n**Mika** <img src=x onerror=alert(1)>\r\n\r\n=== SPOKEN DIALOGUE SCRIPT ===\r\n  “Sandali lang—wait!” 😊 雨\r\nTara na.  ';
function Host({
  text = exact,
  json = false,
  onCopy = vi.fn(),
  onDownload = vi.fn(),
}: {
  text?: string;
  json?: boolean;
  onCopy?: () => void;
  onDownload?: () => void;
}) {
  const [open, setOpen] = useState(false),
    trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={trigger} onClick={() => setOpen(true)}>
        Show Prompt
      </button>
      <button>Background action</button>
      {open && (
        <ScenePromptViewerDialog
          title="Synthetic scene"
          formatLabel="Structured"
          text={text}
          json={json}
          onClose={() => setOpen(false)}
          onCopy={onCopy}
          onDownload={onDownload}
          returnFocusRef={trigger}
        />
      )}
    </>
  );
}
describe('shared prompt viewer', () => {
  it('selects only the complete raw prompt with the keyboard', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Show Prompt' }));
    await user.click(screen.getByRole('button', { name: 'Raw' }));
    screen.getByRole('region', { name: 'Complete prompt text' }).focus();
    await user.keyboard('{Control>}a{/Control}');
    expect(window.getSelection()?.toString()).toBe(exact);
  });
  it('keeps complete exact raw text and canonical actions while formatted content stays escaped', async () => {
    const user = userEvent.setup(),
      copy = vi.fn(),
      download = vi.fn();
    render(<Host onCopy={copy} onDownload={download} />);
    await user.click(screen.getByRole('button', { name: 'Show Prompt' }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: 'CHARACTER IDENTITY' })
    ).toBeVisible();
    expect(dialog.querySelector('img,script')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Raw' }));
    expect(
      within(dialog).getByRole('region', { name: 'Complete prompt text' })
        .textContent
    ).toBe(exact);
    await user.click(
      within(dialog).getByRole('button', { name: 'Copy Prompt' })
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Download Selected' })
    );
    expect(copy).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledTimes(1);
  });
  it('locks background scrolling, traps focus and restores the Show Prompt trigger on Escape', async () => {
    const user = userEvent.setup();
    render(<Host />);
    const trigger = screen.getByRole('button', { name: 'Show Prompt' });
    await user.click(trigger);
    expect(document.body.style.overflow).toBe('hidden');
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    const close = within(dialog).getByRole('button', { name: 'Close' });
    close.focus();
    await user.tab();
    expect(
      within(dialog).getByRole('button', {
        name: 'Close Scene Prompt — Synthetic scene',
      })
    ).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
  it('exposes deterministic section links and a mobile selector without changing text', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Show Prompt' }));
    const navigation = screen.getByRole('navigation', {
      name: 'Prompt sections',
    });
    await user.click(
      within(navigation).getByRole('button', { name: 'SPOKEN DIALOGUE SCRIPT' })
    );
    expect(
      screen.getByRole('heading', { name: 'SPOKEN DIALOGUE SCRIPT' })
    ).toHaveFocus();
    fireEvent.change(screen.getByLabelText('Jump to prompt section'), {
      target: { value: 'prompt-section-2' },
    });
    await user.click(screen.getByRole('button', { name: 'Raw' }));
    expect(
      screen.getByRole('region', { name: 'Complete prompt text' }).textContent
    ).toBe(exact);
    expect(
      within(navigation).getByRole('button', { name: 'SPOKEN DIALOGUE SCRIPT' })
    ).toHaveAttribute('aria-current', 'location');
  });
  it('provides a complete JSON fallback and a truthful empty output state', async () => {
    const user = userEvent.setup(),
      { unmount } = render(<Host text={' {"line":"  Tara na 😊  "}\n'} json />);
    await user.click(screen.getByRole('button', { name: 'Show Prompt' }));
    expect(
      screen.getByRole('region', { name: 'Complete prompt text' }).textContent
    ).toBe(' {"line":"  Tara na 😊  "}\n');
    expect(
      screen.getByRole('navigation', { name: 'Prompt sections' })
    ).toHaveTextContent('Full Prompt');
    unmount();
    render(<Host text="" />);
    await user.click(screen.getByRole('button', { name: 'Show Prompt' }));
    expect(
      screen.getByText('No prompt text in this selected output.')
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Copy Prompt' })).toBeDisabled();
  });
});
