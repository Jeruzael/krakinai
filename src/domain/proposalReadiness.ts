import type {ChangeSet,ChangeSetApproval,ChangeSetPreview,ImportFinding,CandidateDecision} from '../types/changeSet';
import type {ProposalStatus} from '../types/mcp';
import type {LibrarySnapshot} from '../storage/db';
import {canonicalStringify} from './changeSetCanonical';
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

export type OutfitCandidateDecision = NonNullable<ChangeSetApproval['variantDecisions']>[string];

export interface CandidateBlockerItem {
  operationId: string;
  clientRef?: string;
  kind: 'asset' | 'variant';
  candidateKind: string;
  title: string;
  promptText: string;
  decision: CandidateDecision | OutfitCandidateDecision;
  matchesCount: number;
  dependentSceneIds: string[];
  isBlocking: boolean;
  canBulkCreate: boolean;
}

export interface CandidateDependencyAnalysis {
  candidates: CandidateBlockerItem[];
  blockingCandidates: CandidateBlockerItem[];
  bulkCreatableCandidates: CandidateBlockerItem[];
  byClientRef: Record<string, CandidateBlockerItem>;
  byOperationId: Record<string, CandidateBlockerItem>;
  referencedCandidateOpIdsByScene: Record<string, string[]>;
}

