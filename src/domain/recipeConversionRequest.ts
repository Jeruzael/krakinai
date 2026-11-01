import type{ChangeSet,ChangeSetState,RecipeSceneOperation}from'../types/changeSet';
import type{SavedScene,SceneDraft}from'../types/domain';
import type{SceneProjectTarget}from'../types/sceneAuthoring';
import type{ConversionMappingTarget}from'../types/recipeConversion';
import{isDirectPrompt}from'./directPrompt';
import{getRevisionHead}from'./sceneRevisions';
import{getShotTypeRules}from'./shotTypeRules';
import{conversionTargetKey,prepareConversionSources,type ConversionOperation}from'./recipeConversion';
import{generateId}from'../storage/db';
const clone=<T>(x:T):T=>structuredClone(x);
/** Match the JSON transport's optional-field semantics without changing any string value. */
export const serializableMappingPackage=(input:ChangeSet):ChangeSet=>JSON.parse(JSON.stringify(input)) as ChangeSet;
export function reconcileConversionMappings(op:ConversionOperation,source:SavedScene):ConversionOperation{
 const selected=new Map<string,ConversionMappingTarget>();
 const add=(t:ConversionMappingTarget)=>selected.set(conversionTargetKey(t),t);
 for(const r of[...(op.assetRefs??[]),...(op.variantRefs??[])])add({kind:'slot',slot:r.slot});
 for(const p of op.ensemble?.participantUpserts??[]){if(p.character)add({kind:'participant',participantId:p.id,field:'character'});if(p.wardrobe)add({kind:'participant',participantId:p.id,field:'wardrobe'})}
 for(const c of op.ensemble?.dialogueCues??[])add({kind:'cue',cueId:c.id});
 add({kind:'settings'});if(op.sceneInstructions)add({kind:'instructions'});if(op.avoidText)add({kind:'avoid'});
 if(source.referencePack?.entries.length||op.references?.length)add({kind:'references'});
 if((op.sourceMedia??source.sourceMediaLinks)?.length)add({kind:'source_media'});
 if((op.pendingInputs??source.pendingInputs)?.length)add({kind:'pending_inputs'});
 const required=getShotTypeRules({shotType:op.shotType,dialogue:op.dialogue??undefined}).requiredSlots;
 const targets=new Map(selected);for(const slot of required)if(!targets.has('slot:'+slot))targets.set('slot:'+slot,{kind:'slot',slot});
 const prior=new Map(op.conversion.mappings.map(r=>[conversionTargetKey(r.target),r]));
 for(const[key,row]of prior)if(!targets.has(key))targets.set(key,row.target);
 const mappings=[...targets].map(([key,target])=>{
  const old=prior.get(key),present=selected.has(key);
  return{...(old??{id:generateId('map'),target}),assessment:present?(old&&['suggested','uncertain'].includes(old.assessment)?old.assessment:'suggested' as const):target.kind==='slot'&&required.includes(target.slot)?'unassigned' as const:'omitted' as const};
 });
 return{...op,conversion:{...op.conversion,mappings}};
}
export async function createConversionPackage(source:SavedScene,target:SceneProjectTarget,state:ChangeSetState):Promise<ChangeSet>{
 const current=state.scenes.find(s=>s.id===source.id),collection=state.collections.find(c=>c.id===target.collectionId),shot=collection?.project?.shots.find(s=>s.id===target.shotId);
 if(!current||!isDirectPrompt(current)||!shot?.takeSceneIds.includes(current.id)||collection?.project?.revision!==target.expectedProjectRevision)throw Error('Select the saved Direct Prompt and its exact current project shot before mapping.');
 let op:ConversionOperation={type:'scene.convert_direct_to_recipe',operationId:'convert',clientRef:'converted',sceneId:current.id,expectedHeadId:getRevisionHead(current,state.scenes).id,project:{id:collection.id,expectedRevision:target.expectedProjectRevision},shot:{id:shot.id},title:(current.title+' — Recipe').slice(0,100),shotType:current.shotType??'character_scene',settings:{...clone(current.settings),aspectRatio:current.settings.aspectRatio??'16:9',durationSeconds:current.settings.durationSeconds??8},sceneInstructions:'',pendingInputs:clone(current.pendingInputs??[]),conversion:{version:1,sourceTextSha256:'0'.repeat(64),mappings:[]}};
 const input:ChangeSet={schema:'krakinai.change-set.v4',changeSetId:generateId('recipe_conversion'),source:{kind:'manual',label:'Guided Direct Prompt conversion'},title:'Direct Prompt → recipe alternate take',operations:[op]};
 const proofs=await prepareConversionSources(input,[current]);op.conversion.sourceTextSha256=proofs.get(current.id)!.sha256;op=reconcileConversionMappings(op,current);input.operations=[op];return serializableMappingPackage(input);
}
export function buildConversionRequest(source:SavedScene,target:SceneProjectTarget):string{
 return `Prepare a KRAKINAI v4 recipe conversion proposal.\nProject: ${target.collectionId}\nShot: ${target.shotId}\nExpected project revision: ${target.expectedProjectRevision}\nOriginal saved Direct Prompt: ${source.id}\nRead the authorized project and krakinai_get_scene for this source (explicit full-prompt permission required). Use its sourceTextSha256 and expectedHeadId. Search authorized reusable assets and compatible Outfits before proposing missing elements. Map participants and exact dialogue cues explicitly; mark uncertainty and unresolved inputs honestly. Preview with krakinai_preview_change_set, then submit for browser review. Preserve the original, references, pending frames and preferred take. Save a genuine assembled recipe alternate take on this same shot only after human browser approval. Do not create a new project or widen read permissions. This request contains IDs only; it grants no access and includes no original prompt text.`;
}
export function ensemblePatchFromMapping(draft:SceneDraft):NonNullable<RecipeSceneOperation['ensemble']>{
 if(!draft.ensemble)throw Error('Enable participants first.');
 return{version:1,primaryParticipantId:draft.ensemble.primaryParticipantId,participantOrder:draft.ensemble.participants.map(p=>p.id),dialogueCues:clone(draft.ensemble.dialogueCues),participantUpserts:draft.ensemble.participants.map(p=>{
  if(p.character.sourceType!=='asset')throw Error('Choose an actual stored Character.');
  if(p.wardrobe&&!['asset','variant'].includes(p.wardrobe.sourceType))throw Error('Choose a stored wardrobe asset or compatible Outfit.');
  return{id:p.id,character:{asset:{id:p.character.sourceId},expectedRevision:p.character.sourceRevision},...(p.wardrobe?{wardrobe:p.wardrobe.sourceType==='variant'?{variant:{id:p.wardrobe.sourceId},expectedRevision:p.wardrobe.sourceRevision}:{asset:{id:p.wardrobe.sourceId},expectedRevision:p.wardrobe.sourceRevision}}:{}),role:p.role,presence:p.presence,performanceNotes:p.performanceNotes,...(p.generation?.identitySource?{identitySource:p.generation.identitySource}:{})};
 })};
}
