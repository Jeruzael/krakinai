import React, { useState, useEffect } from 'react';
import type { Story, StoryAct } from '../types/domain';
import { useLibrary } from '../context/LibraryContext';
import { getStory, saveStory, toggleStoryFavorite } from '../storage/stories';
import { StoryCreatorMode } from '../components/stories/StoryCreatorMode';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  ExternalLink,
  Film,
  Heart,
  Layers,
  Palette,
  Sparkles,
  User,
} from 'lucide-react';

export interface StoryWorkspaceScreenProps {
  storyId: string;
}

export const StoryWorkspaceScreen: React.FC<StoryWorkspaceScreenProps> = ({ storyId }) => {
  const { snapshot, navigate, showToast, refreshSnapshot } = useLibrary();
  const [story, setStory] = useState<Story | null>(() => {
    return snapshot?.stories?.find((s) => s.id === storyId) || null;
  });
  const [activeTab, setActiveTab] = useState<'book' | 'creator'>('book');
  const [treatmentExpanded, setTreatmentExpanded] = useState(true);
  const [loading, setLoading] = useState(!story);
  const [editingProse, setEditingProse] = useState(false);
  const [proseDraft, setProseDraft] = useState(() => story?.fullBookText || '');

  useEffect(() => {
    if (story) setProseDraft(story.fullBookText || '');
  }, [story?.id]);

  useEffect(() => {
    let active = true;
    getStory(storyId).then((res) => {
      if (active && res) {
        setStory(res);
        setLoading(false);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [storyId]);

  if (loading && !story) {
    return (
      <div className="card" role="status" style={{ padding: 32, textAlign: 'center' }}>
        <p className="muted-text">Loading story workspace...</p>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <h2>Story Not Found</h2>
        <p className="muted-text">The requested story could not be loaded.</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/stories')} style={{ marginTop: 16 }}>
          Return to Stories
        </button>
      </div>
    );
  }

  const handleFavoriteToggle = async () => {
    try {
      await toggleStoryFavorite(story.id);
      setStory((prev) => prev ? { ...prev, favorite: !prev.favorite } : null);
      await refreshSnapshot();
      showToast(story.favorite ? 'Removed from favorites' : 'Added to favorites');
    } catch (err: any) {
      showToast(err.message || 'Failed to update favorite', 'error');
    }
  };

  // Resolve reference pack assets, variants, media
  const referencedAssets = (story.referencePack?.assetIds || [])
    .map((aid) => snapshot?.assets.find((a) => a.id === aid))
    .filter(Boolean);

  const referencedVariants = (story.referencePack?.variantIds || [])
    .map((vid) => snapshot?.variants.find((v) => v.id === vid))
    .filter(Boolean);

  const pairedCollection = snapshot?.collections.find(
    (c) => c.id === story.linkedCollectionId
  );

  return (
    <div className="story-workspace-screen" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Bar Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => navigate('/stories')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={16} />
          <span>Back to Stories</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className={`btn ${story.favorite ? 'btn-danger' : 'btn-outline'}`}
            onClick={handleFavoriteToggle}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Heart size={16} fill={story.favorite ? 'currentColor' : 'none'} />
            <span>{story.favorite ? 'Favorited' : 'Favorite'}</span>
          </button>
        </div>
      </div>

      {/* Hero Banner & Metadata */}
      <div className="card story-hero-banner" style={{ padding: 24, background: '#1e293b', color: '#f8fafc', borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>
                Rev {story.revisionNumber}
              </span>
              {story.archivedAt && (
                <span className="badge" style={{ background: '#94a3b8', color: '#0f172a' }}>
                  Archived
                </span>
              )}
            </div>

            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: '#ffffff' }}>
              {story.title}
            </h1>

            <p style={{ margin: '8px 0 0', fontSize: '1.05rem', color: '#94a3b8' }}>
              By {story.author || 'Anonymous'}
            </p>

            {story.logline && (
              <p style={{ margin: '12px 0 0', fontSize: '0.95rem', color: '#cbd5e1', fontStyle: 'italic', maxWidth: 700 }}>
                "{story.logline}"
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16, fontSize: '0.85rem', color: '#94a3b8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={14} />
                <span>Created {new Date(story.createdAt).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={14} />
                <span>Updated {new Date(story.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {pairedCollection && (
            <div className="card" style={{ background: '#0f172a', border: '1px solid #334155', padding: 16, minWidth: 240 }}>
              <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>
                Paired Storyboard Project
              </div>
              <a
                href={`#/collections/${pairedCollection.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/collections/${pairedCollection.id}`);
                }}
                style={{ color: '#60a5fa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
              >
                <Film size={16} />
                <span>{pairedCollection.name}</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Pitch Treatment */}
      {story.treatment && (
        <div className="card" style={{ padding: 16 }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setTreatmentExpanded(!treatmentExpanded)}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Story Pitch & Treatment</h3>
            <button type="button" className="icon-btn" aria-label="Toggle treatment">
              {treatmentExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
          {treatmentExpanded && (
            <div style={{ marginTop: 12, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
              {story.treatment}
            </div>
          )}
        </div>
      )}

      {/* Organized Reference Pack */}
      {((referencedAssets && referencedAssets.length > 0) || (referencedVariants && referencedVariants.length > 0)) && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Layers size={18} style={{ color: '#6366f1' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Organized Reference Pack</h3>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {referencedAssets.map((asset: any) => (
              <div key={asset.id} className="card" style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', minWidth: 160 }}>
                <span className="badge badge-outline" style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>
                  {asset.category}
                </span>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: 4 }}>{asset.title}</div>
              </div>
            ))}
            {referencedVariants.map((variant: any) => (
              <div key={variant.id} className="card" style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', minWidth: 160 }}>
                <span className="badge" style={{ fontSize: '0.7rem', background: '#ede9fe', color: '#6d28d9' }}>
                  Outfit Variant
                </span>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: 4 }}>{variant.title}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Color Script Timeline */}
      {story.colorScript && story.colorScript.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Palette size={18} style={{ color: '#ec4899' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Color Script Timeline</h3>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {story.colorScript.map((node) => (
              <div key={node.id} className="card" style={{ padding: 12, background: '#fafafa', border: '1px solid #e2e8f0', minWidth: 180, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{node.label}</div>
                {node.notes && <p className="muted-text" style={{ fontSize: '0.8rem', margin: '4px 0 8px' }}>{node.notes}</p>}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {node.hexPalette.map((hex, hIdx) => (
                    <div
                      key={hIdx}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        background: hex,
                        border: '1px solid rgba(0,0,0,0.1)',
                      }}
                      title={hex}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dual Mode Switcher: Book Mode vs Creator Mode */}
      <div style={{ borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 8, marginTop: 8 }} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'book'}
          className={`btn ${activeTab === 'book' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('book')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: '6px 6px 0 0' }}
        >
          <BookOpen size={16} />
          <span>Book Mode</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'creator'}
          className={`btn ${activeTab === 'creator' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('creator')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: '6px 6px 0 0' }}
        >
          <Sparkles size={16} />
          <span>Creator Mode</span>
        </button>
      </div>

      {/* Active Mode View */}
      {activeTab === 'book' ? (
        <div className="card story-book-mode-container" style={{ padding: 32, maxWidth: 840, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span className="badge" style={{ background: '#e2e8f0', color: '#475569' }}>
              Full Story Manuscript
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {editingProse ? (
                <>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setProseDraft(story.fullBookText || '');
                      setEditingProse(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={async () => {
                      const next = { ...story, fullBookText: proseDraft, updatedAt: new Date().toISOString() };
                      setStory(next);
                      await saveStory(next);
                      await refreshSnapshot();
                      setEditingProse(false);
                      showToast('Manuscript saved', 'info');
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Check size={14} />
                    <span>Save Manuscript</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setProseDraft(story.fullBookText || '');
                    setEditingProse(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Edit3 size={14} />
                  <span>Edit Manuscript</span>
                </button>
              )}
            </div>
          </div>

          {editingProse ? (
            <textarea
              className="input-field"
              rows={16}
              style={{
                width: '100%',
                fontSize: '1.05rem',
                lineHeight: 1.8,
                fontFamily: 'Georgia, serif',
                padding: 16,
              }}
              placeholder="Write or paste full-length manuscript prose here..."
              value={proseDraft}
              onChange={(e) => setProseDraft(e.target.value)}
            />
          ) : (
            <div
              className="story-book-body"
              style={{
                fontSize: '1.1rem',
                lineHeight: 1.8,
                color: '#1e293b',
                whiteSpace: 'pre-wrap',
                fontFamily: 'Georgia, serif',
              }}
            >
              {story.fullBookText || (
                <p className="muted-text" style={{ fontStyle: 'italic', textAlign: 'center' }}>
                  No prose written for this story yet.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <StoryCreatorMode
          acts={story.acts}
          onUpdateActs={(updatedActs) => {
            const next = { ...story, acts: updatedActs };
            setStory(next);
            saveStory(next);
          }}
        />
      )}
    </div>
  );
};
