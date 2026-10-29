# Direct Prompt authoring and scene revisions

Phase 6 Stage A extends existing drafts, saved scenes and storyboards. It does not connect to an AI service. All writes remain browser-owned IndexedDB operations. Database version, object stores, archive mechanics and capacity settings are unchanged.

## Authoring modes

Missing `authoringMode`, or explicit `recipe`, keeps Build from Assets. The existing assembler, component requirements, source validation, three frozen outputs, camera composition and identity behavior remain in that path.

`authoringMode: "direct_prompt"` requires a separate `directPrompt` value:

```ts
interface DirectPromptContent {
  version: 1;
  text: string;
  origin?: 'manual' | 'chatgpt' | 'codex' | 'external';
  originLabel?: string;
  importedAt?: string;
}
```

The text is the authored final instruction. It is not a component override or a manual assembler output. Saving it never requires Environment, Action, Character, or any other component. A saved direct scene has `outputs: { full: directPrompt.text }`, equal to the original string. Structured, Compact and provider-derived recipe presets are unavailable, not empty substitute prompts. Existing Full-text consumers still receive the original prompt.

Title is required for final save and is 1–100 UTF-16 code units. Direct text is nonblank and at most 100,000 UTF-16 code units. An unfinished draft may have an empty title/text. Malformed Unicode is rejected so UTF-8 encoding cannot silently replace a lone surrogate. Text is not trimmed, normalized, parsed as JSON, rendered as executable HTML, summarized, or augmented with settings/reference notices.

Source label is at most 100 characters; valid source timestamps are bounded to 100 characters. Notes, claim flags, and revision reasons are at most 10,000 characters. Scene settings retain optional 16:9, 9:16 or 1:1 and integer duration 1–60 seconds. Unsupported authoring/metadata versions fail with an update/version error.

## Exact text and presentation

The editor keeps the accepted original string in state/storage. Paste uses the original plain-text clipboard payload. Ordinary textarea edits map the browser's normalized offsets back to that string, retaining untouched CRLF/CR bytes. JSON-looking content, Filipino/Taglish dialogue, empty lines, tabs, leading/trailing whitespace, combining Unicode and emoji remain literal text.

Copy passes the whole original to the Clipboard API. Download Original Prompt encodes that original as UTF-8, without BOM, appended newline, title, settings, or a reference checklist. Native clipboard applications can have their own newline/encoding conventions; the QA report distinguishes copied payload verification and actual browser clipboard readback. TXT is the portable exact-byte interchange file.

Scene/Generation JSON use `krakinai.direct-scene-prompt.v1` and `krakinai.direct-generation-prompt.v1`. They identify direct authoring and retain original content, source attribution, settings, references, pending requirements and revision provenance. Any inherited component snapshots are explicitly named source context; they are not claimed as newly assembled components. Readiness in these static documents is `not_evaluated`, because a file cannot prove the browser's current media availability or external uploads.

## References, readiness and review

`directReferences` contains stored media associations, with their original roles, order, captured names and MIME metadata. Existing `sourceMediaLinks` and `referencePack` retain their meaning. References can be selected from stored files without duplicating blobs. The picker follows the existing per-control limit; inherited recipe packs are not truncated.

New direct/reference-source selections receive export-pack associations during the same immutable save. Unchanged inherited pack exclusions remain excluded; adding a file does not silently re-export every old component reference. Repeated explicit associations to one stored blob keep distinct pack entries while exports deduplicate the actual file bytes.

Future inputs are separate:

```ts
interface PendingSceneInput {
  version: 1;
  id: string;
  kind: 'reference_image' | 'source_image' | 'source_video' | 'other';
  label: string;
  notes?: string;
}
```

At most 100 pending inputs, unique IDs (at most 1,000 characters), labels 1–240 characters, and optional notes at most 10,000 characters. A pending item must not claim a `mediaId`. Filenames are descriptions, not proof of stored files.

Source-based text remains saveable before its original image/video is ready. Generation readiness uses the existing `validateShotSourceMedia()` checks with the authored text as the instruction input. Missing future inputs remain unresolved. An asserted attachment is checked against current stored media in the save transaction: a missing record, unsupported MIME, inconsistent bytes or mismatched stored MIME blocks that save with a repair/detach action. Detachment is explicit; the app never silently removes an association or invents a replacement.

Changing a saved scene's prompt, settings or references creates a new saved revision. Existing review notes/status and result-media updates keep their separate review path. New revision drafts do not present the previous version's external results as results of the new prompt. Earlier results remain on the earlier scene. Claim notes are user-entered flags; no AI claim is automatically marked verified, no identity description is inferred from an image, and no reusable asset is silently created or replaced.

## Revisions and takes

Each saved version has a new scene ID. New managed histories use `sceneRevision` version 1: root scene ID, optional immediate parent, sequence, creation timestamp, optional source/label/reason, and optional `restoredFromSceneId`. `versionOfSceneId` is the immediate version parent. A separate take uses `separateTakeOfSceneId` and starts its own root. The existing saved-scene `revision` field keeps its old meaning; it is not the sequence shown as Version 1/2/3.

