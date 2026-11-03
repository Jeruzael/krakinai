import {describe,it,expect} from 'vitest';
import {ensembleLegacyDraft,ensembleDraft,actor} from './fixtures/ensembleFixture';
import {blockingBindingToken,validateSceneBlocking} from '../domain/blockingValidation';
import {validatePhase4Record} from '../domain/phase4Validation';
import {makeBlockingFixture} from './fixtures/blockingFixture';

const primary={kind:'primary'};
const target=(landmarkId:string)=>({kind:'landmark',landmarkId});
function fixture(ensemble=false){
 const source=ensemble?ensembleDraft():ensembleLegacyDraft();
 const participant=ensemble?{kind:'ensemble',participantId:'primary'}:primary;
 const track={participant,bindingToken:'["asset","character",1,1]',wardrobeBindingToken:'["variant","aya-outfit",1,null]',
  start:{visibility:'on_screen',zone:'center',depth:'foreground',bodyDirection:{kind:'target',target:target('altar')},eyeline:target('altar')},
  action:{kind:'move',text:'Stop at the aisle midpoint.',waypointLandmarkIds:['aisle'],interactions:[]},
  end:{visibility:'on_screen',zone:'center',depth:'midground',bodyDirection:{kind:'target',target:target('altar')},headDirection:{kind:'target',target:target('door')},eyeline:target('door'),pose:'Hold the bouquet in both hands.'}};
 const blocking:any={version:1,space:{id:'chapel',environmentBindingToken:'["asset","environment",2,null]',originLandmarkId:'door',forwardLandmarkId:'altar'},
  landmarks:[{id:'door',label:'Chapel door'},{id:'aisle',label:'Aisle midpoint'},{id:'altar',label:'Altar'}],
  props:[{id:'bouquet',label:'Bridal bouquet',startHolder:{kind:'participant',participant},endHolder:{kind:'participant',participant}}],participants:[track]};
 return{source,blocking,track};
}
const errors=(value:unknown,source:any,mode:'planning'|'assembly'='assembly')=>validateSceneBlocking(value,source,mode).filter(f=>f.severity==='blocking');

