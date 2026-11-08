import {importBatchChecks} from '../domain/importBatchChecks';
import { getAllSnapshot } from '../storage/db';
import { previewChangeSet, applyApprovedChangeSet } from '../storage/changeSets';
import { parseChangeSet } from '../domain/changeSetValidation';
import { changeSetDigest } from '../domain/changeSetCanonical';
import { readImportLedger } from '../domain/changeSetLedger';
import { assertProposalScope, canReadReceipt, emptyMcpScope, validateMcpScope } from '../domain/mcpScope';
import { readMcpTool, receiptProjection } from '../domain/mcpReads';
import { MCP_LIMITS, McpError, resultData, resultError, validateToolArgs, type McpCommand, type McpResult, type McpToolName } from '../domain/mcpProtocol';
import { emptyChangeSetApproval, type ChangeSet, type ChangeSetApproval, type ChangeSetState } from '../types/changeSet';
import type { McpProposalView, McpScope, ReceiptGrant } from '../types/mcp';
import {conversionMcpPreview}from'../domain/recipeConversionMcp';
import {requireBlockingCapabilities,requireKeyframeCapabilities} from '../domain/mcpCapabilities';
import {keyframeMcpPreview,type FrameMcpProjection} from '../domain/keyframeMcp';
import {blockingMcpPreview} from '../domain/blockingMcp';
import {ProposalInbox} from './proposalInbox';
import {REVIEW_WINDOW_MS,reviewWindowExpired,validateReviewFeedback} from '../domain/proposalReview';
import {feedbackForCurrentContext,type ReviewFeedbackShare} from '../domain/proposalFeedback';
import type {ReviewInbox,ReviewProgress,InvalidReviewDraft} from '../types/proposalReview';
import {withProposalReviewLock} from './proposalReviewLock';
import {
  createEmptyDraftChangeSet,
  stageProjectOperation,
  stageShotOperation,
  stageShotOrderOperation,
  stageShotStatusOperation,
  stageAssetCandidateOperation,
  stageOutfitVariantOperation,
  stageSceneRecipeOperation,
  stageSceneEnsembleOperation,
  stageSceneDialogueOperation,
  stageCameraCompositionOperation,
  stageDirectToRecipeOperation,
  stageSceneBlockingOperation,
  stageKeyframePlanOperation,
  stageFrameImageOperation,
  stageStoryboardBatchOperation,
} from '../domain/mcpGranularStaging';
import {
  readAssetDetail,
  readCatalogPresets,
  readProjectContinuity,
  readSpatialContinuity,
  readSceneAssemblyPreview,
  readSavedScenesList,
  readExportedScenePrompts,
} from '../domain/mcpGranularReads';

interface Dependencies { readState: typeof getAllSnapshot | (() => Promise<ChangeSetState>); preview: typeof previewChangeSet; apply: typeof applyApprovedChangeSet; now(): number; isSessionLive(id: string): boolean; onApplied(): Promise<void>; inbox?:ReviewInbox|ProposalInbox; origin?:string;reviewLock:typeof withProposalReviewLock }
interface Consent { digest: string; packageDigest: string; sessionId: string; scopeEpoch: number; expiresAt: number; used: boolean }
interface ScopeContext { sessionId?: string; epoch: number }
export interface BrokerView { connected: boolean; sessionId?: string; scope: McpScope; proposals: McpProposalView[]; approvedReceiptGrants: ReceiptGrant[]; inboxError?:string; invalidDrafts?:InvalidReviewDraft[] }
const pendingStates = new Set(['received', 'review_required', 'approved', 'conflict']);

