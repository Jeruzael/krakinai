# KRAKINAI change-set v1

Stage B is a local file/paste importer. It does not connect to ChatGPT or an MCP server. The machine-readable [JSON Schema](change-set.schema.json) is generated from the same repository-owned schema used by runtime validation. Regenerate it with `node scripts/export-change-set-schema.mjs`; the parity test prevents drift. Schema URLs are identifiers, not network requests.

## Package and targets

```json
{
  "schema": "krakinai.change-set.v1",
  "changeSetId": "example-project-001",
  "source": {"kind": "chatgpt", "label": "User-requested production planning"},
  "operations": [
    {"operationId":"project","type":"project.create","clientRef":"new-project","name":"Example production"},
    {"operationId":"shot","type":"shot.create","clientRef":"new-shot","project":{"ref":"new-project"},"code":"01","title":"Opening","plannedShotType":"property_environment","plannedDurationSeconds":4},
    {"operationId":"prompt","type":"scene.create_direct_prompt","clientRef":"new-scene","project":{"ref":"new-project"},"shot":{"ref":"new-shot"},"title":"Opening","prompt":{"version":1,"text":"  Preserve this exact text.\r\n“Dito tayo.” 😊  "}}
  ]
}
```

New records use clientRef, never a caller-selected internal ID. References must target earlier operations of the correct kind. Existing projects use `{"id":"collection_actual","expectedRevision":3}`; existing shots/assets/scenes use exact internal IDs. Names never resolve an existing target. IDs/refs are 1–200 ASCII letters/digits/dot/underscore/colon/hyphen, starting with a letter/digit; reserved prototype identifiers are forbidden. Arrays execute in supplied order. Shot creation appends; existing shots/takes are retained.

Supported operations and required fields are detailed by the schema:

| Operation | Purpose |
| --- | --- |
| project.create / project.update | New project or explicit metadata update; name, description, optional planningNotes |
| shot.create / shot.update | Planned shot or metadata update; code/title/type/duration/continuity |
| shot.reorder | Explicit complete ordered list of every current shot ID/ref |
| scene.create_direct_prompt | Exact complete prompt, optional project+shot, stored refs, context assets, pending inputs and claims |
| scene.revise / scene.create_take | Existing sceneId + expectedHeadId + exact new prompt; optional explicit project+shot |
| scene.restore | Existing sceneId + expectedHeadId + restoreFromSceneId; no replacement prompt field |
| shot.attach_take | Explicitly attach an existing/new saved scene; no automatic preference |
| shot.select_take | Explicit scene ID/ref and expectedSelectedSceneId (ID or null); separate preference approval |
| shot.set_status | Explicit new status and expectedStatus; separate status approval |
| asset.propose | Persist a proposed character/wardrobe/environment/action/camera/lighting/style/template candidate |
| asset.review_candidate | Revisit a pending candidateId with expectedRevision using a new change-set ID |

Scene project and shot targets must be supplied together or both omitted for a standalone scene. Revision targets must belong to the explicit shot, preserve Stage A global head rules and name the current expected head. Older content is restored as a new version. Several independent operations on a project use the same original expectedRevision; the final project revision advances once for the batch. There is no implicit rebase or replacement of existing takes.

Optional `assetRefs` specify `{asset:{id}, expectedRevision, slot}` or an earlier candidate reference whose creation/reuse is explicitly approved. They snapshot the chosen reusable asset as context; they do not assemble or rewrite the complete prompt. Optional `references`/`sourceMedia` accept exact existing mediaId, role, altText and optional asserted MIME. Filenames, URLs, file paths and raw bytes are not attachment fields. Use `pendingInputs` with version 1, stable id, kind, label and optional notes when a future file is unavailable. Missing future source inputs are advisory for authored-text storage, not a generation-ready claim.

`claims` accept kind/text and `verified:false`. They become visibly unverified claim notes; imported prompts/assets remain unreviewed. The file cannot grant approval, set identity anchors, replace assets or provide executable fields. HTML-like prompt text is literal text, not executable content.

## Approval, duplicates and receipts

Preview is read-only. Approvals are entered in the UI, outside the file. Project/storyboard changes, immutable scenes, reusable asset decisions, preferred takes and production statuses are separate. A final review confirmation enables Apply after all blocking findings are resolved. Changing input/decisions invalidates the prior approval digest.

Each candidate defaults to deferred: it persists a proposal, not an installed library asset. Explicit creation produces a new unreviewed asset; Template produces an instruction-only Custom template. Possible matches use category, title, tags and prompt terms. Reuse requires a chosen exact current ID/revision. Separate creation despite matches requires duplicate acknowledgement. Existing identities/anchors are never overwritten. An operation depending on an unresolved candidate blocks the whole batch rather than silently skipping the dependency.

