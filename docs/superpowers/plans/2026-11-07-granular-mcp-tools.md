# Granular MCP Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose 23 granular MCP read, inspection, and incremental proposal-staging tools across all KRAKINAI domains so AI agents can inspect assets, catalogs, continuity, saved scenes, and inbox state and author multi-shot storyboards step-by-step without monolithic ChangeSet JSON files.

**Architecture:** Introduce a pure incremental staging module (`src/domain/mcpGranularStaging.ts`) that translates ergonomic tool inputs into canonical `ChangeOperation` items, orders them deterministically by dependency, and automatically promotes package schemas (`v3` -> `v4` -> `v5` -> `v6`). Extend `ReviewInboxRepository` and `ProposalInbox` to allow in-place updates of unapplied draft proposals (`allowPackageUpdate: true`, resetting approval state and recomputing `packageDigest` and `previewChangeSet`), add granular read projections (`src/domain/mcpGranularReads.ts`), and wire all 23 tools through `mcpProtocol.ts`, `ProposalBroker`, and `bridge/src/registerTools.ts`.

**Tech Stack:** TypeScript, React 18, IndexedDB (`krakinai_review_inbox_db` / `krakinai_db`), Model Context Protocol SDK (`@modelcontextprotocol/sdk`), Vitest.

**Spec:** [`docs/superpowers/specs/2026-11-07-granular-mcp-tools-design.md`](../specs/2026-11-07-granular-mcp-tools-design.md)

## Global Constraints

- Preserve all 13 existing MCP tools (`krakinai_connection_status` through `krakinai_get_generation_prompt`) with zero breaking changes to their input schemas or return shapes.
- Never write directly to the main browser IndexedDB (`krakinai_db`) from an MCP tool; all `krakinai_stage_*` tools must stage into `ProposalInbox` (`krakinai_review_inbox_db`) and require human browser confirmation to apply.
- Enforce `McpScope` permissions (`authorizedProjectIds`, `authorizedAssetIds`, `authorizedSceneIds`, `includeAssetText`, `includeCharacterIdentity`, `includeNotes`, `includeMediaFilenames`, `fullPromptSceneIds`, `allowProposals`, `allowBlockingProposals`, `allowKeyframeProposals`) on every tool.
- Automatically promote staged `ChangeSet.schema` to the minimum required version (`krakinai.change-set.v3` default, `v4` when `scene.convert_direct_to_recipe` is present, `v5` when `blocking` is present, `v6` when `keyframePlan` or `frame_image.*` is present) and never downgrade a higher schema version already on the draft.
- When an unapplied draft proposal is modified in place via a `krakinai_stage_*` tool, reset its `approval` to `emptyChangeSetApproval()` and recompute `packageDigest` and `previewChangeSet`.

## Review Focus

1. **Mutating a proposal that is already `applied` or `applying`**: `krakinai_stage_*` and `krakinai_discard_proposal` must reject mutations to proposals whose disposition is `applying` or `applied` with `CONFLICT` so immutable receipt history is never corrupted.
2. **Upserting sub-blocks (`ensemble`, `dialogue`, `cameraComposition`, `blocking`, `keyframePlan`) before the parent scene recipe exists**: Calling `krakinai_stage_scene_ensemble` or `krakinai_stage_scene_blocking` with a `sceneClientRef` that does not match any staged `scene.*` operation in the draft must throw `NOT_FOUND` with a clear message telling the caller to call `krakinai_stage_scene_recipe` first.
3. **Resetting human approval when a staged proposal is modified**: If a reviewer partially approved operations in the browser UI and the agent subsequently calls `krakinai_stage_shot` on the same `changeSetId`, `approval` must reset to `emptyChangeSetApproval()` so stale approvals cannot apply mutated operations.
4. **Scope & capability gate enforcement on incremental v5/v6 promotion**: Calling `krakinai_stage_scene_blocking` without `scope.allowBlockingProposals` (or v2/v3 session capability) or `krakinai_stage_keyframe_plan` / `krakinai_stage_frame_image` without `scope.allowKeyframeProposals` (or v3 session capability) must fail with `PERMISSION_DENIED` before mutating the inbox.
5. **Private text leakage in granular read tools**: `krakinai_get_asset` must redact `promptText`/`compactText`/`description` unless `scope.includeAssetText` is true and redact `identityAnchor` unless `scope.includeCharacterIdentity` is true; `krakinai_export_scene_prompts` must reject any `sceneId` not in `scope.fullPromptSceneIds` with `PERMISSION_DENIED`.

---

## File Structure

