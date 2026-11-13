# Import-history storage QA

> **Scope note (2026-11-13):** This QA snapshot predates the per-receipt expanded-evidence increase from 4 MiB to 50 MiB, the aggregate increase from 32 MiB to 96 MiB, and the full-backup manifest increase from 20 MiB to 100 MiB. The recorded boundary/resource results below verify the earlier 4 MiB per-receipt, 32 MiB aggregate and 20 MiB manifest caps; the new limits have not yet been run. The 8 MiB serialized-ledger cap remains unchanged.

Scope: the approved [import-history design](../superpowers/specs/2026-11-05-import-history-storage-design.md) and [implementation plan](../superpowers/plans/2026-11-05-import-history-storage.md). Local source verification uses synthetic libraries only. Live upgrade, real proposal revalidation, merge and launcher activation are separate actions.

The accompanying [machine-readable results](import-history-storage-results.json) record exact commands, sizes, hashes, response correlations and verification scope. Hosted Linux/Windows results must be checked against the final signed PR head; local results are not a claim that hosted CI ran.

## Directly verified implementation

| Area | Implementation and preserved behavior |
| --- | --- |
| Evidence | [importEvidence.ts](../../src/domain/importEvidence.ts): complete canonical UTF-8, zlib-wrapped DEFLATE/base64, declared byte length and SHA-256. Incremental bounded output; strict native readback rejects corrupt, truncated and trailing data. No prompt summaries or evidence truncation. |
| History | [changeSetLedger.ts](../../src/domain/changeSetLedger.ts): protected storage ledger v4, mixed legacy receipts retained exactly, 8 MiB serialized ledger, 50 MiB per-receipt and 96 MiB aggregate expanded evidence limits. The preceding QA run verified 4 MiB per receipt and 32 MiB aggregate; 1,000 receipts and 250 combined candidates remain independent limits. No retrospective compaction or pruning. |
| Atomic save | [changeSets.ts](../../src/storage/changeSets.ts): verify/snapshot current history and encode evidence before the write transaction. At the transaction boundary compare the exact history token, re-plan, verify reviewed content, scope, revisions, IDs and capacity, then commit records and receipt together. Replay uses one consumptive authorization check and appends nothing. |
| Compatibility | [libraryCompatibility.ts](../../src/storage/libraryCompatibility.ts): explicit database-header upgrade to v4; the same eight object stores, without rewriting records. [LibraryCompatibilityGate.tsx](../../src/components/LibraryCompatibilityGate.tsx) requires acknowledgement of a saved pre-upgrade backup. Old tabs may block the upgrade; cancellation preserves the previous version. Older builds cannot reopen the upgraded library. |
| Backups | [backupFeatures.ts](../../src/domain/backupFeatures.ts), [backup.ts](../../src/storage/backup.ts): required `compact-import-evidence.v1` feature; verify evidence before replacement. Compact-only history retains original media/poster checksums and capacity reservations. Legacy backups remain readable. The current full manifest limit is 100 MiB; this snapshot only exercised 20 MiB. Project Export is still 128 MiB. Other media/archive and independently verified restore limits are unchanged. |
| Browser | [ImportCapacity.tsx](../../src/components/ImportCapacity.tsx): current/prospective storage, expanded evidence, counts and backup metadata. Manual imports put the check inside scrollable approvals; incoming proposals use the readiness rail/mobile Issues dialog. Unknown totals are labelled unavailable. Final Apply rechecks rather than reserving space. |
| MCP | [importBatchChecks.ts](../../src/domain/importBatchChecks.ts), [proposalBroker.ts](../../src/connections/proposalBroker.ts), [mcpReads.ts](../../src/domain/mcpReads.ts): additive allowlisted `batchChecks` for preview/submission/status. A derivable frame can still report a blocked batch. Public receipt versions remain logical v2/v3; private evidence/history totals are not disclosed. Change-set v1-v6 inputs, grants and tools are unchanged. |

No dependency, signed launcher/helper, global MCP registration, certificate trust or execution-policy change is part of this patch. The owner's separate `src/domain/validation.ts` is unchanged.

## Automated verification

