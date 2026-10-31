# B1 — Recipe Change-Set Contract and Asset Assembly

Status: approved by the user on 2026-10-31 for inline implementation and a separately tested B1 PR; no further planning approval required.
Date: 2026-10-31 (Asia/Taipei).
Base: latest master, verified `4f3a90e8f4230c3e0adc4213d23f61a5140ece3a`, the merge of PR #29.
Branch: `codex/recipe-change-set-b1`, reusing the clean existing linked worktree.

## Intent and delivery boundary

Implement the first milestone of the user's Workstream B brief: Codex can propose a genuine single-character recipe using authorized existing assets and explicitly approved same-batch candidates, preview the actual assembler output, and commit the assets, scene, storyboard attachment and receipt atomically. The saved recipe can be reopened in the current Scene Builder.

B2 participants, parent-bound variant creation and multiple dialogue cues, B3 conversion/integration, Stage D connectivity, production-library reads/writes, the real Wedding project, unrelated validation.ts work and ZIP64 PR #12 are excluded. B2 starts only after B1 is reviewed and integrated. B3 follows its stated gates. No automatic merge.

## Directly verified current limitations and reusable boundaries

1. `src/types/changeSet.ts` and `src/domain/changeSetSchema.ts` expose the literal `krakinai.change-set.v1` envelope and only Direct Prompt scene creation/revision operations (plus restoration).
2. `src/domain/changeSetPlanner.ts` sets non-restore authored operations to `authoringMode: direct_prompt`. `assetRefs` and `variantRefs` resolve context snapshots; they do not turn the authored text into assembled recipe output.
3. `src/domain/promptAssembler.ts` already provides `createSnapshotFromAsset`, `createSnapshotFromVariant` and `assembleScenePrompt`. `sceneDocument.ts` preserves component provenance, scene-only overrides and current Full/Structured/Compact formatting.
4. `src/storage/sceneAuthoring.ts:planAuthoredScene` is synchronous and already supports normal recipe validation/assembly, current stored source-media checks, anchor resolution, immutable history and explicit project/shot targeting. `buildRevisionDraft` clones saved component snapshots.
5. Stage B's planner already allocates stable IDs, handles explicit candidate create/reuse/defer decisions and duplicate acknowledgements. `src/storage/changeSets.ts` replans against current records in one existing eight-store transaction, checks reviewed state and browser authorization at the write boundary, and commits the receipt with the writes. Replay uses the stored digest/receipt.
6. `shotTypeRules.ts` and the Scene Builder's Assemble handler enforce actual original-image/video requirements. A pending-input label is not an uploaded file. These requirements also apply to recipes submitted externally.

Other inspected integration points: `changeSetReferences.ts`, `changeSetCandidates.ts`, `changeSetValidation.ts`, `changeSetState.ts`, `changeSetLedger.ts`, `identityAnchors.ts`, `cameraComposition.ts`, `proposalBroker.ts`, `mcpScope.ts`, `mcpProtocol.ts`, `ChangeSetPreview.tsx`, the Scene Builder and the generated-schema exporter.

## Approaches and proposed decision

Recommended: add a v2 change-set envelope with three recipe operation discriminators and route them into the existing planner/save boundary. Keep the published v1 schema and valid v1 behavior unchanged. This adds explicit capability versioning while sharing storage, approval, snapshots and assembly.

An additive extension of the v1 operation enum would be smaller, but changes the declared v1 contract and makes capability support less clear to older external clients. A separate recipe writer/importer would duplicate validation, identity handling and transaction semantics and is rejected.

The user approved the v2 design on 2026-10-31. Routine implementation details below remain within the user's delegated contract-design scope.

## Versioned contract

- Preserve `CHANGE_SET_SCHEMA` and `docs/change-set.schema.json` as v1. Add `CHANGE_SET_V2_SCHEMA`, a generated `docs/change-set-v2.schema.json`, and an internal supported-envelope rule accepting v1 or v2.
- V1 accepts its current operations only. V2 accepts the existing operations plus `scene.create_recipe`, `scene.revise_recipe`, and `scene.create_recipe_take`.
- Use one repository-owned canonical structural rule definition for runtime validation, exported JSON Schema and MCP tool input schemas. Existing semantic validators still enforce record-dependent rules; document the structural/semantic distinction.
- Keep the MCP API/transport version, tool names, existing argument envelopes and limits. The two existing preview/submit tools advertise the supported change-set union through their normal MCP input schemas; no invented schema-fetch tool is needed.
- Preserve limits: 20 MiB manual package, 1 MiB MCP package, 250 operations, 10 targeted projects, 250 new shots, 100 scene operations, 50 candidate operations, 500 pending inputs, dependency depth 16, and current scope/result limits.
- Continue dependency-first operation ordering. Unknown, wrong-kind, cyclic or forward client references reject with explicit errors. No hidden reordering or partial execution.

