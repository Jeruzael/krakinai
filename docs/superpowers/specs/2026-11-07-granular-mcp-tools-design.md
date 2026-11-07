# Granular MCP Tools Architecture & Complete Feature Coverage — Design Spec

**Date:** 2026-11-07  
**Status:** Proposed for User Review

---

## 1. Goal & Problem Statement

Currently, KRAKINAI exposes 13 MCP tools in [`src/domain/mcpProtocol.ts`](../../src/domain/mcpProtocol.ts): 11 read/status tools plus 2 monolithic change-set tools (`krakinai_preview_change_set` and `krakinai_submit_change_set`).

When an AI agent authors an 18-shot storyboard with reusable characters, wardrobe variants, ensemble bindings, dialogue cues, blocking, or keyframes, it is forced to construct a single 50–100 KB `ChangeSet` JSON payload in one shot. This causes:
- Token/payload truncation risks on large multi-shot episodes.
- Temptation for agents to write temporary local helper scripts to assemble JSON.
- All-or-nothing validation feedback instead of interactive, shot-by-shot validation.
- Missing read/inspection tools for Continuity (Cast Bible, wardrobe timeline, transitions), Catalog Presets (cinematography & performance catalogs), and Review Inbox management.

### Intended Outcome
Expose a comprehensive suite of **Granular MCP Tools** covering all KRAKINAI feature domains so AI agents can:
1. **Inspect & Query Granularly**: Fetch single asset details (with outfits and anchors), browse built-in Cinematography & Performance Catalog presets, inspect Project Continuity (Cast Bible, wardrobe tracking, transitions), check spatial blocking continuity, and list/manage the Incoming Proposals inbox.
2. **Author Incrementally (Shot-by-Shot / Operation-by-Operation)**: Create or update projects, shots, reusable asset candidates, outfit variants, modular scene recipes, ensembles, dialogue cues, camera compositions, v5 shot blocking, and v6 keyframe plans **one granular tool call at a time** without constructing monolithic ChangeSet JSON files.
3. **Preserve KRAKINAI's Security & Immutability Contract**: Every granular authoring tool stages its operation into a live draft proposal in the browser's `ProposalBroker` / `ProposalInbox` (or creates a focused proposal), enforces `McpScope` and `assertProposalScope`, automatically upgrades the package schema (`v3` / `v4` / `v5` / `v6`) as needed, runs live `previewChangeSet` validation, and preserves mandatory human browser approval before any write touches the main IndexedDB library.

---

## 2. Architectural Approaches Considered

### Approach A: Incremental Proposal Staging in `ProposalBroker` + Granular Read Tools (Recommended)
- **How it works:**
  - Introduce a pure domain module [`src/domain/mcpGranularStaging.ts`](../../src/domain/mcpGranularStaging.ts) that translates flat, ergonomic tool arguments (e.g., `krakinai_stage_shot`, `krakinai_stage_scene_recipe`, `krakinai_stage_scene_ensemble`) into canonical `ChangeOperation` records and upserts them by `operationId` / `clientRef` into an in-progress `ChangeSet` inside `ProposalBroker` / `ProposalInbox`.
  - Each granular staging call immediately validates scope (`assertProposalScope`), runs `previewChangeSet`, persists the updated draft in `ProposalInbox`, updates the live browser UI in **Incoming Proposals**, and returns per-operation readiness and conflict feedback to the agent.
  - Add granular read tools (`krakinai_get_asset`, `krakinai_list_catalog_presets`, `krakinai_get_project_continuity`, `krakinai_check_spatial_continuity`, `krakinai_list_saved_scenes`, `krakinai_list_proposals`, `krakinai_discard_proposal`) to [`src/domain/mcpReads.ts`](../../src/domain/mcpReads.ts) and [`src/connections/proposalBroker.ts`](../../src/connections/proposalBroker.ts).
- **Pros:**
  - 100% compliant with [`AGENTS.md`](../../../AGENTS.md): never writes directly to the real browser database without human review, never bypasses scope grants, and never mutates immutable saved scenes.
  - Agents can build a 20-shot episode through 20 small, fast, conversational tool calls (~500 bytes each), getting instant validation after each shot.
  - Reuses the entire tested `previewChangeSet`, `importBatchChecks`, and `applyApprovedChangeSet` pipeline.
- **Cons:**
  - Requires deterministic operation upsert/merge logic when patching an already-staged scene recipe (e.g., adding ensemble or blocking in a second tool call).

