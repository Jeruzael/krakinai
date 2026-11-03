# Image Frames and Video Prompt

Each planned frame has its own complete still-image prompt. The shot retains a separate video prompt describing motion. Neither assembling text nor attaching a file generates media in an external service.

## A simple first workflow

1. Open the shot's Recipe in Scene Builder. Reuse its Character, wardrobe, Environment, Action, Camera, Lighting and Style assets. Choose **Image Frames**, then explicitly create a Start/End plan or a custom plan. Opening this view creates nothing.
2. Select a frame. Name it, set its intended order/timing, choose the visible participants and author its frozen state. A frame can explicitly use Blocking Start or End, or a custom instant. Action is never interpolated into a middle frame automatically.
3. Enter the visual instructions for that frame. Review any legacy Camera, Action and Scene Instructions text: author a still adaptation or explicitly omit it from the still. Raw motion text is not silently rewritten as image instructions.
4. Preview the complete image prompt. Save the frame plan to the draft. Missing assets or instant states can remain unresolved; a complete neighboring frame can still assemble. Global structural problems must be repaired.
5. In Output, use **Image Frames** to select a frame and copy/download its Complete or Concise text. These controls use the complete backing string, not the displayed preview. **Video Prompt** retains Narrative, Structured, Compact and both JSON modes; References and Review remain separate.
6. For a new take, explicitly choose whether to keep the existing video text exactly, marked unverified, or reassemble it. Changed manual image modes each need their own keep-unverified/canonical decision. Save creates a new immutable take; the old take and preferred selection are preserved unless separately changed.
7. Generate media manually in your chosen external tool, then upload the actual result to the exact frame/take. Uploading resets its review to **needs review**. Compare it with that frame's prompt before recording a review.

Example: add a Middle frame to Shot 09 with “Aya turns toward the chapel door.” Keep the existing Character, gown and chapel selections. Author the Middle instant explicitly, retain Start and End, and review the separate motion text. A new take preserves the original take; it does not replace the saved shot in place.

## Images, history and revision conflicts

Draft uploads are draft-owned. Attaching them to a new saved take requires an explicit choice. An unchanged frame's existing image can be carried into the new take only after explicit approval; its review resets. Changed frame inputs do not inherit an old image as a matching result.

Replace and Clear append history; original files and immutable takes remain available. Legacy shot-level First/Last images stay distinct until explicitly adopted for an exact frame. Clearing an association does not delete a file needed by a saved take, draft or retained history.

An intervening draft edit, project revision or source/media change blocks stale saves. Local editor buffers are retained for comparison. Route navigation keeps the exact project, shot, take and frame; an unavailable frame ID is not replaced silently with the first frame. Unsaved recovery is limited to the current app process/tab, not a durable replacement for saving a draft.

Direct Prompts may retain incomplete frame planning. Use the existing guided Recipe conversion to create a new editable Recipe take on the same shot before complete canonical image assembly. The original Direct Prompt and preferred take remain preserved.

## Limits and protected compatibility

Plans allow 16 stable frame IDs, 128 KiB of plan JSON, 120-character labels, 2,000-character visual instructions and 500-character expressions. Each Complete/Concise image mode is limited to 256 KiB UTF-8; captured and manual image text together are limited to 1 MiB per take. Image history is bounded to 2,000 events and 4 MiB per project; the application fails closed rather than pruning history silently.

Frame authoring requires protected library header **3**, using the existing eight object stores. The explicit compatibility upgrade preserves records without backfilling frames or reassembling saved prompts. Older builds cannot reopen the upgraded database for writes. Keep a verified pre-upgrade full backup and an older build separately if rollback is needed; there is no lossy downgrade button.

Full backups containing C data/history use manifest2 with explicit required features and binary SHA-256 checks. Legacy backups remain readable; an older reader rejects unsupported C features before replacement. Scene/Generation documents use version4 for C recipes, Project Export uses version3 for C records. Project Export remains separately bounded at 128 MiB. Reference files are not silently filtered.

Stored media stays 5,000 MiB; existing full-backup/ZIP limits, 2,000-entry limits and the separately verified restore gate are unchanged. This feature does not certify PR #12's large ZIP64 experiment. C raster derivation accepts validated PNG/JPEG/WebP, within existing image limits, 16,384 pixels per edge and 64 million pixels; animated/invalid rasters reject. Larger legacy media stays preserved but may be unavailable for C derivation.

## Manual Flow handoff

From an exact saved take, open **Prepare for Flow**. Preview either Start plus optional End, or explicitly selected Ingredients. Choose any exclusions yourself; unresolved/missing selected files block a complete handoff. The ZIP contains selected original files, complete selected image/video text, stable IDs, roles and hashes. It uses the existing bounded export path: 128 MiB media, 16 MiB text and 2,000 entries.

Model/account/region support is not inferred. Dated guidance can become stale; unknown support remains Unverified. Ingredients do not guarantee middle-frame timing. Upload and generation in Flow remain manual. See the dated source links in the UI and [official Flow help](https://support.google.com/flow/answer/16353334).

## Codex access

Use a reviewed, signed C-capable bridge and a fresh native/browser pairing. Updating this repository does not activate a portable release or change global Codex settings.

Disconnect before changing permission format. Explicitly enable **frame permission format**, select the project and exact scenes under **Blocking authoring text** and **Frame plan text**, then Apply Permissions. Linked phases require their Blocking grant. Captured reference labels may require notes/filename disclosure. These choices do not grant Character identities or component text.

For the minimum useful proposal workflow, grant only the target project/source and contributing assets/variants, the particular identity/text needed, **Allow change-set proposals**, **Allow blocking proposals**, **Allow frame plan proposals**, and **Allow canonical image-prompt derivation**. Request additional scope only when the desired projection reports withheld contributors. Saved image text additionally requires the exact scene/frame grant under **Complete saved image prompts**. Video Full text, image prompts, media metadata and receipt recovery stay independent.

Codex reads opaque exact source tokens, previews a [v6 targeted proposal](change-set-v6.md), and submits it for browser review. Only **Apply reviewed batch** saves it through the existing atomic writer. New takes receive no automatic text grants. Codex must read the authorized confirmed receipt before reporting saved IDs. Disconnect or loss of the last initialized shared client revokes access.

See [authoring guidance](agent-authoring-guide.md), [connection setup](local-codex-mcp.md), and [measured QA status](qa/multi-frame-image-prompt-studio-c.md).
