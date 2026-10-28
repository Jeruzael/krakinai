import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { indexPromptSections } from '../domain/promptSections';
import { FormattedPrompt } from './FormattedPrompt';
import { StudioDialog } from './StudioDialog';
import './scenePromptViewer.css';

export function ScenePromptViewerDialog({
  title,
  formatLabel,
  text,
  json = false,
  onClose,
  onCopy,
  onDownload,
  initialSection,
  returnFocusRef,
}: {
  title: string;
  formatLabel: string;
  text: string;
  json?: boolean;
  onClose: () => void;
  onCopy: () => void | Promise<void>;
  onDownload: () => void;
  initialSection?: string;
  returnFocusRef?: React.RefObject<HTMLElement>;
}) {
  const id = useId(),
    viewport = useRef<HTMLDivElement>(null);
  const sections = useMemo(() => indexPromptSections(text), [text]);
  const anchors = useMemo(
    () => new Map(sections.map((s) => [s.lineIndex, `${id}-${s.id}`])),
    [id, sections]
  );
  const [view, setView] = useState<'formatted' | 'raw'>('formatted');
  const [selected, setSelected] = useState(initialSection ?? sections[0].id);
  const jump = (sectionId: string, focus = true) => {
    const region = viewport.current,
      target = document.getElementById(`${id}-${sectionId}`);
    if (!region || !target || !region.contains(target)) return;
    region.scrollTop +=
      target.getBoundingClientRect().top -
      region.getBoundingClientRect().top -
      16;
    if (focus) target.focus({ preventScroll: true });
    setSelected(sectionId);
  };
  useEffect(() => {
    jump(initialSection ?? sections[0].id, false);
  }, [text, initialSection]);
  useEffect(() => {
    jump(selected, false);
  }, [view]);

  return (
    <StudioDialog
      title={`Scene Prompt — ${title}`}
      onClose={onClose}
      className="scene-prompt-dialog"
      size="wide"
      returnFocusRef={returnFocusRef}
      footer={
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="scene-prompt-toolbar">
        <p className="muted-text">
          {formatLabel} · {text.length.toLocaleString()} characters
        </p>
        <div className="studio-inline">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!text}
            onClick={onDownload}
          >
            <Download size={15} aria-hidden="true" /> Download Selected
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!text}
            onClick={() => void onCopy()}
          >
            <Copy size={15} aria-hidden="true" /> Copy Prompt
          </button>
        </div>
      </div>
      <div
        className="scene-prompt-presentations"
        role="group"
        aria-label="Prompt presentation"
      >
        {(['formatted', 'raw'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className="btn btn-secondary btn-sm"
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {value === 'raw' ? 'Raw' : 'Formatted'}
          </button>
        ))}
        {json && (
          <span className="muted-text">
            Complete JSON · source whitespace preserved
          </span>
        )}
      </div>
      <div className="scene-prompt-body">
        <nav className="scene-prompt-navigation" aria-label="Prompt sections">
          <h3>Sections</h3>
          <div className="scene-prompt-section-links">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                aria-current={selected === section.id ? 'location' : undefined}
                onClick={() => jump(section.id)}
              >
                {section.title}
              </button>
            ))}
          </div>
          <div className="scene-prompt-section-select">
            <label htmlFor={`${id}-section`}>Jump to prompt section</label>
            <select
              id={`${id}-section`}
              className="select"
              value={
                sections.some((s) => s.id === selected)
                  ? selected
                  : sections[0].id
              }
              onChange={(event) => jump(event.target.value)}
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </div>
        </nav>
        <div
          ref={viewport}
          onKeyDown={(event) => {
            if (
              (view === 'raw' || json) &&
              (event.ctrlKey || event.metaKey) &&
              event.key.toLowerCase() === 'a'
            ) {
              const content = viewport.current?.querySelector('pre');
              if (!content) return;
              event.preventDefault();
              const selection = window.getSelection(),
                range = document.createRange();
              range.selectNodeContents(content);
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          }}
          role="region"
          aria-label="Complete prompt text"
          tabIndex={0}
          className={`scene-prompt-viewport ${view === 'raw' || json ? 'scene-prompt-raw' : ''}`}
        >
          {!text ? (
            <p>No prompt text in this selected output.</p>
          ) : view === 'formatted' && !json ? (
            <FormattedPrompt text={text} anchors={anchors} headingLevel={3} />
          ) : (
            <pre>
              {text.split('\n').map((line, index, lines) => (
                <span
                  key={index}
                  id={anchors.get(index)}
                  tabIndex={anchors.has(index) ? -1 : undefined}
                >
                  {line}
                  {index < lines.length - 1 ? '\n' : ''}
                </span>
              ))}
            </pre>
          )}
        </div>
      </div>
    </StudioDialog>
  );
}
