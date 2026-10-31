# Secure Local Codex MCP Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship the approved Stage C vertical slice: scoped MCP reads, asynchronous proposals, real browser approval, atomic save and durable recovery.

**Architecture:** A pinned SDK stdio server owns a loopback-only authenticated HTTP relay. An in-memory application-level browser broker owns scope, preview and one-use approval. Existing Stage B functions remain the only production importer/writer.

**Tech Stack:** React/TypeScript/Vite, Node 22, MCP SDK 2.4.0, Web Crypto, Node HTTP, PowerShell/WPF, Vitest, Playwright.

**Spec:** [Approved design](../specs/2026-10-30-local-codex-mcp-design.md); binding brief: `C:/Users/HomePC/.codex/attachments/984aade2-d21d-4ff6-a119-edf8811f7bbe/Pasted text.txt`.

## Global Constraints

- Base `6530c0eda04809c603930a4b106b7f774bc1dd8d`; branch `codex/local-codex-mcp`. Preserve unrelated work and PR #12. No merge.
- No actual browser profiles/data, localhost:5173 QA, credentials/config access, global Codex changes, external AI requests or artifact deletion.
- Listener literal `127.0.0.1:4177`, required exact app origin, no discovery or fallback binding.
- Package 1 MiB; frame 1.25 MiB; result 512 KiB; eight proposals/8 MiB/ten minutes; 16 outstanding requests; page size 1–50.
- Five pairing proofs/two-minute challenge; one native prompt/30 seconds, five starts/five minutes. Session one hour absolute/15 minutes idle; MAC rotation five minutes; unconfirmed/unresponsive session 45 seconds.
- Tool deadline 15 seconds; long poll 20 seconds; headers 8 KiB/five seconds; body ten seconds. Tool 30/minute/burst eight; transport 120/minute; stdio 64 frames/minute/burst 16 and 16 MiB/minute.
- Human authorization one use/60 seconds, private browser state. No MCP grant/apply/approval endpoint. No migration, assembler, backup, reference or immutable-output changes.
- Exact outputs never truncated; errors sanitized; protocol-only stdout. Runtime dependencies exactly pinned and locked.

## Review Focus

- Lost pairing/rotation acknowledgement must disconnect safely; never accept a replay as authorization (Task 1/2).
- Scope revoked while an async read or digest is pending must block disclosure/application (Task 3/4).
- A historical receipt for a new/removed project or asset-only import must not leak through preview/retry (Task 3/4).
- Background incoming proposals must preserve an unsaved draft and keyboard focus (Task 5/6).
- Native verifier/process failure and CLI version mismatch must be reported distinctly from simulated protocol tests (Task 2/6).

## File responsibilities

- Shared `src/domain/mcpProtocol.ts`: strict transport/tool envelope limits/types/validation; `mcpCrypto.ts`: transcript, ECDH/HKDF/HMAC and authenticated message primitives. Browser-safe only.
- `bridge/`: separate pinned Node package/lockfile, build/typecheck/test setup, `src/relay.ts` for authenticated HTTP/session/queue lifecycle, `src/server.ts` for MCP startup/allowlist/stdin admission, `src/nativeVerifier.ts` and `native/verify.ps1` for Windows pairing. Test modules may inject a verifier; production CLI has no bypass flag.
- `src/domain/mcpScope.ts` and `mcpReads.ts`: scope checks and Stage B context projections, receipt projection/authorization. `src/types/mcp.ts`: browser scope/proposal/view models.
- `src/connections/browserTransport.ts`: browser pairing, authenticated polling/rotation/revocation; `proposalBroker.ts`: in-memory proposals/approval; `AiConnectionContext.tsx`: lifecycle surviving navigation.
- `src/storage/changeSets.ts`: optional synchronous authorization guard at replay disclosure and pre-write boundary; existing manual behavior unchanged.
- `src/screens/AiConnectionsScreen.tsx`, `src/components/McpProposalReview.tsx`, `src/screens/aiConnections.css`: accessible connection/permissions/review/receipt UI. Existing preview/receipt reused. `src/App.tsx`, `src/components/AppShell.tsx`, `src/components/AiPlanningActions.tsx`: provider/route/navigation integration.
- Focused corresponding Vitest suites; `e2e/local-mcp*.spec.mjs`, `scripts/qa/mcp-*` synthetic native/CLI drivers and result evidence; existing golden/backup suites unchanged.
- `.github/workflows/ci.yml`, package scripts: lockfile install and bridge checks. `docs/local-codex-mcp.md`, `docs/local-codex-mcp-qa.md`, `docs/qa/local-mcp-results.json`: actual setup/results/limits.

