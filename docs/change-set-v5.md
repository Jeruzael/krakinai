# Blocking recipe change sets v5

The strict [v5 JSON schema](change-set-v5.schema.json) extends v4 for Blocking recipe creation, revision, alternate takes and guided Direct Prompt conversion. V1–v4 schemas and legacy approval/replay projections remain unchanged. Unknown future keyframe/image-prompt fields are rejected.

## Exact existing targets

For `scene.revise_recipe`, `scene.create_recipe_take` or `scene.convert_direct_to_recipe`, supply native project ID/expected revision, shot ID, source scene ID, expected revision head, `expectedSourceRevision`, `expectedSourceRecipeDigest` and `expectedBlockingDigest`. An authorized `krakinai_get_scene` with the exact Blocking grant returns the opaque source tokens even when the scene has no Blocking yet. The digest is not permission to read hidden text.

SHA-256 proofs are prepared outside the IndexedDB transaction. The transaction compares the current canonical frozen source synchronously against its prepared proof and checks the expected digests/revision. Source/head/project/selection/order or relevant dependency changes invalidate approval. Do not compute asynchronous crypto in a live write transaction.

## Targeted patch

Omitting `blocking` preserves it. An explicit `null` removes it from the new take only. Otherwise provide `version: 1` and `expectedBaseDigest` equal to the source Blocking digest. A new recipe uses the SHA-256 of canonical JSON `null`, obtained through the documented digest helper or the corresponding authorized source token; it must not invent a stored source.

Patch fields:

| Field | Meaning |
| --- | --- |
| `participantUpserts` | Exact `{kind:'primary'}` or `{kind:'ensemble',participantId}`; update only supplied Start/Action/End fields. |
| `removeParticipants`, `participantOrder` | Explicit references; an order lists every resulting track once. |
| `landmarkUpserts`, `removeLandmarkIds`, `landmarkOrder` | Stable local landmark IDs; retain unrelated rows. |
| `propUpserts`, `removePropIds`, `propOrder` | Stable local prop IDs and typed holder relationships. |
| `space`, `camera` | Supplied field changes; optional fields can be explicitly cleared with `null`. |

Participant upserts can explicitly set `bindToRecipe: true` to bind the named track to the resulting, explicitly selected Character/Outfit. Space can explicitly use the same flag for its selected Environment. This supports approved same-batch candidates; it never creates a participant or infers identity. Without an explicit rebind, stale tokens remain a blocking assembly issue.

Action interaction changes use `interactionUpserts` (stable IDs), `removeInteractionIds` and `interactionOrder`. Interactions are ordered authored actions, not timestamps. Other optional field nulls clear that field. Required data cannot be cleared into a valid immutable save. Duplicate/conflicting IDs, partial orders, unsafe keys, unknown fields and unsupported target types reject. Removing a referenced target without repairing its dependencies cannot produce a valid saved scene.

Shared model limits: eight tracks, sixteen landmarks, sixteen props, thirty-two interactions total, four waypoints per track, and 64 KiB UTF-8 for resulting Blocking. IDs, text and nested values use the same strict validator as manual authoring.

## Human decisions and exact review

Approval fields are browser-owned and cannot be serialized into operations. V5 adds `blocking: boolean` and optional `blockingOutputDecisions[operationId][mode]` choices `canonical` or `keep_manual_unverified`. Affected manual modes default to unresolved. Legacy blanket-discard consent is not accepted for v5. Changing candidate choices clears Blocking/output decisions and invalidates exact review.

Review binds exact source/new Blocking, stable changed paths, complete canonical/effective outputs, inherited manual buffers, choices, target mappings, final storyboard order and selected takes. Comparisons run after all simulated operations. A new unselected take has a separately labelled hypothetical comparison; it is not shown as the project's selected take.

Old v1–v4 reconstruction of a Blocking-bearing parent fails explicitly. Metadata-only operations that do not reconstruct the scene retain their normal behavior. There is no generic JSON-pointer writer, separate Blocking writer, approval tool, external generation tool or generic future-field acceptance. [v6](change-set-v6.md) separately versions frame authoring; v5 stays unchanged.

## Atomic receipt and replay

A successful v5 apply produces receipt `version: 2`, `changeSetSchema: 'krakinai.change-set.v5'`, exact approval/output choices and the existing ID mappings/results. Its bounded `reviewedContent` is canonical, non-executable JSON evidence containing the complete review; it is never reconstructed into writes or returned by the MCP receipt projection.

The existing preference ledger upgrades to version 2 only within the successful atomic apply. It holds unchanged v1 receipts alongside v2 receipts. Capacity failure, quota/transaction abort or revoked approval leaves no partial record or receipt. The same change-set ID/package/approval replays the existing receipt without duplication; changed content or decisions under that ID reject.

Ledger2 persists after related scenes are deleted and still requires full-backup manifest2. Receipt recovery shares historical IDs/outcomes, not private review text or grants to new scenes. The MCP tool allowlist remains thirteen tools and existing package/result/session bounds remain unchanged.

See [user workflow and upgrade](blocking-and-spatial-continuity.md), [recipe-first agent guidance](agent-authoring-guide.md), [QA evidence](qa/shot-blocking-b.md) and [approved design](superpowers/specs/2026-11-03-shot-blocking-spatial-continuity-b-design.md).
