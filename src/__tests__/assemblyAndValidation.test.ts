import { describe, expect, it } from 'vitest';
import {
  CATEGORY_TO_SLOT,
  VARIANT_TYPE_TO_SLOT,
  validatePromptAssetInput,
  validateVariantInput,
  validateMediaCandidate,
  validateCollectionInput,
} from '../domain/validation';
import {
  assembleScenePrompt,
  formatSceneExportTxt,
  isManualOutputStale,
  createSnapshotFromAsset,
  createSnapshotFromVariant,
} from '../domain/promptAssembler';
import type { PromptAsset, SceneDraft, Variant } from '../types/domain';

describe('Category and Variant Slot Mapping', () => {
  it('maps all seven categories to their exact builder slots', () => {
    expect(CATEGORY_TO_SLOT.characters).toBe('character');
    expect(CATEGORY_TO_SLOT.wardrobe).toBe('wardrobe');
    expect(CATEGORY_TO_SLOT.environments).toBe('environment');
    expect(CATEGORY_TO_SLOT.actions).toBe('action');
    expect(CATEGORY_TO_SLOT.camera).toBe('camera');
    expect(CATEGORY_TO_SLOT.lighting).toBe('lighting');
    expect(CATEGORY_TO_SLOT.styles).toBe('style');
  });

  it('maps all six variant types to their exact target builder slots', () => {
    expect(VARIANT_TYPE_TO_SLOT['Outfit']).toBe('wardrobe');
    expect(VARIANT_TYPE_TO_SLOT['Expression']).toBe('action');
    expect(VARIANT_TYPE_TO_SLOT['Pose']).toBe('action');
    expect(VARIANT_TYPE_TO_SLOT['Camera Angle']).toBe('camera');
    expect(VARIANT_TYPE_TO_SLOT['Location']).toBe('environment');
    expect(VARIANT_TYPE_TO_SLOT['Visual Style']).toBe('style');
  });
});

describe('Input & Media Validation Rules', () => {
  it('enforces required fields and character bounds on prompt assets', () => {
    const empty = validatePromptAssetInput({
      title: '   ',
      category: 'characters',
      promptText: '',
      tags: [],
    });
    expect(empty.valid).toBe(false);
    expect(empty.errors.title).toBeDefined();
    expect(empty.errors.promptText).toBeDefined();

    const tooManyTags = validatePromptAssetInput({
      title: 'Maya Santos',
      category: 'characters',
      promptText: 'Adult Filipina woman, 28, oval face.',
      tags: Array.from({ length: 13 }, (_, i) => `tag-${i}`),
    });
    expect(tooManyTags.valid).toBe(false);
    expect(tooManyTags.errors.tags).toMatch(/12/);
  });

  it('validates media file types, per-file byte limits, and max 6 files per record', () => {
    expect(
      validateMediaCandidate({
        name: 'photo.png',
        type: 'image/png',
        size: 5 * 1024 * 1024,
        existingCount: 0,
      }).valid
    ).toBe(true);

    const oversizedImg = validateMediaCandidate({
      name: 'huge.png',
      type: 'image/png',
      size: 11 * 1024 * 1024,
      existingCount: 0,
    });
    expect(oversizedImg.valid).toBe(false);
    expect(oversizedImg.error).toMatch(/10 MiB/i);

    const oversizedVid = validateMediaCandidate({
      name: 'clip.mp4',
      type: 'video/mp4',
      size: 51 * 1024 * 1024,
      existingCount: 0,
    });
    expect(oversizedVid.valid).toBe(false);
    expect(oversizedVid.error).toMatch(/50 MiB/i);

    const svgUpload = validateMediaCandidate({
      name: 'vector.svg',
      type: 'image/svg+xml',
      size: 1024,
      existingCount: 0,
    });
    expect(svgUpload.valid).toBe(false);

    const seventhFile = validateMediaCandidate({
      name: 'extra.jpg',
      type: 'image/jpeg',
      size: 1024,
      existingCount: 6,
    });
    expect(seventhFile.valid).toBe(false);
    expect(seventhFile.error).toMatch(/six|6/i);
  });

  it('validates variant parent and collection name bounds', () => {
    const badVariant = validateVariantInput({
      parentCharacterId: '',
      type: 'Outfit',
      title: 'Office',
      promptText: 'Navy blazer',
      tags: [],
    });
    expect(badVariant.valid).toBe(false);
    expect(badVariant.errors.parentCharacterId).toBeDefined();

    const badCol = validateCollectionInput({ name: '   ', description: 'ok' });
    expect(badCol.valid).toBe(false);
  });
});

