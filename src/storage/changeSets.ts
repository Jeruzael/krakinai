import { validateChangeSetBackupCapacity } from "../domain/changeSetCapacity";
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
import {
  appendImportReceipt,
  readImportLedger,
  validateChangeSetApproval,
} from "../domain/changeSetLedger";
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
    },
  };
}
export async function previewChangeSet(
  input: string | unknown,
  approval?: ChangeSetApproval,
): Promise<ChangeSetPreview> {
  const changeSet = parseChangeSet(input),
    decisions = structuredClone(approval ?? emptyChangeSetApproval());
  validateChangeSetApproval(decisions, changeSet.operations);
  const snapshot = await getAllSnapshot(),
    ledger = readImportLedger(snapshot.preferences),
    packageDigest = await changeSetDigest(changeSet),
    existing = ledger.receipts.find(
      (r) => r.changeSetId === changeSet.changeSetId,
    ),
    allocation = allocate(changeSet);
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
  const plan = planChangeSet(changeSet, decisions, snapshot, allocation),
    draft = { changeSet, approval: decisions, allocation, plan };
  const approvedDigest = await changeSetDigest(signedContent(draft));
  if (
    !plan.findings.some(
      (f) => f.severity === "blocking" && !f.code.startsWith("APPROVAL_"),
    )
  ) {
    const receipt: ChangeSetReceipt = {
      version: 1,
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
    try {
      const next = appendImportReceipt(ledger, plan, receipt);
      validateChangeSetBackupCapacity(
        snapshot,
        plan,
        next,
        allocation.preparedAt,
      );
    } catch (error) {
      plan.findings.push({
        severity: "blocking",
        code: (error as Error).message.includes("backup metadata")
          ? "BACKUP_METADATA_CAPACITY"
          : "LEDGER_CAPACITY",
        message: (error as Error).message,
      });
    }
  }
  return { version: 1, ...draft, packageDigest, approvedDigest };
}
async function readState(tx: IDBTransaction): Promise<ChangeSetState> {
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
  };
}
export async function applyApprovedChangeSet(
  preview: ChangeSetPreview,
  approvedDigest: string,
): Promise<ChangeSetReceipt> {
  const prepared = structuredClone(preview),
    changeSet = parseChangeSet(prepared.changeSet);
  validateChangeSetApproval(prepared.approval, changeSet.operations);
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
    const state = await readState(tx),
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
      return structuredClone(previous);
    }
    if (prepared.replay)
      throw Error(
        "The previous receipt is unavailable; preview this package again.",
      );
    const appliedAt = new Date().toISOString();
    const plan = planChangeSet(changeSet, prepared.approval, state, {
        ...prepared.allocation,
        preparedAt: appliedAt,
      }),
      blocked = plan.findings.filter((f) => f.severity === "blocking");
    if (blocked.length) throw Error(blocked.map((f) => f.message).join(" "));
    if (plan.stateSignature !== prepared.plan.stateSignature)
      throw Error(
        "Relevant project, scene, asset or media state changed after preview. Nothing was applied; preview and approve again.",
      );
    const receipt: ChangeSetReceipt = {
      version: 1,
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
    // All planning above is synchronous after IDB reads. Only this transaction owns writes.
    for (const c of plan.collections) {
      const store = tx.objectStore("collections");
      if (state.collections.some((before) => before.id === c.id)) store.put(c);
      else store.add(c);
    }
    for (const scene of plan.scenes) tx.objectStore("scenes").add(scene);
    for (const asset of plan.assets) tx.objectStore("assets").add(asset);
    for (const template of plan.templates)
      tx.objectStore("templates").add(template);
    tx.objectStore("preferences").put({
      ...state.preferences,
      aiImports: nextLedger,
      updatedAt: appliedAt,
    });
    await completion;
    return receipt;
  } catch (error) {
    try {
      tx.abort();
    } catch {}
    await completion.catch(() => undefined);
    throw error;
  }
}
