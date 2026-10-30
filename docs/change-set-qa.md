# Phase 6 Stage B — QA and review evidence

This report records local verification before signing. The PR and its Actions checks bind hosted results to the published signed commit. Machine evidence, all commands, source/screenshot hashes, the complete changed-file list and retained synthetic-profile inventory are in [change-set-results.json](qa/change-set-results.json). Raw `qa_results.json`, logs and profiles remain under ignored `qa-results/change-sets/`.

## Directly verified source facts

- Stage A PR #26 merged as `bc57bd56495e004d13dc034e0fdc4d0fc46a494c`; its tree equals approved Stage A `4ca995ba35546686c16fb8d469f676e0bfc80c1a`. Stage B is based on that merged master and targets `master`.
- [changeSetSchema.ts](../src/domain/changeSetSchema.ts), [changeSetValidation.ts](../src/domain/changeSetValidation.ts) and the parity-tested [distributed schema](change-set.schema.json) define the canonical allowlisted JSON contract. Unknown fields/versions, wrong/forward/cyclic references, excessive depth/count/bytes, invalid targets and approval grants inside files are rejected. Dependency depth uses memoized traversal; converging paths are not traversed repeatedly.
- [changeSets.ts](../src/storage/changeSets.ts) reads current state and commits the entire batch plus its receipt in one existing IndexedDB transaction. New scenes/assets/templates use add-only writes. Existing draft/media/variant records participate in reads without writes; current preferences are merged so active drafts survive. No database/store upgrade, backfill or user-library import is run on startup.
- [sceneAuthoring.ts](../src/storage/sceneAuthoring.ts) exposes shared synchronous planning helpers for both ordinary authoring and batch import. Existing scene versions remain immutable. [changeSetState.ts](../src/domain/changeSetState.ts) binds current relevant dependencies, including the live character master consulted when restoring recipe anchor metadata.
- [changeSetReferences.ts](../src/domain/changeSetReferences.ts) uses existing asset/variant snapshot and ownership checks. Explicit contexts retain actual reference associations even for inactive Shot Type components. There is no media inference, deletion, silent export filtering or identity replacement. Independent inherited pack associations remain until changed explicitly through existing reference controls.
- [aiContext.ts](../src/domain/aiContext.ts) exports selected metadata with separate full-prompt, ordinary-text, identity, notes and filename choices. Raw association IDs that can embed private labels are omitted. Preferences, credentials and media bytes are absent. Names/titles/tags and custom IDs can still be private.
- [changeSetCapacity.ts](../src/domain/changeSetCapacity.ts) uses the same metadata-only manifest builder as [backup.ts](../src/storage/backup.ts). A package below the 20 MiB input bound can still exceed the retained 20 MiB resulting backup-manifest bound and is blocked without writes. No archive/media allowance is raised. Existing Project Export remains 128 MiB.
- Prompt assembler, archive/storage constants, reference-pack engine, dependency manifests, workflow and Playwright configuration are unchanged. Separate local `validation.ts` work, the actual browser library and localhost:5173 are untouched. PR #12 remains a separate unchanged draft at `daf5afa0fb7bfeefcb4626854e2dad7db6aa3ec8`.

## Automated results

All final commands below exited **0**. Exact timings and raw-log paths are in the machine report.

| Command | Actual result |
| --- | --- |
| `git status --short` | Pending feature changes inventoried; full list in machine report |
| `git diff --name-status` | Existing tracked modifications recorded; newly created files listed separately and included in the final inventory |
| `git diff --check` | No whitespace errors |
| `npm test -- --maxWorkers=2 --minWorkers=1` with JSON/JUnit reporters | 662 passed / 94 files; zero failed/skipped |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; chunk-size warning retained |
| `npm audit --omit=dev` | 0 production vulnerabilities |
| `npm run test:qa` | 6 script tests; historical 207 checks /45 screenshots, counted separately |
| `npm run test:e2e` | 135 unique cases /135 attempts; zero failures/skips/flaky cases/retries |

