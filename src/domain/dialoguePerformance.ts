import type {
  DialogueConfig,
  DialogueDeliveryStyle,
  DialoguePerformanceDirection,
  DialogueSpeakingPace,
  DialogueBodyLanguage,
} from '../types/domain';

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
