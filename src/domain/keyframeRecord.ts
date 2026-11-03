import type {SceneDraft} from '../types/domain';
import {KEYFRAME_LIMITS as L} from '../types/keyframes';
import {assertPlainKeyframeJson,validateKeyframePlan} from './keyframeValidation';
import {validateFrameImageProvenance} from './frameImageAssociations';
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const sha=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).every(key=>keys.includes(key));
/** Validate captured C metadata without resolving or rewriting historical assets. */
export function validateKeyframeRecord(value:Record<string,unknown>):string|undefined{
 if(value.keyframePlan===undefined&&value.imagePromptSnapshots===undefined&&value.manualImageOutputs===undefined&&value.frameImageAssignments===undefined)return;
 try{
  if(value.keyframePlan===undefined)throw Error('Image prompts require their exact keyframe plan.');
  const source=value as unknown as SceneDraft,errors=validateKeyframePlan(source.keyframePlan,source,'planning').filter(f=>f.severity==='blocking');if(errors.length)throw Error(errors.map(f=>f.message).join(' '));
  const ids=new Set(source.keyframePlan!.frames.map(f=>f.id));let total=0;const encoder=new TextEncoder();
  if(value.frameImageAssignments!==undefined){
   assertPlainKeyframeJson(value.frameImageAssignments,L.planBytes);const assignments=value.frameImageAssignments;
   if(value.outputs!==undefined||!record(assignments)||Object.keys(assignments).some(id=>!ids.has(id)))throw Error('Draft image attachments require their exact draft/frame ownership.');
   for(const assignment of Object.values(assignments)){
    if(!record(assignment)||!exact(assignment,['mediaId','sha256','promptDigest','visualDigest','bindingDigest','referenceDigest','provenance','updatedAt'])||typeof assignment.mediaId!=='string'||!assignment.mediaId.trim()||assignment.mediaId.length>200||!sha(assignment.sha256)||!sha(assignment.visualDigest)||!sha(assignment.bindingDigest)||!sha(assignment.referenceDigest)||assignment.promptDigest!==undefined&&!sha(assignment.promptDigest)||typeof assignment.updatedAt!=='string'||!Number.isFinite(Date.parse(assignment.updatedAt)))throw Error('Invalid draft frame image binding.');
    validateFrameImageProvenance(assignment.provenance);
   }
  }
  const measure=(text:unknown,nonempty=false)=>{if(typeof text!=='string'||nonempty&&!text.trim())throw Error('Invalid image output text.');const size=encoder.encode(text).length;total+=size;if(size>L.modeBytes)throw Error('Image output exceeds the 256 KiB mode budget.');};
  for(const key of ['imagePromptSnapshots','manualImageOutputs'] as const){const map=value[key];if(map===undefined)continue;assertPlainKeyframeJson(map,20*1024*1024);if(!record(map)||Object.keys(map).some(id=>!ids.has(id)))throw Error('Image output targets an unknown frame.');
   if(value.authoringMode==='direct_prompt'&&Object.keys(map).length)throw Error('Convert the Direct Prompt to a Recipe before assembling image outputs.');
   for(const row of Object.values(map)){
    if(!record(row))throw Error('Invalid image output metadata.');
    if(key==='imagePromptSnapshots'){
     if(!exact(row,['schema','assemblerVersion','full','compact','visualDigest','sourceDigest','referenceProvenance'])||row.schema!=='krakinai.image-prompt.v1'||row.assemblerVersion!==1||!sha(row.visualDigest)||!sha(row.sourceDigest)||!Array.isArray(row.referenceProvenance)||row.referenceProvenance.length>2000)throw Error('Invalid captured image prompt snapshot.');
     measure(row.full,true);if(row.compact!==undefined)measure(row.compact,true);
     for(const provenance of row.referenceProvenance){if(!record(provenance)||!exact(provenance,['association','sha256','missing'])||!record(provenance.association)||typeof provenance.association.associationId!=='string'||typeof provenance.association.mediaId!=='string'||(!sha(provenance.sha256)&&provenance.missing!==true)||(provenance.sha256!==undefined&&provenance.missing!==undefined))throw Error('Invalid image reference provenance.');}
    }else{
     if(!exact(row,['full','compact']))throw Error('Invalid manual image mode.');
     for(const mode of Object.values(row)){if(!record(mode)||!exact(mode,['text','basedOnVisualDigest','updatedAt'])||!sha(mode.basedOnVisualDigest)||typeof mode.updatedAt!=='string'||!Number.isFinite(Date.parse(mode.updatedAt)))throw Error('Invalid manual image output metadata.');measure(mode.text);}
    }
   }
  }
  if(total>L.takeOutputBytes)throw Error('Image outputs and manual buffers exceed the 1 MiB take budget.');
 }catch(error){return (error as Error).message;}
}
