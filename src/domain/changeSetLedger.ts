import type {
  ChangeOperation,
  ChangeSet,
  ChangeSetApproval,
  ChangeSetPlan,
  ChangeSetReceipt,
  ImportLedger,
} from "../types/changeSet";
import type { Preferences } from "../types/domain";
import {
  CHANGE_SET_SCHEMA,
  CHANGE_SET_V3_SCHEMA,
  CHANGE_SET_ID_SCHEMA,
  type JsonRule,
} from "./changeSetSchema";
import { parseChangeSet, validateJsonRule } from "./changeSetValidation";
export const MAX_IMPORT_LEDGER_BYTES = 4 * 1024 * 1024;
const text = (max: number): JsonRule => ({ type: "string", maxLength: max });
const obj = (
  properties: Record<string, JsonRule>,
  required = Object.keys(properties),
  additionalProperties = false,
): JsonRule => ({ type: "object", properties, required, additionalProperties });
const revision: JsonRule = {
  type: "integer",
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
};
const id = CHANGE_SET_ID_SCHEMA,
  sha: JsonRule = { type: "string", pattern: "^[a-f0-9]{64}$" },
  iso: JsonRule = {
    type: "string",
    maxLength: 100,
    pattern: "^\\d{4}-\\d\\d-\\d\\dT",
  };
