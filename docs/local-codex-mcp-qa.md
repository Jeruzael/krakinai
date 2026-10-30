# Stage C QA evidence

The complete installed Codex CLI **0.73.0** revision workflow is verified at both real application origins below. Local acceptance is complete; review readiness is conditional on successful hosted CI for the final signed commit. PR #28 stays unmerged. Exact hosted revision/outcome is recorded by PR Checks and its runtime summary, avoiding a self-referential commit SHA in this document.

## Directly verified facts

This final acceptance follow-up changes QA fixtures, tests, CI evidence validation and documentation. Production application/bridge behavior is unchanged from c39ccd5. Across PR #28, the optional synchronous authorization guard is the only Stage B persistence change; manual callers keep their previous path. IndexedDB stores/version, assembler, snapshots, references, backup limits, Project Export and separate validation.ts work remain unchanged. PR #12 and the real browser library were not modified.

The actual installed CLI launches the production compiled stdio MCP entry directly. Every complete-workflow test uses a new child-only Codex home/config and synthetic Chromium profile. No real auth/config is copied; the model is the existing loopback SSE fixture. Native pairing uses the real signed Windows helper, not an injected verifier. Windows PowerShell 5.1 remains AllSigned; helper was re-signed after the bridge rebuild and both approved local signed copies verified Valid. No certificate identifiers, signatures, keys, profiles or raw QA records are committed.

Literal localhost acceptance uses **http://localhost:4173**, with the production --app-origin argument and real origin/CORS/native checks. The occupied port 5173 service did not match this source and was left unchanged. A second page at 127.0.0.1 in the same disposable localhost profile had zero scenes/collections; returning/reloading localhost preserved the new records. No claim is made about the user's 5173 library.

## Automated results

| Check | Actual result | Exit |
| --- | --- | --- |
| Root unit/component suite, four workers, JUnit | 706/706, 99 files, 100.25 seconds | 0 |
| Bridge suite | 18/18, 3 files | 0 |
| CLI evidence regressions | 23/23 | 0 |
| Full Windows Playwright suite | 147/147, 0 failed/flaky/skipped, 485.444 seconds | 0 |
| Root and bridge typecheck/build | Passed | 0 |
| Root and bridge production audits | 0 vulnerabilities each | 0 |
| QA reconciliation | 8/8; historical 207 checks / 45 screenshots ledger unchanged | 0 |
| git diff --check | No whitespace errors | 0 |

Raw command logs/JUnit/full Playwright JSON and CLI result/tool-message files are under ignored qa-results/local-mcp. Exact paths, hashes and per-call audit entries are in [the machine-readable ledger](qa/local-mcp-results.json). The 147 local browser cases include **five** real Windows/native cases. Linux CI runs 142 portable cases and explicitly skips 5 native opt-in cases; skips are not passes. Hosted CI also runs bridge 18 / evidence 23 / QA 8 and production audits.

Warnings retained: existing React act warnings, NO_COLOR/FORCE_COLOR warning, Vite mixed static/dynamic sceneAuthoring imports and 963.50 kB main-chunk advisory. Root installation also reports deprecated whatwg-encoding and six baseline development/test advisories. The full audit exits 1: 3 moderate, 1 high, 2 critical, affecting @vitest/mocker,esbuild,tinypool,nestedvite,vite-node,vitest. Root package/lock remain unchanged. Production audit 0 does not certify the test toolchain; exploitability was not assessed.

## Actual browser/installed-CLI acceptance

For each origin, actual native UI controls compare the compiled path, origin/relay and current verification code, transfer the key privately and exercise consent. Browser controls authorize only the synthetic MIDORI project and proposal submission. The installed CLI then completes nine actual MCP calls through stdio, across ten loopback model requests:

| Call ID | Tool | Required actual result |
| --- | --- | --- |
| synthetic_cli_read_1 | connection_status | Connected, exact one project, proposals granted |
| synthetic_cli_read_2 | submit_change_set | review_required; actual proposal ID/digest |
| synthetic_cli_read_3 | get_proposal_status | applied; confirmed new-scene receipt |
| synthetic_cli_read_4 | get_import_receipt | Exact same durable saved IDs/digests/operations |
| synthetic_cli_read_5 | submit_change_set | Same proposal applied; no duplicate |
| synthetic_cli_read_6 | connection_status | Disconnected; no old scope |
| synthetic_cli_read_7 | get_project | PAIRING_REQUIRED; no data |
| synthetic_cli_read_8 | get_proposal_status | PAIRING_REQUIRED; no data |
| synthetic_cli_read_9 | submit_change_set | PAIRING_REQUIRED; no data |

Each actual role:tool response is uniquely correlated by call ID **within its separate CLI evidence directory**, decoded and validated before the next tool/browser step. Receipt arguments derive from actual submission results. Assistant success strings, failed earlier calls, changed/swapped IDs, altered earlier replies and unrelated errors cannot certify success. After disconnect, denial fields/types/messages are constrained; RATE_LIMITED is rejected as revocation evidence.

Three full library-snapshot comparisons occur before Apply: after arrival, after opening preview, and after real consent controls immediately before Apply. All are unchanged. Actual browser review commits a new immutable scene through Stage B; its exact Unicode/CRLF Full text, revision parent/root/sequence, saved ID, durable receipt and appended take are checked. Every old scene and unaffected store/collection remains equal; preferred take and all seeded media SHA256 hashes remain equal. Retry preserves the entire approved snapshot with exactly one receipt. Actual browser Disconnect waits for authenticated revoke acknowledgement before the three denied CLI calls.

| Actual origin | Existing scene | New saved scene/receipt ID | Scene count | Matching receipts |
| --- | --- | --- | --- | --- |
| http://127.0.0.1:4173 | scene_d7967599dadc | scene_db5217a87f20 | 2 → 3 | 1 |
| http://localhost:4173 | scene_0ab1a2acd2b6 | scene_551630673dda | 2 → 3 | 1 |

Both cases have 3 no-write checkpoints and matching before/after old-scene/media hashes; the ledger preserves the actual values and all 9 reply digests. These are synthetic IDs and records, not user data.

The existing native cases also verify Allow/Deny and exact scoped CLI reads. The remaining portable browser coverage includes MIDORI 15 shots / 60 seconds, exact Full strings, scripted-DOM consent rejection, foreign-target rejection, receipt-only recovery after lost acknowledgement, revocation during digest, injected quota rollback, selected camera candidate creation, unchanged identity, draft/focus preservation and existing media/backup/golden outputs. Quota rollback is fault injection, not near-capacity disk certification.

## Failed attempts and independent review

- Initial RED: the old CLI fixture performed only reads; it did not satisfy revision acceptance.
- First implementation attempt: a new QA assertion used takes instead of actual takeSceneIds. Only the assertion changed.
- Independent review found a denied reply could carry unexpected data. Adversarial regressions failed before strict envelope/type/message validation; 23 evidence tests now pass. The reviewer confirmed the correction and reported no unresolved material findings.
- First full 147-case run: 145 passed / 2 failed / 0 skipped. The ninth rapid call hit the existing production burst limit. The checker correctly rejected RATE_LIMITED. The fixture now spaces tool emissions by 2100 ms to honor 30/minute, burst 8; production limits are unchanged. Both focused cases and the final complete 147-case run pass. All failed raw outputs remain retained.
- A subsequent run timed out during QA server readiness, with zero tests executed. Diagnostics showed retained QA HTML exports entering Vite dependency crawling. The QA server now scans only index.html and ignores QA artifacts for file watching; the dependency scan finished in 2491 ms, preserving the existing 60-second startup and 30-second test limits. One attempted run also correctly refused the still-running owned diagnostic server; it was stopped explicitly before the final run. Ordinary Vite config and retained files are unchanged.
- Earlier implementation review corrected receipt authorization for unmapped/removed operation targets and UIA Checked/Unchecked consent handling. Earlier cold-navigation/time-budget failures and misleading native-checkbox-green.json(exit1) remain explicitly identified in the machine ledger. No failed result is relabeled passed.

Seventeen synthetic after screenshots are regenerated under qa-results/local-mcp/screenshots; five exact-base manual-import before screenshots remain. All 22 files exist and current PNG dimensions/SHA256 hashes are recorded in the ledger. Four viewport layouts and 720 CSS/DPR2 reflow are covered. Previous representative desktop/mobile images were visually inspected; native key windows are never captured by the QA screenshot driver.

