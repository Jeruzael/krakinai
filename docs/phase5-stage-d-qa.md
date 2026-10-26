# Phase 5 D — productivity and bounded project export verification

Branch `codex/phase5-project-export`, parent Stage C `4e3ebe85a7adbd1f8599d321dd980ac7cd99a18d`. This completes the four-stage stack for review. No PR is merged and master is not pushed. Full commit identities, PR links, complete per-stage file lists, diffs and raw results are in the external delivery index described below.

## Directly inspected implementation

- `src/storage/projectBulk.ts`: transactional bulk status, stable group move, scene membership addition, explicit project-scoped scene status and association-only shot removal. Every selected ID is validated before one project write; invalid selections and write failures abort. Source scenes/media are preserved; incident edges are removed with confirmed shots. Exact saved full outputs are exported without trimming, with a 16 MiB text bound.
- `src/components/ProjectBulkActions.tsx`, `SceneBulkActions.tsx`, `src/screens/LibraryScreen.tsx`, `CollectionWorkspace.tsx`: accessible selection, visible-only selection, counts/clear, target project selection, busy guards and explicit removal confirmation. Controls expand only when selected. Selection survives filters/views within one context, resets on a different project/library context, and prunes deleted IDs.
- `src/domain/projectExport.ts`: `krakinai.project-export.v1`, ordered selected takes, exact Full/Structured/Compact files, Project JSON, optional saved/frozen Generation JSON, script/storyboard/continuity, cast/status/take/frame/transition metadata, stable document/file paths and media provenance/hash manifest. Explicit saved reference packs govern per-scene selection; absent packs use saved legacy checklists. Unselected result files are not appended. Cover, cast image and frame associations are explicit defaults; repeated roles share one binary path per media ID.
- `ProjectExportDialog.tsx`: original choices, friendly media/shot labels, per-association exclusions, planning warnings, progress, errors and cancellation. A missing selected original blocks export until each relevant association is explicitly excluded. Exclusions remain in the manifest. This ZIP is clearly a project export, with no library-restore action.
- Export limits are **128 MiB distinct selected media, 16 MiB generated text/manifest, 2000 entries**. Relevant fields receive a conservative key/scalar/string bound before JSON allocation. Actual aggregate Blob sizes are checked before any read; text bytes and final entries are checked again. Selected source data is captured consistently; unrelated scenes are not cloned. Reads run in batches of two. Compression uses sequential fflate `AsyncZipDeflate` workers, one active entry at a time; cancellation terminates the archive. There is no project `zipSync` or main-thread deflate fallback.
- Generated path components are at most 240 UTF-8 bytes, unique case-insensitively, relative and MIME compatible. Frozen raw requested names, original filenames and source identifiers remain separately in the manifest. ZIP paths never use temporary object URLs.
- Final whole-stack review found an inherited single-shot removal/reorder issue for valid restored arrays whose physical order differed from explicit `order`. `src/storage/projects.ts` now sorts before removal/no-op comparison; two red/green regressions preserve unrelated order. No prior PR history was rewritten.
- `src/App.tsx` loads the project workspace lazily. Final initial JS is 486.00 kB / gzip 141.63 kB; workspace JS is 78.65 kB / gzip 22.01 kB. This resolves Stage C's 500 kB chunk warning without changing the warning threshold.

## Automated command evidence

| Command | Final result |
| --- | --- |
| `git status --short` | Exit 0; precommit list captured, postcommit status checked separately |
| `git diff --name-status` | Exit 0; tracked paths plus complete new-file lists captured separately |
| `git diff --check` | Exit 0, no whitespace errors |
| `npm test` | Exit 0: **309 tests / 45 files passed** |
| `npm run typecheck` | Exit 0 |
| `npm run build` | Exit 0; no Vite chunk warning |
| `npm audit --omit=dev` | Exit 0, zero production vulnerabilities |