The unit total includes 581 existing tests and 81 new tests. Browser total includes 113 existing cases and 22 new cases. All 22 frozen legacy output hashes remain equal, and their complete expected hash map is included in the machine evidence. Tested source hashes were captured before the consolidated run and checked afterward.

Warnings: 25 React `act` notices from MediaThumbnail tests; 2 Node NO_COLOR/FORCE_COLOR notices; Vite's existing >500 kB chunk warning. These are warnings, not failed checks. A production dependency audit is not a security certification.

## Browser-tested behavior

All writes used isolated synthetic Chromium contexts at `127.0.0.1:4173`. No real production profile was opened.

| Scenario | Demonstrated behavior |
| --- | --- |
| A: New storyboard | Exactly 15 ordered planned shots, 60 seconds, types 2 character /9 property /4 graphic, four pending originals, 15 exact complete prompts, two deferred candidates; no automatic assets/preference/status |
| B: Existing project | New shot/take appended; every previous shot/scene/draft and unrelated project preserved |
| C: Revisions | New immutable v2; restore old text as v3; separate alternate take; original snapshots unchanged; preference/status each need explicit approval |
| D: Project isolation | Invalid project/shot/source combinations blocked; shared scene revision attached only to the chosen project |
| E: Replay | Same ID/content returns historical receipt without duplicate records, including after full backup/restore and browser restart |
| F: Stale tab | A second-tab project write invalidates approval; its foreign write remains intact |
| G: Failure | Quota exception and forced transaction abort after queued writes roll back the entire batch; disappearing media blocks Apply |
| H: Pending media | Four honest unresolved originals remain pending; an existing decodable synthetic PNG can be linked later as a new immutable version with unchanged prompt; inconsistent MIME metadata blocks creation |
| I: Reusable candidates | Character reuse and acknowledged separate Camera creation preserve originals; deferred content is inspectable after reload before a later explicit unreviewed creation |
| J: Exact text | Actual clipboard readback, TXT download and project-ZIP prompt member match the original 70-byte CRLF/Unicode text |
| K: Recovery | Full backup restores all records, receipts, candidates, variant context and media hash; entire Chromium process closes/restarts; replay performs no writes |
| L: UI/privacy | File/paste import, read-only preview/cancel, privacy opt-ins, exact context copy/download, 100,000-character prompt, 250-operation collapsed preview, dialog focus/Escape return, keyboard approvals and no horizontal overflow |

The recovery fixture contains 11 assets, 1 variant, 17 scenes, 3 drafts, 3 collections, 4 templates, 1 decodable PNG, 1 receipt and 2 candidates. Every compared JSON record and media SHA-256 is equal after restore/restart. The measured backup is **27161 bytes**, SHA-256 `6a75107438ca8b33e9e1302de1c1e169cfe36637f9baa0da66615c7fe5b39fdc`; its manifest is 113782 bytes. The original/clipboard/TXT SHA-256 is `1fc5330118154416b60b2c8792e6917a503d2c5cc710b6cc72b69a009d7bc193`. Archive readback uses Node fflate; this small representative test is not independent ZIP64 or near-limit capacity certification.

## Final review and earlier failures

One fresh whole-branch review identified **three Important /zero Critical** findings. Each was reproduced and corrected: a recipe restore could change anchor mode after the live character changed; dependency validation repeated converging paths exponentially; deferred-candidate review omitted its full content. Five new assertions failed before the fixes. Focused tests then passed, followed by the complete final suite. Restores now bind updated/deleted masters and expose generation metadata/fallback advice; dependency depth is memoized; candidate preview includes frozen content, decision and outcome. No independent second review was performed.

The deferred-review browser regression additionally exposed an expanded pending list consuming the fixed preview height. Hiding that list during preview restored access to its decision controls. Earlier development checks exposed checkbox timing, preview-focus timing and 1366px action visibility defects; all were corrected. Test-only locator, readiness and conflicting-code assumptions were also corrected. Typecheck caught three unsupported options in new test selectors; they were removed before the consolidated repeat. Raw failed and passing evidence is retained rather than represented as one uninterrupted green run.

## Screenshots and accessibility limits

