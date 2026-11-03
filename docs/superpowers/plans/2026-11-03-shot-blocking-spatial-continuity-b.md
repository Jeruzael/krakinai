# Shot Blocking & Spatial Continuity — Workstream B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The owner approved the plan and inline execution on 2026-11-03; one independent whole-branch review remains required.

**Goal:** Author participant-bound Start → Action → End blocking in Scene Builder and Continuity, include it in canonical video prompts, and support explicitly permissioned Codex proposals through the existing atomic browser approval workflow.

**Architecture:** Keep optional structured blocking on the authoritative recipe and immutable scene, with shared pure validation, formatting, comparison and patch planning. Gate B writes behind an explicitly confirmed IndexedDB header upgrade, version only blocking-bearing documents/exports and v5 receipts, and preserve legacy branches. Reuse the existing authoring transaction, MCP tools, authenticated transports, shared launcher and browser review controls.

**Tech Stack:** Existing React 18, TypeScript, IndexedDB, Vitest/testing-library/fake-indexeddb, Playwright Chromium, Node.js 22, existing MCP SDK and Windows signed verification helper; no new paid dependency, backend or external generation service.

**Spec:** [Approved B design](../specs/2026-11-03-shot-blocking-spatial-continuity-b-design.md), approved by the owner on 2026-11-03. Base `c3866116c5299cda4e0049b941ddabc17f569066`; branch `codex/shot-blocking-spatial-continuity`.

## Global Constraints

- The owner approved this B plan and inline execution on 2026-11-03; C and live bridge activation remain separate.
- Preserve original scenes, outputs, drafts, Character identities/anchors, Outfits, reference packs/associations, media bytes and preferred-take choices. Blocking changes create new immutable takes; no implicit source refresh or selection.
- Optional missing blocking remains valid; incomplete planning is recoverable. Recipe / Build from Assets is preferred; Direct Prompt conversion creates a new recipe take/draft without replacing its source.
- IndexedDB version **1 → 2**, same **eight stores**, no existing-record rewrite. Explicit confirmation precedes opening an existing v1 library for normal B writes; Cancel preserves v1. Handle blocked upgrades and version changes without deleting/resetting a database.
- Blocking ceilings: **8** tracks, **16** landmarks, **16** props, **32** interactions total, **4** waypoints/track, safe IDs **64** characters, labels **120**, pose/movement **500**, descriptions **1,000**, total **64 KiB UTF-8**. Omitted values stay unspecified; never infer identities or geometry from images/prose.
- Keep v1–v4 schemas, legacy output bytes, receipt hashes and valid legacy behavior. New contract **`krakinai.change-set.v5`**, scope **v2**, receipt/ledger **v2**, blocking documents **scene/generation v3**; backup manifest **v2** and Project Export **v2** only when required.
- Scope v2 adds exact **`blockingSceneIds` ≤250** and **`allowBlockingProposals: false`** by default; retain the **13** tools and every existing independent permission. New saved IDs do not inherit blocking/full-prompt grants.
- Keep existing limits: stored media **5,000 MiB**, backup uncompressed **5,500 MiB**, **2,000 entries**, metadata **20 MiB**; Project Export media **128 MiB**, text **16 MiB**, **2,000 entries**; MCP package **1 MiB**, result **512 KiB**, ledger **4 MiB**. Do not change compression/restore limits or claim PR #12 capacity.
- Do not modify separate `src/domain/validation.ts` work, PR #12, real `localhost:5173` data, live relay ports 4177/4180, global Codex registration, certificate trust or AllSigned. No profile deletion without explicit path authorization.
- Build bridge acceptance artifacts into a new ignored directory. Any overwritten/rebuilt signed helper must be signed again and have Authenticode **Valid** before native acceptance; additional executable signing needs concrete artifact authorization. Never export keys or commit certificates, secrets, profiles or QA ZIPs.
- Use exact target IDs/revisions and approval content at the atomic boundary. No writes before browser Apply, automatic approval, unreviewed preferred change, unrelated-track edit or fabricated CLI result.

## Review Focus

1. A stale v1 tab writes while upgrade waits: preserve that write, reread after success, and prove the old build cannot reopen (Task 5).
2. Inherited manual buffers disagree with new blocking: require the same explicit per-mode choice in browser and MCP; never silently discard or claim synchronization (Tasks 6, 11, 13).
3. All blocking scenes were deleted but a v5 receipt remains: backup stays v2 and receipt replay still works after restore (Tasks 7, 11).
4. One Character appears twice or a bound off-camera speaker is a target: retain exact participants, report ambiguous comparisons and never create a visible speaker (Tasks 2, 4, 8).
5. A batch reorders shots or leaves its new take unselected: compare the final simulated storyboard and label hypothetical comparisons; stale selection/order invalidates approval (Tasks 10, 11).

## File Structure and Interfaces

New focused modules below have one authority each. Paths are repository-relative. Existing large files receive narrow adapters; do not refactor unrelated behavior.

