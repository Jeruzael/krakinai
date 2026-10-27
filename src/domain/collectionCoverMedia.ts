import type {
  Collection,
  PromptAsset,
  Variant,
  SavedScene,
} from '../types/domain';
import { getProjectShots, selectedSceneForShot } from './projectStoryboard';

/** Relationships only. Names/filenames never establish project membership. */
export function getCollectionCoverMediaIds(
  collection: Collection | undefined,
  snapshot: { assets: PromptAsset[]; variants: Variant[]; scenes: SavedScene[] }
): string[] {
  if (!collection) return [];
  const ids = new Set<string>(),
    seenScenes = new Set<string>();
  const add = (id?: string) => {
    if (id) ids.add(id);
  };
  const scenes = new Map(snapshot.scenes.map((s) => [s.id, s]));
  const includeScene = (scene: SavedScene | undefined) => {
    if (!scene || seenScenes.has(scene.id)) return;
    seenScenes.add(scene.id);
    scene.resultMediaLinks.forEach((link) => add(link.mediaId));
    scene.references.forEach((link) => add(link.mediaId));
    scene.referencePack?.entries.forEach((link) => add(link.mediaId));
    Object.values(scene.slots).forEach((slot) =>
      slot?.mediaLinks.forEach((link) => add(link.mediaId))
    );
  };
  const shots = getProjectShots(collection, snapshot.scenes);
  shots.forEach((shot) =>
    includeScene(selectedSceneForShot(shot, snapshot.scenes))
  );
  shots.forEach((shot) => {
    shot.takeSceneIds.forEach((id) => includeScene(scenes.get(id)));
    add(shot.firstFrameMediaId);
    add(shot.lastFrameMediaId);
  });
  for (const member of collection.members) {
    if (member.type === 'scene') {
      includeScene(scenes.get(member.id));
      continue;
    }
    const asset =
      member.type === 'asset'
        ? snapshot.assets.find((item) => item.id === member.id)
        : snapshot.variants.find((item) => item.id === member.id);
    asset?.mediaLinks.forEach((link) => add(link.mediaId));
    add(asset?.coverMediaId);
  }
  collection.project?.cast?.forEach((member) =>
    member.referenceMediaIds?.forEach(add)
  );
  add(collection.coverMediaId);
  return [...ids];
}
