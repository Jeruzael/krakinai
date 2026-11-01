# KRAKINAI desktop/tray bridge launcher

Date: 2026-11-01
Status: Proposed design; implementation requires owner review.
Branch: `codex/desktop-bridge-launcher`, based on merged B3/master.

## 1. Intent and agreed scope

Replace repeated terminal commands with a small Windows application containing Start, Stop, Restart, useful error messages, and independent bridge/browser/MCP indicators. The owner selected the desktop/tray approach before adding controls to KRAKINAI itself, and requested a visual mockup. This is a launcher and local transport integration, not a replacement for the browser application.

Keep the existing library in its original browser/profile and exact origin. The launcher neither opens IndexedDB nor imports, exports, migrates, edits, or deletes library records. Preserve scene immutability, reference packs, assemblies, drafts, backups, limits, and Stage B's approval transaction. PR #12 and unrelated checkouts are outside scope.

## 2. Approaches and engineering decisions

| Approach | Trade-off | Decision |
| --- | --- | --- |
| Desktop shortcuts or a GUI that merely starts the existing Node command | Smallest UI, but the manually owned stdio process still has no Codex client attached; misleading as a complete solution. | Insufficient on its own. |
| Native desktop/tray launcher plus a persistent stdio MCP adapter and private Windows IPC | Gives independent manual process control and a genuine Codex connection without browser extensions or a new web control endpoint. Requires a small transport boundary. | Owner selected desktop/tray; this architecture is the implementer's proposal. |
| Browser Start/Stop controls backed by a native companion | Adds protocol registration/browser launch handling before the basic workflow is proven. | Follow-up after the launcher works. |

Proposed implementation choices: C# Windows Forms targeting `net10.0-windows`, with NotifyIcon and no third-party UI packages; Node 22 and the locked existing MCP server SDK for transport. The development machine has .NET SDK 10.0.402 and Windows Desktop runtime 10.0.13. Use a framework-dependent Windows x64 build initially, with an explicit prerequisite check. A self-contained installer, automatic updates, Windows service, startup tasks, Electron/Tauri conversion, and non-Windows support are excluded.

This is a project-sized change because independent lifecycle control requires IPC, even though the window itself is small. The native choice and defaults below are proposed engineering decisions, not additional owner instructions.

## 3. Components and ownership

```text
Codex -> stdio MCP adapter -> native channel -> private pipe -> native launcher
                                                           |
                                                    owned Node host
                                                           |
                                             existing authenticated HTTP relay
                                                           |
                                      original KRAKINAI browser/profile
```

1. **Native launcher:** owns the tray/window, local settings, one Node host and its verification-helper descendants. Native UI actions alone control Start/Stop. A Windows job object tracks owned descendants and closes them if the launcher exits/crashes; never kill a process discovered by its port or PID alone.
2. **Managed Node host:** a separate production entry that reuses `createRelay()`, `windowsVerifier()`, existing validation, and `relay.dispatch()`. It has no injected-verifier or bypass flag. Communicates only with its owning launcher over redirected, bounded stdin/stdout. Keep the existing direct `krakinai-mcp.mjs` entry working for current users/tests.
3. **Stdio MCP adapter:** Codex launches this small entry using its normal MCP configuration. It initializes the existing 13 tool definitions even when the launcher/bridge is stopped. Calls are forwarded through the private pipe to the existing dispatcher; there are no new model-visible start, stop, approve, filesystem, or shell tools. Share tool registration/serialization rather than duplicating input schemas or rules.

For mutual Windows pipe identity checks without Node FFI dependencies, the same signed native executable has a headless `--stdio-channel` role. The adapter starts that fixed local executable with the configured pipe ID and exchanges bounded RPC frames through redirected stdin/stdout. This role is only a pipe client: no UI, mutex ownership, settings writes, process control, or implicit launcher startup. Use .NET CurrentUserOnly on both pipe ends. Adapter initialization never waits on the channel; bounded reconnection attempts (no more than one per five seconds) can establish it after the person opens the launcher. Include the native executable path in the reviewed MCP setup snippet.

The adapter must not start the native launcher or bridge implicitly. Before startup, status reports disconnected and other calls fail with the existing disconnected/pairing-required semantics. After the person presses Start, tools can reach the host without restarting the stdio server. First-time MCP registration/client reload remains an explicit setup step and does not constitute browser authorization.

## 4. Private IPC and process boundaries

Use one named-pipe instance per configured launcher installation, with a generated nonsecret installation ID stored in per-user launcher settings. Copy this exact pipe name into the generated MCP configuration. Pipe names accept only the fixed application prefix and validated ID. A single-instance mutex ensures a second launcher opens/focuses the existing window rather than creating another bridge.

The server uses asynchronous `NamedPipeServerStream` with `CurrentUserOnly` and `FirstPipeInstance`; verify the connecting Windows token matches the current user and elevation. Require normal unelevated operation for the first release; do not elevate or loosen ACLs to resolve a mismatch. Reject remote/network pipe access and unexpected identities. Validate the pipe server identity from the adapter using Windows pipe-server PID/token checks before transmitting tool payloads. The installation ID is routing metadata, not a bearer secret.

