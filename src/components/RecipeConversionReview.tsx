import React from 'react';
import type{ChangeSetApproval,ImportOperationPreview}from'../types/changeSet';
import type{SavedScene,ComponentSnapshot}from'../types/domain';
import type{ConversionMappingTarget}from'../types/recipeConversion';
import type{ConversionOperation}from'../domain/recipeConversion';
import type{RecipeResolvedPreview}from'../domain/changeSetRecipe';
import{conversionTargetKey}from'../domain/recipeConversion';
import{getActiveReferencePack}from'../domain/shotTypeRules';
import{SLOT_LABELS}from'../domain/validation';
import './recipeConversion.css';
export function RecipeConversionReview({row,source,approval,onApproval,disabled}:{row:ImportOperationPreview;source?:SavedScene;approval:ChangeSetApproval;onApproval(value:ChangeSetApproval):void;disabled:boolean}){
 const operation=row.details as ConversionOperation,recipe=(row.resolved as{recipe?:RecipeResolvedPreview}|undefined)?.recipe;
 const decision=approval.conversionDecisions?.[row.operationId]??{reviewed:false,acknowledgedRowIds:[]};
 const update=(next:typeof decision)=>onApproval({...approval,conversionDecisions:{...approval.conversionDecisions,[row.operationId]:next}});
 const snapshot=(t:ConversionMappingTarget):ComponentSnapshot|undefined=>{
  if(t.kind==='slot')return recipe?.components[t.slot];
  if(t.kind==='participant')return recipe?.ensemble?.participants.find(p=>p.id===t.participantId)?.[t.field];
 };
 const value=(t:ConversionMappingTarget)=>{
  const selected=snapshot(t);if(selected)return <><strong>{selected.sourceTitle}</strong><code>{selected.sourceId} · rev {selected.sourceRevision}</code></>;
  if(t.kind==='cue'){const cue=recipe?.ensemble?.dialogueCues.find(c=>c.id===t.cueId);return cue?`${cue.speaker} · ${cue.id} · ${cue.mode??'spoken'}`:'Unassigned cue';}
  if(t.kind==='settings')return `${recipe?.settings.aspectRatio??operation.settings.aspectRatio??'Not selected'} · ${recipe?.settings.durationSeconds??operation.settings.durationSeconds??'?'}s`;
  if(t.kind==='pending_inputs')return `${recipe?.pendingInputs?.length??operation.pendingInputs?.length??source?.pendingInputs?.length??0} pending — not uploaded`;
  if(t.kind==='references')return `${recipe?.referencePack?.entries.length??source?.referencePack?.entries.length??0} retained associations`;
  if(t.kind==='source_media')return `${recipe?.sourceMediaLinks?.length??0} original source file(s)`;
  if(t.kind==='instructions')return 'Scene-only instructions; complete text in the recipe preview';
  if(t.kind==='avoid')return 'Scene-only negative instructions';
  return 'Unassigned — use Recipe mapping to select an input';
 };
 const total=recipe?.referencePack?.entries.length??0;
 const active=recipe?getActiveReferencePack({slots:recipe.components,ensemble:recipe.ensemble,shotType:recipe.shotType,sourceMediaLinks:recipe.sourceMediaLinks,referencePack:recipe.referencePack})?.entries.length??0:0;
 const original=source?.outputs.full??row.currentPrompt;
 const label=(t:ConversionMappingTarget)=>t.kind==='slot'?SLOT_LABELS[t.slot]:t.kind==='participant'?`${t.participantId} — ${SLOT_LABELS[t.field]}`:t.kind==='cue'?`Dialogue cue ${t.cueId}`:({settings:'Shot settings',instructions:'Scene instructions',avoid:'Negative instructions',references:'Reference associations',source_media:'Original source media',pending_inputs:'Pending production inputs'}[t.kind]);
 return <section className="conversion-review" aria-label="Direct Prompt conversion review">
  <h3>Direct Prompt → recipe alternate take</h3>
  <p className="banner banner-info">The original stays unchanged. This new take is assembled from the mapped components; wording and formatting can differ. The preferred take stays unchanged unless separately approved.</p>
  <details><summary>Original Direct Prompt (preserved)</summary><p><code>{operation.sceneId}</code> · expected head <code>{operation.expectedHeadId}</code></p><pre role="region" tabIndex={0} aria-label="Original Direct Prompt text">{original??'Original unavailable. Select the saved source again.'}</pre></details>
  <div className="import-recipe-components" tabIndex={0} role="region" aria-label="Conversion mapping table scroll area"><table aria-label="Direct Prompt conversion mapping"><thead><tr><th scope="col">Mapping</th><th scope="col">Actual selection</th><th scope="col">Assessment</th><th scope="col">Review</th></tr></thead><tbody>{operation.conversion.mappings.map(mapping=><tr key={mapping.id}>
   <th scope="row">{label(mapping.target)}<small>{conversionTargetKey(mapping.target)} · {mapping.id}</small></th><td>{value(mapping.target)}</td><td>{mapping.assessment}{mapping.explanation&&<p>{mapping.explanation}</p>}{mapping.sourceSpan&&original&&<details><summary>Source excerpt</summary><pre>{original.slice(mapping.sourceSpan.start,mapping.sourceSpan.end)}</pre></details>}</td>
   <td>{['uncertain','omitted','unassigned'].includes(mapping.assessment)?<label className="import-check"><input type="checkbox" disabled={disabled} aria-label={`Acknowledge ${mapping.id} (${mapping.assessment})`} checked={decision.acknowledgedRowIds.includes(mapping.id)} onChange={e=>update({reviewed:false,acknowledgedRowIds:e.target.checked?[...decision.acknowledgedRowIds,mapping.id]:decision.acknowledgedRowIds.filter(id=>id!==mapping.id)})}/>Reviewed {mapping.assessment}</label>:'Review in context'}</td>
  </tr>)}</tbody></table></div>
  {total>0&&<p>{total} retained reference associations · {active} active for generation. Inactive captured references remain stored. Source results are context, not new generation results.</p>}
  <label className="import-check"><input type="checkbox" disabled={disabled} aria-label={`I reviewed conversion mapping (${row.operationId})`} checked={decision.reviewed} onChange={e=>update({...decision,reviewed:e.target.checked})}/>I reviewed this mapping, its original, pending inputs and newly assembled outputs.</label>
 </section>;
}
