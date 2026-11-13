# Bulk Style Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply one library Style asset to selected storyboard shots by creating new preferred Recipe takes while preserving every original take.

**Architecture:** Add a pure domain planner/builder that classifies selected shots and constructs immutable style-only Recipe takes. Add a storage operation that revalidates and commits all eligible takes plus preferred-shot references in one IndexedDB transaction. Add a shared Style selector, preview summary, and explicit confirmation to the existing project bulk-actions panel.

**Tech Stack:** React, TypeScript, IndexedDB, existing prompt assembler, Vitest/Testing Library already present (no tests will be added or run under the current session instruction).

**Spec:** `docs/superpowers/specs/2026-11-13-bulk-style-selection-design.md`

## Global Constraints

- Never mutate or replace an existing saved scene or its media.
- Use the selected shot's current preferred saved Recipe as the source; never guess among takes or fabricate missing recipe inputs.
- Preserve all non-Style recipe data and regenerate prompt outputs from the stored recipe snapshots plus the selected Style snapshot.
- Do not convert Direct Prompts or bypass review decisions for Blocking, ensemble, keyframe, image-prompt, or manual-output authored scenes.
- Revalidate project revision, selected shot/take relationships, and the selected Style asset before writing.
- All eligible new takes and preferred-take changes must commit atomically; a write failure must leave the project and saved scenes unchanged.
- Do not add or run tests unless the user asks; use typecheck and diff checks for this implementation.

## Review Focus

- A stale project revision or changed preferred take must abort the complete write.
- A missing, wrong-category, or changed Style asset must abort the complete write.
- Shots with no preferred take, Direct Prompts, advanced authored scene data, or the same Style revision must be classified without silently changing anything.
- Prompt assembly failure for any eligible shot must abort the complete write.
- A large selection must report changed, unchanged, and skipped counts without hiding why shots were skipped.

---

### Task 1: Domain classification and immutable take builder

**Files:**
- Create: `src/domain/projectStyleBatch.ts`
- Modify: none

**Interfaces:**
- Produces `classifyProjectStyleBatch(collection: Collection, scenes: SavedScene[], shotIds: string[], styleAsset: PromptAsset): ProjectStyleBatchClassification`.
- Produces `buildProjectStyleTake(source: SavedScene, styleAsset: PromptAsset, options: { id: string; now: string; inheritedAvoidPrefix: string }): SavedScene`.
- Classification contains changed shot/source pairs, unchanged shot IDs, and skipped shot IDs with one of `missing_preferred`, `direct_prompt`, or `requires_review`.

- [x] Implement classification using `getProjectShots` and `selectedSceneForShot`; require a selected scene ID that is still linked as a take.
- [x] Mark direct prompts and scenes with Blocking, ensemble, keyframe plan, image prompt snapshots, manual image outputs, or nonempty manual output overrides as `requires_review`.
- [x] Treat an already matching Style `sourceId` and `sourceRevision` as unchanged; allow an absent Style slot to receive the selected Style.
- [x] Build a new Recipe take by replacing only `slots.style`, assembling outputs with `assembleScenePrompt`, preserving source recipe inputs, clearing result media/review notes, and setting the new take unreviewed with the source take retained as its lineage. Use the source's captured inherited avoid prefix so old Style avoid text is not carried into the new take.
- [x] If assembly is invalid, throw the assembler's actionable validation messages rather than producing an incomplete take.

### Task 2: Atomic project style application

**Files:**
- Modify: `src/storage/projectBulk.ts`
- Consume: `classifyProjectStyleBatch`, `buildProjectStyleTake` from Task 1

**Interface:**
- Produces `bulkApplyProjectStyle({ collectionId, shotIds, styleAssetId, expectedStyleRevision, expectedProjectRevision }: { collectionId: string; shotIds: string[]; styleAssetId: string; expectedStyleRevision: number; expectedProjectRevision: number }): Promise<ProjectStyleApplyResult>`.
- `ProjectStyleApplyResult` includes the updated `collection`, created scene IDs, and the final changed/unchanged/skipped classification.

- [x] Open one read-write IndexedDB transaction for `collections`, `scenes`, and `assets`; read the current project, all saved scenes, and the selected Style asset.
- [x] Require exact project and Style asset revisions, and a current Style asset in category `styles`; rerun classification against stored records.
- [x] Create one unique style-only take per changed shot, append it to `takeSceneIds`, and set only that shot's `selectedSceneId` to the new take.
- [x] Increment project revision once, rebuild scene membership, validate the resulting project with the complete scene list, then write all new scenes and the updated collection in the same transaction.
- [x] Abort the transaction on any stale target, assembly, validation, quota, or storage error; return the updated project and classification only after commit.

### Task 3: Shared Style picker and review confirmation

**Files:**
- Modify: `src/components/ProjectBulkActions.tsx`
- Modify: `src/components/projectBulkActions.css`
- Consume: domain classification from Task 1 and storage operation from Task 2

- [x] Add one Style asset selector sourced from `snapshot.assets` where `category === 'styles'`, plus an **Apply Style** action in the selected-shot panel.
- [x] Show a pre-apply summary of changed, already-current, and skipped shots, with skipped reasons.
- [x] Add a confirmation dialog stating that new takes will become preferred, existing takes remain available, and no image/video media is generated.
- [x] On confirmation call `bulkApplyProjectStyle` with the selected Style asset ID/revision and `collection.project?.revision ?? 0`; on success refresh the project, clear selection, and show a summary toast. On failure preserve selection and show the error.
- [x] Disable the action when no Style asset is selected, selection is empty, or an apply is in progress; keep the controls usable on narrow screens.

### Task 4: User guide and static verification

**Files:**
- Modify: `docs/manual/05-user-guide-projects-and-continuity.md`
- Review: all files changed in Tasks 1–3

- [x] Document the shared Style action, the creation of preferred alternate takes, eligibility skips, and the fact that media is not generated.
- [x] Run `npm run typecheck` and `git diff --check`.
- [x] Review the final diff against the design's acceptance criteria and confirm only the selected Style slot changes in each generated Recipe take.

