# Direct Prompt and Scene Revisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save complete exact prompts without component assets and support immutable scene versions in the existing production workflow.

**Architecture:** Add explicit authoring metadata and a direct-only content/validation path. Reuse IndexedDB transactions and storyboard relationships for atomic, idempotent saves. Existing recipe assembly and frozen outputs remain unchanged.

**Tech Stack:** TypeScript, React 18, IndexedDB, Vitest/fake-indexeddb, Playwright, existing fflate; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-30-direct-prompt-revisions-design.md` (user approved).

## Global Constraints

- Stage A only; Stage B–D interfaces are documentation, not network implementations.
- Base `eb15dc1583f59cbee195eba9d356b0d35ef290fb`; feature branch only; no automatic merge.
- Missing authoring mode remains recipe; never rewrite historical records or identities.
- Direct text: nonblank, at most 100,000 UTF-16 code units, no normalization; title 1–100 characters; existing settings/attachment/archive limits remain.
- Keep all existing recipe checks, camera semantics, original bytes/names, snapshots, and backup rollback. Do not touch PR #12 or capacity settings.
- New direct/version saves never silently change preferred takes or production/review status.
- Isolated synthetic browser data and test origin only. Never restart/repoint localhost:5173 or delete profiles.
- Established signed-commit workflow; commits deferred to verified final staging to avoid repeated interactive passphrase interruptions.

## Review Focus

- A direct prompt beginning with a recipe-style title header must compare/copy byte-exactly, not lose its prefix.
- Pasted CRLF and combining Unicode must survive textarea display, clipboard, ZIP and restore without normalization.
- Legacy version families can branch; start a managed root at the selected legacy scene without renumbering earlier records.
- A save retry after a successful transaction must not duplicate scene/shot creation or mutate preference.
- A missing media record after selection must not become a claimed attachment or corrupt the draft/library.

## Task 1: Contract, exact content, readiness and revision helpers

**Files:** `src/types/sceneAuthoring.ts`, `src/types/domain.ts`, `src/domain/directPrompt.ts`, `src/domain/sceneRevisions.ts`, `src/__tests__/directPrompt.test.ts`, `src/__tests__/sceneRevisions.test.ts`.

**Interfaces:** `isDirectPrompt(record)`, `validateSceneAuthoring(record, saved?:boolean):string|undefined`, `getSceneOutput(record, mode):string|undefined`, `getDirectPromptReadiness(record, mediaMap):string[]`, `getRevisionFamily(scene, scenes):SavedScene[]`, `compareSceneVersions(before, after)`; types for DirectPromptContent, PendingSceneInput, SceneRevision and SceneRevisionIntent.

- [x] Write failing tests for exact strings/header-like prose, bounds, invalid versions/modes, missing source readiness, metadata diffs, and branched legacy roots.
- [x] Run `npm test -- src/__tests__/directPrompt.test.ts src/__tests__/sceneRevisions.test.ts`; confirm intended failures.
- [x] Implement bounded helpers and optional metadata without touching recipe assembler logic.
- [x] Repeat focused tests; require all passing.

## Task 2: Transactional direct/revision storage

**Files:** `src/storage/db.ts`, `src/storage/sceneAuthoring.ts`, `src/domain/sceneDuplicates.ts`, `src/domain/phase4Validation.ts`, `src/__tests__/directPromptStorage.test.ts`.

**Interfaces:** `createDirectPromptDraft(target?)`, `createSceneRevisionDraft(sceneId, {asDirect?, restoreFromSceneId?, target?})`, `saveAuthoredScene(draftId, {requestId, expectedInputRevision, target?, selectAsPreferred?})`; target binds collection/shot/project revision or new-shot title/type. Saved provenance uses explicit root/parent/current head and sequence. `saveSceneFromDraft` dispatches direct or managed revision drafts before unchanged legacy recipe save.

- [x] Test no-component saves, immutable v1/v2/v3, unchanged preferred/empty selection, distinct takes, same-request retry/conflicting reuse, atomic new-shot creation, stale project/head/draft, cross-project target, missing/invalid media, and forced transaction errors.
- [x] Run focused storage tests RED; implement save/draft helpers with current-record validation and one transaction.
- [x] Validate new metadata at draft save and backup boundaries; preserve media reachability for direct draft references.
- [x] Run focused storage + existing duplicates/projects/repository tests GREEN.

## Task 3: Honest exports and backup round trips

**Files:** `src/domain/directPromptDocument.ts`, `src/domain/sceneDocument.ts`, `src/domain/generationDocument.ts`, `src/domain/projectExport.ts`, `src/storage/backup.ts`, `src/__tests__/directPromptBackup.test.ts`, `src/__tests__/directPromptExport.test.ts`.

**Interfaces:** direct JSON builders return explicit direct schemas/original text/provenance/readiness without invented recipe components. Project export manifest marks unavailable structured/compact files; recipe documents remain byte-identical.

- [x] Write RED tests for mixed backups, all version IDs/relationships, pending inputs, media hashes, honest JSON, exact ZIP prompt bytes, omitted unavailable formats, old fixture compatibility, and invalid new metadata rejection before replacement.
- [x] Implement conditional document/export/backup support and audit every Full/Structured/Compact consumer.
- [x] Run new tests plus existing scene/generation/project-export/backup/golden tests GREEN.

## Task 4: Direct workspace and routing

**Files:** `src/screens/DirectPromptScreen.tsx`, `src/components/DirectPromptWorkspace.tsx`, `src/components/directPrompt.css`, `src/App.tsx`, `src/screens/SceneBuilderScreen.tsx`, `src/screens/LibraryScreen.tsx`, `src/context/LibraryContext.tsx`, `src/__tests__/directPromptWorkspace.test.tsx`.

**Interfaces:** `/direct/new` creates a fresh bound draft; `/builder/:id` and `/output/:id` dispatch direct records to the workspace. Entry points use explicit project/shot context and do not clear an existing recipe draft. Workspace persists direct text/metadata/references and calls Task 2 save.

- [x] Write RED component tests for import entry, exact editor/paste state, draft reload, unavailable formats, raw copy/download and actionable failure.
- [x] Implement original editor/preview, title/origin/settings/notes, stored reference selection/pending inputs, readiness and explicit project save target.
- [x] Keep unsaved buffer dirty guard; use accessible controls, existing dialogs, constrained viewer and sticky actions.
- [x] Run focused component tests GREEN and typecheck.

## Task 5: History, comparison and storyboard integration

**Files:** `src/components/SceneRevisionHistory.tsx`, `src/components/sceneRevisions.css`, `src/screens/PromptOutputScreen.tsx`, `src/screens/CollectionWorkspace.tsx`, `src/components/ProjectTakeManager.tsx`, `src/domain/projectRoutes.ts`, `src/storage/projects.ts`, relevant component tests.

**Interfaces:** history opens exact versions, compares full text + explicit metadata changes, starts version/restore drafts, and uses explicit preferred selection with expected project revision. Existing recipe revision defaults to recipe; optional Full edit converts only in a new draft.

- [x] Write RED tests for v1/v2 comparison, full previous/current content, restore-as-v3, alternate labels, metadata disclosure, unrelated project isolation and explicit preference.
- [x] Implement compact history/dialog controls and storyboard Import Full Prompt/New Version entry points; keep prior take manager layout.
- [x] Run focused history/project component tests and typecheck GREEN.

## Task 6: Committed synthetic browser coverage and screenshots

**Files:** `e2e/direct-prompt-fixture.mjs`, `e2e/direct-prompt.spec.mjs`, `e2e/direct-prompt-screenshots.spec.mjs`, `docs/screenshots/direct-prompts/**`.

- [x] Browser tests must first fail for newly introduced journeys, then pass after implementation; do not count retries/repetitions as unique cases.
- [x] Test all seven acceptance scenarios, exact clipboard/download/ZIP/restore hashes, reload, synthetic media removal, concurrency/failure, two-project isolation, legacy recipe and cinematography compatibility.
- [x] Capture before/after at 1440×900, 1366×768, 768×1024, 390×844; also verify 200% reflow, keyboard/focus and action visibility.
- [x] Keep screenshot provenance and machine-readable unique test results; no real data or profiles committed.

## Task 7: Whole-branch review and verification

**Files:** final changed files, `docs/direct-prompt-contract.md`, `docs/direct-prompt-qa.md`, `docs/qa/direct-prompt-results.json`; progress ledger under ignored `qa-results/direct-prompts`.

- [x] Run all unit/component tests, typecheck/build, production audit, QA ledger checks and all synthetic browser cases; collect actual exits and warnings.
- [x] Fresh whole-branch review against approved spec and this plan, including all Review Focus cases. Reproduce material findings RED, fix, rerun relevant/full checks.
- [x] Document implemented bounds/operations and Stage B–D contracts, historical frozen hashes, media integrity, screenshots and limitations.
- [x] Inspect complete diff/file list and privacy-sensitive paths; no user data/ZIPs/profiles/credentials/temp QA artifacts staged.

## Task 8: Signed commit, feature push and hosted CI

- [ ] Stage explicit verified files; inspect staged diff/check.
- [ ] Use configured SSH signing; request local terminal signing only if interactive key access is needed. Never disable signing or log secrets.
- [ ] Verify signed commit, push only feature branch, create/attach one PR against `master`, leave PR #12 untouched.
- [ ] Verify hosted CI and machine-readable totals for the actual pushed SHA; report exact results and all unresolved risks. Never merge automatically.

## Execution rulings and progress

- User approved the design and implementation. Execute without a second planning approval question; native execution with one fresh whole-branch review.
- Preserve ignored QA workspaces instead of deleting them: the user's explicit profile/file preservation requirement overrides skill cleanup suggestions.
- Defer signed commit until the complete verified patch is reviewable; no unsigned interim commits.

Execution snapshot: Tasks 1–7 verified before signing. Final results: 581 unit/component tests, 113 unique browser cases, 20 screenshot files, 22 unchanged legacy output hashes; all command gates passed. One final review completed and all material findings corrected. Task 8 completion is recorded by the signed PR commit and hosted CI, which occur after this snapshot.
