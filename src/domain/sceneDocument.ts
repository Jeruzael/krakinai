import type {
  BuilderSlot,
  ComponentSnapshot,
  DialogueConfig,
  DialoguePerformanceDirection,
  MediaLink,
  OutputMode,
  SceneSettings,
  ShotType,
} from '../types/domain';
import { getEffectiveDialogueDelivery } from './dialoguePerformance';
import type {CameraComposition} from '../types/cinematography';
import type {SceneAuthoringFields, SceneRevision} from '../types/sceneAuthoring';
import {isDirectPrompt} from './directPrompt';
import {buildDirectPromptDocument} from './directPromptDocument';
import { getActiveSceneSlots, getActiveSourceMediaLinks, getSceneLevelAvoidText, getShotTypeRules, getSourceFidelityInstructions, resolveShotType, SHOT_TYPE_LABELS } from './shotTypeRules';

export const SCENE_COMPONENT_ORDER: BuilderSlot[] = [
  'character',
  'wardrobe',
  'environment',
  'action',
  'camera',
  'lighting',
  'style',
];

export interface SceneDocumentSource extends SceneAuthoringFields {
  sceneRevision?: SceneRevision;
  referencePack?: import('../types/domain').ReferencePack;
  inheritedAvoidPrefix?: string;
  sourceSceneId?: string;
  shotType?: ShotType;
  sourceMediaLinks?: MediaLink[];
  title: string;
  slots: Partial<Record<ComponentSnapshot['slot'], ComponentSnapshot>>;
  sceneInstructions: string;
  dialogue?: DialogueConfig;
  settings: SceneSettings;
  avoidText?: string;
  references?: MediaLink[];
}

interface SceneComponentDocument {
  title: string;
  prompt: string;
  compactPrompt: string;
  avoidText: string | null;
  source: {
    type: ComponentSnapshot['sourceType'];
    id: string;
    revision: number;
    parentCharacterId: string | null;
  };
  snapshot: {
    cameraComposition?:CameraComposition;
    promptText: string;
    compactText: string | null;
    overrideText: string | null;
    overrideCompactText: string | null;
  };
}

export interface SceneDocument {
  schema: 'krakinai.scene-prompt.v1';
  scene: { title: string; type: 'single_shot'; instructions: string; shotType?: ShotType; sourceFidelity?: string };
  sourceMedia?: {mediaId:string|null;filename:string|null;mimeType:string|null}[];
  components: Record<BuilderSlot, SceneComponentDocument | null>;
  dialogue: {
    type: 'spoken_audio';
    mode: NonNullable<DialogueConfig['mode']>;
    speaker: string;
    language: string | null;
    deliveryNotes: string | null;
    performanceDirection?: DialoguePerformanceDirection;
    exactLine: string;
    captionPreference: NonNullable<DialogueConfig['captionPreference']>;
  } | null;
  avoidText: string;
  settings: {
    aspectRatio: string | null;
    durationSeconds: number | null;
    toolNotes: string | null;
  };
  referenceFiles: {
    mediaId: string | null;
    role: MediaLink['role'];
    altText: string | null;
    viewLabel: string | null;
    order: number;
    filename: string | null;
    mimeType: string | null;
  }[];
}

const hasText = (text: string | undefined | null): text is string =>
  Boolean(text?.trim());
const safeMetadata = (text: string | undefined): string | null =>
  text && !/^(?:blob:|data:|file:|[a-z]:[\\/]|[\\/])/i.test(text) ? text : null;
const safeFilename = (text: string | undefined): string | null =>
  text && !/^(?:blob:|data:|file:|https?:)/i.test(text)
    ? text.split(/[\\/]/).pop() || null
    : null;

