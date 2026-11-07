# KRAKINAI Story Setup Skill (Phase 4) & Batch MCP Authoring — Design Specification

- **Date:** 2026-11-08
- **Status:** Approved
- **Scope:**
  1. Harden KRAKINAI's MCP staging engine (`src/domain/mcpGranularStaging.ts`, `src/domain/mcpProtocol.ts`, `src/connections/proposalBroker.ts`) and add Tool #37 (`krakinai_stage_storyboard_batch`) for high-throughput, error-free storyboard ingestion.
  2. Create the standalone **Phase 4 Skill** (`C:\Users\HomePC\.gemini\config\skills\standalone_phase_4_skill_krakinai_setup\SKILL.md`, `name: story-krakinai-setup`) that guides agents from Phase 3 outputs (`03_director_storyboard.md` + `03_storyboard_prompts.json`) into a complete, verified KRAKINAI setup.
  3. Upgrade `C:\Users\HomePC\.gemini\config\skills\krakinai-story-authoring\SKILL.md` to align with the 37-tool MCP suite and fix its `ensemble` + `dialogueCues` contract examples.
  4. Update manual Chapter 10 (`docs/manual/10-technical-mcp-reference.md`) and Chapter 6 (`docs/manual/06-user-guide-ai-collaboration.md`) so the documentation integrity suite (`src/__tests__/manualDocsIntegrity.test.ts`) and PDF book remain 100% synchronized.

---

## 1. Problem Statement & Root Causes

