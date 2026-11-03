import type {ComponentSnapshot} from '../types/domain';
import {BLOCKING_LIMITS as L,BLOCKING_LOCAL_ID_PATTERN,type BlockingFinding,type BlockingSource,type BlockingParticipantSource,type ParticipantRef} from '../types/blocking';
import {canonicalStringify} from './changeSetCanonical';
import {getActiveSceneSlots} from './shotTypeRules';

/** Opaque frozen-source comparison value; never an authorization or identity-text grant. */
export function blockingBindingToken(snapshot:ComponentSnapshot):string{
 return canonicalStringify([snapshot.sourceType,snapshot.sourceId,snapshot.sourceRevision,snapshot.identityRevision??null]);
}
export const blockingParticipantKey=(ref:ParticipantRef)=>ref.kind==='primary'?'primary':`ensemble:${ref.participantId}`;
export function blockingParticipantSources(source:BlockingSource):BlockingParticipantSource[]{
 if(source.ensemble)return source.ensemble.participants.map(p=>({ref:{kind:'ensemble',participantId:p.id},character:p.character,wardrobe:p.wardrobe,presence:p.presence}));
 const slots=getActiveSceneSlots(source);
 return slots.character?[{ref:{kind:'primary'},character:slots.character,wardrobe:slots.wardrobe,presence:'on_camera'}]:[];
}
type Obj=Record<string,unknown>;
const isRecord=(value:unknown):value is Obj=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const localId=(value:unknown):value is string=>typeof value==='string'&&new RegExp(BLOCKING_LOCAL_ID_PATTERN).test(value);
function plainJson(value:unknown,active=new Set<object>(),depth=0):boolean{
 if(value===null||typeof value==='string'||typeof value==='boolean')return true;
 if(typeof value==='number')return Number.isFinite(value);
 if(depth>64||typeof value!=='object'||active.has(value)||(!Array.isArray(value)&&!isRecord(value)))return false;
 active.add(value);
 try{
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Object.getOwnPropertySymbols(value).length)return false;
  const array=Array.isArray(value);
  if(array&&(Object.getPrototypeOf(value)!==Array.prototype||value.length>L.interactions))return false;
  if(array&&Array.from({length:value.length},(_,i)=>String(i)).some(key=>!Object.hasOwn(descriptors,key)))return false;
  return Object.entries(descriptors).every(([key,d])=>array&&key==='length'||(!d.get&&!d.set&&(!array&&d.value===undefined||plainJson(d.value,active,depth+1))));
 }finally{active.delete(value);}
}

