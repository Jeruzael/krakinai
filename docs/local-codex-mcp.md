# Local Codex connection (Phase 6 Stage C)

This feature adds scoped context reads and proposed change sets over a local stdio MCP server. KRAKINAI remains the authority for preview, human approval and atomic saving. Manual AI Change Set import remains available.

## Current certification limit

The isolated SDK/browser workflow and the installed Codex CLI's unpaired status call have been exercised. **Native Windows pairing is not certified on the development machine:** Windows PowerShell 5.1 has `LocalMachine: AllSigned` and rejects the unsigned helper. Keep the Stage C PR draft until native pairing and paired CLI acceptance succeed. Do not disable or bypass the policy. See [local signing instructions](local-codex-mcp-signing.md) and [QA evidence](local-codex-mcp-qa.md).

## Build and configure deliberately

Use Node 22. The tested executable on the development machine is `C:\nvm4w\nodejs\node.exe` (22.23.3). From `bridge/`, run:

```powershell
npm ci --ignore-scripts
npm run build
npm run typecheck
npm test
npm audit --omit=dev
```

The runtime dependency is the locked MCP server SDK 2.4.0. The client SDK is a test dependency. Test entry points are built separately with `npm run build:test` into ignored `bridge/qa-results/`; production `bridge/dist/` has no injected verifier or bypass flag.

No Codex configuration is installed automatically. If you choose to register the server, use the actual absolute executable and compiled entry paths in your own configuration:

```toml
[mcp_servers.krakinai]
command = 'C:\nvm4w\nodejs\node.exe'
args = ['C:\YOUR\KRAKINAI\bridge\dist\krakinai-mcp.mjs', '--app-origin', 'http://localhost:YOUR_EXISTING_PORT', '--port', '4177']
startup_timeout_sec = 20
tool_timeout_sec = 20
```

Replace the origin with **exactly** the origin displayed in AI Connections, including hostname and port. Do not move an existing library between `localhost` and `127.0.0.1`, ports, browsers or profiles to connect: each has separate browser storage. The relay itself binds only literal `127.0.0.1` on the explicitly configured port, with no scanning or fallback.

## Pair and select the smallest useful scope

1. Open AI Connections in the browser/profile containing the intended library. Nothing connects automatically.
2. Select projects or individual scene metadata and reusable records. Proposals and new-project creation are separate opt-ins.
3. Press Connect Codex. Compare the origin, relay, compiled path and verification code with the separate Windows verification window. Reveal its one-time key and enter it into the matching browser field while that window is open. Then choose Allow in the Windows window and Confirm pairing in the browser. Allow closes the native window, so transfer the key first.
4. Ordinary prompt text, Character identity/approved anchors, private notes, filenames and exact Full scene prompts have separate controls. A Full prompt can contain sensitive information regardless of the other text toggles. Original media bytes are never returned by this bridge.
5. Selected context is visible to Codex and may be forwarded to its configured model provider. Local transport does not imply a local AI model. KRAKINAI introduces no AI-provider API calls or cloud storage.

No key belongs in chat, command arguments, environment variables, URLs, configuration, backups or logs. The browser clears the pairing input before completing authentication. Verification keys and approvals live only in process memory; session restart requires pairing again.

## Review a proposed batch

MCP preview/submission does not write library records. Submission returns a proposal ID/status without waiting for human input. Background arrival only updates the badge/queue. Open the proposal yourself, inspect the existing Stage B preview and complete prompt details, choose approval categories and candidate decisions, confirm the exact preview, then press Apply reviewed batch.

Only the existing Stage B atomic writer commits records and its durable receipt. The additional synchronous guard checks the current session, scope, digest and one-use consent inside that transaction before writes or receipt replay. Permission changes invalidate pending approvals. No serialized MCP argument, `approved` flag or approval handle grants consent.

New immutable scenes and candidates retain Stage B semantics. New projects are not automatically added to the read scope. Existing scenes, preferred takes, references, media, drafts, storage schema, backup limits and Project Export are not rewritten by connecting.

## Recovery and cancellation

Disconnect immediately revokes local consent before its best-effort network acknowledgement. A batch already past its authorized atomic boundary may finish; durable records/receipts remain valid. A failed transaction preserves the previous library. After reload, re-pair and explicitly select the exact receipt under recovery permissions to retrieve confirmed IDs. Recovering a receipt does not grant general access to its project or recreate records.

If a package ID is reused for different content, a target revision/head changes, media disappears, scope changes or approval expires, review a fresh preview. Never treat an unacknowledged operation as confirmed success. Manual import is the fallback when a platform, policy or exact payload exceeds the bridge's supported envelope.

## Bounds and assumptions

There are 13 allowlisted tools and no apply, approval, shell, filesystem or arbitrary URL tool. Requests reject unknown fields. Package/frame/result bounds are 1 MiB/1.25 MiB/512 KiB; results are exact or rejected, never silently truncated. Pagination is 1–50; at most eight proposals, 16 pending tool requests and 32 TCP connections are accepted. Tools have a 15-second deadline and 30/minute limit with burst eight; stdio has independent byte/frame budgets. Header/request timeouts are five/ten seconds, checked every second.

Pair challenges last two minutes and allow five proof attempts. Sessions expire after one hour absolute or 15 minutes idle, with five-minute MAC epochs and 45-second unresponsive-browser expiry. Proposals expire after ten minutes. Consent at Apply is one use with a 60-second deadline. Process shutdown and lost rotation acknowledgement fail closed.

Authenticated loopback messages use transcript-bound P-256 ECDH, HKDF and purpose-separated HMACs with sequence/replay checks. This is not TLS encryption or protection against a compromised OS account, malicious browser extension, same-origin script compromise or an authorized desktop automation tool. Browser `isTrusted` checks reject synthetic DOM approval events; they are not proof of a physical human against OS automation. Memory release is best effort, not forensic erasure. Real Chrome/Edge native pairing remains an explicit certification gate; automated Chromium with an injected verifier is reported separately.