| New module | Responsibility / public interface |
| --- | --- |
| `src/types/blocking.ts` | `SceneBlockingV1`, participant/target/phase/interaction types, `BlockingSource = Pick<SceneDraft, 'slots' \| 'ensemble' \| 'shotType'>`, `BlockingFinding {code,path,severity:'blocking'\|'incomplete'\|'advisory',message}`, constants |
| `src/domain/blockingValidation.ts` | `validateSceneBlocking(value: unknown, source: BlockingSource, mode: 'planning'\|'assembly'): BlockingFinding[]`; `blockingBindingToken(snapshot: ComponentSnapshot): string` using canonical source-type/ID/revision projection, not display titles |
| `src/domain/blockingDocument.ts` | `buildBlockingDocument(source: BlockingSource & {blocking?:SceneBlockingV1}): BlockingDocumentV1 \| undefined`; `formatBlockingDocument(doc: BlockingDocumentV1, mode: OutputMode): string` |
| `src/domain/blockingContinuity.ts` | `compareBlockingPair(previous: SavedScene, current: SavedScene): BlockingComparison`; result owns exact scene IDs, basis/comparability and typed advisory findings |
| `src/storage/libraryCompatibility.ts` | `inspectLibraryCompatibility(): Promise<'absent'\|'legacy-v1'\|'current-v2'\|'unsupported'>`; `enableBlockingLibrary(options: {signal?:AbortSignal; onBlocked:()=>void}): Promise<void>`; shared database name/version/store definitions |
| `src/domain/blockingOutputReview.ts` | `BlockingOutputDecisions = Partial<Record<OutputMode,'canonical'\|'keep_manual_unverified'>>`; `resolveBlockingOutputs(draft: SceneDraft, canonical: Record<OutputMode,string>, decisions: BlockingOutputDecisions): BlockingOutputResolution` returning outputs, retained manual buffers and findings |
| `src/domain/backupFeatures.ts` | `detectBackupFeatures(snapshot: LibrarySnapshot): ('blocking.v1'\|'change-set.v5-ledger')[]`; shared full-backup version selection/feature validation |
| `src/domain/blockingChangeSetSchema.ts` | Strict v5-only typed blocking patch rules; `createBlockingChangeSetSchema(v4: JsonRule): JsonRule` |
| `src/domain/blockingPatch.ts` | `applyBlockingPatch(base: SceneBlockingV1\|undefined, patch: BlockingPatchV1\|null, source: BlockingSource): BlockingPatchResult`; result has next blocking, changed typed paths and findings, never mutates base |
| `src/domain/blockingReview.ts` | `blockingReviewedProjection(plan: ChangeSetPlan): unknown`; final-simulation comparisons and exact v5 reviewed content |
| `src/domain/blockingMcp.ts` | `projectBlockingForMcp(scene: SavedScene, scope: McpScope, state: ChangeSetState): BlockingDisclosure`; `projectBlockingDifferences(preview: ChangeSetPreview, scope: McpScope, state: ChangeSetState): BlockingMcpDifference[]` |
| `src/domain/mcpCapabilities.ts` | Immutable supported scope/change-set capability constants; compatible bridge advertisement parsing and B enablement |
| `src/components/blocking/*` | Shared controlled editor, schematic, saved-take comparison and manual-output review. Reuse `StudioDialog`, existing controls/tokens and dirty guards. |
| `src/components/LibraryCompatibilityGate.tsx` | Explicit startup Enable/Cancel/blocked/retry states; no UI await inside upgrade transaction |
| `src/__tests__/fixtures/blockingFixture.ts`, `e2e/blocking-fixture.mjs` | Synthetic records, exact hashes/IDs and isolated library helpers; never imported into production |
| `scripts/qa/blocking-mcp-workflow.mjs` | Pure call-ID-correlated acceptance state machine/evidence validation, independent of model prose |

`BlockingPatchV1`, `BlockingDocumentV1`, `BlockingComparison`, `BlockingOutputResolution`, `BlockingPatchResult` and disclosure/difference types live with their owning modules and are exported. `BlockingPatchResult` has `{blocking?:SceneBlockingV1,changedPaths:string[],findings:BlockingFinding[]}`. `BlockingOutputResolution` has `{outputs:Record<OutputMode,string>,manualOutputs:SceneDraft['manualOutputs'],findings:BlockingFinding[]}`. `BlockingComparison` has `{previousSceneId:string,currentSceneId:string,comparable:boolean,basis:BlockingComparisonBasis,findings:BlockingFinding[]}`. Its `BlockingComparisonBasis` has optional common `spaceId:string` and `axisKey:string` (canonical ordered endpoint/basis key), `participantPairs:Array<{previous:ParticipantRef,current:ParticipantRef}>`, and optional `reason:'missing_blocking'|'unbound'|'ambiguous_participants'|'space_mismatch'|'axis_mismatch'`. All later tasks consume these names; preserve signatures or update every dependent task during plan execution. Existing `SceneDocumentSource`, `SceneDraft`/saved recipe fields, `ChangeSetPlan`/approval/receipt, `McpScope` and backup/export unions gain narrowly versioned B fields.

## Execution and Evidence Rules

Use the current suitable checkout; first verify branch/base/status and retain all foreign changes. Own only `.superpowers/sdd/2026-11-03-shot-blocking-b/` and newly created ignored QA paths. Re-read `AGENTS.md` and the approved design. Do not access another task's private workspace.

Before changes, capture the exact baseline commit/tree, commands and warnings, complete current regression counts, pre-existing failures and synthetic screenshots. A failing baseline is an observation to investigate, not permission to weaken a check. At each task run the named red test before its production implementation, then the focused green tests. Task 1 is a deliberately green compatibility capture before modification. Each task ends with a focused diff review and a signed checkpoint when the owner can provide SSH signing; do not disable signing, stage the entire checkout or force a commit per task while its signer is blocked. Record verified pending checkpoints and batch reviewable commits when needed.

Run commands from repository root using the installed Node 22/npm. Each verification records stdout/stderr, exit code, duration, exact tested tree and explicit skips. A proposed new test/module below is not expected to exist until its owning task. No command results in this plan are claims of completed B verification.

### Task 1: Freeze legacy contracts and synthetic acceptance fixtures

**Files:** Create `src/__tests__/fixtures/blocking-legacy-baseline.json`, `src/__tests__/blockingLegacy.test.ts`, `scripts/qa/capture-blocking-baseline.mjs`. Read/reuse the existing ensemble, conversion and change-set fixtures and `e2e/fixtures/output-workspace-baseline.json`.

**Interfaces:** Baseline JSON contains exact Full/Structured/Compact/scene/generation strings, v1–v4 schema SHA-256 and representative receipt/package/approval digests. Exporter uses trusted repository modules only, refuses non-synthetic input and never reads a browser profile.

- [ ] Capture the untouched base's synthetic bytes/digests with the new exporter; inspect generated data before accepting it as the frozen expected fixture. Never regenerate expected bytes after implementation to make tests pass.
- [ ] Add `legacy bytes and receipt identities survive B`: compare every actual string/hash to the committed baseline, assert old receipt replay creates no additional records, and cover single Character, ensemble and Direct Prompt records.

  ```ts
  expect(actual.outputs).toEqual(baseline.outputs);
  expect(actual.receiptDigests).toEqual(baseline.receiptDigests);
  ```
