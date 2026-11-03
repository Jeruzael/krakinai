# Workstream C — Multi-Frame Image Prompt Studio QA

Local date: **2026-11-04, Asia/Taipei**. Base: `e3012123647d9989a923936090102fadd58378a5`. Feature branch: `codex/multi-frame-prompt-studio-c`.

**Status: local corrections and independent evidence review complete; owner-signed commit and complete hosted CI pending.** This report does not claim a signed feature commit, hosted CI, PR approval, merge or live bridge activation. The [machine-readable results](multi-frame-image-prompt-studio-c-results.json) record the actual command results, artifact hashes and per-call native evidence. This local report describes an uncommitted source tree; later hosted results must identify their exact signed head.

## Directly verified source facts

- [Canonical image assembly](../../src/domain/imagePromptDocument.ts) is separate from [video assembly](../../src/domain/promptAssembler.ts). Shared frozen Recipe identities, wardrobe/environment selections and explicit still states contribute to each frame; arbitrary motion text requires a still adaptation/omission. Full text is bounded and rejected on overflow, never truncated.
- [The shared frame validator](../../src/domain/keyframeValidation.ts) keeps global shape/ID/order/timing checks, while assembly checks the selected frame's readiness. A deliberately unfinished Middle remains unresolved without preventing valid Start/End text. Direct Prompt planning does not masquerade as complete Recipe assembly.
- [The database writer](../../src/storage/db.ts) guards Output mutations by the expected draft revision and advances ordinary C draft revisions, including plan creation/removal. The three Output controls retain their local edit after a conflict. Removing the whole/last plan omits dependent C maps. No diff exists for the user's separate `src/domain/validation.ts` file.
- [Compatibility](../../src/storage/libraryCompatibility.ts) explicitly enables protected header3 with the existing **eight** stores. It does not backfill/rewrite existing scene records. Genuine older builds fail to reopen an upgraded library for writes.
- [Stage B apply](../../src/storage/changeSets.ts) remains the atomic save path. Prepared hashes/decoding happen outside the transaction; exact source/head/revisions, current media, scope and browser-owned consent are rechecked at save. Old immutable takes and unrelated frames are retained. Local image transfer uses the same save transaction.
- [v6](../change-set-v6.md) adds targeted frame/image/video-review operations, scope3 and receipt/ledger3. V1–v5 remain supported. The MCP allowlist stays thirteen tools. A new scene or receipt does not grant its image/video text. A compiled discovery-schema factoring change is lossless and covered by actual SDK negotiation.
- [Image history](../../src/storage/frameImages.ts) retains original files and exact take/frame associations. Upload/carry-over starts needing review. Carry-over requires explicit approval; clears preserve retained history/media reachability.
- Full backup required-feature/checksum handling and C Project Export retain complete reference associations. Flow handoff requires explicit selected files/exclusions and manual external generation. Existing media/backup/entry/Project Export limits remain unchanged. These source observations are not blanket security certification.

## Automated results

| Command / suite | Actual result | Exit |
| --- | --- | --- |
| `npm test -- --maxWorkers=2 --minWorkers=1` | 193 files; **1,556 passed**, 0 failed | 0 |
| `npm run typecheck` | No diagnostics | 0 |
| `npm run build` | Production build completed | 0 |
| `npm audit --omit=dev` | 0 vulnerabilities | 0 |
| `npm run test:qa` | Historical Phase5 ledger valid: 207 counted checks / 45 screenshots | 0 |
| `npm --prefix bridge run build` / `build:test` / `typecheck` | All completed | 0 each |
| `npm --prefix bridge test` | 14 files; **74 passed**, 0 failed | 0 |
| `npm --prefix bridge audit --omit=dev` | 0 vulnerabilities | 0 |
| `dotnet run --project launcher/tests/Krakinai.BridgeLauncher.Tests.csproj` | **38 passed**, 0 failed on completed rerun | 0 |
| The ten committed CI QA-helper files, including the C validator | **87 passed**, 0 failed, 0 skipped | 0 |
| `npm run test:e2e` | Complete attempt: 235 passed / 7 failed / 18 gated skips | 1 |
| Corrected affected files, with their own server and frozen pre-C build | **21 passed / 0 failed / 0 skipped** | 0 |
| Exact file / complete title path / project reconciliation | **260 distinct cases: 243 verified passes / 0 unresolved failures / 17 gated skips** | Script 0 |

