import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import type { QwenSettings, WordDefinitionResult } from '../../types/qwen';
import { lookupWordDefinition } from '../../services/qwenClient';
import { Sparkles, X, BookOpen, Quote, RefreshCw } from 'lucide-react';
import './qwenCoPilot.css';

export interface QwenWordLookupPopoverProps {
  settings: QwenSettings;
  isServerAwake: boolean;
  onWakeQwen?: () => void;
}

export function calculatePopoverCoords(
  range: Range,
  cardEl?: HTMLElement | null
): { x: number; y: number; placeAbove: boolean } {
  const rect = range.getBoundingClientRect();
  const cardHeight = cardEl?.offsetHeight || 300;
  const cardWidth = 320;

  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;

  // Prefer above if there is sufficient room; otherwise place below
  const placeAbove = spaceAbove >= cardHeight + 16 || spaceAbove > spaceBelow;
  let targetY = placeAbove ? rect.top - cardHeight - 8 : rect.bottom + 8;
  targetY = Math.max(12, Math.min(window.innerHeight - cardHeight - 12, targetY));

  let targetX = Math.max(
    16,
    Math.min(window.innerWidth - cardWidth - 16, rect.left + rect.width / 2 - cardWidth / 2)
  );

  return { x: targetX, y: targetY, placeAbove };
}

