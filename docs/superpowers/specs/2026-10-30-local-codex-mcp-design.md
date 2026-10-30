# Stage C: Secure Local Codex MCP Bridge and Human Approval Center

Status: approved by the user on 2026-10-30 ("Approve and implement"). This records design approval, not completed implementation or certification. Engineering defaults below are the approved implementation direction; test gates remain mandatory.

Fresh builder review: completed against this design and the binding brief; the reviewer reported "nothing important left" and no unmet requirement in the design. Actual CLI compatibility and native Windows verification remain execution gates, not verified results.

Base: `6530c0eda04809c603930a4b106b7f774bc1dd8d` (`master`, PR #27 merge). Feature branch: `codex/local-codex-mcp`.

## Purpose and preserved behavior

Let local Codex read specifically authorized production context and submit a normal `krakinai.change-set.v1` package. Only the person reviewing that package in KRAKINAI can authorize its atomic application. Codex obtains actual committed IDs afterward. Both new projects and immutable scene revisions follow this path.

This feature adds no public MCP endpoint, AI service, cloud storage, browser automation write bridge, filesystem credential reader, or unattended approval. It does not alter IndexedDB stores/version, prompt assemblers, saved outputs, media associations, backup limits, ZIP64, or PR #12. Manual Stage B paste/file imports continue to work. No testing uses the user's library or existing browser profiles, and no QA artifacts are deleted.

## Verified starting points

- Fetched `origin/master`; its tree equals Stage B head `2206fbbc2e19555c2efee6a5e72c418c2accacc3`. The starting checkout was clean. No applicable `AGENTS.md` was found in this checkout or its parents.
- Reviewed Stage B's storage, planner, validation, ledger, canonical digest, state signature, context export, types, preview/receipt components, authoring/storage modules, importer/context screens, and integration/contract documentation listed in the brief.
- `parseChangeSet()` accepts the native strict contract with a 20 MiB manual-import ceiling. `previewChangeSet()` binds decisions, allocated IDs and relevant state into an approved digest. `applyApprovedChangeSet()` revalidates inside one transaction over the existing eight stores and commits records with the receipt together. It does not presently accept a session authorization guard.
- Receipt idempotency is durable in `Preferences.aiImports`. Merely knowing an import ID or digest is not permission to disclose that receipt.
- `buildAiContext()` already separates ordinary asset text, exact scene prompts, Character identities/anchors, notes and filenames. Generic asset-text permission never authorizes Character Identity. These protections must be reused, including the existing omission of potentially private association IDs.
- Local runtime: Node `22.23.3`; `codex-cli 0.73.0`. That CLI exposes `mcp add/list/get/remove`, not a direct `tools/call` command. No CLI upgrade, credentials, or global configuration changes have been made.
- Registry inspection reports maintained `@modelcontextprotocol/server` and `@modelcontextprotocol/client` version `2.4.0`, Node >=20. The SDK documents legacy-client serving over stdio; compatibility with this actual CLI still requires a test, not an assumption.

These are inspection results, not Stage C test results. Stage C has not been built or certified.

## Approaches and recommendation

Use stdio between Codex and a Node process, and authenticated browser-initiated HTTP long polling between that process and KRAKINAI. A Windows verification window supplies a strong one-time pairing secret outside the browser/network channel. The browser owns all permissions and final writes.

HTTP polling permits bounded requests, explicit authentication and cancellation using the browser's existing fetch API and Node's HTTP server. A WebSocket alternative offers lower idle overhead but needs another connection lifecycle, upgrade authorization and hijacking controls without removing the pairing problem. Local TLS would add certificate installation/trust management; a browser extension/native-messaging solution would add an independently installed extension. Neither is needed for this slice. The recommendation requires no certificate or extension installation.

The Windows verification step is a proposed user-visible choice requiring approval of this design. It is not evidence that an unauthenticated web page can verify its own bridge identity.

## 1. Transport and process lifecycle

```text
Local Codex CLI
    | MCP JSON-RPC over inherited stdio
Node MCP server + loopback relay
    | authenticated, bounded JSON requests; browser initiates each request
KRAKINAI browser session and permission broker
    | local preview + real user confirmation
Existing Stage B atomic apply -> records and durable receipt
```

- The Codex-launched process registers only the documented tools. Use pinned SDK `2.4.0`, with legacy stdio support for the installed CLI. No sampling, shell, filesystem, arbitrary URL, raw database, permission-grant or apply tool is registered.
- The listener binds only literal `127.0.0.1`, default explicit port `4177`. A configured port collision fails visibly; no scanning, LAN binding or automatic port fallback. One process accepts one browser controller. A second controller cannot replace an active session silently.
- `--app-origin` is required and must be an exact loopback HTTP application origin, including its port. Production setup keeps `http://localhost:5173` if that is where the user's records exist. The relay URL being `127.0.0.1` does not move or reload the application to that origin.
- On stdin EOF, termination, startup failure or normal shutdown, close the listener, abort pending transport work, destroy in-memory sessions/proposals and close only the process's own verification child. Do not kill a browser or erase files. Existing committed receipts survive.
- Stdout contains MCP responses only, which may include expressly authorized tool data. No diagnostic echo of prompts or credentials. Stderr contains bounded error codes and operational messages, not packages, text fields, request bodies, tokens or user filenames. Do not attach raw exceptions to model responses.
- Enforce a byte limit before the SDK's JSON parsing. Use a bounded input stream/custom SDK transport if its serving entry does not expose a pre-parse limit. Do not silently rely on schema validation after an unbounded line has already been buffered.

## 2. Browser connection and security checks

AI Connections displays the current application origin, a fresh browser-library session label, explicit relay address, selected project names and connected client. Browser profile paths are not discoverable from the app; do not pretend that a session label identifies a Chrome profile. Local library counts can help the person recognize the correct browser, but are not disclosed to an unpaired client.

Use browser-initiated POST long polling and POST result delivery, with one transport command per poll. Routes are exact and versioned: pairing start/proof, session confirmation/poll/result/rotation/revocation. Reject query strings, cookies, unexpected routes/methods, compressed bodies and unknown envelope fields. No media download or filesystem route exists.

Every browser route checks the literal configured Host and exact allowed Origin. Missing/null/mismatched Origin fails; an attacker-controlled Host fails even if it resolves to loopback. Preflight allows only that Origin, POST and the explicit header set. There is no wildcard CORS or credentialed-cookie mode. These checks supplement authentication and do not replace it: a local non-browser client can forge Origin.

Authenticated messages bind protocol version, instance/session/epoch, monotonically increasing sequence, request ID, method, path and complete body digest. HMAC-SHA-256 proves the message and response. The browser verifies the matching response before dispatching any command. A small bounded forward sequence window tolerates cancelled/lost requests; previously used or older sequences fail. Serialize transport requests so parallel polling/results cannot weaken replay checks. Different request and response keys prevent reflection.

Every library-data tool, including proposal status and receipts, makes a fresh browser round trip. The Node relay does not cache library context or serve prior-session results after revocation. A suspended/unavailable browser returns a timeout/disconnected result rather than data or a success claim.

## 3. Pairing and credentials

1. The person opens AI Connections in the browser containing the intended library, chooses permissions, enters the explicit relay address and clicks Connect. No listener discovery occurs.
2. The browser creates a fresh nonce and ephemeral P-256 ECDH key pair. Pair-start contains only public key/nonce and protocol metadata. The Node process creates its own ephemeral pair, nonce, single-use challenge and 256-bit random bootstrap secret.
3. A verification window belonging to the launched bridge shows its actual compiled path/version, configured origin, port and challenge identity. It reveals the one-time secret only on a local user action and requires an Allow decision. The browser cannot fetch that secret; MCP has no tool to reveal it or approve this window.
4. The person enters the strong secret in the browser's masked pairing field. There is no automatic clipboard access. Derive purpose-separated handshake/session keys with Web Crypto P-256 ECDH, HKDF-SHA-256 and HMAC, binding both public keys/nonces, challenge, instance, origin, port and protocol version. Validate imported curve points and strict lengths. Both sides exchange domain-separated transcript proofs. A short display code is optional assistance, never authentication by itself.
5. Accept proof only after the native Allow decision. The browser verifies the server's proof, then confirms the authenticated session. Only now activate the reviewed browser permissions. Wrong proof, denial, expired/consumed challenge or replay fails closed. If acknowledgement is lost, do not reuse a consumed challenge; the short unconfirmed-session reservation expires and the person pairs again.

The verifier is a small Windows PowerShell/WPF helper launched with a hidden console and visible user-requested window. Secret material travels to that child through an anonymous pipe, never process arguments, environment, URLs, temporary files, stdout or stderr. Native output contains only challenge ID and allow/deny. If the native verifier cannot run, pairing fails with a useful error; it does not fall back to logging the key. The final launcher uses a verified absolute helper path next to its compiled server.

Keep keys and permissions in memory only. Use non-extractable CryptoKeys where possible; remove pairing fields and release temporary secret buffers after use. JavaScript cannot promise forensic memory erasure. User-initiated copying can expose a secret to OS clipboard history; the app does not copy automatically and cannot protect a compromised desktop. Ephemeral ECDH avoids treating the displayed bootstrap secret alone as a reusable bearer credential.

Proposed limits: a challenge lives two minutes, maximum five proof attempts, one pending challenge, at most one native prompt per 30 seconds and five starts per five minutes. A session expires after one hour or 15 minutes without user/tool activity; background polling does not extend it. Derive fresh request/response MAC keys every five minutes using the in-memory master and a new authenticated epoch nonce. Retired epochs stop authenticating. Unconfirmed sessions expire in 45 seconds. An unresponsive controller is disconnected after 45 seconds; data calls cannot bypass it in the meantime.

Disconnect invalidates the browser broker, approval handles and in-flight replies synchronously before attempting the relay revocation message. If the network is unavailable, immediate browser revocation still prevents reads/writes; the relay marks the transport stale on its deadline and has no context cache to disclose. Reload/restart requires fresh pairing, with no permissions or approvals restored from storage.

## 4. Permission boundaries and read contracts

All capabilities start empty. The person can select exact existing projects, reusable asset/variant/template IDs, and separately allow creation of a new project and proposal submission. No active draft or current route implies permission. Scene metadata is limited to takes belonging to authorized projects; explicitly selected additional scenes are separately visible grants. Use of existing unassociated media requires an explicit local media-ID selection; associated media metadata may be used only through authorized source records. Original bytes are never returned.

Independent, off-by-default disclosure grants cover ordinary asset text, exact saved Full prompts for selected scene IDs, Character identities/approved anchors, production notes, and filenames. Full prompt permission warns that the exact string may itself contain identities, notes or filenames; it cannot be both exact and redacted. A general scene-metadata or asset-text checkbox never enables these text disclosures. Titles, tags and IDs can themselves be sensitive and are returned only within the selected record scope.

Use Stage B context projection/privacy rules rather than a parallel serializer. For pagination, project metadata and ordered shot pages must not expand all takes; scoped scene projections can be serialized individually. Extract reusable projection helpers only if needed, preserving every existing context-export test and behavior. Filter before serialization; never JSON-stringify a full snapshot, Blob or private error to the relay.

Check permissions before reading and again after asynchronous work before returning a result. A monotonic browser scope epoch invalidates in-flight replies, previews and approval handles on any permission change. Target scope also constrains proposals: permission to propose is not permission to modify another project or reference an unselected existing asset/scene/media ID. Recheck resolved IDs and candidate decisions at application. A locally chosen candidate-reuse decision may grant use of that one record for that reviewed proposal without enabling its general text disclosure; record that consent only in private browser state.

Review of an existing deferred candidate requires an explicit grant for that candidate or its originating import receipt. A guessed candidate ID cannot authorize lookup, matching or modification.

Cross-project history must not disclose other projects' titles or scene bodies. History pages include only authorized family members; an opaque expected global-head ID needed for concurrency does not grant access to that head's contents. Receipt access is separately described below.

### Versioned tool family

Use underscore names for compatibility: `krakinai_<name>`. Results use a stable `krakinai.mcp.v1` envelope with `ok`, structured data or a sanitized error code, and request correlation. Tool schemas reject unknown fields; there are no caller-provided approval or scope fields. All returned stored text is untrusted user content, never tool instructions.

| Name suffix | Input | Authority and bounded result |
| --- | --- | --- |
| `connection_status` | Empty | Available unpaired; minimal transport state. Scoped capabilities require live browser confirmation. No unpaired project names/counts. |
| `list_projects` | Cursor, limit | Only explicitly authorized project IDs and basic metadata. |
| `get_project` | Exact project ID | Selected project metadata/revision; no expanded storyboard or notes without grant. |
| `get_storyboard` | Exact project ID, cursor, limit | Ordered shot metadata, type, duration and permitted take IDs. |
| `get_scene` | Exact scene ID | Authorized metadata and only separately permitted text. |
| `get_scene_history` | Exact authorized scene ID, cursor, limit | Authorized immutable-family metadata, global expected-head identifier where required. |
| `search_assets` | Query, optional category/kind, cursor, limit | Search only selected reusable records, with text controlled by disclosure grants. No global-match counts. |
| `get_shot_types` | Empty | Paired session; existing public type/rule metadata. |
| `preview_change_set` | Native change-set object | Scope check + existing Stage B preview, read-only. Return safe counts/codes, not unrelated duplicate-match data. |
| `submit_change_set` | Native change-set object | Explicit proposal capability; register proposal and return ID/digest/status, never apply. |
| `get_proposal_status` | Exact proposal ID | Current-session proposal; live browser check. Confirmed scoped receipt after commit. |
| `get_import_receipt` | Exact change-set ID and package digest | Explicit receipt grant or all receipt targets authorized; return confirmed outcomes/mappings. |
| `get_generation_prompt` | Exact scene ID | Separately authorized exact Full output; never truncate. Oversize returns an error/manual export guidance. |

Numeric cursors are bound to scope epoch and relevant revision; reject stale pagination rather than silently mixing snapshots. Page size 1–50, query <=200 characters and IDs follow existing native bounds. No `list_all` or wildcard target.

Stable errors include `DISCONNECTED`, `PAIRING_REQUIRED`, `AUTH_FAILED`, `SESSION_EXPIRED`, `PERMISSION_DENIED`, `STALE_CURSOR`, `INVALID_PACKAGE`, `PAYLOAD_TOO_LARGE`, `QUEUE_FULL`, `RATE_LIMITED`, `TOOL_TIMEOUT`, `PROPOSAL_EXPIRED`, `REVIEW_REQUIRED`, `CONFLICT`, `APPLY_FAILED` and `RECEIPT_UNAVAILABLE`. Unauthorized and unknown targets share a generic response; do not echo private validator messages.

## 5. Human approval and atomic application

The browser broker owns an in-memory proposal registry and private approval records. MCP cannot supply booleans, approved digests, handles, allocation IDs or decisions outside the canonical package. Reject such extra transport fields; native validation also rejects unknown package properties.

- Submission parses the unchanged native package, checks current scope and computes its canonical digest. Reuse `previewChangeSet()` and the Stage B category/candidate decision model. The transport does not rewrite the package's operations or source attribution.
- Use the existing `ChangeSetPreview` for project/shot targets, exact before/after prompts, conflicts, candidate matching/reuse and media requirements. Stage B's read-only preview can show its full local details to the human without sending them all to Codex. Add a clear requester/session header and final review confirmation.
- Only a real trusted event on the browser's final Apply control mints a private, one-use authorization record, valid for 60 seconds. Bind it to proposal/package/approved digest, exact decisions/allocation/state signature, session ID and scope epoch. No HTTP or MCP endpoint can mint, transmit or redeem it. `isTrusted` is defense in depth, not protection from compromised same-origin JavaScript or host automation.
- Before calling Stage B, recheck scope, deadline and session. Add an optional synchronous browser-supplied authorization guard to `applyApprovedChangeSet()`; manual calls keep their existing behavior. Invoke the guard inside the existing transaction after current-state planning/signature/capacity validation and immediately before the first write. Validate private broker state and consume the one-use record there. The replay-receipt return branch must also check current authorization before disclosing a receipt. Do no network or cryptographic awaits inside the transaction.
- Changing the package, decisions, relevant state, scope, connection or deadline invalidates approval. A failed transaction consumes the attempted authorization and requires fresh review. There is no retry loop that reapplies an old approval.
- The synchronous guard/first-write point is the authorization boundary. Revocation before it aborts with no writes. Once an authorized atomic transaction has started its writes, finish/abort it normally; transport loss cannot undo a committed batch. The UI explains that disconnect does not reverse already authorized committed work.
- Show success only after transaction completion, using the actual Stage B receipt. Quota/abort/conflict produces no success receipt or partial records. Preferred takes/statuses require their separate existing approval categories. Identity/claim review is never inferred from a model request.

## 6. Proposal acknowledgement and recovery

Lifecycle: `received -> review_required -> approved -> applying -> applied`; rejection, conflict, expiry and disconnection are explicit terminal states for that review attempt. Only browser-owned transitions can enter `approved/applying`. `submit_change_set` completes after browser acceptance; it does not wait for the person. Status is client-initiated and bounded, with no automatic notification/polling agent.

Retain at most eight in-memory proposals (<=1 MiB native package each); review expires after ten minutes. Deduplicate same-session submissions by change-set ID plus package digest. Reusing an ID with different content is a conflict, never a silent update. Refresh/process restart discards pending review/approval; the agent can explicitly resubmit unchanged content for fresh review after pairing.

Committed receipts remain in Stage B's existing ledger. After a lost success acknowledgement, pair again and retrieve by exact change-set ID and package digest. The person must grant that receipt explicitly in AI Connections, or authorize all its target records. Knowing a digest/proposal ID is insufficient. Newly created projects do not silently widen general read scope; the browser offers an explicit grant to continue working on them. Asset-only and removed-project historical receipts use the explicit receipt-grant path.

Return a narrow confirmed receipt projection: actual IDs, per-operation outcomes, project revisions, immutable relationships and pending requirement kinds/counts. Notes, filenames, candidate prompt text and other private fields still require disclosure grants. Full historical receipt details remain locally visible. Retry of an applied package invokes Stage B's durable idempotency path/receipt lookup, never recreation of removed records. An unauthorized replay cannot leak the ledger through the ordinary preview tool.

## 7. Resource limits and failure handling

| Resource | Proposed bound |
| --- | --- |
| Native package over MCP | 1 MiB UTF-8; manual importer retains 20 MiB |
| Stdio frame / relay command envelope | 1.25 MiB, enforced before parsing; no compressed bodies |
| Tool/result data | 512 KiB UTF-8, including envelope; exact text never silently cut |
| Outstanding transport requests | 16; one controller and one command per poll |
| Proposal registry | Eight; total package bytes <=8 MiB; ten-minute review expiry |
| MCP read/acceptance deadline | 15 seconds; no waiting for human review |
| Long poll | 20 seconds; cancelled/released on shutdown |
| Request pressure | 30 tool calls/minute, bounded burst eight; separate transport limit 120/minute |
| Stdio admission | 64 inbound frames/minute, burst 16, aggregate 16 MiB/minute before SDK dispatch; notifications/unknown methods count |
| HTTP receive | 8 KiB headers, five-second header deadline, ten-second body deadline; streaming byte counter |

These are engineering defaults, not changes to application/storage limits. Reject before accumulating an oversized input. Expired/cancelled commands cannot be delivered later to a new session. Wipe pending response references on invalidation. Return retryable disconnected/timeout states without blind write retries. Shutdown and expiry timers must be bounded and tested with controlled clocks.

## 8. Trust boundaries and remaining assumptions

Treat the agent, package contents, stored descriptions and every HTTP caller as untrusted. Static allowlisted tool descriptions do not inherit instructions from library content. No eval, shell execution, arbitrary fetch, raw HTML rendering, script/URL loading or file access is driven by those contents. UI renders text through existing escaped React controls.

Authentication, scope filtering, private human approval and Stage B transaction validation are separate checks; passing one never replaces another. The native window is the out-of-band bootstrap channel, and the person must verify it belongs to the deliberately launched bridge. A fake page displaying its own code is not verification. Local HMAC authentication provides no protection from a malicious process that already controls the same user's desktop, reads process memory or replaces the trusted executable. Same-origin XSS, malicious browser extensions, OS/administrator compromise and malicious physical automation are outside this authorization boundary. Previously disclosed Codex context cannot be recalled by revocation.

Native pairing and the custom authenticated relay need adversarial review and tests; neither a function-name search nor using cryptographic primitives earns a "SAFE" label. Fail visibly on unsupported platform/native verifier errors. Initial production pairing support is Windows Chromium; other operating systems are not certified by a simulated verifier test.

## 9. Windows setup and application experience

Plan a separate `bridge/` Node package with pinned runtime dependencies/lockfile, TypeScript source and compiled launcher/helper in `bridge/dist/`. Browser code receives only shared JSON types/protocol helpers; it does not bundle Node's SDK/server dependencies. Use Node 22 LTS for local/CI verification (the SDK's lower engine floor is not a certification claim).

