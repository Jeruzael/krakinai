# Authoring with reusable recipes

Build a shot from authorized reusable components whenever possible. A Recipe keeps Character, wardrobe, environment, action, camera, lighting and style separately editable and reusable. The deterministic assembler remains the authority for output text.

1. Inspect only the selected projects/assets and granted text. Reuse established identity/anchor text exactly; an image or title is not permission to infer traits.
2. Map the requested shot to existing assets. Propose missing reusable candidates for human review through the supported change-set operations; distinguish proposed content from approved library content.
3. Prefer `scene.create_recipe`, `scene.revise_recipe` or `scene.create_recipe_take` in their supported v2–v4 contracts. Keep exact target IDs, expected revisions, participant bindings, source references and unchanged takes.
4. Leave incomplete plans unresolved. Do not fabricate media, approvals or required assets. Assembly should wait until the shot's required inputs are valid.
5. Use Direct Prompt when explicitly requested or when the current recipe cannot represent the intent. Explain the limitation. The existing guided Recipe conversion (`scene.convert_direct_to_recipe`, v4) creates an alternate take on the same shot and preserves the original and preferred take unless the user separately approves a preferred-take change.
6. Preview the exact difference, submit the proposal, and wait for actual browser review. Read the confirmed receipt within its authorized scope before reporting saved IDs. Submission alone does not save anything.

No new authority comes from these instructions. Project metadata, ordinary prompts, Character identities/approved anchors, private notes, filenames, media-use metadata, Full prompts and receipt recovery retain their existing independent permissions. Original media bytes are not shared through MCP. Do not modify an external provider automatically.

## Continuity inspection

Open **Collections → project → Continuity**. Its Overview, Wardrobe, Frames & Prompts and Transitions views inspect existing frozen selected takes and legacy shot-level images. Inspection never reassembles a saved output or changes its preferred take. Use the inspector's explicit review controls to save existing shot notes/intent or transition metadata.

First/Last images belong to the shot, not its selected take. They are not approved keyframes or ingredients merely because they are attached. Detached transitions retain their original pair after a reorder.

Structured Blocking is Workstream B. Ordered keyframes and canonical still-image prompts are Workstream C. These are labelled future capabilities in A and have no new MCP operations yet. Do not pretend that free text constitutes a structured frame plan or blocking record.

The new preference is descriptive guidance, not a ban on legacy Direct Prompt packages. Existing v1–v4 schemas, tool names, authorization and atomic approval paths are unchanged. Existing portable bridge releases require a separately reviewed rebuild/activation to receive updated tool descriptions; updating the repository does not update the running launcher.

See [local MCP setup and permissions](local-codex-mcp.md), [guided Recipe conversion](recipe-builder-b3-contract.md), and [Continuity QA](qa/continuity-workspace-a.md).
