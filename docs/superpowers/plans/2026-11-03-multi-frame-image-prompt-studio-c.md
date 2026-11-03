# Multi-Frame Image Prompt Studio — Workstream C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The owner approved this plan and inline execution on 2026-11-03; one independent whole-branch review remains required.

**Goal:** Give every deliberately planned keyframe its own complete still-image prompt and take-specific image history, alongside a separate video prompt and explicitly permissioned, human-reviewed Codex authoring.

**Architecture:** One shared typed keyframe model, still assembler, dependency planner and output-resolution layer serve UI, exports and MCP. Extend the existing Recipe/Stage B atomic writer and protected library-format gate; preserve legacy branches byte-for-byte. Frame image assignment/review events live in a versioned project extension, outside immutable saved prompt snapshots.

**Tech Stack:** Existing React 18, TypeScript, IndexedDB, Vitest/testing-library/fake-indexeddb, Playwright Chromium, Node.js 22, fflate, existing MCP SDK and signed Windows verification helper/shared launcher. No new backend, paid dependency or generation provider.

**Spec:** [Owner-approved C design](../specs/2026-11-03-multi-frame-image-prompt-studio-c-design.md), approved 2026-11-03. Base `e3012123647d9989a923936090102fadd58378a5`; branch `codex/multi-frame-prompt-studio-c`.

## Global Constraints

- The owner approved the design, this plan and inline execution on 2026-11-03. No real library upgrade, live bridge activation, global MCP change or merge follows from approving development.
- Unified shot workspace; independent complete still prompt per planned frame; separate Full/Narrative, Structured and Compact video outputs and existing JSON modes. Preserve every legacy output and v1–v5 contract. Do not concatenate complete image prompts into video text.
- Prefer Recipe / Build from Assets. Incomplete Direct Prompt frame planning remains recoverable through guided conversion; never invent an asset or replace the original Direct Prompt/preferred take.
- Header-only IndexedDB **2 → 3**, support explicit **1 → 3** too; same **eight stores**, no backfill/rewrite. Preserve Cancel/blocked/late-write/versionchange behavior. Older writers must receive VersionError.
- Frame bounds: **16** frames; safe IDs **64** characters; labels **120**; frame instructions **2,000**; per-person expression **500**; authored plan **128 KiB UTF-8**; individual complete/concise image mode **256 KiB UTF-8**; all saved image output/manual strings per take **1 MiB UTF-8**; image history **2,000 events** and project frame-production metadata **4 MiB**. Reject oversize without truncation or lost planning.
- Keep B limits/types/semantics. Repeated Characters use exact participant refs/binding tokens. Off-camera people remain targets until explicitly made visible. No interpolation, image-derived identity or inferred approved anchor.
- Frame images: decodable PNG/JPEG/WebP using the existing **10 MiB** image limit; preserve bytes/hashes. Existing SVG references remain in their existing roles. Stable frame ID, exact project/shot/take and prompt digest own the association.
- Carry-over is explicitly approved, only for unchanged validated image/prompt/bindings/provenance, and resets review. Changed images/takes, removed frames and reordered indices never acquire implicit assignments/approval.
- Preserve stored media **5,000 MiB**; existing full-backup uncompressed **5,500 MiB**, **2,000 entries**, manifest **20 MiB**; all existing compressed/verified-restore gates remain untouched. Keep Project Export **128 MiB media / 16 MiB text / 2,000 entries**. No ZIP64 experiment/PR #12 changes.
- C adds change-set **v6**, scope **v3**, receipt/ledger **v3**, Scene/Generation document **v4** only when C data exists, image document **krakinai.image-prompt.v1**, C Project Export **v3**. Backup manifest **v2** gains explicit required features, not permissive unknown-field acceptance.
- Scope3: **keyframeSceneIds ≤250**, **imagePromptFrameGrants ≤250 exact pairs**, proposal/association/derivation capabilities default false. Keep **13** tools; MCP package **1 MiB**, result **512 KiB**, ledger **4 MiB** and all other transport/session limits. No new IDs or receipt implies a text/media grant.
- New C scope requires supporting authenticated capabilities and a fresh Windows/browser pairing. Preserve AllSigned, certificate trust, current signed releases, global Codex settings and real `localhost:5173` data. Do not touch unrelated `src/domain/validation.ts` work or live ports 4177/4180.
- No automatic approval or database writes before trusted browser Apply. Exact live revisions/source proofs/content/scope are rechecked at the transaction boundary. Media/hash preparation occurs outside the transaction, followed by exact current-record signature validation inside it.
- Flow is manual, with dated official compatibility guidance and Unverified fallback. No external provider calls, credentials, generated-media claims or guaranteed keyframe timing.
- Test only synthetic isolated libraries. Keep keys, certificates, secrets, profiles, generated ZIPs and temporary QA artifacts out of Git. Delete no profiles/files without explicit path authorization. Signing requires concrete artifact authorization; never disable signing/policy or export a private key.

## Review Focus

1. A tab owns a newly uploaded image while another tab saves/deletes a different record: pending, draft, saved and history references all remain reachable (Task 7).
2. A frame is renamed/reordered, or the same Character appears twice: retain exact frame/participant identity and unaffected bytes; conflicting authored times remain unresolved (Tasks 2–4).
3. A manual image/video mode survives a visual change: require an explicit per-mode keep-exact/canonical choice, with correspondence unverified until reviewed (Tasks 4, 6, 9, 12).
4. All C scenes are deleted but association history or a v6 receipt remains: feature detection, old-reader rejection, restore and replay remain correct (Tasks 9–10).
5. Permission/source/media changes after preview, including a switch to another browser origin: reject at the atomic boundary with zero partial writes and no canary leakage (Tasks 8–9, 14–15).

## File Structure and Interfaces

Paths below are repository-relative. Read the spec and applicable AGENTS.md before executing. Existing large files get narrow adapters; no unrelated refactor. These tasks share snapshots, digests and one transaction, so this is one coordinated implementation plan rather than independently activated subsystems.