Use versioned UTF-8 frames with an enforced byte limit before parsing. Permit only adapter hello/initialized/heartbeat, connection metadata, and existing tool request/result envelopes on the public pipe. Match request IDs, host generation and adapter connection ID; reject extra fields, unknown methods, wrong versions, duplicate IDs, and late results. Start/Stop/settings are not pipe operations. Parent-only host control messages travel on the private child stdin, not the adapter pipe.

Bounds: reuse the 1.25 MiB transport frame and 512 KiB result bounds, 16 pending requests, existing tool rate/deadline limits, and an 8 MiB aggregate IPC queue. Enforce bounds at every hop, stream frames, apply backpressure, and reject rather than truncate. The launcher only routes in-memory tool payloads; it does not display or persist their contents. No pairing key, authentication transcript, full prompt, scene text, asset text, or receipt body enters diagnostics.

Only one initialized MCP adapter controls a launcher connection at a time. Reject a second with an actionable client-conflict message; do not replace the first silently. A five-second heartbeat with a 15-second stale deadline clears MCP-connected state. Adapter loss or protocol failure stops the owned host, revokes its session, fails pending calls, and requires explicit Start and fresh pairing. Reconnection cannot revive pending requests, proposals, scopes, or approval.

## 5. Controls, indicators, and lifecycle

Default behavior is manual startup: opening the launcher does not start Node, pair, launch Codex, or grant permissions. Settings and the IPC listener may be available while the bridge is stopped.

| Indicator | Evidence required |
| --- | --- |
| Bridge: stopped / starting / running / stopping / error | The exact owned host's startup acknowledgement and live process generation; an occupied port is insufficient. |
| Browser: not paired / pairing / paired / expired | Narrow lifecycle events from the existing relay; paired only after authenticated session confirmation. No library counts or content required. |
| MCP client: not connected / connected / stale | SDK `oninitialized` notification plus an authenticated local pipe connection/heartbeat; launching Node or initializing a local test client is insufficient. |

Start runs readiness checks, then starts the owned host at the exact configured origin and relay port. Stop is idempotent: reject new forwarding, gracefully close the relay/session/challenges and cancel pending requests, wait up to five seconds, then terminate only owned descendants if necessary. Restart is Stop then Start and requires fresh browser pairing. Never promise that shutdown reverses a Stage B transaction already past its authorization boundary; existing committed records/receipts remain intact.

The window provides Start, Stop, Restart, connection addresses, Settings, Copy App Address, and Copy MCP Configuration. Enabled states follow the lifecycle. Closing the window minimizes to tray, with a clear notice that the bridge continues running. The tray menu has Open Launcher, Start, Stop, Restart, and Quit & Stop Bridge. Quit performs the same shutdown. A duplicate launch focuses the existing window. No tray action displays, copies, or approves a pairing key.

Use native keyboard navigation, meaningful accessible names and text statuses, focus restoration for dialogs, and a keyboard-accessible tray menu. Verify readable layout at 100% and 200% Windows scaling and high contrast; status must not depend only on color.

Display named, actionable errors: port occupied by an unmanaged process, missing/wrong Node version, missing build/runtime/helper, invalid signature, untrusted publisher, policy restriction, mismatched user/elevation, IPC version/identity/client conflict, native verification failure, and host crash. Use known paths/codes, not raw child stderr. Do not inspect unrelated process command lines or automatically close the older bridge on 4177. The owner can stop it in its terminal or choose a different relay port.

## 6. Settings, certificate trust, and signing

Settings contain only the approved local Node/build paths, exact application origin, explicit relay port, installation ID, and approved public signer identities. Store atomically under a per-user local-app-data directory with owner-restricted access. Do not store pairing secrets, scopes, library data, or AI credentials. Apply settings only while stopped, validate paths/versions, and never resolve executable paths from browser/model content. Initial suggested values are the existing localhost origin and explicit port 4180; no port scanning/fallback. Copy App Address lets the person paste into their established browser/profile rather than silently opening a potentially empty default profile.

Before Start, verify the helper's Authenticode status **and** publisher trust in a fresh Windows PowerShell process running under the same actual launch identity/environment as native verification. A valid signature alone is insufficient: the observed manual failure had `Valid` but `TrustedPublisher: false`. Treat user/LocalMachine trust stores according to actual policy; fail visibly on a managed-policy denial. Preserve AllSigned, avoid unsafe inherited Node/PowerShell options, and forward only required Windows profile/temp/path environment fields.

Persist the already proven native-window visibility correction in the tracked helper source, so a rebuild does not silently lose it. The window should initially be visible/on top, show in the taskbar and activate; release topmost after revealing the key. Native approval and browser confirmation remain manual. Never mark the comparison checkbox, choose Allow, import certificates, modify trust, or sign automatically.

