import type { Collection, CollectionMemberRef, ProjectShot, SavedScene } from '../types/domain';

export function getProjectShots(collection: Collection, scenes: SavedScene[]): ProjectShot[] {
  if (collection.project) return [...collection.project.shots].sort((a,b) => a.order-b.order);
  const sceneIds = new Set(scenes.map(scene => scene.id));
  return collection.members.filter(member => member.type === 'scene').map((member, order) => ({
    id: `${collection.id}:legacy:${member.id}`, order, code: String(order + 1).padStart(2,'0'),
    title: scenes.find(scene => scene.id === member.id)?.title ?? '', takeSceneIds: [member.id],
    selectedSceneId: sceneIds.has(member.id) ? member.id : undefined,
    status: sceneIds.has(member.id) ? 'prompt_ready' : 'planned',
  }));
}

export function projectMembersFromShots(collection: Collection, shots: ProjectShot[]): CollectionMemberRef[] {
  const retained = new Map(collection.members.filter(member => member.type === 'scene').map(member => [member.id, member]));
  const members = collection.members.filter(member => member.type !== 'scene');
  const seen = new Set<string>();
  for (const shot of [...shots].sort((a,b) => a.order-b.order)) for (const id of shot.takeSceneIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    members.push(retained.get(id) ?? {type:'scene',id,addedAt:collection.updatedAt});
  }
  return members;
}

export function selectedSceneForShot(shot: ProjectShot, scenes: SavedScene[]): SavedScene | undefined {
  return shot.selectedSceneId && shot.takeSceneIds.includes(shot.selectedSceneId)
    ? scenes.find(scene => scene.id === shot.selectedSceneId) : undefined;
}

export function getProjectRuntime(collection: Collection, scenes: SavedScene[]): {plannedSeconds:number;unknownShots:number;shotCount:number;actualSeconds?:number} {
  let plannedSeconds=0,unknownShots=0;
  const shots=getProjectShots(collection,scenes);
  for (const shot of shots) {
    const selected=selectedSceneForShot(shot,scenes);
    const planned=shot.plannedDurationSeconds ?? selected?.settings.durationSeconds;
    if (typeof planned === 'number' && Number.isFinite(planned) && planned > 0 && planned <= 86400) plannedSeconds+=planned;
    else unknownShots++;
  }
  return {plannedSeconds,unknownShots,shotCount:shots.length};
}

export function removeTakeFromProject(collection: Collection, sceneId: string, scenes: SavedScene[]): Collection {
  if (!collection.project) return {...collection,members:collection.members.filter(member => member.type !== 'scene' || member.id !== sceneId)};
  const available = new Set(scenes.map(scene => scene.id));
  const shots=collection.project.shots.map(shot => {
    if (!shot.takeSceneIds.includes(sceneId)) return shot;
    const takeSceneIds=shot.takeSceneIds.filter(id => id !== sceneId);
    const selectedSceneId=shot.selectedSceneId === sceneId ? takeSceneIds.find(id => available.has(id)) : shot.selectedSceneId;
    const takeNotes=shot.takeNotes ? Object.fromEntries(Object.entries(shot.takeNotes).filter(([id]) => id !== sceneId)) : undefined;
    return {...shot,takeSceneIds,selectedSceneId,takeNotes,status:takeSceneIds.length===0?'planned':shot.status};
  });
  return {...collection,project:{...collection.project,revision:collection.project.revision+1,shots},members:projectMembersFromShots(collection,shots)};
}