describe('Deterministic Prompt Assembly & Output Modes', () => {
  const mayaAsset: PromptAsset = {
    id: 'asset_maya',
    title: 'Maya Santos / Base Identity',
    category: 'characters',
    description: 'Lead character',
    promptText:
      'Maya is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, dark brown eyes, shoulder-length wavy black hair, and an average build. Keep these identity traits unchanged.',
    compactText: 'SHOULD BE IGNORED FOR CHARACTERS',
    avoidText: 'extra limbs, distorted face',
    tags: ['Adult', 'Realistic'],
    mediaLinks: [{ mediaId: 'media_maya_front', role: 'reference', altText: 'Maya front portrait', order: 0, filename: 'maya-front.png' }],
    coverMediaId: 'media_maya_front',
    favorite: true,
    reviewStatus: 'user-approved',
    provenance: { toolName: 'External Tool' },
    notes: '',
    revision: 1,
    createdAt: '2026-10-25T00:00:00.000Z',
    updatedAt: '2026-10-25T00:00:00.000Z',
  };

  const officeVariant: Variant = {
    id: 'variant_office',
    parentCharacterId: 'asset_maya',
    type: 'Outfit',
    targetSlot: 'wardrobe',
    title: 'Office Outfit',
    promptText: 'She wears a navy blazer over a plain white shirt, charcoal trousers, and small silver stud earrings.',
    compactText: 'Navy blazer over white shirt, charcoal trousers, silver stud earrings.',
    avoidText: 'casual hoodie',
    tags: ['Formal'],
    mediaLinks: [{ mediaId: 'media_office', role: 'reference', altText: 'Office blazer reference', order: 0, filename: 'office-look.png' }],
    coverMediaId: 'media_office',
    favorite: false,
    reviewStatus: 'unreviewed',
    revision: 1,
    createdAt: '2026-10-25T00:00:00.000Z',
    updatedAt: '2026-10-25T00:00:00.000Z',
  };

  const cafeAsset: PromptAsset = {
    id: 'asset_cafe',
    title: 'Neighborhood Cafe / Day',
    category: 'environments',
    description: 'Quiet cafe',
    promptText: 'A quiet neighborhood cafe with pale wooden tables and a window on the left; daytime.',
    compactText: 'Quiet daytime cafe with wooden tables and left window.',
    avoidText: 'neon lights',
    tags: ['Indoor', 'Day'],
    mediaLinks: [{ mediaId: 'media_cafe', role: 'reference', altText: 'Cafe table reference', order: 0, filename: 'cafe-reference.png' }],
    coverMediaId: 'media_cafe',
    favorite: false,
    reviewStatus: 'unreviewed',
    provenance: {},
    notes: '',
    revision: 1,
    createdAt: '2026-10-25T00:00:00.000Z',
    updatedAt: '2026-10-25T00:00:00.000Z',
  };

  const sittingAsset: PromptAsset = {
    id: 'asset_sitting',
    title: 'Sitting and Listening',
    category: 'actions',
    description: 'Seated cafe action',
    promptText: 'She sits at the table, closes her notebook, and looks toward someone off-camera with a restrained smile.',
    compactText: 'Sits at table, closes notebook, looks off-camera with restrained smile.',
    tags: ['Seated'],
    mediaLinks: [],
    favorite: false,
    reviewStatus: 'unreviewed',
    provenance: {},
    notes: '',
    revision: 1,
    createdAt: '2026-10-25T00:00:00.000Z',
    updatedAt: '2026-10-25T00:00:00.000Z',
  };

  const baseDraft: SceneDraft = {
    id: 'draft_cafe',
    title: 'Cafe opening',
    slots: {
      character: createSnapshotFromAsset(mayaAsset),
      wardrobe: createSnapshotFromVariant(officeVariant),
      environment: createSnapshotFromAsset(cafeAsset),
      action: createSnapshotFromAsset(sittingAsset),
    },
    extraRequiredSlots: [],
    sceneInstructions: 'One continuous shot. Preserve the selected outfit and background arrangement.',
    dialogue: {
      speaker: 'Maya',
      line: 'Akala ko hindi ka na darating.',
    },
    settings: {
      aspectRatio: '16:9',
      durationSeconds: 8,
      toolNotes: 'External generator guidance only',
    },
    inputRevision: 1,
    manualOutputs: {},
    resultMediaLinks: [],
    reviewNotes: '',
    reviewStatus: 'unreviewed',
    updatedAt: '2026-10-25T00:00:00.000Z',
  };

  it('assembles Full, Structured, and Compact prompts in exact deterministic order and omits unfilled optional slots', () => {
    const res = assembleScenePrompt(baseDraft);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);

    expect(res.outputs.full).toBe(
      [
        mayaAsset.promptText,
        officeVariant.promptText,
        cafeAsset.promptText,
        sittingAsset.promptText,
        'One continuous shot. Preserve the selected outfit and background arrangement.',
        'Dialogue (Maya): Akala ko hindi ka na darating.',
      ].join('\n\n')
    );

    // Compact preserves character identity and dialogue verbatim, uses compactText for non-character slots
    expect(res.outputs.compact).toBe(
      [
        mayaAsset.promptText,
        officeVariant.compactText!,
        cafeAsset.compactText!,
        sittingAsset.compactText!,
        'One continuous shot. Preserve the selected outfit and background arrangement.',
        'Dialogue (Maya): Akala ko hindi ka na darating.',
      ].join('\n\n')
    );

    // Structured adds labels to the same blocks
    expect(res.outputs.structured).toContain('Character Identity:\n' + mayaAsset.promptText);
    expect(res.outputs.structured).toContain('Clothing & Accessories:\n' + officeVariant.promptText);
    expect(res.outputs.structured).toContain('Environment:\n' + cafeAsset.promptText);
    expect(res.outputs.structured).toContain('Action & Emotion:\n' + sittingAsset.promptText);
    expect(res.outputs.structured).not.toContain('Camera & Movement:');
    expect(res.outputs.structured).toContain('Dialogue:\nDialogue (Maya): Akala ko hindi ka na darating.');

    // Avoid text is kept separate
    expect(res.avoidText).toContain('extra limbs, distorted face');
    expect(res.avoidText).toContain('casual hoodie');
    expect(res.avoidText).toContain('neon lights');

    // Reference checklist collects references in order
    expect(res.references.map((r) => r.mediaId)).toEqual([
      'media_maya_front',
      'media_office',
      'media_cafe',
    ]);
  });

  it('invalidates copied compact text when a scene-only override is applied without a compact override', () => {
    const overriddenDraft: SceneDraft = {
      ...baseDraft,
      slots: {
        ...baseDraft.slots,
        environment: {
          ...baseDraft.slots.environment!,
          overrideText: 'A rainy rooftop terrace under a canvas awning at dusk.',
        },
      },
    };
    const res = assembleScenePrompt(overriddenDraft);
    expect(res.valid).toBe(true);
    expect(res.outputs.compact).toContain('A rainy rooftop terrace under a canvas awning at dusk.');
    expect(res.outputs.compact).not.toContain(cafeAsset.compactText!);
  });

  it('enforces required slots (title, environment, action, template extraRequiredSlots, dialogue requires character)', () => {
    const missingReq = assembleScenePrompt({
      ...baseDraft,
      title: '',
      slots: { character: baseDraft.slots.character },
      extraRequiredSlots: ['camera'],
    });
    expect(missingReq.valid).toBe(false);
    expect(missingReq.errors.join(' ')).toMatch(/title/i);
    expect(missingReq.errors.join(' ')).toMatch(/environment/i);
    expect(missingReq.errors.join(' ')).toMatch(/action/i);
    expect(missingReq.errors.join(' ')).toMatch(/camera/i);

    const dialogueWithoutChar = assembleScenePrompt({
      ...baseDraft,
      slots: {
        environment: baseDraft.slots.environment,
        action: baseDraft.slots.action,
      },
      dialogue: { speaker: 'Maya', line: 'Hello there.' },
    });
    expect(dialogueWithoutChar.valid).toBe(false);
    expect(dialogueWithoutChar.errors.join(' ')).toMatch(/character/i);
  });

  it('rejects unresolved variant parent mismatch during assembly', () => {
    const mismatchDraft: SceneDraft = {
      ...baseDraft,
      slots: {
        ...baseDraft.slots,
        wardrobe: {
          ...baseDraft.slots.wardrobe!,
          parentCharacterId: 'asset_nico',
        },
      },
    };
    const res = assembleScenePrompt(mismatchDraft);
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/mismatch|parent/i);
  });

  it('detects stale manual output edits when draft inputRevision advances', () => {
    const manual = {
      text: 'Custom edited full output',
      basedOnInputRevision: 2,
      updatedAt: '2026-10-25T00:00:00.000Z',
    };
    expect(isManualOutputStale(manual, 2)).toBe(false);
    expect(isManualOutputStale(manual, 3)).toBe(true);
  });

  it('formats Download .txt with distinct Prompt, Settings, Avoid Text, and Reference Checklist sections', () => {
    const assembled = assembleScenePrompt(baseDraft);
    const txt = formatSceneExportTxt({
      title: baseDraft.title,
      mode: 'full',
      promptText: assembled.outputs.full,
      settings: baseDraft.settings,
      avoidText: assembled.avoidText,
      references: assembled.references,
    });
    expect(txt).toContain('=== PROMPT (FULL) ===');
    expect(txt).toContain('=== SETTINGS (USER INSTRUCTIONS) ===');
    expect(txt).toContain('Aspect Ratio: 16:9');
    expect(txt).toContain('Intended Duration: 8s');
    expect(txt).toContain('=== AVOID / NEGATIVE TEXT ===');
    expect(txt).toContain('=== REFERENCE CHECKLIST (ATTACH SEPARATELY) ===');
    expect(txt).toContain('maya-front.png');
  });
});
