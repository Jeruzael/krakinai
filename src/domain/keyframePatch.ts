import type {SceneDraft} from '../types/domain';
import type {KeyframePlanV1,KeyframePatchV1,KeyframeInstant,KeyframeInstantPatch,PlannedKeyframeV1,FrameInstantProp} from '../types/keyframes';
import type {ParticipantRef} from '../types/blocking';
import {blockingBindingToken,blockingParticipantKey,blockingParticipantSources} from './blockingValidation';
import {assertPlainKeyframeJson,isKeyframeLocalId,validateKeyframePlan} from './keyframeValidation';

type Row=Record<string,any>;
const object=(value:unknown):value is Row=>!!value&&typeof value==='object'&&!Array.isArray(value);
function shape(value:unknown,keys:string[],required:string[]=[]):asserts value is Row{
 if(!object(value)||Object.keys(value).some(k=>!keys.includes(k))||required.some(k=>value[k]===undefined))throw Error('Unsupported or missing keyframe patch fields.');
}
function refKey(value:unknown):string{
 shape(value,object(value)&&value.kind==='primary'?['kind']:['kind','participantId'],['kind']);
 if(value.kind!=='primary'&&(value.kind!=='ensemble'||!isKeyframeLocalId(value.participantId)))throw Error('Use an exact safe participant reference.');
 return blockingParticipantKey(value as ParticipantRef);
}
function merge(base:Row|undefined,patch:Row):Row{
 const next=structuredClone(base??{});
 for(const [key,value]of Object.entries(patch)){
  if(value===null)delete next[key];
  else if(object(value)&&!(value.kind&&value.kind!==next[key]?.kind))next[key]=merge(object(next[key])?next[key]:undefined,value);
  else if(value!==undefined)next[key]=structuredClone(value);
 }
 return next;
}
function array(value:unknown,label:string):any[]{if(!Array.isArray(value))throw Error(`${label} must be an explicit array.`);return value;}
function unique(keys:string[],label:string){if(new Set(keys).size!==keys.length)throw Error(`Duplicate ${label}.`);}

function patchInstant(base:KeyframeInstant|undefined,patch:KeyframeInstantPatch|null,source:SceneDraft):KeyframeInstant|undefined{
 if(patch===null)return;
 if(patch.kind==='linked_phase'){
  shape(patch,['kind','phase'],['kind','phase']);
  if(patch.phase!=='start'&&patch.phase!=='end')throw Error('Choose an exact Start or End phase.');
  return structuredClone(patch);
 }
 shape(patch,['kind','participantUpserts','removeParticipants','participantOrder','propUpserts','removePropIds'],['kind']);
 if(patch.kind!=='custom')throw Error('Unsupported keyframe instant patch.');
 let participants=base?.kind==='custom'?structuredClone(base.participants):[];
 const upserts=patch.participantUpserts===undefined?[]:array(patch.participantUpserts,'Participant upserts');
 const removes=patch.removeParticipants===undefined?[]:array(patch.removeParticipants,'Removed participants').map(refKey);
 const upsertKeys=upserts.map(p=>{shape(p,['participant','bindingToken','wardrobeBindingToken','bindToRecipe','phase'],['participant']);return refKey(p.participant);});
 unique(upsertKeys,'participant upserts');unique(removes,'removed participants');
 if(upsertKeys.some(k=>removes.includes(k))||removes.some(k=>!participants.some(p=>refKey(p.participant)===k)))throw Error('Conflicting or unknown participant removal.');
 participants=participants.filter(p=>!removes.includes(refKey(p.participant)));
 for(const upsert of upserts){
  const key=refKey(upsert.participant),at=participants.findIndex(p=>refKey(p.participant)===key),old=at<0?undefined:participants[at];
  const {bindToRecipe,phase,...fields}=upsert;
  if(bindToRecipe!==undefined&&bindToRecipe!==true)throw Error('Explicit binding repair must be true.');
  const next=merge(old,fields);next.phase=phase===null?{}:phase===undefined?structuredClone(old?.phase??{}):merge(old?.phase,phase);
  if(bindToRecipe){
   const bound=blockingParticipantSources(source).find(p=>refKey(p.ref)===key);if(!bound)throw Error('Binding repair needs the exact existing Recipe participant.');
   next.bindingToken=blockingBindingToken(bound.character);
   if(bound.wardrobe)next.wardrobeBindingToken=blockingBindingToken(bound.wardrobe);else delete next.wardrobeBindingToken;
  }
  if(at<0)participants.push(next as any);else participants[at]=next as any;
 }
 if(patch.participantOrder!==undefined){const order=array(patch.participantOrder,'Participant order').map(refKey);unique(order,'participant order');if(order.length!==participants.length||order.some(k=>!participants.some(p=>refKey(p.participant)===k)))throw Error('Participant order must list every resulting exact participant once.');participants=order.map(k=>participants.find(p=>refKey(p.participant)===k)!);}
 let props=base?.kind==='custom'?structuredClone(base.props??[]):[];
 const removedProps=patch.removePropIds===undefined?[]:array(patch.removePropIds,'Removed props');unique(removedProps,'removed prop IDs');
 if(removedProps.some(id=>!props.some(p=>p.propId===id)))throw Error('Cannot remove an unknown instant prop.');
 props=props.filter(p=>!removedProps.includes(p.propId));
 const propUpserts=patch.propUpserts===undefined?[]:array(patch.propUpserts,'Prop upserts');unique(propUpserts.map(p=>p.propId),'prop upserts');
 for(const prop of propUpserts){shape(prop,['propId','holder'],['propId','holder']);if(removedProps.includes(prop.propId))throw Error('Conflicting instant prop edit.');const at=props.findIndex(p=>p.propId===prop.propId),next=structuredClone(prop) as FrameInstantProp;if(at<0)props.push(next);else props[at]=next;}
 return{kind:'custom',participants,...(props.length||base?.kind==='custom'&&base.props!==undefined?{props}:{})};
}