- [ ] Run `npm test -- src/__tests__/blockingLegacy.test.ts` and `node scripts/export-change-set-schema.mjs --check`; expect exit 0 on the untouched base. Run/capture the complete baseline suites listed in Task 15.
- [ ] Capture synthetic before screenshots at 1440×900, 768×1024, 390×844 and 720×450/DPR2. Retain an ignored, hash-inventoried copy of this base's production build for the actual old-reader archive test in Task 7; serve it only on an isolated QA origin/profile. Review/stage only this task's text fixtures/tools/tests; checkpoint `test: freeze pre-blocking compatibility contracts`.

### Task 2: Add the bounded participant model and shared validation

**Files:** Create `src/types/blocking.ts`, `src/domain/blockingValidation.ts`, `src/__tests__/blockingModel.test.ts`, `src/__tests__/fixtures/blockingFixture.ts`. Modify `src/types/domain.ts`, `src/domain/phase4Validation.ts`.

**Interfaces:** Types/validator from the file map. Fixture exports `makeBlockingFixture()` returning `{draft,state,projectId,shotId,parentSceneId,otherSceneIds}`; `state` is a `LibrarySnapshot` with synthetic Aya/Lucas/Marco, bridal/groom Outfits, chapel landmarks, bouquet, decodable media, legacy receipts and multiple shots. Binding-token derivation uses frozen snapshot values, not current library text.

- [ ] Write red cases `independent body and eyeline`, `off-camera target has no visible track`, `primary disallowed with ensemble`, `duplicate Character has distinct participant IDs`, `stale binding`, `typed enter and exit endpoints`, `dangling target remains incomplete in planning`, `unknown keys and unsafe IDs`, `all count/text/UTF8 boundaries`. Assert valid absence returns `[]`, planning unresolved rows survive, and assembly reports blocking findings for unresolved/invalid authored references.

  ```ts
  const {draft} = makeBlockingFixture();
  expect(validateSceneBlocking(undefined, draft, 'assembly')).toEqual([]);
  expect(validateSceneBlocking(draft.blocking, draft, 'assembly')).toEqual([]);
  ```
- [ ] Run `npm test -- src/__tests__/blockingModel.test.ts`; prove the intended missing B behavior fails.
- [ ] Implement exact model/interaction vocabulary and all approved limits. Use separate direction/eyeline fields, typed visibility, stable prop/landmark/interaction IDs, shared prop holders, explicit geography/axis basis and on/off-camera semantics. Reject blocking on saved Direct Prompts; a conversion working draft is a Recipe.
- [ ] Run focused tests plus `blockingLegacy.test.ts` and `npm run typecheck`; review and checkpoint `feat: define validated shot blocking model`.

### Task 3: Assemble blocking through one canonical document path

**Files:** Create `src/domain/blockingDocument.ts`, `src/__tests__/blockingAssembly.test.ts`. Modify `src/domain/sceneDocument.ts`, `src/domain/generationDocument.ts`, `src/domain/promptAssembler.ts`, `src/domain/scenePreflight.ts`, `src/components/ScenePreflightDialog.tsx` only for actionable B paths.

**Interfaces:** `BlockingDocumentV1` is validated semantic data; no pixel positions, inferred actions or still-image prompt. Existing build/serialize/assemble functions retain signatures and dispatch v3 only when blocking exists.

- [ ] Write red `Aya body altar, head door` asserting all three modes contain authored staging but exact dialogue/component strings remain equal; `scene and generation v3`; `no blocking preserves every legacy byte`; `unresolved authored target blocks assembly and directs to Blocking`.

  ```ts
  expect(buildSceneDocument(draft).schema).toBe('krakinai.scene-prompt.v3');
  expect(assembleScenePrompt(withoutBlocking).outputs).toEqual(baseline.outputs);
  ```
- [ ] Run `npm test -- src/__tests__/blockingAssembly.test.ts src/__tests__/blockingLegacy.test.ts`; verify the new section/version assertion fails first.
- [ ] Implement stable participant order then landmark/prop ID order, the labelled **Blocking & spatial direction** section and semantically complete Compact content. Add preflight adapter findings from the same validator. Keep original source-media validation, seven component requirements and negative text intact.
- [ ] Run focused tests, existing scene/generation/preflight tests and typecheck; checkpoint `feat: assemble canonical blocking direction`.

### Task 4: Compare typed spatial continuity conservatively

**Files:** Create `src/domain/blockingContinuity.ts`, `src/__tests__/blockingContinuity.test.ts`. Extend `src/domain/continuityWorkspace.ts` with derived availability/comparison metadata only.

**Interfaces:** `BlockingComparison` contains exact previous/current scene IDs, declared space/axis basis, `comparable` state/reason and findings carrying evidence paths/IDs. It never mutates scenes, supplies an identity mapping from names or writes Collection notes.

- [ ] Write red cases asserting position/depth, facing/head/eyeline, exact prop-holder/transfer, entrance/exit and same-axis-side changes are advisory; unchanged/shared-holder values produce no warning. Assert repeated/unknown bindings and changed/reversed bases disclose insufficient information instead of inventing matches.

  ```ts
  const comparison = compareBlockingPair(previous, current);
  expect(comparison.previousSceneId).toBe(previous.id);
  expect(comparison.findings.every(f => f.severity === 'advisory')).toBe(true);
  ```
- [ ] Run `npm test -- src/__tests__/blockingContinuity.test.ts`; verify new comparison cases fail.
- [ ] Implement exact matching rules from design §6, including optional absence, off-camera targets, deliberate cuts/time jumps and identity ambiguity. Derive comparison without reassembling saved outputs.
- [ ] Run focused comparison/Continuity tests and typecheck; checkpoint `feat: derive spatial continuity advisories`.

### Task 5: Protect the library format before any B write

**Files:** Create `src/storage/libraryCompatibility.ts`, `src/components/LibraryCompatibilityGate.tsx`, `src/__tests__/libraryCompatibility.test.ts`, `e2e/blocking-upgrade.spec.mjs`. Modify `src/storage/db.ts`, `src/context/LibraryContext.tsx`, `src/App.tsx`.

