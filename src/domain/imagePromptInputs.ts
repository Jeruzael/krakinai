import type {SceneDraft,ComponentSnapshot} from '../types/domain';
import type {PlannedKeyframeV1,KeyframeFinding} from '../types/keyframes';
import type {ParticipantRef,TargetRef,BlockingDirection,BlockingPhase,BlockingHolder} from '../types/blocking';
import {blockingBindingToken,blockingParticipantKey,blockingParticipantSources} from './blockingValidation';
import {getActiveSceneSlots,getSourceFidelityInstructions,resolveShotType,getSceneLevelAvoidText} from './shotTypeRules';
import {resolveKeyframeInstant,getKeyframeReferenceEntries} from './keyframeValidation';
import {getIdentityAnchorStatus,getIdentityRevision,resolveGenerationIdentity} from './identityAnchors';
import {projectStillCamera} from './stillCamera';
import {validateSnapshotWardrobeOwnership} from './ensembleValidation';

export interface ImagePromptSection{kind:string;label:string;text:string}
const effective=(s:ComponentSnapshot|undefined)=>s?(s.overrideText?.trim()?s.overrideText:s.promptText):'';
export function resolveImagePromptInputs(source:SceneDraft,frame:PlannedKeyframeV1):{sections:ImagePromptSection[];bindings:unknown;findings:KeyframeFinding[]}{
 const sections:ImagePromptSection[]=[],findings:KeyframeFinding[]=[];
 const add=(kind:string,label:string,text:string|undefined)=>{if(text?.trim())sections.push({kind,label,text});};
 const fail=(code:string,path:string,message:string)=>findings.push({code,path,message,severity:'blocking'});
 const slots=getActiveSceneSlots(source),roster=blockingParticipantSources(source),instant=resolveKeyframeInstant(source,frame);
 const selected=new Set(frame.participantRefs.map(blockingParticipantKey));
 const visible=roster.filter(p=>selected.has(blockingParticipantKey(p.ref))&&p.presence==='on_camera'&&instant?.participants.find(t=>blockingParticipantKey(t.participant)===blockingParticipantKey(p.ref))?.start?.visibility!=='out_of_frame');
 add('intent','Image task','Create one still image depicting a single frozen instant.');
 add('aspect','Aspect ratio',source.settings.aspectRatio);
 const identities=[];
 for(const p of visible){
  const key=blockingParticipantKey(p.ref),generation=p.ref.kind==='ensemble'?source.ensemble?.participants.find(v=>v.id===(p.ref as {participantId:string}).participantId)?.generation:source.generation;
  const ownership=validateSnapshotWardrobeOwnership(p.character,p.wardrobe);if(ownership)fail('IMAGE_WARDROBE','slots.wardrobe',ownership);
  if(!p.character.promptText?.trim()){fail('IMAGE_IDENTITY','keyframes.identity','Select a captured Character identity with complete appearance text.');continue;}
  if(generation?.identitySource==='approved_anchor'){
   const anchor=generation.anchor,approved=p.character.identityAnchor;
   if(p.character.sourceType!=='asset'||!anchor||getIdentityAnchorStatus(p.character)!=='approved'||anchor.text!==approved?.approvedText||anchor.approvedAt!==approved.approvedAt||anchor.approvedMasterIdentityRevision!==getIdentityRevision(p.character)){
    fail('IMAGE_IDENTITY','keyframes.identity','The requested anchor must match this captured Character’s explicit approval. Choose its master identity or review the owned anchor.');continue;
   }
  }
  const identity=resolveGenerationIdentity({slots:{character:p.character},generation},undefined,true).identity;
  add('identity',`Character ${p.character.sourceTitle} [${key}]`,identity.description);
  add('wardrobe',`Wardrobe [${key}]`,effective(p.wardrobe));
  identities.push({participant:p.ref,character:blockingBindingToken(p.character),wardrobe:p.wardrobe?blockingBindingToken(p.wardrobe):undefined,identitySource:identity.source});
 }
 if(resolveShotType(source)==='character_scene'||resolveShotType(source)==='property_environment'){
  if(!slots.environment||!effective(slots.environment).trim())fail('IMAGE_RECIPE','slots.environment','Select an Environment before complete image assembly.');
 }
 for(const [slot,label]of [['environment','Environment'],['lighting','Lighting'],['style','Style']] as const)add(slot,label,effective(slots[slot]));
 const adaptations=source.keyframePlan?.stillSourceAdaptations,omitted=new Set(adaptations?.omittedSources??[]);
 const ownCamera=Boolean(frame.composition?.cameraComposition||frame.composition?.instructions?.trim());
 const camera=projectStillCamera(ownCamera?frame.composition?.cameraComposition:slots.camera?.cameraComposition);
 if(camera.error||frame.composition?.cameraComposition&&camera.omittedIds.length)fail('IMAGE_CAMERA','keyframes.composition','Choose reviewed static Camera techniques or author an explicit still composition. Motion techniques remain in the separate video prompt.');
 add('camera','Static camera composition',camera.text);
 add('composition','Frame composition',frame.composition?.instructions);
 for(const key of ['camera','action','sceneInstructions'] as const){
  if(key==='camera'&&ownCamera)continue;
  const raw=key==='sceneInstructions'?source.sceneInstructions:effective(slots[key]);
  const typedOnly=key==='camera'&&slots.camera?.cameraComposition?.includeBaseText===false;
  const adaptation=adaptations?.[key];
  if(raw?.trim()&&!typedOnly&&!adaptation?.trim()&&!omitted.has(key))fail('IMAGE_ADAPTATION',`keyframePlan.stillSourceAdaptations.${key}`,`Review ${key} source context and provide a still adaptation or explicitly omit it. Video prose is never silently rewritten.`);
  if(!omitted.has(key))add('adaptation',key==='camera'?'Still camera adaptation':key==='action'?'Instant action adaptation':'Visual instructions adaptation',adaptation);
 }
 add('moment','Selected visual moment',frame.visualInstructions);
 const participant=(ref:ParticipantRef)=>`${roster.find(p=>blockingParticipantKey(p.ref)===blockingParticipantKey(ref))?.character.sourceTitle??'Unresolved participant'} [${blockingParticipantKey(ref)}]`;
 const target=(ref:TargetRef):string=>ref.kind==='camera'?'the camera':ref.kind==='participant'?participant(ref.participant):`${instant?.landmarks.find(l=>l.id===ref.landmarkId)?.label??'Unresolved landmark'} [landmark:${ref.landmarkId}]`;
 const direction=(v:BlockingDirection)=>v.kind==='target'?`toward ${target(v.target)}`:v.direction.replaceAll('_',' ');
 const phase=(p:BlockingPhase)=>{
  if(p.visibility==='out_of_frame')return 'out of frame; do not depict this participant.';
  const parts:string[]=[];
  if(p.visibility)parts.push(`Visibility: ${p.visibility.replaceAll('_',' ')}`);
  if(p.zone)parts.push(`Screen zone: ${p.zone}`);if(p.depth)parts.push(`Depth: ${p.depth}`);
  if(p.scenePlacement)parts.push(`Placement: ${p.scenePlacement.relation.replaceAll('_',' ')} ${target({kind:'landmark',landmarkId:p.scenePlacement.landmarkId})}`);
  if(p.bodyDirection)parts.push(`Body orientation: ${direction(p.bodyDirection)}`);
  if(p.headDirection)parts.push(`Head orientation: ${direction(p.headDirection)}`);
  if(p.eyeline)parts.push(`Eyeline: ${target(p.eyeline)}`);if(p.pose!==undefined)parts.push(`Pose: ${p.pose}`);
  return parts.join('; ')||'Position intentionally unspecified.';
 };
 const holding=(v:BlockingHolder):string=>v.kind==='participant'?participant(v.participant):v.kind==='shared'?`shared by ${v.participants.map(participant).join(' and ')}`:v.kind==='landmark'?target(v):v.kind.replaceAll('_',' ');
 if(instant){
  const lines=[];
  if(instant.space)lines.push(`Declared space: ${instant.space.id}${instant.space.originLandmarkId&&instant.space.forwardLandmarkId?`; origin ${target({kind:'landmark',landmarkId:instant.space.originLandmarkId})}; forward ${target({kind:'landmark',landmarkId:instant.space.forwardLandmarkId})}`:''}`);
  for(const l of instant.landmarks)lines.push(`Landmark ${l.label} [${l.id}]${l.description?`: ${l.description}`:''}${l.screen?.zone?`; screen zone ${l.screen.zone}`:''}${l.screen?.depth?`; depth ${l.screen.depth}`:''}`);
  for(const p of instant.participants)lines.push(`${participant(p.participant)}: ${phase(p.start??{})}`);
  for(const p of instant.props)lines.push(`Prop ${p.label} [${p.id}]${p.description?`: ${p.description}`:''}; holder: ${p.startHolder?holding(p.startHolder):'unspecified'}`);
  if(instant.camera?.direction)lines.push(`Declared camera direction: toward ${target(instant.camera.direction)}`);
  if(instant.camera?.axis)lines.push(`Declared camera axis ${instant.camera.axis.id}: ${target(instant.camera.axis.from)} / ${target(instant.camera.axis.to)}; side ${instant.camera.axis.side}`);
  add('blocking','Instantaneous spatial setup',lines.join('\n'));
 }
 for(const e of frame.expressions??[])if(visible.some(p=>blockingParticipantKey(p.ref)===blockingParticipantKey(e.participant)))add('expression',`Expression [${blockingParticipantKey(e.participant)}]`,e.text);
 add('source','Original source fidelity',getSourceFidelityInstructions(source));
 const references=getKeyframeReferenceEntries(source);
 const referenceLines=frame.referenceAssociationIds.map(id=>references.find(e=>e.associationId===id)).filter((e):e is NonNullable<typeof e>=>Boolean(e)).map((e,i)=>`${i+1}. ${e.role==='sample'?'Illustrative sample (not identity approval)':e.role==='result'?'Externally supplied result (review separately)':'Reference'} · ${e.sourceSlot} · ${e.purpose}${e.participantId?` [participant:${e.participantId}]`:''}${e.altText?` — ${e.altText}`:''}`);
 add('references','Accompanying reference inputs',referenceLines.join('\n'));
 const negatives=[...visible.flatMap(p=>[p.character.avoidText,p.wardrobe?.avoidText]),slots.environment?.avoidText,slots.lighting?.avoidText,slots.style?.avoidText,getSceneLevelAvoidText(source)].filter((s):s is string=>Boolean(s?.trim()));
 add('negative','Avoid / negative instructions',[...new Set(negatives)].join('\n'));
 return{sections,findings,bindings:{identities,environment:slots.environment?blockingBindingToken(slots.environment):undefined,lighting:slots.lighting?blockingBindingToken(slots.lighting):undefined,style:slots.style?blockingBindingToken(slots.style):undefined,camera:!ownCamera&&slots.camera?blockingBindingToken(slots.camera):undefined,action:adaptations?.action&&slots.action?blockingBindingToken(slots.action):undefined}};
}
