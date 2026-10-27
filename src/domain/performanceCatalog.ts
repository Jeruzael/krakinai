/** Stable authoring IDs. Labels are descriptive prompt guidance, not audio guarantees. */
export const EMOTION_GROUPS = {
  Positive: {
    joyful: 'Joyful',
    excited: 'Excited',
    content: 'Content',
    relieved: 'Relieved',
    grateful: 'Grateful',
    proud: 'Proud',
    hopeful: 'Hopeful',
    affectionate: 'Affectionate',
    amused: 'Amused',
    inspired: 'Inspired',
    triumphant: 'Triumphant',
  },
  'Sad / Vulnerable': {
    sad: 'Sad',
    grieving: 'Grieving',
    heartbroken: 'Heartbroken',
    disappointed: 'Disappointed',
    regretful: 'Regretful',
    lonely: 'Lonely',
    ashamed: 'Ashamed',
    guilty: 'Guilty',
    vulnerable: 'Vulnerable',
    wistful: 'Wistful',
    nostalgic: 'Nostalgic',
  },
  'Anger / Conflict': {
    angry: 'Angry',
    furious: 'Furious',
    frustrated: 'Frustrated',
    irritated: 'Irritated',
    resentful: 'Resentful',
    jealous: 'Jealous',
    bitter: 'Bitter',
    contemptuous: 'Contemptuous',
    disgusted: 'Disgusted',
    defensive: 'Defensive',
    confrontational: 'Confrontational',
  },
  'Fear / Uncertainty': {
    afraid: 'Afraid',
    anxious: 'Anxious',
    nervous: 'Nervous',
    panicked: 'Panicked',
    worried: 'Worried',
    hesitant: 'Hesitant',
    suspicious: 'Suspicious',
    insecure: 'Insecure',
    overwhelmed: 'Overwhelmed',
    confused: 'Confused',
  },
  'Surprise / Discovery': {
    surprised: 'Surprised',
    shocked: 'Shocked',
    amazed: 'Amazed',
    astonished: 'Astonished',
    curious: 'Curious',
    puzzled: 'Puzzled',
    skeptical: 'Skeptical',
    intrigued: 'Intrigued',
  },
  'Neutral / Controlled': {
    calm: 'Calm',
    composed: 'Composed',
    serious: 'Serious',
    stoic: 'Stoic',
    focused: 'Focused',
    determined: 'Determined',
    confident: 'Confident',
    indifferent: 'Indifferent',
    resigned: 'Resigned',
  },
  'Social / Complex': {
    embarrassed: 'Embarrassed',
    shy: 'Shy',
    awkward: 'Awkward',
    sympathetic: 'Sympathetic',
    compassionate: 'Compassionate',
    playful: 'Playful',
    flirty: 'Flirty',
    pleading: 'Pleading',
    conflicted: 'Conflicted',
  },
} as const;
type ValueOf<T> = T[keyof T];
export type EmotionId = ValueOf<{
  [K in keyof typeof EMOTION_GROUPS]: keyof (typeof EMOTION_GROUPS)[K];
}>;
export const EMOTIONS: Record<EmotionId, string> = Object.assign(
  {},
  ...Object.values(EMOTION_GROUPS)
);
export const EMOTIONAL_INTENSITIES = {
  subtle: 'Subtle',
  mild: 'Mild',
  moderate: 'Moderate',
  strong: 'Strong',
  extreme: 'Extreme',
} as const;
export const TECHNIQUES = {
  conversational: 'Conversational',
  whispered: 'Whispered',
  murmured: 'Murmured',
  shouted: 'Shouted',
  screamed: 'Screamed',
  lecturing: 'Lecturing',
  questioning: 'Questioning',
  interrogative: 'Interrogative',
  pleading: 'Pleading',
  commanding: 'Commanding',
  persuasive: 'Persuasive',
  confessing: 'Confessing',
  reassuring: 'Reassuring',
  warning: 'Warning',
  accusing: 'Accusing',
  theatrical: 'Theatrical',
  understated: 'Understated',
  deadpan: 'Deadpan',
  monotone: 'Monotone',
  stammering: 'Stammering',
  breathless: 'Breathless',
  trembling: 'Trembling',
  laughing_while_speaking: 'Laughing while speaking',
  crying_while_speaking: 'Crying while speaking',
  soothing: 'Soothing',
  teasing: 'Teasing',
  mocking: 'Mocking',
  formal: 'Formal',
  casual: 'Casual',
  intimate: 'Intimate',
  storytelling: 'Storytelling',
  motivational: 'Motivational',
  sarcastic: 'Sarcastic',
  restrained: 'Restrained',
  emphatic: 'Emphatic',
} as const;
export type TechniqueId = keyof typeof TECHNIQUES;
export const VOICE_FIELDS = {
  tone: {
    label: 'Vocal tone',
    options: {
      warm: 'Warm',
      cold: 'Cold',
      gentle: 'Gentle',
      stern: 'Stern',
      friendly: 'Friendly',
      authoritative: 'Authoritative',
      intimate: 'Intimate',
      detached: 'Detached',
      reassuring: 'Reassuring',
    },
  },
  pitch: {
    label: 'Relative pitch',
    options: { low: 'Low', mid: 'Mid', high: 'High' },
  },
  variation: {
    label: 'Pitch variation',
    options: { flat: 'Flat', subtle: 'Subtle', expressive: 'Expressive' },
  },
  texture: {
    label: 'Voice texture',
    options: {
      smooth: 'Smooth',
      breathy: 'Breathy',
      airy: 'Airy',
      raspy: 'Raspy',
      husky: 'Husky',
      gravelly: 'Gravelly',
      nasal: 'Nasal',
      clear: 'Clear',
      trembling: 'Trembling',
    },
  },
  projection: {
    label: 'Projection',
    options: { soft: 'Soft', normal: 'Normal', projected: 'Projected' },
  },
  intensity: {
    label: 'Vocal intensity',
    options: {
      restrained: 'Restrained',
      moderate: 'Moderate',
      strong: 'Strong',
    },
  },
} as const;
export const SPEECH_FIELDS = {
  pace: {
    label: 'Speaking pace',
    options: { slow: 'Slow', natural: 'Natural', fast: 'Fast' },
  },
  intonation: {
    label: 'Intonation',
    options: {
      flat: 'Flat',
      rising: 'Rising',
      falling: 'Falling',
      varied: 'Varied',
      questioning: 'Questioning',
      emphatic: 'Emphatic',
    },
  },
  rhythm: {
    label: 'Rhythm',
    options: {
      steady: 'Steady',
      flowing: 'Flowing',
      hesitant: 'Hesitant',
      choppy: 'Choppy',
    },
  },
  articulation: {
    label: 'Articulation',
    options: {
      clear: 'Clear',
      natural: 'Natural',
      crisp: 'Crisp',
      deliberately_slurred: 'Deliberately slurred',
    },
  },
  pauses: {
    label: 'Pauses',
    options: { brief: 'Brief', deliberate: 'Deliberate', dramatic: 'Dramatic' },
  },
} as const;
export type VoiceDirection = {
  [K in keyof typeof VOICE_FIELDS]?: keyof (typeof VOICE_FIELDS)[K]['options'];
};
export type SpeechDirection = {
  [
    K in keyof typeof SPEECH_FIELDS
  ]?: keyof (typeof SPEECH_FIELDS)[K]['options'];
} & { emphasis?: string };
export const GESTURES = {
  subtle: 'Subtle gestures',
  natural: 'Natural gestures',
  expressive: 'Expressive gestures',
  strong_pointing: 'Strong pointing gestures',
  minimal_movement: 'Minimal movement',
  open_palm: 'Open-palm gestures',
  restless_movement: 'Restless movement',
  nervous_fidgeting: 'Nervous fidgeting',
  restrained_posture: 'Restrained posture',
} as const;
export type BodyGesture = keyof typeof GESTURES;

/** Simultaneous quiet/loud vocal extremes cannot be selected together. */
export function conflictingTechnique(
  id: TechniqueId,
  selected: readonly TechniqueId[]
): TechniqueId | undefined {
  const quiet: TechniqueId[] = ['whispered', 'murmured'];
  const loud: TechniqueId[] = ['shouted', 'screamed'];
  return (quiet.includes(id) ? loud : loud.includes(id) ? quiet : []).find(
    (value) => selected.includes(value)
  );
}