export function analyzeProposalCandidateBlockers(
  preview?: ChangeSetPreview,
  snapshot?: Pick<LibrarySnapshot, 'assets' | 'preferences'>,
): CandidateDependencyAnalysis {
  const empty: CandidateDependencyAnalysis = {
    candidates: [],
    blockingCandidates: [],
    bulkCreatableCandidates: [],
    byClientRef: Object.create(null),
    byOperationId: Object.create(null),
    referencedCandidateOpIdsByScene: Object.create(null),
  };
  if (!preview) return empty;

  const changeSet = preview.changeSet;
  const plan = preview.plan;
  const approval = preview.approval;

  const candidates: CandidateBlockerItem[] = [];
  const candidateOps: { item: CandidateBlockerItem; op: any }[] = [];

  for (const op of changeSet.operations) {
    if (op.type === 'asset.propose') {
      const decision = approval.assetDecisions?.[op.operationId] ?? { action: 'defer' };
      const matches = plan.operations.find(r => r.operationId === op.operationId)?.matches ?? [];
      const item: CandidateBlockerItem = {
        operationId: op.operationId,
        clientRef: op.clientRef,
        kind: 'asset',
        candidateKind: op.kind,
        title: op.title || op.operationId,
        promptText: op.promptText || '',
        decision,
        matchesCount: matches.length,
        dependentSceneIds: [],
        isBlocking: false,
        canBulkCreate: decision.action === 'defer' && matches.length === 0,
      };
      candidates.push(item);
      candidateOps.push({ item, op });
    } else if (op.type === 'asset.review_candidate') {
      const decision = approval.assetDecisions?.[op.operationId] ?? { action: 'defer' };
      const matches = plan.operations.find(r => r.operationId === op.operationId)?.matches ?? [];
      const c = snapshot?.preferences?.aiImports?.candidates?.find(x => x.id === (op as any).candidateId);
      const item: CandidateBlockerItem = {
        operationId: op.operationId,
        clientRef: undefined,
        kind: 'asset',
        candidateKind: c?.kind ?? 'asset',
        title: c?.title ?? op.operationId,
        promptText: c?.promptText ?? '',
        decision,
        matchesCount: matches.length,
        dependentSceneIds: [],
        isBlocking: false,
        canBulkCreate: decision.action === 'defer' && matches.length === 0,
      };
      candidates.push(item);
      candidateOps.push({ item, op });
    } else if (op.type === 'variant.propose') {
      const decision = approval.variantDecisions?.[op.operationId] ?? { action: 'defer' };
      const matches = plan.operations.find(r => r.operationId === op.operationId)?.matches ?? [];
      const parentOk = !snapshot || !op.parentCharacterId || (snapshot.assets ?? []).some(a => a.id === op.parentCharacterId);
      const item: CandidateBlockerItem = {
        operationId: op.operationId,
        clientRef: op.clientRef,
        kind: 'variant',
        candidateKind: op.variantType || 'Outfit',
        title: op.title || op.operationId,
        promptText: op.promptText || '',
        decision,
        matchesCount: matches.length,
        dependentSceneIds: [],
        isBlocking: false,
        canBulkCreate: decision.action === 'defer' && matches.length === 0 && parentOk,
      };
      candidates.push(item);
      candidateOps.push({ item, op });
    } else if (op.type === 'variant.review_candidate') {
      const decision = approval.variantDecisions?.[op.operationId] ?? { action: 'defer' };
      const matches = plan.operations.find(r => r.operationId === op.operationId)?.matches ?? [];
      const vc = snapshot?.preferences?.aiImports?.variantCandidates?.find(x => x.id === (op as any).candidateId);
      const item: CandidateBlockerItem = {
        operationId: op.operationId,
        clientRef: undefined,
        kind: 'variant',
        candidateKind: 'Outfit',
        title: vc?.title ?? op.operationId,
        promptText: vc?.promptText ?? '',
        decision,
        matchesCount: matches.length,
        dependentSceneIds: [],
        isBlocking: false,
        canBulkCreate: decision.action === 'defer' && matches.length === 0,
      };
      candidates.push(item);
      candidateOps.push({ item, op });
    }
  }

  const byClientRef: Record<string, CandidateBlockerItem> = Object.create(null);
  const byOperationId: Record<string, CandidateBlockerItem> = Object.create(null);
  for (const { item } of candidateOps) {
    if (item.clientRef) byClientRef[item.clientRef] = item;
    byOperationId[item.operationId] = item;
  }

  const findCandidate = (ref: string): CandidateBlockerItem | undefined => {
    return byClientRef[ref] ?? byOperationId[ref] ?? candidateOps.find(({ op }) => (op as any).candidateId === ref)?.item;
  };

  const referencedCandidateOpIdsByScene: Record<string, string[]> = Object.create(null);

  for (const op of changeSet.operations) {
    if (!op.type.startsWith('scene.')) continue;
    const sceneOpId = op.operationId;
    const referencedOpIds: string[] = [];

    const addRef = (ref?: string) => {
      if (!ref) return;
      const candidate = findCandidate(ref);
      if (candidate) {
        if (!candidate.dependentSceneIds.includes(sceneOpId)) {
          candidate.dependentSceneIds.push(sceneOpId);
        }
        if (!referencedOpIds.includes(candidate.operationId)) {
          referencedOpIds.push(candidate.operationId);
        }
      }
    };

    if (Array.isArray((op as any).assetRefs)) {
      for (const link of (op as any).assetRefs) {
        if (link?.asset && 'ref' in link.asset) {
          addRef(link.asset.ref);
        }
      }
    }

    if (Array.isArray((op as any).variantRefs)) {
      for (const link of (op as any).variantRefs) {
        if (link) {
          if ('ref' in link) addRef((link as any).ref);
          else if (link.variant && 'ref' in link.variant) addRef(link.variant.ref);
          else if (link.variantId) addRef(link.variantId);
        }
      }
    }

    const ensemble = (op as any).ensemble;
    if (ensemble && Array.isArray(ensemble.participantUpserts)) {
      for (const p of ensemble.participantUpserts) {
        if (p?.character?.asset && 'ref' in p.character.asset) {
          addRef(p.character.asset.ref);
        }
        if (p?.wardrobe) {
          if ('asset' in p.wardrobe && p.wardrobe.asset && 'ref' in p.wardrobe.asset) {
            addRef(p.wardrobe.asset.ref);
          } else if ('variant' in p.wardrobe && p.wardrobe.variant && 'ref' in p.wardrobe.variant) {
            addRef(p.wardrobe.variant.ref);
          } else if ('ref' in p.wardrobe) {
            addRef(p.wardrobe.ref);
          }
        }
      }
    }

    if (referencedOpIds.length > 0) {
      referencedCandidateOpIdsByScene[sceneOpId] = referencedOpIds;
    }
  }

  for (const c of candidates) {
    c.isBlocking = c.dependentSceneIds.length > 0 && c.decision.action === 'defer';
  }

  const blockingCandidates = candidates.filter(c => c.isBlocking);
  const bulkCreatableCandidates = candidates.filter(c => c.canBulkCreate);

  return {
    candidates,
    blockingCandidates,
    bulkCreatableCandidates,
    byClientRef,
    byOperationId,
    referencedCandidateOpIdsByScene,
  };
}

