# AI Connections Workspace Design

Status: approved by the user on 2026-10-31 for inline implementation. Workstream A only. Independent builder check: no material questions left.
Base: master `3e5d352531007f99e72f711396676423bbde6fe5`.
Branch: `codex/ai-connections-workspace`.

## Intent and delivery sequence

Make choosing Codex context fast and understandable without widening authorization implicitly. Follow the supplied AI Recipe Builder & AI Connections Redesign brief, sections A1–A10 and its security requirements.

Deliver A as its own feature PR. Begin B only after the permissions redesign is reviewed. Prepare C only after B is verified and reviewed. No real Wedding Prequel conversion, duplicate project, or production-data test belongs to A.

The supplied attachment is 20,224 bytes and ends at acceptance test 8: “Full Access requires explicit”. Earlier requirements fully specify confirmation; this design covers those requirements without claiming to have received a missing ending.

## Verified current behavior

- The route is `#/connections/ai`. AiConnectionProvider owns ephemeral connection state and ProposalBroker owns consent, proposal previews, scope epochs and atomic application.
- RecordChoices renders 50 items initially and has a separately scrolling list. Every checkbox immediately calls setPermissions.
- Scope validation permits 10 projects, 250 explicit scenes, 250 full prompts, 500 combined assets/variants/templates, 2,000 media IDs, 250 candidates and 1,000 exact receipt grants.
- Selecting a project grants metadata for all its storyboard takes. Full text needs a separate fullPromptSceneIds grant.
- The provider currently silently removes full-prompt grants no longer covered by project/scene metadata scope.
- Broker.setScope increments the epoch, clears reviewed consent and temporary receipt grants, and marks pending proposals conflicted. This authority remains.
- Browser-approved batches can confer exact current-session receipt grants outside the explicit scope receipt list. The new summary must show these separately.
- Native Windows pairing, the cryptographic transport, default-deny scope, and trusted browser approval are already implemented. A does not replace them.

The source checkout and live application contain a separate uncommitted pairing repair. It remains in place there. This worktree starts at clean master and does not copy the signed helper, certificates, keys, profiles, user-library extracts, or unrelated validation.ts edits.

## Approach

Use three tabs on the existing route: Connection, Permissions, Incoming Proposals. This follows the brief and keeps one established provider/broker lifetime. A separate route per step is unnecessary because permissions and proposal review must survive switching views.

Use a staged permission draft with a visible before/after review and one Apply Permissions action. Keep the existing setPermissions/broker boundary as the only authority-changing operation. No new authorization protocol or storage schema is needed.

Presets are transformations of a draft, not new forms of server authority. Full Access is the only additional confirmation dialog; routine editing and its review stay inline.

These implementation choices were approved by the user for inline implementation.

## Screen layout and focus

A compact header shows connection state and a non-disruptive proposal count. The primary tabs implement Arrow Left/Right, Home/End, roving tab order, labelled tab panels and visible focus.

Connection shows the origin, browser library session, library counts, relay address, native pairing, Connect/Disconnect, actual confirmed session expiry, idle-expiry explanation and troubleshooting. Expose only the existing confirmed expiry through the provider; do not change deadlines. Pairing keys remain ephemeral and are cleared after confirmation, cancellation, disconnect and leaving the pairing view.

Permissions occupies the available page width. A compact category navigator and one active record panel replace many simultaneously expanded lists. Use a 12-row result page with Previous/Next and a visible range; pagination never bounds bulk selection. On mobile, categories wrap or become a labelled selector. The page uses normal scrolling and a non-obscuring sticky action bar.

Incoming Proposals preserves the existing review component and browser-owned approvals. Keep the selected proposal and its broker preview when switching views. Arrival updates a polite status/badge and never changes tabs, routes or keyboard focus.

Draft permissions and picker search/page state survive primary-tab switches. A connection ending clears staged credentials and permissions; a new session starts default-deny. Route reloads do not restore grants from persistent storage.

## Permission draft and application

Maintain separate applied and edited scopes. Editing IDs or disclosure flags changes only the local draft. While connected, Codex keeps the applied grants until Apply Permissions.

