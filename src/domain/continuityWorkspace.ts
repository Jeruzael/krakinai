import type { Collection, MediaAsset, ProjectShot, SavedScene } from '../types/domain';
import { getWardrobeContinuity, type WardrobeContinuityRow } from './projectContinuity';
import { getProjectShots, selectedSceneForShot } from './projectStoryboard';

export const CONTINUITY_VIEWS = ['overview', 'wardrobe', 'blocking', 'frames', 'transitions'] as const;
export type ContinuityView = typeof CONTINUITY_VIEWS[number];
export const CONTINUITY_LABELS: Record<ContinuityView, string> = { overview:'Overview', wardrobe:'Wardrobe', blocking:'Blocking', frames:'Frames & Prompts', transitions:'Transitions' };
export type FrameSide = 'firstFrameMediaId' | 'lastFrameMediaId';
export interface ContinuityFrame { id?: string; media?: MediaAsset; state: 'unassigned' | 'missing' | 'invalid' | 'available' }
export interface ContinuityAppearance extends WardrobeContinuityRow { key: string; offCamera: boolean; unbound: boolean; sameAsPrevious: boolean }
export interface ContinuityMatrixRow { key: string; characterId: string; characterName: string; appearances: ContinuityAppearance[] }
export interface ContinuityShotRow { shot: ProjectShot; scene?: SavedScene; wardrobe: ContinuityAppearance[]; frames: {first: ContinuityFrame; last: ContinuityFrame}; attention: boolean }

/** Derived display state only. Inspection never establishes a project or assembles outputs. */
export function buildContinuityWorkspace(collection: Collection, scenes: SavedScene[], media: MediaAsset[]) {
  const shots = getProjectShots(collection, scenes), mediaMap = new Map(media.map(item => [item.id, item]));
  const frozenRows = getWardrobeContinuity(collection, scenes);
  const matrix = new Map<string, ContinuityMatrixRow>();
  const frame = (id?: string): ContinuityFrame => {
    const record = id ? mediaMap.get(id) : undefined;
    return { ...(id ? {id} : {}), ...(record ? {media: record} : {}), state: !id ? 'unassigned' : !record ? 'missing' : !record.mimeType.startsWith('image/') ? 'invalid' : 'available' };
  };
  const rows: ContinuityShotRow[] = shots.map(shot => {
    const scene = selectedSceneForShot(shot, scenes);
    const participants = scene?.ensemble ? scene.ensemble.participants.map(p => ({participantId:p.id, character:p.character, wardrobe:p.wardrobe, offCamera:p.presence==='off_camera'})) : scene?.slots.character ? [{participantId:undefined,character:scene.slots.character,wardrobe:scene.slots.wardrobe,offCamera:false}] : [];
    const wardrobe = participants.map(p => {
      const groupKey = `${p.character.sourceType}:${p.character.sourceId}`;
      const source = frozenRows.find(r => r.shotId===shot.id && r.participantId===p.participantId && r.characterId===p.character.sourceId);
      const name = source?.characterName ?? p.character.sourceTitle;
      const group = matrix.get(groupKey) ?? {key:groupKey,characterId:p.character.sourceId,characterName:name,appearances:[]};
      const previous = [...group.appearances].reverse().find(a=>!a.offCamera);
      const description = p.wardrobe?.overrideText?.trim() ? p.wardrobe.overrideText : p.wardrobe?.promptText;
      const value: ContinuityAppearance = {
        shotId:shot.id,code:shot.code,characterId:p.character.sourceId,characterName:name,
        ...(p.participantId ? {participantId:p.participantId} : {}),
        wardrobeSourceId:p.wardrobe?.sourceId,wardrobeSourceTitle:p.wardrobe?.sourceTitle,wardrobeDescription:description,
        changed:source?.changed ?? false,intentionalReason:shot.intentionalWardrobeChange,
        key:JSON.stringify([shot.id,p.participantId??null,p.character.sourceType,p.character.sourceId]),
        offCamera:p.offCamera,unbound:p.character.sourceType!=='asset',
        sameAsPrevious:!p.offCamera && !!p.wardrobe && !!previous && previous.shotId!==shot.id && previous.wardrobeSourceId===p.wardrobe.sourceId && previous.wardrobeDescription===description,
      };
      group.appearances.push(value); matrix.set(groupKey,group); return value;
    });
    const frames = {first:frame(shot.firstFrameMediaId),last:frame(shot.lastFrameMediaId)};
    return {shot,scene,wardrobe,frames,attention:!scene || wardrobe.some(a=>!a.offCamera&&(a.changed||!a.wardrobeSourceId||a.unbound)) || Object.values(frames).some(f=>f.state==='missing'||f.state==='invalid')};
  });
  const transitions = collection.project?.transitions ?? [];
  const pairs = shots.slice(0,-1).map((from,index) => ({from,to:shots[index+1],transition:transitions.find(t=>t.fromShotId===from.id&&t.toShotId===shots[index+1].id)}));
  const detached = transitions.filter(t=>!pairs.some(p=>p.from.id===t.fromShotId&&p.to.id===t.toShotId));
  const frames = rows.flatMap(r=>Object.values(r.frames));
  return { rows, matrix:[...matrix.values()], pairs, detached, summary:{
    shots:rows.length,selectedTakes:rows.filter(r=>r.scene).length,
    missingSelectedTakes:rows.filter(r=>r.shot.selectedSceneId&&!r.scene).length,
    unselectedTakes:rows.filter(r=>!r.shot.selectedSceneId).length,
    availableImages:new Set(frames.filter(f=>f.state==='available').map(f=>f.id)).size,
    missingFrames:frames.filter(f=>f.state==='missing'||f.state==='invalid').length,
    wardrobeChanges:rows.flatMap(r=>r.wardrobe).filter(a=>!a.offCamera&&a.changed).length,
    unknownWardrobe:rows.flatMap(r=>r.wardrobe).filter(a=>!a.offCamera&&(!a.wardrobeSourceId||a.unbound)).length,
    definedTransitions:pairs.filter(p=>p.transition).length,detachedTransitions:detached.length,
  }};
}
export type ContinuityWorkspaceModel = ReturnType<typeof buildContinuityWorkspace>;