| Final command/suite | Exit | Actual result |
| --- | ---: | --- |
| `npm test` (two workers, JSON/JUnit reporters) | 0 | 1,656 tests, 210 files; 298.83 s |
| `npm run typecheck` | 0 | No TypeScript errors |
| `npm run build` | 0 | Built; warnings retained below |
| App and bridge `npm audit --omit=dev --json` | 0 each | 0 vulnerabilities each |
| `npm --prefix bridge test` | 0 | 74 tests, 14 files |
| `npm --prefix bridge run typecheck` | 0 | No TypeScript errors |
| Launcher core `dotnet run` harness | 0 | 38 passed, 0 failed |
| Explicit Node helper list + resource sampler | 0 | 89 passed, 0 failed |
| `npm run test:qa` | 0 | 8 tests; historical ledger: 207 checks / 45 screenshots |
| `npm run test:e2e` | 0 | 262 passed, 18 skipped, 0 failed/flaky; 1280.12 s |
| Independent Python ZIP reader | 0 | 4 archives verified |
| Local CI summary generator | 0 | Complete actual reports fit unchanged 64 KiB bound |


Exact final totals and command exit codes are in the results JSON. The complete app, bridge, launcher-core, helper, browser and historical QA-ledger suites are separate counts, not an aggregated invented check total. Historical reconciliation still describes 207 checks and 45 screenshots; it does not describe the current Playwright suite.

Unit/storage regressions cover exact/over-limit stored and expanded bytes, all independently exceeded limits, unchanged legacy receipts, Unicode/high-entropy evidence, malformed framing/hash, async input mutation, concurrent history writes, stale state, permission rejection, compact-receipt write failure rollback, one-shot replay authorization, backup corruption, legacy formats, protected upgrades and checksum reservation.

Warnings are retained: React test `act(...)` diagnostics, Vite mixed static/dynamic-import notices and the existing large-chunk advisory; Playwright's inherited `NO_COLOR`/`FORCE_COLOR` notice. These are not suppressed or counted as failures. No test timeout, assertion or production guard was weakened; retries remain zero.

## Browser-tested behavior

The committed [browser cases](../../e2e/import-history.spec.mjs) run in isolated synthetic Windows Chromium profiles, with authenticated real MCP SDK calls and actual browser review controls. They do **not** use the installed Codex CLI or signed native verification window; no new native acceptance or AllSigned certification is claimed.

- A 30-operation v6 batch adds 15 Recipe takes with 33 complete still-image prompts and separate video prompts near the 8 MiB history ceiling. Before browser approval the production library snapshot and observed writes remain unchanged. Existing scenes, drafts, media and every old receipt remain unchanged after the intended additions. Restart, renewed authorized receipt read and exact retry preserve the result without duplicates.
- An exactly full history permits individual frame derivation but returns `LEDGER_CAPACITY` in actual preview/submission/status responses. The owner sees the same blocker; Apply stays disabled and records remain unchanged.
- Exact 8 MiB stored history passes an atomic append and full backup/restore. Exact 32 MiB expanded evidence and one 4 MiB high-entropy receipt pass export, validation, replacement and exact snapshot comparison. Extra receipts/bytes are rejected. Both aggregate ceilings survive actual Chromium process restart.
- Manual import Review controls remain mouse-accessible, storage details remain reachable, keyboard consent works and unconfirmed Apply stays disabled at 1440, 1280 and 390 pixels. Incoming-review screenshots cover 1440, 768 and 390 pixels.
- A 65,238-byte opaque expansion fixture representing 64 MiB of repeated bytes is rejected 27 times. It is an adversarial byte fixture, not playable media or a valid prompt. A fresh browser realm observes typed-array constructors captured by fflate before import; this supplements callback and OS-process observations.

The [independent reader](../../scripts/qa/verify-import-history-archives.py) uses Python `zipfile`, `zlib` and `hashlib`, independently of fflate. It checks all four synthetic archives, ZIP CRCs, strict stream consumption, manifest/ledger/evidence limits, evidence SHA-256, media/poster hashes and frame counts. Full measurements and archive/source hashes are in the results JSON; test ZIPs stay ignored.