### Approach B: Direct Unreviewed Database Writes from MCP
- **How it works:** Have MCP tools call `savePromptAsset`, `addProjectShot`, and `saveSceneFromDraft` directly in IndexedDB without going through `ProposalBroker`.
- **Pros:** Immediate database mutation.
- **Cons:** Explicitly violates [`AGENTS.md`](../../../AGENTS.md) (*"Preview and submit through the existing authenticated MCP workflow. Never write directly to the real browser database, automate approval, claim unconfirmed success, or replace immutable saved outputs"*). Rejected.

### Approach C: Separate Mini-Proposal per Tool Call
- **How it works:** Every granular tool call creates a brand-new proposal in the Review Inbox.
- **Pros:** Trivial implementation.
- **Cons:** The Review Inbox has a strict limit of 8 packages (`MCP_LIMITS.proposals = 8`), so an 18-shot episode would immediately fail with `QUEUE_FULL` after 8 calls, and cross-operation references (`{ ref: "proj-1" }`, `{ ref: "shot-s01" }`) would not resolve across separate packages. Rejected.

---

## 3. System Decomposition & Tool Catalog (5 Workstreams)

Because this covers the entire KRAKINAI feature surface, the architecture is organized into **5 cohesive workstreams** that build cleanly on top of one another:

### Workstream 1: Proposal Inbox Management & Incremental Staging Core
Provides the staging engine (`mcpGranularStaging.ts`) and project/shot-level granular tools:
1. **`krakinai_list_proposals`**: Lists all proposals in the browser's Review Inbox (`proposalId`, `changeSetId`, `title`, `status`, `operationCount`, `blockingFindingCount`, `expiresAt`).
2. **`krakinai_discard_proposal`**: Removes a draft/rejected/expired proposal from the browser's Review Inbox (`proposalId`) so the agent/user can free up the 8-proposal queue without leaving chat.
3. **`krakinai_stage_project`**: Creates or updates a `project.create` or `project.update` operation inside a staged proposal (`changeSetId`, `title?`, `projectId?`, `clientRef?`, `name`, `description?`, `planningNotes?`).
4. **`krakinai_stage_shot`**: Upserts a `shot.create` or `shot.update` operation inside a staged proposal (`changeSetId`, `project`, `shotId?`, `clientRef?`, `code`, `title`, `plannedShotType?`, `plannedDurationSeconds?`, `continuityNotes?`).
5. **`krakinai_stage_shot_order`**: Upserts a `shot.reorder` operation (`changeSetId`, `project`, `shots`).
6. **`krakinai_stage_shot_status`**: Upserts a `shot.set_status` or `shot.select_take` operation (`changeSetId`, `project`, `shot`, `status?`, `expectedStatus?`, `selectedScene?`, `expectedSelectedSceneId?`).

### Workstream 2: Library Assets, Character Variants & Catalog Presets
Provides granular inspection and staging for reusable assets and built-in catalogs:
7. **`krakinai_get_asset`**: Returns full authorized details for a single asset (`id`), including `promptText`, `compactText`, `tags`, `notes` (when granted), `identityAnchor` metadata (when granted), and all linked character `Outfit` variants.
8. **`krakinai_list_catalog_presets`**: Read-only lookup of KRAKINAI's built-in deterministic catalogs:
   - `catalog: 'cinematography' | 'performance' | 'shot_types'`
   - Returns shot sizes, camera angles, movements, lenses, depth of field options, or emotion IDs, intensity levels, vocal tones, delivery styles, and body gestures.
9. **`krakinai_stage_asset_candidate`**: Upserts an `asset.propose` operation (`changeSetId`, `clientRef`, `kind`, `title`, `promptText`, `description?`, `tags?`, `notes?`) into the staged proposal.
10. **`krakinai_stage_outfit_variant`**: Upserts a `variant.propose` operation (`changeSetId`, `clientRef`, `parentCharacterId`, `expectedParentRevision`, `title`, `promptText`, `description?`, `tags?`, `notes?`) into the staged proposal.

