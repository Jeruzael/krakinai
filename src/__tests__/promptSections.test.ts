import { describe, expect, it } from 'vitest';
import { indexPromptSections } from '../domain/promptSections';

describe('prompt section navigation', () => {
  it('indexes real exporter boundaries without changing whitespace or inventing prose sections', () => {
    const text =
      '  Exact introduction.\r\n\r\n=== CHARACTER IDENTITY ===\r\nMika: “Sandali—wait!” 😊\r\nCamera is only a word in this paragraph.\r\n\r\n=== CAMERA & CINEMATOGRAPHY ===\r\n  Keep this framing.  ';
    const sections = indexPromptSections(text);
    expect(sections.map((s) => [s.title, s.lineIndex])).toEqual([
      ['Full Prompt', 0],
      ['CHARACTER IDENTITY', 2],
      ['CAMERA & CINEMATOGRAPHY', 6],
    ]);
    expect(sections.map((s) => text.slice(s.start, s.end)).join('')).toBe(text);
  });
  it('recognizes supported Markdown sections but ignores unknown headings and quoted headings', () => {
    const sections = indexPromptSections(
      '## Character Identity\nOriginal.\n## A personal note\nText.\n> ## Camera\n## Additional Scene Instructions\nHold.'
    );
    expect(sections.map((s) => s.title)).toEqual([
      'Character Identity',
      'Additional Scene Instructions',
    ]);
  });
  it('does not interpret JSON strings or prose as scene metadata', () => {
    expect(
      indexPromptSections('{"notes":"## Camera\\nexact"}').map((s) => s.title)
    ).toEqual(['Full Prompt']);
    expect(
      indexPromptSections(
        'Character: Mika\nCamera: shoulder level\nDialogue: hello'
      ).map((s) => s.title)
    ).toEqual(['Full Prompt']);
  });
  it('uses stable unique anchors for repeated recognized headings', () => {
    const sections = indexPromptSections(
      '=== VISUAL STYLE ===\nOne\n=== VISUAL STYLE ===\nTwo'
    );
    expect(new Set(sections.map((s) => s.id)).size).toBe(2);
    expect(sections.map((s) => s.title)).toEqual([
      'VISUAL STYLE',
      'VISUAL STYLE',
    ]);
  });
  it('supports an empty prompt and an unbroken extremely long prompt without truncation', () => {
    expect(indexPromptSections('')).toEqual([
      expect.objectContaining({
        title: 'Full Prompt',
        start: 0,
        end: 0,
        lineIndex: 0,
      }),
    ]);
    const text = '  雨😊'.repeat(20000) + '\n';
    expect(indexPromptSections(text)).toEqual([
      expect.objectContaining({ start: 0, end: text.length }),
    ]);
  });
});
