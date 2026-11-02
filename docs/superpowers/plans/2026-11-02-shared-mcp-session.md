# Shared MCP Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The owner explicitly selected inline implementation and waived another planning approval. Steps use checkbox syntax for tracking.

**Goal:** Make one manually launched KRAKINAI bridge usable by multiple Codex adapters under the same explicit browser permissions.

**Architecture:** The existing signed native launcher becomes a bounded broker for up to eight authenticated adapters. It preserves one managed host and shared browser session while routing each pipe independently. Aggregate request credits survive caller cancellation until the dispatched work terminates; only loss of the final initialized client triggers shared-session shutdown.

**Tech Stack:** Existing C#/.NET 10 Windows Forms, Node 22, TypeScript, locked MCP SDK, Vitest, Playwright and native console harness; no new dependencies.

**Spec:** [Approved design](../specs/2026-11-02-shared-mcp-session-design.md).

## Global Constraints

- 8 admitted adapters, at most one additional handshaking/capacity-rejection pipe slot.
- 16 aggregate admitted host calls, including forwarded work whose caller disconnected.
- 1.25 MiB frame, 512 KiB result, 8 MiB broker-wide outgoing queue; exact payloads or errors, never truncation.
- Five-second handshake/initialization and status-write bounds, five-second heartbeats, fifteen-second stale/caller deadlines; twenty-second forwarded-reservation health deadline checked on the bounded host-monitor cadence.
- Preserve strict `krakinai.launcher.v1` wire shapes, settings format 1 and the existing 13 tools. Client counts stay native presentation state.
- Same user/session/elevation and signed executable identity checks remain mandatory. No native/model process-control API, auto Start, imported trust or AllSigned bypass.
- Browser permissions and Stage B approval/atomic save stay authoritative; storage, assemblers, immutable outputs and backups are unchanged.
- Use new synthetic origins/settings/profiles/build outputs. Do not stop the live R3 launcher or edit the current global MCP configuration during development. Keep R3, its signatures and real browser data intact.
- Owner-terminal Git signing and artifact-specific executable signing remain required. Keep verified task checkpoints locally until the final reviewed source can be signed; never substitute unsigned commits or access/export the key.

## Review Focus

- A discovery peer initializes or disconnects during another client's final shutdown: never revive the old host generation or browser consent. Pin in Task 3.
- Two peers reuse external IDs and complete out of order: never return another caller's result or late reply. Pin in Tasks 2–3.
- A caller disappears after forwarding or midway through a shared write: do not free credits early or corrupt the shared stream. Pin in Tasks 1–2.
- A live peer stops reading while others work: bounded status fan-out/queues and prompt Stop remain functional. Pin in Tasks 1 and 3.
- Native/SDK tests pass while the desktop still lacks tools: retain actual installed-client/desktop acceptance as separate gates, not inferred from a green indicator. Pin in Task 5.

## Files and responsibilities

- `launcher/Core/FrameQueueBudget.cs`: shared, thread-safe byte reservations with exactly-once release.
- `launcher/Core/FrameCodec.cs`: writer uses an optional shared budget and supports a guarded begin-write boundary.
- `launcher/Core/HostRequestLedger.cs`: sixteen-call admission, separate caller/result lifetime, internal-route correlation, terminal retirement and health expiry.
- `launcher/Core/ManagedNodeHost.cs`: consume ledger, protect a started shared write from caller cancellation, monitor orphaned work.
- `launcher/Core/LauncherPipeServer.cs`: bounded peer registry, initialization counts, per-peer routing/status/cancellation, last-client transition serialization.
- `launcher/Core/BridgeController.cs`: aggregate initialized-client count and existing explicit lifecycle ownership.
- `launcher/Core/LauncherPresentation.cs`, `launcher/UI/LauncherForm.cs`: connected-client count, sharing notice and capacity guidance.
- `bridge/src/managedHost.ts`: recoverable overload without a host protocol crash.
- `bridge/src/stdioAdapter.ts`: capacity diagnostic if needed, preserving existing SDK registration/initialization rules.
- `launcher/tests/SharedSessionTests.cs`, `launcher/tests/Program.cs`: native regressions and registration in the existing harness.
- `bridge/test/managedHost.test.ts`, `bridge/test/stdioAdapter.test.ts`: transport/overload regressions.
- `src/components/aiConnections/ConnectionPanel.tsx`: concise shared-permission notice; no new browser authority or persistence.
- `scripts/qa/shared-mcp-workflow.mjs`, `scripts/qa/shared-mcp-workflow.test.mjs`: isolated installed-Codex acceptance/evidence validation.
- `docs/desktop-bridge-launcher.md`, `README.md`, new `docs/shared-mcp-session-qa.md`: setup, intentional disconnect behavior and actual final evidence/limitations.
- `.github/workflows/ci.yml`: include new evidence-helper tests if necessary; preserve required Linux/Windows suites.

