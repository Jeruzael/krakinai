import type {
  MediaAsset,
  OutputMode,
  SavedScene,
  SceneDraft,
} from "../types/domain";
import type { DirectPromptContent } from "../types/sceneAuthoring";
import { isShotType, validateShotSourceMedia } from "./shotTypeRules";
import { MAX_FILES_PER_RECORD } from "./validation";

export const MAX_DIRECT_PROMPT_LENGTH = 100_000;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number, nonblank = false): v is string =>
  typeof v === "string" && v.length <= max && (!nonblank || !!v.trim());
const id = (v: unknown) => text(v, 1000, true);
const iso = (v: unknown) =>
  text(v, 100) && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v));
const positive = (v: unknown) => Number.isSafeInteger(v) && (v as number) > 0;
const origin = (v: unknown) =>
  v === undefined ||
  ["manual", "chatgpt", "codex", "external"].includes(v as string);

export function isDirectPrompt<T extends object>(
  value: T,
): value is T & {
  authoringMode: "direct_prompt";
  directPrompt: DirectPromptContent;
} {
  return "authoringMode" in value && value.authoringMode === "direct_prompt";
}
export function getSceneOutput(
  record: {
    authoringMode?: unknown;
    directPrompt?: DirectPromptContent;
    outputs?: { full: string; structured?: string; compact?: string };
  },
  mode: OutputMode,
): string | undefined {
  return isDirectPrompt(record)
    ? mode === "full"
      ? record.directPrompt.text
      : undefined
    : record.outputs?.[mode];
}

/** Optional metadata validator: legacy content is not reinterpreted or rewritten. */
export function validateSceneAuthoring(
  value: unknown,
  saved = false,
): string | undefined {
  if (!object(value)) return "Invalid scene authoring record.";
  if (
    value.authoringMode !== undefined &&
    !["recipe", "direct_prompt"].includes(value.authoringMode as string)
  )
    return "Unsupported scene authoring mode. Update KRAKINAI before importing this record.";
  if (
    value.authoringMode !== "direct_prompt" &&
    value.directPrompt !== undefined
  )
    return "Direct prompt content cannot be stored in recipe mode.";
  if (value.pendingInputs !== undefined) {
    if (!Array.isArray(value.pendingInputs) || value.pendingInputs.length > 100)
      return "Invalid pending scene inputs (maximum 100).";
    const ids = new Set<string>();
    for (const input of value.pendingInputs) {
      if (
        !object(input) ||
        input.version !== 1 ||
        !id(input.id) ||
        ids.has(input.id as string) ||
        !["reference_image", "source_image", "source_video", "other"].includes(
          input.kind as string,
        ) ||
        !text(input.label, 240, true) ||
        (input.notes !== undefined && !text(input.notes, 10000)) ||
        input.mediaId !== undefined
      )
        return "Invalid pending input metadata. Pending inputs must not claim attached media IDs.";
      ids.add(input.id as string);
    }
  }
  if (value.claimNotes !== undefined && !text(value.claimNotes, 10000))
    return "Claim review notes must be 10,000 characters or fewer.";
  if (value.directReferences !== undefined) {
    if (
      !Array.isArray(value.directReferences) ||
      value.directReferences.length > 2000
    )
      return "Invalid direct references.";
    for (const link of value.directReferences)
      if (
        !object(link) ||
        !id(link.mediaId) ||
        !["reference", "sample", "result"].includes(link.role as string) ||
        !text(link.altText, 10000) ||
        !Number.isSafeInteger(link.order) ||
        (link.order as number) < 0
      )
        return "Invalid direct reference association.";
  }
  for (const key of ["sceneRevision", "revisionIntent"] as const) {
    const data = value[key];
    if (data === undefined) continue;
    if (!object(data) || data.version !== 1)
      return `Unsupported ${key} metadata version. Update KRAKINAI before importing.`;
    if (
      !id(data.rootSceneId) ||
      (data.parentSceneId !== undefined && !id(data.parentSceneId)) ||
      (data.reason !== undefined && !text(data.reason, 10000)) ||
      (data.restoredFromSceneId !== undefined && !id(data.restoredFromSceneId))
    )
      return `Invalid ${key} metadata.`;
    if (data.contextSceneId !== undefined && !id(data.contextSceneId))
      return "Invalid explicit revision context scene ID.";
    if (key === "sceneRevision") {
      if (
        !positive(data.sequence) ||
        !iso(data.createdAt) ||
        !origin(data.origin) ||
        (data.originLabel !== undefined && !text(data.originLabel, 100)) ||
        data.parentSceneId === value.id ||
        (data.sequence === 1 && data.parentSceneId !== undefined) ||
        ((data.sequence as number) > 1 && !id(data.parentSceneId))
      )
        return "Invalid scene revision sequence, parent or provenance.";
    } else if (
      !["revision", "take"].includes(data.kind as string) ||
      !id(data.parentSceneId) ||
      !id(data.expectedHeadId)
    )
      return "Invalid scene revision intent.";
  }
  if (value.authoredProjectTarget !== undefined) {
    const error = validateSceneProjectTarget(value.authoredProjectTarget);
    if (error) return error;
  }
  if (value.authoringMode !== "direct_prompt") return;
  const prompt = value.directPrompt;
  if (!object(prompt) || prompt.version !== 1)
    return "Unsupported direct prompt metadata version. Update KRAKINAI before importing.";
  if (!text(prompt.text, MAX_DIRECT_PROMPT_LENGTH))
    return "Direct prompt must be text of 100,000 characters or fewer.";
  if (saved && !prompt.text.trim())
    return "A nonempty original prompt is required.";
  if (/\p{Surrogate}/u.test(prompt.text))
    return "Original prompt contains malformed Unicode. Replace the invalid character before saving.";
  if (
    !origin(prompt.origin) ||
    (prompt.originLabel !== undefined && !text(prompt.originLabel, 100)) ||
    (prompt.importedAt !== undefined && !iso(prompt.importedAt))
  )
    return "Invalid direct prompt source provenance.";
  if (!text(value.title, 100, saved))
    return "Scene title is required and must be 100 characters or fewer.";
  if (value.shotType !== undefined && !isShotType(value.shotType))
    return "Invalid Shot Type.";
  if (!object(value.settings)) return "Invalid direct scene settings.";
  if (
    value.settings.durationSeconds !== undefined &&
    (!positive(value.settings.durationSeconds) ||
      (value.settings.durationSeconds as number) > 60)
  )
    return "Intended duration must be an integer between 1 and 60 seconds.";
  if (
    value.settings.aspectRatio !== undefined &&
    !["16:9", "9:16", "1:1"].includes(value.settings.aspectRatio as string)
  )
    return "Invalid aspect ratio.";
  if (
    value.settings.toolNotes !== undefined &&
    !text(value.settings.toolNotes, 10000)
  )
    return "Tool notes must be 10,000 characters or fewer.";
  if (
    value.manualOutputs &&
    (!object(value.manualOutputs) || Object.keys(value.manualOutputs).length)
  )
    return "Direct prompts cannot use manual output overrides.";
  if (saved) {
    if (!object(value.outputs) || value.outputs.full !== prompt.text)
      return "Saved output must equal the exact original direct prompt.";
    if (
      value.outputs.structured !== undefined ||
      value.outputs.compact !== undefined
    )
      return "Structured and Compact are unavailable for direct prompts.";
  }
}
export function validateSceneProjectTarget(
  target: unknown,
): string | undefined {
  if (
    !object(target) ||
    !id(target.collectionId) ||
    !Number.isSafeInteger(target.expectedProjectRevision) ||
    (target.expectedProjectRevision as number) < 0 ||
    Boolean(target.shotId) === Boolean(target.newShot)
  )
    return "Invalid explicit project/shot target or expected project revision.";
  if (target.shotId !== undefined && !id(target.shotId))
    return "Invalid target shot ID.";
  if (
    target.newShot !== undefined &&
    (!object(target.newShot) ||
      !text(target.newShot.title, 240, true) ||
      (target.newShot.plannedShotType !== undefined &&
        !isShotType(target.newShot.plannedShotType)))
  )
    return "Invalid new storyboard shot.";
}

