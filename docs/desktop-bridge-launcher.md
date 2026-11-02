# KRAKINAI Windows bridge launcher

This launcher provides manual Start, Stop and Restart, a system-tray menu, and separate bridge, browser and MCP-client indicators. It does not install or replace the browser application, start its development server, or access its IndexedDB library.

## Before you start

The first release is a **portable folder**, not an installer. Keep the executable and its adjacent `bridge` directory together in a stable local location. Windows x64, the .NET 10 Windows Desktop Runtime and an existing Node.js 22 installation are required. The executable and verification helper must have valid signatures from the approved publisher. A local development certificate is not a public-distribution certificate or a guarantee of SmartScreen reputation.

The repository contains source and release-building tools. It does not include the development machine's signed executable, certificate, desktop shortcut or ignored `qa-results` release folders. Obtain a reviewed signed portable folder from its maintainer, or follow [Signing and updates](#signing-and-updates) to prepare and sign a reviewed build locally. There is no automatic installer or certificate-trust setup. Signing and trust must be checked under the Windows account that will run the launcher and Codex; keep AllSigned enabled. See the [local signing guide](local-codex-mcp-signing.md) for certificate requirements and the scope of trusting a publisher.

Start KRAKINAI separately (`npm ci` followed by `npm run dev` from the repository folder for local development). In the browser/profile containing your records, open **AI Connections** and note **Current application origin**. Keep that exact origin, such as `http://localhost:5173`: `localhost`, `127.0.0.1`, different ports and different browser profiles have separate libraries. If your usual app port is unavailable, resolve that server conflict rather than moving an existing library to another URL. The launcher copies an address for you to paste; it does not choose a different default browser/profile.

## One-time launcher settings and shortcut

Run the launcher and Codex normally under the same Windows account, session and elevation. Administrator mode is unsupported. Double-click `Krakinai.BridgeLauncher.exe` to open it stopped, then open **Settings**:

| Setting | What to select |
| --- | --- |
| Node.js 22 executable | Your installed Node 22 `node.exe`; paths differ between installations. |
| Bridge release directory | The reviewed release's adjacent `bridge` folder containing `krakinai-managed-host.mjs`, `krakinai-stdio-adapter.mjs`, dependencies and `native/verify.ps1`. |
| Exact application origin | The value shown by KRAKINAI, for example `http://localhost:5173`, without a route or trailing slash. |
| Relay port | An available explicit port, default `4180`. This is separate from the app's port; port `80` is unsupported. |
| Approved public signer thumbprint | The reviewed publisher's public thumbprint, matching both the signed executable and helper. Do not copy a different installation's signer blindly. |

Click **Save settings**. Settings can only be edited while stopped. Their default location is `%LOCALAPPDATA%\KRAKINAI\BridgeLauncher\launcher-settings.json`. A custom settings file can be selected explicitly:

```powershell
& 'C:\KRAKINAI\Krakinai.BridgeLauncher.exe' --config 'C:\Users\YOUR_USER\AppData\Local\KRAKINAI\BridgeLauncher\launcher-settings-custom.json'
```

These are example paths: replace them with your actual release and settings paths. The settings file must be in an owner-controlled local directory. Shared or redirected configuration paths are refused without changing existing folder permissions. The saved settings bind to the executable's exact path. If switching to a new release path, use a new dedicated settings file and configure it in that launcher; using an older release's settings can produce `NATIVE_PATH_MISMATCH`.

For a desktop shortcut, right-click the executable and choose **Show more options → Send to → Desktop (create shortcut)**. If using a custom settings file, open the shortcut's **Properties** and set **Target** to the following, using your real paths:

```text
"C:\KRAKINAI\Krakinai.BridgeLauncher.exe" --config "C:\Users\YOUR_USER\AppData\Local\KRAKINAI\BridgeLauncher\launcher-settings-custom.json"
```

The shortcut and MCP registration must use the **same settings file and release**. You do not need to paste the launch command for each session. No shortcut, global Codex configuration, startup task, Windows service, certificate trust or execution-policy change is installed automatically. A normal installer and automatic startup are outside this release.

## One-time Codex MCP registration

Starting the launcher or pairing the browser does not register a server in Codex. Register the persistent stdio adapter once for the intended Codex client:

1. In the configured launcher, click **Review MCP configuration**. Check the Node executable, adapter and settings paths, then choose **Copy configuration**. This button only copies text; it does not edit Codex settings or connect the client.
2. Open your Codex configuration, normally `%USERPROFILE%\.codex\config.toml`. Preserve all existing settings and other MCP servers. Add the generated `[mcp_servers.krakinai]` block at the end. If that table already exists, replace only that server's definition instead of creating a duplicate. Use your actual Codex configuration location if it has been customized.
3. Save, then reload the Codex client; fully quit and reopen the desktop app if necessary. Keep the launcher open. Run both under the same normal Windows account.
4. Confirm the launcher shows **MCP client: Connected**. Ask Codex to check KRAKINAI connection status to verify tools are available in the intended chat. A configuration entry alone does not prove a successful client connection. If reloading ended browser consent, pair again using the next section.

The copied block has this shape; **copy the real values from your launcher**, rather than pasting these placeholders:

