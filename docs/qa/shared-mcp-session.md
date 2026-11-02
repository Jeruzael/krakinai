# Shared MCP session QA — local acceptance

Date: 2026-11-02. Feature branch: `codex/shared-mcp-session`. Base: `73b6cb6b4acf94e066506f9a638be891a3f7bdc8`.

Signed native / installed-Codex acceptance and the separate two-chat desktop availability smoke passed locally. Hosted CI on the final signed Git commit remains pending. Keep the feature PR unmerged.

## Directly verified implementation

- `launcher/Core/LauncherPipeServer.cs`: eight admitted peers plus one rejection/handshake slot; server-owned routes; initialized membership serialized through final-client Stop; per-peer cancellation and coalesced five-second status writes. Existing same-user/session/elevation/executable checks remain in use.
- `launcher/Core/HostRequestLedger.cs` and `ManagedNodeHost.cs`: sixteen aggregate admitted operations; dispatched work retains its credit after the caller leaves; fifteen-second caller wait and twenty-second forwarded-work health deadline with a 250 ms monitor cadence. Started shared writes use host lifetime rather than caller cancellation.
- `launcher/Core/FrameQueueBudget.cs`: one eight-MiB broker outgoing allowance shared by native peer writers and the owned host writer. This is a queue bound, not a total-memory claim.
- Native client count stays outside the exact `krakinai.launcher.v1` wire schema. The existing thirteen model-visible tools and settings format 1 remain unchanged. Initialization cannot Start the host.
- Application changes are confined to connection-help text. Storage, assembler, scene snapshot and backup implementations are unchanged in this diff.

## Automated evidence

Local command logs are retained in the ignored, plan-scoped `.superpowers/sdd/2026-11-02-shared-mcp-session/` directory. Synthetic runtime files remain ignored under `qa-results/` and `bridge/qa-results/`.

| Check | Actual result at this checkpoint |
| --- | --- |
| Native baseline | 23 passed, exit 0 |
| Updated native harness | 38 passed, exit 0 |
| Bridge Vitest suite | 54 passed, exit 0; Windows single-worker configuration |
| Application Vitest suite | 1,118 passed in 128 files, exit 0 on isolated rerun |
| App / bridge typecheck | Both exit 0 |
| App production build | Exit 0 |
| QA helper tests, including shared workflow/client validators | 72 passed, exit 0; startup-cleanup, owned-session teardown and first-import receipt regressions selected in Windows CI |
| Historical QA reconciliation | 8 tests passed; 207 counted checks / 45 screenshots, exit 0; historical evidence, not new shared-session browser acceptance |
| App / bridge production audit | Both exit 0, zero production vulnerabilities reported |
| Full synthetic browser suite | Final rerun: 180 passed / 11 explicitly skipped, exit 0; 698,946.449 ms; zero unexpected failures or flaky cases |
| Hosted GitHub Actions on feature head | Not run; signed commit pending |

The initial concurrent application run had 1,117 passes and one five-second timeout in the unchanged `dialogueCompatibility` test. A later full run under concurrent acceptance/transport load had 1,115 passes and three timing failures (`dialogueCompatibility`, `promptOutputWorkspace`, `recipeConversionWorkspace`). Failed attempts remain retained. The final bounded-worker full run (`npm test -- --maxWorkers=2 --minWorkers=1`) passed 1,118/1,118 in 128 files, exit 0, in 229.47 seconds. No timeout or affected test was changed. This local timing sensitivity remains a risk; hosted CI must pass separately.

Tests first reproduced capacity, cancellation/partial-stream corruption, presentation and envelope failures before their corrections. Native tests cover reversed replies with colliding external IDs, reconnects and late results, duplicate requests, ninth-peer rejection, stale/malformed peer isolation, a non-reading status recipient, and initialization racing a delayed final Stop. The occupied-port regression also exposed a readiness-fault/cancellation race; the terminal fault now remains visible and the unrelated listener is preserved.

