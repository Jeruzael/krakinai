# Ensemble Recipe B2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver reviewed multi-participant recipes with owned wardrobe, ordered cues, immutable snapshots and complete existing-workflow compatibility.
**Architecture:** Optional ensemble envelopes retain checked legacy primary mirrors. Existing canonical assembly and atomic save remain authoritative; v3 change sets add explicit patches and Outfit candidates without rewriting v1/v2 or stored legacy records.
**Tech Stack:** Existing TypeScript, React, IndexedDB, MCP SDK, Vitest and Playwright. No new dependency.
**Spec:** ../specs/2026-11-01-ensemble-recipe-b2-design.md (approved).
**Execution:** User selected inline and waived another planning approval. Use task-local TDD/ledger and one fresh final whole-branch review, no per-task implementers/reviewers.

## Global Constraints

- Base master7ce149200bdd09b5d7c8f2f4d74a00801b0fd9c3; branch codex/ensemble-recipe-b2 in existing clean linked worktree.
- At most8 participants,32 cues; IDs<=64 characters; role<=500; participant notes<=1000. Current field/package/media/manifest/storage/export limits remain effective; Project Export128MiB unchanged.
- B2 only: no B3 Direct Prompt conversion/full installed-CLI ensemble certification, no real Wedding/library/profile access, no PR12 or unrelated validation.ts/local changes, no automatic merge.
- No database version/store change or legacy migration. Frozen v1/v2 schemas and old output/script hashes stay exact. New fields appear only after explicit opt-in/application.
- Primary Character/wardrobe/generation mirrors must match the explicit visual primary. Off-camera speech never fabricates a Character. Identity overrides/approval stamps are forbidden.
- New Outfit candidates require exact existing parent Character and revision; create/reuse/defer is human-owned. New Character first, Outfit later. No automatic reparenting or scope expansion.
- Inherited template snapshots remain frozen and honestly labeled. Ensemble template inclusion is explicit; shared-only omissions are reviewed.
- All writes use existing factory/transactions, reviewed content/state/scope epoch and idempotent receipts. Retain every QA profile/artifact; no unauthorized deletion.
- Preserve AllSigned. Re-sign compiled native helper after every bridge rebuild and verify Valid before native testing. Keep profiles/ZIPs/keys/certificates/secrets out of Git.

## Review Focus

- Legacy template identities/outfits must survive ensemble opt-in and full/shared template round trips without invented asset IDs or lost selected media (Tasks1/3/6).
- An inherited frozen participant must survive another participant/Camera edit after its live source changes, while actually consulted live anchor/variant reads invalidate stale approval (Tasks1/3/5).
- The same media used by several people/roles must retain distinct associations, export bytes once and remain reachable from unsaved forms/templates (Tasks2/3/7).
- Multiple cues in one shot, reordered cues and reused takes must have stable UI/script IDs, exact text and no duplicated legacy speech/negative clauses (Tasks1/2/3/6).
- New variants/participants cannot escape disclosure/scope controls through nested references, candidate reuse, receipts or altered rendered previews; late failures must roll back every write (Tasks4/5/7).

## Task 1: Versioned ensemble data, validation and opt-in

**Files:** new types/ensemble.ts; domain/ensemble.ts, ensembleValidation.ts; types/domain.ts; new __tests__/ensembleModel.test.ts and fixture.
**Interfaces:** SceneParticipant, DialogueCue, SceneEnsembleV1, EnsembleTemplateDefaultV1; EnsembleSource structural source; enableSceneEnsemble<T extends EnsembleSource>(source:T):T; syncEnsemblePrimary<T extends EnsembleSource>(source:T):T; validateSceneEnsemble(source:unknown,options?:{forAssembly?:boolean}):string[]. Pure cloning/helpers only, no persistence. Helpers expose getVisualParticipants and stable primary selection.
- [x] Write tests for legacy byte-equal no-op, idempotent seeding of primary/legacy-dialogue, template sources,8/9 and32/33 boundaries, exact cue fields/order/timing, duplicate IDs/Characters, wrong-parent Outfit, primary mirrors and Shot Type/presence/mode rules. Run RED with missing helpers.
- [x] Implement optional types and strict structural/semantic validation using existing performance/identity/Shot Type rules; reject raw identity overrides and dual legacy dialogue. New mutable primary changes synchronize only through shared helper; validation never repairs persisted mismatches.
- [x] Run `npm test -- --run src/__tests__/ensembleModel.test.ts src/__tests__/assemblyAndValidation.test.ts --maxWorkers=1 --minWorkers=1`; expected all pass. Run typecheck; expected0. Commit scoped tested task with configured SSH signing.

