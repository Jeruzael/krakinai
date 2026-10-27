import { describe, expect, it } from 'vitest';
import type { SceneDraft } from '../types/domain';
import { assembleScenePrompt } from '../domain/promptAssembler';
import {
  buildSceneDocument,
  serializeSceneJson,
} from '../domain/sceneDocument';
import { buildGenerationDocument } from '../domain/generationDocument';
import { formatGenerationText } from '../domain/exportPresets';
import {
  getProjectDialogue,
  formatProjectScript,
} from '../domain/projectContinuity';
import { validatePhase4Record } from '../domain/phase4Validation';
import { runScenePreflight } from '../domain/scenePreflight';
import { legacyDraft, legacyScene } from './fixtures/legacyScene';

const exact = '  “Hindi pa tapos—wait lang!”\nTara na, Mika. 😊  ';
const generated =
  'Angry, energetic and lecturing delivery. Fast-paced speech with strong, purposeful pointing gestures.';
function source(styles = ['lecturing', 'angry', 'energetic']) {
  const s = structuredClone(legacyDraft);
  s.dialogue = {
    speaker: 'Mika',
    line: exact,
    deliveryNotes: '  Keep the final pause.\nHuwag baguhin ang linya.  ',
    performanceDirection: {
      version: 1,
      styles,
      pace: 'fast',
      gestures: 'strong_pointing',
    },
  } as SceneDraft['dialogue'];
  return s;
}

describe('dialogue performance presets', () => {
  it('uses deterministic effective delivery exactly once across every output without changing exact Taglish text', () => {
    const s = source(),
      before = structuredClone(s),
      expected = generated + '\n\n' + s.dialogue!.deliveryNotes;
    const doc = buildSceneDocument(s),
      generation = buildGenerationDocument(s);
    expect(doc.dialogue?.deliveryNotes).toBe(expected);
    expect(generation.dialogue?.deliveryNotes).toBe(expected);
    expect(JSON.parse(serializeSceneJson(s)).dialogue.exactLine).toBe(exact);
    for (const text of [
      ...Object.values(assembleScenePrompt(s).outputs),
      formatGenerationText(s, 'generic_structured'),
      formatGenerationText(s, 'gemini_omni_flash'),
    ]) {
      expect(text.split(generated)).toHaveLength(2);
      expect(text).toContain(exact);
    }
    const scene = { ...structuredClone(legacyScene), dialogue: s.dialogue };
    const collection = {
      id: 'project',
      name: 'Synthetic film',
      description: '',
      members: [{ id: scene.id, type: 'scene' as const, addedAt: '' }],
      createdAt: '',
      updatedAt: '',
    };
    expect(getProjectDialogue(collection, [scene])[0].deliveryNotes).toBe(
      expected
    );
    expect(formatProjectScript(collection, [scene])).toContain(expected);
    expect(
      buildSceneDocument(source(['angry', 'energetic', 'lecturing'])).dialogue
        ?.deliveryNotes
    ).toBe(expected);
    expect(s).toEqual(before);
  });

  it('preserves arbitrary legacy free text without inferring presets and omits entirely empty delivery', () => {
    const s = source();
    s.dialogue = {
      speaker: 'Mika',
      line: exact,
      deliveryNotes:
        ' Angry? Not really.\nSpeak gently — exactly as authored.  ',
    };
    const doc = buildSceneDocument(s);
    expect(doc.dialogue?.deliveryNotes).toBe(s.dialogue.deliveryNotes);
    expect(doc.dialogue).not.toHaveProperty('performanceDirection');
    s.dialogue.deliveryNotes = '   ';
    expect(buildGenerationDocument(s).dialogue?.deliveryNotes).toBeNull();
    for (const output of Object.values(assembleScenePrompt(s).outputs))
      expect(output).not.toContain('Delivery Notes:');
  });

  it('supports presets alone and requires dialogue context even when only performance is selected', () => {
    const s = source();
    delete s.dialogue!.deliveryNotes;
    expect(buildSceneDocument(s).dialogue?.deliveryNotes).toBe(generated);
    s.dialogue!.speaker = '';
    s.dialogue!.line = '';
    expect(assembleScenePrompt(s).valid).toBe(false);
  });

  it.each([
    { version: 2, styles: ['calm'] },
    { version: 1, styles: ['invented'] },
    { version: 1, styles: ['calm', 'calm'] },
    { version: 1, styles: ['calm', 'angry'] },
    { version: 1, styles: ['sad', 'happy'] },
    { version: 1, styles: ['nervous', 'confident'] },
    { version: 1, styles: [], pace: 'extreme' },
    { version: 1, styles: [], gestures: 'invented' },
    { version: 1, styles: [], unexpected: true },
  ])(
    'rejects malformed or incompatible optional metadata: %j',
    (performanceDirection) => {
      const s = source();
      Object.assign(s.dialogue!, { performanceDirection });
      expect(validatePhase4Record(s)).toMatch(/Dialogue performance/);
      expect(assembleScenePrompt(s).valid).toBe(false);
      expect(
        runScenePreflight(s).find((f) => f.title === validatePhase4Record(s))
          ?.evidence[0].text
      ).toBe(JSON.stringify(performanceDirection, null, 2));
    }
  );
});