| New module | Authority / public interface |
| --- | --- |
| `src/types/keyframes.ts` | `KeyframePlanV1`, `PlannedKeyframeV1`, `KeyframePatchV1`, `KeyframeFinding`, `ImagePromptMode = 'full' \| 'compact'`, `ImagePromptSnapshotV1`, `FrameOutputDecisions`, `FrameVideoReviewBasis`; bounds from Global Constraints |
| `src/domain/keyframeValidation.ts` | `validateKeyframePlan(value: unknown, source: SceneDraft, mode: 'planning' \| 'assembly'): KeyframeFinding[]`; no mutation or identity inference |
| `src/domain/keyframePatch.ts` | `applyKeyframePatch(base: KeyframePlanV1 \| undefined, patch: KeyframePatchV1 \| null \| undefined, source: SceneDraft, baseDigest: string): KeyframePlanV1 \| undefined`; omission preserves/null removes |
| `src/domain/keyframeDependencies.ts` | `prepareKeyframeBasis(source: SceneDraft, media: ReadonlyMap<string,MediaAsset>): Promise<KeyframeBasis>`; `diffKeyframeBasis(before: KeyframeBasis, after: KeyframeBasis): KeyframeDependencyDiff` |
| `src/domain/imagePromptDocument.ts` | `assembleImagePrompt(source: SceneDraft, frameId: string, media: ReadonlyMap<string,MediaAsset>): Promise<ImagePromptAssembly>`; result union `{ready:true,snapshot:ImagePromptSnapshotV1}` or `{ready:false,findings:KeyframeFinding[]}` |
| `src/domain/frameOutputReview.ts` | `resolveFrameOutputs(source: SceneDraft, canonical: ReadonlyMap<string,ImagePromptSnapshotV1>, decisions?: FrameOutputDecisions): FrameOutputResolution`; returns exact effective strings/manual buffers/findings/valid |
| `src/domain/frameVideoReview.ts` | `planFrameVideoReview(source: SceneDraft, basis: KeyframeBasis, decision?: FrameVideoDecision): FrameVideoResolution`; B's existing manual video decisions remain separate inputs |
| `src/types/frameProduction.ts`, `src/domain/frameImageAssociations.ts` | `FrameProductionV1`, `FrameImageTarget`, `FrameImageCommand`, `FrameImageEvent`, `FrameVideoReviewEvent`; pure image-event and explicit carry-over planning, signatures below |
| `src/types/keyframeChangeSet.ts`, `src/domain/keyframeChangeSetSchema.ts` | Exact v6 patch/operation/approval types and strict schema extension; frozen v1–v5 branches remain unchanged |
| `src/domain/keyframeChangeSet.ts` | `prepareKeyframeSources(input:ChangeSet,state:ChangeSetState):Promise<KeyframeSourceProofs>` and `keyframeReviewedProjection(plan:ChangeSetPlan):unknown`; v6 recipe/association adapters use Tasks2–4/7 inside the existing planner |
| `src/domain/keyframeMcp.ts` | Scoped plan/image/difference projections and complete single-frame derivation/result selection |
| `src/storage/frameImages.ts` | `applyFrameImageCommand(command: FrameImageCommand): Promise<Collection>`; `uploadFrameImage(input: {target:FrameImageTarget;file:File}): Promise<Collection>`; atomic metadata/media save |
| `src/domain/flowHandoff.ts` | `planFlowHandoff(collection:Collection,snapshot:LibrarySnapshot,selection:FlowHandoffSelection):FlowHandoffPlan`; `buildFlowHandoff(collection:Collection,snapshot:LibrarySnapshot,selection:FlowHandoffSelection,options:{signal?:AbortSignal}):Promise<FlowHandoffArchive>`; exact roles, bounds, strings, file hashes |
| `src/domain/flowCompatibility.ts` | Local dated official-source table and conservative unknown/unsupported findings; no runtime provider lookup |
| `src/components/keyframes/*` | Shared controlled frame editor/timeline, image inspector/history, output decisions, Flow preparation and C proposal detail; use existing design tokens, dialogs, media controls and focus/dirty guards |
| `src/__tests__/fixtures/keyframeFixture.ts`, `e2e/keyframe-fixture.mjs` | Deterministic synthetic Recipe/Direct Prompt/old-reader/media fixtures with stable IDs and expected hashes |
| `scripts/qa/keyframe-mcp-workflow.mjs` | Strict call-ID-correlated installed-CLI v6 acceptance validator, preserving failed attempts |

**Type decisions shared across tasks:** A `PlannedKeyframeV1` has `id`, `label`, `role`, optional `relativePosition` or `timeSeconds`, ordered exact `participantRefs`, `visualInstructions`, per-participant instant/expression data, explicit static composition and relevant reference-association IDs. Its instant is a discriminated Start/End link or a custom B-compatible phase, never a timeline interpolation. `KeyframePlanV1` contains `version:1`, stable `id`, ordered `frames` and explicit take-level still-source adaptations. `ImagePromptSnapshotV1` owns schema/version, exact Full/optional Compact, assembler version, visual/source digests and reference provenance/hashes. Draft/Saved Recipe fields are optional `keyframePlan`, `imagePromptSnapshots` keyed by frame ID, and `manualImageOutputs` keyed by frame ID/mode. Absence retains legacy output paths.

`KeyframeBasis` contains `planDigest`, `videoReviewDigest`, and exact frame-ID → `visualDigest`/bindings/reference-provenance maps. `KeyframeDependencyDiff` has `addedFrameIds`, `removedFrameIds`, `reorderedFrameIds`, `metadataOnlyFrameIds`, `visuallyChangedFrameIds` and `videoReviewRequired`. `FrameOutputDecisions` is a per-frame/per-mode map of `canonical | keep_manual_unverified`; `FrameVideoDecision` is `reassemble | keep_exact_unverified`, with existing B manual video choices supplied independently. Result types expose typed findings and `valid`, never silently discard invalid input.

`FrameImageTarget` pins project ID/revision, shot ID, saved scene ID/revision, frame ID/visual digest and expected association revision. `FrameProductionV1` is optional under `Collection.project`, with its own revision, image events/active pointers and video-review events; no new store. Events have stable IDs, target, media ID/hash when present, prompt basis, source association, explicit provenance, bounded notes and `reviewStatus: 'needs_review' | 'approved' | 'needs_changes'`. Existing-media link, clear and human-review commands are discriminated; remote proposals cannot issue the human-review command. Draft attachments use an explicit draft/frame binding, not a guessed saved take. Video correspondence uses `reviewStatus: 'unverified' | 'reviewed'` against an exact basis, distinct from image review.

`planFrameImageChange(collection:Collection,scene:SavedScene,command:FrameImageCommand,media:ReadonlyMap<string,MediaAsset>,identity:{eventId:string;now:string}):FrameProductionV1` validates exact ownership and returns a new extension. `planFrameCarryOver(input:{source:SavedScene;destination:SavedScene;target:FrameImageTarget;production?:FrameProductionV1;frameIds:readonly string[];media:ReadonlyMap<string,MediaAsset>;newEventId:()=>string;now:string}):FrameImageEvent[]` returns only explicitly selected eligible events. Notes are bounded to 1,000 characters as an implementation choice within the approved metadata budget. `KeyframeSourceProofs` holds exact scene/project/association/media signatures and prepared source/plan/visual digests for only the input's referenced records; never hash the whole real library. `FrameOutputResolution` owns `snapshots`, `manualImageOutputs`, `findings`, `valid`; `FrameVideoResolution` owns `outputs`, `manualOutputs`, `basis`, `reviewStatus`, `findings`, `valid`.