## Task 2: Canonical outputs, references and Preflight

**Files:** new domain/ensembleDocument.ts, ensembleReferences.ts; sceneDocument.ts, promptAssembler.ts, generationDocument.ts, exportPresets.ts, shotTypeRules.ts, scenePreflight.ts; new ensembleAssembly.test.ts and ensembleReferences.test.ts.
**Interfaces:** buildEnsembleDocument(source,baseLegacyDocument) produces SceneDocumentV2; existing buildSceneDocument/formatSceneDocumentText dispatch canonical v1/v2. getSceneSnapshotEntries(source) returns {slot,snapshot,participantId?}[] without duplicate primary mirrors; participant generation resolves through existing identity resolver. Existing assembler API unchanged.
- [x] Write RED tests for two/three separate identities/outfits, independent performances, off-screen officiant then Lucas `I do.`, all3 outputs, JSON v2, old JSON/text exact, off-camera visual exclusion, source Shot Types, current originals, once-only negative prefixes and shared-file distinct reference roles.
- [x] Extend one canonical document/formatter route, generic/provider exports and Preflight for ensemble records only. Add participant-aware stable reference IDs without rewriting legacy IDs, ordered cue exports and identity-source-aware generation output.
- [x] Run `npm test -- --run src/__tests__/ensembleAssembly.test.ts src/__tests__/ensembleReferences.test.ts src/__tests__/sceneDocument.test.ts src/__tests__/generationDocument.test.ts src/__tests__/scenePreflight --maxWorkers=1 --minWorkers=1`; expected all pass and original golden assertions unchanged. Typecheck0; signed scoped commit.

## Task 3: Save/revision/template/media and production round trips

**Files:** storage/db.ts, sceneAuthoring.ts; domain/phase4Validation.ts, projectContinuity.ts, projectExport.ts and actual backup/dependency entry points; components/ProjectScriptPanel.tsx; new ensembleStorage.test.ts, ensembleProduction.test.ts, ensembleBackup.test.ts.
**Interfaces:** existing saveSceneDraft/planAuthoredScene/buildRevisionDraft preserve ensemble; pure createEnsembleTemplateDefault(draft,includeEnsemble) and applyEnsembleTemplateDefault(template,draft) retain explicit defaults/selection. getProjectDialogue extends only ensemble rows with cueId/participantId and stable key helper. Existing public writer signatures gain only explicit optional ensemble/template flags.
- [x] Write RED tests for full draft/save/revision/restore/take preservation, Camera-only edit after live-source changes, stale anchors, no implicit preferred changes, templates full/shared confirmation, inherited template sources, media reachability including templates and unsaved claims, independent wardrobe continuity/Cast and ordered Script.
- [x] Extend validators and shared snapshot traversal to all persistence/dependency/cleanup paths. Do not change cleanup lease protections or delete any media. Copy and resolve each participant generation with actual current assets while keeping master snapshots frozen. Share existing pure variant validation where later task needs it.
- [x] Add mixed legacy/B1/B2/template ZIP/project round trips, actual PNG hashes, no doubled bytes, malformed restore preservation and source-original preservation. Keep128MiB project allowance and all full-backup limits unchanged.
- [x] Run `npm test -- --run src/__tests__/ensembleStorage.test.ts src/__tests__/ensembleProduction.test.ts src/__tests__/ensembleBackup.test.ts src/__tests__/sceneAuthoring src/__tests__/projectContinuity src/__tests__/referencePack --maxWorkers=1 --minWorkers=1`; expected all pass. Typecheck0; signed scoped commit.

## Task 4: Frozen old contracts and v3/Outfit contracts

