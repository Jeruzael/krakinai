# Stage C integration readiness

Stage B adds no server, listener, remote transport or credentials. Future connectivity remains a separate security-reviewed stage.

Reusable boundaries are:

- `parseChangeSet(input)` — bounded strict canonical package validation.
- `planChangeSet(package, approval, snapshot, allocation)` — synchronous read-only domain planning.
- `previewChangeSet(input, approval?)` — browser-owned snapshot preview and deterministic content/approval digest; no writes.
- `applyApprovedChangeSet(preview, approvedDigest)` — current-state revalidation and a coordinated transactional write with durable idempotency receipt.
- `buildAiContext` / `serializeAiContext` — bounded selected-field context with explicit privacy controls.

A digest provides integrity binding, not authentication or proof of human consent. An external client must never be allowed to supply approval booleans and call raw Apply as though a human approved. Stage C needs a browser-owned approval broker: trusted local UI review, an opaque revocable approval handle bound to the exact digest/selection/expected revisions, expiry, single-operation scope and replay-safe receipt retrieval. Human confirmation must remain separate from the tool's proposed content. New content/selection/state invalidates approval.

The future bridge must be loopback-only with authenticated revocable pairing, restricted origins, CSRF/rebinding defenses, bounded requests/timeouts, clear disconnected behavior and minimal read/write capabilities. It may request an allowlisted context selection; complete prompts, identity details, notes and filenames need the same explicit user controls. No raw IndexedDB files or unrestricted snapshot should be exposed. All writes stay in the application's browser transaction code.

Expected project revisions, current scene heads, candidate/asset revisions and current media consistency checks remain mandatory at commit. Receipt lookup precedes stale-state checks for the identical operation. A success response must mean application-confirmed commit, not merely JSON generation. Partial-batch success is unsupported.

Before shipping Stage C, add transport/auth/approval-broker security tests, cross-origin/pairing abuse tests, bounded context privacy tests, failure/disconnect/retry recovery tests and exact-head CI. Stage D ChatGPT integration depends on supported account capabilities and this broker. Stage B file import/context export is the practical fallback, not proof of Stage C/D connectivity.
