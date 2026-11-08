# KRAKINAI Story Setup Skill (Phase 4) & Batch MCP Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `krakinai_stage_storyboard_batch` MCP tool (Tool #37), harden composite/non-destructive staging in `mcpGranularStaging.ts`, author the standalone Phase 4 skill (`story-krakinai-setup`), upgrade `krakinai-story-authoring`, and sync the KRAKINAI Manual & PDF book.

**Architecture:** We extend `src/domain/mcpGranularStaging.ts`, `src/domain/mcpProtocol.ts`, and `src/connections/proposalBroker.ts` so `krakinai_stage_scene_recipe` accepts composite sub-objects (`ensemble`, `participants`, `dialogue`, `dialogueCues`, `cameraComposition`, `blocking`, `keyframes`, `overrides`) non-destructively, `krakinai_stage_scene_dialogue` auto-routes single `dialogue` into `ensemble.dialogueCues`, `normalizeCameraComposition` maps directorial shorthands (`EWS`, `MCU`, `dutch`, `crane`, `shallow-dof`, etc.) to valid `CINEMATOGRAPHY_TECHNIQUES` IDs, and `krakinai_stage_storyboard_batch` stages entire multi-shot storyboards in 1–2 tool calls. Then we author `C:\Users\HomePC\.gemini\config\skills\standalone_phase_4_skill_krakinai_setup\SKILL.md`, update `C:\Users\HomePC\.gemini\config\skills\krakinai-story-authoring\SKILL.md`, and update `docs/manual/` to reflect all 37 MCP tools.

**Tech Stack:** TypeScript 5.8, Vitest, Node.js, Markdown Skill Specifications (`SKILL.md`).

