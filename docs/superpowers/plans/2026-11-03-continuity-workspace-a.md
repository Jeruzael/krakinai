# Continuity Workspace A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The owner explicitly approved inline execution and waived a second planning approval. Independent whole-diff review is still required.

**Goal:** Deliver the compact Continuity Collection workspace and recipe-first agent guidance without changing saved records or authoring contracts.

**Architecture:** Derive a read-only presentation model from existing selected takes, wardrobe snapshots, shot-level First/Last associations and exact transition pairs. A focused workspace/controller reuses existing metadata save APIs and shared dialogs. Navigation state belongs in the URL/UI, not IndexedDB; MCP guidance changes descriptions only.

**Tech Stack:** Existing React/TypeScript, CSS tokens, IndexedDB repository, Vitest/Testing Library, Playwright and MCP SDK. No new dependencies.

**Spec:** [Approved A design](../specs/2026-11-03-continuity-workspace-a-design.md).

## Global Constraints

- A only. Blocking, arbitrary keyframes, image assembly, new data/proposal schemas and Flow handoff remain later review gates.
- Preserve every saved output/snapshot, preferred take, media byte/association, legacy First/Last field, v1–v4 contract and existing backup/export limit.
- No real-library access, global Codex change, live bridge rebuild/activation, automatic merge/deploy, PR #12 change or separate validation edit.
- Synthetic fixtures and isolated profiles only. Retain profiles, failed checks and rerun evidence.
- The owner must sign the final reviewed staged commit locally; preserve configured SSH signing. Group changes into one reviewable signed delivery rather than requesting a passphrase per task.

## Review Focus

1. A filter hides the selected shot: retain the exact selection and disclose it rather than retargeting edits (Tasks 1–3).
2. The same Character appears in several participant bindings: retain every frozen Outfit and off-camera/unknown state (Tasks 1–2).
3. Preview or failed save interrupts a dirty editor: retain text/target and restore focus without changing stored scenes (Tasks 2–3).
4. An image exists only at shot level or a transition became detached: do not invent take ownership or retarget its pair (Tasks 1–3).
5. Nested tabs, return links, mobile/reflow and explicit Direct Prompt requests: retain navigation/accessibility and legacy authorization behavior (Tasks 3–5).

## File Responsibilities

- `src/domain/continuityWorkspace.ts`: presentation-only view constants, per-shot status and matrix/pair models; no writes.
- `src/components/ProjectContinuityPanel.tsx`: workspace/controller, selected context and existing metadata/media operations.
- `src/components/ContinuityViews.tsx`: compact Overview, Wardrobe matrix, legacy Frames and transition rail/presentation.
- `src/components/ContinuityEditor.tsx`: shared metadata form fields/controls, desktop inspector and mobile shared-dialog composition.
- `src/components/projectContinuity.css`: workspace sizing, inspector, matrix, labels and mobile/reflow.
- `src/domain/collectionNavigation.ts`, `src/screens/CollectionWorkspace.tsx`: Continuity tab/subview and exact return context, compact active heading.
- `AGENTS.md`, `docs/agent-authoring-guide.md`, `README.md`, `docs/local-codex-mcp.md`, `bridge/src/registerTools.ts`: consistent recipe-first guidance, no extra authority.
- Focused unit/bridge/browser tests and `docs/qa/continuity-workspace-a.md`: executable evidence, documented scope/limitations.

## Task 1 — Presentation Model and Route State

**Interfaces:** `CONTINUITY_VIEWS`/`ContinuityView`; `buildContinuityWorkspace(collection, scenes, media)` returns ordered rows, per-participant wardrobe groups, adjacent/detached pairs and real summary counts. `CollectionViewState.continuity?: ContinuityView` serializes as an allowlisted optional query value and survives `collectionSceneRoute` round trips.

- [x] Add failing tests in `src/__tests__/continuityWorkspace.test.ts` for immutable derivation, optional versus missing images, missing selected take, unknown wardrobe, duplicate participant bindings and detached pairs after reorder.
- [x] Extend `src/__tests__/collectionNavigation.test.ts` with valid/invalid Continuity subviews and exact shot/Collection/return state. Assert old routes are unchanged when no Continuity state is supplied.
- [x] Run the focused tests and retain the expected RED output.
- [x] Implement the pure model and route extension using existing `getProjectShots`, `selectedSceneForShot` and `getWardrobeContinuity`; preserve stable IDs and actual storyboard order.
- [x] Rerun both files; require all assertions pass with unchanged input objects.

## Task 2 — Focused Workspace, Inspector and Existing Editors

**Interfaces:** `ProjectContinuityPanel({collection,onChanged,view?,shotId?,onNavigate?,onOpenTake?,onManageTakes?})`; `onNavigate({continuity,shot})` changes UI route only. Pure presentation children receive callbacks, never repository authority. Existing save functions retain their exact payload semantics.