The user has a 3-phase standalone storytelling pipeline:
1. **Phase 1 (`story-screenwriter`):** Raw story draft $\to$ `01_polished_script.md`
2. **Phase 2 (`story-script-editor`):** Editorial audit $\to$ `02_locked_shooting_script.md` (with *Director's Handoff Briefing*)
3. **Phase 3 (`story-director`):** Directorial & DP translation $\to$ `03_director_storyboard.md` (Reference Pack + 8-column table) and `03_storyboard_prompts.json` (12-layer shot objects with strict 3-plane `foreground`, `midground`, and `background_crowd` continuity).

When an agent attempts to take `03_director_storyboard.md` and `03_storyboard_prompts.json` (e.g., a 35-shot episode) and set it up in KRAKINAI, four friction points occur:

1. **Schema Conflict Between `ensemble` and Top-Level `dialogue`:**
   - `validateEnsembleRecipePatch` (`src/domain/ensembleChangeSetSchema.ts:158-169`) forbids top-level `dialogue`, `identitySource`, or `character`/`wardrobe` slot links whenever `op.ensemble` is present.
   - However, `stageSceneDialogueOperation` (`src/domain/mcpGranularStaging.ts:673-678`) attaches `args.dialogue` directly to `updatedOp.dialogue` even when `updatedOp.ensemble` exists, causing immediate `parseChangeSet` rejection.
   - Furthermore, the existing `krakinai-story-authoring/SKILL.md` (lines 222–249) shows an invalid example with both `ensemble` and top-level `dialogue`.
2. **Re-Staging a Recipe Overwrites Attached Sub-Objects:**
   - Calling `krakinai_stage_scene_recipe` on an existing `clientRef` replaces the entire operation object and drops previously staged `ensemble`, `dialogue`, `cameraComposition`, `blocking`, and `keyframes`, while also ignoring `args.overrides`.
3. **Round-Trip Bottleneck on Multi-Shot Storyboards:**
   - Staging 35 shots with assets, shots, recipes, ensembles, dialogue cues, camera compositions, and blocking currently requires ~200 sequential MCP tool calls.
4. **Cinematography Technique ID Mismatches:**
   - Phase 3 outputs human-readable cinematography specs (`"EWS / High Angle / 24mm Wide-Angle / Deep Focus / Slow crane down & push-in"` or `"MS / 15° Dutch Angle / Unsettling handheld tremor"`). If an agent passes shorthand technique strings instead of exact `CINEMATOGRAPHY_TECHNIQUES` IDs, `validateCameraComposition` rejects the operation.

---

## 2. Architecture & Component Design

### 2.1 MCP Engine Enhancements (`src/domain/mcpGranularStaging.ts`, `src/domain/mcpProtocol.ts`, `src/connections/proposalBroker.ts`)

#### A. Tool #37: `krakinai_stage_storyboard_batch`
A high-throughput staging tool that accepts a batch of project, asset candidates, outfit variants, shots, and composite scenes, applies them in dependency order into the target `changeSetId`, validates and previews once, and persists to the Proposal Review Inbox.

- **Input Schema (`MCP_INPUT_SCHEMAS.krakinai_stage_storyboard_batch`):**
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
  }, ['changeSetId'])
  ```
- **Execution Semantics (`stageStoryboardBatchOperation(draft, args)`):**
  1. If `args.title` or `args.description` is provided, updates `draft.title` / `draft.description`.
  2. For each item in `args.assets ?? []`, runs `stageAssetCandidateOperation`.
  3. For each item in `args.variants ?? []`, runs `stageOutfitVariantOperation`.
  4. If `args.project` is provided, runs `stageProjectOperation` (inheriting `changeSetId`).
  5. For each item in `args.shots ?? []`, runs `stageShotOperation` (defaulting `project` to `{ ref: projectClientRef }` or `{ id: projectId }` if omitted on the individual shot item).
  6. For each item in `args.scenes ?? []`, runs the enhanced `stageSceneRecipeOperation` (which also processes inline `ensemble`, `participants`, `dialogue`, `dialogueCues`, `cameraComposition`, `blocking`, `keyframes`, and `overrides`).
  7. Returns `{ changeSet, operationId, stagedCounts: { assets, variants, projects, shots, scenes } }`.

#### B. Composite & Non-Destructive `stageSceneRecipeOperation`
- **Preserves Existing Sub-Objects on Re-Stage:**
  - When updating an existing recipe operation (`existingOp`) matching `clientRef` or `operationId`, preserves `existingOp.ensemble`, `existingOp.dialogue`, `existingOp.cameraComposition`, `existingOp.blocking`, `existingOp.keyframes`, and `existingOp.overrides` unless explicitly replaced.
- **Supports Inline Composite Fields:**
  - `MCP_INPUT_SCHEMAS.krakinai_stage_scene_recipe` and `stageSceneRecipeOperation` accept optional inline:
    - `ensemble` (object with `participants`/`participantUpserts`, `primaryParticipantId`, `removeParticipantIds`, `dialogueCues`) or top-level `participants` array
    - `dialogue` (single cue object) and `dialogueCues` (array of cues)
    - `cameraComposition` (object or shorthand)
    - `blocking` (v5 blocking patch object; requires v5 blocking capability/scope when present)
    - `keyframes` / `keyframePlan` (v6 keyframe patch object; requires v6 keyframe capability/scope when present)
    - `overrides` (`Partial<Record<BuilderSlot, RecipeComponentOverride>>`)
- **Automatic Slot Conflict Prevention with `ensemble`:**
  - When `ensemble` is present on a recipe operation, `assetRefs` automatically strips `character` and `wardrobe` slot links (or moves them into `ensemble.participantUpserts` if not already present) and removes top-level `dialogue` and `identitySource` so `validateEnsembleRecipePatch` never fails.

#### C. Auto-Normalized `stageSceneDialogueOperation`
- When `args.dialogue` (single cue object) is passed to `stageSceneDialogueOperation`:
  - If `updatedOp.ensemble` is already present on the target scene, `args.dialogue` is automatically converted into a single-element `ensemble.dialogueCues` entry (`id: 'cue-1'`, `speaker`, `line`, `participantId`, `mode`, `deliveryNotes`, `timing`, `performanceDirection`), and top-level `updatedOp.dialogue` is deleted.
- When `args.dialogueCues` is passed:
  - Always deletes any lingering top-level `updatedOp.dialogue` so `validateEnsembleRecipePatch` passes cleanly.
- Normalizes `timing`: ensures `startSeconds >= 0`, `endSeconds > startSeconds`, and `endSeconds <= durationSeconds` (clamping to the scene's `settings.durationSeconds` if a cue slightly exceeds the clip duration).

#### D. Smart Cinematography Alias Resolution (`normalizeCameraComposition`)
Maps both exact `CINEMATOGRAPHY_TECHNIQUES` IDs and common directorial shorthands from `03_storyboard_prompts.json` / `03_director_storyboard.md`:
- **Shot Sizes:** `ews` / `extreme-wide` / `extreme_wide` $\to$ `shot-size.extreme-wide`; `ws` / `wide` / `wide-shot` $\to$ `shot-size.wide-long-shot`; `mws` / `medium-wide` / `medium_wide` $\to$ `shot-size.medium-wide`; `fs` / `full-shot` $\to$ `shot-size.full-shot`; `ms` / `medium` / `medium-shot` $\to$ `shot-size.medium-shot`; `mcu` / `medium-close-up` $\to$ `shot-size.medium-close-up`; `cu` / `close-up` $\to$ `shot-size.close-up`; `ecu` / `extreme-close-up` $\to$ `shot-size.extreme-close-up`.
- **Angles:** `eye-level` / `eye_level` $\to$ `angle.eye-level`; `low-angle` / `low_angle` $\to$ `angle.low-angle`; `high-angle` / `high_angle` $\to$ `angle.high-angle`; `dutch` / `dutch-angle` / `dutch-tilt` / `dutch_tilt` $\to$ `angle.dutch-tilt`; `overhead` / `birds-eye` $\to$ `angle.overhead-birds-eye`; `worms-eye` $\to$ `angle.worms-eye`.
- **Framing:** `single` / `dirty-single` $\to$ `framing.single`; `two-shot` / `two_shot` $\to$ `framing.two-shot`; `three-shot` / `group` $\to$ `framing.group-crowd`; `ots` / `over-the-shoulder` $\to$ `framing.over-the-shoulder`; `pov` / `point-of-view` $\to$ `framing.point-of-view`; `symmetrical` / `centered` $\to$ `framing.centered-symmetrical`.
- **Movement:** `static` / `locked-off` $\to$ `movement.static-locked-off`; `push-in` / `dolly-in` $\to$ `movement.push-in-dolly-in`; `pull-back` / `dolly-out` $\to$ `movement.pull-back-dolly-out`; `pan` / `whip-pan` $\to$ `movement.pan`; `tilt` / `tilt-up` / `tilt-down` $\to$ `movement.tilt`; `tracking` / `trucking` $\to$ `movement.tracking-trucking`; `arc` / `orbit` $\to$ `movement.arc-orbit`; `crane` / `jib` $\to$ `movement.crane-jib`; `handheld` $\to$ `movement.handheld`; `steadicam` $\to$ `movement.steadicam`.
- **Depth of Field:** `shallow` / `shallow-dof` / `shallow_dof` / `bokeh` $\to$ `depth-of-field.shallow-dof`; `deep` / `deep-focus` / `deep_focus` $\to$ `depth-of-field.deep-focus`; `rack-focus` / `rack_focus` $\to$ `depth-of-field.rack-focus`.
- Filters out any unrecognized strings and falls back to `['shot-size.medium-shot']` if empty so `validateCameraComposition` never crashes on an unknown alias.

---

### 2.2 Standalone Phase 4 Skill: `story-krakinai-setup`

- **Location:** `C:\Users\HomePC\.gemini\config\skills\standalone_phase_4_skill_krakinai_setup\SKILL.md`
- **Frontmatter:**
  ```yaml
  ---
  name: story-krakinai-setup
  description: Use when setting up, staging, or importing Phase 3 director storyboards (03_director_storyboard.md and 03_storyboard_prompts.json) or multi-shot scripts into KRAKINAI via MCP tools.
  version: 1.0.0
  input_artifact: 03_director_storyboard.md AND 03_storyboard_prompts.json
  output_artifact: 04_krakinai_setup_report.md
  ---
  ```
- **Core Responsibilities Taught by the Skill:**
  1. **Mandatory Tool Discovery & Scope Check:**
     - Always begin by calling `krakinai_connection_status`, `krakinai_list_catalog_presets` (`cinematography`, `performance`, `shot_types`), `krakinai_search_assets`, and `krakinai_list_projects`.
     - Inspect active browser permissions (`allowProposals`, `allowBlockingProposals`, `allowKeyframeProposals`). If a required permission is disabled, instruct the user which toggle to enable in **Settings & Backup $\to$ AI Connections** or gracefully adapt to the permitted contract level (`v3` vs `v5` vs `v6`).
  2. **12-Layer to KRAKINAI Recipe Mapping Contract:**
     - **Characters (`kind: "character"`):** Permanent physiology only (age, facial structure, eyes, hair, skin, build). Zero clothing or temporary states.
     - **Wardrobe State Matrix (`kind: "wardrobe"`):** Create distinct wardrobe candidates for every costume state transition across the storyboard (e.g., `ward-silvester-clean-linen` for Shots 01–14, `ward-silvester-scorched-sleeve` for Shots 15–25, `ward-silvester-sludge-torn` for Shots 26–35; `ward-orin-clean-vestments` for Shots 01–27, `ward-orin-sludge-hem` for Shots 28–35).
     - **Environments (`kind: "environment"`) & Lighting (`kind: "lighting"`) & Style (`kind: "style"`):** Extract the fixed spatial geography invariant (`North/Center/Upper/South`) and each lighting/color script phase (`3200K/6500K Class Divide`, `9000K Sapphire Fire`, `2800K Golden Dragon`, `4500K Chartreuse Horror`, `7000K Storm Exile`) into reusable assets bound via `slots: { environment, lighting, style }`.
     - **Ensemble & Dialogue Cues:** Bind every character present in the shot (`on_camera` or `off_camera` for O.S. speakers and foreground dirty-single shoulders) with their active wardrobe and observable `performanceNotes`. Map all spoken dialogue into `dialogueCues` with valid `timing: { startSeconds, endSeconds }` within `durationSeconds`.
     - **3-Plane Crowd Permanence (`FG` / `MG` / `BG`) & Audio Preservation:**
       - Format `sceneInstructions` with four deterministic sections so KRAKINAI's prompt assembler (`SCENE_COMPONENT_ORDER`) outputs every layer without truncation:
         1. `[3-PLANE STAGING — FG / MG / BG]` (verbatim `blocking.foreground`, `blocking.midground`, `blocking.background_crowd`)
         2. `[OPTICS & CAMERA DYNAMICS]` (exact focal length, lens, DOF, and movement trajectory)
         3. `[INTERACTIVE LIGHTING & VFX]` (shot-specific bounce light and hero prop/VFX behavior)
         4. `[AUDIO, FOLEY & CONTINUITY LOCKS]` (`audio.ambience`, `audio.foley`, and `continuity` rules)
       - Populate `avoidText` with `output.forbidden_transitions` + `"No generated music, no captions, no empty background hall."`
       - When `allowBlockingProposals` (`v5`) is active, also populate structured `blocking` (`landmarkUpserts` + `participantUpserts` with `zone`, `depth`, `visibility`).
  3. **Batch & Granular Staging Execution:**
     - Use `krakinai_stage_storyboard_batch` to stage the project, all asset/wardrobe candidates, all shots (`SHOT_01`–`SHOT_35`), and all composite scene recipes in 1–2 calls (or use individual `krakinai_stage_*` tools for targeted updates).
  4. **Verification & Continuity Audit Gate:**
     - Call `krakinai_preview_scene_assembly` on representative shots to inspect assembled prompt sections and verify zero `blocking` preflight findings (`P000`–`P008`).
     - Call `krakinai_check_spatial_continuity` on the staged `changeSetId` to audit 180-degree axis and zone jumps.
     - Call `krakinai_get_proposal_status` to confirm the proposal is `review_required` with `blockingFindingCount: 0`.
  5. **Required Output Artifact (`04_krakinai_setup_report.md`):**
     - Summarizes the proposal ID, changeSetId, schema version, asset & wardrobe state matrix, shot-by-shot recipe binding table, preflight & spatial continuity audit results, and user approval instructions in KRAKINAI's Review Inbox.

---

### 2.3 Upgrading `krakinai-story-authoring` Skill

- **Location:** `C:\Users\HomePC\.gemini\config\skills\krakinai-story-authoring\SKILL.md`
- **Updates:**
  - Fix the Phase 4 JSON example so `dialogueCues` is inside `ensemble` (never top-level `dialogue` alongside `ensemble`).
  - Document the full 37-tool MCP workflow (`krakinai_stage_storyboard_batch` + granular `krakinai_stage_*` tools + `krakinai_preview_scene_assembly` + `krakinai_check_spatial_continuity`).
  - Cross-reference `story-krakinai-setup` for Phase 3 (`03_storyboard_prompts.json`) ingestion.

---

## 3. Testing & Verification Strategy

1. **Unit & Integration Tests (`src/__tests__/mcpGranularBroker.test.ts`):**
   - Test `krakinai_stage_storyboard_batch` staging a complete multi-shot storyboard (project + characters + wardrobes + environments + lighting + style + shots + composite scenes with ensemble, dialogueCues, cameraComposition, and avoidText) in a single call and verifying `previewChangeSet` passes with `blockingFindingCount === 0`.
   - Test `krakinai_stage_scene_recipe` non-destructive re-staging (updating `sceneInstructions` or `slots` preserves previously staged `ensemble`, `dialogueCues`, `cameraComposition`, and `blocking`).
   - Test `krakinai_stage_scene_dialogue` auto-converting single `dialogue` into `ensemble.dialogueCues` when `ensemble` is present on the scene.
   - Test `normalizeCameraComposition` resolving shorthand aliases (`EWS`, `MCU`, `low-angle`, `dutch`, `crane`, `shallow-dof`, `deep-focus`, `ots`).
2. **Documentation & Skill Integrity Tests (`src/__tests__/manualDocsIntegrity.test.ts`):**
   - Verify all 37 `MCP_TOOL_NAMES` are documented in `docs/manual/10-technical-mcp-reference.md`.
   - Rebuild the manual PDF (`npm run docs:manual`) and verify clean exit.
   - Run `npx tsc --noEmit` to verify zero TypeScript errors.
