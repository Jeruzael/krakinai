import type {Collection,MediaAsset,SceneDraft,SavedScene} from '../types/domain';
import type {FrameImageEvent,FrameMediaProof} from '../types/frameProduction';
import type {PreparedFrameAuthoring} from './frameAuthoring';
import {canonicalStringify} from './changeSetCanonical';
import {prepareStoredFrameImage} from './frameImageMedia';
import {frameMediaSignature,getActiveFrameImage,planFrameImageAssociation,planFrameImageCarryOver} from './frameImageAssociations';
export interface LocalFrameImageChoices{draftFrameIds:string[];carryOverEventIds:string[]}
export interface PreparedLocalFrameImages{collectionSignature:string;entries:{frameId:string;mediaId:string;proof:FrameMediaProof;source?:FrameImageEvent}[]}
export function validateLocalFrameImageChoices(choices:LocalFrameImageChoices|undefined){
 if(choices===undefined)return;
 if(!choices||Object.keys(choices).some(k=>!['draftFrameIds','carryOverEventIds'].includes(k))||[choices.draftFrameIds,choices.carryOverEventIds].some(ids=>!Array.isArray(ids)||ids.length>16||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!id||id.length>200)))throw Error('Choose bounded, unique frame image assignments explicitly.');
}
export async function prepareLocalFrameImages(draft:SceneDraft,parent:SavedScene|undefined,collection:Collection|undefined,media:ReadonlyMap<string,MediaAsset>,frames:PreparedFrameAuthoring,choices:LocalFrameImageChoices):Promise<PreparedLocalFrameImages>{
 validateLocalFrameImageChoices(choices);if(!collection?.project)throw Error('Select an exact storyboard shot before carrying images into a new take.');
 const entries:PreparedLocalFrameImages['entries']=[],used=new Set<string>();
 for(const id of choices.draftFrameIds){const assignment=draft.frameImageAssignments?.[id],proof=frames.frames[id],file=assignment&&media.get(assignment.mediaId);if(!assignment||!proof||!file)throw Error('Draft frame image is missing or incomplete. Reopen its image prompt and select a valid image.');
  const checked=await prepareStoredFrameImage(file);
  if(assignment.sha256!==checked.sha256||assignment.visualDigest!==proof.visualDigest||assignment.bindingDigest!==proof.bindingDigest||assignment.referenceDigest!==proof.referenceDigest||assignment.promptDigest!==undefined&&assignment.promptDigest!==proof.promptDigest)throw Error('Draft image basis changed. Review and upload or link its image again.');
  entries.push({frameId:id,mediaId:file.id,proof:checked});used.add(id);
 }
 for(const id of choices.carryOverEventIds){const source=collection.project.frameProduction?.imageEvents.find(e=>e.id===id),proof=source&&frames.frames[source.frameId],file=source?.mediaId&&media.get(source.mediaId);
  if(!source||!parent||source.sceneId!==parent.id||!proof||!file||getActiveFrameImage(collection.project.frameProduction,source)?.id!==id||used.has(source.frameId))throw Error('Select one current source image per unchanged frame.');
  entries.push({frameId:source.frameId,mediaId:file.id,proof:await prepareStoredFrameImage(file),source});used.add(source.frameId);
 }
 return{collectionSignature:canonicalStringify(collection),entries};
}
/** Called inside the existing new-scene transaction, with no hashing or decoding. */
export function applyLocalFrameImages(prepared:PreparedLocalFrameImages,original:Collection,updated:Collection,scene:SavedScene,frames:PreparedFrameAuthoring,media:ReadonlyMap<string,MediaAsset>,eventId:()=>string,now:string):Collection{
 if(canonicalStringify(original)!==prepared.collectionSignature||!scene.saveProjectTarget)throw Error('Frame image source project changed. Review again.');
 let collection=updated;
 for(const entry of prepared.entries){const file=media.get(entry.mediaId);if(!file||frameMediaSignature(file)!==entry.proof.signature)throw Error('Frame image media changed during preparation.');
  const input={collection,target:{shotId:scene.saveProjectTarget.shotId,sceneId:scene.id,frameId:entry.frameId},proof:frames.frames[entry.frameId],media:file,mediaProof:entry.proof,eventId:eventId(),now};
  collection=entry.source?planFrameImageCarryOver({...input,source:entry.source}):planFrameImageAssociation({...input,kind:'link',expectedRevision:0,provenance:{kind:'external_upload'}}).collection;
 }
 return collection;
}