/** Pure supplied-field patching; all resulting authored values use the shared validator. */
export function applyKeyframePatch(base:KeyframePlanV1|undefined,patch:KeyframePatchV1|null|undefined,source:SceneDraft,baseDigest:string):KeyframePlanV1|undefined{
 if(patch===undefined)return structuredClone(base);if(patch===null)return;
 assertPlainKeyframeJson(patch);
 shape(patch,['version','expectedBaseDigest','id','frameUpserts','removeFrameIds','frameOrder','stillSourceAdaptations'],['version','expectedBaseDigest']);
 if(patch.version!==1||patch.expectedBaseDigest!==baseDigest)throw Error('The exact keyframe base digest changed. Read and preview the source again.');
 if(base&&patch.id!==undefined&&patch.id!==base.id)throw Error('An existing frame plan keeps its stable ID.');
 const next=structuredClone(base??{version:1,id:patch.id,frames:[]}) as KeyframePlanV1;
 const removes=patch.removeFrameIds===undefined?[]:array(patch.removeFrameIds,'Removed frames');unique(removes,'removed frame IDs');
 const upserts=patch.frameUpserts===undefined?[]:array(patch.frameUpserts,'Frame upserts');
 for(const row of upserts){shape(row,['id','label','role','relativePosition','timeSeconds','participantRefs','visualInstructions','instant','expressions','expressionUpserts','composition','referenceAssociationIds'],['id']);if(Object.hasOwn(row,'expressions'))throw Error('Use targeted expression upserts.');if(!isKeyframeLocalId(row.id))throw Error('Use a safe frame ID.');}
 unique(upserts.map(r=>r.id),'frame upserts');
 if(removes.some(id=>!next.frames.some(f=>f.id===id))||upserts.some(r=>removes.includes(r.id)))throw Error('Conflicting or unknown frame removal.');
 const adds=upserts.filter(r=>!next.frames.some(f=>f.id===r.id));
 if((adds.length||removes.length)&&patch.frameOrder===undefined)throw Error('Provide the complete resulting frame order when adding or removing frames.');
 next.frames=next.frames.filter(f=>!removes.includes(f.id));
 for(const row of upserts){
  const at=next.frames.findIndex(f=>f.id===row.id),old=at<0?undefined:next.frames[at];
  const {instant,composition,expressionUpserts,...fields}=row;
  const frame=merge(old??{id:row.id,participantRefs:[],referenceAssociationIds:[]},fields) as PlannedKeyframeV1;
  if(instant!==undefined){const result=patchInstant(old?.instant,instant,source);if(result)frame.instant=result;else delete frame.instant;}
  if(composition===null)delete frame.composition;else if(composition!==undefined){shape(composition,['instructions','cameraComposition']);frame.composition=merge(old?.composition,composition);}
  if(expressionUpserts!==undefined){
   const expressions=structuredClone(old?.expressions??[]),updates=array(expressionUpserts,'Expression upserts'),keys=updates.map(e=>{shape(e,['participant','text'],['participant','text']);return refKey(e.participant);});unique(keys,'expression participants');
   for(const e of updates){const key=refKey(e.participant),index=expressions.findIndex(old=>refKey(old.participant)===key);if(e.text===null){if(index<0)throw Error('Cannot remove an unknown expression.');expressions.splice(index,1);}else if(index<0)expressions.push(structuredClone(e));else expressions[index]=structuredClone(e);}
   frame.expressions=expressions;
  }
  if(at<0)next.frames.push(frame);else next.frames[at]=frame;
 }
 if(patch.frameOrder!==undefined){const order=array(patch.frameOrder,'Frame order');unique(order,'frame order IDs');if(order.length!==next.frames.length||order.some(id=>!next.frames.some(f=>f.id===id)))throw Error('Frame order must list every resulting exact frame ID once.');next.frames=order.map(id=>next.frames.find(f=>f.id===id)!);}
 if(patch.stillSourceAdaptations===null)delete next.stillSourceAdaptations;
 else if(patch.stillSourceAdaptations!==undefined){shape(patch.stillSourceAdaptations,['camera','action','sceneInstructions','omittedSources']);next.stillSourceAdaptations=merge(next.stillSourceAdaptations,patch.stillSourceAdaptations);}
 const blocking=validateKeyframePlan(next,source,'planning').filter(f=>f.severity==='blocking');
 if(blocking.length)throw Error(blocking.map(f=>`${f.path}: ${f.message}`).join(' '));
 return next;
}