### Task 1: Strict protocol, cryptographic handshake and package setup

**Interfaces:** `McpToolName`, `McpCommand`, `McpResult`, `validateToolArgs(name, value)`, `assertByteLimit(value, limit)`, `createOffer()`, `deriveHandshake(secret, privateKey, remotePublicKey, transcript)`, `deriveEpoch(master, sessionId, epoch, nonce)`, `authenticateMessage(keys, envelope)`; all browser-compatible. Existing `parseChangeSet`/`canonicalStringify` reused.

- [x] Write failing protocol/crypto tests for exact bounds, unknown approval fields, invalid targets/points, transcript tampering, client/server proof separation, MAC method/path/body/sequence binding and retired epochs.
- [x] Run focused Vitest; confirm missing implementation fails.
- [x] Implement shared types/primitives and separate locked bridge package; verify maintained SDK API/legacy support in installed source, including the bounded stdin entry.
- [x] Run focused tests and bridge typecheck/build; record actual counts/warnings. Test lost/invalid rotation acknowledgement as fail-closed, not implicit reconnect.

### Task 2: Authenticated Node relay, Windows verifier and MCP process

**Consumes:** Task 1 primitives. **Produces:** `createRelay(options: RelayOptions): Promise<RelayHandle>` with `dispatch(tool, args): Promise<McpResult>`, `close(): Promise<void>`; injected `NativeVerifier`/clock only in module constructors; normal `server.ts` hardwires the Windows verifier.

- [x] Write failing HTTP/SDK tests for unpaired reads, wrong proof, replay/expiry, null/forged Origin/Host, local clients, oversized/chunked/compressed/flood inputs, queue limits, browser absence, EOF and clean stdout. Verify no sensitive data in diagnostic output.
- [x] Run focused tests and confirm failures.
- [x] Implement relay/session/rotation, deadlines, exact routes, native pipe-based verifier and SDK tools. Native helper takes no secret arguments/environment and emits no secret. Exit/port collision fail closed.
- [x] Exercise real SDK stdio initialization/list/call and legacy initialization, termination and bounded invalid frames; run native helper locally only in its own synthetic pairing workflow (Task 6).

### Task 3: Permission projections and receipt privacy

**Consumes:** shared tools; Stage B context builder. **Produces:** `emptyMcpScope(): McpScope`, `assertProposalScope(changeSet, scope, state, localReuseGrants)`, `readMcpTool(tool, args, scope, state): Promise<unknown>`; session/epoch checked outside and after async reads.

- [x] Write failing tests for selected-project metadata, ordered pagination, unauthorized/unknown identical errors, hidden identities/anchors/prompts/notes/filenames, absence of media bytes, full exact authorized prompt, deferred-candidate and existing-media permissions, global history boundaries and stale cursors.
- [x] Run focused Vitest and confirm failures.
- [x] Implement conservative allowlists using existing privacy projections; preserve context-export tests. Do not expose global matches/counts or serialize snapshots/Blobs.
- [x] Test receipt lookup and preview/retry for new/removed projects and asset-only receipts without grants; authorized confirmed projection contains actual IDs and no private text. Run existing AI context suites.

### Task 4: Browser transport, private approval broker and transaction guard

**Consumes:** relay protocol, Task 3 scope, existing Stage B functions. **Produces:** `BrowserConnection` with `pair`, `disconnect`, `setScope`; `ProposalBroker` with `receive`, `preview`, `reject`, `applyFromUserEvent`; subscription-based state for React. Approval records remain private and never enter wire types.

- [x] Write failing storage/broker tests for submitted flags/forged handles, duplicates, altered digest/decisions/state/head, session/epoch/TTL invalidation and no writes before trusted approval.
- [x] Run focused Vitest and confirm failures.
- [x] Implement pairing/polling/response verification, rotation, synchronous local revocation, in-memory proposal lifecycle and deduplication. All result paths recheck scope after awaits.
- [x] Add `authorize?: (currentState: ChangeSetState) => unknown` to existing apply; require synchronous completion, call inside transaction before writes and before replay return. Test a paused digest/IDB read followed by revocation results in zero records/receipt; leave manual calls unchanged. The current transaction state lets the broker recheck project-membership authorization without a stale external snapshot.
- [x] Test quota/abort, simultaneous applies, consumed-handle retry, source association failure, disconnect/reload and lost acknowledgement. Durable receipt recovery must not recreate records or widen read scope.

