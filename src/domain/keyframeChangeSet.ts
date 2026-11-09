import type {SavedScene,SceneDraft,MediaAsset} from '../types/domain';
import type {ChangeSet,ChangeSetApproval,ChangeSetState,ChangeSetAllocation,RecipeSceneOperation} from '../types/changeSet';
import type {KeyframeBasis,FrameVideoReviewBasis} from '../types/keyframes';
import type {ConversionSourceProofs} from './recipeConversion';
import type {BlockingSourceProofs} from './blockingPatch';
import {canonicalStringify} from './changeSetCanonical';
import {prepareKeyframeBasis} from './keyframeDependencies';
import {applyKeyframePatch} from './keyframePatch';
import {prepareFrameVideoReviewBasis} from './frameVideoReview';
import {planChangeSet} from './changeSetPlanner';
import {NULL_BLOCKING_DIGEST} from './blockingPatch';
import type {FramePromptProof,FrameMediaProof} from '../types/frameProduction';
import {prepareStoredFrameImage} from './frameImageMedia';
import {prepareFrameAuthoring,prepareFramePromptProofs,type PreparedFrameAuthoring} from './frameAuthoring';

export interface KeyframeSourceProof{signature:string;basis:KeyframeBasis;frames:Record<string,FramePromptProof>;videoBasis?:FrameVideoReviewBasis}
export type KeyframeSourceProofs=Map<string,KeyframeSourceProof>;
export interface PreparedKeyframeChange extends PreparedFrameAuthoring{signature:string}
export interface KeyframePlanningContext {
 sources:KeyframeSourceProofs;
 prepared:Map<string,PreparedKeyframeChange>;
 mediaProofs:Map<string,FrameMediaProof>;
 mediaValidationErrors:Map<string,string>;
 collect?:(op:RecipeSceneOperation,draft:SceneDraft,parent:SavedScene|undefined)=>void;
}
export const keyframeDraftSignature=(draft:SceneDraft,op:RecipeSceneOperation,approval:ChangeSetApproval)=>{
 const {authoredProjectTarget,...signatureDraft}=draft;
 return canonicalStringify({draft:signatureDraft,op,frameOutputDecisions:approval.frameOutputDecisions?.[op.operationId],blockingOutputDecisions:approval.blockingOutputDecisions?.[op.operationId]});
};

/** Hashing is bounded and happens before opening the Stage B write transaction. */
export async function prepareKeyframeSources(scenes:SavedScene[],media:ReadonlyMap<string,MediaAsset>):Promise<KeyframeSourceProofs>{
 const result:KeyframeSourceProofs=new Map();
 for(const scene of scenes){const source={...scene,inputRevision:1,sourceSceneId:scene.id} as SceneDraft,basis=await prepareKeyframeBasis(source,media);result.set(scene.id,{signature:canonicalStringify(scene),basis,frames:await prepareFramePromptProofs(scene,basis),...(scene.authoringMode!=='direct_prompt'?{videoBasis:await prepareFrameVideoReviewBasis(source,basis,scene.outputs)}:{})});}
 return result;
}

/** The strict supplied-field patch never modifies the source or invents an identity. */
export function applyRecipeKeyframeChange(draft:SceneDraft,parent:SavedScene|undefined,op:RecipeSceneOperation,context:KeyframePlanningContext):void{
 const proof=parent?context.sources.get(parent.id):undefined;
 if(parent&&(!proof||proof.signature!==canonicalStringify(parent)||op.expectedKeyframeDigest!==proof.basis.planDigest))throw Error('The exact keyframe source or plan digest changed. Read and preview that take again.');
 for(const field of ['keyframePlan','imagePromptSnapshots','manualImageOutputs'] as const){if(parent?.[field]!==undefined)Object.assign(draft,{[field]:structuredClone(parent[field])});}
 draft.keyframePlan=applyKeyframePatch(draft.keyframePlan,op.keyframes,draft,proof?.basis.planDigest??NULL_BLOCKING_DIGEST);
 const ids=new Set(draft.keyframePlan?.frames.map(frame=>frame.id)??[]);
 for(const field of ['imagePromptSnapshots','manualImageOutputs'] as const){if(!draft.keyframePlan)delete draft[field];else if(draft[field])Object.assign(draft,{[field]:Object.fromEntries(Object.entries(draft[field]!).filter(([id])=>ids.has(id)))});}
}

