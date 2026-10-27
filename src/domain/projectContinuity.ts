import type { CharacterBibleEntry, Collection, PromptAsset, SavedScene, WardrobeIntentReason } from '../types/domain';
import { getProjectShots, selectedSceneForShot } from './projectStoryboard';
import { getEffectiveDialogueDelivery } from './dialoguePerformance';

export interface ProjectCastRow extends CharacterBibleEntry { derived: boolean; asset?: PromptAsset }
export interface WardrobeContinuityRow {
  shotId: string; code: string; characterId: string; characterName: string;
  wardrobeSourceId?: string; wardrobeDescription?: string;
  changed: boolean; intentionalReason?: WardrobeIntentReason;
}
export interface ProjectDialogueRow {
  shotId: string; code: string; title: string; sceneId: string; speaker: string;
  exactLine: string; mode?: 'spoken' | 'on_camera' | 'voiceover' | 'off_screen';
  language?: string; deliveryNotes?: string; durationSeconds?: number;
}

export function getProjectCast(collection: Collection, scenes: SavedScene[], assets: PromptAsset[]): ProjectCastRow[] {
  const assetMap = new Map(assets.filter(a => a.category === 'characters').map(a => [a.id, a]));
  const explicit = (collection.project?.cast ?? []).map(entry => ({ ...entry, derived: false, asset: assetMap.get(entry.characterId) }));
  const seen = new Set(explicit.map(entry => entry.characterId));
  const derived: ProjectCastRow[] = [];
  for (const shot of getProjectShots(collection, scenes)) {
    const scene = selectedSceneForShot(shot, scenes);
    const snapshot = scene?.slots.character;
    if (!snapshot || snapshot.sourceType !== 'asset' || seen.has(snapshot.sourceId)) continue;
    seen.add(snapshot.sourceId);
    derived.push({ characterId: snapshot.sourceId, derived: true, asset: assetMap.get(snapshot.sourceId) });
  }
  return [...explicit, ...derived];
}

export function getWardrobeContinuity(collection: Collection, scenes: SavedScene[]): WardrobeContinuityRow[] {
  const rows: WardrobeContinuityRow[] = [];
  const last = new Map<string, { id?: string; description?: string }>();
  for (const shot of getProjectShots(collection, scenes)) {
    const scene = selectedSceneForShot(shot, scenes);
    const character = scene?.slots.character;
    if (!character || character.sourceType !== 'asset') continue;
    const wardrobe = scene?.slots.wardrobe;
    const description = wardrobe?.overrideText?.trim() ? wardrobe.overrideText : wardrobe?.promptText;
    const current = wardrobe ? { id: wardrobe.sourceId, description } : {};
    const previous = last.get(character.sourceId);
    rows.push({
      shotId: shot.id, code: shot.code, characterId: character.sourceId,
      characterName: collection.project?.cast?.find(c => c.characterId === character.sourceId)?.name ?? character.sourceTitle,
      wardrobeSourceId: current.id, wardrobeDescription: current.description,
      changed: Boolean(previous && previous.id && current.id && (previous.id !== current.id || previous.description !== current.description)),
      intentionalReason: shot.intentionalWardrobeChange,
    });
    last.set(character.sourceId, current);
  }
  return rows;
}

export function getProjectDialogue(collection: Collection, scenes: SavedScene[]): ProjectDialogueRow[] {
  const rows: ProjectDialogueRow[] = [];
  for (const shot of getProjectShots(collection, scenes)) {
    const scene = selectedSceneForShot(shot, scenes);
    if (!scene?.dialogue) continue;
    rows.push({ shotId: shot.id, code: shot.code, title: shot.title, sceneId: scene.id,
      speaker: scene.dialogue.speaker, exactLine: scene.dialogue.line, mode: scene.dialogue.mode,
      language: scene.dialogue.language, deliveryNotes: getEffectiveDialogueDelivery(scene.dialogue),
      durationSeconds: shot.plannedDurationSeconds ?? scene.settings.durationSeconds });
  }
  return rows;
}

export function formatProjectScript(collection: Collection, scenes: SavedScene[]): string {
  const lines = [`# ${collection.name}`, ''];
  for (const row of getProjectDialogue(collection, scenes)) {
    lines.push(`## ${row.code} ${row.title}`, '',
      `Speaker: ${row.speaker}`,
      `Mode: ${row.mode ?? 'unspecified'}`,
      `Language: ${row.language ?? 'unspecified'}`,
      ...(row.deliveryNotes ? [`Delivery: ${row.deliveryNotes}`] : []),
      `Intended duration: ${row.durationSeconds === undefined ? 'unknown' : `${row.durationSeconds} seconds`}`,
      '', row.exactLine, '');
  }
  return lines.join('\n');
}
