import React, { useMemo, useState } from 'react';
import {
  Camera,
  Clapperboard,
  Film,
  HardDrive,
  Palette,
  Plus,
  Search,
  Shirt,
  Sparkles,
  Sun,
  TreePine,
  UserPlus,
} from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import { CATEGORY_LABELS } from '../domain/validation';
import type { MediaAsset, PromptCategory } from '../types/domain';
import { PromptCard } from '../components/PromptCard';
import { toggleAssetFavorite } from '../storage/db';

const CATEGORY_TILES: Array<{
  id: PromptCategory;
  label: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'characters',
    label: 'Characters',
    desc: 'Base identities & reference portraits',
    icon: <UserPlus size={20} color="#2563EB" />,
  },
  {
    id: 'wardrobe',
    label: 'Clothing & Accessories',
    desc: 'Outfits, footwear & accessories',
    icon: <Shirt size={20} color="#0284C7" />,
  },
  {
    id: 'actions',
    label: 'Actions & Emotions',
    desc: 'Movement, gestures & expressions',
    icon: <Sparkles size={20} color="#4F46E5" />,
  },
  {
    id: 'environments',
    label: 'Environments',
    desc: 'Locations, interiors & settings',
    icon: <TreePine size={20} color="#0D9488" />,
  },
  {
    id: 'camera',
    label: 'Camera & Cinematography',
    desc: 'Framing, lenses & camera motion',
    icon: <Camera size={20} color="#7C3AED" />,
  },
  {
    id: 'lighting',
    label: 'Lighting & Mood',
    desc: 'Key light, time of day & atmosphere',
    icon: <Sun size={20} color="#D97706" />,
  },
  {
    id: 'styles',
    label: 'Art Styles',
    desc: 'Live-action, 3D & 2D aesthetics',
    icon: <Palette size={20} color="#E11D48" />,
  },
];

