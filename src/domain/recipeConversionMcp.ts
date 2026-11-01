import type{ChangeSetPreview}from'../types/changeSet';
import type{McpScope}from'../types/mcp';
import type{RecipeResolvedPreview}from'./changeSetRecipe';
import{getSceneSnapshotEntries}from'./ensembleReferences';
/** Bounded preview only. Neither text disclosure nor these digests confer write authority. */
export function conversionMcpPreview(preview:ChangeSetPreview,scope:McpScope){
 if(preview.changeSet.schema!=='krakinai.change-set.v4')return undefined;
 const visible={asset:new Set(scope.assetIds),variant:new Set(scope.variantIds),template:new Set(scope.templateIds)};
 // Local reuse choices authorize browser editing, not disclosure to the model.
 // Only creations authored in this exact package may be previewed without a
 // pre-existing record grant; this grants no subsequent record-read authority.
 const authored=new Set(preview.changeSet.operations.filter(o=>o.type==='asset.propose'||o.type==='variant.propose').map(o=>o.operationId));
 for(const candidate of preview.plan.candidates)if(candidate.changeSetId===preview.changeSet.changeSetId&&authored.has(candidate.operationId)&&candidate.status==='created'&&candidate.assetId)visible[candidate.kind==='template'?'template':'asset'].add(candidate.assetId);
 for(const candidate of preview.plan.variantCandidates??[])if(candidate.changeSetId===preview.changeSet.changeSetId&&authored.has(candidate.operationId)&&candidate.status==='created'&&candidate.variantId&&visible.asset.has(candidate.parentCharacterId))visible.variant.add(candidate.variantId);
 return preview.plan.operations.filter(row=>row.type==='scene.convert_direct_to_recipe').map(row=>{
  const recipe=(row.resolved as{recipe?:RecipeResolvedPreview}|undefined)?.recipe;
  const entries=recipe?getSceneSnapshotEntries({slots:recipe.components,ensemble:recipe.ensemble}):[];
  const readable=(entry:typeof entries[number])=>visible[entry.snapshot.sourceType].has(entry.snapshot.sourceId)&&(!entry.snapshot.parentCharacterId||visible.asset.has(entry.snapshot.parentCharacterId));
  const missingDisclosures=[
   ...new Set(entries.filter(e=>!readable(e)).flatMap(e=>[e.snapshot.sourceType==='variant'?'variantIds':e.snapshot.sourceType==='template'?'templateIds':'assetIds',...(e.snapshot.parentCharacterId&&!visible.asset.has(e.snapshot.parentCharacterId)?['assetIds']:[])])),
   ...(entries.some(e=>e.slot==='character')&&!scope.includeCharacterIdentity?['includeCharacterIdentity']:[]),
   ...(entries.some(e=>e.slot!=='character')&&!scope.includeAssetText?['includeAssetText']:[]),
   ...(recipe?.settings.toolNotes?.trim()&&!scope.includeNotes?['includeNotes']:[]),
   ...(recipe?.sourceMediaLinks?.some(l=>Boolean(l.filename))&&!scope.includeMediaFilenames?['includeMediaFilenames']:[]),
  ];
  const share=Boolean(recipe?.outputs)&&missingDisclosures.length===0;
  return{operationId:row.operationId,readiness:recipe?.readiness??'blocked',outputDisclosure:share?'shared':'withheld',missingDisclosures,
   ...(share&&recipe?.outputs?{outputs:structuredClone(recipe.outputs)}:{}),
   components:entries.map(e=>({slot:e.slot,...(e.participantId?{participantId:e.participantId}:{}),...(readable(e)?{id:e.snapshot.sourceId,title:e.snapshot.sourceTitle,revision:e.snapshot.sourceRevision,sourceType:e.snapshot.sourceType}:{disclosure:'withheld'})})),
   pendingInputCount:recipe?.pendingInputs?.length??0,
   findingCodes:preview.plan.findings.filter(f=>f.operationId===row.operationId).map(f=>({code:f.code,severity:f.severity})),
  };
 });
}
