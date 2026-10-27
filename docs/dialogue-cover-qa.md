# Dialogue performance presets and collection cover picker — QA

Base: master `59c5a37b94c5a54553d6e2ddc86866958b34dbae`. Branch: `codex/dialogue-presets-cover-picker`. Target: master; no automatic merge.

[Machine-readable evidence](qa/dialogue-cover/qa_results.json) records command exits, every browser case, tested source hashes, synthetic preservation checks and screenshot hashes. The [before/after gallery](qa/dialogue-cover/README.md) includes the requested 1440×900, 768×1024 and 390×844 viewports. Baseline captures use an unmodified Git archive of the base with the same synthetic fixture.

## Directly verified source facts

- [PerformanceDirection](../src/components/PerformanceDirection.tsx) provides 13 removable delivery checkboxes, optional pace and gestures, editable Custom Notes, an effective preview and Clear. Nothing is selected by default. Only calm/angry, sad/happy and nervous/confident are treated as opposite pairs; disabled choices explain which selection to remove first. The component updates only dialogue delivery fields and never derives selections from prose or changes `dialogue.line`.
- [dialoguePerformance](../src/domain/dialoguePerformance.ts) validates a versioned optional object and produces canonical instructions in a fixed preset order. Generated sentences and the exact custom string are separated by two newlines. Empty delivery is omitted. Arbitrary existing `deliveryNotes` remains editable custom text, including authored whitespace.
- [sceneDocument](../src/domain/sceneDocument.ts), [promptAssembler](../src/domain/promptAssembler.ts) and [projectContinuity](../src/domain/projectContinuity.ts) share the effective string. Narrative, Structured, Compact, Project JSON, Generation JSON, Generic, Gemini Omni and Project Script use the same instructions. Preflight uses the effective string and shows exact optional-metadata evidence on validation errors; its existing rule matchers are unchanged.
- [db](../src/storage/db.ts) validates the new optional field before draft writes and deep-copies nested dialogue data when saving or creating an editable copy. [phase4Validation](../src/domain/phase4Validation.ts) applies the same optional validation during backup validation. Existing scenes and their frozen outputs are never rewritten.
- [collectionCoverMedia](../src/domain/collectionCoverMedia.ts) resolves actual shot/take, scene result/reference/reference-pack/slot, frame, cast-reference, collection-member and current-cover links. Selected scene results and references come first. Names and filenames never establish project membership.
- [CollectionCoverPicker](../src/components/CollectionCoverPicker.tsx) starts on Project Media, retains All Images, and groups explicit collection covers and current-session uploads under Covers. Search covers display and original names with Unicode normalization. At most 24 images render per page; names truncate visually while accessible descriptions preserve full original filenames. The existing MediaThumbnail, upload validator and media storage API remain in use.
- [CollectionWorkspace](../src/screens/CollectionWorkspace.tsx) and both [CollectionsScreen](../src/screens/CollectionsScreen.tsx) entry paths supply context. Selecting a thumbnail changes only the picker highlight. Use Cover stages it in the parent editor; Save Project / Save Changes / Create Collection commits it. Cancel or Escape preserves the prior parent selection. Remove Cover explicitly stages removal. Uploads store original bytes immediately and survive cancellation, as explained in the UI. Focus returns to Choose/Change Cover after the picker closes, including React Strict Mode.

## Representation and compatibility

Authoring records keep `dialogue.deliveryNotes` as the original custom text and optionally add:

```json
{
  "performanceDirection": {
    "version": 1,
    "styles": ["angry", "energetic", "lecturing"],
    "pace": "fast",
    "gestures": "strong_pointing"
  }
}
```

Absent choices are omitted. No migration or default backfill runs. Draft reload, saved-scene edit copies and full-library backups retain this metadata and the separate custom string. Old records without it keep their previous output shape and custom text. New Project JSON includes optional selection metadata and an effective `deliveryNotes` string for consumers; Generation JSON includes the effective string only. These are output documents, not authoring-record import formats: selections are never reconstructed from their flattened text. Actual backup records retain the custom string separately.

