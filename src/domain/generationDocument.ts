import type { BuilderSlot, MediaRole } from "../types/domain";
import {
  buildSceneDocument,
  SCENE_COMPONENT_ORDER,
  type SceneDocumentSource,
} from "./sceneDocument";

export interface GenerationReference {
  associationId?: string;
  mediaId: string;
  sourceSlot?: BuilderSlot | "result" | "legacy";
  purpose?: "identity" | "outfit" | "environment" | "motion" | "general";
  order: number;
  filename: string | null;
  mimeType: string | null;
  role: MediaRole;
  altText: string | null;
}
export interface GenerationExportOptions {
  identity?: { source: "master" | "approved_anchor"; description: string };
  references?: GenerationReference[];
}
const hasText = (value: string | undefined | null): value is string =>
  Boolean(value?.trim());
const normalize = (value: string) =>
  value.normalize("NFC").trim().replace(/\s+/gu, " ").toLowerCase();
const safeMetadata = (value: string | undefined | null): string | null =>
  value && !/^(?:blob:|data:|file:|https?:|[a-z]:[\\/]|[\\/])/i.test(value)
    ? value
    : null;
const safeFilename = (value: string | undefined | null): string | null =>
  value && !/^(?:blob:|data:|file:|https?:)/i.test(value)
    ? value.split(/[\\/]/).pop() || null
    : null;

function negativeInstructions(source: SceneDocumentSource): string[] {
  const parts = SCENE_COMPONENT_ORDER.map(
    (slot) => source.slots[slot]?.avoidText,
  ).filter(hasText);
  let extra = source.avoidText;
  // Saved scenes hold the assembler's component-joined prefix plus scene negatives.
  // Only remove this exact prefix; never tokenize authored punctuation.
  if (source.references !== undefined && parts.length && extra) {
    const prefix = parts.join(", ");
    if (extra === prefix) extra = undefined;
    else if (extra.startsWith(`${prefix}, `))
      extra = extra.slice(prefix.length + 2);
  }
  if (hasText(extra)) parts.push(extra);
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = normalize(part);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildGenerationDocument(
  source: SceneDocumentSource,
  options: GenerationExportOptions = {},
) {
  const project = buildSceneDocument(source);
  const effective = (slot: BuilderSlot) =>
    project.components[slot]?.prompt ?? null;
  const character = project.components.character;
  const references: GenerationReference[] =
    options.references ??
    project.referenceFiles.map((reference) => ({
      mediaId: reference.mediaId ?? "",
      role: reference.role,
      altText: reference.altText,
      order: reference.order,
      filename: reference.filename,
      mimeType: reference.mimeType,
    }));
  return {
    schema: "krakinai.generation-prompt.v1" as const,
    scene: {
      title: source.title,
      type: "single_shot" as const,
      durationSeconds: project.settings.durationSeconds,
      aspectRatio: project.settings.aspectRatio,
      instructions: project.scene.instructions,
      toolNotes: project.settings.toolNotes,
    },
    character: character
      ? {
          name: character.title,
          identitySource: options.identity?.source ?? "master",
          description: options.identity?.description ?? character.prompt,
        }
      : null,
    wardrobe: effective("wardrobe"),
    environment: effective("environment"),
    action: effective("action"),
    camera: effective("camera"),
    lighting: effective("lighting"),
    style: effective("style"),
    dialogue: project.dialogue
      ? {
          mode: project.dialogue.mode,
          speaker: project.dialogue.speaker,
          language: project.dialogue.language,
          deliveryNotes: project.dialogue.deliveryNotes,
          exactLine: project.dialogue.exactLine,
          captionPreference: project.dialogue.captionPreference,
        }
      : null,
    negativeInstructions: negativeInstructions(source),
    references: references.map((reference) => ({
      ...(reference.associationId !== undefined
        ? { associationId: safeMetadata(reference.associationId) ?? "" }
        : {}),
      mediaId: safeMetadata(reference.mediaId) ?? "",
      ...(reference.sourceSlot !== undefined
        ? { sourceSlot: reference.sourceSlot }
        : {}),
      ...(reference.purpose !== undefined
        ? { purpose: reference.purpose }
        : {}),
      order: reference.order,
      filename: safeFilename(reference.filename),
      mimeType: safeMetadata(reference.mimeType),
      role: reference.role,
      altText: safeMetadata(reference.altText),
    })),
  };
}
export function serializeGenerationJson(
  source: SceneDocumentSource,
  options?: GenerationExportOptions,
): string {
  return JSON.stringify(buildGenerationDocument(source, options), null, 2);
}