**Commit checkpoints:** Each task ends with a verified checkpoint and proposed commit scope. Use path-specific staging and configured signed commits. If the signer needs the owner's passphrase, record the checkpoint and batch concrete reviewed changes; do not interrupt the owner for every task, disable signing or stage unrelated files. No push to master.

---

### Task 1: Protect the C library format and pin the legacy baseline

**Files:** Modify `src/storage/libraryCompatibility.ts`, `src/components/LibraryCompatibilityGate.tsx`, `src/storage/db.ts`, `src/context/LibraryContext.tsx`. Create `src/__tests__/keyframeLibraryCompatibility.test.ts`, `src/__tests__/fixtures/keyframe-legacy-baseline.json`, `e2e/keyframe-upgrade.spec.mjs`, `scripts/qa/capture-keyframe-baseline.mjs`.

**Interfaces:** Preserve existing guarded open/enable APIs; compatibility states become `absent | legacy-v1 | legacy-v2 | current-v3 | unsupported`. Pre-upgrade reads support the exact detected old header without initialization or record writes.

- [x] Capture deterministic legacy/B video, scene/generation JSON, schema and receipt digests from base `e301212...` using synthetic fixtures; commit only synthetic baseline metadata. Capture before screenshots at the four design viewports before product edits.
- [x] Write failing tests: v1/v2 Cancel leaves header/records exact; absent probe creates nothing; 1/2→3 changes only header; late old-tab writes survive; blocked Cancel cannot upgrade later; old production open receives VersionError; failed/cancelled opens do not poison retry/cache; initialization/starter/template writes await explicit Enable.

  ```ts
  // 'Cancel keeps a version2 library intact'
  expect(await inspectLibraryCompatibility()).toBe('legacy-v2');
  expect(afterCancel).toEqual(before);
  expect(STORE_NAMES).toHaveLength(8);
  ```
- [x] Run `npm test -- src/__tests__/keyframeLibraryCompatibility.test.ts`; record the expected failures against DB_VERSION 2.
- [x] Implement version3 and generic pre-upgrade handling with unchanged eight stores, no record backfill and no await/UI inside upgrade transactions. Explain the downgrade barrier and that download initiation is not verified disk backup.
- [x] Run the new tests plus `libraryCompatibility.test.ts`/`libraryCompatibilityGate.test.tsx`, then `npm run typecheck`; checkpoint `feat: protect keyframe-compatible library format`.

### Task 2: Validate and patch stable frame plans

**Files:** Create `src/types/keyframes.ts`, `src/domain/keyframeValidation.ts`, `src/domain/keyframePatch.ts`, `src/domain/keyframeDependencies.ts`, `src/__tests__/keyframeModel.test.ts`, `src/__tests__/keyframePatch.test.ts`, `src/__tests__/keyframeDependencies.test.ts`, `src/__tests__/fixtures/keyframeFixture.ts`. Modify optional fields in `src/types/domain.ts` only.

**Interfaces:** Produce model/patch/basis types and functions in the shared interface table; reuse `ParticipantRef`, `BlockingPhase`, `blockingParticipantKey()` and binding-token rules.

- [x] Write failing tests for absent/one/Start-End/custom/16-frame plans, 17 rejected, duplicate/unsafe IDs, labels120/121, instructions2000/2001, expression500/501, multibyte 128KiB boundaries, finite exclusive relative/seconds timing, ordered roles/times, unresolved duration and missing dependencies.
- [x] Write targeted patch tests: omission preserves, null removes, unknown removal/duplicate order rejects, explicit full resulting order, unchanged IDs and snapshots survive. Repeat one Character twice and keep an off-camera person as a target; no name matching or invented on-camera track. Assert rename/reorder changes plan/video basis but not per-frame visual basis.

  ```ts
  // 'Reorder retains each visual basis and flags video review'
  expect(diff.visuallyChangedFrameIds).toEqual([]);
  expect(diff.videoReviewRequired).toBe(true);
  expect(new Set(reordered.frames.map(f => f.id))).toEqual(new Set(original.frames.map(f => f.id)));
  ```
- [x] Run `npm test -- src/__tests__/keyframeModel.test.ts src/__tests__/keyframePatch.test.ts src/__tests__/keyframeDependencies.test.ts`; verify red.
- [x] Define `KeyframePatchV1` alongside the frame model now, so Task2 compiles independently; Task5 reuses it in the strict wire contract. Implement typed bounds, patch semantics and pure dependency preparation. SHA work occurs before transactions. Global foundation changes enumerate affected frames; custom instants never interpolate Action.
- [x] Run those tests and existing Blocking model/patch tests plus typecheck; checkpoint `feat: model stable keyframes and visual dependencies`.

### Task 3: Assemble complete canonical still-image prompts

**Files:** Create `src/domain/imagePromptDocument.ts`, `src/__tests__/imagePromptDocument.test.ts`, `src/__tests__/imagePromptSources.test.ts`. Modify `src/domain/sceneDocument.ts`, `src/domain/generationDocument.ts` for C-only document4 projections; consume existing `src/domain/shotTypeRules.ts` and `src/domain/cameraComposition.ts` through narrow static adapters, not broad video formatting.

**Interfaces:** `assembleImagePrompt()` returns only complete canonical snapshots or typed unavailable findings. Saved reads use captured snapshot strings; they never reassemble from live asset records.

- [x] Write failing synthetic Aya/Lucas/chapel tests for full identities, distinct wardrobe, off-camera targets, approved-anchor ownership, source-graphic fidelity, same references and instantaneous expression/pose. Assert no typed spoken dialogue/audio/timed movement enters still output.
- [x] Test each accepted static Camera dimension and reject movement/rig/capture/specialized wholesale inclusion. Legacy mixed prose needs explicit still adaptation; no semantic rewrite by regex. Test corrupt/deleted/mismatched required originals using shared `validateShotSourceMedia()` and a current media map.
- [x] Test 256KiB per mode and 1MiB take output/manual limits with UTF-8, retaining recoverable planning and rejecting rather than truncating. C document4 and old scene/generation/video baselines must remain distinct.

  ```ts
  // 'A complete frame preserves captured identity and standalone still text'
  expect(result.ready).toBe(true);
  if (result.ready) expect(result.snapshot.full).toContain(capturedCharacter.promptText);
  expect(legacyAfter.outputs).toEqual(legacyBefore.outputs);
  ```
- [x] Run `npm test -- src/__tests__/imagePromptDocument.test.ts src/__tests__/imagePromptSources.test.ts`; verify red.
- [x] Implement deterministic provider-independent Full/optional complete Compact assembly and reference/source digests. Keep video-only assembly on its old exact branch.
- [x] Run new tests, `sceneDocument.test.ts`, `generationDocument.test.ts`, `assemblyAndValidation.test.ts`, `blockingAssembly.test.ts`, `blockingLegacy.test.ts`; checkpoint `feat: assemble standalone keyframe image prompts`.

