import { useEffect, useState } from 'react';
import type { MediaAsset } from '../types/domain';

export function useMediaObjectUrl(media: MediaAsset | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!media || !media.blob) {
      setUrl(null);
      return;
    }
    const createdUrl = URL.createObjectURL(media.blob);
    setUrl(createdUrl);
    return () => {
      URL.revokeObjectURL(createdUrl);
    };
  }, [media]);

  return url;
}

export function downloadBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
