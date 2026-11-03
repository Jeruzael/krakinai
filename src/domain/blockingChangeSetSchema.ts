import type {JsonRule} from './changeSetSchema';
import {BLOCKING_LOCAL_ID_PATTERN} from '../types/blocking';
const obj=(properties:Record<string,JsonRule>,required:string[]=[]):JsonRule=>({type:'object',properties,required,additionalProperties:false});
const arr=(items:JsonRule,maxItems:number):JsonRule=>({type:'array',items,maxItems});
const text=(maxLength:number):JsonRule=>({type:'string',maxLength});
const id:JsonRule={type:'string',minLength:1,maxLength:64,pattern:BLOCKING_LOCAL_ID_PATTERN};
export const BLOCKING_DIGEST_RULE:JsonRule={type:'string',minLength:64,maxLength:64,pattern:'^[a-f0-9]{64}$'};
const nullable=(rule:JsonRule):JsonRule=>({oneOf:[rule,{type:'null'}]});
const choices=(...values:string[]):JsonRule=>({enum:values});
const participant:JsonRule={oneOf:[obj({kind:{const:'primary'}},['kind']),obj({kind:{const:'ensemble'},participantId:id},['kind','participantId'])]};
const target:JsonRule={oneOf:[obj({kind:{const:'participant'},participant},['kind','participant']),obj({kind:{const:'landmark'},landmarkId:id},['kind','landmarkId']),obj({kind:{const:'camera'}},['kind'])]};
const interactionTarget:JsonRule={oneOf:[...target.oneOf!,obj({kind:{const:'prop'},propId:id},['kind','propId'])]};
const direction:JsonRule={oneOf:[obj({kind:{const:'target'},target},['kind','target']),obj({kind:{const:'screen'},direction:choices('toward_camera','away_from_camera','screen_left','screen_right','toward_left','toward_right','away_left','away_right')},['kind','direction'])]};
const zone=choices('left','center','right','unspecified'),depth=choices('foreground','midground','background','unspecified');
const phase=obj({visibility:nullable(choices('on_screen','out_of_frame','unspecified')),zone:nullable(zone),depth:nullable(depth),scenePlacement:nullable(obj({landmarkId:id,relation:choices('at','near','left_of','right_of','in_front_of','behind')},['landmarkId','relation'])),bodyDirection:nullable(direction),headDirection:nullable(direction),eyeline:nullable(target),pose:nullable(text(500))});
const interaction:JsonRule={oneOf:[
 obj({id,kind:choices('approach','follow','face','touch','gesture_to','avoid'),target:interactionTarget},['id','kind','target']),
 obj({id,kind:{const:'transfer_prop'},propId:id,from:participant,to:participant},['id','kind','propId','from','to']),
 obj({id,kind:{const:'custom'},description:text(1000),target:interactionTarget},['id','kind','description']),
]};
const holder:JsonRule={oneOf:[obj({kind:{const:'participant'},participant},['kind','participant']),obj({kind:{const:'shared'},participants:{...arr(participant,8),minItems:2}},['kind','participants']),obj({kind:{const:'landmark'},landmarkId:id},['kind','landmarkId']),...['unheld','unspecified'].map(kind=>obj({kind:{const:kind}},['kind']))]};
export const BLOCKING_PARTICIPANT_RULE=participant;
export const BLOCKING_PHASE_PATCH_RULE=phase;
export const BLOCKING_HOLDER_RULE=holder;
const action=obj({kind:choices('hold','move','enter','exit','custom','unspecified'),text:nullable(text(500)),waypointLandmarkIds:nullable(arr(id,4)),interactionUpserts:arr(interaction,32),removeInteractionIds:arr(id,32),interactionOrder:arr(id,32)});
export const BLOCKING_PATCH_SCHEMA:JsonRule=obj({
 version:{const:1},expectedBaseDigest:BLOCKING_DIGEST_RULE,
 participantUpserts:arr(obj({participant,bindToRecipe:{const:true},bindingToken:text(4096),wardrobeBindingToken:nullable(text(4096)),start:nullable(phase),action:nullable(action),end:nullable(phase)},['participant']),8),
 removeParticipants:arr(participant,8),participantOrder:arr(participant,8),
 landmarkUpserts:arr(obj({id,label:text(120),description:nullable(text(1000)),screen:nullable(obj({zone:nullable(zone),depth:nullable(depth)}))},['id']),16),removeLandmarkIds:arr(id,16),landmarkOrder:arr(id,16),
 propUpserts:arr(obj({id,label:text(120),description:nullable(text(1000)),startHolder:nullable(holder),endHolder:nullable(holder)},['id']),16),removePropIds:arr(id,16),propOrder:arr(id,16),
 space:nullable(obj({id,bindToRecipe:{const:true},environmentBindingToken:nullable(text(4096)),originLandmarkId:nullable(id),forwardLandmarkId:nullable(id)})),
 camera:nullable(obj({direction:nullable(target),axis:nullable(obj({id,from:target,to:target,side:choices('A','B','on_axis','unspecified')},['id','from','to','side']))})),
},['version','expectedBaseDigest']);
export function createBlockingChangeSetSchema(v4:JsonRule):JsonRule{
 const schema=structuredClone(v4);schema.$id='https://krakinai.local/schemas/change-set-v5.json';schema.title='KRAKINAI Change Set v5';schema.properties!.schema={const:'krakinai.change-set.v5'};
 for(const op of schema.properties!.operations.items!.oneOf!){
  if(!['scene.create_recipe','scene.revise_recipe','scene.create_recipe_take','scene.convert_direct_to_recipe'].includes(String(op.properties!.type.const)))continue;
  op.properties!.blocking=nullable(BLOCKING_PATCH_SCHEMA);
  if(op.properties!.type.const==='scene.create_recipe')continue;
  op.properties!.expectedSourceRecipeDigest=BLOCKING_DIGEST_RULE;op.properties!.expectedBlockingDigest=BLOCKING_DIGEST_RULE;
  op.properties!.expectedSourceRevision={type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER};
  op.required!.push('expectedSourceRecipeDigest','expectedBlockingDigest','expectedSourceRevision');
  const project=op.properties!.project;if(project.oneOf)op.properties!.project=structuredClone(project.oneOf.find(r=>r.properties?.id)!);
  const shot=op.properties!.shot;if(shot.oneOf)op.properties!.shot=structuredClone(shot.oneOf.find(r=>r.properties?.id)!);
 }
 return schema;
}
