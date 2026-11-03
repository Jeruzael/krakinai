import type {Collection,MediaAsset,SavedScene,SceneDraft} from '../types/domain';
import type {FrameImageTarget,FrameImageCommand} from '../types/frameProduction';
import {getAllSnapshot,openDatabase,generateId} from './db';
import {withStableLibraryMedia} from './mediaPreparationLock';
import {prepareStoredFrameImage} from '../domain/frameImageMedia';
import {getActiveFrameImage,planFrameImageAssociation,planFrameImageReview,frameMediaSignature,emptyFrameProduction,validateFrameProduction} from '../domain/frameImageAssociations';
import {prepareKeyframeSources} from '../domain/keyframeChangeSet';
import {canonicalStringify,changeSetDigest} from '../domain/changeSetCanonical';
import {validateProject} from '../domain/phase5ProjectValidation';
import {validateMediaCandidate} from '../domain/validation';
import {prepareKeyframeBasis} from '../domain/keyframeDependencies';
import {prepareFramePromptProofs} from '../domain/frameAuthoring';
import {validatePhase4Record} from '../domain/phase4Validation';
import type {FrameVideoReviewBasis} from '../types/keyframes';
import {isFrameVideoReviewCurrent} from '../domain/frameVideoReview';
import {assertPlainKeyframeJson} from '../domain/keyframeValidation';

const request=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const done=(tx:IDBTransaction)=>new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error??Error('Frame image transaction aborted.'));});
const abort=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Frame image operation cancelled.','AbortError');};
function assertTarget(target:FrameImageTarget,collection:Collection|undefined,scene:SavedScene|undefined):asserts collection is Collection{
 if(!collection?.project||collection.id!==target.collectionId||collection.project.revision!==target.expectedProjectRevision)throw Error('Project revision changed. Reopen this exact frame target.');
 const shot=collection.project.shots.find(s=>s.id===target.shotId);
 if(!scene||scene.id!==target.sceneId||!shot?.takeSceneIds.includes(scene.id))throw Error('The exact scene is not a take of the target project shot.');
 if(scene.revision!==target.expectedSceneRevision)throw Error('Saved scene revision changed. Reopen its frame.');
 if(scene.authoringMode==='direct_prompt'||!scene.keyframePlan?.frames.some(frame=>frame.id===target.frameId))throw Error('Select a planned frame on a saved Recipe take. Complete guided Recipe conversion first.');
 if(!scene.imagePromptSnapshots?.[target.frameId]||scene.imagePromptSnapshots[target.frameId].visualDigest!==target.expectedVisualDigest)throw Error('The exact canonical frame prompt is unavailable or changed. Assemble it on a new Recipe take first.');
}

