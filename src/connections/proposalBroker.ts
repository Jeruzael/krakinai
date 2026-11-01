import { getAllSnapshot } from '../storage/db';
import { previewChangeSet, applyApprovedChangeSet } from '../storage/changeSets';
import { parseChangeSet } from '../domain/changeSetValidation';
import { changeSetDigest } from '../domain/changeSetCanonical';
import { readImportLedger } from '../domain/changeSetLedger';
import { assertProposalScope, canReadReceipt, emptyMcpScope, validateMcpScope } from '../domain/mcpScope';
import { readMcpTool, receiptProjection } from '../domain/mcpReads';
import { MCP_LIMITS, McpError, resultData, resultError, validateToolArgs, type McpCommand, type McpResult } from '../domain/mcpProtocol';
import { emptyChangeSetApproval, type ChangeSetApproval, type ChangeSetState } from '../types/changeSet';
import type { McpProposalView, McpScope, ReceiptGrant } from '../types/mcp';
import {conversionMcpPreview}from'../domain/recipeConversionMcp';

interface Dependencies { readState: typeof getAllSnapshot | (() => Promise<ChangeSetState>); preview: typeof previewChangeSet; apply: typeof applyApprovedChangeSet; now(): number; isSessionLive(id: string): boolean; onApplied(): Promise<void> }
interface Consent { digest: string; packageDigest: string; sessionId: string; scopeEpoch: number; expiresAt: number; used: boolean }
interface ScopeContext { sessionId?: string; epoch: number }
export interface BrokerView { connected: boolean; sessionId?: string; scope: McpScope; proposals: McpProposalView[]; approvedReceiptGrants: ReceiptGrant[] }
const pendingStates = new Set(['received', 'review_required', 'approved', 'conflict']);

