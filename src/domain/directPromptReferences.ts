import type {
  MediaLink,
  ReferencePack,
  SavedScene,
  SceneDraft,
} from "../types/domain";
const associationKey = (link: MediaLink) =>
  JSON.stringify([link.mediaId, link.role, link.altText, link.viewLabel ?? ""]);
/** Recover independent refs without treating an original input as a second attachment. */
export function getDirectReferenceLinks(source: {
  directReferences?: MediaLink[];
  references?: MediaLink[];
  sourceMediaLinks?: MediaLink[];
}): MediaLink[] {
  if (source.directReferences !== undefined)
    return structuredClone(source.directReferences);
  const links = structuredClone(source.references ?? []);
  for (const original of source.sourceMediaLinks ?? []) {
    const index = links.findIndex(
      (link) => associationKey(link) === associationKey(original),
    );
    if (index >= 0) links.splice(index, 1);
  }
  return links;
}
/** Add explicit new selections to a retained pack without undoing inherited exclusions. */
export function reconcileDirectReferencePack(
  draft: SceneDraft,
  source?: SavedScene,
): ReferencePack | undefined {
  if (!draft.referencePack) return;
  const before = getDirectReferenceLinks(source ?? {}),
    after = draft.directReferences ?? [],
    sources = draft.sourceMediaLinks ?? [];
  const beforeKeys = new Set(before.map(associationKey)),
    afterKeys = new Set(after.map(associationKey)),
    sourceKeys = new Set(sources.map(associationKey));
  const entries = structuredClone(draft.referencePack.entries).filter(
    (entry) =>
      entry.sourceSlot === "source"
        ? sourceKeys.has(associationKey(entry))
        : !beforeKeys.has(associationKey(entry)) ||
          afterKeys.has(associationKey(entry)),
  );
  const remaining = new Map<string, number>();
  for (const link of before) {
    const key = associationKey(link);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  const occurrences = new Map<string, number>();
  const inheritedSelected = new Map<string, number>();
  for (const entry of source?.referencePack?.entries ?? [])
    if (entry.sourceSlot !== "source") {
      const key = associationKey(entry);
      inheritedSelected.set(key, (inheritedSelected.get(key) ?? 0) + 1);
    }
  for (const link of after) {
    const key = associationKey(link),
      count = remaining.get(key) ?? 0;
    if (count) {
      remaining.set(key, count - 1);
      continue;
    }
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    if (
      entries.filter(
        (entry) =>
          entry.sourceSlot !== "source" && associationKey(entry) === key,
      ).length >=
      (inheritedSelected.get(key) ?? 0) + occurrence + 1
    )
      continue;
    entries.push({
      ...link,
      associationId: JSON.stringify(["direct", draft.id, key, occurrence]),
      sourceSlot: "legacy",
      sourceId: draft.id,
      sourceTitle: draft.title,
      purpose: "general",
      order: entries.length,
    });
  }
  const sourceOccurrences = new Map<string, number>();
  for (const link of sources) {
    const sourceKey = associationKey(link),
      occurrence = (sourceOccurrences.get(sourceKey) ?? 0) + 1;
    sourceOccurrences.set(sourceKey, occurrence);
    if (
      entries.filter(
        (entry) =>
          entry.sourceSlot === "source" &&
          associationKey(entry) === associationKey(link),
      ).length >= occurrence
    )
      continue;
    entries.push({
      ...link,
      associationId: JSON.stringify([
        "direct-source",
        draft.id,
        associationKey(link),
        entries.length,
      ]),
      sourceSlot: "source",
      sourceId: draft.id,
      sourceTitle: "Original Source Media",
      purpose: "general",
      order: entries.length,
    });
  }
  return {
    version: 1,
    entries: entries.map((entry, order) => ({ ...entry, order })),
  };
}
