import type {SceneDraft,MediaAsset} from '../types/domain';
import type {KeyframeBasis,KeyframeDependencyDiff,FrameReferenceProvenance,PlannedKeyframeV1} from '../types/keyframes';
import {canonicalStringify,changeSetDigest} from './changeSetCanonical';
import {getActiveSceneSlots,getActiveSourceMediaLinks,resolveShotType} from './shotTypeRules';
import {assertPlainKeyframeJson,getKeyframeReferenceEntries,validateKeyframePlan} from './keyframeValidation';
import {MAX_VIDEO_BYTES} from './validation';
import {resolveImagePromptInputs} from './imagePromptInputs';

/** Kept separate from labels, timeline position, timestamps and video-only performance. */
export function keyframeVisualInputs(source:SceneDraft,frame:PlannedKeyframeV1){
 const resolved=resolveImagePromptInputs(source,frame);
 return{version:1,shotType:resolveShotType(source),sections:resolved.sections,bindings:resolved.bindings,readiness:resolved.findings.map(f=>({code:f.code,path:f.path}))};
}

/** Sequential bounded Blob reads, cached per referenced ID; never hash an entire library. */
export async function prepareKeyframeBasis(source:SceneDraft,media:ReadonlyMap<string,MediaAsset>):Promise<KeyframeBasis>{
 if(source.keyframePlan)assertPlainKeyframeJson(source.keyframePlan);
 const invalid=validateKeyframePlan(source.keyframePlan,source,'planning').filter(f=>f.severity==='blocking');
 if(invalid.length)throw Error(invalid.map(f=>f.message).join(' '));
 const planDigest=await changeSetDigest(source.keyframePlan??null),references=getKeyframeReferenceEntries(source);
 const mediaDigests=new Map<string,string>();
 const digest=async(id:string):Promise<string|undefined>=>{
  const file=media.get(id);if(!file)return;
  const cached=mediaDigests.get(id);if(cached)return cached;
  if(file.blob.size>MAX_VIDEO_BYTES)throw Error('Selected keyframe media exceeds the existing bounded per-file upload allowance. Keep the plan and choose supported media before assembly.');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');
  mediaDigests.set(id,hash);return hash;
 };
 const originals=[];
 for(const link of getActiveSourceMediaLinks(source)){const stored=media.get(link.mediaId);originals.push({link,sha256:await digest(link.mediaId),stored:stored?{mimeType:stored.mimeType,byteSize:stored.byteSize,width:stored.width,height:stored.height,durationSeconds:stored.durationSeconds}:null});}
 const frames:KeyframeBasis['frames']={};
 for(const frame of source.keyframePlan?.frames??[]){
  const provenance:FrameReferenceProvenance[]=[];
  for(const id of frame.referenceAssociationIds){const association=references.find(e=>e.associationId===id);if(!association)continue;const sha256=await digest(association.mediaId);provenance.push({association:structuredClone(association),...(sha256?{sha256}:{missing:true as const})});}
  const inputs=keyframeVisualInputs(source,frame);
  frames[frame.id]={visualDigest:await changeSetDigest({inputs,referenceProvenance:provenance,originals}),metadataDigest:await changeSetDigest({label:frame.label,role:frame.role,relativePosition:frame.relativePosition,timeSeconds:frame.timeSeconds}),bindingDigest:await changeSetDigest(inputs.bindings),referenceProvenance:provenance};
 }
 const manualVideoTexts=Object.fromEntries(Object.entries(source.manualOutputs).map(([mode,value])=>[mode,value?.text]));
 const videoReviewDigest=await changeSetDigest({planDigest,frameVisualDigests:Object.entries(frames).map(([id,frame])=>({id,visualDigest:frame.visualDigest})),shotType:resolveShotType(source),slots:getActiveSceneSlots(source),ensemble:source.ensemble,sceneInstructions:source.sceneInstructions,avoidText:source.avoidText,dialogue:source.dialogue,settings:source.settings,blocking:source.blocking,generation:source.generation,originals,manualVideoTexts});
 return{planDigest,videoReviewDigest,frameOrder:(source.keyframePlan?.frames??[]).map(f=>f.id),frames};
}

export function diffKeyframeBasis(before:KeyframeBasis,after:KeyframeBasis):KeyframeDependencyDiff{
 const addedFrameIds=after.frameOrder.filter(id=>!Object.hasOwn(before.frames,id)),removedFrameIds=before.frameOrder.filter(id=>!Object.hasOwn(after.frames,id));
 const shared=after.frameOrder.filter(id=>Object.hasOwn(before.frames,id));
 const reorderedFrameIds=shared.filter(id=>before.frameOrder.indexOf(id)!==after.frameOrder.indexOf(id));
 const visuallyChangedFrameIds=shared.filter(id=>before.frames[id].visualDigest!==after.frames[id].visualDigest);
 const metadataOnlyFrameIds=shared.filter(id=>before.frames[id].metadataDigest!==after.frames[id].metadataDigest&&!visuallyChangedFrameIds.includes(id));
 return{addedFrameIds,removedFrameIds,reorderedFrameIds,metadataOnlyFrameIds,visuallyChangedFrameIds,videoReviewRequired:before.videoReviewDigest!==after.videoReviewDigest||canonicalStringify(before.frameOrder)!==canonicalStringify(after.frameOrder)};
}