**Files:** types/changeSet.ts; new domain/ensembleChangeSetSchema.ts; changeSetSchema.ts, changeSetValidation.ts, changeSetLedger.ts, mcpProtocol.ts; scripts/export-change-set-schema.mjs; docs/change-set-v3.schema.json; new ensembleChangeSetContract.test.ts.
**Interfaces:** RecipeEnsemblePatch contains explicit participantUpserts/removeParticipantIds/participantOrder/primaryParticipantId/dialogueCues; OutfitCandidate operation type with exact stored parent ID/revision. Optional variantDecisions, variantCandidates and variantId receipt mappings leave historical defaults/shapes intact. CHANGE_SET_V3_SCHEMA joins existing supported union; no new MCP tools.
- [x] Write RED tests for v3 patches/Outfit proposal-review, wrong/forward kinds, unknown fields/snapshots/approval injection,8/32 bounds, exact existing parent, combined candidate caps and old default/receipt/schema parity.
- [x] Define exact external refs and independent human variant decisions; strict validation of conflicts, explicit removals/reorder and cue replacements. Old versions reject new fields; Task5 adds the stateful planner guard against reconstructing ensemble parents, while leaving metadata-only operations available.
- [x] Export/check v3 without rewriting either frozen artifact; test actual MCP tool schemas. Run `npm test -- --run src/__tests__/ensembleChangeSetContract.test.ts src/__tests__/recipeChangeSetContract.test.ts src/__tests__/changeSetContract.test.ts src/__tests__/mcpProtocol.test.ts --maxWorkers=1 --minWorkers=1`; expected all pass; schema --check/typecheck0. Signed scoped commit.

## Task 5: Atomic ensemble imports, variants and MCP boundaries

**Files:** new domain/changeSetEnsemble.ts, changeSetVariants.ts; changeSetPlanner.ts, changeSetRecipe.ts, changeSetRecipeContent.ts, changeSetState.ts, changeSetCandidates.ts; storage/changeSets.ts; mcpScope.ts,mcpReads.ts and actual permission DTO helpers; new ensembleChangeSetPlanning.test.ts, ensembleChangeSetStorage.test.ts, ensembleMcp.test.ts.
**Interfaces:** applyRecipeEnsemblePatch(draft,patch,state,resolveBinding):SceneDraft clones existing or explicit legacy seed and preserves omitted fields. planOutfitCandidate uses pure existing Variant construction/validation and returns candidate/result/approvedVariant only. ChangeSetPlan gains variants write list; transaction writes approved variants with existing other stores/receipt. AssetId and variantId mappings never interchange.
- [x] Write RED tests for existing/same-batch actors/Outfits, third-person addition, independent primary replacement, exact-parent create/reuse/defer/review, deferred dependent batch0writes, explicit local reuse without permanent grants and old-client rejection on new scenes.
- [x] Extend deterministic content and relevant-state proofs to all envelope/template/candidate/variant/anchor/media reads. Test altered visible preview/outputs, stale source/head/project/media/variant/parent/permissions and exact replay across restart/backup.
- [x] Inject late variant/scene/receipt put quota/abort and assert exact whole-library rollback; add metadata-only response checks with private identity/cue/note/filename sentinels. No approval/apply MCP tool or actual-library access.
- [x] Run `npm test -- --run src/__tests__/ensembleChangeSet src/__tests__/ensembleMcp.test.ts src/__tests__/changeSet src/__tests__/recipeChangeSet src/__tests__/mcp --maxWorkers=1 --minWorkers=1`; expected all pass, typecheck/build0. Signed scoped commit.

## Task 6: Builder, cue, template and reviewed preview UI