The bounded-worker app command runs the complete suite. Its 414.58-second local duration is not a product performance benchmark. Historical ledger checks are a separate dataset, not the current browser-test count. Native/manual skips in automated CI are never added to local native acceptance passes.

Warnings: existing React `act(...)` diagnostics in component tests; Vite's existing >500 kB chunk advisory (largest minified app chunk 1,352.91 kB); Playwright/Node `NO_COLOR`/`FORCE_COLOR` warning and slow-test notices. None is hidden by changing warning thresholds.

The first bridge run was 73 passed / 1 failed because an older exact schema-list assertion stopped at v5. The assertion now explicitly includes v6 and the complete bridge suite passed. The first launcher run stopped at 25 passed / 1 SocketException (“Only one usage of each socket address…”); no production change was made, and the full rerun passed38. Both failed logs remain retained.

## Browser-tested behavior

Task14's pre-review-fix current-product run passed **22/22**, with zero skips, including native image decode/Web Locks, permissions, approval/replay, stale state, injected transaction/quota failure, genuine old-reader rejection, full restore and clipboard/download checks. Earlier failures remain recorded: attempt1 10/18, attempt2 12/18, layout attempt3 2/6. They revealed route/selection loss, fixed-panel clipping, accessible-label issues and Windows clipboard newline conversion; corrected assertions preserve complete text and actual browser APIs.

The complete run included all existing cases plus the four new Output review regressions. Seven failures came from old v5-only SDK schema lists, the renamed Video Prompt panel, legacy images now collapsed, and a label locator rather than the actual textbox role. Those expectations were corrected without weakening preservation/approval assertions. All seven cases passed the owned-server recheck. An earlier concurrent recheck passed14 then failed5 when its shared server shut down; it remains a failed infrastructure attempt.

The machine reconciliation uses full suite title paths, file and project keys; it does not add 235 and21 or drop earlier failures. It also includes the frozen pre-C reader case, previously gated in the complete run. This **does not relabel the original full command exit1 as exit0**. Hosted CI must still run the complete corrected suite on the signed head. Focus, keyboard-only controls, mobile reflow and DPR2 checks use actual synthetic app screens; they are separate from the approved design mockups. Automated accessible-name/focus checks do not constitute a full assistive-technology audit.

Windows clipboard: the exact `navigator.clipboard.writeText` argument is checked and then sent through the original API. Native readback normalizes LF to CRLF; that platform conversion is compared explicitly. UTF-8 downloads are compared byte-for-byte. No claim of byte-identical native Windows clipboard storage is made.

## Installed Codex and signed native acceptance

Both origin runs used the **actual installed Codex CLI0.73.0**, production stdio entry, signed Windows verification helper, disposable persistent Chromium profiles, real browser review controls and isolated loopback SSE model fixture. No external AI credentials or provider generated content was used. Native origin/code/path/key confirmation was completed by the owner. Synthetic proposal review/Apply was exercised through actual browser controls by the authorized QA runner; this is not a claim that a human reviewed production content.

| Case | Result |
| --- | --- |
| `127.0.0.1:4173`, first native run | 17 exact call-ID-correlated replies passed; CLI exit0; independent validator exit0. Browser source predates the four review fixes. |
| `localhost:4173`, final native attempt3 | 17 exact replies passed; CLI exit0; independent validator exit0; post-fix source. |
| Both-origin SDK preflights | Passed independently of native certification; real browser scope/contributors and atomic save checks, injected verifier explicitly distinguished. |
| Shared desktop / production persistent adapter | Actual installed desktop Codex0.166.0-alpha.5.1; two clients, three exact calls; one departure preserved read access, final departure revoked pairing and stopped relay; no library/media change. |

The native scenarios verify source/preview, denied submission before proposal permission, no writes before Apply, a new immutable take with one Middle frame and targeted Blocking Action change, receipt/retry, full browser restart, explicit receipt recovery grant, denial of ungranted new frame text, explicit exact-frame grant, actual complete saved text/hash readback, Disconnect and denied reads/submission. Original Start/End prompts, old scenes, preferred take, assets and media hashes remain exact. The validator rejects missing/swapped/duplicate call IDs, fabricated success prose, wrong receipts/hashes, extra writes/grants and a later success substituted for an earlier failure.

All five final compiled production bridge `.mjs` files are byte-identical to the signed test candidate. The unchanged launcher and C helper are Authenticode **Valid**; Windows PowerShell5 effective and LocalMachine policy remain **AllSigned**. Source review confirmed that final local browser/localhost-native coverage plus both-origin SDK and unchanged bridge bytes are the relevant recertification for these app-only fixes; the retained IPv4 run is explicitly not relabelled post-fix.

