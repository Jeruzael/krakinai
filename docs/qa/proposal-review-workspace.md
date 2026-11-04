# Proposal Review Workspace QA

Local date: 2026-11-04, Asia/Taipei. Branch: `codex/proposal-review-workspace`. Base: `c85ea435d1a92b06e353f04282da81def6c06a0f`.

**Local verification passed.** The [machine-readable report](proposal-review-workspace-results.json) records the uncommitted tested-source fingerprint, commands, exact browser cases/skips, request/response call IDs and screenshot hashes. A signed feature commit, PR and final-head hosted CI are the next integration steps; no hosted success or merge is claimed here.

## Directly verified source facts

- [Review policy](../../src/domain/proposalReview.ts) uses a 24-hour absolute window. [MCP limits](../../src/domain/mcpProtocol.ts) retain one-hour sessions, 15-minute idle expiry, two-minute pairing and one-use 60-second Apply consent.
- [Review inbox](../../src/storage/proposalReviewInbox.ts) is a separate database, v1/one store, bounded to eight packages/10 MiB, with per-record 1 MiB package/64 KiB metadata limits. CAS revisions protect against stale-tab overwrites. Invalid content is quarantined. No main library database version, eight-store schema, storage/backup/export allowance or serializer was changed.
- [Broker](../../src/connections/proposalBroker.ts) restores content without session/approval authority. Explicit resumption/reconsideration/renewal rechecks current scope and source state. Candidate/manual choices are cached as hints and reset before fresh-session preview. Actual Stage B apply and its atomic authorization callback remain the save path.
- Recovery checks an exact actual ledger receipt and its current read permission. Cached `applying`/`applied` fields alone cannot establish success. A postcommit cache failure preserves the confirmed result; receipt replay never creates another scene.
- [Feedback](../../src/domain/proposalFeedback.ts) uses a transient session/epoch/package-specific sharing proof. Persisted sharing-history flags never authorize disclosure. All non-applied status paths recheck current scope, including legacy contracts. Feedback is optional metadata; all thirteen MCP tools and v1–v6 inputs remain supported.
- [Readiness](../../src/domain/proposalReadiness.ts) projects every finding into data conflicts, approval categories or advisories, with separate lifecycle requirements. Global/unknown findings remain under Batch. The [selected-item workspace](../../src/components/aiConnections/ProposalReviewWorkspace.tsx) shares existing detailed review components and final save guards.

These are source observations and specific test findings, not blanket security certification.

## Automated results

| Command / suite | Actual final result | Exit |
| --- | --- | --- |
| `npm test -- --maxWorkers=2 --minWorkers=1` (also JUnit reporter) | 201 files; **1,622 passed**, 0 failed | 0 |
| `npm run test:e2e -- --workers=2` | **251 passed, 18 explicit skips**, 0 failed/flaky; 269 cases; 652.55 s | 0 |
| `npm run typecheck` / `npm run build` | Both completed | 0 each |
| `npm audit --omit=dev` | 0 vulnerabilities | 0 |
| Isolated bridge build / bridge typecheck | Both completed; signed live helper not overwritten | 0 each |
| `npm --prefix bridge test -- --maxWorkers=1 --minWorkers=1` | 14 files; **74 passed** | 0 |
| `npm --prefix bridge audit --omit=dev` | 0 vulnerabilities | 0 |
| `dotnet run --project launcher/tests/Krakinai.BridgeLauncher.Tests.csproj` | **38 passed**, 0 failed | 0 |
| Installed-CLI/launcher evidence-validator Node tests | **87 passed**; exact ten-file command in JSON | 0 |
| `npm run test:qa` | 8 passed; historical ledger 207 checks/45 screenshots remains valid | 0 |
| Existing CI summary writer with final reports | 1,622 unit / 269 browser cases; **58,795 bytes**, below unchanged 64 KiB bound | 0 |

Runtime: Node 22.23.3, Playwright 1.64.1, Chromium 156.0.8078.4 (revision 1248). This is local Windows Chromium verification, not a hosted Linux/Windows CI claim. Warnings: existing Vite >500 kB chunk warning, React `act()` warnings in test output and Playwright's NO_COLOR/FORCE_COLOR warning. Production audits do not certify development dependencies or the whole application's security.

