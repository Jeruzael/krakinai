import { describe, expect, it } from 'vitest';
import { assembleScenePrompt } from '../domain/promptAssembler';
import {
  buildSceneDocument,
  serializeSceneJson,
} from '../domain/sceneDocument';
import { buildGenerationDocument } from '../domain/generationDocument';
import { formatGenerationText } from '../domain/exportPresets';
import { formatProjectScript } from '../domain/projectContinuity';
import {
  validatePerformanceDirection,
  getEffectiveDialogueDelivery,
} from '../domain/dialoguePerformance';
import { validatePhase4Record } from '../domain/phase4Validation';
import { runScenePreflight } from '../domain/scenePreflight';
import { legacyDraft, legacyScene } from './fixtures/legacyScene';

export const studio = {
  version: 2 as const,
  emotion: { primary: 'angry', secondary: 'sad', intensity: 'strong' },
  techniques: ['lecturing'],
  voice: { tone: 'stern', pitch: 'mid' },
  speech: { pace: 'fast', intonation: 'emphatic' },
  gestures: ['strong_pointing'],
};
const expected =
  'Emotion: angry mixed with sad; strong intensity. Delivery technique: lecturing. Vocal tone: stern. Relative pitch: mid. Speaking pace: fast. Intonation: emphatic. Body language: strong, purposeful pointing gestures.';
const exact = '  “Hindi pa tapos—wait lang!”\nTara na, Mika. 😊  ';
function source(direction: unknown = studio) {
  const draft = structuredClone(legacyDraft);
  Object.assign(draft, {
    dialogue: {
      speaker: 'Mika',
      line: exact,
      deliveryNotes: '  Huwag baguhin.\nKeep this pause.  ',
      performanceDirection: direction,
    },
  });
  return draft;
}
describe('Performance Studio version 2', () => {
  it('formats structured acting once across every output and Project Script without changing exact multilingual dialogue', () => {
    const draft = source(),
      before = structuredClone(draft);
    expect(validatePhase4Record(draft)).toBeUndefined();
    expect(buildSceneDocument(draft).dialogue?.deliveryNotes).toBe(
      expected + '\n\n' + draft.dialogue!.deliveryNotes
    );
    expect(buildGenerationDocument(draft).dialogue?.deliveryNotes).toBe(
      expected + '\n\n' + draft.dialogue!.deliveryNotes
    );
    expect(JSON.parse(serializeSceneJson(draft)).dialogue.exactLine).toBe(
      exact
    );
    expect(
      JSON.parse(serializeSceneJson(draft)).dialogue.performanceDirection
    ).toEqual(studio);
    for (const output of [
      ...Object.values(assembleScenePrompt(draft).outputs),
      formatGenerationText(draft, 'generic_structured'),
      formatGenerationText(draft, 'gemini_omni_flash'),
    ]) {
      expect(output.split(expected)).toHaveLength(2);
      expect(output).toContain(exact);
    }
    const scene = { ...structuredClone(legacyScene), dialogue: draft.dialogue };
    expect(
      formatProjectScript(
        {
          id: 'p',
          name: 'Film',
          description: '',
          members: [{ id: scene.id, type: 'scene', addedAt: '' }],
          createdAt: '',
          updatedAt: '',
        },
        [scene]
      )
    ).toContain(expected);
    expect(draft).toEqual(before);
  });
  it('leaves empty optional settings silent and never infers settings from custom prose', () => {
    const draft = source({
      version: 2,
      emotion: {},
      techniques: [],
      voice: {},
      speech: {},
      gestures: [],
    });
    delete draft.dialogue!.deliveryNotes;
    expect(validatePhase4Record(draft)).toBeUndefined();
    expect(getEffectiveDialogueDelivery(draft.dialogue)).toBeUndefined();
    draft.dialogue!.deliveryNotes =
      '  Angry? Whispering? Speak exactly as authored.  ';
    expect(getEffectiveDialogueDelivery(draft.dialogue)).toBe(
      draft.dialogue!.deliveryNotes
    );
    expect(buildSceneDocument(draft).dialogue?.exactLine).toBe(exact);
  });
  it('supports every additional category with deterministic ordering and preserves free text exactly', () => {
    const draft = source({
      version: 2,
      emotion: { custom: '  bittersweet\nwith resolve  ' },
      techniques: ['emphatic', 'conversational'],
      customTechnique: '  Start soft, then shout.  ',
      voice: {
        variation: 'expressive',
        texture: 'husky',
        projection: 'projected',
        intensity: 'restrained',
      },
      speech: {
        rhythm: 'hesitant',
        articulation: 'deliberately_slurred',
        pauses: 'dramatic',
        emphasis: '  Emphasize “tayo”.  ',
      },
      gestures: ['restrained_posture', 'open_palm'],
    });
    delete draft.dialogue!.deliveryNotes;
    expect(getEffectiveDialogueDelivery(draft.dialogue)).toBe(
      'Emotional description:   bittersweet\nwith resolve  \nDelivery technique: conversational and emphatic. Delivery guidance:   Start soft, then shout.  \nPitch variation: expressive. Voice texture: husky. Projection: projected. Vocal intensity: restrained. Rhythm: hesitant. Articulation: deliberately slurred. Pauses: dramatic. Word emphasis:   Emphasize “tayo”.  \nBody language: open-palm gestures and restrained posture.'
    );
  });
  it.each([
    { version: 2, emotion: { primary: 'made_up' } },
    { version: 2, emotion: { primary: 'sad', secondary: 'sad' } },
    { version: 2, emotion: { primary: 'angry', intensity: 'maximum' } },
    { version: 2, techniques: ['whispered', 'screamed'] },
    { version: 2, techniques: ['murmured', 'shouted'] },
    { version: 2, techniques: ['lecturing', 'lecturing'] },
    { version: 2, voice: { pitch: 300 } },
    { version: 2, voice: { cloneId: 'unknown' } },
    { version: 2, speech: { pauses: 'none' } },
    { version: 2, speech: { emphasis: 'x'.repeat(1001) } },
    { version: 2, gestures: ['natural', 'natural'] },
    { version: 2, customTechnique: null },
    { version: 2, emotion: [] },
    { version: 2, styles: [] },
    { version: 3 },
  ])(
    'rejects unsupported metadata with exact Preflight evidence: %j',
    (direction) => {
      const draft = source(direction),
        error = validatePhase4Record(draft);
      expect(error).toMatch(/^Dialogue performance/);
      expect(assembleScenePrompt(draft).valid).toBe(false);
      expect(
        runScenePreflight(draft).find((f) => f.title === error)?.evidence[0]
          .text
      ).toBe(JSON.stringify(direction, null, 2));
    }
  );
  it('accepts mixed emotions and separately authored sequential technique guidance', () => {
    expect(validatePerformanceDirection(studio)).toBeUndefined();
    // Clearing either optional emotion retains the other without reassigning its ID.
    expect(
      validatePerformanceDirection({
        version: 2,
        emotion: { secondary: 'sad' },
      })
    ).toBeUndefined();
    expect(
      getEffectiveDialogueDelivery(
        source({ version: 2, emotion: { secondary: 'sad' } }).dialogue
      )
    ).toBe('Emotion: sad.\n\n  Huwag baguhin.\nKeep this pause.  ');
    expect(
      validatePerformanceDirection({
        version: 2,
        customTechnique: 'Whisper, pause, then scream.',
      })
    ).toBeUndefined();
  });
});