- **Create:** [`src/domain/mcpGranularStaging.ts`](../../../src/domain/mcpGranularStaging.ts) — Pure functions that build/upsert `ChangeOperation` records into a draft `ChangeSet`, maintain canonical operation dependency ordering, and compute minimum required schema (`v3`/`v4`/`v5`/`v6`).
- **Create:** [`src/domain/mcpGranularReads.ts`](../../../src/domain/mcpGranularReads.ts) — Scope-aware read projections for `krakinai_get_asset`, `krakinai_list_catalog_presets`, `krakinai_get_project_continuity`, `krakinai_check_spatial_continuity`, `krakinai_preview_scene_assembly`, `krakinai_list_saved_scenes`, and `krakinai_export_scene_prompts`.
- **Modify:** [`src/types/proposalReview.ts`](../../../src/types/proposalReview.ts) — Add `allowPackageUpdate?: boolean` to `ReviewUpdateOptions`.
- **Modify:** [`src/storage/proposalReviewInbox.ts`](../../../src/storage/proposalReviewInbox.ts) — Allow updating `changeSet`, `packageDigest`, and `preview` on unapplied inbox records when `options.allowPackageUpdate === true`.
- **Modify:** [`src/connections/proposalInbox.ts`](../../../src/connections/proposalInbox.ts) — Add `upsertDraftChangeSet(changeSet: ChangeSet): Promise<ProposalRecord>` and `discard(proposalId: string): Promise<{ discarded: true; proposalId: string }>`.
- **Modify:** [`src/domain/mcpProtocol.ts`](../../../src/domain/mcpProtocol.ts) — Register all 23 new tool names in `MCP_TOOL_NAMES` (bringing total to 36) and add their strict `FieldSchema` definitions in `MCP_INPUT_SCHEMAS`.
- **Modify:** [`src/connections/proposalBroker.ts`](../../../src/connections/proposalBroker.ts) — Route the 23 new tools in `ProposalBroker.handle(...)` with scope, rate-limit, and capability checks.
- **Modify:** [`bridge/src/registerTools.ts`](../../../bridge/src/registerTools.ts) — Mark `krakinai_submit_change_set`, `krakinai_discard_proposal`, and all `krakinai_stage_*` tools with `readOnlyHint: false` while keeping read tools `readOnlyHint: true`.
- **Create:** [`src/__tests__/mcpGranularStaging.test.ts`](../../../src/__tests__/mcpGranularStaging.test.ts) — Unit tests for incremental operation staging, dependency ordering, and schema promotion.
- **Create:** [`src/__tests__/mcpGranularReads.test.ts`](../../../src/__tests__/mcpGranularReads.test.ts) — Unit tests for all granular read tools and `McpScope` redaction rules.
- **Create:** [`src/__tests__/mcpGranularBroker.test.ts`](../../../src/__tests__/mcpGranularBroker.test.ts) — End-to-end `ProposalBroker` + `ProposalInbox` tests for granular staging, approval reset on mutation, capability gating, and inbox discard.
- **Modify:** [`src/__tests__/blockingMcpCapabilities.test.ts`](../../../src/__tests__/blockingMcpCapabilities.test.ts) — Update `MCP_TOOL_NAMES` length assertion from `13` to `36`.

---

### Task 1: Incremental Proposal Staging Engine (`src/domain/mcpGranularStaging.ts`)

**Files:**
- Create: `src/domain/mcpGranularStaging.ts`
- Test: `src/__tests__/mcpGranularStaging.test.ts`

**Interfaces:**
- Consumes: `ChangeSet`, `ChangeOperation`, `SceneRecipeOperationPayload`, `EntityRef` from `src/types/changeSet.ts`; `BlockingSpec` from `src/types/blocking.ts`; `KeyframePlan` from `src/types/keyframes.ts`
- Produces:
  - `createEmptyDraftChangeSet(changeSetId: string, title?: string, summary?: string): ChangeSet`
  - `stageProjectOperation(draft: ChangeSet, args: Record<string, unknown>): { changeSet: ChangeSet; operationId: string }`
  - `stageShotOperation(draft: ChangeSet, args: Record<string, unknown>): { changeSet: ChangeSet; operationId: string }`
  - `stageShotOrderOperation(draft: ChangeSet, args: Record<string, unknown>): { changeSet: ChangeSet; operationId: string }`
  - `stageShotStatusOperation(draft: ChangeSet, args: Record<string, unknown>): { changeSet: ChangeSet; operationId: string }`
  - `stageAssetCandidateOperation(draft: ChangeSet, args: Record<string, unknown>): { changeSet: ChangeSet; operationId: string }`
  - `stageOutfitVariantOperation(draft: ChangeSet, args: Record<string, unknown>): { changeSet: ChangeSet; operationId: string }`
  - `stageSceneRecipeOperation(draft: ChangeSet, args: Record<string, unknown>): { changeSet: ChangeSet; operationId: string }`
  - `stageSceneEnsembleOperation(draft: ChangeSet, args: Record<string, unknown>): { changeSet: ChangeSet; operationId: string }`
  - `stageSceneDialogueOperation(draft: ChangeSet, args: Record<string, unknown>): { changeSet: ChangeSet; operationId: string }`
  - `stageCameraCompositionOperation(draft: ChangeSet, args: Record<string, unknown>): { changeSet: ChangeSet; operationId: string }`
  - `stageDirectToRecipeOperation(draft: ChangeSet, args: Record<string, unknown>): { changeSet: ChangeSet; operationId: string }`
  - `stageSceneBlockingOperation(draft: ChangeSet, args: Record<string, unknown>): { changeSet: ChangeSet; operationId: string }`
  - `stageKeyframePlanOperation(draft: ChangeSet, args: Record<string, unknown>): { changeSet: ChangeSet; operationId: string }`
  - `stageFrameImageOperation(draft: ChangeSet, args: Record<string, unknown>): { changeSet: ChangeSet; operationId: string }`

