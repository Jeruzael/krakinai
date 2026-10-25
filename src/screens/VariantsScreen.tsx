import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Heart,
  Lock,
  Plus,
  PlusCircle,
} from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import { SLOT_LABELS } from '../domain/validation';
import type { MediaAsset, VariantType } from '../types/domain';
import { MediaThumbnail } from '../components/MediaThumbnail';
import { toggleVariantFavorite } from '../storage/db';
import './characterStudio.css';

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
  const { snapshot, navigate, copyText, applyVariantToScene, refreshSnapshot } =
    useLibrary();

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
    <div className="character-studio character-studio-variants">
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
        <div className="character-studio-breadcrumb">
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
      <div className="card character-studio-parent">
        <button
          type="button"
          className="character-studio-parent-preview"
          aria-label={`Open ${character.title}`}
          onClick={() => navigate(`/prompts/${character.id}`)}
        >
          <MediaThumbnail media={charMedia} altText={character.title} />
        </button>
        <div className="character-studio-parent-context">
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
          <p className="character-studio-layer-note">
            Choose a changed layer below. The parent identity stays unchanged.
          </p>
          <details className="character-studio-prompt-details">
            <summary>View full base identity</summary>
            <div
              className="character-studio-prompt-content"
              tabIndex={0}
              role="region"
              aria-label="Complete base identity"
            >
              <strong>
                Base identity prompt · Preserved verbatim in scenes
              </strong>
              <p className="character-studio-full-text">
                {character.promptText}
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => copyText(character.promptText)}
              >
                <Copy size={14} /> Copy Base Identity
              </button>
            </div>
          </details>
        </div>
      </div>

      {/* Type Filters & Search */}
      <div className="card character-studio-filters">
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
              aria-pressed={typeFilter === 'All'}
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
                  aria-pressed={typeFilter === vt}
                  onClick={() => setTypeFilter(vt)}
                >
                  {vt} ({count})
                </button>
              );
            })}
          </div>

          <div className="character-studio-search">
            <input
              className="input"
              aria-label="Search variants"
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
        <div className="character-studio-variant-grid">
          {filteredVariants.map((variant) => {
            const coverId =
              variant.coverMediaId || variant.mediaLinks[0]?.mediaId;
            const coverLink = variant.mediaLinks.find(
              (link) => link.mediaId === coverId
            );
            const excerpt =
              variant.promptText.length > 140
                ? `${variant.promptText.slice(0, 140)}…`
                : variant.promptText;
            return (
              <article
                key={variant.id}
                className="prompt-card character-studio-variant-card"
                aria-label={variant.title}
              >
                <div className="character-studio-variant-media">
                  <button
                    type="button"
                    className="character-studio-variant-preview"
                    aria-label={`Open ${variant.title}`}
                    onClick={() => navigate(`/variants/${variant.id}`)}
                  >
                    <MediaThumbnail
                      media={coverId ? mediaMap.get(coverId) : undefined}
                      altText={coverLink?.altText || variant.title}
                    />
                  </button>
                  <button
                    type="button"
                    className="icon-btn character-studio-variant-favorite"
                    aria-label={
                      variant.favorite
                        ? `Remove ${variant.title} from favorites`
                        : `Add ${variant.title} to favorites`
                    }
                    aria-pressed={variant.favorite}
                    onClick={async () => {
                      await toggleVariantFavorite(variant.id);
                      await refreshSnapshot();
                    }}
                  >
                    <Heart
                      size={18}
                      fill={variant.favorite ? 'currentColor' : 'none'}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <div className="prompt-card-body">
                  <div className="character-studio-inline-actions">
                    <span className="badge badge-primary">
                      {variant.type} Variant
                    </span>
                    {variant.reviewStatus === 'user-approved' && (
                      <span className="badge badge-success">User-approved</span>
                    )}
                  </div>
                  <h3 className="character-studio-variant-title">
                    {variant.title}
                  </h3>
                  <p className="character-studio-slot-label">
                    {SLOT_LABELS[variant.targetSlot]}
                  </p>
                  <p className="prompt-card-excerpt character-studio-excerpt">
                    {excerpt}
                  </p>
                  {variant.tags.length > 0 && (
                    <div className="tag-list">
                      {variant.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="badge">
                          {tag}
                        </span>
                      ))}
                      {variant.tags.length > 3 && (
                        <span className="badge">
                          +{variant.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="prompt-card-actions character-studio-variant-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/variants/${variant.id}`)}
                    >
                      <ExternalLink size={14} /> Open
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyText(variant.promptText)}
                    >
                      <Copy size={14} /> Copy
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm character-studio-use-variant"
                      onClick={() => applyVariantToScene(variant)}
                    >
                      <PlusCircle size={14} /> Use in Scene
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
};
