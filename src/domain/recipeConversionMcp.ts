import type{ChangeSetPreview}from'../types/changeSet';
import type{McpScope}from'../types/mcp';
import type{RecipeResolvedPreview}from'./changeSetRecipe';
import{getSceneSnapshotEntries}from'./ensembleReferences';
/** Bounded preview only. Neither text disclosure nor these digests confer write authority. */
export function conversionMcpPreview(preview:ChangeSetPreview,scope:McpScope){
 if(preview.changeSet.schema!=='krakinai.change-set.v4')return undefined;
 return preview.plan.operations.filter(row=>row.type==='scene.convert_direct_to_recipe').map(row=>{
  const recipe=(row.resolved as{recipe?:RecipeResolvedPreview}|undefined)?.recipe;
  const entries=recipe?getSceneSnapshotEntries({slots:recipe.components,ensemble:recipe.ensemble}):[];
  const missingDisclosures=[
   ...(entries.some(e=>e.slot==='character')&&!scope.includeCharacterIdentity?['includeCharacterIdentity']:[]),
   ...(entries.some(e=>e.slot!=='character')&&!scope.includeAssetText?['includeAssetText']:[]),
   ...(recipe?.settings.toolNotes?.trim()&&!scope.includeNotes?['includeNotes']:[]),
   ...(recipe?.sourceMediaLinks?.some(l=>Boolean(l.filename))&&!scope.includeMediaFilenames?['includeMediaFilenames']:[]),
  ];
  const share=Boolean(recipe?.outputs)&&missingDisclosures.length===0;
  return{operationId:row.operationId,readiness:recipe?.readiness??'blocked',outputDisclosure:share?'shared':'withheld',missingDisclosures,
   ...(share&&recipe?.outputs?{outputs:structuredClone(recipe.outputs)}:{}),
   components:entries.map(e=>({slot:e.slot,...(e.participantId?{participantId:e.participantId}:{}),id:e.snapshot.sourceId,title:e.snapshot.sourceTitle,revision:e.snapshot.sourceRevision,sourceType:e.snapshot.sourceType})),
   pendingInputCount:recipe?.pendingInputs?.length??0,
   findingCodes:preview.plan.findings.filter(f=>f.operationId===row.operationId).map(f=>({code:f.code,severity:f.severity})),
  };
 });
}