**Interfaces:** Shared database definitions replace private duplicated constants; `openDatabase():Promise<IDBDatabase>` remains the writer entry point and refuses an existing unapproved v1 library. Compatibility gate runs before initialization/starter/template writes. Inspection uses `indexedDB.databases()` when available; fallback aborts `oldVersion===0` probe creation and leaves no database behind. Unsupported/newer versions are never silently opened for writes.

- [ ] Write red tests `Cancel leaves v1 unchanged`, `probe absent does not create v1`, `header upgrade preserves every key/record/blob`, `blocked upgrade preserves late old-tab write`, `old build receives VersionError`, `versionchange closes cache`, `blocked Cancel never completes later`. Cancellation must mark/abort any later `onupgradeneeded`, not merely hide UI. Test a failure then retry with fresh cached promise.

  ```ts
  expect(await inspectLibraryCompatibility()).toBe('legacy-v1'); // after Cancel
  expect(afterCancel).toEqual(before);
  expect(afterSuccessfulUpgrade).toEqual(beforeIncludingLateWrite);
  ```
- [ ] Run `npm test -- src/__tests__/libraryCompatibility.test.ts`; verify the protected-open assertions fail before editing storage.
- [ ] Implement explicit Enable, Cancel, blocked/retry UI; fresh empty libraries may open v2. Retain eight stores and record bytes; attach versionchange close/cache reset, error and blocked handlers. Never await UI in upgrade or delete/force-close old databases. Re-read snapshot after successful upgrade, including writes made while blocked. Update test-only setup to explicitly enable seeded v1 synthetic libraries where needed, preserving deliberate old-reader cases; add no production test-mode bypass.
- [ ] Run focused unit tests and `npm run build`; only after exit 0 run `npm run test:e2e -- e2e/blocking-upgrade.spec.mjs`. The browser test holds an actual v1 connection, writes while blocked, then closes it and compares all hashes after restart. Review/checkpoint `feat: gate blocking behind protected library upgrade`.

### Task 6: Preserve drafts and immutable saves with explicit manual-output decisions

**Files:** Create `src/domain/blockingOutputReview.ts`, `src/__tests__/blockingStorage.test.ts`, `src/__tests__/blockingOutputReview.test.ts`. Modify `src/storage/db.ts`, `src/storage/sceneAuthoring.ts`, `src/types/sceneAuthoring.ts`, `src/domain/ensemblePersistence.ts`, `src/domain/sceneDuplicates.ts`, `src/domain/phase4Validation.ts` and `src/context/LibraryContext.tsx` at explicit-copy paths.

**Interfaces:** Add optional `blockingOutputDecisions?:BlockingOutputDecisions` to `AuthoredSaveOptions` and legacy `SaveSceneOptions`, not caller self-approval flags. `BlockingOutputResolution` contains exact outputs, retained manual overrides and findings; unresolved active modes yield `BLOCKING_OUTPUT_DECISION_REQUIRED`. Add B content to duplicate/fingerprint semantics without changing legacy keys.

- [ ] Write red `save/reopen/copy/revision/alternate preserve blocking`, `source and preferred unchanged`, `incomplete draft recoverable`, `manual decisions unresolved/canonical/keep/cancel`, `unchanged legacy duplicate key`, `template omission requires acknowledgement`. Assert snapshots, generation choices, anchors, reference associations, media hashes and dialogue remain exact through a blocking-only revision; abort on a required source refresh.

  ```ts
  const kept = resolveBlockingOutputs(draft, canonical, {full:'keep_manual_unverified'});
  expect(kept.outputs.full).toBe(draft.manualOutputs.full!.text);
  expect(kept.manualOutputs.full).toEqual(draft.manualOutputs.full);
  ```
- [ ] Run `npm test -- src/__tests__/blockingStorage.test.ts src/__tests__/blockingOutputReview.test.ts` and verify missing-preservation/decision cases fail.
- [ ] Carry optional blocking through all explicit draft/saved constructors and context asset/variant replacement; retain unresolved bindings for repair rather than silently erase. Integrate validation/output resolution into both save paths inside their existing transaction guards. Save Draft permits valid incomplete planning; immutable save does not. Explicit template omission acknowledgement leaves source intact; template apply retains blocking for review or confirms removal.
- [ ] Run focused tests plus scene-authoring/ensemble/conversion storage suites and typecheck; checkpoint `feat: preserve blocking in immutable authoring paths`.

### Task 7: Version backups and Project Export without changing limits

**Files:** Create `src/domain/backupFeatures.ts`, `src/__tests__/blockingBackup.test.ts`, `src/__tests__/blockingProjectExport.test.ts`. Modify `src/storage/backup.ts`, `src/domain/projectExport.ts`, `src/domain/changeSetCapacity.ts`, `src/components/ProjectExportDialog.tsx` only where version display is needed.

**Interfaces:** `BackupManifest` becomes a strict v1/v2 union; v2 has supported `requiredFeatures`. `ProjectExportManifest` becomes v1/v2, with blocking/v3 document fields only on v2 selected takes. Exporters/restore signatures and inclusion options remain unchanged. Feature detection checks ledger version as well as live records; Task 11 supplies a real mixed ledger fixture.

- [ ] Write red `v1 archive equality and restore`, `blocking v2 round trip/restart`, `old reader rejects before writes`, `unknown required feature`, `corrupt/incomplete saved blocking`, `ledger-only selects v2`, `Project Export selected take version`, `legacy-only v1 in DB2`, and exact size/entry ceilings. The ledger-only case here checks feature/version selection only; Task 11 adds its real strict mixed-ledger round trip/replay after the v2 ledger validator exists. Assert source/restore SHA-256 and old receipt bytes, not just counts.

  ```ts
  expect(detectBackupFeatures(ledgerOnly)).toContain('change-set.v5-ledger');
  expect(restored.scenes).toEqual(original.scenes);
  expect(restoredMediaHashes).toEqual(originalMediaHashes);
  ```
