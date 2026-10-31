import type { AiContextSelection } from './aiContext';
import type { ChangeSetPreview, ChangeSetReceipt } from './changeSet';
export interface ReceiptGrant { changeSetId: string; packageDigest: string }
export interface McpScope extends Required<AiContextSelection> {
  version: 1; epoch: number; mediaIds: string[]; candidateIds: string[]; receiptGrants: ReceiptGrant[];
  allowNewProjects: boolean; allowProposals: boolean;
}
export type ProposalStatus = 'received' | 'review_required' | 'approved' | 'applying' | 'applied' | 'rejected' | 'conflict' | 'expired' | 'disconnected';
export interface McpProposalView { id: string; changeSetId: string; packageDigest: string; sessionId: string; scopeEpoch: number; receivedAt: number; expiresAt: number; status: ProposalStatus; preview?: ChangeSetPreview; receipt?: ChangeSetReceipt; error?: string }