/** Strict structure in both modes; unresolved authored relationships remain recoverable planning. */
export function validateSceneBlocking(value:unknown,source:BlockingSource,mode:'planning'|'assembly'):BlockingFinding[]{
 if(value===undefined)return [];
 const findings:BlockingFinding[]=[];
 const issue=(code:string,path:string,message:string,incomplete=false)=>findings.push({code,path,message,severity:incomplete&&mode==='planning'?'incomplete':'blocking'});
 const shape=(v:unknown,allowed:string[],path:string,required:string[]=[]):v is Obj=>{
  if(!isRecord(v)||Object.keys(v).some(key=>!allowed.includes(key))||required.some(key=>v[key]===undefined)){
   issue('BLOCKING_SHAPE',path,'Unsupported or incomplete blocking fields. Review Blocking.');return false;
  }return true;
 };
 const str=(v:unknown,max:number,path:string,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))issue('BLOCKING_SHAPE',path,`Use ${required?'nonblank ':''}text of at most ${max} characters.`);};
 const id=(v:unknown,path:string)=>{if(!localId(v))issue('BLOCKING_SHAPE',path,'Use a safe local ID of at most 64 characters.');};
 const choice=(v:unknown,values:string[],path:string)=>{if(typeof v!=='string'||!values.includes(v))issue('BLOCKING_SHAPE',path,'Choose a supported blocking value.');};
 const list=(v:unknown,max:number,path:string):unknown[]=>{if(!Array.isArray(v)||v.length>max){issue('BLOCKING_SHAPE',path,`Use at most ${max} entries.`);return [];}return v;};
 let json:string;
 try{if(!plainJson(value))throw Error();json=JSON.stringify(value);if(typeof json!=='string')throw Error();}catch{issue('BLOCKING_SHAPE','blocking','Use plain, bounded JSON values without hooks, accessors, cycles or oversized arrays.');return findings;}
 if(new TextEncoder().encode(json).length>L.bytes){issue('BLOCKING_BYTES','blocking','Blocking exceeds 64 KiB. Reduce the authored text or relationships.');return findings;}
 if(!shape(value,['version','space','landmarks','props','participants','camera'],'blocking',['version','landmarks','props','participants']))return findings;
 if(value.version!==1)issue('BLOCKING_SHAPE','blocking.version','Unsupported blocking version.');
 if(source.authoringMode==='direct_prompt')issue('BLOCKING_SHAPE','blocking','Use guided Recipe conversion before authoring blocking. The Direct Prompt is preserved.');
 const landmarks=list(value.landmarks,L.landmarks,'blocking.landmarks'),props=list(value.props,L.props,'blocking.props'),tracks=list(value.participants,L.participants,'blocking.participants');
 const ids=(items:unknown[],path:string)=>{
  const found=new Set<string>();items.forEach((v,i)=>{if(isRecord(v)){id(v.id,`${path}[${i}].id`);if(typeof v.id==='string'){if(found.has(v.id))issue('BLOCKING_DUPLICATE',`${path}[${i}].id`,'Duplicate local ID.');found.add(v.id);}}});return found;
 };
 const landmarkIds=ids(landmarks,'blocking.landmarks'),propIds=ids(props,'blocking.props');
 const sources=new Map(blockingParticipantSources(source).map(p=>[blockingParticipantKey(p.ref),p]));
 const activeSlots=getActiveSceneSlots(source);
 const reference=(v:unknown,path:string):BlockingParticipantSource|undefined=>{
  if(!isRecord(v)||!['primary','ensemble'].includes(String(v.kind))){issue('BLOCKING_SHAPE',path,'Choose an exact participant reference.');return;}
  if(!shape(v,v.kind==='primary'?['kind']:['kind','participantId'],path,v.kind==='primary'?['kind']:['kind','participantId']))return;
  if(v.kind==='ensemble')id(v.participantId,path+'.participantId');
  const resolved=sources.get(v.kind==='primary'?'primary':`ensemble:${v.participantId}`);
  if(!resolved)issue('BLOCKING_REFERENCE',path,'The participant is unresolved. Select or repair the exact Character binding in Blocking.',true);
  return resolved;
 };
 const landmark=(v:unknown,path:string)=>{id(v,path);if(typeof v==='string'&&!landmarkIds.has(v))issue('BLOCKING_REFERENCE',path,'Define or select the missing landmark in Blocking.',true);};
 const prop=(v:unknown,path:string)=>{id(v,path);if(typeof v==='string'&&!propIds.has(v))issue('BLOCKING_REFERENCE',path,'Define or select the missing prop in Blocking.',true);};
 const target=(v:unknown,path:string,allowProp=false)=>{
  if(!isRecord(v)){issue('BLOCKING_SHAPE',path,'Choose a typed target.');return;}
  if(v.kind==='participant'){if(shape(v,['kind','participant'],path,['kind','participant']))reference(v.participant,path+'.participant');}
  else if(v.kind==='landmark'){if(shape(v,['kind','landmarkId'],path,['kind','landmarkId']))landmark(v.landmarkId,path+'.landmarkId');}
  else if(v.kind==='camera')shape(v,['kind'],path,['kind']);
  else if(v.kind==='prop'&&allowProp){if(shape(v,['kind','propId'],path,['kind','propId']))prop(v.propId,path+'.propId');}
  else issue('BLOCKING_SHAPE',path,'Unsupported target type.');
 };
 const zone=(v:unknown,path:string)=>choice(v,['left','center','right','unspecified'],path);
 const depth=(v:unknown,path:string)=>choice(v,['foreground','midground','background','unspecified'],path);
 const direction=(v:unknown,path:string)=>{
  if(!isRecord(v)){issue('BLOCKING_SHAPE',path,'Choose a direction or exact target.');return;}
  if(v.kind==='target'){if(shape(v,['kind','target'],path,['kind','target']))target(v.target,path+'.target');}
  else if(v.kind==='screen'){if(shape(v,['kind','direction'],path,['kind','direction']))choice(v.direction,['toward_camera','away_from_camera','screen_left','screen_right','toward_left','toward_right','away_left','away_right'],path+'.direction');}
  else issue('BLOCKING_SHAPE',path,'Unsupported direction type.');
 };
 const space=isRecord(value.space)?value.space:undefined;
 if(value.space!==undefined&&shape(value.space,['id','environmentBindingToken','originLandmarkId','forwardLandmarkId'],'blocking.space',['id'])){
  const s=value.space;id(s.id,'blocking.space.id');
  if(s.environmentBindingToken!==undefined)str(s.environmentBindingToken,4096,'blocking.space.environmentBindingToken');
  if((activeSlots.environment&&s.environmentBindingToken!==blockingBindingToken(activeSlots.environment))||(!activeSlots.environment&&s.environmentBindingToken!==undefined))issue('BLOCKING_BINDING','blocking.space.environmentBindingToken','The Environment binding changed. Review the spatial setup explicitly.',true);
  for(const key of ['originLandmarkId','forwardLandmarkId'])if(s[key]!==undefined)landmark(s[key],'blocking.space.'+key);
  if((s.originLandmarkId===undefined)!==(s.forwardLandmarkId===undefined))issue('BLOCKING_REFERENCE','blocking.space','Declare both origin and forward landmarks for scene-relative directions.',true);
  if(s.originLandmarkId!==undefined&&s.originLandmarkId===s.forwardLandmarkId)issue('BLOCKING_REFERENCE','blocking.space','Origin and forward landmarks must differ.');
 }
 landmarks.forEach((v,i)=>{
  const path=`blocking.landmarks[${i}]`;if(!shape(v,['id','label','description','screen'],path,['id','label']))return;
  str(v.label,L.label,path+'.label',true);if(v.description!==undefined)str(v.description,L.description,path+'.description');
  if(v.screen!==undefined&&shape(v.screen,['zone','depth'],path+'.screen')){if(v.screen.zone!==undefined)zone(v.screen.zone,path+'.screen.zone');if(v.screen.depth!==undefined)depth(v.screen.depth,path+'.screen.depth');}
 });
 const holder=(v:unknown,path:string)=>{
  if(!isRecord(v)){issue('BLOCKING_SHAPE',path,'Choose a prop holder.');return;}
  if(v.kind==='participant'){if(shape(v,['kind','participant'],path,['kind','participant']))reference(v.participant,path+'.participant');}
  else if(v.kind==='shared'&&shape(v,['kind','participants'],path,['kind','participants'])){
   const members=list(v.participants,L.participants,path+'.participants');if(members.length<2)issue('BLOCKING_SHAPE',path,'Shared holding requires at least two distinct participants.');
   const seen=new Set<string>();members.forEach((p,i)=>{reference(p,`${path}.participants[${i}]`);const key=canonicalStringify(p);if(seen.has(key))issue('BLOCKING_DUPLICATE',path,'Shared holders must be distinct.');seen.add(key);});
  }else if(v.kind==='landmark'){if(shape(v,['kind','landmarkId'],path,['kind','landmarkId']))landmark(v.landmarkId,path+'.landmarkId');}
  else if(['unheld','unspecified'].includes(String(v.kind)))shape(v,['kind'],path,['kind']);
  else if(v.kind!=='shared')issue('BLOCKING_SHAPE',path,'Unsupported prop holder.');
 };
 props.forEach((v,i)=>{const path=`blocking.props[${i}]`;if(!shape(v,['id','label','description','startHolder','endHolder'],path,['id','label']))return;str(v.label,L.label,path+'.label',true);if(v.description!==undefined)str(v.description,L.description,path+'.description');for(const key of ['startHolder','endHolder'])if(v[key]!==undefined)holder(v[key],path+'.'+key);});
 const phase=(v:unknown,path:string)=>{
  if(!shape(v,['visibility','zone','depth','scenePlacement','bodyDirection','headDirection','eyeline','pose'],path))return;
  if(v.visibility!==undefined)choice(v.visibility,['on_screen','out_of_frame','unspecified'],path+'.visibility');
  if(v.zone!==undefined)zone(v.zone,path+'.zone');if(v.depth!==undefined)depth(v.depth,path+'.depth');if(v.pose!==undefined)str(v.pose,L.text,path+'.pose');
  for(const key of ['bodyDirection','headDirection'])if(v[key]!==undefined)direction(v[key],path+'.'+key);
  if(v.eyeline!==undefined)target(v.eyeline,path+'.eyeline');
  if(v.scenePlacement!==undefined&&shape(v.scenePlacement,['landmarkId','relation'],path+'.scenePlacement',['landmarkId','relation'])){
   landmark(v.scenePlacement.landmarkId,path+'.scenePlacement.landmarkId');choice(v.scenePlacement.relation,['at','near','left_of','right_of','in_front_of','behind'],path+'.scenePlacement.relation');
   if(['left_of','right_of'].includes(String(v.scenePlacement.relation))&&(!space?.originLandmarkId||!space.forwardLandmarkId))issue('BLOCKING_REFERENCE',path+'.scenePlacement','Declare the spatial origin and forward direction before using scene-relative left/right.',true);
  }
 };
 const trackIds=new Set<string>(),interactionIds=new Set<string>();let interactionCount=0;
 tracks.forEach((v,i)=>{
  const path=`blocking.participants[${i}]`;if(!shape(v,['participant','bindingToken','wardrobeBindingToken','start','action','end'],path,['participant','bindingToken']))return;
  const p=reference(v.participant,path+'.participant'),key=canonicalStringify(v.participant);
  if(trackIds.has(key))issue('BLOCKING_DUPLICATE',path,'Only one track is allowed per exact participant.');trackIds.add(key);
  str(v.bindingToken,4096,path+'.bindingToken');if(v.wardrobeBindingToken!==undefined)str(v.wardrobeBindingToken,4096,path+'.wardrobeBindingToken');
  if(p){
   if(v.bindingToken!==blockingBindingToken(p.character)||(p.wardrobe?v.wardrobeBindingToken!==blockingBindingToken(p.wardrobe):v.wardrobeBindingToken!==undefined))issue('BLOCKING_BINDING',path,'The frozen Character or Outfit binding changed. Review and explicitly rebind the track.',true);
   if(p.presence==='off_camera'&&[v.start,v.action,v.end].some(x=>x!==undefined))issue('BLOCKING_PRESENCE',path,'An off-camera participant can be a target but cannot have visible staging.');
  }
  for(const name of ['start','end'])if(v[name]!==undefined)phase(v[name],path+'.'+name);
  if(v.action!==undefined&&shape(v.action,['kind','text','waypointLandmarkIds','interactions'],path+'.action',['kind'])){
   const a=v.action;choice(a.kind,['hold','move','enter','exit','custom','unspecified'],path+'.action.kind');if(a.text!==undefined)str(a.text,L.text,path+'.action.text');
   if(a.waypointLandmarkIds!==undefined)list(a.waypointLandmarkIds,L.waypoints,path+'.action.waypointLandmarkIds').forEach((id,i)=>landmark(id,`${path}.action.waypointLandmarkIds[${i}]`));
   if(a.kind==='enter'||a.kind==='exit'){
    const start=isRecord(v.start)?v.start.visibility:undefined,end=isRecord(v.end)?v.end.visibility:undefined;
    const expected=a.kind==='enter'?['out_of_frame','on_screen']:['on_screen','out_of_frame'];
    if(start===undefined||end===undefined||start==='unspecified'||end==='unspecified')issue('BLOCKING_VISIBILITY',path,'Complete Start and End visibility for the explicit entrance/exit.',true);
    else if(start!==expected[0]||end!==expected[1])issue('BLOCKING_VISIBILITY',path,'Entrance/exit visibility contradicts its explicit Start and End.');
   }
   if(a.interactions!==undefined)list(a.interactions,L.interactions,path+'.action.interactions').forEach((interaction,j)=>{
    interactionCount++;const at=`${path}.action.interactions[${j}]`;
    if(!isRecord(interaction)){issue('BLOCKING_SHAPE',at,'Choose a typed interaction.');return;}
    id(interaction.id,at+'.id');if(typeof interaction.id==='string'){if(interactionIds.has(interaction.id))issue('BLOCKING_DUPLICATE',at,'Duplicate interaction ID.');interactionIds.add(interaction.id);}
    const kind=interaction.kind;
    if(kind==='transfer_prop'){
     if(!shape(interaction,['id','kind','propId','from','to'],at,['id','kind','propId','from','to']))return;
     prop(interaction.propId,at+'.propId');reference(interaction.from,at+'.from');reference(interaction.to,at+'.to');
     if(canonicalStringify(interaction.from)===canonicalStringify(interaction.to))issue('BLOCKING_SELF_INTERACTION',at,'A prop transfer requires distinct participants.');
    }else if(kind==='custom'){
     if(!shape(interaction,['id','kind','description','target'],at,['id','kind','description']))return;str(interaction.description,L.description,at+'.description',true);if(interaction.target!==undefined)target(interaction.target,at+'.target',true);
    }else if(['approach','follow','face','touch','gesture_to','avoid'].includes(String(kind))){
     if(!shape(interaction,['id','kind','target'],at,['id','kind','target']))return;target(interaction.target,at+'.target',true);
     const t=isRecord(interaction.target)?interaction.target:undefined;
     const allowed:Record<string,string[]>={approach:['participant','landmark'],follow:['participant'],face:['participant','landmark','camera'],touch:['participant','landmark','prop'],gesture_to:['participant','landmark','camera','prop'],avoid:['participant','landmark']};
     if(!t||!allowed[String(kind)].includes(String(t.kind)))issue('BLOCKING_SHAPE',at,'This interaction requires a supported target type.');
     if(kind==='follow'&&t?.kind==='participant'&&t.participant!==undefined&&canonicalStringify(t.participant)===key)issue('BLOCKING_SELF_INTERACTION',at,'A participant cannot follow itself.');
    }else issue('BLOCKING_SHAPE',at,'Unsupported interaction type.');
   });
  }
 });
 if(interactionCount>L.interactions)issue('BLOCKING_SHAPE','blocking.participants','Use at most 32 interactions across all participants.');
 if(value.camera!==undefined&&shape(value.camera,['direction','axis'],'blocking.camera')){
  const c=value.camera;if(c.direction!==undefined)target(c.direction,'blocking.camera.direction');
  if(c.axis!==undefined&&shape(c.axis,['id','from','to','side'],'blocking.camera.axis',['id','from','to','side'])){
   id(c.axis.id,'blocking.camera.axis.id');target(c.axis.from,'blocking.camera.axis.from');target(c.axis.to,'blocking.camera.axis.to');choice(c.axis.side,['A','B','on_axis','unspecified'],'blocking.camera.axis.side');
   if(canonicalStringify(c.axis.from)===canonicalStringify(c.axis.to))issue('BLOCKING_AXIS','blocking.camera.axis','The camera axis requires distinct ordered endpoints.');
  }
 }
 return findings;
}