One recorded expanded native run observed an eight-client **whole-harness peak working set of 78,368,768 bytes**, and an owned Node host peak of **55,009,280 bytes**. The slow status reader was removed in **5,182 ms**, while the surviving peer stayed paired and usable. These are process samples from synthetic native tests, not production capacity benchmarks or separate additive allocations.

Existing warnings: React `act` warnings in application tests; Vite mixed static/dynamic `sceneAuthoring` import and the 1,067.89 kB main chunk exceeding the 500 kB advisory. Production audits exclude development dependencies.

## Actual installed-client probe

An isolated, absent-native-launcher probe used the installed **Codex 0.166.0-alpha.5.1** app-server, SHA-256 `3097c909fb6d5cd63510d44aceb1d42df9f6e85722a3e447e477def1ecf60e16`, a fresh Codex home, the production compiled stdio adapter, and a loopback Responses fixture. All thirteen KRAKINAI tools were advertised. Actual call ID `probe_status_1` returned `krakinai_connection_status` with `ok: true`, `connected: false`. The actual call and output IDs/names/arguments were correlated; an assistant completion string was not used as evidence.

The successful raw synthetic evidence is `qa-results/shared-mcp-session/probe-6cccb04b-752f-4524-a151-6ef92becb2b3/result.json`. Earlier failures remain separate. Four background external connection attempts were refused by the loopback proxy; no external model request or real credential was used. This probe does not establish pairing, native sharing, writes or desktop availability.

A subsequent actual installed-client probe started three threads, obtained concurrent replies for `probe_status_1`, `probe_status_2` and `probe_status_3`, unsubscribed alpha, and received beta's `probe_survivor_4`. All four actual replies were correlated and disconnected, as required with the absent synthetic native launcher. The final helper source repeated this successfully: `qa-results/shared-mcp-session/probe-edd1b78f-a50c-49a8-9529-960951a6dc85/result.json`, eight loopback model requests. This remains separate from paired/native sharing acceptance.

The 11 browser skips are opt-in signed-native B1/B2, Windows Allow/Deny, installed-CLI read/revision, and ten-shot recipe cases requiring manual native verification. They are not counted as passes or evidence for this shared-session release. Machine-readable browser evidence is preserved at `.superpowers/sdd/2026-11-02-shared-mcp-session/browser-pre-sign.json`.

## Review and signed candidate

The independent source review found one Important issue in the new synthetic QA helper: a failure before child-process creation left the loopback fixture listener open. Its regression first failed with a five-second process timeout, then passed after startup acquired-resource cleanup was widened. The complete helper suite passed 70/70. No Critical or Minor findings were raised; native pairing, desktop availability and hosted evidence remain separate pending gates.

Native UI build passed with zero warnings/errors. A new portable candidate was built under `qa-results/desktop-bridge-launcher/releases/shared-session-20261102-r1`, containing 1,006 pre-sign inventoried files / 16,467,283 bytes. Unsigned executable SHA-256: `6b7083075aa5f3ac505143248b70d47c31e3e884d820176d08fe42158dd2f7b1`. The owner signed this exact executable locally. Independently verified current Authenticode status is `Valid`, signed executable SHA-256 `a19be3e0a8392f605dbf9ec1dbaaef15e4a374d4ec8fd2b19ce8011e9554c8e3`, and the signer matches the approved public thumbprint. The copied helper body matches source and its signature is also `Valid`. Effective Windows PowerShell policy remains `AllSigned`; no signing key or certificate was exported.

The first signed paired attempt reached a real submitted proposal with unchanged pre-approval data, then failed its client-departure assertion (expected 2, observed 3). It remains a failure: no review/Apply occurred and no new scene was saved. `thread/unsubscribe` does not immediately end the installed Codex session. The QA client now archives/ends only its own synthetic session before unsubscribing, with a rollout stored solely in its fresh QA home. A separate signed, unpaired native probe then verified an actual 3-to-2 client transition and a surviving tool response (`membership-c894a408-b59c-4992-821b-4ebb21d103af` under the owned acceptance case). Native accessibility text was refreshed before interpreting the counter; the earlier stale-text/time-out attempt is retained separately. No launcher rebuild or signature change was made for this QA-only correction.

