import type { AiContextSelection } from './aiContext';
import type { ChangeSetPreview, ChangeSetReceipt } from './changeSet';
import type {ReviewDraftRecord} from './proposalReview';
export interface ReceiptGrant { changeSetId: string; packageDigest: string }
export interface McpScopeV1 extends Required<Omit<AiContextSelection,'blockingSceneIds'>> {
  version: 1; epoch: number; mediaIds: string[]; candidateIds: string[]; receiptGrants: ReceiptGrant[];
  allowNewProjects: boolean; allowProposals: boolean;
}
export interface McpScopeV2 extends Omit<McpScopeV1,'version'>{version:2;blockingSceneIds:string[];allowBlockingProposals:boolean}
export interface ImagePromptFrameGrant {sceneId:string;frameId:string}
export interface McpScopeV3 extends Omit<McpScopeV2,'version'> {
 version:3;keyframeSceneIds:string[];imagePromptFrameGrants:ImagePromptFrameGrant[];
 allowKeyframeProposals:boolean;allowFrameImageProposals:boolean;allowImagePromptDerivation:boolean;
}
export type McpScope=McpScopeV1|McpScopeV2|McpScopeV3;
export type ProposalStatus = 'received' | 'review_required' | 'approved' | 'applying' | 'applied' | 'rejected' | 'conflict' | 'expired' | 'disconnected';
export interface McpProposalView { id: string; changeSetId: string; packageDigest: string; sessionId: string; scopeEpoch: number; receivedAt: number; expiresAt: number; status: ProposalStatus; preview?: ChangeSetPreview; receipt?: ChangeSetReceipt; error?: string; draft?:ReviewDraftRecord; persisted?:boolean; cacheError?:string; needsRevalidation?:boolean }
