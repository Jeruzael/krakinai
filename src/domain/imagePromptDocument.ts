import type {SceneDraft,MediaAsset} from '../types/domain';
import {KEYFRAME_LIMITS as L,type ImagePromptSnapshotV1,type KeyframeFinding} from '../types/keyframes';
import {validateKeyframePlan} from './keyframeValidation';
import {prepareKeyframeBasis} from './keyframeDependencies';
import {resolveImagePromptInputs} from './imagePromptInputs';
import {validateShotSourceMedia} from './shotTypeRules';
import {validateSceneEnsemble} from './ensembleValidation';
import {changeSetDigest} from './changeSetCanonical';
export type ImagePromptAssembly={ready:true;snapshot:ImagePromptSnapshotV1}|{ready:false;findings:KeyframeFinding[]};
const unavailable=(code:string,message:string,path='keyframePlan'):ImagePromptAssembly=>({ready:false,findings:[{code,path,message,severity:'blocking'}]});
const size=(text:string)=>new TextEncoder().encode(text).length;
/** Canonical still assembly only. No persistence, model output, external generation or video-string reuse. */
export async function assembleImagePrompt(source:SceneDraft,frameId:string,media:ReadonlyMap<string,MediaAsset>):Promise<ImagePromptAssembly>{
 if(source.authoringMode==='direct_prompt')return unavailable('IMAGE_RECIPE','Retain this frame plan and use guided Recipe conversion before complete image assembly. The original Direct Prompt is preserved.');
 const findings=validateKeyframePlan(source.keyframePlan,source,'assembly',frameId);if(findings.some(f=>f.severity==='blocking'))return{ready:false,findings};
 const frame=source.keyframePlan?.frames.find(f=>f.id===frameId);if(!frame)return unavailable('IMAGE_FRAME','Select an existing planned frame in Image Frames.');
 const originalErrors=validateShotSourceMedia(source,media);if(originalErrors.length)return{ready:false,findings:originalErrors.map(message=>({code:'IMAGE_SOURCE_MEDIA',path:'sourceMediaLinks',message:'Review Source Media: '+message,severity:'blocking'}))};
 const ensembleErrors=validateSceneEnsemble(source,{forAssembly:true});if(ensembleErrors.length)return{ready:false,findings:ensembleErrors.map(message=>({code:'IMAGE_RECIPE',path:'ensemble',message,severity:'blocking'}))};
 const input=resolveImagePromptInputs(source,frame);if(input.findings.some(f=>f.severity==='blocking'))return{ready:false,findings:input.findings};
 const full=input.sections.map(s=>`## ${s.label}\n${s.text}`).join('\n\n');
 const compact=input.sections.map(s=>`${s.label}:\n${s.text}`).join('\n');
 if(size(full)>L.modeBytes||size(compact)>L.modeBytes)return unavailable('IMAGE_PROMPT_BYTES','The complete frame prompt exceeds 256 KiB. Keep the plan and review inherited visual text; identity text is never truncated.');
 let total=size(full)+size(compact);
 for(const [id,stored]of Object.entries(source.imagePromptSnapshots??{}))if(id!==frameId){for(const text of [stored.full,stored.compact])if(text!==undefined){if(typeof text!=='string'||size(text)>L.modeBytes)return unavailable('IMAGE_PROMPT_BYTES','An existing image mode exceeds its complete-text budget. Review Image Frames.');total+=size(text);}}
 for(const modes of Object.values(source.manualImageOutputs??{}))for(const value of Object.values(modes))if(value){if(typeof value.text!=='string'||size(value.text)>L.modeBytes)return unavailable('IMAGE_PROMPT_BYTES','A manual image mode exceeds 256 KiB. Keep the exact recoverable draft.');total+=size(value.text);}
 if(total>L.takeOutputBytes)return unavailable('IMAGE_TAKE_BYTES','Combined image snapshots and retained manual text exceed 1 MiB for this take. Preserve the draft and reduce the planned output set explicitly.');
 try{
  const basis=await prepareKeyframeBasis(source,media),visual=basis.frames[frameId];
  if(visual.referenceProvenance.some(p=>p.missing))return unavailable('IMAGE_REFERENCE','A selected reference file is missing. Restore it or explicitly revise this frame’s reference selection; saved packs are unchanged.');
  const snapshot:ImagePromptSnapshotV1={schema:'krakinai.image-prompt.v1',assemblerVersion:1,full,compact,visualDigest:visual.visualDigest,sourceDigest:await changeSetDigest({planDigest:basis.planDigest,frameId,visualDigest:visual.visualDigest}),referenceProvenance:visual.referenceProvenance};
  return{ready:true,snapshot};
 }catch{return unavailable('IMAGE_MEDIA_BUDGET','Current frame inputs could not be safely hashed within the existing per-file allowance. Keep the plan and review Source Media and references.');}
}
