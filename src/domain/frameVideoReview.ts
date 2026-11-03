import type {SceneDraft,OutputMode} from '../types/domain';
import type {KeyframeBasis,FrameVideoReviewBasis} from '../types/keyframes';
import type {BlockingOutputDecisions} from './blockingOutputReview';
import type {KeyframeFinding} from '../types/keyframes';
import {canonicalStringify,changeSetDigest} from './changeSetCanonical';
import {assembleScenePrompt} from './promptAssembler';
import {resolveBlockingOutputs} from './blockingOutputReview';

export type FrameVideoDecision='keep_exact_unverified'|'reassemble';
export interface FrameVideoResolution{canonicalOutputs?:Record<OutputMode,string>;valid:boolean;outputs:Record<OutputMode,string>;manualOutputs:SceneDraft['manualOutputs'];reviewStatus:'required'|'unverified';basis:FrameVideoReviewBasis;findings:KeyframeFinding[]}

export async function prepareFrameVideoReviewBasis(source:SceneDraft,basis:KeyframeBasis,outputs:Record<OutputMode,string>):Promise<FrameVideoReviewBasis>{
 const videoTextDigests:FrameVideoReviewBasis['videoTextDigests']={};
 for(const mode of ['full','structured','compact'] as const)videoTextDigests[mode]=await changeSetDigest(outputs[mode]);
 return{...(source.sourceSceneId?{sourceSceneId:source.sourceSceneId}:{}),planDigest:basis.planDigest,videoInputDigest:basis.videoReviewDigest,videoTextDigests};
}
/** Equality only checks a human review's recorded basis, never semantic agreement. */
export function isFrameVideoReviewCurrent(before:FrameVideoReviewBasis|undefined,after:FrameVideoReviewBasis){return !!before&&canonicalStringify(before)===canonicalStringify(after);}
export async function planFrameVideoReview(source:SceneDraft,outputs:Record<OutputMode,string>,basis:KeyframeBasis,decision?:FrameVideoDecision,manual?:BlockingOutputDecisions):Promise<FrameVideoResolution>{
 const findings:KeyframeFinding[]=[];let canonicalOutputs:Record<OutputMode,string>|undefined;let nextOutputs={...outputs},manualOutputs=structuredClone(source.manualOutputs),reviewStatus:FrameVideoResolution['reviewStatus']='unverified';
 if(decision==='reassemble'){
  const assembled=assembleScenePrompt(source,{authoredKeyframeMoments:true});canonicalOutputs=assembled.outputs;
  for(const message of assembled.errors)findings.push({code:'FRAME_VIDEO_ASSEMBLY',path:'video',severity:'blocking',message});
  const resolved=resolveBlockingOutputs(source,assembled.outputs,manual,true);
  nextOutputs=resolved.outputs;manualOutputs=resolved.manualOutputs;findings.push(...resolved.findings);
  reviewStatus=Object.keys(manualOutputs).length?'unverified':'required';
 }else if(decision!=='keep_exact_unverified')findings.push({code:'FRAME_VIDEO_DECISION_REQUIRED',path:'frameVideoDecision',severity:'blocking',message:'Choose coordinated video reassembly or keep the exact current video with correspondence unverified.'});
 return{...(canonicalOutputs?{canonicalOutputs}:{}),valid:!findings.some(f=>f.severity==='blocking'),outputs:nextOutputs,manualOutputs,reviewStatus,basis:await prepareFrameVideoReviewBasis(source,basis,nextOutputs),findings};
}
