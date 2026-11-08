import {it,expect} from 'vitest';
import {
  proposalReadiness,
  proposalOperationGroup,
  analyzeProposalCandidateBlockers,
  applyCandidateDecisionWithSafeguards,
  buildBulkCreateApproval,
  type CandidateBlockerItem,
  type CandidateDependencyAnalysis,
} from '../domain/proposalReadiness';
import {planChangeSet} from '../domain/changeSetPlanner';
import {emptyChangeSetApproval,type ChangeSetPreview,type ImportFinding,type ChangeSet} from '../types/changeSet';
import {midoriChangeSet,emptyState,allocationFor} from './fixtures/changeSetFixture';
const context={status:'review_required' as const,connected:true,currentBinding:true,reviewed:true,needsRevalidation:false,expiresAt:100000,now:1000};
function preview(findings:ImportFinding[]=[]):ChangeSetPreview{
 const changeSet=midoriChangeSet(),approval=emptyChangeSetApproval(),allocation=allocationFor(changeSet),plan=planChangeSet(changeSet,approval,emptyState(),allocation);
 return{version:1,changeSet,approval,allocation,plan:{...plan,findings},packageDigest:'a'.repeat(64),approvedDigest:'b'.repeat(64)};
}
it('keeps project/global conflicts visible on Batch without fabricating an operation',()=>{
 const message='Project cast reference must be an existing image.';
 const r=proposalReadiness(preview([{severity:'blocking',code:'PROJECT_VALIDATION',message}]),context);
 expect(r.conflictCount).toBe(1);expect(r.batch.map(x=>x.message)).toContain(message);expect(r.batch[0].target.operationId).toBeUndefined();expect(r.canApply).toBe(false);
});
it('preserves complete codes/messages for unknown findings and missing operation targets',()=>{
 const message='Complete explanation '.repeat(500),r=proposalReadiness(preview([{operationId:'unknown-op',severity:'blocking',code:'NEW_DOMAIN_RULE',message}]),context);
 expect(r.batch[0]).toMatchObject({code:'NEW_DOMAIN_RULE',message,target:{kind:'batch'}});expect(r.canApply).toBe(false);
});
it('separates data conflicts from grouped approvals and advisory findings',()=>{
 const p=preview([{operationId:'prompt-01',severity:'blocking',code:'SOURCE_MISSING',message:'Missing source.'},{severity:'blocking',code:'LEDGER_CAPACITY',message:'Use a smaller batch.'},{operationId:'prompt-01',severity:'blocking',code:'APPROVAL_SCENES',message:'Approve scenes.'},{operationId:'prompt-02',severity:'blocking',code:'APPROVAL_SCENES',message:'Approve scenes.'},{operationId:'prompt-02',severity:'advisory',code:'REVIEW_STYLE',message:'Style review.'}]);
 const r=proposalReadiness(p,context);expect(r.conflictCount).toBe(2);expect(r.approvalCount).toBe(1);expect(r.approvals).toHaveLength(2);expect(r.advisories).toHaveLength(1);expect(r.byOperation['prompt-01']).toHaveLength(2);expect(r.batch).toHaveLength(1);expect(r.canApply).toBe(false);
});
it('uses the same current findings for Apply availability',()=>{
 expect(proposalReadiness(preview(),context).canApply).toBe(true);
 for(const patch of[{connected:false},{currentBinding:false},{reviewed:false},{needsRevalidation:true},{expiresAt:1000},{status:'expired' as const},{status:'conflict' as const},{status:'applying' as const},{status:'rejected' as const},{status:'applied' as const}])expect(proposalReadiness(preview(),{...context,...patch}).canApply).toBe(false);
 expect(proposalReadiness(undefined,context).canApply).toBe(false);
});
it('keeps connection, review-window and exact-confirmation reasons distinct',()=>{
 const r=proposalReadiness(preview(),{...context,connected:false,reviewed:false,expiresAt:1000});
 expect(r.lifecycle.map(x=>x.code)).toContain('CONNECTION_REQUIRED');expect(r.lifecycle.map(x=>x.code)).toContain('REVIEW_WINDOW_EXPIRED');expect(r.confirmationRequired).toBe(true);expect(r.approvalCount).toBe(0);
});
it('does not turn a cache warning on a new in-memory review into imaginary data conflict',()=>{
 const r=proposalReadiness(preview(),{...context,cacheError:'Not saved for later'});expect(r.conflictCount).toBe(0);expect(r.canApply).toBe(true);expect(r.warnings).toContain('Not saved for later');
});
it('routes frame/video/blocking findings to their exact selected operation detail',()=>{
 const r=proposalReadiness(preview([{operationId:'prompt-01',severity:'blocking',code:'KEYFRAME_PREPARATION',message:'Repair frames.'},{operationId:'prompt-02',severity:'blocking',code:'BLOCKING_SOURCE',message:'Repair Blocking.'},{operationId:'prompt-03',severity:'blocking',code:'VIDEO_MANUAL_DECISION',message:'Choose video text.'}]),context);
 expect(r.conflicts.map(x=>x.target.tab)).toEqual(['frames','blocking','video']);expect(r.conflicts[0].target.operationId).toBe('prompt-01');
});
it('has a safe navigator group for every operation, including unknown ones',()=>{
 for(const type of['project.create','shot.create','scene.create_recipe','frame_image.link','variant.propose','asset.propose','shot.select_take','template.future_kind','unknown.future_kind'])expect(proposalOperationGroup(type)).toBeTruthy();
 expect(proposalOperationGroup('unknown.future_kind')).toBe('Other changes');
});