- [x] **Step 1: Write failing unit tests in `src/__tests__/mcpGranularStaging.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import {
  createEmptyDraftChangeSet,
  stageAssetCandidateOperation,
  stageCameraCompositionOperation,
  stageDirectToRecipeOperation,
  stageFrameImageOperation,
  stageKeyframePlanOperation,
  stageOutfitVariantOperation,
  stageProjectOperation,
  stageSceneBlockingOperation,
  stageSceneDialogueOperation,
  stageSceneEnsembleOperation,
  stageSceneRecipeOperation,
  stageShotOperation,
  stageShotOrderOperation,
  stageShotStatusOperation,
} from '../domain/mcpGranularStaging';
import { validateChangeSetShape } from '../domain/changeSetValidate';

describe('mcpGranularStaging', () => {
  it('builds a valid ChangeSet in canonical dependency order across granular calls', () => {
    let draft = createEmptyDraftChangeSet('cs-ep1', 'Episode 1 Draft');

    draft = stageSceneRecipeOperation(draft, {
      clientRef: 'scene-s01',
      project: { ref: 'proj-ep1' },
      shot: { ref: 'shot-s01' },
      title: 'S01 Opening',
      shotType: 'Establishing / World Concept',
      settings: { outputType: 'Video Prompts', quantity: 1, AspectRatio: '16:9', Duration: '8s' },
      slots: { characters: [{ ref: 'char-hero' }], environment: { ref: 'env-lab' }, actions: [{ ref: 'act-wake' }], camera: null, lighting: null, style: null },
      sceneInstructions: 'Slow awakening.',
    }).changeSet;

    draft = stageShotOperation(draft, {
      clientRef: 'shot-s01',
      project: { ref: 'proj-ep1' },
      code: 'S01',
      title: 'Cold Open',
      plannedShotType: 'Establishing / World Concept',
      plannedDurationSeconds: 8,
    }).changeSet;

    draft = stageProjectOperation(draft, {
      clientRef: 'proj-ep1',
      name: 'Episode 1',
      description: 'Pilot episode',
    }).changeSet;

    draft = stageAssetCandidateOperation(draft, {
      clientRef: 'char-hero',
      kind: 'Characters',
      title: 'Silvester',
      promptText: 'A tall silver-furred tabby cat with amber eyes.',
    }).changeSet;

    draft = stageAssetCandidateOperation(draft, {
      clientRef: 'env-lab',
      kind: 'Environments',
      title: 'Bedroom',
      promptText: 'Sunlit hardwood bedroom.',
    }).changeSet;

    draft = stageAssetCandidateOperation(draft, {
      clientRef: 'act-wake',
      kind: 'Actions',
      title: 'Waking Up',
      promptText: 'Blinks slowly and stretches.',
    }).changeSet;

    draft = stageOutfitVariantOperation(draft, {
      clientRef: 'outfit-collar',
      parentCharacterId: 'asset-existing-char',
      expectedParentRevision: 2,
      title: 'Red Collar',
      promptText: 'Wears a stitched crimson leather collar.',
    }).changeSet;

    // Verify canonical dependency order: assets/variants -> project -> shot -> scene
    expect(draft.operations.map((op) => op.type)).toEqual([
      'asset.propose',
      'asset.propose',
      'asset.propose',
      'variant.propose',
      'project.create',
      'shot.create',
      'scene.create_recipe',
    ]);

    const shapeIssues = validateChangeSetShape(draft);
    expect(shapeIssues).toEqual([]);
  });

  it('patches ensemble, dialogue, cameraComposition, blocking (v5), and keyframePlan (v6) onto a staged scene recipe', () => {
    let draft = createEmptyDraftChangeSet('cs-patch', 'Patch Test');
    draft = stageSceneRecipeOperation(draft, {
      clientRef: 'scene-s01',
      project: { id: 'proj-1' },
      shot: { id: 'shot-1' },
      title: 'S01',
      shotType: 'Dialogue / Duo Scene',
      settings: { outputType: 'Video Prompts', quantity: 1 },
      slots: { characters: [{ id: 'char-1' }], environment: { id: 'env-1' }, actions: [{ id: 'act-1' }], camera: null, lighting: null, style: null },
    }).changeSet;

    expect(draft.schema).toBe('krakinai.change-set.v3');

    draft = stageSceneEnsembleOperation(draft, {
      sceneClientRef: 'scene-s01',
      primaryParticipantId: 'p-1',
      participants: [
        { id: 'p-1', characterAsset: { id: 'char-1' }, outfitVariant: null, label: 'Hero', order: 0 },
      ],
    }).changeSet;

    draft = stageSceneDialogueOperation(draft, {
      sceneClientRef: 'scene-s01',
      dialogueCues: [
        { id: 'cue-1', speakerParticipantId: 'p-1', lineText: 'Where am I?', order: 0, startSeconds: 1, endSeconds: 3 },
      ],
    }).changeSet;

    draft = stageCameraCompositionOperation(draft, {
      sceneClientRef: 'scene-s01',
      cameraComposition: { shotSize: 'medium_close_up', angle: 'eye_level', movement: 'slow_push_in' },
    }).changeSet;

    // Staging blocking promotes schema to v5
    draft = stageSceneBlockingOperation(draft, {
      sceneClientRef: 'scene-s01',
      blocking: {
        version: 1,
        landmarks: [{ id: 'lm-bed', label: 'Bed', zone: 'center', depth: 'midground' }],
        participants: [
          {
            participantId: 'p-1',
            start: { zone: 'center', depth: 'midground', posture: 'lying', facing: 'camera' },
            action: { verb: 'rises slowly' },
            end: { zone: 'center', depth: 'midground', posture: 'sitting', facing: 'camera' },
          },
        ],
      },
    }).changeSet;
    expect(draft.schema).toBe('krakinai.change-set.v5');

    // Staging keyframePlan promotes schema to v6
    draft = stageKeyframePlanOperation(draft, {
      sceneClientRef: 'scene-s01',
      keyframePlan: {
        version: 1,
        frames: [
          { id: 'frame-start', label: 'Start Frame', kind: 'start', order: 0, beatDescription: 'Eyes closed on bed' },
          { id: 'frame-end', label: 'End Frame', kind: 'end', order: 1, beatDescription: 'Sitting upright looking at paws' },
        ],
      },
    }).changeSet;
    expect(draft.schema).toBe('krakinai.change-set.v6');
  });

  it('throws NOT_FOUND when patching a sceneClientRef that does not exist in the draft', () => {
    const draft = createEmptyDraftChangeSet('cs-missing');
    expect(() =>
      stageSceneEnsembleOperation(draft, {
        sceneClientRef: 'nonexistent',
        participants: [],
      }),
    ).toThrow(/sceneClientRef/i);
  });

  it('promotes schema to v4 for direct-to-recipe conversion and supports shot order, status, and frame_image ops', () => {
    let draft = createEmptyDraftChangeSet('cs-v4');
    draft = stageDirectToRecipeOperation(draft, {
      clientRef: 'scene-conv-1',
      project: { id: 'proj-1' },
      shot: { id: 'shot-1' },
      sceneId: 'scene-legacy-1',
      expectedHeadId: 'scene-legacy-1',
      conversion: { sourceSceneId: 'scene-legacy-1', sourceMode: 'direct', selectConvertedTake: false, preserveDirectTake: true },
      title: 'Converted S01',
      shotType: 'Action / Motion Beat',
      settings: { outputType: 'Video Prompts', quantity: 1 },
      slots: { characters: [{ id: 'char-1' }], environment: { id: 'env-1' }, actions: [{ id: 'act-1' }], camera: null, lighting: null, style: null },
    }).changeSet;
    expect(draft.schema).toBe('krakinai.change-set.v4');

    draft = stageShotOrderOperation(draft, {
      project: { id: 'proj-1' },
      shots: [{ id: 'shot-1' }, { id: 'shot-2' }],
    }).changeSet;

    draft = stageShotStatusOperation(draft, {
      project: { id: 'proj-1' },
      shot: { id: 'shot-1' },
      status: 'ready',
      expectedStatus: 'planned',
    }).changeSet;

    draft = stageFrameImageOperation(draft, {
      project: { id: 'proj-1' },
      shot: { id: 'shot-1' },
      scene: { ref: 'scene-conv-1' },
      frameId: 'frame-1',
      mediaId: 'media-1',
      expectedAssociationRevision: 0,
    }).changeSet;
    expect(draft.schema).toBe('krakinai.change-set.v6');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cmd /c npx vitest run src/__tests__/mcpGranularStaging.test.ts`