const source = CHANGE_SET_SCHEMA.properties!.source;
const enumRule = (...values: string[]): JsonRule => ({
  type: "string",
  enum: values,
});
const types = CHANGE_SET_V3_SCHEMA.properties!.operations.items!.oneOf!.map(
  (r) => r.properties!.type.const,
);
const decisionRule = obj(
  {
    action: enumRule("defer", "create", "reuse"),
    assetId: id,
    expectedRevision: revision,
    acknowledgeDuplicate: { type: "boolean" },
  },
  ["action"],
);
export function validateChangeSetApproval(
  value: unknown,
  operations: Pick<ChangeSet["operations"][number], "operationId" | "type">[],
): asserts value is ChangeSetApproval {
  validateJsonRule(
    obj(
      {
        storyboard: { type: "boolean" },
        scenes: { type: "boolean" },
        preferred: { type: "boolean" },
        statuses: { type: "boolean" },
        assetDecisions: { type: "object" },
        variantDecisions:{type:'object'},
        allowDuplicateSceneOperations: {
          type: "array",
          items: id,
          maxItems: 100,
        },
        discardManualOutputOperations: {
          type: "array",
          items: id,
          maxItems: 100,
        },
      },
      [
        "storyboard",
        "scenes",
        "preferred",
        "statuses",
        "assetDecisions",
        "allowDuplicateSceneOperations",
      ],
    ),
    value,
    "approval",
  );
  const approval = value as ChangeSetApproval,
    known = new Map(operations.map((o) => [o.operationId, o.type]));
  if (Object.keys(approval.assetDecisions).length+Object.keys(approval.variantDecisions??{}).length > 50)
    throw Error("Too many candidate approval decisions.");
  for (const [operationId, decision] of Object.entries(
    approval.assetDecisions,
  )) {
    if (!known.get(operationId)?.startsWith("asset."))
      throw Error("Candidate approval targets an unknown operation.");
    validateJsonRule(decisionRule, decision, "candidate approval");
    if (
      decision.action === "reuse" &&
      (!decision.assetId || decision.expectedRevision === undefined)
    )
      throw Error(
        "Reuse approval needs an exact asset ID and expected revision.",
      );
    if (
      decision.action !== "reuse" &&
      (decision.assetId !== undefined ||
        decision.expectedRevision !== undefined)
    )
      throw Error("Only reuse approval accepts an existing asset target.");
  }
  for(const [operationId,decision]of Object.entries(approval.variantDecisions??{})){
    if(!known.get(operationId)?.startsWith('variant.'))throw Error('Variant approval targets an unknown operation.');
    validateJsonRule(obj({action:enumRule('defer','create','reuse'),variantId:id,expectedRevision:{...revision,minimum:1},acknowledgeDuplicate:{type:'boolean'}},['action']),decision,'variant approval');
    if(decision.action==='reuse'&&(!decision.variantId||decision.expectedRevision===undefined))throw Error('Reuse approval needs an exact variant ID and expected revision.');
    if(decision.action!=='reuse'&&(decision.variantId!==undefined||decision.expectedRevision!==undefined))throw Error('Only reuse approval accepts an existing variant target.');
  }
  if (
    new Set(approval.allowDuplicateSceneOperations).size !==
      approval.allowDuplicateSceneOperations.length ||
    approval.allowDuplicateSceneOperations.some(
      (id) =>
        !["scene.create_direct_prompt", "scene.create_recipe"].includes(
          known.get(id) ?? "",
        ),
    )
  )
    throw Error(
      "Duplicate-scene acknowledgement targets an unknown creation operation.",
    );
  const manual = approval.discardManualOutputOperations ?? [];
  if (
    new Set(manual).size !== manual.length ||
    manual.some(
      (id) =>
        ![
          "scene.create_recipe",
          "scene.revise_recipe",
          "scene.create_recipe_take",
        ].includes(known.get(id) ?? ""),
    )
  )
    throw Error(
      "Manual-output acknowledgement targets an unknown recipe operation.",
    );
}
export function validateImportLedger(
  value: unknown,
): asserts value is ImportLedger {
  if (
    new TextEncoder().encode(JSON.stringify(value)).length >
    MAX_IMPORT_LEDGER_BYTES
  )
    throw Error(
      "Import history exceeds its 4 MiB limit; no receipts were dropped.",
    );
  validateJsonRule(
    obj({
      version: { const: 1 },
      receipts: { type: "array", maxItems: 1000 },
      candidates: { type: "array", maxItems: 250 },
      variantCandidates:{type:'array',maxItems:250},
    },['version','receipts','candidates']),
    value,
    "import ledger",
  );
  const ledger = value as ImportLedger,
    seen = new Set<string>();
  if(ledger.candidates.length+(ledger.variantCandidates?.length??0)>250)throw Error('Combined import candidate capacity limit is 250; no candidates were dropped.');
  for (const receipt of ledger.receipts) {
    validateJsonRule(
      obj(
        {
          version: { const: 1 },
          changeSetId: id,
          packageDigest: sha,
          approvedDigest: sha,
          source,
          title: text(100),
          preparedAt: iso,
          appliedAt: iso,
          approval: { type: "object" },
          idMappings: { type: "object" },
          operations: { type: "array", maxItems: 250, minItems: 1 },
          projectRevisions: { type: "object" },
        },
        [
          "version",
          "changeSetId",
          "packageDigest",
          "approvedDigest",
          "source",
          "appliedAt",
          "approval",
          "idMappings",
          "operations",
          "projectRevisions",
        ],
      ),
      receipt,
      "import receipt",
    );
    if (
      seen.has(receipt.changeSetId) ||
      !Number.isFinite(Date.parse(receipt.appliedAt))
    )
      throw Error("Duplicate/invalid import receipt.");
    seen.add(receipt.changeSetId);
    const opIds = new Set<string>();
    for (const op of receipt.operations) {
      validateJsonRule(
        obj(
          {
            operationId: id,
            type: { type: "string", enum: types },
            recordId: id,
            status: enumRule(
              "created",
              "updated",
              "candidate_pending",
              "asset_created",
              "asset_reused",
              'variant_created',
              'variant_reused',
              "unchanged",
            ),
          },
          ["operationId", "type", "status"],
        ),
        op,
        "receipt operation",
      );
      if (opIds.has(op.operationId))
        throw Error("Duplicate receipt operation.");
      opIds.add(op.operationId);
    }
    validateChangeSetApproval(receipt.approval, receipt.operations);
    if (
      Object.keys(receipt.idMappings).length > 250 ||
      Object.keys(receipt.projectRevisions).length > 10
    )
      throw Error("Receipt mapping/project limit exceeded.");
    for (const [ref, mapping] of Object.entries(receipt.idMappings)) {
      validateJsonRule(id, ref, "receipt client reference");
      validateJsonRule(
        obj(
          {
            kind: enumRule("project", "shot", "scene", "candidate",'variant_candidate'),
            id,
            assetId: id,
            variantId:id,
          },
          ["kind", "id"],
        ),
        mapping,
        "receipt mapping",
      );
      if(mapping.variantId!==undefined&&(mapping.kind!=='variant_candidate'||mapping.assetId!==undefined)||mapping.kind==='variant_candidate'&&mapping.assetId!==undefined)throw Error('Invalid typed variant receipt mapping.');
    }
    for (const [project, change] of Object.entries(receipt.projectRevisions)) {
      validateJsonRule(id, project, "receipt project");
      validateJsonRule(
        obj({ before: revision, after: revision }),
        change,
        "receipt project revision",
      );
      if (change.after !== change.before + 1)
        throw Error("Invalid imported project revision change.");
    }
  }
  seen.clear();
  for (const candidate of ledger.candidates) {
    validateJsonRule(
      obj(
        {
          id,
          revision: { ...revision, minimum: 1 },
          kind: enumRule(
            "character",
            "wardrobe",
            "environment",
            "action",
            "camera",
            "lighting",
            "style",
            "template",
          ),
          title: text(100),
          promptText: text(12000),
          description: text(500),
          tags: { type: "array", items: text(30), maxItems: 12 },
          notes: text(4000),
          source,
          changeSetId: id,
          operationId: id,
          sourceSceneId: id,
          status: enumRule("pending", "created", "reused"),
          assetId: id,
          createdAt: iso,
          updatedAt: iso,
        },
        [
          "id",
          "revision",
          "kind",
          "title",
          "promptText",
          "description",
          "tags",
          "notes",
          "source",
          "changeSetId",
          "operationId",
          "status",
          "createdAt",
          "updatedAt",
        ],
      ),
      candidate,
      "import candidate",
    );
    if (
      seen.has(candidate.id) ||
      !Number.isFinite(Date.parse(candidate.createdAt)) ||
      !Number.isFinite(Date.parse(candidate.updatedAt)) ||
      (candidate.status === "pending") !== (candidate.assetId === undefined)
    )
      throw Error("Invalid/duplicate import candidate state.");
    seen.add(candidate.id);
    parseChangeSet({
      schema: "krakinai.change-set.v1",
      changeSetId: candidate.changeSetId,
      source: candidate.source,
      operations: [
        {
          operationId: candidate.operationId,
          type: "asset.propose",
          clientRef: "candidate",
          kind: candidate.kind,
          title: candidate.title,
          promptText: candidate.promptText,
          description: candidate.description,
          tags: candidate.tags,
          notes: candidate.notes,
        },
      ],
    });
    if (
      !ledger.receipts.some(
        (r) =>
          r.changeSetId === candidate.changeSetId &&
          r.operations.some(
            (o) =>
              o.operationId === candidate.operationId &&
              o.type === "asset.propose",
          ),
      )
    )
      throw Error("Candidate has no originating import receipt.");
  }
  const fields=CHANGE_SET_V3_SCHEMA.properties!.operations.items!.oneOf!.find(r=>r.properties!.type.const==='variant.propose')!.properties!;
  for(const candidate of ledger.variantCandidates??[]){
    validateJsonRule(obj({version:{const:1},id,revision:{...revision,minimum:1},variantType:{const:'Outfit'},parentCharacterId:id,expectedParentRevision:{...revision,minimum:1},title:fields.title,promptText:fields.promptText,description:fields.description,tags:fields.tags,notes:fields.notes,source,changeSetId:id,operationId:id,sourceSceneId:id,status:enumRule('pending','created','reused'),variantId:id,createdAt:iso,updatedAt:iso},['version','id','revision','variantType','parentCharacterId','expectedParentRevision','title','promptText','description','tags','notes','source','changeSetId','operationId','status','createdAt','updatedAt']),candidate,'variant import candidate');
    if(seen.has(candidate.id)||!Number.isFinite(Date.parse(candidate.createdAt))||!Number.isFinite(Date.parse(candidate.updatedAt))||(candidate.status==='pending')!==(candidate.variantId===undefined))throw Error('Invalid/duplicate variant import candidate state.');
    seen.add(candidate.id);
    parseChangeSet({schema:'krakinai.change-set.v3',changeSetId:candidate.changeSetId,source:candidate.source,operations:[{operationId:candidate.operationId,type:'variant.propose',clientRef:'candidate',variantType:'Outfit',parentCharacterId:candidate.parentCharacterId,expectedParentRevision:candidate.expectedParentRevision,title:candidate.title,promptText:candidate.promptText,description:candidate.description,tags:candidate.tags,notes:candidate.notes}]});
    if(!ledger.receipts.some(r=>r.changeSetId===candidate.changeSetId&&r.operations.some(o=>o.operationId===candidate.operationId&&o.type==='variant.propose')))throw Error('Variant candidate has no originating import receipt.');
  }
}
export function readImportLedger(preferences: Preferences): ImportLedger {
  if (preferences.aiImports === undefined)
    return { version: 1, receipts: [], candidates: [] };
  validateImportLedger(preferences.aiImports);
  return structuredClone(preferences.aiImports);
}
export function appendImportReceipt(
  previous: ImportLedger,
  plan: ChangeSetPlan,
  receipt: ChangeSetReceipt,
): ImportLedger {
  const next = structuredClone(previous);
  for (const candidate of plan.candidates) {
    const i = next.candidates.findIndex((c) => c.id === candidate.id);
    if (i < 0) next.candidates.push(structuredClone(candidate));
    else next.candidates[i] = structuredClone(candidate);
  }
  if(plan.variantCandidates?.length){next.variantCandidates??=[];for(const candidate of plan.variantCandidates){const index=next.variantCandidates.findIndex(c=>c.id===candidate.id);if(index<0)next.variantCandidates.push(structuredClone(candidate));else next.variantCandidates[index]=structuredClone(candidate)}}
  next.receipts.push(structuredClone(receipt));
  validateImportLedger(next);
  return next;
}

export function requiresStoryboardApproval(op: ChangeOperation): boolean {
  return (
    op.type.startsWith("project.") ||
    (op.type.startsWith("shot.") &&
      !["shot.select_take", "shot.set_status"].includes(op.type)) ||
    (op.type.startsWith("scene.") && "project" in op && !!op.project)
  );
}