it('analyzeProposalCandidateBlockers maps scene assetRefs and ensemble participant refs to candidate operations', () => {
  const p = preview();
  const cs = p.changeSet as any;
  cs.operations = [
    {
      operationId: 'op-char-silvester',
      type: 'asset.propose',
      clientRef: 'char-silvester',
      kind: 'character',
      title: 'Silvester Character',
      promptText: 'Young man in robes',
      tags: [],
    },
    {
      operationId: 'op-env-sacred-hall',
      type: 'asset.propose',
      clientRef: 'env-sacred-hall',
      kind: 'environment',
      title: 'Sacred Hall Environment',
      promptText: 'Grand stone nave',
      tags: [],
    },
    {
      operationId: 'op-dup-asset',
      type: 'asset.propose',
      clientRef: 'dup-asset',
      kind: 'style',
      title: 'Existing Style Match',
      promptText: 'Cinematic lighting',
      tags: [],
    },
    {
      operationId: 'op-outfit-robe',
      type: 'variant.propose',
      clientRef: 'outfit-robe',
      variantType: 'Outfit',
      parentCharacterId: 'existing-char-id',
      expectedParentRevision: 1,
      title: 'Silvester Robe',
      promptText: 'Linen robe',
      tags: [],
    },
    {
      operationId: 'op-scene-s01',
      type: 'scene.create_recipe',
      clientRef: 'scene-01',
      title: 'Beat 1: Opposing Columns',
      project: { ref: 'p1' },
      shot: { ref: 's1' },
      shotType: 'character_scene',
      settings: { aspectRatio: '16:9', durationSeconds: 5 },
      assetRefs: [{ slot: 'environment', asset: { ref: 'env-sacred-hall' } }],
      ensemble: {
        version: 1,
        participantUpserts: [
          {
            id: 'silvester',
            character: { asset: { ref: 'char-silvester' } },
            wardrobe: { variant: { ref: 'outfit-robe' } },
          },
        ],
      },
    },
    {
      operationId: 'op-scene-s02',
      type: 'scene.create_recipe',
      clientRef: 'scene-02',
      title: 'Beat 2: Nave',
      project: { ref: 'p1' },
      shot: { ref: 's1' },
      shotType: 'wide_scene',
      settings: { aspectRatio: '16:9', durationSeconds: 5 },
      assetRefs: [{ slot: 'environment', asset: { ref: 'env-sacred-hall' } }],
    },
  ];
  p.plan.operations = [
    { operationId: 'op-char-silvester', type: 'asset.propose', summary: 'Silvester', matches: [] } as any,
    { operationId: 'op-env-sacred-hall', type: 'asset.propose', summary: 'Sacred Hall', matches: [] } as any,
    { operationId: 'op-dup-asset', type: 'asset.propose', summary: 'Duplicate Style', matches: [{ id: 'style-1', title: 'Existing' }] } as any,
    { operationId: 'op-outfit-robe', type: 'variant.propose', summary: 'Robe', matches: [] } as any,
    { operationId: 'op-scene-s01', type: 'scene.create_recipe', summary: 'Scene 1', matches: [] } as any,
    { operationId: 'op-scene-s02', type: 'scene.create_recipe', summary: 'Scene 2', matches: [] } as any,
  ];
  const snapshot = {
    assets: [{ id: 'existing-char-id', category: 'character' as const, revision: 1, title: 'Char' }] as any,
    preferences: {},
  };

  const analysis = analyzeProposalCandidateBlockers(p, snapshot);
  expect(analysis.candidates).toHaveLength(4);
  expect(analysis.blockingCandidates.map(c => c.operationId)).toEqual([
    'op-char-silvester',
    'op-env-sacred-hall',
    'op-outfit-robe',
  ]);
  expect(analysis.byClientRef['char-silvester']?.dependentSceneIds).toEqual(['op-scene-s01']);
  expect(analysis.byClientRef['env-sacred-hall']?.dependentSceneIds).toEqual(['op-scene-s01', 'op-scene-s02']);
  expect(analysis.byClientRef['outfit-robe']?.dependentSceneIds).toEqual(['op-scene-s01']);
  expect(analysis.referencedCandidateOpIdsByScene['op-scene-s01']).toEqual([
    'op-env-sacred-hall',
    'op-char-silvester',
    'op-outfit-robe',
  ]);
  expect(analysis.referencedCandidateOpIdsByScene['op-scene-s02']).toEqual([
    'op-env-sacred-hall',
  ]);

  expect(analysis.bulkCreatableCandidates.map(c => c.operationId)).toEqual([
    'op-char-silvester',
    'op-env-sacred-hall',
    'op-outfit-robe',
  ]);
  expect(analysis.byOperationId['op-dup-asset'].canBulkCreate).toBe(false);
  expect(analysis.byOperationId['op-dup-asset'].isBlocking).toBe(false);
});

