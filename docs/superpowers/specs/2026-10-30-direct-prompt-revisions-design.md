# Phase 6 Stage A: Direct Prompt authoring and immutable revisions

Status: user-approved design (2026-10-30); implementation and verification are recorded separately in the Stage A QA report.

Date: 2026-10-30 (Asia/Taipei).

Branch: `codex/direct-prompt-revisions`.

Verified base: `eb15dc1583f59cbee195eba9d356b0d35ef290fb`, fetched `origin/master` on 2026-10-30. This includes the merged Cinematography Explorer. The prior feature checkout had a clean working tree and the same tracked tree as this base.

## Intent and scope

Make KRAKINAI the permanent home for complete prompts authored by a person, ChatGPT, Codex, or another external source, alongside the existing asset-based scene workflow. A complete prompt must be saveable without selecting component assets. It must retain its exact original text and support independent, immutable saved revisions within the existing storyboard/take model.

Implement Stage A in one focused PR against `master`. Stage B change-set imports, Stage C local MCP integration, and Stage D ChatGPT Web integration receive interface documentation only. No server, network integration, AI extraction, background synchronization, or factual verification service is implemented.

Do not change recipe assembly, camera composition semantics, identities, media bytes/names, storage limits, database schema/version, or PR #12. Do not access or modify the user's actual browser library. Do not merge automatically.

## Verified architecture and consequences

These observations come from source inspection, not new runtime tests:

| Current source | Verified behavior | Stage A consequence |
| --- | --- | --- |
| `src/types/domain.ts` | Drafts have component slots and manual overrides; saved scenes require Full/Structured/Compact strings. Existing save provenance includes request/draft IDs, `versionOfSceneId`, and `separateTakeOfSceneId`. | Add an explicit optional authoring discriminator, separate direct content, and additive revision metadata. Audit every consumer of recipe outputs. |
| `src/storage/db.ts` (`saveSceneFromDraft`) | Uses one read/write transaction over drafts/scenes/assets/media/collections; validates live source media, assembles the recipe, freezes outputs, handles duplicate retries, and optionally appends a project take. | Reuse transaction guarantees with separate authoring validation/content construction. Do not relax or invoke recipe assembly for direct content. |
| `src/storage/db.ts` and `src/domain/sceneDuplicates.ts` | `version` and `take` decisions currently require an identical-content match. Duplicate keys remove generated recipe headers. | An edited revision needs its own explicit intent. Direct text must never have a title-like prefix removed or be normalized. |
| `src/storage/db.ts` (`createDraftFromSavedScene`) | Copies snapshots but clears manual overrides. | A new version of a saved prompt must seed from the selected frozen output, including an existing manual Full override. Keep the older copy/recipe behavior available. |
| `src/screens/SceneBuilderScreen.tsx` | Saves a draft, validates current source media, runs the recipe assembler, then navigates. | Dispatch authoring modes before this path; keep all existing recipe checks. |
| `src/screens/PromptOutputScreen.tsx` | Always assembles drafts; has derived formats, manual edit buffers, exact selected-output downloads, and a specification download that adds metadata. | Show direct original text as the primary format; do not derive provider formats or use the metadata-wrapping download as the exact prompt download. |
| `src/domain/sceneDocument.ts`, `generationDocument.ts` | Describe recipe components and generation fields; can filter references by active component slots. | Direct exports must identify authored content honestly and preserve independently attached references. |
| `src/storage/projects.ts`, `src/domain/projectRoutes.ts`, `src/screens/CollectionWorkspace.tsx`, `src/components/ProjectTakeManager.tsx` | Shots support multiple scene IDs and an explicit selected scene; project routes carry collection/shot IDs. New take creation can seed from the selected take. | Use explicit collection/shot targets, distinct Version/Alternate Take actions, and existing compact take management. |
| `src/storage/db.ts` project save block | Automatically selects a newly saved scene when a shot has no preferred scene. | New revision/direct save operations must have an explicit preference choice and must not silently select a revision. Preserve legacy recipe behavior. |
| `src/domain/shotTypeRules.ts`, `scenePreflight.ts` | Source validation and required component rules are based on Shot Type; Preflight calls the recipe assembler. | Direct prompt saveability and generation readiness are separate. Recipe Preflight remains unchanged. |
| `src/domain/projectExport.ts` | Exports selected takes, writes all three text modes, and enforces 128 MiB selected-media, 16 MiB text, and 2,000-entry limits. | Omit unavailable direct formats, document them, and retain these limits and the selected-take scope. |
| `src/storage/backup.ts`, `src/domain/phase4Validation.ts` | Full backups serialize drafts/scenes and validate optional metadata before replacement. | Validate and round-trip the new fields without changing archive mechanics, limits, or restore semantics. |

