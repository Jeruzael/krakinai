import {expect,it} from 'vitest';
import {makeKeyframeFixture} from './fixtures/keyframeFixture';
import {prepareKeyframeBasis} from '../domain/keyframeDependencies';
import {assembleScenePrompt} from '../domain/promptAssembler';
import {planFrameVideoReview,isFrameVideoReviewCurrent,prepareFrameVideoReviewBasis} from '../domain/frameVideoReview';

it('keep exact video preserves all effective strings and manual buffers and stays unverified',async()=>{
 const f=makeKeyframeFixture(),outputs=assembleScenePrompt(f.draft).outputs;
 f.draft.manualOutputs={full:{text:' Exact historical video\r\n',basedOnInputRevision:1,updatedAt:f.draft.updatedAt}};
 outputs.full=f.draft.manualOutputs.full!.text;const before=structuredClone(f.draft),basis=await prepareKeyframeBasis(f.draft,f.media);
 const result=await planFrameVideoReview(f.draft,outputs,basis,'keep_exact_unverified');
 expect(result.valid).toBe(true);expect(result.outputs).toEqual(outputs);expect(result.manualOutputs).toEqual(before.manualOutputs);
 expect(result.reviewStatus).toBe('unverified');expect(f.draft).toEqual(before);
});
it('coordinated video adds concise ordered authored moments while preserving legacy dialogue and B motion',async()=>{
 const f=makeKeyframeFixture(),legacy=assembleScenePrompt(f.draft).outputs,basis=await prepareKeyframeBasis(f.draft,f.media);
 const result=await planFrameVideoReview(f.draft,legacy,basis,'reassemble');expect(result.valid).toBe(true);
 for(const mode of ['full','structured','compact'] as const){
  expect(result.outputs[mode].startsWith(legacy[mode])).toBe(true);
  expect(result.outputs[mode]).toContain('Authored visual moments');expect(result.outputs[mode]).toContain('Aya turns her head toward the chapel door.');
  expect(result.outputs[mode]).not.toContain('## Character');
 }
 expect(result.reviewStatus).toBe('required');
});
it('manual video decisions remain per mode and no proposal flag marks a video reviewed',async()=>{
 const f=makeKeyframeFixture(),basis=await prepareKeyframeBasis(f.draft,f.media),outputs=assembleScenePrompt(f.draft).outputs;
 f.draft.manualOutputs={full:{text:'Exact manual',basedOnInputRevision:1,updatedAt:f.draft.updatedAt}};
 expect((await planFrameVideoReview(f.draft,outputs,basis,'reassemble')).valid).toBe(false);
 const result=await planFrameVideoReview(f.draft,outputs,basis,'reassemble',{full:'keep_manual_unverified'});
 expect(result.valid).toBe(true);expect(result.outputs.full).toBe('Exact manual');expect(result.reviewStatus).toBe('unverified');
 expect((await planFrameVideoReview(f.draft,outputs,basis,'reviewed' as never)).valid).toBe(false);
});
it('a recorded human review matches only the exact plan, source and effective video basis',async()=>{
 const f=makeKeyframeFixture(),basis=await prepareKeyframeBasis(f.draft,f.media),outputs=assembleScenePrompt(f.draft).outputs;
 const reviewed=await prepareFrameVideoReviewBasis(f.draft,basis,outputs);
 expect(isFrameVideoReviewCurrent(reviewed,structuredClone(reviewed))).toBe(true);
 f.plan.frames.reverse();const changed=await prepareFrameVideoReviewBasis(f.draft,await prepareKeyframeBasis(f.draft,f.media),outputs);
 expect(isFrameVideoReviewCurrent(reviewed,changed)).toBe(false);
 expect(isFrameVideoReviewCurrent(reviewed,{...reviewed,sourceSceneId:'different-take'})).toBe(false);
 expect(isFrameVideoReviewCurrent(reviewed,{...reviewed,videoTextDigests:{...reviewed.videoTextDigests,full:'changed'}})).toBe(false);
});
