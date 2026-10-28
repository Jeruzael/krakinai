import { ORDERED_BUILDER_SLOTS } from './promptAssembler';
import { validatePerformanceDirection } from './dialoguePerformance';
import { isShotType } from './shotTypeRules';
import { MAX_FILES_PER_RECORD, MAX_MANIFEST_BYTES } from './validation';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 100000, nonblank = false) => typeof value === 'string' && value.length <= max && (!nonblank || !!value.trim());
const revision = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 1;
const date = (value: unknown) => text(value, 100, true) && Number.isFinite(Date.parse(value as string));
const mimes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/webm']);

function identityError(value: Record<string, unknown>): string | undefined {
  if (value.identityRevision !== undefined && !revision(value.identityRevision)) return 'Invalid identityRevision.';
  if (value.identityAnchor === undefined) return;
  const anchor = value.identityAnchor;
  if (!record(anchor) || !text(anchor.text)) return 'Invalid identity anchor text.';
  const approval = [anchor.approvedText, anchor.approvedMasterIdentityRevision, anchor.approvedAt];
  if (approval.some(v => v !== undefined) && (!text(anchor.approvedText, 100000, true) || !revision(anchor.approvedMasterIdentityRevision) || !date(anchor.approvedAt))) return 'Invalid identity anchor approval metadata.';
}

/** Validate optional Stage B metadata without resolving historical source or media IDs. */
export function validatePhase4Record(value: unknown): string | undefined {
  if (!record(value)) return 'Invalid record.';
  if (value.inheritedAvoidPrefix !== undefined && !text(value.inheritedAvoidPrefix,MAX_MANIFEST_BYTES)) return 'Invalid inherited negative prefix.';
  if (value.shotType !== undefined && !isShotType(value.shotType)) return 'Invalid Shot Type.';
  if (value.sourceMediaLinks !== undefined) {
    if (!Array.isArray(value.sourceMediaLinks) || value.sourceMediaLinks.length > MAX_FILES_PER_RECORD) return 'Invalid source media links.';
    for (const link of value.sourceMediaLinks) {
      if (!record(link) || !text(link.mediaId, 1000, true) || link.role !== 'reference' || !text(link.altText, 10000) || !Number.isSafeInteger(link.order) || (link.order as number) < 0) return 'Invalid source media association.';
      if (link.filename !== undefined && !text(link.filename, 1000, true)) return 'Invalid source media filename.';
      if (link.mimeType !== undefined && !mimes.has(link.mimeType as string)) return 'Invalid source media MIME type.';
      if (link.viewLabel !== undefined && !text(link.viewLabel, 1000)) return 'Invalid source media view label.';
    }
  }
  if(record(value.dialogue)) {
    const error=validatePerformanceDirection(value.dialogue.performanceDirection);
    if(error)return error;
  }
  const identity = identityError(value);
  if (identity) return identity;
  if (record(value.slots)) for (const snapshot of Object.values(value.slots)) {
    if (!record(snapshot)) continue;
    const error = identityError(snapshot);
    if (error) return error;
  }
  if (record(value.includedCharacterSnapshot)) {
    const error = identityError(value.includedCharacterSnapshot);
    if (error) return error;
  }
  if (value.generation !== undefined) {
    const generation = value.generation;
    if (!record(generation) || !['master', 'approved_anchor'].includes(generation.identitySource as string)) return 'Invalid generation identity source.';
    if (generation.fallbackReason !== undefined && !text(generation.fallbackReason, 10000)) return 'Invalid generation fallback reason.';
    if (generation.anchor !== undefined) {
      const anchor = generation.anchor;
      if (!record(anchor) || !text(anchor.text, 100000, true) || !revision(anchor.approvedMasterIdentityRevision) || !date(anchor.approvedAt)) return 'Invalid generation anchor approval metadata.';
    }
    if (generation.identitySource === 'approved_anchor' && generation.anchor === undefined) return 'Approved anchor generation requires captured approval metadata.';
  }
  if (value.referencePack !== undefined) {
    const pack = value.referencePack;
    if (!record(pack) || pack.version !== 1 || !Array.isArray(pack.entries) || pack.entries.length > 2000) return 'Invalid reference pack.';
    const associations = new Set<string>();
    const orders = new Set<number>();
    for (const entry of pack.entries) {
      if (!record(entry) || !text(entry.associationId, 10000, true) || !text(entry.mediaId, 1000, true) || !text(entry.sourceId, 1000, true) || !text(entry.sourceTitle, 10000) || !text(entry.altText, 10000)) return 'Invalid reference pack association metadata.';
      if (![...ORDERED_BUILDER_SLOTS, 'result', 'legacy', 'source'].includes(entry.sourceSlot as never) || !['reference', 'sample', 'result'].includes(entry.role as string) || !['identity', 'outfit', 'environment', 'motion', 'general'].includes(entry.purpose as string)) return 'Invalid reference pack enum value.';
      if (entry.sourceSlot === 'source' && entry.role !== 'reference') return 'Invalid source reference pack role.';
      if (!Number.isSafeInteger(entry.order) || (entry.order as number) < 0 || orders.has(entry.order as number)) return 'Invalid or duplicate reference pack order.';
      if (associations.has(entry.associationId as string)) return 'Duplicate reference pack association ID.';
      if (entry.filename !== undefined && !text(entry.filename, 1000, true)) return 'Invalid reference pack filename.';
      if (entry.mimeType !== undefined && !mimes.has(entry.mimeType as string)) return 'Invalid reference pack MIME type.';
      associations.add(entry.associationId as string);
      orders.add(entry.order as number);
    }
  }
}
