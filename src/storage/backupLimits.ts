import {
  MAX_BACKUP_ENTRIES,
  MAX_BACKUP_UNCOMPRESSED_BYTES,
  MAX_MANIFEST_BYTES,
  MAX_TOTAL_MEDIA_BYTES,
} from '../domain/validation';

export { MAX_BACKUP_ENTRIES, MAX_BACKUP_UNCOMPRESSED_BYTES, MAX_MANIFEST_BYTES, MAX_TOTAL_MEDIA_BYTES };

export const MAX_BACKUP_COMPRESSED_BYTES = 5500 * 1024 * 1024;
export const MAX_BUFFERED_BACKUP_BYTES = 64 * 1024 * 1024;
// Verified production restore: 1 GiB of media plus the measured fixture manifest. Larger restores remain disabled.
export const MAX_VERIFIED_RESTORE_BYTES = 1073748246;
export const CHUNK_BYTES = 256 * 1024;
export const MAX_CENTRAL_DIRECTORY_BYTES = 16 * 1024 * 1024;
export const MAX_ARCHIVE_FILENAME_BYTES = 1024;
