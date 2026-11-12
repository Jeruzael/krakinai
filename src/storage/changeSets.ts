import { validateChangeSetBackupCapacity,assessImportCapacity } from "../domain/changeSetCapacity";
import { isRecipeOperation } from "../types/changeSet";
import { recipeReviewedProjection,ensembleReviewedProjection } from "../domain/changeSetRecipeContent";
import type {
  ChangeSet,
  ChangeSetAllocation,
  ChangeSetApproval,
  ChangeSetPlan,
  ChangeSetPreview,
  ChangeSetReceipt,
  ChangeSetState,
} from "../types/changeSet";
import { emptyChangeSetApproval } from "../types/changeSet";
import { openDatabase, getAllSnapshot, generateId } from "./db";
import { parseChangeSet } from "../domain/changeSetValidation";
import {
  canonicalStringify,
  changeSetDigest,
} from "../domain/changeSetCanonical";
import { planChangeSet } from "../domain/changeSetPlanner";
import {prepareConversionSources,type ConversionSourceProofs}from'../domain/recipeConversion';
import {prepareBlockingSources,type BlockingSourceProofs} from '../domain/blockingPatch';
import {blockingReviewedProjection} from '../domain/blockingReview';
import type {SavedScene, Story}from'../types/domain';
import {
  appendImportReceipt,
  readImportLedger,
  prepareImportLedger,
  validateChangeSetApproval,
} from "../domain/changeSetLedger";
import {prepareKeyframeChangeSet,keyframeReviewedProjection} from '../domain/keyframeChangeSet';
import {frameReceiptResults} from '../domain/keyframeReceipt';
import {encodeImportEvidence,verifyImportEvidence} from '../domain/importEvidence';
import type {ImportCapacity} from '../domain/importAdmission';
import {ImportAdmissionError} from '../domain/importAdmission';
import {withStableLibraryMedia} from './mediaPreparationLock';
import { saveStory, listStories } from './stories';
const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () =>
      reject(tx.error ?? new Error("Change-set transaction aborted."));
  });