async function prepareChange(op:RecipeSceneOperation,draft:SceneDraft,parent:SavedScene|undefined,approval:ChangeSetApproval,media:ReadonlyMap<string,MediaAsset>):Promise<PreparedKeyframeChange>{
 const needsDecision=!!(parent?.keyframePlan||draft.keyframePlan||Object.hasOwn(op,'keyframes'));
 return{...await prepareFrameAuthoring(draft,parent,media,{frameOutputDecisions:approval.frameOutputDecisions?.[op.operationId],frameVideoDecision:needsDecision?op.videoDecision:'reassemble',blockingOutputDecisions:approval.blockingOutputDecisions?.[op.operationId]}),signature:keyframeDraftSignature(draft,op,approval)};
}

/** A dry pass resolves approved same-batch assets and collects transient drafts only. */
export async function prepareKeyframeChangeSet(input:ChangeSet,approval:ChangeSetApproval,state:ChangeSetState,allocation:ChangeSetAllocation,conversionProofs:ConversionSourceProofs=new Map(),blockingProofs:BlockingSourceProofs=new Map()):Promise<KeyframePlanningContext>{
 const media=new Map(state.media.map(m=>[m.id,m])),ids=new Set(input.operations.flatMap(op=>'sceneId'in op?[op.sceneId]:'scene'in op&&'id'in op.scene?[op.scene.id]:[]));
 const context:KeyframePlanningContext={sources:await prepareKeyframeSources(state.scenes.filter(s=>ids.has(s.id)),media),prepared:new Map(),mediaProofs:new Map(),mediaValidationErrors:new Map()};
 if(input.schema!=='krakinai.change-set.v6')return context;
 const mediaIds=new Set(input.operations.flatMap(op=>op.type==='frame_image.link'?[op.mediaId]:'imageCarryOver'in op?(op.imageCarryOver??[]).flatMap(choice=>state.collections.flatMap(c=>c.project?.frameProduction?.imageEvents.filter(e=>e.id===choice.associationId&&e.mediaId).map(e=>e.mediaId!)??[])):[]));
 for(const id of mediaIds){const file=media.get(id);try{if(!file)throw Error();context.mediaProofs.set(id,await prepareStoredFrameImage(file));}catch{context.mediaValidationErrors.set(id,'Frame image failed current MIME, signature, decode or dimension validation, or is unavailable. Select a complete PNG/JPEG/WebP still within 10 MiB, 16,384 pixels per edge and 64 MiPixels. No image was generated or approved.');}}
 const drafts:{op:RecipeSceneOperation;draft:SceneDraft;parent?:SavedScene}[]=[];
 context.collect=(op,draft,parent)=>drafts.push({op,draft:structuredClone(draft),parent});
 planChangeSet(input,approval,state,allocation,conversionProofs,blockingProofs,context);delete context.collect;
 for(const {op,draft,parent}of drafts){
  try{context.prepared.set(op.operationId,await prepareChange(op,draft,parent,approval,media));}
  catch(error){const message=(error as Error).message;context.prepared.set(op.operationId,{signature:keyframeDraftSignature(draft,op,approval),findings:[{code:'KEYFRAME_PREPARATION',path:'keyframes',severity:'blocking',message}]} as PreparedKeyframeChange);}
 }
 return context;
}

export function keyframeReviewedProjection(plan:ReturnType<typeof planChangeSet>){
 return{operations:plan.operations.map(row=>({operationId:row.operationId,type:row.type,resolved:row.resolved})),scenes:plan.scenes.map(scene=>({id:scene.id,keyframePlan:scene.keyframePlan,imagePromptSnapshots:scene.imagePromptSnapshots,manualImageOutputs:scene.manualImageOutputs,outputs:scene.outputs,manualOutputs:scene.manualOutputs})),collections:plan.collections,findings:plan.findings.filter(f=>!f.code.startsWith('APPROVAL_'))};
}
