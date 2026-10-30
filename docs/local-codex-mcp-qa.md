# Stage C QA evidence

Status: portable implementation plus **three isolated signed Windows native/installed-CLI cases verified**. PR #28 remains draft and unmerged for review. Full-suite evidence and its failed attempts are distinguished below. This report does not infer safety from function-name searches.

## Directly inspected facts

- Browser IndexedDB version/stores and all backup/restore/export limits are unchanged. `validation.ts`, assembler logic, immutable scene implementation and PR #12 are outside this patch.
- The only production persistence change is the optional synchronous authorization guard in the existing Stage B writer. Manual callers omit it and use their previous path.
- The production CLI hardwires Windows verification. The injected verifier is a separate test entry built outside production `dist`.
- Exact tool schemas reuse Stage B's parser/schema. There is no MCP approval/apply endpoint. Disclosure controls and session credentials are held in memory.

## Automated results

- Fresh follow-up root suite: **706/706**, 99 files, exit **0**, 101.47 seconds with four workers and JUnit (`qa-results/local-mcp/native-followup-unit.xml`). Earlier plain/JUnit runs are retained as historical evidence in the machine ledger.
- Bridge tests: **18/18**, three files, exit **0**; real SDK initialization/list/call/EOF, strict HTTP/crypto/session tests and real HTTP browser-transport tests. Separate injected verifiers are identified as test dependencies.
- Root/bridge typechecks and builds: exit **0**. Vite warns that `sceneAuthoring.ts` has both static and dynamic imports and that the main minified chunk is **963.50 kB**, above its 500 kB advisory threshold. These warnings are retained.
- Production dependency audits: root and bridge each **0 vulnerabilities**, exit **0**.
- Root installation exited **0** but reported **6 advisories: 3 moderate, 1 high, 2 critical**, plus deprecated `whatwg-encoding@3.1.1`. A separate full `npm audit --json` reproduced those counts with exit **1**. The affected baseline test chain is `@vitest/mocker@2.1.9` (moderate), `esbuild@0.21.5` (moderate), `tinypool@1.1.1` (critical), nested `vite@5.4.21` (high), `vite-node@2.1.9` (moderate), and `vitest@2.1.9` (critical). Root `package.json` and `package-lock.json` are unchanged from master. These are npm advisory classifications; exploitability was not assessed and no dependency upgrade was attempted in this scoped feature.
- `npm run test:qa`: **8/8**, exit **0**. Its historical Phase 5 ledger remains **207 canonical checks / 45 screenshots**; those are not the Stage C browser-test or screenshot totals.
- Full Playwright before the final extra candidate case: **141 passed / 1 native skipped**, exit **0**. The next 143-case run had **141 passed / 1 failed / 1 skipped**, exit **1**: the existing deferred-candidate case exceeded 30 seconds at initial `page.goto`, before fixture initialization. Its focused rerun passed in 28.6 seconds; no existing test timeout or application code was changed for this observation. The final warmed complete run passed142/142 executable cases, with1explicit native skip, exit0. Raw failed/full results are retained separately.
- That sequential run also reached the same 30-second total limit, this time at the candidate dialog. QA readiness now warms the module graph before `/__qa_ready` returns success. The unchanged case then passed in **4.1 seconds** (41.8 seconds including cold server startup). Ordinary development configuration and the 30-second browser-test budget are unchanged. The full warmed run completed with142passed/1native skipped, exit0; both failed attempts remain recorded.
- Baseline before this feature: 661/662, one existing five-second timeout in `dialogueCompatibility.test.tsx` multiline/save/ZIP case. Focused baseline rerun 3/3 passed; subsequent full runs passed without changing that test. Existing React `act` warnings were present before this patch. Playwright also reports the `NO_COLOR`/`FORCE_COLOR` environment warning.
- Hosted CI is verified after the signed push. Exact-head run links and the runtime-generated `summary.json` are supplied in the PR and final handoff; local tests above ran against the uncommitted working tree.

## Browser-tested behavior (isolated synthetic profiles)