describe('bounded authoritative blocking',()=>{
 it('accepts the synthetic managed recipe while preserving its frozen parent',()=>{
  const {draft,state,parentSceneId,shotId}=makeBlockingFixture(),before=structuredClone(state.scenes);
  expect(validateSceneBlocking(draft.blocking,draft,'assembly')).toEqual([]);
  expect(draft.revisionIntent?.contextSceneId).toBe(parentSceneId);expect(draft.authoredProjectTarget?.shotId).toBe(shotId);
  expect(state.scenes).toEqual(before);expect(state.media[0].blob.size).toBeGreaterThan(0);
 });
 it('keeps absent blocking optional and validates independent body/head/eyeline without rewriting it',()=>{
  const f=fixture(),before=structuredClone(f.blocking);
  expect(validateSceneBlocking(undefined,f.source,'assembly')).toEqual([]);
  expect(validateSceneBlocking(f.blocking,f.source,'assembly')).toEqual([]);
  expect(f.blocking).toEqual(before);
 });
 it('binds exact frozen source/revision/identity revision, ignoring display names and prompt wording',()=>{
  const s=actor();expect(blockingBindingToken(s)).toBe('["asset","character",1,1]');
  expect(blockingBindingToken({...s,sourceTitle:'Another title',promptText:'Same frozen source'})).toBe(blockingBindingToken(s));
  expect(blockingBindingToken({...s,identityRevision:2})).not.toBe(blockingBindingToken(s));
 });
 it.each(['bindingToken','wardrobeBindingToken'])('requires explicit review of changed %s',field=>{
  const f=fixture();f.blocking.participants[0][field]='stale';
  expect(errors(f.blocking,f.source).some(f=>f.code==='BLOCKING_BINDING')).toBe(true);
  expect(validateSceneBlocking(f.blocking,f.source,'planning').some(f=>f.severity==='incomplete')).toBe(true);
 });
 it('allows an off-camera eyeline target but rejects visible staging for that participant',()=>{
  const f=fixture(true);f.source.ensemble!.participants.push({id:'marco',character:actor('marco','Marco'),presence:'off_camera'});
  f.blocking.participants[0].end.eyeline={kind:'participant',participant:{kind:'ensemble',participantId:'marco'}};
  expect(errors(f.blocking,f.source)).toEqual([]);
  f.blocking.participants.push({participant:{kind:'ensemble',participantId:'marco'},bindingToken:'["asset","marco",1,1]',start:{visibility:'on_screen'}});
  expect(errors(f.blocking,f.source).some(f=>f.code==='BLOCKING_PRESENCE')).toBe(true);
 });
 it('never treats primary as an invented ensemble member',()=>{
  const f=fixture(true);f.blocking.participants[0].participant=primary;
  expect(errors(f.blocking,f.source).some(f=>f.code==='BLOCKING_REFERENCE')).toBe(true);
 });
 it('keeps repeated Character bindings distinct using participant IDs',()=>{
  const f=fixture(true),p=f.source.ensemble!.participants[0];
  f.source.ensemble!.participants.push({...structuredClone(p),id:'double'});
  f.blocking.participants.push({...structuredClone(f.blocking.participants[0]),participant:{kind:'ensemble',participantId:'double'}});
  expect(errors(f.blocking,f.source)).toEqual([]);
  f.blocking.participants.push(structuredClone(f.blocking.participants[0]));
  expect(errors(f.blocking,f.source).some(f=>f.code==='BLOCKING_DUPLICATE')).toBe(true);
 });
 it('retains unresolved relationships in planning while blocking assembly',()=>{
  const f=fixture();f.blocking.participants[0].end.eyeline=target('not-uploaded-or-defined');const before=structuredClone(f.blocking);
  expect(errors(f.blocking,f.source,'planning')).toEqual([]);
  expect(validateSceneBlocking(f.blocking,f.source,'planning').some(f=>f.severity==='incomplete')).toBe(true);
  expect(errors(f.blocking,f.source).some(f=>f.code==='BLOCKING_REFERENCE')).toBe(true);expect(f.blocking).toEqual(before);
 });
 it.each([['enter','out_of_frame','on_screen'],['exit','on_screen','out_of_frame']])('validates explicit %s endpoints without inventing visibility', (kind,start,end)=>{
  const f=fixture();Object.assign(f.blocking.participants[0].action,{kind});f.blocking.participants[0].start.visibility=start;f.blocking.participants[0].end.visibility=end;
  expect(errors(f.blocking,f.source)).toEqual([]);
  f.blocking.participants[0].end.visibility=start;expect(errors(f.blocking,f.source).some(f=>f.code==='BLOCKING_VISIBILITY')).toBe(true);
  f.blocking.participants[0].end.visibility='unspecified';expect(errors(f.blocking,f.source,'planning')).toEqual([]);expect(errors(f.blocking,f.source).length).toBeGreaterThan(0);
 });
 it('does not block camera reveals or unspecified endpoint visibility for ordinary movement',()=>{
  const f=fixture();f.blocking.participants[0].start.visibility='out_of_frame';f.blocking.participants[0].end.visibility='unspecified';
  expect(errors(f.blocking,f.source)).toEqual([]);
 });
 it('validates typed interactions and prop transfers with exact participant references',()=>{
  const f=fixture(true),aya={kind:'ensemble',participantId:'primary'},lucas={kind:'ensemble',participantId:'lucas'};
  f.blocking.participants[0].action.interactions=[{id:'follow-lucas',kind:'follow',target:{kind:'participant',participant:lucas}},{id:'handoff',kind:'transfer_prop',propId:'bouquet',from:aya,to:lucas}];
  f.blocking.props[0].endHolder={kind:'shared',participants:[aya,lucas]};expect(errors(f.blocking,f.source)).toEqual([]);
  f.blocking.participants[0].action.interactions[0].target.participant=aya;
  f.blocking.participants[0].action.interactions[1].to=aya;expect(errors(f.blocking,f.source).filter(f=>f.code==='BLOCKING_SELF_INTERACTION')).toHaveLength(2);
 });
 it('returns a structural finding for a follow target missing its participant instead of throwing',()=>{
  const f=fixture();f.blocking.participants[0].action.interactions=[{id:'bad-follow',kind:'follow',target:{kind:'participant'}}];
  expect(()=>validateSceneBlocking(f.blocking,f.source,'planning')).not.toThrow();
  expect(errors(f.blocking,f.source,'planning').some(f=>f.code==='BLOCKING_SHAPE')).toBe(true);
 });
 it('requires declared geography for scene-relative left/right and rejects a degenerate camera axis',()=>{
  const f=fixture();f.blocking.participants[0].end.scenePlacement={landmarkId:'aisle',relation:'left_of'};
  expect(errors(f.blocking,f.source)).toEqual([]);delete f.blocking.space.forwardLandmarkId;
  expect(errors(f.blocking,f.source).length).toBeGreaterThan(0);
  f.blocking.camera={axis:{id:'axis',from:target('altar'),to:target('altar'),side:'A'}};expect(errors(f.blocking,f.source).some(f=>f.code==='BLOCKING_AXIS')).toBe(true);
 });
 it.each(['__proto__','constructor','prototype','bad id','x'.repeat(65)])('rejects unsafe local ID %s',id=>{
  const f=fixture();f.blocking.landmarks[0].id=id;expect(errors(f.blocking,f.source).length).toBeGreaterThan(0);
 });
 it.each(['participants','landmarks','props','interactions','waypoints','label','pose','movement','description'])('enforces the approved %s ceiling',kind=>{
  const f=fixture();
  if(kind==='participants')f.blocking.participants=Array.from({length:9},()=>structuredClone(f.track));
  if(kind==='landmarks'||kind==='props')f.blocking[kind]=Array.from({length:17},(_,i)=>({id:'item-'+i,label:'Synthetic item'}));
  if(kind==='interactions')f.blocking.participants[0].action.interactions=Array.from({length:33},(_,i)=>({id:'i'+i,kind:'custom',description:'Authored action'}));
  if(kind==='waypoints')f.blocking.participants[0].action.waypointLandmarkIds=Array(5).fill('aisle');
  if(kind==='label')f.blocking.landmarks[0].label='x'.repeat(121);
  if(kind==='pose')f.blocking.participants[0].end.pose='x'.repeat(501);
  if(kind==='movement')f.blocking.participants[0].action.text='x'.repeat(501);
  if(kind==='description')f.blocking.landmarks[0].description='x'.repeat(1001);
  expect(errors(f.blocking,f.source).some(f=>f.code==='BLOCKING_SHAPE')).toBe(true);
 });
 it('measures the aggregate allowance in UTF8 bytes, not string length',()=>{
  const f=fixture();f.blocking.landmarks=Array.from({length:16},(_,i)=>({id:['door','aisle','altar'][i]??'l'+i,label:'Place',description:'界'.repeat(1000)}));
  f.blocking.props=Array.from({length:16},(_,i)=>({id:'p'+i,label:'Prop',description:'界'.repeat(1000)}));
  expect(errors(f.blocking,f.source).some(f=>f.code==='BLOCKING_BYTES')).toBe(true);
 });
 it('accepts the exact 64 KiB UTF8 boundary and rejects one additional byte',()=>{
  const f=fixture();f.blocking.landmarks=Array.from({length:16},(_,i)=>({id:['door','aisle','altar'][i]??'l'+i,label:'Place',description:''}));
  f.blocking.props=Array.from({length:16},(_,i)=>({id:'p'+i,label:'Prop',description:''}));
  const entries=[...f.blocking.landmarks,...f.blocking.props],bytes=()=>new TextEncoder().encode(JSON.stringify(f.blocking)).length;
  for(const entry of entries){const remaining=65536-bytes();entry.description='界'.repeat(Math.min(1000,Math.floor(remaining/3)));if(bytes()<65536&&entry.description.length<1000)entry.description+='a'.repeat(Math.min(1000-entry.description.length,65536-bytes()));}
  expect(bytes()).toBe(65536);expect(errors(f.blocking,f.source)).toEqual([]);
  entries.at(-1).description+='a';expect(bytes()).toBe(65537);expect(errors(f.blocking,f.source).some(f=>f.code==='BLOCKING_BYTES')).toBe(true);
 });
 it('allows maximum safe ID and text widths with Unicode within the aggregate bound',()=>{
  const f=fixture();f.blocking.landmarks.push({id:'a'.repeat(64),label:'界'.repeat(120),description:'界'.repeat(1000)});f.blocking.participants[0].end.pose='界'.repeat(500);f.blocking.participants[0].action.text='界'.repeat(500);
  expect(errors(f.blocking,f.source)).toEqual([]);
 });
 it('enforces 32 interactions across tracks rather than allowing 32 per participant',()=>{
  const f=fixture(true),lucas=structuredClone(f.blocking.participants[0]);
  Object.assign(lucas,{participant:{kind:'ensemble',participantId:'lucas'},bindingToken:'["asset","lucas",1,1]',wardrobeBindingToken:'["variant","lucas-suit",1,null]'});f.blocking.participants.push(lucas);
  f.blocking.participants.forEach((p:any,index:number)=>p.action.interactions=Array.from({length:17},(_,i)=>({id:`i-${index}-${i}`,kind:'custom',description:'An authored gesture.'})));
  expect(errors(f.blocking,f.source).some(f=>f.code==='BLOCKING_SHAPE')).toBe(true);
 });
 it('rejects JSON hooks and accessors before serializing untrusted structured values',()=>{
  const f=fixture();let invoked=0;
  const hooked={...f.blocking,toJSON(){invoked++;return f.blocking;}};
  expect(errors(hooked,f.source).length).toBeGreaterThan(0);expect(invoked).toBe(0);
  const getter={...f.blocking};Object.defineProperty(getter,'landmarks',{enumerable:true,get(){invoked++;return f.blocking.landmarks;}});
  expect(errors(getter,f.source).length).toBeGreaterThan(0);expect(invoked).toBe(0);
 });
 it('treats known optional undefined fields as unspecified',()=>{
  const f=fixture();f.blocking.participants[0].end.pose=undefined;
  expect(errors(f.blocking,f.source)).toEqual([]);
 });
 it('rejects sparse planning arrays instead of silently dropping unresolved rows',()=>{
  const f=fixture();
  f.blocking.landmarks=new Array(3);
  expect(errors(f.blocking,f.source,'planning').some(f=>f.code==='BLOCKING_SHAPE')).toBe(true);
 });
 it('rejects unknown keys, non-JSON values and unsupported versions without invoking input content',()=>{
  const f=fixture();expect(errors({...f.blocking,externalApiKey:'not accepted'},f.source).length).toBeGreaterThan(0);
  expect(errors({...f.blocking,version:2},f.source).length).toBeGreaterThan(0);
  expect(errors({...f.blocking,camera:{direction:{kind:'screen',direction:NaN}}},f.source).length).toBeGreaterThan(0);
  const cycle:any={...f.blocking};cycle.space=cycle;expect(errors(cycle,f.source).length).toBeGreaterThan(0);
 });
 it('does not append blocking to a saved Direct Prompt',()=>{
  const f=fixture();expect(errors(f.blocking,{...f.source,authoringMode:'direct_prompt'}).length).toBeGreaterThan(0);
 });
 it('applies the same blocking contract at record validation and retains incomplete drafts',()=>{
  const f=fixture();
  expect(validatePhase4Record({...f.source,blocking:{...f.blocking,version:99}})).toMatch(/blocking/i);
  f.blocking.participants[0].end.eyeline=target('unresolved');
  expect(validatePhase4Record({...f.source,blocking:f.blocking})).toBeUndefined();
  expect(validatePhase4Record({...f.source,blocking:f.blocking,outputs:{full:'Saved output'}})).toMatch(/landmark|blocking/i);
 });
 it('rejects an inherited array serialization hook before it runs',()=>{
  const f=fixture();let invoked=false;const proto=Object.create(Array.prototype);proto.toJSON=()=>{invoked=true;return[];};
  Object.setPrototypeOf(f.blocking.props,proto);
  expect(errors(f.blocking,f.source).length).toBeGreaterThan(0);expect(invoked).toBe(false);
 });
});
