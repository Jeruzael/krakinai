# Phase 6 Stage B — AI change-set importer

Execution refinements: explicit existing variant bindings reuse ownership checks and preserve inactive-slot reference associations; context exports omit label-bearing raw association IDs. Application timestamps are generated at commit, distinct from preview preparation. A scene destination requires both scene and storyboard approval. Shared backup-manifest construction preflights the retained 20 MiB metadata capacity, including current drafts, and rechecks it inside the existing eight-store transaction. These refinements preserve configured storage/archive limits and do not introduce schema migration.

Implementation decisions for the supplied Stage B brief, before persistence coding. The user requested documentation followed by complete implementation; these are engineering choices within that authorization, not a claim that the user separately approved this document.

## Base and scope

Stage A PR #26 merged before this work started: merge `bc57bd56495e004d13dc034e0fdc4d0fc46a494c` contains verified `4ca995ba35546686c16fb8d469f676e0bfc80c1a`, with no tree differences. Stage B branch starts at the verified Stage A commit and is reconciled onto that merge. Target master while preserving PR #12. Existing isolated worktree is reused; live localhost:5173, user profiles/data, separate validation changes, capacities, recipe assembler and camera semantics stay untouched.

Build file/paste JSON import, read-only AI context export, grouped preview, explicit approval, one transactional apply, durable receipts/candidates, examples and documentation. No network, listeners, MCP/ChatGPT connectivity, raw media import, replacement of identities or legacy MIDORI adapter.

## Approaches and source constraints

One coordinated write transaction is required. Calling public per-scene/per-project saves sequentially cannot provide batch rollback. Extract synchronous Stage A revision-draft and saved-scene planning helpers; existing public saves retain their transaction ownership and use the same helpers. The batch computes a complete working plan and enqueues add/put operations in one transaction.

A new receipt object store would require a version upgrade and all backup consumers to change. Separate records in preferences are unsafe: getAllSnapshot currently reads prefsList[0], and full backup serializes only one preferences object. Choose an optional bounded `preferences.aiImports` field on the existing `app_preferences` record. Existing writes spread that record; full backup already carries it. Select app_preferences explicitly rather than relying on order, and validate the new field on restore. No schema/store upgrade. This design rejects ledger exhaustion, never silently drops old receipts or candidates.

Keep project planning notes as an optional Collection.planningNotes string; existing collection updates spread records and retain it. Validate it at import/backup boundaries and expose it in project details/context only when requested.

## Canonical contract

`schema: krakinai.change-set.v1`, bounded changeSetId, source {kind: manual|chatgpt|codex|external, label?}, title?, description?, ordered operations with unique operationId and optional unique clientRef. Strict object properties; unknown operations/fields, executable fields, dangerous object keys, malformed Unicode and nonfinite numbers are rejected. Prompt text is literal data, including HTML-like prose; it is never evaluated or rendered as HTML.

Targets are explicit `{id, expectedRevision}` for existing projects or `{ref}` for a new project; shots and scene/asset links use exact `{id}` or an earlier typed `{ref}`. New IDs are allocated internally; external IDs never select a record to overwrite. Duplicate references, forward dependencies, cycles, wrong reference kinds and dependency depth >16 fail. Operations execute in supplied order; new shots append. Reorder is an explicit operation containing the complete ordered shot mapping.

Supported operations:

- project.create (name/description/planningNotes); project.update (exact project target, metadata only).
- shot.create (code/title/Shot Type/duration/continuity); shot.update (metadata only); shot.reorder (all shot IDs/refs).
- scene.create_direct_prompt; scene.revise; scene.create_take; scene.restore. Scene creation has exact prompt text, optional settings/Shot Type, explicit existing asset/media associations, pending inputs and unverified claims. Revision/take/restore requires explicit source scene ID and expectedHeadId. Restore names the old version and accepts no replacement prompt text.
- shot.attach_take, shot.select_take and shot.set_status are explicit operations. Selection/status include the expected prior selection/status and require their own approval groups.
- asset.propose persists a candidate; asset.review_candidate revisits an existing pending candidate. The approval decision for each candidate is defer/create/reuse. Creation requires a separate explicit grant, yields a new unreviewed record, and never updates an existing asset. Reuse requires exact ID and expected revision. Template candidates create instruction-only Custom templates; other candidates use existing asset categories.

Scene asset associations snapshot explicitly chosen assets into optional component context using the existing snapshot function, without changing the complete prompt or requiring components. Existing media ID/MIME/blob metadata must validate through Stage A. URLs, local paths and filenames never count as media IDs. Pending descriptions carry no fake media ID. New scenes remain unreviewed; shots remain planned unless an explicit approved status operation says otherwise. Imported claims are `verified:false` and remain clearly unverified in claim notes.

Candidate duplicate review uses category, normalized titles/tags/prompt content and current IDs. It reports possible matches without asserting equivalent identity. Creating despite a possible match requires an explicit duplicate acknowledgement; reuse never guesses. Deferred candidate references cannot masquerade as created assets: dependent operations block the entire batch.

## Bounds

