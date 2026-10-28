import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageOff, Play } from 'lucide-react';
import type { MediaAsset } from '../types/domain';
import { useMediaObjectUrl } from '../hooks/useObjectUrl';

// All thumbnail instances share one hover player; expanded playback is explicit.
let activeHover: { video: HTMLVideoElement; stop: () => void } | undefined;

interface MediaThumbnailProps {
  media?: MediaAsset;
  enableHoverPreview?: boolean;
  altText?: string;
  showVideoControls?: boolean;
  emptyLabel?: string;
  roleBadge?: string;
  imageZoom?: number | 'actual';
  onImageDimensions?: (size: { width: number; height: number }) => void;
}

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({
  media,
  enableHoverPreview = false,
  altText,
  showVideoControls = false,
  emptyLabel = 'No sample yet. Add an image or video when ready.',
  roleBadge,
  imageZoom,
  onImageDimensions,
}) => {
  const url = useMediaObjectUrl(media);
  const videoRef = useRef<HTMLVideoElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const eligible = useRef(false);
  const generation = useRef(0);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (imageZoom === undefined || !surfaceRef.current) return;
    const surface = surfaceRef.current;
    const measure = () =>
      setViewport({ width: surface.clientWidth, height: surface.clientHeight });
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(surface);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [imageZoom, url]);
  const stop = useCallback((video = videoRef.current) => {
    generation.current += 1;
    if (!video) return;
    if (activeHover?.video === video) activeHover = undefined;
    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      // The browser may not have loaded metadata yet.
    }
  }, []);
  useEffect(() => {
    if (!enableHoverPreview || showVideoControls || !window.matchMedia) return;
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      eligible.current = pointer.matches && !motion.matches;
      if (!eligible.current) {
        hovering.current = false;
        stop();
      }
    };
    update();
    pointer.addEventListener('change', update);
    motion.addEventListener('change', update);
    return () => {
      eligible.current = false;
      hovering.current = false;
      stop();
      pointer.removeEventListener('change', update);
      motion.removeEventListener('change', update);
    };
  }, [enableHoverPreview, showVideoControls, stop]);
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      hovering.current = false;
      stop(video);
    };
  }, [media, url, showVideoControls, stop]);
  useEffect(() => {
    if (!enableHoverPreview || showVideoControls) return;
    const pause = () => {
      hovering.current = false;
      stop();
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    document.addEventListener('visibilitychange', visibility);
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? undefined
        : new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) pause();
          });
    if (surfaceRef.current) observer?.observe(surfaceRef.current);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [enableHoverPreview, showVideoControls, url, stop]);
  const start = () => {
    const video = videoRef.current;
    // Pointer entry itself proves visibility; IntersectionObserver can still
    // contain the previous offscreen position immediately after scrolling.
    if (
      !video ||
      !eligible.current ||
      document.visibilityState === 'hidden' ||
      !enableHoverPreview ||
      showVideoControls
    )
      return;
    if (activeHover?.video !== video) activeHover?.stop();
    hovering.current = true;
    activeHover = {
      video,
      stop: () => {
        hovering.current = false;
        stop(video);
      },
    };
    const request = ++generation.current;
    video.muted = true;
    try {
      const playback = video.play();
      playback
        ?.then(() => {
          if (
            !hovering.current ||
            !eligible.current ||
            video !== videoRef.current
          )
            stop(video);
        })
        .catch(() => {
          if (request === generation.current) stop(video);
        });
    } catch {
      stop(video);
    }
  };
  const [decodeError, setDecodeError] = useState(false);

  useEffect(() => {
    setDecodeError(false);
  }, [media?.id, url]);

  if (!media || !url || decodeError) {
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
        <span style={{ fontSize: 12, fontWeight: 500 }}>
          {decodeError ? 'Media file unavailable or corrupted.' : emptyLabel}
        </span>
      </div>
    );
  }

  const isVideo =
    media.mimeType === 'video/mp4' || media.mimeType === 'video/webm';
  const zoomable = imageZoom !== undefined && !isVideo;
  const fit = natural.width
    ? Math.min(
        1,
        (viewport.width || natural.width) / natural.width,
        (viewport.height || natural.height) / natural.height
      )
    : 1;
  const scale =
    imageZoom === 'actual' ? 1 : fit * Math.min(4, Math.max(1, imageZoom ?? 1));
  const imageWidth = natural.width * scale,
    imageHeight = natural.height * scale;

  return (
    <div
      onPointerEnter={start}
      ref={surfaceRef}
      tabIndex={zoomable ? 0 : undefined}
      role={zoomable ? 'region' : undefined}
      aria-label={
        zoomable ? 'Image viewport; scroll to pan when zoomed' : undefined
      }
      onPointerLeave={() => {
        if (enableHoverPreview && !showVideoControls) {
          hovering.current = false;
          stop();
        }
      }}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems:
          zoomable && imageHeight > viewport.height ? 'flex-start' : 'center',
        justifyContent:
          zoomable && imageWidth > viewport.width ? 'flex-start' : 'center',
        background: '#F8FAFC',
        overflow: zoomable ? 'auto' : undefined,
      }}
    >
      {isVideo ? (
        showVideoControls ? (
          <video
            ref={videoRef}
            src={url}
            controls
            muted
            playsInline
            preload="metadata"
            onError={() => {
              stop();
              setDecodeError(true);
            }}
            style={{
              width: '100%',
              height: '100%',
              maxHeight: 520,
              objectFit: 'contain',
            }}
          >
            Your browser does not support playable MP4/WebM video.
          </video>
        ) : (
          <>
            <video
              ref={videoRef}
              src={url}
              loop
              preload="metadata"
              muted
              playsInline
              onError={() => {
                stop();
                setDecodeError(true);
              }}
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
          draggable={false}
          onLoad={(event) => {
            if (imageZoom === undefined && !onImageDimensions) return;
            const img = event.currentTarget,
              size = { width: img.naturalWidth, height: img.naturalHeight };
            setNatural(size);
            onImageDimensions?.(size);
          }}
          onError={() => {
            stop();
            setDecodeError(true);
          }}
          style={
            zoomable && natural.width
              ? {
                  width: imageWidth,
                  height: imageHeight,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  flexShrink: 0,
                }
              : { width: '100%', height: '100%', objectFit: 'contain' }
          }
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