Expected: FAIL with `Cannot find module '../domain/mcpGranularStaging'`

- [x] **Step 3: Implement `src/domain/mcpGranularStaging.ts`**

Implement the pure staging functions in `src/domain/mcpGranularStaging.ts`:
- Assign deterministic operation priority buckets for canonical sorting:
  1. `asset.propose`, `variant.propose` (bucket `10`)
  2. `project.create`, `project.update` (bucket `20`)
  3. `shot.create`, `shot.update`, `shot.reorder` (bucket `30`)
  4. `scene.create_recipe`, `scene.revise_recipe`, `scene.create_recipe_take`, `scene.convert_direct_to_recipe` (bucket `40`)
  5. `shot.attach_take`, `shot.select_take`, `shot.set_status`, `frame_image.link`, `frame_image.clear` (bucket `50`)
- When upserting an operation, match by `operationId` or `clientRef` (or deterministic composite key such as `op-shot-order-${projectKey}` for `shot.reorder` and `op-frame-image-${sceneKey}-${frameId}` for `frame_image.*`).
- Compute `schema` via `resolveMinimumSchema(draft)`:
  - `'krakinai.change-set.v6'` if any scene op has `keyframePlan` or any op is `frame_image.link` / `frame_image.clear` (or existing schema is already `v6`).
  - `'krakinai.change-set.v5'` if any scene op has `blocking` (or existing schema is already `v5`).
  - `'krakinai.change-set.v4'` if any op is `scene.convert_direct_to_recipe` (or existing schema is already `v4`).
  - `'krakinai.change-set.v3'` otherwise.
- When `stageSceneEnsembleOperation`, `stageSceneDialogueOperation`, `stageCameraCompositionOperation`, `stageSceneBlockingOperation`, or `stageKeyframePlanOperation` cannot find a scene operation matching `sceneClientRef` (by `clientRef` or `operationId`), throw `mcpError('NOT_FOUND', 'No staged scene recipe matches sceneClientRef. Call krakinai_stage_scene_recipe first.', { sceneClientRef })`.

- [x] **Step 4: Run test to verify it passes**

Run: `cmd /c npx vitest run src/__tests__/mcpGranularStaging.test.ts`
Expected: PASS (4 passed)

- [x] **Step 5: Commit**

```bash
git add src/domain/mcpGranularStaging.ts src/__tests__/mcpGranularStaging.test.ts
git commit -m "feat(mcp): add incremental proposal staging engine"
```

---

### Task 2: Granular Read & Inspection Tools (`src/domain/mcpGranularReads.ts`)

**Files:**
- Create: `src/domain/mcpGranularReads.ts`
- Test: `src/__tests__/mcpGranularReads.test.ts`

**Interfaces:**
- Consumes: `LibrarySnapshot`, `McpScope`, `mcpError` from `src/domain/mcpProtocol.ts`; `CINEMATOGRAPHY_PRESETS` / camera constants from `src/constants/cinematography.ts`; `PERFORMANCE_CATALOG` from `src/constants/performanceCatalog.ts`; `SHOT_TYPE_TEMPLATES` from `src/constants/shotTypes.ts`; `buildContinuityWorkspace` from `src/domain/continuityWorkspace.ts`; `evaluateProjectBlockingContinuity` from `src/domain/blockingContinuity.ts`; `assemblePrompt` from `src/domain/assembler.ts`; `runScenePreflight` from `src/domain/preflight.ts`; `formatSelectedPrompts` from `src/domain/projectExport.ts`
- Produces:
  - `readAssetDetail(snapshot: LibrarySnapshot, scope: McpScope, args: { id: string }): Record<string, unknown>`
  - `readCatalogPresets(args: { catalog: 'cinematography' | 'performance' | 'shot_types' }): Record<string, unknown>`
  - `readProjectContinuity(snapshot: LibrarySnapshot, scope: McpScope, args: { projectId: string }): Record<string, unknown>`
  - `readSpatialContinuity(snapshot: LibrarySnapshot, scope: McpScope, args: { projectId: string }, stagedChangeSet?: ChangeSet): Record<string, unknown>`
  - `readSceneAssemblyPreview(snapshot: LibrarySnapshot, scope: McpScope, args: { sceneId?: string; changeSetId?: string; sceneClientRef?: string }, stagedChangeSet?: ChangeSet): Record<string, unknown>`
  - `readSavedScenesList(snapshot: LibrarySnapshot, scope: McpScope, args: { query?: string; archiveFilter?: 'active' | 'archived' | 'all'; shotType?: string; reviewStatus?: string; cursor?: string; limit?: number }): Record<string, unknown>`
  - `readExportedScenePrompts(snapshot: LibrarySnapshot, scope: McpScope, args: { sceneIds: string[] }): Record<string, unknown>`

