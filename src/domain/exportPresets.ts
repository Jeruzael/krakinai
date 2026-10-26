import {
  buildGenerationDocument,
  type GenerationExportOptions,
} from "./generationDocument";
import {
  DIALOGUE_MODE_LABELS,
  type SceneDocumentSource,
} from "./sceneDocument";

export type ExportPresetId =
  "generic_structured" | "gemini_omni_flash" | "custom";
const sources = [
  "https://ai.google.dev/gemini-api/docs/omni",
  "https://ai.google.dev/gemini-api/docs/video",
  "https://deepmind.google/models/gemini-omni/prompt-guide/",
  "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/best-practice",
];
export const EXPORT_PRESETS: {
  id: ExportPresetId;
  label: string;
  verifiedAt: string | null;
  sources: string[];
  model: string | null;
  limits: { attachmentCount: number | null; durationSeconds: number | null };
  guidance: string[];
}[] = [
  {
    id: "generic_structured",
    label: "Generic Structured",
    verifiedAt: null,
    sources: [],
    model: null,
    limits: { attachmentCount: null, durationSeconds: null },
    guidance: ["Model-agnostic sections preserving selected scene text."],
  },
  {
    id: "gemini_omni_flash",
    label: "Gemini Omni Flash",
    verifiedAt: "2026-10-26",
    sources,
    model: "gemini-omni-1.1-flash",
    limits: { attachmentCount: null, durationSeconds: null },
    guidance: [
      "Describe visual framing, motion, style, light, location and action.",
      "Use speaker/action followed by a colon without decorative quotation wrappers.",
      "Negative constraints are ordinary text; no native negativePrompt parameter is documented.",
      "The documented video-reference API workflow permits up to three clips of up to three seconds each; this is not a general attachment limit.",
      "Veo 3.1 Preview retired on 2026-10-22.",
    ],
  },
  {
    id: "custom",
    label: "Custom starting template",
    verifiedAt: null,
    sources: [],
    model: null,
    limits: { attachmentCount: null, durationSeconds: null },
    guidance: [
      "Generic starting template; reusable custom presets are not persisted.",
    ],
  },
];
export function getProviderNotices(
  _source: SceneDocumentSource,
  presetId: ExportPresetId,
  _options?: GenerationExportOptions,
): string[] {
  const notices = [
    "Generation exports are KRAKINAI-defined views, not an official provider request contract. External generation quality is untested.",
  ];
  if (presetId === "gemini_omni_flash")
    notices.push(
      "Official guidance verified 2026-10-26 for gemini-omni-1.1-flash. General attachment and output-duration limits are unknown here; check the current workflow documentation.",
      "Reference files must be attached separately. Video-reference API guidance is scoped to up to three clips of up to three seconds each; it is not a general attachment-count limit.",
      "Negative instructions are text constraints. No native negativePrompt parameter is documented.",
    );
  if (presetId === "custom")
    notices.push(
      "Custom is a generic starting template; saved formatting preferences are not available.",
    );
  return notices;
}
export function formatGenerationText(
  source: SceneDocumentSource,
  presetId: ExportPresetId,
  options?: GenerationExportOptions,
): string {
  const doc = buildGenerationDocument(source, options);
  const blocks: string[] = [];
  const section = (title: string, content: string | null) => {
    if (content !== null && content !== "")
      blocks.push(`=== ${title} ===\n${content}`);
  };
  const overview = [
    `Scene Title: ${doc.scene.title}`,
    "Scene Type: Single-shot video",
  ];
  if (doc.scene.aspectRatio !== null)
    overview.push(`Aspect Ratio: ${doc.scene.aspectRatio}`);
  if (doc.scene.durationSeconds !== null)
    overview.push(`Intended Duration: ${doc.scene.durationSeconds}s`);
  section("SCENE OVERVIEW", overview.join("\n"));
  section("CHARACTER IDENTITY", doc.character?.description ?? null);
  for (const [title, content] of [
    ["WARDROBE & ACCESSORIES", doc.wardrobe],
    ["ENVIRONMENT / LOCATION", doc.environment],
    ["ACTION & PERFORMANCE", doc.action],
    ["CAMERA & CINEMATOGRAPHY", doc.camera],
    ["LIGHTING & ATMOSPHERE", doc.lighting],
    ["VISUAL STYLE", doc.style],
  ])
    section(title!, content ?? null);
  const dialogue = doc.dialogue;
  if (dialogue) {
    const lines = [
      `Speaker: ${dialogue.speaker}`,
      `Dialogue Mode: ${DIALOGUE_MODE_LABELS[dialogue.mode]}`,
    ];
    if (dialogue.language !== null)
      lines.push(`Language: ${dialogue.language}`);
    if (dialogue.deliveryNotes !== null)
      lines.push(`Delivery Notes: ${dialogue.deliveryNotes}`);
    if (dialogue.captionPreference === "none")
      lines.push("Captions: No on-screen captions.");
    if (dialogue.captionPreference === "requested")
      lines.push("Captions: Captions requested.");
    if (presetId === "gemini_omni_flash") {
      const action =
        dialogue.mode === "voiceover"
          ? "delivers voiceover"
          : dialogue.mode === "off_screen"
            ? "speaks off screen"
            : dialogue.mode === "on_camera"
              ? "speaks on camera"
              : "speaks";
      lines.push(`${dialogue.speaker} ${action}: ${dialogue.exactLine}`);
    } else lines.push(`Exact Spoken Line: ${dialogue.exactLine}`);
    section("SPOKEN DIALOGUE SCRIPT", lines.join("\n"));
  }
  section("ADDITIONAL SCENE INSTRUCTIONS", doc.scene.instructions);
  section("TOOL / PROVIDER NOTES", doc.scene.toolNotes);
  section(
    "NEGATIVE INSTRUCTIONS",
    doc.negativeInstructions.length
      ? doc.negativeInstructions.join("\n")
      : null,
  );
  section(
    "REFERENCE CHECKLIST — ATTACH FILES SEPARATELY",
    doc.references.length
      ? doc.references
          .map(
            (ref) =>
              `${ref.order + 1}. ${ref.filename ?? ref.mediaId} | ${ref.role}${ref.sourceSlot ? ` | ${ref.sourceSlot}` : ""}${ref.purpose ? ` | ${ref.purpose}` : ""}${ref.altText ? ` | ${ref.altText}` : ""}`,
          )
          .join("\n")
      : null,
  );
  return blocks.join("\n\n");
}
