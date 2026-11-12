import React from 'react';
import './storyMarkdown.css';

export interface StoryMarkdownRendererProps {
  content: string;
  variant?: 'book' | 'chat';
  className?: string;
}

export function unescapeRawMarkdown(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\t/g, '  ');
}

export function parseInlineMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  // Regex patterns:
  // 1. Dialogue italic quotes: *"..."* or *“...”*
  // 2. Bold italic: ***...***
  // 3. Bold: **...** or __...__
  // 4. Italic: *...* (no space after opening, no space before closing) or _..._
  // 5. Inline code: `...`
  const regex = /(\*(?:“|")[\s\S]+?(?:”|")\*|\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|__[\s\S]+?__|(?<!\w)\*(?!\s)[^*\n]+?(?<!\s)\*(?!\w)|(?<!\w)_(?!\s)[^_\n]+?(?<!\s)_(?!\w)|`[^`\n]+`)/g;

  const parts = text.split(regex);
  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (!part) return null;

    // Dialogue quotes: *"..."* or *“...”*
    if (
      (part.startsWith('*"') && part.endsWith('"*')) ||
      (part.startsWith('*“') && part.endsWith('”*')) ||
      (part.startsWith('*”') && part.endsWith('”*'))
    ) {
      const inner = part.slice(1, -1);
      return (
        <em key={index} className="story-md-dialogue">
          {inner}
        </em>
      );
    }

    // Bold-italic: ***...***
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      return (
        <strong key={index}>
          <em>{parseInlineMarkdown(part.slice(3, -3))}</em>
        </strong>
      );
    }

    // Bold: **...** or __...__
    if (
      (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
    ) {
      return <strong key={index}>{parseInlineMarkdown(part.slice(2, -2))}</strong>;
    }

    // Italic: *...* or _..._
    if (
      (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
    ) {
      return <em key={index}>{parseInlineMarkdown(part.slice(1, -1))}</em>;
    }

    // Code: `...`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={index} className="story-md-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
}

export const StoryMarkdownRenderer: React.FC<StoryMarkdownRendererProps> = ({
  content,
  variant = 'chat',
  className = '',
}) => {
  if (!content) return null;

  const normalized = unescapeRawMarkdown(content);
  const lines = normalized.split('\n');

  const renderedBlocks: React.ReactNode[] = [];
  let currentParagraphLines: string[] = [];
  let currentListItems: { ordered: boolean; text: string }[] = [];
  let currentBlockquoteLines: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];

  const flushParagraph = (key: string) => {
    if (currentParagraphLines.length > 0) {
      renderedBlocks.push(
        <p key={key} className="story-md-p">
          {currentParagraphLines.map((line, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <br />}
              {parseInlineMarkdown(line)}
            </React.Fragment>
          ))}
        </p>
      );
      currentParagraphLines = [];
    }
  };

  const flushList = (key: string) => {
    if (currentListItems.length > 0) {
      const isOrdered = currentListItems[0].ordered;
      if (isOrdered) {
        renderedBlocks.push(
          <ol key={key} className="story-md-list story-md-ordered-list">
            {currentListItems.map((item, idx) => (
              <li key={idx} className="story-md-list-item">
                {parseInlineMarkdown(item.text)}
              </li>
            ))}
          </ol>
        );
      } else {
        renderedBlocks.push(
          <ul key={key} className="story-md-list">
            {currentListItems.map((item, idx) => (
              <li key={idx} className="story-md-list-item">
                {parseInlineMarkdown(item.text)}
              </li>
            ))}
          </ul>
        );
      }
      currentListItems = [];
    }
  };

  const flushBlockquote = (key: string) => {
    if (currentBlockquoteLines.length > 0) {
      renderedBlocks.push(
        <blockquote key={key} className="story-md-blockquote">
          {currentBlockquoteLines.map((line, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <br />}
              {parseInlineMarkdown(line)}
            </React.Fragment>
          ))}
        </blockquote>
      );
      currentBlockquoteLines = [];
    }
  };

  const flushAll = (keySuffix: string) => {
    flushParagraph(`p-${keySuffix}`);
    flushList(`list-${keySuffix}`);
    flushBlockquote(`quote-${keySuffix}`);
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Code block fences
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // closing code block
        renderedBlocks.push(
          <pre key={`code-${index}`} className="story-md-pre" data-lang={codeBlockLang}>
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        );
        inCodeBlock = false;
        codeBlockLang = '';
        codeBlockLines = [];
      } else {
        flushAll(`before-code-${index}`);
        inCodeBlock = true;
        codeBlockLang = trimmed.replace(/^```/, '').trim();
        codeBlockLines = [];
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    // Empty line separates blocks
    if (!trimmed) {
      flushAll(`empty-${index}`);
      return;
    }

    // Horizontal Rule
    if (/^([-*_]){3,}$/.test(trimmed)) {
      flushAll(`before-hr-${index}`);
      renderedBlocks.push(<hr key={`hr-${index}`} className="story-md-divider" />);
      return;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushAll(`before-h-${index}`);
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const headingContent = parseInlineMarkdown(text);
      if (level === 1) {
        renderedBlocks.push(
          <h1 key={`h1-${index}`} className="story-md-h1">
            {headingContent}
          </h1>
        );
      } else if (level === 2) {
        renderedBlocks.push(
          <h2 key={`h2-${index}`} className="story-md-h2">
            {headingContent}
          </h2>
        );
      } else if (level === 3) {
        renderedBlocks.push(
          <h3 key={`h3-${index}`} className="story-md-h3">
            {headingContent}
          </h3>
        );
      } else {
        renderedBlocks.push(
          <h4 key={`h4-${index}`} className="story-md-h4">
            {headingContent}
          </h4>
        );
      }
      return;
    }

    // Blockquote line
    if (trimmed.startsWith('>')) {
      flushParagraph(`before-quote-${index}`);
      flushList(`before-quote-list-${index}`);
      currentBlockquoteLines.push(trimmed.replace(/^>\s?/, ''));
      return;
    }

    // List item
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph(`before-list-${index}`);
      flushBlockquote(`before-list-quote-${index}`);
      currentListItems.push({ ordered: false, text: bulletMatch[1] });
      return;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph(`before-list-${index}`);
      flushBlockquote(`before-list-quote-${index}`);
      currentListItems.push({ ordered: true, text: orderedMatch[1] });
      return;
    }

    // Regular line continues paragraph (or starts new one if list/blockquote just ended)
    flushList(`before-p-${index}`);
    flushBlockquote(`before-p-${index}`);
    currentParagraphLines.push(line);
  });

  // Final flush
  flushAll('end');
  if (inCodeBlock && codeBlockLines.length > 0) {
    renderedBlocks.push(
      <pre key="code-end" className="story-md-pre" data-lang={codeBlockLang}>
        <code>{codeBlockLines.join('\n')}</code>
      </pre>
    );
  }

  return (
    <div className={`story-markdown-root ${variant}-mode ${className}`.trim()}>
      {renderedBlocks}
    </div>
  );
};
