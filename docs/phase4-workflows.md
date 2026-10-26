# Scene preflight, identity and reference workflow

Phase 4 adds local advisory checks and generation views. Original source prompts, the three canonical stored outputs and Project JSON remain authoritative historical records. There is no generation service, upload API or cloud storage.

## Preflight

Open Preflight beside Assemble Prompt or in Prompt Output. Findings include exact preserved evidence, source controls and suggested review actions. Subjective findings never prevent copying/exporting. Only existing required-input and confirmed parent-compatibility validation blocks assembly/save. Intentional checkmarks are local, evidence keyed and reset on page reload; they never change source text.

| Rule | Meaning | Severity |
| --- | --- | --- |
| P000 | Existing required scene and dialogue validation | Blocking |
| P001 | Explicit direct gaze and rear camera composition | Review |
| P002 | Explicit static/locked camera and physical camera motion | Review |
| P003 | Explicit day/morning and evening/night direction | Review |
| P004 | Photorealistic and strongly stylized/cartoon direction | Information |
| P005 | Speaker label differs from selected character title | Review |
| P006 | Confirmed variant parent mismatch | Blocking |
| P007 | Visible speech/lens interaction may be hidden by composition | Review |
| P008 | Selected reference ID unavailable in local media | Review |

Checks are conservative and incomplete. Negation, front three-quarter composition, quoted identity examples and audio-only dialogue have focused false-positive tests. Character titles with descriptive suffixes can still produce speaker-review notes. “No common conflicts detected” is not a consistency guarantee. View Source displays the preserved effective text; saved-scene editing creates a copy.

## Identity Anchor

On a character page, expand Identity Anchor. Enter your own concise text, save a draft, compare against the master and explicitly Approve Anchor. Interactive entry accepts up to 12,000 characters. Draft saves preserve previous approval metadata for comparison but do not grant approval. Copy Anchor copies exactly the editor contents.

`PromptAsset.identityRevision` increments only when the master prompt changes. Legacy records use their existing asset revision until a later save materializes the dedicated identity revision; there is no bulk rewrite. Optional `identityAnchor` records contain `text`, and after approval, `approvedText`, `approvedMasterIdentityRevision`, `approvedAt`. Exact text and matching revision establish the approval state. A later master edit preserves the anchor and marks approval stale.

Refresh the selected Character in Scene Builder after approving, then explicitly choose Approved Identity Anchor. Full Master Identity remains the default. This choice affects Generation JSON and provider export views only; Narrative/Structured/Compact and Project JSON keep the full master. A stale/unavailable approval falls back to the selected snapshot's master with a visible explanation. It never silently reads a newer library prompt into that snapshot.

Optional scene `generation` stores `identitySource`, captured anchor text/revision/date, and any fallback reason. New saves resolve against the current source transactionally and freeze the effective choice. Saved exports use that frozen choice even after library edits. Edit a Copy rechecks current approval before using it in a new export.

## Reference Pack

Open Manage Reference Pack in Builder or Output → References. The gallery groups character/outfit/environment/action/camera/lighting/style, legacy checklist associations and external results. It labels image/video, reference/sample/result, demo and missing states. Previews and original downloads are available.

A new pack starts unselected. Apply Suggested Pack proposes available non-demo identity/outfit/environment references locally; it does not save or include results automatically. Choose checkboxes, purposes and global attachment order, then Apply Reference Pack to confirm. Deselecting never deletes media or changes library associations. Selected missing associations remain visible; ZIP export fails explicitly until they are restored or deselected.

Optional `referencePack: {version: 1, entries: [...]}` belongs to the draft/scene. Absent means legacy export behavior; present with empty entries explicitly means no selected files. Each entry stores associationId, mediaId, sourceSlot/sourceId/sourceTitle, role, altText, optional filename/MIME, purpose and order. Association identity encodes origin/source/media/role/view/alt text and an occurrence discriminator for identical duplicates. It is independent of unrelated list ordering and title edits.

Generation/provider views use the confirmed pack; Project JSON and canonical checklists retain their legacy behavior. Output References exposes both selected and all linked references. Saved packs are read-only; Edit a Copy makes changes for a new scene.

Reference ZIP schema `krakinai.reference-pack.v1` contains ordered manifest entries with binaryPath. Multiple roles retain separate manifest entries and share a single original binary per media ID. Binary paths use safe unique basenames. The copied checklist matches selected order/purpose. This ZIP is a generation pack, separate from full library backup.

## Compatibility

IndexedDB stays version 1 with eight stores. New record fields are optional; no migration, bulk backfill, cleanup or reference deletion is introduced. Full backups include the optional fields and every stored original as before. Restore validates new metadata before writes, accepts legacy version-1 archives, and aborts the whole replacement transaction on synchronous enqueue or asynchronous request failure. Missing optional pack metadata can remain represented; existing canonical media integrity checks still apply.

See [generation schema and official provider sources](phase4-exports.md) and the Stage A/Stage B QA reports for evidence and limitations.
