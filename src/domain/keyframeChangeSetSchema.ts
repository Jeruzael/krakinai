import type {JsonRule} from './changeSetSchema';
import {BLOCKING_DIGEST_RULE as digest,BLOCKING_PARTICIPANT_RULE as participant,BLOCKING_PHASE_PATCH_RULE as phase,BLOCKING_HOLDER_RULE as holder} from './blockingChangeSetSchema';
import {RECIPE_SCENE_FIELDS} from './recipeChangeSetSchema';
const obj=(properties:Record<string,JsonRule>,required:string[]=[]):JsonRule=>({type:'object',properties,required,additionalProperties:false});
const arr=(items:JsonRule,maxItems:number):JsonRule=>({type:'array',items,maxItems});
const text=(maxLength:number):JsonRule=>({type:'string',maxLength});
const nullable=(rule:JsonRule):JsonRule=>({oneOf:[rule,{type:'null'}]});
const local:JsonRule={type:'string',minLength:1,maxLength:64,pattern:'^(?!(?:constructor|prototype|__proto__)$)[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$'};
const revision:JsonRule={type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER};
const instant:JsonRule={oneOf:[
 obj({kind:{const:'linked_phase'},phase:{enum:['start','end']}},['kind','phase']),
 obj({kind:{const:'custom'},participantUpserts:arr(obj({participant,bindingToken:text(4096),wardrobeBindingToken:nullable(text(4096)),bindToRecipe:{const:true},phase:nullable(phase)},['participant']),8),removeParticipants:arr(participant,8),participantOrder:arr(participant,8),propUpserts:arr(obj({propId:local,holder},['propId','holder']),16),removePropIds:arr(local,16)},['kind']),
]};
export const KEYFRAME_PATCH_SCHEMA:JsonRule=obj({
 version:{const:1},expectedBaseDigest:digest,id:local,
 frameUpserts:arr(obj({id:local,label:nullable(text(120)),role:nullable({enum:['start','intermediate','end','custom']}),relativePosition:nullable({type:'number',minimum:0,maximum:1}),timeSeconds:nullable({type:'number',minimum:0,maximum:60}),participantRefs:nullable(arr(participant,8)),visualInstructions:nullable(text(2000)),instant:nullable(instant),expressionUpserts:arr(obj({participant,text:nullable(text(500))},['participant','text']),8),composition:nullable(obj({instructions:nullable(text(2000)),cameraComposition:nullable(RECIPE_SCENE_FIELDS.cameraComposition.oneOf![0])})),referenceAssociationIds:nullable(arr(text(4096),2000))},['id']),16),
 removeFrameIds:arr(local,16),frameOrder:arr(local,16),
 stillSourceAdaptations:nullable(obj({camera:nullable(text(2000)),action:nullable(text(2000)),sceneInstructions:nullable(text(2000)),omittedSources:nullable(arr({enum:['camera','action','sceneInstructions']},3))})),
},['version','expectedBaseDigest']);

export function createKeyframeChangeSetSchema(v5:JsonRule,nativeId:JsonRule):JsonRule{
 const schema=structuredClone(v5),ops=schema.properties!.operations.items!.oneOf!;
 schema.$id='https://krakinai.local/schemas/change-set-v6.json';schema.title='KRAKINAI Change Set v6';schema.properties!.schema={const:'krakinai.change-set.v6'};
 for(const op of ops){
  if(!['scene.create_recipe','scene.revise_recipe','scene.create_recipe_take','scene.convert_direct_to_recipe'].includes(String(op.properties!.type.const)))continue;
  op.properties!.keyframes=nullable(KEYFRAME_PATCH_SCHEMA);op.properties!.videoDecision={enum:['keep_exact_unverified','reassemble']};
  op.properties!.imageCarryOver=arr(obj({frameId:local,associationId:nativeId,expectedRevision:revision},['frameId','associationId','expectedRevision']),16);
  if(op.properties!.type.const!=='scene.create_recipe'){op.properties!.expectedKeyframeDigest=digest;op.required!.push('expectedKeyframeDigest');}
 }
 const scene={oneOf:[obj({id:nativeId},['id']),obj({ref:nativeId},['ref'])]},project={oneOf:[obj({id:nativeId,expectedRevision:revision},['id','expectedRevision']),obj({ref:nativeId},['ref'])]},shot={oneOf:[obj({id:nativeId},['id']),obj({ref:nativeId},['ref'])]};
 const base={operationId:nativeId,project,shot,scene,expectedSceneRevision:{...revision,minimum:1}},target={...base,frameId:local,expectedFrameDigest:digest,expectedAssociationRevision:revision};
 ops.push(obj({...target,type:{const:'frame_image.link'},mediaId:nativeId},['operationId','type','project','shot','scene','frameId','expectedFrameDigest','expectedAssociationRevision','mediaId']));
 ops.push(obj({...target,type:{const:'frame_image.clear'}},['operationId','type','project','shot','scene','frameId','expectedFrameDigest','expectedAssociationRevision']));
 ops.push(obj({...base,type:{const:'frame_video.request_review'},expectedKeyframeDigest:digest},['operationId','type','project','shot','scene','expectedKeyframeDigest']));
 return schema;
}
