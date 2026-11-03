import type {ChangeSetPreview,ChangeSetState} from '../types/changeSet';
import type {McpScope} from '../types/mcp';
import type {SavedScene,OutputMode} from '../types/domain';
import type {SceneBlockingV1} from '../types/blocking';
import type {BlockingDifference} from './blockingReview';
import type {RecipeResolvedPreview} from './changeSetRecipe';
import {blockingDigest} from './blockingPatch';
import {changeSetDigest} from './changeSetCanonical';
import {getSceneSnapshotEntries} from './ensembleReferences';

export const hasBlockingGrant=(scope:McpScope,id:string)=>scope.version!==1&&scope.blockingSceneIds.includes(id);
export function blockingDisclosure(scene:Pick<SavedScene,'id'|'blocking'>,allowed:boolean){
 return scene.blocking?{available:true,version:1 as const,disclosure:allowed?'shared':'withheld',...(allowed?{plan:structuredClone(scene.blocking)}:{})}:undefined;
}
export async function blockingSourceTokens(scene:SavedScene){return{expectedSourceRevision:scene.revision,expectedSourceRecipeDigest:await changeSetDigest(scene),expectedBlockingDigest:await blockingDigest(scene.blocking)};}
interface ReviewedBlocking{sourceSceneId?:string;sourceRevision?:number;expectedSourceRecipeDigest?:string;expectedBlockingDigest?:string;before:SceneBlockingV1|null;after:SceneBlockingV1|null;changedPaths:BlockingDifference[];canonicalOutputs:Record<OutputMode,string>;effectiveOutputs:Record<OutputMode,string>;outputChanges:unknown}
/** Allowlist projection only. Complete browser review is never an implicit model grant. */
export function blockingMcpPreview(preview:ChangeSetPreview,scope:McpScope,state:ChangeSetState){
 if(preview.changeSet.schema!=='krakinai.change-set.v5')return[];
 const visible={asset:new Set(scope.assetIds),variant:new Set(scope.variantIds),template:new Set(scope.templateIds)};
 const authored=new Set(preview.changeSet.operations.filter(o=>o.type==='asset.propose'||o.type==='variant.propose').map(o=>o.operationId));
 for(const candidate of preview.plan.candidates)if(candidate.changeSetId===preview.changeSet.changeSetId&&authored.has(candidate.operationId)&&candidate.status==='created'&&candidate.assetId)visible[candidate.kind==='template'?'template':'asset'].add(candidate.assetId);
 for(const candidate of preview.plan.variantCandidates??[])if(candidate.changeSetId===preview.changeSet.changeSetId&&authored.has(candidate.operationId)&&candidate.status==='created'&&candidate.variantId&&visible.asset.has(candidate.parentCharacterId))visible.variant.add(candidate.variantId);
 return preview.plan.operations.filter(row=>row.type.startsWith('scene.')&&row.type.includes('recipe')).map(row=>{
  const resolved=row.resolved as {blocking?:ReviewedBlocking;recipe?:RecipeResolvedPreview}|undefined,b=resolved?.blocking,recipe=resolved?.recipe,parent=b?.sourceSceneId?state.scenes.find(s=>s.id===b.sourceSceneId):undefined;
  const entries=recipe?getSceneSnapshotEntries({slots:recipe.components,ensemble:recipe.ensemble,shotType:recipe.shotType},{activeOnly:true}):[];
  const readable=entries.every(e=>visible[e.snapshot.sourceType].has(e.snapshot.sourceId)&&(!e.snapshot.parentCharacterId||visible.asset.has(e.snapshot.parentCharacterId)));
  const blockingAllowed=!!b&&(!b.sourceSceneId||hasBlockingGrant(scope,b.sourceSceneId)),typedValues=blockingAllowed&&readable;
  const links=[...(recipe?.referencePack?.entries??[]),...(recipe?.sourceMediaLinks??[]),...(parent?.references??[])];
  const missingDisclosures=[...new Set([
   ...(!blockingAllowed?['blockingSceneIds']:[]),...(!readable?['component record grants']:[]),
   ...(entries.some(e=>e.slot==='character')&&!scope.includeCharacterIdentity?['includeCharacterIdentity']:[]),
   ...(entries.some(e=>e.slot!=='character')&&!scope.includeAssetText?['includeAssetText']:[]),
   ...(parent&&!scope.fullPromptSceneIds.includes(parent.id)?['fullPromptSceneIds']:[]),
   ...((recipe?.settings.toolNotes||parent?.claimNotes||recipe?.ensemble?.participants.some(p=>!!p.role||!!p.performanceNotes)||links.some(l=>!!l.altText))&&!scope.includeNotes?['includeNotes']:[]),
   ...(links.length&&!scope.includeMediaFilenames?['includeMediaFilenames']:[]),
  ])];
  const share=!!b&&missingDisclosures.length===0;
  const currentId=preview.plan.results.find(r=>r.operationId===row.operationId)?.recordId;
  const comparisons=(preview.plan.blockingContinuity??[]).filter(c=>c.projectId===row.projectId).flatMap(c=>c.comparisons.filter(p=>p.currentSceneId===currentId||p.shotId===row.shotId).map(pair=>{
   const canRead=(id:string|undefined)=>!!id&&(hasBlockingGrant(scope,id)||id===currentId&&blockingAllowed);
   return{kind:pair.kind,projectId:c.projectId,finalShotOrder:[...c.finalShotOrder],previousShotId:pair.previousShotId,shotId:pair.shotId,previousSceneId:pair.previousSceneId,currentSceneId:pair.currentSceneId,...(canRead(pair.previousSceneId)&&canRead(pair.currentSceneId)?{comparison:structuredClone(pair.comparison)}:{disclosure:'withheld'})};
  }));
  return{operationId:row.operationId,projectId:row.projectId,shotId:row.shotId,sourceSceneId:b?.sourceSceneId,sourceRevision:b?.sourceRevision,expectedSourceRecipeDigest:b?.expectedSourceRecipeDigest,expectedBlockingDigest:b?.expectedBlockingDigest,proposedSceneId:currentId,readiness:recipe?.readiness??'blocked',
   changedPaths:(b?.changedPaths??[]).map(change=>typedValues?structuredClone(change):{path:change.path,disclosure:'withheld'}),
   outputDisclosure:share?'shared':'withheld',missingDisclosures,outputChanges:b?.outputChanges??null,...(share?{canonicalOutputs:structuredClone(b!.canonicalOutputs),effectiveOutputs:structuredClone(b!.effectiveOutputs)}:{}),
   findingCodes:preview.plan.findings.filter(f=>f.operationId===row.operationId).map(f=>({code:f.code,severity:f.severity})),comparisons,
  };
 });
}