- [x] **Step 1: Write failing unit tests in `src/__tests__/mcpGranularReads.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import {
  readAssetDetail,
  readCatalogPresets,
  readExportedScenePrompts,
  readProjectContinuity,
  readSavedScenesList,
  readSceneAssemblyPreview,
  readSpatialContinuity,
} from '../domain/mcpGranularReads';
import { createDefaultMcpScope } from '../domain/mcpProtocol';
import type { LibrarySnapshot } from '../domain/mcpReads';

const mockSnapshot: LibrarySnapshot = {
  projects: [
    {
      id: 'proj-1',
      name: 'Ep 1',
      description: 'Test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      shots: [
        { id: 'shot-1', shotCode: 'S01', title: 'Shot 1', order: 0, status: 'ready', sceneIds: ['scene-1'], selectedSceneId: 'scene-1' },
      ],
    },
  ],
  assets: [
    {
      id: 'char-1',
      kind: 'Characters',
      title: 'Silvester',
      promptText: 'Secret prompt text',
      compactText: 'Silver tabby',
      description: 'Main cat',
      tags: ['cat'],
      notes: 'Private note',
      isFavorite: true,
      revision: 1,
      identityAnchor: {
        status: 'approved',
        immutableTraits: 'Amber eyes, nicked ear',
        prohibitedDrift: 'No collar',
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'outfit-1',
      kind: 'Outfits',
      parentCharacterId: 'char-1',
      title: 'Winter Scarf',
      promptText: 'Knitted wool scarf',
      tags: ['winter'],
      isFavorite: false,
      revision: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  scenes: [
    {
      id: 'scene-1',
      headId: 'scene-1',
      versionNumber: 1,
      title: 'S01 Take 1',
      mode: 'recipe',
      shotType: 'Establishing / World Concept',
      settings: { outputType: 'Video Prompts', quantity: 1 },
      selectedAssetIds: {
        Characters: ['char-1'],
        Environments: [],
        Actions: [],
        Camera: null,
        Lighting: null,
        Style: null,
      },
      finalPrompt: 'Full assembled prompt for S01',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'scene-archived',
      headId: 'scene-archived',
      versionNumber: 1,
      title: 'Old Archived Take',
      mode: 'direct',
      shotType: 'Action / Motion Beat',
      settings: { outputType: 'Video Prompts', quantity: 1 },
      directPromptText: 'Archived prompt',
      finalPrompt: 'Archived prompt',
      archivedAt: '2026-02-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-02-01T00:00:00Z',
    },
  ],
  media: [],
};

describe('mcpGranularReads', () => {
  it('redacts promptText, notes, and identityAnchor in readAssetDetail unless granted by scope', () => {
    const minScope = {
      ...createDefaultMcpScope(),
      authorizedAssetIds: ['char-1', 'outfit-1'],
      includeAssetText: false,
      includeCharacterIdentity: false,
      includeNotes: false,
    };

    const redacted = readAssetDetail(mockSnapshot, minScope, { id: 'char-1' });
    expect(redacted.promptText).toBeUndefined();
    expect(redacted.notes).toBeUndefined();
    expect(redacted.identityAnchor).toEqual({ status: 'approved', redacted: true });
    expect((redacted.outfitVariants as Array<Record<string, unknown>>)[0].id).toBe('outfit-1');

    const fullScope = {
      ...minScope,
      includeAssetText: true,
      includeCharacterIdentity: true,
      includeNotes: true,
    };
    const full = readAssetDetail(mockSnapshot, fullScope, { id: 'char-1' });
    expect(full.promptText).toBe('Secret prompt text');
    expect(full.notes).toBe('Private note');
    expect((full.identityAnchor as Record<string, unknown>).immutableTraits).toBe('Amber eyes, nicked ear');
  });

  it('returns cinematography, performance, and shot_types presets from readCatalogPresets', () => {
    const cinema = readCatalogPresets({ catalog: 'cinematography' });
    expect(cinema.catalog).toBe('cinematography');
    expect(Array.isArray(cinema.shotSizes)).toBe(true);

    const perf = readCatalogPresets({ catalog: 'performance' });
    expect(perf.catalog).toBe('performance');
    expect(Array.isArray(perf.emotions)).toBe(true);
  });

  it('filters saved scenes by archiveFilter and enforces fullPromptSceneIds on export', () => {
    const scope = {
      ...createDefaultMcpScope(),
      authorizedSceneIds: ['scene-1', 'scene-archived'],
      fullPromptSceneIds: ['scene-1'],
    };

    const activeOnly = readSavedScenesList(mockSnapshot, scope, { archiveFilter: 'active' });
    expect((activeOnly.items as Array<{ id: string }>).map((s) => s.id)).toEqual(['scene-1']);

    const archivedOnly = readSavedScenesList(mockSnapshot, scope, { archiveFilter: 'archived' });
    expect((archivedOnly.items as Array<{ id: string }>).map((s) => s.id)).toEqual(['scene-archived']);

    const exported = readExportedScenePrompts(mockSnapshot, scope, { sceneIds: ['scene-1'] });
    expect(exported.text).toContain('Full assembled prompt for S01');

    expect(() =>
      readExportedScenePrompts(mockSnapshot, scope, { sceneIds: ['scene-archived'] }),
    ).toThrow(/Full prompt disclosure is not enabled/i);
  });

  it('reads project continuity, spatial continuity, and scene assembly preview for authorized projects/scenes', () => {
    const scope = {
      ...createDefaultMcpScope(),
      authorizedProjectIds: ['proj-1'],
      authorizedSceneIds: ['scene-1'],
      authorizedAssetIds: ['char-1'],
    };

    const cont = readProjectContinuity(mockSnapshot, scope, { projectId: 'proj-1' });
    expect(cont.projectId).toBe('proj-1');
    expect(Array.isArray(cont.cast)).toBe(true);

    const spatial = readSpatialContinuity(mockSnapshot, scope, { projectId: 'proj-1' });
    expect(spatial.projectId).toBe('proj-1');
    expect(Array.isArray(spatial.findings)).toBe(true);

    const assembly = readSceneAssemblyPreview(mockSnapshot, scope, { sceneId: 'scene-1' });
    expect(assembly.sceneId).toBe('scene-1');
    expect(Array.isArray(assembly.preflightFindings)).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cmd /c npx vitest run src/__tests__/mcpGranularReads.test.ts`