## Task 1: Bounded shared writers and admitted-work lifetime

**Files:** Create `FrameQueueBudget.cs`, `HostRequestLedger.cs`, `launcher/tests/SharedSessionTests.cs`; modify `FrameCodec.cs` and native harness registration.

**Interfaces:**
- `FrameQueueBudget(int limit = FrameCodec.QueueBytes).Reserve(int bytes): IDisposable`: reject invalid/over-capacity reservations and release once.
- `FrameWriter(Stream, FrameDirection, FrameQueueBudget? sharedBudget = null)`; existing `WriteAsync(JsonElement,CancellationToken): Task` remains.
- `FrameWriter.WriteIfAsync(JsonElement,CancellationToken,Func<bool> beginWrite): Task<bool>`: evaluate the guard under the stream write lock; false sends no bytes.
- `HostRequestLedger(TimeProvider? clock = null)`; nested production `Pending` exposes its completion task and whether writing began.
- `Reserve(JsonElement): Pending`, `TryBeginWrite(Pending): bool`, `CancelCaller(Pending,CancellationToken): void`, `RejectUnsent(Pending,Exception): void`, `Complete(JsonElement): void`, `HasExpired(): bool`, `Close(Exception): void`.

- [ ] Write regressions proving that two writers share one eight-MiB allowance; cancellation/error releases credits; a false begin guard writes no bytes; a blocked client cannot consume an unbounded queue.
- [ ] Write ledger regressions: the seventeenth call is rejected; cancelling an unsent call frees its slot; cancelling a dispatched call does not; its terminal result frees the slot without delivering success to the departed caller; wrong/duplicate/retired routes cannot satisfy a fresh call; the twenty-second health deadline is independent of the caller wait.
- [ ] Run the native harness and observe the missing behavior fail before implementing it. Preserve relevant existing cases.
- [ ] Implement the interfaces with bounded dictionaries/retirement and monotonic time. No payload logging or test-only runtime methods.
- [ ] Run the native harness to green. Record the exact result and source diff checkpoint.

## Task 2: Protect the managed host under cancellation and overload

**Files:** Modify `ManagedNodeHost.cs`, `bridge/src/managedHost.ts`, `bridge/test/managedHost.test.ts`; extend native tests/fixtures.

**Interfaces:** Consume Task 1's writer/ledger. `ManagedNodeHost(TimeProvider? clock = null)` retains `IManagedHost` methods. Admission and caller-wait lifetime are independent of the shared-stream send lifetime.

- [ ] Add a failing test that one caller's cancellation while a frame is queued sends nothing; after writing begins it cannot interrupt the frame or redirect the reply. Keep a second caller's result usable.
- [ ] Add failing tests retaining dispatched reservations after cancellation, admitting no more than sixteen outstanding operations, releasing on terminal reply, and failing the whole host on a genuinely expired orphan or corrupted shared-stream write.
- [ ] Add a managed-host test that valid capacity exhaustion returns a correlated `QUEUE_FULL` result and the host can serve another request afterward. Invalid protocol still fails.
- [ ] Run the targeted native/bridge tests to demonstrate failures.
- [ ] Integrate the ledger and a bounded health monitor. Do not pass an individual caller's cancellation into a shared write once it begins. Complete/release retained reservations when responses arrive or the host closes.
- [ ] Keep existing activation/shutdown validation, generation checks, sixteen-slot bound, owned Windows job cleanup and result retirement protection.
- [ ] Return recoverable capacity results from the Node layer without raising its limits.
- [ ] Run targeted native/bridge tests to green, including old lifecycle and late-result cases.

## Task 3: Multiple authenticated peers and last-client revocation

**Files:** Modify `LauncherPipeServer.cs`, `BridgeController.cs`; extend `SharedSessionTests.cs` and update existing native cases to the approved shared behavior.

**Interfaces:**
- `LauncherPipeServer.MaximumClients = 8`; bounded admitted registry plus one rejection slot.
- `LauncherStatus` gains native-only `McpClients` count. `BridgeController.SetMcpClientCountAsync(int): Task` validates `0..8`, sets aggregate Boolean state, and stops on a positive-to-zero transition.
- Existing v1 public-pipe status objects retain their exact fields. Native-only count must not leak into their serialization.

