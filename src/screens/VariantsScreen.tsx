import React, { useMemo, useState } from 'react';
import { ArrowLeft, Lock, Plus, PlusCircle } from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import { SLOT_LABELS, VARIANT_TYPE_TO_SLOT } from '../domain/validation';
import type { MediaAsset, VariantType } from '../types/domain';
import { PromptCard } from '../components/PromptCard';
import { MediaThumbnail } from '../components/MediaThumbnail';
import { toggleVariantFavorite } from '../storage/db';

const VARIANT_TYPES: VariantType[] = [
  'Outfit',
  'Expression',
  'Pose',
  'Camera Angle',
  'Location',
  'Visual Style',
];

export const VariantsScreen: React.FC<{ characterId: string }> = ({
  characterId,
}) => {
  const {
    snapshot,
    navigate,
    copyText,
    applyVariantToScene,
    refreshSnapshot,
  } = useLibrary();

  const [typeFilter, setTypeFilter] = useState<'All' | VariantType>('All');
  const [search, setSearch] = useState('');

  const mediaMap = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const m of snapshot?.media ?? []) {
      map.set(m.id, m);
    }
    return map;
  }, [snapshot]);

  if (!snapshot) return null;

  const character = snapshot.assets.find(
    (a) => a.id === characterId && a.category === 'characters'
  );

  if (!character) {
    return (
      <div className="card">
        <h1 className="section-title">Character not found</h1>
        <p className="muted-text">
          This character record is no longer available.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/library/characters')}
        >
          Back to Characters
        </button>
      </div>
    );
  }

  const allCharVariants = snapshot.variants.filter(
    (v) => v.parentCharacterId === character.id
  );

  const filteredVariants = allCharVariants.filter((v) => {
    if (typeFilter !== 'All' && v.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        v.title.toLowerCase().includes(q) ||
        v.promptText.toLowerCase().includes(q) ||
        v.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const charCoverId =
    character.coverMediaId || character.mediaLinks[0]?.mediaId;
  const charMedia = charCoverId ? mediaMap.get(charCoverId) : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/prompts/${character.id}`)}
          >
            <ArrowLeft size={15} /> Back to {character.title}
          </button>
          <h1 className="page-title">Variants</h1>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate(`/characters/${character.id}/variants/new`)}
        >
          <Plus size={16} /> + Add Variant
        </button>
      </div>

      {/* Parent Character & Locked Identity Context */}
      <div className="card">
        <div
          style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 12,
                overflow: 'hidden',
                flexShrink: 0,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <MediaThumbnail media={charMedia} altText={character.title} />
            </div>
            <div>
              <span className="badge badge-primary">
                <Lock size={12} /> Locked Base Identity (Rev {character.revision})
              </span>
              <h2 className="section-title" style={{ margin: '6px 0 4px' }}>
                {character.title}
              </h2>
              <p className="muted-text" style={{ margin: 0, fontSize: 12 }}>
                Identity locking protects text reuse inside the app. It does not
                guarantee an external model’s output.
              </p>
            </div>
          </div>

          <div
            style={{
              background: '#F8FAFC',
              padding: 14,
              borderRadius: 10,
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text-muted)',
                marginBottom: 4,
              }}
            >
              BASE IDENTITY PROMPT (PRESERVED VERBATIM IN SCENES):
            </div>
            <p style={{ margin: 0, fontSize: 14 }}>{character.promptText}</p>
          </div>
        </div>
      </div>

      {/* Type Filters & Search */}
      <div className="card" style={{ padding: 16 }}>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn btn-sm ${
                typeFilter === 'All' ? 'btn-primary' : 'btn-secondary'
              }`}
              onClick={() => setTypeFilter('All')}
            >
              All ({allCharVariants.length})
            </button>
            {VARIANT_TYPES.map((vt) => {
              const count = allCharVariants.filter((v) => v.type === vt).length;
              return (
                <button
                  key={vt}
                  type="button"
                  className={`btn btn-sm ${
                    typeFilter === vt ? 'btn-primary' : 'btn-secondary'
                  }`}
                  onClick={() => setTypeFilter(vt)}
                >
                  {vt} ({count})
                </button>
              );
            })}
          </div>

          <div style={{ minWidth: 220 }}>
            <input
              className="input"
              placeholder="Search variants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Variants Grid */}
      {filteredVariants.length === 0 ? (
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: 8 }}>
            No variants for this filter yet
          </h3>
          <p className="muted-text" style={{ margin: '0 0 14px' }}>
            Add an Outfit, Expression, Pose, Camera Angle, Location, or Visual
            Style layer linked to {character.title}.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate(`/characters/${character.id}/variants/new`)}
          >
            <Plus size={16} /> + Add Variant
          </button>
        </div>
      ) : (
        <div className="card-grid">
          {filteredVariants.map((variant) => (
            <PromptCard
              key={variant.id}
              item={variant}
              kind="variant"
              mediaMap={mediaMap}
              onOpen={() => navigate(`/variants/${variant.id}`)}
              onCopy={() => copyText(variant.promptText)}
              onToggleFavorite={async () => {
                await toggleVariantFavorite(variant.id);
                await refreshSnapshot();
              }}
              onAddToScene={() => applyVariantToScene(variant)}
              extraAction={
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%' }}
                  onClick={() => applyVariantToScene(variant)}
                >
                  <PlusCircle size={14} /> Use in Scene
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