/** Application authority; no serialized command can mint or redeem human consent. */
export class ProposalBroker {
  #deps: Dependencies; #session?: string; #deadline = 0; #activity = 0; #scope:McpScope = emptyMcpScope();#capabilities:readonly string[]=[];
  #proposals = new Map<string, McpProposalView>(); #reviewed = new Map<string, string>();
  #consents = new Map<string, Consent>(); #reuse = new Map<string, Set<string>>(); #receiptGrants = new Map<string, ReceiptGrant>();
  #versions = new Map<string, number>(); #listeners = new Set<() => void>();
  #inbox:ProposalInbox; #initialized?:Promise<void>;
  #feedbackShares=new Map<string,ReviewFeedbackShare>();
  #view: BrokerView = { connected: false, scope: emptyMcpScope(), proposals: [], approvedReceiptGrants: [] };
  constructor(dependencies: Partial<Dependencies> = {}) {
    this.#deps = { readState: getAllSnapshot, preview: previewChangeSet, apply: applyApprovedChangeSet, now: Date.now, isSessionLive: () => true, onApplied: async () => {},reviewLock:withProposalReviewLock, ...dependencies };
    this.#inbox = dependencies.inbox instanceof ProposalInbox
      ? dependencies.inbox
      : new ProposalInbox(dependencies.inbox, this.#deps.origin ?? 'http://localhost:5173', () => this.#deps.now());
  }
  #locked<T>(id:string,work:()=>Promise<T>):Promise<T>{return this.#deps.inbox?this.#deps.reviewLock(id,work):work();}
  subscribe = (listener: () => void) => { this.#listeners.add(listener); return () => { this.#listeners.delete(listener); }; };
  getState = (): BrokerView => this.#view;
  #emit() { for(const p of this.#proposals.values())this.#inbox.annotate(p);this.#view = { connected: !!this.#session, sessionId: this.#session, scope: structuredClone(this.#scope), proposals: [...this.#proposals.values()].map(p => structuredClone(p)), approvedReceiptGrants: structuredClone([...this.#receiptGrants.values()]),...(this.#inbox.error?{inboxError:this.#inbox.error}:{}),invalidDrafts:structuredClone(this.#inbox.invalid) }; for (const listener of this.#listeners) listener(); }
  initializeInbox():Promise<void>{
    if(!this.#initialized)this.#initialized=(async()=>{await this.#inbox.initialize();for(const r of this.#inbox.all())if(!this.#proposals.has(r.id))this.#proposals.set(r.id,{id:r.id,changeSetId:r.changeSetId,packageDigest:r.packageDigest,sessionId:'',scopeEpoch:-1,receivedAt:r.firstReceivedAt,expiresAt:r.expiresAt,status:r.disposition==='rejected'?'rejected':reviewWindowExpired(r,this.#deps.now())?'expired':'disconnected',needsRevalidation:true,...(['applying','applied'].includes(r.disposition)?{error:'Previous save outcome needs checking against the actual receipt before retrying.'}:{})});this.#emit();})();
    return this.#initialized;
  }
  #current(): ScopeContext { return { sessionId: this.#session, epoch: this.#scope.epoch }; }
  #assert(current: ScopeContext) { // The private state is never supplied by MCP.
    if (!current.sessionId || current.sessionId !== this.#session || !this.#deps.isSessionLive(current.sessionId) || this.#deps.now() >= this.#deadline || this.#deps.now() - this.#activity >= MCP_LIMITS.idleMs) throw new McpError('DISCONNECTED', 'The browser session is no longer authorized. Pair again.');
    if (current.epoch !== this.#scope.epoch) throw new McpError('PERMISSION_DENIED', 'Permissions changed. Review this request again.');
  }
  #effectiveScope(): McpScope { return { ...this.#scope, receiptGrants: [...this.#scope.receiptGrants, ...this.#receiptGrants.values()] }; }
  connect(sessionId: string, scope: McpScope, expiresAt = this.#deps.now() + MCP_LIMITS.sessionMs,capabilities:readonly string[]=[]) {
    const checked = validateMcpScope(scope);
    if(checked.version!==1)requireBlockingCapabilities(capabilities);
    if(checked.version===3)requireKeyframeCapabilities(capabilities);
    this.disconnect(); this.#session = sessionId; this.#deadline = Math.min(expiresAt, this.#deps.now() + MCP_LIMITS.sessionMs); this.#activity = this.#deps.now();
    this.#capabilities=[...capabilities];
    this.#scope = { ...checked, epoch: this.#scope.epoch + 1 }; this.#emit();
  }
  setScope(scope: McpScope) {
    const checked = validateMcpScope(scope);
    if(this.#session&&checked.version!==this.#scope.version)throw new McpError('CAPABILITY_REQUIRED','Disconnect and make a fresh native pairing before changing the permission format.');
    if(this.#session&&checked.version!==1)requireBlockingCapabilities(this.#capabilities);
    if(this.#session&&checked.version===3)requireKeyframeCapabilities(this.#capabilities);
    this.#scope = { ...checked, epoch: this.#scope.epoch + 1 }; this.#reviewed.clear(); this.#consents.clear(); this.#receiptGrants.clear(); this.#reuse.clear();
    this.#feedbackShares.clear();
    for (const p of this.#proposals.values()) if (pendingStates.has(p.status)) { p.status = 'conflict';p.needsRevalidation=true;p.preview=p.preview?{...p.preview,approval:emptyChangeSetApproval()}:undefined; p.error = 'Permissions changed. Preview and review again.'; }
    this.#emit();
  }
  disconnect() {
    this.#capabilities=[];
    this.#session = undefined; this.#scope = { ...emptyMcpScope(), epoch: this.#scope.epoch + 1 }; this.#reviewed.clear(); this.#consents.clear(); this.#receiptGrants.clear(); this.#reuse.clear();
    this.#feedbackShares.clear();
    for (const p of this.#proposals.values()) if (pendingStates.has(p.status)) { p.status = 'disconnected';p.needsRevalidation=true;p.preview=p.preview?{...p.preview,approval:emptyChangeSetApproval()}:undefined; p.error = 'Session ended. Your draft remains available. Pair and revalidate before approval.'; }
    this.#emit();
  }
  touchActivity() {
    if (this.#session) {
      this.#activity = this.#deps.now();
      this.#deadline = this.#deps.now() + MCP_LIMITS.sessionMs;
    }
  }
  expire() {
    if (this.#session && (this.#deps.now() >= this.#deadline || this.#deps.now() - this.#activity >= MCP_LIMITS.idleMs)) this.disconnect();
    let changed = false;
    for (const p of this.#proposals.values()) if (!['applied','applying','rejected','expired'].includes(p.status) && this.#deps.now() >= p.expiresAt) { p.status = 'expired';p.needsRevalidation=true; this.#reviewed.delete(p.id); this.#consents.delete(p.id); changed = true; }
    if (changed) this.#emit();
  }
  #proposal(id: string) { this.expire(); const p = this.#proposals.get(id); if (!p || p.sessionId !== this.#session) throw new McpError('PERMISSION_DENIED'); return p; }
  #trusted(event: Event) { if (!(event instanceof Event) || !event.isTrusted) throw new McpError('HUMAN_APPROVAL_REQUIRED', 'Use the actual review controls in KRAKINAI to approve this proposal.'); }
  async handle(command: McpCommand, sessionId: string): Promise<McpResult> {
    try {
      this.expire(); const context = this.#current(); this.#assert(context); if (sessionId !== context.sessionId) throw new McpError('DISCONNECTED');
      this.#activity = this.#deps.now(); const args = validateToolArgs(command.tool, command.args);
      if(command.tool==='krakinai_submit_change_set'||command.tool==='krakinai_get_proposal_status'||command.tool==='krakinai_list_proposals'||command.tool==='krakinai_discard_proposal'||command.tool.startsWith('krakinai_stage_')){await this.initializeInbox();this.#assert(context);}
      if(args.target||args.projection||('changeSet'in args&&(args.changeSet as {schema?:string})?.schema==='krakinai.change-set.v6'))requireKeyframeCapabilities(this.#capabilities);
      if (command.tool === 'krakinai_list_proposals') {
        if (!this.#scope.allowProposals) throw new McpError('PERMISSION_DENIED');
        const items = [...this.#proposals.values()]
          .filter((p) => !p.sessionId || p.sessionId === sessionId)
          .map((p) => ({
            proposalId: p.id,
            changeSetId: p.changeSetId,
            title: p.preview?.changeSet.title ?? this.#inbox.record(p.id)?.changeSet.title ?? 'Proposal',
            status: p.status,
            operationCount:
              p.preview?.changeSet.operations.length ??
              this.#inbox.record(p.id)?.changeSet.operations.length ??
              0,
            blockingFindingCount:
              p.preview?.plan.findings.filter((f) => f.severity === 'blocking').length ?? 0,
            expiresAt: p.expiresAt,
          }));
        return resultData({ items });
      }
      if (command.tool === 'krakinai_discard_proposal') {
        if (!this.#scope.allowProposals) throw new McpError('PERMISSION_DENIED');
        const proposalId = String(args.proposalId);
        const p = this.#proposals.get(proposalId);
        if (!p || (p.sessionId && p.sessionId !== sessionId)) throw new McpError('PERMISSION_DENIED');
        if (p.status === 'applied' || p.status === 'applying') {
          throw new McpError('CONFLICT', 'Applied or applying proposals cannot be discarded.');
        }
        await this.#inbox.discard(proposalId);
        this.#proposals.delete(proposalId);
        this.#reviewed.delete(proposalId);
        this.#consents.delete(proposalId);
        this.#receiptGrants.delete(proposalId);
        this.#reuse.delete(proposalId);
        this.#feedbackShares.delete(proposalId);
        this.#emit();
        return resultData({ discarded: true, proposalId });
      }
      if (command.tool.startsWith('krakinai_stage_')) {
        return await this.#handleGranularStage(command.tool, args, sessionId, context);
      }
      if (command.tool === 'krakinai_get_proposal_status') {
        if (!this.#scope.allowProposals) throw new McpError('PERMISSION_DENIED');
        const p = this.#proposal(String(args.proposalId));
        if (p.scopeEpoch !== this.#scope.epoch) throw new McpError('PERMISSION_DENIED');
        if(p.status!=='applied'){
          const state=await this.#deps.readState();this.#assert(context);
          const pkg=p.preview?.changeSet??this.#inbox.record(p.id)?.changeSet;if(!pkg)throw new McpError('PERMISSION_DENIED');
          assertProposalScope(pkg,this.#scope,state,this.#reuse.get(p.id));
          if(this.#feedbackShares.has(p.id)){await this.#inbox.refresh(p.id);this.#assert(context);}
        }
        const data = this.#status(p);
        if(p.preview?.changeSet.schema==='krakinai.change-set.v6'&&p.status!=='applied'){
          const state=await this.#deps.readState();this.#assert(context);assertProposalScope(p.preview.changeSet,this.#scope,state,this.#reuse.get(p.id));
          const keyframes=await keyframeMcpPreview(p.preview,this.#scope,state,args.projection as FrameMcpProjection|undefined);this.#assert(context);return resultData({...data,previewIsSnapshot:true,previewPreparedAt:p.preview.allocation.preparedAt,previewDigest:p.preview.approvedDigest,keyframes});
        }
        if(p.preview?.changeSet.schema==='krakinai.change-set.v5'&&p.status!=='applied'){
          const state=await this.#deps.readState();this.#assert(context);assertProposalScope(p.preview.changeSet,this.#scope,state,this.#reuse.get(p.id));
          return resultData({...data,previewIsSnapshot:true,previewPreparedAt:p.preview.allocation.preparedAt,previewDigest:p.preview.approvedDigest,blocking:blockingMcpPreview(p.preview,this.#scope,state)});
        }
        if(p.preview?.changeSet.schema==='krakinai.change-set.v4'&&p.status!=='applied'){
          const state=await this.#deps.readState();this.#assert(context);assertProposalScope(p.preview.changeSet,this.#scope,state,this.#reuse.get(p.id));
          return resultData({...data,previewIsSnapshot:true,previewPreparedAt:p.preview.allocation.preparedAt,previewDigest:p.preview.approvedDigest,conversions:conversionMcpPreview(p.preview,this.#scope)});
        }
        if (p.status === 'applied' && p.receipt) { const state = await this.#deps.readState(); this.#assert(context); if (!canReadReceipt(p.receipt, this.#effectiveScope(), state)) throw new McpError('PERMISSION_DENIED'); return resultData({ ...data, receipt: receiptProjection(p.receipt, state) }); }
        return resultData(data);
      }
      const state = await this.#deps.readState(); this.#assert(context);
      if (command.tool === 'krakinai_submit_change_set' || command.tool === 'krakinai_preview_change_set') {
        const pkg = parseChangeSet(args.changeSet),readOnlyDerivation=command.tool==='krakinai_preview_change_set'&&!!args.projection&&pkg.schema==='krakinai.change-set.v6'&&this.#scope.version===3&&this.#scope.allowImagePromptDerivation&&(!this.#scope.allowProposals||!this.#scope.allowKeyframeProposals); assertProposalScope(pkg, this.#scope, state,new Set(),readOnlyDerivation);
        const digest = await changeSetDigest(pkg); this.#assert(context);
        if (command.tool === 'krakinai_preview_change_set') {
          const preview=await this.#deps.preview(pkg); this.#assert(context);
          const current=['krakinai.change-set.v5','krakinai.change-set.v6'].includes(pkg.schema)?await this.#deps.readState():state;this.#assert(context);if(['krakinai.change-set.v5','krakinai.change-set.v6'].includes(pkg.schema))assertProposalScope(pkg,this.#scope,current,new Set(),readOnlyDerivation);
          const keyframes=pkg.schema==='krakinai.change-set.v6'?await keyframeMcpPreview(preview,this.#scope,current,args.projection as FrameMcpProjection|undefined):undefined;this.#assert(context);
          if(args.projection&&!keyframes)throw new McpError('INVALID_REQUEST','Frame projection requires a v6 proposal.');
          return resultData({batchChecks:importBatchChecks(preview),...(keyframes?{keyframes}:{}), changeSetId: pkg.changeSetId, packageDigest: digest, operationCount: pkg.operations.length, requestedOperations: pkg.operations.map(op => ({ operationId: op.operationId, type: op.type })), reviewRequired: true,...(pkg.schema==='krakinai.change-set.v4'?{conversions:conversionMcpPreview(preview,this.#scope)}:{}),...(pkg.schema==='krakinai.change-set.v5'?{blocking:blockingMcpPreview(preview,this.#scope,current)}:{}) });
        }
        const existing = [...this.#proposals.values()].find(p => p.changeSetId === pkg.changeSetId);
        if (existing) {
          if (existing.packageDigest !== digest) throw new McpError('CONFLICT', 'This change-set ID already identifies different content.');
          if(existing.sessionId===sessionId&&!existing.needsRevalidation)return resultData(this.#status(existing));
          const record=await this.#inbox.refresh(existing.id);this.#assert(context);
          if(record.disposition==='rejected'||reviewWindowExpired(record,this.#deps.now())){
            existing.sessionId=sessionId;existing.scopeEpoch=context.epoch;existing.status=record.disposition==='rejected'?'rejected':'expired';existing.expiresAt=record.expiresAt;this.#emit();return resultData(this.#status(existing));
          }
          await this.#prepareSaved(existing,context);return resultData(existing.receipt&&canReadReceipt(existing.receipt,this.#effectiveScope(),state)?{...this.#status(existing),receipt:receiptProjection(existing.receipt,state)}:this.#status(existing));
        }
        if (this.#proposals.size >= MCP_LIMITS.proposals) {
          throw new McpError('QUEUE_FULL', 'Download or remove an existing saved review before submitting another proposal.');
        }
        const preview = await this.#deps.preview(pkg); this.#assert(context);
        if(['krakinai.change-set.v5','krakinai.change-set.v6'].includes(pkg.schema)){const current=await this.#deps.readState();this.#assert(context);assertProposalScope(pkg,this.#scope,current,new Set(),readOnlyDerivation);}
        const record=await this.#inbox.admit(pkg);
        const p: McpProposalView = { id: record.id, changeSetId: pkg.changeSetId, packageDigest: digest, sessionId, scopeEpoch: context.epoch, receivedAt:record.firstReceivedAt, expiresAt:record.expiresAt, status:'review_required', preview:structuredClone(preview),needsRevalidation:false };
        try{this.#assert(context);}catch(error){p.sessionId='';p.scopeEpoch=-1;p.status='disconnected';p.needsRevalidation=true;this.#proposals.set(p.id,p);this.#emit();throw error;}
        if (preview.replay && canReadReceipt(preview.replay, this.#effectiveScope(), state)) { p.status = 'applied'; p.receipt = structuredClone(preview.replay); }
        this.#proposals.set(p.id, p); this.#emit(); return resultData(p.receipt ? { ...this.#status(p), receipt: receiptProjection(p.receipt, state) } : this.#status(p));
      }
      if (command.tool === 'krakinai_get_asset') {
        const result = readAssetDetail(state, this.#effectiveScope(), args as { id: string });
        this.#assert(context);
        return resultData(result);
      }
      if (command.tool === 'krakinai_list_catalog_presets') {
        const result = readCatalogPresets(args as { catalog: 'cinematography' | 'performance' | 'shot_types' });
        this.#assert(context);
        return resultData(result);
      }
      if (command.tool === 'krakinai_get_project_continuity') {
        const result = readProjectContinuity(state, this.#effectiveScope(), args as { projectId: string });
        this.#assert(context);
        return resultData(result);
      }
      if (command.tool === 'krakinai_check_spatial_continuity') {
        let stagedChangeSet: ChangeSet | undefined;
        if (args.changeSetId) {
          const p = [...this.#proposals.values()].find((p) => p.changeSetId === args.changeSetId);
          stagedChangeSet = p?.preview?.changeSet ?? this.#inbox.findByChangeSetId(String(args.changeSetId))?.changeSet;
        }
        const result = readSpatialContinuity(
          state,
          this.#effectiveScope(),
          args as { projectId: string; changeSetId?: string },
          stagedChangeSet,
        );
        this.#assert(context);
        return resultData(result);
      }
      if (command.tool === 'krakinai_preview_scene_assembly') {
        let stagedChangeSet: ChangeSet | undefined;
        if (args.changeSetId) {
          const p = [...this.#proposals.values()].find((p) => p.changeSetId === args.changeSetId);
          stagedChangeSet = p?.preview?.changeSet ?? this.#inbox.findByChangeSetId(String(args.changeSetId))?.changeSet;
        }
        const result = readSceneAssemblyPreview(
          state,
          this.#effectiveScope(),
          args as { sceneId?: string; changeSetId?: string; sceneClientRef?: string },
          stagedChangeSet,
        );
        this.#assert(context);
        return resultData(result);
      }
      if (command.tool === 'krakinai_list_saved_scenes') {
        const result = readSavedScenesList(state, this.#effectiveScope(), args);
        this.#assert(context);
        return resultData(result);
      }
      if (command.tool === 'krakinai_export_scene_prompts') {
        const result = readExportedScenePrompts(state, this.#effectiveScope(), args as { sceneIds: string[] });
        this.#assert(context);
        return resultData(result);
      }
      const data = await readMcpTool(command.tool, args, this.#effectiveScope(), state); this.#assert(context); return resultData(data);
    } catch (error) { return resultError(error); }
  }
  async #handleGranularStage(
    tool: McpToolName,
    args: Record<string, unknown>,
    sessionId: string,
    context: ScopeContext,
  ): Promise<McpResult> {
    if (!this.#scope.allowProposals) throw new McpError('PERMISSION_DENIED');

    if (
      tool === 'krakinai_stage_scene_blocking' ||
      (args.blocking !== undefined) ||
      (Array.isArray(args.scenes) && args.scenes.some((s: any) => s && s.blocking !== undefined))
    ) {
      requireBlockingCapabilities(this.#capabilities);
      if (!('allowBlockingProposals' in this.#scope) || !this.#scope.allowBlockingProposals) throw new McpError('PERMISSION_DENIED');
    }
    if (
      tool === 'krakinai_stage_keyframe_plan' ||
      tool === 'krakinai_stage_frame_image' ||
      (args.keyframes !== undefined || args.keyframePlan !== undefined) ||
      (Array.isArray(args.scenes) && args.scenes.some((s: any) => s && (s.keyframes !== undefined || s.keyframePlan !== undefined)))
    ) {
      requireKeyframeCapabilities(this.#capabilities);
      if (!('allowKeyframeProposals' in this.#scope) || !this.#scope.allowKeyframeProposals) throw new McpError('PERMISSION_DENIED');
    }

    const changeSetId = String(args.changeSetId);
    const existing = [...this.#proposals.values()].find((p) => p.changeSetId === changeSetId);
    if (existing) {
      if (existing.status === 'applied' || existing.status === 'applying') {
        throw new McpError('CONFLICT', 'Applied or applying proposals cannot be modified.');
      }
    }
    const inboxRecord = this.#inbox.findByChangeSetId(changeSetId);
    if (inboxRecord && ['applied', 'applying'].includes(inboxRecord.disposition)) {
      throw new McpError('CONFLICT', 'Applied or applying proposals cannot be modified.');
    }

    let draft: ChangeSet;
    if (existing?.preview?.changeSet) {
      draft = structuredClone(existing.preview.changeSet);
    } else if (inboxRecord?.changeSet) {
      draft = structuredClone(inboxRecord.changeSet);
    } else {
      draft = createEmptyDraftChangeSet(
        changeSetId,
        typeof args.title === 'string' ? args.title : undefined,
        typeof args.description === 'string' ? args.description : undefined,
      );
    }

    let staged: { changeSet: ChangeSet; operationId: string };
    switch (tool) {
      case 'krakinai_stage_storyboard_batch':
        staged = stageStoryboardBatchOperation(draft, args);
        break;
      case 'krakinai_stage_project':
        staged = stageProjectOperation(draft, args);
        break;
      case 'krakinai_stage_shot':
        staged = stageShotOperation(draft, args);
        break;
      case 'krakinai_stage_shot_order':
        staged = stageShotOrderOperation(draft, args);
        break;
      case 'krakinai_stage_shot_status':
        staged = stageShotStatusOperation(draft, args);
        break;
      case 'krakinai_stage_asset_candidate':
        staged = stageAssetCandidateOperation(draft, args);
        break;
      case 'krakinai_stage_outfit_variant':
        staged = stageOutfitVariantOperation(draft, args);
        break;
      case 'krakinai_stage_scene_recipe':
        staged = stageSceneRecipeOperation(draft, args);
        break;
      case 'krakinai_stage_scene_ensemble':
        staged = stageSceneEnsembleOperation(draft, args);
        break;
      case 'krakinai_stage_scene_dialogue':
        staged = stageSceneDialogueOperation(draft, args);
        break;
      case 'krakinai_stage_camera_composition':
        staged = stageCameraCompositionOperation(draft, args);
        break;
      case 'krakinai_stage_direct_to_recipe':
        staged = stageDirectToRecipeOperation(draft, args);
        break;
      case 'krakinai_stage_scene_blocking':
        staged = stageSceneBlockingOperation(draft, args);
        break;
      case 'krakinai_stage_keyframe_plan':
        staged = stageKeyframePlanOperation(draft, args);
        break;
      case 'krakinai_stage_frame_image':
        staged = stageFrameImageOperation(draft, args);
        break;
      default:
        throw new McpError('UNKNOWN_TOOL');
    }

    if (staged.changeSet.schema === 'krakinai.change-set.v5') {
      requireBlockingCapabilities(this.#capabilities);
      if (!('allowBlockingProposals' in this.#scope) || !this.#scope.allowBlockingProposals) throw new McpError('PERMISSION_DENIED');
    }
    if (staged.changeSet.schema === 'krakinai.change-set.v6') {
      requireKeyframeCapabilities(this.#capabilities);
      if (!('allowKeyframeProposals' in this.#scope) || !this.#scope.allowKeyframeProposals) throw new McpError('PERMISSION_DENIED');
    }

    const state = await this.#deps.readState();
    this.#assert(context);
    assertProposalScope(staged.changeSet, this.#scope, state);

    if (!existing && !inboxRecord && this.#proposals.size >= MCP_LIMITS.proposals) {
      throw new McpError('QUEUE_FULL', 'Download or remove an existing saved review before submitting another proposal.');
    }

    const preview = await this.#deps.preview(staged.changeSet);
    this.#assert(context);

    const record = await this.#inbox.upsertDraftChangeSet(staged.changeSet);
    this.#assert(context);
    const digest = await changeSetDigest(record.changeSet);
    this.#assert(context);

    const p: McpProposalView = {
      id: record.id,
      changeSetId: record.changeSet.changeSetId,
      packageDigest: digest,
      sessionId,
      scopeEpoch: context.epoch,
      receivedAt: record.firstReceivedAt,
      expiresAt: record.expiresAt,
      status: 'review_required',
      preview: structuredClone(preview),
      needsRevalidation: false,
    };
    this.#proposals.set(p.id, p);
    this.#reviewed.delete(record.id);
    this.#consents.delete(record.id);
    this.#emit();

    return resultData({
      proposalId: record.id,
      changeSetId: record.changeSet.changeSetId,
      schema: record.changeSet.schema,
      packageDigest: record.packageDigest,
      operationCount: record.changeSet.operations.length,
      stagedOperationId: staged.operationId,
      ...('stagedCounts' in staged ? { stagedCounts: (staged as any).stagedCounts } : {}),
      status: 'review_required',
      expiresAt: record.expiresAt,
      summary: preview.plan?.summary,
      batchChecks: importBatchChecks(preview),
    });
  }
  async #prepareSaved(p:McpProposalView,context:ScopeContext,options:{renew?:boolean;reconsider?:boolean}={}){
    return this.#locked(p.id,()=>this.#prepareSavedLocked(p,context,options));
  }
  async #prepareSavedLocked(p:McpProposalView,context:ScopeContext,options:{renew?:boolean;reconsider?:boolean}={}){
    const record=await this.#inbox.refresh(p.id);this.#assert(context);
    if(record.disposition==='rejected'&&!options.reconsider)throw new McpError('REVIEW_REQUIRED','Explicitly reconsider the rejected draft before reviewing again.');
    if(reviewWindowExpired(record,this.#deps.now())&&!options.renew)throw new McpError('PROPOSAL_EXPIRED','Revalidate for another day before approving.');
    if(p.status==='applying')throw new McpError('REVIEW_REQUIRED','This proposal is applying. Wait for its actual result.');
    const state=await this.#deps.readState();this.#assert(context);
    // Cached decisions are review hints, never fresh grants or accepted manual-output decisions.
    const approval=emptyChangeSetApproval(),reuse=new Set<string>();
    const historical=readImportLedger(state.preferences).receipts.find(r=>r.changeSetId===record.changeSetId);
    if(historical){
      if(historical.packageDigest!==record.packageDigest)throw new McpError('CONFLICT','The committed change-set ID identifies different content.');
      if(!canReadReceipt(historical,this.#effectiveScope(),state))throw new McpError('PERMISSION_DENIED','Select the exact receipt or its authorized records before recovering this result.');
    }else assertProposalScope(record.changeSet,this.#scope,state,reuse);
    // Omitting approval on replay asks the existing preview path for the real ledger
    // decisions. Empty decisions would conflict with an already committed package.
    const preview=await this.#deps.preview(record.changeSet,historical?undefined:approval);this.#assert(context);
    const current=await this.#deps.readState();this.#assert(context);
    if(preview.replay){
      const actual=readImportLedger(current.preferences).receipts.find(r=>r.changeSetId===record.changeSetId&&r.packageDigest===record.packageDigest);
      if(!actual||actual.approvedDigest!==preview.replay.approvedDigest)throw new McpError('CONFLICT','The recorded outcome changed during recovery.');
      if(!canReadReceipt(actual,this.#effectiveScope(),current))throw new McpError('PERMISSION_DENIED');
    }else assertProposalScope(record.changeSet,this.#scope,current,reuse);
    const renewedAt=this.#deps.now();
    let recoveryWarning:string|undefined;
    try{await this.#inbox.update(p.id,{disposition:preview.replay?'applied':'review',...(options.reconsider?{feedback:undefined}:{}),...(options.renew?{windowStartedAt:renewedAt,expiresAt:renewedAt+REVIEW_WINDOW_MS}:{})},{...options,finishApply:['applying','applied'].includes(record.disposition)});}
    catch(error){if(!preview.replay)throw error;recoveryWarning='The confirmed receipt was recovered. Its local review status could not be updated.';}
    this.#assert(context);const saved=this.#inbox.record(p.id)!;
    p.sessionId=context.sessionId!;p.scopeEpoch=context.epoch;p.expiresAt=saved.expiresAt;p.preview=structuredClone(preview);p.status='review_required';p.needsRevalidation=false;p.error=recoveryWarning;p.receipt=undefined;
    this.#reuse.set(p.id,reuse);this.#reviewed.delete(p.id);this.#consents.delete(p.id);
    this.#feedbackShares.delete(p.id);
    if(preview.replay&&canReadReceipt(preview.replay,this.#effectiveScope(),current)){p.receipt=structuredClone(preview.replay);p.status='applied';}
    this.#emit();
  }
  async resumeDraft(id:string,event:Event,options:{renew?:boolean;reconsider?:boolean}={}){
    this.#trusted(event);await this.initializeInbox();this.expire();const context=this.#current();this.#assert(context);
    const p=this.#proposals.get(id);if(!p)throw new McpError('PERMISSION_DENIED');
    this.#reviewed.delete(id);this.#consents.delete(id);
    try{await this.#prepareSaved(p,context,options);}catch(error){p.needsRevalidation=true;p.error=error instanceof Error?error.message:'Could not resume this draft.';this.#emit();throw error;}
  }
  async removeDraft(id:string,event:Event){
    this.#trusted(event);return this.#locked(id,()=>this.#removeDraft(id,event));
  }
  async #removeDraft(id:string,event:Event){
    this.#trusted(event);await this.initializeInbox();const p=this.#proposals.get(id);
    if(!p)throw Error('Saved review is unavailable.');if(p.status==='applying')throw Error('This proposal is applying. Check the outcome first.');
    await this.#inbox.remove(id);this.#proposals.delete(id);this.#reviewed.delete(id);this.#consents.delete(id);this.#reuse.delete(id);this.#versions.delete(id);this.#emit();
  }
  async removeInvalidDraft(id:string,event:Event){this.#trusted(event);await this.#inbox.removeInvalid(id);this.#emit();}
  exportInvalidDraft(id:string){return this.#inbox.exportRaw(id);}
  async saveProgress(id:string,patch:Partial<ReviewProgress>){
    await this.initializeInbox();const p=this.#proposals.get(id),record=this.#inbox.record(id);if(!p||!record)throw Error('Saved review is unavailable.');
    try{await this.#inbox.update(id,current=>({progress:{...current.progress,...structuredClone(patch)}}));this.#emit();}
    catch(error){p.needsRevalidation=true;p.error=error instanceof Error?error.message:'Review progress could not be saved.';this.#reviewed.delete(id);this.#consents.delete(id);this.#emit();throw error;}
  }
  #status(p: McpProposalView) {
    const record=this.#inbox.record(p.id),feedback=record?feedbackForCurrentContext(record,this.#feedbackShares.get(p.id),{sessionId:this.#session,scopeEpoch:this.#scope.epoch}):undefined;
    return { proposalId:p.id,changeSetId:p.changeSetId,packageDigest:p.packageDigest,status:p.status,expiresAt:new Date(p.expiresAt).toISOString(),...(p.status!=='applied'?{batchChecks:importBatchChecks(p.preview)}:{}),...(feedback?{feedback}:{}) };
  }
  async rejectWithFeedback(id:string,text:string,share:boolean,event:Event):Promise<void>{
    this.#trusted(event);const context=this.#current();
    return this.#locked(id,()=>{if(share)this.#assert(context);return this.#rejectWithFeedback(id,text,share,event);});
  }
  async #rejectWithFeedback(id:string,text:string,share:boolean,event:Event):Promise<void>{
    this.#trusted(event);validateReviewFeedback(text);const context=this.#current();
    if(share){this.#assert(context);if(!text.trim())throw new McpError('INVALID_REQUEST','Enter a non-empty comment before sharing feedback.');}
    await this.initializeInbox();if(share)this.#assert(context);
    const p=this.#proposals.get(id),record=this.#inbox.record(id);
    if(!p||!record)throw new McpError('PERMISSION_DENIED');
    if(p.status==='applying'||p.status==='applied')throw new McpError('CONFLICT','An applying or committed batch cannot be rejected.');
    if(share){
      if(p.sessionId!==context.sessionId||p.scopeEpoch!==context.epoch)throw new McpError('PERMISSION_DENIED','Revalidate this draft in the current connection before sharing feedback.');
      const state=await this.#deps.readState();this.#assert(context);assertProposalScope(record.changeSet,this.#scope,state,this.#reuse.get(id));
    }
    this.#reviewed.delete(id);this.#consents.delete(id);this.#feedbackShares.delete(id);
    const rejectedAt=this.#deps.now();
    await this.#inbox.update(id,{disposition:'rejected',feedback:text.trim()?{text,rejectedAt,sharedPreviously:share}:undefined});
    p.status='rejected';p.needsRevalidation=true;p.error=undefined;
    if(share){
      try{this.#assert(context);this.#feedbackShares.set(id,{sessionId:context.sessionId!,scopeEpoch:context.epoch,proposalId:id,packageDigest:p.packageDigest,text,rejectedAt});}
      catch(error){p.error='Rejected locally. The connection changed before feedback sharing was authorized.';this.#emit();throw error;}
    }
    this.#emit();
  }
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
      const decisions=Object.fromEntries(Object.entries(approval).filter(([key])=>['assetDecisions','variantDecisions','conversionDecisions','blockingOutputDecisions','frameOutputDecisions'].includes(key)));
      const record=this.#inbox.record(id);if(record)await this.#inbox.update(id,current=>({progress:{...current.progress,draftDecisions:decisions as ReviewProgress['draftDecisions']}}));
      this.#assert(context);if(this.#versions.get(id)!==version)return;
      this.#reuse.set(id, reuse); p.preview = structuredClone(preview); p.scopeEpoch = context.epoch; p.status = 'review_required'; p.error = undefined;p.needsRevalidation=false;
    } catch (error) {
      if (this.#versions.get(id) !== version || this.#session !== context.sessionId) return;
      const reason=error&&typeof error==='object'&&'message'in error&&typeof error.message==='string'?error.message:'Current permissions, targets or storage changed.';
      p.status = this.#deps.now() >= p.expiresAt ? 'expired' : 'conflict'; p.error = 'Review could not be updated. '+reason+' Resolve this requirement, then revalidate.';
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
  async reject(id:string){return this.#locked(id,async()=>{const p=this.#proposal(id);if(['applying','applied'].includes(p.status))throw new McpError('CONFLICT');await this.#inbox.update(id,{disposition:'rejected',feedback:undefined});p.status='rejected';p.needsRevalidation=true;this.#reviewed.delete(id);this.#consents.delete(id);this.#feedbackShares.delete(id);this.#emit();});}
  async applyFromUserEvent(id: string, event: Event) {
    this.#trusted(event);const context=this.#current();this.#assert(context);
    return this.#locked(id,()=>{this.#assert(context);return this.#applyFromUserEvent(id,event);});
  }
  async #applyFromUserEvent(id: string, event: Event) {
    this.#trusted(event); const p = this.#proposal(id), context = this.#current(); this.#assert(context);
    const preview = p.preview;
    if (!preview || p.status !== 'review_required' || p.needsRevalidation || !this.isReviewed(id) || p.scopeEpoch !== context.epoch || preview.plan.findings.some(f => f.severity === 'blocking')) throw new McpError('REVIEW_REQUIRED', 'Resolve blockers and confirm the exact current preview first.');
    const consent: Consent = { digest: preview.approvedDigest, packageDigest: p.packageDigest, sessionId: context.sessionId!, scopeEpoch: context.epoch, expiresAt: this.#deps.now() + MCP_LIMITS.approvalMs, used: false };
    this.#consents.set(id, consent); p.status = 'approved'; this.#emit();
    let receipt:Awaited<ReturnType<Dependencies['apply']>>;
    try {
      await this.#inbox.update(id,{disposition:'applying'});this.#assert(context);
      p.status='applying';this.#emit();
      receipt = await this.#deps.apply(preview, preview.approvedDigest, currentState => {
        this.#assert(context);
        if (this.#consents.get(id) !== consent || consent.used || this.#deps.now() >= consent.expiresAt || this.#deps.now() >= p.expiresAt || consent.digest !== p.preview?.approvedDigest || consent.packageDigest !== p.packageDigest || consent.sessionId !== this.#session || consent.scopeEpoch !== this.#scope.epoch) throw new McpError('REVIEW_REQUIRED', 'Approval expired or changed. Preview and approve again.');
        if (preview.replay) { const stored = readImportLedger(currentState.preferences).receipts.find(r => r.changeSetId === preview.changeSet.changeSetId && r.packageDigest === preview.packageDigest); if (!stored) throw new McpError('CONFLICT'); }
        else assertProposalScope(preview.changeSet, this.#scope, currentState, this.#reuse.get(id));
        consent.used = true; this.#consents.delete(id);
      });
    } catch (error) {
      this.#consents.delete(id);this.#reviewed.delete(id);p.needsRevalidation=true;
      p.status=this.#session!==context.sessionId?'disconnected':this.#deps.now()>=p.expiresAt?'expired':'conflict';
      const reason=error&&typeof error==='object'&&'message'in error&&typeof error.message==='string'?error.message:'Permissions, records or storage changed.';
      p.error='Nothing was applied. '+reason+' Revalidate and approve again.';
      if(this.#inbox.record(id)?.disposition==='applying')try{await this.#inbox.update(id,{disposition:'review'},{finishApply:true});}catch{/* Keep the uncertain local hint; recovery checks the actual receipt. */}
      this.#emit();throw error;
    }
    // A cache/view refresh failure after this point cannot undo a committed library transaction.
    p.receipt=structuredClone(receipt);p.status='applied';p.error=undefined;p.needsRevalidation=false;this.#reviewed.delete(id);
    if(this.#session===context.sessionId&&this.#scope.epoch===context.epoch)this.#receiptGrants.set(receipt.changeSetId,{changeSetId:receipt.changeSetId,packageDigest:receipt.packageDigest});
    try{await this.#inbox.update(id,{disposition:'applied'},{finishApply:true});}catch{p.error='The batch committed. Its local review status could not be saved; check the confirmed receipt after reopening.';}
    this.#emit();
    try{await this.#deps.onApplied();}catch{p.error='The batch committed, but the view could not refresh. Check the confirmed receipt and reload.';this.#emit();}
    return receipt;
  }
}