it('applyCandidateDecisionWithSafeguards resets v5/v6 blocking and frames flags on candidate decision change', () => {
  const cs: ChangeSet = {
    schema: 'krakinai.change-set.v6',
    changeSetId: 'cs-v6',
    operations: [
      { operationId: 'op-asset-1', type: 'asset.propose', clientRef: 'a1', kind: 'character', title: 'A', promptText: 'P', tags: [] },
      { operationId: 'op-scene-1', type: 'scene.create_recipe', clientRef: 's1', title: 'S1', project: { ref: 'p' }, shot: { ref: 's' }, shotType: 'character_scene', settings: { aspectRatio: '16:9', durationSeconds: 5 } },
    ],
  };
  const approval = {
    ...emptyChangeSetApproval(),
    blocking: true,
    keyframes: true,
    frameImages: true,
    frameVideo: true,
    blockingOutputDecisions: { 'out-1': { action: 'approve' as const } },
    frameOutputDecisions: { 'frame-1': { action: 'approve' as const } },
  };

  const updated = applyCandidateDecisionWithSafeguards(cs, approval, {
    'op-asset-1': { action: 'create' },
  });

  expect(updated.assetDecisions['op-asset-1']).toEqual({ action: 'create' });
  expect(updated.blocking).toBe(false);
  expect(updated.keyframes).toBe(false);
  expect(updated.frameImages).toBe(false);
  expect(updated.frameVideo).toBe(false);
  expect(updated.blockingOutputDecisions).toEqual({});
  expect(updated.frameOutputDecisions).toEqual({});

  const unchanged = applyCandidateDecisionWithSafeguards(cs, updated, {
    'op-asset-1': { action: 'create' },
  });
  expect(unchanged).toEqual(updated);
});

it('buildBulkCreateApproval sets create on bulkCreatableCandidates and skips duplicate matches', () => {
  const p = preview();
  const cs = p.changeSet as any;
  cs.schema = 'krakinai.change-set.v5';
  cs.operations = [
    { operationId: 'op-cand-1', type: 'asset.propose', clientRef: 'c1', kind: 'environment', title: 'Env', promptText: 'P', tags: [] },
    { operationId: 'op-cand-2', type: 'asset.propose', clientRef: 'c2', kind: 'character', title: 'Char', promptText: 'P', tags: [] },
  ];
  p.plan.operations = [
    { operationId: 'op-cand-1', type: 'asset.propose', summary: 'Env', matches: [] } as any,
    { operationId: 'op-cand-2', type: 'asset.propose', summary: 'Char', matches: [{ id: 'existing', title: 'Existing' }] } as any,
  ];
  p.approval = {
    ...emptyChangeSetApproval(),
    blocking: true,
  };

  const nextApproval = buildBulkCreateApproval(p);
  expect(nextApproval.assetDecisions['op-cand-1']).toEqual({ action: 'create' });
  expect(nextApproval.assetDecisions['op-cand-2']).toBeUndefined();
  expect(nextApproval.blocking).toBe(false);
});