## Browser-tested behavior

All nine new cases passed in the complete final run: real persistent-profile restart/fresh scope/save/replay; local/shared feedback with denied scope; expired/unresolved 320 px inspection/download and explicit renewal; quota fallback/stale-tab CAS; 15-shot bulk review at 1440/768/390; active review-lock takeover rejection; eight-successes inbox cleanup; committed cache-failure receipt recovery; and a real delayed Stage B Apply protected from another authenticated tab's recovery/rejection/removal.

These use actual MCP SDK calls, authenticated synthetic relay transport, fresh retained Chromium profiles and trusted browser review controls. Each tool response is correlated to its request ID and response SHA-256. They are **not** new installed-Codex CLI or signed Windows native-pairing certification. All eighteen skipped test names and their exact gating reasons are in the JSON report; native/manual and frozen-build gates are not counted as passes.

Library snapshots and native media SHA-256 values are compared before submission and after approval. Review-cache writes are recorded separately; no production-library writes occur before approval. Existing source scenes, image/video outputs, asset associations, preferred takes and media hashes remain equal, with exactly one intended new scene in successful revision cases. The final browser report has 251 passes and no failures; all earlier failures remain retained separately.

## Failures retained and corrected

Initial browser attempts failed rather than being reclassified as passes. One checkbox assertion assumed synchronous persistence; queue re-entry helpers assumed an operation modal instead of the new selected workspace, and a reload case reused a still-active relay. Corrected harnesses retain the underlying assertions and use explicit fresh synthetic sessions.

Two product defects were reproduced with regression tests: rapid progress writes could overwrite earlier navigation fields, and recovery of a committed package passed empty approval choices into the existing ledger replay validator. The progress merge now runs inside the serialized write; recovery uses the real ledger's original choices with current receipt authorization. The actual postcommit-cache-failure browser test verifies a visible committed receipt, intact old records, an uncertain local hint after failure, receipt recovery after reload and no duplication.

The initial extended dialog test used the wrong existing close-button accessible name; correcting its selector produced 21/21 passing dialog/permissions tests. Earlier preview/mockup focus failures are documented in the approved design and remain separate from product results.

## Screenshots

All six images contain only fictional synthetic data. The old version was served from the clean base checkout on isolated QA port 4174; the current version uses QA port 4173. Neither uses the real localhost:5173 browser profile.

| Width | Before | After |
| --- | --- | --- |
| 1440 | [Before](screenshots/proposal-review-workspace/before-1440.png) | [After](screenshots/proposal-review-workspace/after-1440.png) |
| 768 | [Before](screenshots/proposal-review-workspace/before-768.png) | [After](screenshots/proposal-review-workspace/after-768.png) |
| 390 | [Before](screenshots/proposal-review-workspace/before-390.png) | [After](screenshots/proposal-review-workspace/after-390.png) |

For the same 33-operation/15-shot package, measured document heights were 1,255/1,679/1,868 px before and 900/1,113/1,501 px after at 1440/768/390 respectively. The desktop review workspace itself is 675 px high; its selected detail and navigator scroll independently. Mobile uses normal page scrolling and a labelled Issues/Approvals dialog. Full-page screenshots show complete documents, not a claim that all mobile content fits one viewport.

## Assumptions and remaining verification

Review storage relies on the same browser origin and device security as the existing local library. Cache deletion/eviction by the browser can remove review drafts; Download is the portable recovery option, and full-library backups intentionally exclude this cache. Browser `isTrusted` rejects synthetic DOM consent, but is not proof against a compromised OS, same-origin script, malicious extension or authorized desktop automation.

No real library/profile, global Codex configuration, live release, signing key, certificate trust or execution policy was changed. Read-only checks show Windows PowerShell (the native helper runtime) at LocalMachine AllSigned and the separate PowerShell Core tool shell at LocalMachine RemoteSigned. No QA profile cleanup/deletion was attempted; retained synthetic profiles, logs, caches and packages remain in ignored task/QA directories. The six reviewed documentation screenshots are the only generated visual artifacts intended for Git. Final local browser results/skips are recorded above. Signed SHA, PR and hosted CI remain separate integration steps and must not be inferred from local passes.


## Independent review and correction pass