/** Shared local metadata writer. Uploaded media and its association commit together. */
async function execute(command:FrameImageCommand,upload?:{file:File;signal?:AbortSignal}):Promise<Collection>{
 return withStableLibraryMedia(async()=>{
  abort(upload?.signal);const snapshot=await getAllSnapshot(),target=command.target,collection=snapshot.collections.find(c=>c.id===target.collectionId),scene=snapshot.scenes.find(s=>s.id===target.sceneId);
  assertTarget(target,collection,scene);
  const mediaMap=new Map(snapshot.media.map(file=>[file.id,file])),source=await prepareKeyframeSources([scene!],mediaMap),proof=source.get(scene!.id)!.frames[target.frameId];
  if(!proof||proof.visualDigest!==target.expectedVisualDigest)throw Error('Current source media or image-prompt inputs changed. Save a newly reviewed Recipe take before assigning an image.');
  const previous=getActiveFrameImage(collection.project!.frameProduction,target),now=new Date().toISOString();let media:MediaAsset|undefined;
  if(upload){media={id:generateId('media'),filename:upload.file.name,safeFilename:upload.file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,80)||'frame_image',mimeType:upload.file.type,byteSize:upload.file.size,blob:upload.file,createdAt:now};}
  else if(command.kind==='link')media=mediaMap.get(command.mediaId);
  else if(command.kind==='review'&&previous?.mediaId)media=mediaMap.get(previous.mediaId);
  if(command.kind!=='clear'&&!media)throw Error('The original image is missing. Upload or select an existing supported raster image.');
  let mediaProof=media?await prepareStoredFrameImage(media,{signal:upload?.signal}):undefined;
  if(upload&&media&&mediaProof){media={...media,width:mediaProof.width,height:mediaProof.height};mediaProof={...mediaProof,signature:frameMediaSignature(media)};}
  if(command.kind==='link'&&!upload&&command.provenance){
   const shot=collection.project!.shots.find(s=>s.id===target.shotId)!;
   if(command.provenance.kind!=='existing_media'&&command.provenance.kind!=='legacy_adoption')throw Error('Carry-over and upload provenance require their dedicated reviewed workflows.');
   if(command.provenance.kind==='legacy_adoption'&&![shot.firstFrameMediaId,shot.lastFrameMediaId].includes(command.mediaId))throw Error('Choose the actual legacy First/Last image for explicit adoption. Legacy fields are unchanged.');
  }
  abort(upload?.signal);
  const db=await openDatabase(),tx=db.transaction(['collections','scenes','media'],'readwrite'),completion=done(tx);
  const cancel=()=>{try{tx.abort();}catch{}};upload?.signal?.addEventListener('abort',cancel,{once:true});
  try{
   const [current,currentScene,scenes,currentMedia,allMedia]=await Promise.all([
    request<Collection|undefined>(tx.objectStore('collections').get(target.collectionId)),request<SavedScene|undefined>(tx.objectStore('scenes').get(target.sceneId)),request<SavedScene[]>(tx.objectStore('scenes').getAll()),media&&!upload?request<MediaAsset|undefined>(tx.objectStore('media').get(media.id)):Promise.resolve(media),upload?request<MediaAsset[]>(tx.objectStore('media').getAll()):Promise.resolve([] as MediaAsset[]),
   ]);
   assertTarget(target,current,currentScene);
   if(canonicalStringify(current)!==canonicalStringify(collection)||canonicalStringify(currentScene)!==canonicalStringify(scene))throw Error('The exact source or image associations changed during preparation. Review again.');
   if(upload&&media){const checked=validateMediaCandidate({name:media.filename,type:media.mimeType,size:media.byteSize,existingCount:0,currentTotalBytes:allMedia.reduce((total,row)=>total+row.byteSize+(row.posterBlob?.size??0),0)});if(!checked.valid)throw Error(checked.error);}
   const identity={collection:current,target,proof,media:currentMedia,mediaProof,expectedRevision:target.expectedAssociationRevision,eventId:generateId('frame_event'),now};
   const result=command.kind==='review'?planFrameImageReview({...identity,reviewStatus:command.reviewStatus,note:command.note}):planFrameImageAssociation({...identity,kind:command.kind,...(upload?{provenance:{kind:'external_upload' as const}}:command.kind==='link'&&command.provenance?{provenance:command.provenance}:{})});
   const updated:Collection={...result.collection,project:{...result.collection.project!,revision:current.project!.revision+1},updatedAt:now},error=validateProject(updated,scenes);if(error)throw Error(error);
   abort(upload?.signal);if(upload&&media)tx.objectStore('media').add(media);tx.objectStore('collections').put(updated);await completion;return updated;
  }catch(error){try{tx.abort();}catch{}await completion.catch(()=>undefined);throw error;}finally{upload?.signal?.removeEventListener('abort',cancel);}
 },true);
}
export async function uploadFrameImage(input:{target:FrameImageTarget;file:File;signal?:AbortSignal}):Promise<Collection>{return execute({kind:'link',target:input.target,mediaId:''},input);}
export async function applyFrameImageCommand(command:FrameImageCommand):Promise<Collection>{return execute(command);}
/** Browser human-review path only; the MCP contract exposes request_review, not this action. */
export async function recordFrameVideoReview(input:{collectionId:string;expectedProjectRevision:number;shotId:string;sceneId:string;expectedSceneRevision:number;expectedBasis:FrameVideoReviewBasis;note?:string}):Promise<Collection>{
 return withStableLibraryMedia(async()=>{
  assertPlainKeyframeJson(input,16*1024);if(input.note!==undefined&&(typeof input.note!=='string'||input.note.length>1000))throw Error('Video review notes are limited to 1,000 characters.');
  const snapshot=await getAllSnapshot(),collection=snapshot.collections.find(c=>c.id===input.collectionId),scene=snapshot.scenes.find(s=>s.id===input.sceneId);
  if(!collection?.project||collection.project.revision!==input.expectedProjectRevision||!collection.project.shots.some(shot=>shot.id===input.shotId&&shot.takeSceneIds.includes(input.sceneId))||!scene?.keyframePlan||scene.authoringMode==='direct_prompt'||scene.revision!==input.expectedSceneRevision)throw Error('The exact project/shot/take revision changed. Review its current video basis again.');
  const basis=(await prepareKeyframeSources([scene],new Map(snapshot.media.map(m=>[m.id,m])))).get(scene.id)!.videoBasis!;
  if(!isFrameVideoReviewCurrent(input.expectedBasis,basis))throw Error('The exact frame plan, references or effective video text basis changed. Review again without replacing the saved prompt.');
  const db=await openDatabase(),tx=db.transaction(['collections','scenes'],'readwrite'),completion=done(tx);
  try{
   const [current,currentScene]=await Promise.all([request<Collection|undefined>(tx.objectStore('collections').get(collection.id)),request<SavedScene|undefined>(tx.objectStore('scenes').get(scene.id))]);
   if(canonicalStringify(current)!==canonicalStringify(collection)||canonicalStringify(currentScene)!==canonicalStringify(scene))throw Error('The video review source changed during preparation. Review again.');
   const production=structuredClone(collection.project.frameProduction??emptyFrameProduction()),now=new Date().toISOString();production.videoReviews.push({id:generateId('video_review'),shotId:input.shotId,sceneId:scene.id,kind:'reviewed',basis,createdAt:now,...(input.note!==undefined?{note:input.note}:{})});production.revision++;validateFrameProduction(production);
   const updated:Collection={...collection,project:{...collection.project,revision:collection.project.revision+1,frameProduction:production},updatedAt:now};tx.objectStore('collections').put(updated);await completion;return updated;
  }catch(error){try{tx.abort();}catch{}await completion.catch(()=>undefined);throw error;}
 },true);
}
export async function uploadDraftFrameImage(input:{draftId:string;expectedInputRevision:number;frameId:string;expectedVisualDigest:string;file:File;signal?:AbortSignal}):Promise<SceneDraft>{
 return withStableLibraryMedia(async()=>{
  abort(input.signal);const snapshot=await getAllSnapshot(),draft=snapshot.drafts.find(row=>row.id===input.draftId);
  if(!draft||draft.inputRevision!==input.expectedInputRevision||!draft.keyframePlan?.frames.some(frame=>frame.id===input.frameId))throw Error('The exact draft/frame revision changed. Save or reopen the current planning draft before uploading.');
  const basis=await prepareKeyframeBasis(draft,new Map(snapshot.media.map(file=>[file.id,file]))),frame=basis.frames[input.frameId];if(frame.visualDigest!==input.expectedVisualDigest)throw Error('The current draft visual basis changed. Review this exact frame again.');
  const prompts=await prepareFramePromptProofs(draft,basis),referenceDigest=await changeSetDigest(frame.referenceProvenance),now=new Date().toISOString();let media:MediaAsset={id:generateId('media'),filename:input.file.name,safeFilename:input.file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,80)||'draft_frame',mimeType:input.file.type,byteSize:input.file.size,blob:input.file,createdAt:now};
  const prepared=await prepareStoredFrameImage(media,{signal:input.signal});media={...media,width:prepared.width,height:prepared.height};abort(input.signal);
  const db=await openDatabase(),tx=db.transaction(['drafts','media'],'readwrite'),completion=done(tx),cancel=()=>{try{tx.abort();}catch{}};input.signal?.addEventListener('abort',cancel,{once:true});
  try{
   const [current,allMedia]=await Promise.all([request<SceneDraft|undefined>(tx.objectStore('drafts').get(input.draftId)),request<MediaAsset[]>(tx.objectStore('media').getAll())]);
   if(!current||canonicalStringify(current)!==canonicalStringify(draft))throw Error('The draft changed during image preparation. Your file was not committed; compare and retry.');
   const checked=validateMediaCandidate({name:media.filename,type:media.mimeType,size:media.byteSize,existingCount:0,currentTotalBytes:allMedia.reduce((sum,file)=>sum+file.byteSize+(file.posterBlob?.size??0),0)});if(!checked.valid)throw Error(checked.error);
   const assignment={mediaId:media.id,sha256:prepared.sha256,visualDigest:frame.visualDigest,bindingDigest:frame.bindingDigest,referenceDigest,...(prompts[input.frameId]?{promptDigest:prompts[input.frameId].promptDigest}:{}),provenance:{kind:'external_upload' as const},updatedAt:now};
   const next:SceneDraft={...current,frameImageAssignments:{...current.frameImageAssignments,[input.frameId]:assignment},inputRevision:current.inputRevision+1,updatedAt:now},error=validatePhase4Record(next);if(error)throw Error(error);
   abort(input.signal);tx.objectStore('media').add(media);tx.objectStore('drafts').put(next);await completion;return next;
  }catch(error){try{tx.abort();}catch{}await completion.catch(()=>undefined);throw error;}finally{input.signal?.removeEventListener('abort',cancel);}
 },true);
}