export function buildSceneDocument(source: SceneDocumentSource): SceneDocument {
  if(isDirectPrompt(source))throw new Error('Direct Prompt has no assembled component document. Use its original prompt or direct JSON export.');
  const activeSlots=getActiveSceneSlots(source);
  const sources=getActiveSourceMediaLinks(source);
  const shotType=resolveShotType(source);
  const components = {} as SceneDocument['components'];
  const references: MediaLink[] = [];
  const seenMedia = new Set<string>();
  for(const link of sources)if(!seenMedia.has(link.mediaId)){references.push({...link});seenMedia.add(link.mediaId);}
  const negativeParts: string[] = [];
  for (const slot of SCENE_COMPONENT_ORDER) {
    const snap = activeSlots[slot];
    if (!snap) {
      components[slot] = null;
      continue;
    }
    const overridden = slot !== 'character' && hasText(snap.overrideText);
    const prompt = overridden ? snap.overrideText! : snap.promptText;
    const compactPrompt =
      slot === 'character'
        ? snap.promptText
        : overridden
          ? hasText(snap.overrideCompactText)
            ? snap.overrideCompactText
            : prompt
          : hasText(snap.compactText)
            ? snap.compactText
            : prompt;
    components[slot] = {
      title: snap.sourceTitle,
      prompt,
      compactPrompt,
      avoidText: snap.avoidText ?? null,
      source: {
        type: snap.sourceType,
        id: snap.sourceId,
        revision: snap.sourceRevision,
        parentCharacterId: snap.parentCharacterId ?? null,
      },
      snapshot: {
        ...(slot==='camera'&&snap.cameraComposition?{cameraComposition:structuredClone(snap.cameraComposition)}:{}),
        promptText: snap.promptText,
        compactText: snap.compactText ?? null,
        overrideText: snap.overrideText ?? null,
        overrideCompactText: snap.overrideCompactText ?? null,
      },
    };
    if (hasText(snap.avoidText)) negativeParts.push(snap.avoidText);
    for (const link of snap.mediaLinks ?? []) {
      if (!seenMedia.has(link.mediaId)) {
        references.push({ ...link });
        seenMedia.add(link.mediaId);
      }
    }
  }
  const sceneAvoid=getSceneLevelAvoidText(source);
  if (hasText(sceneAvoid)) negativeParts.push(sceneAvoid);
  const dialogue = source.dialogue;
  let selectedReferences = source.references ?? references;
  if(shotType!=='character_scene') {
    const activeIds=new Set(references.map(l=>l.mediaId));
    selectedReferences=selectedReferences.filter(l=>activeIds.has(l.mediaId));
    for(const link of sources)if(!selectedReferences.some(l=>l.mediaId===link.mediaId))selectedReferences=[...selectedReferences,link];
  }
  return {
    schema: 'krakinai.scene-prompt.v1',
    scene: {
      title: source.title,
      type: 'single_shot',
      instructions: source.sceneInstructions ?? '',
      ...(shotType!=='character_scene'?{shotType,sourceFidelity:getSourceFidelityInstructions(source)}:{}),
    },
    ...(sources.length?{sourceMedia:sources.map(l=>({mediaId:safeMetadata(l.mediaId),filename:safeFilename(l.filename),mimeType:safeMetadata(l.mimeType)}))}:{}),
    components,
    dialogue:
      dialogue && hasText(dialogue.speaker) && hasText(dialogue.line)
        ? {
            type: 'spoken_audio',
            mode: dialogue.mode ?? 'spoken',
            speaker: dialogue.speaker,
            language: hasText(dialogue.language) ? dialogue.language : null,
            deliveryNotes: getEffectiveDialogueDelivery(dialogue) ?? null,
            ...(dialogue.performanceDirection ? {performanceDirection:structuredClone(dialogue.performanceDirection)} : {}),
            exactLine: dialogue.line,
            captionPreference: dialogue.captionPreference ?? 'unspecified',
          }
        : null,
    avoidText:
      source.references !== undefined && shotType==='character_scene'
        ? (source.avoidText ?? '')
        : negativeParts.join(', '),
    settings: {
      aspectRatio: source.settings.aspectRatio ?? null,
      durationSeconds: source.settings.durationSeconds ?? null,
      toolNotes: source.settings.toolNotes ?? null,
    },
    referenceFiles: selectedReferences.map((link) => ({
      mediaId: safeMetadata(link.mediaId),
      role: link.role,
      altText: safeMetadata(link.altText),
      viewLabel: safeMetadata(link.viewLabel),
      order: link.order,
      filename: safeFilename(link.filename),
      mimeType: safeMetadata(link.mimeType),
    })),
  };
}

export function serializeSceneJson(source: SceneDocumentSource): string {
  if(isDirectPrompt(source))return JSON.stringify(buildDirectPromptDocument(source),null,2);
  return JSON.stringify(buildSceneDocument(source), null, 2);
}

const SECTION_TITLES: Record<BuilderSlot, string> = {
  character: 'Character Identity',
  wardrobe: 'Wardrobe & Accessories',
  environment: 'Environment / Location',
  action: 'Action & Performance',
  camera: 'Camera & Cinematography',
  lighting: 'Lighting & Atmosphere',
  style: 'Visual Style',
};
export const DIALOGUE_MODE_LABELS = {
  spoken: 'Spoken, unspecified position',
  on_camera: 'On-camera speech',
  voiceover: 'Voiceover',
  off_screen: 'Off-screen speech',
} as const;

