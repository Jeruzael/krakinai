# Guided AI Recipe Builder B3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user approved inline execution and waived another planning approval on 2026-11-01.

**Goal:** Convert saved Direct Prompts into reviewed, immutable recipe alternate takes on their original shots, and certify the complete installed-Codex workflow without touching production data.

**Architecture:** A transient guided mapping form creates v4 conversion operations. Existing Stage B planning/assembly/atomic saving and Stage C permissions/browser approval remain authoritative. Conversion creates a new recipe root with bounded provenance and preserves the original and preferred take.

**Tech Stack:** Existing TypeScript, React, IndexedDB, Vitest, Playwright, Node loopback model fixture, installed Codex CLI, signed Windows helper; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-01-ai-recipe-builder-b3-design.md` (approved 2026-11-01).

## Global Constraints

- Base `96e819ae23adc2bf897c7e3ccc71e16176e28b42`; branch `codex/ai-recipe-builder-b3`; separate unmerged PR against master.
- Keep v1/v2/v3 schemas and historical output bytes unchanged; add `krakinai.change-set.v4` and `scene.convert_direct_to_recipe`.
- Eight IndexedDB stores, database version, persistence/cleanup rules, immutable scenes, existing backup gates and Project Export 128 MiB remain unchanged.
- Preserve 250 operations, 100 scene operations, 50 candidate operations, 500 pending inputs, 20 MiB manual packages, 1 MiB MCP packages, 512 KiB results, 8 participants and 32 cues.
- Conversion mapping: at most 128 rows, 64-character IDs, 500-character explanations; SHA-256 uses exact UTF-8 Full text; spans use UTF-16 offsets.
- Actual library at localhost:5173, live bridge4177, unrelated validation.ts work, PR12, other worktrees/profiles and prior QA artifacts are excluded.
- AllSigned stays; re-sign reviewed compiled helper after every bridge build; no keys, certificates, secrets, profiles, ZIPs or actual library exports in Git. Do not delete QA profiles.
- Real Wedding conversion is a plan only; no production writes or merge authorized.

## Review Focus

- The same saved source belongs to multiple shots/projects: require exact membership and preserve every other target (Task2/5).
- Source prompt contains CRLF, Unicode, malicious-looking instructions or unshared text: exact hash/span handling, data-only rendering and no disclosure through conversion preview (Task1/3/5).
- Review fields change while asynchronous preview is running: stale results/consent must never be applied (Task3/4/5).
- A converted recipe is exported without its Direct Prompt source: provenance validates without requiring that source, and restore retains exact outputs (Task2/5).
- Codex replies are duplicated, reordered, fabricated or fail before a later success: strict call-ID matching fails that workflow, with retained evidence (Task6).

## File structure and interfaces

- `src/types/recipeConversion.ts`: bounded mapping target/row/input/provenance types.
- `src/domain/recipeConversionSchema.ts`: v4 extension and shared provenance rule.
- `src/domain/recipeConversion.ts`: source/target/map validation and fresh-draft preparation; no writes.
- `src/domain/recipeConversionRequest.ts`: transient browser mapping package/request construction; no inference/backend.
- `src/components/RecipeConversionReview.tsx`: common source/mapping/uncertainty review in manual and MCP paths.
- `src/screens/AiRecipeBuilderScreen.tsx`, `recipeBuilder.css`: transient guided screen and explicit review handoff.
- Existing contract, planner, storage, validation, context/protocol, output/revision/action and review files receive focused integration changes.
- `src/__tests__/fixtures/recipeConversionFixture.ts` and focused contract/planning/storage/UI/MCP/backup tests share synthetic fixtures.
- `e2e/recipe-conversion-fixture.mjs`, `recipe-conversion.spec.mjs`, `recipe-conversion-mcp.spec.mjs`: synthetic end-to-end coverage.
- `scripts/qa/mcp-recipe-workflow.mjs` and its tests: separate strict full-recipe CLI validator; extend existing CLI runner only where required.
- `e2e/recipe-conversion-native.spec.mjs`: actual installed-CLI acceptance on both loopback origins.
- `docs/change-set-v4.schema.json`, `docs/recipe-builder-b3-contract.md`, QA evidence and synthetic screenshots; private production plan and run logs stay under ignored `qa-results/recipe-builder-b3/`.

### Task 1: Versioned contract and review acknowledgements

**Files:** Create types/schema and `recipeConversionContract.test.ts`; modify `types/changeSet.ts`, `domain/changeSetSchema.ts`, `changeSetValidation.ts`, `changeSetLedger.ts`, `scripts/export-change-set-schema.mjs`; create distributed v4 schema.

**Interfaces:** `ConversionMappingRow`, `ConversionInput`, `ConversionProvenance`; `createConversionChangeSetSchema(v3: JsonRule, id: JsonRule): JsonRule`; `CONVERSION_PROVENANCE_SCHEMA`; optional `conversionDecisions: Record<operationId,{reviewed:boolean;acknowledgedRowIds:string[]}>` on browser approvals. New conversion operation has explicit stored project/shot, source `sceneId`/`expectedHeadId`, title/type/settings, v3 recipe fields and `conversion`.

- [ ] Add failing cases: v4 conversion accepted by parser/MCP schema; rejected by v1–v3; distributed legacy schema hashes unchanged; additional prompt/snapshot/approval fields rejected; rows/span/hash bounds and duplicate IDs rejected; browser acknowledgements cannot target unrelated operations/rows.
- [ ] Run `npx vitest run src/__tests__/recipeConversionContract.test.ts`; require expected failures.
- [ ] Implement typed v4 extension without mutating v3; extend parser dispatch/dependency handling, receipts/approval validation, schema exporter and supported MCP union.
- [ ] Run focused contract plus existing recipe/ensemble contracts; require all pass and regenerate/check schema parity.
- [ ] Commit signed contract changes with exact file paths.

### Task 2: Non-destructive conversion planning and provenance

**Files:** Create `domain/recipeConversion.ts`, `recipeConversionPlanning.test.ts`, `recipeConversionStorage.test.ts`; modify `changeSetRecipe.ts`, `changeSetPlanner.ts`, `changeSetState.ts`, `changeSetRecipeContent.ts`, `storage/changeSets.ts`, `storage/sceneAuthoring.ts`, `types/sceneAuthoring.ts`, `phase4Validation.ts` and existing save/backup validation only where provenance needs recognition.

**Interfaces:** `validateConversionSource(operation, state): SavedScene`; `prepareConversionDraft(operation, source, identity): SceneDraft`; `conversionReviewFindings(operation, approval, source, draft): ImportFinding[]`; `validateConversionProvenance(value): string|undefined`. Source hashing happens before the synchronous transaction; source text/state is rechecked via bound state signature and reviewed projection during commit.

- [ ] Add failing tests: exact source/head/hash/membership checks including multiple memberships; required missing components block; uncertainty acknowledgements bind row/operation; source record/settings/refs unchanged; fresh recipe root/same shot/preference unchanged; actual assembler outputs differ from unmapped source sentinel; candidate deferral blocks complete batch.
- [ ] Run focused tests and confirm failures before implementation.
- [ ] Construct a fresh recipe draft, retain source reference/pending defaults explicitly, apply v3 bindings, call current assembler/factory, capture bounded provenance and existing source link; preserve provenance on later recipe revisions/takes.
- [ ] Bind conversion projection/decisions into preview, state signature and approved digest; validate source inside synchronous planner without async IDB work. Retain all old operation semantics and limits.
- [ ] Verify rollback, replay, preference, stale-source/component/project, wrong-parent Outfit and optional-pending/mandatory-original cases with focused storage/planner tests.
- [ ] Commit signed conversion planner/storage changes.

### Task 3: Shared guided review and MCP scope protection

**Files:** Create `RecipeConversionReview.tsx`, `recipeConversionPreview.test.tsx`, `recipeConversionMcp.test.ts`; modify `ChangeSetPreview.tsx`, `RecipeOperationPreview.tsx`, `McpProposalReview.tsx`, `domain/mcpScope.ts`, `mcpReads.ts`, context projections and broker only where conversion scope/redaction requires it.

**Interfaces:** `RecipeConversionReview({row,source,approval,onApproval,disabled})`; consume existing `ImportOperationPreview` and canonical conversion operation. No authority is embedded in the package. All final application stays through existing review controls/Stage B.

- [ ] Add failing tests: source comparison and typed mappings; complete three-mode copy; uncertain/omitted acknowledgements reset consent; browser-local review allowed without pairing; MCP source/full prompt requires explicit grants; unselected canaries and newly created records remain unreadable; source content never leaks through preview/errors/receipts.
- [ ] Run focused preview/MCP tests and confirm expected failures.
- [ ] Render common conversion review and acknowledgement controls; preserve broker trusted-event approval and exact digests; extend v4 scope checks without broadening existing grants.
- [ ] Test async preview/approval races and permission changes, and run existing MCP/recipe/ensemble preview suites.
- [ ] Commit signed review/scope changes.

### Task 4: Transient guided mapping screen and explicit revision choices

**Files:** Create `recipeConversionRequest.ts`, `AiRecipeBuilderScreen.tsx`, `recipeBuilder.css`, `recipeConversionWorkspace.test.tsx`; modify `App.tsx`, `AiPlanningActions.tsx`, `DirectPromptWorkspace.tsx`, `SceneRevisionHistory.tsx`, and the manual import handoff as needed.

**Interfaces:** `createConversionPackage(source,target,state): Promise<ChangeSet>`; `buildConversionRequest(source,target): string` IDs-only; transient package handoff must not use storage or URLs for prompt content. Existing `ChangeSetImportScreen` may accept initial package/back callback so review/save remains one implementation. Incoming mapping edit creates a new local package/digest; explicit old-proposal rejection and distinct receipt identity.

- [ ] Add failing UI tests: exact membership selection; saved-source requirement; compact mapping/search/participant/cue controls; no data writes while mapping/previewing; pending readiness; dirty guard and download/reopen without restored consent; IDs-only Codex request; no automatic scope changes; source prompt collapsed and full copy preserved.
- [ ] Run focused UI tests and confirm failures.
- [ ] Build new lazy route and presentational controls with local state, current pickers and styles. Do not mount autosaving builder. Reuse import review/receipt for local final save; shared incoming proposal review remains broker-owned.
- [ ] Add scene-only revision, alternate take, and library editor/proposal choices using existing protected paths; preserve legacy Build from Assets and routes.
- [ ] Verify keyboard/focus/mobile and async stale results; run root typecheck and focused UI tests.
- [ ] Commit signed guided workspace changes.

### Task 5: Browser, backup and historical compatibility

**Files:** Create conversion fixtures/specs, `recipeConversionBackup.test.ts`; extend existing synthetic fixture helpers only as needed; add committed before/after screenshots under `docs/qa/recipe-builder-b3/`.

**Interfaces:** `seedRecipeConversion(page)` returns owned synthetic IDs; `readConversionLibrary(page)` includes all stores; `conversionPackage(ids,state)` returns v4 fixture; existing media hash and origin helpers remain authoritative.

- [ ] Capture baseline screenshot of existing synthetic Direct Prompt/shot actions at widths1440/768/390 before product UI changes; retain hashes/paths.
- [ ] Write browser regressions: guided and incoming review, edit/supersede, same-shot membership, explicit uncertain decisions, no-write preview, replacement original media, rollback, replay, distinct revision actions and preferred selection only via separate approval.
- [ ] Add backup/project ZIP round trips for new provenance without source record, malformed provenance atomic rejection, media/reference identity, and historical three-mode output hashes. Ensure Unicode/CRLF source hash and malicious-looking text stay exact and data-only.
- [ ] Run focused browser/backup suites, inspect screenshots and clipping/focus checks at all three widths. Copy committed synthetic screenshots only.
- [ ] Commit signed compatibility tests and verified images.

### Task 6: Actual installed-Codex ten-shot certification

**Files:** Create `mcp-recipe-workflow.mjs`, its test file, `recipe-conversion-native.spec.mjs`; extend `mcp-codex-cli.mjs` only for new workflow selection; use reviewed signed ignored QA-driver copy.

**Interfaces:** `createRecipeWorkflow({projectId,excludedProjectId,changeSet,onReply})` exposes the existing runner-compatible `plan`, `consume(messages)` and `summary()` shape, and validates every actual tool call ID/arguments/reply. Reuse installed CLI runner, production launcher/native helper and isolated model fixture.

- [ ] Add failing validator tests for missing/duplicate/reordered/wrong-ID/error replies, fabricated success strings, partial receipts, altered historical replies and later-success masking; implement without weakening current single-revision validator.
- [ ] Seed isolated 10-shot/70s9:16 wedding-like Direct Prompt project, three synthetic Characters, multiple parent-owned Outfits, shared components, six pending frames and privacy canaries. Use live CLI reads/searches, missing asset and Outfit proposals, ensemble/cues, actual preview/submit.
- [ ] Rebuild/sign compiled helper after source comparison, verify Authenticode Valid and effective AllSigned, sign only reviewed QA-driver copy; use separate disposable profiles for localhost4173 and127.0.0.1:4173.
- [ ] Perform trusted native pairing and actual browser approvals; assert every store/media hash unchanged beforehand, ten new genuine recipe roots/receipt IDs afterward, preserved originals/preferences/pending frames; verify explicit revision/take, exact replay, new asset denial and actual revocation calls.
- [ ] Verify cross-origin empty library, reload/reopen, record CLI executable/version, per-call hashes, saved IDs, receipts, durations and retained artifacts. Native inability keeps PR draft and is reported unverified.
- [ ] Commit signed harness/tests with no secrets/profiles/run dumps.

### Task 7: Full regression, final branch review, signed PR and CI

**Files:** Contract/usage docs, machine-readable B3 results, QA report and file inventory; ignored local Wedding conversion plan and execution ledger. `.github/workflows/ci.yml` only if needed to execute new committed validator suite while preserving existing checks.

- [ ] Write contract/UX docs and ignored real-project plan from supplied brief only, labelled historical/unverified; ten actual mappings, six pending frames, explicit later authorization and no production writes.
- [ ] Run `git diff --check`, `npm test`, bridge tests, `npm run typecheck`, `npm run build`, `npm run test:qa`, all CLI validator tests, root/bridge production audits, complete browser suite including signed native tests. Record exact exit codes/counts/skips/warnings and historical/media hashes.
- [ ] Request one fresh whole-branch final review required by inline execution; resolve findings with regression tests and rerun only impacted/full required checks as warranted.
- [ ] Inspect complete staged inventory for scope, secrets, actual data, QA profiles/ZIPs, and certificate/key exclusion. Sign final changes using configured SSH signer and verify with per-command public allowed-signers file; never change Git signing policy.
- [ ] Push this feature branch only; open separate PR against master, kept unmerged/draft if acceptance blocked. Verify hosted CI on exact final signed SHA and provide run links, evidence, risks and retained paths. Avoid post-green metadata changes triggering an unobserved run.

## Self-review and execution

All approved design sections map to Tasks1–7. Review Focus cases are explicitly assigned above. Source hashes are checked before preview/transaction and synchronous state/consent guards bind them at commit; no cryptographic await is introduced inside an active IDB transaction. Public v4 contract, runtime operation/receipt/approval types, stored provenance and MCP supported union must move together. The native harness is separate from existing single-revision certification. Real conversion remains a plan.

Execute inline as approved; do not request another planning approval. Maintain a B3-only ignored execution ledger with commands/results and artifact paths; do not reuse B2's ledger.
