# Shot Blocking B — verification report

Status: local implementation and verification complete; owner-signed Git commit, pull request and exact-head hosted CI pending at this report snapshot. This report is not a merge or live-activation approval. Branch `codex/shot-blocking-spatial-continuity`, base `c3866116c5299cda4e0049b941ddabc17f569066`. The eventual PR checks and delivery comment will identify the signed head and hosted run links; this pre-commit report does not claim they have run.

## Source inspection

- [Shared validation](../../src/domain/blockingValidation.ts), [formatter](../../src/domain/blockingDocument.ts) and [comparison](../../src/domain/blockingContinuity.ts) own the typed rules and advisory spatial comparisons. The board is an editorial schematic, not a physical simulation.
- [Compatibility gate](../../src/components/LibraryCompatibilityGate.tsx) requires explicit consent before an existing v1 library opens for B writes. The header becomes 2 with the same eight stores; existing records are not rewritten. Old builds cannot reopen it. Cancel and blocked upgrades have separate tests.
- [Shared manual-output resolver](../../src/domain/blockingOutputReview.ts) requires a separate canonical/keep-exact-manual decision for every active manual mode. Kept text is labelled unverified. Saved sources remain immutable.
- [v5 patches](../../src/domain/blockingPatch.ts), [review projection](../../src/domain/blockingReview.ts) and [atomic application](../../src/storage/changeSets.ts) use exact source/head/project/revision/digest targets and existing transactional writes. A new take is distinct from a preferred-take change.
- [Permission projection](../../src/domain/blockingMcp.ts), [scope](../../src/domain/mcpScope.ts) and [proof-bound transport](../../src/connections/browserTransport.ts) require explicit B grants and fresh capability-aware pairing. New saved IDs do not inherit Blocking/Full grants. Legacy schemas remain supported.

## Automated results

Actual local command results, with Git delivery still pending:

| Check | Result | Exit |
| --- | --- | --- |
| `npm test` | 1,343 passed, 155 files; final standalone run, 98.65 seconds | 0 |
| `npm run typecheck` | Passed after correcting new test-only types | 0 |
| `npm run build` | Passed; index 1,166.69 kB minified / 302.91 kB gzip; existing chunk warning | 0 |
| `npm audit --omit=dev` | 0 vulnerabilities | 0 |
| `npm --prefix bridge run typecheck` | Passed | 0 |
| Bridge tests against isolated candidate | 67 passed | 0 |
| `npm --prefix bridge audit --omit=dev` | 0 vulnerabilities | 0 |
| `node --test scripts/qa/*.test.mjs` | 87 passed | 0 |
| `dotnet run --project launcher/tests/Krakinai.BridgeLauncher.Tests.csproj` | 38 passed | 0 |
| `node scripts/export-change-set-schema.mjs --check` | All exported schemas match | 0 |
| `npm run test:qa` | Historical ledger: 207 counted checks / 45 screenshots; separate from B | 0 |
| `npm run test:e2e` | 214 passed, 14 explicit native/manual skips, 0 failures/flaky; 228 cases, 15.1 minutes | 0 |
| Supplemental touch test | 1 passed with Chromium touch emulation; tap placement saves only the draft | 0 |
| Final screenshot recaptures | 1 inherited-manual SDK workflow and 4 viewport Continuity cases passed | 0 |

The 214-pass full run covered the final runtime source digest `69aa494fbc525e280ae204ed8cf73d3b7f799c241c732dfb6351a556dd7e9ab9` (266 files). Subsequent changes only added the explicit touch regression and made screenshot capture wait for the real responsive animation/restore the inspected panel's scroll position. Those six focused cases passed on the same runtime. The current committed suite will declare 229 cases including the new touch test; no 229-case whole-run result is claimed here. The 14 skips include B's two native-origin and one shared-launcher cases, certified separately below, plus eleven older opt-in native cases. Skips are never counted as passes.

React `act`, Playwright environment colour, the installed CLI's deprecation warning and build chunk warnings are retained, not treated as security evidence. The separate full dependency audit (including development tools) returned exit 1 with six advisories: three moderate, one high and two critical. Production audits remain zero; dependency lockfiles were not changed by B. No timeout or retry was raised to obtain these results.

## Browser-tested behavior and failed attempts

Authoring, Continuity, protected upgrade and small backup/restart tests ran on synthetic libraries. The SDK workflow demonstrates queued proposals, zero preapproval writes, explicit browser approval, immutable new takes, receipt replay, denied access after Disconnect, permission rejection, stale source/order rejection and late quota rollback. Exact totals, call IDs, hashes, screenshot paths and command exits are recorded in the [machine-readable report](shot-blocking-b-results.json).