Each tool result is correlated by **connection phase and request ID**, with the SHA-256 of its actual response. IDs restart after reconnect. A later success is not proof that an earlier call succeeded. The synthetic SDK correlation records (IDs, tools, received/success flags and response hashes) are retained locally and allowlisted in hosted CI artifacts; these records are not full response-body transcripts.

## Resource observations

| Case | Stored ledger bytes | Expanded evidence bytes | ZIP bytes | Observed process working-set sum | Duration |
| --- | ---: | ---: | ---: | ---: | ---: |
| stored-8MiB | 8,388,608 | 8,386,577 | 13,762 | 652,210,176 bytes (622.00 MiB) | 3.109 s |
| expanded-32MiB | 50,850 | 33,554,432 | 4,650 | 575,963,136 bytes (549.28 MiB) | 4.089 s |
| high-entropy-4MiB | 4,652,881 | 4,194,304 | 3,599,064 | 781,545,472 bytes (745.34 MiB) | 30.091 s |

Near-limit 15-take/33-frame prepare/Apply: **903,487,488 observed bytes (861.63 MiB)** across 8 samples, 4.333 s. Its final ledger is 8,382,325 bytes. The actual MCP/browser case's new receipt is 151,958 stored bytes for 1,715,608 evidence bytes; its final mixed ledger is 8,382,337 bytes.


Results JSON records exact bytes, durations, sample counts and browser version for each case. The sampler sums owned Chromium process working sets on Windows (RSS on supported Unix hosts), requests 500 ms samples, settles in-flight work and includes a final sample. This is an observed aggregate, not unique physical RAM, total-system peak or an allocation proof.

The tested 32-byte-declared expansion case observed a largest decoder backing buffer of 524,288 bytes and 247,940 callback bytes before rejection. With a 4 MiB declared output, that output buffer was allocated once; other observed decoder buffers reached 655,360 bytes, callback output reached 264,192 bytes, and cumulative constructor bytes were 27,119,571 per rejected attempt. Cumulative allocations are not simultaneous resident memory. These bounds describe this tested fixture, not every possible DEFLATE stream or JavaScript-engine allocation.

The representative 15-shot prepare/Apply measurement uses the Stage B storage API and is labelled separately from the actual MCP/browser-approval workflow. Large-history processing can use substantial memory; compression does not make the application a streaming whole-library backup engine. No near-limit media or ZIP64 capacity certification is implied.

## Failed attempts and corrections

Failures remain in the ignored QA workspace; they are not relabelled as passes:

1. Initial compatibility/receipt assertions failed after the deliberate storage version change. Logical receipt comparison was corrected without rewriting the frozen legacy output baseline. Preliminary full app run: 1,640 passed / 5 failed.
2. A fixture replacement-string mistake expanded dollar sequences; corrected literal generation then exposed a real base64-regex stack overflow on valid 4 MiB high-entropy input. Flat alphabet checking plus canonical base64 verification fixes it; bounds were not raised.
3. An async mutable-ledger proof regression failed; snapshotting before verification fixes it.
4. Independent final review identified double-use of replay consent, a compact-only media/poster checksum downgrade and omitted in-flight resource samples. Each correction has a failing-then-passing regression. Decoder allocation and representative Apply observations were added. Synthetic JSON/PNG evidence is now retained by CI; profiles, ZIPs and secrets are excluded.
5. A concurrent heavy app run timed out six tests (1,648/1,654 passed). Final app verification uses two workers with unchanged assertions/timeouts. An earlier browser run cancelled after 130 passes is not a completed run.
6. The first complete post-review browser run returned exit 1: **257 passed, 18 skipped, 2 timed out** (277 total, 19.9 minutes). A traced diagnostic reproduced both failures (14 passed / 2 failed). Trace hit-testing proved the new top-level capacity card squeezed manual review buttons under the footer. Moving it inside the existing scrollable approvals panel fixes the introduced regression. Both original cases and three new reachability cases passed (5/5, 22.4 seconds), without forced clicks or increased timeouts. The complete corrected rerun is recorded separately in results JSON.

## Security assumptions and remaining risks

