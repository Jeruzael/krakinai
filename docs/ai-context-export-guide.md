# Export Context for AI

Open Export Context for AI from a project or Collections. Select only the projects, saved scenes and reusable assets relevant to the request. The preview shows exactly what Copy/Download will share; exporting performs no database writes and sends nothing over the network.

The default is metadata: selected project IDs/revisions; shot IDs/order/codes/type/duration/status/preference; saved scene IDs/root/current head; selected asset IDs/names/categories/tags; pending-input IDs/kinds and association availability. It excludes prompt text, identity anchors, notes, filenames, blobs and preferences. Names/titles/tags can themselves be private: select deliberately.

Opt-ins are separate:

- Choose specific saved scenes whose complete Full prompt may be included.
- Include selected ordinary asset/variant/template prompt text.
- Include selected character identity/anchor details. Generic asset text never turns this on.
- Include notes and pending descriptions, including project planning/continuity/review/claim notes.
- Include associated media filenames. Original bytes and filesystem access are never included.

The package is bounded to 5 MiB, 10 projects, 250 shots, 250 scene metadata records and 500 combined selected assets, variants and templates. It fails rather than truncating text. A context export contains only selected project records; global head IDs of shared revision histories may be reported for concurrency, without unrelated project details or unselected prompt bodies.

Frozen component metadata includes source IDs/revisions, current availability and current expected revisions, allowing exact asset/variant selection. Internal reference-pack association IDs can embed labels/filenames: context uses scoped association indexes instead of exporting raw IDs. This does not change stored reference packs. Variant prompt text is shared only with its independent ordinary-text opt-in; character identity remains separately controlled.

Copy/download `krakinai.ai-context.v1` JSON and provide it manually to ChatGPT/Codex together with the [change-set contract](change-set-contract.md) and [JSON Schema](change-set.schema.json). A useful instruction is:

> Prepare one krakinai.change-set.v1 JSON package for my requested storyboard. Use the exact IDs and expected revisions in this context. Use stable clientRef values for newly created records and refer only to earlier operations. Keep my complete prompt strings unchanged. Never guess IDs, create placeholder media/assets, replace approved identities, mark claims verified, or include approval grants. Leave unavailable source files as pending inputs. Propose reusable assets separately for human review. Use a new stable changeSetId for this requested batch. Return JSON only, with no executable fields.

Import the returned package, review all changes and conflicts, choose candidate decisions and explicit approval groups, then Apply. Context is not a backup and cannot be imported as a change set. Re-export context after other tabs change target records; stale imports fail as a complete batch. This manual workflow does not claim an active ChatGPT connection.
