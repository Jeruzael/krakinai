import type { SavedScene, OutputMode } from '../types/domain';
import { getActiveReferencePack, getActiveSceneSlots, getActiveSourceMediaLinks, resolveShotType } from './shotTypeRules';
const ignored = new Set(['sourceTitle','displayName','exportFilename','namesCaptured','filename','mimeType','approvedAt','updatedAt','createdAt']);
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key,value])=>!ignored.has(key) && value !== undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,stable(value)]));
  return value;
}
/** Compare frozen saved content, removing only known generated presentation headers. */
export function sceneDuplicateKey(scene: SavedScene): string {
  const outputs = Object.fromEntries((['full','structured','compact'] as OutputMode[]).map(mode=>{
    let text=scene.outputs[mode];
    if (!scene.manualOutputs[mode]) {
      const header=mode==='structured' ? `=== SCENE OVERVIEW ===\nScene Title: ${scene.title}\n` : `# ${scene.title}\n`;
      if(text.startsWith(header)) text=text.slice(header.length);
    }
    return [mode,text];
  }));
  const shotType=resolveShotType(scene);
  const pack=getActiveReferencePack(scene);
  const referencePack=pack&&shotType!=='character_scene'?{...pack,entries:pack.entries.map(entry=>entry.sourceSlot==='source'?{...entry,associationId:undefined,sourceId:undefined}:entry)}:pack;
  return JSON.stringify(stable({...(shotType!=='character_scene'?{shotType,sourceMediaLinks:getActiveSourceMediaLinks(scene)}:{}),slots:getActiveSceneSlots(scene),extraRequiredSlots:scene.extraRequiredSlots,sceneInstructions:scene.sceneInstructions,avoidText:scene.avoidText,dialogue:scene.dialogue,settings:scene.settings,outputs,manualOutputs:Object.fromEntries(Object.entries(scene.manualOutputs).map(([key,value])=>[key,value?.text])),generation:scene.generation,referencePack,references:scene.references}));
}
export function findSimilarScenes(candidate: SavedScene, scenes: SavedScene[]): SavedScene[] { const key=sceneDuplicateKey(candidate); return scenes.filter(scene=>sceneDuplicateKey(scene)===key); }
export class SimilarSceneError extends Error {
  readonly matches: SavedScene[];
  constructor(matches: SavedScene[]) { super('A similar saved scene already exists.'); this.name='SimilarSceneError';this.matches=matches; }
}