- [ ] Run `npm test -- src/__tests__/blockingBackup.test.ts src/__tests__/blockingProjectExport.test.ts`; verify missing v2/feature checks fail.
- [ ] Implement shared feature selection and strict validation, preserving atomic replacement and original saved text. Do not reset the DB header to1 on legacy restore or change the separate storage-limit file. Measure capacity including blocking, document strings and retained receipts; reject oversized exports without truncation/filtering. Do not adopt PR #12 streaming code or certify large restores here.
- [ ] Run focused tests, existing backup/project-export suites and typecheck. In a fresh v1 QA profile, load Task 1's frozen old build, select the new synthetic v2 ZIP through its actual restore controls and verify rejection preserves the prior library. Do not point the old build at an upgraded or real library. Review/checkpoint `feat: preserve blocking in versioned backups and exports`.

### Task 8: Build the shared accessible editor and Scene Builder entry

**Files:** Create `src/components/blocking/BlockingEditor.tsx`, `BlockingBoard.tsx`, `BlockingOutputReview.tsx`, `blocking.css`, `src/__tests__/blockingEditor.test.tsx`, `e2e/blocking-authoring.spec.mjs`, `e2e/blocking-fixture.mjs`. Modify `src/screens/SceneBuilderScreen.tsx`, `src/screens/PromptOutputScreen.tsx` and existing template controls as required by Task 6.

**Interfaces:** `BlockingEditor({source:SceneDraft,value:SceneBlockingV1|undefined,onChange:(next:SceneBlockingV1|undefined)=>void,onClose:()=>void})`; draft owner handles persistence. `BlockingBoard({source,blocking,phase,participant,onSelect,onScreenPlacement?})` consumes the same data; any drag emits only screen fields. Review component consumes Task 6 resolution/decisions and exposes explicit per-mode choices.

- [ ] Write red UI tests for phase/participant switching, body/head/eyeline independence, all essential fields without drag, live findings, explicit removals/dependent repairs, exact off-camera/repeated bindings, long text, keyboard/Escape/focus return, template acknowledgement and draft Cancel. Assert no saved-scene mutation or source prompt expansion merely on open.

  ```tsx
  await user.click(screen.getByRole('button', {name:'Edit blocking', exact:true}));
  expect(screen.getByRole('combobox', {name:'Participant', exact:true})).toBeVisible();
  expect(afterOpen.scenes).toEqual(beforeOpen.scenes);
  ```
- [ ] Run `npm test -- src/__tests__/blockingEditor.test.tsx`; verify missing editor/decision controls fail.
- [ ] Implement Board first desktop and stacked mobile using existing blue palette/controls/`StudioDialog`. Include visibility, typed movement/entrance/exit/interactions, landmark basis/props/shared holders/camera axis behind focused sections; do not replace unspecified fields with visual guesses. Only explicit Reuse spatial setup copies declared IDs/basis. Scene Builder status shows optional/incomplete/authored/errors; Assemble and every immutable-save button use shared validation/manual review and preserve the draft on rejection. Direct Prompt planning invokes existing guided conversion into a recoverable Recipe draft.
- [ ] Run focused UI tests; build and run `npm run test:e2e -- e2e/blocking-authoring.spec.mjs`, including valid replacement after stale bindings/source media, Copy/Download exact complete outputs and legacy Character scenes. Review/checkpoint `feat: add accessible shot blocking editor`.

### Task 9: Integrate saved-take inspection and cross-shot review into Continuity

**Files:** Create `src/components/blocking/BlockingContinuityView.tsx`, `src/__tests__/blockingContinuityWorkspace.test.tsx`, `e2e/blocking-continuity.spec.mjs`. Modify `src/components/ContinuityViews.tsx`, `src/components/ProjectContinuityPanel.tsx`, `src/domain/continuityWorkspace.ts` and scoped styling.

**Interfaces:** `BlockingContinuityView({model,selected,onEditRecipe})` receives the existing workspace rows/selection; `onEditRecipe(sceneId:string,shotId:string)` creates the managed working copy through existing revision/target logic. Comparison uses Task 4 exact scene IDs and current visible shot order; saved view has no editing callback wired to marker movement.

- [ ] Write red `opening saved blocking causes zero writes`, `edit copy targets exact scene/shot`, `compare previous selected End/current Start`, `filter retains outside selection`, `reorder shows stale pair`, `dirty back/forward/clear retains text`, `missing selected take/optional blocking`. Include explicit unknown/uncomparable labels and no modification to transitions/legacy First/Last images.

  ```ts
  expect(afterInspection).toEqual(beforeInspection);
  expect(revisionDraft.revisionIntent?.contextSceneId).toBe(selectedScene.id);
  expect(revisionDraft.revisionIntent?.parentSceneId).toBe(expectedHead.id);
  expect(revisionDraft.authoredProjectTarget?.shotId).toBe(selectedShot.id);
  ```
- [ ] Run `npm test -- src/__tests__/blockingContinuityWorkspace.test.tsx`; verify B view/copy behavior fails first.
- [ ] Replace A's Blocking placeholder with read-only board/fields and explicit Edit a recipe copy. Preserve A route/return/history, shared shot navigator, inspector, image previews and dirty guards; make pair interpretation filters local only. Update derived overview status without manufacturing a score.
- [ ] Run focused tests and `npm run test:e2e -- e2e/continuity-workspace.spec.mjs e2e/blocking-continuity.spec.mjs` after build; checkpoint `feat: review blocking continuity across selected takes`.

### Task 10: Add strict v5 patches and final-state reviewed content

**Files:** Create `src/domain/blockingChangeSetSchema.ts`, `src/domain/blockingPatch.ts`, `src/domain/blockingReview.ts`, `src/__tests__/blockingChangeSetContract.test.ts`, `src/__tests__/blockingChangeSetPlanning.test.ts`, `docs/change-set-v5.schema.json`. Modify `src/types/changeSet.ts`, `src/domain/changeSetSchema.ts`, `changeSetValidation.ts`, `changeSetRecipe.ts`, `changeSetPlanner.ts`, `changeSetRecipeContent.ts`, `changeSetState.ts`, `scripts/export-change-set-schema.mjs`.

