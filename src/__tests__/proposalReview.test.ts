import {describe,it,expect} from 'vitest';
import {createReviewDraft,validateReviewDraft,validateReviewFeedback,REVIEW_WINDOW_MS,reviewWindowExpired} from '../domain/proposalReview';
import {midoriChangeSet} from './fixtures/changeSetFixture';

describe('local proposal review policy',()=>{
 it('keeps a complete exact package for a day without storing authority',async()=>{
  const input=midoriChangeSet(),record=await createReviewDraft(input,1000,'http://localhost:5173');
  expect(REVIEW_WINDOW_MS).toBe(86400000);expect(record.changeSet).toEqual(input);
  expect(record.expiresAt).toBe(86401000);expect(record.disposition).toBe('review');
  expect(await validateReviewDraft(record)).toEqual(record);
  expect(Object.keys(record)).not.toContain('sessionId');expect(Object.keys(record)).not.toContain('approval');
  input.title='Changed after receipt';expect(record.changeSet.title).not.toBe(input.title);
 });
 it('uses an absolute review deadline, including its exact boundary',async()=>{
  const r=await createReviewDraft(midoriChangeSet(),1000,'http://localhost:5173');
  expect(reviewWindowExpired(r,601001)).toBe(false);
  expect(reviewWindowExpired(r,r.expiresAt-1)).toBe(false);expect(reviewWindowExpired(r,r.expiresAt)).toBe(true);
 });
 it('rejects changed package bytes under a saved digest',async()=>{
  const r=await createReviewDraft(midoriChangeSet(),1000,'http://localhost:5173');r.changeSet.title='Different package';
  await expect(validateReviewDraft(r)).rejects.toThrow(/digest/i);
 });
 it('refuses authority and unknown envelope fields',async()=>{
  const r=await createReviewDraft(midoriChangeSet(),1000,'http://localhost:5173');
  for(const extra of[{sessionId:'old-session'},{approval:{scenes:true}},{scope:{allowProposals:true}},{approvedDigest:'a'.repeat(64)}])await expect(validateReviewDraft({...r,...extra})).rejects.toThrow();
  await expect(validateReviewDraft({...r,progress:{...r.progress,reviewed:true}})).rejects.toThrow();
 });
 it('enforces the existing one-MiB MCP package limit before persistence',async()=>{
  const input=midoriChangeSet();input.title='x'.repeat(1048577);
  await expect(createReviewDraft(input,1000,'http://localhost:5173')).rejects.toThrow(/package|MiB|limit/i);
 });
 it('rejects invalid deadlines, format and origin',async()=>{
  const r=await createReviewDraft(midoriChangeSet(),1000,'http://localhost:5173');
  for(const patch of[{version:2},{expiresAt:r.expiresAt+1},{windowStartedAt:-1},{origin:'https://unrelated.example'},{revision:-1}])await expect(validateReviewDraft({...r,...patch})).rejects.toThrow();
 });
 it('preserves plain-text feedback and bounds Unicode length',()=>{
  expect(validateReviewFeedback('  <b>Keep this exact text</b>\r\n😊  ')).toBe('  <b>Keep this exact text</b>\r\n😊  ');
  expect(validateReviewFeedback('😊'.repeat(2000))).toHaveLength(4000);
  expect(()=>validateReviewFeedback('😊'.repeat(2001))).toThrow(/2,000|2000/);
 });
 it('does not persist final approval flags in draft choices',async()=>{
  const r=await createReviewDraft(midoriChangeSet(),1000,'http://localhost:5173');
  r.progress={...r.progress,draftDecisions:{scenes:true}} as any;
  await expect(validateReviewDraft(r)).rejects.toThrow();
 });
 it('bounds local progress separately from the package',async()=>{
  const r=await createReviewDraft(midoriChangeSet(),1000,'http://localhost:5173');
  r.progress.draftDecisions={assetDecisions:{huge:{action:'reuse',assetId:'x'.repeat(70000)}}};
  await expect(validateReviewDraft(r)).rejects.toThrow(/64 KiB/);
 });
});

it('stores a reserved Batch navigation marker without colliding with actual operation IDs',async()=>{
 const record=await createReviewDraft(midoriChangeSet(),1000);record.progress={selectedOperationId:'@batch',viewedOperations:{'@batch':'a'.repeat(64)}};expect((await validateReviewDraft(record)).progress).toEqual(record.progress);
});