Later attempts include an operator abort after Escape, an incorrect inline-review locator that reset the original browser driver, and a first-import evidence-validator failure. These are retained as failed attempts, not passes. A standalone bounded-command browser runner now survives inspection errors. The last of these attempts reached actual browser Apply after a real 3-to-2 client departure. Its three preapproval snapshots equal the initial library, and retained postapproval evidence validates one new immutable scene, exact prompt bytes, confirmed saved ID, old scenes/takes/preferred selection, draft and media hashes. The validator had assumed the optional initial import ledger existed; a regression reproduced the missing-ledger failure and passed after correction. That attempt did not complete actual CLI receipt, replay or revocation checks and is not full workflow certification. Its saved synthetic scene and receipt are preserved as the measured baseline for continuation; the original baseline and failed evidence remain unchanged.

Only 29 source, test, workflow and documentation files are staged. Release binaries/dependencies, browser profiles, certificates, keys, settings, test ZIPs and temporary/raw QA outputs are excluded. R3 and live compiled-file hashes still match their recorded pre-task values. There is no new Git commit or push at this checkpoint.

## Remaining acceptance gates and assumptions

`scripts/qa/shared-mcp-acceptance.mjs` orchestrates three actual installed-client threads using `shared-codex-client.mjs` and the strict `shared-mcp-workflow.mjs` validator. Browser/native observations must be supplied from the owned synthetic setup. No helper reveals/copies a pairing key or automates native Allow. It requires pre-approval database snapshots, actual review/Apply, confirmed scene/receipt IDs, preserved old scenes/preferred takes/media hashes, replay without changes, cross-client reads, browser Disconnect and separately re-paired last-client loss.

The reviewed native executable is signed and verified. The complete installed-client acceptance and separate desktop smoke described below passed. Existing signed releases, the live compiled bridge, private settings and desktop shortcuts remain unchanged. Only the separately approved temporary desktop MCP entry was added; it was then removed, restoring the exact original global configuration bytes. No test uses the real library origin/profile.

Security assumptions remain the existing trusted Windows account/session, reviewed release files and uncompromised same-origin application. The channel does not attest a specific chat or vendor. All accepted clients share the applied browser scope; an accepted local client is not isolated from other chats. A malicious extension, same-user/administrator compromise, and compromised same-origin scripts are outside these protections. No area is labelled safe solely from a source search.

## Successful signed installed-client acceptance

Actual result: `workflowVerified: true`, `desktopVerified: false`, exit 0. Machine-readable evidence and raw correlated tool responses are retained at `qa-results/shared-mcp-session/acceptance-f60a8bdba2674806bf287435200f663b/attempt-16f7b7cc-cda5-4b10-a347-c545712e91a6/result.json`. This is a new complete attempt; it does not change the failed results above.

The installed executable is Codex `0.166.0-alpha.5.1`, SHA-256 `3097c909fb6d5cd63510d44aceb1d42df9f6e85722a3e447e477def1ecf60e16`. Three real app-server threads used the production stdio adapter, signed R1 launcher/helper, fresh QA Codex home, and the isolated Responses model fixture. All thirteen KRAKINAI tools were advertised alongside built-in tools. There were 24 loopback model requests. Three background external connection attempts were refused; no external model credentials or requests were used. Pairing was completed manually through the actual Windows verification window and the synthetic browser at `http://localhost:5183`, relay `54189`.

