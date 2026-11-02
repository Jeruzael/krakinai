# Shared KRAKINAI MCP session for Codex chats

Date: 2026-11-02
Status: Proposed; owner design approval required before implementation.
Branch: `codex/shared-mcp-session`, from master `73b6cb6` after PR #34 merged.

## Intent and confirmed choice

Manual launch must work when Codex opens several MCP adapters. The owner selected **all chats sharing the selected access**, rather than limiting access to one explicitly selected chat. Keep one launcher, one owned managed bridge, one browser pairing, and one browser-approved permission scope per configured installation. Route requests from several adapters independently.

Every write still requires the existing browser review and Stage B atomic transaction. Preserve identities, prompt outputs, media, immutable scenes, reference packs, storage schemas, limits and backups. Do not touch PR #12, other worktrees, the real browser library, or the running R3 release during development.

This is a project-sized transport/lifecycle correction, not a storage or prompt-format change. The shared-access workflow is the owner's decision. The architecture and numerical bounds below are engineering proposals.

## Evidence and root cause

- The Windows desktop app launched three `krakinai-stdio-adapter.mjs` processes under the same Codex app-server while only one launcher GUI was running.
- `PersistentAdapter.start()` opens the native channel independently of model tool calls. Disconnected/rejected adapters retry on a five-second schedule. Opening the launcher manually therefore does not prevent the competition.
- `LauncherPipeServer.HandleAsync()` claims its single `active` client on hello, before SDK initialization, and rejects every other connection with `CLIENT_ALREADY_CONNECTED`. The approved R3 design deliberately allowed one initialized adapter.
- `BridgeController.SetMcpConnectedAsync(false)` stops the owned host when its single client is lost. That rule needs an explicit shared-session replacement, rather than silently removing the connection check.
- The earlier settings-path failure is separate and already diagnosed: the original LocalAppData ancestor failed the existing configuration-access guard; the owner-approved copy under `.codex/krakinai-bridge` passes the exact compiled guard. Preserve that guard and the corrected live configuration.
- Current installed desktop Codex executable reports `0.166.0-alpha.5.1`. Previous signed acceptance primarily demonstrated installed CLI `0.73.0`; this correction must exercise multiple clients and the actual desktop path separately.

## Approaches

| Approach | Trade-off | Decision |
| --- | --- | --- |
| One exclusive adapter with manual chat selection | Keeps exclusive ownership, but requires another selection step and does not deliver the owner's chosen shared-chat workflow. | Not selected. |
| Existing native launcher acts as a bounded shared broker over its protected pipe | Reuses the signed native boundary, relay and tool dispatcher. Needs explicit membership, routing, queue and last-client-loss behavior. No additional port or credentials. | Proposed implementation of the selected shared-access workflow. |
| Add a separate HTTP MCP broker/service | Can multiplex sessions, but adds a listener, credential lifecycle and process boundary alongside the existing native transport. | Unnecessary for this fix. |

Keep Windows Forms/.NET 10, Node 22, the locked MCP SDK and existing dependencies. Do not add an AI backend, cloud service, installer, autostart, paid dependency, or model-visible process-control tool.

## Shared consent and its limits

All accepted adapters for the same launcher installation share the **current applied browser permissions**. Selecting a project does not grant full prompts, Character identities, private notes, filenames, new-project creation or proposal submission unless their existing independent permissions are enabled.

Closing one chat is not a global Disconnect while other initialized adapters remain connected. Submitted proposals remain reviewable within the continuing shared session; closing a chat does not withdraw a proposal. No per-chat permission or proposal-ownership system is introduced. Requests that lost their caller must never be reported as confirmed success; existing proposal-status, receipt recovery and replay protection remain the way to confirm outcomes.

Windows pipe checks authenticate the same Windows user/session/elevation and signed native channel. They do not attest a particular chat or prove the invoking application is Codex. Another local MCP client configured for this same installation and accepted by the existing checks would share the same scope. Separate installations/configurations are needed for independent consent. Do not describe the installation ID as a secret or an application-vendor credential.

Browser Disconnect, permission changes, pairing expiry, Stop, Restart and host failure keep their existing authorization effects. Sharing never grants access merely because another adapter initializes.

## Native broker and client membership

Replace the single `active` field with a bounded registry of authenticated clients. Propose **8 admitted adapters**, with at most one additional pipe slot available to return an actionable capacity rejection. Retain CurrentUserOnly, FirstPipeInstance and `PipeIdentity` validation on every connection, plus the signed headless role's server PID/token checks. No remote pipe or elevation fallback.