export const QwenWordLookupPopover: React.FC<QwenWordLookupPopoverProps> = ({
  settings,
  isServerAwake,
  onWakeQwen,
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number; placeAbove: boolean }>({
    x: 0,
    y: 0,
    placeAbove: true,
  });
  const [word, setWord] = useState('');
  const [contextSentence, setContextSentence] = useState('');
  const [definition, setDefinition] = useState<WordDefinitionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const activeRangeRef = useRef<Range | null>(null);

  const triggerLookup = useCallback(
    (targetWord: string, sentence: string, forceFresh: boolean = false) => {
      if (!isServerAwake || !targetWord) return;
      setLoading(true);
      setError(null);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      lookupWordDefinition(
        targetWord,
        sentence,
        settings.live,
        controller.signal,
        {
          ...(settings.dictionary || {}),
          cacheEnabled: forceFresh ? false : settings.dictionary?.cacheEnabled !== false,
        }
      )
        .then((res) => {
          setDefinition(res);
          setLoading(false);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setError(err.message || 'Lookup failed');
            setLoading(false);
          }
        });
    },
    [isServerAwake, settings.live, settings.dictionary]
  );

  // Re-adjust coordinates when card dimensions settle
  useLayoutEffect(() => {
    if (visible && activeRangeRef.current && popoverRef.current) {
      const updated = calculatePopoverCoords(activeRangeRef.current, popoverRef.current);
      setCoords(updated);
    }
  }, [visible, definition, loading, error]);

  // Keep popover pinned to word during scroll
  useEffect(() => {
    if (!visible) return;

    const handleScroll = () => {
      if (!activeRangeRef.current) return;
      const rect = activeRangeRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setVisible(false);
        return;
      }
      const updated = calculatePopoverCoords(activeRangeRef.current, popoverRef.current);
      setCoords(updated);
    };

    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [visible]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleSelectionCheck = (e?: MouseEvent) => {
      // Don't close if user clicked inside the popover
      if (e?.target && popoverRef.current && popoverRef.current.contains(e.target as Node)) {
        return;
      }

      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          return;
        }

        const rawText = sel.toString().trim();
        // Trigger only for 1 to 3 words, length <= 35 chars, purely words/letters
        if (!rawText || rawText.length > 35) return;
        const wordTokens = rawText.split(/\s+/);
        if (wordTokens.length < 1 || wordTokens.length > 3) return;

        // Skip inputs, textareas, or buttons
        const range = sel.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const parentElem =
          container.nodeType === Node.ELEMENT_NODE
            ? (container as Element)
            : container.parentElement;

        if (
          parentElem?.closest(
            'input, textarea, button, form, .qwen-copilot-input-form, .qwen-word-lookup-card'
          )
        ) {
          return;
        }

        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        // Extract surrounding sentence
        const fullParagraphText = parentElem?.textContent || '';
        const sentenceRegex = /[^.!?]+[.!?]+(\s|$)/g;
        let matchedSentence = '';
        let sentenceMatch;
        while ((sentenceMatch = sentenceRegex.exec(fullParagraphText)) !== null) {
          if (sentenceMatch[0].includes(rawText)) {
            matchedSentence = sentenceMatch[0].trim();
            break;
          }
        }
        if (!matchedSentence) {
          matchedSentence = fullParagraphText.slice(0, 160);
        }

        activeRangeRef.current = range;
        const initialCoords = calculatePopoverCoords(range, null);

        setCoords(initialCoords);
        setWord(rawText);
        setContextSentence(matchedSentence);
        setVisible(true);
        setDefinition(null);
        setError(null);

        triggerLookup(rawText, matchedSentence, false);
      }, 150);
    };

    const handleDocumentMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setVisible(false);
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }
    };

    document.addEventListener('mouseup', handleSelectionCheck);
    document.addEventListener('mousedown', handleDocumentMouseDown);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mouseup', handleSelectionCheck);
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [triggerLookup]);

  if (!visible) return null;

  return (
    <div
      ref={popoverRef}
      className={`qwen-word-lookup-card ${coords.placeAbove ? 'above' : 'below'}`}
      style={{
        left: `${coords.x}px`,
        top: `${coords.y}px`,
      }}
      role="dialog"
      aria-label="Word Definition"
    >
      {/* Header */}
      <div className="word-card-header">
        <div className="word-title-group">
          <BookOpen size={13} className="text-cyan" />
          <span className="word-text">{word}</span>
          {definition?.partOfSpeech && (
            <span className="word-pos-pill">{definition.partOfSpeech}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="word-card-close-btn"
          aria-label="Close Definition"
        >
          <X size={12} />
        </button>
      </div>

      {/* Content */}
      <div className="word-card-body">
        {!isServerAwake ? (
          <div className="word-sleeping-notice">
            <span>🤖 Local Qwen is sleeping.</span>
            {onWakeQwen && (
              <button type="button" onClick={onWakeQwen} className="word-wake-btn">
                Wake Qwen
              </button>
            )}
          </div>
        ) : loading ? (
          <div className="word-loading-state">
            <span className="word-shimmer-pulse" />
            <span>Consulting Qwen Lexicon...</span>
          </div>
        ) : error ? (
          <div className="word-error-state" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span>⚠️ {error}</span>
            <button
              type="button"
              onClick={() => triggerLookup(word, contextSentence, true)}
              className="word-wake-btn"
              style={{ alignSelf: 'flex-start', marginTop: '2px' }}
            >
              Retry Lookup
            </button>
          </div>
        ) : definition ? (
          <>
            <div className="word-definition-text">{definition.definition}</div>

            {definition.contextualMeaning && (
              <div className="word-context-meaning">
                <span className="context-label">💡 Scene nuance:</span> {definition.contextualMeaning}
              </div>
            )}

            {definition.synonyms && definition.synonyms.length > 0 && (
              <div className="word-synonyms-row">
                {definition.synonyms.slice(0, 4).map((syn, idx) => (
                  <span key={idx} className="word-synonym-pill">
                    {syn}
                  </span>
                ))}
              </div>
            )}

            {definition.examples && definition.examples.length > 0 && (
              <div className="word-examples-list">
                {definition.examples.slice(0, 2).map((ex, idx) => (
                  <div key={idx} className="word-example-item">
                    <Quote size={10} className="example-quote-icon" />
                    <span>{ex}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Token Consumption & Cache Library Badge */}
            <div className="word-card-footer">
              <div className="token-cost-group">
                {definition.cached ? (
                  <span className="word-cache-badge" title="Loaded instantly from local dictionary cache at 0 new tokens">
                    📚 Saved in Dictionary (0 tok)
                  </span>
                ) : (
                  <span className="word-token-cost-badge" title="Live tokens consumed; word is automatically saved to Dictionary Library">
                    ⚡ {definition.tokenCost?.totalTokens || 0} tokens • 💾 Saved to Library
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => triggerLookup(word, contextSentence, true)}
                className="word-re-query-btn"
                title="Force a live AI re-query with Qwen"
              >
                <RefreshCw size={10} />
                <span>Re-query AI</span>
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
