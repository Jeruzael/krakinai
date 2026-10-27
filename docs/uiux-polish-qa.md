# UI polish, media drop and identity clarity — QA

Base: `master` / `82c38032cd0feff8111422f1161f792c5caf59ce`. Feature branch: `codex/uiux-polish-media-identity`. No automatic merge.

The [machine-readable results](qa/uiux-polish/qa_results.json) contain command exit codes, timestamps, test cases, warning counts, protected-file verification, and every screenshot's dimensions, byte size and SHA-256. The [comparison gallery](qa/uiux-polish/README.md) contains 27 before and 30 after screenshots (4,468,737 bytes): all nine affected views at 1440×900, 768×1024 and 390×844, plus the new tag picker at all three widths. Every image contains synthetic fixtures only.

## Directly verified source facts

- [MediaDropZone](../src/components/MediaDropZone.tsx) delivers dropped or chosen files to the Editor's shared `processFiles` function. It prevents external file drops from replacing the editor page, highlights supported drag types and ignores internal reorder drags.
- [EditorScreen](../src/screens/EditorScreen.tsx) still calls `validateMediaCandidate()` and `saveMediaAsset()`. Uploads are guarded against overlap, duplicates are compared against attached media in bounded 64 KiB chunks, errors identify the file, and Save is disabled while processing. A separate drag handle changes association order; Move Up/Down remains keyboard accessible. Existing cover selection, role editing and association removal remain available.
- [StudioDialog](../src/components/StudioDialog.tsx) has an explicit wide size used by [ProjectTakeManager](../src/components/ProjectTakeManager.tsx) and [ReferencePackManager](../src/components/ReferencePackManager.tsx). Existing focus trapping, Escape and focus restoration remain in place. Dialog headers/footers stay outside the scrolling body.
- Take cards use separate thumbnail/details columns, stacked on phones. Notes fill their column; long titles, IDs and note labels wrap. Complete take details remain closed by default. Reference cards retain full accessible names and historical selection behavior while using concise visible Preview/Download actions.
- [MediaMetadataEditor](../src/components/MediaMetadataEditor.tsx) starts with Rename / Details closed. Original Filename remains read-only. Display Name, Export Filename and the attachment's Accessibility Description remain separate; renaming retains the original bytes and identity.
- [LibraryTagFilters](../src/components/LibraryTagFilters.tsx) shows eight frequently used tags initially, counts each record once regardless of case duplicates, offers searchable expansion, and keeps selected tags visible. [LibraryScreen](../src/screens/LibraryScreen.tsx) preserves OR filtering within tags, text search, review filtering and sorting. Clear Filters resets filters while retaining sort order. Stored asset tags are never rewritten by the picker.
- [IdentityAnchorPanel](../src/components/IdentityAnchorPanel.tsx) explains Master vs Anchor, record vs master identity revision, draft/approval/stale state and approval provenance. Text is user-written; saving and approval remain explicit existing storage actions. [GenerationIdentityControl](../src/components/GenerationIdentityControl.tsx) uses the existing resolver for current eligibility and frozen saved sources. A saved Master source is labelled as a saved Master snapshot, without promoting an unselected stale anchor.

The complete `src/domain`, `src/storage`, `src/types`, `useObjectUrl.ts`, `package.json` and lockfile compare unchanged against the base. The protected `validation.ts` SHA-256 is `50660f5c044585676932402583c25e8b52ece28af04a714cc909898cc1970fae`. There is no schema migration, storage-limit adjustment, assembler/output rewrite, backup change, dependency addition or cloud integration. No actual user browser profile was opened or modified.

## Automated results

| Command | Result | Exit |
|---|---|---:|
| Baseline `npm test` | 309 passed, 45 files | 0 |
| `npm test -- --reporter=default --reporter=json --outputFile.json=qa-results/uiux-polish/vitest-final.json` | 329 passed, 50 files, 0 failed/skipped | 0 |
| `npm run typecheck` | Passed | 0 |
| `npm run build` | Passed; main JS chunk 494.52 kB / 144.15 kB gzip | 0 |
| `npm audit --omit=dev --json` | 0 production vulnerabilities | 0 |
| `npx playwright test` | 16 passed, 0 failed/skipped | 0 |
| `git diff --check` | No whitespace errors | 0 |