**Files:** new components/EnsembleControls.tsx, ParticipantEditor.tsx, DialogueCueEditor.tsx and scoped CSS; SceneBuilderScreen.tsx, SharedModals.tsx, PerformanceDirection.tsx only necessary shared controls; RecipeOperationPreview.tsx, ChangeSetPreview.tsx and existing Script/Cast/continuity UI. New ensembleControls.test.tsx, ensemblePreview.test.tsx.
**Interfaces:** EnsembleControls receives draft/current library and onChange(newDraft); central helpers own mirror updates. ParticipantEditor never edits identity strings. DialogueCueEditor uses exact DialogueConfig + stable ID and existing Performance Studio. Existing template save calls receive explicit full/shared choice and omission acknowledgement.
- [ ] Write RED tests for explicit idempotent opt-in, actual character/variant ownership, primary/presence/removal/cue linking, ordered exact multi-cue editing, per-person anchor fallback and template inclusion/omission review.
- [ ] Keep compact rows and add labeled details for participants/cues; full output stays accessible. Extend readonly proposal detail and Outfit create/reuse/defer decisions; show previous/new people, cues, scope, references, findings and all3 exact-copy modes.
- [ ] Test keyboard tabs/drawers/focus/ESC, accessible labels, copy long text/line endings and no writes before approval. Run `npm test -- --run src/__tests__/ensembleControls.test.tsx src/__tests__/ensemblePreview.test.tsx src/__tests__/recipeChangeSetPreview.test.tsx src/__tests__/dialogueCompatibility.test.tsx --maxWorkers=1 --minWorkers=1`; expected all pass and typecheck0. Signed scoped commit.

## Task 7: Synthetic end-to-end, native compatibility and screenshots

**Files:** new e2e/ensemble-fixture.mjs, ensemble-recipes.spec.mjs, ensemble-mcp.spec.mjs; minimal existing test-helper/native stdio schema assertions as demonstrated. Curated screenshots/evidence after successful runs only.
**Interfaces:** production APIs and actual SDK preview/submit; all fresh isolated profiles refuse nonempty seeding. Receipt IDs/old records/preferred/media hashes are actual DB/Blob values. Real native signer is Valid under AllSigned; synthetic and native evidence labeled separately.
- [ ] Add browser regressions for ensemble/Outfit create/reuse/defer, missing originals and replacement, stale tab/scope, immutable revisions and same-file roles; observe required RED before UI fixes if defects found.
- [ ] Verify Script/Cast/wardrobe/template round trips, Full/Structured/Compact copy/download, reordered cues/participants and old outputs. Run actual SDK v3 through browser-only Apply/receipt/replay/revocation at IPv4 and localhost; check all response call IDs and metadata privacy.
- [ ] Capture1440/768/390 and equivalent200% reflow, keyboard/focus. Rebuild/sign helper using reviewed procedure; run existing installedCLI/native regressions and new signed SDK acceptance without real-profile access. Full installedCLI ensemble remains B3.
- [ ] Run `npx playwright test e2e/ensemble-recipes.spec.mjs e2e/ensemble-mcp.spec.mjs` plus relevant existing native regressions with explicit opt-in. Expected all cases pass; any unsupported native run remains unverified, never counted passed. Signed scoped commit.

## Task 8: Full evidence, independent review, signing and PR/CI

**Files:** docs/ensemble-recipe-b2-contract.md, ensemble-recipe-b2-qa.md, docs/qa/ensemble-recipe-b2-results.json; safe synthetic galleries/source inventories.
- [ ] Run full root unit/component, bridge production/test builds/tests/typechecks, root typecheck/build, both prod audits, schema parity, QA8/historical ledger, CLI validators and full browser/native suites with bounded sequential local resource usage. Record real exits/warnings/skips/hash baselines and preserve all logs.
- [ ] Audit complete diff/inventory for personal data/profiles/ZIPs/keys/certificates/temp artifacts, protected unrelated paths, actual schema/data/limits changes. Only curated synthetic proof is committed; actual user data remains untouched.
- [ ] One fresh whole-branch reviewer on the most capable model checks spec/Review Focus/ledger. Regrade and fix only material findings in one RED→GREEN+whole-suite pass; ledger all rulings/deferred minors. No per-task reviewer or second final review.
- [ ] Verify configured signed commits without global Git changes, push feature branch only, open separate PR against master, verify exact final signed-head hosted CI and artifacts. Keep PR unmerged and retain worktree/ignored artifacts. Publication state lives in PR/CI/ledger, not a self-referential committed SHA.

## Plan self-review and execution notes

All approved design sections map to Tasks1–8. Helpers/types above are the shared interfaces; refine names only with a ledger ruling if source demands it. Template compatibility belongs to Task3 and UI Task6, not an omitted follow-up. B3 and actual-library migration remain excluded. Sign tested task commits as configured; signing access failure is an actual blocker requiring user action, never a reason to disable signing. User approval of this design explicitly waives a second planning confirmation.