The real SDK, actual compiled Node runtime and Chromium application completed a 15-shot import through trusted browser review clicks: exactly 60 seconds, shot types 2 Character / 9 Property / 4 Graphic, four pending original inputs and exact Full strings. Scripted DOM approval was rejected. Preview/submission/retry made no library writes. A created project remained unreadable until explicitly selected.

Shot 05 revision retained its exact Unicode/CRLF/whitespace, original immutable snapshot and existing preferred take. A foreign-project target was rejected. The SDK process was killed before receiving a committed receipt response; reload/re-pair and an explicit receipt-only grant recovered the exact saved IDs without granting project access or duplicating records.

Additional checks exercised revocation while package hashing was paused, injected quota failure after initial writes with complete transaction rollback, unsaved Direct Prompt/focus preservation on background arrival, and disconnect-dialog focus restoration and read revocation. Quota failure is **fault injection**, not evidence of a real near-disk-capacity test. Existing manual-import, media, backup and golden-output regressions are included in the final full browser run.

The extra candidate-only MCP package installed exactly the camera candidate explicitly selected in browser review, returned its actual asset ID, left the Character candidate pending and existing identities unchanged, and did not silently grant access to the new asset. Before/after revision text and dialog focus were checked in the actual review UI. SHA-256 of every seeded original media blob matched after import, revision and recovery.

Seventeen after screenshots exist under ignored `qa-results/local-mcp/screenshots/`: disconnected/connected/review/applied at 1440×900, 1366×768, 768×1024 and 390×844, plus 720 CSS pixels at DPR2 (200% equivalent reflow). No horizontal page overflow was observed. Desktop and mobile review screenshots were visually inspected; an initial capture caught a mobile sidebar transition, so the capture now waits for the closed sidebar and disables screenshot animations. Before screenshots use an exported copy of exact base `6530c0e`, a separate loopback QA origin/profile and the previous manual import workflow. The reproducible driver is `scripts/qa/mcp-before-screenshots.mjs`; final file counts/hashes are recorded in the machine ledger.

## Independent review and correction

A fresh whole-patch reviewer reproduced one P2: a historical mixed project update/candidate review could expose an unmapped candidate operation ID. Authorization now checks **every disclosed operation target**, including unmapped and removed targets. Two real-planner/read-path and removed-shot regressions failed before the fix and pass afterward. The reviewer inspected the correction and confirmed the demonstrated issue resolved; the reviewer did not run the suites or inspect profiles.

The pairing instructions were corrected to transfer the key before Allow closes the native window. The remaining minor is deliberate preview-tool conservatism: MCP receives input intent and the requirement for human review; complete validation findings stay in the browser to avoid leaking global duplicate-match information. The model must await browser review for apply readiness.

## Actual CLI and native Windows results

Follow-up: **3/3 passed**, zero skipped/failed, exit **0**, 63.788 seconds including cold server startup. Raw `qa-results/local-mcp/native-strict-final.json`. Fresh root/bridge typechecks, root and bridge builds, bridge18 tests, both production audits and QA8 checks passed. Seven new CLI-evidence regressions also passed and are required in CI. Previous full portable runs below are historical; the current CI suite has142portable cases plus3explicit native opt-in cases.

The **installed npm Codex CLI 0.73.0** invoked `mcp__krakinai__krakinai_connection_status` through the production SDK stdio launcher. Exit **0**, two loopback model-fixture requests, `connected:false`, no unexpected external proxy requests. A dedicated child-only configuration/home was used; real auth/config was not copied or changed. This was the initial unpaired proof; the strict paired follow-up is documented below. Neither proof certifies a remote AI model. Raw result: `qa-results/local-mcp/cli/5993a442-245d-4e20-93f2-ef9cec506089/result.json`.

Initially the unsigned native scripts were rejected by Windows PowerShell5.1 AllSigned (exit1). The owner then created a local code-signing certificate and explicitly approved adding only its public certificate to CurrentUser Root/TrustedPublisher and signing the compiled helper and ignored QA driver. Both signatures verified Valid in a fresh Windows PowerShell process. No machine trust store, execution policy, private-key export, global Codex configuration or actual user browser data was changed. Signed copies/certificate identifiers are excluded from Git.

