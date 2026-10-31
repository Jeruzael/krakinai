# B1 Recipe Change-Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Deliver single-character recipe operations through the existing reviewed, atomic change-set pipeline.
**Architecture:** Versioned v2 operations build trusted SceneDraft snapshots and reuse planAuthoredScene. Preview and commit share assembly and a deterministic content projection; v1 remains unchanged.
**Tech Stack:** Existing TypeScript/React, IndexedDB, canonical JSON rules, MCP SDK, Vitest and Playwright. No new paid dependencies.
**Spec:** ../specs/2026-10-31-recipe-change-set-b1-design.md (approved).
**Execution:** User approved inline implementation and waived another planning approval.

## Global Constraints

- Base master 4f3a90e8f4230c3e0adc4213d23f61a5140ece3a; branch codex/recipe-change-set-b1.
- B1 only. B2 requires B1 review/integration; B3 and production conversion remain gated.
- No real browser/project access, unrelated validation.ts edits, ZIP64 PR12 changes, schema/store/limit changes, auto-approval, automatic merge or global signing changes.
- Preserve legacy v1 schema, valid imports, frozen outputs, snapshots, media and anchors. New assets remain unreviewed.
- Limits unchanged: manual20MiB/MCP1MiB,250 ops,10 projects,250 shots,100 scenes,50 candidates,500 pending,dependency depth16 and existing scope limits.
- New recipe parents only for revision/take; Character text cannot be overridden. Manual outputs require browser-owned explicit reassembly acknowledgement.
- Only synthetic QA profiles; retain all profiles/artifacts. Native helper must be signed/Valid under AllSigned before native execution.

## Review Focus

- A partial Camera revision must preserve all unrelated frozen components and provenance, even after global asset edits.
- Deferred/reused candidates and live variant/anchor changes must not bypass approval, revision checks or scope at the write boundary.
- Preview outputs and committed outputs must match despite timestamp changes or tampered resolved preview metadata.
- Incomplete packages must remain recoverable without any partial project/asset/scene writes or Direct Prompt substitution.
- New receipt operations/backups and dual-version MCP schemas must preserve old v1 behavior and never expand ongoing read grants.

## Task 1: Versioned contract and schema

**Files:** types/changeSet.ts; domain/changeSetSchema.ts, new domain/recipeChangeSetSchema.ts; changeSetValidation.ts; changeSetLedger.ts; mcpProtocol.ts; scripts/export-change-set-schema.mjs; docs/change-set-v2.schema.json; new __tests__/recipeChangeSetContract.test.ts.
**Interfaces:** RecipeSceneFields and RecipeSceneOperation define assetRefs/variantRefs, overrides, clearSlots, dialogue, identitySource, cameraComposition and existing context fields. CHANGE_SET_V2_SCHEMA and SUPPORTED_CHANGE_SET_SCHEMA accompany unchanged CHANGE_SET_SCHEMA. parseChangeSet accepts correct envelopes; existing tools accept the supported union.
- [x] Write contract tests for three v2 operations, v1 rejection, malformed/unknown fields, bounds, dependent refs, invalid Character override, camera/dialogue structure and exported-schema/MCP parity. Run RED.
- [x] Implement strict version dispatch, types and canonical recipe structural rules. Reuse canonical camera/performance catalogs and semantic validators; export both schemas through a repository-owned loader.
- [x] Extend human approval/receipt operation validation without adding fields to historical default approval objects. Manual-output acknowledgement is a browser-owned optional list of recipe operation IDs.
- [x] Run contract, MCP protocol and ledger tests/typecheck; generated v1 schema must remain byte-identical. Expected all focused tests pass.

## Task 2: Trusted recipe planning and atomic persistence

**Files:** new domain/changeSetRecipe.ts; changeSetReferences.ts; changeSetPlanner.ts; changeSetState.ts; storage/sceneAuthoring.ts only if a narrowly required integration change; new __tests__/recipeChangeSetPlanning.test.ts and recipeChangeSetStorage.test.ts.
**Interfaces:** buildRecipeChangeDraft(operation, state, allocation, target, resolveAsset) returns a trusted SceneDraft from exact records or a frozen recipe parent. The planner owns human consent; finishRecipeScene captures source provenance. recipeContentProjection(scene) and recipeReviewedProjection(plan) select deterministic content for v2 approved-state comparison. Existing planChangeSet and planAuthoredScene remain authoritative.
- [x] Write failing tests for existing and same-batch bindings, deferred dependencies, revisions/categories/ownership, all Shot Types/current originals, scene-only overrides/composition, outputs, identity controls, incomplete planning and manual-output acknowledgement. Observe RED.
- [x] Share binding resolution/snapshot validation with the existing Direct Prompt context path; keep v1 reference behavior. Preserve unchanged parent slots; merge only named fields. Build provenance from source and actual IDs.
- [x] Route recipe operations before the legacy scene branch; enforce explicit targets and recipe parents. Resolve candidates through existing approved mapping.assetId. Save only assembled scenes with authoringMode recipe and all three authoritative outputs.
- [x] Bind live recipe reads and deterministic content projection into v2 state comparison. Keep v1 signatures unchanged; exclude volatile timestamps.
- [x] Add storage regressions for stale after preview, late writes/quota/abort, replay, preference preservation, tampered preview, backup/restore of mixed records/receipts and unchanged media hashes. Run RED→GREEN.
- [x] Run all change-set, authored-scene, Shot Type, camera and legacy output tests. Expected zero failures; no persistence-rule or assembler rewrite.

