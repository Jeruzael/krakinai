# Story Section (Book Mode & Creator Mode) + MCP Workstream 6 — Design Specification

**Date:** 2026-11-11  
**Status:** Approved for Planning  
**Schema Target:** `krakinai.change-set.v7`  
**MCP Tool Target:** 45 total tools (+7 Story & Creator Mode tools)

---

## 1. Executive Summary & Objective

Currently, KRAKINAI's production lifecycle begins at pre-production asset creation and shot-level storyboarding. The **Story Section** introduces a dedicated narrative development workspace upstream of the **Scene Builder** and **Projects & Storyboard** (`Collections`) views. It allows human creators and MCP-connected AI agents to collaboratively author, edit, archive, and structure full-length stories, treatments, and Creator Mode beat sheets (`Act -> Sequence -> Scene -> Beat`), while linking narrative elements directly to reusable KRAKINAI Library Assets and Storyboard Projects.

---

## 2. Key Architectural Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| **D1** | **Companion IndexedDB Store (`krakinai_stories_db`) Hydrated into `LibrarySnapshot`** | `krakinai_prompt_library_db` (`DB_VERSION = 4`) is locked to 8 object stores in `src/storage/libraryCompatibility.ts` and tested by `compactLibraryCompatibility.test.ts`. Storing stories in `krakinai_stories_db` (matching `krakinai_review_inbox_db`) and hydrating `stories?: Story[]` into `getAllSnapshot()`, `ChangeSetState`, and `backup.ts` provides indexed IndexedDB persistence (`updatedAt`, `favorite`, `archivedAt`, `linkedCollectionId`) and full ZIP/JSON backup compatibility with zero breaking v4 migration locks. |
| **D2** | **Additive Change-Set Schema (`krakinai.change-set.v7`)** | Preserves v1–v6 contracts unchanged. Any staged `story.*` operation promotes the draft ChangeSet schema to `'krakinai.change-set.v7'` and enforces canonical execution ordering: `Assets/Variants -> Stories -> Projects -> Shots -> Scenes`. |
| **D3** | **Consistent `McpScope` Governance (`storyIds`, `includeStoryText`, `allowStoryProposals`)** | Follows existing `projectIds` / `sceneIds` / `assetIds` naming. Preserves legacy `permissionFingerprint` outputs when story grants are empty so `blockingPermissionDraft.test.ts` and `keyframeMcpCapabilities.test.ts` remain green. |
| **D4** | **Optimistic Concurrency via `expectedRevision` & `expectedStoryDigest`** | Stale overwrites on story prose or Creator Mode hierarchy are rejected with `McpError('CONFLICT')` at staging time and produce blocking `CONFLICT` findings during `planChangeSet`. |
| **D5** | **Soft-Archive Only for AI Agents; Guarded Hard Delete in UI** | MCP agents can only stage `story.set_status` (`archived`, `favorite`). Hard deletion is human-only in the UI and blocked if `linkedCollectionId` references an active project until unlinked. |

---

## 3. Data Models (`src/types/domain.ts`, `src/types/changeSet.ts`, `src/types/mcp.ts`)

### 3.1 Story Domain Models
- **`StoryDramaticMeta`**: `{ setupForeshadowing?: string[]; incitingIncident?: string; subtext?: string; climax?: string; payoff?: string[]; characterArcs?: Array<{ characterAssetId: string; arcState: string; internalShift?: string }> }`
- **`StoryBeat`**: `{ id: string; orderIndex: number; title: string; content: string; dramaticMeta?: StoryDramaticMeta; linkedShotId?: string; linkedSceneId?: string }`
- **`StorySceneNode`**: `{ id: string; orderIndex: number; title: string; summary?: string; environmentAssetId?: string; dramaticMeta?: StoryDramaticMeta; linkedShotIds?: string[]; beats: StoryBeat[] }`
- **`StorySequence`**: `{ id: string; orderIndex: number; title: string; summary?: string; dramaticMeta?: StoryDramaticMeta; scenes: StorySceneNode[] }`
- **`StoryAct`**: `{ id: string; orderIndex: number; title: string; summary?: string; dramaticMeta?: StoryDramaticMeta; sequences: StorySequence[] }`
- **`StoryColorScriptEntry`**: `{ id: string; orderIndex: number; label: string; targetNodeId?: string; hexPalette: string[]; mediaId?: string; lightingAssetId?: string; styleAssetId?: string; notes?: string }`
- **`StoryReferencePack`**: `{ assetIds: string[]; variantIds: string[]; mediaIds: string[] }`
- **`Story`**: `{ id: string; title: string; author: string; createdAt: string; updatedAt: string; archivedAt?: string | null; favorite: boolean; revisionNumber: number; tags: string[]; coverMediaId?: string | null; heroBannerMediaId?: string | null; logline: string; premise: string; synopsis: string; treatment: string; fullBookText: string; referencePack: StoryReferencePack; linkedCollectionId?: string | null; colorScript: StoryColorScriptEntry[]; acts: StoryAct[] }`

### 3.2 Change-Set v7 Operations (`story.*`)
1. `story.create` (`StoryCreateOperation`)
2. `story.update` (`StoryUpdateOperation`)
3. `story.set_status` (`StoryStatusOperation`)
4. `story.patch_structure` (`StoryStructurePatchOperation`)
5. `story.patch_dramatic_meta` (`StoryDramaticMetaPatchOperation`)
6. `story.patch_references` (`StoryReferencesPatchOperation`)

### 3.3 MCP Workstream 6 Tools (7 Tools)
1. `krakinai_list_stories` (Read)
2. `krakinai_get_story` (Read with projections: `'overview' | 'book' | 'creator_hierarchy' | 'full'`)
3. `krakinai_stage_story` (Stage create/update)
4. `krakinai_stage_story_status` (Stage archive/unarchive/favorite)
5. `krakinai_stage_story_structure` (Stage `Act -> Sequence -> Scene -> Beat` hierarchy)
6. `krakinai_stage_story_dramatic_meta` (Stage dramatic metadata on an act, sequence, scene, or beat)
7. `krakinai_stage_story_references` (Stage Reference Pack, Color Script, and `linkedCollectionId`)
