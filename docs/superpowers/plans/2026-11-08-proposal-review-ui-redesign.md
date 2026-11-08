# Incoming Proposals UI Redesign (Proposal 1: Inline + Bulk Resolution) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate navigation dead-ends and reference-fixing friction in KRAKINAI's Incoming Proposals review workspace by adding 1-click bulk candidate creation, collapsed root-cause `DEPENDENCY_BLOCKED` grouping, scene-scoped candidate visibility in the right rail, inline candidate resolution controls inside the Scene `Recipe` tab, and an ensemble-aware cast table.

**Architecture:** We extend `src/domain/proposalReadiness.ts` with pure dependency-graph analysis (`analyzeProposalCandidateBlockers`), safeguard-preserving candidate approval helpers (`applyCandidateDecisionWithSafeguards`, `buildBulkCreateApproval`), and scene-to-candidate mapping. We then update `ProposalIssues.tsx`, `ChangeSetPreview.tsx`, and `OutfitReviewDecisions.tsx` so the right rail groups repetitive `DEPENDENCY_BLOCKED` conflicts, surfaces a 1-click bulk approval action, and displays the selected scene's referenced candidates instead of hiding them. Finally, we upgrade `RecipeOperationPreview.tsx`, `ProposalOperationDetail.tsx`, `ProposalReviewWorkspace.tsx`, and `proposalReview.css` to support inline slot/ensemble candidate resolution and show blocking candidates in the `Conflicts` navigator filter.

**Tech Stack:** React 19, TypeScript 5.8, Vitest, Testing Library (`@testing-library/react`, `@testing-library/user-event`), CSS custom properties.

