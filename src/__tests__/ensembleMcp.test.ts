import { it, expect } from "vitest";
import { emptyMcpScope, assertProposalScope } from "../domain/mcpScope";
import { readMcpTool } from "../domain/mcpReads";
import { buildAiContext } from "../domain/aiContext";
import { ensembleParentState } from "./fixtures/ensemblePlanningFixture";
import {
  ensembleChangeSet,
  outfitProposal,
} from "./fixtures/ensembleChangeSetFixture";
import { assembleScenePrompt } from "../domain/promptAssembler";
it("authorizes nested template media only after that full template is explicitly scoped", () => {
  const { state, scope } = fixture(),
    ensemble = structuredClone(state.scenes[0].ensemble!);
  ensemble.participants[1].character.mediaLinks = [
    {
      mediaId: "template-only-file",
      role: "reference",
      altText: "Scoped template guide",
      order: 0,
    },
  ];
  state.templates.push({
    id: "template-with-guide",
    name: "Synthetic full template",
    description: "",
    category: "Custom",
    requiredSlots: [],
    defaults: {},
    ensembleDefault: { version: 1, ensemble },
    isStarter: false,
    revision: 1,
    createdAt: "2026-11-01",
    updatedAt: "2026-11-01",
  });
  const p = ensembleChangeSet();
  p.operations[0].references = [
    { mediaId: "template-only-file", role: "reference" },
  ];
  expect(() => assertProposalScope(p, scope, state)).toThrow();
  scope.templateIds = ["template-with-guide"];
  const before = structuredClone(scope);
  expect(() => assertProposalScope(p, scope, state)).not.toThrow();
  expect(scope).toEqual(before);
});
import { planChangeSet } from "../domain/changeSetPlanner";
import { appendImportReceipt } from "../domain/changeSetLedger";
import { allocationFor } from "./fixtures/changeSetFixture";
import { recipeApproval } from "./fixtures/recipeChangeSetFixture";
import {
  buildPermissionInventory,
  permissionInventoryStamp,
} from "../domain/mcpPermissionDraft";
function fixture() {
  const state = ensembleParentState(),
    scope = {
      ...emptyMcpScope(),
      projectIds: ["project"],
      assetIds: ["environment", "action", "character", "lucas"],
      allowProposals: true,
    };
  return { state, scope };
}
function pendingFixture() {
  const { state, scope } = fixture(),
    p = ensembleChangeSet(),
    approval = recipeApproval();
  p.operations = [outfitProposal("outfit", "lucas")];
  const allocation = allocationFor(p),
    plan = planChangeSet(p, approval, state, allocation);
  state.preferences.aiImports = appendImportReceipt(
    { version: 1, receipts: [], candidates: [] },
    plan,
    {
      version: 1,
      changeSetId: p.changeSetId,
      packageDigest: "a".repeat(64),
      approvedDigest: "b".repeat(64),
      source: p.source,
      appliedAt: allocation.preparedAt,
      approval,
      idMappings: plan.idMappings,
      operations: plan.results,
      projectRevisions: plan.projectRevisions,
    },
  );
  return {
    state,
    scope,
    candidate: state.preferences.aiImports.variantCandidates![0],
  };
}
it("requires explicit scope for every nested Character and does not retrofit authority from local reuse", () => {
  const { state, scope } = fixture(),
    p = ensembleChangeSet();
  expect(() => assertProposalScope(p, scope, state)).not.toThrow();
  scope.assetIds = scope.assetIds.filter((id) => id !== "lucas");
  expect(() => assertProposalScope(p, scope, state)).toThrow();
  expect(() =>
    assertProposalScope(p, scope, state, new Set(["lucas"])),
  ).toThrow();
});
it("requires selected stored variants and an already authorized Outfit parent", () => {
  const { state, scope } = fixture(),
    p = ensembleChangeSet();
  p.operations[0].ensemble.participantUpserts[1].wardrobe = {
    variant: { id: "lucas-suit" },
    expectedRevision: 1,
  };
  expect(() => assertProposalScope(p, scope, state)).toThrow();
  scope.variantIds = ["lucas-suit"];
  expect(() => assertProposalScope(p, scope, state)).not.toThrow();
  const proposal = { ...p, operations: [outfitProposal("outfit", "lucas")] };
  scope.assetIds = scope.assetIds.filter((id) => id !== "lucas");
  expect(() =>
    assertProposalScope(proposal, scope, state, new Set(["lucas"])),
  ).toThrow();
});
it("exposes useful participant/cue metadata while withholding private frozen identities, speech, notes and filenames", async () => {
  const { state, scope } = fixture(),
    scene = state.scenes[0],
    p = scene.ensemble!.participants[1];
  p.character.promptText = "PRIVATE_SECONDARY_IDENTITY";
  p.character.identityAnchor = { text: "PRIVATE_SECONDARY_ANCHOR" };
  p.performanceNotes = "PRIVATE_PERFORMANCE_NOTE";
  p.role = "PRIVATE_ROLE_NOTE";
  scene.ensemble!.dialogueCues[1].line = "PRIVATE_CUE_TEXT";
  p.character.mediaLinks = [
    {
      mediaId: "synthetic-media",
      filename: "PRIVATE_FILE_NAME.png",
      role: "reference",
      altText: "PRIVATE_ALT_NOTE",
      order: 0,
    },
  ];
  scene.outputs = assembleScenePrompt({ ...scene, inputRevision: 1 }).outputs;
  const data: any = await readMcpTool(
    "krakinai_get_scene",
    { sceneId: scene.id },
    scope,
    state,
  );
  expect(data.ensemble).toMatchObject({
    version: 1,
    primaryParticipantId: "primary",
    participants: [{ id: "primary" }, { id: "lucas" }],
    dialogueCues: [
      { id: "officiant" },
      { id: "lucas-reply", participantId: "lucas" },
    ],
  });
  expect(JSON.stringify(data)).not.toContain("PRIVATE_");
  expect(JSON.stringify(data)).not.toMatch(/"blob"|"approvedText"/);
  const manual = buildAiContext(state, { sceneIds: [scene.id] });
  expect(JSON.stringify(manual.scenes)).not.toContain("PRIVATE_");
  scope.fullPromptSceneIds = [scene.id];
  const full: any = await readMcpTool(
    "krakinai_get_scene",
    { sceneId: scene.id },
    scope,
    state,
  );
  expect(full.fullPrompt).toBe(scene.outputs.full);
  expect(full.fullPrompt).toContain("PRIVATE_SECONDARY_IDENTITY");
  expect(full.fullPrompt).toContain("PRIVATE_CUE_TEXT");
});
it("gates deferred Outfit review by candidate/receipt permission and separate parent authorization", () => {
  const { state, scope, candidate } = pendingFixture(),
    p = ensembleChangeSet();
  p.operations = [
    {
      operationId: "review",
      type: "variant.review_candidate",
      candidateId: candidate.id,
      expectedRevision: candidate.revision,
    },
  ];
  expect(() => assertProposalScope(p, scope, state)).toThrow();
  scope.candidateIds = [candidate.id];
  expect(() => assertProposalScope(p, scope, state)).not.toThrow();
  scope.assetIds = scope.assetIds.filter((id) => id !== "lucas");
  expect(() =>
    assertProposalScope(p, scope, state, new Set(["lucas"])),
  ).toThrow();
  const inventory = buildPermissionInventory(state, scope);
  expect(inventory.candidateIds).toContainEqual({
    id: candidate.id,
    label: candidate.title,
    category: "Outfit",
  });
  const stamp = permissionInventoryStamp(state);
  candidate.status = "reused";
  candidate.variantId = "lucas-suit";
  candidate.revision++;
  expect(permissionInventoryStamp(state)).not.toBe(stamp);
});
it("discloses confirmed Outfit IDs through an exact receipt grant without changing reusable scope", async () => {
  const { state, scope } = pendingFixture(),
    receipt = state.preferences.aiImports!.receipts[0],
    before = structuredClone(scope);
  await expect(
    readMcpTool(
      "krakinai_get_import_receipt",
      {
        changeSetId: receipt.changeSetId,
        packageDigest: receipt.packageDigest,
      },
      scope,
      state,
    ),
  ).rejects.toMatchObject({ code: "RECEIPT_UNAVAILABLE" });
  scope.receiptGrants = [
    { changeSetId: receipt.changeSetId, packageDigest: receipt.packageDigest },
  ];
  const result: any = await readMcpTool(
    "krakinai_get_import_receipt",
    { changeSetId: receipt.changeSetId, packageDigest: receipt.packageDigest },
    scope,
    state,
  );
  expect(result.idMappings.outfit.kind).toBe("variant_candidate");
  expect(JSON.stringify(result)).not.toContain("A charcoal formal suit.");
  expect(scope.assetIds).toEqual(before.assetIds);
  expect(scope.variantIds).toEqual(before.variantIds);
});
it("applies existing identity/text/note/filename disclosure switches to frozen ensemble templates", () => {
  const { state } = fixture(),
    e = structuredClone(state.scenes[0].ensemble!);
  e.participants[1].character.promptText = "PRIVATE_TEMPLATE_IDENTITY";
  e.participants[1].character.identityAnchor = {
    text: "PRIVATE_TEMPLATE_ANCHOR",
  };
  e.participants[1].wardrobe!.promptText = "PRIVATE_TEMPLATE_WARDROBE";
  e.participants[1].performanceNotes = "PRIVATE_TEMPLATE_NOTE";
  e.dialogueCues[1].line = "PRIVATE_TEMPLATE_CUE";
  e.participants[1].character.mediaLinks = [
    {
      mediaId: "template-media",
      role: "reference",
      filename: "PRIVATE_TEMPLATE_FILE.png",
      altText: "PRIVATE_TEMPLATE_ALT",
      order: 0,
    },
  ];
  state.templates = [
    {
      id: "ensemble-template",
      name: "Synthetic full template",
      description: "",
      category: "Custom",
      defaults: {},
      requiredSlots: [],
      ensembleDefault: { version: 1, ensemble: e },
      isStarter: false,
      revision: 1,
      createdAt: "2026-11-01",
      updatedAt: "2026-11-01",
    },
  ];
  const base: any = buildAiContext(state, {
    templateIds: ["ensemble-template"],
  }).templates[0];
  expect(base.ensembleDefault.ensemble.participants).toHaveLength(2);
  expect(JSON.stringify(base)).not.toContain("PRIVATE_");
  const text = JSON.stringify(
    buildAiContext(state, {
      templateIds: ["ensemble-template"],
      includeAssetText: true,
    }).templates,
  );
  expect(text).toContain("PRIVATE_TEMPLATE_WARDROBE");
  expect(text).toContain("PRIVATE_TEMPLATE_CUE");
  expect(text).not.toContain("PRIVATE_TEMPLATE_IDENTITY");
  expect(text).not.toContain("PRIVATE_TEMPLATE_ANCHOR");
  expect(text).not.toContain("PRIVATE_TEMPLATE_NOTE");
  expect(text).not.toContain("PRIVATE_TEMPLATE_FILE");
  const identities = JSON.stringify(
    buildAiContext(state, {
      templateIds: ["ensemble-template"],
      includeCharacterIdentity: true,
    }).templates,
  );
  expect(identities).toContain("PRIVATE_TEMPLATE_IDENTITY");
  expect(identities).toContain("PRIVATE_TEMPLATE_ANCHOR");
  expect(identities).not.toContain("PRIVATE_TEMPLATE_WARDROBE");
  expect(identities).not.toContain("PRIVATE_TEMPLATE_CUE");
});
