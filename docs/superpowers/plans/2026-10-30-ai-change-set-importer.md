# AI Change-Set Importer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Preview and explicitly approve complete production change sets, commit them atomically with durable replay receipts, and export privacy-controlled AI context.

**Architecture:** Strict shared JSON contract and synchronous working-snapshot planner; extracted Stage A pure helpers; one IndexedDB transaction plus a bounded versioned app_preferences ledger; grouped React importer/context workspaces.

**Tech Stack:** Existing TypeScript/React/IndexedDB/Vitest/Playwright/fflate only; no new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-30-ai-change-set-design.md`, interpreting the supplied Stage B implementation brief.

## Global Constraints

- Base is merged Stage A `bc57bd56495e004d13dc034e0fdc4d0fc46a494c`, tree-equal to verified `4ca995ba35546686c16fb8d469f676e0bfc80c1a`; Stage B branch only, final PR against master after rechecking merge state.
- No live localhost:5173/browser data inspection or writes, no profile deletion, no PR #12 or separate validation/capacity/assembler/camera changes; no network feature or new backend/dependencies.
- JSON 20 MiB / 250 operations / 10 projects / 250 shots / 100 scenes / 50 candidate operations / 16 dependency edges / 32 nesting levels. Existing direct limit 100,000 UTF-16 units.
- Ledger <=1,000 receipts /250 candidates /4 MiB; no eviction. Context <=5 MiB /10 projects /250 shots /250 scenes /500 assets; no truncation.
- Exact prompt strings; existing immutable records and original media untouched. New scenes/assets unreviewed; preference/status changes require separate explicit approvals.
- Native execution as requested by the implementation brief; one fresh whole-branch final review. Signed commit deferred until verified patch; preserve ignored QA workspace instead of deleting it.

## Review Focus

- Deferred candidate later approved: original receipt stays idempotent; later review uses a new change-set ID and cannot create duplicates silently (Tasks 2/3/5).
- Several operations on one project check the original revision once; a foreign-tab edit after preview aborts the entire batch (Tasks 2/3/6).
- A scene shared between projects must preserve global head semantics and explicit selected project context (Tasks 2/3/6).
- Context metadata defaults must not leak selected character prompts through generic asset-text controls, unselected scene prompts, filenames or preference extras (Tasks 4/6).
- Receipt replay after full backup/restore and whole Chromium restart must precede stale revision checks; changed content/approval cannot reuse the ID (Tasks 3/6).

## Task 1: Canonical contract, bounds and validation

**Files:** new `src/types/changeSet.ts`, `src/domain/changeSetSchema.ts`, `src/domain/changeSetValidation.ts`, `src/domain/changeSetCanonical.ts`, `docs/change-set.schema.json`, contract examples; tests `src/__tests__/changeSetContract.test.ts`.

**Interfaces:** `parseChangeSet(input:string|unknown):ChangeSet`, `canonicalStringify(value):string`, `changeSetDigest(value):Promise<string>`. Shared JSON Schema is exported as data and used by strict validation; domain settings/authoring validators remain authoritative.

- [x] RED tests: valid ordered project/shot/direct prompt, exact Unicode/CRLF, unknown version/op/fields, dangerous keys, malformed Unicode, all limits, duplicate IDs/refs, forward/wrong-kind/cyclic/deep dependencies, invalid target/revision/type/settings, unverified claims only.
- [x] Implement schema/types/native bounded validation and deterministic digest; generate documented schema from shared data.
- [x] GREEN focused contract tests; schema example parity check.

## Task 2: Reusable Stage A planners and batch simulation

**Files:** modify `src/storage/sceneAuthoring.ts`; new `src/domain/changeSetPlanner.ts`, `changeSetCandidates.ts`, `changeSetState.ts`; optional `Collection.planningNotes`; tests `changeSetPlanner.test.ts`, existing direct/revision tests.

**Interfaces:** `buildRevisionDraft(sceneId,snapshot,options)` and `planAuthoredScene(draft,options,state,{id,now})` are synchronous shared Stage A helpers; individual public APIs retain their established transaction/validation behavior. `planChangeSet(changeSet,approval,snapshot,allocation):ChangeSetPlan` resolves typed refs, returns findings/read signature/writes/results without writes.

- [x] RED tests: original revision constructor/save equivalence, no database writes from simulation; ordered15-shot60s plan; same-project original revision consistency; metadata/reorder/status/preference rules; shared-scene routing/head conflicts; pending media and duplicate asset/candidate decisions; current stored media deletion/inconsistency.
- [x] Extract existing helper logic preserving recipe outputs/negatives/dialogue and Stage A idempotency; build working-copy planner using shared validators and snapshots.
- [x] GREEN planner/new helper tests plus direct/revision/recipe/golden regressions.

## Task 3: Atomic apply, durable ledger and backup

**Files:** new `src/storage/changeSets.ts`, `src/domain/changeSetLedger.ts`; optional Preferences.aiImports; modify `src/storage/db.ts` explicit preference lookup and `src/storage/backup.ts` validation. Tests `changeSetStorage.test.ts`, `changeSetBackup.test.ts`.

**Interfaces:** `previewChangeSet(input,approval):Promise<ChangeSetPreview>`, `applyApprovedChangeSet(preview,approvedDigest):Promise<ChangeSetReceipt>`. Pure planner/digest preparation outside write tx; apply reads current state then synchronously validates/plans and enqueues all creates/updates/receipt in one tx. Preview replay is read-only; durable ledger validation is shared with backup.

- [x] RED tests: complete atomic import, expected-state/tampered approval rejection, same-ID same-digest retry/changed-content failure, two concurrent attempts, forced abort/quota/late-invalid rollback, no active-draft preference mutation, unrelated projects/media/identity preserved, pending candidate later create/reuse, ledger exhaustion.
- [x] RED mixed legacy/Stage A/Stage B backup roundtrip with receipt/candidate references; malformed ledger fails before replacement; legacy ZIP remains valid.
- [x] Implement atomic storage and optional metadata, validate bounded ledger and backup; no store/version upgrade.
- [x] GREEN full focused storage/backup/Stage A regression suites.

## Task 4: Privacy-controlled AI context

**Files:** new `src/domain/aiContext.ts`, `src/types/aiContext.ts`; tests `aiContext.test.ts`.

**Interfaces:** `buildAiContext(snapshot,selection):AiContextDocument`, `serializeAiContext(...):string`; selected IDs only and explicit opt-ins for scene prompts, generic asset text, character identity/anchors, notes/pending labels and filenames.

- [x] RED tests: metadata-only defaults with canary secrets/private notes/filenames/preferences; selected-only projects/scenes/assets; shared head metadata; independent character toggle; byte-exact optional prompts; output bounds/no truncation; no writes.
- [x] Implement whitelist/export bounds and actionable selection errors.
- [x] GREEN context tests plus existing export/golden suite.

## Task 5: Import/context UI and documentation

**Files:** new importer, grouped preview, approval/candidate, receipt and context screen components/styles; App routes; Collections and Library entry points; project planning notes display. Tests `changeSetWorkspace.test.tsx`, `aiContextWorkspace.test.tsx`.

- [x] RED tests for file/paste preview without writes, literal imported text, real computed counts/runtime, per-group approvals/candidate duplicate acknowledgement, exact before/after revision text, input/approval change invalidating digest, Cancel, conflicts, success receipt/replay and later candidate review.
- [x] Implement accessible compact workspaces with existing dialogs, controlled selection, safe rendering, copy/download and clear stale-preview recovery.
- [x] GREEN component tests/typecheck. Write canonical valid/invalid examples, AI context guide, Stage C readiness contract and synthetic15-shot sample.

## Task 6: Synthetic browsers, screenshots and final verification

**Files:** new `e2e/change-set-fixture.mjs`, `e2e/change-set.spec.mjs`, `e2e/change-set-screenshots.spec.mjs`, synthetic fixtures and intentional docs screenshots; QA report and machine evidence.

- [x] Capture before screenshots before product source edits at 1440×900,1366×768,768×1024,390×844 with base-tree guard.
- [x] Browser RED→GREEN coverage A–L:15shots60s types2/9/4, existing project append, immutable revision/restore/takes, cross-project rejection, replay, stale second tab, quota/abort, pending media, duplicate identities/camera candidates, exact copy/TXT/export/full backup/restore, process restart then replay, legacy22-hash integrity.
- [x] Check all viewport sizes, 200% equivalent reflow, keyboard/dialog focus, huge/long preview, cancellation/receipt/context privacy. Capture/inspect after screenshots; CI writes raw PNGs under ignored QA directory.
- [x] Full unit and Playwright runs, typecheck/build/production audit/historical QA; record actual exits, unique counts, warnings, hashes, 60s runtime and complete file list. One fresh final review; reproduce and correct Important/Critical findings, run relevant/full checks.

## Task 7: Signed publication and CI

- [ ] Review complete changed content/privacy/protected paths, explicit staging, source hashes and whitespace.
- [ ] Keep SSH signing enabled; verify signed feature commit. Recheck PR26/master status and ancestry; no automatic merge.
- [ ] Push feature branch; create/attach correct-base PR; verify exact-head hosted CI and hash-verified machine artifact; return PR/CI/report/screenshots and unresolved risks.

## Execution rulings

The user explicitly requested documenting contract choices then implementing; do not substitute another design/plan approval round. Native execution and final independent review preserve the established workflow. User data/profile retention overrides skill cleanup. Stage A has already merged, so master is the appropriate final base after verifying its merge tree.

Local verification and review are complete. Task7 checkboxes capture the pre-signing state; signed publication and exact-head hosted CI are reported on the PR and in the delivery response. Rulings: the user already selected push/create PR; no redundant integration menu. Keep the worktree and all QA profiles. Retain independent pack associations; no implicit removal is added. Final review found3Important issues, all reproduced and addressed in one fix pass; no second review.
