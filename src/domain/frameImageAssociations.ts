import type {Collection,MediaAsset} from '../types/domain';
import type {FrameImageIdentity,FrameImageEvent,FrameProductionV1,FramePromptProof,FrameMediaProof} from '../types/frameProduction';
import {KEYFRAME_LIMITS} from '../types/keyframes';
import {canonicalStringify} from './changeSetCanonical';
import {assertPlainKeyframeJson,isKeyframeLocalId} from './keyframeValidation';

export const frameTargetKey=(target:FrameImageIdentity)=>JSON.stringify([target.shotId,target.sceneId,target.frameId]);
export const emptyFrameProduction=():FrameProductionV1=>({version:1,revision:0,imageEvents:[],active:[],videoReviews:[]});
type Row=Record<string,unknown>;
function shape(value:unknown,keys:string[],required:string[]=keys):asserts value is Row{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key))||required.some(key=>!Object.hasOwn(value,key)))throw Error('Invalid or unsupported frame-production metadata.');}
const id=(value:unknown)=>typeof value==='string'&&!!value.trim()&&value.length<=200;
const sha=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const natural=(value:unknown,minimum=0)=>Number.isSafeInteger(value)&&(value as number)>=minimum;
const date=(value:unknown)=>typeof value==='string'&&value.length<=100&&Number.isFinite(Date.parse(value));
export function validateFrameImageProvenance(value:unknown):void{shape(value,['kind','sourceEventId'],['kind']);if(!['existing_media','external_upload','carry_over','reuse_changed_basis','legacy_adoption'].includes(String(value.kind))||value.sourceEventId!==undefined&&!id(value.sourceEventId))throw Error('Invalid frame image provenance.');}
export function validateFrameProduction(value:unknown):void{
 if(value===undefined)return;
 assertPlainKeyframeJson(value,KEYFRAME_LIMITS.historyBytes,128000);shape(value,['version','revision','imageEvents','active','videoReviews']);
 if(value.version!==1||!natural(value.revision)||!Array.isArray(value.imageEvents)||!Array.isArray(value.active)||!Array.isArray(value.videoReviews)||value.active.length>2000)throw Error('Invalid frame-production version or arrays.');
 const production=value as unknown as FrameProductionV1;validateFrameProductionBudget(production);
 if(production.revision<production.imageEvents.length+production.videoReviews.length)throw Error('Invalid frame-production revision.');
 const eventIds=new Set<string>(),last=new Map<string,FrameImageEvent>();
 for(const event of production.imageEvents){
  shape(event,['id','revision','kind','shotId','sceneId','frameId','mediaId','sha256','promptDigest','visualDigest','bindingDigest','referenceDigest','provenance','reviewStatus','note','createdAt'],['id','revision','kind','shotId','sceneId','frameId','promptDigest','visualDigest','bindingDigest','referenceDigest','provenance','reviewStatus','createdAt']);
  if(!id(event.id)||eventIds.has(event.id)||!id(event.shotId)||!id(event.sceneId)||!isKeyframeLocalId(event.frameId)||!['linked','cleared','reviewed','retired'].includes(String(event.kind))||!natural(event.revision,1)||!date(event.createdAt))throw Error('Invalid or duplicate frame image event.');
  for(const key of ['promptDigest','visualDigest','bindingDigest','referenceDigest'])if(!sha(event[key]))throw Error('Invalid frame prompt basis digest.');
  if((event.mediaId===undefined)!==(event.sha256===undefined)||event.mediaId!==undefined&&(!id(event.mediaId)||!sha(event.sha256))||['linked','reviewed'].includes(String(event.kind))&&event.mediaId===undefined||event.kind==='cleared'&&event.mediaId!==undefined)throw Error('Invalid frame image media/hash pair.');
  if(!['needs_review','approved','needs_changes'].includes(String(event.reviewStatus))||event.kind!=='reviewed'&&event.reviewStatus!=='needs_review'||event.note!==undefined&&(typeof event.note!=='string'||event.note.length>1000))throw Error('Invalid human frame image review.');
  validateFrameImageProvenance(event.provenance);eventIds.add(event.id as string);const row=event as unknown as FrameImageEvent,key=frameTargetKey(row);if(row.revision!==(last.get(key)?.revision??0)+1)throw Error('Frame image revisions must preserve their exact event history.');last.set(key,row);
 }
 const active=new Set<string>();
 for(const pointer of production.active){shape(pointer,['shotId','sceneId','frameId','eventId']);const key=frameTargetKey(pointer as unknown as FrameImageIdentity),event=last.get(key);if(active.has(key)||!event||event.id!==pointer.eventId||!['linked','reviewed'].includes(event.kind))throw Error('Active frame image pointer does not match its exact latest event.');active.add(key);}
 for(const event of production.videoReviews){
  shape(event,['id','shotId','sceneId','kind','basis','createdAt','note'],['id','shotId','sceneId','kind','basis','createdAt']);
  if(!id(event.id)||eventIds.has(event.id)||!id(event.shotId)||!id(event.sceneId)||!['requested','reviewed'].includes(String(event.kind))||!date(event.createdAt)||event.note!==undefined&&(typeof event.note!=='string'||event.note.length>1000))throw Error('Invalid video correspondence review event.');
  shape(event.basis,['sourceSceneId','planDigest','videoInputDigest','videoTextDigests'],['planDigest','videoInputDigest','videoTextDigests']);if(event.basis.sourceSceneId!==undefined&&!id(event.basis.sourceSceneId)||!sha(event.basis.planDigest)||!sha(event.basis.videoInputDigest))throw Error('Invalid exact video review basis.');
  shape(event.basis.videoTextDigests,['full','structured','compact'],['full']);for(const hash of Object.values(event.basis.videoTextDigests))if(!sha(hash))throw Error('Invalid video text digest.');eventIds.add(event.id as string);
 }
}
export function getFrameImageEvent(production:FrameProductionV1|undefined,target:FrameImageIdentity):FrameImageEvent|undefined{return production?[...production.imageEvents].reverse().find(e=>frameTargetKey(e)===frameTargetKey(target)):undefined;}
export function getActiveFrameImage(production:FrameProductionV1|undefined,target:FrameImageIdentity):FrameImageEvent|undefined{const pointer=production?.active.find(p=>frameTargetKey(p)===frameTargetKey(target));return pointer?production?.imageEvents.find(e=>e.id===pointer.eventId):undefined;}
export function validateFrameProductionBudget(production:FrameProductionV1):void{
 if(production.imageEvents.length+production.videoReviews.length>KEYFRAME_LIMITS.historyEvents)throw Error('Frame production history exceeds 2,000 events. Export a backup before reorganizing this project.');
 if(new TextEncoder().encode(JSON.stringify(production)).byteLength>KEYFRAME_LIMITS.historyBytes)throw Error('Frame production metadata exceeds 4 MiB. No history was truncated.');
}
export function frameMediaSignature(media:MediaAsset):string{const {blob,posterBlob,...metadata}=media;return canonicalStringify({...metadata,blobSize:blob.size,blobType:blob.type,posterSize:posterBlob?.size,posterType:posterBlob?.type});}
/** Pure append-only association planning; approval is never inferred from an image. */
export function planFrameImageAssociation(input:{collection:Collection;target:FrameImageIdentity;proof:FramePromptProof;media?:MediaAsset;mediaProof?:FrameMediaProof;expectedRevision:number;eventId:string;now:string;kind:'link'|'clear';provenance?:FrameImageEvent['provenance']}):{collection:Collection;event:FrameImageEvent}{
 const {proof,media,mediaProof}=input,target:FrameImageIdentity={shotId:input.target.shotId,sceneId:input.target.sceneId,frameId:input.target.frameId},production=structuredClone(input.collection.project?.frameProduction??emptyFrameProduction());validateFrameProduction(production);
 const previous=getFrameImageEvent(production,target);
 if((previous?.revision??0)!==input.expectedRevision)throw Error('Frame image association changed. Reopen and review this exact take/frame.');
 if(input.kind==='link'&&(!media||!mediaProof||mediaProof.signature!==frameMediaSignature(media)))throw Error('The selected image is missing or changed. Select an existing validated image again.');
 if(production.imageEvents.some(e=>e.id===input.eventId)||production.videoReviews.some(e=>e.id===input.eventId))throw Error('Frame event ID already exists.');
 const related=media?[...production.imageEvents].reverse().find(e=>e.mediaId===media.id&&e.promptDigest!==proof.promptDigest):undefined;
 const event:FrameImageEvent={...target,id:input.eventId,revision:(previous?.revision??0)+1,kind:input.kind==='link'?'linked':'cleared',...proof,...(media&&input.kind==='link'?{mediaId:media.id,sha256:mediaProof!.sha256}:{}),provenance:input.provenance??(related?{kind:'reuse_changed_basis',sourceEventId:related.id}:{kind:'existing_media'}),reviewStatus:'needs_review',createdAt:input.now};
 production.imageEvents.push(event);production.revision++;production.active=production.active.filter(p=>frameTargetKey(p)!==frameTargetKey(target));if(input.kind==='link')production.active.push({...target,eventId:event.id});validateFrameProduction(production);
 return{collection:{...input.collection,project:{...input.collection.project!,frameProduction:production}},event};
}
export function planFrameImageCarryOver(input:{collection:Collection;source:FrameImageEvent;target:FrameImageIdentity;proof:FramePromptProof;media?:MediaAsset;mediaProof?:FrameMediaProof;eventId:string;now:string}):Collection{
 const {source,proof}=input,current=getActiveFrameImage(input.collection.project?.frameProduction,source);
 if(current?.id!==source.id||source.frameId!==input.target.frameId||source.promptDigest!==proof.promptDigest||source.visualDigest!==proof.visualDigest||source.bindingDigest!==proof.bindingDigest||source.referenceDigest!==proof.referenceDigest||!input.mediaProof||source.sha256!==input.mediaProof.sha256)throw Error('Carry-over requires the current unchanged stable frame, exact prompt, visual bindings, references and original file hash. Choose an explicit new image association for a changed basis.');
 return planFrameImageAssociation({...input,kind:'link',expectedRevision:0,provenance:{kind:'carry_over',sourceEventId:source.id}}).collection;
}
export function planFrameImageReview(input:{collection:Collection;target:FrameImageIdentity;proof:FramePromptProof;media?:MediaAsset;mediaProof?:FrameMediaProof;expectedRevision:number;eventId:string;now:string;reviewStatus:'approved'|'needs_changes';note?:string}):{collection:Collection;event:FrameImageEvent}{
 const previous=getActiveFrameImage(input.collection.project?.frameProduction,input.target);
 if(!previous||previous.revision!==input.expectedRevision||!input.media||!input.mediaProof||previous.mediaId!==input.media.id||previous.sha256!==input.mediaProof.sha256||frameMediaSignature(input.media)!==input.mediaProof.signature||previous.promptDigest!==input.proof.promptDigest||previous.visualDigest!==input.proof.visualDigest||previous.bindingDigest!==input.proof.bindingDigest||previous.referenceDigest!==input.proof.referenceDigest)throw Error('The image, exact prompt basis or association changed. Reopen the image and review it again.');
 if(!['approved','needs_changes'].includes(input.reviewStatus)||input.note!==undefined&&(typeof input.note!=='string'||input.note.length>1000))throw Error('Choose a valid human image review and a note of at most 1,000 characters.');
 const production=structuredClone(input.collection.project!.frameProduction!),event:FrameImageEvent={...structuredClone(previous),id:input.eventId,revision:previous.revision+1,kind:'reviewed',reviewStatus:input.reviewStatus,createdAt:input.now,...(input.note!==undefined?{note:input.note}:{})};
 if(production.imageEvents.some(e=>e.id===event.id))throw Error('Frame event ID already exists.');
 production.imageEvents.push(event);production.active=production.active.map(pointer=>frameTargetKey(pointer)===frameTargetKey(input.target)?{...pointer,eventId:event.id}:pointer);production.revision++;validateFrameProduction(production);
 return{collection:{...input.collection,project:{...input.collection.project!,frameProduction:production}},event};
}
/** Explicit target removal retires pointers only; captured history and file IDs remain. */
export function retireUnavailableFrameImages(collection:Collection):Collection{
 const production=collection.project?.frameProduction;if(!production?.active.length)return collection;
 const active=production.active.filter(pointer=>collection.project!.shots.some(shot=>shot.id===pointer.shotId&&shot.takeSceneIds.includes(pointer.sceneId)));
 if(active.length===production.active.length)return collection;
 return{...collection,project:{...collection.project!,frameProduction:{...production,revision:production.revision+1,active}}};
}