export function getDirectPromptReadiness(
  source: Partial<
    Pick<
      SceneDraft,
      | "shotType"
      | "sceneInstructions"
      | "sourceMediaLinks"
      | "directPrompt"
      | "pendingInputs"
      | "directReferences"
    >
  >,
  mediaMap: ReadonlyMap<string, MediaAsset>,
): string[] {
  const issues = validateShotSourceMedia(
    {
      ...source,
      sceneInstructions: source.directPrompt?.text ?? source.sceneInstructions,
    },
    mediaMap,
  );
  for (const pending of source.pendingInputs ?? [])
    issues.push(
      `Pending ${pending.kind.replaceAll("_", " ")}: ${pending.label}.`,
    );
  for (const link of source.directReferences ?? [])
    if (!mediaMap.has(link.mediaId))
      issues.push(
        `Reference missing from storage: ${link.mediaId}. Repair or explicitly detach it.`,
      );
  return [...new Set(issues)];
}
/** Every asserted attachment must exist; absent future requirements live separately. */
export function validateDirectAttachments(
  source: SceneDraft | SavedScene,
  mediaMap: ReadonlyMap<string, MediaAsset>,
): string[] {
  const errors: string[] = [];
  const links = [
    ...(source.directReferences ?? []),
    ...(source.sourceMediaLinks ?? []),
    ...(source.referencePack?.entries ?? []),
  ];
  for (const link of links) {
    const media = mediaMap.get(link.mediaId);
    if (!media) {
      errors.push(
        `Attached media is missing: ${link.mediaId}. Restore it or detach it in References / Source Media.`,
      );
      continue;
    }
    if (
      ![
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/svg+xml",
        "video/mp4",
        "video/webm",
      ].includes(media.mimeType) ||
      !media.blob ||
      media.blob.size !== media.byteSize ||
      (media.blob.type && media.blob.type !== media.mimeType) ||
      (link.mimeType && link.mimeType !== media.mimeType)
    )
      errors.push(
        `Attached media has unsupported MIME type or inconsistent stored metadata: ${link.mediaId}. Repair it in Source Media.`,
      );
  }
  if ((source.sourceMediaLinks?.length ?? 0) > MAX_FILES_PER_RECORD)
    errors.push(
      `A maximum of ${MAX_FILES_PER_RECORD} original source files is allowed.`,
    );
  if (source.sourceMediaLinks?.length) {
    const checks = validateShotSourceMedia(
      {
        ...source,
        sceneInstructions:
          source.directPrompt?.text ?? source.sceneInstructions,
      },
      mediaMap,
    );
    errors.push(
      ...checks.filter((error) => !error.includes("Instructions are required")),
    );
  }
  return [...new Set(errors)];
}