The first broad browser diagnostic run recorded **201 passes, 13 skips and 8 failures**. It is not final certification: source changed during that diagnostic run. A new output-availability check incorrectly disabled a legacy viewer; an exact regression now limits the additional gate to Blocking. Legacy SDK discovery exceeded the QA transport's old frame bound; the application result limit remains unchanged. Subsequent focused runs and any remaining failures must be reported independently.

The second whole unit run recorded 1,335 passes / 1 failure. A deterministic delayed-save regression reproduced newer typing being replaced by an earlier completion. The fix preserves newer local fields and carries the returned revision into the next save. The later complete run passed all 1,337 tests; the failed run remains retained.

A later delivery unit run overlapped the full browser run and recorded 1,340 passes / 3 failures: two existing five-second UI timeouts and a subsequent camera assertion. The two files passed all 33 focused cases. After the browser finished, an unchanged standard `npm test` passed all 1,343 cases. Resource contention is a plausible explanation, not a proved root cause; the failed overlapping attempt remains in the evidence history.

The first manual signed-native IPv4 attempt paired successfully and reached the pending proposal through installed Codex CLI 0.73.0. It then failed on a harness label selector before Apply. No new scene was saved. The accessible combobox selector and exact inherited-manual review path are now exercised in SDK/browser smoke. This failed attempt is not counted as complete native acceptance.

The corrected **IPv4** and separate **localhost** runs each passed all **15 actual installed Codex CLI 0.73.0 calls**, correlated by their original IDs, names, arguments and reply hashes. They verify eight preapproval snapshot checks, explicit browser manual-mode/Blocking approval, one new immutable take, receipt2 retrieval, replay without duplication, denied new-scene text grants, Disconnect denial, exact old scene/reference/participant preservation, PNG SHA-256 and a full browser-process restart. Actual synthetic new IDs were `scene_4d8ae54629cf` and `scene_8d8e1ea8e3ae`; these are different libraries at different origins.

After the independent review fixes, both complete CLI origin cases passed again using the real signed helper and the existing Valid signed QA driver: **2/2 cases, 30 correlated actual CLI responses**, exit 0. These are automated native-window retests, separate from the earlier owner-manual pairing results. All five freshly rebuilt production bridge bundles were byte-identical to the signed candidate; native signatures were not overwritten. Windows PowerShell still reported AllSigned and the approved publisher was trusted.

The **shared signed launcher** run passed three actual installed desktop app-server calls using **0.166.0-alpha.5.1**, separately labelled from CLI 0.73.0. One client's departure preserved the second client's exact B read; final-client loss revoked pairing and stopped the relay. The library and media were unchanged.

Its first attempt failed a harness assertion of zero outbound attempts, after the read/departure checks completed. A standalone unpaired, zero-model-turn diagnostic reproduced four startup CONNECT attempts: `chatgpt.com` twice, `github.com` and `api.github.com`. All were refused by the local proxy. The corrected acceptance records these observations and rejects other destinations; its three actual turns used six loopback model-fixture requests. No external request was forwarded by the fixture. This is proxy-level evidence, not system-wide direct-egress monitoring or a claim about the purpose of encrypted CONNECT traffic. No external AI credentials were supplied, and no production guard was relaxed.

## Independent review and fix disposition

One fresh independent reviewer examined the complete staged change, strict schema producer, surrounding legacy paths, evidence and a mobile screenshot. It found three required fixes and no minor findings. No second reviewer was used.

- **P1 Notes disclosure:** new canonical v5 outputs could expose underlying ensemble role/performance notes when a sanitized manual parent Full was authorized but Notes remained off. The shared disclosure gate now checks these fields across all participants. Actual broker preview/pending-status canaries fail before the correction and pass afterward; enabling Notes restores the complete output.
- **P2 own autosave:** opening Blocking before the owner's save completed could capture an obsolete revision and strand the editor. Opening is now disabled only while that save is pending. The delayed-save regression proves a subsequent Blocking edit saves against the stored revision. Foreign-source protection remains strict.
- **P2 incomplete Direct Prompt planning:** the guided workspace now opens the shared editor on a transient working Recipe, retains a v5 planning package and resumes it without requiring a complete saved conversion first. Captured bindings and source proofs remain exact. Unit and actual browser download/reload/resume checks preserve the original/preferred take and show zero writes. Even all-content approval cannot create a scene while the required Environment is missing.

The original frozen browser run passed **213 cases / 14 explicit skips**, exit 0, before these fixes. The affected post-fix browser run passed **15/15**, followed by the complete **214-pass / 14-skip** run above. The reviewer did not independently rerun the reported suites; its read-only privacy reproduction and the executor's RED→GREEN regressions are recorded separately. There are no deferred minor findings. Review scope rulings, their reasons and costs are retained in the machine-readable report.

