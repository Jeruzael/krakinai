import React, { useState, useMemo, useEffect } from 'react';
import type { Story } from '../types/domain';
import type { StoryFieldsUpdatePayload } from '../types/qwen';
import { useLibrary } from '../context/LibraryContext';
import { useQwen } from '../context/QwenContext';
import { StoryCardModal } from '../components/stories/StoryCardModal';
import { StoryEditModal } from '../components/stories/StoryEditModal';
import { MediaThumbnail } from '../components/MediaThumbnail';
import { saveStory } from '../storage/stories';
import { SAMPLE_STORY_CREATOR_MODE } from '../domain/sampleStory';
import {
  BookOpen,
  Edit3,
  Filter,
  Grid,
  Heart,
  List,
  Plus,
  Search,
  Sparkles,
  Tag,
} from 'lucide-react';

export const StoriesScreen: React.FC = () => {
  const { snapshot, navigate, refreshSnapshot, showToast } = useLibrary();
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [inspectingStory, setInspectingStory] = useState<Story | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);

  const { registerStoryCreationHandler } = useQwen();

  useEffect(() => {
    const unregister = registerStoryCreationHandler(async (fields: StoryFieldsUpdatePayload) => {
      const newId = `story_${Date.now()}`;
      const newStory: Story = {
        id: newId,
        title: fields.title?.trim() || 'Untitled Story',
        author: fields.author || 'Author',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        favorite: false,
        revisionNumber: 1,
        tags: fields.tags || [],
        logline: fields.logline || '',
        premise: fields.premise || '',
        synopsis: fields.synopsis || '',
        treatment: fields.treatment || '',
        fullBookText: fields.fullBookText || '',
        referencePack: { assetIds: [], variantIds: [], mediaIds: [] },
        colorScript: [],
        acts: [],
      };
      await saveStory(newStory);
      await refreshSnapshot();
      showToast(`Created new story: "${newStory.title}"`, 'info');
      navigate(`/stories/${newId}`);
      return newId;
    });
    return () => {
      unregister();
    };
  }, [navigate, refreshSnapshot, showToast, registerStoryCreationHandler]);

  const stories = snapshot?.stories || [];

  const mediaMap = useMemo(() => {
    return new Map((snapshot?.media ?? []).map((m) => [m.id, m]));
  }, [snapshot?.media]);

  // Collect all unique tags across stories
  const allTags = useMemo(() => {
    const set = new Set<string>();
    stories.forEach((s) => {
      s.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [stories]);

  // Filter stories based on criteria
  const filteredStories = useMemo(() => {
    return stories.filter((story) => {
      // Archive filter
      if (archiveFilter === 'active' && story.archivedAt) return false;
      if (archiveFilter === 'archived' && !story.archivedAt) return false;

      // Favorites filter
      if (favoritesOnly && !story.favorite) return false;

      // Tag filter
      if (selectedTag && (!story.tags || !story.tags.includes(selectedTag))) {
        return false;
      }

      // Search query (title, author, logline, premise, tags)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = story.title.toLowerCase().includes(q);
        const matchesAuthor = story.author?.toLowerCase().includes(q) || false;
        const matchesLogline = story.logline?.toLowerCase().includes(q) || false;
        const matchesPremise = story.premise?.toLowerCase().includes(q) || false;
        const matchesTags = story.tags?.some((t) => t.toLowerCase().includes(q)) || false;
        if (!matchesTitle && !matchesAuthor && !matchesLogline && !matchesPremise && !matchesTags) {
          return false;
        }
      }

      return true;
    });
  }, [stories, archiveFilter, favoritesOnly, selectedTag, searchQuery]);

  return (
    <div className="stories-screen" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>
            Stories & Creator Mode
          </h1>
          <p className="muted-text" style={{ margin: '4px 0 0' }}>
            Full narrative authoring, literary treatments, and 4-tier Creator Mode beat sheets
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!stories.some((s) => s.id === SAMPLE_STORY_CREATOR_MODE.id) && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={async () => {
                await saveStory(SAMPLE_STORY_CREATOR_MODE);
                await refreshSnapshot();
                navigate(`/stories/${SAMPLE_STORY_CREATOR_MODE.id}`);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Sparkles size={15} />
              <span>Load Sample Story</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              const newId = `story_${Date.now()}`;
              const newStory: Story = {
                id: newId,
                title: 'Untitled Story',
                author: 'Author',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                favorite: false,
                revisionNumber: 1,
                tags: [],
                logline: '',
                premise: '',
                synopsis: '',
                treatment: '',
                fullBookText: '',
                referencePack: { assetIds: [], variantIds: [], mediaIds: [] },
                colorScript: [],
                acts: [],
              };
              await saveStory(newStory);
              await refreshSnapshot();
              navigate(`/stories/${newId}`);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            <span>New Story</span>
          </button>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 240 }}>
            <Search size={16} className="muted-text" />
            <input
              type="text"
              className="input-field"
              placeholder="Search stories by title, author, logline, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          {/* Favorites & Archive Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn ${favoritesOnly ? 'btn-danger' : 'btn-outline'}`}
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              aria-label="Favorites Only"
              title="Favorites Only"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Heart size={15} fill={favoritesOnly ? 'currentColor' : 'none'} />
              <span>Favorites Only</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label htmlFor="story-archive-filter" style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Archive filter:
              </label>
              <select
                id="story-archive-filter"
                aria-label="Archive filter"
                className="input-field"
                value={archiveFilter}
                onChange={(e) => setArchiveFilter(e.target.value as any)}
                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
              >
                <option value="active">Active Only</option>
                <option value="archived">Archived Only</option>
                <option value="all">All Stories</option>
              </select>
            </div>

            {/* Grid / List View Toggle */}
            <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
              <button
                type="button"
                className={`icon-btn ${layoutMode === 'grid' ? 'active' : ''}`}
                onClick={() => setLayoutMode('grid')}
                aria-label="Grid View"
                title="Grid View"
                style={{ padding: '6px 10px', borderRadius: 0, background: layoutMode === 'grid' ? '#e2e8f0' : 'transparent' }}
              >
                <Grid size={16} />
              </button>
              <button
                type="button"
                className={`icon-btn ${layoutMode === 'list' ? 'active' : ''}`}
                onClick={() => setLayoutMode('list')}
                aria-label="List View"
                title="List View"
                style={{ padding: '6px 10px', borderRadius: 0, background: layoutMode === 'list' ? '#e2e8f0' : 'transparent' }}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Tag Pills */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tag size={12} /> Tags:
            </span>
            <button
              type="button"
              className={`badge ${selectedTag === null ? 'badge-primary' : 'badge-outline'}`}
              onClick={() => setSelectedTag(null)}
              style={{ cursor: 'pointer', border: 'none' }}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`badge ${selectedTag === tag ? 'badge-primary' : 'badge-outline'}`}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                style={{ cursor: 'pointer', border: 'none' }}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stories Collection Container */}
      <div
        data-testid="stories-container"
        className={`stories-container ${layoutMode === 'list' ? 'stories-list-view' : 'stories-grid-view'}`}
        style={
          layoutMode === 'grid'
            ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }
            : { display: 'flex', flexDirection: 'column', gap: 12 }
        }
      >
        {filteredStories.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', padding: 48, textAlign: 'center' }}>
            <BookOpen size={36} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
            <h3 style={{ margin: 0 }}>No Stories Found</h3>
            <p className="muted-text" style={{ margin: '6px 0 16px' }}>
              {stories.length === 0
                ? 'Your narrative library is currently empty. Start by creating a story or exploring our sample Creator Mode beat sheet.'
                : 'No stories matched your current search filters.'}
            </p>
            {stories.length === 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  await saveStory(SAMPLE_STORY_CREATOR_MODE);
                  await refreshSnapshot();
                  navigate(`/stories/${SAMPLE_STORY_CREATOR_MODE.id}`);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Sparkles size={16} />
                <span>Load Sample Story (Creator Mode)</span>
              </button>
            )}
          </div>
        ) : (
          filteredStories.map((story) => {
            const coverMedia = story.coverMediaId ? mediaMap.get(story.coverMediaId) : undefined;
            return (
              <div
                key={story.id}
                className="card story-card"
                onClick={() => setInspectingStory(story)}
                style={{
                  cursor: 'pointer',
                  padding: layoutMode === 'list' ? 12 : 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: layoutMode === 'list' ? 'row' : 'column',
                  alignItems: layoutMode === 'list' ? 'center' : 'stretch',
                  justifyContent: 'space-between',
                  gap: 12,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* Story Card Cover */}
                {layoutMode === 'grid' ? (
                  <div
                    className="story-card-cover"
                    data-testid="story-card-cover"
                    style={{
                      width: '100%',
                      height: 140,
                      background: '#1e293b',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {coverMedia ? (
                      <MediaThumbnail
                        media={coverMedia}
                        altText={`${story.title} cover`}
                        enableHoverPreview
                        objectFit="cover"
                        backgroundColor="#0f172a"
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          color: '#94a3b8',
                          padding: 12,
                          textAlign: 'center',
                        }}
                      >
                        <BookOpen size={28} style={{ color: '#60a5fa' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1' }}>
                          Story Manuscript
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="story-card-cover-list"
                    data-testid="story-card-cover"
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 6,
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: '#1e293b',
                    }}
                  >
                    {coverMedia ? (
                      <MediaThumbnail
                        media={coverMedia}
                        altText={`${story.title} cover`}
                        objectFit="cover"
                        backgroundColor="#0f172a"
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#60a5fa',
                        }}
                      >
                        <BookOpen size={24} />
                      </div>
                    )}
                  </div>
                )}

                <div style={{ flex: 1, padding: layoutMode === 'grid' ? 16 : 0, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span className="badge" style={{ background: '#3b82f6', color: '#fff', fontSize: '0.75rem' }}>
                      Rev {story.revisionNumber}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {story.favorite && (
                        <Heart size={14} style={{ color: '#ef4444' }} fill="#ef4444" />
                      )}
                      {story.archivedAt && (
                        <span className="badge" style={{ fontSize: '0.7rem', background: '#cbd5e1', color: '#334155' }}>
                          Archived
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 style={{ margin: '8px 0 4px', fontSize: '1.15rem', fontWeight: 600 }}>
                    {story.title}
                  </h3>

                  <p className="muted-text" style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>
                    {story.author || 'Anonymous'}
                  </p>

                  {story.logline && (
                    <p style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#475569', lineHeight: 1.4 }}>
                      {story.logline}
                    </p>
                  )}

                  {story.tags && story.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {story.tags.slice(0, 3).map((t) => (
                        <span key={t} className="badge badge-outline" style={{ fontSize: '0.7rem' }}>
                          #{t}
                        </span>
                      ))}
                      {story.tags.length > 3 && (
                        <span className="muted-text" style={{ fontSize: '0.7rem' }}>
                          +{story.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      title="Edit story details"
                      aria-label={`Edit ${story.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingStory(story);
                        setShowEditModal(true);
                      }}
                      style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Edit3 size={13} />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Story Quick-Inspect Modal */}
      {inspectingStory && (
        <StoryCardModal
          story={inspectingStory}
          onClose={() => setInspectingStory(null)}
          onStoryUpdated={async () => {
            await refreshSnapshot();
          }}
          onEditStory={(targetStory) => {
            setInspectingStory(null);
            setEditingStory(targetStory);
            setShowEditModal(true);
          }}
        />
      )}

      {/* Story Edit / Create Modal */}
      {showEditModal && (
        <StoryEditModal
          story={editingStory}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingStory(null);
          }}
          onSave={async (savedStory) => {
            await saveStory(savedStory);
            await refreshSnapshot();
            showToast(editingStory ? 'Story updated successfully' : 'New story created successfully');
            navigate(`/stories/${savedStory.id}`);
          }}
        />
      )}
    </div>
  );
};