## Security assumptions and remaining risks

These functional tests exercise scope, consent, replay, expiry, transaction and revocation boundaries; they are not a security certification. Trusted OS/origin are assumptions. OS compromise, same-origin script compromise, malicious extensions and desktop automation are outside the boundary; isTrusted is not physical-human attestation. Loopback authentication is not TLS. Selected context can enter a configured model provider in real use, and releasing references is not forensic erasure. The loopback fixture certifies integration, not external model quality.

Actual Chrome/Edge profiles and non-Windows native pairing remain unverified. The six baseline test/development dependency findings remain. MCP preview deliberately returns intent rather than private global-match findings; the model must await browser review. Rebuilding the bridge requires re-signing its local compiled helper under AllSigned.

All explicit synthetic profiles, failed logs and signing copies remain ignored/retained; no cleanup was performed. Historical retention exception: early Playwright runs reset their default output directory, so some early runner contexts were not retained. Subsequent output paths are unique; no retroactive retention claim is made. The earlier artifact inventory in the ledger is labeled historical, not a current disk measurement.

## Complete PR file list

62 source/test/documentation/configuration files; no personal data, browser profiles, test ZIPs, credentials, signed binaries or temporary QA artifacts:

- .github/workflows/ci.yml
- bridge/build.mjs
- bridge/native/verify.ps1
- bridge/package-lock.json
- bridge/package.json
- bridge/src/admission.ts
- bridge/src/nativeVerifier.ts
- bridge/src/relay.ts
- bridge/src/runtime.ts
- bridge/src/server.ts
- bridge/test/browser-server.ts
- bridge/test/browserTransport.test.ts
- bridge/test/build.mjs
- bridge/test/relay.test.ts
- bridge/test/stdio.test.ts
- bridge/tsconfig.json
- bridge/vitest.config.ts
- docs/local-codex-mcp-qa.md
- docs/local-codex-mcp-signing.md
- docs/local-codex-mcp.md
- docs/qa/local-mcp-results.json
- docs/superpowers/plans/2026-10-30-local-codex-mcp.md
- docs/superpowers/plans/2026-10-31-stage-c-final-acceptance.md
- docs/superpowers/specs/2026-10-30-local-codex-mcp-design.md
- e2e/local-mcp-failures.spec.mjs
- e2e/local-mcp-fixture.mjs
- e2e/local-mcp-native.spec.mjs
- e2e/local-mcp-screenshots.spec.mjs
- e2e/local-mcp-workflow-native.spec.mjs
- e2e/local-mcp.spec.mjs
- playwright.config.mjs
- scripts/qa/mcp-before-screenshots.mjs
- scripts/qa/mcp-cli-replies.mjs
- scripts/qa/mcp-cli-workflow.mjs
- scripts/qa/mcp-cli-workflow.test.mjs
- scripts/qa/mcp-codex-cli.mjs
- scripts/qa/mcp-codex-cli.test.mjs
- scripts/qa/mcp-native-window.ps1
- scripts/qa/mcp-prepare-signing.mjs
- scripts/qa/serve-smoke.mjs
- src/App.tsx
- src/__tests__/aiConnections.test.tsx
- src/__tests__/mcpBroker.test.ts
- src/__tests__/mcpProtocol.test.ts
- src/__tests__/mcpScope.test.ts
- src/__tests__/mcpTransactionGuard.test.ts
- src/components/AiPlanningActions.tsx
- src/components/AppShell.tsx
- src/components/ImportReceipt.tsx
- src/components/McpProposalReview.tsx
- src/connections/AiConnectionContext.tsx
- src/connections/browserTransport.ts
- src/connections/proposalBroker.ts
- src/domain/aiContext.ts
- src/domain/mcpCrypto.ts
- src/domain/mcpProtocol.ts
- src/domain/mcpReads.ts
- src/domain/mcpScope.ts
- src/screens/AiConnectionsScreen.tsx
- src/screens/aiConnections.css
- src/storage/changeSets.ts
- src/types/mcp.ts
