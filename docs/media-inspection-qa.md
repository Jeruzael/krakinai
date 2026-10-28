# Media inspection and Storyboard List — QA

PR A independently targets master from `ae510d3b90f731c115eaf6f1daf261ebaec88981`, branch `codex/media-preview-storyboard-list`. This is a local verification snapshot of the source hashes in [qa_results.json](qa/media-inspection/qa_results.json). Signed commit, PR and exact-head GitHub CI links are supplied in the final handoff. [Before/after screenshots](qa/media-inspection/README.md) cover 1440×900, 768×1024 and 390×844.

## Direct source verification

- [SharedModals](../src/components/SharedModals.tsx): asset and character-variant cards use MediaThumbnail's coordinated hover playback, retain search/category filtering, and place Preview separately from Select. Bounded card columns, wrapped/clamped titles with complete titles available, fixed thumbnail areas and an anchored Select action prevent overlap. Preview does not call selection or persistence. Parent dialog state survives the temporary preview and focus returns to that specific Preview button.
- [MediaPreviewDialog](../src/components/MediaPreviewDialog.tsx) and [MediaThumbnail](../src/components/MediaThumbnail.tsx): a shared wide dialog provides fit, 50-point zoom increments from 100% to 400% of fitted size, reset, native size and scrollable panning. Fit caps at source resolution. Visible source pixel dimensions and zoom labels distinguish enlargement from additional detail. Actual Size can exceed the relative zoom range; Fit/Reset returns to the fitted view. The existing native video branch provides controls, muted initial state and explicit playback, with no second video implementation. Original object-URL hook is unchanged.
- [ReferenceBoard](../src/components/ReferenceBoard.tsx): all association keys, source roles and repeated media IDs remain distinct. Twelve associations render per gallery page, with hover-capable thumbnails, independent Preview and existing Download actions. Filename previews truncate visually while complete original filenames remain in accessible text and title information. Preview never changes the featured association, reference pack or export list. Gallery and preview dialogs take turns mounting to avoid competing focus traps. Both the per-entry Preview trigger and original View All / +more trigger regain focus, including the expanded secondary-thumbnail disclosure.
- [CollectionWorkspace](../src/screens/CollectionWorkspace.tsx) and [collectionWorkspace.css](../src/screens/collectionWorkspace.css): the selection/drag header is outside a dedicated inner media/details row. List mode caps the media column at 220px on desktop, retains 16:9 thumbnails and gives details a shrinking, wrapping column. At tablet/mobile sizes media stacks above details. Grid structure retains its previous visual spacing; shot-code shrink protection also prevents broken codes with long titles. Ordering, grip, keyboard ordering, selection, status, takes, navigation and More Actions remain in their existing controls.

The complete domain, storage, types and object-URL hook are unchanged, as are package/lock files. This PR changes no assembler, schema, media limits, ZIP64/backup/restore architecture, 128 MiB Project Export, immutable output strings, approved identities or anchors. Protected `validation.ts` SHA-256 remains `50660f5c044585676932402583c25e8b52ece28af04a714cc909898cc1970fae`.

## Automated results

| Command | Final local result | Exit |
| --- | --- | --- |
| `npm test` | 367/367 tests, 56 files | 0 |
| `npm run typecheck` | No TypeScript errors | 0 |
| `npm run build` | Production build succeeds; bundle advisory retained | 0 |
| `npm audit --omit=dev` | 0 vulnerabilities | 0 |
| `npm run test:qa` | 3/3; historical ledger valid: 207 checks, 45 screenshots | 0 |
| `npm run test:e2e` | 51/51, no failures/skips/flakes | 0 |
| `git diff --check` | Clean | 0 |

The historical ledger's 207 checks are separate from this PR's Playwright cases; counts are not added. No test timeout, retries or warning suppression was introduced. An intermediate full unit run timed out in the unchanged legacy dialogue compatibility test during concurrent unit/build/browser jobs; the sequential full run passed all 367 with the original five-second limit. A prior old preview test assumed Close was the only tab stop; it now asserts traversal through the new zoom controls and viewport and verifies wrapping back to Close.

TDD demonstrated missing zoom/Preview/pagination behavior, a baseline List media width of 515.77px instead of the required maximum 240px, and the gallery double-Escape focus regression. The corresponding corrected tests pass. Fresh independent review found the focus regression, confirmed the fix for both openers, and passed 17 focused tests with no remaining source findings. Test coverage was then strengthened for small-source images and repeated video cleanup.

Exact command warnings, source/screenshot hashes and browser observations are recorded in the JSON. React `act(...)` warnings in older tests, runner color-environment warnings and the Vite main-chunk advisory are retained and reported.

## Browser evidence

All tests use fresh synthetic Playwright contexts on private local ports 4173/4174. No actual browser profile or user IndexedDB was opened. The unchanged Git archive of the base produced the before images, using the same synthetic fixture as after.

