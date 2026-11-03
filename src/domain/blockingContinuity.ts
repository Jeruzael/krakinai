import type {SavedScene} from '../types/domain';
import type {ParticipantRef,BlockingFinding,TargetRef,BlockingDirection,BlockingHolder,BlockingParticipantSource} from '../types/blocking';
import {blockingParticipantSources,blockingParticipantKey,blockingBindingToken,validateSceneBlocking} from './blockingValidation';
import {canonicalStringify as keyOf} from './changeSetCanonical';
export interface BlockingSpatialFinding extends BlockingFinding {previousSceneId:string;currentSceneId:string;participant?:ParticipantRef;propId?:string;before:unknown;after:unknown}
export interface BlockingComparison {previousSceneId:string;currentSceneId:string;comparable:boolean;basis:{spaceId?:string;axisKey?:string;participantPairs:{previous:ParticipantRef;current:ParticipantRef}[];reason?:'missing_blocking'|'invalid_blocking'|'unbound'|'ambiguous_participants'|'space_mismatch'|'axis_mismatch'|'no_common_participants'};findings:BlockingSpatialFinding[]}
export interface BlockingComparisonOptions {participantPairs?:{previous:ParticipantRef;current:ParticipantRef}[]}
export function compareBlockingPair(previous:SavedScene,current:SavedScene,options:BlockingComparisonOptions={}):BlockingComparison{
 const result:BlockingComparison={previousSceneId:previous.id,currentSceneId:current.id,comparable:false,basis:{participantPairs:[]},findings:[]};
 const note=(reason:NonNullable<BlockingComparison['basis']['reason']>)=>{result.basis.reason??=reason;};
 if(!previous.blocking||!current.blocking){note('missing_blocking');return result;}
 if([previous,current].some(scene=>validateSceneBlocking(scene.blocking,scene,'assembly').some(f=>f.severity==='blocking'))){note('invalid_blocking');return result;}
 const a=previous.blocking,b=current.blocking;
 const oldSources=blockingParticipantSources(previous),newSources=blockingParticipantSources(current),oldMap=new Map(oldSources.map(p=>[blockingParticipantKey(p.ref),p]));
 const duplicates=(sources:BlockingParticipantSource[])=>{const counts=new Map<string,number>();for(const p of sources){const k=keyOf([p.character.sourceType,p.character.sourceId]);counts.set(k,(counts.get(k)??0)+1);}return counts;};
 const oldCounts=duplicates(oldSources),newCounts=duplicates(newSources),common=new Set<string>();
 // A local read-only mapping can confirm a repeated appearance with the exact same
 // participant ID. It cannot equate different identities or silently retarget IDs.
 const confirmed=new Set((options.participantPairs??[]).filter(p=>blockingParticipantKey(p.previous)===blockingParticipantKey(p.current)).map(p=>blockingParticipantKey(p.current)));
 for(const p of newSources){
  const key=blockingParticipantKey(p.ref),old=oldMap.get(key);if(!old)continue;
  if(p.character.sourceType!=='asset'||old.character.sourceType!=='asset'){note('unbound');continue;}
  const identity=keyOf([p.character.sourceType,p.character.sourceId]);
  if(((newCounts.get(identity)??0)>1||(oldCounts.get(keyOf([old.character.sourceType,old.character.sourceId]))??0)>1)&&!confirmed.has(key)){note('ambiguous_participants');continue;}
  if(blockingBindingToken(p.character)===blockingBindingToken(old.character))common.add(key);
 }
 const spaceKey=(s:typeof a.space)=>s?keyOf([s.id,s.originLandmarkId??null,s.forwardLandmarkId??null,s.environmentBindingToken??null]):undefined;
 const sameSpace=!!a.space&&!!b.space&&spaceKey(a.space)===spaceKey(b.space);
 if(sameSpace)result.basis.spaceId=a.space!.id;else if(a.space||b.space)note('space_mismatch');
 const refKey=(ref:ParticipantRef)=>common.has(blockingParticipantKey(ref))?blockingParticipantKey(ref):undefined;
 const targetKey=(target:TargetRef):string|undefined=>target.kind==='camera'?'camera':target.kind==='participant'?refKey(target.participant):sameSpace?'landmark:'+target.landmarkId:undefined;
 const directionKey=(direction:BlockingDirection)=>direction.kind==='screen'?`screen:${direction.direction}`:targetKey(direction.target);
 const add=(code:string,path:string,message:string,before:unknown,after:unknown,participant?:ParticipantRef,propId?:string)=>result.findings.push({code,path,message,severity:'advisory',previousSceneId:previous.id,currentSceneId:current.id,before:structuredClone(before),after:structuredClone(after),...(participant?{participant:structuredClone(participant)}:{}),...(propId?{propId}:{})});
 const specified=(v:unknown)=>v!==undefined&&v!=='unspecified';
 for(const p of b.participants){
  const k=blockingParticipantKey(p.participant),old=a.participants.find(v=>blockingParticipantKey(v.participant)===k),source=newSources.find(v=>blockingParticipantKey(v.ref)===k);
  if(!old||!common.has(k)||source?.presence!=='on_camera'||oldMap.get(k)?.presence!=='on_camera')continue;
  result.basis.participantPairs.push({previous:structuredClone(old.participant),current:structuredClone(p.participant)});
  const before=old.end,after=p.start;if(!before||!after)continue;
  for(const field of ['zone','depth'] as const)if(specified(before[field])&&specified(after[field])&&before[field]!==after[field])add('B_POSITION',`participants.${k}.start.${field}`,'Screen placement changes across these selected takes; review the editorial cut.',before[field],after[field],p.participant);
  for(const [field,code]of [['bodyDirection','B_FACING'],['headDirection','B_HEAD']] as const){const from=before[field],to=after[field];if(from&&to&&from.kind===to.kind){const left=directionKey(from),right=directionKey(to);if(left!==undefined&&right!==undefined&&left!==right)add(code,`participants.${k}.start.${field}`,'An explicit facing direction changes across the cut; it may be intentional.',from,to,p.participant);}}
  if(before.eyeline&&after.eyeline){const left=targetKey(before.eyeline),right=targetKey(after.eyeline);if(left!==undefined&&right!==undefined&&left!==right)add('B_EYELINE',`participants.${k}.start.eyeline`,'The explicit eyeline target changes across the cut; review the intended look.',before.eyeline,after.eyeline,p.participant);}
  if(sameSpace&&before.scenePlacement&&after.scenePlacement&&keyOf(before.scenePlacement)!==keyOf(after.scenePlacement))add('B_POSITION',`participants.${k}.start.scenePlacement`,'Declared scene placement changes across the cut; review continuity.',before.scenePlacement,after.scenePlacement,p.participant);
  if(specified(before.visibility)&&specified(after.visibility)&&before.visibility!==after.visibility&&old.action?.kind!=='exit'&&p.action?.kind!=='enter')add('B_VISIBILITY',`participants.${k}.start.visibility`,'Visibility changes without a declared entrance/exit; an editorial cut may explain it.',before.visibility,after.visibility,p.participant);
 }
 const holders=(h?:BlockingHolder):Set<string>|undefined=>{
  if(!h||h.kind==='unspecified')return;
  if(h.kind==='unheld')return new Set(['unheld']);
  if(h.kind==='landmark')return sameSpace?new Set(['landmark:'+h.landmarkId]):undefined;
  const keys=(h.kind==='shared'?h.participants:[h.participant]).map(refKey);return keys.every((k):k is string=>k!==undefined)?new Set(keys):undefined;
 };
 let comparedProps=0;
 if(sameSpace)for(const prop of b.props){
  const old=a.props.find(p=>p.id===prop.id);if(!old)continue;const before=holders(old.endHolder),after=holders(prop.startHolder);if(!before||!after)continue;comparedProps++;
  const shared=[...before].some(k=>after.has(k));
  const transfer=[...a.participants,...b.participants].flatMap(p=>p.action?.interactions??[]).some(i=>i.kind==='transfer_prop'&&i.propId===prop.id&&before.has(refKey(i.from)??'')&&after.has(refKey(i.to)??''));
  if(!shared&&!transfer)add('B_PROP_HOLDER',`props.${prop.id}.startHolder`,'The same declared prop changes holder without a declared transfer; review the cut.',old.endHolder,prop.startHolder,undefined,prop.id);
 }
 const oldAxis=a.camera?.axis,newAxis=b.camera?.axis;let axisComparable=false;
 if(oldAxis&&newAxis&&(!(a.space||b.space)||sameSpace)){
  const axisKey=(axis:typeof oldAxis)=>{const from=targetKey(axis.from),to=targetKey(axis.to);return from!==undefined&&to!==undefined?keyOf([axis.id,spaceKey(a.space)??null,from,to]):undefined;};
  const oldKey=axisKey(oldAxis),newKey=axisKey(newAxis);
  if(oldKey!==undefined&&oldKey===newKey){axisComparable=true;result.basis.axisKey=oldKey;if(specified(oldAxis.side)&&specified(newAxis.side)&&oldAxis.side!==newAxis.side)add('B_CAMERA_AXIS','camera.axis.side','The side of the same declared ordered camera axis changes; review the reverse angle.',oldAxis.side,newAxis.side);}
  else note('axis_mismatch');
 }else if(oldAxis||newAxis)note('axis_mismatch');
 result.comparable=result.basis.participantPairs.length>0||comparedProps>0||axisComparable;
 if(!result.comparable&&!result.basis.reason)note('no_common_participants');
 return result;
}
