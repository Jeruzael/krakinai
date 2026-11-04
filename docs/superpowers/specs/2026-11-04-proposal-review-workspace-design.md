# Proposal Review Workspace, Saved Review Drafts and Rejection Feedback

Date: 2026-11-04. Status: owner approved design and inline implementation on 2026-11-04; implementation in progress.

## 1. Intent and agreed direction

Bulk proposals need enough time and space for careful review. The owner requested at least a day before expiry, an explanation/comment when rejecting, visible reasons for every remaining blocker, and less vertical scrolling. The owner chose a **compact review workspace with desktop/mobile mockups** and accepted retaining proposals locally across closing/reopening KRAKINAI, with fresh connection, validation and approval before saving.

This is a proposal-review improvement, not a rewrite of authoring, storage, backup or MCP permissions. Immutable scenes, expected revisions, stable frame IDs, v1–v6 packages, exact prompt/media bytes and the Stage B atomic transaction remain authoritative. No changes to the real library, global Codex registration, signed release or PR #12 are part of design work.

## 2. Observed implementation and problem

- `src/domain/mcpProtocol.ts`: proposal lifetime is 600,000 ms; authorization has a separate 3,600,000 ms maximum session and 900,000 ms idle timeout; final save consent lasts 60,000 ms.
- `src/connections/proposalBroker.ts`: proposals, review markers and consent are in memory. Disconnect clears authority and marks pending proposals disconnected. Raising `proposalMs` alone cannot deliver next-day review or survive closing the browser.
- `src/components/ChangeSetPreview.tsx`: conflict counts and row badges exclude `APPROVAL_*`; row badges require a matching operation ID. Global findings are listed after the operation groups, away from the top warning. `PROJECT_VALIDATION` is currently global; `BACKUP_METADATA_CAPACITY` and `LEDGER_CAPACITY` are necessarily batch-wide. Not every blocker can truthfully belong to a shot.
- `src/components/keyframes/KeyframeProposalReview.tsx` renders detailed sections for every operation before the generic operation list; this expands the review document even when most text is collapsed.
- `src/components/McpProposalReview.tsx` disables the shared preview for terminal proposals, also disabling package download. Rejection has no comment. The screenshot does not reveal its exact underlying finding; these are verified structural gaps, not a diagnosis of that private package.

The existing broker and Recipe preview suites passed 16/16 on the unchanged baseline. This is baseline evidence, not evidence of the new behavior.

## 3. Approaches considered

1. **Increase the existing timer only.** Small change, but session/idle expiry and browser close still terminate review; misses the agreed requirement.
2. **Keep session authority alive for a day.** Conflates review time with authorization, still loses in-memory drafts on close and unnecessarily changes security boundaries. Rejected.
3. **Separate a saved local review package from short-lived session/approval authority.** Selected direction. A new compact workspace reads saved packages; reconnect/resume produces a new current preview and never revives consent.

For layout, a sequential wizard was considered. The owner chose a workspace: a list plus selected detail is faster for comparing and revisiting a large batch. On smaller screens the same content becomes one panel with an item selector and an approval drawer.

## 4. Review window and local persistence

### 4.1 Concrete proposed policy

The default **review window is 24 hours from first receipt**. It is independent of session lifetime. The queue shows the exact local expiry date/time and a readable time remaining; warn without moving focus at one hour and five minutes. Background timer throttling does not extend the deadline: every resume/review/apply checks an absolute timestamp. Retrying or opening a package does not silently renew it.

After that window, the item becomes **Review window expired**: still readable, downloadable and removable, but ineligible for Apply. An explicit browser **Revalidate for another day** action may open a new 24-hour review window only after current scope and source validation. It does not alter the submitted package, resolve stale targets, grant permissions or approve anything. New time is measured from that successful explicit action. This separates the review deadline from storage deletion: local saved packages remain until removed by the owner.

These are proposed builder defaults for the owner to approve: one 24-hour window with explicit renewal, rather than an additional duration-settings screen; no automatic deletion or deadline extension.

### 4.2 Separate review inbox

Use a separate same-origin IndexedDB database, proposed name `krakinai_review_inbox_db`, version 1. Do not add a store, version or field to the eight-store library database or its preferences/backup manifest. This cache stores **uncommitted review drafts**, not assets, scenes or authority. Documents/tests must distinguish these local review-cache writes from production library writes; do not claim that literally no database write occurs when saving a review draft.

Persist only the original validated MCP package (within the existing 1 MiB MCP package limit), canonical package digest, change-set ID, local inbox ID, origin, receipt/deadline timestamps, explicit expiry/rejection disposition, optional feedback, and bounded local review progress. Do not persist session IDs/keys, scope grants, pairing proofs, approved digests, receipt permissions, trusted events, final approval flags or authority. Do not persist resolved library snapshots or separately captured identity/media text just to reopen a preview.

