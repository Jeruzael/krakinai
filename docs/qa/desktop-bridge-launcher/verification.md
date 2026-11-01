# Windows bridge launcher verification

Date: 2026-11-01 (Asia/Taipei). Source branch: `codex/desktop-bridge-launcher`, based on `20f964adf5eeae1e0093e282d7ffc0e8d12800e9`.

Status: local automated checks, source review and the final signed artifact's paired installed-CLI workflow passed. This is a precommit evidence snapshot; the signed Git commit and hosted run links are recorded separately in the PR and must be checked before merge. Native scaling/high-contrast limitations remain below.

## Direct source review

The new Windows launcher owns its managed Node host through a Windows job. Its protected channel supports the existing MCP tools; process controls remain in the native window and tray. Browser permissions, proposal review and the existing Stage B transaction remain responsible for data access and writes. There are no changes under application `src/storage`, `src/domain` or `src/types` in this feature.

The independent final review found two Important issues. Both were fixed and cleared on focused recheck:

- Settings could persist after tray Start changed lifecycle state. Persistence and assignment now share the controller's Start lock; modal Settings disables and guards lifecycle controls. Rejected/failed saves preserve active settings.
- A second MCP client's hello rejection lost `CLIENT_ALREADY_CONNECTED`. The adapter now correlates connection, request and generation before reporting a fixed diagnostic, and the native window receives the rejection. The first controller remains active. Existing tool error envelopes are preserved.

## Automated results

| Command/check | Result | Exit |
| --- | --- | --- |
| `npm test -- --maxWorkers=1 --minWorkers=1` | 1,118 passed; 128 files | 0 |
| `npm run typecheck` | Passed | 0 |
| `npm run build` | Passed; existing large-chunk warning | 0 |
| `npm audit --omit=dev` | 0 vulnerabilities | 0 |
| `npm --prefix bridge run typecheck` | Passed | 0 |
| `npm --prefix bridge test` | 50 passed; 11 files | 0 |
| `dotnet run --project launcher/tests/Krakinai.BridgeLauncher.Tests.csproj` | 23 passed | 0 |
| QA helper Node tests (CLI factory, reply/workflow/recipe correlation, release and TCP guards) | 49 passed | 0 |
| `npm run test:qa` | 8 passed; historical ledger remains 207 checks / 45 screenshots | 0 |
| `npm run test:e2e` serial rerun | 180 passed, 11 skipped, 0 failed | 0 |
| Isolated Windows x64 portable release packaging | Published; locked production dependencies audit: 0 vulnerabilities | 0 |
| `git diff --check` | Passed | 0 |

The 11 skipped browser cases require signed native verification/installed CLI acceptance. Their skips are not successes. The historical 207-check ledger is a separate report, not the current browser-test count.

The build reports a 1,067.89 kB main chunk (274.14 kB gzip), above Vite's 500 kB warning threshold. No threshold was changed.

### Earlier failures retained

An earlier concurrent application run passed 1,117 tests and failed the ensemble workspace's asynchronous `Participants (2)` lookup. The unchanged file passed 7/7 alone; the complete serial rerun then passed 1,118/1,118.

An earlier browser run passed 179 tests, skipped 11 and failed one 720px ensemble navigation with Windows `net::ERR_NO_BUFFER_SPACE`. The complete serial rerun passed all 180 enabled cases. No Windows network settings or unrelated processes were changed. The underlying transient OS/browser error was not independently diagnosed.

The new regressions were observed failing before their fixes. The settings persistence regression initially failed compilation because the atomic persistence overload did not exist. Initial follow-up runs also exposed a test matcher unavailable in this Vitest version and an expected filesystem denial type; these test corrections preceded the passing results above.

## Signed artifacts and manual observations

The original signed portable release is retained. A new candidate was created after the review fixes, and the owner signed only its hash-checked executable. Executable and verification helper were independently checked as Authenticode `Valid` under the approved public signer. No key was exported and no trust or execution policy was changed by this work.

| Artifact | SHA-256 |
| --- | --- |
| New executable before signing | `df774cb51bcb11f5314ec540956695404270ff3f01fe37db504e59b89597c51a` |
| New executable after signing | `e7fa8faa64ce203438bca22f6e8f5f201bfe8c65db5c4ab95c5356a2ed5bab0c` |
| Signed verification helper | `9da3e09687e6d95761513be7e61c8b07b6d114924d8852ea407a5fb694b97390` |

The earlier signed artifact demonstrated owner-operated Start/Stop, real SDK initialization, 13 registered tools, persistent SDK operation across Stop, and three consecutive TCP connection refusals after the owner's Stop action. Its peak observed working sets were approximately 96.5 MiB for the native process and 64.9 MiB for the owned Node host. These observations do not certify the final artifact's paired workflow or large-library memory usage.

The installed Codex CLI 0.73.0 completed an unpaired status-only call through the earlier production adapter. Its actual call ID and reply/argument hashes were recorded. This is not a paired proposal/import result.

The synthetic acceptance baseline was at `http://localhost:4173`, isolated from the real library at `http://localhost:5173`. It contained one fictional character, one immutable Direct Prompt scene, one decodable 1,509-byte synthetic PNG, one draft, two projects and the four built-in templates. The primary synthetic project has 15 shots. The approved test added one new scene revision. No real browser library is used.

Browser control was stopped by the owner's Escape key during the first final-artifact attempt. Native control automation also reported unavailable geometry/unusable window. Keyboard/scaling checks remain unfinished. That interrupted attempt did not advance past the human pairing gate. A subsequent attempt expired waiting for the manual observation; another actual CLI status call correctly exposed an empty scope after disconnect cleared permissions. Neither attempt was counted as a pass. The grants were visibly reapplied and verified before the successful fresh run below.