Expected: FAIL with `Cannot find module '../domain/mcpGranularReads'`

- [x] **Step 3: Implement `src/domain/mcpGranularReads.ts`**

Implement the 7 read/inspection functions in `src/domain/mcpGranularReads.ts`:
- `readAssetDetail`: Check `isAssetAuthorized(scope, asset.id)`. Return base fields (`id`, `kind`, `title`, `tags`, `isFavorite`, `revision`, `parentCharacterId`, `createdAt`, `updatedAt`), include `promptText`/`compactText`/`description` only when `scope.includeAssetText` is true, include `notes` only when `scope.includeNotes` is true, include full `identityAnchor` only when `scope.includeCharacterIdentity` is true (otherwise `{ status: asset.identityAnchor.status, redacted: true }`), and attach authorized child `Outfits` in `outfitVariants`.
- `readCatalogPresets`: Return structured preset lists from `src/constants/cinematography.ts`, `src/constants/performanceCatalog.ts`, or `src/constants/shotTypes.ts`.
- `readProjectContinuity`: Verify project authorization, run `buildContinuityWorkspace(project, authorizedScenes, authorizedAssets)`, and return `{ projectId, cast, transitions, warnings }`.
- `readSpatialContinuity`: Verify project authorization, evaluate spatial continuity across the project's shots (plus any staged `blocking` on `stagedChangeSet` when provided), and return `{ projectId, findings }`.
- `readSceneAssemblyPreview`: Support either `sceneId` (authorized existing scene) or `{ changeSetId, sceneClientRef }` (from `stagedChangeSet`). Run `assemblePrompt` + `runScenePreflight`, redacting `assembledPrompt` unless `sceneId` is in `scope.fullPromptSceneIds` (or for staged recipes, when all referenced assets are authorized and `scope.includeAssetText` is true).
- `readSavedScenesList`: Filter `snapshot.scenes` by `isSceneAuthorized(scope, scene.id)`, `archiveFilter` (`'active'` default -> `!scene.archivedAt`, `'archived'` -> `Boolean(scene.archivedAt)`, `'all'` -> all), `query`, `shotType`, and `reviewStatus`, then paginate.
- `readExportedScenePrompts`: Verify every ID in `args.sceneIds` is in `scope.authorizedSceneIds` and `scope.fullPromptSceneIds` (throwing `PERMISSION_DENIED` otherwise), then format with `formatSelectedPrompts(scenes)`.

- [x] **Step 4: Run test to verify it passes**

Run: `cmd /c npx vitest run src/__tests__/mcpGranularReads.test.ts`
Expected: PASS (4 passed)

- [x] **Step 5: Commit**

```bash
git add src/domain/mcpGranularReads.ts src/__tests__/mcpGranularReads.test.ts
git commit -m "feat(mcp): add granular read and inspection projections"
```

---

### Task 3: Review Inbox In-Place Draft Update & Discard (`src/types/proposalReview.ts`, `src/storage/proposalReviewInbox.ts`, `src/connections/proposalInbox.ts`)

**Files:**
- Modify: `src/types/proposalReview.ts:75-85`
- Modify: `src/storage/proposalReviewInbox.ts:48-85`
- Modify: `src/connections/proposalInbox.ts:115-210`
- Test: `src/__tests__/mcpGranularBroker.test.ts` (inbox unit tests)

**Interfaces:**
- Consumes: `ChangeSet`, `ChangeSetPreviewResult`, `ChangeSetApproval` from `src/types/changeSet.ts`
- Produces:
  - `ReviewUpdateOptions.allowPackageUpdate?: boolean` in `src/types/proposalReview.ts`
  - `ProposalInbox.upsertDraftChangeSet(changeSet: ChangeSet): Promise<ProposalRecord>` in `src/connections/proposalInbox.ts`
  - `ProposalInbox.discard(proposalId: string): Promise<{ discarded: true; proposalId: string }>` in `src/connections/proposalInbox.ts`