Additional callers to audit include Saved Scenes search/copy/cards (`LibraryScreen.tsx`), project bulk copying (`storage/projectBulk.ts`), continuity/script summaries, reference collection/exports, review/result updates, and scene comparison UI.

## Approaches and recommendation

1. **Recommended: extend the existing scene/draft model with an explicit authoring mode and separate content path.** Preserve the recipe branch and its three outputs; direct records expose original Full text only. Extend the existing transaction, storyboard membership, and immutable scene relationships. This fits the brief's requirement to reuse the current model.
2. **Reuse manual output overrides as direct content.** Smaller initial UI change, but still depends on assembly and conflates authored source with a stale override. Rejected because the brief explicitly separates these concepts.
3. **Create a second direct-scene store/model.** Strong separation, but requires schema changes and parallel project/backup/export logic. Rejected because it increases migration and compatibility risk without a Stage A benefit.

The brief already specifies reuse of existing scene/storyboard storage. The remaining choices below are implementation recommendations, not claims of additional user approval.

## Data contract

### Authoring and output availability

Use a discriminated union for saved scenes and drafts over their shared existing fields:

```ts
type SceneAuthoringMode = 'recipe' | 'direct_prompt';

interface DirectPromptContentV1 {
  version: 1;
  text: string;
  origin?: 'manual' | 'chatgpt' | 'codex' | 'external';
  originLabel?: string;
  importedAt?: string;
}

// Recipe branch: authoringMode?: 'recipe', directPrompt?: never,
// and the current Record<OutputMode, string> saved outputs.
// Direct branch: authoringMode: 'direct_prompt', directPrompt required,
// saved outputs: { full: string; structured?: never; compact?: never }.
```

`outputs.full` is the exact frozen copy of `directPrompt.text`, validated equal at save/import. It supports existing Full text readers without fabricating Structured/Compact output. A shared output-availability helper returns either available original text or an explicit unavailable result. It must not fall back from a missing direct format to recipe assembly or an empty string presented as a valid format.

Missing `authoringMode` means recipe, with no record rewrite. Explicit unknown modes and unsupported direct metadata versions are errors. Direct content with a recipe discriminator is an error. New direct records do not use `manualOutputs` for content; retain an empty object for shared compatibility. Existing recipe manual override behavior is unchanged.

New direct prompts start with empty slots and never create assets. Converting a recipe into an explicitly requested direct revision retains its selected saved scene as provenance. Preserve its reference associations and frozen component/identity/camera snapshots as read-only source context, but do not assemble, alter, or represent that context as newly authored components. Do not copy result media into a new scene as if it were a result of the revised prompt; previous results remain available on the earlier version.

### Bounds and exact text

Recommendations: title 1–100 characters; original text nonblank and at most 100,000 UTF-16 code units (consistent with existing bounded prompt metadata); origin label at most 100 characters; notes/revision reason at most 10,000 characters; valid optional ISO timestamps; existing duration/aspect-ratio constraints. The final contract must list all bounds and reject unsupported field versions before writing. Existing archive/manifest limits continue to apply.

Use trimming only to test blankness, never to mutate original text. Do not normalize Unicode, join paragraphs, remove negative instructions, infer dialogue, parse provider JSON-looking content, or append title/settings/references to the original output. Text is a string, never executable markup.

Store one authoritative string and use it directly for clipboard and UTF-8 downloads without a BOM or newline conversion. Tests must cover leading/trailing whitespace, blank lines, LF and CRLF, quotes, combining Unicode, emoji, Filipino/Taglish, and JSON-looking text. The textarea/paste path must preserve the accepted original string; a visual DOM newline normalization must not silently replace it in storage. Reject malformed Unicode input if UTF-8 encoding would change it. Demonstrate fidelity by SHA-256 of encoded saved/copied/downloaded/exported/restored text, not screenshots alone.

### Attached references and pending requirements

Use existing `referencePack`, `sourceMediaLinks`, captured names, and saved `references` where appropriate; resolve selected stored IDs and validate current stored media within the save transaction. New direct reference selection uses existing media records, not filenames as IDs. Preserve multiple meaningful associations to a shared blob and existing names/order/roles. Update media-reachability collection for any new direct draft reference representation.

Represent missing future inputs separately as optional versioned pending requirements with a stable requirement ID, kind (`reference_image`, `source_image`, `source_video`, or `other`), user-entered label/notes, and no fabricated `mediaId`. The UI may retain an explicitly reported missing association as unresolved, but must never count it as an attached input. A new save with invalid asserted attachments fails with a repair/detach action; detaching to an unresolved requirement is explicit.