| Actual call ID | Client | Actual tool / outcome |
| --- | --- | --- |
| `synthetic_cli_read_1` | alpha | connection status: connected, exactly selected project and proposals |
| `synthetic_cli_read_2` | beta | list projects: only selected synthetic MIDORI |
| `synthetic_cli_read_3` | gamma | get selected project: matching ID and name |
| `shared_scope_denied` | gamma | get excluded project: `PERMISSION_DENIED`, no data |
| `synthetic_cli_read_4` | alpha | submit change set: `review_required`, then alpha archived |
| `synthetic_cli_read_5` | beta | proposal status: `applied`, confirmed new scene receipt |
| `synthetic_cli_read_6` | gamma | import receipt: exactly matches proposal receipt |
| `synthetic_cli_read_7` | beta | retry same change set: same applied proposal, no duplication |
| `synthetic_cli_read_8` | gamma | status after browser Disconnect: disconnected, no old scope |
| `synthetic_cli_read_9` | beta | get project after Disconnect: `PAIRING_REQUIRED` |
| `synthetic_cli_read_10` | gamma | proposal status after Disconnect: `PAIRING_REQUIRED` |
| `synthetic_cli_read_11` | beta | submit after Disconnect: `PAIRING_REQUIRED` |

Every result is checked against its actual echoed call ID, client, tool, arguments and completed turn; the JSON evidence also records each reply's SHA-256. Assistant success strings are not accepted. Three preapproval database snapshots (submitted, preview, reviewed) exactly equal this attempt's measured baseline. Actual browser checkboxes and Apply saved one immutable new scene `scene_2ce623cd8798`, attached it once to the existing shot, and preserved both earlier scenes, preferred take, old take metadata, draft, assets, variants, templates, excluded collection and media hashes. The attempt began with two synthetic scenes (including the earlier preserved save) and ended with three; the real library was never used.

Confirmed change set: `synthetic-shared-78910fe5-39c9-46a4-80f8-27dd85ada3d2`. Package digest: `b5ba98808e17db24e99d80b4973cad7a8e976d98c5d4af5b236b0afdb13f0928`. Approved digest: `a3cabd8f5cc696286605057aa559c4cf93d411a0fa2e59efdaef1e4649816889`. The synthetic PNG SHA-256 stayed `89e8c1c8d608ad333a302e7098e18fccfb7276ee61094c1ea86dd8c54ad4a48b`.

Observed native membership: three initialized clients; alpha's actual archive reduced this to two while preserving running/paired and the same host generation. After browser Disconnect and denied calls, the owner completed a separate fresh native pairing. Archiving beta left one paired client; archiving gamma left zero clients, stopped the owned host, cleared pairing and returned generation `none`. The observer's hello-only channel was never counted as initialized membership. Native accessibility state was refreshed before interpreting counts.

One final sample of the signed GUI's lifetime peak working set was 118,464,512 bytes (current working set 99,201,024 bytes) after multiple attempts in the same GUI process. This is a cumulative process peak, not a per-client allocation, isolated-run peak, or capacity guarantee. Earlier native-harness/owned-Node samples above remain separate.

## Separate actual desktop smoke

After explicit owner approval, one temporary `krakinai_shared_qa` registration used only the signed candidate and the same synthetic settings. Two new desktop chats each discovered thirteen KRAKINAI tools and invoked only `krakinai_connection_status` with `{}`. Both actual responses contained `ok: true`, `connected: false`, `state: disconnected`, as expected with the synthetic host stopped and browser unpaired. The native UI, refreshed before interpretation, showed two initialized desktop clients. This checks desktop discovery/status; paired write acceptance remains the separate installed-client test above.

| Desktop chat | Actual enclosing call ID | Actual MCP tool item ID |
| --- | --- | --- |
| QA A | `call_2bb8dac4346846dcbbd4fbe675a2bb17` | `exec-29bd3c3e-f9f6-4dac-af1e-9e6c860ebf68` |
| QA B | `call_14811d6f0f704e5fb564b1b5b2ca3d44` | `exec-b5855c97-50f1-4be5-8aa9-81c491d1d827` |

