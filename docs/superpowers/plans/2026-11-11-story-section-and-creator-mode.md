# Story Section & Creator Mode (MCP Workstream 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the **Stories** section (`#/stories` and `#/stories/:id`) with Book Mode, Creator Mode (`Act -> Sequence -> Scene -> Beat`), Reference Packs, Color Scripts, and 7 MCP Workstream 6 tools governed by `krakinai.change-set.v7` and human-in-the-loop review.

**Architecture:** Persist stories in a dedicated companion IndexedDB (`krakinai_stories_db`) hydrated into `LibrarySnapshot.stories` and `ChangeSetState.stories` to preserve `krakinai_prompt_library_db` v4 8-store compatibility. Extend ChangeSet planning/validation to `krakinai.change-set.v7` with canonical ordering (`Assets -> Stories -> Projects -> Shots -> Scenes`), optimistic concurrency (`expectedRevision` + `expectedStoryDigest`), and `McpScope` controls (`storyIds`, `includeStoryText`, `allowStoryProposals`).

**Tech Stack:** TypeScript, React 18, IndexedDB (`fake-indexeddb` in Vitest), `@modelcontextprotocol/server`, Lucide React.

**Spec:** `docs/superpowers/specs/2026-11-11-story-section-and-creator-mode-design.md`

## Global Constraints

- Preserve `DB_VERSION = 4` and the 8 store names in `src/storage/libraryCompatibility.ts` so `compactLibraryCompatibility.test.ts` remains 100% unmodified and passing.
- Total MCP tool count in `MCP_TOOL_NAMES` becomes **45** (38 existing + 7 Story tools), and total `tools/list` schema discovery payload must stay strictly `< 1,310,720` bytes (`MCP_LIMITS.frame`).
- Every MCP story write must stage into `krakinai_review_inbox_db` as `'krakinai.change-set.v7'`, reset prior approvals on draft mutation, and require an explicit human click (`event.isTrusted`) to commit.
- Legacy `permissionFingerprint(scope)` must remain identical when `storyIds` is empty and `includeStoryText` / `allowStoryProposals` are `false`.
- Always commit with `git commit --no-gpg-sign`.

## Review Focus

1. **Stale Story Digest / Revision Overwrite:** Staging or applying a `story.update`, `story.patch_structure`, or `story.patch_dramatic_meta` with a mismatched `expectedRevision` or `expectedStoryDigest` must reject with `McpError('CONFLICT')` or a blocking `CONFLICT` plan finding.
2. **Unauthorized Prose Redaction (`includeStoryText: false`):** Calling `krakinai_get_story` or `krakinai_list_stories` when `storyIds` includes the story but `includeStoryText` is `false` must return story and hierarchy node titles while redacting `logline`, `premise`, `synopsis`, `treatment`, `fullBookText`, beat `content`, and `dramaticMeta`.
3. **Hard Delete Guard on Linked Storyboard Project:** Calling `deleteStory(id)` when `story.linkedCollectionId` points to an existing collection must throw a clear error until unlinked; AI agents cannot hard-delete stories.
4. **Same-Batch ClientRef Resolution (`story.create` + `story.patch_structure`):** Staging `krakinai_stage_story` (with `clientRef: "story-1"`) followed by `krakinai_stage_story_structure` (targeting `{ ref: "story-1" }`) in the same `changeSetId` must plan and apply cleanly in canonical order (`Assets -> Stories -> Projects`).
5. **Legacy Scope Fingerprint Compatibility:** Calling `permissionFingerprint(emptyMcpScope())` and `validateMcpScope` on legacy v1/v2/v3 scopes must pass existing `blockingPermissionDraft.test.ts` and `keyframeMcpCapabilities.test.ts` without regression.

---

## Task 1: Story Domain Types, Digest Validator & IndexedDB Storage (`src/storage/stories.ts`)

**Files:**
- Modify: `src/types/domain.ts`
- Modify: `src/types/changeSet.ts`
- Modify: `src/types/mcp.ts`
- Modify: `src/types/aiContext.ts`
- Create: `src/domain/storyValidator.ts`
- Create: `src/storage/stories.ts`
- Modify: `src/storage/db.ts`
- Modify: `src/storage/backup.ts`
- Create: `src/__tests__/storyStorageAndValidation.test.ts`

- [ ] **Step 1: Write failing test in `src/__tests__/storyStorageAndValidation.test.ts`** testing Story CRUD, `computeStoryDigest`, favorite/archive toggles, linked-project delete guard, and `getAllSnapshot()` hydration.
- [ ] **Step 2: Run test to verify failure:** `npx vitest run src/__tests__/storyStorageAndValidation.test.ts`
- [ ] **Step 3: Implement types, `src/domain/storyValidator.ts`, `src/storage/stories.ts`, and `src/storage/db.ts` / `backup.ts` wiring.**
- [ ] **Step 4: Run tests to verify pass:** `npx vitest run src/__tests__/storyStorageAndValidation.test.ts src/__tests__/compactLibraryCompatibility.test.ts`
- [ ] **Step 5: Commit:** `git commit --no-gpg-sign -m "feat(stories): add Story domain types, validator, and IndexedDB storage"`

---

## Task 2: Change-Set v7 Validation, Planner, Atomic Apply & Scope Governance

**Files:**
- Modify: `src/domain/changeSetSchema.ts`
- Modify: `src/domain/changeSetValidation.ts`
- Modify: `src/domain/changeSetPlanner.ts`
- Modify: `src/storage/changeSets.ts`
- Modify: `src/domain/mcpScope.ts`
- Modify: `src/domain/mcpPermissionDraft.ts`
- Modify: `src/__tests__/storyStorageAndValidation.test.ts`