export function applyCandidateDecisionWithSafeguards(
  changeSet: ChangeSet,
  currentApproval: ChangeSetApproval,
  nextAssetDecisions: ChangeSetApproval['assetDecisions'],
  nextVariantDecisions?: ChangeSetApproval['variantDecisions'],
): ChangeSetApproval {
  const sanitizedAssetDecisions: ChangeSetApproval['assetDecisions'] = {};
  for (const [opId, d] of Object.entries(nextAssetDecisions ?? {})) {
    if (d.action === 'reuse' && (!d.assetId || d.expectedRevision === undefined)) {
      sanitizedAssetDecisions[opId] = { action: 'defer' };
    } else {
      sanitizedAssetDecisions[opId] = d;
    }
  }

  const sanitizedVariantDecisions: ChangeSetApproval['variantDecisions'] = nextVariantDecisions ? {} : undefined;
  if (nextVariantDecisions) {
    for (const [opId, d] of Object.entries(nextVariantDecisions)) {
      if (d.action === 'reuse' && (!d.variantId || d.expectedRevision === undefined)) {
        sanitizedVariantDecisions![opId] = { action: 'defer' };
      } else {
        sanitizedVariantDecisions![opId] = d;
      }
    }
  }

  let next: ChangeSetApproval = {
    ...currentApproval,
    assetDecisions: sanitizedAssetDecisions,
    ...(sanitizedVariantDecisions !== undefined ? { variantDecisions: sanitizedVariantDecisions } : {}),
  };
  const decisionsChanged =
    canonicalStringify([next.assetDecisions, next.variantDecisions ?? {}]) !==
    canonicalStringify([currentApproval.assetDecisions, currentApproval.variantDecisions ?? {}]);

  if (decisionsChanged) {
    if (['krakinai.change-set.v5', 'krakinai.change-set.v6'].includes(changeSet.schema)) {
      next = {
        ...next,
        blocking: false,
        blockingOutputDecisions: {},
        ...(changeSet.schema === 'krakinai.change-set.v6'
          ? { keyframes: false, frameImages: false, frameVideo: false, frameOutputDecisions: {} }
          : {}),
      };
    }
    if (changeSet.operations.some(o => o.type === 'scene.convert_direct_to_recipe')) {
      next = { ...next, conversionDecisions: {} };
    }
  }
  return next;
}

export function buildBulkCreateApproval(
  preview: ChangeSetPreview,
  snapshot?: Pick<LibrarySnapshot, 'assets' | 'preferences'>,
  targetOperationIds?: string[],
): ChangeSetApproval {
  const analysis = analyzeProposalCandidateBlockers(preview, snapshot);
  const targets = new Set(targetOperationIds ?? analysis.bulkCreatableCandidates.map(c => c.operationId));

  const nextAssetDecisions = { ...preview.approval.assetDecisions };
  const nextVariantDecisions = { ...(preview.approval.variantDecisions ?? {}) };

  for (const candidate of analysis.bulkCreatableCandidates) {
    if (!targets.has(candidate.operationId)) continue;
    if (candidate.kind === 'asset') {
      nextAssetDecisions[candidate.operationId] = { action: 'create' };
    } else if (candidate.kind === 'variant') {
      nextVariantDecisions[candidate.operationId] = { action: 'create' };
    }
  }

  return applyCandidateDecisionWithSafeguards(
    preview.changeSet,
    preview.approval,
    nextAssetDecisions,
    nextVariantDecisions,
  );
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
  if(/RECIPE|CANDIDATE|ASSET|OUTFIT|VARIANT|DEPENDENCY|DOMAIN_RULE/.test(code))return 'recipe';
  return 'summary';
}
function remedy(f:ImportFinding){
  if(/BACKUP_METADATA_CAPACITY|LEDGER_|RECEIPT_EVIDENCE_CAPACITY/.test(f.code))return 'Open Batch & project checks → Storage check to identify the exceeded allowance. Revalidate after revising the package; splitting may not reduce cumulative history. No receipt is removed automatically.';
  if(f.code.startsWith('APPROVAL_'))return 'Review and confirm the corresponding approval below. Confirmation does not resolve data conflicts.';
  if(f.code==='PROJECT_VALIDATION')return 'Inspect the Batch project details. A revised package may be needed; no shot is assumed to own this error.';
  if(/MANUAL|DECISION/.test(f.code))return 'Open the affected item and review the exact output or candidate decision.';
  if(/select an existing linked participant or explicitly leave narration unlinked/.test(f.message))return 'The staged script assigned a dialogue cue to a participant not cast in this scene. Download the package JSON, correct the cue’s participantId (or add that character to the scene’s participants), and re-import.';
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
