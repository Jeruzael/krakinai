# Phase 5 B — storyboard workspace verification

Reconciled check identities and screenshot hashes are in [the Phase 5 QA ledger](qa/phase5-summary.md). These local Chromium results were not independently run by GitHub CI.

Parent: Stage A `e072e909717e6ce53efd761afd3d2615b6edbe26`. Branch: `codex/phase5-storyboard-workspace`. No merge or master push. This report describes the tested Stage B tree; Stage C continuity and Stage D project ZIP are separate follow-ups in the stack.

## Directly inspected implementation

- `src/types/domain.ts`: optional version-1 `Collection.project` with revision and ordered ProjectShots; no new IndexedDB store or schema migration. Status, duration override, take preference and notes belong to the project.
- `src/domain/projectStoryboard.ts`: deterministic legacy order, known intended duration plus unknown count, selected take lookup, first-occurrence scene-member projection. Shots/takes are authoritative once project metadata exists; non-scene membership and retained addedAt survive.
- `src/storage/projects.ts`, `src/storage/db.ts`: latest-state readwrite operations, expected-revision reorder conflicts, atomic scene-save plus shot attachment, target-bound retries, project-aware membership and deletion. Removing the last take creates a planned placeholder; deleting a collection preserves scenes and media.
- `src/screens/CollectionWorkspace.tsx`, `src/components/ProjectTakeManager.tsx`: thumbnail grid/list, planned shots, status/filter/counts, inserts, immediate saved reordering with keyboard alternatives, take comparison/preference/notes. No quality score inference. Intended duration is separate from actual video metadata.
- `src/domain/projectRoutes.ts`, `src/domain/collectionNavigation.ts`, Builder/Output/return controls: validated shot context through New Take and return navigation, including lazy legacy shots and encoded IDs. Invalid requested targets require correction or explicit standalone continuation.
- `src/context/LibraryContext.tsx`: refresh on window focus/visible document; local shot editors send only fields changed against their opening baseline, preserving unrelated refreshed edits.
- `src/domain/phase5ProjectValidation.ts`, `src/storage/backup.ts`: validate optional projects and exact scene-member projection before transactional restore; legacy absent metadata accepted.

## Automated results

`npm test`: **244 tests / 36 files passed**, exit 0. The run emitted 14 React MediaThumbnail act warnings (seven in the new take save UI test and seven in the existing rapid-save test); no failed assertions. New regressions cover legacy order, independent membership, empty take removal, unknown duration, invalid targets, target-bound retries, cross-connection writes, synchronous QuotaExceededError rollback after project write, backups, compare controls, default tabs, changed-field patches and navigation.

`npm run typecheck`: exit 0. `npm run build`: exit 0; Vite JS 496.22 kB / gzip 142.24 kB, no chunk warning. `npm audit --omit=dev`: exit 0, zero vulnerabilities. `git diff --check`: exit 0. An earlier typecheck/build failed because two new UI tests used Playwright's unsupported `exact` option with Testing Library; removed that option and reran both successfully. Tests had already passed before this type-only correction.

Scoped review originally found cross-tab edit overwrite, empty final shots, default tab and legacy return issues. Focused red/green regressions and scoped re-review addressed all four. Browser QA found an additional dropped shot query on return; red/green navigation test and full browser rerun passed after correction.

## Browser-tested behavior and evidence

External evidence directory: `C:/Users/HomePC/.codex/visualizations/2026/10/26/01a172e9-6e93-73f1-8220-ee98cad74baf/phase5/`.

`stage-b-browser.cjs` final run: **46/46 checks**, zero page errors. Created a synthetic project/cover, 11 planned shots linked to saved scenes, codes 03A/06A, reorder, status and duration edits, two takes/compare/preference/notes/removal, New Take Builder→Assemble→Save, invalid target failure, two projects with independent order, actual separate-page IndexedDB writes, stale reorder conflict, and full-backup restore in a second isolated browser context. Original scene JSON remained identical. Setup combined UI actions with explicit repository fixture operations; this was not 11 repetitions of every setup click.

Six existing nonempty screenshots: `stage-b-workspace-{1440,768,390}.png` and `stage-b-takes-{1440,768,390}.png`, respectively 1440×900, 768×1024, 390×844. No document horizontal overflow; primary action bounds, dialog initial focus/Escape and keyboard tab arrows checked. Raw JSON: `stage-b-browser-results.json`; detailed scope: `b-browser-report.md`. Earlier before/A screenshots remain in that directory. All QA ZIPs, PNGs, browser data and logs remain outside Git.

## Assumptions and remaining risks

All browser work used synthetic records and new isolated Chromium contexts at port 4193; no user profiles or port 5173 data were touched. The existing `validation.ts` SHA-256 remains `50660f5c044585676932402583c25e8b52ece28af04a714cc909898cc1970fae`, including the user's storage limits. Immutable scene text, source identities, reference packs, media and backup rules remain separate from project metadata.

The browser pass did not exercise drag/drop itself, real result-video duration, screen-reader software, contrast analysis, or multi-gigabyte backups. Keyboard move controls and metadata-based runtime are tested separately. Passing synthetic tests is evidence for the covered behavior, not a general security or production-readiness certification. Same-field concurrent edits use latest explicit write; unrelated fields merge, while stale whole-order writes reject. Reordering saves immediately rather than staging a second unsaved sequence.
