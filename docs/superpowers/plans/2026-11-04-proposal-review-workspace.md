# Proposal Review Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The owner explicitly chose inline execution and authorized writing this plan without a second planning-approval gate.

**Goal:** Allow durable 24-hour proposal review, clear actionable blockers, explicit rejection feedback and compact bulk review without carrying authority across sessions.

**Architecture:** A bounded separate IndexedDB inbox holds uncommitted packages and local progress, while ProposalBroker retains short-lived session/approval authority. A shared readiness projection drives a selected-operation workspace and precise issue navigation; the existing atomic change-set writer remains the only path to library changes.

**Tech Stack:** Existing React/TypeScript/CSS, IndexedDB, Vitest/fake-indexeddb, Playwright, authenticated MCP v1–v6; no new dependency.

**Spec:** `docs/superpowers/specs/2026-11-04-proposal-review-workspace-design.md` (owner approved 2026-11-04, including inline planning/implementation and an unmerged tested PR).

## Global Constraints

- Keep library DB version 3/eight stores, all storage/backup/export limits, immutable scenes and v1–v6 contracts unchanged.
- Review window 24 hours; session 1 hour, idle 15 minutes, native challenge 2 minutes, final one-use save consent 1 minute unchanged.
- Review cache: 8 original packages ≤1 MiB each, metadata/progress ≤64 KiB each, total ≤10 MiB; cache is outside library backups and contains no authorization material.
- Optional rejection feedback ≤2,000 Unicode characters and ≤8 KiB UTF-8, plain text; sharing requires a separate trusted explicit owner action and current scope.
- No real-library writes/tests, native approval automation, global MCP changes, live package activation, signed helper overwrite, credential/certificate/profile/ZIP commits or PR #12 changes.
- Use existing KRAKINAI components/palette, preserve complete prompt copy/export, no partial batch apply and no automatic scope/revision/asset replacement.
- Owner's SSH signer requires their terminal. Prepare one final concrete reviewed commit rather than repeatedly interrupting the owner for intermediate signing; preserve logical checkpoints in task evidence.

## Review Focus

1. A cached applying flag is not a receipt: restart after an uncertain save must read the real ledger before any retry (Task 2).
2. A local rejection/removal in another tab must not be overwritten by an old progress callback or resume (Tasks 1–2).
3. An optional feedback field must not leak an old package's existence or private comment after scope reduction, including v1 status paths (Task 3).
4. A globally blocking finding with no operation ID or an unknown future operation must remain visible/reachable, with Apply explanations matching actual guards (Tasks 4–5).
5. A large/expired/incomplete v6 package must remain readable/downloadable on mobile without treating viewed marks as approval or truncating copied text (Tasks 5–6).

## Files and responsibilities

- Create `src/types/proposalReview.ts`: local record/progress/rejection types, separate from grants/receipts.
- Create `src/domain/proposalReview.ts`: retention/feedback/record validation and deterministic budgets; no storage or authority.
- Create `src/storage/proposalReviewInbox.ts`: separate DB, transactional capacity/CAS, no library access, no silent deletion.
- Modify `src/types/mcp.ts`, `src/connections/proposalBroker.ts`, `src/connections/AiConnectionContext.tsx`: local draft restore, explicit resume/renew/reconsider, current status/feedback checks and commit recovery.
- Create `src/domain/proposalReadiness.ts`: one display projection of findings plus lifecycle/approval needs.
- Create review workspace/issue/feedback components under `src/components/aiConnections/`; adapt `ChangeSetPreview`, v5/v6 detail components and `McpProposalReview` narrowly.
- Modify `src/screens/aiConnections.css` and necessary shared preview CSS. Add proposed-finding context where the planner has exact project information.
- Focused unit/browser tests, synthetic fixtures, user/MCP documentation and QA report; standalone mockup stays ignored.

### Task 1 — Bounded local inbox and pure policy

**Interfaces:** `ReviewDraftRecord`, `ReviewProgress`, `ReviewFeedback`; `validateReviewDraft(value:unknown):Promise<ReviewDraftRecord>`; `createReviewDraft(changeSet:ChangeSet,now:number):Promise<ReviewDraftRecord>`; `validateReviewFeedback(text:string):string`; `ReviewInboxRepository` with `list`, `create`, `update(record,expectedRevision)`, `remove(id,expectedRevision)`. Domain constants express the exact spec bounds.

