import type {SceneDraft} from '../types/domain';
import {KEYFRAME_LIMITS,type KeyframeBasis,type ImagePromptSnapshotV1,type FrameOutputDecisions,type ManualImageOutputs,type KeyframeFinding,type ImagePromptMode} from '../types/keyframes';
import {assertPlainKeyframeJson} from './keyframeValidation';

export interface FrameOutputResolution {
 valid:boolean;
 imagePromptSnapshots:Record<string,ImagePromptSnapshotV1>;
 manualImageOutputs:ManualImageOutputs;
 effectiveOutputs:Record<string,Partial<Record<ImagePromptMode,string>>>;
 unverifiedFrameIds:string[];
 findings:KeyframeFinding[];
}

/** Pure resolution. A manual buffer never becomes a canonical or reviewed prompt. */
export function resolveFrameOutputs(source:SceneDraft,basis:KeyframeBasis,canonical:Record<string,ImagePromptSnapshotV1>,decisions?:FrameOutputDecisions):FrameOutputResolution{
 const findings:KeyframeFinding[]=[],imagePromptSnapshots:FrameOutputResolution['imagePromptSnapshots']={},manualImageOutputs:ManualImageOutputs={},effectiveOutputs:FrameOutputResolution['effectiveOutputs']={},unverifiedFrameIds:string[]=[];
 const add=(code:string,path:string,message:string,severity:KeyframeFinding['severity']='blocking')=>findings.push({code,path,message,severity});
 const modes=['full','compact'] as const,ids=new Set(basis.frameOrder);
 if(decisions!==undefined){
  try{
   assertPlainKeyframeJson(decisions);
   if(!decisions||typeof decisions!=='object'||Array.isArray(decisions))throw Error();
   for(const [id,choices] of Object.entries(decisions)){
    if(!ids.has(id)||!choices||typeof choices!=='object'||Array.isArray(choices))throw Error();
    for(const [mode,choice] of Object.entries(choices))if(!modes.includes(mode as ImagePromptMode)||!['canonical','keep_manual_unverified'].includes(choice)||!source.manualImageOutputs?.[id]?.[mode as ImagePromptMode])throw Error();
   }
  }catch{add('FRAME_OUTPUT_DECISION_INVALID','frameOutputDecisions','Choose only canonical or keep exact for an active frame and manual mode.');}
 }
 for(const id of Object.keys(canonical))if(!ids.has(id))add('FRAME_CANONICAL_TARGET',`imagePromptSnapshots.${id}`,'The assembled image target is not in this frame plan.');
 for(const id of basis.frameOrder){
  const snapshot=canonical[id]??source.imagePromptSnapshots?.[id];
  if(snapshot){
   if(snapshot.visualDigest!==basis.frames[id].visualDigest)add('FRAME_CANONICAL_STALE',`imagePromptSnapshots.${id}`,'Reassemble this changed frame before saving its canonical image prompt.');
   imagePromptSnapshots[id]=structuredClone(snapshot);
   effectiveOutputs[id]={full:snapshot.full,...(snapshot.compact!==undefined?{compact:snapshot.compact}:{})};
  }
  for(const mode of modes){
   const manual=source.manualImageOutputs?.[id]?.[mode];if(!manual)continue;
   const choice=decisions?.[id]?.[mode];
   if(choice==='canonical'){
    if(!snapshot||snapshot.visualDigest!==basis.frames[id].visualDigest||snapshot[mode]===undefined)add('FRAME_CANONICAL_REQUIRED',`manualImageOutputs.${id}.${mode}`,'Assemble the complete canonical mode before discarding this manual buffer.');
    continue;
   }
   (manualImageOutputs[id]??={})[mode]=structuredClone(manual);
   (effectiveOutputs[id]??={})[mode]=manual.text;
   if(!unverifiedFrameIds.includes(id))unverifiedFrameIds.push(id);
   if(manual.basedOnVisualDigest!==basis.frames[id].visualDigest&&choice!=='keep_manual_unverified')add('FRAME_OUTPUT_DECISION_REQUIRED',`manualImageOutputs.${id}.${mode}`,`Choose newly assembled canonical ${mode} or keep the exact manual text as correspondence unverified.`);
   else add('FRAME_MANUAL_UNVERIFIED',`manualImageOutputs.${id}.${mode}`,'Exact manual text retained; image correspondence is unverified.','advisory');
  }
 }
 let total=0;const encoder=new TextEncoder();
 const measure=(text:string,path:string)=>{const bytes=encoder.encode(text).byteLength;total+=bytes;if(bytes>KEYFRAME_LIMITS.modeBytes)add('FRAME_OUTPUT_BUDGET',path,'Image prompt exceeds 256 KiB. Shorten it before saving; no text was truncated.');};
 for(const [id,snapshot] of Object.entries(imagePromptSnapshots))for(const mode of modes)if(snapshot[mode]!==undefined)measure(snapshot[mode]!,`imagePromptSnapshots.${id}.${mode}`);
 for(const [id,manual] of Object.entries(manualImageOutputs))for(const mode of modes)if(manual[mode])measure(manual[mode]!.text,`manualImageOutputs.${id}.${mode}`);
 if(total>KEYFRAME_LIMITS.takeOutputBytes)add('FRAME_OUTPUT_BUDGET','imagePromptSnapshots','Image outputs and manual buffers exceed the 1 MiB take budget. Keep the plan and shorten outputs before saving.');
 return{valid:!findings.some(f=>f.severity==='blocking'),imagePromptSnapshots,manualImageOutputs,effectiveOutputs,unverifiedFrameIds,findings};
}
