import type {ChangeSet,ChangeSetState} from '../types/changeSet';
import type {KeyframePlanV1,KeyframePatchV1} from '../types/keyframes';
import {isRecipeOperation} from '../types/changeSet';
import {blockingSourceTokens} from './blockingMcp';
import {changeSetDigest} from './changeSetCanonical';
import {parseChangeSet} from './changeSetValidation';
import {serializableMappingPackage} from './recipeConversionRequest';

/** Explicit promotion only. A resumed v6 package keeps stale proofs visible. */
export async function enableKeyframeMapping(input:ChangeSet,state:ChangeSetState):Promise<ChangeSet>{
 if(input.schema==='krakinai.change-set.v6')return input;
 if(!['krakinai.change-set.v4','krakinai.change-set.v5'].includes(input.schema))throw Error('Choose a v4–v6 guided conversion package.');
 const next=structuredClone(input);next.schema='krakinai.change-set.v6';
 for(const op of next.operations)if(isRecipeOperation(op)&&'sceneId'in op){const source=state.scenes.find(s=>s.id===op.sceneId);if(!source)throw Error('The exact mapping source is unavailable. Keep this package and restore its source.');Object.assign(op,await blockingSourceTokens(source),{expectedKeyframeDigest:await changeSetDigest(source.keyframePlan??null)});}
 return parseChangeSet(serializableMappingPackage(next));
}

/** Serialize authored state into the strict targeted patch contract, never output text. */
export function conversionKeyframePatch(plan:KeyframePlanV1|undefined,baseDigest:string,base?:KeyframePlanV1):KeyframePatchV1|null{
 if(!plan)return null;
 return{version:1,id:plan.id,expectedBaseDigest:baseDigest,frameOrder:plan.frames.map(frame=>frame.id),removeFrameIds:base?.frames.filter(old=>!plan.frames.some(frame=>frame.id===old.id)).map(frame=>frame.id)??[],stillSourceAdaptations:plan.stillSourceAdaptations?{camera:plan.stillSourceAdaptations.camera??null,action:plan.stillSourceAdaptations.action??null,sceneInstructions:plan.stillSourceAdaptations.sceneInstructions??null,omittedSources:plan.stillSourceAdaptations.omittedSources??null}:null,
 frameUpserts:plan.frames.map(frame=>{
  const old=base?.frames.find(row=>row.id===frame.id),instant=frame.instant;
  return{id:frame.id,label:frame.label,role:frame.role,relativePosition:frame.relativePosition??null,timeSeconds:frame.timeSeconds??null,participantRefs:structuredClone(frame.participantRefs),visualInstructions:frame.visualInstructions??null,referenceAssociationIds:[...frame.referenceAssociationIds],composition:frame.composition?{instructions:frame.composition.instructions??null,cameraComposition:structuredClone(frame.composition.cameraComposition??null)}:null,
   ...(frame.expressions!==undefined||old?.expressions!==undefined?{expressionUpserts:[...(frame.expressions??[]).map(expression=>structuredClone(expression)),...(old?.expressions??[]).filter(expression=>!frame.expressions?.some(row=>JSON.stringify(row.participant)===JSON.stringify(expression.participant))).map(expression=>({participant:structuredClone(expression.participant),text:null}))]}:{}),
   instant:instant?.kind==='linked_phase'?structuredClone(instant):instant?.kind==='custom'?{kind:'custom' as const,participantUpserts:instant.participants.map(p=>({participant:structuredClone(p.participant),bindingToken:p.bindingToken,wardrobeBindingToken:p.wardrobeBindingToken??null,phase:Object.fromEntries(['visibility','zone','depth','scenePlacement','bodyDirection','headDirection','eyeline','pose'].map(key=>[key,structuredClone((p.phase as Record<string,unknown>)[key]??null)]))})),participantOrder:instant.participants.map(p=>structuredClone(p.participant)),removeParticipants:old?.instant?.kind==='custom'?old.instant.participants.filter(p=>!instant.participants.some(row=>JSON.stringify(row.participant)===JSON.stringify(p.participant))).map(p=>structuredClone(p.participant)):[],propUpserts:structuredClone(instant.props??[]),removePropIds:old?.instant?.kind==='custom'?old.instant.props?.filter(p=>!instant.props?.some(row=>row.propId===p.propId)).map(p=>p.propId)??[]:[]}:null};
 })};
}
