import React, { useId, useState } from 'react';
import { Image as ImageIcon, Maximize2 } from 'lucide-react';
import type { MediaAsset } from '../types/domain';
import type { PromptSection } from '../domain/promptSections';
import type { StudioReference } from './ReferenceBoard';
import { MediaThumbnail } from './MediaThumbnail';
import { MediaPreviewDialog } from './MediaPreviewDialog';

export type OutputWorkspaceLayout = 'split' | 'tabs';

function SceneVisual({
  items,
  mediaMap,
  selected,
  onSelect,
}: {
  items: StudioReference[];
  mediaMap: Map<string, MediaAsset>;
  selected: string;
  onSelect: (key: string) => void;
}) {
  const id = useId(),
    [preview, setPreview] = useState(false);
  const first = items.find((item) => mediaMap.has(item.mediaId)) ?? items[0];
  const item = items.find((item) => item.key === selected) ?? first;
  const media = item ? mediaMap.get(item.mediaId) : undefined;
  const role = media?.isBundledIllustration
    ? 'Sample · Demo illustration'
    : item?.role === 'result'
      ? 'Result'
      : item?.role === 'sample'
        ? 'Sample'
        : 'Reference';
  return (
    <section className="output-scene-visual" aria-label="Scene Visual">
      <div className="output-section-heading">
        <h2>Scene Visual</h2>
        {item && <span className="badge">{role}</span>}
      </div>
      <div className="output-visual-surface">
        <MediaThumbnail
          media={media}
          altText={item?.altText || item?.sourceTitle}
          roleBadge={item ? role : undefined}
          emptyLabel="No scene media available. Add references or upload a result when ready."
        />
      </div>
      <div className="output-visual-controls">
        {items.length > 0 && (
          <div className="output-visual-picker">
            <label htmlFor={`${id}-visual`} className="form-label">
              Associated media
            </label>
            <select
              id={`${id}-visual`}
              className="select"
              value={item?.key ?? ''}
              onChange={(event) => onSelect(event.target.value)}
            >
              {items.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.role === 'result'
                    ? 'Result'
                    : option.role === 'sample'
                      ? 'Sample'
                      : 'Reference'}{' '}
                  · {option.label} · {option.sourceTitle}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!media}
          onClick={() => setPreview(true)}
        >
          <Maximize2 size={14} aria-hidden="true" /> Preview Media
        </button>
        <p className="muted-text output-visual-caption">
          {item
            ? `${item.label} · ${item.sourceTitle}`
            : 'Linked scene media will appear here.'}
        </p>
      </div>
      {preview && media && (
        <MediaPreviewDialog
          media={media}
          title={item?.sourceTitle ?? 'Scene visual'}
          altText={item?.altText}
          onClose={() => setPreview(false)}
        />
      )}
    </section>
  );
}

const TABS = ['Configuration', 'Preview', 'Sections', 'Tools'] as const;
export function SceneOutputWorkspace({
  layout,
  configuration,
  summary,
  actions,
  tools,
  sections,
  onSection,
  media,
  mediaMap,
}: {
  layout: OutputWorkspaceLayout;
  configuration: React.ReactNode;
  summary: React.ReactNode;
  actions: React.ReactNode;
  tools: React.ReactNode;
  sections: PromptSection[];
  onSection: (id: string) => void;
  media: StudioReference[];
  mediaMap: Map<string, MediaAsset>;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Configuration'),
    id = useId();
  const [selectedMedia, setSelectedMedia] = useState('');
  const visual = (
    <SceneVisual
      items={media}
      mediaMap={mediaMap}
      selected={selectedMedia}
      onSelect={setSelectedMedia}
    />
  );
  if (layout === 'split')
    return (
      <div className="output-split-view">
        {visual}
        <div className="output-configuration-column">
          <h2 className="output-panel-title">Output Configuration</h2>
          {configuration}
          {summary}
          {actions}
          {tools}
        </div>
      </div>
    );
  return (
    <div className="output-studio-tabs">
      <h2 className="output-panel-title">
        <ImageIcon size={17} aria-hidden="true" /> Output Studio
      </h2>
      <div
        className="tabs-bar output-inner-tabs"
        role="tablist"
        aria-label="Output studio"
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
            return;
          const buttons = [
              ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                '[role="tab"]'
              ),
            ],
            current = buttons.indexOf(event.target as HTMLButtonElement);
          if (current < 0) return;
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : (current +
                    (event.key === 'ArrowRight' ? 1 : -1) +
                    buttons.length) %
                  buttons.length;
          event.preventDefault();
          buttons[next].focus();
          buttons[next].click();
        }}
      >
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            className={`tab-btn ${tab === name ? 'active' : ''}`}
            id={`${id}-tab-${name}`}
            aria-controls={`${id}-panel-${name}`}
            aria-selected={tab === name}
            tabIndex={tab === name ? 0 : -1}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="output-studio-content">
        <div className="output-studio-panels">
          {TABS.map((name) => (
            <section
              key={name}
              role="tabpanel"
              id={`${id}-panel-${name}`}
              aria-labelledby={`${id}-tab-${name}`}
              hidden={tab !== name}
              className="output-studio-panel"
              tabIndex={0}
            >
              {name === 'Configuration' ? (
                configuration
              ) : name === 'Preview' ? (
                visual
              ) : name === 'Tools' ? (
                tools
              ) : (
                <div className="output-section-index">
                  <p className="muted-text">
                    Sections detected in the selected output. Open one to read
                    the complete prompt.
                  </p>
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onSection(section.id)}
                    >
                      {section.title}
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
        <aside className="output-studio-summary">
          {summary}
          {actions}
        </aside>
      </div>
    </div>
  );
}
