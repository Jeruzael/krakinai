# KRAKINAI Incoming Proposals UI Redesign (Proposal 1: Context-Aware Inline + Bulk Resolution)

**Date:** 2026-11-08
**Status:** Approved for Implementation Planning

---

## 1. Problem Statement & Root Causes

When reviewing a multi-shot storyboard proposal (e.g., 35 scenes + 8–10 proposed reusable assets) in **AI Connections → Incoming Proposals**, four UX bottlenecks make navigation and reference resolution frustrating:

1. **The "Go to Scene" Dead-End Bug:**
   - Proposed candidates (`asset.propose`, `variant.propose`) default to `action: "defer"`.
   - Every scene referencing a deferred candidate fails with `DEPENDENCY_BLOCKED`.
   - Clicking `Go to op-scene-s17 →` selects `op-scene-s17` and passes `operationId="op-scene-s17"` into `<ChangeSetPreview approvalsOnly operationId={selectedRow?.operationId} />`.
   - `ChangeSetPreview` filters `assetOps` by `o.type.startsWith("asset.") && o.operationId === "op-scene-s17"`, which returns `[]` — hiding all candidate decision controls whenever a scene is selected.
2. **The "Conflicts" Filter Hides Blocking Candidates:**
   - Filtering the left navigator by `Conflicts` only matches operations with a `conflict` finding attached to their own `operationId`. Because `DEPENDENCY_BLOCKED` is attached to the downstream scenes rather than the deferred candidates, filtering by `Conflicts` hides the `Reusable candidates` section completely.
3. **35 Repetitive `DEPENDENCY_BLOCKED` Cards Flood the Right Rail:**
   - `ProposalIssues` renders 35 separate yellow conflict cards at the top of the `255px` right rail, pushing global approval checkboxes (`Approve storyboard changes`, `Approve new immutable scenes`, `I reviewed this exact proposal`) far below the scroll fold.
   - There is no bulk action to approve all non-conflicting new candidates at once.
4. **Misleading "Unassigned" Slots & Raw JSON for Ensemble Scenes:**
   - When a v3 recipe uses `ensemble`, `RecipeOperationPreview` still displays `Character Identity: Unassigned / Not selected` and `Clothing & Accessories: Unassigned / Not selected` in the main component table.
   - When assembly is blocked by deferred candidates, `resolved.ensemble` is `undefined`, so `RecipeOperationPreview` hides the structured participant summary and dumps raw JSON inside `<details><summary>Unresolved participant and cue requests</summary>`.
   - Unresolved slot references (`ref:env-sacred-hall · unresolved`) are static text with no inline controls to approve or reuse the candidate.

---

## 2. Design Architecture (Approach A / Proposal 1)

### 2.1 Candidate Dependency & Bulk Resolution Engine (`src/domain/proposalReadiness.ts`)
- Add `analyzeProposalCandidateBlockers(preview?: ChangeSetPreview, snapshot?: LibrarySnapshot): CandidateDependencyAnalysis` to compute:
  - Every `asset.propose`, `asset.review_candidate`, `variant.propose`, and `variant.review_candidate` operation in the package.
  - Which `scene.*` operations depend on each candidate via `assetRefs`, `variantRefs`, or `ensemble.participantUpserts` (`character.asset.ref`, `wardrobe.asset.ref`, `wardrobe.variant.ref`).
  - `isBlocking`: whether the candidate is currently `defer` and referenced by at least one scene.
  - `canBulkCreate`: whether the candidate is currently `defer`, has `0` duplicate matches in `plan.operations`, and (for Outfit variants) has an available parent character in `snapshot.assets` or approved in the batch.
- Add `applyCandidateDecisionWithSafeguards(changeSet: ChangeSet, currentApproval: ChangeSetApproval, nextAssetDecisions: ChangeSetApproval['assetDecisions'], nextVariantDecisions?: ChangeSetApproval['variantDecisions']): ChangeSetApproval` so inline, bulk, and rail decisions all apply the exact same v4/v5/v6 approval-reset safeguards.
- Add `buildBulkCreateApproval(preview: ChangeSetPreview, snapshot?: LibrarySnapshot, targetOperationIds?: string[]): ChangeSetApproval` to approve all (or scene-scoped) bulk-creatable candidates as `{ action: 'create' }` in one atomic state update.

