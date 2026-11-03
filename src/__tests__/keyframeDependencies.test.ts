import {it,expect} from 'vitest';
import {makeKeyframeFixture} from './fixtures/keyframeFixture';
import {prepareKeyframeBasis,diffKeyframeBasis} from '../domain/keyframeDependencies';
it('renaming and reordering retain visual digests but require a fresh video-correspondence review',async()=>{
 const {draft,media}=makeKeyframeFixture(),before=await prepareKeyframeBasis(draft,media);
 draft.keyframePlan!.frames.reverse();draft.keyframePlan!.frames[0].label='Closing still';
 const after=await prepareKeyframeBasis(draft,media),diff=diffKeyframeBasis(before,after);
 expect(diff.visuallyChangedFrameIds).toEqual([]);expect(diff.videoReviewRequired).toBe(true);expect(after.frames.start.visualDigest).toBe(before.frames.start.visualDigest);
});
it('a middle-frame instruction changes only that frame while a frozen Environment change affects all frames',async()=>{
 const {draft,media}=makeKeyframeFixture(),before=await prepareKeyframeBasis(draft,media);
 draft.keyframePlan!.frames[1].visualInstructions+=' Keep the door in the composition.';
 const middle=await prepareKeyframeBasis(draft,media);expect(diffKeyframeBasis(before,middle).visuallyChangedFrameIds).toEqual(['middle']);
  expect(diffKeyframeBasis(before,middle).metadataOnlyFrameIds).toEqual([]);
 draft.slots.environment!.promptText+=' Preserve the stone doorway.';
 const environment=await prepareKeyframeBasis(draft,media);expect(diffKeyframeBasis(middle,environment).visuallyChangedFrameIds).toEqual(['start','middle','end']);
});
it('ignores revision timestamps and unrelated off-camera identities while detecting referenced file byte changes',async()=>{
 const {draft,media}=makeKeyframeFixture(),before=await prepareKeyframeBasis(draft,media);
 draft.inputRevision++;draft.updatedAt='2026-11-04T00:00:00.000Z';draft.ensemble!.participants.find(p=>p.id==='marco')!.character.promptText+=' Private off-camera identity.';
 const metadata=await prepareKeyframeBasis(draft,media);expect(diffKeyframeBasis(before,metadata).visuallyChangedFrameIds).toEqual([]);
 const first=media.values().next().value!;media.set(first.id,{...first,blob:new Blob([new Uint8Array([9,8,7])],{type:'image/png'}),byteSize:3});
 const changed=await prepareKeyframeBasis(draft,media);expect(diffKeyframeBasis(metadata,changed).visuallyChangedFrameIds).toEqual(['start','middle','end']);expect(diffKeyframeBasis(metadata,changed).videoReviewRequired).toBe(true);
});
it('keeps oversized legacy files untouched and refuses an unbounded whole-file preview hash',async()=>{
 const {draft,media}=makeKeyframeFixture(),first=media.values().next().value!;
 const bytes=new Uint8Array(50*1024*1024+1),blob=new Blob([bytes],{type:'video/webm'});
 media.set(first.id,{...first,blob,mimeType:'video/webm',byteSize:blob.size});
 await expect(prepareKeyframeBasis(draft,media)).rejects.toThrow(/bounded per-file/);
 expect(media.get(first.id)!.blob).toBe(blob);expect(draft.keyframePlan!.frames).toHaveLength(3);
});
it('rejects unsafe and duplicate frame identities before constructing a digest map',async()=>{
 for(const invalid of ['__proto__','start']){
  const {draft,media}=makeKeyframeFixture();draft.keyframePlan!.frames[1].id=invalid;
  await expect(prepareKeyframeBasis(draft,media)).rejects.toThrow(/safe|Duplicate|stable ID/);
 }
});