**Spec:** [docs/superpowers/specs/2026-11-08-krakinai-story-setup-skill-design.md](file:///c:/Users/HomePC/dev/krakinai/docs/superpowers/specs/2026-11-08-krakinai-story-setup-skill-design.md)

## Global Constraints

- Preserve all existing 36 MCP tools and ChangeSet v1–v6 contracts without breaking changes.
- `krakinai_stage_storyboard_batch` must enforce v5 blocking and v6 keyframe capability/scope checks whenever any staged scene contains `blocking` or `keyframes`.
- Whenever `ensemble` is present on a recipe operation, top-level `dialogue`, `identitySource`, and `character`/`wardrobe` slot references in `assetRefs` must be stripped or converted so `validateEnsembleRecipePatch` never throws `"Conflicting global Character/wardrobe/identity/dialogue fields with an ensemble patch."`.
- Dialogue cue timings must satisfy `0 <= startSeconds < endSeconds <= settings.durationSeconds`.
- Skill `description` frontmatter in `SKILL.md` must start with `"Use when..."`, be written in third person, and describe only triggering conditions (never summarizing the internal workflow).

## Review Focus

1. **Ensemble + Single Dialogue Conflict:** Calling `krakinai_stage_scene_dialogue` with `{ dialogue: { speaker, line } }` on a scene that already has `ensemble` must convert `dialogue` into `ensemble.dialogueCues` and delete top-level `dialogue` so `parseChangeSet` passes.
2. **Non-Destructive Recipe Re-Staging:** Calling `krakinai_stage_scene_recipe` a second time on an existing `clientRef` (e.g., to update `sceneInstructions` or `avoidText`) must preserve previously staged `ensemble`, `cameraComposition`, `blocking`, `keyframes`, and `overrides`.
3. **Dialogue Timing Overflow:** If a dialogue cue in `dialogueCues` has `endSeconds > settings.durationSeconds` (or `startSeconds >= endSeconds`), normalization must clamp timing within `[0, durationSeconds]` so `validateDialogueCueTiming` does not reject the batch.
4. **Unrecognized or Shorthand Camera Technique IDs:** Passing shorthand strings (`"EWS"`, `"High Angle"`, `"Crane"`, `"Deep Focus"`, `"15° Dutch Angle"`) in `cameraComposition.techniqueIds` must resolve to valid `CINEMATOGRAPHY_TECHNIQUES` IDs and drop unknown strings without crashing `validateCameraComposition`.
5. **Batch Permission Boundary Enforcement:** If `krakinai_stage_storyboard_batch` includes a scene with `blocking` (v5) or `keyframes` (v6) while the browser session lacks `allowBlockingProposals` or `allowKeyframeProposals`, `ProposalBroker` must reject with `PERMISSION_DENIED` or `CAPABILITY_REQUIRED`.

---

### Task 1: Composite & Batch MCP Staging Engine (`krakinai_stage_storyboard_batch` + Hardened `mcpGranularStaging.ts`)

**Files:**
- Modify: `src/domain/mcpProtocol.ts`
- Modify: `src/domain/mcpGranularStaging.ts`
- Modify: `src/connections/proposalBroker.ts`
- Test: `src/__tests__/mcpGranularBroker.test.ts`

**Interfaces:**
- Consumes: `ChangeSet`, `RecipeSceneOperation` (`src/types/changeSet.ts`), `CINEMATOGRAPHY_TECHNIQUES` (`src/data/cinematographyRegistry.ts`)
- Produces:
  - `'krakinai_stage_storyboard_batch'` in `MCP_TOOL_NAMES` and `MCP_INPUT_SCHEMAS` (`src/domain/mcpProtocol.ts`)
  - `stageStoryboardBatchOperation(draft: ChangeSet, args: Record<string, unknown>): { changeSet: ChangeSet; operationId: string; stagedCounts: { assets: number; variants: number; projects: number; shots: number; scenes: number } }` (`src/domain/mcpGranularStaging.ts`)
  - Composite & non-destructive `stageSceneRecipeOperation`, auto-normalized `stageSceneDialogueOperation`, and alias-aware `normalizeCameraComposition` (`src/domain/mcpGranularStaging.ts`)

- [ ] **Step 1: Write the failing tests in `src/__tests__/mcpGranularBroker.test.ts`**

Add a new `describe('Composite & Batch Storyboard Staging (Phase 4 support)', ...)` suite in `src/__tests__/mcpGranularBroker.test.ts` testing:
1. `krakinai_stage_scene_dialogue` auto-converts single `dialogue` into `ensemble.dialogueCues` when `ensemble` is present and clamps cue timing within `durationSeconds`.
2. `krakinai_stage_scene_recipe` accepts inline `participants`, `dialogueCues`, `cameraComposition` (with shorthand aliases like `['EWS', 'high-angle', 'crane', 'deep-focus']`), `avoidText`, and `overrides`, and preserves them when `krakinai_stage_scene_recipe` is called again to update `sceneInstructions`.
3. `krakinai_stage_storyboard_batch` stages a complete multi-shot 12-layer storyboard (`project`, `assets` for characters/wardrobe/environment/lighting/style, `shots`, and composite `scenes`) in a single call, producing `status: 'review_required'` and `blockingFindingCount === 0`.
4. `krakinai_stage_storyboard_batch` rejects with `PERMISSION_DENIED` / `CAPABILITY_REQUIRED` when a batch scene includes `blocking` under a v1 scope without blocking permissions.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cmd /c npx vitest run src/__tests__/mcpGranularBroker.test.ts`
Expected: FAIL (`krakinai_stage_storyboard_batch` is not in `MCP_TOOL_NAMES`, single `dialogue` conflicts with `ensemble`, re-staging wipes `ensemble`).

- [ ] **Step 3: Implement `krakinai_stage_storyboard_batch` and staging hardening in `src/domain/mcpProtocol.ts`, `src/domain/mcpGranularStaging.ts`, and `src/connections/proposalBroker.ts`**

1. In `src/domain/mcpProtocol.ts`:
   - Add `'krakinai_stage_storyboard_batch'` to `MCP_TOOL_NAMES`.
   - Extend `MCP_INPUT_SCHEMAS.krakinai_stage_scene_recipe` properties with optional `ensemble: { type: 'object' }`, `participants: { type: 'array' }`, `primaryParticipantId: idSchema`, `dialogue: { type: 'object' }`, `dialogueCues: { type: 'array' }`, `cameraComposition: { type: 'object' }`, `blocking: { type: 'object' }`, `keyframes: { type: 'object' }`, `keyframePlan: { type: 'object' }`.
   - Add `MCP_INPUT_SCHEMAS.krakinai_stage_storyboard_batch`:
     ```ts
     krakinai_stage_storyboard_batch: schema({
       changeSetId: idSchema,
       title: { type: 'string', maxLength: 200 },
       description: { type: 'string', maxLength: 2000 },
       project: { type: 'object' },
       assets: { type: 'array' },
       variants: { type: 'array' },
       shots: { type: 'array' },
       scenes: { type: 'array' },
     }, ['changeSetId']),
     ```
2. In `src/domain/mcpGranularStaging.ts`:
   - Enhance `normalizeCameraComposition` with a lookup map translating directorial shorthands (`ews`, `ws`, `mws`, `fs`, `ms`, `mcu`, `cu`, `ecu`, `eye-level`, `low-angle`, `high-angle`, `dutch`, `dutch-angle`, `dutch-tilt`, `overhead`, `worms-eye`, `single`, `dirty-single`, `two-shot`, `three-shot`, `group`, `ots`, `over-the-shoulder`, `pov`, `symmetrical`, `static`, `locked-off`, `push-in`, `dolly-in`, `pull-back`, `dolly-out`, `pan`, `whip-pan`, `tilt`, `tracking`, `trucking`, `arc`, `orbit`, `crane`, `jib`, `handheld`, `steadicam`, `shallow-dof`, `shallow`, `bokeh`, `deep-focus`, `deep`, `rack-focus`) to exact `CINEMATOGRAPHY_TECHNIQUES` IDs, deduplicating and filtering to valid IDs.
   - Update `stageSceneDialogueOperation` to:
     - Clamp cue `timing` so `0 <= startSeconds < endSeconds <= durationSeconds`.
     - If `updatedOp.ensemble` exists and `args.dialogue` is provided without `args.dialogueCues`, convert `args.dialogue` into `updatedOp.ensemble.dialogueCues` and delete top-level `updatedOp.dialogue`.
     - Whenever `updatedOp.ensemble` exists, ensure top-level `updatedOp.dialogue` and `updatedOp.identitySource` are removed.
   - Update `stageSceneRecipeOperation` to:
     - Look up any existing staged recipe operation with the same `clientRef` or `operationId` and preserve its existing `ensemble`, `dialogue`, `cameraComposition`, `blocking`, `keyframes`, `overrides`, `assetRefs`, `sceneInstructions`, and `avoidText` when not overridden by `args`.
     - Apply `args.overrides` if non-empty.
     - If `args.ensemble` or `args.participants` is provided, apply `stageSceneEnsembleOperation` inline.
     - If `args.dialogue` or `args.dialogueCues` is provided, apply `stageSceneDialogueOperation` inline.
     - If `args.cameraComposition` is provided, apply `stageCameraCompositionOperation` inline.
     - If `args.blocking` is provided, apply `stageSceneBlockingOperation` inline.
     - If `args.keyframes` or `args.keyframePlan` is provided, apply `stageKeyframePlanOperation` inline.
   - Implement `stageStoryboardBatchOperation(draft: ChangeSet, args: Record<string, unknown>)` that iterates over `args.assets`, `args.variants`, `args.project`, `args.shots`, and `args.scenes` in order and returns `{ changeSet, operationId, stagedCounts }`.
3. In `src/connections/proposalBroker.ts`:
   - Import `stageStoryboardBatchOperation` and handle `case 'krakinai_stage_storyboard_batch':` in `#handleGranularStage`, including `stagedCounts` in the returned `resultData`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cmd /c npx vitest run src/__tests__/mcpGranularBroker.test.ts src/__tests__/mcpProtocol.test.ts`
Expected: PASS (all tests green).

---

### Task 2: Author Phase 4 Skill (`story-krakinai-setup`) & Upgrade `krakinai-story-authoring`

**Files:**
- Create: `C:\Users\HomePC\.gemini\config\skills\standalone_phase_4_skill_krakinai_setup\SKILL.md`
- Modify: `C:\Users\HomePC\.gemini\config\skills\krakinai-story-authoring\SKILL.md`
- Modify: `C:\Users\HomePC\.gemini\config\skills\standalone_phase_3_skill_director\SKILL.md` (add Phase 4 handoff note at bottom)

**Interfaces:**
- Consumes: Phase 3 artifacts (`03_director_storyboard.md` and `03_storyboard_prompts.json`) and all 37 KRAKINAI MCP tools.
- Produces:
  - `story-krakinai-setup` skill (`C:\Users\HomePC\.gemini\config\skills\standalone_phase_4_skill_krakinai_setup\SKILL.md`)
  - Updated `krakinai-story-authoring` skill (`C:\Users\HomePC\.gemini\config\skills\krakinai-story-authoring\SKILL.md`)

- [ ] **Step 1: Author `C:\Users\HomePC\.gemini\config\skills\standalone_phase_4_skill_krakinai_setup\SKILL.md`**

Include:
1. YAML Frontmatter (`name: story-krakinai-setup`, `description: Use when setting up, staging, or importing Phase 3 director storyboards (03_director_storyboard.md and 03_storyboard_prompts.json) or multi-shot scripts into KRAKINAI via MCP tools.`, `version: 1.0.0`, `input_artifact: 03_director_storyboard.md AND 03_storyboard_prompts.json`, `output_artifact: 04_krakinai_setup_report.md`).
2. **The Iron Laws of Phase 4 KRAKINAI Setup:**
   - Utilize the MCP toolset first (`krakinai_connection_status`, `krakinai_list_catalog_presets`, `krakinai_search_assets`, `krakinai_stage_storyboard_batch`, granular `krakinai_stage_*`, `krakinai_preview_scene_assembly`, `krakinai_check_spatial_continuity`, `krakinai_get_proposal_status`).
   - Strict separation of **Base Character Physiology** (`kind: "character"`) vs. **Beat-Specific Wardrobe States** (`kind: "wardrobe"`, e.g. clean tunic $\to$ scorched sleeve $\to$ sludge-torn tunic; clean vestments $\to$ sludge-stained vestments).
   - **Zero Loss of 12-Layer Detail & 3-Plane Crowd Permanence:** Every shot's `sceneInstructions` must preserve `[3-PLANE STAGING — FG / MG / BG]`, `[OPTICS & CAMERA DYNAMICS]`, `[INTERACTIVE LIGHTING & VFX]`, and `[AUDIO, FOLEY & CONTINUITY LOCKS]`, while `avoidText` locks `forbidden_transitions` and `"No generated music, no captions, no empty background hall."`
   - Never put top-level `dialogue` alongside `ensemble`; always use `dialogueCues` inside `ensemble` (or `dialogueCues` in `krakinai_stage_storyboard_batch` / `krakinai_stage_scene_recipe`).
3. **Complete 6-Stage Execution Protocol** with concrete `krakinai_stage_storyboard_batch` payload examples mapped directly from Silvester's `03_storyboard_prompts.json`.
4. **Required Output Artifact Template (`04_krakinai_setup_report.md`).**

- [ ] **Step 2: Update `C:\Users\HomePC\.gemini\config\skills\krakinai-story-authoring\SKILL.md` and `standalone_phase_3_skill_director\SKILL.md`**

1. In `krakinai-story-authoring/SKILL.md`:
   - Fix the Phase 4 `scene.create_recipe` example so spoken lines sit inside `ensemble.dialogueCues` instead of top-level `dialogue`.
   - Add the MCP Granular & Batch Staging workflow (`krakinai_stage_storyboard_batch`, `krakinai_stage_scene_recipe`, `krakinai_preview_scene_assembly`, `krakinai_check_spatial_continuity`).
   - Reference `story-krakinai-setup` when working from Phase 3 (`03_director_storyboard.md` + `03_storyboard_prompts.json`) artifacts.
2. In `standalone_phase_3_skill_director/SKILL.md`:
   - Add a handoff section at the end pointing to Phase 4 (`story-krakinai-setup`) once the user approves `03_director_storyboard.md` and `03_storyboard_prompts.json`.

- [ ] **Step 3: Verify skill files and YAML frontmatter**

Run: `Get-Item "C:\Users\HomePC\.gemini\config\skills\standalone_phase_4_skill_krakinai_setup\SKILL.md", "C:\Users\HomePC\.gemini\config\skills\krakinai-story-authoring\SKILL.md"`
Expected: Both files exist with valid frontmatter and complete instructions.

---

### Task 3: Sync KRAKINAI Official Manual & Recompile PDF Book

**Files:**
- Modify: `docs/manual/10-technical-mcp-reference.md`
- Modify: `docs/manual/06-user-guide-ai-collaboration.md`
- Modify: `src/__tests__/manualDocsIntegrity.test.ts`

**Interfaces:**
- Consumes: Updated 37-tool `MCP_TOOL_NAMES` from `src/domain/mcpProtocol.ts`.
- Produces: Updated `docs/manual/10-technical-mcp-reference.md`, `docs/manual/06-user-guide-ai-collaboration.md`, and recompiled `docs/manual/dist/KRAKINAI-Manual.pdf`.

- [ ] **Step 1: Run `src/__tests__/manualDocsIntegrity.test.ts` to observe the expected failure for the new 37th tool**

Run: `cmd /c npx vitest run src/__tests__/manualDocsIntegrity.test.ts`
Expected: FAIL (`docs/manual/10-technical-mcp-reference.md` does not yet contain `krakinai_stage_storyboard_batch`).

- [ ] **Step 2: Document `krakinai_stage_storyboard_batch` and composite recipe staging in `docs/manual/10-technical-mcp-reference.md` and `docs/manual/06-user-guide-ai-collaboration.md`**

- Add `krakinai_stage_storyboard_batch` to Workstream 1/3 in `docs/manual/10-technical-mcp-reference.md` and `docs/manual/06-user-guide-ai-collaboration.md`.
- Update the tool count in `src/__tests__/manualDocsIntegrity.test.ts` from 36 to 37.

- [ ] **Step 3: Run integrity tests, typecheck, and rebuild the PDF manual**

Run:
1. `cmd /c npx vitest run src/__tests__/manualDocsIntegrity.test.ts src/__tests__/mcpGranularBroker.test.ts`
2. `cmd /c npx tsc --noEmit`
3. `cmd /c npm run docs:manual`
Expected: All tests pass, `tsc --noEmit` exits 0, and `docs/manual/dist/KRAKINAI-Manual.pdf` compiles cleanly.
