# Phase 5 A — Workflow reliability verification

Base: `50492d719134c49137feb56d36dc5a775ff219c2`, integration PR #6, which combines reviewed Phase 4 with current master. Stage A branch: `codex/phase5-workflow-reliability`. No PR is merged automatically.

## Implemented behavior and source

- `src/domain/sceneDuplicates.ts` and `src/storage/db.ts`: deterministic meaningful-scene comparison, transactional duplicate check/insert, explicit version/take lineage and operation-scoped request idempotency. Titles/display names alone do not identify a scene. `PromptOutputScreen.tsx` offers Open Existing / New Version / Separate Take / Cancel, prevents rapid concurrent requests and preserves unfinished per-mode buffers when returning from Open Existing. A return to a draft starts a new save attempt; retries of an in-flight operation remain idempotent.
- `src/domain/mediaNaming.ts`, `src/storage/mediaMetadata.ts`, `MediaMetadataEditor.tsx`: separate read-only original filename, editable display name, optional validated export filename and accessible description. Existing IDs/bytes/provenance remain unchanged. Names are frozen on newly saved associations/results/packs; legacy saved associations do not fall back to later live optional names. Backup serializes/restores optional names in both directions. Existing optional missing-pack metadata remains restorable; canonical missing-reference rules stay strict.
- `CollectionCoverPicker.tsx` / `CollectionsScreen.tsx`: image reuse/upload, explicit cover removal, computed nonpersistent fallback, scene/runtime/unknown-duration metadata. Editor and picker mount one dialog at a time and retain unsaved edit fields.
- `collectionNavigation.ts` / `CollectionReturnControl.tsx`: encoded, validated collection origin and view state, direct/deleted-origin fallback, session navigation scroll map. `CollectionMembershipBadge.tsx` and the membership modal show actual memberships and keep creation behind + New Collection. No scene copies are created for membership changes.

## Automated evidence

Baseline: 162 tests / 23 files, typecheck and build passed on combined Phase 4 + master. Integration PR #6 GitHub CI also passed (run 40329246690).

Stage A: `npm test` **194 tests / 30 files passed**, exit 0. `npm run typecheck`, `npm run build`, `npm audit --omit=dev`, `git diff --check`: exit 0. Production audit: 0 vulnerabilities. Build approximately 453 kB JS / 131 kB gzip. Seven existing asynchronous MediaThumbnail React act warning entries occurred in the final full test run; typecheck/build had no warnings.

Focused tests cover same/different scene inputs, explicit version/take, duplicate races/idempotency/token mismatch, rapid first and modal save clicks, unfinished buffer restoration, metadata/ZIP roundtrip, long/Unicode export names and safe extensions, legacy naming, missing optional pack compatibility, cover APIs/persistence, navigation validation and membership controls. Reports record where tests were added after initial UI work; no unsupported test-first claim for those portions.

The initial full gate found five media-retention fixtures intentionally saving the same scene twice, two lost accessible association-description labels, and an older membership journey using the formerly expanded create form. The fixtures now explicitly request a separate take without weakening their retention assertions; association alt descriptions remain accessible alongside names; the journey expands New Collection and waits for pending membership completion. Browser QA then found the completed-save token being reused after route return; a regression reproduced it and the new-attempt reset fixes it. Filename review reproduced extension loss on long overrides and Unicode sanitization; validated explicit names now remain intact.

## Browser evidence

**36 complete Stage A Chromium assertions + 5 real two-tab assertions passed**, using disposable contexts and synthetic Aya/Marco/Lucas Late Again records. They verify rapid save counts, explicit lineage, Cancel/Open Existing buffer preservation, cover selection/refresh without binary copies, two independent memberships, deep-link Back to Collection and correct second origin, naming vs alt/original provenance, frozen legacy download filename/hash, duplicate detection after media rename, exact original saved-scene preservation and full-backup restore in a separate context.

Actual independent-tab database connections verify that two concurrent implicit saves produce one record and one SimilarSceneError; same-token retries return one scene ID; changed dialogue with a reused token is rejected. This is in addition to fake-indexeddb Promise.all coverage.

Nine before screenshots were captured from the built integration baseline, and nine Stage A screenshots at 1440x900, 768x1024 and 390x844. Browser assertions check horizontal overflow; screenshots were visually inspected. Original media SHA-256s, identities, alt descriptions and original immutable scenes are compared. No uncaught browser errors in the completed journey. Scripts wait for asynchronous membership/navigation updates before asserting; initial harness failures are not represented as product passes.

Full raw logs, scripts/results, before/after PNGs, synthetic ZIPs and per-task review reports live outside Git under the task's `phase5` visualization directory. Only source/tests/docs are committed. Scoped independent source review approved after the filename fix.

## Preservation / security assumptions / limitations

IndexedDB remains v1/eight stores and backup schema 1. The user's existing storage-limit file remains byte-identical (SHA-256 `50660f5c044585676932402583c25e8b52ece28af04a714cc909898cc1970fae`), with no changes to its constants. Original checkout and real browser data were not used or modified. There is no cleanup, identity rewriting, new backend, service call or application dependency.

Duplicate detection is deterministic/conservative, not semantic similarity; changed provenance/revisions may intentionally yield a different candidate. Incomplete output-buffer recovery and collection scroll are session-memory features, not browser-restart persistence. Media metadata does not rename a file on the user's disk. Full backup still uses its existing synchronous implementation and user-selected larger storage bounds; this stage makes no large-archive safety claim. Bounded asynchronous project export is Stage D. Production dependency audit is not a comprehensive application-security audit. Other browser engines, physical devices, speech screen-reader output and external generation are untested. Storyboard/continuity/export features follow in separate PRs.
