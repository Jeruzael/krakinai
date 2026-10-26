import type {Collection,ProjectShot,SavedScene} from '../types/domain';
import {projectMembersFromShots} from './projectStoryboard';

const statuses=new Set(['planned','prompt_ready','generated','reviewed','final']);
export function validateProject(collection:Collection, scenes:SavedScene[], checkMembers=true):string|null {
  const project=collection.project;
  if (!project) return null;
  if (project.version!==1 || !Number.isSafeInteger(project.revision) || project.revision<0 || !Array.isArray(project.shots)) return 'Invalid project metadata or revision.';
  const sceneIds=new Set(scenes.map(s=>s.id));
  const ids=new Set<string>();
  for (const [index,shot] of [...project.shots].sort((a,b)=>a.order-b.order).entries()) {
    if (!shot || typeof shot.id!=='string' || !shot.id.trim() || ids.has(shot.id)) return 'Invalid or duplicate shot ID.';
    ids.add(shot.id);
    if (shot.order!==index) return 'Project shot order must be contiguous.';
    if (typeof shot.code!=='string' || !shot.code.trim() || shot.code.length>40 || typeof shot.title!=='string' || shot.title.length>240 || !statuses.has(shot.status)) return 'Invalid project shot fields or status.';
    if (shot.plannedDurationSeconds!==undefined && (!Number.isFinite(shot.plannedDurationSeconds) || shot.plannedDurationSeconds<=0 || shot.plannedDurationSeconds>86400)) return 'Invalid planned duration.';
    if (shot.continuityNotes!==undefined && (typeof shot.continuityNotes!=='string'||shot.continuityNotes.length>10000)) return 'Invalid continuity notes.';
    if (shot.intentionalWardrobeChange!==undefined && (typeof shot.intentionalWardrobeChange!=='string'||shot.intentionalWardrobeChange.length>10000)) return 'Invalid wardrobe change reason.';
    if (!Array.isArray(shot.takeSceneIds) || new Set(shot.takeSceneIds).size!==shot.takeSceneIds.length || shot.takeSceneIds.some(id=>typeof id!=='string'||!id.trim()||!sceneIds.has(id))) return 'Invalid or missing project take scene.';
    if (shot.selectedSceneId!==undefined && (!shot.takeSceneIds.includes(shot.selectedSceneId)||!sceneIds.has(shot.selectedSceneId))) return 'Selected take must be an existing shot take.';
    if (shot.takeNotes && (typeof shot.takeNotes!=='object'||Array.isArray(shot.takeNotes)||Object.keys(shot.takeNotes).some(id=>!shot.takeSceneIds.includes(id)||typeof shot.takeNotes![id]!=='string'||shot.takeNotes![id].length>10000))) return 'Invalid take notes.';
  }
  if (checkMembers) {
    const expected=projectMembersFromShots(collection,project.shots).filter(m=>m.type==='scene').map(m=>m.id);
    const actual=collection.members.filter(m=>m.type==='scene').map(m=>m.id);
    if (expected.length!==actual.length||expected.some((id,i)=>id!==actual[i])) return 'Project scene members do not match shot takes.';
  }
  return null;
}

export function validateShotChange(shot:ProjectShot):void {
  if (!shot.id || typeof shot.code!=='string'||!shot.code.trim()||shot.code.length>40||typeof shot.title!=='string'||shot.title.length>240||!statuses.has(shot.status)) throw new Error('Invalid shot fields or status.');
  if (shot.plannedDurationSeconds!==undefined && (!Number.isFinite(shot.plannedDurationSeconds)||shot.plannedDurationSeconds<=0||shot.plannedDurationSeconds>86400)) throw new Error('Invalid planned duration.');
  if (shot.continuityNotes!==undefined && (typeof shot.continuityNotes!=='string'||shot.continuityNotes.length>10000)) throw new Error('Invalid continuity notes.');
}
