import { describe, expect, it } from 'vitest';
import {
  buildSceneDocument,
  serializeSceneJson,
} from '../domain/sceneDocument';
import { assembleScenePrompt } from '../domain/promptAssembler';
import { legacyDraft, legacyScene } from './fixtures/legacyScene';

describe('Snapshot-derived scene document', () => {
  it('preserves all ordered components, complete long identity, source revisions and scene overrides without mutation', () => {
    const source = structuredClone(legacyDraft);
    source.slots.character!.overrideText = 'Must never replace the identity';
    source.slots.character!.compactText = 'Must never shorten the identity';
    const before = structuredClone(source);
    const doc = buildSceneDocument(source);
    expect(Object.keys(doc)).toEqual([
      'schema',
      'scene',
      'components',
      'dialogue',
      'avoidText',
      'settings',
      'referenceFiles',
    ]);
    expect(Object.keys(doc.components)).toEqual([
      'character',
      'wardrobe',
      'environment',
      'action',
      'camera',
      'lighting',
      'style',
    ]);
    expect(doc.components.character!.prompt).toBe(
      source.slots.character!.promptText
    );
    expect(doc.components.character!.compactPrompt).toBe(
      source.slots.character!.promptText
    );
    expect(doc.components.character!.source.revision).toBe(
      source.slots.character!.sourceRevision
    );
    expect(doc.components.camera!.prompt).toBe(
      source.slots.camera!.overrideText
    );
    expect(doc.components.camera!.compactPrompt).toBe(
      source.slots.camera!.overrideText
    );
    expect(doc.components.camera!.snapshot.promptText).toBe(
      source.slots.camera!.promptText
    );
    expect(source).toEqual(before);
    expect(serializeSceneJson(source)).toBe(serializeSceneJson(source));
  });

  it('uses manually authored compact overrides and retains exact whitespace in identity, dialogue and instructions', () => {
    const source = structuredClone(legacyDraft);
    source.slots.character!.promptText = '  Identity\n\n**HAIR**\nExact.  ';
    source.slots.camera!.overrideCompactText = 'User camera summary';
    source.sceneInstructions = '\n  User instructions.\n';
    source.dialogue = {
      speaker: ' Mika ',
      line: "  “Kumusta?”\nLet's go! 😊  ",
      mode: 'on_camera',
      language: 'Taglish',
      deliveryNotes: 'Natural — user entered',
      captionPreference: 'requested',
    };
    const doc = JSON.parse(serializeSceneJson(source));
    expect(doc.components.character!.prompt).toBe(
      source.slots.character!.promptText
    );
    expect(doc.components.camera!.compactPrompt).toBe('User camera summary');
    expect(doc.scene.instructions).toBe(source.sceneInstructions);
    expect(doc.dialogue).toEqual({
      type: 'spoken_audio',
      mode: 'on_camera',
      speaker: ' Mika ',
      language: 'Taglish',
      deliveryNotes: 'Natural — user entered',
      exactLine: source.dialogue.line,
      captionPreference: 'requested',
    });
    expect(doc.settings.durationSeconds).toBe(8);
    expect(typeof doc.settings.durationSeconds).toBe('number');
  });

  it('represents missing optional values consistently without inferring lens, language, mood, or dialogue', () => {
    const doc = buildSceneDocument({
      title: 'Empty specification',
      slots: {},
      sceneInstructions: '',
      settings: {},
    });
    expect(Object.values(doc.components)).toEqual(Array(7).fill(null));
    expect(doc.dialogue).toBeNull();
    expect(doc.settings).toEqual({
      aspectRatio: null,
      durationSeconds: null,
      toolNotes: null,
    });
    expect(doc.referenceFiles).toEqual([]);
    expect(doc.avoidText).toBe('');
    expect(
      serializeSceneJson({
        title: 'Empty',
        slots: {},
        sceneInstructions: '',
        settings: {},
      })
    ).not.toMatch(/lens|mood|English|on_camera/);
  });

  it('uses the authoritative saved checklist, preserves association duplicates, and does not rebuild an empty saved list', () => {
    const ref = {
      mediaId: 'media_id',
      filename: 'C:\\private\\portrait.png',
      role: 'reference' as const,
      altText: 'Portrait',
      order: 0,
      mimeType: 'image/png',
    };
    const source = {
      ...legacyScene,
      references: [ref, { ...ref, role: 'sample' as const, order: 1 }],
      avoidText: 'Saved combined negative text',
    };
    const doc = buildSceneDocument(source);
    expect(doc.referenceFiles).toHaveLength(2);
    expect(doc.referenceFiles[0].filename).toBe('portrait.png');
    expect(doc.referenceFiles.map((r: any) => r.role)).toEqual([
      'reference',
      'sample',
    ]);
    expect(doc.avoidText).toBe(source.avoidText);
    expect(
      buildSceneDocument({ ...source, references: [] }).referenceFiles
    ).toEqual([]);
    const text = serializeSceneJson({
      ...source,
      references: [
        {
          ...ref,
          filename: 'blob:temporary-preview',
          blob: new Blob(['private bytes']),
          path: 'C:/private/media.png',
        } as any,
      ],
    });
    expect(text).not.toContain('blob:temporary-preview');
    expect(text).not.toContain('private bytes');
    expect(text).not.toContain('C:/private');
    expect(text).not.toContain('C:\\\\private');
  });
});

