# Camera & Cinematography QA

Local verification passed on Windows on 29 October 2026. The work is on `codex/camera-cinematography`, based on `a03bd5d62bf42f55142565147bd0c0b99d2899db`. This report describes the verified working tree before its configured SSH-signed commit. A remote PR and GitHub Actions result require that signed commit and push; neither is claimed here.

The automated signed-commit attempt reached `Enter passphrase:` and was cancelled without changing HEAD. All 67 intended files remain staged and whitespace checks pass. Local key entry in the user's own terminal is the remaining handoff; signing configuration was not disabled or changed.

The [machine-readable results](qa/cinematography-results.json) contain command exit codes, every browser case, output/media hashes, all changed files, and hashes/sizes for all 18 synthetic screenshots. [Design and coverage](camera-cinematography-design.md), [usage/metadata contract](camera-cinematography-guide.md), and the [execution/review ledger](superpowers/plans/2026-10-29-camera-cinematography.md) explain the implementation and decisions.

## Directly verified facts

- The actual read-only browser inventory contained **72 Camera records**: 63 imported CAM records, three bundled starters and six authored records. Repeated reads matched; the inventory performed zero IndexedDB writes and did not read media blobs.
- The reviewed 338-item matrix contains **138 Existing, 49 Partial, 125 Missing and 26 Ambiguous** items. Twenty-five ambiguous entries belong to Lighting/Styles; those categories' actual records were not inspected by the Camera-only audit. Existing motion controls mean prose coverage, not pre-existing structured UI controls. Full private matching IDs/evidence remain outside Git.
- The same 72-record capture was passed to the pack's pure preview function. Its eight candidates were available. This did not install anything or reconnect to the actual user's database. Installation will recheck the current library after explicit user confirmation.
- The existing `camera` category, route and Builder slot remain. The registry has 15 families and 338 items; the core pack contains only eight optional reusable presets.
- `src/domain/promptAssembler.ts` is unchanged. UI labels use `src/domain/displayLabels.ts`; historical assembly labels retain their original wording. `src/domain/validation.ts` changes only the Camera category's display label; limits are unchanged. The user's separate local validation work was not edited.
- `src/storage/db.ts` retains IndexedDB version 1 and the same eight stores. Changes validate optional Camera metadata at draft/save boundaries. No migration, automatic install, media cleanup or archive-limit change is included. The separate Project Export limit remains 128 MiB.

## Automated command results

| Command | Exit | Result |
| --- | ---: | --- |
| `npm test` | 0 | 521 passed across 75 files; zero failures/skips |
| `npm run typecheck` | 0 | No TypeScript errors |
| `npm run build` | 0 | Production build completed |
| `npm audit --omit=dev` | 0 | Zero production dependency vulnerabilities reported |
| `npm run test:qa` | 0 | All six QA regression checks passed; historical ledger valid at 207 counted checks/45 screenshots |
| `npm run test:e2e` | 0 | 94 passed; zero failures, flaky results or skips; 268.30 seconds |
| `git diff --check` | 0 | No whitespace errors |

Unit reporting used additional JUnit/JSON reporters; raw reports remain in ignored `qa-results/`. The current browser total is **83 retained cases + 11 new cases = 94**. The historical 207-check reconciliation ledger is a separate dataset and is not added to that browser total. Before screenshots ran in a separate three-case baseline pass; three focused source-workflow repetitions also passed and are not counted again in the 94.

Warnings from the final local run:

- Vite's main JavaScript chunk is **815.12 kB / 203.10 kB gzip**, above its default 500 kB warning threshold. The build succeeds; bundle splitting remains a possible future optimization.
- Vitest emitted **53 `act(...)` warnings from asynchronous MediaThumbnail updates**. Assertions passed. These notices are recorded rather than treated as a clean warning-free run.
- The browser runner emitted one notice that `FORCE_COLOR` causes `NO_COLOR` to be ignored.

## Browser-tested behavior

Playwright 1.64.1 used bundled Chromium 156.0.8078.4, revision 1248, in fresh synthetic contexts on `127.0.0.1:4173`. The real user profile and `localhost:5173` were not used for feature testing.