Warnings are retained, not suppressed: the final unit run emitted 39 React `act(...)` warnings from MediaThumbnail updates in component tests. The browser runner emitted two `NO_COLOR`/`FORCE_COLOR` environment warnings. Typecheck and build emitted no warnings. These warnings are separate from the passing assertions.

Existing tests continue to cover canonical output, identity and backup compatibility. New component tests cover drop/button delivery, supported MIME types, invalid-file errors, six-attachment handling, overlapping/repeated upload protection, variant ordering/cover persistence, naming without binary mutation, tag ranking/search/multiple selection/focus, wide dialog selection, concise reference actions, and explicit identity revision/approval/stale/frozen states.

## Browser-tested behavior

Playwright uses fresh isolated Chromium contexts at `127.0.0.1:4173`; it does not attach to the user's KRAKINAI profile.

- Real synthetic JPG, PNG and WebP images decode after drop. Synthetic MP4 (2,148 bytes) and WebM (1,202 bytes) independently decode to 64×64 before upload, then load metadata successfully in the application previews. These are encoded videos, not opaque byte fixtures.
- Invalid files are rejected per file; the same PNG bytes under a renamed filename are skipped. File-input uploads use the same path. The six-file cap is preserved.
- A native HTML drag between visible reorder targets persists after Save/reload. Keyboard Move Up also persists. Existing cover, master prompt, anchor, scene and draft data remain unchanged in the ordering case.
- Tags expand/search/select, keep selected tags outside the picker, preserve stored tags and sorting, clear filters, and return focus after Escape.
- Reference selection order and downloads remain functional; historical saved reference selections are disabled. Take preference, project-only note save, comparison and association removal preserve source scenes.
- Anchor drafts require approval. Changed approval/snapshot data requires refresh. An explicitly revised master makes the anchor unavailable and falls back to Master without changing saved scenes.
- All 30 after-view checks pass document/dialog/body horizontal-containment assertions. Additional stress cases use 100-character unbroken take titles and long synthetic IDs at all three widths, verify thumbnails/details do not overlap and notes fill their column.

## Failed attempts and resolved findings

The first combined test/build/browser run had one existing dialogueCompatibility test exceed its five-second timeout (327/328 passed at that point). The isolated rerun passed all 329 tests without changing timeouts. Early browser harness issues included a selector that counted the expansion button as an unpressed tag, and a drag crossing offscreen content; the corrected tests select actual tag toggles and drag between visible cards.

The first static headless-canvas recorder produced zero MP4 bytes and header-only WebM. Independent readback identified that fixture failure before application ingestion. The encoder now explicitly supplies frames and validates playback before testing upload; all five formats pass.

Independent review identified an incorrect green “current” badge for saved Master scenes with an unselected stale anchor. A failing regression preceded the status fix; the saved source and resolver remain unchanged. Additional long-name browser tests found a note label widening the modal at 768 and 390; wrapping the label fixed all three stress cases.

## Security assumptions and remaining risks

This is a UI and correctness review plus a production dependency audit, not a comprehensive security certification. Media type/content trust remains governed by the existing validator and browser decoder; neither schema nor upload/storage policy was broadened.

- Actual dragging from Windows File Explorer was not exercised. Tests use Chromium's real DataTransfer/File APIs and Playwright file-input delivery; a native Explorer smoke test remains useful.
- Keyboard and accessible names/focus were tested; no manual NVDA/JAWS session was performed.
- Duplicate comparison is memory bounded, but worst-case latency with six maximum-size videos was not benchmarked. Processing displays a busy state.
- Optional Ctrl+V screenshot upload is deliberately not implemented in this pass.

Only product code, focused tests, this plan/report, machine summaries and intentional synthetic screenshot evidence belong in the PR. Browser profiles, test ZIPs, raw logs, import helpers, user media, credentials and temporary QA artifacts remain outside the commit. GitHub's PR checks and attached run summary provide the authoritative result for the pushed commit; local measurements above describe the verified source used for this change.
