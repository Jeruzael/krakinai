import React, { useId, useMemo, useRef, useState } from 'react';
import type { MediaAsset } from '../types/domain';
import { StudioDialog } from './StudioDialog';
import { MediaThumbnail } from './MediaThumbnail';
import { saveMediaAsset } from '../storage/db';
import { validateMediaCandidate } from '../domain/validation';
import { getMediaDisplayName } from '../domain/mediaNaming';
import './collectionCoverPicker.css';

const tabs = ['project', 'all', 'covers'] as const;
type Tab = (typeof tabs)[number];
const labels: Record<Tab, string> = {
  project: 'Project Media',
  all: 'All Images',
  covers: 'Covers',
};
const PAGE_SIZE = 24;
export const CollectionCoverPicker: React.FC<{
  media: MediaAsset[];
  currentId?: string | null;
  projectMediaIds?: readonly string[];
  coverMediaIds?: readonly string[];
  onSelect: (id: string | null) => void;
  onClose: () => void;
  onUploaded: () => Promise<unknown>;
  saveActionLabel?: string;
}> = ({
  media,
  currentId,
  projectMediaIds = [],
  coverMediaIds = [],
  onSelect,
  onClose,
  onUploaded,
  saveActionLabel = 'Save Project',
}) => {
  const prefix = useId(),
    tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({}),
    busyRef = useRef(false);
  const [tab, setTab] = useState<Tab>('project'),
    [search, setSearch] = useState(''),
    [requestedPage, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState(currentId),
    [uploads, setUploads] = useState<MediaAsset[]>([]);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const allMedia = useMemo(
    () => new Map([...media, ...uploads].map((item) => [item.id, item])),
    [media, uploads]
  );
  const images = [...allMedia.values()].filter((item) =>
    item.mimeType.startsWith('image/')
  );
  const imageMap = new Map(images.map((item) => [item.id, item]));
  const resolve = (ids: readonly string[]) =>
    [...new Set(ids)]
      .map((id) => imageMap.get(id))
      .filter((item): item is MediaAsset => !!item);
  const scopes: Record<Tab, MediaAsset[]> = {
    project: resolve(projectMediaIds),
    all: images,
    covers: resolve([
      ...uploads.map((item) => item.id),
      ...coverMediaIds,
      ...(currentId ? [currentId] : []),
    ]),
  };
  const query = search.normalize('NFC').trim().toLocaleLowerCase();
  const filtered = scopes[tab].filter(
    (item) =>
      !query ||
      `${getMediaDisplayName(item)}\n${item.filename}`
        .normalize('NFC')
        .toLocaleLowerCase()
        .includes(query)
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
    page = Math.min(requestedPage, pages - 1),
    visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const missingProjectCount = [...new Set(projectMediaIds)].filter(
    (id) => !allMedia.has(id)
  ).length;
  const selectTab = (value: Tab) => {
    setTab(value);
    setPage(0);
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget,
      file = input.files?.[0];
    if (!file || busyRef.current) return;
    setError('');
    const check = validateMediaCandidate({
      name: file.name,
      type: file.type,
      size: file.size,
      existingCount: 0,
      currentTotalBytes: [...allMedia.values()].reduce(
        (n, m) => n + m.byteSize + (m.posterBlob?.size ?? 0),
        0
      ),
    });
    if (!check.valid || check.kind !== 'image') {
      setError(check.error || 'Choose an image file.');
      input.value = '';
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const saved = await saveMediaAsset({
        filename: file.name,
        mimeType: file.type,
        blob: file,
      });
      setUploads((previous) => [saved, ...previous]);
      setSelectedId(saved.id);
      setSearch('');
      selectTab('covers');
      await onUploaded();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      busyRef.current = false;
      setBusy(false);
      input.value = '';
    }
  };
  return (
    <StudioDialog
      title="Choose Collection Cover"
      size="wide"
      className="cover-picker-dialog"
      onClose={() => {
        if (!busyRef.current) onClose();
      }}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => {
              onSelect(null);
              onClose();
            }}
          >
            Remove Cover
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !selectedId || !imageMap.has(selectedId)}
            onClick={() => {
              if (selectedId) {
                onSelect(selectedId);
                onClose();
              }
            }}
          >
            Use Cover
          </button>
        </>
      }
    >
      <div className="cover-picker-intro">
        <p>
          Choose a cover, then use <strong>{saveActionLabel}</strong> in the
          project editor to commit it. Cancel leaves your previous selection
          unchanged.
        </p>
        <p className="muted-text">
          Uploads are stored immediately. Cancelling keeps uploaded images in
          All Images.
        </p>
      </div>
      {currentId && !allMedia.has(currentId) && (
        <p role="status" className="cover-picker-warning">
          Current cover is missing ({currentId}).
        </p>
      )}
      {currentId && allMedia.has(currentId) && !imageMap.has(currentId) && (
        <p role="status" className="cover-picker-warning">
          The current cover is not an image. Keep it by cancelling or explicitly
          choose an image.
        </p>
      )}
      <div className="cover-picker-tools">
        <label htmlFor={`${prefix}-search`}>
          Search images
          <input
            id={`${prefix}-search`}
            type="search"
            className="input"
            aria-label="Search cover images"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="cover-picker-upload" htmlFor={`${prefix}-upload`}>
          Upload new cover image
          <input
            id={`${prefix}-upload`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(event) => void upload(event)}
          />
        </label>
      </div>
      {busy && <p aria-live="polite">Saving cover image…</p>}
      {error && <p role="alert">{error}</p>}
      <div
        className="cover-picker-tabs"
        role="tablist"
        aria-label="Cover image sources"
      >
        {tabs.map((item) => (
          <button
            key={item}
            ref={(element) => {
              tabRefs.current[item] = element;
            }}
            type="button"
            role="tab"
            id={`${prefix}-${item}`}
            aria-controls={`${prefix}-gallery`}
            aria-selected={tab === item}
            tabIndex={tab === item ? 0 : -1}
            onClick={() => selectTab(item)}
            onKeyDown={(event) => {
              const index = tabs.indexOf(item);
              let next: Tab | undefined;
              if (event.key === 'ArrowRight')
                next = tabs[(index + 1) % tabs.length];
              if (event.key === 'ArrowLeft')
                next = tabs[(index + tabs.length - 1) % tabs.length];
              if (event.key === 'Home') next = tabs[0];
              if (event.key === 'End') next = tabs.at(-1);
              if (next) {
                event.preventDefault();
                selectTab(next);
                tabRefs.current[next]?.focus();
              }
            }}
          >
            {labels[item]} <span>({scopes[item].length})</span>
          </button>
        ))}
      </div>
      <p className="cover-picker-scope muted-text">
        {tab === 'project'
          ? 'Saved scene results and references, followed by other explicitly linked project images.'
          : tab === 'covers'
            ? 'Images used as collection covers and covers uploaded in this session.'
            : 'Every stored image remains available here.'}
        {tab === 'project' && missingProjectCount > 0
          ? ` ${missingProjectCount} linked media file(s) unavailable.`
          : ''}
      </p>
      <section
        role="tabpanel"
        id={`${prefix}-gallery`}
        aria-labelledby={`${prefix}-${tab}`}
        className="cover-picker-browser"
      >
        {visible.length ? (
          <ul className="cover-picker-grid" aria-label="Cover images">
            {visible.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`cover-picker-choice ${selectedId === item.id ? 'selected' : ''}`}
                  disabled={busy}
                  aria-label={`Use ${getMediaDisplayName(item)} as cover`}
                  aria-describedby={`${prefix}-file-${item.id}`}
                  aria-pressed={selectedId === item.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="cover-picker-thumbnail">
                    <MediaThumbnail
                      media={item}
                      altText={getMediaDisplayName(item)}
                    />
                    {selectedId === item.id && (
                      <span className="cover-picker-selected">Selected</span>
                    )}
                  </span>
                  <span
                    className="cover-picker-name"
                    title={getMediaDisplayName(item)}
                  >
                    {getMediaDisplayName(item)}
                  </span>
                  <small
                    className="cover-picker-filename"
                    id={`${prefix}-file-${item.id}`}
                    title={item.filename}
                  >
                    Original filename: {item.filename}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="cover-picker-empty">
            <p>
              {search
                ? 'No images match your search.'
                : tab === 'project'
                  ? 'No project images available yet. Choose All Images or upload a cover.'
                  : 'No images in this group yet.'}
            </p>
          </div>
        )}
      </section>
      <div className="cover-picker-pagination">
        <p aria-live="polite">
          {filtered.length
            ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length} images`
            : '0 images'}{' '}
          · Page {page + 1} of {pages}
        </p>
        <div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label="Previous page"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label="Next page"
            disabled={page === pages - 1}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </StudioDialog>
  );
};