Proposed bounds: **8 saved packages**, each original package at most 1 MiB, each local metadata/progress/feedback envelope at most 64 KiB, overall UTF-8 encoded inbox budget **10 MiB**. The existing runtime eight-proposal admission limit and all other application/MCP limits stay unchanged. At capacity, show Download/Remove choices and a correlated queue-full response; do not silently evict another saved review or overwrite it. A package received while local persistence fails can remain reviewable in memory, but must be clearly labelled **Not saved for later**, with Download available; never promise restart recovery. A full durable inbox does not imply a newly received proposal was accepted.

Exact policy distinction: capacity exhaustion rejects admission before adding the new runtime item; an unexpected write/quota failure after otherwise valid admission may use the explicit in-memory fallback. Bound/digest checks run before storage and again when loading; malformed or unsupported saved records are quarantined from Apply and can be exported/removed without being executed.

Local progress may include selected item/tab, non-authoritative candidate/manual-resolution drafts and reviewed-item markers bound to content fingerprints. It never carries the exact-proposal confirmation or approval checkboxes across reload, disconnect, source/scope change or renewal. If operation content changes during revalidation, reset that operation's local marker. “Marked viewed” is navigation assistance, not permission or final consent.

Review drafts are browser/profile/origin-specific. They are **not part of the full-library ZIP**; the UI/docs must say so and offer Download JSON for a portable copy. Restoring a library neither applies nor authorizes cached packages. They remain disconnected and require fresh target validation against the restored library. No restore hook, lossy migration or change to backup limits is required.

Cross-tab cache writes use transactions and record revisions. An update cannot resurrect a removed/rejected item or overwrite a newer rejection/comment. Cache updates are allowed to fail visibly; they cannot race into the library's save path. Do not clear all drafts on one tab's disconnect.

## 5. Lifecycle, reconnect and atomic save

Local inbox lifecycle is separate from a live MCP proposal. A restored item begins **Saved draft · connection required**, regardless of its former runtime state. It can display the original package while disconnected; fresh resolved diffs require fresh preparation. The UI labels any old/local display as a snapshot rather than current validation.

An explicit **Revalidate and resume** action requires a paired current session, proposal permission, the relevant v5/v6 capabilities, and the package's minimum selected scope. Re-parse/re-hash the package, read current records, recheck exact source IDs/revisions/digests, and recompute the plan/differences. Missing permissions and stale state become visible blockers. Do not automatically rebase expected revisions, expand scope, swap assets or create dummy references. A changed package needs its own valid identity according to the existing change-set ID/content rule.

A fresh exact resubmission in a current authorized session can locate the saved draft by change-set ID plus digest. It must pass current scope checks **before** disclosing saved status/feedback or binding the local draft. It does not renew the deadline or resurrect rejected/expired authority. Rejected drafts stay rejected; reconsideration requires an explicit owner action. Any resume produces a new runtime proposal binding/current preview, not a restored old session.

Keep the existing one-hour session, 15-minute idle timeout, two-minute native challenge and one-minute one-use final-save consent. Disconnect, Stop, expiry, last-client loss and scope changes revoke authority as they do now, but do not erase review content. Pairing does not auto-resume cached proposals. UI editing alone must not silently keep a session authenticated.

Apply still requires a trusted browser event, complete current approval checklist and exact-proposal confirmation, no current blocking finding, valid window, fresh scope/epoch and content digest. Revalidate scope, source state and approved content inside the existing atomic transaction. Preserve rollback and no partial project/scene creation. Replays return historical receipts only with the existing receipt authorization; a local saved draft confers no receipt access.

Crash handling: if the browser closes during Apply, restore the inbox as **Outcome needs checking**, not as applied or ready to retry. Read the authoritative import ledger/receipt under the existing rules before allowing another save. Do not trust a cached “applying/applied” flag as evidence of a commit. A completed library transaction and a failed cache update must remain a completed transaction, with a visible status-recovery action; never report rollback merely because saving review progress failed.

## 6. Rejection comments and feedback

Reject opens a dialog with an optional plain-text reason, a character count and target identification. Proposed maximum: **2,000 Unicode characters and 8 KiB UTF-8**, whichever is reached first. Preserve the actual entered text; validate bounds, render as text, never HTML/commands. Empty/whitespace-only feedback cannot be sent as a comment; rejection without a comment remains available.

Provide two explicit actions: **Reject locally** and **Reject and share feedback with Codex**. The latter explains that authorized connected Codex clients share this session; the application cannot identify a particular chat as the exclusive recipient. It shares only this entered reason, timestamp and proposal/package identity. It never enables general notes, identity, prompt, media or receipt permissions.

