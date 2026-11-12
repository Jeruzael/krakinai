# Import History Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. The owner approved inline execution and waived a separate plan approval.

> **Owner-directed follow-up (2026-11-13):** The per-receipt expanded-evidence cap is now 50 MiB and the aggregate cap is 96 MiB. The implementation and QA results recorded in this original plan used the prior 4/32 MiB limits; the new boundaries still require isolated QA. The 8 MiB stored-ledger and 20 MiB backup-metadata limits remain unchanged.

**Goal:** Preserve complete import evidence compactly, demonstrate bounded 8 MiB history, and expose batch-level admission failures before approval.

**Architecture:** A versioned receipt codec preserves exact canonical bytes while a protected database/backup feature version prevents old-reader writes. Verified asynchronous preparation precedes the existing synchronous atomic transaction; typed capacity checks feed browser and allowlisted MCP summaries.

**Tech Stack:** Existing TypeScript/React, IndexedDB, WebCrypto, fflate, Vitest/fake-indexeddb and Playwright; no new dependencies.

**Spec:** [Approved design](../specs/2026-11-05-import-history-storage-design.md)

## Global Constraints

- Stored ledger: 8 MiB test target; expanded receipt: 50 MiB; aggregate evidence: 96 MiB.
- Preserve 1,000 receipts, 250 combined candidates, 20 MiB backup metadata and 128 MiB Project Export limits.
- Preserve v1-v6 inputs, all existing evidence, exact output bytes, scene immutability, atomicity and permissions.
- Main database v4, eight unchanged stores, explicit upgrade/backup acknowledgement. No live library/launcher/configuration activation.
- Synthetic isolated QA only. Retain ignored files/profiles. No signing keys/certificates or actual library/story content in Git.
- No asynchronous work inside a write transaction. Final content, scope, ledger and capacity revalidation are mandatory.

## Review Focus

- A small compressed payload can expand far past its declared size: Task 1 tests incremental decoder allocation, output ceilings and corrupt/trailing input.
- History can change while a user approves: Tasks 3/6 test exact prepared-ledger comparison, fresh capacity and no partial write.
- Legacy receipts and old tabs must not lose data: Tasks 2/4 test mixed evidence, blocked upgrades, cancellation and old-reader rejection.
- Individually valid frame prompts can hide a batch blocker: Tasks 5/6 test actual MCP responses and browser disabled Apply.
- A fit in ledger storage can still exceed backup metadata: Tasks 3/4 independently test admission and restorable mixed-history exports.

## Files and responsibilities

- New `src/domain/importEvidence.ts`: strict lossless envelope, bounded sequential decoding, asynchronous SHA-256 verification, prepared evidence proofs.
- `src/types/changeSet.ts`, `src/domain/changeSetLedger.ts`: storage v4 unions/validation, logical receipt access and independent limits.
- `src/storage/changeSets.ts`, `src/domain/changeSetCapacity.ts`: asynchronous preparation, atomic comparison, typed capacity result.
- `src/storage/libraryCompatibility.ts`, `src/components/LibraryCompatibilityGate.tsx`: protected v4 header and pre-upgrade owner flow.
- `src/domain/backupFeatures.ts`, `src/storage/backup.ts`: feature-gated evidence integrity and legacy/mixed full backups.
- New `src/components/ImportCapacity.tsx`; existing ChangeSetPreview and proposal-review/readiness code: compact owner-visible admission details.
- `src/connections/proposalBroker.ts`, `src/domain/mcpReads.ts`: safe additive batch summaries and legacy-compatible public receipts.
- Focused tests below, existing related fixtures/tests, `e2e/import-history.spec.mjs`, synthetic browser fixtures and documentation/QA report.

### Task 1: Lossless bounded evidence codec

**Interfaces:** `encodeImportEvidence(text:string):Promise<CompactImportEvidence>`, `decodeImportEvidence(envelope):string`, `verifyImportEvidence(envelope):Promise<string>`; constants for 50 MiB evidence and bounded input chunks. Decode validates encoding/UTF-8/canonical payload boundaries; verify additionally checks SHA-256.

- [x] Add `src/__tests__/importEvidence.test.ts`: exact Unicode/canonical round trip; wrong size/hash/encoding/base64; truncated/trailing/corrupt streams; incompressible boundary; bomb stops during decoding.
- [x] Run focused Vitest; establish the new tests fail before implementation.
- [x] Implement existing fflate/WebCrypto codec; preserve exact bytes and expose decoder high-water observations to a test harness without product debug UI.
- [x] Run focused tests and compare hashes to WebCrypto; record overshoot/allocation observations.
- [x] Record a logical checkpoint; preserve owner's signed final commit workflow.

### Task 2: Versioned mixed ledger

**Interfaces:** `prepareImportLedger(ledger):Promise<VerifiedImportLedger>` gives exact comparison token and verified expanded totals; `validateImportLedger` retains synchronous shape/bounds/canonical checks. New receipt storage v4 uses v5/v6 schema and exact frame results. Logical receipt projection remains v2/v3.

