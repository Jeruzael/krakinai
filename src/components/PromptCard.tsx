import React, { useState } from 'react';
import { Copy, ExternalLink, Heart, PlusCircle } from 'lucide-react';
import type { MediaAsset, PromptAsset, Variant } from '../types/domain';
import { CATEGORY_LABELS } from '../domain/validation';
import { MediaPreviewDialog } from './MediaPreviewDialog';
import { MediaThumbnail } from './MediaThumbnail';

interface PromptCardProps {
  item: PromptAsset | Variant;
  kind: 'asset' | 'variant';
  mediaMap: Map<string, MediaAsset>;
  onOpen: () => void;
  onCopy: () => void;
  onToggleFavorite: () => void;
  onAddToScene: () => void;
  extraAction?: React.ReactNode;
}

export const PromptCard: React.FC<PromptCardProps> = ({
  item,
  kind,
  mediaMap,
  onOpen,
  onCopy,
  onToggleFavorite,
  onAddToScene,
  extraAction,
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const coverId = item.coverMediaId || item.mediaLinks[0]?.mediaId;
  const coverMedia = coverId ? mediaMap.get(coverId) : undefined;
  const coverLink =
    item.mediaLinks.find((l) => l.mediaId === coverId) || item.mediaLinks[0];

  const badgeText =
    kind === 'asset'
      ? CATEGORY_LABELS[(item as PromptAsset).category]
      : `${(item as Variant).type} Variant`;

  return (
    <article className="prompt-card" aria-label={item.title}>
      <div className="prompt-card-media">
        <button
          type="button"
          aria-label={`Expand media: ${item.title}`}
          disabled={!coverMedia}
          onClick={() => setPreviewOpen(true)}
          style={{
            width: '100%',
            height: '100%',
            border: 0,
            padding: 0,
            cursor: 'zoom-in',
          }}
        >
          <MediaThumbnail
            media={coverMedia}
            altText={coverLink?.altText || item.title}
            enableHoverPreview={!previewOpen}
          />
        </button>
        <button
          type="button"
          className="icon-btn prompt-card-fav"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          aria-label={
            item.favorite
              ? `Remove ${item.title} from favorites`
              : `Add ${item.title} to favorites`
          }
          title={item.favorite ? 'Favorited' : 'Add to Favorites'}
          style={{
            background: item.favorite ? '#EFF6FF' : 'rgba(255,255,255,0.92)',
            color: item.favorite ? '#2563EB' : '#475569',
          }}
        >
          <Heart
            size={18}
            fill={item.favorite ? '#2563EB' : 'none'}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="prompt-card-body">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span className="badge badge-primary">{badgeText}</span>
          {item.reviewStatus === 'user-approved' && (
            <span className="badge badge-success">User-approved</span>
          )}
        </div>

        <h3 className="prompt-card-title" onClick={onOpen}>
          {item.title}
        </h3>

        {item.tags.length > 0 && (
          <div className="tag-list">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="badge">
                {tag}
              </span>
            ))}
            {item.tags.length > 3 && (
              <span className="badge">+{item.tags.length - 3}</span>
            )}
          </div>
        )}

        <div>
          <p className={`prompt-card-excerpt ${expanded ? '' : 'clamped'}`}>
            {item.promptText}
          </p>
          {item.promptText.length > 100 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 0',
                color: 'var(--link-text)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {expanded ? 'Show less' : 'Expand excerpt'}
            </button>
          )}
        </div>

        <div className="prompt-card-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpen}
          >
            <ExternalLink size={14} /> Open Prompt
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onCopy}
          >
            <Copy size={14} /> Copy
          </button>
          <button
            type="button"
            className="btn btn-tint btn-sm"
            onClick={onAddToScene}
          >
            <PlusCircle size={14} /> Add to Scene
          </button>
          {extraAction}
        </div>
      </div>
      {previewOpen && coverMedia && (
        <MediaPreviewDialog
          media={coverMedia}
          title={item.title}
          altText={coverLink?.altText}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </article>
  );
};