### 2.2 Right Rail: Fast-Track Bulk Resolution & Grouped `DEPENDENCY_BLOCKED` Card (`src/components/aiConnections/ProposalIssues.tsx` & `src/components/ChangeSetPreview.tsx`)
- **Fast-Track Bulk Resolution Card:**
  - When `analysis.bulkCreatableCandidates.length > 0`, render a prominent card at the top of `ProposalIssues` showing how many deferred candidates are blocking scenes and a 1-click button: **`Create all new candidates (N)`**.
- **Grouped `DEPENDENCY_BLOCKED` Conflict Card:**
  - Separate `DEPENDENCY_BLOCKED` conflicts from other data conflicts (`PROJECT_VALIDATION`, `SOURCE_MISSING`, etc.).
  - Non-dependency conflicts render individually exactly as before.
  - When multiple `DEPENDENCY_BLOCKED` conflicts exist, render a single summary card (`DEPENDENCY_BLOCKED · N scenes blocked`) listing the blocking candidate references, a primary jump button for the first blocked scene, and a collapsible `<details><summary>View all N blocked scenes</summary>` containing the remaining `Go to <operationId> →` buttons.
- **Context-Aware Candidate Decisions in `ChangeSetPreview` & `OutfitReviewDecisions`:**
  - When `operationId` is a `scene.*` operation, filter `assetOps` and `OutfitReviewDecisions` to the candidates referenced by that scene (or all batch candidates if the scene references none), rather than returning an empty array.

### 2.3 Center Panel (`Recipe` Tab): Inline Candidate Controls & Ensemble Cast Table (`src/components/RecipeOperationPreview.tsx`)
- **Scene Dependency Banner:**
  - When a selected scene references deferred candidates, display a top callout banner in the `Recipe` tab listing the unresolved candidates with a 1-click **`Approve scene candidates (N)`** button.
- **Inline Slot Candidate Controls:**
  - For any slot (`environment`, `style`, `action`, `camera`, `lighting`, etc.) bound to a `ref:<clientRef>` candidate, show the candidate's title, its current decision badge (`Deferred`, `Will create`, `Will reuse`), an inline **`Approve Create`** button (when `defer`), and an inline decision `<select>` (`Keep as pending proposal`, `Create new unreviewed library asset`, `Reuse an existing asset`).
- **Ensemble-Aware Slots & Participant Table:**
  - When `operation.ensemble` is active and single-character `character`/`wardrobe` slots are unused, display **`Managed by Ensemble Cast (N participant(s))`** and status **`Ensemble active`** instead of `"Unassigned"` / `"Not selected"`.
  - Render a structured **Ensemble Cast & Candidate Bindings** table showing each participant's character and wardrobe references alongside inline **`Approve Create`** / decision `<select>` controls even when full prompt assembly is blocked by deferred candidates.

### 2.4 Left Navigator & Layout Proportions (`src/components/aiConnections/ProposalReviewWorkspace.tsx` & `proposalReview.css`)
- **Include Blocking Candidates in `Conflicts` Filter:**
  - When `filter === 'conflicts'`, include any candidate where `isBlocking === true` so the root-cause candidates appear at the top of the `Conflicts` list under `Reusable candidates`.
- **Actionable Candidate Status Badges:**
  - Badge candidate items in the navigator with `Blocks N scene(s)` (when blocking), `Will create`, `Will reuse`, or `Deferred`.
- **Balanced 3-Column Grid:**
  - Widen desktop `.pr-columns` from `195px minmax(0,1fr) 255px` to `240px minmax(0,1fr) 320px`.

---

## 3. Compatibility & Safeguard Invariants
- Never auto-approve candidates without an explicit user click.
- Never write to IndexedDB during preview or candidate decision changes.
- Preserve all existing ARIA labels, roles, keyboard navigation (`ArrowLeft`/`ArrowRight`/`Home`/`End`), and test contracts in `proposalReviewWorkspace.test.tsx`, `proposalReadiness.test.ts`, `recipeChangeSetPreview.test.tsx`, `ensemblePreview.test.tsx`, and `recipeConversionPreview.test.tsx`.
