import type {
  MediaLink,
  PromptAsset,
  ReviewStatus,
  Variant,
  VariantType,
} from "../types/domain";
import { validateVariantInput, VARIANT_TYPE_TO_SLOT } from "./validation";
export interface VariantRecordInput {
  id?: string;
  parentCharacterId: string;
  type: VariantType;
  title: string;
  description?: string;
  promptText: string;
  compactText?: string;
  avoidText?: string;
  tags: string[];
  mediaLinks?: MediaLink[];
  coverMediaId?: string;
  favorite?: boolean;
  reviewStatus?: ReviewStatus;
  notes?: string;
}
/** Shared by the existing editor and synchronous import planner; never writes. */
export function buildVariantRecord(
  input: VariantRecordInput,
  parent: PromptAsset | undefined,
  existing: Variant | undefined,
  identity: { id: string; now: string },
): Variant {
  const valid = validateVariantInput(input);
  if (!valid.valid) throw Error(Object.values(valid.errors).join(" "));
  if (!parent || parent.category !== "characters")
    throw Error("Parent character does not exist.");
  if (
    existing &&
    (existing.parentCharacterId !== input.parentCharacterId ||
      existing.type !== input.type)
  )
    throw Error(
      "Variant parent character and type are fixed after first save. Duplicate to change them.",
    );
  const mediaLinks = (input.mediaLinks ?? existing?.mediaLinks ?? []).map(
    (l, idx) => ({ ...l, order: idx }),
  );
  const coverMediaId =
    input.coverMediaId &&
    mediaLinks.some((m) => m.mediaId === input.coverMediaId)
      ? input.coverMediaId
      : mediaLinks[0]?.mediaId;
  return {
    id: existing?.id || input.id || identity.id,
    parentCharacterId: existing
      ? existing.parentCharacterId
      : input.parentCharacterId,
    type: existing ? existing.type : input.type,
    targetSlot: VARIANT_TYPE_TO_SLOT[existing ? existing.type : input.type],
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    promptText: input.promptText.trim(),
    compactText: input.compactText?.trim() || undefined,
    avoidText: input.avoidText?.trim() || undefined,
    tags: input.tags.map((t) => t.trim()).filter(Boolean),
    mediaLinks,
    coverMediaId,
    favorite: input.favorite ?? existing?.favorite ?? false,
    reviewStatus: input.reviewStatus ?? existing?.reviewStatus ?? "unreviewed",
    notes: (input.notes ?? existing?.notes ?? "").trim(),
    isStarter: existing?.isStarter ?? false,
    revision: existing ? existing.revision + 1 : 1,
    createdAt: existing?.createdAt || identity.now,
    updatedAt: identity.now,
  };
}