For new direct references, follow existing per-control file-count limits. Inherited recipe reference packs retain their existing valid bounds and associations; do not truncate them to a smaller picker limit.

An original source requirement for Graphic/Motion or Existing Footage does not prevent saving authored text. Readiness uses the existing `validateShotSourceMedia()` checks for supplied original source records, and reports absent required source input separately. An exact original prompt need not have duplicate text in `sceneInstructions` to be saved. A readiness adapter can pass the authored instruction to existing source validation without changing the stored text or the recipe rules. No readiness result implies the media was uploaded to an external generator.

Adding/replacing references after a saved scene exists creates a new immutable revision. Draft associations remain editable. Review notes/status and result attachments retain their existing explicitly mutable review path.

### Revisions

Keep legacy relationship fields unchanged. Add versioned revision provenance to newly saved, explicitly versioned scenes, with:

- Immediate parent saved-scene ID and root/origin saved-scene ID.
- Revision sequence within that root, allocated transactionally.
- Author/source, creation timestamp, and an optional user-entered reason.
- Optional `restoredFromSceneId` for restoring earlier content as a new revision.

Set `versionOfSceneId` to the immediate parent for compatibility with existing readers. Keep saved-scene `revision` semantics intact; do not reuse its review/update counter as the new version sequence. Alternate takes use `separateTakeOfSceneId`, not a revision parent. Historical `sourceSceneId` copies alone are not proof of a revision and must not be relabeled automatically.

Restoring Version 1 after Version 2 creates Version 3 parented to Version 2, with `restoredFromSceneId` pointing at Version 1. The new content/associations come from the explicitly selected earlier snapshot. No saved content or timestamps are overwritten.

New revisions are linear within a root: require the expected current head ID at save. If another tab saved a newer version, preserve the draft and require explicit refresh/compare/rebase or creation as an alternate take. Never silently branch or reinterpret the user's save intent. History displays unavailable historical IDs clearly if an earlier scene was explicitly deleted; it does not invent or rewrite ancestors. Reject self-parenting, cycles, mismatched roots, and unrelated project targets in newly submitted metadata.

**Legacy-family decision (implementation recommendation):** existing `versionOfSceneId` relationships may already branch. Do not adopt or renumber a whole legacy family, choose a winning branch, or stamp old records with new metadata. The first Stage A revision of a selected legacy scene starts a new managed root at that selected scene's ID; it is displayed as the original (virtual sequence 1), and the new child receives sequence 2. Later managed children use that root's checked current head. Existing explicit older version links remain navigable as legacy relationships, with original IDs/dates and no invented linear numbering. `sourceSceneId` alone still does not imply a version. New Stage A originals can carry their own root/sequence 1 from creation. This preserves every legacy branch while making subsequent stale-head checks deterministic.

## Validated production operations and atomicity

Add an explicit authoring-aware save operation using the existing IndexedDB storage layer. Share transaction/freeze/project-link helpers where useful; retain the recipe construction/validation path. Do not use full-library restore for individual scene saves.

Each command binds an explicit draft ID, expected draft input revision, authoring mode, save intent, request ID, optional parent/current-head IDs, and optional project target plus expected project revision. The transaction reads current draft/media/scene/project records and revalidates those bindings. Check project/shot membership for revisions; an explicit MIDORI target cannot revise or attach a drama scene accidentally. A source scene with multiple memberships requires an explicit target selection; no global active-draft inference.

Commit the saved scene, revision relationship, new/existing storyboard shot, collection membership, and any explicitly confirmed preference change together. Creating a new target shot as part of save must not leave an empty stray shot if saving the scene fails. New scene IDs are add-only. Abort on invalid metadata, stale bindings, missing media, quota error, or any write failure.

Duplicate request IDs are idempotent for the same bounded operation/content fingerprint; reuse with different content or targets fails. A same-operation retry returns the previous result without creating another scene, version, or shot. Content duplicates remain visible as a warning/decision: separate a deliberate unchanged revision/restore from an accidental repeated save. Direct duplicate comparison includes exact text and meaningful settings/associations; it never strips recipe headers from direct prose.

Default preference for all new direct/revision operations is **keep existing selection**, including an explicitly unselected shot. A distinct, clearly labeled user action may select a version/take, with a current project revision check. Existing legacy recipe first-save behavior is preserved. Do not auto-advance planned/production/review statuses or factual approvals; offer any status change as an explicit choice.

## UI workflow