- [ ] **Step 1: Write failing tests** for `parseChangeSet` (`krakinai.change-set.v7`), `planChangeSet` (`story.create`, `story.update`, `story.set_status`, `story.patch_structure`, `story.patch_dramatic_meta`, `story.patch_references`), `expectedStoryDigest` conflict detection, `applyApprovedChangeSet` atomic commit, and `McpScope` (`storyIds`, `includeStoryText`, `allowStoryProposals`).
- [ ] **Step 2: Run tests to verify failure:** `npx vitest run src/__tests__/storyStorageAndValidation.test.ts`
- [ ] **Step 3: Implement ChangeSet v7 validation, planning, application, and scope rules.**
- [ ] **Step 4: Run tests to verify pass:** `npx vitest run src/__tests__/storyStorageAndValidation.test.ts src/__tests__/mcpScope.test.ts src/__tests__/blockingPermissionDraft.test.ts src/__tests__/keyframeMcpCapabilities.test.ts`
- [ ] **Step 5: Commit:** `git commit --no-gpg-sign -m "feat(change-set): add krakinai.change-set.v7 story operations and McpScope governance"`

---

## Task 3: MCP Workstream 6 (7 Story Read & Incremental Staging Tools)

**Files:**
- Modify: `src/domain/mcpGranularReads.ts`
- Modify: `src/domain/mcpGranularStaging.ts`
- Modify: `src/domain/mcpProtocol.ts`
- Modify: `src/connections/proposalBroker.ts`
- Modify: `docs/manual/10-technical-mcp-reference.md`
- Modify: `src/__tests__/manualDocsIntegrity.test.ts`
- Modify: `bridge/test/adapterHandshake.test.ts`
- Modify: `bridge/test/adapterProcess.test.ts`
- Modify: `bridge/test/schemaDiscovery.test.ts`
- Modify: `bridge/test/stdio.test.ts`
- Create: `src/__tests__/storyMcpTools.test.ts`

- [ ] **Step 1: Write failing tests in `src/__tests__/storyMcpTools.test.ts`** covering `krakinai_list_stories`, `krakinai_get_story` (all 4 projections + `includeStoryText: false` redaction), and the 5 `krakinai_stage_story_*` tools via `ProposalBroker` (auto-promoting to `v7`, canonical sort `Assets -> Stories -> Projects`, digest conflict errors, and approval reset on re-stage).
- [ ] **Step 2: Run tests to verify failure:** `npx vitest run src/__tests__/storyMcpTools.test.ts`
- [ ] **Step 3: Implement read/staging handlers, register the 7 tools in `mcpProtocol.ts` and `proposalBroker.ts`, and update tool count assertions to 45 + manual docs.**
- [ ] **Step 4: Run tests to verify pass:** `npx vitest run src/__tests__/storyMcpTools.test.ts src/__tests__/manualDocsIntegrity.test.ts && npm --prefix bridge test`
- [ ] **Step 5: Commit:** `git commit --no-gpg-sign -m "feat(mcp): add 7 Workstream 6 story read and staging tools"`

---

## Task 4: Story Section UI (Collection, Preview Modal, Full Workspace, Book & Creator Modes, Proposal Diffs)

**Files:**
- Create: `src/screens/StoriesScreen.tsx`
- Create: `src/components/stories/StoryCardModal.tsx`
- Create: `src/screens/StoryWorkspaceScreen.tsx`
- Create: `src/components/stories/StoryCreatorMode.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/aiConnections/PermissionsWorkspace.tsx`
- Modify: `src/components/aiConnections/ProposalOperationDetail.tsx`
- Modify: `src/components/ChangeSetPreview.tsx`
- Create: `src/__tests__/storyWorkspaceUi.test.tsx`

- [ ] **Step 1: Write failing UI tests in `src/__tests__/storyWorkspaceUi.test.tsx`** covering Sidebar navigation to Stories, Grid/List toggle, Search/Favorite/Archive filtering, Story Card Preview Modal ("Read Full Story", Favorite, Archive, Delete guard), Full Story Workspace (Hero Banner, Treatment, Reference Pack, Color Script, Project link), Book Mode vs. Creator Mode (`Act -> Sequence -> Scene -> Beat` + Dramatic Metadata editing), and Incoming Proposal story diffs.
- [ ] **Step 2: Run test to verify failure:** `npx vitest run src/__tests__/storyWorkspaceUi.test.tsx`
- [ ] **Step 3: Implement `StoriesScreen.tsx`, `StoryCardModal.tsx`, `StoryWorkspaceScreen.tsx`, `StoryCreatorMode.tsx`, navigation wiring in `AppShell.tsx`/`App.tsx`, and permission/review UI updates.**
- [ ] **Step 4: Run tests to verify pass:** `npx vitest run src/__tests__/storyWorkspaceUi.test.tsx`
- [ ] **Step 5: Commit:** `git commit --no-gpg-sign -m "feat(ui): add Stories collection, preview modal, workspace, Book/Creator modes, and proposal diffs"`

---

## Task 5: Full Verification & Push

- [ ] **Step 1:** Run `npm run typecheck` and `npm --prefix bridge run typecheck` (expect 0 errors).
- [ ] **Step 2:** Run `npm --prefix bridge test` and `npx vitest run` (expect 100% pass).
- [ ] **Step 3:** Run `npm run build` (expect clean production build).
- [ ] **Step 4:** Push branch to remote.