Failed native attempts are not passes. Localhost attempt1 paired with legacy/empty grants and stopped on its first actual response before submission. Attempt2 passed ten calls and saved one valid synthetic scene, then the QA restart helper searched Home for the bridge address and failed. The navigation setup was corrected and regression-tested before attempt3. Initial SDK preflights also failed on fixture selection/patch/grant mistakes; strict production rules were retained.

During the shared test the owner closed the launcher. Automatic reopening was rejected with “blocked by policy”; no alternate-tool bypass was attempted. The owner reopened the exact synthetic configuration manually and the test passed. Four installed-client startup CONNECT attempts to known hosts were denied by the fixture/proxy, none forwarded; only fixture/proxy traffic was observed, not system-wide direct egress.

## Archives, screenshots and review

Independent Python `zipfile` readback checked CRCs, media SHA-256 and exact text in three small synthetic archives:

| Archive | ZIP bytes | Uncompressed bytes | Entries | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Full backup | 13,675 | 130,675 | 3 | `b2d2afbc8cc0decee1c6af9dfbd39d0150dd70a3e2ff1fb9d104388d8e559c78` |
| Project Export | 48,586 | 214,897 | 31 | `a6a9417a9cb497229023b6761f4eec22207acd891d5a84e8a8565b2323a00fc5` |
| Flow handoff | 8,261 | 19,055 | 8 | `1052a7bf2409e25739d001ed659612848b3dfbbff63e9d89c91167802aac8964` |

The verified screenshot inventory contains **8 before + 12 after** product captures at 1440, 768, 390 and 720/DPR2, with actual file/hash checks and separate CSS viewport/physical pixel dimensions. The frozen pre-C fixture covers original video/document bytes, v1–v5 schemas and real v5 receipt/replay. It passed in the complete app suite. These small fixtures do not certify maximum archive capacity.

One independent whole-change review found four Important defects. Seven reproducing regressions failed before the fix. The consolidated fix pass and 42-test focused run passed; the same reviewer independently reproduced the corrected behavior, verified all delta hashes and confirmed generated v6 schema equality. All four findings are resolved. The same reviewer verified final documents, all34 raw call audits, reconciliation, screenshots, signatures and independent archive samples. No unresolved material source/evidence findings remain. Complete hosted CI on the signed head remains required.

## Security assumptions and remaining risks

Browser scope/approval, trusted application code, local certificate validation and cooperating origin Web Locks are required. An authorized desktop automation tool, hostile same-origin code/DevTools, compromised OS or malicious extension is outside that boundary. SHA-256 payload checks detect corruption, not a malicious manifest's authenticity. Memory release is best effort.

Large legacy-Blob WebCrypto peak memory is unmeasured; backup retains its existing buffering path and no new maximum-capacity claim is made. PR #12 and its restore certification are separate. No external Flow upload/generation, account/region eligibility or provider timing guarantee was tested. Local Chromium acceptance does not certify every browser/OS/screen reader. Unsaved recovery is current-process/tab memory; save a draft for durable recovery.

Real `localhost:5173` profiles, live bridge processes, global Codex settings and real library records were excluded. Synthetic profiles, raw CLI logs, ZIP fixtures and failed attempts remain retained under ignored QA/workspace paths; no deletion was performed. Signing keys/certificates, profiles, local settings, credentials and temporary archives are excluded from the feature commit. The [complete changed-file inventory](multi-frame-image-prompt-studio-c-files.json) records reviewed modified/new paths. Final signed-head CI links are still required before handoff.

User instructions: [frame workflow](../keyframes-and-image-prompts.md) · [v6 contract](../change-set-v6.md) · [Recipe-first agent guide](../agent-authoring-guide.md).

Product captures: [before desktop](../screenshots/multi-frame-image-prompt-studio-c/before/output-1440-dpr1.png) · [Image Frames desktop](../screenshots/multi-frame-image-prompt-studio-c/after/after-frames-1440-dpr1.png) · [Image Frames mobile](../screenshots/multi-frame-image-prompt-studio-c/after/after-frames-390-dpr1.png). All20 paths and hashes are in the machine report.

Final staging normalized CRLF line endings in9 new source/fixture files. The initial staged whitespace check returned2; the corrected check returned0. All15 built app files and all5 production bridge entries are byte-identical before/after normalization, and40 focused legacy/authoring/guard tests passed. No prompt escapes, media bytes, signed helper or launcher were changed.