- Input: 20 MiB UTF-8, 250 operations, 10 created projects, 250 created shots, 100 scene operations, 50 candidate operations, 16 dependency edges, 32 JSON nesting levels.
- IDs/client refs/operation IDs: 1–200 code units. Text: Stage A prompt <=100,000 UTF-16 units; title <=100; shot title <=240/code <=40; planning/continuity/claim notes <=10,000; asset/project description <=500; asset notes <=4,000; candidate prompt <=12,000; tags <=12 × 30; pending <=100 per scene and 500 per batch. Settings and Shot Types use existing validators.
- Durable ledger: version 1, <=1,000 receipts, <=250 pending/retained candidates, <=4 MiB UTF-8 total. No eviction. Creation fails atomically at the limit with a clear capacity message. Receipts contain digests/mappings/results/approvals rather than entire original packages; pending candidates retain their proposed text.
- AI context: <=5 MiB UTF-8, <=10 selected projects/250 shots/250 scene metadata records/500 selected assets. Fail rather than truncate. Complete prompt text is opt-in for specifically selected scenes.

## Preview, approval and transaction

Pure parse/validate/plan functions consume a snapshot. The preview performs no database writes, allocates IDs, evaluates duplicate and readiness findings, and presents every operation compactly. Full before/proposed text is available for revisions. Blocking findings disable Apply; advisory missing future sources do not prevent saving authored text. Cancel before Apply changes nothing.

Separate approval groups cover storyboard/project changes, saved scenes, asset creation/reuse decisions, preferred selections and statuses. A final review confirmation is required. Required groups cannot be silently omitted. Candidate deferral persists a proposal; it is not selective operation skipping. Changing content or approvals invalidates the previous preview and digest.

Canonical SHA-256 binds exact parsed strings, ordered operations, user approval decisions, allocated IDs, preparation timestamp and relevant preview state. JSON key order is canonicalized without trimming string values. The imported file cannot contain approval grants. A receipt also stores the source-content digest so replay can identify the original package after reload.

Apply verifies the supplied approval digest outside the transaction, then opens a readwrite transaction over the existing relevant stores. Queue/read state, check an existing receipt first, recompute the synchronous plan and relevant state signature, recheck expected project revisions/current heads/asset revisions/media metadata/candidate matches, and enqueue all records plus the updated preference ledger. No crypto, timers, file reads or network awaits inside the transaction; only IndexedDB requests and synchronous planning. Any exception/abort/quota error rolls back all changes, including receipts.

The expected project revision is checked against the original transaction snapshot once per existing project; all operation targets must agree. Working project mutations are applied in order and final revision advances once per affected project. Stage A helper calls receive the current in-batch working project revision; this does not refresh an externally reviewed revision. Multiple scene revisions in a family must name the correct current head; no implicit rebase.

Same change-set ID and approved digest returns its prior receipt before stale-state checks. Reusing an ID with different package content or approval decisions fails. A read-only replay preview can show the prior receipt and original approvals without new writes. Reviewing deferred candidates uses a new change-set ID. Receipt mappings and candidate state survive app restart and full backup/restore.

Stored media bytes are immutable under supported app APIs; current MIME/type/size/link metadata is checked inside apply using existing validation. Arbitrary external database mutation is outside the supported write API. No stronger byte-integrity claim is made by metadata checks; original file hashes are separately exercised in regression/backup tests.

## Context export and UI

Routes: dedicated import workspace and context export workspace, linked from Collections/library and each project. Import accepts a bounded JSON file or paste; grouped summary sections and per-operation disclosures show actual counts/runtime, target IDs, possible matches, exact changes and conflicts. Explicit approval checkboxes never come from imported content. Completed receipt links created projects/scenes and displays durable ID mappings. A compact pending-candidate section supports explicit later review using the same preview/apply pipeline.

Context export whitelists selected metadata: project/shot IDs/revisions/order/type/duration/current preferred IDs, scene head/root references and selected asset IDs/names/categories/tags. No preferences, unrelated projects, blobs, credentials or filesystem access. Notes/pending labels, selected full scene prompts, selected asset prompt text, selected character identity/anchor details and media filenames each require explicit controls; character text never piggybacks on the generic asset-text toggle. Context JSON is a separate schema, not an importable change set. Copy/download are read-only.

Use existing components, palette, Dialog focus behavior and mobile navigation. Desktop summaries are bounded/scrollable; mobile uses normal page scrolling. Test all requested viewport sizes, keyboard and 200% reflow equivalent; inspect before/after PNGs. Keep captured PNGs intentional, raw evidence/profiles/ZIPs ignored and retained.

## Verification and delivery

RED→GREEN tests cover canonical validation and all A–L scenarios, approval tampering, duplicate acknowledgement, replay after restart/restore, graph/type ambiguity, newly missing/stale media, rollback after late failure, recipe/Full/camera/reference hashes and context privacy. Synthetic MIDORI fixture: 15 ordered shots, exactly 60 seconds, 2 character / 9 property / 4 graphic, 4 pending originals, explicit reusable references/proposals, no invented media or dummy component assets.

Run full unit/browser suites, typecheck/build/production audit/historical QA reconciliation, current new counts and 22 frozen Stage A baseline hashes. One fresh whole-branch review after implementation; correct material findings and rerun checks. Keep signing enabled, verify/push feature commit, create/attach PR and verify exact-head hosted CI. Check Stage A merge status again before publishing and target the verified master as appropriate. Never merge or alter PR #12.