The desktop agents could not see their invocation IDs. Those IDs and actual raw outputs were independently read from only these two authorized QA rollouts, correlated against each chat's MCP tool trace, and validated; assistant reports alone were not accepted. Evidence: `desktop-result.json` in the owned acceptance directory. The extraction initially assumed both chats printed the same envelope; QA A printed an explicit tool/arguments/response wrapper. The checker was corrected to validate that exact wrapper before parsing the same original actual response; neither tool was rerun to replace an earlier result.

Both temporary chats were archived and the temporary MCP table was removed. The original global configuration was restored byte for byte (SHA-256 `F2C48E408366C6C85F8370D4EED10EC35D20EF4BBF65F49D53637AD909CB1332`). Original and temporary configuration backups remain in the private `.codex/krakinai-bridge` directory, outside Git, with all QA profiles/release files retained. No trust, execution policy, original MCP entry or real library was changed.

An `IPC_PROTOCOL_ERROR` guidance message was also observed on the stopped synthetic launcher during desktop discovery/reconnection. Both actual status calls succeeded and two desktop clients remained initialized; the precise rejected-peer trigger was not captured. Protocol/identity failures already surface through this existing guidance path. This observation remains an unresolved diagnostic limitation; no checks were weakened or runtime changes added to hide it.

## Post-merge portable-package correction — 2026-11-02

Relocating the shared-session release outside the checkout exposed a packaging defect: the managed host exited with `ERR_MODULE_NOT_FOUND` for `fflate`. The earlier signed acceptance ran from a directory beneath the checkout, where the application's ancestor `node_modules` supplied that undeclared dependency. Those original results remain valid for the tested layout; they did not establish a self-contained portable dependency closure. This `HOST_EXITED` failure is distinct from the stopped-GUI diagnostic observation above.

`bridge/package.json` and its lockfile now declare `fflate` 0.8.3 as a production dependency, matching the application's existing installed version. The regression in `scripts/qa/launcher-release.test.mjs` builds into a fresh external directory with no ancestor `node_modules`, installs only the bridge's declared production dependencies from its lockfile, clears inherited Node environment options, then verifies an actual managed-host ready frame and confirmed shutdown on an isolated loopback port. It first failed with the missing-package error, then passed after the dependency correction.

Local correction checks: bridge 54/54, QA helpers 73/73, bridge build/typecheck and production audit exit 0, zero production vulnerabilities. The exact manual dependency-install repair was also verified against the original failed synthetic standalone fixture: one package added, actual host startup/shutdown succeeded, stderr empty. No live configuration, real browser data, executable/helper bytes, certificate trust or execution policy was changed by the agent. Existing native signatures remain valid; the owner selected manual activation/repair.

The earlier 72-helper and pre-relocation results above remain historical checkpoints, rather than being relabelled with this additional regression. Hosted results for this correction must be checked separately against its eventual signed commit.

After the owner's manual repair and MCP reload, the owner reported **Running / Paired / Connected (4)**. This chat then received actual successful MCP replies for connection status, the authorized project list and a one-item asset read. That is a live connection smoke check, with no proposal submission or database write. It is separate from the isolated signed acceptance above and does not certify every live chat or expand the selected permissions. No real library content or screenshots are included in this correction.

The first hosted correction run, [41461552649](https://github.com/Jeruzael/krakinai/actions/runs/41461552649), tested signed commit `4f709545577fb9136527881b34648d834376a78f`. Its Windows job passed bridge 54/54 and native core 38/38, then failed the new regression during dependency installation (`ENOTCACHED` for the locked `zod` archive; release/lifecycle helpers 22 passed, 1 failed). The local warm npm cache had hidden the test's offline-only cache assumption. A fresh empty local cache reproduced the same error. The regression now uses a new fixture-local cache and permits npm to download missing locked packages with install scripts still disabled. It retains the external layout, ancestor-package rejection, cleared host environment and actual ready/shutdown assertions. This test-setup correction does not change the production bridge or signed native files; the failed hosted attempt remains a failure.