The final guide will replace the planned launcher with its actually built, tested absolute path in this checkout and the verified Node executable path, including `--app-origin http://localhost:5173 --port 4177`. No `npx -y`, implicit runtime download, global package installation or automatic Codex configuration edit. Show the user the optional `codex mcp add`/remove commands and explain that those commands edit their configuration; run neither without authorization. Per-process/test configuration is separate.

Add `/connections/ai`, existing navigation entry points and an application-level in-memory connection provider so ordinary navigation does not destroy an active session. No connection starts at app boot. All states must be visible: disconnected, pairing, permissions, incoming review, exact change detail, final confirmation, receipt, conflict/error and disconnect confirmation. Dialogs reuse existing focus trapping/restoration and labels; announcements use status/live regions. No focus stealing when a background proposal arrives. Review is contained and scrollable; mobile stacks the content with reachable approval and disconnect controls.

Disconnect closes the browser capability, not the library. Uninstall means disconnect, stop/remove the optional Codex MCP configuration and leave application records untouched. Explain browser-origin/profile separation and recovery/manual Stage B file import when the bridge is unavailable.

## 10. Test architecture and evidence

Do not report any of the following as passed until executed. Record command exits/warnings, raw machine-readable results, artifact paths and hashes; keep synthetic profiles/files for review without deletion.