- [x] **Step 1: Write failing test for in-place draft upsert and approval reset in `src/__tests__/mcpGranularBroker.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { ProposalInbox } from '../connections/proposalInbox';
import { createMemoryReviewInboxRepository } from '../storage/proposalReviewInbox';
import { createEmptyDraftChangeSet, stageProjectOperation, stageShotOperation } from '../domain/mcpGranularStaging';
import type { LibrarySnapshot } from '../domain/mcpReads';

const emptySnapshot: LibrarySnapshot = { projects: [], assets: [], scenes: [], media: [] };

describe('ProposalInbox granular draft upsert & discard', () => {
  it('updates an unapplied draft ChangeSet in place, recomputes packageDigest, and resets prior approval', async () => {
    const repo = createMemoryReviewInboxRepository();
    const inbox = new ProposalInbox({
      loadSnapshot: async () => emptySnapshot,
      repository: repo,
    });

    let draft = createEmptyDraftChangeSet('cs-live-1', 'Live Storyboard');
    draft = stageProjectOperation(draft, { clientRef: 'proj-1', name: 'Project 1' }).changeSet;

    const first = await inbox.upsertDraftChangeSet(draft);
    expect(first.changeSet.operations).toHaveLength(1);
    const firstDigest = first.packageDigest;

    // Simulate partial reviewer approval in UI
    await inbox.setDecision(first.id, first.changeSet.operations[0].operationId, 'approved');
    const afterApprove = inbox.get(first.id);
    expect(Object.keys(afterApprove?.approval.operationDecisions ?? {})).toHaveLength(1);

    // Agent stages a second operation on the same changeSetId
    draft = stageShotOperation(draft, {
      clientRef: 'shot-1',
      project: { ref: 'proj-1' },
      code: 'S01',
      title: 'Opening Shot',
    }).changeSet;

    const second = await inbox.upsertDraftChangeSet(draft);
    expect(second.id).toBe(first.id);
    expect(second.changeSet.operations).toHaveLength(2);
    expect(second.packageDigest).not.toBe(firstDigest);
    expect(second.approval.operationDecisions).toEqual({});

    // Discard removes the draft from the inbox
    const discarded = await inbox.discard(first.id);
    expect(discarded).toEqual({ discarded: true, proposalId: first.id });
    expect(inbox.get(first.id)).toBeUndefined();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cmd /c npx vitest run src/__tests__/mcpGranularBroker.test.ts`
Expected: FAIL with `inbox.upsertDraftChangeSet is not a function`

- [x] **Step 3: Implement `allowPackageUpdate` in `ReviewInboxRepository` and `upsertDraftChangeSet` + `discard` in `ProposalInbox`**

1. In `src/types/proposalReview.ts`, add `allowPackageUpdate?: boolean;` to `ReviewUpdateOptions`.
2. In `src/storage/proposalReviewInbox.ts`, inside `update(id, patch, options)`:
   - When `options.allowPackageUpdate === true`:
     - Verify `old.disposition !== 'applying' && old.disposition !== 'applied'` (throw `Error('Applied or applying packages cannot be modified.')` otherwise).
     - Allow `checked.packageDigest` and `checked.changeSet` to update to the new draft values.
3. In `src/connections/proposalInbox.ts`:
   - Add `findByChangeSetId(changeSetId: string): ProposalRecord | undefined` that finds a cached record matching `record.changeSet.changeSetId === changeSetId`.
   - Add `upsertDraftChangeSet(changeSet: ChangeSet): Promise<ProposalRecord>`:
     - If no existing record matches `changeSet.changeSetId`, call `this.admit(changeSet)`.
     - If an existing record is found, verify its `disposition` is not `'applying'` or `'applied'` (throw `mcpError('CONFLICT', 'Cannot modify a proposal that is already applying or applied.')` otherwise).
     - Recompute `preview = await this.preview(changeSet)`, reset `approval = emptyChangeSetApproval()`, and persist via `this.update(existing.id, { changeSet: preview.changeSet, packageDigest: preview.packageDigest, preview, approval, status: preview.status, disposition: 'pending_review' }, { allowPackageUpdate: true })`.
   - Add `discard(proposalId: string): Promise<{ discarded: true; proposalId: string }>`:
     - Look up the proposal by `proposalId` (or `changeSetId`). If not found, throw `mcpError('NOT_FOUND', 'Proposal not found.', { proposalId })`.
     - If `disposition === 'applying' || disposition === 'applied'`, throw `mcpError('CONFLICT', 'Applied or applying proposals cannot be discarded.', { proposalId })`.
     - Call `await this.remove(record.id)` and return `{ discarded: true, proposalId: record.id }`.

- [x] **Step 4: Run test to verify it passes**

Run: `cmd /c npx vitest run src/__tests__/mcpGranularBroker.test.ts`
Expected: PASS (1 passed)

- [x] **Step 5: Commit**

```bash
git add src/types/proposalReview.ts src/storage/proposalReviewInbox.ts src/connections/proposalInbox.ts src/__tests__/mcpGranularBroker.test.ts
git commit -m "feat(mcp): support in-place draft proposal updates and inbox discard"
```

---

### Task 4: Protocol Schemas, ProposalBroker Routing & Bridge Registration (`src/domain/mcpProtocol.ts`, `src/connections/proposalBroker.ts`, `bridge/src/registerTools.ts`)

**Files:**
- Modify: `src/domain/mcpProtocol.ts`
- Modify: `src/connections/proposalBroker.ts`
- Modify: `bridge/src/registerTools.ts`
- Modify: `src/__tests__/blockingMcpCapabilities.test.ts`
- Modify: `src/__tests__/mcpGranularBroker.test.ts`

**Interfaces:**
- Consumes: All functions from `src/domain/mcpGranularStaging.ts` and `src/domain/mcpGranularReads.ts`, `ProposalInbox.upsertDraftChangeSet`, `ProposalInbox.discard`
- Produces:
  - 36 total tools in `MCP_TOOL_NAMES` and `MCP_INPUT_SCHEMAS` in `src/domain/mcpProtocol.ts`
  - Complete routing in `ProposalBroker.handle(command, sessionId)` in `src/connections/proposalBroker.ts`
  - Accurate `readOnlyHint` annotations in `bridge/src/registerTools.ts`

- [x] **Step 1: Expand `src/__tests__/mcpGranularBroker.test.ts` with end-to-end broker tests for the new tools and capability/scope gates**