### Task 4: Resolve manual outputs and video correspondence explicitly

**Files:** Create `src/domain/frameOutputReview.ts`, `src/domain/frameVideoReview.ts`, `src/__tests__/frameOutputReview.test.ts`, `src/__tests__/frameVideoReview.test.ts`. Modify `src/domain/promptAssembler.ts` only with an absent-C-preserving adapter for a concise authored-moments section; reuse B output decisions.

**Interfaces:** Produce `resolveFrameOutputs()` and `planFrameVideoReview()`; distinguish effective image strings, canonical strings, manual buffers and review basis. Unverified is not approved.

- [x] Write red tests for inherited manual Full/Compact decisions, canonical rebuild vs exact-manual retention, unchanged per-frame text, dependency edits and mode-specific errors. A visual rename/reorder retains still bytes while reordered motion requires video review.
- [x] Test explicit coordinated video reassembly preserves dialogue/audio and B motion, never copies whole image prompts; keep-exact preserves all effective video strings/manual buffers and remains unverified. A saved review is valid only for the exact plan/video basis.

  ```ts
  // 'Keep exact video does not certify its correspondence'
  expect(kept.outputs).toEqual(source.outputs);
  expect(kept.manualOutputs).toEqual(source.manualOutputs);
  expect(kept.reviewStatus).toBe('unverified');
  ```
- [x] Run `npm test -- src/__tests__/frameOutputReview.test.ts src/__tests__/frameVideoReview.test.ts`; verify red.
- [x] Implement the shared resolvers and concise authored-moment document extension. Do not let a model-supplied approval flag or image upload satisfy human review.
- [x] Run focused tests, baseline hashes and Blocking output-review tests; checkpoint `feat: review frame and video output decisions`.

### Task 5: Define strict v6 operations and pure change-set planning

**Files:** Create `src/types/keyframeChangeSet.ts`, `src/domain/keyframeChangeSetSchema.ts`, `src/domain/keyframeChangeSet.ts`, `src/__tests__/keyframeChangeSetContract.test.ts`, `src/__tests__/keyframeChangeSetPlanning.test.ts`. Modify `src/types/changeSet.ts`, `src/domain/changeSetSchema.ts`, `src/domain/changeSetValidation.ts`, `src/domain/changeSetPlanner.ts`, `src/domain/changeSetRecipe.ts`, `src/domain/changeSetRecipeContent.ts`, `src/domain/recipeConversionSchema.ts` narrowly.

**Interfaces:** Add `krakinai.change-set.v6`. `KeyframePatchV1` has version/base digest, stable-ID supplied-field upserts/removals and exact resulting order. Extend the four Recipe create/revise/alternate/conversion operations; add `frame_image.link`, `frame_image.clear`, `frame_video.request_review`. Existing target/client-ref conventions remain; no arbitrary JSON pointers or output/approval replacement.

- [x] Write failing schema tests for valid strict v6 and unchanged v1–v5 fixtures; reject unknown keys, guessed source IDs, stale revision/digest proofs, duplicate frame edits, foreign image targets, human-review flags and oversized packages.
- [x] Write planning tests for add-middle/reorder/remove, exact same-shot source ownership, new-take client refs, unresolved removed-frame handoff roles, explicit image carry choices and untouched participant/frame/output preservation. Existing-media link requires an actual authorized record.

  ```ts
  // 'v6 is strict while legacy contracts remain accepted'
  expect(parseChangeSet(validV6).schema).toBe('krakinai.change-set.v6');
  expect(() => parseChangeSet(v6WithApprovalFlag)).toThrow();
  for (const old of legacyV1ThroughV5) expect(parseChangeSet(old)).toEqual(old);
  ```
- [x] Run `npm test -- src/__tests__/keyframeChangeSetContract.test.ts src/__tests__/keyframeChangeSetPlanning.test.ts`; verify red.
- [x] Implement strict v6 dispatch plus prepared source/frame/association proofs and exact review projection, reusing Tasks2–4 rather than duplicating validators/assemblers. No writes from planning/preview.
- [x] Run new and all old change-set/Recipe/conversion/Blocking contract and planning tests; checkpoint `feat: plan versioned keyframe change sets`.

### Task 6: Persist drafts and immutable Recipe takes without losing C fields

**Files:** Modify `src/storage/sceneAuthoring.ts`, `src/storage/db.ts`, `src/types/sceneAuthoring.ts`, `src/domain/recipeConversion.ts`, `src/domain/recipeConversionRequest.ts`, `src/components/RecipeMappingEditor.tsx`, `src/components/RecipeConversionReview.tsx`. Create `src/__tests__/keyframeAuthoring.test.ts`, `src/__tests__/keyframeConversion.test.ts`, `src/__tests__/keyframeTemplates.test.ts`.

**Interfaces:** Extend `AuthoredSaveOptions` and existing Recipe save options with frame output/video decisions. Shared `planAuthoredScene()` consumes prepared C snapshots and source proofs; existing callers without C keep old semantics. Guided v6 working packages can remain incomplete/downloadable without committing incomplete converted takes.

- [x] Write red save/reopen/copy/revise/alternate tests preserving stable frame IDs, exact snapshot/manual strings and reference provenance. Old take, preferred take, assets and scene media remain byte-identical. Dirty recovery differs from durable draft saving.
- [x] Test incomplete Direct Prompt planning/resume/source-hash stale rejection; complete image assembly waits for valid guided Recipe conversion. Test explicit template omission acknowledgement for frames/images/B data, with no scene/frame IDs silently retained in templates.

  ```ts
  // 'A converted recipe is a new take, never the preferred-source replacement'
  expect(saved.id).not.toBe(original.id);
  expect(originalAfter).toEqual(original);
  expect(shotAfter.selectedSceneId).toBe(shotBefore.selectedSceneId);
  ```
- [x] Run `npm test -- src/__tests__/keyframeAuthoring.test.ts src/__tests__/keyframeConversion.test.ts src/__tests__/keyframeTemplates.test.ts`; verify red.
- [x] Integrate C fields and decisions into existing managed draft/Recipe write paths, including duplicate detection and original-media revalidation. No parallel persistence API or source mutation.
- [x] Run focused tests and existing revision, save-race, conversion, template and snapshot tests; checkpoint `feat: preserve keyframes through recipe authoring`.

### Task 7: Save frame image associations atomically and retain live media

**Files:** Create `src/types/frameProduction.ts`, `src/domain/frameImageAssociations.ts`, `src/storage/frameImages.ts`, `src/__tests__/frameImageAssociations.test.ts`, `src/__tests__/frameImageStorage.test.ts`, `src/__tests__/frameImageRetention.test.ts`, `e2e/keyframe-media-races.spec.mjs`. Modify optional `Collection.project` data, `src/domain/phase5ProjectValidation.ts`, `src/storage/db.ts` reachability/deletion and draft ownership paths, with preservation adapters in `src/storage/projects.ts` and `src/storage/projectBulk.ts`; reuse existing raster validation and media byte inspection.