Real testing exposed an accessibility defect: UIA Toggle raises Checked but not Click, so the original Click-only consent handler left Allow disabled. The actual Windows control probe returned Checked=true, ClickEvents=0, CheckedEvents=1. A failing native regression was observed before changing the helper to Checked/Unchecked handlers. The driver now verifies unchecked/checked/unchecked/checked button states and waits for the owned verifier process to exit before browser confirmation; the production Node verifier still requires exit0 and the matching challenge. Four post-signing failed attempts are retained in the machine ledger, including the misleadingly named native-checkbox-green.json whose actual exit was1.

The final native suite verifies: Allow only after checked consent; Deny rejects even the correct captured one-time key, leaves reads blocked and preserves records; actual installed CLI0.73.0 performs connection_status/list_projects/get_project via the direct production launcher and signed native window. Each named response is correlated by call ID, must succeed, the listing must contain exactly the selected project, and the unrelated project ID must never appear. The library snapshot and media SHA256 hashes remain equal. Actual paired CLI evidence: qa-results/local-mcp/cli/e20dc714-d8b5-49df-82e3-5637e630e84d/result.json. The SSE model fixture and proxy remain loopback-only; no external AI provider/auth files/global configuration are used.

Independent review caught a QA acceptance gap: the first checker could accept a failed listing when the final project read succeeded. That condition is now rejected by seven focused regressions; the reviewer rechecked the correction and confirmed it resolved. The final real three-case native suite passed again with strict checking. Playwright Chromium is tested; actual Chrome/Edge profiles and non-Windows native verification remain unverified.

## Security assumptions and remaining risks

The baseline development/test dependency advisories above remain unresolved. Zero findings in `npm audit --omit=dev` applies only to production dependency audits and is not a clean audit of the whole toolchain.


Scope/replay/epoch/MAC/expiry tests exercise the implemented boundaries; they do not prove absence of vulnerabilities. Local OS compromise, same-origin JavaScript compromise, malicious extensions and desktop automation are outside this bridge's protection. `isTrusted` is not physical-human attestation. Loopback authentication does not encrypt traffic. Selected context may enter Codex's configured model provider. Secrets are released from application references on disconnect but forensic memory erasure is not guaranteed.

Native acceptance is now verified for the isolated Windows setup; the PR remains draft and unmerged pending owner review. No actual browser library/profile was used. Explicit persistent QA profiles remain retained. **Retention exception:** early reruns used Playwright's established default `test-results` output directory, which Playwright resets, so earlier runner error contexts were not all preserved. This was acknowledged and corrected: each subsequent run now uses a unique ignored `qa-results/playwright-runs/<time>-<UUID>` directory. No explicit profile cleanup or real record deletion occurred. Archived raw failures, signing copies and profiles are excluded from Git.

The checked-in machine-readable ledger is `docs/qa/local-mcp-results.json`. It records local evidence; exact hosted revisions are bound by GitHub's runtime summary and PR checks. The complete changed-file list and retained artifact measurements are provided with the final verification.

## Implementation decisions

| Decision | Reason | Cost or limitation |
| --- | --- | --- |
| Execute the approved plan inline without another approval menu | User explicitly approved implementation | One independent whole-patch review rather than a reviewer per task |
| Retain this plan's ledger, profiles and QA files | User prohibits cleanup/deletion | Retained disk usage; runner retention exception disclosed above |
| Deny creation of a new standalone MCP scene without an authorized project | New records need an explicit authorization target | Manual import remains the standalone fallback |
| Use asynchronous SHA-256 cursor stamps | Reuse existing canonical hashing rather than a weak cursor fingerprint | Paging includes a digest await and a session/scope recheck |
| Pass fresh transaction state to the synchronous guard | Scope membership can change after preview | Small synchronous authorization work before the first write |
| Keep real Windows tests opt-in and injected-native CI separate | User-approved local signatures satisfy AllSigned without bypassing it | Linux CI skips3native cases; real Windows3/3 is a separate measured run |
| Cap unparsed TCP connections at 32 | Per-body limits do not bound incomplete connections | New connections can be rejected during saturation |
| Use unique runner output directories | Playwright's default reset replaced earlier error contexts | More retained disk usage; no retroactive recovery claim |
| Wait for QA module warmup and do not reuse arbitrary servers | First cold navigation consumed the interaction test budget | Cold startup occurs before tests; an occupied QA port fails explicitly |
| Capture the before UI from an exported exact Git base | Preserve all existing checkouts and browser profiles | Retain a baseline source archive and a separate synthetic profile |
| Keep Stage C draft and unmerged | Owner review is still required; isolated Windows native3/3 now verified | Functional acceptance is not a general security certification |

