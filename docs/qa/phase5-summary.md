# Phase 5 browser QA reconciliation

Canonical local result: **207 counted checks passed** across Stages A–D. These are isolated Chromium runs, not GitHub CI checks.

| Stage | Counted checks |
| --- | ---: |
| A | 41 |
| B | 46 |
| C | 59 |
| D | 61 |

Stage A is 36 main checks plus five separate two-tab checks. The QA task brief cited an earlier Stage C count of 56; the current Stage C document and retained final machine-readable run record 59. The 56-check intermediate JSON is not available, so the exact three additions cannot be established by a direct diff. Stage D's 61 comprises 60 main checks and one consolidated label follow-up; its 13 granular follow-up assertions are recorded in the ledger and excluded from the 207 total.

**Screenshots:** 45 nonempty PNGs: nine baseline, nine A, six B, twelve C, nine D. The [JSON ledger](phase5-summary.json) lists every check name and screenshot filename, byte count and SHA-256, plus SHA-256 for each raw result JSON. The raw files and screenshots remain outside Git. Raw screenshots and result JSON contain no embedded Git commit SHA; reported stage commit associations are historical claims rather than cryptographic proof.

Historical runs were not all clean. Stage C had an asynchronous navigation wait increased to five seconds after a load-sensitive timeout; the final 270-test suite passed with 22 React `act(...)` warnings. Stage D had interim 297, 306 and 308-test passes and transient fixture type errors before the final 309-test pass, also with 22 React `act(...)` warnings. The warnings and interim outcomes are not counted as browser assertion failures.

Regenerate from the retained local evidence with `node scripts/qa/reconcile-results.mjs --evidence <directory>`. Validate this committed, sanitized ledger without local evidence with `node scripts/qa/reconcile-results.mjs --check`.
