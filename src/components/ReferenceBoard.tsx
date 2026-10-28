import {
  getMediaDisplayName,
  getDownloadFilename,
} from '../domain/mediaNaming';
import React, { useState, useEffect, useRef } from 'react';
import { Download, Grid2X2, Image, Maximize2 } from 'lucide-react';
import type { MediaAsset } from '../types/domain';
import { MediaThumbnail } from './MediaThumbnail';
import { MediaPreviewDialog } from './MediaPreviewDialog';
import { StudioDialog } from './StudioDialog';
import { downloadBlobAsFile } from '../hooks/useObjectUrl';

export interface StudioReference {
  isSource?: boolean;
  key: string;
  mediaId: string;
  label: string;
  sourceTitle: string;
  role: string;
  altText?: string;
  filename?: string;
  displayName?: string;
  exportFilename?: string;
  namesCaptured?: true;
}

export const ReferenceBoard: React.FC<{
  items: StudioReference[];
  mediaMap: Map<string, MediaAsset>;
  title?: string;
  collapseThumbnails?: boolean;
  downloadable?: boolean;
  historical?: boolean;
}> = ({
  items,
  mediaMap,
  title = 'Reference Board',
  collapseThumbnails = false,
  downloadable = false,
  historical = false,
}) => {
  const [featuredKey, setFeaturedKey] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<StudioReference | null>(null);
  const [galleryPage, setGalleryPage] = useState(0);
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);
  const previewButtons = useRef<Record<string, HTMLButtonElement | null>>({}),
    featuredButton = useRef<HTMLButtonElement>(null),
    restorePreview = useRef<string | null>(null);
  useEffect(() => {
    if (previewItem || !restorePreview.current) return;
    const frame = requestAnimationFrame(() => {
      (restorePreview.current === 'featured'
        ? featuredButton.current
        : previewButtons.current[restorePreview.current!]
      )?.focus();
      restorePreview.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [previewItem]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const galleryButtons = useRef<Record<string, HTMLButtonElement | null>>({}),
    galleryOrigin = useRef('all'),
    restoreGallery = useRef(false);
  const openGallery = (origin: string) => {
    galleryOrigin.current = origin;
    setGalleryOpen(true);
  };
  useEffect(() => {
    if (galleryOpen || !restoreGallery.current) return;
    const frame = requestAnimationFrame(() => {
      galleryButtons.current[galleryOrigin.current]?.focus();
      restoreGallery.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [galleryOpen]);
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
          ref={(el) => {
            galleryButtons.current.more = el;
          }}
          onClick={() => openGallery('more')}
          aria-label={`View All ${items.length} references`}
        >
          <Grid2X2 size={20} />
          <span>+{items.length - 6} more</span>
        </button>
      )}
    </div>
  );

  if (previewItem && mediaMap.get(previewItem.mediaId))
    return (
      <MediaPreviewDialog
        media={mediaMap.get(previewItem.mediaId)!}
        title={previewItem.sourceTitle}
        altText={previewItem.altText}
        onClose={() => setPreviewItem(null)}
      />
    );
  const pageCount = Math.max(1, Math.ceil(items.length / 12)),
    page = Math.min(galleryPage, pageCount - 1);
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
            {!previewItem && !galleryOpen && (
              <MediaThumbnail
                media={media}
                altText={featured.altText || featured.sourceTitle}
                showVideoControls={true}
              />
            )}
            <button
              type="button"
              className="icon-btn reference-expand"
              ref={featuredButton}
              onClick={() => {
                restorePreview.current = 'featured';
                setPreviewItem(featured);
              }}
              disabled={!media}
              aria-label="Expand Media"
            >
              <Maximize2 size={17} />
            </button>
          </div>
          <div className="reference-caption">
            <div className="studio-inline">
              <span className="badge badge-primary">{featured.label}</span>
              <span className="badge">{featured.isSource ? 'Original input' : featured.role}</span>
              {media?.isBundledIllustration && (
                <span className="badge badge-warning">Demo illustration</span>
              )}
            </div>
            <strong>{featured.sourceTitle}</strong>
            <span className="muted-text">
              {getMediaDisplayName(media, featured, historical)}
            </span>
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
                    getDownloadFilename(media, featured, historical)
                  )
                }
              >
                <Download size={14} /> Download {featured.label} reference
              </button>
            )}
          </div>
          {collapseThumbnails ? (
            <details
              className="studio-disclosure reference-secondary"
              open={thumbnailsOpen}
              onToggle={(event) => setThumbnailsOpen(event.currentTarget.open)}
            >
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
              ref={(el) => {
                galleryButtons.current.all = el;
              }}
              onClick={() => openGallery('all')}
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
      {galleryOpen && (
        <StudioDialog
          title="All references"
          onClose={() => {
            restoreGallery.current = true;
            setGalleryOpen(false);
          }}
          className="reference-gallery-dialog"
        >
          <p className="muted-text">
            All {items.length} reference associations are available in pages of
            12. Preview selection does not change saved references or exports.
          </p>
          <div className="reference-gallery">
            {items.slice(page * 12, (page + 1) * 12).map((item) => {
              const record = mediaMap.get(item.mediaId);
              return (
                <article key={item.key} className="reference-gallery-item">
                  <div className="reference-gallery-image">
                    <MediaThumbnail
                      media={record}
                      altText={item.altText || item.sourceTitle}
                      enableHoverPreview
                    />
                  </div>
                  <div className="reference-caption">
                    <div className="studio-inline">
                      <span className="badge badge-primary">{item.label}</span>
                      <span className="badge">{item.isSource ? 'Original input' : item.role}</span>
                      {record?.isBundledIllustration && (
                        <span className="badge badge-warning">
                          Demo illustration
                        </span>
                      )}
                    </div>
                    <strong>{item.sourceTitle}</strong>
                    <span className="muted-text">
                      {getMediaDisplayName(record, item, historical)}
                    </span>
                    <span
                      className="muted-text"
                      title={item.filename || record?.filename}
                    >
                      Original:{' '}
                      {item.filename || record?.filename || item.mediaId}
                    </span>
                    <button
                      ref={(el) => {
                        previewButtons.current[item.key] = el;
                      }}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={!record}
                      aria-label={`Preview ${item.label}: ${item.sourceTitle}`}
                      onClick={() => {
                        restorePreview.current = item.key;
                        setPreviewItem(item);
                      }}
                    >
                      Preview
                    </button>
                    {downloadable && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={!record}
                        onClick={() =>
                          record &&
                          downloadBlobAsFile(
                            record.blob,
                            getDownloadFilename(record, item, historical)
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
          <div className="reference-gallery-pagination">
            <p aria-live="polite">
              {items.length
                ? `${page * 12 + 1}–${Math.min((page + 1) * 12, items.length)} of ${items.length} associations`
                : '0 associations'}{' '}
              · Page {page + 1} of {pageCount}
            </p>
            <div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-label="Previous references page"
                disabled={page === 0}
                onClick={() => setGalleryPage(page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-label="Next references page"
                disabled={page === pageCount - 1}
                onClick={() => setGalleryPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </StudioDialog>
      )}
    </section>
  );
};
