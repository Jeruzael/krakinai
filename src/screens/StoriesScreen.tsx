import React, { useState, useMemo } from 'react';
import type { Story } from '../types/domain';
import { useLibrary } from '../context/LibraryContext';
import { StoryCardModal } from '../components/stories/StoryCardModal';
import {
  BookOpen,
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
  const { snapshot, navigate, refreshSnapshot } = useLibrary();
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [inspectingStory, setInspectingStory] = useState<Story | null>(null);

  const stories = snapshot?.stories || [];

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

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            const newId = `story_${Date.now()}`;
            navigate(`/stories/${newId}`);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={16} />
          <span>New Story</span>
        </button>
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
                ? 'Your narrative library is currently empty. Start by creating a story or importing one with an AI agent.'
                : 'No stories matched your current search filters.'}
            </p>
          </div>
        ) : (
          filteredStories.map((story) => (
            <div
              key={story.id}
              className="card story-card"
              onClick={() => setInspectingStory(story)}
              style={{
                cursor: 'pointer',
                padding: 16,
                display: 'flex',
                flexDirection: layoutMode === 'list' ? 'row' : 'column',
                justifyContent: 'space-between',
                gap: 12,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div style={{ flex: 1 }}>
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
              </div>
            </div>
          ))
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
        />
      )}
    </div>
  );
};