### Workstream 3: Modular Scene Recipes, Ensemble, Dialogue & Camera Authoring
Provides flat, ergonomic tools to author or patch individual scene recipes inside a staged proposal:
11. **`krakinai_stage_scene_recipe`**: Upserts a `scene.create_recipe`, `scene.revise_recipe`, or `scene.create_recipe_take` operation (`changeSetId`, `clientRef`, `project`, `shot`, `sceneId?`, `expectedHeadId?`, `mode?: 'create' | 'revise' | 'take'`, `title`, `shotType`, `settings`, `slots`, `sceneInstructions?`, `avoidText?`, `overrides?`).
12. **`krakinai_stage_scene_ensemble`**: Sets or updates the `ensemble` block on a staged recipe operation (`changeSetId`, `sceneClientRef`, `participants`, `primaryParticipantId?`, `removeParticipantIds?`).
13. **`krakinai_stage_scene_dialogue`**: Sets or updates single-speaker `dialogue` or multi-speaker `dialogueCues` (with `{ startSeconds, endSeconds }` timing and V1/V2 `performanceDirection`) on a staged recipe operation (`changeSetId`, `sceneClientRef`, `dialogue?`, `dialogueCues?`).
14. **`krakinai_stage_camera_composition`**: Sets structured `cameraComposition` parameters (`shotSize`, `angle`, `movement`, `lens`, `depthOfField`) on a staged recipe operation (`changeSetId`, `sceneClientRef`, `cameraComposition`).
15. **`krakinai_stage_direct_to_recipe`**: Upserts a `scene.convert_direct_to_recipe` operation on a staged proposal (`changeSetId`, `clientRef`, `project`, `shot`, `sceneId`, `expectedHeadId`, `conversion`, `title`, `shotType`, `settings`, `slots`, `sceneInstructions?`).
16. **`krakinai_preview_scene_assembly`**: Read-only deterministic assembly + preflight check (`P001`–`P005`) for a staged recipe operation (`changeSetId`, `sceneClientRef`) or an existing `sceneId`, returning assembled metadata and preflight findings.

### Workstream 4: Continuity, Shot Blocking (v5) & Keyframes / Image Prompt Studio (v6)
Provides read and staging tools for Continuity, Workstream B (Blocking), and Workstream C (Keyframes):
17. **`krakinai_get_project_continuity`**: Returns the project's Cast Bible (`cast`), shot-to-shot `transitions`, intentional wardrobe change annotations, and continuity warnings computed by [`continuityWorkspace.ts`](../../src/domain/continuityWorkspace.ts).
18. **`krakinai_check_spatial_continuity`**: Runs [`blockingContinuity.ts`](../../src/domain/blockingContinuity.ts) across a project's shots (including any staged blocking operations in `changeSetId?`) and returns advisory spatial continuity findings.
19. **`krakinai_stage_scene_blocking`**: Sets or patches the v5 `blocking` specification (`Start -> Action -> End` participant staging, landmarks, props, interactions) on a staged recipe operation (`changeSetId`, `sceneClientRef`, `blocking`, `expectedSourceTokens?`) and automatically promotes the staged package schema to `krakinai.change-set.v5` (when not already `v6`).
20. **`krakinai_stage_keyframe_plan`**: Sets or updates the v6 `keyframePlan` (ordered `frames` with `id`, `label`, `kind`, `beatDescription`, `cameraOverride`, `actionOverride`) on a staged recipe operation (`changeSetId`, `sceneClientRef`, `keyframePlan`, `expectedSourceTokens?`) and automatically promotes the staged package schema to `krakinai.change-set.v6`.
21. **`krakinai_stage_frame_image`**: Upserts a v6 `frame_image.link` or `frame_image.clear` operation in the staged proposal (`changeSetId`, `project`, `shot`, `scene`, `frameId`, `mediaId?`, `expectedAssociationRevision`).

### Workstream 5: Saved Scenes Query & Export Tools
Provides read/search/export tools for the Saved Scenes library:
22. **`krakinai_list_saved_scenes`**: Paginated search/filter over authorized saved scenes (`query?`, `archiveFilter?: 'active' | 'archived' | 'all'`, `shotType?`, `reviewStatus?`, `cursor?`, `limit?`).
23. **`krakinai_export_scene_prompts`**: Formats and returns the combined full prompts (`formatSelectedPrompts`) for a list of `sceneIds` that have full-prompt disclosure grants.

---

## 4. Incremental Staging Mechanics (`src/domain/mcpGranularStaging.ts`)

