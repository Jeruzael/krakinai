import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoryMarkdownRenderer } from '../components/stories/StoryMarkdownRenderer';

describe('StoryMarkdownRenderer', () => {
  it('unescapes literal \\n\\n and \\" correctly into formatted blocks', () => {
    const rawContent = 'Elena opened it.\\n\\nThey were addressed to \\"the girl who left.\\"\\n\\nThere were twelve of them.';
    const { container } = render(<StoryMarkdownRenderer content={rawContent} variant="chat" />);

    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBe(3);
    expect(paragraphs[0].textContent).toBe('Elena opened it.');
    expect(paragraphs[1].textContent).toContain('"the girl who left."');
    expect(paragraphs[2].textContent).toBe('There were twelve of them.');
  });

  it('renders markdown headings, dividers, and metadata lists', () => {
    const markdown = `# 02b_book_manuscript.md

## Manuscript Metadata
* **Story Title:** The Unmade Man
* **Author:** KRAKINAI Studio & Antigravity
* **Source Script:** 02_locked_shooting_script.md

---

### Chapter 1: The Silver Needle

Sheets of freezing rain slammed incessantly against the depot.`;

    const { container } = render(<StoryMarkdownRenderer content={markdown} variant="book" />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('02b_book_manuscript.md');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Manuscript Metadata');
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Chapter 1: The Silver Needle');
    
    expect(container.querySelector('hr')).toBeTruthy();

    const listItems = container.querySelectorAll('li');
    expect(listItems.length).toBe(3);
    expect(listItems[0].querySelector('strong')?.textContent).toBe('Story Title:');
    expect(listItems[0].textContent).toContain('The Unmade Man');
  });

  it('renders italic dialogue quotes with dialogue class', () => {
    const markdown = `The radio clicked:

*"...classified footage leaked from the subterranean Black Ridge research facility..."*

Elias did not look at the news.`;

    const { container } = render(<StoryMarkdownRenderer content={markdown} variant="book" />);
    const dialogueEm = container.querySelector('.story-md-dialogue');
    expect(dialogueEm).toBeTruthy();
    expect(dialogueEm?.textContent).toContain('classified footage leaked');
  });
});