1. Unit/protocol tests: strict tool/envelope schemas, byte/queue/rate/time limits; transcript tampering, wrong/expired/replayed pairing, invalid curve points, MAC/epoch/sequence reflection/replay, forged Host/Origin/null origin, CSRF/rebinding and arbitrary local clients. Verify no credentials in messages/logs/config files and no data before pairing. Test all privacy switches, async scope changes, cross-project history, exact text limits and receipt-privacy paths.
2. Broker/storage regressions: submitted approval booleans/handles fail; trusted browser approval required; altered package/decisions/state/head/epoch/deadline fail. Pause the operation before its pre-write guard and revoke, proving zero writes. Test replay, concurrent approvals, quota, transaction abort, invalid media associations, stale tabs and preferred-take preservation. Manual import runs without an MCP session and remains unchanged.
3. Real SDK stdio client/server tests: initialization, list/call, bounded frames, browser unavailable, timeouts, process EOF/termination and no stdout noise. Include 2025-era protocol negotiation for CLI compatibility.
4. Real installed Codex CLI smoke: use only a fresh synthetic working directory and process-local/test-scoped configuration; no copied authentication or global config writes. A loopback test-only model-response fixture can direct the actual CLI to call `krakinai_connection_status` while disconnected and read one authorized synthetic project after pairing, letting us observe real MCP tool invocations without an external AI API. Label this controlled local orchestration honestly: it proves CLI transport/tool execution, not model reasoning. If this old CLI cannot operate with that fixture, document the exact compatibility blocker instead of counting an SDK client as a Codex CLI call. Do not upgrade it silently.
5. Isolated Chromium UI/bridge end-to-end: real browser approval controls and Stage B storage. Linux CI can inject a test verifier only through test module dependency injection, never a production flag/route/environment shortcut. Separately test the real compiled Windows launcher and WPF verification window locally, including native denial/unavailability; simulation is not native certification. Any automation may control only its own synthetic test window/profile.
6. Acceptance batch: synthetic MIDORI with 15 ordered shots/60 seconds, 2 Character/9 Property/4 Graphic and four pending inputs; zero writes before approval; actual committed receipt IDs afterward. Revise Shot 05 with exact stationary-wide/subtle-zoom text, preserving architecture, old output and preferred take. Reject a drama shot under MIDORI's project ID. Test candidate Camera reuse/defer/create decisions, immediate revocation, review reload, lost acknowledgement and authorized durable receipt recovery without duplicates.
7. Compatibility: existing recipe golden hashes, Direct Prompts, immutable history, Camera composition, reference associations, legacy backups and original synthetic media hashes. No startup migration. Existing Stage B manual file/paste tests remain required.
8. UI evidence at 1440x900, 1366x768, 768x1024, 390x844 and 200%-equivalent reflow. Keyboard-only pairing/permission/review/confirmation, focus restore, no background focus capture, screen-reader labels and narrow layouts. Screenshots must mask all pairing material and contain only synthetic data.
9. Run existing tests, typecheck, build, production audit, QA scripts and committed browser suite, plus bridge-specific tests/build/audit. Update GitHub Actions to execute the new package's lockfile-based checks and synthetic protocol/browser tests; inspect actual hosted results/artifacts before claiming green. Keep output hashes/structured results and successful run links in the final QA report. No invented browser-check counts.