### Recipe operation fields

Reuse the existing top-level `assetRefs`, `variantRefs`, `references`, `sourceMedia`, `pendingInputs`, `shotType`, `settings`, `title`, `project`, `shot`, `clientRef`, `reason` and source/provenance conventions. This retains existing scope and dependency traversal rather than introducing a parallel asset-reference language.

Creation requires a title, explicit Shot Type, project/shot targets, settings with aspect ratio and duration, and structurally valid bindings. Existing projects require `expectedRevision`. Source assets use exact IDs plus `expectedRevision`; new/reused same-batch assets use the producing candidate's client reference. Variants use their actual ID and expected revision.

Add bounded recipe-only fields:

- `sceneInstructions` and scene-level `avoidText`.
- Scene component overrides for non-Character slots, using the existing full/compact override semantics. Base snapshots remain present.
- `clearSlots` for explicit removal, subject to normal required-slot/variant rules. Character text overrides are forbidden; explicit Character selection remains supported.
- Existing single `DialogueConfig`, including its currently supported performance direction. B2 participant/cue fields reject in B1.
- `cameraComposition` using the existing `CameraCompositionChoice`; null explicitly resets composition. Internal baseline fields, source snapshots and approval stamps are not caller-supplied.
- A bounded identity-source choice: master by default; approved-anchor selection can use only actual stored approval metadata and existing validity rules. No caller-provided anchor approval or identity text.

Revision/take operations require `sceneId`, `expectedHeadId`, project/shot and expected project revision. B1 revisions and recipe takes operate on recipe parents. Existing Direct Prompt conversion UI and mapping remain B3; a new recipe can already be attached to a shot containing a preserved Direct Prompt through normal recipe creation.

Patch semantics are explicit: omitted values retain the parent snapshot/value, listed bindings replace only those slots, `clearSlots` removes only named slots, nullable dialogue/composition clears only that field, and settings merge by named field. Reject conflicting replace/clear instructions and empty revision patches. New creation defaults are documented and bounded; no library asset is selected by title.

Recipe operations never accept externally assembled text, `directPrompt`, raw snapshots, manual outputs or identity-approval fields. For a recipe parent with manual output overrides, require explicit acknowledgement to discard those overrides and reassemble all outputs; otherwise block with an actionable message. The preview displays the resulting output differences.

## Binding and assembly pipeline

1. Parse the selected version and perform structural, bound, dependency and duplicate-slot validation.
2. Apply candidate decisions in the established dependency-first planner order. Created assets retain `unreviewed` status; Character creation starts without an approved anchor. Deferred candidates remain unresolved.
3. Build a fresh in-memory recipe draft, or clone the existing recipe with `buildRevisionDraft`. Resolve only explicit changed bindings through shared snapshot helpers. Preserve every unchanged frozen slot, even if its current reusable asset has later revisions.
4. Extract/share the binding-validation portion of `applyImportedContexts` as needed, retaining its v1 behavior. Enforce category-to-slot and variant-parent compatibility without silently switching or reparenting a Character. Avoid importing Direct-Prompt-only fields into recipe drafts.
5. Apply supported scene-only overrides and `applyCameraComposition`/reset helpers. Reject explicitly requested bindings that are inapplicable to the chosen Shot Type rather than silently discarding them. Shot Type changes show their active/inactive component consequences in the preview.
6. Reconcile references using the existing association/role rules. Preserve inherited source IDs, labels and names; do not fabricate media IDs, reassign media or delete attachments. Required originals are validated against the actual stored media map.
7. Call `planAuthoredScene`, which calls the authoritative assembler and current validation. New recipe operations set `authoringMode: recipe`, clear only explicitly acknowledged manual outputs, and record source/provenance in supported revision metadata and the receipt. Do not change the assembler or validation.ts.
8. Add the new immutable scene to the explicit storyboard shot through existing project/history helpers. Preferred selection and shot status remain unchanged unless separate existing operations and approvals request them.

