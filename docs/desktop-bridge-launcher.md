# KRAKINAI Windows bridge launcher

This launcher provides manual Start, Stop and Restart, a system-tray menu, and separate bridge, browser and MCP-client indicators. It does not install or replace the browser application, start its development server, or access its IndexedDB library.

## Installation and daily use

The first release is a **portable folder**, not an installer. Keep the executable and its adjacent `bridge` directory together in a stable local location. Windows x64, the .NET 10 Windows Desktop Runtime and an existing Node.js 22 installation are required. The executable and verification helper must have valid signatures from the approved publisher. A local development certificate is not a public-distribution certificate or a guarantee of SmartScreen reputation.

Double-click the executable or an explicitly created shortcut to open the launcher. It opens stopped. Configure the Node executable, packaged bridge directory, approved public signer thumbprint, exact application origin and explicit relay port in Settings. Settings save only while stopped. Their default location is `%LOCALAPPDATA%\KRAKINAI\BridgeLauncher\launcher-settings.json`; an explicitly selected `--config` file must be in an owner-controlled local directory. Shared or redirected configuration paths are refused without changing existing folder permissions.

Press **Start bridge** when needed. Keep using the browser/profile containing the library and its original origin, such as `http://localhost:5173`. `localhost`, `127.0.0.1`, different ports and different browser profiles have separate libraries. The launcher copies an address for you to paste; it does not choose a different default browser/profile.

Closing the window hides it to the tray. Opening the same launcher/configuration again restores the existing window. **Stop bridge** stops the owned bridge and clears its pairing session while leaving the launcher open. **Quit & Stop Bridge** stops the bridge and exits the launcher. Double-click its shortcut to reopen it afterward. Restart requires fresh browser pairing.

No shortcut, global Codex configuration, startup task, Windows service, certificate trust or execution-policy change is installed automatically. A normal installer and automatic startup are outside this release.

## Connecting Codex

Use **Review MCP configuration** to inspect the exact Node, adapter and settings paths before copying them into the intended Codex client. Registration/client reload is a separate explicit step; opening the launcher cannot register tools in an already-running client. The persistent stdio adapter registers the existing 13 tools while the launcher is stopped and reconnects to its private channel without starting a bridge.

The indicators have different meanings:

| Indicator | Evidence |
| --- | --- |
| Bridge running | The owned Node host acknowledged activation. An occupied port is insufficient. |
| Browser paired | The existing relay completed browser/native verification and session confirmation. |
| MCP client connected | The SDK received client initialization and the protected native channel remains live. |

An MCP client can be connected while the bridge is stopped and browser is not paired. Neither Start nor MCP initialization grants browser permissions. Select context and permissions in KRAKINAI, compare the signed Windows verification window, and complete its manual confirmation. Proposals still require the existing browser review and Stage B atomic save. The launcher never approves them.

Client loss, stale heartbeat, Stop, Restart or an owned-host failure clears the session. Reconnection does not restore consent or pending requests. An already-authorized browser transaction may finish under existing Stage B semantics; Stop does not undo committed records.

## Signing and updates

`node scripts/qa/launcher-release.mjs --output <NEW directory under qa-results/desktop-bridge-launcher/releases> --signed-helper <previously signed helper> --signer <approved public thumbprint>` builds an isolated candidate. It refuses an existing destination, compares the signed helper's body with source, checks its signature, installs only locked production bridge dependencies with scripts disabled, audits them and writes hashes plus manual signing instructions. It never signs or imports trust.

Review the source, candidate and exact unsigned executable hash before authorizing its local signing. Enter any private-key prompt locally. Do not export the key. Verify the final executable/helper signatures and signer after all byte changes. Rebuilding the executable requires a new review and signature. The executable signature does not independently attest the adjacent JavaScript/dependencies; preserve the reviewed release manifest and dependency lockfile as well.

The approved helper signature can be reused by copying the exact signed file only when its script body matches source. Do not rebuild over a live bridge directory. Development outputs and release candidates remain separate from existing `bridge/dist` installations.

## Troubleshooting

| Message | Action |
| --- | --- |
| Port already occupied | Stop that bridge in its own terminal or select another explicit port. The launcher does not kill another process or scan for a replacement port. |
| Valid signature, publisher untrusted | Review that exact public certificate under the actual normal Windows account running the launcher and Codex. Trust in a different account/context is insufficient. |
| Invalid signature / signer mismatch | Use the reviewed signed release and verify its public signer. Do not bypass policy. |
| Policy blocked | The effective Windows PowerShell policy prevents script execution. Ask the administrator for an approved policy; the launcher does not change it. |
| Configuration access unsafe | Use a dedicated local directory controlled by your account. Existing shared folders are not silently secured or modified. |
| Identity/client conflict | Run both components normally under the same account, session and elevation with the same installed executable. Close the other adapter rather than replacing it. |
| Missing runtime/build | Check .NET Desktop Runtime, Node 22 and the complete packaged bridge directory. |

Diagnostics are limited to codes, statuses and configured addresses. Pairing keys, prompt text, proposals, receipts, private notes and library contents must not enter launcher logs. Same-user/administrator compromise, compromised same-origin scripts and malicious browser extensions remain outside these protections.

Signed native acceptance, actual installed-CLI workflows and desktop-client registration must be reported separately from unit tests or simulated/mockup results. A valid signature alone is not end-to-end certification.
