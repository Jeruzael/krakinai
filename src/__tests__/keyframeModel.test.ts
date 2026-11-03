import {it,expect} from 'vitest';
import {makeKeyframeFixture} from './fixtures/keyframeFixture';
import {validateKeyframePlan} from '../domain/keyframeValidation';
const blocking=(value:unknown,draft:ReturnType<typeof makeKeyframeFixture>['draft'])=>validateKeyframePlan(value,draft,'assembly').filter(f=>f.severity==='blocking');
it('accepts absent, a single custom frame, Start/End and sixteen deliberately planned frames',()=>{
 const {draft,plan}=makeKeyframeFixture();expect(blocking(undefined,draft)).toEqual([]);
 expect(blocking(plan,draft)).toEqual([]);
 expect(blocking({...plan,frames:[{...plan.frames[1],role:'custom',relativePosition:undefined}]},draft)).toEqual([]);
 expect(blocking({...plan,frames:[plan.frames[0],plan.frames[2]]},draft)).toEqual([]);
 const frames=Array.from({length:16},(_,i)=>({...plan.frames[1],id:'frame-'+i,label:'Frame '+i,role:'custom',relativePosition:undefined}));
 expect(blocking({...plan,frames},draft)).toEqual([]);
 expect(blocking({...plan,frames:[...frames,{...frames[0],id:'seventeenth'}]},draft).length).toBeGreaterThan(0);
});
it('rejects duplicate IDs, prototype keys, unknown fields and object hooks without executing them',()=>{
 const {draft,plan}=makeKeyframeFixture();
 for(const value of [{...plan,frames:[plan.frames[0],plan.frames[0]]},{...plan,id:'__proto__'},{...plan,unknown:true},{...plan,frames:[{...plan.frames[0],id:'../file'}]}])expect(blocking(value,draft).length).toBeGreaterThan(0);
 let calls=0;const hooked={...plan,toJSON(){calls++;return plan;}};expect(blocking(hooked,draft).length).toBeGreaterThan(0);expect(calls).toBe(0);
 const accessor={...plan};Object.defineProperty(accessor,'frames',{get(){calls++;return plan.frames;},enumerable:true});expect(blocking(accessor,draft).length).toBeGreaterThan(0);expect(calls).toBe(0);
});
it('enforces labels, visual instructions, expressions and total multibyte authored-plan budgets',()=>{
 const {draft,plan}=makeKeyframeFixture(),frame=plan.frames[1];
 expect(blocking({...plan,frames:[{...frame,label:'a'.repeat(120),visualInstructions:'a'.repeat(2000),relativePosition:undefined}]},draft)).toEqual([]);
 for(const change of [{label:'a'.repeat(121)},{visualInstructions:'a'.repeat(2001)},{expressions:[{participant:frame.participantRefs[0],text:'a'.repeat(501)}]}])expect(blocking({...plan,frames:[{...frame,...change}]},draft).length).toBeGreaterThan(0);
 const frames=Array.from({length:16},(_,i)=>({...frame,id:'frame-'+i,role:'custom',relativePosition:undefined,visualInstructions:'界'.repeat(2000),composition:{instructions:'界'.repeat(2000)}}));
 expect(blocking({...plan,frames},draft).some(f=>f.code==='KEYFRAME_BYTES')).toBe(true);
});
it('rejects ambiguous or impossible timing and leaves missing duration unresolved during planning',()=>{
 const {draft,plan}=makeKeyframeFixture(),frame=plan.frames[1];
 for(const timing of [{relativePosition:NaN},{relativePosition:Infinity},{relativePosition:1.1},{relativePosition:0.5,timeSeconds:4},{relativePosition:undefined,timeSeconds:9}])expect(blocking({...plan,frames:[{...frame,...timing}]},draft).length).toBeGreaterThan(0);
 const unknown={...draft,settings:{...draft.settings,durationSeconds:undefined}},absolute={...plan,frames:[{...frame,relativePosition:undefined,timeSeconds:4}]};
 expect(validateKeyframePlan(absolute,unknown,'planning')).toContainEqual(expect.objectContaining({severity:'incomplete',code:'KEYFRAME_TIMING'}));
 expect(blocking(absolute,unknown).length).toBeGreaterThan(0);
 const reversed={...plan,frames:[plan.frames[2],plan.frames[1],plan.frames[0]]};expect(blocking(reversed,draft).some(f=>f.code==='KEYFRAME_TIMING')).toBe(true);
});
it('retains exact participants and requires explicit repair when captured Character/Outfit bindings change',()=>{
 const {draft,plan}=makeKeyframeFixture();draft.ensemble!.participants[0].character.sourceRevision++;
 expect(validateKeyframePlan(plan,draft,'planning').some(f=>f.code==='KEYFRAME_BINDING'&&f.severity==='incomplete')).toBe(true);
 expect(blocking(plan,draft).some(f=>f.code==='KEYFRAME_BINDING')).toBe(true);
});
it('keeps an off-camera person as an eyeline target without allowing visible staging or an image identity block',()=>{
 const {draft,plan}=makeKeyframeFixture(),frame=plan.frames[1];
 if(frame.instant!.kind!=='custom')throw Error('fixture');
 frame.instant!.participants[0].phase.eyeline={kind:'participant',participant:{kind:'ensemble',participantId:'marco'}};
 expect(blocking(plan,draft)).toEqual([]);
 frame.participantRefs.push({kind:'ensemble',participantId:'marco'});expect(blocking(plan,draft).some(f=>f.code==='KEYFRAME_PRESENCE')).toBe(true);
});
it('does not interpolate Action and reports missing linked states and reference associations',()=>{
 const {draft,plan}=makeKeyframeFixture();delete draft.blocking;
 expect(validateKeyframePlan(plan,draft,'planning').some(f=>f.code==='KEYFRAME_INSTANT'&&f.severity==='incomplete')).toBe(true);
 const unknown={...plan,frames:[{...plan.frames[1],referenceAssociationIds:['not-an-existing-association']}]};expect(blocking(unknown,draft).some(f=>f.code==='KEYFRAME_REFERENCE')).toBe(true);
});
it('does not accept a nonexistent linked phase even when a frame shows no people',()=>{
 const {draft,plan}=makeKeyframeFixture();delete draft.blocking;
 const empty={...plan,frames:[{...plan.frames[0],participantRefs:[]}]};
 expect(blocking(empty,draft).some(f=>f.code==='KEYFRAME_INSTANT')).toBe(true);
});
it('requires an unambiguous adaptation or explicit omission for each mixed legacy source',()=>{
 const {draft,plan}=makeKeyframeFixture();plan.stillSourceAdaptations!.omittedSources=['camera'];
 expect(blocking(plan,draft).some(f=>f.code==='KEYFRAME_ADAPTATION')).toBe(true);
});
