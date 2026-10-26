# Phase 4 pre-merge Preflight corrections

Verified 2026-10-26. Scope: `src/domain/scenePreflight.ts`, regression cases in `src/__tests__/scenePreflightMika.test.ts`, and this report. No persistence, schema, identity source, prompt assembler, export, reference-pack, backup or dependency implementation changes.

## Corrected behavior

- **P001 / Review:** The actual Mika eye-contact action combined with `Position the camera about 135 degrees from the subject's forward axis, toward the left-rear side.` now produces a review finding. The additional matcher requires an explicit camera-placement instruction and a left/right-rear side/view/angle. It does not infer rear placement from 135 degrees alone or from clothing details. Comma-linked placement stays together for negation checks. The shared rear-composition predicate also keeps existing P007 visible-speech checks consistent with P001.
- **P004 / Information:** `High-craft stylized 3D feature animation` paired with an explicit photorealistic direction produces an informational creative-choice finding. Negated/quoted style examples and generic 3D feature animation alone do not activate the additional matcher.
- **P005 / Review only for unmatched names:** `Mika` matches `Mika / Base Identity`. Matching uses NFC normalization, whitespace/case folding and removal of only a known trailing `/ Base Identity`, `/ Master Identity` or `/ Character Identity` label. No surname removal, accent removal, prefix matching, arbitrary slash splitting or persisted aliases are introduced. Maya/Mika, Mika/Mika Santos, Mika/Mikaela and ambiguous slash titles still produce review notes. Existing voiceover/off-screen exemptions remain.

The original evidence strings are displayed without rewriting. Findings remain advisory except existing confirmed validation/compatibility blockers. Inputs are not mutated.

## Test-first evidence

36 new actual-Mika regression cases: before the fix, 10 failed and 26 passed (exit 1), including independent P001/P004/P005 failures. After the fix, all 36 pass. Existing Preflight/dialog coverage also passes (47 total focused tests). Cases include left/right-rear, negated placement before/after the comma, front three-quarter, quoted examples, non-camera rear details, negated gaze, stylized video, non-stylized 3D, normalized matching names and distinct/ambiguous names. The combined case checks exact evidence/severity, deterministic findings, unchanged input, Project JSON and assembler output.

## PR #4 branch verification

| Command | Exit | Result |
| --- | --- | --- |
| `npm test` | 0 | 126 tests / 18 files |
| `npm run typecheck` | 0 | No diagnostics |
| `npm run build` | 0 | Production bundle 416.11 kB JS / 119.26 kB gzip |
| `git diff --check` | 0 | No whitespace errors |
| Focused isolated Chromium | 0 | 21 checks / 3 screenshots, 1440/768/390, no page errors |

Browser checks exercise Builder and Output, original evidence/severities, same/different speaker, scene-only camera/style corrections and negation, advisory assembly, saved Narrative and Project JSON bytes, keyboard focus/trap/restoration, unchanged library identities/associations/saved scene, original media SHA-256 and validation of the unchanged synthetic backup. The script waits for asynchronous navigation after assembly before checking the destination.

The PR #4 full run emitted eight existing asynchronous MediaThumbnail React `act(...)` warning entries. Typecheck/build had no warnings; browser runs had no uncaught page errors.

## PR #5 integration verification

Parent correction commit `15cc0dfaf6d5c9e2955a7479a0cfbb10f02dc17b` was merged locally into the existing child branch, preserving its previous history. One adjacent function-signature conflict was resolved by retaining the new helpers and the child's optional referencePack parameter. P008 still checks explicit reference-pack entries. Comparing the corrected module against the parent shows only those two pre-existing Stage B differences.

| Command | Exit | Result |
| --- | --- | --- |
| `npm test` (final standalone run) | 0 | 162 tests / 23 files; eight existing MediaThumbnail React `act(...)` warning entries |
| `npm run typecheck` | 0 | No diagnostics |
| `npm run build` | 0 | Production bundle 435.74 kB JS / 125.21 kB gzip; no warnings |
| `git diff --check` / staged check | 0 | No whitespace errors |
| Focused isolated Chromium | 0 | 22 checks / 3 screenshots, 1440/768/390, no page errors |

The initial PR #5 full test run, concurrent with build/typecheck/browser work, exited 1 because the existing dialogue persistence flow exceeded its five-second test timeout (161 passed, one timed out). Its raw log is retained. The unchanged complete suite passed on a standalone rerun without increasing timeouts or changing that test. This remains a timing-sensitive harness limitation under load.

Stage B browser checks additionally verify that the frozen approved anchor and selected reference pack survive Preflight inspection and that the complete saved scene, including metadata/outputs/pack, is unchanged. Across both branches, 43 focused browser assertions and six screenshots are recorded.

Raw test-first logs, command logs and browser scripts/results/screenshots are outside Git in the task's `preflight-corrections` visualization directory. Tests use synthetic records and disposable Chromium contexts, never the user's profile.

## Preservation and risks

The separate original-checkout `src/domain/validation.ts` change is excluded; its SHA-256 before and after correction work is `71fe000636779be90ba52d22565b56d82aadbdd14ae2a5e1e45d4078d2e14dee`. Both PRs stay open. Incorporating the parent branch into the child branch preserves the existing PR #5 commits and optional pack handling without rewriting history or merging a PR.

Preflight remains incomplete deterministic pattern matching. It does not infer camera geometry, identity aliases or external model behavior. Unknown title suffixes can still receive a speaker-review note. No external generation or live screen-reader audio was tested. The existing master-only GitHub Actions filter does not trigger on these stacked PR bases; local gates are recorded separately.
