import type {ChangeSet,ChangeSetApproval,ChangeSetState,ImportFinding,RecipeSceneOperation} from '../types/changeSet';
import type {SavedScene,SceneDraft} from '../types/domain';
import type {ConversionMappingTarget,ConversionProvenance} from '../types/recipeConversion';
import {isDirectPrompt} from './directPrompt';
import {getRevisionHead} from './sceneRevisions';
import {getShotTypeRules} from './shotTypeRules';
import {getSceneSnapshotEntries} from './ensembleReferences';
import {collectReferenceCandidates} from './referencePack';
import {CONVERSION_PROVENANCE_SCHEMA,validateConversionInput} from './recipeConversionSchema';
import {validateJsonRule} from './changeSetValidation';
export type ConversionOperation=Extract<RecipeSceneOperation,{type:'scene.convert_direct_to_recipe'}>;
export interface ConversionSourceProof {text:string;sha256:string}
export type ConversionSourceProofs=ReadonlyMap<string,ConversionSourceProof>;
export async function hashConversionSourceText(text:string):Promise<string>{
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}

/** WebCrypto runs outside write transactions. Proofs are local arguments, never package authority. */
export async function prepareConversionSources(input:ChangeSet,scenes:readonly SavedScene[]):Promise<Map<string,ConversionSourceProof>>{
 const ids=new Set(input.operations.filter((o):o is ConversionOperation=>o.type==='scene.convert_direct_to_recipe').map(o=>o.sceneId));
 const entries=await Promise.all([...ids].map(async id=>{
  const scene=scenes.find(s=>s.id===id);if(!scene)return undefined;
  const text=scene.outputs.full;
  return [id,{text,sha256:await hashConversionSourceText(text)}] as const;
 }));
 return new Map(entries.filter((e):e is NonNullable<typeof e>=>!!e));
}
export function validateConversionSource(operation:ConversionOperation,state:ChangeSetState,proofs:ConversionSourceProofs):SavedScene{
 const source=state.scenes.find(s=>s.id===operation.sceneId);
 if(!source||!isDirectPrompt(source)||source.outputs.full!==source.directPrompt.text)throw Error('Choose an available saved Direct Prompt with consistent original text.');
 if(getRevisionHead(source,state.scenes).id!==operation.expectedHeadId)throw Error('The source revision head changed. Preview this conversion again.');
 const projectId='id'in operation.project?operation.project.id:undefined,shotId='id'in operation.shot?operation.shot.id:undefined;
 const project=state.collections.find(c=>c.id===projectId);
 const shot=project?.project?.shots.find(s=>s.id===shotId);
 if(!shot?.takeSceneIds.includes(source.id))throw Error('The original Direct Prompt must belong to this exact project shot. Choose Source and destination again.');
 const proof=proofs.get(source.id);
 if(!proof||proof.text!==source.outputs.full||proof.sha256!==operation.conversion.sourceTextSha256)throw Error('The source text/hash changed or is unavailable. Preview and review this conversion again.');
 for(const row of operation.conversion.mappings)if(row.sourceSpan){
  const {start,end}=row.sourceSpan,text=source.outputs.full;
  const split=(i:number)=>i>0&&i<text.length&&/[\uD800-\uDBFF]/.test(text[i-1])&&/[\uDC00-\uDFFF]/.test(text[i]);
  if(start<0||end>text.length||end<=start||split(start)||split(end))throw Error('A conversion source excerpt is outside the exact original text or splits a Unicode character.');
 }
 return source;
}
export function prepareConversionDraft(operation:ConversionOperation,source:SavedScene,identity:Pick<SceneDraft,'id'|'inputRevision'|'updatedAt'>):SceneDraft{
 return {...identity,title:operation.title,authoringMode:'recipe',slots:{},extraRequiredSlots:[],sceneInstructions:'',settings:{},manualOutputs:{},resultMediaLinks:[],reviewNotes:'',reviewStatus:'unreviewed',sourceSceneId:source.id,inheritedAvoidPrefix:'',
  ...(source.referencePack?{referencePack:structuredClone(source.referencePack)}:{}),
  ...(source.sourceMediaLinks?{sourceMediaLinks:structuredClone(source.sourceMediaLinks)}:{}),
  ...(source.pendingInputs?{pendingInputs:structuredClone(source.pendingInputs)}:{}),
  ...(source.claimNotes?{claimNotes:source.claimNotes}:{}),
  conversionProvenance:{...structuredClone(operation.conversion),sourceSceneId:source.id},
 };
}
export function conversionTargetKey(target:ConversionMappingTarget):string{
 if(target.kind==='slot')return 'slot:'+target.slot;
 if(target.kind==='participant')return `participant:${target.participantId}:${target.field}`;
 if(target.kind==='cue')return 'cue:'+target.cueId;
 return target.kind;
}
/** All actual bindings and authored groups must be visible in the mapping. */
export function conversionTargets(draft:SceneDraft):ConversionMappingTarget[]{
 return [
  ...getSceneSnapshotEntries(draft).map(e=>e.participantId?{kind:'participant' as const,participantId:e.participantId,field:e.slot as 'character'|'wardrobe'}:{kind:'slot' as const,slot:e.slot}),
  ...(draft.ensemble?.dialogueCues??[]).map(c=>({kind:'cue' as const,cueId:c.id})),
  {kind:'settings' as const},
  ...(draft.sceneInstructions?[{kind:'instructions' as const}]:[]),
  ...(draft.avoidText?[{kind:'avoid' as const}]:[]),
  ...(draft.referencePack?.entries.length?[{kind:'references' as const}]:[]),
  ...(draft.sourceMediaLinks?.length?[{kind:'source_media' as const}]:[]),
  ...(draft.pendingInputs?.length?[{kind:'pending_inputs' as const}]:[]),
 ];
}
export function retainConversionReferences(draft:SceneDraft,state:ChangeSetState):void{
 const entries=structuredClone(draft.referencePack?.entries??[]).sort((a,b)=>a.order-b.order),ids=new Set(entries.map(e=>e.associationId));
 for(const entry of collectReferenceCandidates(draft,new Map(state.media.map(m=>[m.id,m]))))if(!ids.has(entry.associationId)){
  entries.push(entry);ids.add(entry.associationId);
 }
 if(entries.length)draft.referencePack={version:1,entries:entries.map((e,order)=>({...e,order}))};
}
export function conversionReviewFindings(operation:ConversionOperation,approval:ChangeSetApproval,source:SavedScene,draft:SceneDraft):ImportFinding[]{
 const findings:ImportFinding[]=[],decision=approval.conversionDecisions?.[operation.operationId];
 const fail=(code:string,message:string)=>findings.push({operationId:operation.operationId,severity:'blocking',code,message});
 if(!decision?.reviewed)fail('CONVERSION_MAPPING_REVIEW','Review the original and every proposed conversion mapping before saving a new recipe take.');
 const targets=new Map(conversionTargets(draft).map(t=>[conversionTargetKey(t),t]));
 const rows=new Map(operation.conversion.mappings.map(r=>[conversionTargetKey(r.target),r]));
 for(const [key]of targets)if(!rows.has(key))fail('CONVERSION_MAPPING_MISSING',`Add a reviewed mapping for ${key}. No selected component or cue can be hidden from review.`);
 for(const row of rows.values()){
  const key=conversionTargetKey(row.target),present=targets.has(key);
  if((row.assessment==='suggested'||row.assessment==='uncertain')&&!present)fail('CONVERSION_MAPPING_UNASSIGNED',`Select the actual ${key} input or mark the optional omission explicitly.`);
  if((row.assessment==='omitted'||row.assessment==='unassigned')&&present)fail('CONVERSION_MAPPING_CONFLICT',`${key} has a selected value. Review its actual binding rather than marking it absent.`);
  if((row.assessment==='uncertain'||row.assessment==='omitted'||row.assessment==='unassigned')&&!decision?.acknowledgedRowIds.includes(row.id))fail('CONVERSION_MAPPING_REVIEW',`Review and acknowledge mapping ${row.id}: ${row.assessment}.`);
  if(row.target.kind==='slot'&&getShotTypeRules(draft).requiredSlots.includes(row.target.slot)&&!present)fail('CONVERSION_MAPPING_UNASSIGNED',`Select the required ${row.target.slot} in Recipe mapping before assembly.`);
  const target=row.target;
  if(target.kind==='participant'&&!draft.ensemble?.participants.some(p=>p.id===target.participantId))fail('CONVERSION_MAPPING_TARGET','A mapping targets an unavailable participant.');
  if(target.kind==='cue'&&!draft.ensemble?.dialogueCues.some(c=>c.id===target.cueId))fail('CONVERSION_MAPPING_TARGET','A mapping targets an unavailable dialogue cue.');
 }
 if(source.pendingInputs?.length&&!draft.pendingInputs?.length&&rows.get('pending_inputs')?.assessment!=='omitted')fail('CONVERSION_PENDING_REMOVAL','Explicitly review the omission of the original pending inputs; they were not uploaded.');
 return findings;
}
export function validateConversionProvenance(value:unknown):string|undefined{
 if(value===undefined)return;
 try{validateJsonRule(CONVERSION_PROVENANCE_SCHEMA,value,'conversion provenance');validateConversionInput(value as ConversionProvenance)}catch(error){return (error as Error).message}
}