describe('New production prompt assembly', () => {
  it('clearly separates preserved visual layers and exact spoken dialogue in every mode', () => {
    const draft = structuredClone(legacyDraft);
    draft.dialogue = {
      ...draft.dialogue!,
      mode: 'on_camera',
      language: 'Taglish',
      deliveryNotes: 'Natural and conversational',
      captionPreference: 'none',
    };
    const result = assembleScenePrompt(draft);
    expect(result.valid).toBe(true);
    expect(result.outputs.structured).toContain(
      '=== SCENE OVERVIEW ===\nScene Title: Mika introduction — café\nScene Type: Single-shot video\nAspect Ratio: 9:16\nIntended Duration: 8s'
    );
    const labels = [
      'CHARACTER IDENTITY',
      'WARDROBE & ACCESSORIES',
      'ENVIRONMENT / LOCATION',
      'ACTION & PERFORMANCE',
      'CAMERA & CINEMATOGRAPHY',
      'LIGHTING & ATMOSPHERE',
      'VISUAL STYLE',
      'SPOKEN DIALOGUE SCRIPT',
      'ADDITIONAL SCENE INSTRUCTIONS',
    ];
    let position = -1;
    for (const label of labels) {
      const next = result.outputs.structured.indexOf(`=== ${label} ===`);
      expect(next).toBeGreaterThan(position);
      position = next;
    }
    for (const output of Object.values(result.outputs)) {
      expect(output).toContain(draft.slots.character!.promptText);
      expect(output).toContain(`"${draft.dialogue.line}"`);
      expect(output).toContain('EXACT SPOKEN LINE:');
      expect(output).toContain('No on-screen captions.');
      expect(output).not.toContain('=== AVOID');
    }
    expect(result.outputs.compact).toContain(
      draft.slots.wardrobe!.compactText!
    );
    expect(result.outputs.compact).toContain(draft.slots.camera!.overrideText!);
    expect(result.avoidText).toContain('No identity drift.');
  });

  it('voiceover never instructs visible speech or invents captions, language or delivery', () => {
    const result = assembleScenePrompt({
      ...legacyDraft,
      dialogue: {
        speaker: 'Mika',
        line: 'Exact voiceover.',
        mode: 'voiceover',
      },
    });
    for (const output of Object.values(result.outputs)) {
      expect(output).toContain('Dialogue Mode: Voiceover');
      expect(output).toContain('voiceover');
      expect(output).not.toMatch(
        /speaks to camera|lip.sync|Language:|Delivery Notes:|Captions requested|No on-screen captions/
      );
    }
  });

  it('omits the entire dialogue section when absent and preserves partial-dialogue validation', () => {
    const noDialogue = assembleScenePrompt({
      ...legacyDraft,
      dialogue: undefined,
    });
    expect(noDialogue.outputs.structured).not.toContain('SPOKEN DIALOGUE');
    expect(
      assembleScenePrompt({
        ...legacyDraft,
        dialogue: { speaker: 'Mika', line: '' },
      }).valid
    ).toBe(false);
    expect(
      assembleScenePrompt({
        ...legacyDraft,
        dialogue: { speaker: '', line: 'Hi.' },
      }).valid
    ).toBe(false);
    expect(
      assembleScenePrompt({
        ...legacyDraft,
        dialogue: { speaker: 'Mika', line: 'Hi', mode: 'invalid' as any },
      }).valid
    ).toBe(false);
  });
});