The IndexedDB schema version and eight stores remain unchanged. Media limits, ZIP backup/restore architecture, the separate 128 MiB Project Export, identity records and provider integrations are unchanged. The protected `src/domain/validation.ts` SHA-256 remains `50660f5c044585676932402583c25e8b52ece28af04a714cc909898cc1970fae`.

## Automated results

| Command | Actual local result | Exit |
| --- | --- | --- |
| `npm test` | 364/364 tests, 55 files, 27.45 seconds | 0 |
| `npm run typecheck` | No TypeScript errors | 0 |
| `npm run build` | Production build succeeds; bundle advisory below | 0 |
| `npm audit --omit=dev` | 0 vulnerabilities | 0 |
| `npm run test:qa` | 3/3 tests; historical ledger valid: 207 checks, 45 screenshots | 0 |
| `npm run test:e2e` | 39/39, 0 skipped/flaky/failed, 69.477 seconds | 0 |
| `git status --short` | Pending intended source/tests/docs/screenshots listed below | 0 |
| `git diff --check` | Clean | 0 |

Runtime: Node 22.23.3, npm 10.9.9, Playwright 1.64.1 and its pinned Chromium. The baseline suite passed 337/337 tests in 50 files. The independent source review found no actionable defects and independently passed the 27 new focused tests. Exact-head GitHub CI evidence is supplied with the PR handoff; this committed report is a local verification snapshot of the source hashes in the companion JSON.

Warnings are retained: 20 React `act(...)` warnings from MediaThumbnail updates in older tests, two browser runner `NO_COLOR`/`FORCE_COLOR` warnings, and Vite's advisory that the main JS chunk is over 500 kB (508.07 kB / gzip 148.18 kB; collection JS 82.13 kB / gzip 22.99 kB). Typecheck, production audit and QA-ledger checks report no warnings. The historical QA ledger's 207 canonical checks are separate from the current Playwright suite and are not added to its count. All 18 PNGs exist, total 1,336,298 bytes, with dimensions and SHA-256 recorded in the JSON.

Regression tests first demonstrated failures for missing preset formatting/validation, picker staging/context and Strict Mode focus restoration, then passed with the implementation. Existing golden output and legacy dialogue tests remain included.

## Browser-tested behavior

All browser tests use fresh isolated Playwright contexts and synthetic IndexedDB on `127.0.0.1:4173`; baseline screenshots use port 4174. The user's localhost:5173 browser/profile was never opened, cleared or changed.

- Compatible presets, custom-only directions, presets-only directions, individual removal and Clear work without defaults or inference. Exact Taglish text, quotation marks, spaces, newline and emoji survive draft save/reload, assembly, JSON, scene save and Project Script. All seven output variants contain the generated directions exactly once. Native clipboard contents match the displayed full output after Windows CRLF/LF normalization; this test does not claim raw operating-system clipboard newline bytes are identical.
- Synthetic existing scenes, assets and media hashes remain identical after adding a new performance scene. Unit tests also verify legacy frozen outputs, nested-copy isolation, old/new ZIP roundtrips and rejection of malformed metadata before replacement, with the original library intact.
- Project Media excludes unrelated images; All Images finds long Unicode filenames and exposes their complete accessible descriptions. Selection, picker cancellation, parent cancellation, explicit Save and reload behave independently. A missing cover remains explicit and cannot be silently replaced by Use Cover.
- A 63-image synthetic library renders pages of 24/24/15. A valid PNG uploaded through the native file input keeps the same SHA-256 as the source. Cancelling both editors retains that uploaded file while leaving existing media, scenes, collections and assets unchanged. Unit tests cover unsupported, empty, oversized and failed uploads.
- Arrow keys switch picker tabs; Escape closes it and restores the parent editor and focus. The inherited dialog focus trap and keyboard controls remain in use. At all three requested sizes, document and dialog body have no horizontal overflow and the action footer remains within the viewport. Screenshots were visually inspected for readable controls and filename containment.

## Security assumptions and remaining limitations

