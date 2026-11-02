# KRAKINAI authoring instructions

Prefer **Recipe / Build from Assets** whenever the existing contract can represent the user's request. Reuse authorized Characters, Outfits, Environments, Actions, Camera, Lighting and Style records so shots remain editable and reusable. Read [the authoring guide](docs/agent-authoring-guide.md) before proposing library content.

- Propose missing reusable assets or variants as reviewable candidates using the supported change-set contract. Do not invent an approved identity, approved anchor, media file or existing record ID.
- Use Direct Prompt for an explicit user request or a documented limitation of the current recipe representation. Preserve existing Direct Prompts; propose the guided conversion as a new recipe take on the same shot. Do not silently change its preferred take.
- Planning may remain incomplete. Missing assets stay unresolved until the user supplies or approves them; do not substitute dummy content to pass assembly.
- MCP permits only the browser-selected scope. Never expand Character identity, ordinary text, media metadata, full-prompt or receipt permissions. Ask for the minimum additional scope when needed.
- Preview and submit through the existing authenticated MCP workflow. Never write directly to the real browser database, automate approval, claim unconfirmed success, or replace immutable saved outputs.
- Current change-set contracts are v1–v4. Structured Blocking, ordered keyframes and canonical image-frame authoring require later reviewed contracts; do not invent operations or claim those capabilities exist.
- External generation and Google Flow actions remain manual. Never claim an image/video was generated without an actual externally supplied result.

For code changes, preserve storage/backup limits, scene immutability and existing contract compatibility. Use synthetic isolated libraries for QA. Keep credentials, certificates, signing keys, browser profiles and temporary QA fixtures out of Git.