async function readConversionProofs(input:ChangeSet):Promise<ConversionSourceProofs>{
  const ids=[...new Set(input.operations.flatMap(o=>o.type==='scene.convert_direct_to_recipe'?[o.sceneId]:[]))];
  if(!ids.length)return new Map();
  const db=await openDatabase(),tx=db.transaction('scenes','readonly'),completion=done(tx);
  const scenes=await Promise.all(ids.map(id=>request<SavedScene|undefined>(tx.objectStore('scenes').get(id))));
  await completion;
  return prepareConversionSources(input,scenes.filter((s):s is SavedScene=>!!s));
}
async function readBlockingProofs(input:ChangeSet):Promise<BlockingSourceProofs>{
 if(!['krakinai.change-set.v5','krakinai.change-set.v6'].includes(input.schema))return new Map();
 const ids=[...new Set(input.operations.flatMap(o=>isRecipeOperation(o)&&'sceneId'in o?[o.sceneId]:[]))];
 if(!ids.length)return new Map();
 const db=await openDatabase(),tx=db.transaction('scenes','readonly'),completion=done(tx);
 const scenes=await Promise.all(ids.map(id=>request<SavedScene|undefined>(tx.objectStore('scenes').get(id))));await completion;
 return prepareBlockingSources(scenes.filter((s):s is SavedScene=>!!s));
}
const evidenceText=(input:ChangeSet,plan:ChangeSetPlan)=>input.schema==='krakinai.change-set.v7'?canonicalStringify({ stories: plan.stories?.map(s => ({ id: s.id, revision: s.revisionNumber })) ?? [] }):input.schema==='krakinai.change-set.v6'?canonicalStringify(keyframeReviewedProjection(plan)):input.schema==='krakinai.change-set.v5'?canonicalStringify(blockingReviewedProjection(plan)):undefined;
async function receiptVersion(input:ChangeSet,plan:ChangeSetPlan,state:ChangeSetState){
 if(input.schema==='krakinai.change-set.v7')return{version:4 as const,changeSetSchema:'krakinai.change-set.v7' as const,reviewedEvidence:await encodeImportEvidence(evidenceText(input,plan)!)};
 if(input.schema==='krakinai.change-set.v6')return{version:4 as const,changeSetSchema:'krakinai.change-set.v6' as const,reviewedEvidence:await encodeImportEvidence(evidenceText(input,plan)!),frameResults:frameReceiptResults(input,plan,state)};
 if(input.schema==='krakinai.change-set.v5')return{version:4 as const,changeSetSchema:'krakinai.change-set.v5' as const,reviewedEvidence:await encodeImportEvidence(evidenceText(input,plan)!)};
 return{version:1 as const};
}
const signedContent = (
  input: Pick<
    ChangeSetPreview,
    "changeSet" | "approval" | "allocation" | "plan"
  >,
) => ({
  changeSet: input.changeSet,
  approval: input.approval,
  allocation: input.allocation,
  stateSignature: input.plan.stateSignature,
  ...(input.changeSet.schema==='krakinai.change-set.v6'?{v6Review:keyframeReviewedProjection(input.plan)}:{}),
  ...(input.changeSet.schema==='krakinai.change-set.v5'?{v5Review:blockingReviewedProjection(input.plan)}:{}),
  ...(input.changeSet.schema==='krakinai.change-set.v3'?{v3Review:ensembleReviewedProjection(input.plan)}:{}),
  ...(input.changeSet.schema==='krakinai.change-set.v4'?{v4Review:ensembleReviewedProjection(input.plan)}:{}),
  ...(input.changeSet.schema === "krakinai.change-set.v2" &&
  input.changeSet.operations.some(isRecipeOperation)
    ? { recipeReview: recipeReviewedProjection(input.plan) }
    : {}),
});
function allocate(input: ChangeSet): ChangeSetAllocation {
  return {
    preparedAt: new Date().toISOString(),
    ids: Object.fromEntries(
      input.operations.map((op) => [
        op.operationId,
        generateId(
          op.type.startsWith("project.")
            ? "collection"
            : op.type.startsWith("shot.")
              ? "shot"
              : op.type.startsWith("scene.")
                ? "scene"
                : "candidate",
        ),
      ]),
    ),
  };
}
function emptyPlan(): ChangeSetPlan {
  return {
    findings: [],
    operations: [],
    idMappings: {},
    results: [],
    collections: [],
    scenes: [],
    assets: [],
    templates: [],
    stories: [],
    candidates: [],
    projectRevisions: {},
    stateSignature: "",
    summary: {
      projects: 0,
      shots: 0,
      scenes: 0,
      candidates: 0,
      pendingInputs: 0,
      plannedSeconds: 0,
      stories: 0,
    },
  };
}
async function previewChangeSetInternal(
  input: string | unknown,
  approval?: ChangeSetApproval,
): Promise<ChangeSetPreview> {
  const changeSet = parseChangeSet(input),
    decisions = structuredClone(approval ?? emptyChangeSetApproval());
  validateChangeSetApproval(decisions, changeSet.operations,changeSet.schema);
  const snapshot = await getAllSnapshot(),
    ledger = readImportLedger(snapshot.preferences),
    packageDigest = await changeSetDigest(changeSet),
    existing = ledger.receipts.find(
      (r) => r.changeSetId === changeSet.changeSetId,
    ),
    allocation = allocate(changeSet);
  await prepareImportLedger(ledger);
  if (existing) {
    if (existing.packageDigest !== packageDigest)
      throw Error(
        "Change-set ID was already used with different content. Use a new ID for new work.",
      );
    if (
      approval &&
      canonicalStringify(existing.approval) !== canonicalStringify(decisions)
    )
      throw Error(
        "Change-set ID was already applied with different approval decisions.",
      );
    return {
      version: 1,
      changeSet,
      approval: structuredClone(existing.approval),
      packageDigest,
      approvedDigest: existing.approvedDigest,
      allocation,
      plan: emptyPlan(),
      replay: structuredClone(existing),
    };
  }
  const conversionProofs=await prepareConversionSources(changeSet,snapshot.scenes);
  const blockingProofs=['krakinai.change-set.v5','krakinai.change-set.v6'].includes(changeSet.schema)?await prepareBlockingSources(snapshot.scenes.filter(s=>changeSet.operations.some(o=>isRecipeOperation(o)&&'sceneId'in o&&o.sceneId===s.id))):new Map();
  const keyframeContext=changeSet.schema==='krakinai.change-set.v6'?await prepareKeyframeChangeSet(changeSet,decisions,snapshot,allocation,conversionProofs,blockingProofs):undefined;
  const plan = planChangeSet(changeSet, decisions, snapshot, allocation,conversionProofs,blockingProofs,keyframeContext),
    draft = { changeSet, approval: decisions, allocation, plan };
  const approvedDigest = await changeSetDigest(signedContent(draft));
  let capacity:ImportCapacity=assessImportCapacity(snapshot,plan,ledger,allocation.preparedAt);
  if (
    !plan.findings.some(
      (f) => f.severity === "blocking" && !f.code.startsWith("APPROVAL_"),
    )
  ) {
    try {
    const receipt: ChangeSetReceipt = {
      ...await receiptVersion(changeSet,plan,snapshot),
      changeSetId: changeSet.changeSetId,
      packageDigest,
      approvedDigest,
      source: structuredClone(changeSet.source),
      ...(changeSet.title ? { title: changeSet.title } : {}),
      preparedAt: allocation.preparedAt,
      appliedAt: allocation.preparedAt,
      approval: structuredClone(decisions),
      idMappings: structuredClone(plan.idMappings),
      operations: structuredClone(plan.results),
      projectRevisions: structuredClone(plan.projectRevisions),
    };
      capacity=assessImportCapacity(snapshot,plan,ledger,allocation.preparedAt,receipt);
      plan.findings.push(...capacity.findings);
    } catch (error) {
      if(!(error instanceof ImportAdmissionError))throw error;
      const finding={severity:'blocking' as const,code:error.code,message:error.message};
      plan.findings.push(finding);capacity={...capacity,status:'blocked',findings:[finding]};
    }
  }
  return { version: 1, ...draft, packageDigest, approvedDigest,capacity };
}
async function readState(tx: IDBTransaction, stories: Story[] = []): Promise<ChangeSetState> {
  const [
    collections,
    scenes,
    assets,
    variants,
    templates,
    media,
    drafts,
    pref,
  ] = await Promise.all([
    request(tx.objectStore("collections").getAll()),
    request(tx.objectStore("scenes").getAll()),
    request(tx.objectStore("assets").getAll()),
    request(tx.objectStore("variants").getAll()),
    request(tx.objectStore("templates").getAll()),
    request(tx.objectStore("media").getAll()),
    request(tx.objectStore("drafts").getAll()),
    request(tx.objectStore("preferences").get("app_preferences")),
  ]);
  if (!pref)
    throw Error("Initialize the local library before applying a change set.");
  return {
    collections,
    scenes,
    assets,
    variants,
    templates,
    media,
    drafts,
    preferences: pref,
    stories,
  };
}
function checkSynchronousAuthorization(
  state: ChangeSetState,
  authorize?: (currentState: ChangeSetState) => unknown,
): void {
  const result = authorize?.(state);
  if (result && typeof (result as { then?: unknown }).then === "function") {
    void Promise.resolve(result).catch(() => undefined);
    throw Error(
      "Browser authorization must be synchronous inside the transaction.",
    );
  }
}
async function applyApprovedChangeSetInternal(
  preview: ChangeSetPreview,
  approvedDigest: string,
  authorize?: (currentState: ChangeSetState) => unknown,
): Promise<ChangeSetReceipt> {
  const prepared = structuredClone(preview),
    changeSet = parseChangeSet(prepared.changeSet);
  validateChangeSetApproval(prepared.approval, changeSet.operations,changeSet.schema);
  const packageDigest = await changeSetDigest(changeSet);
  if (
    prepared.version !== 1 ||
    packageDigest !== prepared.packageDigest ||
    typeof approvedDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(approvedDigest) ||
    prepared.approvedDigest !== approvedDigest
  )
    throw Error(
      "Approved digest does not match the exact preview. Preview and approve again.",
    );
  if (
    !prepared.replay &&
    (await changeSetDigest(signedContent(prepared))) !== approvedDigest
  )
    throw Error(
      "Preview content/approval digest changed. Preview and approve again.",
    );
  if (
    !prepared.allocation ||
    !Number.isFinite(Date.parse(prepared.allocation.preparedAt)) ||
    Object.keys(prepared.allocation.ids).length !==
      changeSet.operations.length ||
    changeSet.operations.some(
      (o) =>
        !prepared.allocation.ids[o.operationId] ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(
          prepared.allocation.ids[o.operationId],
        ),
    )
  )
    throw Error("Invalid preview allocation.");
  const conversionProofs=await readConversionProofs(changeSet);
  const blockingProofs=await readBlockingProofs(changeSet);
  const keyframeContext=changeSet.schema==='krakinai.change-set.v6'?await prepareKeyframeChangeSet(changeSet,prepared.approval,await getAllSnapshot(),prepared.allocation,conversionProofs,blockingProofs):undefined;
  const verificationState=await getAllSnapshot(),verifiedLedger=await prepareImportLedger(readImportLedger(verificationState.preferences));
  const verifiedEvidence=prepared.replay?undefined:await receiptVersion(changeSet,prepared.plan,verificationState);
  const verifiedText=prepared.replay?undefined:evidenceText(changeSet,prepared.plan);
  const currentStories = await listStories({ archiveFilter: 'all' });
  const db = await openDatabase(),
    tx = db.transaction(
      [
        "collections",
        "scenes",
        "assets",
        "variants",
        "templates",
        "media",
        "drafts",
        "preferences",
      ],
      "readwrite",
    ),
    completion = done(tx);
  try {
    const state = await readState(tx, currentStories),
      ledger = readImportLedger(state.preferences),
      previous = ledger.receipts.find(
        (r) => r.changeSetId === changeSet.changeSetId,
      );
    if (previous) {
      if (
        previous.packageDigest !== packageDigest ||
        previous.approvedDigest !== approvedDigest
      )
        throw Error(
          "Change-set ID was already used with different content or approvals.",
        );
      await completion;
      // A concurrent identical writer may have committed since our preparation.
      // This branch performs no writes; verify its actual receipt after the tx.
      if(previous.version===4)await verifyImportEvidence(previous.reviewedEvidence);
      const freshState=await getAllSnapshot(),currentReceipt=readImportLedger(freshState.preferences).receipts.find(r=>r.changeSetId===previous.changeSetId);
      if(!currentReceipt||canonicalStringify(currentReceipt)!==canonicalStringify(previous))throw Error('The confirmed receipt changed during verification. Revalidate before recovery.');
      checkSynchronousAuthorization(freshState,authorize);
      return structuredClone(previous);
    }
    if(canonicalStringify(ledger)!==verifiedLedger.comparison)throw Error('Import history changed during verification. Revalidate capacity and approve again; nothing was applied.');
    if (prepared.replay)
      throw Error(
        "The previous receipt is unavailable; preview this package again.",
      );
    const appliedAt = new Date().toISOString();
    const plan = planChangeSet(changeSet, prepared.approval, state, {
        ...prepared.allocation,
        preparedAt: changeSet.schema==='krakinai.change-set.v6'?prepared.allocation.preparedAt:appliedAt,
      },conversionProofs,blockingProofs,keyframeContext),
      blocked = plan.findings.filter((f) => f.severity === "blocking");
    if (blocked.length) throw Error(blocked.map((f) => f.message).join(" "));
    if (plan.stateSignature !== prepared.plan.stateSignature)
      throw Error(
        "Relevant project, scene, asset or media state changed after preview. Nothing was applied; preview and approve again.",
      );
    if(evidenceText(changeSet,plan)!==verifiedText)throw Error('Reviewed evidence changed at the atomic boundary. Revalidate and review again.');
    if(verifiedEvidence?.version===4&&verifiedEvidence.changeSetSchema==='krakinai.change-set.v6'&&canonicalStringify(frameReceiptResults(changeSet,plan,state))!==canonicalStringify(verifiedEvidence.frameResults))throw Error('Exact frame receipt results changed. Revalidate and review again.');
    if(!verifiedEvidence)throw Error('Missing verified receipt preparation.');
    const receipt: ChangeSetReceipt = {
      ...verifiedEvidence,
      changeSetId: changeSet.changeSetId,
      packageDigest,
      approvedDigest,
      source: structuredClone(changeSet.source),
      ...(changeSet.title ? { title: changeSet.title } : {}),
      preparedAt: prepared.allocation.preparedAt,
      appliedAt,
      approval: structuredClone(prepared.approval),
      idMappings: structuredClone(plan.idMappings),
      operations: structuredClone(plan.results),
      projectRevisions: structuredClone(plan.projectRevisions),
    };
    const nextLedger = appendImportReceipt(ledger, plan, receipt);
    validateChangeSetBackupCapacity(state, plan, nextLedger, appliedAt);
    // MCP consent is browser-owned and must still be live at the atomic write boundary.
    // Manual imports retain their existing path when no guard is supplied.
    checkSynchronousAuthorization(state, authorize);
    // All planning above is synchronous after IDB reads. Only this transaction owns writes.
    for (const c of plan.collections) {
      const store = tx.objectStore("collections");
      if (state.collections.some((before) => before.id === c.id)) store.put(c);
      else store.add(c);
    }
    for (const scene of plan.scenes) tx.objectStore("scenes").add(scene);
    for (const asset of plan.assets) tx.objectStore("assets").add(asset);
    for(const variant of plan.variants??[])tx.objectStore('variants').add(variant);
    for (const template of plan.templates)
      tx.objectStore("templates").add(template);
    tx.objectStore("preferences").put({
      ...state.preferences,
      aiImports: nextLedger,
      updatedAt: appliedAt,
    });
    await completion;
    if (plan.stories && plan.stories.length > 0) {
      for (const story of plan.stories) {
        await saveStory(story);
      }
    }
    return receipt;
  } catch (error) {
    try {
      tx.abort();
    } catch {}
    await completion.catch(() => undefined);
    throw error;
  }
}

/** One media-stability lease encloses C preparation and the existing Stage B transaction. */
export async function previewChangeSet(input:string|unknown,approval?:ChangeSetApproval):Promise<ChangeSetPreview>{
 const parsed=parseChangeSet(input);
 return parsed.schema==='krakinai.change-set.v6'?withStableLibraryMedia(()=>previewChangeSetInternal(parsed,approval),true):previewChangeSetInternal(parsed,approval);
}
export async function applyApprovedChangeSet(preview:ChangeSetPreview,approvedDigest:string,authorize?:(currentState:ChangeSetState)=>unknown):Promise<ChangeSetReceipt>{
 const captured=structuredClone(preview);
 return captured.changeSet.schema==='krakinai.change-set.v6'?withStableLibraryMedia(()=>applyApprovedChangeSetInternal(captured,approvedDigest,authorize),true):applyApprovedChangeSetInternal(captured,approvedDigest,authorize);
}
