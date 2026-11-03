import {it,expect} from 'vitest';
import {makeKeyframeFixture} from './fixtures/keyframeFixture';
import {applyKeyframePatch} from '../domain/keyframePatch';
it('preserves omission, removes only by explicit null and never mutates its source plan',()=>{
 const {draft,plan}=makeKeyframeFixture(),before=structuredClone(plan);
 expect(applyKeyframePatch(plan,undefined,draft,'base')).toEqual(plan);
 expect(applyKeyframePatch(plan,null,draft,'base')).toBeUndefined();expect(plan).toEqual(before);
});
it('changes a middle-frame instruction and partial head direction while preserving the other frames and pose',()=>{
 const {draft,plan}=makeKeyframeFixture(),original=structuredClone(plan),frame=plan.frames[1];
 const changed=applyKeyframePatch(plan,{version:1,expectedBaseDigest:'base',frameUpserts:[{id:'middle',visualInstructions:'Aya looks toward the door.',instant:{kind:'custom',participantUpserts:[{participant:frame.participantRefs[0],phase:{headDirection:{kind:'screen',direction:'screen_left'}}}]}}]},draft,'base')!;
 expect(changed.frames[0]).toEqual(original.frames[0]);expect(changed.frames[2]).toEqual(original.frames[2]);expect(plan).toEqual(original);
 const next=changed.frames[1].instant;if(next?.kind!=='custom'||frame.instant?.kind!=='custom')throw Error('fixture');
 expect(next.participants[0].phase.pose).toBe(frame.instant.participants[0].phase.pose);expect(next.participants[0].phase.headDirection).toEqual({kind:'screen',direction:'screen_left'});
});
it('requires exact current proof and a complete resulting order, rejecting conflicts and unknown removals',()=>{
 const {draft,plan}=makeKeyframeFixture();
 for(const patch of [{version:1,expectedBaseDigest:'stale'},{version:1,expectedBaseDigest:'base',removeFrameIds:['unknown']},{version:1,expectedBaseDigest:'base',frameOrder:['middle','start','start']},{version:1,expectedBaseDigest:'base',removeFrameIds:['middle'],frameUpserts:[{...plan.frames[1]}]},{version:1,expectedBaseDigest:'base',frameUpserts:[{...plan.frames[1],id:'new'}]}])expect(()=>applyKeyframePatch(plan,patch as any,draft,'base')).toThrow();
 const reordered=applyKeyframePatch(plan,{version:1,expectedBaseDigest:'base',frameOrder:['end','middle','start']},draft,'base')!;expect(reordered.frames.map(f=>f.id)).toEqual(['end','middle','start']);
});
it('keeps repeated Character instances separate and requires explicit binding repair',()=>{
 const {draft,plan}=makeKeyframeFixture(),frame=plan.frames[1];draft.ensemble!.participants[1].character=structuredClone(draft.ensemble!.participants[0].character);
 expect(()=>applyKeyframePatch(plan,{version:1,expectedBaseDigest:'base',frameUpserts:[{id:'middle',instant:{kind:'custom',participantUpserts:[{participant:frame.participantRefs[1],bindToRecipe:true,phase:{pose:'Hold at the altar.'}}]}}]},draft,'base')).not.toThrow();
});