One fresh independent reviewer read the entire working-tree change and all six screenshots. It requested changes for cross-tab active-Apply recovery, applied-inbox cleanup and the collapsed tablet detail area. Its two smaller findings covered duplicate failure alerts and malformed applying-record removal. All five were taken into a single correction pass; no second review is claimed.

- Apply/recovery/rejection/removal now cooperate through a same-origin exclusive Web Lock for the exact review ID. It is crash-releasing and requested without waiting, so another tab receives a clear wait/revalidate message. CAS still protects stored revisions; the lock confers no scope, consent or approval. Missing Web Locks fails closed for review lifecycle transitions and Apply; reading and Download remain available. Existing v6 saves already require Web Locks.
- Confirmed receipts retain original package Download and local Remove. An actual eight-successes browser run fills the inbox, proves the ninth admission is rejected, removes only a cached package and admits the ninth without deleting saved records.
- A compact page header reclaims desktop space. Tablet keeps a meaningful fixed detail viewport inside a normal-scrolling page, with sticky actions; tests require at least 180 px of actual detail content. The final 1440/768/390 screenshots replace the earlier cramped tablet capture. All three corrected screenshots were visually inspected.
- Failure feedback uses one precise alert with the save outcome. Fingerprint-matched malformed records may be explicitly removed without treating an invalid applying field as an active transaction.

The lock-takeover and layout regressions were observed failing. UI tests for missing receipt actions/duplicate alerts and the malformed-record test also failed before correction, then passed. The focused corrected run passed eight cases; the ninth real delayed-Apply case initially failed a stale receipt-picker fixture after the actual save safeguards had passed. Its corrected isolated run passed with a browser reload, fresh pairing and explicit exact-receipt permission. Native SHA-256 operations were delayed, never fabricated, to pause a real Stage B save after its applying claim. Another authenticated tab could not resume, reject or remove it; release allowed exactly one commit and authorized receipt recovery.

Actual expired/unresolved v6 inspection and Download also passed at 320 px. Automated keyboard/focus checks are not a claim of a manual assistive-technology audit; actual screen-reader announcements, virtual-keyboard behavior and system clipboard integration remain manual verification limits. Exact clipboard contents (including CRLF/trailing whitespace) are unit-tested; browser Download and saved output/hash checks are separate evidence.

## Implementation decisions

The final owner-signed checkpoint replaces repeated per-task signing because the configured SSH signer needs the owner's terminal; logical task evidence is retained. Task scratch/profiles remain available because cleanup deletion was not authorized. Cache sequencing is isolated from broker authority in a small helper. Cached choices are hints only; no synthetic trusted-event bypass was added for positive unit approval tests. Native/installed-CLI certification is not repeated because native helpers, transports, capabilities and live package are unchanged; their regression suites still run and manual-gated browser cases remain explicit skips. The new review lock adds a documented browser-support requirement rather than weakening crash recovery. No automatic live activation or merge is included.


## Final boundary and preservation checks

A valid operation named `batch` initially collided with the global Batch navigator. A failing UI/policy regression proved it; global navigation now uses an internal marker that cannot be a contract operation ID. No v1–v6 input schema changed. A separate regression exposed a generic message hiding a 64 KiB review-metadata failure; the exact reason and next action now remain visible without carrying any consent forward. Both regressions pass in the final 1,622-test run.

The complete prior serial browser run finished with 247 passes/18 skips/four failures caused by obsolete test helpers (old group counts or hidden-versus-drawer controls). Their corrected focused runs passed, followed by the complete final two-worker run with 251 passes/18 skips/no failures. No earlier failing call or attempt is substituted with a later success.

The existing Continuity screenshot suite regenerated sixteen tracked synthetic PNGs. Generated versions were retained in ignored QA storage before their known-clean baseline bytes were restored; those unrelated changes are excluded from this feature. The intended-file list in the JSON includes only source, tests, documentation, design/plan and the six reviewed synthetic screenshots. No profile, credential, signing material, native executable/helper, ZIP, runtime settings or temporary QA package is intended for Git. The actual main library, separate validation.ts work and PR #12 remain untouched.

Old-version proposals that were never persisted are not retroactively recoverable after their tab closes. Preserve their original JSON or request an exact resubmission before updating. This limitation does not affect existing saved library records or backups.