The final full test run emitted **22 MediaThumbnail React act warnings**, with no failed assertions. Earlier Stage D runs passed 297, 306 and 308 tests as focused cases were added; transient concurrent fixture type errors were repaired before final verification. Scoped review approved export/bulk/selection, the inherited order fix, and the final label-only UI correction. Its independent runs passed 49 scoped tests and 12 single-order tests. Automated results are limited to their asserted cases; no general security certification is claimed.

## Browser-tested behavior

Evidence directory: `C:/Users/HomePC/.codex/visualizations/2026/10/26/01a172e9-6e93-73f1-8220-ee98cad74baf/phase5/`.

Final `stage-d-browser-results.json`: **61/61 combined checks**, no page errors. This combines 60 complete flow/stress checks and one consolidated final friendly-label follow-up; `stage-d-ui-refresh-results.json` records that follow-up's 13 granular checks. The label-only change did not alter the export algorithm. Synthetic Late Again fixtures cover three cast, 11 ordered shots including 03A/06A, two takes/preference/notes, two independent projects, covers, wardrobe intent, frames, transitions, exact Taglish, navigation, bulk actions and separate-context full backup restore. Fixtures combine direct repository/native setup with UI actions; the detailed report distinguishes them.

The downloaded small project ZIP had **63 entries, 95,003 bytes, 11 shots and 15 associations**. Validation checked all three output modes byte for byte, saved frozen Generation JSON, exact script, ordered manifest, source provenance, original media SHA-256, binary deduplication, MIME/filename correctness, safe unique paths and absence of generated object URLs. An incomplete project blocked missing files until **four individual association exclusions**; planning warnings and exclusions survived export. Full-library backup restored both projects and all tested optional metadata in another isolated context, then the app was reloaded before UI assertions.

A separate **48 MiB synthetic random-byte** archive case produced 50,425,561 ZIP bytes in **2,112 ms**. Instrumentation counted 55 Worker constructions, 113 ticks of a 16 ms UI interval, and a 151 ms maximum observed gap. This counts constructions, not simultaneous workers. The synthetic records carried video metadata solely for byte-path stress; they are not playable videos. Cancellation during compression produced no second download and no record changes.

Nine nonempty screenshots, refreshed after final UI labels: `stage-d-{workspace,bulk,export}-{1440,768,390}.png` at 1440×900, 768×1024 and 390×844. Document widths fit, dialog focus/Escape passed, and bulk screenshots show the controls. Desktop export and mobile export/bulk captures were visually inspected. Earlier nine baseline, nine A, six B and twelve C screenshots remain available. Browser scripts/results/reports and all ZIPs live outside Git.

## Data integrity, assumptions and remaining risks

No schema migration, dependency, AI/backend service, storage-limit change or automatic media cleanup was introduced. The eight version-1 stores and full-library backup remain distinct from project export. User `validation.ts` SHA-256 is unchanged: `50660f5c044585676932402583c25e8b52ece28af04a714cc909898cc1970fae`. Phase 5 has no `promptAssembler.ts` diff against the integration base. Original checkout status and validation hash were checked; user browser profiles and port 5173 were not used. Committed files are application code, synthetic tests and documentation; no browser profiles, user records/media, credentials, ZIPs, screenshots or raw temporary QA artifacts are staged.

Peak memory can be several times the uncompressed project size: selected buffers, worker copies, compressed chunks and final concatenation coexist. The preflight string estimate is deliberately conservative and can reject a project whose eventual compressed ZIP would be small. **48 MiB responsiveness does not establish 128 MiB boundary memory/performance, multi-gigabyte backup safety, playable codecs, other browser engines, or screen-reader software behavior.** Existing same-field narrow edits use the latest explicit write; full-entry and ordering conflicts reject. These are documented limits, not claims that untested areas are safe.

External `qa_results.json`, `phase5-delivery-report.md`, per-stage `*-changed-files.txt`, `*-code.diff`, raw command logs and browser JSON provide the reproducible index. Each stage also has its committed `docs/phase5-stage-{a,b,c,d}-qa.md` report.