/** Application authority; no serialized command can mint or redeem human consent. */
export class ProposalBroker {
  #deps: Dependencies; #session?: string; #deadline = 0; #activity = 0; #scope = emptyMcpScope();
  #proposals = new Map<string, McpProposalView>(); #reviewed = new Map<string, string>();
  #consents = new Map<string, Consent>(); #reuse = new Map<string, Set<string>>(); #receiptGrants = new Map<string, ReceiptGrant>();
  #versions = new Map<string, number>(); #listeners = new Set<() => void>();
  #view: BrokerView = { connected: false, scope: emptyMcpScope(), proposals: [], approvedReceiptGrants: [] };
  constructor(dependencies: Partial<Dependencies> = {}) { this.#deps = { readState: getAllSnapshot, preview: previewChangeSet, apply: applyApprovedChangeSet, now: Date.now, isSessionLive: () => true, onApplied: async () => {}, ...dependencies }; }
  subscribe = (listener: () => void) => { this.#listeners.add(listener); return () => { this.#listeners.delete(listener); }; };
  getState = (): BrokerView => this.#view;
  #emit() { this.#view = { connected: !!this.#session, sessionId: this.#session, scope: structuredClone(this.#scope), proposals: [...this.#proposals.values()].map(p => structuredClone(p)), approvedReceiptGrants: structuredClone([...this.#receiptGrants.values()]) }; for (const listener of this.#listeners) listener(); }
  #current(): ScopeContext { return { sessionId: this.#session, epoch: this.#scope.epoch }; }
  #assert(current: ScopeContext) { // The private state is never supplied by MCP.
    if (!current.sessionId || current.sessionId !== this.#session || !this.#deps.isSessionLive(current.sessionId) || this.#deps.now() >= this.#deadline || this.#deps.now() - this.#activity >= MCP_LIMITS.idleMs) throw new McpError('DISCONNECTED', 'The browser session is no longer authorized. Pair again.');
    if (current.epoch !== this.#scope.epoch) throw new McpError('PERMISSION_DENIED', 'Permissions changed. Review this request again.');
  }
  #effectiveScope(): McpScope { return { ...this.#scope, receiptGrants: [...this.#scope.receiptGrants, ...this.#receiptGrants.values()] }; }
  connect(sessionId: string, scope: McpScope, expiresAt = this.#deps.now() + MCP_LIMITS.sessionMs) {
    const checked = validateMcpScope(scope);
    this.disconnect(); this.#session = sessionId; this.#deadline = Math.min(expiresAt, this.#deps.now() + MCP_LIMITS.sessionMs); this.#activity = this.#deps.now();
    this.#scope = { ...checked, epoch: this.#scope.epoch + 1 }; this.#emit();
  }
  setScope(scope: McpScope) {
    const checked = validateMcpScope(scope);
    this.#scope = { ...checked, epoch: this.#scope.epoch + 1 }; this.#reviewed.clear(); this.#consents.clear(); this.#receiptGrants.clear(); this.#reuse.clear();
    for (const p of this.#proposals.values()) if (pendingStates.has(p.status)) { p.status = 'conflict'; p.error = 'Permissions changed. Preview and review again.'; }
    this.#emit();
  }
  disconnect() {
    this.#session = undefined; this.#scope = { ...emptyMcpScope(), epoch: this.#scope.epoch + 1 }; this.#reviewed.clear(); this.#consents.clear(); this.#receiptGrants.clear(); this.#reuse.clear();
    for (const p of this.#proposals.values()) if (pendingStates.has(p.status)) { p.status = 'disconnected'; p.error = 'Session ended. Request a fresh submission after pairing.'; }
    this.#emit();
  }
  expire() {
    if (this.#session && (this.#deps.now() >= this.#deadline || this.#deps.now() - this.#activity >= MCP_LIMITS.idleMs)) { this.disconnect(); return; }
    let changed = false;
    for (const p of this.#proposals.values()) if (pendingStates.has(p.status) && this.#deps.now() >= p.expiresAt) { p.status = 'expired'; this.#reviewed.delete(p.id); this.#consents.delete(p.id); changed = true; }
    if (changed) this.#emit();
  }
  #proposal(id: string) { this.expire(); const p = this.#proposals.get(id); if (!p || p.sessionId !== this.#session) throw new McpError('PERMISSION_DENIED'); return p; }
  #trusted(event: Event) { if (!(event instanceof Event) || !event.isTrusted) throw new McpError('HUMAN_APPROVAL_REQUIRED', 'Use the actual review controls in KRAKINAI to approve this proposal.'); }
  async handle(command: McpCommand, sessionId: string): Promise<McpResult> {
    try {
      this.expire(); const context = this.#current(); this.#assert(context); if (sessionId !== context.sessionId) throw new McpError('DISCONNECTED');
      this.#activity = this.#deps.now(); const args = validateToolArgs(command.tool, command.args);
      if (command.tool === 'krakinai_get_proposal_status') {
        if (!this.#scope.allowProposals) throw new McpError('PERMISSION_DENIED');
        const p = this.#proposal(String(args.proposalId));
        if (p.scopeEpoch !== this.#scope.epoch) throw new McpError('PERMISSION_DENIED');
        const data = this.#status(p);
        if(p.preview?.changeSet.schema==='krakinai.change-set.v4'&&p.status!=='applied'){
          const state=await this.#deps.readState();this.#assert(context);assertProposalScope(p.preview.changeSet,this.#scope,state,this.#reuse.get(p.id));
          return resultData({...data,previewIsSnapshot:true,previewPreparedAt:p.preview.allocation.preparedAt,previewDigest:p.preview.approvedDigest,conversions:conversionMcpPreview(p.preview,this.#scope)});
        }
        if (p.status === 'applied' && p.receipt) { const state = await this.#deps.readState(); this.#assert(context); if (!canReadReceipt(p.receipt, this.#effectiveScope(), state)) throw new McpError('PERMISSION_DENIED'); return resultData({ ...data, receipt: receiptProjection(p.receipt, state) }); }
        return resultData(data);
      }
      const state = await this.#deps.readState(); this.#assert(context);
      if (command.tool === 'krakinai_submit_change_set' || command.tool === 'krakinai_preview_change_set') {
        const pkg = parseChangeSet(args.changeSet); assertProposalScope(pkg, this.#scope, state);
        const digest = await changeSetDigest(pkg); this.#assert(context);
        if (command.tool === 'krakinai_preview_change_set') {
          const preview=await this.#deps.preview(pkg); this.#assert(context);
          return resultData({ changeSetId: pkg.changeSetId, packageDigest: digest, operationCount: pkg.operations.length, requestedOperations: pkg.operations.map(op => ({ operationId: op.operationId, type: op.type })), reviewRequired: true,...(pkg.schema==='krakinai.change-set.v4'?{conversions:conversionMcpPreview(preview,this.#scope)}:{}) });
        }
        const existing = [...this.#proposals.values()].find(p => p.sessionId === sessionId && p.changeSetId === pkg.changeSetId);
        if (existing) { if (existing.packageDigest !== digest) throw new McpError('CONFLICT', 'This change-set ID already identifies different content.'); return resultData(this.#status(existing)); }
        if (this.#proposals.size >= MCP_LIMITS.proposals) {
          const discard = [...this.#proposals.values()].find(p => ['applied', 'rejected', 'expired', 'disconnected'].includes(p.status));
          if (!discard) throw new McpError('QUEUE_FULL', 'Review or reject an existing proposal first.');
          this.#proposals.delete(discard.id); this.#reviewed.delete(discard.id); this.#consents.delete(discard.id); this.#versions.delete(discard.id); this.#reuse.delete(discard.id);
        }
        const preview = await this.#deps.preview(pkg); this.#assert(context);
        const p: McpProposalView = { id: crypto.randomUUID(), changeSetId: pkg.changeSetId, packageDigest: digest, sessionId, scopeEpoch: context.epoch, receivedAt: this.#deps.now(), expiresAt: this.#deps.now() + MCP_LIMITS.proposalMs, status: 'review_required', preview: structuredClone(preview) };
        if (preview.replay && canReadReceipt(preview.replay, this.#effectiveScope(), state)) { p.status = 'applied'; p.receipt = structuredClone(preview.replay); }
        this.#proposals.set(p.id, p); this.#emit(); return resultData(p.receipt ? { ...this.#status(p), receipt: receiptProjection(p.receipt, state) } : this.#status(p));
      }
      const data = await readMcpTool(command.tool, args, this.#effectiveScope(), state); this.#assert(context); return resultData(data);
    } catch (error) { return resultError(error); }
  }
  #status(p: McpProposalView) { return { proposalId: p.id, changeSetId: p.changeSetId, packageDigest: p.packageDigest, status: p.status, expiresAt: new Date(p.expiresAt).toISOString() }; }
  async review(id: string, approval: ChangeSetApproval = emptyChangeSetApproval()): Promise<void> {
    const p = this.#proposal(id), context = this.#current(); this.#assert(context);
    if (!p.preview || ['applying', 'applied', 'rejected', 'expired', 'disconnected'].includes(p.status)) throw new McpError('REVIEW_REQUIRED');
    const version = (this.#versions.get(id) ?? 0) + 1; this.#versions.set(id, version); this.#reviewed.delete(id); this.#consents.delete(id);
    // Render the human's choices immediately; the old digest grants nothing
    // while status is received. Only a freshly computed preview restores review.
    p.preview = { ...p.preview, approval: structuredClone(approval) }; p.status = 'received'; this.#emit();
    try {
      const state = await this.#deps.readState(); this.#assert(context);
      const reuse = new Set(Object.values(approval.assetDecisions).filter(d => d.action === 'reuse' && d.assetId).map(d => d.assetId!));
      assertProposalScope(p.preview.changeSet, this.#scope, state, reuse);
      const preview = await this.#deps.preview(p.preview.changeSet, approval); this.#assert(context);
      if (this.#versions.get(id) !== version || this.#deps.now() >= p.expiresAt) throw new McpError('PROPOSAL_EXPIRED');
      this.#reuse.set(id, reuse); p.preview = structuredClone(preview); p.scopeEpoch = context.epoch; p.status = 'review_required'; p.error = undefined;
    } catch {
      if (this.#versions.get(id) !== version || this.#session !== context.sessionId) return;
      p.status = this.#deps.now() >= p.expiresAt ? 'expired' : 'conflict'; p.error = 'Preview changed or failed. Review the current permissions and targets, then preview again.';
    }
    this.#emit();
  }
  confirmReview(id: string, reviewed: boolean, event: Event) {
    this.#trusted(event); const p = this.#proposal(id); this.#assert(this.#current());
    if (!p.preview || p.status !== 'review_required' || p.scopeEpoch !== this.#scope.epoch) throw new McpError('REVIEW_REQUIRED');
    if (reviewed) this.#reviewed.set(id, p.preview.approvedDigest); else this.#reviewed.delete(id);
    this.#emit();
  }
  isReviewed(id: string) { const p = this.#proposals.get(id); return !!p?.preview && this.#reviewed.get(id) === p.preview.approvedDigest; }
  reject(id: string) { const p = this.#proposal(id); if (p.status === 'applying' || p.status === 'applied') throw new McpError('CONFLICT'); p.status = 'rejected'; this.#reviewed.delete(id); this.#consents.delete(id); this.#emit(); }
  async applyFromUserEvent(id: string, event: Event) {
    this.#trusted(event); const p = this.#proposal(id), context = this.#current(); this.#assert(context);
    const preview = p.preview;
    if (!preview || p.status !== 'review_required' || !this.isReviewed(id) || p.scopeEpoch !== context.epoch || preview.plan.findings.some(f => f.severity === 'blocking')) throw new McpError('REVIEW_REQUIRED', 'Resolve blockers and confirm the exact current preview first.');
    const consent: Consent = { digest: preview.approvedDigest, packageDigest: p.packageDigest, sessionId: context.sessionId!, scopeEpoch: context.epoch, expiresAt: this.#deps.now() + MCP_LIMITS.approvalMs, used: false };
    this.#consents.set(id, consent); p.status = 'approved'; this.#emit(); p.status = 'applying'; this.#emit();
    try {
      const receipt = await this.#deps.apply(preview, preview.approvedDigest, currentState => {
        this.#assert(context);
        if (this.#consents.get(id) !== consent || consent.used || this.#deps.now() >= consent.expiresAt || this.#deps.now() >= p.expiresAt || consent.digest !== p.preview?.approvedDigest || consent.packageDigest !== p.packageDigest || consent.sessionId !== this.#session || consent.scopeEpoch !== this.#scope.epoch) throw new McpError('REVIEW_REQUIRED', 'Approval expired or changed. Preview and approve again.');
        if (preview.replay) { const stored = readImportLedger(currentState.preferences).receipts.find(r => r.changeSetId === preview.changeSet.changeSetId && r.packageDigest === preview.packageDigest); if (!stored) throw new McpError('CONFLICT'); }
        else assertProposalScope(preview.changeSet, this.#scope, currentState, this.#reuse.get(id));
        consent.used = true; this.#consents.delete(id);
      });
      p.receipt = structuredClone(receipt); p.status = 'applied'; p.error = undefined; this.#reviewed.delete(id);
      if (this.#session === context.sessionId && this.#scope.epoch === context.epoch) this.#receiptGrants.set(receipt.changeSetId, { changeSetId: receipt.changeSetId, packageDigest: receipt.packageDigest });
      this.#emit();
      try { await this.#deps.onApplied(); } catch { p.error = 'The batch committed, but the view could not refresh. Reload to see the saved records.'; this.#emit(); }
      return receipt;
    } catch (error) { this.#consents.delete(id); this.#reviewed.delete(id); p.status = this.#session !== context.sessionId ? 'disconnected' : this.#deps.now() >= p.expiresAt ? 'expired' : 'conflict'; p.error = 'Nothing was applied. Permissions, records or storage changed; preview and approve again.'; this.#emit(); throw error; }
  }
}