## Final signed native / installed CLI acceptance

The owner started the final signed native launcher and completed the real signed Windows verification window. The production persistent stdio adapter connected the actual installed Codex CLI 0.73.0 to one selected synthetic project. The isolated loopback SSE model fixture used no external AI provider credentials or global Codex configuration.

The successful run exited 0 after 12 model requests and 11 strictly correlated actual tool responses. Call IDs, argument hashes, reply hashes, actual saved IDs and digests are recorded in [cli-acceptance.json](cli-acceptance.json). No later response was substituted for an earlier failure.

| Call IDs | Actual behavior |
| --- | --- |
| 1–3 | Connected status has exactly the approved project; list/get expose that project and exclude the other project. |
| 4 | Submit one new scene revision; three complete snapshots prove no database writes after submission, preview and checked review controls. |
| 5–6 | After actual browser Apply, proposal status and import receipt return the same confirmed mapping/digests. |
| 7 | Identical retry returns the applied proposal; the complete saved snapshot is unchanged. |
| 8 | After actual browser Disconnect, status is disconnected without the old scope. |
| 9–11 | Project read, proposal status and submission each return the exact `PAIRING_REQUIRED` envelope without data. |

The browser's real Stage B transaction saved `scene_28b9381715ae`, preserving original `scene_faf8db8ade9d` byte-for-byte as a record. Its JSON SHA-256 before/after was `36f99c630ed486e63880f69550d9c205c98d33db400c3838d44e16ddaf535749`. The original remained the preferred take; the other 14 shots, excluded project, character, draft, templates and reference associations were unchanged. The new prompt preserved exact CRLF/Unicode/trailing-space bytes. Reference PNG SHA-256 before/after remained `89e8c1c8d608ad333a302e7098e18fccfb7276ee61094c1ea86dd8c54ad4a48b`.

Application reload preserved the complete committed snapshot. In the same isolated browser profile, `http://127.0.0.1:4173` had zero records while `localhost` retained the test library. This is origin-isolation and reload evidence, not a browser-process restart or a second full paired IPv4-origin certification.

After the actual CLI exited, three independent TCP probes received explicit refusal on its owned relay port, proving release of the owned listener. Timeouts would fail this check. The final native process's observed peak working set was 108,519,424 bytes; paired managed-host peak memory was not measured. Observation timings in the JSON include manual review time and are not performance benchmarks.

## Assumptions and remaining verification

### Hosted CI investigation and fixture follow-up

The first hosted run on signed commit `a0b4c6d9c15e91eeb0ff5d9b0afc8662d526e162` passed the complete Linux job. Windows failed 2/50 bridge tests: the first positive configuration-access probe stopped after 10,059 ms, and adapter startup closed after 10,508 ms. A Windows-only rerun reproduced those failures at 10,066/10,425 ms and additionally hit an oversized-HTTP `ECONNRESET` (47/50 passed). Neither failed attempt is a passing certification. Run: [41315170900](https://github.com/Jeruzael/krakinai/actions/runs/41315170900).

The guard intentionally reports one fixed error for process, deadline and ACL failures, so those logs alone cannot establish which underlying cause occurred. The CI-only follow-up creates an owner-controlled inheritable DACL on the fresh GUID fixture root, records fixed probe stage/ACL/process metadata without paths or raw stderr, and serializes all 50 Windows bridge tests. It does not change production checks, trusted identities, ten-second deadline, execution policy, signed artifacts or application code. The actual source probe is reused, with extra read-only diagnostic work; its timing includes instrumentation/cache effects and is not an identical production benchmark.

Local follow-up: instrumented probe passed in 573 ms with 14 trusted, non-reparse file/ancestor checks and no untrusted mutation rules; the complete serial bridge suite passed 50/50, and the expanded QA helper suite passed 52/52. The new diagnostic tests failed before implementation and then passed 3/3, including redaction and rejection of fabricated success output. The independent focused source review cleared this follow-up. Hosted confirmation, including the intermittent HTTP case and Windows native/build steps, is still required on the new signed head.

### Verification limits

- Local executable/build paths and the same Windows user are trusted. Same-user/administrator compromise and malicious same-origin scripts/extensions are outside the threat model.
- The executable signature does not sign adjacent JavaScript/dependencies. Release inventory hashes and locked dependencies must be reviewed alongside it.
- The full final-artifact paired workflow above was demonstrated at `localhost`; a separate full paired IPv4 configuration and browser-process restart were not demonstrated.
- Keyboard/modal focus, 200% native scaling and high contrast have not been fully demonstrated. Source accessibility labels and system colors alone are not equivalent to those tests.
- The installed CLI uses the SDK's legacy negotiation; explicit modern negotiation has not been certified. Global Codex desktop registration remains an owner-controlled setup step.
- Hosted Windows/Linux CI results must refer to the final Git-signed commit before merge.

## Data and artifact hygiene

No real library records, backup ZIPs, media, profiles, credentials, certificates or executable binaries belong in the commit. Local release folders, settings, generated reports and test profiles remain ignored. Existing live `bridge/dist` executable/helper hashes were checked unchanged. The separate `validation.ts` work and PR #12 remain outside this feature.

All earlier failures and test files are retained locally. An accidentally overlapping native screenshot was marked invalid and excluded from evidence; it must never be committed or uploaded. No disposable profiles were deleted. A first-ever .NET CLI invocation earlier printed its default development-certificate installation notice; subsequent commands used an isolated CLI home with automatic certificate generation disabled. No trust/signing/deletion command was run for that development-certificate observation.
