import React, { useEffect, useId, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import {
  ALLOWED_IMAGE_MIMES,
  ALLOWED_VIDEO_MIMES,
  MAX_FILES_PER_RECORD,
} from '../domain/validation';
import './mediaDropZone.css';

const hasFiles = (transfer: DataTransfer | null) =>
  Array.from(transfer?.types ?? []).includes('Files');

export const MediaDropZone: React.FC<{
  count: number;
  busy?: boolean;
  onFiles: (files: File[]) => void | Promise<void>;
}> = ({ count, busy = false, onFiles }) => {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [active, setActive] = useState(false);
  useEffect(() => {
    // External files dropped anywhere in the editor must never replace the page.
    const preventNavigation = (event: DragEvent) => {
      if (hasFiles(event.dataTransfer)) event.preventDefault();
    };
    window.addEventListener('dragover', preventNavigation);
    window.addEventListener('drop', preventNavigation);
    return () => {
      window.removeEventListener('dragover', preventNavigation);
      window.removeEventListener('drop', preventNavigation);
    };
  }, []);
  return (
    <section
      className="media-drop-zone"
      role="region"
      aria-label="Upload media"
      aria-busy={busy}
      data-drag-active={active}
      onDragEnter={(event) => {
        if (!hasFiles(event.dataTransfer)) return;
        event.preventDefault();
        depth.current++;
        const items = Array.from(event.dataTransfer.items ?? []);
        setActive(
          !busy &&
            items.some(
              (item) =>
                item.kind === 'file' &&
                (ALLOWED_IMAGE_MIMES.has(item.type) ||
                  ALLOWED_VIDEO_MIMES.has(item.type))
            )
        );
      }}
      onDragOver={(event) => {
        if (hasFiles(event.dataTransfer)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
        }
      }}
      onDragLeave={(event) => {
        if (hasFiles(event.dataTransfer) && --depth.current <= 0) {
          depth.current = 0;
          setActive(false);
        }
      }}
      onDrop={(event) => {
        if (!hasFiles(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        depth.current = 0;
        setActive(false);
        if (!busy) void onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <Upload size={22} aria-hidden="true" />
      <strong>
        {busy ? 'Uploading media…' : 'Drop images or videos here'}
      </strong>
      <span className="muted-text" id={`${id}-hint`}>
        JPG, PNG, WebP, MP4 or WebM · {count}/{MAX_FILES_PER_RECORD} attached
      </span>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        Choose Image or Video Files ({count}/{MAX_FILES_PER_RECORD})
      </button>
      <input
        ref={input}
        id={id}
        type="file"
        multiple
        hidden
        disabled={busy}
        aria-label="Choose Image or Video Files"
        aria-describedby={`${id}-hint`}
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          if (files.length && !busy) void onFiles(files);
        }}
      />
    </section>
  );
};