Deferred minor: the MCP preview tool reports requested intent; complete findings remain in browser review. This avoids a global duplicate-match oracle but gives the model no automatic apply-ready verdict.

Latest local totals:706root unit/component,18bridge tests,3native Windows cases,7CLI-evidence regressions and8QA reconciliation tests passed. The earlier full portable run was142passed/1native skipped; current Linux CI has142portable cases and3explicit native skips, with the exact outcome bound by its runtime artifact. Artifact figures below are the earlier local-QA snapshot, not a live disk inventory:15791files /1098274543bytes excluding linked dependencies,53explicit profiles plus the baseline profile.22local screenshots exist with hashes in the machine ledger.

Complete intended changed-file list (57files; source/tests/docs/config only):

- `.github/workflows/ci.yml`
- `bridge/build.mjs`
- `bridge/native/verify.ps1`
- `bridge/package-lock.json`
- `bridge/package.json`
- `bridge/src/admission.ts`
- `bridge/src/nativeVerifier.ts`
- `bridge/src/relay.ts`
- `bridge/src/runtime.ts`
- `bridge/src/server.ts`
- `bridge/test/browser-server.ts`
- `bridge/test/browserTransport.test.ts`
- `bridge/test/build.mjs`
- `bridge/test/relay.test.ts`
- `bridge/test/stdio.test.ts`
- `bridge/tsconfig.json`
- `bridge/vitest.config.ts`
- `docs/local-codex-mcp-qa.md`
- `docs/local-codex-mcp-signing.md`
- `docs/local-codex-mcp.md`
- `docs/qa/local-mcp-results.json`
- `docs/superpowers/plans/2026-10-30-local-codex-mcp.md`
- `docs/superpowers/specs/2026-10-30-local-codex-mcp-design.md`
- `e2e/local-mcp-failures.spec.mjs`
- `e2e/local-mcp-fixture.mjs`
- `e2e/local-mcp-native.spec.mjs`
- `e2e/local-mcp-screenshots.spec.mjs`
- `e2e/local-mcp.spec.mjs`
- `playwright.config.mjs`
- `scripts/qa/mcp-before-screenshots.mjs`
- `scripts/qa/mcp-codex-cli.mjs`
- `scripts/qa/mcp-codex-cli.test.mjs`
- `scripts/qa/mcp-native-window.ps1`
- `scripts/qa/mcp-prepare-signing.mjs`
- `scripts/qa/serve-smoke.mjs`
- `src/App.tsx`
- `src/__tests__/aiConnections.test.tsx`
- `src/__tests__/mcpBroker.test.ts`
- `src/__tests__/mcpProtocol.test.ts`
- `src/__tests__/mcpScope.test.ts`
- `src/__tests__/mcpTransactionGuard.test.ts`
- `src/components/AiPlanningActions.tsx`
- `src/components/AppShell.tsx`
- `src/components/ImportReceipt.tsx`
- `src/components/McpProposalReview.tsx`
- `src/connections/AiConnectionContext.tsx`
- `src/connections/browserTransport.ts`
- `src/connections/proposalBroker.ts`
- `src/domain/aiContext.ts`
- `src/domain/mcpCrypto.ts`
- `src/domain/mcpProtocol.ts`
- `src/domain/mcpReads.ts`
- `src/domain/mcpScope.ts`
- `src/screens/AiConnectionsScreen.tsx`
- `src/screens/aiConnections.css`
- `src/storage/changeSets.ts`
- `src/types/mcp.ts`
