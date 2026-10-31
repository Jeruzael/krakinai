# Stage C final installed-CLI acceptance plan

> **For agentic workers:** Use superpowers:executing-plans inline, with test-driven-development and verification-before-completion. Preserve the existing worktree and all QA artifacts.

**Goal:** Demonstrate a complete installed Codex CLI revision/import/retry/revocation workflow through the production launcher, signed native window and real browser controls.

**Architecture:** Extend the existing isolated loopback model fixture with a finite scenario whose actual CLI tool replies are validated by call ID before each browser action. Run it against fresh profiles at `http://127.0.0.1:4173` and literal `http://localhost:4173`; the production relay retains its real origin checks. Application code remains unchanged unless a demonstrated defect requires a scoped fix.

**Tech stack:** Existing Node22, Playwright, Codex CLI0.73.0, production MCP SDK launcher, Windows PowerShell5.1/Authenticode.

**Spec:** The user's final Stage C acceptance request (ten workflow steps), plus the approved `docs/superpowers/specs/2026-10-30-local-codex-mcp-design.md`.

## Global constraints

- Preserve AllSigned; verify Valid signatures and re-sign the compiled helper after every bridge rebuild. Signing material, secrets and profiles stay outside Git.
- Use no external AI credentials or provider. Never use a real browser profile/library, change PR12, merge, or alter unrelated work.
- Port5173 is occupied by a service whose source probe did not match KRAKINAI; do not change it. Literal localhost acceptance uses the owned QA server at4173.

## Review focus

- An earlier failed reply cannot be rescued by a later successful reply or fabricated assistant text.
- Receipt/proposal IDs must match actual Stage B committed records, not fixture guesses.
- No writes before trusted browser approval; original snapshots, preferred take and media hashes stay equal.
- Identical retries must return the same proposal/receipt without duplicate records.
- Disconnect must revoke real CLI reads/status access; localhost must be a real application origin with separate IndexedDB storage.

## Tasks

- [x] Add the end-to-end revision acceptance and observe a meaningful failure against the current read-only CLI fixture.
- [x] Extend the existing fixture with per-call correlated reply handling, actual-result-derived arguments and browser callbacks; add adversarial evidence regressions. Preserve existing read-only acceptance.
- [x] Run both real signed native origin cases and the existing native cases. Run full unit, bridge, evidence, QA and browser suites, typecheck, builds and production audits; preserve raw results and warnings.
- [x] Obtain a read-only review, update QA docs/ledger and verify the intended source/test/documentation files.

Release sequence: create a signed commit, push PR28, verify exact-head hosted CI/artifacts, then make it ready for review while leaving it unmerged. The completion evidence for this post-commit sequence belongs in PR Checks, its runtime artifact and the execution ledger; this plan cannot embed its own final commit SHA.