```toml
[mcp_servers.krakinai]
command = 'C:\Program Files\nodejs\node.exe'
args = ['C:\KRAKINAI\bridge\krakinai-stdio-adapter.mjs', '--config', 'C:\Users\YOUR_USER\AppData\Local\KRAKINAI\BridgeLauncher\launcher-settings-custom.json']
```

The relay address such as `http://127.0.0.1:4180` belongs in **KRAKINAI's browser connection form**. It is not a Streamable HTTP MCP endpoint. The launcher-managed configuration uses `krakinai-stdio-adapter.mjs` with `--config`; the standalone `krakinai-mcp.mjs --app-origin ... --port ...` command in the [direct stdio guide](local-codex-mcp.md) starts a separate bridge and must not be substituted for this adapter.

Codex stores MCP registrations in its configuration file; see [official MCP configuration documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli). Registration is repeated only when the relevant paths/settings file change or you configure another client host. The persistent adapter registers the existing 13 tools while the bridge is stopped and reconnects to its private channel without starting a bridge. Only one adapter can control a launcher at a time; close a separate CLI test client before using the desktop client with that launcher.

## Pair the browser and apply permissions

1. Click **Start bridge** and wait for **Bridge: Running**. Keep the KRAKINAI app server and original browser/profile open.
2. In **AI Connections → Permissions**, select the intended projects or reusable records, review the changes, and click **Apply Permissions**. For a read-only test, leave proposals, new-project creation and text-sharing options off. Enable only the separate permissions needed for a production task; Character identity text and ordinary asset prompt text are independent choices.
3. In **Connection**, set **Local bridge address** to the launcher's displayed relay address, for example `http://127.0.0.1:4180`, and click **Connect Codex** once.
4. A separate **KRAKINAI Local Bridge Verification** Windows window should appear. It is not a browser pop-up. Compare its application origin, verification code and compiled bridge path with the intended app and release.
5. While that window is open, click **Show pairing key**. Copy its long **43-character one-time key** only into KRAKINAI's **One-time pairing key** field. The shorter verification code is for comparison, not this field. Check the entered-character count. Never send the key in chat or put it in configuration, screenshots or logs.
6. Check **I verified the origin, code and bridge path** and click **Allow pairing** in Windows, then **Confirm pairing** in the browser. Allow closes the native window, so copy the key first. The challenge expires in two minutes; if it expires, cancel the old attempt and start a fresh one with a new code/key.
7. Confirm **Browser: Paired** in the launcher and **Connected** in KRAKINAI. Confirm **MCP client: Connected** separately. Project selection alone does not share full prompts or Character identity text. Selected text may reach Codex's configured model provider; local transport does not mean the model runs locally.

Incoming proposals appear in **AI Connections → Incoming Proposals**. Open **Review proposal**, inspect its complete changes, select the appropriate approval categories, confirm the exact reviewed proposal, then choose **Apply reviewed batch**. Neither pairing nor permissions approve a library write; the existing Stage B transaction saves the approved changes and receipt.

## Daily use

1. Start the KRAKINAI app server if needed and open the usual browser/profile and exact origin.
2. Double-click your launcher shortcut, then **Start bridge**. The saved settings and registered MCP block are reused; there is no daily command to paste. Keep Codex open so its registered adapter can connect.
3. Pair the browser for the current session, review/apply the intended permissions, and check the three indicators before requesting work. If any consent has ended, a previous session's pairing does not restore it.
4. Review proposals in KRAKINAI before applying changes.
5. Use **Stop bridge** to stop the owned bridge while leaving the launcher open, or **Quit & stop bridge** to stop and exit. Closing the window with **X** hides it to the tray and leaves a running bridge running. Double-click the tray icon or the same shortcut/configuration to restore the window.

## Understand the connection indicators

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
| Bridge Running, Browser Paired, MCP client Not connected | Complete [one-time Codex MCP registration](#one-time-codex-mcp-registration), reload Codex, and check that its adapter uses the same settings file and release as the open launcher. Browser pairing alone cannot connect the MCP client. |
| MCP client Connected, Browser Not paired | Complete native/browser pairing and apply the intended permissions. MCP initialization grants no browser access. |
| No Windows verification window after Connect Codex | Check Bridge is Running and the browser relay address matches this launcher. Check the taskbar/Alt+Tab for the separate native window. If none exists, inspect the launcher's signature, publisher-trust or policy error; do not disable AllSigned. Cancel the old attempt before retrying. |
| `PAIRING_KEY_FORMAT` | Use the revealed 43-character one-time key, without spaces or line breaks, rather than the short verification code. Start a fresh attempt if the native window has closed or the challenge expired. |
| `NATIVE_PATH_MISMATCH` | Open the executable belonging to that settings file, or configure a new dedicated settings file for the new executable path. Regenerate the shortcut and MCP block from the same launcher/configuration. |
| Library appears empty in another window | Check the exact hostname, port and browser profile. Return to the original library origin/profile; the bridge does not synchronize or move browser data. |

Diagnostics are limited to codes, statuses and configured addresses. Pairing keys, prompt text, proposals, receipts, private notes and library contents must not enter launcher logs. Same-user/administrator compromise, compromised same-origin scripts and malicious browser extensions remain outside these protections.

Signed native acceptance, actual installed-CLI workflows and desktop-client registration must be reported separately from unit tests or simulated/mockup results. A valid signature alone is not end-to-end certification.
