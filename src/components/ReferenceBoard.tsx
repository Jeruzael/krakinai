import React, { useState } from 'react';
import { Download, Grid2X2, Image, Maximize2 } from 'lucide-react';
import type { MediaAsset } from '../types/domain';
import { MediaThumbnail } from './MediaThumbnail';
import { MediaPreviewDialog } from './MediaPreviewDialog';
import { StudioDialog } from './StudioDialog';
import { downloadBlobAsFile } from '../hooks/useObjectUrl';

export interface StudioReference {
  key: string;
  mediaId: string;
  label: string;
  sourceTitle: string;
  role: string;
  altText?: string;
  filename?: string;
}

export const ReferenceBoard: React.FC<{
  items: StudioReference[];
  mediaMap: Map<string, MediaAsset>;
  title?: string;
  collapseThumbnails?: boolean;
  downloadable?: boolean;
}> = ({
  items,
  mediaMap,
  title = 'Reference Board',
  collapseThumbnails = false,
  downloadable = false,
}) => {
  const [featuredKey, setFeaturedKey] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const featured = items.find((item) => item.key === featuredKey) ?? items[0];
  const media = featured ? mediaMap.get(featured.mediaId) : undefined;
  const thumbnailStrip = (
    <div className="reference-strip" aria-label="Selected reference thumbnails">
      {items.slice(0, 6).map((item) => (
        <button
          key={item.key}
          type="button"
          className={`reference-thumb ${featured?.key === item.key ? 'is-featured' : ''}`}
          aria-label={`Feature ${item.label}: ${item.sourceTitle}`}
          aria-pressed={featured?.key === item.key}
          onClick={() => setFeaturedKey(item.key)}
        >
          <div className="reference-thumb-image">
            <MediaThumbnail
              media={mediaMap.get(item.mediaId)}
              altText={item.altText || item.sourceTitle}
            />
          </div>
          <span>{item.label}</span>
        </button>
      ))}
      {items.length > 6 && (
        <button
          type="button"
          className="reference-thumb reference-more"
          onClick={() => setGalleryOpen(true)}
          aria-label={`View All ${items.length} references`}
        >
          <Grid2X2 size={20} />
          <span>+{items.length - 6} more</span>
        </button>
      )}
    </div>
  );

  return (
    <section className="reference-board" aria-label={title}>
      <div className="studio-panel-heading">
        <div>
          <span className="studio-eyebrow">VISUAL DIRECTION</span>
          <h2 className="section-title">{title}</h2>
        </div>
        <span className="badge">
          {items.length} {items.length === 1 ? 'reference' : 'references'}
        </span>
      </div>
      {featured ? (
        <>
          <div className="reference-featured">
            {!previewOpen && !galleryOpen && (
              <MediaThumbnail
                media={media}
                altText={featured.altText || featured.sourceTitle}
                showVideoControls={true}
              />
            )}
            <button
              type="button"
              className="icon-btn reference-expand"
              onClick={() => setPreviewOpen(true)}
              disabled={!media}
              aria-label="Expand Media"
            >
              <Maximize2 size={17} />
            </button>
          </div>
          <div className="reference-caption">
            <div className="studio-inline">
              <span className="badge badge-primary">{featured.label}</span>
              <span className="badge">{featured.role}</span>
              {media?.isBundledIllustration && (
                <span className="badge badge-warning">Demo illustration</span>
              )}
            </div>
            <strong>{featured.sourceTitle}</strong>
            {!media && (
              <span className="muted-text">
                File unavailable: {featured.filename || featured.mediaId}
              </span>
            )}
            {downloadable && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!media}
                onClick={() =>
                  media &&
                  downloadBlobAsFile(
                    media.blob,
                    media.safeFilename || media.filename
                  )
                }
              >
                <Download size={14} /> Download {featured.label} reference
              </button>
            )}
          </div>
          {collapseThumbnails ? (
            <details className="studio-disclosure reference-secondary">
              <summary>Show reference thumbnails ({items.length})</summary>
              {thumbnailStrip}
            </details>
          ) : (
            thumbnailStrip
          )}
          <div className="reference-board-footer">
            <span className="muted-text">
              References only. This app does not render a combined scene.
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setGalleryOpen(true)}
            >
              <Grid2X2 size={14} /> View All ({items.length})
            </button>
          </div>
        </>
      ) : (
        <div className="reference-empty">
          <Image size={36} aria-hidden="true" />
          <strong>Your visual direction starts here</strong>
          <p>Select components in the recipe to preview their references.</p>
          <p>References only. This app does not render a combined scene.</p>
        </div>
      )}
      {previewOpen && media && featured && (
        <MediaPreviewDialog
          media={media}
          title={featured.sourceTitle}
          altText={featured.altText}
          onClose={() => setPreviewOpen(false)}
        />
      )}
      {galleryOpen && (
        <StudioDialog
          title="All references"
          onClose={() => setGalleryOpen(false)}
          className="reference-gallery-dialog"
        >
          <p className="muted-text">
            All {items.length} reference associations are shown. Preview
            selection does not change saved references or exports.
          </p>
          <div className="reference-gallery">
            {items.map((item) => {
              const record = mediaMap.get(item.mediaId);
              return (
                <article key={item.key} className="reference-gallery-item">
                  <div className="reference-gallery-image">
                    <MediaThumbnail
                      media={record}
                      altText={item.altText || item.sourceTitle}
                      showVideoControls={true}
                    />
                  </div>
                  <div className="reference-caption">
                    <div className="studio-inline">
                      <span className="badge badge-primary">{item.label}</span>
                      <span className="badge">{item.role}</span>
                      {record?.isBundledIllustration && (
                        <span className="badge badge-warning">
                          Demo illustration
                        </span>
                      )}
                    </div>
                    <strong>{item.sourceTitle}</strong>
                    <span className="muted-text">
                      {record?.filename || item.filename || item.mediaId}
                    </span>
                    {downloadable && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={!record}
                        onClick={() =>
                          record &&
                          downloadBlobAsFile(
                            record.blob,
                            record.safeFilename || record.filename
                          )
                        }
                        aria-label={`Download ${item.label}: ${item.sourceTitle}`}
                      >
                        <Download size={14} />
                        {record ? 'Download original' : 'File unavailable'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </StudioDialog>
      )}
    </section>
  );
};
