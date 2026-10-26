# Phase 5 C — continuity and script verification

Reconciled check identities and screenshot hashes are in [the Phase 5 QA ledger](qa/phase5-summary.md). The final retained JSON contains 59 checks. An earlier QA brief cited 56, but no intermediate 56-check JSON remains for an exact three-check diff. These local Chromium results were not independently run by GitHub CI.

Branch `codex/phase5-continuity-script`, parent Stage B `d1a98e7f990cdbcfb918611f7a7d4f3a1b0fce37`. No merge or master push. Project export and bulk productivity remain separate Stage D work.

## Directly inspected facts

`src/types/domain.ts`, `src/domain/projectContinuity.ts`, and `src/storage/projectContinuity.ts` add optional collection-local cast/Bible metadata, wardrobe intent, explicit frame images and stable transition edges. The existing eight version-1 stores remain unchanged. Cast traits are manually entered; selected-shot cast is explicitly labeled derived. Character master identity and approved anchor are read only. Scene snapshots, canonical outputs, reference packs and original media are not rewritten.

`src/components/ProjectCastPanel.tsx` and `ProjectScriptPanel.tsx` provide compact cards, full identity disclosure, manual Bible editing and exact ordered dialogue copy/UTF-8 Markdown export, including mode/language/delivery/intended duration. `ProjectContinuityPanel.tsx` reviews effective saved wardrobe descriptions, intentional changes, explicit first/last images, adjacent last→first visual pairs, and transitions. It neither generates nor extracts video frames. Reorder retains edge IDs/endpoints and displays detached edges; confirmed shot removal clears incident edges.

New frame uploads and assignment share one IndexedDB transaction through `uploadProjectFrame`. Current quota is checked inside that transaction; deleted targets or write failures abort both media and project writes. Existing-image assignment patches only one side. Wardrobe editors send changed fields, and full Bible/transition editors bind to opening project revision so stale forms reject visibly.

`src/domain/phase5ProjectValidation.ts`, `src/storage/backup.ts` and the media ownership collector in `src/storage/db.ts` validate/preserve optional metadata and frame/cast image ownership. Binding design ruling 11 preserves unavailable historical cast source/wardrobe IDs after ordinary asset deletion, while present records must have the correct type/parent and new explicit selections require live records. Missing choices remain visible/removable; metadata is not silently erased. Frame/cast image files remain strict canonical references. Legacy optional reference-pack policy remains unchanged.

The workspace retains non-asset character snapshots as read-only cards, avoiding a regression for legacy template characters. Master identity is not inferred from those snapshots.

## Automated results

`npm test`: **270 tests / 40 files passed**, exit 0. The final run emitted 22 MediaThumbnail React act warnings; no assertions failed. Coverage includes exact Unicode/multiline strings, canonical empty-override fallback, intentional/missing wardrobe, original master preservation, deleted cast-source backup restore, strict new image selections, edge stability/removal, stale form conflicts, atomic upload success and synchronous/asynchronous abort, current media quota, and frame backup bytes.

`npm run typecheck`: exit 0. `npm run build`: exit 0; JS 528.12 kB / gzip 150.81 kB. **Warning:** Vite reported a chunk above 500 kB. `npm audit --omit=dev`: exit 0, zero vulnerabilities. `git diff --check`: exit 0. Existing `validation.ts` SHA-256 remains `50660f5c044585676932402583c25e8b52ece28af04a714cc909898cc1970fae`.

Earlier integration runs were not clean: missing concurrently authored panel imports; one template-character regression, fixed without changing its assertion; and one asynchronous navigation wait exceeding Testing Library's one-second default under parallel suite load. The unchanged journey passed in isolation, and its output-control wait was increased to five seconds before the final full-suite pass. No product check was removed. Scoped review findings (wardrobe fallback, stale Add Cast, unavailable wardrobe editing, two-transaction upload, adjacent image comparison) have focused fixes and approved re-review.

## Browser evidence

External evidence directory: `C:/Users/HomePC/.codex/visualizations/2026/10/26/01a172e9-6e93-73f1-8220-ee98cad74baf/phase5/`.

`stage-c-browser.cjs` final results: **59 checks, zero failures/page errors**, 12 nonempty screenshots. Isolated Chromium with synthetic Late Again three-character/11-shot fixtures tested manual Bible editing, exact script copy/download, wardrobe review, frame upload/select/clear/enlarge, stable transition metadata and detached review, separate-page conflicts/narrow updates, immutable originals, and full backup restore in another context. Script setup uses explicit repository/native fixture operations as recorded in `c-browser-report.md`; this is not a claim that every fixture record was created through UI clicks.

Screenshots: `stage-c-{characters,continuity,bible,transition}-{1440,768,390}.png` at 1440×900, 768×1024, 390×844. File existence/size checked; mobile Characters screenshot visually inspected. Overflow, focus and Escape checks are recorded in `stage-c-browser-results.json`. Windows clipboard reads can convert LF to CRLF; that platform conversion is normalized only in clipboard checks. Downloaded UTF-8 bytes are checked exactly. Three additional post-commit checks verified active transition restore and visibly unavailable historical references; direct test-only IDB restore requires an explicit app reload before UI assertions.

## Assumptions and remaining risks

All browser profiles, ZIPs, screenshots and raw logs are outside Git. The original checkout, user browser profiles and port 5173 data were untouched. No new services/dependencies or storage-limit changes. The tests establish the covered behavior, not a general security certification. Real screen-reader software, every media codec, large-library memory use and multi-gigabyte backups were not tested. Full-entry concurrent edits reject rather than auto-merge; users must reopen the editor after a conflict. The build chunk warning remains visible evidence at this stage.
