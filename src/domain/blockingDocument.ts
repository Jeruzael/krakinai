import type {OutputMode} from '../types/domain';
import type {SceneBlockingV1,BlockingSource,ParticipantRef,TargetRef,InteractionTargetRef,BlockingDirection,BlockingHolder,BlockingPhase} from '../types/blocking';
import {validateSceneBlocking,blockingParticipantKey,blockingParticipantSources} from './blockingValidation';

export interface BlockingDocumentV1 extends SceneBlockingV1 {participantLabels:{participant:ParticipantRef;name:string;presence:'on_camera'|'off_camera'}[]}
const byId=(a:{id:string},b:{id:string})=>a.id<b.id?-1:a.id>b.id?1:0;
export function buildBlockingDocument(source:BlockingSource&{blocking?:SceneBlockingV1}):BlockingDocumentV1|undefined{
 if(source.blocking===undefined)return;
 const errors=validateSceneBlocking(source.blocking,source,'assembly').filter(f=>f.severity==='blocking');
 if(errors.length)throw Error('Review Blocking before assembly: '+errors.map(f=>`${f.path}: ${f.message}`).join(' '));
 const plan=structuredClone(source.blocking),sources=blockingParticipantSources(source),order=new Map(sources.map((p,i)=>[blockingParticipantKey(p.ref),i]));
 plan.participants.sort((a,b)=>order.get(blockingParticipantKey(a.participant))!-order.get(blockingParticipantKey(b.participant))!);
 plan.landmarks.sort(byId);plan.props.sort(byId);
 return{...plan,participantLabels:sources.map(p=>({participant:p.ref,name:p.character.sourceTitle,presence:p.presence}))};
}
/** The compact mode preserves all authored staging, including exact action/pose strings. */
export function formatBlockingDocument(doc:BlockingDocumentV1,mode:OutputMode):string{
 const participant=(ref:ParticipantRef)=>`${doc.participantLabels.find(p=>blockingParticipantKey(p.participant)===blockingParticipantKey(ref))!.name} [${blockingParticipantKey(ref)}]`;
 const target=(ref:TargetRef|InteractionTargetRef):string=>ref.kind==='camera'?'Camera':ref.kind==='participant'?participant(ref.participant):ref.kind==='landmark'?`${doc.landmarks.find(l=>l.id===ref.landmarkId)!.label} [landmark:${ref.landmarkId}]`:`${doc.props.find(p=>p.id===ref.propId)!.label} [prop:${ref.propId}]`;
 const direction=(d:BlockingDirection)=>d.kind==='target'?`toward ${target(d.target)}`:d.direction.replaceAll('_',' ');
 const holding=(h?:BlockingHolder):string=>!h||h.kind==='unspecified'?'unspecified':h.kind==='unheld'?'unheld':h.kind==='participant'?participant(h.participant):h.kind==='landmark'?target(h):`shared by ${h.participants.map(participant).join(' and ')}`;
 const phase=(p?:BlockingPhase)=>{
  if(!p||!Object.values(p).some(v=>v!==undefined))return 'unspecified';
  const parts:string[]=[];
  if(p.visibility!==undefined)parts.push(`Visibility: ${p.visibility.replaceAll('_',' ')}`);
  if(p.zone!==undefined)parts.push(`Screen zone: ${p.zone}`);if(p.depth!==undefined)parts.push(`Depth: ${p.depth}`);
  if(p.scenePlacement)parts.push(`Scene placement: ${p.scenePlacement.relation.replaceAll('_',' ')} ${target({kind:'landmark',landmarkId:p.scenePlacement.landmarkId})}`);
  if(p.bodyDirection)parts.push(`Body: ${direction(p.bodyDirection)}`);if(p.headDirection)parts.push(`Head: ${direction(p.headDirection)}`);if(p.eyeline)parts.push(`Eyeline: ${target(p.eyeline)}`);
  if(p.pose!==undefined)parts.push(`Pose: ${p.pose}`);return parts.join('; ');
 };
 const lines=[mode==='structured'?'=== BLOCKING & SPATIAL DIRECTION ===':'## Blocking & spatial direction'];
 if(doc.space)lines.push(`Declared space: ${doc.space.id}${doc.space.originLandmarkId&&doc.space.forwardLandmarkId?`; origin ${target({kind:'landmark',landmarkId:doc.space.originLandmarkId})}; forward ${target({kind:'landmark',landmarkId:doc.space.forwardLandmarkId})}`:''}`);
 for(const l of doc.landmarks)lines.push(`Landmark [${l.id}]: ${l.label}${l.description!==undefined?`; ${l.description}`:''}${l.screen?.zone?`; screen zone ${l.screen.zone}`:''}${l.screen?.depth?`; depth ${l.screen.depth}`:''}`);
 for(const p of doc.participants){
  const label=doc.participantLabels.find(v=>blockingParticipantKey(v.participant)===blockingParticipantKey(p.participant))!;
  lines.push(`Participant: ${participant(p.participant)}${label.presence==='off_camera'?' (off-camera target only)':''}`);
  if(label.presence==='off_camera')continue;
  lines.push(`Start: ${phase(p.start)}`);
  if(p.action){lines.push(`Action [${p.action.kind}]: ${p.action.text??'unspecified'}${p.action.waypointLandmarkIds?.length?`; via ${p.action.waypointLandmarkIds.map(id=>target({kind:'landmark',landmarkId:id})).join(' → ')}`:''}`);
   for(const interaction of p.action.interactions??[]){
    const action=interaction.kind==='transfer_prop'?`${target({kind:'prop',propId:interaction.propId})}: ${participant(interaction.from)} → ${participant(interaction.to)}`:interaction.kind==='custom'?`${interaction.description}${interaction.target?`; target ${target(interaction.target)}`:''}`:target(interaction.target);
    lines.push(`Interaction [${interaction.id}] ${interaction.kind}: ${action}`);
   }
  }
  lines.push(`End: ${phase(p.end)}`);
 }
 for(const prop of doc.props)lines.push(`Prop [${prop.id}]: ${prop.label}${prop.description!==undefined?`; ${prop.description}`:''}; Start holder: ${holding(prop.startHolder)}; End holder: ${holding(prop.endHolder)}`);
 if(doc.camera?.direction)lines.push(`Camera direction: toward ${target(doc.camera.direction)}`);
 if(doc.camera?.axis){const axis=doc.camera.axis;lines.push(`Declared camera axis [${axis.id}]: ${target(axis.from)} → ${target(axis.to)}; side ${axis.side}`);}
 return lines.join('\n');
}
