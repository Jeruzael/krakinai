import type {Collection,ProjectShot,SavedScene,PromptAsset,Variant,MediaAsset,CharacterBibleEntry,ProjectTransition} from '../types/domain';
import {projectMembersFromShots} from './projectStoryboard';
import {isShotType} from './shotTypeRules';

const statuses=new Set(['planned','prompt_ready','generated','reviewed','final']);
const reasons=new Set(['new_day','costume_change','flashback','timeline','deliberate','other']);
const transitionTypes=new Set(['straight_cut','match_cut','dissolve','j_cut','l_cut','bridge_shot','custom']);
const castFields=['name','storyRole','voiceNotes','personality','distinctiveFeatures','accessories','relationships','notes'] as const;
export interface ProjectReferences {assets:PromptAsset[];variants:Variant[];media:Pick<MediaAsset,'id'|'mimeType'>[];allowMissingCastSources?:boolean}
export function validateProject(collection:Collection, scenes:SavedScene[], checkMembers=true, references?:ProjectReferences):string|null {
  if(collection.planningNotes!==undefined&&(typeof collection.planningNotes!=='string'||collection.planningNotes.length>10000))return 'Invalid project planning notes.';
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
    if (shot.plannedShotType!==undefined && !isShotType(shot.plannedShotType)) return 'Invalid planned Shot Type.';
    if (shot.continuityNotes!==undefined && (typeof shot.continuityNotes!=='string'||shot.continuityNotes.length>10000)) return 'Invalid continuity notes.';
    if (shot.intentionalWardrobeChange!==undefined && !reasons.has(shot.intentionalWardrobeChange)) return 'Invalid wardrobe change reason.';
    if(references) for(const mediaId of [shot.firstFrameMediaId,shot.lastFrameMediaId]) if(mediaId!==undefined && !references.media.some(m=>m.id===mediaId&&m.mimeType.startsWith('image/'))) return 'Project frame must reference an existing image.';
    if (!Array.isArray(shot.takeSceneIds) || new Set(shot.takeSceneIds).size!==shot.takeSceneIds.length || shot.takeSceneIds.some(id=>typeof id!=='string'||!id.trim()||!sceneIds.has(id))) return 'Invalid or missing project take scene.';
    if (shot.selectedSceneId!==undefined && (!shot.takeSceneIds.includes(shot.selectedSceneId)||!sceneIds.has(shot.selectedSceneId))) return 'Selected take must be an existing shot take.';
    if (shot.takeNotes && (typeof shot.takeNotes!=='object'||Array.isArray(shot.takeNotes)||Object.keys(shot.takeNotes).some(id=>!shot.takeSceneIds.includes(id)||typeof shot.takeNotes![id]!=='string'||shot.takeNotes![id].length>10000))) return 'Invalid take notes.';
  }
  if(project.cast!==undefined){
    if(!Array.isArray(project.cast))return 'Invalid project cast.';
    const castIds=new Set<string>();
    for(const entry of project.cast as CharacterBibleEntry[]){
      if(!entry||typeof entry.characterId!=='string'||!entry.characterId.trim()||castIds.has(entry.characterId))return 'Invalid or duplicate project cast character.';
      castIds.add(entry.characterId);
      if(castFields.some(field=>entry[field]!==undefined&&(typeof entry[field]!=='string'||entry[field]!.length>10000)))return 'Invalid project cast text.';
      for(const key of ['approvedWardrobeVariantIds','referenceMediaIds'] as const){const values=entry[key];if(values!==undefined&&(!Array.isArray(values)||new Set(values).size!==values.length||values.some(id=>typeof id!=='string'||!id.trim())))return 'Invalid project cast references.';}
      if(references){
        const asset=references.assets.find(a=>a.id===entry.characterId);
        if((!asset&&!references.allowMissingCastSources)||(asset&&asset.category!=='characters'))return 'Project cast character is unavailable.';
        if(entry.approvedWardrobeVariantIds?.some(id=>{const variant=references.variants.find(v=>v.id===id);return (!variant&&!references.allowMissingCastSources)||(variant&&(variant.parentCharacterId!==entry.characterId||variant.type!=='Outfit'||variant.targetSlot!=='wardrobe'));}))return 'Project cast wardrobe variant is unavailable.';
        if(entry.referenceMediaIds?.some(id=>!references.media.some(m=>m.id===id&&m.mimeType.startsWith('image/'))))return 'Project cast reference must be an existing image.';
      }
    }
  }
  if(project.transitions!==undefined){
    if(!Array.isArray(project.transitions))return 'Invalid project transitions.';
    const transitionIds=new Set<string>(), pairs=new Set<string>();
    for(const transition of project.transitions as ProjectTransition[]){
      if(!transition||typeof transition.id!=='string'||!transition.id.trim()||transitionIds.has(transition.id))return 'Invalid or duplicate transition ID.';
      transitionIds.add(transition.id);
      if(typeof transition.fromShotId!=='string'||typeof transition.toShotId!=='string'||!ids.has(transition.fromShotId)||!ids.has(transition.toShotId)||transition.fromShotId===transition.toShotId)return 'Invalid transition endpoints.';
      const pair=JSON.stringify([transition.fromShotId,transition.toShotId]);if(pairs.has(pair))return 'Duplicate transition pair.';pairs.add(pair);
      if(!transitionTypes.has(transition.type)||typeof transition.description!=='string'||transition.description.length>10000||typeof transition.notes!=='string'||transition.notes.length>10000)return 'Invalid transition fields.';
      if(transition.durationSeconds!==undefined&&(!Number.isFinite(transition.durationSeconds)||transition.durationSeconds<=0||transition.durationSeconds>86400))return 'Invalid transition duration.';
    }
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
  if (shot.plannedShotType!==undefined && !isShotType(shot.plannedShotType)) throw new Error('Invalid planned Shot Type.');
  if (shot.continuityNotes!==undefined && (typeof shot.continuityNotes!=='string'||shot.continuityNotes.length>10000)) throw new Error('Invalid continuity notes.');
  if(shot.intentionalWardrobeChange!==undefined&&!reasons.has(shot.intentionalWardrobeChange))throw new Error('Invalid wardrobe change reason.');
}