Store the final local rejection reason/disposition with the saved draft, even if disconnected. Local-only feedback stays local. Sharing is permitted only by the browser owner through the actual control and a current authorized proposal context. Offline users can save a local reason or copy it; sharing later requires another explicit action after revalidation. A checkbox state restored from disk cannot grant new sharing authority. Once rejected, the same proposal cannot Apply; reopening for reconsideration requires fresh validation and confirmation. Editing the actual package creates different content and follows existing ID rules.

Expose shared feedback as optional additive metadata in `krakinai_get_proposal_status` (and the exact authorized duplicate-submit status), not through a new write tool or a change-set operation. No v7 contract is necessary: v1–v6 input contracts and all thirteen tools remain unchanged. Before every feedback disclosure, enforce the current session, proposal scope, epoch and exact package identity; the existing non-v5/v6 status path also needs this recheck so feedback does not become an existence/notes leak after scope reduction. Do not return comments for guessed IDs, different packages, expired grants or unselected projects. Existing clients that ignore optional feedback remain compatible. Receipt replay semantics are unchanged.

Do not automatically submit a replacement after rejection or treat feedback text as permission to modify the library. Codex can use the feedback to prepare a separately reviewable proposal.

## 7. Compact desktop review workspace

Reuse KRAKINAI's existing palette, cards, badges, controls and `StudioDialog`. At 1440 × 900 the app retains its usual navigation and the review fills the remaining viewport:

- **Sticky header:** title, exact package/digest, saved/revalidation/session status, 24-hour deadline, concise computed summary, and counts such as **1 conflict · 3 approvals left**.
- **Left navigator:** compact grouped operations/shots/assets and a Batch row, search, filters All / Conflicts / Needs approval / Marked viewed. Use human titles plus exact operation/shot identifiers. Every operation type has a group or a safe Other fallback; no disappearing rows.
- **Centre selected detail:** one operation or Batch at a time. Tabs Summary / Recipe / Blocking / Frames / Video / Exact data show only applicable content. Frame selection reveals one frame's complete image text and exact before/after changes. Long prompts are in bounded viewers with complete Copy/Download; truncation is only for list excerpts. Add Previous/Next and optional Mark viewed controls, which do not approve content.
- **Right review rail:** all remaining issues and approvals, their codes/reasons and exact targets, with “Go to” actions. Batch issues go to Batch, not an invented operation. Keep exact manual-output/candidate decisions reachable from these actions. The final exact-proposal confirmation remains separate.
- **Persistent action area:** Revalidate, Download JSON, Reject and Apply batch. Apply stays disabled with a readable list/count of reasons. The operation selection is for inspection only: no per-shot partial apply or silent filtering of the package.

Do not render all v5/v6 operation detail cards ahead of this workspace. Adapt the existing detailed components to the selected operation so the same content/rules remain available, without maintaining a second validation implementation.

## 8. Complete issue visibility

Use one derived readiness projection for header counts, filters, row/Batch badges, issue rail and Apply explanations. Preserve the underlying validation rules; display data conflicts, pending explicit approvals and lifecycle/connection/storage requirements separately. Do not classify an unchecked approval as a data conflict, but do not hide it from the reasons Apply is unavailable.

All `plan.findings` must be reachable: blocking, approval and advisory. Show code, complete message, scope, affected target when known, and a next action or an honest explanation that a revised package is needed. Extend internal finding context with optional project/shot/field identifiers where the planner already knows them; do not invent certainty. A global validation error remains a visible Batch blocker when attribution is unavailable. Backup/ledger capacity is a Batch issue with a clear smaller-batch remedy. “Go to issue” expands the necessary section, selects the item/tab and moves keyboard focus to its heading/control. Unknown findings still display and block accurately.

A stale/expired/disconnected proposal remains inspectable and downloadable. Terminal state must not disable navigation or Download; only mutation/approval controls are disabled. Preserve the exact incoming package for recovery. Already-expired older in-memory items can be explicitly saved/downloaded if their package is still available; do not claim that an earlier closed tab's unpersisted proposal can be recovered.

## 9. Responsive and accessible behavior

At 768 px use a narrow navigator plus detail, with approvals in a labelled drawer. At 390/320 px use a normal-scrolling single detail view, an accessible operation selector and Issues/Approvals sheet, plus a compact sticky action bar. Do not reproduce desktop nested-scroll regions on mobile. Sticky controls must not cover focused content at zoom or with the virtual keyboard.

Support arrow-key tab navigation, visible focus, labelled buttons/statuses, focus restoration when dialogs close, and text alongside status colours. Filtering does not lose a selected operation silently. Incoming proposals never steal focus or automatically change the open review. Warn on locally unsaved feedback when persistence fails. A mockup may demonstrate interactions but cannot certify screen-reader behavior, the system clipboard, real saves or actual native pairing.

## 10. Scope and compatibility boundaries

