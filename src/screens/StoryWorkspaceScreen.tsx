import React, { useState, useEffect, useMemo } from 'react';
import type { Story, StoryAct, StoryColorScriptEntry, StoryReferencePack } from '../types/domain';
import { useLibrary } from '../context/LibraryContext';
import { getStory, saveStory, toggleStoryFavorite } from '../storage/stories';
import { generateId } from '../storage/db';
import { StoryCreatorMode } from '../components/stories/StoryCreatorMode';
import { CollectionCoverPicker } from '../components/CollectionCoverPicker';
import { MediaThumbnail } from '../components/MediaThumbnail';
import { useMediaObjectUrl } from '../hooks/useObjectUrl';
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
  Image,
  ImageIcon,
  Layers,
  Palette,
  Plus,
  Search,
  Sparkles,
  Trash2,
  User,
  X,
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

  // Media pickers & dialogs
  const [coverPickerKind, setCoverPickerKind] = useState<'cover' | 'hero' | null>(null);
  const [showReferenceManager, setShowReferenceManager] = useState(false);
  const [refSearch, setRefSearch] = useState('');
  const [refCategory, setRefCategory] = useState<string>('all');
  const [editingColorBeat, setEditingColorBeat] = useState<{
    id?: string;
    label: string;
    notes: string;
    hexPalette: string;
  } | null>(null);

  useEffect(() => {
    if (story) setProseDraft(story.fullBookText || '');
  }, [story?.id]);

  useEffect(() => {
    let active = true;
    getStory(storyId)
      .then((res) => {
        if (active && res) {
          setStory(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [storyId]);

  const coverMedia = useMemo(() => {
    return story?.coverMediaId
      ? snapshot?.media?.find((m) => m.id === story.coverMediaId)
      : undefined;
  }, [story?.coverMediaId, snapshot?.media]);

  const heroBannerMedia = useMemo(() => {
    return story?.heroBannerMediaId
      ? snapshot?.media?.find((m) => m.id === story.heroBannerMediaId)
      : undefined;
  }, [story?.heroBannerMediaId, snapshot?.media]);

  const heroBannerUrl = useMediaObjectUrl(heroBannerMedia);

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
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/stories')}
          style={{ marginTop: 16 }}
        >
          Return to Stories
        </button>
      </div>
    );
  }

  const handleFavoriteToggle = async () => {
    try {
      await toggleStoryFavorite(story.id);
      setStory((prev) => (prev ? { ...prev, favorite: !prev.favorite } : null));
      await refreshSnapshot();
      showToast(story.favorite ? 'Removed from favorites' : 'Added to favorites');
    } catch (err: any) {
      showToast(err.message || 'Failed to update favorite', 'error');
    }
  };

  // Resolved reference pack items
  const referencedAssets = (story.referencePack?.assetIds || [])
    .map((aid) => snapshot?.assets?.find((a) => a.id === aid))
    .filter(Boolean);

  const referencedVariants = (story.referencePack?.variantIds || [])
    .map((vid) => snapshot?.variants?.find((v) => v.id === vid))
    .filter(Boolean);

  const pairedCollection = snapshot?.collections?.find(
    (c) => c.id === story.linkedCollectionId
  );

  // Reference pack unbind handler
  const handleRemoveAssetReference = async (assetId: string) => {
    const nextAssetIds = (story.referencePack?.assetIds || []).filter((id) => id !== assetId);
    const next: Story = {
      ...story,
      referencePack: {
        ...(story.referencePack || { assetIds: [], variantIds: [], mediaIds: [] }),
        assetIds: nextAssetIds,
      },
      updatedAt: new Date().toISOString(),
    };
    setStory(next);
    await saveStory(next);
    await refreshSnapshot();
    showToast('Asset reference unlinked');
  };

  const handleRemoveVariantReference = async (variantId: string) => {
    const nextVariantIds = (story.referencePack?.variantIds || []).filter((id) => id !== variantId);
    const next: Story = {
      ...story,
      referencePack: {
        ...(story.referencePack || { assetIds: [], variantIds: [], mediaIds: [] }),
        variantIds: nextVariantIds,
      },
      updatedAt: new Date().toISOString(),
    };
    setStory(next);
    await saveStory(next);
    await refreshSnapshot();
    showToast('Variant reference unlinked');
  };

  // Color script handlers
  const handleOpenAddColorBeat = () => {
    setEditingColorBeat({
      label: `Beat ${(story.colorScript?.length || 0) + 1}`,
      notes: '',
      hexPalette: '#1e293b, #3b82f6, #93c5fd',
    });
  };

  const handleSaveColorBeat = async () => {
    if (!editingColorBeat || !editingColorBeat.label.trim()) return;
    const currentScript = [...(story.colorScript || [])];
    const rawPalette = editingColorBeat.hexPalette
      .split(',')
      .map((h) => h.trim())
      .filter((h) => h.startsWith('#'));

    const hexPalette = rawPalette.length > 0 ? rawPalette : ['#1e293b', '#3b82f6'];

    if (editingColorBeat.id) {
      // Editing existing
      const nextScript = currentScript.map((node) =>
        node.id === editingColorBeat.id
          ? {
              ...node,
              label: editingColorBeat.label.trim(),
              notes: editingColorBeat.notes.trim() || undefined,
              hexPalette,
            }
          : node
      );
      const next: Story = { ...story, colorScript: nextScript, updatedAt: new Date().toISOString() };
      setStory(next);
      await saveStory(next);
      await refreshSnapshot();
    } else {
      // Adding new
      const newNode: StoryColorScriptEntry = {
        id: generateId('cs_beat'),
        orderIndex: currentScript.length,
        label: editingColorBeat.label.trim(),
        notes: editingColorBeat.notes.trim() || undefined,
        hexPalette,
      };
      const nextScript = [...currentScript, newNode];
      const next: Story = { ...story, colorScript: nextScript, updatedAt: new Date().toISOString() };
      setStory(next);
      await saveStory(next);
      await refreshSnapshot();
    }

    setEditingColorBeat(null);
    showToast('Color script updated');
  };

  const handleDeleteColorBeat = async (nodeId: string) => {
    const nextScript = (story.colorScript || [])
      .filter((n) => n.id !== nodeId)
      .map((n, idx) => ({ ...n, orderIndex: idx }));
    const next: Story = { ...story, colorScript: nextScript, updatedAt: new Date().toISOString() };
    setStory(next);
    await saveStory(next);
    await refreshSnapshot();
    showToast('Color beat removed');
  };

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
            className="btn btn-outline"
            onClick={() => setCoverPickerKind('hero')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#FFFFFF',
              color: '#0F172A',
              borderColor: '#CBD5E1',
              fontWeight: 600,
            }}
          >
            <ImageIcon size={16} />
            <span>Change Hero Banner</span>
          </button>

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
      <div
        className="card story-hero-banner"
        style={{
          padding: 24,
          background: heroBannerUrl
            ? `linear-gradient(to right, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.88) 50%, rgba(15, 23, 42, 0.75) 100%), url(${heroBannerUrl}) center/cover no-repeat`
            : '#1e293b',
          color: '#f8fafc',
          borderRadius: 8,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Cover Artwork & Uploader */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div
              style={{
                width: 140,
                height: 180,
                borderRadius: 8,
                overflow: 'hidden',
                background: '#0F172A',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.2)',
                position: 'relative',
              }}
            >
              {coverMedia ? (
                <MediaThumbnail
                  media={coverMedia}
                  altText={`${story.title} cover`}
                  enableHoverPreview
                  objectFit="cover"
                  backgroundColor="#0F172A"
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    color: '#94a3b8',
                    padding: 8,
                    textAlign: 'center',
                  }}
                >
                  <BookOpen size={28} style={{ color: '#60a5fa' }} />
                  <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>
                    Story Book
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setCoverPickerKind('cover')}
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                borderColor: 'rgba(255, 255, 255, 0.45)',
                borderRadius: 6,
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontWeight: 600,
              }}
            >
              <Image size={13} />
              <span>Change Cover</span>
            </button>
          </div>

          {/* Story Metadata */}
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

      {/* Organized Reference Pack (Always Visible with Manage References) */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} style={{ color: '#6366f1' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Organized Reference Pack</h3>
            <span className="badge" style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.75rem' }}>
              {referencedAssets.length + referencedVariants.length} Bound
            </span>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setShowReferenceManager(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} />
            <span>Manage References</span>
          </button>
        </div>

        {referencedAssets.length === 0 && referencedVariants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', background: '#f8fafc', borderRadius: 6, border: '1px dashed #cbd5e1' }}>
            <p className="muted-text" style={{ margin: '0 0 10px', fontSize: '0.9rem' }}>
              No library assets bound to this story yet. Connect characters, outfits, and environments to keep narrative continuity.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowReferenceManager(true)}
            >
              + Add Asset References
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {referencedAssets.map((asset: any) => (
              <div
                key={asset.id}
                className="card"
                style={{
                  padding: '8px 12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  minWidth: 160,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <div>
                  <span className="badge badge-outline" style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>
                    {asset.category}
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: 4 }}>{asset.title}</div>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  title="Remove asset reference"
                  onClick={() => handleRemoveAssetReference(asset.id)}
                  style={{ color: '#94a3b8', padding: 2 }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {referencedVariants.map((variant: any) => (
              <div
                key={variant.id}
                className="card"
                style={{
                  padding: '8px 12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  minWidth: 160,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <div>
                  <span className="badge" style={{ fontSize: '0.7rem', background: '#ede9fe', color: '#6d28d9' }}>
                    Outfit Variant
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: 4 }}>{variant.title}</div>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  title="Remove variant reference"
                  onClick={() => handleRemoveVariantReference(variant.id)}
                  style={{ color: '#94a3b8', padding: 2 }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Color Script Timeline (Always Visible with Add/Edit/Delete Controls) */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Palette size={18} style={{ color: '#ec4899' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Color Script Timeline</h3>
            <span className="badge" style={{ background: '#fce7f3', color: '#be185d', fontSize: '0.75rem' }}>
              {(story.colorScript || []).length} Beats
            </span>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleOpenAddColorBeat}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} />
            <span>Add Color Beat</span>
          </button>
        </div>

        {(!story.colorScript || story.colorScript.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', background: '#f8fafc', borderRadius: 6, border: '1px dashed #cbd5e1' }}>
            <p className="muted-text" style={{ margin: '0 0 10px', fontSize: '0.9rem' }}>
              No color script beats added yet. Define color palettes and mood lighting across your story progression.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleOpenAddColorBeat}
            >
              + Add First Color Beat
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {story.colorScript.map((node) => (
              <div
                key={node.id}
                className="card"
                style={{
                  padding: 12,
                  background: '#fafafa',
                  border: '1px solid #e2e8f0',
                  minWidth: 180,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{node.label}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Edit color beat"
                        onClick={() =>
                          setEditingColorBeat({
                            id: node.id,
                            label: node.label,
                            notes: node.notes || '',
                            hexPalette: (node.hexPalette || []).join(', '),
                          })
                        }
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn text-danger"
                        title="Delete color beat"
                        onClick={() => handleDeleteColorBeat(node.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {node.notes && <p className="muted-text" style={{ fontSize: '0.8rem', margin: '4px 0 8px' }}>{node.notes}</p>}
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
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
        )}
      </div>

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
          onUpdateActs={async (updatedActs) => {
            const next = { ...story, acts: updatedActs, updatedAt: new Date().toISOString() };
            setStory(next);
            await saveStory(next);
            await refreshSnapshot();
          }}
        />
      )}

      {/* Cover / Hero Banner Media Picker Modal */}
      {coverPickerKind && (
        <CollectionCoverPicker
          media={snapshot?.media ?? []}
          currentId={coverPickerKind === 'cover' ? story.coverMediaId : story.heroBannerMediaId}
          saveActionLabel={coverPickerKind === 'cover' ? 'Set Story Cover' : 'Set Hero Banner'}
          onSelect={async (newId) => {
            const next: Story = {
              ...story,
              ...(coverPickerKind === 'cover' ? { coverMediaId: newId } : { heroBannerMediaId: newId }),
              updatedAt: new Date().toISOString(),
            };
            setStory(next);
            await saveStory(next);
            await refreshSnapshot();
            setCoverPickerKind(null);
            showToast(coverPickerKind === 'cover' ? 'Story cover updated' : 'Hero banner updated');
          }}
          onClose={() => setCoverPickerKind(null)}
          onUploaded={refreshSnapshot}
        />
      )}

      {/* Reference Pack Manager Modal */}
      {showReferenceManager && (
        <div className="modal-backdrop" onClick={() => setShowReferenceManager(false)}>
          <div
            className="modal-panel modal-card"
            role="dialog"
            aria-label="Manage Story References"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 640,
              width: '92vw',
              background: '#FFFFFF',
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div className="modal-header" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0F172A' }}>Manage Reference Pack</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowReferenceManager(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto', background: '#FFFFFF' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
                  <input
                    type="text"
                    className="input-field"
                    style={{ paddingLeft: 30, width: '100%' }}
                    placeholder="Search library assets..."
                    value={refSearch}
                    onChange={(e) => setRefSearch(e.target.value)}
                  />
                </div>
                <select
                  className="input-field"
                  value={refCategory}
                  onChange={(e) => setRefCategory(e.target.value)}
                  style={{ width: 140 }}
                >
                  <option value="all">All Types</option>
                  <option value="characters">Characters</option>
                  <option value="wardrobe">Wardrobe</option>
                  <option value="environments">Environments</option>
                  <option value="actions">Actions</option>
                  <option value="camera">Camera</option>
                  <option value="lighting">Lighting</option>
                  <option value="styles">Styles</option>
                  <option value="variants">Outfit Variants</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Assets */}
                {refCategory !== 'variants' &&
                  (snapshot?.assets ?? [])
                    .filter((a) => {
                      if (refCategory !== 'all' && a.category !== refCategory) return false;
                      if (!refSearch.trim()) return true;
                      const q = refSearch.toLowerCase();
                      return a.title.toLowerCase().includes(q) || a.tags?.some((t) => t.toLowerCase().includes(q));
                    })
                    .map((asset) => {
                      const isBound = (story.referencePack?.assetIds || []).includes(asset.id);
                      return (
                        <label
                          key={asset.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: 8,
                            borderRadius: 6,
                            background: isBound ? '#eff6ff' : '#f8fafc',
                            border: `1px solid ${isBound ? '#bfdbfe' : '#e2e8f0'}`,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isBound}
                            onChange={async (e) => {
                              const currentIds = story.referencePack?.assetIds || [];
                              const nextIds = e.target.checked
                                ? [...currentIds, asset.id]
                                : currentIds.filter((id) => id !== asset.id);
                              const next: Story = {
                                ...story,
                                referencePack: {
                                  ...(story.referencePack || { assetIds: [], variantIds: [], mediaIds: [] }),
                                  assetIds: nextIds,
                                },
                                updatedAt: new Date().toISOString(),
                              };
                              setStory(next);
                              await saveStory(next);
                              await refreshSnapshot();
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{asset.title}</div>
                            <span className="badge badge-outline" style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>
                              {asset.category}
                            </span>
                          </div>
                        </label>
                      );
                    })}

                {/* Variants */}
                {(refCategory === 'all' || refCategory === 'variants') &&
                  (snapshot?.variants ?? [])
                    .filter((v) => {
                      if (!refSearch.trim()) return true;
                      const q = refSearch.toLowerCase();
                      return v.title.toLowerCase().includes(q) || v.tags?.some((t) => t.toLowerCase().includes(q));
                    })
                    .map((variant) => {
                      const isBound = (story.referencePack?.variantIds || []).includes(variant.id);
                      return (
                        <label
                          key={variant.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: 8,
                            borderRadius: 6,
                            background: isBound ? '#f5f3ff' : '#f8fafc',
                            border: `1px solid ${isBound ? '#ddd6fe' : '#e2e8f0'}`,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isBound}
                            onChange={async (e) => {
                              const currentIds = story.referencePack?.variantIds || [];
                              const nextIds = e.target.checked
                                ? [...currentIds, variant.id]
                                : currentIds.filter((id) => id !== variant.id);
                              const next: Story = {
                                ...story,
                                referencePack: {
                                  ...(story.referencePack || { assetIds: [], variantIds: [], mediaIds: [] }),
                                  variantIds: nextIds,
                                },
                                updatedAt: new Date().toISOString(),
                              };
                              setStory(next);
                              await saveStory(next);
                              await refreshSnapshot();
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{variant.title}</div>
                            <span className="badge" style={{ fontSize: '0.7rem', background: '#ede9fe', color: '#6d28d9' }}>
                              Outfit Variant
                            </span>
                          </div>
                        </label>
                      );
                    })}
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowReferenceManager(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Color Beat Edit Dialog */}
      {editingColorBeat && (
        <div className="modal-backdrop" onClick={() => setEditingColorBeat(null)}>
          <div
            className="modal-panel modal-card"
            role="dialog"
            aria-label="Edit Color Beat"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 480,
              width: '92vw',
              background: '#FFFFFF',
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div className="modal-header" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0F172A' }}>
                {editingColorBeat.id ? 'Edit Color Beat' : 'Add Color Beat'}
              </h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setEditingColorBeat(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#FFFFFF' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Beat Label
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%' }}
                  placeholder="e.g. Act I - Dawn Mist"
                  value={editingColorBeat.label}
                  onChange={(e) => setEditingColorBeat({ ...editingColorBeat, label: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Color & Mood Notes
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  style={{ width: '100%' }}
                  placeholder="e.g. Muted amber fading into cold frosty blue"
                  value={editingColorBeat.notes}
                  onChange={(e) => setEditingColorBeat({ ...editingColorBeat, notes: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Hex Palette (comma-separated hex codes)
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%' }}
                  placeholder="#1e293b, #3b82f6, #93c5fd"
                  value={editingColorBeat.hexPalette}
                  onChange={(e) => setEditingColorBeat({ ...editingColorBeat, hexPalette: e.target.value })}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {editingColorBeat.hexPalette
                    .split(',')
                    .map((h) => h.trim())
                    .filter((h) => h.startsWith('#'))
                    .map((hex, idx) => (
                      <div
                        key={idx}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          background: hex,
                          border: '1px solid rgba(0,0,0,0.15)',
                        }}
                        title={hex}
                      />
                    ))}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setEditingColorBeat(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveColorBeat}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Check size={14} />
                <span>Save Beat</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