- [x] Add `proposalReview.test.ts` and `proposalReviewInbox.test.ts`: package/digest/origin/deadline round trip, Unicode/8 KiB comment bounds, no authority fields, eight-item/byte caps, CAS conflict, removed/rejected/applying record protection and quota errors. Assert main library snapshot/store list unchanged.
- [x] Run `npm test -- src/__tests__/proposalReview.test.ts src/__tests__/proposalReviewInbox.test.ts`; retain actual RED output before implementation.
- [x] Implement pure validation and the separate repository. Validate before and after load; bound reads; create/update use one IDB transaction with revision checks. Preserve malformed records for export/removal with an explicit load error; do not execute them.
- [x] Run the focused tests to green and typecheck. Record exact counts/exit codes in ignored task evidence.

### Task 2 — Broker restore, 24-hour review and authoritative resume/recovery

**Interfaces:** Optional `inbox` dependency; `initializeInbox():Promise<void>`; `resumeDraft(id:string,event:Event,options?:{renew?:boolean;reconsider?:boolean}):Promise<void>`; `removeDraft(id,event):Promise<void>`; saved-draft display metadata on `McpProposalView`. Persist raw content/progress, never scope/session/consent. Existing brokers without an injected inbox remain testable in memory.

- [x] Add `proposalReviewBroker.test.ts` and update old ten-minute expiry expectations: ten minutes remains reviewable; 24-hour boundary blocks Apply; retries do not extend. Session/idle expiry still revokes while content remains. Restore begins disconnected with no approvals; insufficient grants, changed expected revisions/digests and malformed cache cannot resume.
- [x] Add crash/CAS cases: cache applying state with/without actual ledger receipt; cache update failure after a real commit reports saved receipt; no duplicate on retry; removed/rejected stale-tab updates fail; reconsider and renew require actual trusted browser events.
- [x] Run those tests red; implement repository initialization/restore, cached admission, explicit current-scope resume/renew, expiry display and uncertain-save receipt recovery. Persist an applying disposition before the library transaction so normal cache rejection/removal cannot race it; it is a recovery hint, never authority. Catch postcommit cache errors outside the transaction-failure path.
- [x] Keep all current transaction guards and unchanged security timers. All exact save flags and final confirmation reset on restore/disconnect/renew/content change; draft choices are untrusted UI hints only. Add clear saved/in-memory-fallback/capacity errors.
- [x] Run old/new broker, transaction guard, scope, v5/v6 and storage tests to green. Verify no production-library writes before approval.

### Task 3 — Explicit rejection feedback and scoped MCP status

**Interfaces:** `rejectWithFeedback(id:string,text:string,share:boolean,event:Event):Promise<void>`; local/remote feedback projection bound to exact package, current session/epoch and owner action. Optional output metadata only; no new MCP tool or v7 operation.

- [x] Add `proposalFeedback.test.ts`: local-only, explicit sharing, empty/oversized/Unicode/HTML-like text, guessed ID, changed digest, unselected project, reduced scope/epoch and old contract paths. Persisted sharing history does not authorize disclosure to a new session. Rejection never calls the apply dependency.
- [x] Run red, implement all-status scope revalidation and bounded final rejection comment. Reject without a comment remains possible. A local offline rejection does not need an agent, but sharing requires current authorized binding; read cached old comments only after explicit new-session sharing.
- [x] Run tests green and verify v1–v6 input schemas/thirteen tools remain unchanged. Update descriptions/docs only where necessary; do not rebuild a live release.

### Task 4 — One readiness model and exact issue targets

**Interfaces:** `proposalReadiness(preview:ChangeSetPreview,context:ReviewReadinessContext):ProposalReadiness`; data conflicts, pending approvals, advisories and lifecycle needs have stable display IDs, exact messages and known target context. No duplicated validation logic or inferred operation attribution.

- [x] Add `proposalReadiness.test.ts` for PROJECT_VALIDATION without operation ID, capacity, unknown/global, mixed approval/data, unknown operation type and terminal/disconnected/applying states. Assert counts/row badges/Apply explanations use the same findings, while approvals remain a separate category.
- [x] Run red, implement projection and add optional known project/shot/field finding context at the planner's actual source. Unknown context routes to Batch. Preserve the existing atomic writer's guards as authority.
- [x] Run planner/readiness/shared-preview regressions green.

