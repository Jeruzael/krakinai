import { CollectionMembershipBadge } from '../components/CollectionMembershipBadge';
import { SceneBulkActions } from '../components/SceneBulkActions';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Edit3,
  ExternalLink,
  FolderPlus,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import { CATEGORY_LABELS } from '../domain/validation';
import type { MediaAsset, PromptCategory } from '../types/domain';
import { PromptCard } from '../components/PromptCard';
import { MediaThumbnail } from '../components/MediaThumbnail';
import { LibraryTagFilters } from '../components/LibraryTagFilters';
import {
  createDraftFromSavedScene,
  deleteSavedScene,
  toggleAssetFavorite,
  toggleVariantFavorite,
} from '../storage/db';
import { ORDERED_BUILDER_SLOTS } from '../domain/promptAssembler';

interface LibraryScreenProps {
  mode: 'all' | 'category' | 'favorites' | 'scenes';
  category?: PromptCategory;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  mode,
  category,
}) => {
  const {
    snapshot,
    browseState,
    updateBrowseState,
    navigate,
    copyText,
    applyAssetToScene,
    applyVariantToScene,
    refreshSnapshot,
    openCollectionModal,
    openConfirmDialog,
    closeConfirmDialog,
    showToast,
  } = useLibrary();

  const [scenesSearch, setScenesSearch] = useState('');
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(
    new Set()
  );
  useEffect(() => {
    setSelectedSceneIds(new Set());
  }, [mode, category]);
  useEffect(() => {
    setSelectedSceneIds((previous) => {
      const ids = new Set(snapshot?.scenes.map((scene) => scene.id) ?? []);
      const next = [...previous].filter((id) => ids.has(id));
      return next.length === previous.size ? previous : new Set(next);
    });
  }, [snapshot?.scenes]);

  useEffect(() => {
    if (browseState.scrollY > 0) {
      window.scrollTo({
        top: browseState.scrollY,
        behavior: 'instant' as ScrollBehavior,
      });
    }
  }, [browseState.scrollY]);

  const mediaMap = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const m of snapshot?.media ?? []) {
      map.set(m.id, m);
    }
    return map;
  }, [snapshot]);

  const baseAssets = useMemo(() => {
    if (!snapshot) return [];
    if (mode === 'category' && category) {
      return snapshot.assets.filter((a) => a.category === category);
    }
    if (mode === 'favorites') {
      return snapshot.assets.filter((a) => a.favorite);
    }
    return snapshot.assets;
  }, [snapshot, mode, category]);

  const favoriteVariants = useMemo(() => {
    if (!snapshot || mode !== 'favorites') return [];
    return snapshot.variants.filter((v) => v.favorite);
  }, [snapshot, mode]);

  const filteredAssets = useMemo(() => {
    const tokens = browseState.query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const matched = baseAssets.filter((a) => {
      if (
        browseState.reviewFilter !== 'all' &&
        a.reviewStatus !== browseState.reviewFilter
      ) {
        return false;
      }
      if (browseState.selectedTags.length > 0) {
        // OR within tag facet
        const hasAnyTag = browseState.selectedTags.some((tag) =>
          a.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
        );
        if (!hasAnyTag) return false;
      }
      if (tokens.length > 0) {
        const searchable = [
          a.title,
          a.description,
          a.promptText,
          a.compactText ?? '',
          a.tags.join(' '),
        ]
          .join(' ')
          .toLowerCase();
        return tokens.every((tok) => searchable.includes(tok));
      }
      return true;
    });

    return matched.sort((a, b) => {
      if (browseState.sortBy === 'az') {
        return a.title.localeCompare(b.title);
      }
      if (browseState.sortBy === 'newest') {
        return b.createdAt.localeCompare(a.createdAt);
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [baseAssets, browseState]);

  const filteredScenes = useMemo(() => {
    if (!snapshot || mode !== 'scenes') return [];
    const tokens = scenesSearch
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const matched = snapshot.scenes.filter((s) => {
      if (tokens.length === 0) return true;
      const hay = `${s.title} ${s.outputs.full} ${s.reviewNotes}`.toLowerCase();
      return tokens.every((tok) => hay.includes(tok));
    });
    return matched.sort((a, b) => {
      if (browseState.sortBy === 'az') return a.title.localeCompare(b.title);
      if (browseState.sortBy === 'newest')
        return b.createdAt.localeCompare(a.createdAt);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [snapshot, mode, scenesSearch, browseState.sortBy]);

  if (!snapshot) return null;

  const toggleTag = (tag: string) => {
    const exists = browseState.selectedTags.some(
      (t) => t.trim().toLowerCase() === tag.trim().toLowerCase()
    );
    const next = exists
      ? browseState.selectedTags.filter(
          (t) => t.trim().toLowerCase() !== tag.trim().toLowerCase()
        )
      : [...browseState.selectedTags, tag];
    updateBrowseState({ selectedTags: next, visibleCount: 24 });
  };

  const clearAllFilters = () => {
    updateBrowseState({
      query: '',
      selectedTags: [],
      reviewFilter: 'all',
      visibleCount: 24,
    });
  };

  if (mode === 'scenes') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h1 className="page-title">Saved Scenes</h1>
            <p className="muted-text" style={{ margin: '4px 0 0' }}>
              {filteredScenes.length} saved scene snapshot(s) — original prompts and assembled outputs preserved.
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={()=>navigate('/direct/new')}>Import Full Prompt</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/builder')}
          >
            <Plus size={16} /> Build New Scene
          </button>
        </div>

        <div
          className="card"
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="scenes-search" style={{ display: 'none' }}>
              Search saved scenes
            </label>
            <input
              id="scenes-search"
              className="input"
              placeholder="Search saved scenes by title, prompt text, or notes..."
              value={scenesSearch}
              onChange={(e) => setScenesSearch(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="scenes-sort" style={{ display: 'none' }}>
              Sort scenes
            </label>
            <select
              id="scenes-sort"
              className="select"
              value={browseState.sortBy}
              onChange={(e) =>
                updateBrowseState({
                  sortBy: e.target.value as 'updated' | 'newest' | 'az',
                })
              }
            >
              <option value="updated">Sort: Updated</option>
              <option value="newest">Sort: Newest</option>
              <option value="az">Sort: A–Z</option>
            </select>
          </div>
        </div>

        <SceneBulkActions
          selectedSceneIds={[...selectedSceneIds]}
          onClear={() => setSelectedSceneIds(new Set())}
          onChanged={refreshSnapshot}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            aria-label="Select all visible scenes"
            checked={
              filteredScenes.length > 0 &&
              filteredScenes.every((scene) => selectedSceneIds.has(scene.id))
            }
            onChange={(event) =>
              setSelectedSceneIds((previous) => {
                const next = new Set(previous);
                filteredScenes.forEach((scene) =>
                  event.target.checked
                    ? next.add(scene.id)
                    : next.delete(scene.id)
                );
                return next;
              })
            }
          />{' '}
          Select all visible scenes
        </label>
        {filteredScenes.length === 0 ? (
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 8 }}>
              No saved scenes found
            </h2>
            <p className="muted-text" style={{ margin: '0 0 14px' }}>
              {scenesSearch
                ? 'No saved scenes matched your search query.'
                : 'Assemble a scene in the Scene Builder and click "Save Scene" on the Prompt Output screen.'}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/builder')}
            >
              Open Scene Builder
            </button>
          </div>
        ) : (
          <div className="card-grid">
            {filteredScenes.map((scene) => {
              const resultMediaId = scene.resultMediaLinks[0]?.mediaId;
              const fallbackRefId = scene.references[0]?.mediaId;
              const previewMedia = resultMediaId
                ? mediaMap.get(resultMediaId)
                : fallbackRefId
                  ? mediaMap.get(fallbackRefId)
                  : undefined;

              const slotCount = ORDERED_BUILDER_SLOTS.filter((s) =>
                Boolean(scene.slots[s])
              ).length;

              return (
                <article key={scene.id} className="prompt-card">
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select scene ${scene.title}`}
                      checked={selectedSceneIds.has(scene.id)}
                      onChange={(event) =>
                        setSelectedSceneIds((previous) => {
                          const next = new Set(previous);
                          if (event.target.checked) next.add(scene.id);
                          else next.delete(scene.id);
                          return next;
                        })
                      }
                    />{' '}
                    Select scene
                  </label>
                  <div
                    className="prompt-card-media"
                    onClick={() => navigate(`/output/${scene.id}`)}
                  >
                    <MediaThumbnail
                      media={previewMedia}
                      altText={scene.title}
                      roleBadge={
                        resultMediaId ? 'Uploaded Result' : 'Reference Input'
                      }
                    />
                  </div>
                  <div className="prompt-card-body">
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span className="badge badge-primary">
                        {slotCount} slots
                      </span>
                      <span
                        className={`badge ${
                          scene.reviewStatus === 'user-approved'
                            ? 'badge-success'
                            : ''
                        }`}
                      >
                        {scene.reviewStatus === 'user-approved'
                          ? 'User-approved'
                          : 'Unreviewed'}
                      </span>
                    </div>
                    <CollectionMembershipBadge sceneId={scene.id} />
                    <h3
                      className="prompt-card-title"
                      onClick={() => navigate(`/output/${scene.id}`)}
                    >
                      {scene.title}
                    </h3>
                    <p className="prompt-card-excerpt clamped">
                      {scene.outputs.full}
                    </p>
                    <div className="prompt-card-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/output/${scene.id}`)}
                      >
                        <ExternalLink size={14} /> Open
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          const draft = await createDraftFromSavedScene(
                            scene.id
                          );
                          await refreshSnapshot();
                          showToast(
                            'Created editable draft copy from saved scene.',
                            'success'
                          );
                          navigate(`/builder/${draft.id}`);
                        }}
                      >
                        <Edit3 size={14} /> Edit a Copy
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => copyText(scene.outputs.full)}
                      >
                        <Copy size={14} /> Copy
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        aria-label="Add to Collection"
                        onClick={() =>
                          openCollectionModal({
                            type: 'scene',
                            id: scene.id,
                            title: scene.title,
                          })
                        }
                      >
                        <FolderPlus size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        aria-label={`Delete saved scene ${scene.title}`}
                        onClick={() =>
                          openConfirmDialog({
                            title: 'Delete Saved Scene?',
                            message: `Delete saved scene "${scene.title}"? Source library prompts will remain intact.`,
                            confirmLabel: 'Delete Scene',
                            danger: true,
                            onConfirm: async () => {
                              await deleteSavedScene(scene.id);
                              await refreshSnapshot();
                              closeConfirmDialog();
                              showToast('Deleted saved scene.', 'info');
                            },
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const heading =
    mode === 'category' && category
      ? CATEGORY_LABELS[category]
      : mode === 'favorites'
        ? 'Favorites'
        : 'All Prompts';

  const visibleAssets = filteredAssets.slice(0, browseState.visibleCount);
  const hasActiveFilters =
    browseState.query.trim() !== '' ||
    browseState.selectedTags.length > 0 ||
    browseState.reviewFilter !== 'all';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 className="page-title">{heading}</h1>
          <p className="muted-text" style={{ margin: '4px 0 0' }}>
            {filteredAssets.length} prompt item(s)
            {mode === 'favorites' &&
              favoriteVariants.length > 0 &&
              ` + ${favoriteVariants.length} favorite variant(s)`}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            navigate(
              category ? `/prompts/new?category=${category}` : '/prompts/new'
            )
          }
        >
          <Plus size={16} />{' '}
          {category ? `New ${CATEGORY_LABELS[category]}` : 'New Prompt'}
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: 16 }}>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="library-search-input" style={{ display: 'none' }}>
              Search prompts
            </label>
            <input
              id="library-search-input"
              className="input"
              placeholder="Search title, description, tags, and prompt text..."
              value={browseState.query}
              onChange={(e) =>
                updateBrowseState({ query: e.target.value, visibleCount: 24 })
              }
            />
          </div>

          <div>
            <label htmlFor="library-review-filter" style={{ display: 'none' }}>
              Review status filter
            </label>
            <select
              id="library-review-filter"
              className="select"
              value={browseState.reviewFilter}
              onChange={(e) =>
                updateBrowseState({
                  reviewFilter: e.target.value as
                    | 'all'
                    | 'user-approved'
                    | 'unreviewed',
                  visibleCount: 24,
                })
              }
            >
              <option value="all">Status: All</option>
              <option value="user-approved">Status: User-approved</option>
              <option value="unreviewed">Status: Unreviewed</option>
            </select>
          </div>

          <div>
            <label htmlFor="library-sort-select" style={{ display: 'none' }}>
              Sort order
            </label>
            <select
              id="library-sort-select"
              className="select"
              value={browseState.sortBy}
              onChange={(e) =>
                updateBrowseState({
                  sortBy: e.target.value as 'updated' | 'newest' | 'az',
                })
              }
            >
              <option value="updated">Sort: Updated</option>
              <option value="newest">Sort: Newest</option>
              <option value="az">Sort: A–Z</option>
            </select>
          </div>
        </div>

        <LibraryTagFilters
          assets={baseAssets}
          selectedTags={browseState.selectedTags}
          onToggle={toggleTag}
        />

        {hasActiveFilters && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid var(--border-subtle)',
              flexWrap: 'wrap',
            }}
          >
            <span className="muted-text" style={{ fontSize: 12 }}>
              Active filters:
            </span>
            {browseState.query.trim() && (
              <span className="badge badge-primary">
                Query: “{browseState.query.trim()}”
              </span>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={clearAllFilters}
              style={{ minHeight: 30, padding: '4px 10px' }}
            >
              <X size={13} /> Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Results Grid */}
      {visibleAssets.length === 0 && favoriteVariants.length === 0 ? (
        <div className="card">
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            {hasActiveFilters
              ? 'No prompts match your active filters'
              : 'No prompts in this view yet'}
          </h2>
          <p className="muted-text" style={{ margin: '0 0 14px' }}>
            {hasActiveFilters
              ? 'Try clearing your search query or selected tag filters.'
              : 'Create a new prompt card or load the starter library from Home or Settings.'}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearAllFilters}
            >
              Clear Filters
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                navigate(
                  category
                    ? `/prompts/new?category=${category}`
                    : '/prompts/new'
                )
              }
            >
              <Plus size={16} /> Create Prompt
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="card-grid">
            {visibleAssets.map((asset) => (
              <PromptCard
                key={asset.id}
                item={asset}
                kind="asset"
                mediaMap={mediaMap}
                onOpen={() => {
                  updateBrowseState({ scrollY: window.scrollY });
                  navigate(`/prompts/${asset.id}`);
                }}
                onCopy={() => copyText(asset.promptText)}
                onToggleFavorite={async () => {
                  await toggleAssetFavorite(asset.id);
                  await refreshSnapshot();
                }}
                onAddToScene={() => applyAssetToScene(asset)}
              />
            ))}

            {mode === 'favorites' &&
              favoriteVariants.map((variant) => (
                <PromptCard
                  key={variant.id}
                  item={variant}
                  kind="variant"
                  mediaMap={mediaMap}
                  onOpen={() => {
                    updateBrowseState({ scrollY: window.scrollY });
                    navigate(`/variants/${variant.id}`);
                  }}
                  onCopy={() => copyText(variant.promptText)}
                  onToggleFavorite={async () => {
                    await toggleVariantFavorite(variant.id);
                    await refreshSnapshot();
                  }}
                  onAddToScene={() => applyVariantToScene(variant)}
                />
              ))}
          </div>

          {filteredAssets.length > browseState.visibleCount && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  updateBrowseState({
                    visibleCount: browseState.visibleCount + 24,
                  })
                }
              >
                Load More ({filteredAssets.length - browseState.visibleCount}{' '}
                remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