Apply verifies the exact approved digest and rechecks relevant state in one IndexedDB transaction. Every record and receipt commits together; quota/errors/abort leave the preceding library intact. The same ID/content/approval returns its prior receipt before stale-state checks. A different package or approval cannot reuse that ID. Reopening a previously imported package shows its original receipt. Reviewing deferred candidates uses a new package ID.

Receipts record provenance, operation results, internal IDs and before/after project revisions. They omit the original full package to avoid duplicating all text. Pending/resolved candidates retain their proposed text and originating receipt. The ledger is an optional versioned field on app_preferences and survives full backup/restore. A historical receipt remains a receipt if the user later deletes its created records; replay does not resurrect deleted records. Use a new change-set ID to request deliberate new creation.

## Limits and compatibility

Input is <=20 MiB UTF-8, <=250 operations, <=10 projects, <=250 new shots, <=100 scene operations and <=50 candidate operations; dependencies <=16 edges, JSON nesting <=32. Direct Prompt text <=100,000 UTF-16 units; candidate prompt <=12,000; asset tags <=12×30; asset/project description <=500; asset notes <=4,000; planning/continuity/claim notes <=10,000. Pending inputs <=100 per scene /500 per batch. Existing application media/archive limits remain.

Ledger <=4 MiB UTF-8, <=1,000 receipts and <=250 retained candidates. No silent eviction. Exceeding a limit aborts the entire import and reports capacity. Backups validate ledger version/shape before replacing anything. Legacy v1 backups without this optional field remain supported. An updated app is needed for new record fields; older binaries are not promised forward compatibility.

Invalid examples: changing schema to v99; supplying root `approvals`; adding `id` to project.create; using project names as targets; using a missing/forward/wrong-kind ref; omitting expectedRevision for an existing project; calling identity.replace; supplying `script`, remoteURL, localPath or blob fields; claiming verified:true. Each fails with an actionable preview error. A context document or the old `nativeKrakinaiImport:false` MIDORI manifest is not a change set and is rejected, not guessed into the new contract.

## Synthetic MIDORI sample

[midori-change-set-v1.json](examples/midori-change-set-v1.json) contains 15 shots/60 seconds, types 2 character/9 property/4 graphic, four pending originals, 15 complete prompts and two deferred proposals. Its existing Camera reference is the synthetic fixture ID `asset_synthetic_camera`, revision 1. Replace that binding using your selected actual context ID/revision before real use, or explicitly remove the binding and leave an honest pending requirement. Do not create a dummy asset to satisfy the sample. All details/claims are fictional and unverified. Browser tests seed a real reusable synthetic camera before importing; the batch does not create it.

Regenerate the sample with `node scripts/export-change-set-examples.mjs`. A legacy MIDORI adapter is not implemented.

## Additional contract safeguards

`variantRefs` bind existing variants using `{variantId, expectedRevision, slot}`. Existing character-ownership rules apply: no variant creation, reparenting or implicit character selection. Explicit asset/variant contexts preserve actual media associations even when that component does not contribute to the selected Shot Type. Context attachment never reassembles a Direct Prompt. A reusable Template is not a component slot; approved Template creation produces an instruction-only template.

Revising or creating a take requires the complete `prompt` field, even when only attachments or pending inputs change. Supply unchanged original text in that case. Restore accepts a source version and reason, without replacement prompt/context fields, and restores frozen content as a new version. A scene operation with a project/shot destination also requires storyboard approval because it adds a take. Standalone scenes require scene approval. Preferred-take and production-status changes remain separate opt-ins.

`preparedAt` records the approved preview allocation; `appliedAt` and new-record creation/update/import timestamps record actual application time. The digest freezes payload, decisions, allocated IDs and relevant state. Replay returns stored timestamps. Local digests are integrity/concurrency controls, not signatures authenticating an AI producer or protection against direct database/backup tampering.

The 20 MiB input allowance is separate from the existing 20 MiB full-backup **manifest** allowance. Preview and Apply calculate resulting metadata with the same manifest builder used by full backup, including current drafts, immutable scenes, candidates and receipts. A batch exceeding that allowance is blocked without writes even when input JSON is below 20 MiB. This reads Blob metadata, never whole media/archive bytes. All eight existing stores participate in consistent transaction reads; drafts, media and variants are read-only participants. No store, database version or application capacity is added or raised. Project Export remains 128 MiB. Large ZIP64 certification remains separate.

Existing independent reference-pack associations are retained when contexts change. The v1 package has no implicit media deletion, removal or export-filter operation; use the existing explicit reference controls when changing those associations. Recipe restoration also binds the live character master consulted by the existing anchor-validity rules. A changed/deleted master invalidates approval; a fresh preview exposes generation metadata and an advisory if identity must fall back to the master prompt. Deferred-candidate review exposes its frozen full content, decision and computed outcome before approval.
