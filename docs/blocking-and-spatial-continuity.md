# Shot Blocking and Spatial Continuity

Blocking records authored Start → Action → End direction for one recipe. It does not generate media, simulate physical movement, create keyframes, or infer identity from an image. Existing scene snapshots and prompt strings remain immutable.

## Enable an existing library

Use the same browser profile and exact application origin as your library. Before enabling Blocking, the compatibility screen lets you download a validated legacy backup. A download request is not proof that you saved that file to disk; keep your own backup.

Choose **Enable Blocking for this library** only when ready. This upgrades the IndexedDB header from 1 to 2, keeping the same eight stores and all existing records. Older builds cannot reopen that library. Close older KRAKINAI tabs if the upgrade is blocked. **Cancel** aborts a pending upgrade; an upgrade that already committed is reported as completed. Do not clear browser data to resolve a blocked upgrade. A new empty library starts at version 2.

The header barrier prevents older code from silently dropping new fields. It is not a conversion of existing saved prompts or an automatic backup.

## Author a recipe

1. Open a recipe in Scene Builder and choose **Edit Blocking**. Character identity stays in its selected frozen component.
2. Choose Start, Action or End. Use the board or the labelled forms for placement, body/head direction, eyelines, pose and movement. Off-camera participants can be targets; they cannot have visible staging.
3. Add explicit landmarks, a spatial origin/forward direction, props, holders and interactions when needed. IDs keep these relationships stable. Removing a referenced item requires repairing the dependent fields before assembly.
4. Save the Blocking editor to update the draft. Incomplete planning may be saved; assembly and immutable saves require valid bindings and relationships. Changing a Character, Outfit or Environment requires explicit binding review.
5. Assemble and review complete video outputs. For every active manual output, choose **Use newly assembled canonical output for this new take**, or **Keep this exact manual output; blocking correspondence unverified**. The default is unresolved. Keeping text preserves its exact bytes and manual marker; it does not certify agreement with Blocking.

Direct Prompts first use the guided Recipe conversion. **Plan blocking** opens a working Recipe with the components selected so far, even when required assets are still missing. Planning stays in the mapping package; **Download mapping package** keeps a strict v5 package that **Resume mapping package** can reopen. Resuming never refreshes stale source proofs automatically. No scene is created until its complete inputs and exact conversion/Blocking changes pass review. The eventual recipe is a separate take; the Direct Prompt and its preferred selection are preserved. Reusable templates require an explicit acknowledgement that scene-specific Blocking will be omitted.

The editor retains an unsaved working copy in the current tab's memory during Back/Forward navigation. It is not durable across a browser restart. If the source changes, saving stops and the local text remains available for review.

## Inspect saved continuity

Open **Collections → project → Continuity → Blocking**. Select a saved take and inspect its readonly board and complete authored detail. **Edit recipe copy** explicitly creates a revision draft on the same shot; inspection alone performs no save.

Comparisons use the immediately preceding shot in the complete storyboard order, even when a filter hides that shot. Exact scene IDs, shot IDs, project revision and comparison basis are shown. A reorder makes an already captured comparison stale rather than retargeting it silently.

Screen positions, facing, eyelines, visibility, prop holders and the declared ordered camera axis produce advisories. Missing Blocking, different spatial bases, changed identity bindings or ambiguous repeated appearances can make a comparison unavailable. An optional local mapping can confirm repeated appearances only with the same participant ID and Character identity. These are editorial checks, not a continuity score or proof that a scene is physically correct.

## Backups and exports

Historical full-backup manifest version 1 remains readable. A backup containing Blocking records or retained v5 import history uses manifest version 2 with explicit required features. Older readers reject it before replacement. A protected library with no new-format records/history may still export a legacy v1 manifest.

Project Export uses version 2 only when its selected takes contain Blocking. Its separate **128 MiB** limit is unchanged. Scene/generation documents use version 3 only for Blocking recipes; complete legacy output strings are preserved. Export does not silently filter reference files.

This feature does not implement the separate ZIP64 experiment or certify large-library capacity. Existing storage, backup, entry and media limits remain unchanged. The compatibility-header tests use small, decodable synthetic media; they are not large-archive certification.

## Codex connection

Use the [existing launcher setup](desktop-bridge-launcher.md) or [direct stdio setup](local-codex-mcp.md). Updating source does not update your portable launcher, shortcut or MCP registration. A new bridge candidate requires its reviewed signing and activation workflow; development does not activate it in your real library.

1. Disconnect before changing permission format. In Permissions, explicitly enable **Blocking permission format**, choose the project/scene metadata, and select exact scenes under **Blocking authoring text**. Positions, movement and prop labels may be private. No generic preset enables these new grants.
2. Enable **Allow blocking proposals** and **Allow change-set proposals** if proposals are wanted. All other text, identity, media, notes and receipt grants remain separate.
3. Apply permissions and complete a fresh browser/signed-Windows pairing with a bridge supporting `blocking.v1`, `change-set.v5` and `scope.v2`. A live legacy pairing cannot be promoted in place. Unsupported peers retain legacy scope1 use with Blocking disabled. Authentication, native denial or network failures never trigger a downgrade. Some older bridges do not expose readable CORS errors for unknown routes; these fail closed and require an update for Blocking.
4. Ask Codex for a [v5 recipe proposal](change-set-v5.md). Review exact fields, complete original/new video outputs and each manual-mode decision in Incoming Proposals. Check **Approve blocking changes** separately, then confirm the exact proposal and Apply.

Submission queues a proposal and writes no records. Apply revalidates the exact source, head, project, permissions and reviewed content in the existing atomic transaction. A new immutable take is created; preferred takes change only through separately approved selection operations. Codex receives confirmed IDs through the receipt, but new saved Blocking/Full text requires its own exact grants.

Native/installed-CLI certification and hosted CI status are recorded separately in the [B QA report](qa/shot-blocking-b.md); automated SDK smoke is not a substitute for that certification. [Workstream C](keyframes-and-image-prompts.md) adds ordered frames and separate canonical still prompts using protected header3 and permissioned v6 proposals. This document describes B; refer to the C guide for the newer compatibility boundary.