Existing authorization covered the prior helper and ignored QA driver. Signing the new launcher executable is an additional artifact: prepare its reviewed unsigned hash and an exact local signing command for explicit owner authorization/manual signing at the release step. Do not export/access the key preemptively. Build before signing; verify final helper and launcher signatures after all byte changes and before native certification. Local signatures, certificates, binaries, profiles, settings, and reports stay out of Git. CI can test unsigned isolated artifacts but cannot certify local trust or supply signing credentials.

## 7. Browser authorization and storage invariants

Keep existing origin checks, loopback binding, cryptographic pairing, HMAC/replay/expiry checks, 13-tool allowlist, scope filtering, and Stage B write guard. The managed host uses the same relay/dispatcher rather than reimplementing authorization. Lifecycle telemetry exposes only enum/boolean status and configured addresses. The native controller has no library database API and cannot approve a proposal.

Stop, restart, launcher/host crash, client loss, or wrong IPC generation must not resurrect consent. In-flight authorized browser transactions may complete under existing semantics; earlier unapproved requests cannot commit. Fresh pairing and exact permission selection are always required after restarting the host. No new project/asset/scene writes or browser-record migrations are part of installation or setup.

## 8. Verification and release evidence

- Unit/transport tests: lifecycle transitions, duplicate Start/Stop, serialized Start/Restart/Stop, ownership/PID reuse and job cleanup, status evidence, identity/elevation/remote rejection, frame/queue limits, malformed input, cancellation, correlation/generation/heartbeat, second clients, and no implicit startup/model-visible control methods.
- Native tests: startup from a fresh unelevated desktop context; helper `Valid` but publisher untrusted; valid/trusted helper; invalid signature; missing Node/runtime/build; conflict with an unrelated synthetic listener left intact; duplicate launcher; tray close versus Quit; crash and orphan cleanup. Use signed helpers and explicit disposable test directories. No deletion of QA profiles or other test paths without exact owner authorization.
- Installed Codex CLI 0.73.0: actual stdio adapter initializes with launcher absent/stopped, Start becomes reachable, signed native pairing, scoped synthetic reads, proposal with zero preapproval writes, actual browser review, immutable new revision and confirmed receipt, replay without duplication, old scene/preferred-take/media-hash preservation, Stop revocation, and explicit Restart/fresh pairing. Use the isolated loopback model fixture and correlate every tool response by call ID. Also test the actual desktop client's configured tool availability; document reload limitations separately.
- Browser tests: existing direct-entry regressions and managed transport at localhost and 127.0.0.1 in isolated synthetic profiles; actual real-user library remains untouched. Verify native focus/taskbar behavior separately from headless assertions. Preserve all existing suites, typecheck/build, production audits, QA reconciliation and hosted CI on the final signed Git commit.
- Report actual native/browser/CLI outcomes, counts, executable/helper hashes and signature status, screenshots, startup/stop durations and peak process memory. No unsupported platform or security-certification claims based on searches or simulated success.

Submit a separate tested PR, keep it unmerged, and keep the ZIP64 PR unchanged. No user-level Codex configuration or desktop shortcut is installed silently; provide a reviewed configuration/shortcut for the owner's one-time setup. Further installation/signing actions require concrete reviewed artifacts first.

## 9. Risks and follow-up

The IPC adapter adds a security boundary and must be tested independently of the small UI. Same-user/administrator compromise, malicious browser extensions, and compromised same-origin scripts remain outside the original bridge's protections. Windows identity/elevation mismatches, managed trust policy, blocked Node/native execution, and missing .NET runtime are supported error states, not reasons to weaken controls. Framework-dependent builds require the selected Windows Desktop runtime. Desktop tool registration may require a client reload; this is not solved by showing an open port as connected.

The visual mockup is a simulation with no bridge/network/library actions and is not evidence of a working native launcher. This design must be approved before product implementation. Browser Start/Stop integration, installer/autostart, multi-client/multi-origin support, and other operating systems remain follow-up work.

Independent builder check: a fresh Windows/Node/MCP reviewer reported "nothing important left" before owner review. Native accessibility checks were subsequently made explicit; no product implementation has started.

## 10. Sources checked

- Repository: `bridge/src/runtime.ts`, `server.ts`, `relay.ts`, `nativeVerifier.ts`, `bridge/native/verify.ps1`, `src/connections/`, and `docs/local-codex-mcp*.md`.
- Existing locked SDK exposes `server.oninitialized` only after the client's initialized notification; use that lifecycle signal, not process launch.
- [Official Codex MCP configuration](https://developers.openai.com/codex/mcp): stdio servers are configured by executable/arguments; setup is separate from browser pairing.
- [Microsoft PipeOptions](https://learn.microsoft.com/en-us/dotnet/api/system.io.pipes.pipeoptions?view=net-10.0): CurrentUserOnly includes user/elevation checks on Windows.
- [Microsoft NotifyIcon](https://learn.microsoft.com/en-us/dotnet/desktop/winforms/controls/notifyicon-component-overview-windows-forms): native tray icon/menu support.
