import React from 'react';
import { Film, ImageOff, Play } from 'lucide-react';
import type { MediaAsset } from '../types/domain';
import { useMediaObjectUrl } from '../hooks/useObjectUrl';

interface MediaThumbnailProps {
  media?: MediaAsset;
  altText?: string;
  showVideoControls?: boolean;
  emptyLabel?: string;
  roleBadge?: string;
}

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({
  media,
  altText,
  showVideoControls = false,
  emptyLabel = 'No sample yet. Add an image or video when ready.',
  roleBadge,
}) => {
  const url = useMediaObjectUrl(media);

  if (!media || !url) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          minHeight: 140,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          textAlign: 'center',
          color: 'var(--text-muted)',
          background: '#F1F5F9',
          gap: 8,
        }}
      >
        <ImageOff size={24} aria-hidden="true" />
        <span style={{ fontSize: 12, fontWeight: 500 }}>{emptyLabel}</span>
      </div>
    );
  }

  const isVideo =
    media.mimeType === 'video/mp4' || media.mimeType === 'video/webm';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F8FAFC',
      }}
    >
      {isVideo ? (
        showVideoControls ? (
          <video
            src={url}
            controls
            preload="metadata"
            style={{ width: '100%', height: '100%', maxHeight: 520, objectFit: 'contain' }}
          >
            Your browser does not support playable MP4/WebM video.
          </video>
        ) : (
          <>
            <video
              src={url}
              preload="metadata"
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            <span
              className="badge badge-primary"
              style={{
                position: 'absolute',
                bottom: 10,
                left: 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              aria-label="Playable video sample"
            >
              <Play size={12} /> Video
            </span>
          </>
        )
      ) : (
        <img
          src={url}
          alt={altText || media.filename}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      )}

      {roleBadge && (
        <span
          className="badge"
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(15, 23, 42, 0.78)',
            color: '#FFFFFF',
          }}
        >
          {roleBadge}
        </span>
      )}

      {media.isBundledIllustration && !roleBadge && (
        <span
          className="badge"
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            fontSize: 10,
            background: 'rgba(255, 255, 255, 0.9)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          Demo / Illustrative
        </span>
      )}
    </div>
  );
};
