# AI Connections Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver Workstream A as a tested standalone PR with efficient, explicit and bounded session permissions.
**Architecture:** A three-tab coordinator keeps the existing provider/broker alive. Pure draft helpers operate on complete snapshot inventories; one reviewed apply uses the current enforcement boundary.
**Tech Stack:** Existing React 18, TypeScript, Vitest, Testing Library, Playwright and local MCP SDK.
**Spec:** ../specs/2026-10-31-ai-connections-workspace-design.md (approved by user 2026-10-31).
**Execution:** User approved inline implementation and waived another planning approval.

## Global Constraints

- Master base 3e5d352531007f99e72f711396676423bbde6fe5; feature branch codex/ai-connections-workspace.
- Workstream A only. B awaits A review; C awaits B verification/review.
- Keep default-deny, native pairing, trusted browser consent, atomic transactions, immutable scenes and legacy outputs.
- No storage schema, prompt assembler, backup/restore, application-limit, validation.ts or production-library changes.
- Existing limits: 10 projects; 250 scenes/full prompts/candidates; 500 combined assets/variants/templates; 2,000 media; 1,000 exact receipts.
- Only synthetic isolated browser data. Retain disposable profiles; never clear user data.
- No new dependencies. AllSigned and the separate pending pairing repair remain unchanged.
- Keep signing enabled. Prepare one final signed commit after verification; local key access may require the user's terminal.

## Review Focus

- A hidden selection or a result after row 50 must never be lost or omitted from a bulk action.
- Exceeding a combined limit must reject the entire action and retain the old draft.
- Removing project scope must reveal dependent full-prompt revocations without removing separately covered grants.
- Disconnect, expiry or inventory changes must not resurrect a stale/full-access draft.
- Temporary receipt authority must be visible and explicitly revoked on permission application; record selection never approves production writes.

## Task 1: Complete-set permission model

**Files:** Create src/domain/mcpPermissionDraft.ts and src/__tests__/mcpPermissionDraft.test.ts; modify src/domain/mcpScope.ts, src/connections/proposalBroker.ts, src/connections/AiConnectionContext.tsx and broker tests.

**Interfaces:** PermissionInventory maps scope ID/grant fields to stable PermissionRecord values. buildPermissionInventory(snapshot), changeSelection(scope, field, ids, selected), normalizePermissionDraft(scope,snapshot), validatePermissionDraft(scope,snapshot), presetPermissionDraft(name,scope,snapshot), scopeDiff(before,after,inventory) and projectPermissionContext(projectId,snapshot) serve the editor. Scope limits remain single-sourced in validateMcpScope. Provider exposes confirmed session expiry; BrokerView exposes a copied approvedReceiptGrants list.

- [x] Write tests for >50 full matches, hidden selection retention, deduplication, clear-matching, all exact/exceeded limits, dependency revocation/explicit coverage, presets, frozen IDs, exact receipts and ID-based project links.
- [x] Run focused tests and observe missing behavior failing.
- [x] Implement the pure helpers and additive browser metadata without authorization widening.
- [x] Run focused tests, root suite and typecheck. Expected: zero failures; unchanged enforcement tests pass.

## Task 2: Three-view permission workspace

**Files:** Replace src/screens/AiConnectionsScreen.tsx/aiConnections.css; create src/components/aiConnections/{ConnectionPanel,PermissionsWorkspace,PermissionRecordPicker,PermissionReview,IncomingProposals}.tsx; adapt src/__tests__/aiConnections.test.tsx and add src/__tests__/aiPermissions.test.tsx.

**Interfaces:** Screen owns tab/selected-proposal state; PermissionsWorkspace keeps an edited McpScope separate from connection.scope. Components consume Task 1's inventories, diffs and limits. Commit authority remains connection.setPermissions, invoked once after review.

- [x] Write failing component tests for accessible tabs, staged-vs-applied scope, complete-set filtered bulk actions, review, full-access cancel/confirm, privacy isolation, dependency warnings, reset, teardown and no database writes.
- [x] Implement the panels, project shortcut, presets, sensitive controls, selected-only review, bulk actions, pagination and sticky action area.
- [x] Preserve native-pairing flow and existing proposal review while adapting tests to deliberate tab/apply actions.
- [x] Run focused component tests and the whole unit suite/typecheck. Expected: zero failures; no product writes from permission edits.

## Task 3: Browser flows, layout and regression evidence

**Files:** Add e2e/ai-connections-workspace.spec.mjs and synthetic fixtures as needed; adapt existing local-mcp test helpers to tabs and explicit Apply; update screenshot artifact paths and add docs/ai-connections-workspace-qa.md plus synthetic machine-readable results.

- [x] Capture baseline screenshots with synthetic records at all requested widths before changing the tested UI; preserve separate baseline evidence.
- [x] Add browser regressions exercising >50 matches, limit rejection, real synthetic MCP applied scope, stale consent, no focus stealing, privacy and actual proposal review.
- [x] Capture after screenshots at 1440×900, 1366×768, 768×1024, 390×844 and 200%-equivalent reflow; inspect them.
- [x] Run npm test, typecheck, build, production audit, bridge tests/typecheck/audit, test:qa, evidence tests and complete synthetic browser suite.
- [x] Record commands, exit codes, warnings/skips and actual machine-readable totals; preserve historical reports. Expected: green required checks; unsupported native/manual checks explicitly distinguished.

## Task 4: Review and PR

**Files:** QA report, plan/ledger, PR description and only reviewed source/test/docs/CI changes.
- [x] Dispatch one fresh whole-branch reviewer with plan/spec and diff; fix material findings using RED→GREEN tests and rerun affected/full checks.
- [x] Review changed-file list and diff --check; exclude user records, profiles, media, certificates, keys, archives and temporary artifacts.
- [ ] Stage only scoped files and obtain the configured signed commit without disabling signing.
- [ ] Push the feature branch, create the A PR against master, verify hosted CI on that exact SHA and provide run/screenshot evidence.
- [ ] Keep the PR unmerged; stop before Workstream B until requested review.
