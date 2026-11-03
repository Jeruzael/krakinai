# Frame authoring change sets v6

`krakinai.change-set.v6` extends v5's strict Recipe operations. Existing v1–v5 contracts remain supported; older reconstruction contracts cannot silently discard C-bearing parent data. Use the [generated JSON schema](change-set-v6.schema.json) and existing authenticated preview/submit tools. No approval or arbitrary JSON-pointer write tool is added.

## Exact targets and patch semantics

`scene.revise_recipe`, `scene.create_recipe_take` and `scene.convert_direct_to_recipe` require the exact project/expected revision, shot, source scene, expected head, source revision, source Recipe digest, Blocking digest and **expectedKeyframeDigest**. Read these opaque tokens from the authorized `krakinai_get_scene`; a digest grants no hidden content access.

Recipe operations accept `keyframes`: omit to preserve; `null` to remove only from the proposed new take; otherwise use a patch with `version:1` and `expectedBaseDigest` equal to the authorized source keyframe digest. New recipes use the canonical null-plan digest, not an invented stored ID.

| Patch field | Meaning |
| --- | --- |
| `frameUpserts` | Stable frame ID plus only changed label, role, timing, participants, instructions, instant, expressions, composition and reference associations. |
| `removeFrameIds` | Explicit removal; unrelated frames remain unchanged. |
| `frameOrder` | Every resulting frame ID exactly once; reordering does not retime it. |
| `stillSourceAdaptations` | Explicit still text or omission for legacy Camera, Action and Scene Instructions. |

A linked instant names Blocking `start` or `end`. A custom instant uses typed `participantUpserts`, optional `removeParticipants`/`participantOrder`, and prop changes. Do not send a stored plan's `participants` array as a wire patch. Exact participant references and binding tokens remain authoritative; `bindToRecipe:true` is an explicit rebind, not identity inference. Targeted expression changes use `expressionUpserts`. Unknown fields, conflicting IDs and partial orders reject.

`videoDecision` is `keep_exact_unverified` or `reassemble`. Image carry-over explicitly names `frameId`, existing `associationId` and `expectedRevision`; unchanged inputs are checked and review resets. Per-mode manual output choices and final approval are browser-owned, never serialized consent in the proposal.

## Frame-specific operations

`frame_image.link` proposes an existing authorized media record for an exact project/shot/scene/frame. `frame_image.clear` clears that association while preserving history/files. Both pin `expectedFrameDigest` and `expectedAssociationRevision`; existing scenes also require their revision. A same-batch scene can be targeted by its exact client ref. No upload of arbitrary paths or external media generation is implied.

`frame_video.request_review` requests correspondence review for the exact scene/keyframe digest. It does not declare an AI-generated prompt or result approved, replace video text or perform external generation.

Shared limits: 16 frames, 128 KiB plan JSON, 256 KiB per image mode, 1 MiB image text per take, 2,000 history events/4 MiB per project. The existing MCP package/result ceilings are unchanged; an oversized complete result rejects rather than truncates.

## Permissioned reads and derivation

The same thirteen MCP tools remain available. Scope3 adds exact `keyframeSceneIds`, exact `{sceneId,frameId}` image-prompt grants, and independent keyframe/image proposal and derivation flags. Scope3 requires transcript-bound `keyframes.v1`, `image-prompts.v1`, `change-set.v6`, `scope.v3` and inherited Blocking capabilities through fresh native pairing. Old grants never promote automatically.

`krakinai_get_scene` with `projection:'keyframes'` returns only the permitted plan projection and opaque targets. A complete saved image uses `krakinai_get_generation_prompt` with `sceneId` and `target:{kind:'image',keyframeId,mode:'full'|'compact'}` and its independent grant. Contributor identity, ordinary text, notes, filenames and original-media metadata permissions remain separate. Original binary bytes are not returned.

`krakinai_preview_change_set` may request one canonical image via `projection:{operationId,keyframeId,mode:'full'|'compact'}`. It requires explicit derivation and all contributing disclosures, without implicitly granting saved image or Video Full text. Metadata and withholding explanations do not include the withheld prompt.

## Browser review, atomic save and receipts

Review displays exact changed paths, frame order/timing, complete image/video texts, inherited manual buffers, carry-over and correspondence decisions. Candidate/choice changes invalidate exact approval. The browser requires the applicable storyboard/scene/Blocking/frame/image/video review categories and final exact-proposal confirmation.

Hashes/decoding prepare outside IndexedDB under the cooperating origin media lock. At the existing Stage B atomic boundary the writer revalidates current source/head/revisions, media proofs, scope, choices and one-use consent. Any stale state, quota/transaction failure or revoked approval leaves all stores/receipt unchanged. New immutable scenes preserve unrelated frames, old takes and preferred selections unless an explicit separately approved selection changes them.

Successful v6 applies create receipt/ledger **version3**. The receipt includes exact saved IDs and frame results; older receipts retain their historical shapes. Identical replay returns the existing receipt without duplication; changed package/decisions under the same change-set ID reject. Receipt recovery after restart requires explicit recovery grants and fresh pairing, and does not grant text access to the new scene.

See [user workflow](keyframes-and-image-prompts.md), [Recipe-first guidance](agent-authoring-guide.md), [v5 inherited rules](change-set-v5.md), and [actual certification status](qa/multi-frame-image-prompt-studio-c.md).
