# Desktop Bridge Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The owner explicitly approved inline execution and waived an additional planning approval. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a native Windows tray launcher with manual Start/Stop/Restart, trustworthy status/error messages, and an actual Codex MCP connection independent of the bridge process lifecycle.

**Architecture:** A C# Windows Forms application owns an isolated Node managed host reusing the existing relay. A persistent Node stdio MCP adapter registers the same 13 tools and communicates through the native application's headless protected-pipe channel. Native controls alone manage processes; existing browser pairing, scopes and Stage B saving remain authoritative.

**Tech Stack:** .NET 10 Windows Forms/BCL, Node 22, existing locked MCP SDK, TypeScript/Vitest, existing Playwright and installed Codex CLI fixture.

**Spec:** `docs/superpowers/specs/2026-11-01-desktop-bridge-launcher-design.md` (approved 2026-11-01).

## Global Constraints

- Preserve actual browser records, original application origin/profile, immutable scenes, drafts, media, references, backups and all application limits.
- Keep AllSigned; never auto-import trust, export keys, automate real pairing/approval, or sign the additional native executable before artifact-specific owner authorization.
- Existing direct stdio entry remains compatible; same 13 model-visible tools, schemas, limits and dispatcher, with no model-visible process-control methods.
- Frame/result/pending/aggregate queue limits: 1.25 MiB / 512 KiB / 16 / 8 MiB. Five-second IPC heartbeats, 15-second stale timeout, five-second graceful Stop deadline.
- Manual startup, exact explicit origin/port, one adapter/controller, current-user/current-elevation local IPC only. No port scanning, process takeover or killing by discovered port/PID.
- No external model credentials, cloud backend, paid packages or additional UI dependency. .NET framework-dependent Windows x64 first release.
- Keep new builds under ignored QA/release output directories during development: do not replace the live `bridge/dist/` used by the owner's running bridge. No profile/file deletions without exact path authorization.
- Separate branch/PR, no merge; preserve PR #12, unrelated local work and global Codex configuration.
- Signing-required Git commits can be collected into the final reviewed signed commit rather than blocking every task on a passphrase prompt.

## Review Focus

1. Codex initializes before the tray exists: tools register immediately, no implicit native startup, and later explicit Start works without reconstructing the SDK server.
2. Restart/Stop races with delayed replies: correlate both request ID and host generation; old results and consent cannot enter a new session.
3. Current-user trust differs from the developer's environment: probe actual launch identity; `Valid` with an untrusted publisher must block Start visibly.
4. Launcher crash/PID reuse: put the owned host into a job before activating its relay; clean only owned handles and never unmanaged instances.
5. Chunked oversized/malformed IPC and absent consumers: streaming limits and bounded queues must hold before parsing/forwarding, with no raw payload logging.

## File structure

- `bridge/src/launcherProtocol.ts`: shared frame types, strict validation, bounded line decoder and correlation.
- `bridge/src/registerTools.ts`: reuse 13 existing SDK tool definitions/result encoding.
- `bridge/src/managedHost.ts`, `managedHostEntry.ts`: parent-owned host activation, existing relay/native verifier, status and shutdown.
- `bridge/src/stdioAdapter.ts`, `stdioAdapterEntry.ts`: MCP server and reconnecting fixed native channel client.
- `bridge/src/relay.ts`: optional content-free lifecycle callback; default/direct behavior unchanged.
- `bridge/build.mjs`, `bridge/test/stdio.test.ts`, `bridge/test/build.mjs`: configurable ignored build directory and new entries, preserving live output.
- `bridge/test/launcherProtocol.test.ts`, `managedHost.test.ts`, `stdioAdapter.test.ts`: focused unit/transport tests.
- `launcher/Krakinai.BridgeLauncher.csproj`, `Program.cs`: Windows executable with GUI and headless-channel roles.
- `launcher/Core/`: settings, lifecycle/controller, certificate/runtime readiness, job/process ownership, IPC framing/server/channel and sanitized errors.
- `launcher/UI/LauncherForm.cs`, `SettingsDialog.cs`: native controls, tray, accessible statuses and setup copy.
- `launcher/tests/`: package-free console test harness and synthetic process/IPC fixtures, separate from production entry.
- `bridge/native/verify.ps1`: source-level visibility fix matching the previously reviewed signed local helper.
- `scripts/qa/launcher-*.mjs`, `e2e/launcher-*.spec.mjs`, `.github/workflows/ci.yml`: reproducible build, synthetic native/CLI acceptance, CI and report generation.
- `docs/desktop-bridge-launcher*.md`, `docs/qa/desktop-bridge-launcher/`: operator setup, release/signing procedure and sanitized evidence.

