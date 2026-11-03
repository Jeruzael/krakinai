import type {SceneDraft,ReferencePackEntry} from '../types/domain';
import type {SceneBlockingV1,ParticipantRef} from '../types/blocking';
import {BLOCKING_LOCAL_ID_PATTERN} from '../types/blocking';
import {KEYFRAME_LIMITS as L,type KeyframeFinding,type PlannedKeyframeV1} from '../types/keyframes';
import {blockingParticipantKey,blockingParticipantSources,validateSceneBlocking} from './blockingValidation';
import {collectReferenceCandidates} from './referencePack';
import {getActiveReferencePack} from './shotTypeRules';

type Obj=Record<string,unknown>;
const record=(v:unknown):v is Obj=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
export const isKeyframeLocalId=(v:unknown):v is string=>typeof v==='string'&&new RegExp(BLOCKING_LOCAL_ID_PATTERN).test(v);

/** Read descriptors before JSON.stringify; never invoke an accessor or toJSON hook. */
export function assertPlainKeyframeJson(value:unknown,maximum=L.planBytes,maximumNodes=16384):string{
 const active=new Set<object>();let nodes=0;
 const visit=(v:unknown,depth:number):boolean=>{
  if(++nodes>maximumNodes||depth>48)return false;
  if(v===null||typeof v==='string'||typeof v==='boolean')return true;
  if(typeof v==='number')return Number.isFinite(v);
  if(!v||typeof v!=='object'||active.has(v)||(!Array.isArray(v)&&!record(v))||Object.getOwnPropertySymbols(v).length)return false;
  active.add(v);
  try{
   const descriptors=Object.getOwnPropertyDescriptors(v),array=Array.isArray(v);
   if(array&&(Object.getPrototypeOf(v)!==Array.prototype||v.length>2000||Array.from({length:v.length},(_,i)=>String(i)).some(key=>!Object.hasOwn(descriptors,key))))return false;
   return Object.entries(descriptors).every(([key,d])=>array&&key==='length'||(!d.get&&!d.set&&!['__proto__','prototype','constructor','toJSON'].includes(key)&&(!array&&d.value===undefined||visit(d.value,depth+1))));
  }finally{active.delete(v);}
 };
 if(!visit(value,0))throw Error('Use bounded plain keyframe JSON without hooks, accessors, cycles or nonfinite values.');
 const json=JSON.stringify(value);if(new TextEncoder().encode(json).length>maximum)throw Error('KEYFRAME_BYTES: authored keyframe data exceeds its UTF-8 budget.');return json;
}

export function getKeyframeReferenceEntries(source:SceneDraft):ReferencePackEntry[]{return getActiveReferencePack(source)?.entries??collectReferenceCandidates(source,new Map());}

/** Project only an explicitly chosen instant; Action never supplies an interpolated state. */
export function resolveKeyframeInstant(source:SceneDraft,frame:PlannedKeyframeV1):SceneBlockingV1|undefined{
 if(!frame.instant)return;
 const base=source.blocking;
 if(frame.instant.kind==='linked_phase'){
  if(!base)return;
  const phase=frame.instant.phase;
  return{version:1,...(base.space?{space:structuredClone(base.space)}:{}),landmarks:structuredClone(base.landmarks),props:base.props.map(p=>({id:p.id,label:p.label,...(p.description?{description:p.description}:{}),...(p[phase==='start'?'startHolder':'endHolder']?{startHolder:structuredClone(p[phase==='start'?'startHolder':'endHolder'])}:{})})),participants:frame.participantRefs.map(ref=>{const track=base.participants.find(p=>blockingParticipantKey(p.participant)===blockingParticipantKey(ref));return{participant:structuredClone(ref),bindingToken:track?.bindingToken??'',...(track?.wardrobeBindingToken?{wardrobeBindingToken:track.wardrobeBindingToken}:{}),...(track?.[phase]?{start:structuredClone(track[phase])}:{})};}),...(base.camera?{camera:structuredClone(base.camera)}:{})};
 }
 return{version:1,...(base?.space?{space:structuredClone(base.space)}:{}),landmarks:structuredClone(base?.landmarks??[]),props:(frame.instant.props??[]).map(p=>{const original=base?.props.find(v=>v.id===p.propId);return{id:p.propId,label:original?.label??p.propId,...(original?.description?{description:original.description}:{}),startHolder:structuredClone(p.holder)};}),participants:frame.instant.participants.map(p=>({participant:structuredClone(p.participant),bindingToken:p.bindingToken,...(p.wardrobeBindingToken?{wardrobeBindingToken:p.wardrobeBindingToken}:{}),start:structuredClone(p.phase)})),...(base?.camera?{camera:structuredClone(base.camera)}:{})};
}

