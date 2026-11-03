import type {ChangeSet,ChangeSetPreview,ChangeSetState} from '../types/changeSet';
import type {SavedScene,SceneDraft} from '../types/domain';
import type {SceneBlockingV1} from '../types/blocking';
import type {BlockingPatchV1} from '../types/blockingChangeSet';
import type {RecipeResolvedPreview} from './changeSetRecipe';
import {isRecipeOperation} from '../types/changeSet';
import {blockingSourceTokens} from './blockingMcp';
import {parseChangeSet} from './changeSetValidation';
import {serializableMappingPackage} from './recipeConversionRequest';

/** Explicit format promotion. Resuming v5 never refreshes stale source proofs. */
export async function enableBlockingMapping(input:ChangeSet,state:ChangeSetState):Promise<ChangeSet>{
 if(input.schema==='krakinai.change-set.v5')return input;
 if(input.schema!=='krakinai.change-set.v4')throw Error('Choose a v4/v5 conversion mapping package.');
 const next=structuredClone(input);next.schema='krakinai.change-set.v5';
 for(const op of next.operations)if(isRecipeOperation(op)&&'sceneId'in op){const source=state.scenes.find(s=>s.id===op.sceneId);if(!source)throw Error('A mapped source is missing. Keep this package and restore its exact source before planning.');Object.assign(op,await blockingSourceTokens(source));}
 return parseChangeSet(serializableMappingPackage(next));
}

/** Whole new plan against the immutable Direct Prompt's empty Blocking base.
 * Keep captured binding tokens; mapping another asset must require explicit repair.
 */
export function conversionBlockingPatch(plan:SceneBlockingV1|undefined,baseDigest:string):BlockingPatchV1|null{
 if(!plan)return null;
 return {version:1,expectedBaseDigest:baseDigest,
  participantUpserts:plan.participants.map(({action,...track})=>{if(!action)return structuredClone(track);const {interactions,...fields}=action;return {...structuredClone(track),action:{...structuredClone(fields),...(interactions?{interactionUpserts:structuredClone(interactions)}:{})}};}),
  participantOrder:plan.participants.map(p=>structuredClone(p.participant)),
  landmarkUpserts:structuredClone(plan.landmarks),landmarkOrder:plan.landmarks.map(l=>l.id),
  propUpserts:structuredClone(plan.props),propOrder:plan.props.map(p=>p.id),
  ...(plan.space?{space:structuredClone(plan.space)}:{}),...(plan.camera?{camera:structuredClone(plan.camera)}:{}),
 };
}

/** Transient guided Recipe draft: no record ID is claimed to exist in IndexedDB. */
export function conversionBlockingDraft(input:ChangeSet,operationId:string,source:SavedScene,preview:ChangeSetPreview):SceneDraft|undefined{
 const op=input.operations.find(o=>o.operationId===operationId&&o.type==='scene.convert_direct_to_recipe');
 const row=preview.plan.operations.find(o=>o.operationId===operationId),data=row?.resolved as {recipe?:RecipeResolvedPreview;blocking?:{after:SceneBlockingV1|null}}|undefined,recipe=data?.recipe;
 if(!op||op.type!=='scene.convert_direct_to_recipe'||!recipe)return;
 return {id:`mapping:${input.changeSetId}:${operationId}`,inputRevision:1,updatedAt:source.updatedAt,title:op.title,authoringMode:'recipe',sourceSceneId:source.id,
  slots:structuredClone(recipe.components),...(recipe.ensemble?{ensemble:structuredClone(recipe.ensemble)}:{}),shotType:recipe.shotType,extraRequiredSlots:[],sceneInstructions:recipe.sceneInstructions,settings:structuredClone(recipe.settings),
  dialogue:structuredClone(recipe.dialogue),avoidText:recipe.avoidText,sourceMediaLinks:structuredClone(recipe.sourceMediaLinks),referencePack:structuredClone(recipe.referencePack),pendingInputs:structuredClone(recipe.pendingInputs),generation:structuredClone(recipe.generation),
  manualOutputs:{},resultMediaLinks:[],reviewNotes:'',reviewStatus:'unreviewed',blocking:structuredClone(data?.blocking?.after??undefined),conversionProvenance:{...structuredClone(op.conversion),sourceSceneId:source.id},
 };
}
