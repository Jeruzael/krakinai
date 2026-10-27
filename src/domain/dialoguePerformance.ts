import type {
  DialogueConfig,
  DialogueDeliveryStyle,
  DialoguePerformanceDirection,
  DialoguePerformanceDirectionV2,
  DialogueSpeakingPace,
  DialogueBodyLanguage,
} from '../types/domain';
import {
  EMOTIONS,
  EMOTIONAL_INTENSITIES,
  TECHNIQUES,
  VOICE_FIELDS,
  SPEECH_FIELDS,
  GESTURES,
  conflictingTechnique,
  type TechniqueId,
} from './performanceCatalog';

export const DELIVERY_STYLES: { id: DialogueDeliveryStyle; label: string }[] = [
  { id: 'calm', label: 'Calm' },
  { id: 'angry', label: 'Angry' },
  { id: 'sad', label: 'Sad' },
  { id: 'happy', label: 'Happy' },
  { id: 'nervous', label: 'Nervous' },
  { id: 'confident', label: 'Confident' },
  { id: 'apologetic', label: 'Apologetic' },
  { id: 'sarcastic', label: 'Sarcastic' },
  { id: 'energetic', label: 'Energetic' },
  { id: 'playful', label: 'Playful' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'lecturing', label: 'Lecturing' },
  { id: 'whispering', label: 'Whispering' },
];
export const SPEAKING_PACES: Record<DialogueSpeakingPace, string> = {
  slow: 'Slow',
  natural: 'Natural',
  fast: 'Fast',
};
export const BODY_LANGUAGE: Record<DialogueBodyLanguage, string> = {
  subtle: 'Subtle gestures',
  natural: 'Natural gestures',
  expressive: 'Expressive gestures',
  strong_pointing: 'Strong pointing gestures',
};
const opposites: [DialogueDeliveryStyle, DialogueDeliveryStyle][] = [
  ['calm', 'angry'],
  ['sad', 'happy'],
  ['nervous', 'confident'],
];
export function conflictingDeliveryStyle(
  id: DialogueDeliveryStyle,
  selected: readonly DialogueDeliveryStyle[]
): DialogueDeliveryStyle | undefined {
  const pair = opposites.find((pair) => pair.includes(id));
  return pair?.find((other) => other !== id && selected.includes(other));
}

/** Only optional new metadata is validated here; arbitrary legacy notes stay text. */
export function validatePerformanceDirection(
  value: unknown
): string | undefined {
  if (value === undefined) return;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return 'Dialogue performance direction must be an object.';
  const p = value as Record<string, unknown>;
  if (p.version === 2) return validateStudio(p);
  if (
    p.version !== 1 ||
    Object.keys(p).some(
      (key) => !['version', 'styles', 'pace', 'gestures'].includes(key)
    )
  )
    return 'Dialogue performance direction has an unsupported version or field.';
  const styles = p.styles;
  if (
    !Array.isArray(styles) ||
    styles.length > DELIVERY_STYLES.length ||
    styles.some((id) => !DELIVERY_STYLES.some((item) => item.id === id)) ||
    new Set(styles).size !== styles.length
  )
    return 'Dialogue performance styles must be unique supported preset IDs.';
  if (styles.some((id) => conflictingDeliveryStyle(id, styles)))
    return 'Dialogue performance styles contain incompatible choices.';
  if (
    p.pace !== undefined &&
    (typeof p.pace !== 'string' || !Object.hasOwn(SPEAKING_PACES, p.pace))
  )
    return 'Dialogue performance pace is invalid.';
  if (
    p.gestures !== undefined &&
    (typeof p.gestures !== 'string' ||
      !Object.hasOwn(BODY_LANGUAGE, p.gestures))
  )
    return 'Dialogue performance gestures are invalid.';
}