export const HomeScreen: React.FC = () => {
  const {
    snapshot,
    navigate,
    updateBrowseState,
    loadStarterData,
    copyText,
    applyAssetToScene,
    refreshSnapshot,
    setIsSettingsOpen,
  } = useLibrary();

  const [searchInput, setSearchInput] = useState('');

  const mediaMap = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const m of snapshot?.media ?? []) {
      map.set(m.id, m);
    }
    return map;
  }, [snapshot]);

  if (!snapshot) return null;

  const recentAssets = [...snapshot.assets]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);

  const recentScenes = [...snapshot.scenes]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);

  const recentDrafts = [...snapshot.drafts]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 2);

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateBrowseState({ query: searchInput, visibleCount: 24 });
    navigate('/library');
  };

  const isEmptyLibrary =
    snapshot.assets.length === 0 && snapshot.scenes.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Hero Banner */}
      <section
        className="card"
        style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #EFF6FF 100%)',
          padding: 28,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
          }}
        >
          <div style={{ maxWidth: 680 }}>
            <span className="badge badge-primary" style={{ marginBottom: 10 }}>
              KRAKINAI • Local-First Visual Prompt Library
            </span>
            <h1 className="page-title" style={{ marginBottom: 8 }}>
              Your reusable video creation toolkit.
            </h1>
            <p className="muted-text" style={{ margin: '0 0 18px', fontSize: 15 }}>
              Save character identities, layer wardrobe and action variants, and
              assemble structured single-shot video prompts with reference
              checklists for your external AI tools.
            </p>

            <form
              onSubmit={handleGlobalSearch}
              style={{
                display: 'flex',
                gap: 8,
                maxWidth: 540,
                marginBottom: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 220 }}>
                <label htmlFor="home-global-search" className="sr-only" style={{ display: 'none' }}>
                  Search prompts
                </label>
                <input
                  id="home-global-search"
                  className="input"
                  placeholder="Search characters, prompts, tags (e.g. 'cafe', '50mm')..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary">
                <Search size={16} /> Search
              </button>
            </form>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/prompts/new?category=characters')}
              >
                <UserPlus size={16} /> Create Character
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/prompts/new')}
              >
                <Plus size={16} /> New Prompt
              </button>
              <button
                type="button"
                className="btn btn-tint"
                onClick={() => navigate('/builder')}
              >
                <Clapperboard size={16} /> Build Scene
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* First-Run Onboarding / Starter Library Callout */}
      {isEmptyLibrary && (
        <section className="card" style={{ borderStyle: 'dashed' }}>
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            Start with your first character or load the demo starter library
          </h2>
          <p className="muted-text" style={{ margin: '0 0 16px' }}>
            Your library is currently empty. Create your own character with a
            reference image, or load the optional illustrative starter library
            (21 prompt components across all 7 categories, 6 Maya variants, 3
            collections, and 4 templates).
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/prompts/new?category=characters')}
            >
              <UserPlus size={16} /> Create First Character
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadStarterData()}
            >
              Load Starter Library (Demo / Illustrative)
            </button>
          </div>
        </section>
      )}

      {/* Browse by Category (7 Categories + Saved Scenes Tile) */}
      <section>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <h2 className="section-title">Browse by Category</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/library')}
          >
            View All Prompts ({snapshot.assets.length})
          </button>
        </div>

        <div className="category-tile-grid">
          {CATEGORY_TILES.map((tile) => {
            const count = snapshot.assets.filter(
              (a) => a.category === tile.id
            ).length;
            return (
              <button
                key={tile.id}
                type="button"
                className="category-tile"
                onClick={() => navigate(`/library/${tile.id}`)}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                  }}
                >
                  {tile.icon}
                  <span className="badge">{count}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {CATEGORY_LABELS[tile.id]}
                </div>
                <div className="muted-text" style={{ fontSize: 12 }}>
                  {tile.desc}
                </div>
              </button>
            );
          })}

          <button
            type="button"
            className="category-tile"
            onClick={() => navigate('/scenes')}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              <Film size={20} color="#0F172A" />
              <span className="badge">{snapshot.scenes.length}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Saved Scenes</div>
            <div className="muted-text" style={{ fontSize: 12 }}>
              Assembled shot outputs & result reviews
            </div>
          </button>
        </div>
      </section>

      {/* Recent Prompts */}
      <section>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <h2 className="section-title">Recent Prompts</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/library')}
          >
            View All
          </button>
        </div>

        {recentAssets.length === 0 ? (
          <div className="card">
            <p className="muted-text" style={{ margin: 0 }}>
              No saved prompts yet. Click “Create Character” or “Load Starter
              Library” above to get started.
            </p>
          </div>
        ) : (
          <div className="card-grid">
            {recentAssets.map((asset) => (
              <PromptCard
                key={asset.id}
                item={asset}
                kind="asset"
                mediaMap={mediaMap}
                onOpen={() => navigate(`/prompts/${asset.id}`)}
                onCopy={() => copyText(asset.promptText)}
                onToggleFavorite={async () => {
                  await toggleAssetFavorite(asset.id);
                  await refreshSnapshot();
                }}
                onAddToScene={() => applyAssetToScene(asset)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent Scenes & Active Drafts */}
      <section>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <h2 className="section-title">Recent Scenes & Drafts</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/scenes')}
          >
            View Saved Scenes
          </button>
        </div>

        {recentScenes.length === 0 && recentDrafts.length === 0 ? (
          <div className="card">
            <p className="muted-text" style={{ margin: '0 0 12px' }}>
              No scenes assembled yet. Combine a character, environment, and
              action in the Scene Builder or start from a Template.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/builder')}
              >
                Open Scene Builder
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/templates')}
              >
                Browse Templates
              </button>
            </div>
          </div>
        ) : (
          <div className="card-grid">
            {recentDrafts.map((draft) => (
              <div key={draft.id} className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <span className="badge badge-warning">Scene Draft</span>
                  <span className="muted-text" style={{ fontSize: 12 }}>
                    Rev {draft.inputRevision}
                  </span>
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>
                  {draft.title || 'Untitled Draft'}
                </h3>
                <p className="muted-text" style={{ fontSize: 13 }}>
                  {Object.keys(draft.slots).length} component slot(s) selected
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/builder/${draft.id}`)}
                >
                  Continue Draft
                </button>
              </div>
            ))}

            {recentScenes.map((scene) => (
              <div key={scene.id} className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <span className="badge badge-success">Saved Scene</span>
                  {scene.reviewStatus === 'user-approved' && (
                    <span className="badge badge-primary">User-approved</span>
                  )}
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>
                  {scene.title}
                </h3>
                <p
                  className="muted-text"
                  style={{
                    fontSize: 13,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {scene.outputs.full}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate(`/output/${scene.id}`)}
                  >
                    Open Output
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Persistent Local Storage Disclosure */}
      <div className="banner banner-info" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HardDrive size={18} />
          <span style={{ fontSize: 13 }}>
            <strong>Stored on this browser. Not synced.</strong> Local storage
            is not cloud sync or an automatic backup; another browser or app URL
            has a separate library.
          </span>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setIsSettingsOpen(true)}
        >
          Backup / Restore (.zip)
        </button>
      </div>
    </div>
  );
};