## Task 1: Shared bounded protocol and relay/tool reuse

**Interfaces:** `LauncherFrame`, `validateLauncherFrame(value, direction)`, `LauncherLineDecoder.push(bytes): LauncherFrame[]`; `registerKrakinaiTools(server, dispatch)`; optional `RelayOptions.onState(state)` with only enum/boolean metadata.

- [ ] Write tests rejecting unknown/control methods on the adapter channel, oversized split frames/aggregate queues, mismatched IDs/generations, malformed UTF-8, and exposing no data in lifecycle events.
- [ ] Run focused Vitest and record red results before implementation.
- [ ] Implement shared protocol/registration and additive relay callbacks. Reuse existing schemas/limits/errors; do not duplicate tool authorization.
- [ ] Run focused and legacy relay/stdio tests; verify the 13-tool list/outputs remain equivalent.

## Task 2: Managed host and isolated build outputs

**Interfaces:** `runManagedHost(options, io)` waits for `activate` before binding; `dispatch` maps only to existing `relay.dispatch`; `shutdown` closes relay before acknowledgement. Production entry supplies only the real Windows verifier. `build.mjs --outdir <explicit-directory>` defaults to existing dist, but development/tests select a separate ignored directory.

- [ ] Add failing tests: no network/native child before activation; shutdown closes pending calls; bad generation rejects; new host cannot return old results; no injected verifier CLI flag.
- [ ] Implement the managed host and build entries with unchanged direct entry support.
- [ ] Build into an ignored launcher-specific directory; adapt test fixture paths with a task-specific environment override.
- [ ] Verify existing live compiled-helper hash/output is unchanged by these commands. Preserve the visibility fix in tracked source; use/sign an equivalent isolated helper only with appropriate authorization.
- [ ] Run managed-host and existing bridge tests.

## Task 3: Windows controller, containment, readiness and configuration

**Interfaces:** `LauncherSettings.Load/Save/Validate`, `BridgeController.StartAsync/StopAsync/RestartAsync`, immutable `LauncherStatus`, `ReadinessProbe.CheckAsync`, `OwnedJobProcess`.

- [ ] Write package-free .NET tests for invalid settings/origins/ports, missing runtime/build, untrusted/invalid signatures, duplicate actions and concurrent Start/Stop/Restart.
- [ ] Implement one-identity local configuration with atomic writes and no secrets; explicit executable/build path review and environment allowlist.
- [ ] Implement host startup gate: start child suspended in behavior (host awaits activate), assign owned job, then send activate. Job failure exits before relay/native activation. Use job handles, not discovered PIDs, for forced cleanup.
- [ ] Probe Authenticode and publisher trust in the actual child identity/environment. Production entry uses real readiness; test fakes stay in the separate harness.
- [ ] Verify port-conflict handling leaves an unrelated synthetic listener intact; ownership/crash/late-output tests pass.

## Task 4: Protected Windows IPC and native headless channel

**Interfaces:** `LauncherPipeServer`, `NativeChannel.RunAsync(pipeId)`. Use CurrentUserOnly on server/client, FirstPipeInstance, local PID/token checks, one controller, strict version/role frames, 8 MiB aggregate queue and 1.25 MiB streaming frame bound.

