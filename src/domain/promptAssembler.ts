import type {
  BuilderSlot,
  ComponentSnapshot,
  ManualOutputOverride,
  MediaLink,
  OutputMode,
  PromptAsset,
  SceneDraft,
  SceneSettings,
  TemplateSlotDefault,
  Variant,
} from '../types/domain';
import {
  buildSceneDocument,
  formatSceneDocumentText,
  DIALOGUE_MODE_LABELS,
  SCENE_COMPONENT_ORDER,
} from './sceneDocument';
import { CATEGORY_TO_SLOT, SLOT_LABELS } from './validation';

export const ORDERED_BUILDER_SLOTS = SCENE_COMPONENT_ORDER;

export function createSnapshotFromAsset(asset: PromptAsset): ComponentSnapshot {
  const slot = CATEGORY_TO_SLOT[asset.category];
  return {
    slot,
    sourceType: 'asset',
    sourceId: asset.id,
    sourceRevision: asset.revision,
    sourceTitle: asset.title,
    promptText: asset.promptText.trim(),
    compactText: asset.compactText?.trim() || undefined,
    avoidText: asset.avoidText?.trim() || undefined,
    mediaLinks: asset.mediaLinks.map((m) => ({ ...m })),
  };
}

export function createSnapshotFromVariant(variant: Variant): ComponentSnapshot {
  return {
    slot: variant.targetSlot,
    sourceType: 'variant',
    sourceId: variant.id,
    sourceRevision: variant.revision,
    sourceTitle: variant.title,
    parentCharacterId: variant.parentCharacterId,
    promptText: variant.promptText.trim(),
    compactText: variant.compactText?.trim() || undefined,
    avoidText: variant.avoidText?.trim() || undefined,
    mediaLinks: variant.mediaLinks.map((m) => ({ ...m })),
  };
}

export function createSnapshotFromTemplateDefault(
  templateId: string,
  templateRevision: number,
  def: TemplateSlotDefault
): ComponentSnapshot {
  return {
    slot: def.slot,
    sourceType: 'template',
    sourceId: templateId,
    sourceRevision: templateRevision,
    sourceTitle: def.title,
    promptText: def.promptText.trim(),
    compactText: def.compactText?.trim() || undefined,
    avoidText: def.avoidText?.trim() || undefined,
    mediaLinks: [],
  };
}

export interface AssembledPromptResult {
  valid: boolean;
  errors: string[];
  outputs: Record<OutputMode, string>;
  avoidText: string;
  references: MediaLink[];
}