Validation bounds the optional preset metadata and rejects unknown/duplicate/incompatible IDs, versions and fields. This is targeted correctness and data-preservation evidence, not a security certification. Existing MIME/size validation and browser storage protections remain assumptions inherited from the application; this change does not add malware scanning or stronger media decoding validation.

Browser evidence is Chromium automation with viewport emulation. Safari, Firefox, physical mobile devices and assistive-technology speech output were not tested. Accessible names, descriptions, keyboard paths and focus are asserted, but a human screen-reader audit remains useful. No external AI provider was called, and provider acting quality is unverified.

Upload storage rejection is tested; rejection of the later library-refresh callback after successful storage has no dedicated regression case. The source retains the successfully stored image in picker state and clears the busy state while reporting that error.

Covers is an equivalent relationship-based grouping, not permanent upload provenance. An unused upload cancelled in an earlier session is still available in All Images. Pagination bounds rendered thumbnails, while the existing library snapshot still loads media records; this task does not certify multi-gigabyte library memory behavior. Existing React test warnings and the Vite bundle advisory are reported without suppressing them.

Only application source, synthetic tests, documentation and selected synthetic screenshots belong in this PR. Ignored `qa-results/dialogue-cover/` retains command logs, baseline source/archive/configuration and diagnostic evidence; other pre-existing ignored QA files are preserved. No browser profile, backup/test ZIP, actual user media, credentials or temporary server output is included in the commit.

## Complete changed-file list

49 intended files (M = modified, A = new):

```text
M src/__tests__/collectionControls.test.tsx
M src/__tests__/collectionCoverEditor.test.tsx
M src/__tests__/dialogueCompatibility.test.tsx
M src/components/CollectionCoverPicker.tsx
M src/domain/phase4Validation.ts
M src/domain/projectContinuity.ts
M src/domain/promptAssembler.ts
M src/domain/sceneDocument.ts
M src/domain/scenePreflight.ts
M src/screens/CollectionWorkspace.tsx
M src/screens/CollectionsScreen.tsx
M src/screens/SceneBuilderScreen.tsx
M src/storage/db.ts
M src/types/domain.ts
A docs/dialogue-cover-qa.md
A docs/qa/dialogue-cover/README.md
A docs/qa/dialogue-cover/after/cover-project-1440.png
A docs/qa/dialogue-cover/after/cover-project-390.png
A docs/qa/dialogue-cover/after/cover-project-768.png
A docs/qa/dialogue-cover/after/cover-search-1440.png
A docs/qa/dialogue-cover/after/cover-search-390.png
A docs/qa/dialogue-cover/after/cover-search-768.png
A docs/qa/dialogue-cover/after/custom-preview-1440.png
A docs/qa/dialogue-cover/after/custom-preview-390.png
A docs/qa/dialogue-cover/after/custom-preview-768.png
A docs/qa/dialogue-cover/after/performance-1440.png
A docs/qa/dialogue-cover/after/performance-390.png
A docs/qa/dialogue-cover/after/performance-768.png
A docs/qa/dialogue-cover/before/cover-project-1440.png
A docs/qa/dialogue-cover/before/cover-project-390.png
A docs/qa/dialogue-cover/before/cover-project-768.png
A docs/qa/dialogue-cover/before/performance-1440.png
A docs/qa/dialogue-cover/before/performance-390.png
A docs/qa/dialogue-cover/before/performance-768.png
A docs/qa/dialogue-cover/qa_results.json
A docs/superpowers/plans/2026-10-28-dialogue-cover.md
A e2e/dialogue-cover-fixture.mjs
A e2e/dialogue-cover-screenshots.spec.mjs
A e2e/dialogue-cover.spec.mjs
A src/__tests__/collectionCoverMedia.test.ts
A src/__tests__/collectionCoverPicker.test.tsx
A src/__tests__/dialoguePerformance.test.ts
A src/__tests__/dialoguePerformancePersistence.test.ts
A src/__tests__/performanceDirection.test.tsx
A src/components/PerformanceDirection.tsx
A src/components/collectionCoverPicker.css
A src/components/performanceDirection.css
A src/domain/collectionCoverMedia.ts
A src/domain/dialoguePerformance.ts
```