## Application screenshots

All **28 actual PNG files** exist; dimensions and SHA-256 hashes are in the machine-readable report. They contain synthetic data only. The before images came from the frozen base build, not the design mockup. Desktop content panels and short dialogs scroll internally; mobile uses page/dialog scrolling. Screenshots are visual evidence, not a substitute for interactive checks.

| Viewport / DPR | Before | After |
| --- | --- | --- |
| 1440×900 / 1 | [Builder](../screenshots/shot-blocking-b/before/builder-1440-dpr1.png), [Continuity](../screenshots/shot-blocking-b/before/continuity-1440-dpr1.png) | [Builder](../screenshots/shot-blocking-b/after/builder-1440-dpr1.png), [Editor](../screenshots/shot-blocking-b/after/editor-1440-dpr1.png), [Continuity](../screenshots/shot-blocking-b/after/continuity-1440-dpr1.png) |
| 768×1024 / 1 | [Builder](../screenshots/shot-blocking-b/before/builder-768-dpr1.png), [Continuity](../screenshots/shot-blocking-b/before/continuity-768-dpr1.png) | [Builder](../screenshots/shot-blocking-b/after/builder-768-dpr1.png), [Editor](../screenshots/shot-blocking-b/after/editor-768-dpr1.png), [Continuity](../screenshots/shot-blocking-b/after/continuity-768-dpr1.png) |
| 390×844 / 1 | [Builder](../screenshots/shot-blocking-b/before/builder-390-dpr1.png), [Continuity](../screenshots/shot-blocking-b/before/continuity-390-dpr1.png) | [Builder](../screenshots/shot-blocking-b/after/builder-390-dpr1.png), [Editor](../screenshots/shot-blocking-b/after/editor-390-dpr1.png), [Continuity](../screenshots/shot-blocking-b/after/continuity-390-dpr1.png) |
| 720×450 / 2 | [Builder](../screenshots/shot-blocking-b/before/builder-720-dpr2.png), [Continuity](../screenshots/shot-blocking-b/before/continuity-720-dpr2.png) | [Builder](../screenshots/shot-blocking-b/after/builder-720-dpr2.png), [Editor](../screenshots/shot-blocking-b/after/editor-720-dpr2.png), [Continuity](../screenshots/shot-blocking-b/after/continuity-720-dpr2.png) |

Supplemental desktop/mobile views: [empty 1440](../screenshots/shot-blocking-b/after/empty-1440.png), [empty 390](../screenshots/shot-blocking-b/after/empty-390.png), [off-camera 1440](../screenshots/shot-blocking-b/after/off-camera-1440.png), [off-camera 390](../screenshots/shot-blocking-b/after/off-camera-390.png), [manual-output review 1440](../screenshots/shot-blocking-b/after/manual-review-1440.png), [manual-output review 390](../screenshots/shot-blocking-b/after/manual-review-390.png), [incomplete planning 1440](../screenshots/shot-blocking-b/after/planning-1440.png), [incomplete planning 390](../screenshots/shot-blocking-b/after/planning-390.png). The first manual-review mobile capture caught the existing sidebar resize transition halfway through; the recapture waits for the transition and verifies the closed drawer is off-screen. No product CSS was changed for a screenshot.

## Security assumptions and remaining limitations

- Browser scope, native verification and cryptographic capability binding constrain bridge access; they do not protect against a compromised browser, Windows account or malicious code directly editing IndexedDB.
- Source/revision checks and atomic rollback protect the tested application write boundary. Spatial findings remain advisory and cannot prove visual continuity.
- Unsaved Blocking recovery is current-tab memory only; browser crashes/restarts can lose unfinished local edits.
- Existing large-library limits are unchanged. Small synthetic restore/hash tests do not certify near-limit ZIP64 recovery or alter PR #12.
- Older bridge endpoints with unreadable CORS errors fail closed for B. Scope-format changes require Disconnect and fresh native pairing.
- Owner-signed Git delivery and final-head hosted Linux/Windows CI remain required. The real localhost:5173 library, live launcher, global MCP settings, certificate trust and AllSigned were not used or changed for QA. Existing local public-certificate trust was checked read-only; the owner signed the isolated helper.
- Keyboard phase navigation, form labels, focus return, mobile reflow and emulated touch taps were exercised. NVDA/JAWS and physical touch hardware were not independently certified.
- Disposable profiles and test files remain in ignored QA locations; none are authorized for deletion or Git inclusion. No signing key or certificate file is included.

See the [user guide](../blocking-and-spatial-continuity.md), [v5 contract](../change-set-v5.md) and [approved plan](../superpowers/plans/2026-11-03-shot-blocking-spatial-continuity-b.md).
