import type {JsonRule} from './changeSetSchema';
import type {ConversionInput} from '../types/recipeConversion';
const object=(properties:Record<string,JsonRule>,required=Object.keys(properties)):JsonRule=>({type:'object',properties,required,additionalProperties:false});
const localId:JsonRule={type:'string',minLength:1,maxLength:64,pattern:'^(?!(?:constructor|prototype|__proto__)$)[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$'};
const nativeId:JsonRule={type:'string',minLength:1,maxLength:200,pattern:'^(?!(?:constructor|prototype|__proto__)$)[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$'};
const index:JsonRule={type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER};
export const CONVERSION_MAPPING_RULE:JsonRule=object({
 id:localId,
 target:{oneOf:[
  object({kind:{const:'slot'},slot:{enum:['character','wardrobe','environment','action','camera','lighting','style']}}),
  object({kind:{const:'participant'},participantId:localId,field:{enum:['character','wardrobe']}}),
  object({kind:{const:'cue'},cueId:localId}),
  ...['settings','instructions','avoid','references','source_media','pending_inputs'].map(kind=>object({kind:{const:kind}})),
 ]},
 assessment:{enum:['suggested','uncertain','unassigned','omitted']},
 explanation:{type:'string',maxLength:500},
 sourceSpan:object({start:index,end:index}),
},['id','target','assessment']);
export const CONVERSION_INPUT_SCHEMA:JsonRule=object({version:{const:1},sourceTextSha256:{type:'string',pattern:'^[a-f0-9]{64}$',minLength:64,maxLength:64},mappings:{type:'array',minItems:1,maxItems:128,items:CONVERSION_MAPPING_RULE}});
export const CONVERSION_PROVENANCE_SCHEMA:JsonRule=object({...CONVERSION_INPUT_SCHEMA.properties,sourceSceneId:nativeId});
export function createConversionChangeSetSchema(v3:JsonRule,id:JsonRule):JsonRule{
 const v4=structuredClone(v3),ops=v4.properties!.operations.items!.oneOf!;
 const create=structuredClone(ops.find(o=>o.properties!.type.const==='scene.create_recipe')!);
 create.properties!.type={const:'scene.convert_direct_to_recipe'};
 create.properties!.sceneId=id;create.properties!.expectedHeadId=id;
 create.properties!.conversion=CONVERSION_INPUT_SCHEMA;
 create.properties!.project=structuredClone(create.properties!.project.oneOf!.find(r=>r.properties?.id)!);
 create.properties!.shot=object({id});
 create.required!.push('sceneId','expectedHeadId','conversion');
 ops.push(create);v4.$id='https://krakinai.local/schemas/change-set-v4.json';
 v4.title='KRAKINAI Change Set v4';v4.properties!.schema={const:'krakinai.change-set.v4'};
 return v4;
}
/** Semantic checks shared by packages and frozen provenance; source-specific checks are separate. */
export function validateConversionInput(input:ConversionInput):void{
 const ids=new Set<string>(),targets=new Set<string>();
 for(const row of input.mappings){
  if(ids.has(row.id))throw Error('Duplicate conversion mapping row ID.');ids.add(row.id);
  const target=JSON.stringify(row.target,Object.keys(row.target).sort());
  if(targets.has(target))throw Error('Duplicate conversion mapping target.');targets.add(target);
  if(row.sourceSpan&&row.sourceSpan.end<=row.sourceSpan.start)throw Error('Invalid conversion source span.');
 }
}