**Interfaces:** `BlockingPatchV1` has version1, expected base digest, exact-ID participant/landmark/prop upserts/removals, interaction updates/order and optional camera/space changes. It is allowed only on v5 recipe create/revise/alternate/conversion operations. Omission preserves, null removes from the new take, field null clears optional content; unrelated rows never disappear. Add v5 expected source-recipe/blocking digests without accepting them in old schemas. Use prepared source proofs outside the IDB transaction and compare synchronous canonical source signatures at the boundary, as existing conversion proof handling does.

- [ ] Write red tests for every patch operation, same-batch ensemble/candidate resolution, missing/stale digest, explicit/null removal with dependency repair, legacy-on-blocking-parent rejection and unknown future C fields. Assert v1–v4 schema/digest fixtures remain exact. For a reorder+revision batch assert findings use final order/selected takes; an unselected new take has a separately labelled hypothetical comparison.

  ```ts
  expect(parseChangeSet(validV5).schema).toBe('krakinai.change-set.v5');
  expect(() => parseChangeSet({...validV5, schema:'krakinai.change-set.v4'})).toThrow();
  expect(patchedUnrelatedTrack).toEqual(originalUnrelatedTrack);
  ```
- [ ] Run `npm test -- src/__tests__/blockingChangeSetContract.test.ts src/__tests__/blockingChangeSetPlanning.test.ts`; verify v5-only cases fail.
- [ ] Implement strict schema dispatch/patching and shared authored-scene planning. V5 retains parent manual buffers for Task 6 decisions, preserves hidden frozen sources and stops on identity fallback. Add a separate v5 reviewed projection binding exact outputs, manual choices, changed paths, final order, comparisons, IDs and state signatures; do not alter the old projections by adding an unconditional field. Define v5 approval extensions `blocking:boolean` and `blockingOutputDecisions[operationId][mode]` only for v5.
- [ ] Export/check all schemas, run contract/planning/legacy tests and typecheck; checkpoint `feat: plan reviewed blocking change sets v5`.

### Task 11: Commit v5 atomically with versioned receipts and replay

**Files:** Create `src/__tests__/blockingChangeSetStorage.test.ts`, `src/__tests__/blockingLedger.test.ts`. Modify `src/domain/changeSetLedger.ts`, `src/storage/changeSets.ts`, `src/types/changeSet.ts`, `src/domain/changeSetCapacity.ts` and Task 7 tests.

**Interfaces:** Receipt v2 adds `changeSetSchema:'krakinai.change-set.v5'` and exact v5 approval/output decisions; ledger v2 holds unchanged receipt1 or receipt2 records. Dispatch strict receipt/approval validation by contract/version. `previewChangeSet()`/`applyApprovedChangeSet()` retain existing caller interfaces and one Stage B transaction; no second B writer.

- [ ] Write red `v5 receipt2 and mixed ledger2`, `ledger upgrade only on successful apply`, `same-ID replay no duplicate`, `same ID different package/approval denied`, `deleted scenes retain replay and backup2`. Add stale head/project/source/selection/order/binding/media, changed decision/digest, revoked session/epoch and injected post-put transaction abort/quota-failure tests. Assert every old record/media hash and foreign write is preserved and no receipt exists on abort.

  ```ts
  expect(receipt).toMatchObject({version:2, changeSetSchema:'krakinai.change-set.v5'});
  expect(afterReplay).toEqual(afterFirstApply);
  expect(afterAbort).toEqual(beforeIncludingForeignWrites);
  ```
- [ ] Run `npm test -- src/__tests__/blockingChangeSetStorage.test.ts src/__tests__/blockingLedger.test.ts`; verify missing v5 validation/commit behavior fails.
- [ ] Add conditional v5 content signing and actual live-source/scope/dependency/manual-decision revalidation inside the current transaction. Commit new scene, explicit membership/selection operations and receipt together; no automatic preferred selection. Preserve exact v1 ledger/receipt/digest branches; upgrade the preference record only with successful v5 writes.
- [ ] Run new storage/ledger/backup tests, existing transaction/replay suites and typecheck; checkpoint `feat: atomically save blocking proposals and v2 receipts`.

### Task 12: Negotiate scope v2 without weakening the authenticated bridge

**Files:** Create `src/domain/mcpCapabilities.ts`, `src/__tests__/blockingMcpCapabilities.test.ts`, `bridge/test/blockingCapabilities.test.ts`. Modify `src/types/mcp.ts`, `src/domain/mcpScope.ts`, `src/domain/mcpProtocol.ts`, `src/connections/browserTransport.ts`, `src/connections/AiConnectionContext.tsx`, `bridge/src/relay.ts`; touch tool descriptions/adapters only for compatible schemas/capability metadata.

**Interfaces:** Preserve `McpScopeV1` exactly; `McpScopeV2` adds only the two approved fields. Browser records authenticated peer capability intersection. Implement a separate versioned pairing negotiation for B peers; keep old `/v1/pair/start` request/response strict and byte-compatible, and use a capability-bound `/v2/pair/start` transcript for new peers. Fall back only on explicit unsupported-route/version response, never authentication/native-denial failures. All capabilities are bound into the handshake proof; session endpoints and auth/revocation limits stay unchanged. B requires fresh native pairing with a supporting peer; no in-place v1 scope promotion.

- [ ] Write red exact-v1-wire tests, new/new capability intersection, new/old B-disabled fallback, old/new legacy pairing, tampered/downgraded capability transcript rejection and independent v2 scope defaults. Assert scope1 unknown B fields reject, no grants materialize during version conversion, and shared direct/desktop clients advertise the same 13 tools and bounds.

  ```ts
  expect(emptyMcpScope().version).toBe(1);
  expect(() => validateMcpScope({...emptyMcpScope(), blockingSceneIds:[]})).toThrow();
  expect(scopeV2.allowBlockingProposals).toBe(false);
  expect(scopeV2.blockingSceneIds).toEqual([]);
  ```