- [x] Add `src/__tests__/compactImportLedger.test.ts`: unchanged v1-v3 entries in v4, count/storage/aggregate/per-receipt bounds, invalid origin/schema/evidence and public projection redaction.
- [x] Run failing tests; implement storage types, sequential verification and v4 append semantics without retrospective compaction.
- [x] Run existing Blocking/keyframe/backup ledger tests; update only expectations deliberately changed by the new protected format/cap.
- [x] Record checkpoint and measured serialized/expanded sizes.

### Task 3: Atomic preparation and typed capacity

**Interfaces:** shared capacity result contains owner-only exact/current/prospective byte/count fields and typed findings. Prepared ledger/evidence tokens remain browser-local. `previewChangeSet` returns optional capacity details; `applyChangeSet` verifies fresh state and encoded evidence before any synchronous transaction writes.

- [x] Add capacity tests with real valid synthetic receipts below/at/over every independent bound; malformed evidence is integrity failure.
- [x] Add storage regression: concurrent ledger append between verification and transaction, stale sources, altered approvals, injected scene/receipt write failure and idempotent replay.
- [x] Run failing tests; implement preparation before transaction, canonical evidence equality and exact ledger comparison within transaction. Retain all existing authorization/revision/media checks.
- [x] Run related change-set/recipe/Blocking/keyframe save suites; assert complete pre/post state on failures and fixed-fixture output/digest equality.
- [x] Record checkpoint; no real database calls.

### Task 4: Protected upgrade and full backups

**Interfaces:** compatibility inspection recognizes legacy v1/v2/v3 and current v4; pre-upgrade backup reader accepts v3; enabling requires explicit backup acknowledgement. `compact-import-evidence.v1` is required for ledger v4 in manifest schema 2.

- [x] Add regression tests for old v3 tabs, blocked/cancelled upgrades, unchanged eight-store contents and no automatic upgrade.
- [x] Add mixed-history full ZIP export/restore/re-export; corrupt evidence/hash and unknown feature reject before replacement; old backup schemas remain accepted.
- [x] Run failing tests, then implement header/feature changes and asynchronous evidence verification at integrity/restore entry points.
- [x] Test startup/recovery integrity and legacy receipt replay after restart; compare archive media/output hashes and record counts.
- [x] Record checkpoint; keep all unrelated storage/export limits unchanged.

### Task 5: Browser capacity and safe MCP summaries

**Interfaces:** `ImportCapacity({capacity})` renders one compact storage section. MCP `batchChecks` version 1 exposes only safe readiness/finding codes/fixed text and snapshot identity; no global history measurements or private contents.

- [x] Add UI tests for known/unknown/provisional capacity, linked global blocker and disabled Apply after a capacity race.
- [x] Add broker tests for preview/submit/status when frames pass but history or backup admission fails; scope rejection, read-only derivation, redaction, response bounds and logical receipt projection.
- [x] Run failing tests; implement the owner-only section and additive allowlist projection on all v1-v6 paths. Preserve existing approval/cache state and review lifetime.
- [x] Run existing proposal-readiness, review-workspace, privacy, permission and MCP regression suites.
- [x] Record checkpoint and update user/agent documentation.

### Task 6: Synthetic end-to-end and resource certification

**Interfaces:** committed synthetic fixture/runner produces machine-readable counts, bytes, hashes, timing/memory observations and actual MCP request IDs. It never uses the real origin/profile or actual story.

- [x] Add 15-shot/33-frame/30-operation browser workflow with independently authored assets, mixed prior history, browser review/approval, exact take/frame/output checks, restart and receipt replay.
- [x] Add permission/stale/rollback cases and MCP batch-blocker proof; retain each actual tool response by request ID.
- [x] Run representative and near-boundary stored/expanded history, incompressible/bomb fixtures, backup readback and restart. Record peak process memory and durations; reject unverified targets rather than widening them.
- [x] Capture and inspect synthetic 1440/768/390 screenshots for compact storage check, blockers, keyboard/focus/mobile behavior.
- [x] Record independent successful/failed cases and remaining manual/platform limitations.

### Task 7: Complete regressions and independent source review

- [x] Run `git diff --check`, `npm test`, `npm run typecheck`, `npm run build`, app/bridge production audits, bridge/native/helper suites, complete browser suite and required QA reconciliation.
- [x] Inspect actual exit codes/warnings/skips and machine-readable totals. Re-run only after a new change or unresolved failure warrants it.
- [x] Use one fresh final reviewer as required by inline execution; resolve material findings with targeted regression tests.
- [x] Update plan, QA report and results JSON with actual supported limits, memory, hashes, command results and limitations. Verify no real content/secrets/artifacts are staged.

### Task 8: Signed PR and hosted checks

- [ ] Stage exact reviewed source/tests/docs, obtain owner terminal signed commit if local SSH signing needs their key, and verify the commit.
- [ ] Push `codex/import-history-storage`, create a separate PR against master, wait for final-head Linux/Windows hosted CI and link exact runs.
- [ ] Keep PR unmerged. Do not activate a live upgrade/launcher or retry the real blocked proposal. Report remaining limits honestly.

## Plan self-review

All design areas map to Tasks 1-8; every review-focus failure has a named test owner. Interfaces preserve synchronous transaction work and separate stored, expanded and backup budgets. Final signing and live activation retain the owner's existing authorization boundaries. No further plan approval is required under the owner's explicit design approval.