**Interfaces:** Implement frame-production types/functions from the interface table. Prepare File decode/signature/dimensions/hash outside a transaction, then add media + association in one transaction with exact source/project/association signatures. Do not call a separately committing media saver before association commit.

- [x] Write red tests for PNG/JPEG/WebP success, unsupported/corrupt/MIME/dimension/missing data, 10MiB and stored-media boundaries; no automatic transcoding or review. Replace/clear/review retain prior events and media hashes.
- [x] Test explicit carry-over only for identical stable frame/effective prompt/bindings/provenance; reset review, same media bytes, no duplicate upload. Changed-prompt reuse requires a distinct explicit provenance/review state; reordering never remaps by index.
- [x] Test 2,000-event/4MiB metadata boundaries and quota/late-source failure with zero orphan media/metadata writes. Test draft, active, cleared-history and cross-tab pending-upload reachability while another tab saves/deletes an unrelated prompt. No orphan sweep.

  ```ts
  // 'Late failure preserves all stores and carry-over never inherits review'
  expect(afterFailedUpload).toEqual(beforeUpload);
  expect(carried.mediaId).toBe(sourceAssociation.mediaId);
  expect(carried.reviewStatus).toBe('needs_review');
  ```
- [x] Run `npm test -- src/__tests__/frameImageAssociations.test.ts src/__tests__/frameImageStorage.test.ts src/__tests__/frameImageRetention.test.ts`; verify red.
- [x] Implement pure event planning, atomic repository calls and reachability adapters, keeping existing legacy First/Last setter behavior unchanged. Explicit legacy-image adoption creates a new association; it never migrates old fields. Project/shot operations preserve the extension; explicit target deletion retires active pointers while retaining hash-bound historical events/media. Historical targets may be deleted, shown as unavailable source records rather than reconstructed takes; backup validation must not require every history target still to exist.
- [x] Run focused tests, `mediaRetention.test.ts`, `projectContinuity.test.ts`, repository/deletion tests and the two-tab browser regression; checkpoint `feat: retain take-specific frame image history`.

### Task 8: Add scope3 and bounded canonical MCP projections

**Files:** Create `src/domain/keyframeMcp.ts`, `src/__tests__/keyframeMcpPrivacy.test.ts`, `src/__tests__/keyframeMcpCapabilities.test.ts`, `src/__tests__/keyframeMcpProjection.test.ts`, `bridge/test/keyframeCapabilities.test.ts`. Modify `src/types/mcp.ts`, `src/domain/mcpScope.ts`, `src/domain/mcpReads.ts`, `src/domain/mcpProtocol.ts`, `src/domain/mcpPermissionDraft.ts`, `src/domain/mcpCapabilities.ts`, `src/connections/browserTransport.ts`, `src/connections/proposalBroker.ts`, `src/components/aiConnections/PermissionsWorkspace.tsx`, `src/components/aiConnections/PermissionReview.tsx`, `bridge/src/relay.ts`, `bridge/src/registerTools.ts` for shared schemas/capability negotiation.

**Interfaces:** `McpScopeV3` adds exact plan scenes/image scene-frame pairs and three false-by-default capabilities. Implement `emptyMcpScopeV3():McpScopeV3` beside existing v1/v2 factories. Capability transcript adds `keyframes.v1`, `image-prompts.v1`, `change-set.v6`, `scope.v3`. Preserve authenticated v1/v2 pairing and old tool arguments; use existing capability-aware transport, not unauthenticated side channels.

- [x] Write red tests for fresh-pairing-required format3, old peer/scope refusal, no select-all promotion, exact250 boundaries and independent B/plan/image/derivation/association/identity/asset/Notes/media/filename/Full-video denials. Put synthetic canaries in every ungranted text field and assert absence from reads, errors, previews, context and receipts.
- [x] Test old `{sceneId}` video reads unchanged; explicit single-frame saved-image reads; preview derivation for a new proposed frame only with explicit derivation and all contributor grants. New saved IDs remain ungranted. No image bytes leave the browser.
- [x] Test bounded default summaries and complete single-operation/frame/mode projections, including 512KiB result /1MiB package limits and schema discovery through the actual SDK client. Reject too-large complete text with actionable narrower-request/export guidance, never truncate.

  ```ts
  // 'Selecting a project does not grant image text or derivation'
  expect(emptyMcpScopeV3().allowImagePromptDerivation).toBe(false);
  expect(emptyMcpScopeV3().imagePromptFrameGrants).toEqual([]);
  expect(JSON.stringify(deniedResponses)).not.toContain('PRIVATE_FRAME_IDENTITY_CANARY');
  ```
- [x] Run `npm test -- src/__tests__/keyframeMcpPrivacy.test.ts src/__tests__/keyframeMcpCapabilities.test.ts src/__tests__/keyframeMcpProjection.test.ts` and `npm --prefix bridge test -- test/keyframeCapabilities.test.ts`; verify red.
- [x] Implement scoped projections, protocol unions, broker/session checks and explicit browser permissions with Disconnect/fresh native pairing. Derivation is read-only. Keep thirteen tool names and all existing scopes/callers working.
- [x] Run focused and all existing MCP scope/protocol/broker/transaction/privacy/capability/transport tests; checkpoint `feat: authorize keyframe Codex workflows explicitly`.

### Task 9: Review exact v6 changes and commit them through Stage B

**Files:** Create `src/components/keyframes/KeyframeProposalReview.tsx`, `src/__tests__/keyframeProposalReview.test.tsx`, `src/__tests__/keyframeChangeSetStorage.test.ts`, `src/__tests__/keyframeLedger.test.ts`. Modify `src/components/ChangeSetPreview.tsx`, `src/components/McpProposalReview.tsx`, `src/screens/ChangeSetImportScreen.tsx`, `src/storage/changeSets.ts`, `src/domain/changeSetLedger.ts`, `src/domain/changeSetCapacity.ts` and reviewed-projection adapters.

**Interfaces:** v6 approval adds separate keyframe/image-output, image-association/carry-over and video-decision categories to exact one-use reviewed content. Receipt3 maps actual take/frame/association IDs; ledger3 accepts unchanged receipt1/2. Prepared C proof signatures are checked again inside the same existing atomic writer.

