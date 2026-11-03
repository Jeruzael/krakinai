import {expect,it} from 'vitest';
import {makeKeyframeFixture} from './fixtures/keyframeFixture';
import {assembleImagePrompt} from '../domain/imagePromptDocument';
import {prepareKeyframeBasis} from '../domain/keyframeDependencies';
import {resolveFrameOutputs} from '../domain/frameOutputReview';

async function fixture(){
 const f=makeKeyframeFixture(),result=await assembleImagePrompt(f.draft,'middle',f.media);
 if(!result.ready)throw Error(JSON.stringify(result.findings));
 f.draft.imagePromptSnapshots={middle:result.snapshot};
 f.draft.manualImageOutputs={middle:{full:{text:'  Exact manual image\r\n✨\n',basedOnVisualDigest:result.snapshot.visualDigest,updatedAt:f.draft.updatedAt},compact:{text:'Manual compact',basedOnVisualDigest:result.snapshot.visualDigest,updatedAt:f.draft.updatedAt}}};
 return f;
}
it('retains unchanged canonical bytes and exact manual buffers without certifying manual correspondence',async()=>{
 const f=await fixture(),before=structuredClone(f.draft),basis=await prepareKeyframeBasis(f.draft,f.media);
 const result=resolveFrameOutputs(f.draft,basis,{});
 expect(result.valid).toBe(true);expect(result.imagePromptSnapshots).toEqual(before.imagePromptSnapshots);
 expect(result.manualImageOutputs).toEqual(before.manualImageOutputs);
 expect(result.effectiveOutputs.middle.full).toBe(before.manualImageOutputs!.middle.full!.text);
 expect(result.unverifiedFrameIds).toEqual(['middle']);expect(f.draft).toEqual(before);
});
it('requires independent stale Full/Compact decisions and changes only the explicitly rebuilt mode',async()=>{
 const f=await fixture();f.plan.frames[1].visualInstructions='Aya looks toward the open chapel door.';
 const next=await assembleImagePrompt(f.draft,'middle',f.media);if(!next.ready)throw Error('fixture');
 const basis=await prepareKeyframeBasis(f.draft,f.media),none=resolveFrameOutputs(f.draft,basis,{middle:next.snapshot});
 expect(none.valid).toBe(false);expect(none.findings.filter(x=>x.code==='FRAME_OUTPUT_DECISION_REQUIRED').map(x=>x.path)).toEqual(['manualImageOutputs.middle.full','manualImageOutputs.middle.compact']);
 const chosen=resolveFrameOutputs(f.draft,basis,{middle:next.snapshot},{middle:{full:'keep_manual_unverified',compact:'canonical'}});
 expect(chosen.valid).toBe(true);expect(chosen.effectiveOutputs.middle.full).toBe(f.draft.manualImageOutputs!.middle.full!.text);
 expect(chosen.manualImageOutputs!.middle.compact).toBeUndefined();expect(chosen.effectiveOutputs.middle.compact).toBe(next.snapshot.compact);
});
it('rejects stale canonical snapshots, unknown decisions and outputs exceeding byte budgets',async()=>{
 const f=await fixture();f.plan.frames[1].visualInstructions='A different authored instant.';const basis=await prepareKeyframeBasis(f.draft,f.media);
 expect(resolveFrameOutputs(f.draft,basis,{}).findings).toContainEqual(expect.objectContaining({code:'FRAME_CANONICAL_STALE'}));
 expect(resolveFrameOutputs(f.draft,basis,{}, {middle:{full:'auto'}} as never).valid).toBe(false);
 f.draft.manualImageOutputs!.middle.full!.text='界'.repeat(90000);
 expect(resolveFrameOutputs(f.draft,basis,{}, {middle:{full:'keep_manual_unverified',compact:'keep_manual_unverified'}}).findings).toContainEqual(expect.objectContaining({code:'FRAME_OUTPUT_BUDGET'}));
});
