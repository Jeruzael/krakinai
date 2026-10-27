# Performance Studio QA

PR B adds optional scene-specific acting direction on `codex/advanced-performance-studio`, independently based on master `ae510d3b90f731c115eaf6f1daf261ebaec88981` (PR #20 merged). This report verifies a local source snapshot using the recorded source hashes. The signed commit, PR and GitHub CI run for that commit are linked in the final handoff. No PR A source is included and signing configuration is unchanged.

## Representation and compatibility

The optional `dialogue.performanceDirection` field accepts the unchanged version 1 shape or a new version 2 shape. [The implementation plan](superpowers/plans/2026-10-28-performance-studio.md) records the representation before code was changed. Version 2 separates emotions, techniques, voice, speech and gestures. Delivery notes remain their original editable string. There is no IndexedDB schema migration, inference from prose, default acting choice, character Voice Profile, cloning or synthesis service.

Version 1 uses its original validation and formatter. Opening, previewing, saving and copying a legacy record does not translate or reorder its selections. Legacy controls can remove individual choices while retaining the original order of the remaining IDs. The explicit **Replace legacy directions with Performance Studio** button discards the old structured selections and preserves custom notes; it performs no preset mapping. Empty legacy metadata stays version 1 until replacement or Clear is explicitly selected.

Version 2 emotion fields are independently optional. Removing primary emotion retains an explicitly selected secondary emotion in its original field; the formatter emits the remaining emotion alone. It does not discard or promote that selection, invent a primary emotion, or create a mixed emotion unless both fields are selected. Domain and component assertions pin this removal behavior.

All outputs use `getEffectiveDialogueDelivery`: Scene Builder preview, narrative, structured, compact, Project JSON, Generation JSON, Generic export, Gemini Omni export and Project Script. Preflight reports exact invalid structured metadata. Backup and draft writes validate the same optional metadata through existing validation entry points; no backup format or ZIP64 implementation changed.

## Actual verification

The machine-readable [results](qa/performance-studio/qa_results.json) contain the final run counts, durations, warnings, command log hashes, source hashes, changed files and screenshot hashes.

| Check | Result |
| --- | --- |
| Unit/component suite | 391 passed, 58 files |
| TypeScript typecheck | Passed |
| Production build | Passed |
| Production dependency audit | Zero vulnerabilities |
| QA reconciliation | 3 tests passed; historical ledger: 207 checks, 45 screenshots |
| Complete Playwright suite | 45 passed, zero skipped, failed or flaky |
| Before capture | 3 passed on unchanged master product source |
| Fresh read-only review | Approved; no blocking product defects; 31 focused tests passed |
| Whitespace validation | `git diff --check` clean |

TDD observed four failing new-model domain tests and three failing controls tests before the respective production changes. Green tests retain every original version 1 golden assertion. Existing delivery browser tests explicitly seed version 1; the existing dialogue integration test opens the new Custom Instructions group before editing notes. Assertions were retained.

Browser runs use the local private origin `http://127.0.0.1:4273` with a fresh synthetic Playwright context per test. No actual browser profile, personal media or existing user database was opened. Raw logs, ZIP data, browser reports and temporary configuration remain in ignored `qa-results/`, `test-results/` or the ignored `playwright.performance.local.mjs`.

## Preservation evidence

- Unit tests compare exact Filipino, English and Taglish dialogue with whitespace, quotes, line breaks, punctuation and emoji through save, copy and backup/restore.
- Version 1 tests retain deterministic legacy output strings and exact custom notes; legacy golden scenes without metadata retain their original output bytes.
- Version 2 tests compare structured metadata across draft save, saved scene, Edit a Copy and backup/restore. Editing the copy leaves the saved scene and its output strings unchanged.
- Invalid nested enums/fields, duplicate values and incompatible whispered/murmured plus shouted/screamed combinations fail before writes and restore. The complete existing library is compared after each rejected restore.
- Browser tests compare all existing scenes, assets, variants and media hashes before and after the new acting workflow; new saved scene creation is permitted, existing scenes are unchanged. The browser backup roundtrip compares scenes and drafts exactly and confirms immutable copy behavior.
- All seven output presentations contain the single generated instruction block once. Project JSON retains structured authoring metadata. Exact spoken dialogue stays in its dedicated field. Project Script includes the same effective instructions.
- `src/domain/validation.ts` remains SHA256 `50660f5c044585676932402583c25e8b52ece28af04a714cc909898cc1970fae`. Schema versions, provider integrations and ZIP64 source are unchanged.

## Responsive and accessibility evidence

[The screenshot gallery](qa/performance-studio/gallery.md) includes true before/after images at **1440×900, 768×1024 and 390×844**, plus expanded mixed emotions, voice characteristics, technique conflict explanations and a long Unicode preview. The before images were captured before product source edits on the base commit, using the same synthetic scene fixture. Desktop uses the existing two-column editor; tablet/mobile retain the app's existing navigation and stack controls within the available editor width. Native selects, textareas and checkboxes retain keyboard operation. Group buttons expose expanded state and named regions. Only the actively edited group is expanded; removable selections and compact summaries remain visible while groups are closed.

The tests assert no horizontal document overflow at each capture width. Keyboard Enter/Space open groups, search narrows catalog controls, conflicting vocal extremes are disabled with readable explanations, fields can be individually removed, and Clear All preserves speaker and exact dialogue. Reduced-motion coverage exercises the new direction controls and the full existing suite. Effective 200% reflow is checked at **720×450 CSS pixels**, equivalent to the layout viewport of a 1440×900 window at 200%; it is viewport emulation, not a browser chrome zoom action. The capture waits for the existing sidebar transition to complete.

## Warnings and limits

- The build reports its existing chunk-size warning; the main JavaScript chunk is now approximately 525 kB minified. No new runtime dependency was added.
- Unit logs include existing React `act(...)` warnings from asynchronous media thumbnails. Playwright emits the existing `NO_COLOR`/`FORCE_COLOR` environment warning. Counts and raw-log hashes are in the results JSON.
- A repeat full unit run during concurrent build/browser activity timed out in the existing five-second `dialogueCompatibility` UI test (390 passed, one timeout). The isolated compatibility rerun passed all three tests without changing assertions or time limits. This intermediate run remains recorded with its log hash; it is not counted as a passing run.
- Initial `npm ci` reported six development-tree audit findings. The required production-only audit reports zero vulnerabilities; no unrelated dependency upgrade was applied.
- Instructions are descriptive prompt guidance, not guarantees of pitch processing, voice reproduction, accent, synchronization or performance. Custom technique guidance can describe sequential changes; there is no structured sequence/timeline editor.
- Hosted GitHub CI and the signed commit/PR are linked in the final handoff. This report records local verification against the listed source hashes.