## Task 3: Complete recipe preview and recoverable packages

**Files:** components/ChangeSetPreview.tsx; new components/RecipeOperationPreview.tsx if needed; screens/ChangeSetImportScreen.tsx; existing import CSS; new __tests__/recipeChangeSetPreview.test.tsx.
**Interfaces:** resolved recipe preview data includes actual component snapshots, outputs, readiness and differences; UI reads authoritative plan data. Package download serializes exact changeSet; never persists unapproved data.
- [x] Add failing UI tests for component IDs/revisions/overrides, three full output tabs/copy, previous comparison, missing dependency visibility, manual-output consent and blocked-package download with no DB writes.
- [x] Implement a bounded accessible operation detail view and existing candidate approval controls; include recipe creation in duplicate-scene acknowledgement where relevant.
- [x] Distinguish invalid/incomplete/assembled-with-pending/ready states. Keep missing recipes downloadable; no fictitious saved draft/scene IDs.
- [x] Run UI/import/broker tests and typecheck. Expected exact text retained, focus/tab behavior correct, existing v1 preview unchanged.

## Task 4: Synthetic browser and MCP acceptance

**Files:** new e2e/recipe-change-sets.spec.mjs and synthetic recipe fixture; adapt existing shared helpers only as necessary; domain/mcpScope.ts only if a demonstrated new-field grant gap; focused tests for broker/scope/disclosure.
**Interfaces:** real SDK preview/submit uses v2 input, browser-only reviewed Apply and exact receipt IDs. New asset/full-prompt IDs are not added to continuing scopes.
- [x] Test existing and same-batch recipe creation through actual SDK, zero pre-approval writes, duplicate/defer/reuse and local grant behavior, denied/unshared IDs, revoked consent and atomic rollback.
- [x] Verify saved IDs, all three outputs, frozen snapshot revisions, old Direct Prompt/preferred take equality, media hashes, reopen/edit Camera-only revision and alternate take.
- [x] Verify required original deletion/MIME mismatch blocks, optional pending references remain honest, and blocked package exports without writes.
- [x] Capture responsive preview at1440/768/390 and keyboard/reflow. Attempt relevant existing signed native checks with isolated profiles; document real execution versus synthetic verifier and any blocker.
- [x] Run focused recipe + existing MCP/browser workflows. Expected actual machine-readable case results and no real data access.

## Task 5: Regression evidence, independent review and PR

**Files:** docs/recipe-change-set-b1-contract.md, docs/recipe-change-set-b1-qa.md, docs/qa/recipe-change-set-b1-results.json, curated synthetic screenshots/examples, CI artifact paths if needed.
- [x] Run full unit/component suite with bounded workers, typecheck/build, both production audits, bridge builds/typecheck/tests, QA ledger/evidence checks, schema generation parity and full browser suite sequentially where resource contention matters.
- [x] Record actual exits/warnings/skips, frozen output/media hashes, rollback/replay and mixed/legacy backup results. Inventory scoped files and exclude data/profiles/archives/keys/certs/temp artifacts.
- [x] Dispatch one fresh whole-branch reviewer on the most capable model; regrade findings and fix material ones in one RED→GREEN pass, then rerun affected/full checks.
- [ ] Sign scoped commit with configured signing, verify signature and source identity, push only B1 branch, create its PR against master and verify exact signed-head CI. Keep unmerged; preserve worktree and QA artifacts. Update PR evidence rather than looping commits for its own SHA.

## Implementation rulings

Use task-local ignored ledger/briefs for recovery. Collect a final scoped signed commit after verification rather than interrupting the user for per-task signing. The user's existing method is inline; no per-task implementer/reviewer agents. A new native signing/trust action is evaluated against the explicit current brief and existing approved procedure, never inferred from an unrelated past file path. Any actual blocker is reported with exact unverified cases.

Publication status is recorded by the signed PR head, its Actions run and the retained execution ledger; this plan is committed before publishing.
