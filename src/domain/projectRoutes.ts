import type { Collection } from '../types/domain';
import type {SavedScene} from '../types/domain';
import type {SceneProjectTarget} from '../types/sceneAuthoring';
import { createDraftFromSavedScene, getAllSnapshot, saveSceneDraft } from '../storage/db';
import { initializeProject } from '../storage/projects';
import {isDirectPrompt} from './directPrompt';

export function getSavedSceneProjectTarget(path:string,scene:SavedScene,collections:Collection[]):{requested:boolean;target?:SceneProjectTarget;error?:string}{
  const query=new URLSearchParams(path.split('?')[1]??'');
  if(!query.has('collection')&&!query.has('shot'))return {requested:false};
  const collection=collections.find(c=>c.id===query.get('collection'));
  const shot=collection?.project?.shots.find(s=>s.id===query.get('shot')&&s.takeSceneIds.includes(scene.id));
  if(!collection||!shot)return {requested:true,error:'This explicit project/shot target is unavailable or does not contain this scene. Return to the intended storyboard before creating a revision.'};
  return {requested:true,target:{collectionId:collection.id,shotId:shot.id,expectedProjectRevision:collection.project!.revision}};
}

export function getProjectSaveTarget(path: string, collections: Collection[]): {
  requested: boolean; target?: {collectionId:string;shotId:string}; error?: string;
} {
  const query = new URLSearchParams(path.split('?')[1] ?? '');
  if (!query.has('takeTarget')) return {requested:false};
  const collection = collections.find(record => record.id === query.get('collection'));
  const shot = collection?.project?.shots.find(record => record.id === query.get('shot'));
  if (query.get('takeTarget') !== '1' || !collection || !shot)
    return {requested:true,error:'This project shot is unavailable. Refresh the project or explicitly continue as a standalone draft.'};
  return {requested:true,target:{collectionId:collection.id,shotId:shot.id}};
}

export function carryProjectTarget(route: string, fromPath: string): string {
  const from = new URLSearchParams(fromPath.split('?')[1] ?? '');
  if (!from.has('takeTarget')) return route;
  const query = new URLSearchParams({collection:from.get('collection') ?? '',shot:from.get('shot') ?? '',takeTarget:from.get('takeTarget') ?? '',tab:'storyboard'});
  return `${route}?${query.toString()}`;
}

export async function startProjectShotDraft(collectionId: string, shotId: string): Promise<string> {
  await initializeProject(collectionId);
  const snapshot = await getAllSnapshot();
  const collection = snapshot.collections.find(record => record.id === collectionId);
  const shot = collection?.project?.shots.find(record => record.id === shotId);
  if (!collection || !shot) throw new Error('Project shot no longer exists. Refresh the project before creating a prompt.');
  const selectedId = shot.selectedSceneId ?? shot.takeSceneIds[0];
  if (selectedId && !snapshot.scenes.some(scene => scene.id === selectedId))
    throw new Error('Selected take is unavailable. Choose an existing take or a planned shot.');
  const selected=selectedId?snapshot.scenes.find(scene=>scene.id===selectedId):undefined;
  const draft = selected&&isDirectPrompt(selected)?await (await import('../storage/sceneAuthoring')).createSceneRevisionDraft(selected.id,{alternateTake:true,target:{collectionId,shotId,expectedProjectRevision:collection.project!.revision}}):selectedId ? await createDraftFromSavedScene(selectedId) : await saveSceneDraft({
    title:`${shot.code} — ${shot.title}`,slots:{},extraRequiredSlots:[],sceneInstructions:'',settings:{},manualOutputs:{},resultMediaLinks:[],reviewNotes:'',reviewStatus:'unreviewed',
    ...(shot.plannedShotType ? {shotType:shot.plannedShotType} : {}),
  });
  return `/builder/${encodeURIComponent(draft.id)}?${new URLSearchParams({collection:collection.id,shot:shot.id,takeTarget:'1',tab:'storyboard'}).toString()}`;
}