- [ ] Add failing tests for two/three initialized clients sharing one manually started fake/owned host; the ninth receives a capacity error without replacing anyone; preinitialized peers do not inflate the count.
- [ ] Add failing tests for same external connection/request IDs, reversed completion order, cancellation/reconnect with late results, malformed/stale peer isolation and slow-reader status coalescing.
- [ ] Add failing races: one of two leaves while the other continues; the final client leaves while another initializes; delay Stop and prove the arriving client cannot restore the previous generation, pairing or automatic running state.
- [ ] Run red native regressions.
- [ ] Replace `active` ownership with the authenticated bounded registry and serialized asynchronous membership transitions. Preserve all `PipeIdentity` and frame checks.
- [ ] Give each peer a new server-owned route ID; normalize calls before forwarding and restore external IDs only to that peer's own response stream.
- [ ] Share Task 1's outgoing budget across peer writers. Bound/coalesce unsolicited status, enforce status-write deadlines, and cancel/drain only the closed peer.
- [ ] Stop/revoke once when the final initialized peer is lost; initialization arriving during that transition waits for completion. Ordinary second-client arrival is not an error.
- [ ] Run complete native tests to green; preserve single-client loss/Stop/Restart behavior as the one-member case.

## Task 4: Clear shared-session presentation and backward-compatible adapter behavior

**Files:** Modify native presentation/form, browser connection help, adapter diagnostics and their existing behavioral tests; update launcher documentation and README.

**Interfaces:** `LauncherPresentation.From` displays the actual initialized count; no wire/version or model-tool schema changes. Capacity is reported as `MCP_CLIENT_LIMIT` through existing typed error envelopes.

- [ ] Add failing native presentation tests for zero/one/multiple clients and genuine capacity errors. Add adapter regression coverage if a capacity diagnostic is added; keep default/legacy SDK initialization tests.
- [ ] Implement **MCP clients: Connected (N)** and explain that connected clients share applied browser permissions. Keep all native Start/Stop/settings actions and accessibility labels.
- [ ] Add the same concise consent clarification to existing browser help; no per-chat authorization controls or storage changes.
- [ ] Document that closing one chat leaves other initialized peers connected, submitted proposals remain reviewable during the shared session, and browser Disconnect/Stop/last-client loss revoke globally.
- [ ] Document dedicated private `--config` locations for ancestor-ACL rejection, with the standard security checks retained. Preserve existing files and installer/signing limitations.
- [ ] Run native/adapter tests, application unit suite, typecheck and build. Record existing warnings explicitly.

## Task 5: Isolated actual-Codex acceptance and reviewed signed release

**Files:** Create the shared MCP workflow/evidence helper and tests, update CI's helper-test command and QA documentation. Release candidates, settings, certificates, profiles and raw QA outputs remain ignored/outside Git.

- [ ] Add failing evidence-validator tests that reject missing/duplicate/wrong call IDs, a later successful response substituted for an earlier failure, synthetic fabricated success text, incomplete shared-client/approval/revocation cases and real-profile targets.
- [ ] Implement the harness with fresh synthetic data and an isolated Codex home. Use the actual installed app-server/CLI and existing loopback model fixture; determine exact protocol fields from its generated schema/help before using them.
- [ ] Exercise discovery plus multiple thread/client connections. Confirm per-call real responses, scope denial, concurrent/reused request IDs, one-client departure while others continue, and final-client revocation.
- [ ] Test proposal submission with zero pre-approval writes, actual synthetic browser review/Apply, immutable new scene/receipt, cross-client status/receipt retrieval, replay without duplication, old scene/preferred-take/media-hash preservation and global browser Disconnect/Stop denial.
- [ ] Run the full pre-sign automated checks and independent whole-branch review; fix material findings before preparing a release.
- [ ] Build into a NEW ignored release directory. Hash the unsigned native executable, compare the existing signed helper body, and verify its signature/trust without using a private key. Preserve R3 and the live compiled bridge.
- [ ] Present the concrete reviewed executable hash and local signing command for owner authorization/signing. Verify final Authenticode status as Valid before signed native acceptance.
- [ ] Run signed isolated native/actual installed-Codex acceptance. Native pairing remains a manual owner security step; automate no pairing-key reading, copying or Allow approval.
- [ ] Conduct actual desktop multi-chat tool-availability/status smoke separately. Any temporary synthetic MCP registration gets reviewed activation approval first. Never use the real library for write tests. Mark the PR draft and report a blocker if actual desktop acceptance remains incomplete.
- [ ] Run final full application/bridge/native/helper/QA/browser suites, typecheck, build and production audits. Inspect machine-readable counts and warnings.
- [ ] Stage only reviewed source, tests and docs; `git diff --cached --check`. Have the owner sign the final Git commit, push this feature branch, create a separate PR and verify both hosted jobs against that exact signed head. Keep the PR unmerged.

## Self-review

The five Review Focus cases are assigned to their owning test tasks. Every spec area maps to Tasks 1–5, including shared proposals, last-client revocation, response correlation, aggregate capacity, actual desktop evidence and signing. Native count is deliberately absent from the strict v1 frame schema. No new authorization rules, data migration or global configuration changes are part of development. Owner-approved inline execution proceeds directly from this plan.