export function assembleScenePrompt(draft: SceneDraft): AssembledPromptResult {
  const errors: string[] = [];
  const title = (draft.title ?? '').trim();
  if (!title) {
    errors.push('Scene title is required.');
  } else if (title.length > 100) {
    errors.push('Scene title must be 100 characters or fewer.');
  }

  const requiredSlots = new Set<BuilderSlot>([
    'environment',
    'action',
    ...(draft.extraRequiredSlots ?? []),
  ]);

  for (const reqSlot of requiredSlots) {
    const snap = draft.slots[reqSlot];
    const resolved =
      reqSlot === 'character'
        ? snap?.promptText?.trim()
        : (snap?.overrideText ?? snap?.promptText)?.trim();
    if (!snap || !resolved) {
      errors.push(
        `${SLOT_LABELS[reqSlot]} (${reqSlot}) is required for assembly.`
      );
    }
  }

  const hasDialogueLine = Boolean(draft.dialogue?.line?.trim());
  const hasDialogueSpeaker = Boolean(draft.dialogue?.speaker?.trim());
  const hasDialogueOptions = Boolean(
    draft.dialogue?.mode ||
      draft.dialogue?.language?.trim() ||
      draft.dialogue?.deliveryNotes?.trim() ||
      draft.dialogue?.captionPreference
  );
  if (hasDialogueLine || hasDialogueSpeaker || hasDialogueOptions) {
    if (!draft.slots.character || !draft.slots.character.promptText.trim()) {
      errors.push('Dialogue requires a selected Character in the scene.');
    }
    if (!hasDialogueSpeaker) {
      errors.push('Dialogue requires a speaker label.');
    }
    if (!hasDialogueLine) {
      errors.push('Dialogue line cannot be empty when a speaker is entered.');
    }
  }

  if (
    draft.dialogue?.mode !== undefined &&
    !Object.hasOwn(DIALOGUE_MODE_LABELS, draft.dialogue.mode)
  )
    errors.push('Select a valid dialogue mode.');
  if (
    draft.dialogue?.captionPreference !== undefined &&
    !['unspecified', 'none', 'requested'].includes(
      draft.dialogue.captionPreference
    )
  )
    errors.push('Select a valid caption preference.');
  if ((draft.dialogue?.speaker?.length ?? 0) > 100)
    errors.push('Speaker must be 100 characters or fewer.');
  if ((draft.dialogue?.language?.length ?? 0) > 100)
    errors.push('Language must be 100 characters or fewer.');
  if ((draft.dialogue?.deliveryNotes?.length ?? 0) > 1000)
    errors.push('Delivery notes must be 1,000 characters or fewer.');

  if (draft.sceneInstructions && draft.sceneInstructions.trim().length > 4000) {
    errors.push('Scene instructions must be 4,000 characters or fewer.');
  }
  if (draft.dialogue?.line && draft.dialogue.line.trim().length > 4000) {
    errors.push('Dialogue must be 4,000 characters or fewer.');
  }
  if (
    draft.settings?.durationSeconds !== undefined &&
    (draft.settings.durationSeconds < 1 ||
      draft.settings.durationSeconds > 60 ||
      !Number.isInteger(draft.settings.durationSeconds))
  ) {
    errors.push(
      'Intended duration must be an integer between 1 and 60 seconds.'
    );
  }

  // Check variant parent character match
  const currentCharId = draft.slots.character?.sourceId;
  for (const slot of ORDERED_BUILDER_SLOTS) {
    const snap = draft.slots[slot];
    if (snap && snap.sourceType === 'variant' && snap.parentCharacterId) {
      if (!currentCharId || snap.parentCharacterId !== currentCharId) {
        errors.push(
          `Variant "${snap.sourceTitle}" in ${SLOT_LABELS[slot]} has a parent character mismatch.`
        );
      }
    }
  }

  const document = buildSceneDocument(draft);
  const references: MediaLink[] = [];
  const seenMediaIds = new Set<string>();
  for (const slot of ORDERED_BUILDER_SLOTS) {
    for (const link of draft.slots[slot]?.mediaLinks ?? []) {
      if (!seenMediaIds.has(link.mediaId)) {
        references.push({ ...link });
        seenMediaIds.add(link.mediaId);
      }
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    outputs: {
      full: formatSceneDocumentText(document, 'full'),
      structured: formatSceneDocumentText(document, 'structured'),
      compact: formatSceneDocumentText(document, 'compact'),
    },
    avoidText: document.avoidText,
    references,
  };
}

export function isManualOutputStale(
  manual: ManualOutputOverride | undefined,
  currentInputRevision: number
): boolean {
  if (!manual) return false;
  return manual.basedOnInputRevision < currentInputRevision;
}

export function formatSceneExportTxt(params: {
  title: string;
  mode: OutputMode;
  promptText: string;
  settings: SceneSettings;
  avoidText: string;
  references: MediaLink[];
}): string {
  const { title, mode, promptText, settings, avoidText, references } = params;
  const settingsLines: string[] = [
    `Aspect Ratio: ${settings.aspectRatio || 'Not specified'}`,
    `Intended Duration: ${settings.durationSeconds ? `${settings.durationSeconds}s` : 'Not specified'}`,
    `Tool / Provider Notes: ${settings.toolNotes?.trim() || 'None'}`,
    `(Note: Settings are user instructions, not verified provider capabilities.)`,
  ];

  const refLines =
    references.length > 0
      ? references.map(
          (r, idx) =>
            `${idx + 1}. ${r.filename || r.mediaId} (${r.role}) — ${r.altText || 'Reference file'}`
        )
      : ['No reference files attached.'];

  return [
    `KRAKINAI — AI VIDEO PROMPT LIBRARY EXPORT`,
    `Scene: ${title}`,
    ``,
    `=== PROMPT (${mode.toUpperCase()}) ===`,
    promptText,
    ``,
    `=== SETTINGS (USER INSTRUCTIONS) ===`,
    settingsLines.join('\n'),
    ``,
    `=== AVOID / NEGATIVE TEXT ===`,
    avoidText.trim() || 'None specified.',
    ``,
    `=== REFERENCE CHECKLIST (ATTACH SEPARATELY) ===`,
    `Copying or downloading this text does not upload reference files to an external tool.`,
    ...refLines,
    ``,
  ].join('\n');
}