- [x] Add failing workspace component tests for Overview default, subview/shot selection, matrix details, optional/missing records, retained outside-filter selection, explicit metadata saves and unavailable B/C capabilities.
- [x] Preserve existing assertions in `projectContinuityPanel.test.tsx`; change entry/navigation selectors deliberately so each assertion is exercised in its new focused view.
- [x] Build the workspace and split presentation/editor responsibilities. Show only the selected shot/pair's details. Default to read-only summaries; use explicit edit actions. Preserve per-participant frozen text and legacy association labels.
- [x] Reuse existing First/Last upload/choose/clear and transition save/remove functions. Keep one active dialog, exact target IDs, existing revision checks, busy guards and error retention.
- [x] Add dirty close/navigation confirmation and the existing dirty-form/beforeunload guard. Preserve dirty editor state during original-image inspection; Cancel must retain text. Read-only inspection never writes.
- [x] Verify component regressions including rejected save, captured pair after reorder, off-camera participant, missing take and multiple appearances. Check selected records remain deeply equal before explicit save.

## Task 3 — Collection Integration, Layout and Browser Proof

**Interfaces:** existing Collection route plus `tab=continuity&continuity=<view>&shot=<id>`; Open Saved Take uses `collectionSceneRoute` to retain this state. Existing take manager is the only preferred-selection action.

- [x] Capture baseline screenshots from the integrated source in a fresh synthetic profile before replacing the accordion.
- [x] Add `e2e/continuity-workspace.spec.mjs` using the existing synthetic storyboard fixture/proof helpers. First run must fail because the dedicated Continuity tab does not exist.
- [x] Integrate the tab/compact heading, replace the old full accordion with an Open Continuity action, and scope nested-tab keyboard focus selectors. Avoid changing other Collection views.
- [x] Add responsive CSS using existing palette/tokens: compact sequence rail, desktop content/inspector, mobile full-width/shared-dialog editor and wrapping long text. Keep relevant actions reachable at 1440×900, 768×1024, 390×844 and equivalent 200% reflow/DPR2.
- [x] Test keyboard tab navigation/Home/End, focus return, filter selection, refresh/Back/Forward, exact saved-take round trip, dirty edits/failed saves and frame preview. Compare exact scene/output/media proofs before/after reads and only the intended metadata delta after saves.
- [x] Adapt existing storyboard-cleanup entry selectors without deleting or weakening their persistence/media assertions. Capture real before/after synthetic screenshots for Overview, Wardrobe, Frames and Transitions.

## Task 4 — Recipe-First Agent Guidance

**Interfaces:** shared MCP registration still lists exactly 13 tools with identical schemas/annotations. Only descriptive authoring guidance changes; all existing v1–v4 packages remain valid.

- [x] Extend actual compiled SDK tests in `bridge/test/stdio.test.ts` and `bridge/test/adapterProcess.test.ts` to assert recipe-first guidance, explicit Direct Prompt exception and unchanged allowlist/schema versions. Run RED against an isolated production build, preserving live `bridge/dist`.
- [x] Add repository/authoring docs: reuse authorized assets, prefer existing Recipe/Build from Assets operations, propose missing candidates for review, never invent approval/identity or expand permissions, retain incomplete plans and original Direct Prompts.
- [x] Add the shared guidance in `bridge/src/registerTools.ts`, used by both launch paths. Do not add tools, auto-approval or validation changes that reject legacy Direct Prompts.
- [x] Build/test in a new ignored directory and run both actual-process tests. Check guide links and exact tool schemas/annotations. Document that installed portable releases require separately reviewed rebuild/activation.

## Task 5 — Complete Verification and Independent Review

- [x] Run root unit/component suite, root typecheck/build/audit, bridge build/test/typecheck/audit, QA ledger/evidence helper suites and complete browser E2E; retain exact exit codes/counts, warnings, skips and failed attempts.
- [x] Verify backup/export and v1–v4 schema parity through their existing meaningful tests. No new limits/migrations or full-output reassembly are permitted.
- [x] Inspect screenshots and verify their actual paths. Clearly separate product browser results from earlier design-only mockups.
- [x] Update `docs/qa/continuity-workspace-a.md` with affected interfaces, actual evidence, screenshots, risks and B/C boundaries; update user docs for the new Continuity entry and recipe preference.
- [x] Request the independent read-only whole-diff review required by the approved brief. Fix material findings; rerun affected checks.
- [x] Review the exact staged allowlist: source/tests/docs only, no profile, synthetic ZIP/media, signing key/certificate, secrets or temporary QA artifact. Preserve all unrelated local work.

## Task 6 — Signed Delivery

- [ ] Stage the fully verified A change and present the exact signed-commit command to the owner if the local SSH signer requires their terminal.
- [ ] Verify the actual signed commit and clean tree, push only `codex/continuity-workspace-a`, and open a dedicated unmerged PR against the correct integrated base.
- [ ] Verify hosted Linux/Windows CI on the final signed SHA. Do not edit the PR description while checks run because this repository's `edited` trigger restarts CI.
- [ ] Report PR/commit/run links, exact tests/screenshots, remaining risks and the next B design gate. Do not activate a live bridge, merge or touch production-library records.
