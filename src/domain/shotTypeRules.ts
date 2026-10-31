import type { BuilderSlot, ComponentSnapshot, DialogueConfig, MediaAsset, MediaLink, ReferencePack, ReferencePackEntry, ShotType } from '../types/domain';
import { ALLOWED_IMAGE_MIMES, ALLOWED_VIDEO_MIMES, MAX_FILES_PER_RECORD, validateMediaCandidate } from './validation';
import { getEffectiveDialogueDelivery } from './dialoguePerformance';
import {getEnsembleAvoidParts} from './ensembleReferences';

export const SHOT_TYPES: ShotType[] = ['character_scene','property_environment','graphic_motion','existing_footage'];
export const SHOT_TYPE_LABELS: Record<ShotType,string> = {
  character_scene:'Character Scene', property_environment:'Property / Environment',
  graphic_motion:'Graphic / Motion Design', existing_footage:'Existing Footage',
};
export const SHOT_TYPE_DESCRIPTIONS: Record<ShotType,string> = {
  character_scene:'Character-led video with an environment and action.',
  property_environment:'Show a location or property; character and action are optional.',
  graphic_motion:'Animate an original image without inventing graphic or architectural content.',
  existing_footage:'Specify edits to an original video. KRAKINAI does not render or modify it.',
};
const slots: BuilderSlot[] = ['character','wardrobe','environment','action','camera','lighting','style'];
export interface ShotRuleSource {
  ensemble?: import('../types/ensemble').SceneEnsembleV1;
  id?: string;
  title?: string;
  shotType?: ShotType;
  slots?: Partial<Record<BuilderSlot, ComponentSnapshot>>;
  extraRequiredSlots?: BuilderSlot[];
  sourceMediaLinks?: MediaLink[];
  referencePack?: ReferencePack;
  sceneInstructions?: string;
  dialogue?: DialogueConfig;
  avoidText?: string;
  inheritedAvoidPrefix?: string;
  sourceSceneId?: string;
  references?: MediaLink[];
}
export function isShotType(value: unknown): value is ShotType { return SHOT_TYPES.includes(value as ShotType); }
export function resolveShotType(source: Pick<ShotRuleSource,'shotType'>): ShotType { return source.shotType ?? 'character_scene'; }
export function getShotTypeRules(source: ShotRuleSource) {
  const shotType=resolveShotType(source);
  const sourceKind=shotType==='graphic_motion'?'image' as const:shotType==='existing_footage'?'video' as const:undefined;
  const inapplicableSlots: BuilderSlot[]=sourceKind?['character','wardrobe','environment','action','lighting']:[];
  const requiredSlots: BuilderSlot[]=shotType==='character_scene'
    ? [...new Set<BuilderSlot>(['environment','action',...(source.extraRequiredSlots??[])])]
    : shotType==='property_environment'?['environment']:[];
  return {shotType,requiredSlots,inapplicableSlots,
    optionalSlots:slots.filter(s=>!inapplicableSlots.includes(s)&&!requiredSlots.includes(s)),
    sourceKind,requiresInstructions:Boolean(sourceKind),
    instructionLabel:shotType==='graphic_motion'?'Animation Instructions':shotType==='existing_footage'?'Editing Instructions':'Scene Instructions',
    allowsAudioOnlyWithoutCharacter:shotType!=='character_scene',
    conditionalCharacterRequired:hasSceneDialogue(source.dialogue)&&(shotType==='character_scene'||!['voiceover','off_screen'].includes(source.dialogue?.mode??'spoken')),
    preflightRules:sourceKind?['P000','P005','P008'] as const:['P000','P001','P002','P003','P004','P005','P006','P007','P008'] as const,
  };
}
export function hasSceneDialogue(dialogue?: DialogueConfig): boolean {
  return Boolean(dialogue?.line?.trim()||dialogue?.speaker?.trim()||dialogue?.mode||dialogue?.language?.trim()||getEffectiveDialogueDelivery(dialogue)||dialogue?.captionPreference);
}
export function dialogueRequiresCharacter(source: ShotRuleSource, dialogue?: DialogueConfig): boolean {
  return !getShotTypeRules(source).allowsAudioOnlyWithoutCharacter || !['voiceover','off_screen'].includes(dialogue?.mode??'spoken');
}
export function getActiveSceneSlots(source: ShotRuleSource): Partial<Record<BuilderSlot,ComponentSnapshot>> {
  const inactive=getShotTypeRules(source).inapplicableSlots;
  return Object.fromEntries(Object.entries(source.slots??{}).filter(([key])=>!inactive.includes(key as BuilderSlot)));
}
export function getActiveSourceMediaLinks(source: ShotRuleSource): MediaLink[] {
  return getShotTypeRules(source).sourceKind ? source.sourceMediaLinks??[] : [];
}
/** Remove only a known inherited aggregate; authored punctuation/text stays exact. */
export function getSceneLevelAvoidText(source: ShotRuleSource): string {
  let text=source.avoidText??'';
  if(source.ensemble){
    if(source.inheritedAvoidPrefix===undefined&&!source.sourceSceneId&&source.references===undefined)return text;
    const prefix=source.inheritedAvoidPrefix??getEnsembleAvoidParts(source).join(', ');
    if(prefix)while(text===prefix||text.startsWith(`${prefix}, `))text=text===prefix?'':text.slice(prefix.length+2);
    return text;
  }
  if(resolveShotType(source)==='character_scene')return text;
  if(source.inheritedAvoidPrefix===undefined&&!source.sourceSceneId&&source.references===undefined)return text;
  const prefix=source.inheritedAvoidPrefix??slots.map(slot=>source.slots?.[slot]?.avoidText).filter(v=>v?.trim()).join(', ');
  if(!prefix)return text;
  // Older repeated Edit-a-Copy operations could repeat this exact aggregate.
  while(text===prefix||text.startsWith(`${prefix}, `))text=text===prefix?'':text.slice(prefix.length+2);
  return text;
}
/** Capture exact component provenance without changing legacy aggregate text. */
export function getCapturedAvoidPrefix(source: ShotRuleSource): string {
  if(source.ensemble)return getEnsembleAvoidParts(source).join(', ');
  const active=getActiveSceneSlots(source);
  const parts=slots.map(slot=>active[slot]?.avoidText).filter(value=>value?.trim());
  if(resolveShotType(source)==='character_scene'&&source.inheritedAvoidPrefix) {
    const inherited=source.inheritedAvoidPrefix;
    let remaining=source.avoidText??'';
    while(remaining===inherited||remaining.startsWith(`${inherited}, `)) {
      parts.push(inherited);remaining=remaining===inherited?'':remaining.slice(inherited.length+2);
    }
  }
  return parts.join(', ');
}
export function getSourceFidelityInstructions(source: ShotRuleSource): string | undefined {
  const type=resolveShotType(source);
  return type==='graphic_motion'
    ? 'Use the original source image. Preserve its geometry, dimensions, labels and proportions. Do not redraw it or invent measurements, labels or architectural information. Attach the original file separately; copying this prompt does not upload or modify it.'
    : type==='existing_footage'
      ? 'Use the original source video as editing input. Follow only the authored editing directions. This specification does not claim that KRAKINAI has rendered or modified the video. Attach the original file separately.'
      : undefined;
}
export function getActiveReferencePack(source: ShotRuleSource): ReferencePack|undefined {
  if(!source.referencePack)return source.referencePack;
  if(resolveShotType(source)==='character_scene')return source.referencePack.entries.some(e=>e.sourceSlot==='source')
    ? {...source.referencePack,entries:source.referencePack.entries.filter(e=>e.sourceSlot!=='source')}:source.referencePack;
  const active=getActiveSceneSlots(source),sources=getActiveSourceMediaLinks(source);
  const activeIds=new Set([...Object.values(active).flatMap(s=>s?.mediaLinks??[]),...sources].map(l=>l.mediaId));
  // Selected participant IDs are captured provenance, independent of today's
  // primary slots or participant membership/presence. Automatic candidates use
  // the separate active-only snapshot traversal.
  const entries=source.referencePack.entries.filter(e=>
    Boolean(source.ensemble&&e.participantId) || e.sourceSlot==='result' || (e.sourceSlot==='source'?sources.some(l=>l.mediaId===e.mediaId):
      e.sourceSlot==='legacy'?activeIds.has(e.mediaId):Boolean(active[e.sourceSlot])));
  for(const entry of getSourceReferenceEntries(source)) if(!entries.some(e=>e.sourceSlot==='source'&&e.mediaId===entry.mediaId))entries.push({...entry,order:entries.length});
  return {...source.referencePack,entries:entries.map((entry,order)=>({...entry,order}))};
}
export function getSourceReferenceEntries(source: ShotRuleSource): ReferencePackEntry[] {
  const occurrences=new Map<string,number>();
  return getActiveSourceMediaLinks(source).map((link,order)=>{
    const key=JSON.stringify([link.mediaId,link.role,link.viewLabel??'',link.altText]);
    const occurrence=occurrences.get(key)??0;occurrences.set(key,occurrence+1);
    return {...link,associationId:JSON.stringify(['source',source.id??'source',key,occurrence]),
      sourceSlot:'source',sourceId:source.id??'source',sourceTitle:source.title??'Original Source Media',purpose:'general',order};
  });
}
export function validateShotSourceMedia(source: ShotRuleSource, mediaMap?: ReadonlyMap<string,MediaAsset>): string[] {
  const errors:string[]=[];
  if(source.shotType!==undefined&&!isShotType(source.shotType)) return ['Select a valid Shot Type.'];
  const rules=getShotTypeRules(source);
  if(!rules.sourceKind)return errors;
  const links=getActiveSourceMediaLinks(source);
  if(!links.length)errors.push(`An original source ${rules.sourceKind} is required.`);
  if(links.length>MAX_FILES_PER_RECORD)errors.push(`A maximum of ${MAX_FILES_PER_RECORD} original source files is allowed.`);
  if(!source.sceneInstructions?.trim())errors.push(`${rules.instructionLabel} are required.`);
  const allowed=rules.sourceKind==='image'?ALLOWED_IMAGE_MIMES:ALLOWED_VIDEO_MIMES;
  for(const link of links) {
    if(link.role!=='reference')errors.push('Original source media must use an input reference association.');
    const media=mediaMap?.get(link.mediaId);
    if(mediaMap&&!media){errors.push(`Original source file is missing from storage: ${link.mediaId}.`);continue;}
    const mime=media?.mimeType??link.mimeType;
    if(!mime||!allowed.has(mime))errors.push(`Original source ${rules.sourceKind} has an unsupported MIME type: ${mime??'unknown'}.`);
    if(media) {
      if(!media.blob || media.blob.size!==media.byteSize || (media.blob.type&&media.blob.type!==media.mimeType))errors.push(`Original source file has inconsistent stored bytes: ${link.mediaId}.`);
      if(link.mimeType&&link.mimeType!==media.mimeType)errors.push(`Original source MIME metadata does not match stored file: ${link.mediaId}.`);
      const check=validateMediaCandidate({name:media.filename,type:media.mimeType,size:media.byteSize,existingCount:0});
      if(!check.valid)errors.push(check.error??'Invalid original source file.');
    }
  }
  return errors;
}