- [ ] Write failing same-identity interoperability, wrong role/version/client, second-controller, partial/oversized frame, stale heartbeat/generation and cancellation tests.
- [ ] Implement private pipe and headless channel with no GUI/process-control/settings privileges in channel mode.
- [ ] Limit the external adapter channel to initialize/status/heartbeat/tool frames. Parent-only activate/shutdown never crosses it.
- [ ] On initialized client loss/staleness, stop the owned host and invalidate its pending session; do not restart automatically.
- [ ] Verify same-account/elevation native exchange; distinguish actual cross-identity tests from mocked negative cases.

## Task 5: Persistent stdio MCP adapter

**Interfaces:** `startStdioAdapter(options)`, channel reconnect interval >=5 seconds; initialized notification determines MCP-connected status. SDK stdout is protocol-only.

- [ ] Add failing SDK tests for initialization with absent/stopped launcher, same 13 tools, no startup side effect, bounded reconnect/deadline and request-generation correlation.
- [ ] Implement adapter using shared registration and the fixed signed executable's headless-channel role; validate explicit configuration rather than arbitrary model-supplied paths.
- [ ] Prove stopped-to-started-to-stopped lifecycle works without rebuilding the SDK client. Map disconnected/pairing-required results through existing exact result envelopes.
- [ ] Run actual installed CLI fixture calls with call-ID correlation; no external AI credentials or global Codex config changes.

## Task 6: Native window/tray and operator setup

**Interfaces:** `LauncherForm`, `SettingsDialog`, Start/Stop/Restart and three independent statuses backed by controller/relay/SDK evidence.

- [ ] Add native presenter/state tests for control availability, actionable port/trust/runtime/client messages, close-to-tray versus Quit, and no automatic pairing/trust/signing.
- [ ] Implement compact native UI matching approved mockup, tray menu, duplicate-instance focus and keyboard/screen-reader names. No user content/key UI or logs.
- [ ] Provide Copy App Address and reviewed Copy MCP Configuration; do not silently open a different browser profile or modify Codex configuration/shortcuts.
- [ ] Check keyboard/dialog focus, native tray behavior, 100%/200% scaling and high-contrast behavior in isolated synthetic tests. Keep unsigned UI checks separate from signed production acceptance.

## Task 7: Release packaging and end-to-end certification

- [ ] Package framework-dependent executable, managed host/adapter, production dependencies and helper into a NEW ignored release directory; never rebuild into the live bridge directory.
- [ ] Freeze reviewed artifact hashes and prepare exact owner signing commands for the additional executable/helper as needed. Preserve signing keys/certificates and AllSigned. No private-key use before artifact-specific authorization.
- [ ] Verify final signatures/publisher trust after signing, then use signed production entries and an isolated synthetic browser profile for actual Start, native pairing, scoped reads, no-write proposal, browser Apply, immutable revision/receipt, replay, Stop/Restart/revocation, crash/port conflict and stale-client cases.
- [ ] Test localhost/127.0.0.1 separately and preserve original scene/preferred-take/media hashes. Use installed Codex 0.73.0/loopback fixture, matching every actual response by call ID; no fabricated success or later-call substitution.
- [ ] Record native screenshots, actual durations/process memory, remaining platform/desktop-client limits and every retained test path; no unauthorized cleanup.

## Task 8: Regression, review and PR

- [ ] Run root tests/typecheck/build/production audit, bridge tests/typecheck/build/audit, native harness, committed browser tests and QA reconciliation. Preserve expected legacy output hashes.
- [ ] Obtain a fresh whole-branch review after inline implementation; fix substantive findings and rerun affected checks.
- [ ] Update operator/security/testing docs, sanitized machine-readable results and changed-file list. No certificates, binaries, secrets, profiles, real-library content or temporary QA artifacts staged.
- [ ] Prepare a concrete final Git diff and signed-commit command if local signing requires the owner; push the separate feature branch, open a PR and verify hosted CI for its exact signed head. Keep it unmerged.

Self-review: the plan covers all design sections, including the additional signing-artifact authorization and the live-output preservation constraint discovered during planning. Native tooling/IPC implementation remains inline; independent agents are for design/final review only.