- [ ] Run `npm test -- src/__tests__/blockingMcpCapabilities.test.ts`; `npm --prefix bridge test -- blockingCapabilities.test.ts`; verify expected negotiation cases fail first.
- [ ] Implement capability version dispatch without relaxing origin/Host, native approval, proof, key isolation, deadlines or shared-client response correlation. Prevent scope v2 application on an unsupported peer with an actionable update message. Add v5 only to supported tool package schemas/descriptions, preserving old schemas.
- [ ] Run full existing protocol/crypto/relay/shared-adapter tests, app/bridge typechecks and build to a NEW ignored output directory; checkpoint `feat: negotiate explicit blocking MCP capabilities`.

### Task 13: Expose scoped B reads/differences and complete browser approval

**Files:** Create `src/domain/blockingMcp.ts`, `src/__tests__/blockingMcpPrivacy.test.ts`, `src/__tests__/blockingProposalReview.test.tsx`, `e2e/blocking-mcp.spec.mjs`. Modify `src/domain/mcpReads.ts`, `mcpScope.ts`, `mcpPermissionDraft.ts`, `aiContext.ts`, `src/types/aiContext.ts`, `src/connections/proposalBroker.ts`, `src/components/aiConnections/PermissionReview.tsx`, `src/components/McpProposalReview.tsx`, `src/components/ChangeSetPreview.tsx`, `src/screens/ChangeSetImportScreen.tsx`, `src/screens/AiConnectionsScreen.tsx`, `src/screens/AiContextScreen.tsx`.

**Interfaces:** Consume Task 12 union/capabilities, Task 10 projection and Task 6 per-mode component. B differences return exact target/revision/typed changed paths and output-change availability, never an unfiltered object spread. Receipts/status use existing authorization and actual saved IDs; confirmed new scenes still require their own text grants.

- [ ] Write red permission matrix for project/scene metadata vs exact blocking grant, blocking proposal flag vs normal proposal flag, Full vs identity/asset/notes/filename grants and receipt-only recovery. Put unique secret canaries in each excluded field and assert absence from errors/success/diffs/status/pagination/context export. Deny entire saved Full output without both exact Full and blocking grants; reject oversized UTF8 results instead of truncating.

  ```ts
  await expect(readMcpTool('krakinai_get_generation_prompt', {sceneId}, noBlockingGrant, state))
    .rejects.toMatchObject({code:'PERMISSION_DENIED'});
  expect(JSON.stringify(disclosed)).not.toContain(excludedCanary);
  ```
- [ ] Add red UI `pending proposal causes no writes/focus/route changes`, `complete blocking and video diff`, `Approve blocking changes required`, `same per-mode choices as manual authoring`, `one-use exact consent`, `cancel preserves buffers`. Existing v1–v4 approval/receipt shapes stay unchanged.
- [ ] Run new privacy/review tests; implement explicit Blocking authoring text selection (≤250), separate proposal switch default false, pending-scope comparison and required fresh pairing. Generic permission presets/select-all must not automatically add B-sensitive grants. Extend manual AI context with explicit B opt-in; old context shape stays exact without it.
- [ ] Integrate safe broker projections at preview/submit/status with fresh scope/session checks around awaits. Human browser sees complete exact outputs and preserved source/wardrobe/reference evidence; Codex gets full proposed video only under all necessary grants, otherwise an explicit withheld state. Run `npm run build`, `npm run test:e2e -- e2e/blocking-mcp.spec.mjs`, existing scope/broker/permission/AI context tests; checkpoint `feat: review permissioned blocking proposals in browser`.

### Task 14: Certify actual installed Codex and signed native pairing

**Files:** Create `scripts/qa/blocking-mcp-workflow.mjs`, `blocking-mcp-workflow.test.mjs`, `e2e/blocking-native.spec.mjs`, `e2e/blocking-native-fixture.mjs`. Reuse `scripts/qa/shared-codex-client.mjs`, `mcp-codex-cli.mjs`, existing loopback model fixture and native synthetic helpers; extend helper entry points only where necessary and regression-test each extension.

**Interfaces:** `createBlockingWorkflow({target,changeSet,baseline,onReply})` exposes ordered calls and `accept({callId,tool,message})`, rejects duplicates/missing/out-of-order/mismatched responses, and records exact argument/response hashes. Tests use `certifyInstalledCli(...workflow...)` for production stdio and `startInstalledCodexClient({executable,directory,target,launcherConfig})` for shared desktop acceptance. No external model credentials or global MCP edits.

- [ ] Write red evidence-guard tests with swapped IDs, success prose on an error, omitted failing call, later-success substitution and malformed receipt; all must reject. Run `node --test scripts/qa/blocking-mcp-workflow.test.mjs`.

  ```js
  assert.throws(() => workflow.accept({...reply, callId:'unrequested-call'}));
  assert.equal(correlatedReply.callId, requestedCall.callId);
  assert.equal(correlatedReply.message.ok, true);
  ```
- [ ] Prepare unique owned synthetic profiles/configs/ports (reject 5173/4177/4180), record actual CLI path/version/hash and use the installed 0.73.0 binary when still present; a changed version needs explicit recorded requalification, not a fabricated version string. Build only the reviewed candidate. Verify/re-sign its helper after that build, compare body/hash and Authenticode Valid; keep AllSigned. Package a separate candidate release for desktop transport; request any needed executable signing only for its concrete hash. Do not rebuild the live release.
- [ ] At both `http://127.0.0.1:4173` and `http://localhost:4173`, use a fresh synthetic profile and real signed native window. Owner completes manual native verification for the manual acceptance run. Select only the exact synthetic project/parent B text and proposals; use actual browser review controls for Apply. Keep automated injected-verifier smoke separate from this signed-native result.
- [ ] Run the exact Aya Shot09 scenario: get-scene → preview v5 → submit → pending status/no-write hash check → review per-mode decisions → browser Apply → status → confirmed receipt → replay → Disconnect → denied call. Verify actual new IDs, immutable old scenes, preferred take, other participant tracks, all output/reference/media hashes and restart. Repeat independent permission rejection, stale-source/order, rollback and scope-revocation cases; keep every failed attempt as a failed attempt. Losing one shared client preserves the other; last-client loss revokes as before.
- [ ] Run `KRAKINAI_NATIVE_QA=1` with a Valid signed driver/helper and the two origin cases via `npm run test:e2e -- e2e/blocking-native.spec.mjs` (PowerShell: set the task-specific environment for the command and restore it afterward). Record correlated evidence per call, no original media bytes, keys or native revealed-key screenshots. A manual/signing blocker leaves acceptance incomplete/draft; it is never a passing skip. Review/checkpoint `test: certify signed Codex blocking workflow`.