An unauthenticated or uninitialized peer never counts as a connected MCP client. Retain the five-second hello/initialization bound, five-second heartbeats and fifteen-second stale deadline. Capacity rejection, malformed input, identity mismatch or a stalled peer must close only that peer while other initialized clients remain healthy. Failed/pre-initialized peers cannot stop an otherwise manually started bridge.

Serialize membership transitions and aggregate controller updates with one asynchronous membership gate. Do not hold a registry monitor while awaiting I/O. Count exactly those clients that successfully sent SDK initialization and are not closed. Set aggregate MCP-connected state to `initializedCount > 0`.

The transition from a positive initialized count to zero must complete the existing host Stop/revocation before a competing initialization can complete its membership transition. A new adapter arriving during that stop may establish an MCP connection afterward, but it cannot cancel the stop, revive the old host generation or restore browser consent. Explicit Start and fresh pairing remain necessary. Adding a second client, or losing one of several clients, must not issue a false disconnected transition to the controller.

There is still one native controller and one owned Node host. MCP initialization, heartbeat, capacity rejection and membership changes cannot Start or Restart it.

## Routing, cancellation and resource bounds

Use a new server-generated internal route ID for each accepted pipe connection. An adapter-supplied `connectionId` is validated within its own pipe but is not trusted as a globally unique route. Before forwarding a call to the managed host, replace its connection ID with the internal route ID. Validate the returned route/request/generation and restore the adapter's external ID only when writing to that adapter's own response stream.

This prevents reused request IDs or external connection IDs on two pipes, including reconnects, from delivering a response to the wrong caller. The managed host already keys pending requests by `(connectionId, requestId)`; retain that tuple and its late-result retirement rules. No model-controlled field selects another adapter's response pipe.

On client close, cancel its local pending waits, close its pipe, release unsent queue reservations and retire its internal route. A call already forwarded to the managed host retains its aggregate work reservation until a terminal reply or whole-host shutdown. Do not free that credit merely because its caller left. Late replies must release the retained credit and be discarded or rejected under the retirement rules, never routed to a replacement client. An operation already delivered to the browser is subject to existing transaction semantics; cancelling a transport wait cannot undo a committed transaction or manufacture a success response.

Do not let one client's cancellation interrupt a shared-host frame midway through writing. Before transmission begins, an unsent call can be cancelled without forwarding. Once writing starts, use the host lifetime and a bounded transport deadline, independently of the caller's local wait. A partial/failed shared-stream write is a whole-host integrity failure, not permission to append another client's frame to uncertain bytes. Keep the caller's existing fifteen-second tool wait. Propose a twenty-second maximum lifetime for a forwarded reservation, allowing a bounded grace period for the existing browser/relay timeout to return its terminal result; an unacknowledged reservation beyond that is a host-health failure that stops the host and revokes the shared session.

Preserve **16 aggregate admitted calls** to the host, including forwarded work whose caller disconnected, not 16 multiplied by the number of clients. Keep the existing per-client bound as an additional ceiling, the 1.25 MiB frame bound, 512 KiB result bound, exact schemas, tool allowlist, rate limits and caller deadlines. Return a correlated bounded error on capacity exhaustion at both the broker and managed-host layer rather than truncating output or converting legitimate overload into a host-wide protocol crash. Malformed protocol input remains an integrity error.

Introduce a broker-wide **8 MiB outgoing queue budget** shared by client writers. Validate and reserve before enqueueing; release exactly once on success, cancellation or exception. Existing writer serialization remains per stream. Adding peers must not multiply the launcher's queue allowance. Reader buffers remain individually frame-bounded, with a fixed maximum number of admitted/handshaking peers; measure actual peak memory rather than describing a queue cap as total process memory.

A non-reading client must not block status fan-out or healthy clients indefinitely. Bound status writes to five seconds, coalesce unsolicited status to the latest pending state per client, and avoid unbounded background status tasks. Keep tool waits bounded by their existing deadline. A writer failure closes that client; if it was the last initialized client, use the last-client-loss rule.

## Compatibility and visible behavior

Retain the current `krakinai.launcher.v1` frame shapes and the same 13 MCP tools. Client counts are native presentation state, not additional fields silently inserted into the strict v1 status envelope. The adapter's `mcp` boolean remains aggregate connected state; its own initialization/hello gates still control its own forwarding.

Preserve settings format 1 and explicit origins/ports. Do not migrate or replace the user's existing files automatically. Older releases remain unchanged. The new release and MCP adapter/configuration must be reviewed and activated together through the established explicit setup flow.

