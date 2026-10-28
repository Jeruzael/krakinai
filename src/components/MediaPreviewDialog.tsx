import React, { useState } from 'react';
import type { MediaAsset } from '../types/domain';
import { StudioDialog } from './StudioDialog';
import { MediaThumbnail } from './MediaThumbnail';
import './mediaInspection.css';

export const MediaPreviewDialog: React.FC<{
  media: MediaAsset;
  title: string;
  altText?: string;
  onClose: () => void;
}> = ({ media, title, altText, onClose }) => {
  const [zoom, setZoom] = useState<number | 'actual'>(1),
    [dimensions, setDimensions] = useState<{ width: number; height: number }>();
  const image = media.mimeType.startsWith('image/');
  return (
    <StudioDialog
      title={`Media: ${title}`}
      onClose={onClose}
      size="wide"
      className="media-preview-dialog"
    >
      {image && (
        <div className="media-zoom-controls" aria-label="Image zoom controls">
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => setZoom(1)}
          >
            Fit to Screen
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={zoom === 1 || zoom === 'actual'}
            onClick={() =>
              setZoom(Math.max(1, (typeof zoom === 'number' ? zoom : 1) - 0.5))
            }
          >
            Zoom Out
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={zoom === 4 || zoom === 'actual'}
            onClick={() =>
              setZoom(Math.min(4, (typeof zoom === 'number' ? zoom : 1) + 0.5))
            }
          >
            Zoom In
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => setZoom(1)}
          >
            Reset Zoom
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={!dimensions}
            aria-pressed={zoom === 'actual'}
            onClick={() => setZoom('actual')}
          >
            Actual Size
          </button>
          <output role="status">
            {zoom === 'actual'
              ? 'Native pixels'
              : `${zoom * 100}% of fitted view`}
            {dimensions
              ? ` · ${dimensions.width} × ${dimensions.height} source pixels`
              : ''}
          </output>
        </div>
      )}
      <div className="media-inspection-viewport">
        <MediaThumbnail
          media={media}
          altText={altText || title}
          showVideoControls
          imageZoom={image ? zoom : undefined}
          onImageDimensions={setDimensions}
        />
      </div>
      <p
        className="muted-text media-inspection-filename"
        title={media.filename}
      >
        {media.filename}
      </p>
      {image ? (
        <p className="muted-text">
          Fit preserves source size for small images. Zoom changes the view, not
          image resolution. Scroll or swipe the image to pan while zoomed.
        </p>
      ) : (
        <p className="muted-text">
          Use the player controls to play, pause, seek, change volume or enter
          fullscreen where supported. Playback starts only when you choose Play.
        </p>
      )}
    </StudioDialog>
  );
};
