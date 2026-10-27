import React, { useMemo, useState } from 'react';
import { StudioDialog } from './StudioDialog';
import './libraryTagFilters.css';

const keyFor = (tag: string) => tag.trim().toLowerCase();
export const LibraryTagFilters: React.FC<{
  assets: ReadonlyArray<{ tags: string[] }>;
  selectedTags: string[];
  onToggle: (tag: string) => void;
}> = ({ assets, selectedTags, onToggle }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const tags = useMemo(() => {
    const counts = new Map<
      string,
      { key: string; label: string; count: number }
    >();
    for (const asset of assets) {
      const seen = new Set<string>();
      for (const raw of asset.tags) {
        const key = keyFor(raw);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const item = counts.get(key) ?? { key, label: raw.trim(), count: 0 };
        item.count++;
        counts.set(key, item);
      }
    }
    return [...counts.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label)
    );
  }, [assets]);
  const selected = new Set(selectedTags.map(keyFor));
  const top = tags.slice(0, 8);
  const visible = [
    ...top,
    ...tags.slice(8).filter((tag) => selected.has(tag.key)),
    ...selectedTags
      .filter((tag) => !tags.some((item) => item.key === keyFor(tag)))
      .map((tag) => ({ key: keyFor(tag), label: tag, count: 0 })),
  ];
  const remaining = tags.filter(
    (tag) => !visible.some((item) => item.key === tag.key)
  ).length;
  if (!tags.length && !selectedTags.length) return null;
  return (
    <>
      <div
        className="library-tag-filters"
        role="group"
        aria-label="Tag filters"
      >
        <span className="muted-text">Tags</span>
        {visible.map((tag) => (
          <button
            key={tag.key}
            type="button"
            className={`btn btn-sm ${selected.has(tag.key) ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={selected.has(tag.key)}
            onClick={() => onToggle(tag.label)}
          >
            <span className="library-tag-label">{tag.label}</span>
            <span className="library-tag-count">{tag.count}</span>
          </button>
        ))}
        {tags.length > 8 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-haspopup="dialog"
            onClick={() => {
              setQuery('');
              setOpen(true);
            }}
          >
            {remaining ? `+ ${remaining} more tags` : 'All tags'}
          </button>
        )}
      </div>
      {open && (
        <StudioDialog
          title="Filter by tags"
          onClose={() => setOpen(false)}
          footer={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          }
        >
          <label className="form-label" htmlFor="library-tag-search">
            Search tags
          </label>
          <input
            id="library-tag-search"
            type="search"
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p className="muted-text">
            Choose several tags to match any of them. Counts show prompts in
            this library view.
          </p>
          <div className="library-tag-picker">
            {tags
              .filter((tag) => tag.key.includes(keyFor(query)))
              .map((tag) => (
                <label key={tag.key}>
                  <input
                    type="checkbox"
                    checked={selected.has(tag.key)}
                    onChange={() => onToggle(tag.label)}
                  />
                  <span>{tag.label}</span>
                  <span className="library-tag-count">{tag.count}</span>
                </label>
              ))}
          </div>
          {!tags.some((tag) => tag.key.includes(keyFor(query))) && (
            <p role="status">No matching tags.</p>
          )}
        </StudioDialog>
      )}
    </>
  );
};
