import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormattedPrompt } from '../components/FormattedPrompt';

describe('FormattedPrompt', () => {
  it('presents headings, labels, bold text and dialogue safely', () => {
    const { container } = render(
      <FormattedPrompt
        text={
          '=== CHARACTER IDENTITY ===\n**HAIR** blue.\n<img src=x onerror=alert(1)>\n\n=== SPOKEN DIALOGUE SCRIPT ===\nSpeaker: Ari\n"Hello <script>alert(1)</script>"'
        }
      />
    );
    expect(
      screen.getByRole('heading', { name: 'CHARACTER IDENTITY' })
    ).toBeVisible();
    expect(screen.getByText('HAIR').tagName).toBe('STRONG');
    expect(screen.getByText('Speaker:').tagName).toBe('STRONG');
    expect(container.querySelector('img, script')).toBeNull();
    expect(
      container.querySelector('.formatted-prompt-dialogue')
    ).not.toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
  });
});