function formatDialogue(doc: SceneDocument): string | null {
  const dialogue = doc.dialogue;
  if (!dialogue) return null;
  const lines = [
    '=== SPOKEN DIALOGUE SCRIPT ===',
    `Speaker: ${dialogue.speaker}`,
    `Dialogue Mode: ${DIALOGUE_MODE_LABELS[dialogue.mode]}`,
  ];
  if (dialogue.language !== null) lines.push(`Language: ${dialogue.language}`);
  if (dialogue.deliveryNotes !== null)
    lines.push(`Delivery Notes: ${dialogue.deliveryNotes}`);
  if (dialogue.captionPreference === 'none')
    lines.push('Captions: No on-screen captions.');
  if (dialogue.captionPreference === 'requested')
    lines.push('Captions: Captions requested.');
  lines.push(
    '',
    'EXACT SPOKEN LINE:',
    `"${dialogue.exactLine}"`,
    '',
    'Performance Instruction:'
  );
  lines.push(
    dialogue.mode === 'voiceover'
      ? 'Deliver the exact line aloud as voiceover.'
      : dialogue.mode === 'off_screen'
        ? 'Deliver the exact line aloud as off-screen speech.'
        : dialogue.mode === 'on_camera'
          ? 'Speak the exact line aloud as on-camera dialogue.'
          : 'Speak the exact line aloud as dialogue.'
  );
  lines.push(
    'Treat the quoted words as the spoken performance script, separate from scene and camera instructions.'
  );
  if (dialogue.captionPreference !== 'requested')
    lines.push(
      'Do not display the spoken words as on-screen text unless captions were explicitly requested.'
    );
  return lines.join('\n');
}

export function formatSceneDocumentText(
  doc: SceneDocument,
  mode: OutputMode
): string {
  const structured = mode === 'structured';
  const overview = structured
    ? [
        '=== SCENE OVERVIEW ===',
        `Scene Title: ${doc.scene.title}`,
        'Scene Type: Single-shot video',
      ]
    : [`# ${doc.scene.title}`, 'Scene Type: Single-shot video'];
  if(doc.scene.shotType)overview.push(`Shot Type: ${SHOT_TYPE_LABELS[doc.scene.shotType]}`);
  if (doc.settings.aspectRatio !== null)
    overview.push(`Aspect Ratio: ${doc.settings.aspectRatio}`);
  if (doc.settings.durationSeconds !== null)
    overview.push(`Intended Duration: ${doc.settings.durationSeconds}s`);
  if (hasText(doc.settings.toolNotes))
    overview.push(`Tool / Provider Notes: ${doc.settings.toolNotes}`);
  const blocks = [overview.join('\n')];
  if(doc.sourceMedia?.length)blocks.push(`${structured?'=== ORIGINAL SOURCE MEDIA ===':'## Original Source Media'}\n${doc.sourceMedia.map(l=>`${l.filename??l.mediaId} | ID: ${l.mediaId} | ${l.mimeType}`).join('\n')}\n${doc.scene.sourceFidelity??''}`);
  for (const slot of SCENE_COMPONENT_ORDER) {
    const component = doc.components[slot];
    if (!component || !hasText(component.prompt)) continue;
    const heading = structured
      ? `=== ${SECTION_TITLES[slot].toUpperCase()} ===`
      : `## ${SECTION_TITLES[slot]}`;
    blocks.push(
      `${heading}\n${mode === 'compact' ? component.compactPrompt : component.prompt}`
    );
  }
  const dialogue = formatDialogue(doc);
  if (dialogue) blocks.push(dialogue);
  if (hasText(doc.scene.instructions))
    blocks.push(
      `${doc.scene.shotType && getShotTypeRules({shotType:doc.scene.shotType}).requiresInstructions
        ? structured?`=== ${getShotTypeRules({shotType:doc.scene.shotType}).instructionLabel.toUpperCase()} ===`:`## ${getShotTypeRules({shotType:doc.scene.shotType}).instructionLabel}`
        : structured ? '=== ADDITIONAL SCENE INSTRUCTIONS ===' : '## Additional Scene Instructions'}\n${doc.scene.instructions}`
    );
  return blocks.join('\n\n');
}