33 committed synthetic PNGs have verified paths, dimensions and hashes. Desktop panels scroll internally with the primary action visible at 1440×900 and 1366×768. Mobile uses normal stacked page scrolling. Long prompts stay in a dedicated bounded detail dialog.

| Width | Before collections | Before storyboard | After collections | After storyboard | Preview | Detail | Receipt | Context |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|1440|[PNG](screenshots/change-sets/before/collections-1440.png)|[PNG](screenshots/change-sets/before/project-1440.png)|[PNG](screenshots/change-sets/after/collections-1440.png)|[PNG](screenshots/change-sets/after/project-1440.png)|[PNG](screenshots/change-sets/after/preview-1440.png)|[PNG](screenshots/change-sets/after/detail-1440.png)|[PNG](screenshots/change-sets/after/receipt-1440.png)|[PNG](screenshots/change-sets/after/context-1440.png)|
|1366|[PNG](screenshots/change-sets/before/collections-1366.png)|[PNG](screenshots/change-sets/before/project-1366.png)|[PNG](screenshots/change-sets/after/collections-1366.png)|[PNG](screenshots/change-sets/after/project-1366.png)|[PNG](screenshots/change-sets/after/preview-1366.png)|[PNG](screenshots/change-sets/after/detail-1366.png)|[PNG](screenshots/change-sets/after/receipt-1366.png)|[PNG](screenshots/change-sets/after/context-1366.png)|
|768|[PNG](screenshots/change-sets/before/collections-768.png)|[PNG](screenshots/change-sets/before/project-768.png)|[PNG](screenshots/change-sets/after/collections-768.png)|[PNG](screenshots/change-sets/after/project-768.png)|[PNG](screenshots/change-sets/after/preview-768.png)|[PNG](screenshots/change-sets/after/detail-768.png)|[PNG](screenshots/change-sets/after/receipt-768.png)|[PNG](screenshots/change-sets/after/context-768.png)|
|390|[PNG](screenshots/change-sets/before/collections-390.png)|[PNG](screenshots/change-sets/before/project-390.png)|[PNG](screenshots/change-sets/after/collections-390.png)|[PNG](screenshots/change-sets/after/project-390.png)|[PNG](screenshots/change-sets/after/preview-390.png)|[PNG](screenshots/change-sets/after/detail-390.png)|[PNG](screenshots/change-sets/after/receipt-390.png)|[PNG](screenshots/change-sets/after/context-390.png)|

[200% equivalent reflow capture](screenshots/change-sets/after/preview-200-percent.png) uses 720×450 CSS pixels and DPR 2, equivalent to a 1440×900 desktop at doubled scale. Native browser zoom controls and standalone screen-reader software are not certified. Browser checks verify accessible control names, keyboard operation and dialog focus behavior; they are not a full WCAG audit.

## Security assumptions and remaining risks

Strict parsing/allowlisted operations, literal React rendering and tested transaction guards provide specific evidence. No area is labelled SAFE from a function-name search. Local digests bind payload/state/decisions; they do not authenticate an AI author, cryptographically prove human consent, or defend against arbitrary same-origin scripts/direct database tampering. Stage C requires a separate authenticated browser-owned approval broker.

Current media MIME/size/type metadata is revalidated. Arbitrary replacement of Blob bytes with identical metadata outside supported APIs is not certified. Quota/abort tests inject transaction failures; physical disk exhaustion and every browser engine are unverified. Names/custom IDs can be private even in metadata-only context, and a deliberately selected full prompt can contain identity information.

PR #12's large-library ZIP64 work is separate and not integration-tested with these new optional fields. The existing backup metadata bound can block a large import. No capacity gate was raised, and no large ZIP recovery completion is claimed. Stages C/D, cloud/AI API calls, pairing, credentials, servers/listeners and automatic identity inference are absent.

Only feature source, tests, canonical examples, curated synthetic screenshots and documentation are intended for this PR. No user-library data, browser profiles, ZIP/XLSX/CSV files, credentials, dependency caches or temporary QA artifacts are staged. Retained synthetic QA profiles/files are inventoried in the machine report; none were deleted. This PR remains unmerged pending human approval.