- [x] Write red UI tests for complete old/new values and strings, unchanged/removed frames, carry IDs/review reset, explicit manual decisions and invalidated consent after a choice/content/source change. Arrival/preview causes no write, navigation or focus theft.
- [x] Write transaction tests changing scope/epoch, exact source/head/project/shot/frame/association/media after preview and immediately before commit; each aborts all writes. Include stale selected take, canary disclosure, reused approval and late quota failures.
- [x] Test one successful add-middle + relevant Blocking + video decision creates one immutable alternate take/targeted membership and reviewed association events/receipt; old take/preferred/other frames/media hashes exact. Retry and receipt replay after deleted targets do not duplicate records or expand reads. Test mixed receipt1/2/3 and 4MiB ledger bounds.

  ```ts
  // 'Rejected atomic save writes no take, association or receipt'
  expect(afterStaleApply).toEqual(beforeApply);
  expect(afterReplay).toEqual(afterFirstApply);
  expect(receipt.changeSetSchema).toBe('krakinai.change-set.v6');
  ```
- [x] Run `npm test -- src/__tests__/keyframeProposalReview.test.tsx src/__tests__/keyframeChangeSetStorage.test.ts src/__tests__/keyframeLedger.test.ts`; verify red.
- [x] Implement exact C projection/consent handling and atomic integration; do not await decode/SHA/UI inside an IDB transaction or add a second writer. Remote operations never mark images/video approved.
- [x] Run focused plus all existing change-set storage/safeguard/ledger/review and MCP transaction tests; checkpoint `feat: approve and atomically save keyframe proposals`.

### Task 10: Preserve C data through backups and project exports

**Files:** Modify `src/domain/backupFeatures.ts`, `src/storage/backup.ts`, `src/domain/projectExport.ts`, `src/domain/sceneDocument.ts`, `src/domain/generationDocument.ts`. Create `src/__tests__/keyframeBackup.test.ts`, `src/__tests__/keyframeProjectExport.test.ts`, `e2e/keyframe-backup.spec.mjs`, `scripts/qa/verify-keyframe-archives.py`.

**Interfaces:** Required features are `keyframes.v1`, `frame-image-history.v1`, `change-set.v6-ledger`; detect records and retained history independently. C Project Exportv3 includes exact image snapshots/history/file mappings; absence retains v1/v2 byte/shape behavior.

- [x] Write red roundtrip tests for old/B/C libraries, C drafts, exact image/video manual strings, deleted-C-scene history/receipt-only libraries, missing/corrupt media and malformed version/required-feature data. Old production readers must reject actual C archives before replacement writes.
- [x] Test restored original hashes, receipt replay, legacy First/Last references, no silently filtered reference files and cancellation/rollback. Assert all pre-existing backup/Project Export constants unchanged, including 128MiB/16MiB/2,000 boundaries.

  ```ts
  // 'Retained image history still requires the feature after scene deletion'
  expect(detectBackupFeatures(historyOnly)).toContain('frame-image-history.v1');
  expect(restoredMediaHashes).toEqual(originalMediaHashes);
  expect(PROJECT_EXPORT_MEDIA_LIMIT).toBe(128 * 1024 * 1024);
  ```
- [x] Run `npm test -- src/__tests__/keyframeBackup.test.ts src/__tests__/keyframeProjectExport.test.ts`; verify red.
- [x] Extend existing serializers/validators/required-feature selection; keep full-backup parser/restore/limits and PR #12 experiment untouched. Python independently checks archive manifest, selected file hashes and exact prompt text.
- [x] Run new and all legacy/Blocking/Recipe/conversion/ensemble backup/export tests, synthetic browser restore, and `python scripts/qa/verify-keyframe-archives.py <synthetic-archive-directory>`; checkpoint `feat: roundtrip keyframe production data safely`.

### Task 11: Build the shared accessible keyframe editor

**Files:** Create `src/components/keyframes/KeyframeEditor.tsx`, `KeyframeTimeline.tsx`, `KeyframeVisualSetup.tsx`, `FrameOutputDecisions.tsx`, `keyframes.css`, `src/__tests__/keyframeEditor.test.tsx`, `src/__tests__/keyframeOutputControls.test.tsx`. Modify `src/screens/SceneBuilderScreen.tsx` through controlled shared editor integration.

**Interfaces:** `KeyframeEditor` consumes `SceneDraft`, current media map, findings and controlled change callbacks; it never writes IDB itself. Timeline selection is a stable frame ID, not index. Use Tasks2–4 and existing B controls/draft dirty guards.

- [x] Write red tests for no automatic plan on view, one/custom/Start-End plans, add/remove/reorder/next-incomplete, selected frame retained after reorder, non-drag keyboard/touch authoring, phase copy and exact participant binding. Show raw legacy motion text as context with explicit still adaptation, not prefilled guessed prose.
- [x] Test unresolved data remains editable, long source descriptions stay collapsed, dialog focus/return, labelled forms, status announcements, complete untruncated copy input and per-mode manual decisions.

  ```tsx
  // 'Only the selected frame prompt is expanded'
  expect(screen.getByRole('textbox', {name: 'Complete image prompt'})).toHaveValue(selectedFullText);
  expect(screen.queryByText(unselectedFullText)).not.toBeInTheDocument();
  ```
- [x] Run `npm test -- src/__tests__/keyframeEditor.test.tsx src/__tests__/keyframeOutputControls.test.tsx`; verify red.
- [x] Implement the compact selected-frame inspector using existing tokens/dialogs. A schematic is labelled as such; no generated-image claim. Assemble validates current original media; saved scenes remain readonly with explicit Recipe-copy editing.
- [x] Run focused and existing Scene Builder/B/Source Media/save-race tests; checkpoint `feat: edit planned keyframes in the recipe workspace`.

### Task 12: Unify output, Continuity and take-specific image review

**Files:** Create `src/components/keyframes/FrameImagePanel.tsx`, `FrameImageHistory.tsx`, `FrameVideoReview.tsx`, `src/__tests__/keyframeOutputWorkspace.test.tsx`, `src/__tests__/keyframeImageUI.test.tsx`, `src/__tests__/keyframeContinuity.test.tsx`. Modify `src/screens/PromptOutputScreen.tsx`, `src/screens/promptOutput.css`, `src/components/ContinuityViews.tsx`, `src/components/ProjectContinuityPanel.tsx`, existing scene prompt viewer adapters and scene route/context helpers only where needed.

**Interfaces:** Preserve exact project/shot/take/frame and return route. Existing Prompt URLs resolve to Video Prompt. Image Frames reuses Task11; image actions call Task7, review is bound to current exact basis.

- [x] Write red tests for distinct Image Frames/Video Prompt, retained References/Review/JSON modes, complete Copy/Download for every mode, no truncation, correct selected take and route/back/dirty restoration. Add-middle must leave existing Start/End text and references exact.
- [x] Test missing/corrupt/unsupported uploads, replace/clear/history, explicit legacy-image adoption, unapproved carry-over defaults/reset reviews, new-take manual video choices, exact correspondence review and stale image/source revision errors. No review is inherited from upload.

  ```tsx
  // 'Unchanged images need explicit carry-over approval'
  expect(screen.getByRole('checkbox', {name: /Carry unchanged/})).not.toBeChecked();
  expect(copiedImageText).toBe(fullSelectedImageText);
  expect(copiedVideoText).toBe(effectiveVideoText);
  ```