### Task 5 — Compact selected-operation workspace and feedback UI

**Interfaces:** `ProposalReviewWorkspace` consumes the current preview/readiness, selected operation/tab and callbacks; `ProposalIssues` renders the projection; `ProposalRejectionDialog` uses `StudioDialog`. Existing v5/v6 detail components accept an optional exact operation filter and remain reusable by manual import.

- [x] Add focused UI tests for one operation's detail mounted at once, all groups/fallback rows, search/filter, keyboard tabs, Batch issue jump/focus, issue drawer close versus jump focus, rejection dialog/return focus, exact full-text copy and expired navigation/download. Fake human events must still fail the broker's authority checks.
- [x] Run red; implement desktop navigator/detail/approval rail and mobile selector/drawer/sticky actions from the approved mockup. Mount only the selected v5/v6 detail, reuse existing exact decision controls, add readable Apply reasons and save-window status. Keep original package Download enabled for terminal states. No partial-selection Apply semantics.
- [x] Wire cache progress, explicit resume/renew/reconsider/remove and final feedback actions. Announce save/fallback outcomes without stealing focus; no auto-review of arriving packages. Reset final consent on relevant changes.
- [x] Run UI tests and the original shared preview/permission suites green. Check both MCP review and unchanged manual import paths.

### Task 6 — Synthetic browser workflows and documentation

**Files:** Create `e2e/proposal-review.spec.mjs` and narrowly extend existing isolated MCP fixture as needed; add a separate inbox-reset helper only for synthetic profiles. Create `docs/proposal-review.md` and `docs/qa/proposal-review-workspace.md`; update setup/authoring docs for saved draft versus authority and scoped feedback.

- [x] Browser regression: synthetic v1/v6 submission, close/reopen isolated profile, original package hash and progress survive, disconnected controls, new pairing/current scope and stale-state rejection, current browser approval, exact one new immutable scene/receipt/replay and old outputs/media preserved. Distinguish cache writes from unchanged eight-store library.
- [x] Browser regression: reject locally/shared with actual review controls, actual MCP status comment, permission rejection after scope reduction, expiry/renewal under injected test clock, quota/write failure, stale-tab rejection/remove and uncertain applying recovery. Do not automate native pairing or actual-library approval; use existing synthetic transport where appropriate and label any manual/native gate separately.
- [x] Capture actual before/after implementation at 1440/768/390 and verify keyboard/filter/tab/drawer/copy/download behavior with long fifteen-shot packages. Keep design mockups distinct from product screenshots.
- [x] Run focused browser suites; retain failures, then fix only demonstrated defects. Explain local cache exclusion from library backups, session/approval deadlines, renewal and feedback disclosure. No new global settings or live activation.

### Task 7 — Full verification, independent review, signed PR and CI

- [x] Run `git status --short`, `git diff --name-status`, `git diff --check`, complete `npm test`, app/bridge typechecks and builds, bridge/native/helper tests, production audits, QA/schema checks and full synthetic browser suite. Reconcile actual machine results and all skips. Preserve user validation.ts changes and exclude private/cache/profile/ZIP/signing artifacts.
- [x] Request one fresh whole-diff independent review, address material findings with focused red/green regression evidence, then rerun affected and required final gates. Update QA with exact SHA/evidence limits and screenshot existence.
- [ ] Stage only reviewed source/tests/docs/synthetic approved product screenshots. Ask owner to sign the concrete final commit if the configured SSH signer cannot finish. Do not disable signing or ask for a passphrase.
- [ ] Push `codex/proposal-review-workspace`, open a PR against master, run/verify hosted CI on its final signed head and report successful run links and unresolved risks. Keep the PR unmerged and live bridge/library untouched. Any new portable package/activation is a separate owner decision.

## Self-review and execution decision

All twelve spec sections map to Tasks 1–7. Review Focus lines map to explicit tests above; types/method names are consistent across task boundaries. Minor component splits and exact wording remain builder-owned. No new dependency, change-set schema, native package or library migration is introduced. The owner approved the design and **inline implementation, including writing this plan without another planning approval**, on 2026-11-04. Proceed with executing-plans and TDD; retain one independent final review.