export function validateKeyframePlan(value:unknown,source:SceneDraft,mode:'planning'|'assembly',assemblyFrameId?:string):KeyframeFinding[]{
 if(value===undefined)return [];
 const findings:KeyframeFinding[]=[];
 // Only unresolved frame readiness is local. Shape, duplicate IDs, order and timing remain plan-wide.
 const targetPath=assemblyFrameId===undefined?undefined:`keyframePlan.frames[${source.keyframePlan?.frames.findIndex(f=>f.id===assemblyFrameId)}]`;
 const otherFrameReadiness=(code:string,path:string)=>targetPath!==undefined&&!path.startsWith(targetPath)&&['KEYFRAME_INSTANT','KEYFRAME_BINDING','KEYFRAME_REFERENCE'].includes(code);
 const issue=(code:string,path:string,message:string,incomplete=false)=>findings.push({code,path,message,severity:incomplete&&(mode==='planning'||otherFrameReadiness(code,path))?'incomplete':'blocking'});
 try{assertPlainKeyframeJson(value);}catch(error){issue(String(error).includes('KEYFRAME_BYTES')?'KEYFRAME_BYTES':'KEYFRAME_SHAPE','keyframePlan',String((error as Error).message));return findings;}
 const shape=(v:unknown,allowed:string[],required:string[],path:string):v is Obj=>{if(!record(v)||Object.keys(v).some(k=>!allowed.includes(k))||required.some(k=>v[k]===undefined)){issue('KEYFRAME_SHAPE',path,'Unsupported or missing keyframe fields.');return false;}return true;};
 const text=(v:unknown,max:number,path:string,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))issue('KEYFRAME_SHAPE',path,`Use ${required?'nonblank ':''}text of at most ${max} characters.`);};
 const id=(v:unknown,path:string)=>{if(!isKeyframeLocalId(v))issue('KEYFRAME_SHAPE',path,'Use a safe local ID of at most 64 characters.');};
 const list=(v:unknown,max:number,path:string):unknown[]=>{if(!Array.isArray(v)||v.length>max){issue('KEYFRAME_SHAPE',path,`Use at most ${max} entries.`);return [];}return v;};
 const sources=new Map(blockingParticipantSources(source).map(p=>[blockingParticipantKey(p.ref),p]));
 const ref=(v:unknown,path:string):string|undefined=>{
  if(!record(v)||!['primary','ensemble'].includes(String(v.kind))||!shape(v,v.kind==='primary'?['kind']:['kind','participantId'],v.kind==='primary'?['kind']:['kind','participantId'],path)){issue('KEYFRAME_SHAPE',path,'Choose an exact participant reference.');return;}
  if(v.kind==='ensemble')id(v.participantId,path+'.participantId');
  const key=blockingParticipantKey(v as unknown as ParticipantRef);if(!sources.has(key))issue('KEYFRAME_BINDING',path,'Select or repair this exact Recipe participant.',true);return key;
 };
 if(!shape(value,['version','id','frames','stillSourceAdaptations'],['version','id','frames'],'keyframePlan'))return findings;
 if(value.version!==1)issue('KEYFRAME_SHAPE','keyframePlan.version','Unsupported keyframe-plan version.');id(value.id,'keyframePlan.id');
 const frames=list(value.frames,L.frames,'keyframePlan.frames');
 if(value.stillSourceAdaptations!==undefined&&shape(value.stillSourceAdaptations,['camera','action','sceneInstructions','omittedSources'],[],'keyframePlan.stillSourceAdaptations')){
  const a=value.stillSourceAdaptations;for(const key of ['camera','action','sceneInstructions'])if(a[key]!==undefined)text(a[key],L.instructions,'keyframePlan.stillSourceAdaptations.'+key);
  if(a.omittedSources!==undefined){const omitted=list(a.omittedSources,3,'keyframePlan.stillSourceAdaptations.omittedSources');if(new Set(omitted).size!==omitted.length||omitted.some(k=>!['camera','action','sceneInstructions'].includes(String(k))))issue('KEYFRAME_SHAPE','keyframePlan.stillSourceAdaptations.omittedSources','Choose each explicitly omitted source once.');if(omitted.some(k=>typeof k==='string'&&typeof a[k]==='string'&&a[k].trim()))issue('KEYFRAME_ADAPTATION','keyframePlan.stillSourceAdaptations','Choose an adaptation or explicit omission for a source, not both.');}
 }
 const seenIds=new Set<string>(),seenRoles=new Set<string>();let previousTime=-Infinity;
 const references=new Set(getKeyframeReferenceEntries(source).map(e=>e.associationId));
 frames.forEach((v,index)=>{
  const path=`keyframePlan.frames[${index}]`;
  if(!shape(v,['id','label','role','relativePosition','timeSeconds','participantRefs','visualInstructions','instant','expressions','composition','referenceAssociationIds'],['id','label','role','participantRefs','referenceAssociationIds'],path))return;
  id(v.id,path+'.id');text(v.label,L.label,path+'.label',true);
  if(typeof v.id==='string'){if(seenIds.has(v.id))issue('KEYFRAME_DUPLICATE',path+'.id','Every frame needs its own stable ID.');seenIds.add(v.id);}
  if(!['start','intermediate','end','custom'].includes(String(v.role)))issue('KEYFRAME_SHAPE',path+'.role','Choose a supported frame role.');
  if(v.role==='start'||v.role==='end'){if(seenRoles.has(v.role))issue('KEYFRAME_DUPLICATE',path+'.role','Use at most one Start and End role.');seenRoles.add(v.role);if(v.role==='start'&&index!==0||v.role==='end'&&index!==frames.length-1)issue('KEYFRAME_ORDER',path+'.role','Place Start first and End last, or change the role explicitly.',true);}
  if(v.visualInstructions!==undefined)text(v.visualInstructions,L.instructions,path+'.visualInstructions');
  const duration=source.settings.durationSeconds,known=typeof duration==='number'&&Number.isFinite(duration)&&duration>0;
  let time:number|undefined;
  if(v.relativePosition!==undefined){if(typeof v.relativePosition!=='number'||!Number.isFinite(v.relativePosition)||v.relativePosition<0||v.relativePosition>1)issue('KEYFRAME_TIMING',path+'.relativePosition','Use a relative position between 0 and 1.');else time=known?v.relativePosition*duration:v.relativePosition;}
  if(v.timeSeconds!==undefined){if(v.relativePosition!==undefined)issue('KEYFRAME_TIMING',path,'Choose relative position or intended seconds, not both.');if(typeof v.timeSeconds!=='number'||!Number.isFinite(v.timeSeconds)||v.timeSeconds<0||known&&v.timeSeconds>duration)issue('KEYFRAME_TIMING',path+'.timeSeconds','Use a finite time within the shot duration.');else if(!known)issue('KEYFRAME_TIMING',path+'.timeSeconds','Set the shot duration before confirming absolute frame timing.',true);else time=v.timeSeconds;}
  if(time!==undefined){if(time<=previousTime)issue('KEYFRAME_TIMING',path,'Frame times must increase with the explicit order. Reorder does not retime frames.',true);previousTime=time;}
  const selected=new Set<string>();for(const [i,p]of list(v.participantRefs,8,path+'.participantRefs').entries()){const key=ref(p,`${path}.participantRefs[${i}]`);if(key){if(selected.has(key))issue('KEYFRAME_DUPLICATE',path+'.participantRefs','Select each exact participant once.');selected.add(key);if(sources.get(key)?.presence==='off_camera')issue('KEYFRAME_PRESENCE',path+'.participantRefs','Make an off-camera participant visible in the Recipe before staging them in an image.');}}
  const expressionKeys=new Set<string>();for(const [i,e]of (v.expressions===undefined?[]:list(v.expressions,8,path+'.expressions')).entries()){const at=`${path}.expressions[${i}]`;if(!shape(e,['participant','text'],['participant','text'],at))continue;const key=ref(e.participant,at+'.participant');text(e.text,L.expression,at+'.text');if(key){if(expressionKeys.has(key))issue('KEYFRAME_DUPLICATE',at,'Use one expression per exact participant.');expressionKeys.add(key);if(!selected.has(key))issue('KEYFRAME_PRESENCE',at,'Expressions apply only to selected visible participants.');}}
  const associationIds=list(v.referenceAssociationIds,2000,path+'.referenceAssociationIds'),seenReferences=new Set<string>();for(const [i,r]of associationIds.entries()){text(r,4096,`${path}.referenceAssociationIds[${i}]`,true);if(typeof r==='string'){if(seenReferences.has(r))issue('KEYFRAME_DUPLICATE',path+'.referenceAssociationIds','Select each reference association once.');seenReferences.add(r);if(!references.has(r))issue('KEYFRAME_REFERENCE',path+'.referenceAssociationIds','Select an existing frozen reference association; no dummy media is substituted.',true);}}
  if(v.composition!==undefined&&shape(v.composition,['instructions','cameraComposition'],[],path+'.composition')){if(v.composition.instructions!==undefined)text(v.composition.instructions,L.instructions,path+'.composition.instructions');if(v.composition.cameraComposition!==undefined&&!record(v.composition.cameraComposition))issue('KEYFRAME_SHAPE',path+'.composition.cameraComposition','Use a typed camera composition.');}
  let validInstant=false;
  if(v.instant===undefined)issue('KEYFRAME_INSTANT',path+'.instant','Choose an explicit Start/End state or author one frozen instant.',true);
  else if(record(v.instant)&&v.instant.kind==='linked_phase'&&shape(v.instant,['kind','phase'],['kind','phase'],path+'.instant')){
   if(v.instant.phase!=='start'&&v.instant.phase!=='end')issue('KEYFRAME_SHAPE',path+'.instant.phase','Choose Start or End.');
   else{validInstant=true;if(!source.blocking)issue('KEYFRAME_INSTANT',path+'.instant','This linked Blocking phase is unavailable. Author Blocking or choose a custom instant.',true);for(const key of selected){const track=source.blocking?.participants.find(p=>blockingParticipantKey(p.participant)===key);if(!track?.[v.instant.phase])issue('KEYFRAME_INSTANT',path+'.instant','This exact linked Blocking phase is unresolved. Author it or choose a custom instant.',true);}}
  }else if(record(v.instant)&&v.instant.kind==='custom'&&shape(v.instant,['kind','participants','props'],['kind','participants'],path+'.instant')){
   validInstant=true;const instantKeys=new Set<string>();
   for(const [i,p]of list(v.instant.participants,8,path+'.instant.participants').entries()){const at=`${path}.instant.participants[${i}]`;if(!shape(p,['participant','bindingToken','wardrobeBindingToken','phase'],['participant','bindingToken','phase'],at)){validInstant=false;continue;}const key=ref(p.participant,at+'.participant');text(p.bindingToken,4096,at+'.bindingToken');if(p.wardrobeBindingToken!==undefined)text(p.wardrobeBindingToken,4096,at+'.wardrobeBindingToken');if(key){if(instantKeys.has(key))issue('KEYFRAME_DUPLICATE',at,'Use one instant state per participant.');instantKeys.add(key);if(!selected.has(key))issue('KEYFRAME_PRESENCE',at,'Only selected on-camera participants may have frame staging.');}}
   for(const key of selected)if(!instantKeys.has(key))issue('KEYFRAME_INSTANT',path+'.instant.participants','Author or explicitly copy the selected participant’s instant state.',true);
   const props=new Set<string>();for(const [i,p]of (v.instant.props===undefined?[]:list(v.instant.props,16,path+'.instant.props')).entries()){const at=`${path}.instant.props[${i}]`;if(!shape(p,['propId','holder'],['propId','holder'],at)){validInstant=false;continue;}id(p.propId,at+'.propId');if(typeof p.propId==='string'){if(props.has(p.propId))issue('KEYFRAME_DUPLICATE',at,'Use one holder per prop.');props.add(p.propId);if(!source.blocking?.props.some(prop=>prop.id===p.propId))issue('KEYFRAME_REFERENCE',at,'Define this prop in Blocking before assigning its frame holder.',true);}}
  }else issue('KEYFRAME_SHAPE',path+'.instant','Use an explicit linked phase or typed custom instant.');
  if(validInstant){
   const instant=resolveKeyframeInstant(source,v as unknown as PlannedKeyframeV1);
   if(instant){for(const f of validateSceneBlocking(instant,{...source,authoringMode:undefined},targetPath!==undefined&&path!==targetPath?'planning':mode)){const code=f.code==='BLOCKING_BINDING'?'KEYFRAME_BINDING':f.code==='BLOCKING_REFERENCE'?'KEYFRAME_REFERENCE':f.code==='BLOCKING_PRESENCE'?'KEYFRAME_PRESENCE':'KEYFRAME_INSTANT';findings.push({...f,code,path:path+'.instant'+f.path.replace(/^blocking/,'')});}}
  }
 });
 return findings;
}