Add tests to `src/__tests__/mcpGranularBroker.test.ts` covering:
1. Full incremental workflow via `broker.handle`: `krakinai_stage_project` -> `krakinai_stage_asset_candidate` -> `krakinai_stage_shot` -> `krakinai_stage_scene_recipe` -> `krakinai_stage_scene_ensemble` -> `krakinai_stage_scene_dialogue` -> `krakinai_stage_camera_composition` -> `krakinai_list_proposals` -> `krakinai_discard_proposal`.
2. Scope and capability enforcement:
   - `krakinai_stage_scene_blocking` fails with `PERMISSION_DENIED` when `scope.allowBlockingProposals === false` or when session lacks `blocking-v5` capability, and succeeds when both are granted.
   - `krakinai_stage_keyframe_plan` and `krakinai_stage_frame_image` fail with `PERMISSION_DENIED` when `scope.allowKeyframeProposals === false` or when session lacks `keyframes-v6` capability, and succeed when both are granted.
3. Read tool routing through `broker.handle`: `krakinai_get_asset`, `krakinai_list_catalog_presets`, `krakinai_get_project_continuity`, `krakinai_check_spatial_continuity`, `krakinai_preview_scene_assembly`, `krakinai_list_saved_scenes`, and `krakinai_export_scene_prompts`.
4. Rejecting `krakinai_stage_*` or `krakinai_discard_proposal` when a proposal's disposition is `applied`.

- [x] **Step 2: Run test to verify it fails**

Run: `cmd /c npx vitest run src/__tests__/mcpGranularBroker.test.ts`
Expected: FAIL with `Tool argument validation failed` / unknown tool names

- [x] **Step 3: Register the 23 tools in `src/domain/mcpProtocol.ts`, wire them in `src/connections/proposalBroker.ts`, and update `bridge/src/registerTools.ts`**

1. In `src/domain/mcpProtocol.ts`:
   - Add the 23 tool names to `MCP_TOOL_NAMES`:
     - Inbox & Project/Shot Staging: `krakinai_list_proposals`, `krakinai_discard_proposal`, `krakinai_stage_project`, `krakinai_stage_shot`, `krakinai_stage_shot_order`, `krakinai_stage_shot_status`
     - Assets, Variants & Catalogs: `krakinai_get_asset`, `krakinai_list_catalog_presets`, `krakinai_stage_asset_candidate`, `krakinai_stage_outfit_variant`
     - Scene Recipes, Ensemble, Dialogue & Camera: `krakinai_stage_scene_recipe`, `krakinai_stage_scene_ensemble`, `krakinai_stage_scene_dialogue`, `krakinai_stage_camera_composition`, `krakinai_stage_direct_to_recipe`, `krakinai_preview_scene_assembly`
     - Continuity, Blocking (v5) & Keyframes (v6): `krakinai_get_project_continuity`, `krakinai_check_spatial_continuity`, `krakinai_stage_scene_blocking`, `krakinai_stage_keyframe_plan`, `krakinai_stage_frame_image`
     - Saved Scenes: `krakinai_list_saved_scenes`, `krakinai_export_scene_prompts`
   - Define strict `FieldSchema` entries for each of the 23 tools in `MCP_INPUT_SCHEMAS`.
2. In `src/connections/proposalBroker.ts`:
   - Add helper `stageWithUpdater(args, sessionId, updater)` that:
     - Checks `this.checkSubmitLimit(sessionKey)` and verifies `this.scope.allowProposals`.
     - Looks up existing draft by `changeSetId` in `this.inbox` (or creates a fresh draft via `createEmptyDraftChangeSet(changeSetId, args.title, args.summary)`).
     - Runs `updater(draft, args)` to produce `{ changeSet, operationId }`.
     - Validates scope via `assertProposalScope(changeSet, snapshot, this.scope)` and session capabilities (`assertBlockingSessionCapability` when `changeSet` uses v5 blocking; `assertKeyframeSessionCapability` when `changeSet` uses v6 keyframes).
     - Calls `await this.inbox.upsertDraftChangeSet(changeSet)` and returns `{ proposalId: record.id, changeSetId: record.changeSet.changeSetId, schema: record.changeSet.schema, packageDigest: record.packageDigest, operationCount: record.changeSet.operations.length, stagedOperationId: operationId, status: record.status, expiresAt: record.expiresAt, summary: record.preview.summary, batchChecks: record.preview.batchChecks }`.
   - Route all 23 tools in `switch (tool)`.
3. In `bridge/src/registerTools.ts`:
   - Set `readOnlyHint: !toolName.startsWith('krakinai_stage_') && toolName !== 'krakinai_submit_change_set' && toolName !== 'krakinai_discard_proposal'`.
4. In `src/__tests__/blockingMcpCapabilities.test.ts`:
   - Update `expect(MCP_TOOL_NAMES).toHaveLength(13)` to `expect(MCP_TOOL_NAMES).toHaveLength(36)`.

- [x] **Step 4: Run tests and TypeScript check to verify everything passes**

Run: `cmd /c npx vitest run src/__tests__/mcpGranularStaging.test.ts src/__tests__/mcpGranularReads.test.ts src/__tests__/mcpGranularBroker.test.ts src/__tests__/blockingMcpCapabilities.test.ts`
Expected: PASS (all tests green)

Run: `cmd /c npx tsc --noEmit`
Expected: Exit code 0

- [x] **Step 5: Commit**

```bash
git add src/domain/mcpProtocol.ts src/connections/proposalBroker.ts bridge/src/registerTools.ts src/__tests__/blockingMcpCapabilities.test.ts src/__tests__/mcpGranularBroker.test.ts
git commit -m "feat(mcp): expose 23 granular read and staging MCP tools"
```
