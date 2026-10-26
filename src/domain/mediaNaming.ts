import type { MediaAsset, MediaLink, ReferencePackEntry } from '../types/domain';
type Names = { displayName?: string; exportFilename?: string; namesCaptured?: true; filename?: string };
export function validateDisplayName(name: string): string {
 if (typeof name !== 'string' || !name.trim() || name.length > 200 || /[\x00-\x1f\x7f]/.test(name)) throw new Error('Display Name must contain 1–200 characters without control characters.');
 return name;
}
export function validateExportFilename(name: string, mimeType: string): string {
 const extensions: Record<string,string[]> = {'image/jpeg':['jpg','jpeg'],'image/jpg':['jpg','jpeg'],'image/png':['png'],'image/webp':['webp'],'image/svg+xml':['svg'],'video/mp4':['mp4'],'video/webm':['webm']};
 if (typeof name !== 'string' || !name || name.length > 200 || /[\\/:*?"<>|\x00-\x1f\x7f]/.test(name) || name.includes('..') || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) throw new Error('Export Filename must be a safe basename without paths, reserved names, or trailing dots/spaces.');
 const ext = name.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase();
 if (!ext || !extensions[mimeType]?.includes(ext)) throw new Error('Export Filename extension must match the original media MIME type.');
 return name;
}
export function getMediaDisplayName(media: MediaAsset | undefined, association?: Names, historical = false): string {
 return association?.displayName ?? ((!historical && !association?.namesCaptured) ? media?.displayName : undefined) ?? association?.filename ?? media?.filename ?? 'Unavailable media';
}
export function getDownloadFilename(media: MediaAsset, association?: Names, historical = false): string {
 const requested=association?.exportFilename ?? ((!historical && !association?.namesCaptured) ? media.exportFilename : undefined);
 if(requested) return validateExportFilename(requested,media.mimeType);
 return (association?.filename ?? media.safeFilename ?? media.filename).split(/[\\/]/).pop() || 'reference';
}
export function captureMediaNames<T extends MediaLink | ReferencePackEntry>(links: T[], mediaMap: ReadonlyMap<string,MediaAsset>): T[] {
 return links.map(link=>link.namesCaptured ? link : {...link,displayName:link.displayName ?? mediaMap.get(link.mediaId)?.displayName,exportFilename:link.exportFilename ?? mediaMap.get(link.mediaId)?.exportFilename,namesCaptured:true});
}