Reuse existing design components and routes, with an authoring mode control and **Import Full Prompt** entry points in Scene Builder/Saved Scenes and the project shot workflow. A new import creates a fresh bound direct draft; changing modes must never clear the user's recipe draft. A recipe-to-direct conversion is an explicit new draft/version seeded from frozen Full text, with a disclosure of its origin.

The direct workspace contains title, original prompt editor/raw preview, source attribution, Shot Type, duration/aspect ratio, notes, and collapsible References/Source Media and readiness. Show the explicit project and shot target beside saving. Provide Save Draft, Review Prompt, and Save Immutable Scene. Do not expose recipe-only template/assembler controls as requirements.

For an existing recipe scene, **Edit as New Version** keeps recipe authoring by default and uses its unchanged assembler/Preflight/source checks; the user may explicitly choose **Edit Full Prompt** to seed a separate direct revision from frozen Full text. Both paths use the same new immutable revision intent and preserve the earlier scene. Direct-to-recipe conversion is not automatic and is outside Stage A; creating an independent recipe/alternate take remains available through the existing workflow.

Prompt Output displays **Original Prompt** by default for direct records, with persistent exact Copy and Download controls. Structured, Compact, and provider-derived recipe presets are unavailable with an explanation. Honest Scene JSON/Generation JSON exports remain possible through direct-content-specific document builders. Specification downloads, if retained, are separately labeled and must not masquerade as an exact prompt download.

Saved scenes expose **Edit as New Version**, **View Revision History**, and **Compare Versions**. History labels versions separately from alternate takes, shows full IDs/provenance and the current preferred version, and navigates to every original prompt. The existing compact ProjectTakeManager gets version labels/actions; do not replace it with an expanded wall of prompts.

Comparison shows complete read-only before/after text plus a bounded readable line diff. It explicitly lists changed reference associations, duration, aspect ratio, Shot Type, and captured character identity/snapshot metadata. If a direct prompt has no structured identity, disclose that identity changes inside prose are not automatically detected. Never claim text-based identity equivalence. For very large differences, preserve both full text views and state if the highlighted diff is limited; do not hide/truncate copy/download text.

Restoring an earlier version opens a new draft/review, then Save New Version. Preferred selection remains an explicit **Set as Preferred** action. Keep a clear Back to Storyboard link and preserve project route context.

For property claims, provide an explicit user flag/note for an unverified claim. Imported AI content starts unreviewed; no extraction or automatic fact verification. Existing scene approval is a user's review action, not evidence that every statement is factually verified. Source fidelity notices remain outside the exact prompt unless the author puts them inside it.

Responsive QA: 1440×900, 1366×768, 768×1024, 390×844, and a 200% zoom/reflow case. Check labels, keyboard order, dialog focus/trapping/restoration, action visibility, original text access, and horizontal overflow. Use a constrained text editor/viewer and compact settings rather than repeating full prompts in storyboard cards.

## Export, backup, and legacy compatibility

Direct Scene/Generation JSON documents explicitly identify `authoringMode`, versioned original text/provenance, readiness/pending inputs, references, settings, and revision relationships. They must not claim component assembly occurred. Keep the exact recipe document schemas/serializations unchanged for records without new authoring fields.

Project ZIP export continues to export selected takes under the existing scope and limits. A selected direct take supplies exact `prompt.txt` and honest JSON; omit Structured/Compact files and mark their availability in its manifest. Preserve all planned shots. A Project ZIP is not a full-library archive and must not be advertised as preserving every nonselected revision. Full-library backup preserves every scene/draft/revision; all versions remain in the application regardless of export selection.

Validate new metadata on save and backup restore, preserve exact strings/IDs/names, and round-trip attached bytes. Do not change ZIP mechanics, rollback, media limits, Project Export's 128 MiB allowance, or PR #12's ZIP64 implementation/restore gate. Unsupported future metadata fails with an actionable update/version error before replacement. Older application builds may not understand Direct Prompt records; document that restores should use a Stage A-capable version and do not promise forward compatibility with older binaries.

Freeze baseline recipe outputs, documents, duplicate behavior, snapshots, reference packs, and representative media hashes before implementation. Existing frozen-output tests must remain unchanged; add explicit before/after fixtures rather than updating expected legacy output to fit new behavior.

## Future interfaces: design only

Reusable candidates: a future versioned candidate carries candidate ID/type, source scene and optional source range, proposed exact text, provenance, and an approval/duplicate-review state. Stage A does not extract, save, or replace assets automatically. Character candidates never overwrite an approved Master Identity or Identity Anchor.