No source asset/variant writes are made for overrides or camera composition. New Camera assets are unnecessary for scene-only variations. Rebinding an updated asset is always explicit.

## Preview, readiness and incomplete planning

Extend the current operation detail dialog, not the entire application workspace. Show resolved component names/IDs/revisions, candidate-created versus reused/existing sources, overrides, identity advisories, originals and pending inputs. Provide Full/Structured/Compact tabs with exact complete read-only text and accessible Copy controls, plus the existing previous-versus-proposed view. Keep raw operation JSON accessible.

Four states must be visible:

1. Invalid contract/binding: blocking error; no scene is saved.
2. Valid planning package with missing required components/originals or a deferred dependency: blocking readiness findings, with complete supplied recipe/candidate details retained.
3. Valid assembled recipe with optional production inputs pending: exact outputs can be saved, but generation readiness warnings remain visible.
4. Valid assembled recipe without pending inputs: normal review/save.

For state 2, B1's explicit preservation flow is a downloadable versioned recipe/candidate JSON package and the existing retained proposal/editor. It is not a saved immutable scene. Users can re-import/resubmit the package after adding media or deciding candidates. Existing planned shots stay unchanged. If a new project/shot must be persisted before assembly, use a separately reviewed existing planning-only change set; a blocked compound batch never applies just its successful half. Do not silently save a Direct Prompt or invent a stored draft ID. A persistent draft-write operation is not necessary for B1.

The preview must not claim outputs exist when assembly is blocked. Source/detail views remain useful while candidate decisions are deferred, and changing a decision recomputes the entire preview.

## Atomicity, approved content and stale-state protection

Keep `applyApprovedChangeSet` as the only writer. Re-read state, synchronously replan/validate and check browser consent immediately before enqueuing writes in its existing transaction. No async hashing, network request or external model call is introduced inside the transaction.

Extend relevant-state capture for new recipe operations, including actual explicitly bound asset/variant revisions, live anchor reads consulted by revision/assembly, parents/heads, project/shot membership, candidate decisions, duplicate matches and associated media metadata. Unchanged component text comes from the frozen parent, not a fresh asset lookup.

Additionally bind v2 recipe preview content to the approved plan: compare a deterministic canonical projection of resolved component snapshots, settings/dialogue, generation metadata, reference associations, pending inputs and all three assembled outputs during replan. Exclude volatile created/applied timestamps. Incorporate this into the v2 reviewed state/content comparison without changing historical v1 signatures. This guards against preview/save output drift as well as stale records.

All approved candidate assets, project changes, new scenes and the receipt commit together or roll back together. Stable allocation and content/approval digests retain replay/idempotency. A stale revision, failed late write, quota failure, changed consent or disconnect before the write boundary leaves the previous library intact. Preserve the existing committed-boundary behavior if disconnect occurs after authorization.

## MCP privacy and discovery

Retain the browser-owned broker and actual trusted browser controls. Existing project, scene, reusable-asset, variant, media and candidate grants apply to recipe operations at submission, re-preview and the atomic write boundary. Same-batch candidate reuse uses the existing reviewed, proposal-local reuse grant.

Identity/ordinary text disclosure remains separate from metadata/binding permission under existing policy. Browser assembly may resolve a selected binding locally; that does not grant the MCP caller its private source text. Keep MCP proposal/status responses bounded summaries and exact receipts, not unrequested assembled prompts or identity text. Reading saved Full output continues to require its existing explicit permission.

New assets/scenes never silently extend ongoing reusable/full-prompt read scopes. Existing project grants still follow storyboard take metadata, as disclosed in Workstream A. No direct database-write or auto-approval MCP tool is added.

## Compatibility and backup

No IndexedDB schema/store, storage-limit, backup-limit, Project Export limit or restore-gate change is required. Existing recipe record shapes already carry the necessary snapshots and overrides.

Extend receipt operation-type validation to recognize the new operations while accepting existing v1 receipts unchanged. Keep ledger/receipt versions where the stored structure remains compatible; include new provenance using supported fields. Validate and round-trip a synthetic full backup containing old Direct Prompts, legacy recipes, new recipe scenes and v2-operation receipts. Prove restoration of media hashes and associations, and test a legacy v1 archive as well. Do not claim new backups are readable by older application versions.

