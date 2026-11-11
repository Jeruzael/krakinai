import React, { useState } from 'react';
import { BookOpen, Bookmark, BookmarkCheck, Archive, RotateCcw, Trash2, Edit3, X } from 'lucide-react';
import type { Story } from '../../types/domain';
import { useLibrary } from '../../context/LibraryContext';
import { MediaThumbnail } from '../MediaThumbnail';
import {
  archiveStory,
  deleteStory,
  toggleStoryFavorite,
  activeCollectionReferencingStory,
} from '../../storage/stories';

interface StoryCardModalProps {
  story: Story;
  onClose: () => void;
  onUpdated?: () => void;
  onStoryUpdated?: () => void | Promise<void>;
}

export const StoryCardModal: React.FC<StoryCardModalProps> = ({
  story,
  onClose,
  onUpdated,
  onStoryUpdated,
}) => {
  const { navigate, snapshot, refreshSnapshot, showToast, openConfirmDialog } = useLibrary();
  const [busy, setBusy] = useState(false);

  const handleReadFullStory = () => {
    onClose();
    navigate(`/stories/${story.id}`);
  };

  const handleToggleFavorite = async () => {
    try {
      setBusy(true);
      await toggleStoryFavorite(story.id);
      await refreshSnapshot();
      showToast(story.favorite ? 'Removed from favorites' : 'Added to favorites', 'info');
      onUpdated?.();
      onStoryUpdated?.();
    } catch (err) {
      showToast('Failed to update favorite status', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleArchive = async () => {
    try {
      setBusy(true);
      const isArchived = Boolean(story.archivedAt);
      await archiveStory(story.id, !isArchived);
      await refreshSnapshot();
      showToast(isArchived ? 'Story restored' : 'Story archived', 'info');
      onUpdated?.();
      onStoryUpdated?.();
    } catch (err) {
      showToast('Failed to update archive status', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    const referencingCollection = activeCollectionReferencingStory(
      story.id,
      snapshot?.collections ?? []
    );

    if (referencingCollection) {
      showToast(
        `Cannot delete: Story is bound to active project "${referencingCollection.name}". Unlink first.`,
        'error'
      );
      return;
    }

    openConfirmDialog({
      title: 'Delete Story',
      message: `Are you sure you want to permanently delete "${story.title}"? This cannot be undone.`,
      confirmLabel: 'Delete Story',
      danger: true,
      onConfirm: async () => {
        try {
          setBusy(true);
          await deleteStory(story.id, snapshot?.collections ?? []);
          await refreshSnapshot();
          showToast('Story permanently deleted', 'info');
          onClose();
          onUpdated?.();
      onStoryUpdated?.();
        } catch (err) {
          showToast('Failed to delete story', 'error');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const coverMedia = story.coverMediaId
    ? (snapshot?.media ?? []).find((m) => m.id === story.coverMediaId)
    : undefined;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel modal-card story-preview-modal"
        role="dialog"
        aria-label={story.title}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '640px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={20} className="text-accent" />
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{story.title}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', background: '#FFFFFF' }}>
          {/* Cover Display */}
          <div
            className="story-modal-cover"
            data-testid="story-modal-cover"
            style={{
              width: '100%',
              height: 180,
              borderRadius: 8,
              overflow: 'hidden',
              background: '#0F172A',
              marginBottom: 16,
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
                  background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: '#94a3b8',
                }}
              >
                <BookOpen size={36} style={{ color: '#60a5fa' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
                  Story Manuscript
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            <span className="badge badge-subtle">By {story.author || 'Unknown'}</span>
            <span className="badge badge-subtle">Rev {story.revisionNumber}</span>
            {story.favorite && <span className="badge badge-primary">Favorite</span>}
            {story.archivedAt && <span className="badge badge-warning">Archived</span>}
            {story.tags.map((tag) => (
              <span key={tag} className="badge badge-neutral">#{tag}</span>
            ))}
          </div>

          {story.logline && (
            <div style={{ marginBottom: '16px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
              "{story.logline}"
            </div>
          )}

          {story.premise && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Premise
              </h4>
              <p style={{ margin: 0, lineHeight: 1.5 }}>{story.premise}</p>
            </div>
          )}

          {story.synopsis && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Synopsis
              </h4>
              <p style={{ margin: 0, lineHeight: 1.5 }}>{story.synopsis}</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', padding: '12px', background: 'var(--surface-subtle, #f8f9fa)', borderRadius: '8px', fontSize: '0.85rem' }}>
            <div>
              <span className="muted-text">Acts:</span> <strong>{story.acts.length}</strong>
            </div>
            <div>
              <span className="muted-text">Color Script:</span> <strong>{story.colorScript.length} beats</strong>
            </div>
            <div>
              <span className="muted-text">Bound Assets:</span> <strong>{story.referencePack.assetIds.length}</strong>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleToggleFavorite}
              disabled={busy}
              aria-label={story.favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {story.favorite ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              <span>{story.favorite ? 'Favorited' : 'Favorite'}</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleToggleArchive}
              disabled={busy}
              aria-label={story.archivedAt ? 'Restore story' : 'Archive story'}
            >
              {story.archivedAt ? <RotateCcw size={16} /> : <Archive size={16} />}
              <span>{story.archivedAt ? 'Restore' : 'Archive'}</span>
            </button>

            <button
              type="button"
              className="btn btn-danger-subtle btn-sm"
              onClick={handleDelete}
              disabled={busy}
              aria-label="Delete story"
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReadFullStory}
              aria-label="Edit Story"
            >
              <Edit3 size={16} />
              <span>Edit Story</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleReadFullStory}
            >
              <BookOpen size={16} />
              <span>Read Full Story</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