Always display a review with:
- Previously allowed counts and inspectable IDs/titles.
- Proposed counts and inspectable additions.
- Removed permissions, including dependent full prompts.
- Separate ordinary reads, sensitive disclosure, proposal capabilities and exact receipt recovery.
- Current-session approved receipt grants that will be revoked by applying permissions.

Apply validates the whole proposed selection and calls the existing setter once. Limits and stale selections must fail as a whole, with an actionable message; no prefix truncation. The review and Apply control may remain available for an explicit reapplication that revokes temporary approved-receipt grants even when ordinary IDs are unchanged.

Reset changes discards the draft back to the currently applied scope. Cancel changes does the same. Neither changes active authority. Changes during pairing are disabled because pairing captures a specific scope.

When metadata scope changes, derive which full prompts would lose authorization, show the exact removed scene list in the draft review, and send an already coherent target scope to the provider. Removing one project does not remove a full-prompt grant that remains covered by an explicit scene grant or another selected project.

External disconnect/expiry wins over an open draft or confirmation. A stale review must not restore a previous session's permissions.

## Record selection semantics

Use stable IDs, deduplicated set operations, and current snapshot inventories. Preserve selections hidden by a different query, category or page.

Provide ordinary buckets:
1. Projects.
2. Additional scene metadata.
3. Reusable assets, filterable by all seven existing asset categories.
4. Character variants.
5. Templates.
6. Media IDs (metadata/use permission, never bytes).
7. Pending asset candidates.

Provide sensitive record buckets separately: Full scene prompts and exact receipt recovery grants. Receipt identity is the pair (changeSetId, packageDigest), never title or an array position.

Every bucket has total/selected/matching counts, a mixed-state matching-selection checkbox, Select All in Category, Select All Matching Search, Clear All in Category, and Clear Matching Selection. With a reusable-asset category filter, category actions cover all records in that category independent of the text query; matching actions use both filters. With All Categories, category actions cover the whole asset bucket. Labels state the target and counts.

All actions use complete sets, including records beyond the 12 rendered rows and the previous 50-row boundary. A failed action leaves every prior selection intact. Display unavailable previously selected records with removal controls rather than silently substituting another record.

Global Select All Records selects known IDs in ordinary buckets only. It leaves disclosure flags, full-prompt grants, receipt grants and proposal capabilities unchanged. Global Clear All Records clears all selected ID/grant lists, including full prompts and explicit receipts, while leaving the independently labelled disclosure/capability toggles unchanged. The review shows the full result before Apply.

No explicit ID selection represents a wildcard. New projects and reusable assets arriving after selection are not automatically granted. Existing project grants continue to follow current storyboard take membership, including newly linked take metadata; full prompt text always requires its separate explicit grant.

## Presets and Full Access

Minimal Access retains the user's selected project metadata only; clears other record/grant lists, disclosure flags and proposal capabilities.

Creative Production retains selected projects, assets, variants and templates; enables change-set proposals; leaves new-project creation and sensitive disclosure off. Other explicit selection removals appear in its review. The user can add granular grants and then see Custom.

Custom permits independent editing. Preset labels describe the current draft configuration, not a separate persisted authorization mechanism.

Full Access / Grant Full Access proposes all currently eligible ordinary IDs, all scenes as explicit metadata, all currently eligible full prompts, pending candidates, exact receipts, all four disclosure flags and both proposal capabilities. It opens a focused confirmation showing project, scene, reusable-record and full-prompt counts; identity, filenames, notes and ordinary-text disclosure; exact receipt/candidate/media counts; and new-project/proposal capabilities.

The confirmation states that full prompt strings may themselves contain identity and private production details, original media bytes are not shared, future records are excluded, and production batches still require separate browser approval. Confirming stages a draft; Apply Permissions remains the explicit authority change.

Freeze the proposed IDs for that confirmation. If the relevant inventory changes before confirming, require a refreshed review rather than broadening the confirmed selection.

If any full selection exceeds a limit, show requested and allowed counts and suggest category/search narrowing. Do not offer an apparently complete Full Access grant containing only the first allowed items.

