import {it,expect} from 'vitest';
import {proposalReadiness,proposalOperationGroup} from '../domain/proposalReadiness';
import {planChangeSet} from '../domain/changeSetPlanner';
import {emptyChangeSetApproval,type ChangeSetPreview,type ImportFinding} from '../types/changeSet';
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
