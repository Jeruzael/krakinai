import React from 'react';
import type { MediaAsset } from '../types/domain';
import { StudioDialog } from './StudioDialog';
import { MediaThumbnail } from './MediaThumbnail';

export const MediaPreviewDialog: React.FC<{
  media: MediaAsset;
  title: string;
  altText?: string;
  onClose: () => void;
}> = ({ media, title, altText, onClose }) => (
  <StudioDialog title={`Media: ${title}`} onClose={onClose}>
    <div style={{ height: 'min(65vh, 700px)', minHeight: 180, width: '100%' }}>
      <MediaThumbnail
        media={media}
        altText={altText || title}
        showVideoControls
      />
    </div>
    <p className="muted-text">{media.filename}</p>
  </StudioDialog>
);