The native window should show **MCP clients: Connected (N)** for initialized peers, alongside Bridge and Browser indicators. Add concise text that connected clients share applied browser permissions. The browser connection/permission help should state the same sharing rule without exposing client IDs or library contents. A full client-management UI and per-chat naming are out of scope.

Replace routine `CLIENT_ALREADY_CONNECTED` warnings with normal membership handling. Retain real identity/protocol failures and add a capacity-specific message, such as `MCP_CLIENT_LIMIT`. Healthy clients must remain visible as connected while another peer is refused. Show actionable errors without raw child stderr, prompts, proposal bodies, tokens, pairing material or filenames.

## Verification and acceptance

All development and write testing uses isolated synthetic settings, origins, relay ports and browser profiles. Do not stop the user's current R3 launcher, disconnect their browser, edit their global Codex configuration or clear profiles to make tests pass.

1. **Native membership:** two and three initialized adapters coexist; the ninth is refused without replacing a peer; hello-only clients do not inflate the count; malformed, wrong-identity and stale peers are isolated; disconnecting one leaves others usable; losing the last initialized client stops the owned host and revokes pairing. Test initialization racing the final disconnect and delayed Stop completion.
2. **Routing:** concurrent requests from different clients reuse the same request ID/external connection ID, complete out of order, and return only to their originating stream. Test cancelled/reconnected clients, late results, wrong generations, duplicate requests within one pipe, and retired routes.
3. **Bounds:** prove the aggregate sixteen-request limit and shared eight-MiB writer budget under multiple clients, including blocked writers and cancellation. Closing a caller with dispatched work cannot free capacity early; terminal results release it. Test cancellation during a shared-stream write and expiry of an orphaned reservation. Heartbeats/status and healthy clients remain responsive. Keep malformed/frame/result/unknown-method rejection tests.
4. **Permission and approval behavior:** all clients see only the same explicitly granted synthetic project/assets. Unshared projects and disabled text/identity fields remain unavailable. Submission creates no database writes before actual browser Apply. One client can submit and another retrieve the proposal's status/confirmed receipt. Replay creates no duplicate scenes; original scenes, preferred takes and media hashes remain equal. Browser Disconnect and Stop revoke every client.
5. **Actual installed Codex:** use the installed `0.166.0-alpha.5.1` app-server/CLI in an isolated Codex home with the existing loopback model fixture. Exercise a discovery connection plus multiple loaded thread/client connections where supported by the actual installed protocol, and correlate every real tool response with its own call ID. Retain failed attempts. A synthetic SDK client alone is not desktop acceptance.
6. **Actual desktop:** after a signed release is ready, perform an explicitly authorized, user-visible desktop smoke check with multiple chats. Verify actual tool availability and status responses, not only Enabled toggles, process counts, open ports or a Connected indicator. Use a separately configured synthetic KRAKINAI session for write acceptance; any real-library check is read-only and limited to connection status. Temporary desktop registration requires its own reviewed activation approval; do not silently add it to global settings.
7. **Regression:** run the complete existing application, bridge, native and QA/evidence suites; typecheck, build, production audits and synthetic browser smoke. Keep required CI checks enabled and verify hosted CI against the final signed commit. Report actual counts, skips, warnings, memory observations and supported-client limitations separately.

## Release, signing and data preservation

Build into a NEW ignored release directory. Never overwrite R3, its signed executable/helper, live `bridge/dist`, current private settings, desktop shortcuts or production MCP registration during development. Reuse a helper signature only if its exact signed file and source body remain identical and Authenticode is Valid. A changed native executable requires a concrete unsigned hash, owner review and explicit local signing; no key export, automatic trust import or AllSigned bypass.

Prepare a separate feature PR against master, with this shared-session behavior and its intentional disconnect semantics explained. Keep it unmerged until approval. The design and later implementation remain on this feature branch; PR #34 is already merged and is not amended.

When approved for activation, create a new private configuration and reviewed shortcut for the signed release, with an explicit rollback path to the retained R3 release. Ask the owner to complete native pairing and any actual browser approval themselves. No real-library test imports or automatic approvals.

## Remaining limits and decisions left to implementation

Same-user/administrator compromise, malicious browser extensions and compromised same-origin scripts remain outside the existing protection model. Shared access is a deliberate consent scope, not isolation between chats. A single chat can encounter the aggregate queue limit; per-chat scheduling/fairness is a follow-up rather than a reason to raise limits.

Implementation may choose internal collection types, precise synchronization decomposition and test utility structure, provided the observable membership, last-client-loss, routing, queue and consent guarantees above hold. No production bypass or test-only method belongs in the native runtime. If actual desktop tool availability still fails after broker sharing works, retain that as an unresolved acceptance failure and investigate it separately.