1. **Deterministic Operation Upsert & Ordering**:
   - Every staged proposal in `ProposalBroker` is stored as a standard `ChangeSet` record inside `ProposalInbox`.
   - When a granular `krakinai_stage_*` tool is called with `changeSetId`:
     - If no draft proposal with `changeSetId` exists yet in `ProposalBroker`, a new `ChangeSet` (`schema: 'krakinai.change-set.v3'`, `source: { kind: 'codex', label: 'KRAKINAI Granular MCP' }`) is initialized.
     - If an operation with the matching `operationId` or `clientRef` already exists in `changeSet.operations`, it is updated in place; otherwise it is inserted in canonical dependency order:
       1. `asset.propose` / `variant.propose`
       2. `project.create` / `project.update`
       3. `shot.create` / `shot.update` / `shot.reorder`
       4. `scene.create_recipe` / `scene.revise_recipe` / `scene.create_recipe_take` / `scene.convert_direct_to_recipe`
       5. `shot.attach_take` / `shot.select_take` / `shot.set_status` / `frame_image.*`
2. **Automatic Schema Version Selection**:
   - Default schema is `krakinai.change-set.v3`.
   - If any operation uses `scene.convert_direct_to_recipe` (and no v5/v6 features), schema upgrades to `krakinai.change-set.v4`.
   - If any operation includes `blocking` (and no v6 features), schema upgrades to `krakinai.change-set.v5` (requiring `allowBlockingProposals` and v2/v3 capability pairing).
   - If any operation includes `keyframePlan` or `frame_image.*`, schema upgrades to `krakinai.change-set.v6` (requiring `allowKeyframeProposals` and v3 capability pairing).
3. **In-Place Inbox Persistence & Re-Preview**:
   - When an existing unapplied draft proposal in `ProposalBroker` is updated by a granular tool, `ProposalInbox` updates its stored `ChangeSet`, recomputes `packageDigest` and `previewChangeSet`, resets `approval` to `emptyChangeSetApproval()` (so human review is always fresh for the updated batch), and returns:
     ```json
     {
       "proposalId": "...",
       "changeSetId": "...",
       "schema": "krakinai.change-set.v3",
       "packageDigest": "...",
       "operationCount": 5,
       "stagedOperationId": "op-scene-s01",
       "status": "review_required",
       "batchChecks": { "readiness": "review_required", "findings": [...] }
     }
     ```

---

## 5. Security, Scope & Privacy Guarantees

- **Zero Scope Escalation**: Every granular read tool uses the exact same `McpScope` filters (`authorizedSceneIds`, `includeAssetText`, `includeCharacterIdentity`, `includeNotes`, `includeMediaFilenames`, `fullPromptSceneIds`, `blockingSceneIds`, `keyframeSceneIds`) as the existing 13 tools.
- **Zero Unapproved Library Writes**: Granular staging tools only mutate uncommitted draft packages in `krakinai_review_inbox_db` (`ProposalInbox`), never the 8 main library stores in `krakinai_db`.
- **Backward Compatibility**: All 13 existing MCP tools (`krakinai_connection_status` through `krakinai_get_generation_prompt`, including `krakinai_preview_change_set` and `krakinai_submit_change_set`) remain 100% unchanged in signature and behavior.

---

## 6. Testing Strategy

1. **Unit Tests for Incremental Staging (`src/__tests__/mcpGranularStaging.test.ts`)**:
   - Building a multi-shot project step-by-step (`stage_project` -> `stage_asset_candidate` -> `stage_outfit_variant` -> `stage_shot` -> `stage_scene_recipe` -> `stage_scene_ensemble` -> `stage_scene_dialogue` -> `stage_camera_composition`) produces a valid `ChangeSet` in dependency order with 0 schema errors.
   - Automatic schema promotion (`v3` -> `v4` -> `v5` -> `v6`) and idempotent upsert when updating an existing `clientRef`.
2. **Read Tool Privacy & Scope Tests (`src/__tests__/mcpGranularReads.test.ts`)**:
   - `krakinai_get_asset`, `krakinai_list_catalog_presets`, `krakinai_get_project_continuity`, `krakinai_check_spatial_continuity`, `krakinai_list_saved_scenes`, and `krakinai_export_scene_prompts` strictly enforce `McpScope` disclosure flags and reject unauthorized IDs with `PERMISSION_DENIED`.
3. **Broker Integration Tests (`src/__tests__/mcpGranularBroker.test.ts`)**:
   - End-to-end `ProposalBroker.handle(...)` tests verifying incremental staging updates the same `proposalId` in `ProposalInbox`, resets prior review approvals on mutation, enforces `allowProposals` / `allowBlockingProposals` / `allowKeyframeProposals`, and supports `krakinai_list_proposals` and `krakinai_discard_proposal`.