**Spec:** [docs/superpowers/specs/2026-11-08-proposal-review-ui-redesign-design.md](file:///c:/Users/HomePC/dev/krakinai/docs/superpowers/specs/2026-11-08-proposal-review-ui-redesign-design.md)

## Global Constraints

- Never auto-approve candidates without an explicit user action (button click or select change).
- Never write to IndexedDB during preview or candidate decision changes.
- Changing any `assetDecisions` or `variantDecisions` entry via bulk or inline controls must apply the exact same v4 (`conversionDecisions`), v5 (`blocking`, `blockingOutputDecisions`), and v6 (`keyframes`, `frameImages`, `frameVideo`, `frameOutputDecisions`) approval-reset safeguards as `ChangeSetPreview`.
- Candidates with existing duplicate matches (`matches.length > 0`) must not be silently bulk-created without duplicate acknowledgement; `buildBulkCreateApproval` only auto-sets `{ action: 'create' }` on deferred candidates with zero duplicate matches (and valid parent character for Outfit variants).
- Preserve all existing ARIA labels, roles, and test contracts across `proposalReadiness.test.ts`, `proposalReviewWorkspace.test.tsx`, `recipeChangeSetPreview.test.tsx`, `ensemblePreview.test.tsx`, and `recipeConversionPreview.test.tsx`.

## Review Focus

1. **Selecting a Scene Operation Hides Candidate Decisions in the Right Rail:** When `operationId` passed to `ChangeSetPreview` / `OutfitReviewDecisions` is a `scene.*` operation (e.g. `op-scene-s01`), the right rail must display the candidate operations referenced by that scene (`assetRefs`, `variantRefs`, and `ensemble` participants) rather than filtering `o.operationId === "op-scene-s01"` and returning zero candidates.
2. **Candidates with Duplicate Matches During Bulk Create:** Clicking `Create all new candidates (N)` must only set `{ action: 'create' }` on deferred candidates that have `matches.length === 0`, leaving candidates that have duplicate matches in `defer` so `DUPLICATE_ASSET` is not triggered unintentionally.
3. **v5/v6 Approval Reset Safeguard on Bulk or Inline Candidate Decision Change:** Changing a candidate decision via the bulk button or inline Recipe tab controls on a v5 or v6 package must reset `blocking`, `blockingOutputDecisions`, `keyframes`, `frameImages`, `frameVideo`, and `frameOutputDecisions` on the `ChangeSetApproval` object.
4. **Ensemble Scene False "Unassigned" & Blocked Participant Visibility:** When a `scene.create_recipe` operation uses `ensemble` and its assembly is blocked by deferred character/wardrobe candidates (`resolved.ensemble === undefined`), the `Recipe` tab must show `Managed by Ensemble Cast` in the `character`/`wardrobe` slot rows and render the participant candidate bindings with inline `Approve Create` controls instead of only a collapsed raw JSON block.
5. **Navigator `Conflicts` Filter Hiding Blocking Candidates:** Clicking the `Conflicts` filter button in `Changes navigator` must include deferred `asset.propose` / `variant.propose` operations that actively block one or more scenes (`isBlocking === true`), while still hiding unrelated non-conflicting operations.

---

### Task 1: Candidate Dependency & Bulk Resolution Domain Engine

**Files:**
- Modify: `src/domain/proposalReadiness.ts`
- Test: `src/__tests__/proposalReadiness.test.ts`

**Interfaces:**
- Consumes: `ChangeSet`, `ChangeSetApproval`, `ChangeSetPreview`, `CandidateDecision`, `OutfitCandidateDecision` from `src/types/changeSet.ts`; `LibrarySnapshot` from `src/storage/db.ts`
- Produces in `src/domain/proposalReadiness.ts`:
  ```ts
  export interface CandidateBlockerItem {
    operationId: string;
    clientRef?: string;
    kind: 'asset' | 'variant';
    candidateKind: string;
    title: string;
    promptText: string;
    decision: CandidateDecision | OutfitCandidateDecision;
    matchesCount: number;
    dependentSceneIds: string[];
    isBlocking: boolean;
    canBulkCreate: boolean;
  }
  export interface CandidateDependencyAnalysis {
    candidates: CandidateBlockerItem[];
    blockingCandidates: CandidateBlockerItem[];
    bulkCreatableCandidates: CandidateBlockerItem[];
    byClientRef: Record<string, CandidateBlockerItem>;
    byOperationId: Record<string, CandidateBlockerItem>;
    referencedCandidateOpIdsByScene: Record<string, string[]>;
  }
  export function analyzeProposalCandidateBlockers(
    preview?: ChangeSetPreview,
    snapshot?: Pick<LibrarySnapshot, 'assets' | 'preferences'>,
  ): CandidateDependencyAnalysis;
  export function applyCandidateDecisionWithSafeguards(
    changeSet: ChangeSet,
    currentApproval: ChangeSetApproval,
    nextAssetDecisions: ChangeSetApproval['assetDecisions'],
    nextVariantDecisions?: ChangeSetApproval['variantDecisions'],
  ): ChangeSetApproval;
  export function buildBulkCreateApproval(
    preview: ChangeSetPreview,
    snapshot?: Pick<LibrarySnapshot, 'assets' | 'preferences'>,
    targetOperationIds?: string[],
  ): ChangeSetApproval;
  ```

- [ ] **Step 1: Write the failing unit tests in `src/__tests__/proposalReadiness.test.ts`**

Add tests covering:
1. `analyzeProposalCandidateBlockers` maps `assetRefs` and `ensemble.participantUpserts` (`character.asset.ref`, `wardrobe.asset.ref`, `wardrobe.variant.ref`) from `scene.*` operations back to `asset.propose` and `variant.propose` operations, marking deferred candidates with dependent scenes as `isBlocking: true` and `canBulkCreate: true` when `matchesCount === 0`.
2. `buildBulkCreateApproval` sets `{ action: 'create' }` only on `canBulkCreate` candidates (skipping candidates with `matchesCount > 0`) and resets v5/v6/conversion downstream flags via `applyCandidateDecisionWithSafeguards`.

- [ ] **Step 2: Run the test suite to verify it fails**

Run: `npx.cmd vitest run src/__tests__/proposalReadiness.test.ts`
Expected: FAIL with missing exports `analyzeProposalCandidateBlockers`, `applyCandidateDecisionWithSafeguards`, `buildBulkCreateApproval`.

- [ ] **Step 3: Implement `analyzeProposalCandidateBlockers`, `applyCandidateDecisionWithSafeguards`, and `buildBulkCreateApproval` in `src/domain/proposalReadiness.ts`**

Inspect `preview.changeSet.operations` for `asset.propose`, `asset.review_candidate`, `variant.propose`, and `variant.review_candidate`. Collect all `ref` targets from every `scene.*` operation (`op.assetRefs`, `op.variantRefs`, and `op.ensemble.participantUpserts` character/wardrobe refs) to populate `dependentSceneIds` and `referencedCandidateOpIdsByScene`. Check `plan.operations` for `matches.length` on each candidate operation. Implement `applyCandidateDecisionWithSafeguards` using `canonicalStringify` identically to `ChangeSetPreview.tsx:41-45`.

- [ ] **Step 4: Run the test suite to verify it passes**

Run: `npx.cmd vitest run src/__tests__/proposalReadiness.test.ts`
Expected: PASS (all existing + new tests green).

- [ ] **Step 5: Commit Task 1**

```bash
git -c commit.gpgsign=false add src/domain/proposalReadiness.ts src/__tests__/proposalReadiness.test.ts
git -c commit.gpgsign=false commit -m "feat(domain): add candidate dependency analysis and bulk approval helpers"
```

---

### Task 2: Right Rail Bulk Action, Grouped `DEPENDENCY_BLOCKED` Card & Scene-Scoped Candidate Decisions

**Files:**
- Modify: `src/components/aiConnections/ProposalIssues.tsx`
- Modify: `src/components/ChangeSetPreview.tsx`
- Modify: `src/components/OutfitReviewDecisions.tsx`
- Test: `src/__tests__/proposalReviewWorkspace.test.tsx`

**Interfaces:**
- Consumes: `analyzeProposalCandidateBlockers`, `buildBulkCreateApproval`, `applyCandidateDecisionWithSafeguards`, `CandidateDependencyAnalysis` from `src/domain/proposalReadiness.ts`
- Updates props:
  - `ProposalIssues`:
    ```ts
    export function ProposalIssues({
      readiness,
      onGoTo,
      candidateAnalysis,
      disabled,
      onBulkCreateCandidates,
    }: {
      readiness: ProposalReadiness;
      onGoTo(issue: ProposalReviewIssue): void;
      candidateAnalysis?: CandidateDependencyAnalysis;
      disabled?: boolean;
      onBulkCreateCandidates?(): void;
    })
    ```

- [ ] **Step 1: Write the failing component tests in `src/__tests__/proposalReviewWorkspace.test.tsx`**

Add tests to `src/__tests__/proposalReviewWorkspace.test.tsx` verifying:
1. When multiple scenes are blocked by `DEPENDENCY_BLOCKED` due to deferred candidates (`char-silvester`, `env-sacred-hall`), `ProposalIssues` renders a single grouped `DEPENDENCY_BLOCKED` summary card (with an expandable `<details>` list containing the individual `Go to <operationId> →` buttons) and a `Create all new candidates (2)` button that calls `onApproval` with both candidates set to `{ action: 'create' }`.
2. Selecting a scene operation (`op-scene-s01`) in `ProposalReviewWorkspace` keeps the candidate decision controls (`Decision for op-char-silvester`, `Decision for op-env-sacred-hall`) visible in the right rail (`Ready to apply?`) instead of hiding them.

- [ ] **Step 2: Run the test suite to verify it fails**

Run: `npx.cmd vitest run src/__tests__/proposalReviewWorkspace.test.tsx`
Expected: FAIL (`Create all new candidates` button not found and `Decision for ...` hidden when scene is selected).

- [ ] **Step 3: Implement grouped `DEPENDENCY_BLOCKED` display, bulk create button, and scene-scoped candidate filtering**

1. In `src/components/aiConnections/ProposalIssues.tsx`:
   - Render a `.pr-bulk-card` section at the top when `candidateAnalysis && candidateAnalysis.bulkCreatableCandidates.length > 0 && onBulkCreateCandidates`, with button `Create all new candidates (${candidateAnalysis.bulkCreatableCandidates.length})`.
   - Split `readiness.conflicts` into `dependencyConflicts` (`code === 'DEPENDENCY_BLOCKED'`) and `otherConflicts` (`code !== 'DEPENDENCY_BLOCKED'`).
   - Render `otherConflicts` as individual `<article>` items exactly as before.
   - If `dependencyConflicts.length === 1`, render it as a standard `<article>` item.
   - If `dependencyConflicts.length > 1`, render a single `<article className="pr-issue pr-issue-conflict pr-issue-grouped">` showing `DEPENDENCY_BLOCKED · ${dependencyConflicts.length} scenes blocked`, the list of blocking candidate refs/titles from `candidateAnalysis?.blockingCandidates`, the primary `Go to ${dependencyConflicts[0].target.operationId ?? 'Batch'} →` button, and a `<details><summary>View all ${dependencyConflicts.length} blocked scenes</summary>...</details>` containing the remaining `Go to ... →` buttons with their exact `aria-label` attributes preserved.
2. In `src/components/ChangeSetPreview.tsx` and `src/components/OutfitReviewDecisions.tsx`:
   - Use `analyzeProposalCandidateBlockers(preview, snapshot)` to determine which candidate operations match `operationId`:
     - If `!operationId`: include all candidate operations in the batch.
     - If `operationId` is itself an `asset.*` or `variant.*` operation: include only `o.operationId === operationId`.
     - If `operationId` is a `scene.*` operation: include all candidates in `analysis.referencedCandidateOpIdsByScene[operationId]` (or all batch candidates if the scene references none).
   - Auto-open `<details className="import-group" open={...}>` for `Reusable asset decisions` / `Outfit variant decisions` when `approvalsOnly` is true and any listed candidate is currently `defer`.
   - Use `applyCandidateDecisionWithSafeguards` in `ChangeSetPreview.tsx`.

- [ ] **Step 4: Run the test suite to verify it passes**

Run: `npx.cmd vitest run src/__tests__/proposalReviewWorkspace.test.tsx src/__tests__/recipeChangeSetPreview.test.tsx src/__tests__/ensemblePreview.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git -c commit.gpgsign=false add src/components/aiConnections/ProposalIssues.tsx src/components/ChangeSetPreview.tsx src/components/OutfitReviewDecisions.tsx src/__tests__/proposalReviewWorkspace.test.tsx
git -c commit.gpgsign=false commit -m "feat(ui): group dependency conflicts and expose bulk/scene-scoped candidate decisions"
```

---

### Task 3: Center Panel (`Recipe` Tab) Inline Candidate Resolution, Ensemble Cast Table & Navigator `Conflicts` Filter

**Files:**
- Modify: `src/components/RecipeOperationPreview.tsx`
- Modify: `src/components/aiConnections/ProposalOperationDetail.tsx`
- Modify: `src/components/aiConnections/ProposalReviewWorkspace.tsx`
- Modify: `src/components/aiConnections/proposalReview.css`
- Test: `src/__tests__/proposalReviewWorkspace.test.tsx`

**Interfaces:**
- Consumes: `analyzeProposalCandidateBlockers`, `applyCandidateDecisionWithSafeguards`, `buildBulkCreateApproval` from `src/domain/proposalReadiness.ts`
- Updates props on `RecipeOperationPreview`:
  ```ts
  export function RecipeOperationPreview({
    row,
    changeSet,
    approval,
    findings,
    view = 'all',
    snapshot,
    disabled = false,
    onApproval,
    onSelectOperation,
  }: {
    row: ImportOperationPreview;
    changeSet: ChangeSet;
    approval: ChangeSetApproval;
    findings: ImportFinding[];
    view?: 'all' | 'components' | 'outputs';
    snapshot?: LibrarySnapshot;
    disabled?: boolean;
    onApproval?: (value: ChangeSetApproval) => void;
    onSelectOperation?: (operationId: string) => void;
  })
  ```

- [ ] **Step 1: Write the failing integration tests in `src/__tests__/proposalReviewWorkspace.test.tsx`**

Add tests to `src/__tests__/proposalReviewWorkspace.test.tsx` verifying:
1. Opening the `Recipe` tab on a scene that has `ensemble` and unresolved `ref:` bindings (`char-silvester`, `ward-silvester-linen`, `env-sacred-hall`):
   - Shows `Managed by Ensemble Cast` instead of `Unassigned` for `Character Identity` and `Clothing & Accessories` rows in `Resolved recipe components`.
   - Renders the `Ensemble candidate bindings` region showing each participant (`silvester`) and inline `Approve Create` buttons for `char-silvester`, `ward-silvester-linen`, and `env-sacred-hall`.
   - Clicking `Approve Create` (or `Approve scene candidates`) updates `onApproval` with `{ action: 'create' }` for those candidates.
2. Clicking the `Conflicts` filter button in `Changes navigator` keeps blocking `asset.propose` operations visible under `Reusable candidates` with a `Blocks N scene(s)` badge while hiding non-conflicting operations.

- [ ] **Step 2: Run the test suite to verify it fails**

Run: `npx.cmd vitest run src/__tests__/proposalReviewWorkspace.test.tsx`
Expected: FAIL (`Managed by Ensemble Cast`, `Ensemble candidate bindings`, and blocking candidate in `Conflicts` filter not yet implemented).

- [ ] **Step 3: Implement inline candidate resolution in `RecipeOperationPreview.tsx`, wire props in `ProposalOperationDetail.tsx` and `ProposalReviewWorkspace.tsx`, and update `proposalReview.css`**

1. In `src/components/RecipeOperationPreview.tsx`:
   - When `operation` has unresolved candidate references and `onApproval` is provided, render a `.pr-scene-dependency-banner` at the top with `Approve scene candidates (N)` when bulk-creatable candidates exist for this scene.
   - In `Resolved recipe components`:
     - When `(slot === 'character' || slot === 'wardrobe') && !component && !requested && !variant && operation.ensemble`: render `Managed by Ensemble Cast (${operation.ensemble.participantUpserts?.length ?? resolved?.ensemble?.participants.length ?? 0} participant(s))` in the source cell and `Ensemble active` in the status cell.
     - When `requested && 'ref' in requested.asset`: look up the producer candidate operation by `clientRef === requested.asset.ref`. Display its title, `ref:${requested.asset.ref}`, and when `onApproval` is provided, render an inline `Approve Create` button (when currently `defer` and `matchesCount === 0`) and an inline `<select aria-label={`Inline decision for ${producer.operationId}`}>` (`defer` / `create` / `reuse`) that updates `onApproval` via `applyCandidateDecisionWithSafeguards`.
   - When `operation.ensemble?.participantUpserts?.length` is present and (`!resolved?.ensemble` || `onApproval` is provided):
     - Render `<section className="pr-ensemble-candidates" aria-label="Ensemble candidate bindings">` listing each participant (`p.id`, `p.role`, `p.presence`), their character target, and their wardrobe target, with inline `Approve Create` buttons and decision `<select>` controls for any candidate `ref`.
2. In `src/components/aiConnections/ProposalOperationDetail.tsx`:
   - Pass `snapshot={snapshot}`, `disabled={disabled}`, `onApproval={onApproval}`, and `onSelectOperation` through to `RecipeOperationPreview`.
3. In `src/components/aiConnections/ProposalReviewWorkspace.tsx`:
   - Compute `candidateAnalysis = analyzeProposalCandidateBlockers(preview, snapshot)`.
   - Pass `candidateAnalysis`, `disabled`, and `onBulkCreateCandidates={() => preview && props.onApproval(buildBulkCreateApproval(preview, snapshot))}` to `<ProposalIssues />`.
   - In `matches(row)`: when `filter === 'conflicts'`, match if `issues.some(i => i.kind === 'conflict') || candidateAnalysis.byOperationId[row.operationId]?.isBlocking === true`.
   - In the left navigator `.pr-operation` item status span: if `candidateAnalysis.byOperationId[row.operationId]` exists, display `Blocks ${c.dependentSceneIds.length} scene(s)` when `c.isBlocking`, `Will create` when `c.decision.action === 'create'`, `Will reuse` when `c.decision.action === 'reuse'`, or `Deferred` when `c.decision.action === 'defer'`.
4. In `src/components/aiConnections/proposalReview.css`:
   - Widen `.pr-columns` desktop layout to `240px minmax(0,1fr) 320px`.
   - Style `.pr-bulk-card`, `.pr-issue-grouped`, `.pr-scene-dependency-banner`, `.pr-inline-candidate-controls`, and `.pr-ensemble-candidates`.

- [ ] **Step 4: Run the full verification suite**

Run:
```bash
npx.cmd vitest run src/__tests__/proposalReadiness.test.ts src/__tests__/proposalReviewWorkspace.test.tsx src/__tests__/recipeChangeSetPreview.test.tsx src/__tests__/ensemblePreview.test.tsx src/__tests__/recipeConversionPreview.test.tsx src/__tests__/changeSetWorkspace.test.tsx
npm.cmd run typecheck
npm.cmd run build
```
Expected: All tests PASS, `tsc --noEmit` exits `0`, `vite build` exits `0`.

- [ ] **Step 5: Commit Task 3**

```bash
git -c commit.gpgsign=false add src/components/RecipeOperationPreview.tsx src/components/aiConnections/ProposalOperationDetail.tsx src/components/aiConnections/ProposalReviewWorkspace.tsx src/components/aiConnections/proposalReview.css src/__tests__/proposalReviewWorkspace.test.tsx docs/superpowers/specs/2026-11-08-proposal-review-ui-redesign-design.md docs/superpowers/plans/2026-11-08-proposal-review-ui-redesign.md
git -c commit.gpgsign=false commit -m "feat(ui): add inline recipe candidate resolution, ensemble cast table, and conflict-aware navigator"
```
