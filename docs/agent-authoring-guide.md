# Authoring with reusable recipes

Build a shot from authorized reusable components whenever possible. A Recipe keeps Character, wardrobe, environment, action, camera, lighting and style separately editable and reusable. The deterministic assembler remains the authority for output text.

1. Inspect only the selected projects/assets and granted text. Reuse established identity/anchor text exactly; an image or title is not permission to infer traits.
2. Map the requested shot to existing assets. Propose missing reusable candidates for human review through the supported change-set operations; distinguish proposed content from approved library content.
3. Prefer `scene.create_recipe`, `scene.revise_recipe` or `scene.create_recipe_take` in their supported v2–v6 contracts. Blocking proposals require v5; frame authoring requires v6. Keep exact target IDs, expected revisions, participant bindings, source references and unchanged takes.
4. Leave incomplete plans unresolved. Do not fabricate media, approvals or required assets. Assembly should wait until the shot's required inputs are valid.
5. Use Direct Prompt when explicitly requested or when the current recipe cannot represent the intent. Explain the limitation. The existing guided Recipe conversion (`scene.convert_direct_to_recipe`, v4) creates an alternate take on the same shot and preserves the original and preferred take unless the user separately approves a preferred-take change.
6. Preview the exact difference, submit the proposal, and wait for actual browser review. Read the confirmed receipt within its authorized scope before reporting saved IDs. Submission alone does not save anything.

No new authority comes from these instructions. Project metadata, ordinary prompts, Character identities/approved anchors, private notes, filenames, media-use metadata, Full prompts and receipt recovery retain their existing independent permissions. Original media bytes are not shared through MCP. Do not modify an external provider automatically.

## Continuity inspection

Open **Collections → project → Continuity**. Its Overview, Wardrobe, Frames & Prompts and Transitions views inspect existing frozen selected takes and legacy shot-level images. Inspection never reassembles a saved output or changes its preferred take. Use the inspector's explicit review controls to save existing shot notes/intent or transition metadata.

First/Last images belong to the shot, not its selected take. They are not approved keyframes or ingredients merely because they are attached. Detached transitions retain their original pair after a reorder.

Structured Blocking is optional recipe data in Workstream B. Read it only with the exact **Blocking authoring text** grant. Use [v5 targeted patches](change-set-v5.md) for positions, movement, orientation, eyelines, props and interactions. Obtain the exact source-recipe/Blocking digests from authorized scene reads. Omission preserves data; null removes it only from the proposed new take. Reuse resulting explicit participant/asset bindings, stable IDs and the shared canonical video assembler. Do not silently rewrite identity, wardrobe, unrelated tracks or saved video strings.

Before submitting, review coordinated video differences and unresolved/manual outputs. Each affected manual mode needs its own browser-owned canonical/keep-unverified decision; submission is not approval. Final-state comparisons use final simulated storyboard order and selected takes. A proposed unselected take remains separately labelled. Read only confirmed IDs/results within the current scope; new takes receive no automatic Blocking or Full-text grants.

Ordered keyframes and canonical still-image prompts use [v6](change-set-v6.md) with exact source/keyframe digests, stable frame IDs and fresh scope3 pairing. Read only authorized frame plans and contributing assets; request the supported single-frame canonical preview rather than inventing an image prompt from hidden identities. Preserve untouched frames, propose coordinated video changes explicitly, and review manual-mode/carry-over choices separately. A new take or receipt grants no new image/video text access. Do not claim external images/videos were generated. Direct Prompts may retain incomplete planning; use guided Recipe conversion before complete structured authoring.

The recipe-first preference is descriptive guidance, not a ban on legacy Direct Prompt packages. Existing v1–v4 schemas, tool names, authorization and atomic approval paths remain supported. Old reconstruction operations cannot reinterpret a Blocking-bearing parent; use v5 for that case. Existing portable bridge releases require a separately reviewed rebuild/signing/activation to support the new capability transcript; updating the repository does not update the running launcher. [Setup and protected upgrade](blocking-and-spatial-continuity.md) · [actual certification status](qa/shot-blocking-b.md).

See [local MCP setup and permissions](local-codex-mcp.md), [guided Recipe conversion](recipe-builder-b3-contract.md), and [Continuity QA](qa/continuity-workspace-a.md).