## Project-focused shortcut

Select Project for AI Work chooses an exact project ID and stages it within the project limit. It does not enable sensitive disclosure or proposals implicitly.

Show project ID, storyboard-shot count, distinct linked-saved-scene count, unavailable takes, missing media references, pending reference requirements, selected reusable assets and current privacy flags.

Derive related record suggestions only from actual collection membership, explicit cast IDs, frozen component source IDs, variant relationships and linked media IDs. Resolve availability against the snapshot. Present suggestions for explicit selection. Do not infer ownership from names, tags or prose, and do not auto-attach media.

A Direct Prompt project with no structured reusable associations honestly shows that no linked recipe assets were found. It remains usable and unchanged.

## Enforcement and implementation boundaries

Use validateMcpScope and authorizedSceneIds. Export the existing limit values from mcpScope for shared UI diagnostics, preserving every numeric bound and the validation behavior.

Expose a copied approvedReceiptGrants list in BrokerView so the local browser summary can describe existing effective receipt authority. This adds no MCP tool, credential or wildcard grant. Existing scope application still clears the temporary grants.

Preserve:
- Native pairing, cryptographic proof and AllSigned.
- Browser trusted-event production consent and separate content/preference approvals.
- Atomic transactions, idempotent receipts and immutable snapshots.
- Prompt assembly, outputs, reference associations, manual imports, backup/restore and storage limits.
- Existing session/idle/approval expiry and scope epoch rules.
- The real localhost library and existing Wedding Prequel records.

Do not add recipe operations, participant/dialogue models, asset installation, production migration or external AI calls in A.

## Planned source boundaries

- AiConnectionsScreen.tsx: three-view coordinator and preserved local view state.
- aiConnections.css: full-width responsive layout and reflow.
- components/aiConnections/: focused connection, permission picker/editor/review and proposal-list components.
- domain/mcpPermissionDraft.ts: pure inventory, selection, preset, limit and diff helpers.
- domain/mcpScope.ts: share existing limits without widening enforcement.
- AiConnectionContext.tsx: expose confirmed expiry; continue using the existing permission setter.
- proposalBroker.ts/types: copied current-session receipt-grant metadata for the browser summary.
- Existing tests and new focused tests; synthetic browser fixtures; QA documentation and screenshot artifact paths.

No product dependencies or IndexedDB schema changes are planned.

## Verification

Use synthetic fixtures only, in disposable profiles retained unless deletion is expressly authorized. Do not connect tests to the real relay/library or use the production project ID as a fixture.

Test:
- Each bucket's full, matching, clear and partial-selection behavior, including >50 matches and hidden selections.
- Exact and exceeded limits for projects, explicit scenes/full prompts, combined reusable records, media, candidates and receipts; whole-action rejection.
- Preset and full-access confirmation, cancellation, frozen inventories and default-deny behavior.
- No active change before Apply; one scope epoch change on Apply; stale production consent invalidation.
- Project-dependent full-prompt revocation and retained explicit-scene coverage.
- Exact receipt identity, disclosure of temporary receipt grants and their revocation.
- Snapshot changes, deleted selected IDs, disconnect and expiry during edits.
- Tab focus, keyboard navigation, incoming proposal preservation and no focus stealing.
- Project associations by IDs only; no false name-based relationships.
- Unchanged database contents after permission-only actions and unchanged legacy output fixtures.
- Actual transport pairing and proposal review against the isolated existing synthetic relay.
- Layouts/screenshots at 1440×900, 1366×768, 768×1024 and 390×844, plus 200%-equivalent CSS reflow. Distinguish an equivalent viewport check from any actual browser zoom/manual screen-reader check.

Run the complete unit/component suite, bridge tests/typecheck, root typecheck/build, production audits, QA ledger checks and synthetic browser suite. Record exit codes, warnings, skips and machine-readable results. Preserve historical QA reports; add this feature's evidence separately. Never claim a Windows/native or manual accessibility check was performed when it was not.

Provide the A PR, changed-file list, screenshots, measured results and remaining limitations. Keep it unmerged. Do not begin B or mutate the real wedding project before the requested review.