### Task 5: AI Connections and complete human review UI

**Consumes:** browser/broker state and existing preview/receipt components. **Produces:** `/connections/ai`, provider across navigation, navigation badges, permission controls and full review/apply/recovery UI.

- [x] Write failing component tests for disabled-by-default, pairing field masking, independent record/text grants, exact before/after review, apply categories and trusted event handling.
- [x] Run focused Vitest and confirm failures.
- [x] Implement route/provider/UI with existing components/palette; no auto navigation/focus grab. Pairing failure exposes useful retry instructions without secret logs.
- [x] Test keyboard navigation, dialog focus restoration/live messages, disconnect, expired/conflict states, new-project/receipt grants and complete text access. Background proposal leaves focus and draft text unchanged.

### Task 6: Synthetic browser, native Windows and real CLI acceptance

**Consumes:** compiled launcher and actual app. **Produces:** committed reproducible test drivers and ignored raw reports/profiles/screenshots.

- [ ] Add real SDK-to-browser tests on isolated origins/profiles for A–H: 15/60/type 2/9/4/pending 4, no preapproval writes, exact IDs, immutable Shot 05 revision/preferred preservation, cross-project rejection, candidate workflow, revocation and lost acknowledgement recovery. Test injection uses a test entry module, never a production bypass.
- [ ] Run new browser tests; verify UI at 1440x900,1366x768,768x1024,390x844 and 200%-equivalent reflow, including keyboard/focus, masked pairing screenshots and unsaved draft preservation.
- [ ] Run the actual Windows launcher/verifier against a fresh isolated profile. Native automation targets only that child/window. Verify allow/deny/failure and exact absolute paths. Keep its evidence separate from injected-verifier CI results.
- [ ] Run installed `codex-cli 0.73.0` with a synthetic cwd, isolated process-scoped configuration and loopback-only model-response fixture; assert real MCP status and authorized project tool calls. Copy/read no auth files; no actual AI API. Report a real compatibility blocker if the installed client cannot run it.
- [ ] Re-run legacy prompt hashes/manual imports/full-backup roundtrip and media hashes; record before/after counts, zero partial writes, unchanged preferred selection and actual screenshots.

### Task 7: CI, complete QA evidence and documentation

- [ ] Extend CI installs/checks for bridge lockfile, build, unit/protocol/browser tests and production audit. Keep existing root JUnit/browser summary contracts and stacked-PR event behavior; don't accidentally forward root reporter args to bridge tests.
- [ ] Run and capture exit codes/output/warnings for `git status --short`, `git diff --name-status`, `git diff --check`, `npm test`, `npm run typecheck`, `npm run build`, `npm audit --omit=dev`, QA scripts, bridge checks/audit and full browser suite.
- [ ] Write setup/recovery/security-limit docs using verified executable paths and actual results only; classify direct inspection, automation, native Windows/CLI proof and unverified assumptions separately. Include retained test artifacts and browser limitations.
- [ ] Review changed-file list for real data, secrets, profiles, ZIPs and generated QA files; stage only intended source/tests/docs/lockfiles.

### Task 8: Whole-branch review and signed PR

- [ ] Fresh independent reviewer checks the full branch, especially scope leakage, one-use browser consent, TOCTOU, idempotency, transport authentication and legacy regression. Resolve findings and repeat relevant checks.
- [ ] Create signed commit(s) using existing signing settings; verify signature and push feature branch. Do not disable signing or alter global configuration.
- [ ] Create and attach PR against latest master, leaving it unmerged. Inspect successful hosted CI for the exact pushed SHA; validate actual machine-readable artifact and supply run/PR links. If any mandatory native/CLI requirement remains blocked, make that explicit and keep the PR draft.

## Self-review

The ten design sections map to Tasks 1–7; delivery maps to Task 8. Each of the five Review Focus conditions has an owning test step. Shared names/signatures are consistent across tasks; implementation may refine internal types without changing the approved boundaries. This is one vertical slice, so execute natively in this session with one fresh final reviewer; the user has explicitly approved implementation and no further routine plan permission is needed.