- [x] Run `npm test -- src/__tests__/keyframeOutputWorkspace.test.tsx src/__tests__/keyframeImageUI.test.tsx src/__tests__/keyframeContinuity.test.tsx`; verify red.
- [x] Implement the unified workspace with constrained desktop content scrolling and stacked mobile flow, shared take header/history, labelled full prompt viewers and explicit image/video review controls.
- [x] Run focused plus existing output/viewer/reference/Continuity/take-manager tests; checkpoint `feat: unify image-frame and video output review`.

### Task 13: Prepare bounded manual Flow handoffs

**Files:** Create `src/domain/flowHandoff.ts`, `src/domain/flowCompatibility.ts`, `src/components/keyframes/FlowHandoffDialog.tsx`, `src/__tests__/flowHandoff.test.ts`, `src/__tests__/flowHandoffDialog.test.tsx`. Integrate from Prompt Output; reuse bounded Project Export primitives and add archive verification to Task10's Python checker.

**Interfaces:** `FlowHandoffSelection` pins project/shot/take, mode `frames | ingredients`, exact selected frame/association IDs and ordered roles, explicit exclusions and model-guidance key. `FlowHandoffPlan` contains completeness/findings, full image/video strings, selected actual-file entries, byte/entry estimates and exact basis. `FlowHandoffArchive` contains ZIP bytes/name/manifest.

- [x] Write red tests for one-frame/Start-End and Ingredients selection, actual available files, empty/missing/unsupported files, explicit exclusions, exact IDs/order/hashes/strings, deduplicated bytes preserving association roles, cancellation and 128MiB media/16MiB text/2,000-entry bounds. No silent file omission or Reference Pack change.
- [x] Test unknown/unsupported/stale model guidance, no universal ingredient-count assumption and no middle-frame timing guarantee. Match the current official Flow sources during implementation; label unverifiable account/region/model guidance Unverified.

  ```ts
  // 'Handoff copies the selected files and strings exactly'
  expect(exportedFileHashes).toEqual(selectedOriginalHashes);
  expect(exportedImageText).toBe(savedEffectiveImageText);
  expect(exportedVideoText).toBe(savedEffectiveVideoText);
  ```
- [x] Run `npm test -- src/__tests__/flowHandoff.test.ts src/__tests__/flowHandoffDialog.test.tsx`; verify red.
- [x] Implement a preview-first manual adapter, stable safe filenames and a versioned hash manifest/readme, preserving original bytes. No provider calls or complete-package claim with unresolved files; explicit exclusion is visible in export metadata.
- [x] Run focused tests and independently read synthetic archives with Python, comparing every prompt/file/hash; checkpoint `feat: prepare manual frame and ingredient handoffs`.

### Task 14: Prove browser workflows, privacy and recovery with synthetic data

**Files:** Create `e2e/keyframe-fixture.mjs`, `e2e/keyframe-authoring.spec.mjs`, `e2e/keyframe-output.spec.mjs`, `e2e/keyframe-mcp.spec.mjs`, `e2e/keyframe-flow.spec.mjs`. Extend prior upgrade/media/backup specs from this plan; add `scripts/qa/keyframe-mcp-workflow.mjs` and its `.test.mjs`. Modify `.github/workflows/ci.yml` only to include the new committed validator tests in both applicable jobs.

**Interfaces:** Reuse existing isolated browser/loopback bridge fixtures and real application controls. The validator takes raw tool replies with original call IDs and expected state hashes; it rejects a later success substituting for an earlier failed call.

- [x] Add failing browser scenarios for the exact Aya Shot09 add-middle request, preserving other frames/source/preferred take; denied scope/text/media/derivation, stale preview/late changed media, no preapproval writes, quota rollback and receipt replay. Use synthetic assets/images/scenes only.
- [x] Add actual clipboard complete-string checks, per-mode decisions, two-tab pending uploads, corrupted images, source graphics, guided Direct Prompt conversion, reload/browser-restart recovery and exact archive/file hashes. Exercise all shared UI paths rather than only domain fixtures.
- [x] Add keyboard-only, focus containment/return/status and narrow-layout assertions at 1440×900, 768×1024, 390×844 and 720×450/DPR2, including long identity text and all relevant empty/stale states. Capture labelled before/after product screenshots separately from design mockups.
- [x] Build the current application and isolated bridge/test artifacts (`npm run build`, `npm --prefix bridge run build -- --outdir qa-results/keyframe-browser-dist`, `npm --prefix bridge run build:test`) so tests cannot exercise a stale dist. Run focused specs using `npm run test:e2e -- e2e/keyframe-authoring.spec.mjs e2e/keyframe-output.spec.mjs e2e/keyframe-mcp.spec.mjs e2e/keyframe-flow.spec.mjs e2e/keyframe-upgrade.spec.mjs e2e/keyframe-media-races.spec.mjs e2e/keyframe-backup.spec.mjs`, wiring that isolated dist into existing test fixtures; preserve real failures/skips before fixing them.
- [x] Implement only missing narrow adapters revealed by those regressions; run each changed test to pass and run `node --test scripts/qa/keyframe-mcp-workflow.test.mjs`. Validate counters/denominators from machine-readable Playwright results, not console estimates; checkpoint `test: certify synthetic keyframe authoring workflows`.

### Task 15: Exercise installed Codex, signed native pairing and shared clients

**Files:** Create `e2e/keyframe-native-fixture.mjs`, `e2e/keyframe-native.spec.mjs`, `e2e/keyframe-shared-native.spec.mjs`. Extend `scripts/qa/mcp-codex-cli.mjs`, `scripts/qa/shared-mcp-acceptance.mjs` only with the v6 workflow selectors needed by the new validator. Keep production launcher lifecycle/security unchanged unless a concrete C compatibility test requires a narrow fix.

**Interfaces:** Reuse the existing loopback model fixture, actual installed Codex CLI, production stdio launcher/managed adapter and signed Windows native helper. Each attempt has a fresh isolated profile/run ID, exact binary/entry/package hashes and raw call-ID-correlated evidence. No external credentials/model request.