function list(words: string[]): string {
  return words.length < 2
    ? words.join('')
    : words.length === 2
      ? words.join(' and ')
      : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

export function formatPerformancePresets(
  p?: DialoguePerformanceDirection
): string {
  if (!p || validatePerformanceDirection(p)) return '';
  if (p.version === 2) return formatStudio(p);
  const sentences: string[] = [];
  const styles = DELIVERY_STYLES.filter((style) =>
    p.styles.includes(style.id)
  ).map((style) => style.label.toLowerCase());
  if (styles.length) {
    const words = list(styles);
    sentences.push(words[0].toUpperCase() + words.slice(1) + ' delivery.');
  }
  const gestures = p.gestures
    ? {
        subtle: 'subtle gestures',
        natural: 'natural gestures',
        expressive: 'expressive gestures',
        strong_pointing: 'strong, purposeful pointing gestures',
      }[p.gestures]
    : undefined;
  if (p.pace)
    sentences.push(
      `${SPEAKING_PACES[p.pace]}-paced speech${gestures ? ` with ${gestures}` : ''}.`
    );
  else if (gestures) sentences.push(`Use ${gestures}.`);
  return sentences.join(' ');
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const supported = (value: unknown, options: object) =>
  typeof value === 'string' && Object.hasOwn(options, value);
const prose = (value: unknown) =>
  typeof value === 'string' && value.length <= 1000;
function fields(
  value: unknown,
  allowed: string[]
): value is Record<string, unknown> {
  return (
    record(value) && Object.keys(value).every((key) => allowed.includes(key))
  );
}
function selections(value: unknown, options: object): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= Object.keys(options).length &&
    value.every((id) => supported(id, options)) &&
    new Set(value).size === value.length
  );
}
function validateStudio(p: Record<string, unknown>): string | undefined {
  const error =
    'Dialogue performance version 2 contains unsupported fields or values.';
  if (
    !fields(p, [
      'version',
      'emotion',
      'techniques',
      'customTechnique',
      'voice',
      'speech',
      'gestures',
    ])
  )
    return error;
  if (p.emotion !== undefined) {
    const e = p.emotion;
    if (!fields(e, ['primary', 'secondary', 'intensity', 'custom']))
      return error;
    for (const key of ['primary', 'secondary'])
      if (e[key] !== undefined && !supported(e[key], EMOTIONS)) return error;
    if (e.primary !== undefined && e.primary === e.secondary)
      return 'Dialogue performance emotions must be distinct.';
    if (
      e.intensity !== undefined &&
      !supported(e.intensity, EMOTIONAL_INTENSITIES)
    )
      return error;
    if (e.custom !== undefined && !prose(e.custom)) return error;
  }
  if (p.techniques !== undefined) {
    if (!selections(p.techniques, TECHNIQUES)) return error;
    const selected = p.techniques as TechniqueId[];
    if (selected.some((id) => conflictingTechnique(id, selected)))
      return 'Dialogue performance techniques contain incompatible simultaneous vocal extremes.';
  }
  if (p.customTechnique !== undefined && !prose(p.customTechnique))
    return error;
  for (const [key, catalog] of [
    ['voice', VOICE_FIELDS],
    ['speech', SPEECH_FIELDS],
  ] as const) {
    const value = p[key];
    if (value === undefined) continue;
    if (
      !fields(value, [
        ...Object.keys(catalog),
        ...(key === 'speech' ? ['emphasis'] : []),
      ])
    )
      return error;
    for (const [field, selected] of Object.entries(value)) {
      if (field === 'emphasis' && key === 'speech') {
        if (!prose(selected)) return error;
      } else if (
        !supported(
          selected,
          (catalog as Record<string, { options: object }>)[field].options
        )
      )
        return error;
    }
  }
  if (p.gestures !== undefined && !selections(p.gestures, GESTURES))
    return error;
}

function formatStudio(p: DialoguePerformanceDirectionV2): string {
  const parts: string[] = [];
  const sentence = (label: string, value?: string) => {
    if (value) parts.push(`${label}: ${value}.`);
  };
  // Free text retains its whitespace and punctuation and is never parsed into presets.
  const custom = (label: string, value?: string) => {
    if (value?.trim()) parts.push(`${label}: ${value}\n`);
  };
  const e = p.emotion;
  if (e) {
    const emotions = [e.primary, e.secondary]
      .filter(Boolean)
      .map((id) => EMOTIONS[id!].toLowerCase())
      .join(' mixed with ');
    sentence(
      'Emotion',
      [emotions, e.intensity ? `${e.intensity} intensity` : '']
        .filter(Boolean)
        .join('; ')
    );
    custom('Emotional description', e.custom);
  }
  sentence(
    'Delivery technique',
    list(
      Object.entries(TECHNIQUES)
        .filter(([id]) => p.techniques?.includes(id as TechniqueId))
        .map(([, label]) => label.toLowerCase())
    )
  );
  custom('Delivery guidance', p.customTechnique);
  for (const [key, field] of Object.entries(VOICE_FIELDS)) {
    const value = p.voice?.[key as keyof typeof VOICE_FIELDS];
    if (value)
      sentence(
        field.label,
        (field.options as Record<string, string>)[value].toLowerCase()
      );
  }
  for (const [key, field] of Object.entries(SPEECH_FIELDS)) {
    const value = p.speech?.[key as keyof typeof SPEECH_FIELDS];
    if (value)
      sentence(
        field.label,
        (field.options as Record<string, string>)[value].toLowerCase()
      );
  }
  custom('Word emphasis', p.speech?.emphasis);
  sentence(
    'Body language',
    list(
      Object.entries(GESTURES)
        .filter(([id]) => p.gestures?.includes(id as keyof typeof GESTURES))
        .map(([id, label]) =>
          id === 'strong_pointing'
            ? 'strong, purposeful pointing gestures'
            : label.toLowerCase()
        )
    )
  );
  return parts.reduce(
    (text, part) => text + (text && !text.endsWith('\n') ? ' ' : '') + part,
    ''
  );
}

/** deliveryNotes stays the original editable custom string. Never parse it into IDs. */
export function getEffectiveDialogueDelivery(
  dialogue?: DialogueConfig
): string | undefined {
  const generated = formatPerformancePresets(dialogue?.performanceDirection);
  const custom = dialogue?.deliveryNotes?.trim()
    ? dialogue.deliveryNotes
    : undefined;
  return generated ? generated + (custom ? '\n\n' + custom : '') : custom;
}