Restoring Version 1 after Version 2 copies the explicitly selected earlier content into a new draft. Saving produces Version 3, parented to Version 2, with `restoredFromSceneId` identifying Version 1. Old scene text, IDs, dates and associations are not rewritten.

Historical `sourceSceneId` copies alone are not automatically classified as versions. Existing legacy `versionOfSceneId` branches remain untouched. The first managed child of a selected legacy scene uses that scene's ID as its root, displays the original as sequence 1 without modifying it, and saves sequence 2 on the new child. Legacy branches remain navigable as legacy relationships.

Managed history checks current head and sequential parent/root relationships. Corrupted managed graphs and duplicate sequences are rejected on restore. References to an explicitly deleted earlier scene can remain visible as unavailable history; the app does not invent that scene.

A shared scene's revision family is global and linear, while storyboard attachments and preferences remain project-specific. Revision intent captures the explicitly opened context scene separately from the current parent/head and any restored-content source. A shared-scene revision targets only the explicitly selected project shot; another project's membership/preference is unchanged. Explicit route targets take precedence over historical save provenance, and invalid route targets fail rather than falling back to an unrelated project.

Comparison presents both complete original texts and a line diff. Highlighting is bounded to 250,000 line-pair cells / 3,000 total lines; above that limit both full originals remain available and the highlighting limitation is disclosed. Captured references, source inputs, aspect ratio, duration, Shot Type and identity snapshot changes are listed explicitly. Identity changes solely inside unstructured prose are not inferred or certified unchanged.

## Storage operation contract

The application owns these operations in `src/storage/sceneAuthoring.ts`:

- `createDirectPromptDraft(target?)`: a fresh draft; never clears a prior recipe or direct draft.
- `createSceneRevisionDraft(sceneId, options)`: explicit version/alternate-take/restore intent, optionally bound to a project shot. Recipe revisions stay recipe unless Edit Full Prompt is explicitly requested; Full conversion starts from the saved frozen Full output, including manual overrides.
- `saveAuthoredScene(draftId, options)`: requires bounded request ID and expected draft input revision. Optional project target requires collection ID, expected project revision, and exactly one existing shot ID or new-shot description. Optional explicit preference/duplicate decisions are distinct options.

The save transaction reads current draft, scenes, collections, assets and media. It checks metadata, expected draft/project/head revisions, project/shot membership, current attachments, and recipe rules when applicable. New scene creation, version provenance, shot creation/attachment and any explicitly selected preference are atomic. Request IDs are bound to an exact canonical operation fingerprint. Repeated same-operation requests return the previous scene; conflicting reuse fails. Quota/write/abort errors leave earlier records intact.

The existing `saveSceneFromDraft` adapter requires caller-supplied `expectedInputRevision` for new direct/managed-version records and retains the reviewed project revision on retries. It does not substitute a fresh database revision to make a stale review pass. Legacy recipe callers without authoring/version metadata retain the old API behavior.

Direct/version saves keep a shot's current preference, including no preference, and preserve production status. Preferred selection is an explicit user action with an expected project revision. Explicit project and scene IDs are never replaced by the globally active draft. Changing modes opens a fresh draft, and asset Use in Scene actions use the asset-based workflow rather than silently adding components to a Direct Prompt.

## Export and backup

Full backups retain every draft, immutable scene, version relationship, pending requirement, collection/shot and original media blob/name. New metadata is validated before replacement. Legacy backups without new fields continue through existing validation. Use a Stage A-capable app to restore backups containing direct prompts; older binaries are not promised forward compatibility.

Project ZIP export keeps its selected-take scope: exact `prompt.txt` and honest JSON for direct selected takes, no fabricated Structured/Compact files. The manifest marks unavailable formats and records managed version metadata. Planned shots remain present without fake scenes. Nonselected history remains in KRAKINAI and full-library backup; a Project ZIP is not a complete history/backup archive. Existing 128 MiB selected-media, 16 MiB generated-text and 2,000-entry limits remain.

## Future Stage B–D boundaries (not implemented)

Stage B will define versioned, bounded change sets with explicit operation IDs and target IDs, expected revisions, preview/conflict reports, approval receipts bound to a change-set digest, and atomic/idempotent application through the same browser storage operations. Planning-only shots and pending media are supported concepts; backup replacement is not an incremental import mechanism.

The candidate contract in `src/types/sceneAuthoring.ts` retains source scene ID, exact proposed text, candidate category, provenance and pending approval. No extraction/asset-saving UI or service is implemented. Equivalence review and explicit approval must precede asset creation; approved character identities cannot be replaced implicitly.

Stage C will require loopback-only authenticated/revocable pairing, origin restrictions, minimal authorized reads, browser-owned writes, explicit IDs/revision checks, operation provenance, and fail-disconnected behavior. An MCP server must not manipulate IndexedDB files. No bridge/listener is introduced in Stage A.

Stage D depends on Stage C security review and the account's actual supported ChatGPT integration capabilities. Successful mutations require application confirmation; approved Stage B files are the fallback. Stage A makes no claim of an active AI connection.