- [x] Extend validator tests to reject fabricated success text, missing/mismatched/duplicate call IDs, failures followed by unrelated success, wrong receipt IDs/digests, extra writes, expanded grants and mismatched image hashes; run them red, then implement the new workflow adapter and run green.
- [x] Build final candidate bridge/test artifacts into a new ignored release directory, preserving every live signed release. Hash the concrete helper, request owner signing if required, and verify Authenticode **Valid** under unchanged AllSigned before native runs. Additional launcher executable signing requires its own concrete artifact approval; no trust installation/policy change.
- [x] At both `http://127.0.0.1:4173` and `http://localhost:4173`, use disposable profiles and a free isolated relay port. Pair via the actual signed Windows window; browser-selected scope3 grants only the synthetic project/source/frame/contributing texts and proposal capabilities. The real `localhost:5173` profile is never opened by QA.
- [x] Have installed Codex call actual source/preview/submit/status/receipt tools for the Aya middle-frame scenario. Pause at real browser review; choose exact output/carry-over decisions and Apply using browser controls. Capture zero writes before Apply and exact new scene/frame/association IDs afterward; preserve old scene, other frames, preferred take and media hashes. Retry, restart the test browser, read permitted receipt/results, and reject ungranted new text IDs. Then explicitly select the new synthetic scene/frame in browser Permissions, apply that grant, and verify the actual CLI reads its complete saved image prompt; this is an explicit new grant, not a receipt side effect.
- [x] Execute denied/stale/rollback variants and shared-client departure/Disconnect/last-client revocation with real production transports. Preserve every failed attempt; a native/manual skip is incomplete acceptance, never a pass. Avoid uncontrolled startup/model network requests; record blocked attempts separately if the installed CLI makes them.
- [x] Run the specs with existing `KRAKINAI_NATIVE_QA=1` and the appropriate signed/manual mode; validate evidence using `node scripts/qa/keyframe-mcp-workflow.mjs <attempt-directory>`. Record actual CLI versions, durations, stdout/stderr warnings and exact exit codes; checkpoint `test: verify native Codex keyframe acceptance`.

### Task 16: Complete documentation, full regression and one whole-diff review

**Files:** Create `docs/keyframes-and-image-prompts.md`, `docs/change-set-v6.md`, `docs/qa/multi-frame-image-prompt-studio-c.md`, `docs/qa/multi-frame-image-prompt-studio-c-results.json`. Modify `README.md`, `docs/agent-authoring-guide.md`, `AGENTS.md`, `docs/local-codex-mcp.md`, `docs/desktop-bridge-launcher.md`. Update versioned schema/QA ledgers and CI summary selectors where C assertions require them, preserving all existing evidence.

**Interfaces:** Docs distinguish shipped behavior, proposed/development capabilities, browser/native tests, assumptions and unresolved risks. Agent guidance uses the newly implemented strict v6 and exact grants, preserving Recipe-first and all older contracts. No fabricated generation/approval claims.

- [x] Update user documentation for separate frame/video prompts, new take vs image history, explicit carry-over, protected upgrade/downgrade barrier, bounded history/export, unresolved Direct Prompt plans, manual Flow and fresh scope3 pairing. Include a nontechnical start-to-finish example and minimum-scope agent example.
- [x] Run `git status --short`, `git diff --name-status`, `git diff --check`, `npm test`, `npm run typecheck`, `npm run build`, `npm audit --omit=dev`, `npm run test:qa`, `npm run test:e2e`; run `npm --prefix bridge run build`, `build:test`, `typecheck`, `test`, `audit --omit=dev`; run `dotnet run --project launcher/tests/Krakinai.BridgeLauncher.Tests.csproj`; run all committed QA-helper tests selected in CI plus C's validator. Record exact commands/results/exits/warnings and machine-readable passed/failed/skipped totals.
- [x] Reconcile every C/legacy screenshot path/hash, baseline output/document/receipt hash, native attempt and archive hash. Verify final candidate signatures after the final bridge build; any changed signed helper invalidates earlier native acceptance until re-signed/retested. Do not rerun full suites without a relevant change/failure/unresolved concern.
- [x] Request exactly one independent read-only whole-diff review on the complete candidate, covering the approved design and this plan. Fix material findings in one substantive pass with focused regressions, then rerun impacted/full gates as required. Do not delegate product implementation by default or repeat broad reviewer cycles.
- [x] Inspect the complete tracked/new file list and secret/artifact boundaries. Stage only reviewed source/docs/synthetic fixtures; exclude profiles, ZIPs, certificates, keys, credentials, local settings, ignored QA outputs and unrelated work. Check local documentation links/anchors and staged diff; checkpoint `docs: document keyframe production and verification`.

### Task 17: Owner-signed feature commit, hosted CI and unmerged PR handoff

**Files:** Final staged feature diff and PR description only; no master push, protection bypass, live deployment or cleanup of unapproved paths.

**Interfaces:** Final hosted tests must identify the exact signed pushed head. Local native artifacts must be tied to matching production source/entry hashes; subsequent production changes require relevant acceptance again.

- [ ] Present the concrete reviewed commit scope and use the configured SSH signer. If it blocks on the passphrase, ask the owner to run the exact signed-commit command in their terminal; do not disable signing or request secrets.
- [ ] Push only `codex/multi-frame-prompt-studio-c` and create its own PR against master, kept unmerged. If the remote baseline changed, reconcile without overwriting local work and repeat affected validation rather than assuming old evidence covers new source.
- [ ] Verify hosted **Linux and Windows CI** on the final head SHA, with exact run/job links, actual counts and explicit native/manual skips distinguished from completed local native acceptance. Any CI fix is reviewed/scoped/signed and tested again on its new head.
- [ ] Deliver PR/commit/diff links, tested SHA, exact local/CI/native results, source/output/media/archive hashes, before/after screenshots, unchanged legacy/limit evidence and remaining risks. State any unsupported/unverified provider or browser behavior plainly. Keep PR #12, live setup and actual library unchanged; merge/activation remain separate owner decisions.

## Self-Review and Approval Gate

- [x] Spec coverage: design §§1–4 → Tasks11–12; §§5–7 → Tasks2–6; §8 → Tasks6–7/12; §9 → Tasks1/6/9–10; §§10–11 → Tasks5/8–9/14–15; §12 → Task13; §13 → Tasks14–17; §14 → this approval gate. No independent provider-generation feature is implied.
- [x] Interface scan: later tasks consume the named model/basis/resolution/proof/association functions; no second still assembler, media rule set or atomic writer. Exact client refs and stable target IDs remain distinct.
- [x] Review Focus: all five conditions have explicit failing tests in the owning tasks; late changes are rechecked at save, not merely preview.
- [x] Boundary scan: old versions/absence, manual buffers, history-only feature detection, UTF-8 budgets, current source media, origin-specific grants and rejected/failed native attempts remain visible.
- [x] Proportion/execution: task interfaces and assertions specify decisions rather than full implementation bodies. Each task has a focused test cycle/checkpoint. This is planning only; none of the unchecked implementation/test steps has run.

**Owner decision, 2026-11-03:** Approved this plan and **inline implementation**. These seventeen tasks depend on one model, review digest and atomic boundary. Execute without per-task permission prompts; reserve one independent whole-branch review for the completed change. Signing, manual native confirmation and any live activation retain their concrete approval boundaries.
