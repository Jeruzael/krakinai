import React, { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import type { MediaAsset } from '../types/domain';
import { MediaThumbnail } from './MediaThumbnail';
import { MediaPreviewDialog } from './MediaPreviewDialog';
import './collectionMediaPreview.css';

/** A preview never navigates or changes media ownership. Keep its trigger mounted
 * for focus restoration while releasing the thumbnail decoder during expansion. */
export const CollectionMediaPreview: React.FC<{
  media?: MediaAsset;
  title: string;
  altText?: string;
  emptyLabel?: string;
}> = ({ media, title, altText, emptyLabel }) => {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="collection-media-preview"
      onDragStart={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {!open ? (
        <MediaThumbnail
          media={media}
          altText={altText || title}
          emptyLabel={emptyLabel}
          enableHoverPreview
        />
      ) : (
        <div className="collection-preview-placeholder">Preview open</div>
      )}
      {media && (
        <button
          type="button"
          className="btn btn-secondary btn-sm collection-preview-trigger"
          aria-label={`Preview media: ${title}`}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
        >
          <Maximize2 size={13} aria-hidden="true" /> Preview
        </button>
      )}
      {open && media && (
        <MediaPreviewDialog
          media={media}
          title={title}
          altText={altText}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};
