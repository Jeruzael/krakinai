import {it,expect} from 'vitest';
import {parseChangeSet} from '../domain/changeSetValidation';
import {applyBlockingPatch,blockingDigest} from '../domain/blockingPatch';
import {blockingChangeScenario as scenario} from './fixtures/blockingChangeSetFixture';
import {canonicalStringify} from '../domain/changeSetCanonical';

it('accepts explicit v5 and leaves older contracts strict',async()=>{
 const f=await scenario();expect(parseChangeSet(f.input).schema).toBe('krakinai.change-set.v5');
 for(const schema of ['v1','v2','v3','v4'])expect(()=>parseChangeSet({...f.input,schema:`krakinai.change-set.${schema}`})).toThrow();
});
it.each(['expectedSourceRevision','expectedSourceRecipeDigest','expectedBlockingDigest'])('requires %s on existing v5 targets',async field=>{
 const f=await scenario();delete (f.op as any)[field];expect(()=>parseChangeSet(f.input)).toThrow();
});
it('rejects future authoring fields and caller-supplied approvals',async()=>{
 const f=await scenario();for(const extra of [{keyframes:[]},{imagePrompt:'pretend'},{blockingOutputDecisions:{full:'canonical'}}])expect(()=>parseChangeSet({...f.input,operations:[{...f.op,...extra}]})).toThrow();
});
it('updates only supplied nested fields and preserves unrelated exact tracks',async()=>{
 const f=await scenario();delete (f.op.blocking.participantUpserts[0].end as any).pose;
 const before=canonicalStringify(f.parent),result=applyBlockingPatch(f.parent.blocking,f.op.blocking as any,f.draft,f.proofs.get(f.parent.id)!.blockingDigest)!;
 expect(result.participants[1]).toEqual(f.parent.blocking!.participants[1]);expect(result.participants[0].end?.pose).toBe(f.parent.blocking!.participants[0].end?.pose);expect(canonicalStringify(f.parent)).toBe(before);
});
it('supports null clearing, explicit removals, stable upserts and ordered interaction edits',async()=>{
 const f=await scenario(),base=f.parent.blocking!,digest=await blockingDigest(base);
 const patch:any={version:1,expectedBaseDigest:digest,participantUpserts:[{participant:{kind:'ensemble',participantId:'primary'},end:{pose:null},action:{interactionUpserts:[{id:'look',kind:'face',target:{kind:'landmark',landmarkId:'door'}},{id:'gesture',kind:'gesture_to',target:{kind:'camera'}}],interactionOrder:['gesture','look']}}],landmarkUpserts:[{id:'new-mark',label:'New mark'}],propUpserts:[{id:'ring',label:'Ring',startHolder:{kind:'unheld'}}],camera:{direction:null}};
 const next=applyBlockingPatch(base,patch,f.draft,digest)!;expect(next.participants[0].end?.pose).toBeUndefined();expect(next.participants[0].action?.interactions?.map(i=>i.id)).toEqual(['gesture','look']);expect(next.landmarks.at(-1)?.id).toBe('new-mark');expect(next.camera?.axis).toEqual(base.camera?.axis);expect(next.camera?.direction).toBeUndefined();
 const final=applyBlockingPatch(next,{version:1,expectedBaseDigest:await blockingDigest(next),removeLandmarkIds:['new-mark'],removePropIds:['ring'],participantUpserts:[{participant:{kind:'ensemble',participantId:'primary'},action:{removeInteractionIds:['gesture'],interactionOrder:['look']}}]} as any,f.draft,await blockingDigest(next))!;
 expect(final.landmarks).toEqual(base.landmarks);expect(final.props).toEqual(base.props);expect(final.participants[0].action?.interactions?.map(i=>i.id)).toEqual(['look']);
 expect(applyBlockingPatch(base,null,f.draft,digest)).toBeUndefined();expect(applyBlockingPatch(base,undefined,f.draft,digest)).toEqual(base);
});
it('rejects stale bases, duplicate/conflicting IDs, partial orders and unacknowledged new bindings',async()=>{
 const f=await scenario(),digest=await blockingDigest(f.parent.blocking);
 for(const patch of [{expectedBaseDigest:'0'.repeat(64)},{landmarkUpserts:[{id:'door',label:'a'},{id:'door',label:'b'}]},{removeLandmarkIds:['door'],landmarkUpserts:[{id:'door',label:'a'}]},{participantOrder:[]},{participantUpserts:[{participant:{kind:'ensemble',participantId:'unknown'},start:{zone:'left'}}]}])expect(()=>applyBlockingPatch(f.parent.blocking,{version:1,expectedBaseDigest:digest,...patch} as any,f.draft,digest)).toThrow();
});