The new browser cases verify read-only exploration, collapsible families, aliases, favorites/recents, Shot Type/property filters and independent category links. They exercise explicit Camera apply/cancel/reset, prior override restoration, new preset rebase, retained Character/Lighting/Style values, restart/reload persistence, arrow-key tabs, dialog focus trapping and trigger restoration.

Motion tests distinguish static-body/rack-focus and static-body/optical-zoom combinations from simultaneous static/travel conflicts. Deliberate compound moves and sequential holds work; primary/secondary execution order reaches the preview. Zero-time travel produces advisory text without a speculative blocker.

Graphic/footage composition does not require a physical lens or height. Required original graphics still block assembly until a valid source is selected. Existing source-deletion, unsupported-MIME and inconsistent-metadata assembly regressions remain in the passing full suite.

Copy API payloads and actual downloads match complete Narrative, Structured, Compact, Project JSON and Generation JSON text. The small full-library backup roundtrip restores Camera metadata, a new frozen take, the unchanged legacy take and identical media SHA-256. Unit tests additionally exercise Project ZIP text/metadata, unknown-metadata rejection before replacement, add-only install rollback, late duplicate insertion and idempotency. Existing legacy output goldens remain unchanged.

## Review corrections

One independent read-only whole-branch review found four Important issues: manual built-in override loss on reset; a library-first preview/application draft mismatch; missed Deep focus equivalents; and movement phase ordering. It also identified obsolete generated-motion advice and inconsistent secondary UI labels. All six were reproduced by failing tests, corrected, and covered by passing focused regressions before the final 521/94 runs. No second independent review is claimed.

The scope/record-privacy decisions and the reviewer's declined-to-judge items are recorded in the execution ledger. The reviewer did not inspect private prompt evidence or certify a future CI run; this report separates the actual inventory, local automated evidence and pending remote evidence.

## Screenshots

All screenshots contain fictional synthetic records. The before source was verified against master `a03bd5d`; after screenshots were captured from this implementation. All 18 files exist, with byte sizes and SHA-256 in the JSON report.

| Width | Before presets | After presets | Explorer | Composer |
| --- | --- | --- | --- | --- |
| 1440 × 900 | [Before](screenshots/cinematography/before/presets-1440.png) | [After](screenshots/cinematography/after/presets-1440.png) | [Explorer](screenshots/cinematography/after/explorer-1440.png) | [Composer](screenshots/cinematography/after/composer-1440.png) |
| 768 × 1024 | [Before](screenshots/cinematography/before/presets-768.png) | [After](screenshots/cinematography/after/presets-768.png) | [Explorer](screenshots/cinematography/after/explorer-768.png) | [Composer](screenshots/cinematography/after/composer-768.png) |
| 390 × 844 | [Before](screenshots/cinematography/before/presets-390.png) | [After](screenshots/cinematography/after/presets-390.png) | [Explorer](screenshots/cinematography/after/explorer-390.png) | [Composer](screenshots/cinematography/after/composer-390.png) |

Builder screenshots are also included for all three widths in each phase. Automated measurements found no horizontal page overflow. The desktop Assemble action and every composer Apply action remained in the viewport. The builder's existing content panel retains its internal scrolling; this addendum does not claim a broader workspace-layout redesign.

## Security assumptions and remaining risks

This is bounded functional verification, not a security certification. Production dependency audit results do not prove all application behavior safe. Metadata validation, atomic add-only installation and record/hash comparisons provide specific evidence; a search for dangerous function names would not establish those properties.

Advice and equivalence matching are conservative, explainable heuristics, not complete natural-language interpretation. Unusual synonyms may still require manual review. Technical settings are planning descriptors; no external generator or physical equipment was exercised or controlled. Source layers/geometry are not inferred.

Firefox, WebKit and an actual screen reader were not tested. Automated keyboard, focus, roles, labels and responsive Chromium checks passed. Favorites/recents are presentation preferences in localStorage and are excluded from library backups. The large ZIP64 recovery certification and its separate draft PR remain outside this change. The broader Production Workspace UI Refinement brief was not supplied.

Actual user records, raw inventory evidence, browser profiles, backup/test ZIPs, credentials and temporary QA logs are excluded from the commit. Only source, tests, documentation and the explicitly identified synthetic PNGs are included. No PR is merged by this workflow.
