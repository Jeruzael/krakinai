import type {ChangeSetPreview,ImportFinding} from '../types/changeSet';
import type {ProposalStatus} from '../types/mcp';
export type ProposalDetailTab='summary'|'recipe'|'blocking'|'frames'|'video'|'data';
export interface ReviewIssueTarget {kind:'batch'|'operation';operationId?:string;tab:ProposalDetailTab}
export interface ProposalReviewIssue {
  id:string;kind:'conflict'|'approval'|'advisory'|'lifecycle';code:string;message:string;
  target:ReviewIssueTarget;projectId?:string;shotId?:string;fieldPath?:string;remedy:string;
}
export interface ReviewReadinessContext {
  status:ProposalStatus;connected:boolean;currentBinding:boolean;reviewed:boolean;
  needsRevalidation?:boolean;expiresAt:number;now:number;cacheError?:string;
}
export interface ProposalReadiness {
  conflicts:ProposalReviewIssue[];approvals:ProposalReviewIssue[];advisories:ProposalReviewIssue[];lifecycle:ProposalReviewIssue[];
  batch:ProposalReviewIssue[];byOperation:Record<string,ProposalReviewIssue[]>;
  conflictCount:number;approvalCount:number;confirmationRequired:boolean;canApply:boolean;busy:boolean;warnings:string[];
}
export function proposalOperationGroup(type:string):string{
  if(type.startsWith('project.'))return 'Projects';
  if(['shot.select_take','shot.set_status'].includes(type))return 'Preference and status';
  if(type.startsWith('shot.'))return 'Storyboard';
  if(type.startsWith('scene.'))return 'Scenes';
  if(type.startsWith('frame_'))return 'Frame images and video';
  if(type.startsWith('asset.')||type.startsWith('variant.'))return 'Reusable candidates';
  return 'Other changes';
}
function findingTab(code:string):ProposalDetailTab{
  if(/VIDEO/.test(code))return 'video';
  if(/KEYFRAME|FRAME|IMAGE/.test(code))return 'frames';
  if(/BLOCKING/.test(code))return 'blocking';
  if(/RECIPE|CANDIDATE|ASSET|OUTFIT|VARIANT/.test(code))return 'recipe';
  return 'summary';
}
function remedy(f:ImportFinding){
  if(/BACKUP_METADATA_CAPACITY|LEDGER_|RECEIPT_EVIDENCE_CAPACITY/.test(f.code))return 'Open Batch & project checks → Storage check to identify the exceeded allowance. Revalidate after revising the package; splitting may not reduce cumulative history. No receipt is removed automatically.';
  if(f.code.startsWith('APPROVAL_'))return 'Review and confirm the corresponding approval below. Confirmation does not resolve data conflicts.';
  if(f.code==='PROJECT_VALIDATION')return 'Inspect the Batch project details. A revised package may be needed; no shot is assumed to own this error.';
  if(/MANUAL|DECISION/.test(f.code))return 'Open the affected item and review the exact output or candidate decision.';
  return 'Inspect the complete finding and target. Revalidate or request a revised package if it cannot be resolved here.';
}
/** Display projection only. Validation and the atomic writer remain the authority. */
export function proposalReadiness(preview:ChangeSetPreview|undefined,context:ReviewReadinessContext):ProposalReadiness{
  const rows=new Set(preview?.plan.operations.map(row=>row.operationId)??[]);
  const conflicts:ProposalReviewIssue[]=[],approvals:ProposalReviewIssue[]=[],advisories:ProposalReviewIssue[]=[],lifecycle:ProposalReviewIssue[]=[];
  const byOperation:Record<string,ProposalReviewIssue[]>=Object.create(null),batch:ProposalReviewIssue[]=[];
  for(const [index,f]of(preview?.plan.findings??[]).entries()){
    const operationId=f.operationId&&rows.has(f.operationId)?f.operationId:undefined;
    const kind=f.severity==='advisory'?'advisory':f.code.startsWith('APPROVAL_')?'approval':'conflict';
    const item:ProposalReviewIssue={id:`finding-${index}`,kind,code:f.code,message:f.message,target:operationId?{kind:'operation',operationId,tab:findingTab(f.code)}:{kind:'batch',tab:'summary'},...(f.projectId?{projectId:f.projectId}:{}),...(f.shotId?{shotId:f.shotId}:{}),...(f.fieldPath?{fieldPath:f.fieldPath}:{}),remedy:remedy(f)};
    (kind==='advisory'?advisories:kind==='approval'?approvals:conflicts).push(item);
    if(operationId)(byOperation[operationId]??=[]).push(item);else batch.push(item);
  }
  const lifecycleIssue=(code:string,message:string)=>lifecycle.push({id:code,kind:'lifecycle',code,message,target:{kind:'batch',tab:'summary'},remedy:message});
  if(preview?.capacity?.status==='not_calculable'&&!preview.replay)lifecycleIssue('CAPACITY_NOT_CALCULABLE','Resolve the listed inputs and revalidate to calculate capacity before applying.');
  if(!context.connected||!context.currentBinding)lifecycleIssue('CONNECTION_REQUIRED','Pair in KRAKINAI, review the selected permissions, then revalidate this saved draft.');
  if(context.now>=context.expiresAt||context.status==='expired')lifecycleIssue('REVIEW_WINDOW_EXPIRED','The review window expired. Explicitly revalidate for another day; no previous approval is restored.');
  if(!preview||context.needsRevalidation||context.status==='conflict')lifecycleIssue('REVALIDATION_REQUIRED','Revalidate against current records and permissions before approving.');
  const busy=['received','approved','applying'].includes(context.status);
  if(busy)lifecycleIssue('REVIEW_BUSY',context.status==='applying'?'The atomic batch is applying. Wait for the actual receipt.':'The current preview is being prepared.');
  if(context.status==='rejected')lifecycleIssue('PROPOSAL_REJECTED','This proposal is rejected. Explicit reconsideration and fresh validation are required.');
  if(context.status==='applied')lifecycleIssue('PROPOSAL_APPLIED','This batch already has a confirmed result. Do not apply it again.');
  const confirmationRequired=!context.reviewed&&context.status!=='applied'&&context.status!=='rejected';
  const canApply=!!preview&&context.status==='review_required'&&!conflicts.length&&!approvals.length&&!lifecycle.length&&!confirmationRequired;
  return{conflicts,approvals,advisories,lifecycle,batch,byOperation,conflictCount:conflicts.length,approvalCount:new Set(approvals.map(a=>a.code)).size,confirmationRequired,canApply,busy,warnings:context.cacheError?[context.cacheError]:[]};
}