Freeze legacy Full/Structured/Compact and Generation JSON fixtures before edits. No historical record is migrated, reassembled or rewritten.

## Proposed affected areas

- Types, canonical change-set rules, parser, dependency validation, schema export and documentation/examples.
- A small recipe-draft construction module and shared binding helpers; planner dispatch and recipe-specific resolved preview data.
- Relevant-state/approved-content comparison, receipt operation validation and capacity compatibility.
- MCP preview/submit input schemas and scope enforcement tests; existing tool names and bridge transport remain.
- Existing change-set operation detail UI and blocked-package download action.
- Focused unit/integration/browser/SDK fixtures and measured QA evidence.

The exact file split and helper names are implementation choices. Avoid unrelated refactors. `promptAssembler.ts`, identity/Shot Type rule semantics, unrelated `validation.ts`, native pairing protocol and full-backup implementation remain unchanged unless a directly demonstrated integration defect requires a scoped decision.

## Acceptance and verification map

| User B1 criterion | Required evidence |
| --- | --- |
| 1 existing Environment/Action | Saved recipe has actual IDs/revisions and normal assembler output. |
| 2 same-batch approved candidates | New asset IDs appear in frozen scene slots; atomic receipt maps them. |
| 3 deferred dependency | Preview blocks; no assets/scenes/project/receipt writes; package retained/downloadable. |
| 4 existing revisions | Exact revision passes; changed/deleted record blocks. |
| 5 category binding | Every wrong category and duplicate slot fails; variant ownership enforced. |
| 6 references | Roles, source IDs, ordering and original media associations remain correct. |
| 7 Camera-only changes | All other snapshots, global assets and old scenes compare equal. |
| 8 all outputs | Full/Structured/Compact equal the existing assembler byte-for-byte for the resolved draft. |
| 9 frozen source revisions | Editing a library asset leaves saved snapshots/outputs unchanged. |
| 10 replay | Identical request returns its receipt and creates no duplicate records. |
| 11 stale project/asset | Post-preview changes abort the entire reviewed batch. |
| 12 late failure | Injected late-write/quota/abort failures restore exact pre-batch state. |
| 13 existing Direct Prompts | Existing fixtures/exports and authoring behavior remain unchanged. |
| 14 legacy hashes | Full legacy golden-output matrix remains equal. |
| 15 MCP approval | Actual SDK submission has no DB writes; browser-only reviewed Apply commits; synthetic event auto-approval rejects. |
| 16 media hashes | Valid synthetic image/video SHA-256 values agree before/after import and backup/restore. |
| 17 reopen recipe | Open new saved recipe as editable draft; change one component and save a new immutable version/take. |

Also test parser/exported-schema/MCP-schema parity, v1 rejection of v2-only operations, invalid recipe fields/identity overrides, incomplete original-media cases, approved-anchor freshness, manual-output acknowledgement, no preferred-take changes, preview/content tampering, scope revocation and bounded metadata disclosures.

Use only fresh synthetic browser profiles. Capture changed preview states at 1440, 768 and 390 widths and keyboard/200%-equivalent reflow. Retain profiles and ignored QA artifacts; do not delete or use real profiles.

After implementation: full unit/component suites, typecheck/build, root/bridge production audits, bridge production/test builds and suites, QA ledger/evidence checks, full browser suite, schema parity/export checks, backups/hashes and the focused real SDK browser workflow. Existing native Windows checks are attempted where relevant using the established synthetic harness, actual production launcher and reviewed signing procedure; verify helper Authenticode after rebuild and preserve AllSigned. If signing or native execution cannot complete, report those cases unverified/skipped and retain the appropriate review gate. Do not count them as passed. Full installed-Codex ensemble acceptance remains B3.

## Delivery and review

Implement B1 inline following design approval, with focused RED-to-GREEN regressions and one independent final whole-branch code review. Prepare one scoped signed commit using configured signing, push only the B1 feature branch, open its own PR against master and verify exact-signed-head hosted CI. Report complete changed files, command exits/warnings, hashes, screenshots and limitations, including any failed preliminary runs. Do not merge or begin B2 automatically.

Decisions needing user review: v2 envelope with frozen v1; dependency-first batches; explicit blocked-package preservation instead of adding persistent-draft writes; recipe-only revision parents for B1; explicit manual-output reassembly acknowledgement; no automatic scope, identity, media or preferred-take changes. Other implementation details are delegated within these boundaries.