## Delivery boundary and approval

After design approval: produce an implementation plan, build/test this complete vertical slice on `codex/local-codex-mcp`, review its security boundaries, sign the verified changes, push and open a PR against latest `master`. Do not merge. PR #12 remains untouched. A real CLI/native Windows incompatibility must be reported as an unresolved requirement, not hidden by an emulator or a weaker authorization path.

The human decision requested now is approval of this design, particularly the native verification window and the browser-only one-use application authorization. Algorithm encoding, internal module names and minor UI layout choices remain engineering work; weakening authentication, privacy or approval is not an implementation discretion.

## Primary references consulted

- [OpenAI Codex MCP configuration](https://developers.openai.com/codex/mcp/): stdio commands, args and configuration. Local CLI help is the authority for flags supported by installed `0.73.0`.
- [MCP SDK stdio serving](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio): protocol-only stdout and lifecycle.
- [MCP SDK legacy clients](https://ts.sdk.modelcontextprotocol.io/v2/serving/legacy-clients.html): legacy stdio posture, subject to actual compatibility tests.
- [MCP transport security](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports): loopback, Origin validation and authentication. The browser relay is a private authenticated application protocol, not a public Streamable HTTP MCP server.

Stage B source references: [storage/apply](../../../src/storage/changeSets.ts), [planner](../../../src/domain/changeSetPlanner.ts), [native validation](../../../src/domain/changeSetValidation.ts), [ledger](../../../src/domain/changeSetLedger.ts), [canonical digests](../../../src/domain/changeSetCanonical.ts), [state signatures](../../../src/domain/changeSetState.ts), [context privacy](../../../src/domain/aiContext.ts), [preview UI](../../../src/components/ChangeSetPreview.tsx), [receipt UI](../../../src/components/ImportReceipt.tsx), [readiness](../../stage-c-integration-readiness.md), [native contract](../../change-set-contract.md).
