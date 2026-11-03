import type {SceneDraft,SavedScene} from '../types/domain';
import type {SceneBlockingV1} from '../types/blocking';
import type {BlockingPatchV1} from '../types/blockingChangeSet';
import type {RecipeSceneOperation,ChangeSetState} from '../types/changeSet';
import {canonicalStringify,changeSetDigest} from './changeSetCanonical';
import {blockingBindingToken,blockingParticipantKey,blockingParticipantSources,validateSceneBlocking} from './blockingValidation';
import {getActiveSceneSlots} from './shotTypeRules';
import {validateJsonRule} from './changeSetValidation';
import {BLOCKING_PATCH_SCHEMA} from './blockingChangeSetSchema';

export const blockingDigest=(value:SceneBlockingV1|undefined)=>changeSetDigest(value??null);
// SHA-256 of canonical JSON null; no asynchronous hashing inside a write transaction.
export const NULL_BLOCKING_DIGEST='74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b';
/** This complete frozen record is a concurrency proof, never a permission grant. */
export const blockingSourceSignature=(scene:SavedScene)=>canonicalStringify(scene);
export type BlockingSourceProofs=Map<string,{signature:string;recipeDigest:string;blockingDigest:string}>;
export async function prepareBlockingSources(scenes:SavedScene[]):Promise<BlockingSourceProofs>{
 return new Map(await Promise.all(scenes.map(async scene=>[scene.id,{signature:blockingSourceSignature(scene),recipeDigest:await changeSetDigest(scene),blockingDigest:await blockingDigest(scene.blocking)}] as const)));
}
export function validateBlockingSource(op:RecipeSceneOperation,state:ChangeSetState,proofs:BlockingSourceProofs):void{
 if(op.type==='scene.create_recipe')return;
 const scene=state.scenes.find(s=>s.id===op.sceneId),proof=proofs.get(op.sceneId);
 if(!scene||!proof||proof.signature!==blockingSourceSignature(scene)||op.expectedSourceRecipeDigest!==proof.recipeDigest||op.expectedBlockingDigest!==proof.blockingDigest||op.expectedSourceRevision!==scene.revision)throw Error('Blocking source recipe, revision or digest changed. Read the exact source and preview again.');
 if(!('id'in op.project)||!('id'in op.shot))throw Error('Existing v5 scenes require exact project and shot IDs.');
 const projectId=op.project.id,shotId=op.shot.id;
 const project=state.collections.find(c=>c.id===projectId),shot=project?.project?.shots.find(s=>s.id===shotId);
 if(!shot?.takeSceneIds.includes(scene.id))throw Error('Blocking source is not a take of the exact target shot.');
}
type Row=Record<string,any>;
function merge(base:Row|undefined,patch:Row):Row{
 const result=structuredClone(base??{});
 for(const [key,value]of Object.entries(patch)){
  if(value===null)delete result[key];
  else if(value&&typeof value==='object'&&!Array.isArray(value)&&!(value.kind&&value.kind!==result[key]?.kind))result[key]=merge(result[key],value);
  else result[key]=structuredClone(value);
 }
 return result;
}
function rows<T extends Row>(base:T[],upserts:T[]|undefined,remove:string[]|undefined,order:string[]|undefined,key:(r:T)=>string,update:(old:T|undefined,row:T)=>T=(old,row)=>merge(old,row) as T):T[]{
 const added=upserts??[],removed=remove??[],keys=added.map(key);
 if(new Set(keys).size!==keys.length||new Set(removed).size!==removed.length||keys.some(k=>removed.includes(k)))throw Error('Duplicate or conflicting blocking patch IDs.');
 if(removed.some(k=>!base.some(row=>key(row)===k)))throw Error('Cannot remove an unknown blocking ID.');
 let result=structuredClone(base.filter(row=>!removed.includes(key(row))));
 for(const row of added){const index=result.findIndex(old=>key(old)===key(row)),next=update(index<0?undefined:result[index],row);if(index<0)result.push(next);else result[index]=next;}
 if(order){if(order.length!==result.length||new Set(order).size!==order.length||order.some(k=>!result.some(row=>key(row)===k)))throw Error('Blocking order must list every resulting exact ID once.');result=order.map(k=>result.find(row=>key(row)===k)!);}
 return result;
}
/** Pure targeted patching; the same strict Blocking validator checks the resulting recipe. */
export function applyBlockingPatch(base:SceneBlockingV1|undefined,patch:BlockingPatchV1|null|undefined,source:SceneDraft,baseDigest:string):SceneBlockingV1|undefined{
 if(patch===undefined)return structuredClone(base);if(patch===null)return undefined;
 validateJsonRule(BLOCKING_PATCH_SCHEMA,patch,'blocking');
 if(patch.expectedBaseDigest!==baseDigest)throw Error('Blocking base digest changed. Preview the exact source again.');
 const next=structuredClone(base??{version:1,participants:[],landmarks:[],props:[]}) as SceneBlockingV1;
 next.landmarks=rows(next.landmarks,patch.landmarkUpserts as any,patch.removeLandmarkIds,patch.landmarkOrder,r=>r.id);
 next.props=rows(next.props,patch.propUpserts as any,patch.removePropIds,patch.propOrder,r=>r.id);
 next.participants=rows(next.participants,patch.participantUpserts as any,patch.removeParticipants?.map(blockingParticipantKey),patch.participantOrder?.map(blockingParticipantKey),r=>blockingParticipantKey(r.participant),(old,upsert)=>{
  const {bindToRecipe,action,...fields}=upsert as unknown as Row;
  const row=merge(old,fields);
  if(action===null)delete row.action;
  else if(action!==undefined){const {interactionUpserts,removeInteractionIds,interactionOrder,...actionFields}=action;row.action=merge(old?.action,actionFields);const interactions=rows(old?.action?.interactions??[],interactionUpserts,removeInteractionIds,interactionOrder,(i:Row)=>i.id);if(old?.action?.interactions!==undefined||interactionUpserts||removeInteractionIds||interactionOrder)row.action.interactions=interactions;}
  if(bindToRecipe){const bound=blockingParticipantSources(source).find(p=>blockingParticipantKey(p.ref)===blockingParticipantKey(row.participant));if(!bound)throw Error('Explicit binding requires an existing resulting recipe participant.');row.bindingToken=blockingBindingToken(bound.character);if(bound.wardrobe)row.wardrobeBindingToken=blockingBindingToken(bound.wardrobe);else delete row.wardrobeBindingToken;}
  return row as any;
 });
 for(const field of ['space','camera'] as const){const value=patch[field];if(value===null)delete next[field];else if(value!==undefined){const {bindToRecipe,...fields}=value as Row;Object.assign(next,{[field]:merge(next[field],fields)});if(field==='space'&&bindToRecipe){const environment=getActiveSceneSlots(source).environment;if(environment)next.space!.environmentBindingToken=blockingBindingToken(environment);else delete next.space!.environmentBindingToken;}}}
 const findings=validateSceneBlocking(next,source,'planning').filter(f=>f.severity==='blocking');
 if(findings.length)throw Error(findings.map(f=>`${f.path}: ${f.message}`).join(' '));
 return next;
}