Stage B: versioned bounded change sets with stable operation IDs, explicit collection/shot/scene IDs, expected revisions, source provenance, preview/conflict results, an approval receipt bound to the exact change-set digest, and atomic/idempotent application through the same validated storage operations. Planned shots and pending media are valid; filenames are never assumed to be stored IDs. No incremental import through backup restore.

Stage C: authenticated, revocable browser/loopback pairing; explicit origin/session restrictions; minimal reads; the browser owns IndexedDB; mutations use Stage B approval and expected-target checks. No raw IndexedDB file access or unauthenticated write endpoint. Fail disconnected. Record provenance without exposing keys. Design separate MIDORI and drama target-isolation tests.

Stage D: adapt those contracts to supported ChatGPT capabilities only after checking the user's actual permissions/platform support and completing Stage C security review. The fallback is Stage B change-set files. Never claim a write succeeded without an application confirmation.

## Verification plan and delivery gates

Use disposable synthetic data in isolated browser contexts on a separate origin/port. Do not read/write/restore/clear the real user browser profile. Do not repoint or restart the user's localhost:5173 service. Retain QA profiles/files unless deletion is explicitly authorized.

1. **No components:** save a complete direct property prompt with empty Environment/Action and zero new assets; find it in Saved Scenes; attach it to an existing shot and create a new shot. Verify explicit preference behavior.
2. **Exact text:** compare encoded bytes/hashes for original string, saved draft, saved scene, clipboard, raw TXT, Project ZIP prompt, JSON-decoded text, and backup/restored text. Include all specified languages/whitespace/Unicode/newline fixtures and content beginning with recipe-like title headers.
3. **Revision history:** create Version 1/2, compare actual full texts and metadata changes, reload/restart, restore Version 1 as Version 3, keep all earlier snapshots and preferred selection unchanged. Test recipe-to-direct revision and alternate take distinction.
4. **Project isolation:** MIDORI plus fictional drama; revision/target checks must reject unrelated scene/shot IDs, stale project/head/draft revisions, and stale-tab submissions without changing any other project, reference, preference, or draft.
5. **Readiness:** save graphic/footage direct text with unresolved inputs; never claim ready. Exercise valid stored replacements, missing-after-selection IDs, invalid MIME/bytes, reference naming/order, pending associations, and immutable later attachment revisions. Existing recipe Source Media safeguards remain blocking.
6. **Integrity:** full backup/restore into a separate synthetic browser with legacy scenes, new direct scenes/revisions, incomplete shots, pending inputs, cinematography metadata, attached reference/result media. Compare scene IDs/relationships, outputs, snapshot data, media filenames and SHA-256 hashes. Verify old ZIP fixtures still import.
7. **Failure:** duplicate clicks/same request, conflicting request reuse, stale revision, quota/write abort, interrupted transaction, invalid mode/version/content, missing media, and reload with an unfinished draft. Assert no partial scene/shot/preferences writes and preservation of the previous library.
8. **Legacy:** run all existing goldens, recipe workflows, camera/reference tests, duplicate save cases, project exports, and backup tests. Do not change their expected historical outputs.
9. **UI/browser:** keyboard/focus, full raw text access, diff/history controls, responsive dimensions and 200% reflow, before/after screenshots. Keep machine-readable case results, exact command exit codes, warnings, screenshot paths/hashes, and synthetic fixture hashes.
10. **Commands:** `git status --short`, `git diff --name-status`, `git diff --check`, `npm test`, `npm run typecheck`, `npm run build`, `npm audit --omit=dev`, `npm run test:qa`, and the committed synthetic Playwright suite. Report actual totals and failures; do not carry the previous feature's test counts forward as new evidence.
11. **Review/delivery:** review final changes and staged files for user data/profiles/ZIPs/credentials/temp artifacts; use the established signed commit workflow without reading/logging a passphrase or disabling signing; push the feature branch, open/attach one PR against `master`, verify hosted CI for its actual SHA, and leave it unmerged. PR #12 remains untouched.

## Decisions left to implementation

Concrete module/helper names, accessible editor layout details, bounded diff algorithm, and test organization may be chosen to fit the current code. Any change to the contracts, limits, immutability guarantees, approval boundaries, or Stage A scope must be called out before implementing it.

No Stage A test counts, compatibility guarantees, backup results, or CI success are claimed by this design document. Those require implementation and recorded verification.

## Design review record

A fresh read-only builder review compared this design with the user brief and relevant source. Its one material planning question concerned existing branched legacy version families. The legacy-family decision above resolves it without migrating records or selecting a branch on the user's behalf. The reviewer rechecked the amendment and reported "nothing important left." No product code or application data was changed during this review.