- Eleven shots sharing one real canvas-encoded and decoded 320×180 WebM retain their records and media SHA-256 through Grid/List switching and previewing. Mixed camera assets and a character Camera Angle variant exercise the actual Scene Builder picker. Two hover players coordinate, stay muted/looping/inline and reset on exit. Explicit preview does not select; Select Variant still chooses the correct variant.
- Native enlarged video begins paused and muted with controls enabled. Play/pause/seek/volume properties are exercised through media APIs; this does not claim a manual native-control or fullscreen audit. Touch Preview and reduced-motion gating are tested. Existing browser cases retain real drag grip, keyboard ordering, rejected playback, corrupt media and URL-revocation coverage.
- A 1600×900 PNG demonstrates zoom, scroll panning, native size and reset. A 120×80 PNG stays at its native dimensions in the default fitted view, without automatic stretching.
- A 50-association reference pack retains duplicate media IDs and distinct roles, renders 12 entries (six videos in the mixed fixture) per page, retains downloads on the final page and previews any entry without changing the featured item or saved pack. Exact saved records and media hashes are compared before and after.
- Twelve alternating image/video preview cycles verify URL counts return to baseline and detached video elements are paused/reset/disconnected. Chromium JS heap is sampled during cycles and after forced garbage collection; actual observations are in the JSON. This bounds the observed run, not all native decoder/GPU/process allocations.
- Long Unicode titles/filenames, selection through Grid/List toggles, header/media/details non-overlap and no document overflow are asserted at all requested viewports and a 720×450 effective 200% reflow viewport. Screenshots were visually inspected. The baseline desktop image visibly intrudes into details; the corrected image stays in its own column.

## Assumptions and limitations

This is targeted compatibility, accessibility and resource-regression testing, not a general security or memory-safety certification. Existing MIME/size validation and browser decoding protections remain assumptions. Native scrolling handles panning; there is no custom drag-to-pan gesture. Native-size zoom controls switch back through Fit/Reset. Fullscreen availability depends on the browser; real fullscreen interaction, audible media and physical mobile hardware were not tested.

Chromium viewport/touch/reduced-motion emulation and keyboard assertions do not replace Safari/Firefox or human screen-reader testing. Memory observations cover a small synthetic workload and JS heap, not whole-process peak memory or long-lived large libraries. The gallery bounds mounted associations, while existing application snapshots still load the full media metadata/library. No actual user records were migrated or reinterpreted.

Only source, synthetic tests, selected synthetic screenshots and documentation are committed. Ignored `qa-results/performance-media/` retains baseline source/archive/configuration and raw command/browser logs; existing QA artifacts are preserved. No personal media, browser profiles, credentials or test/backup ZIP files are included.

Local warnings: 28 React act warnings, 2 runner color warnings, and the Vite bundle advisory. All 18 PNGs exist; total 1391958 bytes. Their hashes and dimensions are recorded in the JSON.

## Complete changed-file list

34 intended files (M modified, A new):

```text
M src/__tests__/mediaPreview.test.tsx
M src/components/MediaPreviewDialog.tsx
M src/components/MediaThumbnail.tsx
M src/components/ReferenceBoard.tsx
M src/components/SharedModals.tsx
M src/screens/CollectionWorkspace.tsx
M src/screens/collectionWorkspace.css
A docs/media-inspection-qa.md
A docs/qa/media-inspection/README.md
A docs/qa/media-inspection/after/gallery-1440.png
A docs/qa/media-inspection/after/gallery-390.png
A docs/qa/media-inspection/after/gallery-768.png
A docs/qa/media-inspection/after/list-1440.png
A docs/qa/media-inspection/after/list-390.png
A docs/qa/media-inspection/after/list-768.png
A docs/qa/media-inspection/after/picker-1440.png
A docs/qa/media-inspection/after/picker-390.png
A docs/qa/media-inspection/after/picker-768.png
A docs/qa/media-inspection/after/zoom-1440.png
A docs/qa/media-inspection/after/zoom-390.png
A docs/qa/media-inspection/after/zoom-768.png
A docs/qa/media-inspection/before/list-1440.png
A docs/qa/media-inspection/before/list-390.png
A docs/qa/media-inspection/before/list-768.png
A docs/qa/media-inspection/before/picker-1440.png
A docs/qa/media-inspection/before/picker-390.png
A docs/qa/media-inspection/before/picker-768.png
A docs/qa/media-inspection/qa_results.json
A docs/superpowers/plans/2026-10-28-media-preview-list.md
A e2e/media-inspection-fixture.mjs
A e2e/media-inspection-screenshots.spec.mjs
A e2e/media-inspection.spec.mjs
A src/__tests__/mediaInspection.test.tsx
A src/components/mediaInspection.css
```

Final resource observation: JS heap before forced-GC baseline 9,998,688 bytes; maximum observed during cycles 13,290,496 bytes; after final forced GC 11,234,024 bytes. Live tracked URLs: 2 before, 2 after. This is not whole-process or native-decoder memory certification.