### Task 15: Complete regression evidence, docs and reviewed Git delivery

**Files:** Create `docs/blocking-and-spatial-continuity.md`, `docs/qa/shot-blocking-b.md`, `docs/qa/shot-blocking-b-results.json`; update `README.md`, `AGENTS.md`, `docs/agent-authoring-guide.md`, `docs/change-set-contract.md`, `docs/scene-prompt-schema.md`, `docs/local-codex-mcp.md`, `.github/workflows/ci.yml` only for new committed synthetic tests, and QA ledger/summary inputs required by the existing schema.

**Interfaces:** Machine-readable QA evidence records actual commands, exits, totals, warnings/skips, tested commit/tree, screenshot inventory/hashes, upgrade record/media hashes and correlated signed-native results. Human report separates source inspection, automated tests, browser behavior, security assumptions and remaining limitations. Update agent guidance to prefer recipe assets, explain supported v5 blocking and explicitly reserve frames/image prompts for C.

- [ ] Run each full command sequentially, log its actual exit independently, and inspect all output: `npm test`; `npm run typecheck`; `npm run build`; `npm audit --omit=dev`; `npm --prefix bridge run typecheck`; `npm --prefix bridge test`; `npm --prefix bridge audit --omit=dev`; `dotnet run --project launcher/tests/Krakinai.BridgeLauncher.Tests.csproj`; `node --test scripts/qa/*.test.mjs`; `node scripts/export-change-set-schema.mjs --check`; `npm run test:qa`; `npm run test:e2e`. Bridge builds use `npm --prefix bridge run build -- --outdir qa-results/blocking-b-dist` and `npm --prefix bridge run build:test`, never overwrite an active signed dist. Tests needing that output set `KRAKINAI_TEST_BRIDGE_DIST` to the matching relative directory. Re-sign after the final build before the final native run.
- [ ] Capture/inspect actual application before/after screenshots at 1440×900, 768×1024, 390×844, 720×450/DPR2; verify no clipped labels, keyboard-only field authoring, touch controls, modal containment/return focus and complete copy/download bytes. Include empty/incomplete/off-camera, selected saved take and changed-output review states. Verify screenshots exist at each reported path. Do not substitute the approved design preview for application evidence.
- [ ] Update docs with Enable/Cancel/old-tab handling, downgrade boundary, actual backup support, manual-output choices, permission setup, exact v5 patches/receipt replay and C exclusions. Test all local doc links and frozen v1–v4 schemas. Record dev advisories/chunk/React warnings separately from production audit; do not claim an area safe from a function-name search or a skipped native test.
- [ ] Self-review against all 18 spec acceptance cases and the five Review Focus lines; perform the selected execution method's required independent final review and fix substantive findings. Verify `git status --short`, `git diff --name-status`, `git diff --check` and the exact staged list. Include only reviewed source/tests/docs and synthetic approved screenshots, no user data, profiles, ZIPs, keys/certificates, private settings or temporary artifacts.
- [ ] Obtain the owner's signed commit through their terminal if SSH key access requires it; do not alter signing. Push only `codex/shot-blocking-spatial-continuity` and open a separate B PR against master when implementation/delivery is authorized. Run hosted Linux/Windows CI on the final signed head, add new helper tests to their existing CI lists, report exact run/job links and retain genuine failed attempts. Do not weaken the Windows pre-boot ten-second security deadline or suppress failures. Keep the PR unmerged, or draft if required manual acceptance is blocked. Do not merge/update PR #12 or activate the new live connection.

## Coverage and Handoff

| Approved design | Owning tasks |
| --- | --- |
| Recipe-first workflows and B/C boundaries (§1–3) | 1, 6, 8, 9, 15 |
| Typed authoring/bounds/relationships (§4) | 2, 8 |
| Canonical output/manual gate/snapshot preservation (§5) | 3, 6, 10, 11, 13 |
| Conservative spatial comparison/final batch basis (§6) | 4, 9, 10, 11 |
| Protected upgrade, downgrade warning, backup/export/templates (§7) | 5, 6, 7, 11, 15 |
| Scope2/capability/v5/approval/receipt/replay (§8) | 10–14 |
| All domain/storage/UI/actual-CLI/failure acceptance (§9) | 1–15, final ledger in15 |

Plan self-review must check spec coverage, exact file paths, producer/consumer type names, test ownership for every Review Focus line and proportion before handoff. The capability negotiation path above is an implementation detail of the approved capability-aware pairing, not permission to remove legacy authentication or change the live registration. If implementation reveals a material change to the approved guarantees, return with the concrete issue rather than silently expanding scope.

**Current state:** inline execution authorized; Tasks 1–14 and Task 15's local implementation, review, fixes and verification are complete. Final standalone root: 1,343/1,343 tests in 155 files. Full browser: 214 passed / 14 explicit native/manual skips, followed by one new touch case and five screenshot-focused cases, all passed on the same runtime. Bridge 67/67, native launcher 38/38, QA helpers 87/87, app/bridge typechecks, build, production audits, frozen schemas and historical 207-check ledger passed. Actual installed CLI 0.73.0 completed both signed-native origins with 15 correlated calls each; the shared desktop 0.166 client lifecycle passed separately. A single fresh independent reviewer found three substantive issues; the one fix pass added RED→GREEN privacy/autosave/incomplete-conversion regressions. All 28 application screenshots exist. Task 15 still requires the owner's signed Git commit, feature-branch push, separate unmerged PR and exact-head hosted CI. No real-library upgrade, live registration/activation, unrelated validation.ts edit, B commit or remote update occurred before this snapshot. The [QA report](../../qa/shot-blocking-b.md) and machine-readable evidence retain failed attempts, warnings and scope rulings; unchecked task bullets above describe the approved original plan, not a claim that these completed checks remain undone.