Primary changes will touch the browser proposal broker/context, a dedicated review-cache repository/types, the incoming review/preview components and CSS, and focused docs/tests. Shared issue presentation may also benefit manual JSON import, but durable storage and the compact layout are initially scoped to incoming MCP proposals; preserve the 20 MiB manual JSON importer and its existing flow.

Keep the main DB at version 3/eight stores, backup/restore behavior and limits, signed native helper/executable, native transport, existing port/origin settings and the 128 MiB Project Export unchanged. No AI backend, cloud service, paid dependency, provider call or automatic Google Flow action. No real-library tests. A future bridge package update, if shared bundled descriptions/constants change, is a separately reviewed release/activation; a source pull does not activate it.

## 11. Verification acceptance for implementation

1. Synthetic persistence: receive a valid v1 and v6 package, restart the isolated browser, recover exact package/digest/progress within 24 hours. All eight library stores remain byte/record equivalent before approval; review-cache writes are measured separately. No credentials/approval flags persisted.
2. Time: fake-clock tests just below/at 10 minutes, 24 hours and renewal; session/idle expiry remains unchanged; viewing/retries do not renew. Expired content remains navigable/downloadable, and fake/synthetic approval events never save.
3. Resume: denied scope/capability, changed epoch/revision/source/media, changed package under same ID, rejected item, malformed cache and stale tabs. No old consent or private feedback leak after reconnect. Fresh explicit validation restores review only when permitted.
4. Save/recovery: exact one-use approval, atomic rollback, interruption before commit preserves old library; interruption after commit finds the actual receipt, does not duplicate, and never claims a cache-write error undid a commit. Preserve old scene IDs/outputs/preferred takes/media hashes.
5. Rejection: optional local reason, explicit share, bounds/Unicode/plain-text rendering, offline local feedback, current-session status retrieval, denied guessed/unselected/reduced-scope reads and no automatic replacement or Apply. v1–v6 older consumers ignore added optional metadata.
6. Issues: operation blocker, project validation, batch capacity, unknown/global finding, approval-only, mixed findings, missing/unsupported operation group and asynchronous preview failure all appear in matching counts/filters; each navigation action reaches and focuses the correct target. Apply explanation agrees with actual save guards.
7. Layout: actual implementation screenshots at 1440/768/390, no excessive document height at desktop with 15 shots, long complete prompts preserved, one selected detail at once, keyboard filters/tabs/drawers/feedback and focus return; normal mobile scrolling and no horizontal overflow.
8. Run focused tests first, complete app/bridge/helper regression suites, typecheck, build, production audit, synthetic browser checks and final-head hosted CI. Any actual native acceptance remains isolated with owner pairing, AllSigned preserved and signatures checked after any rebuild. No temporary profiles, packages, keys/certificates or review drafts in Git.

## 12. Design review gate

This is substantial enough for one independent builder check before owner approval. Resolve already-answered and minor implementation questions in the document; return only material product decisions to the owner once. The standalone mockup is synthetic, has no library/MCP access and never sends a rejection or applies a batch. After approval, invoke writing-plans; product implementation awaits the authorized plan. The owner approved the approach and mockups, not this as-yet-unreviewed written design. No merge or live activation follows from design approval.

### Design-stage evidence

One fresh independent software-engineering builder check read this design and the relevant implementation. It reported **“nothing important left”**: no material unanswered questions before planning. This checks design completeness, not implementation correctness or security certification.

The standalone v2 mockup passed **4 viewport cases (1440, 768, 390 and 320 px), 76 assertions, exit 0**, with six non-empty screenshot files. Checks cover horizontal overflow, bounded desktop document height, selected-item details, arrow-key tabs, stable frame selection/focus, complete synthetic prompt text, batch-issue navigation/focus, readable expired state, available expired downloads, disabled expired Apply, explicit rejection comment sharing and dialog focus return. Three screenshots (desktop, mobile and mobile rejection) were visually inspected. No actual library, approval, persistence or MCP operation ran from the mockup.

Two initial preview-only attempts failed an issue-jump focus assertion. The second localized it to 768 px: closing the Issues drawer asynchronously returned focus to the opener after the intended destination had focused. The v2 mockup uses a one-shot destination-focus path for issue jumps; ordinary dialog closure still returns focus to the opener. Both behaviors pass in the successful run. The failed v1 HTML and failure records are retained, not relabelled as passes.

Preview source, companion state, screenshots and machine-readable results remain ignored under `qa-results/proposal-review-workspace/`. The four normal screenshots are `workspace-1440.png`, `workspace-768.png`, `workspace-390.png` and `workspace-320.png`; rejection dialogs are `rejection-1440.png` and `rejection-390.png`. `preview-evidence/results.json` records the successful run. The single pending tracked artifact is this design document; product code, dependencies, actual library, signed releases and global settings remain unchanged.