- Existing authenticated browser ownership, explicit permissions and human approval remain the security boundary. Integrity, privacy, permission, stale-state and rollback tests provide scoped evidence; no area is labelled “SAFE” from a source search. This is not a comprehensive security audit.
- New compact evidence requires strict native `DecompressionStream('deflate')`. Unsupported engines fail closed. This change is demonstrated in pinned Chromium on Windows and by hosted CI when linked; Firefox, Safari, low-memory devices and near-limit original media are not certified here.
- The 8 MiB physical, 50 MiB per-receipt and 96 MiB aggregate expanded limits are bounded allowances, not unlimited capacity. Existing receipts are not recompressed or discarded; some high-entropy batches can still exceed a per-receipt, aggregate, count or backup-metadata allowance. The actual owner's blocked batch must be revalidated after an approved live upgrade; no real-library success is claimed.
- Deferred minor UI issue: a prior “Fits current preview” capacity label can remain visible while recalculation fails/is pending. Apply remains independently disabled or revalidated, so that text is not a save authorization or space reservation.
- An exploratory bulk **existing-take multi-revision** fixture exposed the existing `KEYFRAME_PREPARATION_STALE` dry-pass/project-revision mismatch after the first revision. The certified bulk path creates new Recipe takes (`scene.create_recipe`), matching the blocked workflow. This patch does not claim to fix unrelated multi-revision planning.
- The protected v4 upgrade has no in-place downgrade. Save the pre-upgrade full backup first; returning to an older build requires a separate compatible profile/address. Merge, live upgrade and retrying the real proposal still require their separate owner actions.
- Ignored synthetic profiles, traces, generated test ZIPs and raw reports remain under `qa-results/` and this plan's `.superpowers/sdd/2026-11-05-import-history-storage/` workspace. They have not been deleted or committed. Previously tracked screenshots regenerated by unrelated tests are preserved in ignored evidence and restored to their original Git contents, not included in this patch.

## Hosted verification and job-budget follow-up

The initial signed implementation is `60979d86ca65bb4d5705a6521ed1103a1b6d406e`, PR #41. [Run 41913799875](https://github.com/Jeruzael/krakinai/actions/runs/41913799875) was superseded when a PR-description link correction emitted the configured `edited` event; it is not counted as a completed verification run.

In [replacement run 41914083090](https://github.com/Jeruzael/krakinai/actions/runs/41914083090), Windows completed successfully: 74 bridge tests, 38 launcher-core tests and 36 lifecycle guards. Linux's substantive steps all reported success: 1,656 app tests, 70 bridge passes / 4 platform skips, 88 helper passes / 1 platform skip, 262 browser passes / 18 explicit skips, both typechecks, build, production audits, historical QA and all four independent archive readbacks. Its browser suite took 16.4 minutes; cold Chromium installation took about 5 minutes 11 seconds. The resulting import-history, summary and UI artifacts uploaded successfully.

The Linux job and workflow nevertheless concluded **cancelled**, approximately 25 minutes after job setup. That matches the configured 25-minute job budget, so inadequate completion headroom is the diagnosis inferred from the timing; the connector does not expose the cancellation annotation. This run is **not** labelled green. The CI-only follow-up increases this overall job allowance to 35 minutes, retaining every command, individual test timeout, assertion, permission, artifact allowlist and application limit. The final signed-head CI conclusion and artifact links are reported separately in the PR evidence comment.

The hosted dependency install also reports six development-tree advisories (3 moderate, 1 high, 2 critical) and a `whatwg-encoding` deprecation. Production-only audits report zero vulnerabilities. This patch changes no dependency manifests or lockfiles and does not claim to remediate those development advisories. A nonfatal Playwright Git metadata fetch exceeded its three-second deadline; explicit checkout/runtime logs still record the exact tested commit above.

## Visual evidence

[Incoming review — 1440px](screenshots/import-history-storage/review-1440.png) · [768px](screenshots/import-history-storage/review-768.png) · [390px](screenshots/import-history-storage/review-390.png)

[Manual review — 1440px](screenshots/import-history-storage/manual-1440.png) · [1280px](screenshots/import-history-storage/manual-1280.png) · [390px](screenshots/import-history-storage/manual-390.png)

All images are synthetic application UI, with no native pairing key window. Existence, dimensions and SHA-256 are recorded in the results JSON.
