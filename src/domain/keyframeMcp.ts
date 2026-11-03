import type {SavedScene,SceneDraft} from '../types/domain';
import type {McpScope} from '../types/mcp';
import type {ChangeSetPreview,ChangeSetState} from '../types/changeSet';
import type {PreparedFrameAuthoring} from './frameAuthoring';
import {getSceneSnapshotEntries} from './ensembleReferences';
import {hasBlockingGrant} from './blockingMcp';
import {requireScene,denyScope} from './mcpScope';
import {McpError,assertByteLimit,MCP_LIMITS} from './mcpProtocol';
import {changeSetDigest} from './changeSetCanonical';
import {prepareKeyframeBasis} from './keyframeDependencies';
import type {RecipeResolvedPreview} from './changeSetRecipe';
export interface FrameMcpProjection {operationId:string;keyframeId:string;mode:'full'|'compact'}
export const hasKeyframeGrant=(scope:McpScope,id:string)=>scope.version===3&&scope.keyframeSceneIds.includes(id);
export const hasImagePromptGrant=(scope:McpScope,id:string,frameId:string)=>scope.version===3&&hasKeyframeGrant(scope,id)&&scope.imagePromptFrameGrants.some(g=>g.sceneId===id&&g.frameId===frameId);
/** Reference IDs may contain captured labels; an unavailable complete plan is withheld. */
function planReadable(scene:SavedScene,scope:McpScope){return hasKeyframeGrant(scope,scene.id)&&(!scene.keyframePlan?.frames.some(f=>f.instant?.kind==='linked_phase')||hasBlockingGrant(scope,scene.id))&&(!scene.keyframePlan?.frames.some(f=>f.referenceAssociationIds.length)||scope.includeNotes&&scope.includeMediaFilenames);}
export function keyframeSceneProjection(scene:SavedScene,scope:McpScope){
 if(!scene.keyframePlan)return{available:false,disclosure:'unavailable'};
 return{available:true,version:1,frameCount:scene.keyframePlan.frames.length,disclosure:planReadable(scene,scope)?'shared':'withheld',...(planReadable(scene,scope)?{plan:structuredClone(scene.keyframePlan)}:{})};
}
/** Complete still text needs contributor grants, independently of a Video Full grant. */
export function imageContributorDisclosures(scene:SavedScene,scope:McpScope,authorization?:{plan:boolean;blocking:boolean}):string[]{
 const entries=getSceneSnapshotEntries(scene,{activeOnly:true}),links=[...scene.references,...(scene.referencePack?.entries??[]),...(scene.sourceMediaLinks??[])];
 return [...new Set([
  ...(!(authorization?.plan??hasKeyframeGrant(scope,scene.id))?['keyframeSceneIds']:[]),
  ...(scene.blocking&&!(authorization?.blocking??hasBlockingGrant(scope,scene.id))?['blockingSceneIds']:[]),
  ...(entries.some(e=>!({asset:scope.assetIds,variant:scope.variantIds,template:scope.templateIds}[e.snapshot.sourceType].includes(e.snapshot.sourceId))||e.snapshot.parentCharacterId&&!scope.assetIds.includes(e.snapshot.parentCharacterId))?['component record grants']:[]),
  ...(entries.some(e=>e.slot==='character')&&!scope.includeCharacterIdentity?['includeCharacterIdentity']:[]),
  ...(entries.some(e=>e.slot!=='character')&&!scope.includeAssetText?['includeAssetText']:[]),
  ...((links.length||scene.settings.toolNotes||scene.claimNotes||scene.manualImageOutputs||scene.ensemble?.participants.some(p=>p.role||p.performanceNotes))&&!scope.includeNotes?['includeNotes']:[]),
  ...(links.length&&!scope.includeMediaFilenames?['includeMediaFilenames']:[]),
 ])];
}
export function keyframeSavedImage(scene:SavedScene,frameId:string,mode:'full'|'compact',scope:McpScope){
 if(!hasImagePromptGrant(scope,scene.id,frameId)||imageContributorDisclosures(scene,scope).length)denyScope();
 if(!scene.keyframePlan?.frames.some(f=>f.id===frameId))throw new McpError('FRAME_UNAVAILABLE','Select an existing frame on this exact saved take.');
 const manual=scene.manualImageOutputs?.[frameId]?.[mode],text=manual?.text??scene.imagePromptSnapshots?.[frameId]?.[mode];
 if(text===undefined)throw new McpError('FRAME_PROMPT_UNAVAILABLE','This frame has no complete saved mode. Complete its Recipe inputs and review canonical assembly in KRAKINAI.');
 return{sceneId:scene.id,keyframeId:frameId,mode,text,source:manual?'manual':'canonical',correspondence:manual?'unverified':'captured',trust:'untrusted_user_content'};
}
export async function keyframeSourceTokens(scene:SavedScene,state:ChangeSetState){const basis=await prepareKeyframeBasis({...scene,inputRevision:1} as SceneDraft,new Map(state.media.map(m=>[m.id,m])));return{expectedSourceRevision:scene.revision,expectedSourceRecipeDigest:await changeSetDigest(scene),expectedKeyframeDigest:basis.planDigest};}
/** Never spread planner records: they contain identities, notes, every prompt and private media. */
export async function keyframeMcpPreview(preview:ChangeSetPreview,scope:McpScope,state:ChangeSetState,projection?:FrameMcpProjection){
 if(preview.changeSet.schema!=='krakinai.change-set.v6'||scope.version!==3)throw new McpError('CAPABILITY_REQUIRED','Use v6 with a freshly paired frame-capable bridge.');
 const operations=preview.plan.operations.map(row=>{
  const prepared=(row.resolved as {keyframes?:PreparedFrameAuthoring}|undefined)?.keyframes,op=preview.changeSet.operations.find(o=>o.operationId===row.operationId),source=op&&'sceneId'in op?requireScene(op.sceneId,scope,state):undefined;
  return{operationId:row.operationId,type:row.type,projectId:row.projectId,shotId:row.shotId,sourceSceneId:source?.id,readiness:preview.plan.findings.some(f=>f.operationId===row.operationId&&f.severity==='blocking')?'blocked':'review_required',findingCodes:preview.plan.findings.filter(f=>f.operationId===row.operationId).map(f=>({code:f.code,severity:f.severity})),...(prepared?{differences:structuredClone(prepared.differences),videoReviewStatus:prepared.video.reviewStatus}:{})};
 });
 let frame:Record<string,unknown>|undefined;
 if(projection){
  const row=preview.plan.operations.find(r=>r.operationId===projection.operationId),op=preview.changeSet.operations.find(o=>o.operationId===projection.operationId);if(!row||!op)throw new McpError('INVALID_REQUEST','Select one existing operation and frame.');
  const source='sceneId'in op?requireScene(op.sceneId,scope,state):undefined,prepared=(row.resolved as {keyframes?:PreparedFrameAuthoring}|undefined)?.keyframes;
  const created=preview.plan.scenes.find(s=>s.id===preview.plan.results.find(r=>r.operationId===row.operationId)?.recordId);
  const recipe=(row.resolved as {recipe?:RecipeResolvedPreview}|undefined)?.recipe;
  // The resolved candidate can differ from its source, including newly selected identities.
  // A transient disclosure view grants no saved ID and is never returned or persisted.
  const candidate=created??(source&&recipe?{...source,slots:recipe.components,ensemble:recipe.ensemble,settings:recipe.settings,referencePack:recipe.referencePack,sourceMediaLinks:recipe.sourceMediaLinks}:undefined);
  const missing=[...new Set([...(!scope.allowImagePromptDerivation?['allowImagePromptDerivation']:[]),...(source?imageContributorDisclosures(source,scope):[]),...(candidate?imageContributorDisclosures(candidate,scope,{plan:source?hasKeyframeGrant(scope,source.id):true,blocking:source?hasBlockingGrant(scope,source.id):scope.allowBlockingProposals}):['source unavailable'])])];
  const text=prepared?.images.effectiveOutputs[projection.keyframeId]?.[projection.mode];
  frame={...projection,...(prepared&&source&&planReadable(source,scope)&&planReadable({...source,keyframePlan:prepared.afterPlan},scope)?{beforeFrame:structuredClone(prepared.beforePlan?.frames.find(f=>f.id===projection.keyframeId)),afterFrame:structuredClone(prepared.afterPlan?.frames.find(f=>f.id===projection.keyframeId))}:{}),disclosure:missing.length?'withheld':text===undefined?'incomplete':'shared',missingDisclosures:missing,...(!missing.length&&text!==undefined?{text,correspondence:prepared?.images.unverifiedFrameIds.includes(projection.keyframeId)?'unverified':'canonical',trust:'untrusted_user_content'}:{})};
 }
 const result={operations,...(frame?{frame}:{})};assertByteLimit(JSON.stringify(result),MCP_LIMITS.result-1024);return result;
}

/** Active metadata only: no original bytes, hidden media IDs, history notes or implied grants. */
export function keyframeImageMetadata(scene:SavedScene,scope:McpScope,state:ChangeSetState){
 if(scope.version!==3||!hasKeyframeGrant(scope,scene.id))return[];
 return state.collections.filter(c=>scope.projectIds.includes(c.id)).flatMap(c=>{
  const production=c.project?.frameProduction;
  return(production?.active??[]).filter(p=>p.sceneId===scene.id&&hasImagePromptGrant(scope,scene.id,p.frameId)).flatMap(p=>{
   const event=production!.imageEvents.find(e=>e.id===p.eventId),media=event?.mediaId?state.media.find(m=>m.id===event.mediaId&&scope.mediaIds.includes(m.id)):undefined;
   if(!event||!media)return[];
   return[{projectId:c.id,expectedProjectRevision:c.project!.revision,shotId:p.shotId,sceneId:scene.id,frameId:p.frameId,associationId:event.id,expectedAssociationRevision:event.revision,mediaId:media.id,sha256:event.sha256,mimeType:media.mimeType,byteSize:media.byteSize,reviewStatus:event.reviewStatus,...(scope.includeMediaFilenames?{filename:media.filename}:{}),...(scope.includeNotes&&event.note?{note:event.note}:{})}];
  });
 });
}
