# Shot Blocking & Spatial Continuity — Workstream B design

Date: 2026-11-03. Status: design and implementation plan approved by the owner; inline implementation authorized on 2026-11-03. Progress is recorded in the plan-scoped execution ledger; no live library upgrade is part of development.

Base: integrated Workstream A, master `c3866116c5299cda4e0049b941ddabc17f569066` (PR #37 merged). Design branch: `codex/shot-blocking-spatial-continuity`. Companion desktop/mobile previews use synthetic Aya/Lucas/Marco examples only.

## 1. Intent, decisions and boundaries

Let a creator describe where each bound Character starts, what they do, and where they finish, then inspect spatial continuity across the selected takes. The same authored blocking must inform the canonical video prompt and Codex proposals. It must not become a second, competing Collection note or an independent AI writer.

**Owner decision:** use a protected one-time library-format upgrade so older builds cannot reopen the library and silently drop new blocking fields. Preserve all existing records. The upgrade itself has not been performed.

**Existing owner decisions:** prefer Recipe / Build from Assets and authorized reusable components; Direct Prompt planning can remain incomplete, with the existing guided Recipe conversion before complete recipe assembly. Preserve original Direct Prompts, preferred takes, snapshots, identities, references, media and backups. Use separate A → B → C reviews and PRs. Full Codex support and browser-owned approval are mandatory.

**Agent proposals included in the approved design:** the model/bounds below, database version 1 → 2 without a store/record migration, capability-aware backup/export formats, change-set v5 and scope v2, the form-plus-diagram interaction, and conservative spatial advisories. Their exact names can be refined by the builder without changing their semantics.

### Approaches considered

| Approach | Tradeoff and ruling |
| --- | --- |
| Optional structured blocking in the authoritative recipe, shared forms/diagram/assembler/MCP validators | Recommended. Preserves immutable takes and gives UI/Codex the same deterministic meaning. This follows the existing brief's explicit recipe-authoring requirement. |
| Blocking stored only on a Collection shot | Simpler display, but one shot has several immutable takes; it would make historical blocking and copied video prompts ambiguous. Ruled out by the brief. |
| Free-text-only blocking, or a separate 3D choreography application | Free text lacks stable references and checkable relationships; 3D simulation adds unsupported physical precision and a separate authoring system. Neither fits this milestone. |

### B includes

- Optional participant-bound Start → Action → End staging in Scene Builder and Continuity → Blocking.
- An editorial 2D staging board, complete non-drag controls, exact selected-take inspection and cross-shot advisory comparison.
- Shared canonical video formatting and immutable recipe save/revision/take support, with complete preview of resulting video outputs.
- Protected storage compatibility, legacy backup acceptance, explicit new-format backup/export support and unchanged size limits.
- Permissioned MCP reads/proposals/differences, atomic approval, rollback and receipt replay, tested with actual installed Codex calls.

### B excludes

Ordered keyframes, per-frame image prompts/assembly, take-specific frame-image assignment, Flow handoff, generated images/video, external provider actions and a new template-authoring feature. Those remain C or a later explicitly approved feature. B does not create a frame plan, retarget legacy First/Last images, modify an existing take, or automate approval. It does not merge PR #12, change ZIP64 capacity/restore certification, alter global Codex registration, rebuild over a live bridge or modify the real browser library during development.

## 2. Verified current architecture

- [`db.ts`](../../../src/storage/db.ts) uses IndexedDB **version 1** and eight stores. It currently has no `onblocked` or connection `onversionchange` handler. Database version and backup manifest `SCHEMA_VERSION` are separate compatibility concerns even though both currently equal 1.
- [`domain.ts`](../../../src/types/domain.ts) stores `SceneDraft.inputRevision`, immutable saved scene snapshots and exact saved output strings. Optional ensemble data binds up to eight participants; [`ensemble.ts`](../../../src/types/ensemble.ts) retains stable local participant/cue IDs and on/off-camera presence.
- [`sceneDocument.ts`](../../../src/domain/sceneDocument.ts), [`ensembleDocument.ts`](../../../src/domain/ensembleDocument.ts) and [`promptAssembler.ts`](../../../src/domain/promptAssembler.ts) produce legacy/ensemble canonical documents and Full/Structured/Compact outputs. Scene JSON currently has v1/v2 shapes; [`generationDocument.ts`](../../../src/domain/generationDocument.ts) also distinguishes v1/v2.
- [`sceneAuthoring.ts`](../../../src/storage/sceneAuthoring.ts) and [`changeSets.ts`](../../../src/storage/changeSets.ts) use the shared authored-scene planner, expected source/project/head checks, one transaction and durable receipts. Existing saves prefer manual output overrides when present; simply adding blocking to the assembler would not make those overrides consistent.
- [`changeSetSchema.ts`](../../../src/domain/changeSetSchema.ts) supports v1–v4. [`changeSetRecipeContent.ts`](../../../src/domain/changeSetRecipeContent.ts) explicitly enumerates content bound into approval; new blocking must be included rather than assumed covered.
- [`mcpScope.ts`](../../../src/domain/mcpScope.ts) validates an exact v1 scope. Scene metadata/project authorization, Character identity text, ordinary asset text, notes, filenames, exact Full prompts and receipt recovery are independent. [`proposalBroker.ts`](../../../src/connections/proposalBroker.ts) generally returns proposal metadata rather than unfiltered prompt differences.
- [`backup.ts`](../../../src/storage/backup.ts) rejects an unsupported manifest version before restoration. [`projectExport.ts`](../../../src/domain/projectExport.ts) uses `krakinai.project-export.v1` and preserves a separate 128 MiB selected-media limit.
- A's [`ContinuityViews.tsx`](../../../src/components/ContinuityViews.tsx) deliberately contains a Blocking placeholder. The shared shot navigator, inspector, dirty-review protection, routing and preview dialogs already exist.

These are source inspections, not evidence that the new B behavior has been implemented or tested.

## 3. Creator workflow

### Scene Builder

Add a compact **Blocking** section showing “Not authored”, “Planning incomplete”, “Authored” or an actionable validation state. Unauthored blocking is optional and never blocks a legacy/video-only recipe.

Open **Edit blocking** to select an actual participant and edit Start, Action or End. Show the participant's frozen Character/Outfit source, presence and identity-lock indicator; keep complete prompts collapsed. Do not change participants, identities or Outfits implicitly from this editor.

Each phase offers screen placement, scene placement, body direction, head direction/eyeline, pose and props. Action adds movement, entrance/exit and interactions. The staging board reflects these fields; dragging is an optional shortcut, never the only editing method. Changes use the existing draft revision/dirty guards. Save Draft may preserve structurally valid incomplete planning; assembly and immutable saves reject invalid authored relationships.

For a Direct Prompt, **Plan blocking** opens/creates an explicit new working Recipe draft through the existing guided conversion flow. It can remain incomplete and recoverable; the Direct Prompt is untouched. Do not hide unsaved structured planning in Collection notes or create a fake Character. Fully assembling/saving the converted recipe waits for its required components. MCP uses the versioned guided-conversion operation with the same conditions.

### Continuity → Blocking

Reuse A's exact shot/subview/return routing. Display the selected saved take, its authored blocking and a Start/Action/End phase selector. Read-only inspection never materializes or saves a plan. **Edit a recipe copy** opens a managed draft for the exact scene/shot, retaining the expected source head and project revision. Show the unsaved-versus-saved distinction throughout; no marker drag edits a saved take.

Desktop: sequence navigator above a staging board, with a focused participant inspector beside it. Tablet/mobile: board and concise participant summary followed by an accessible editor/dialog with Save/Cancel. Next/Previous follows the visible shot sequence, retaining an outside-filter selection as A does. The original-image preview remains independent and preserves dirty text.

**Compare previous shot** shows the previous shot's selected saved take End versus the current take Start. Use current storyboard order for choosing the pair; capture exact scene/shot IDs while inspecting and disclose a stale/reordered pair rather than retargeting it. Keep spatial review separate from existing transition metadata.

## 4. Authoritative optional model

Propose `SceneBlockingV1`, optional as `blocking` on a Recipe draft/saved scene and the scene-document source. It owns authored semantic fields, not diagram pixel coordinates or media files. No Collection-level duplicate and no new object store.

Conceptual shape (not implementation code):

```ts
type ParticipantRef = { kind: 'primary' } |
  { kind: 'ensemble'; participantId: string };
type TargetRef = { kind: 'participant'; participant: ParticipantRef } |
  { kind: 'landmark'; landmarkId: string } | { kind: 'camera' };

interface SceneBlockingV1 {
  version: 1;
  space?: BlockingSpace;        // declared editorial geography
  landmarks: BlockingLandmark[];
  props: BlockingProp[];
  participants: ParticipantBlocking[];
  camera?: BlockingCamera;
}
```

### Identity and presence

- `primary` refers only to the actual legacy single-Character snapshot. It is not an invented ensemble participant and is invalid when an ensemble exists. Ensemble references resolve exact `participantId`; repeated bindings of the same Character stay distinct.
- Each participant track captures a writer-derived binding token from the frozen source type/ID/revision. Client text cannot claim another identity or approval. A different binding/revision makes the track require explicit review/rebinding; never apply an old track to a replacement Character silently.
- `presence: off_camera` does not acquire a visible marker. On-camera participants may start/end out of frame to describe entrance/exit; that phase visibility is different from an off-camera narrator. An eyeline can target an explicitly bound off-camera participant without making them visible or revealing unshared identity text.
- No image analysis, facial/wardrobe inference or title-based identity matching. Unbound legacy/template Character snapshots remain labelled; they are not automatically equated across shots.

### Participant track

One track per `ParticipantRef`, with independent `start`, `action`, `end` objects. An omitted field means unspecified, never copied from another participant. The UI may offer **Copy Start to End** as an explicit local edit.

`start`/`end` contain:

- visibility: `on_screen | out_of_frame | unspecified`;
- horizontal screen zone: `left | center | right | unspecified`;
- depth: `foreground | midground | background | unspecified`;
- optional scene placement: exact landmark ID and `at | near | left_of | right_of | in_front_of | behind`;
- optional body/head direction: a camera-relative eight-direction value, or an exact participant/landmark/camera target; body and head may differ;
- optional eyeline target and pose/posture text.

`action` contains bounded movement/action text, an explicit `hold | move | enter | exit | unspecified` kind, optional waypoint landmark IDs (maximum four), and typed interactions with exact participant/prop targets. Do not introduce timed keyframes or claim physical interpolation. Start/Action/End are semantic phases, not three mandatory image frames or provider timestamps.

Agent-proposed interaction vocabulary is `approach` (participant/landmark), `follow` (other participant), `face` (participant/landmark/camera), `touch` (participant/landmark/prop), `gesture_to` (typed target), `avoid` (participant/landmark), `transfer_prop` (prop plus distinct from/to participants), and `custom` (nonblank bounded description, optional typed target). Each interaction has a stable ID; array order is authored action order. Off-camera participants can be referenced as targets/receivers, without a visible track or invented position. Unknown interaction types, nonexistent references, duplicate IDs and self-follow/self-transfer are structural errors. Body/eyeline/artistic inconsistencies and possible handoff inconsistencies are advisory, not a natural-language simulation.

For an explicitly typed `enter`, complete assembly requires Start `out_of_frame` and End `on_screen`; `exit` requires Start `on_screen` and End `out_of_frame`. Unspecified visibility in these cases is incomplete planning; the opposite explicit combination is invalid. Do not enforce those endpoint rules on `hold`, `move`, `unspecified` or `custom`: a camera reveal or complex in/out action can explain phase visibility changes, so those receive at most an advisory. An on-camera participant is not required to be visible at both endpoints. Use `custom` for multi-entry/exit choreography B's three phases cannot encode faithfully.

### Geography, landmarks, camera and props

- `space.id` is a stable local geography ID. `originLandmarkId` plus `forwardLandmarkId` optionally define scene-relative left/right. Without this basis, do not infer world-left/right from screen-left/right. Environment binding is captured from the recipe; a changed Environment requires explicit geography review.
- Landmarks have stable IDs and labels (e.g. chapel door, aisle midpoint, altar). Optional authored screen-zone/depth makes them visible on the board; no position is invented from their names. **Reuse spatial setup** explicitly copies a frozen setup into the current draft, retaining its declared space/landmark IDs and showing its Environment binding for review. Nothing writes back to the source take.
- The board is a camera-relative zone/depth schematic. It is not a scaled floor plan. Moving a screen marker changes only screen fields; it does not calculate or silently change scene placement, facing, eyelines or camera parameters.
- Camera direction may target a landmark. An optional axis has a stable ID, ordered endpoint references and declared side `A | B | on_axis | unspecified`. Do not calculate a physical 180-degree line from prompt prose. Changed/reversed axis definitions are “not directly comparable” unless their exact declared basis aligns.
- Props have stable IDs, authored labels and optional descriptions. Start/End holder is an exact participant, explicit shared-holder set, landmark, unheld or unspecified. Shared holding is supported; prop ownership means in-scene handling, not legal ownership. Transfer interactions identify the same prop and exact participants. B adds no prop media or reusable prop asset store.

### Bounds and validation

Agent-proposed limits: 8 participant tracks (existing ensemble ceiling), 16 landmarks, 16 props, 32 interactions total across all tracks, four waypoints per track; IDs ≤64 characters using the existing safe local-ID pattern; labels ≤120, pose/movement text ≤500 and descriptions ≤1,000 characters. Total serialized blocking is at most **64 KiB UTF-8**, including all text. Test maximum-width Unicode and reject unknown keys, unsafe/duplicate IDs and non-finite values. These are ceilings, not default content to manufacture.

Two validation modes share one domain validator:

- **Planning:** schema/bounds must be valid; missing required scene components and unresolved staging relationships can remain in an unsaved/draft plan, with explicit incomplete findings. Do not drop unresolved rows on save/reopen or backup.
- **Assembly/immutable save:** authored references/bindings must resolve in that exact recipe; reject duplicate tracks, stale binding tokens, nonexistent targets, visible staging for an off-camera-only participant, invalid basis/axis references and incoherent typed entrance/exit states. An entirely absent blocking object is valid. Partial optional positions remain “unspecified”, not fabricated completeness.

When a participant, landmark or prop is removed, show the affected tracks/targets. Require explicit repair/removal of dependent authored references; retain the working draft if the user cancels. Structural relationship errors are blockers; artistic choices and cross-shot discontinuities are advisory.

## 5. Canonical video output and manual edits

Use one pure blocking document/formatter and one validator for Scene Builder, saved-scene authoring, change-set planning, JSON/text export and MCP preview. Do not maintain separate AI-generated blocking prose as authority.

Only when blocking is present, emit a labelled **Blocking & spatial direction** section in Full/Structured and a concise semantically complete section in Compact. Stable ordering is recipe participant order, then landmark/prop ID order; changing visual board layout cannot reorder output. Include relevant Start → Action → End, facing/head/eyeline, interactions and declared camera basis. Preserve exact dialogue bytes and all frozen Character/Outfit/Environment text. Do not append a still-image prompt or invent connective actions for unspecified fields.

Propose `krakinai.scene-prompt.v3` and `krakinai.generation-prompt.v3` for documents containing blocking. Unauthored legacy/ensemble scenes continue through their exact v1/v2 branches with byte-identical outputs and JSON shape. Never reassemble an old saved scene merely to inspect, export or upgrade its database header.

Changing blocking increments the draft input revision and marks existing manual buffers stale using current semantics. Before any browser- or MCP-authored blocking revision is saved, preview all complete generated video modes and every active manual override. Both paths use the same gate. For each affected Full/Structured/Compact mode, the human must choose **Use newly assembled canonical output for this new take** (recommended), **Keep this exact manual output; blocking correspondence unverified**, or cancel/keep the planning draft/package. Default is unresolved. The keep choice retains the exact reviewed buffer and its manual marker; it does not imply synchronization or suppress the warning. Do not silently clear, copy over or overwrite an inherited manual override. Original bytes always stay in the old immutable scene and comparison view.

Existing general manual-output editing remains available. If the user deliberately saves manual text on a blocking recipe through that workflow, use the same explicit decision and label its blocking correspondence **unverified / manual review required**; do not infer synchronization by searching for words. B's generated preview is canonical, but an effective manually edited/saved output is labelled manual, not represented as canonical or proven consistent. V5 reconstruction retains inherited manual buffers for review instead of invoking the old recipe planner's silent clear behavior. The per-mode choices, complete reviewed buffers and resulting outputs are part of the exact review digest and v5 receipt. V1–v4 legacy planner behavior is not reinterpreted.

Blocking-only revisions must preserve all component snapshots, generation identity/anchor choices, source media, reference pack/associations, dialogue and instructions unless those changes are separately explicit in the same reviewed recipe operation. If current identity resolution would cause fallback/refresh, stop with a dependency-review finding rather than silently changing the source's frozen identity to make a blocking-only operation pass.

## 6. Spatial continuity findings

Compare only exact selected scenes. Match legacy primary appearances only when uniquely bound to the same stored Character. For ensembles require exact participant IDs and Character binding; duplicate/ambiguous appearances require explicit comparison mapping. Never match names or reuse a different participant's Outfit.

The comparison engine uses typed values, stable declared geography and known references. It does not pretend to understand arbitrary movement prose or infer stage geometry from images. Produce deterministic evidence paths, participant/prop IDs, source scene IDs and actionable suggestions.

For a v5 batch, compute cross-shot findings **after all operations have been simulated**, using the final simulated shot order and explicitly selected takes. Do not change existing expected-revision semantics. If the new take is not selected, keep active-project continuity based on its old selected take; show a separate clearly labelled **Proposed unselected take vs previous selected take** comparison. Never present the candidate as the current selected take. Bind the original project revision, final order, compared shot/scene IDs, comparison basis and findings into v5 approval. Any reorder/selection change before Apply invalidates the preview. This is a derived review, not a stored comparison that will retarget itself later.

| Finding | Condition and severity |
| --- | --- |
| Position/depth discontinuity | Comparable previous End/current Start differs; advisory |
| Facing/head/eyeline discontinuity | Explicit comparable fields disagree; advisory, including a possibly intentional look-away |
| Prop handoff to review | Exact prop in the same declared space changes holder without a declared transfer; advisory; explicit shared holding is valid |
| Entrance/exit continuity | Comparable phase visibility changes without an indicated entrance/exit; advisory across shots |
| Camera-axis change | Same declared ordered axis/basis changes side; advisory; unknown/redefined axes disclose insufficient information |
| Participant/binding mismatch | Ambiguous correspondence across shots is advisory/uncomparable; a dangling/stale reference within the authored recipe blocks assembly |
| Dialogue/presence conflict | A bound off-camera narrator must not become a visible actor; typed contradictions are blockers within the recipe; semantic performance conflicts remain advisory |

Editorial cuts, reverse angles, time jumps, intentionally broken geography and unknown fields are legitimate. A comparison-only interpretation control can explain/filter advisories in the current UI session; it does not rewrite a take or silently save an exception. Existing shot continuity notes remain explicit metadata edits. Optional missing blocking is not a blocker and is not scored as “unsafe”.

## 7. Protected storage upgrade and backup compatibility

### One-time explicit database upgrade

Implement the owner's selected **IndexedDB version 1 → 2** barrier, retaining all eight stores, keys, records and media bytes. No migration walks/rewrites records and no data is cleared. Keep `SCHEMA_VERSION`/backup format independent of the IndexedDB header.

Before opening an existing v1 library for normal B writes, show a clear enable/update decision: “Existing data stays; older builds will no longer open this library. Keep using the current build until you are ready.” Proceed only after explicit **Enable blocking-compatible library** confirmation. Cancel leaves v1 intact. A fresh empty library may be created at v2. Probe an absent database without accidentally creating a populated v1 library; do not wait for UI inside an upgrade transaction.

Upgrade waits for old connections. Because old A builds lack `onversionchange`, the UI must handle `onblocked`, identify that older tabs/windows need to close and offer retry/cancel; never force-clear data or assume they closed. No blocking write is allowed before the upgrade succeeds. Older tabs can still make legacy writes while upgrade is blocked; reread state after it succeeds. A blocked/failed/cancelled upgrade preserves those writes and all old records. New B connections close on version change and discard cached connection promises safely. An old build's version-1 open then fails with IndexedDB `VersionError`, preventing lossy old-writer access.

This is a deliberate downgrade boundary. It is not an automatic rollback migration. For returning to A, use a separate profile/origin and an actual pre-upgrade legacy backup; do not force a lower database version or strip blocking. Offer normal verified backup tools before enablement, while respecting their actual supported capacity. Do not promise a 5,500 MiB restore or bypass the unresolved PR #12 gate.

### Backup/export versioning

- New code accepts historical full-backup manifest version 1 unchanged. Use a **separate manifest version 2** when the library contains blocking-bearing drafts/scenes **or a v2 import ledger/v5 receipt**, even if every blocking scene was later deleted. A shared feature detector chooses `requiredFeatures` (e.g. `blocking.v1`, `change-set.v5-ledger`) from all exported records and retained ledger state. Old readers reject manifest version 2 before any replacement. A library with no new-format records or ledger can still export legacy v1 even when its database header is 2.
- Validate the optional blocking model in drafts and strictly in saved scenes; unknown required features/unsupported versions reject before writes. Preserve historical saved output strings, import receipts/approved digests, stable IDs and media hashes. Restoring v1 into a v2 database does not downgrade its header.
- Extend the integrated full-backup validation/replacement paths, not the unrelated ZIP64 experiment. Keep atomic replacement/rollback and existing archive/entry/metadata limits. Do not alter the separate verified restore ceiling if present in a later integrated base.
- Project Export with a selected blocking-bearing take uses `krakinai.project-export.v2`, with exact blocking and v3 scene/generation documents. Legacy-only exports stay v1. Selected-media **128 MiB**, text **16 MiB**, **2,000 entries** and current inclusion choices stay unchanged. Do not silently filter reference files.
- Include B fields and resulting output strings in existing capacity calculations: 20 MiB full-backup metadata, 1 MiB MCP package, 512 KiB result and all current library/media/archive bounds. Reject oversized packages/exports atomically and offer smaller batches; never truncate output or raise limits.
- Existing templates retain their current contract. B does not add blocking-template authoring. Save as Template from a blocking draft must explicitly disclose/acknowledge that scene-specific blocking is not included; the source draft/scene remains intact. Applying an existing template cannot silently erase blocking; retain it and surface unresolved bindings after a component change, or explicitly confirm removal. Scene copy/reopen/revision/alternate-take paths do preserve blocking.

## 8. Explicit Codex/MCP contract

### Versioned permissions, no expanded legacy consent

Propose `McpScopeV2`, preserving exact v1 validation/wire behavior. V2 adds:

- `blockingSceneIds: string[]` (maximum 250 exact saved scene IDs, intersecting normal authorized scene scope);
- `allowBlockingProposals: boolean`, default false.

Old v1 scopes normalize internally with no blocking disclosure/proposal access. Never migrate old grants into these fields automatically. AI Connections presents a separate **Blocking authoring text** scene selection, explains positions/movement/prop labels may be private, and a separate **Allow blocking proposals** switch. The existing proposal permission remains required too. Changing scope revokes pending approval using the existing epoch machinery.

Extend the existing capability handshake with supported scope/change-set versions; no new authority comes from capability advertisement. B scopes require a compatible rebuilt bridge, shared by direct stdio and desktop adapters. Missing support keeps legacy connection behavior available with B disabled and an actionable update message; do not send v2 scope fields to an old strict v1 validator. Enabling v2 permissions requires one fresh browser/native pairing, not silent in-place consent conversion. Preserve AllSigned and the independent signed helper; a rebuilt release requires its separately reviewed signing/activation workflow. No live registration/release update is part of development.

Keep the 13 named tools and current authentication/session/receipt/result limits. `krakinai_get_scene` projects complete blocking only with the exact new blocking grant; without it disclose existence/version only, not authored labels, relationships, text or a partial prompt. Authorized storyboard reads can show availability without expanding text scope. `krakinai_connection_status` advertises supported versions and the selected grants. Manual AI context export follows the same separate opt-in instead of attaching raw blocking to the old document silently.

Exact saved Full prompt reads on a blocking-bearing scene require its existing Full-prompt grant **and** blocking grant; otherwise deny the whole read rather than truncate it. Character identity, ordinary asset text, notes, filenames, media metadata and original bytes retain their existing separate meaning. Blocking text cannot be used as a path to the hidden identity/asset prompts. The UI explains combined disclosure before the user applies grants.

### Change-set v5

Propose `krakinai.change-set.v5` as a new strict schema derived from v4, preserving v1–v4 schemas, valid legacy behavior and canonical approval/replay digests unchanged. Add an optional typed `blocking` patch only to v5's existing recipe create/revise/alternate-take/guided-conversion operations. No generic JSON-pointer update, direct DB tool, approval tool or separate writer.

Patch semantics:

- omission preserves current blocking; an explicit `null` removes it from the **new** take, shown in the difference;
- a patch has version 1, expected base blocking digest, explicit participant/landmark/prop upserts/removals and optional camera/space changes;
- upserts are keyed by exact participant references or stable IDs, update only supplied fields and never replace unrelated tracks; explicit null clears an optional field;
- reference-target removals must be repaired in the same reviewed patch or remain an incomplete plan rather than a valid saved scene;
- IDs, presence, Character binding tokens and target relationships resolve against the resulting recipe after any explicitly proposed ensemble changes; no implicit new participant or identity;
- existing-target operations require exact project ID/revision, shot ID, source scene ID/revision, expected root head, source recipe digest and expected blocking digest. New recipes use the existing bounded same-batch asset resolution and normal scope checks.

The source digest covers the frozen recipe and effective saved outputs, including manual buffers, references, generation choices and existing blocking. It is an opaque concurrency token, never a read grant. Add blocking, rendered outputs, findings, resolution decisions and stable target mappings to the v5 reviewed-content projection and source/state signature. Keep v1–v4 projections unchanged for receipt replay.

V5 applies produce a **receipt version 2** with an explicit `changeSetSchema: 'krakinai.change-set.v5'` discriminator, v5 approval fields/per-mode output decisions, and the existing receipt identity/mappings. Store these in an **import ledger version 2**, which accepts unchanged legacy v1 receipts plus v2 receipts. Upgrade that preferences record only as part of the successful first v5 atomic apply; do not rewrite old receipts/digests. The validator dispatches exact receipt/approval keys by version. A v2 ledger remains new-format even when its v5 scenes have been deleted; backup v2/required-feature detection must cover it. Existing v1 ledgers and v1 receipts retain their exact shape and replay behavior.

An old v1–v4 operation targeting a new blocking-bearing parent must explicitly reject unsupported reconstruction when it cannot preserve that data. Valid old operations on legacy records remain valid. Likewise, B does not accept future C fields or fabricate a v6 contract now.

### Differences, proposals and video coordination

`krakinai_preview_change_set` and v5 proposal status return a bounded, permission-filtered B difference: exact project/shot/source scene and expected revisions; added/changed/removed stable track/prop/landmark IDs; old/new typed fields; findings; and whether all three canonical video modes change. Complete prompt differences are available to the human browser review.

Codex receives complete proposed video text only when disclosure is authorized: the exact parent Full-prompt grant, blocking text grant and any additional asset/identity text grants needed for newly introduced content. A blocking-only revision cannot refresh hidden library text. Otherwise return a clear “full output withheld; review in KRAKINAI” state, not a truncated or supposedly complete prompt. Large results reject with the existing size error and a smaller-batch/manual-review path.

Submission queues a proposal only. Browser review displays full exact blocking and video differences, source/pair IDs, identity/wardrobe/reference preservation, any manual-output decision and a new v5-only explicit **Approve blocking changes** category alongside normal scene/storyboard/preferred-take decisions. Propose v5-only `blockingOutputDecisions[operationId][mode] = 'canonical' | 'keep_manual_unverified'` for active manual modes; these are choices made in browser review, not serialized permission to apply. Existing categories/serialized approval shapes remain unchanged for v1–v4. Background arrival must not navigate, steal focus or change drafts.

At the existing Stage B atomic save boundary, revalidate the live session/scope/epoch, exact source/head/project/shot membership, current source-media validity, dependencies, approved-content digest, output/manual decisions and one-use human consent. Replan with the shared planner, compare to approved content and commit the new immutable scene/project membership/receipt together or abort all. Do not automatically select the new preferred take. A scene shared by projects changes only the explicitly targeted project's shot membership.

Confirmed receipt/status reads retain current authorization checks and response correlation. A new saved ID does not inherit blocking or Full-prompt disclosure merely because its metadata now belongs to an authorized project. Receipt replay verifies the same change-set/package identity and creates no duplicate records. Disconnect, scope revocation, Stop and loss of the last shared MCP client keep their existing revocation semantics.

## 9. Acceptance and verification plan

These are required future tests, not claimed results.

### Domain/compatibility

1. Legacy no-blocking Full/Structured/Compact/scene JSON/generation JSON exact golden bytes; old v1–v4 package schemas and receipt digests/replay.
2. Legacy single Character, ensemble with distinct Outfits, repeated Character bindings, off-camera narration, character-free/property scenes, unknown/missing components and no blocking.
3. Correct independent body/head direction, eyelines to another person/landmark/camera, entry/exit, shared/changed prop holders and camera axes. Screen coordinates do not become world coordinates.
4. Safe/duplicate IDs, stale binding tokens, dangling targets, explicit removal/repair, incomplete draft reopen, Unicode/UTF-8 and every count/byte ceiling.
5. Cross-shot matching ambiguity, changed/missing selected take, cut/reversal/time-jump interpretations and no false blocking failure for optional or unknown data.
6. Browser and MCP manual overrides require identical per-mode decisions; unresolved blocks save/apply, canonical uses newly assembled text, keep retains exact manual bytes with unverified correspondence, and cancel retains the draft/package. Old buffers/outputs remain unchanged. All resulting v5 content is bound to approval.

### Persistence and upgrade

7. Seed a synthetic **real v1 database**, including assets, drafts, receipts, variants, collections, scenes and actual decodable media. Compare serialized records/output bytes and SHA-256 before/after header-only upgrade and restart.
8. Cancelled/blocked upgrade leaves v1 writable and unchanged; an old tab write while upgrade waits is preserved. Close old connections, finish upgrade, then prove a v1 client receives `VersionError` and cannot write. New B connection responds correctly to version change.
9. Legacy v1 and B v2 backup restore/restart exact equality; old reader rejects a B archive before any writes; unknown required feature/corrupt blocking rejected. Preserve/replay v2 receipts even after deleting all B scenes/drafts; that ledger-only library still exports backup v2. Export v1/v2 contracts and 128 MiB limit stay exact. Full-backup/restore failures preserve the prior library and existing capacity gates.
10. Draft save, immutable revision, alternate take, copy/reopen, managed project target, selected/preferred take preservation, template omission acknowledgement, reference/media reachability and failed transaction rollback. No new media writes or assignment changes.

### Browser/accessibility

11. Same editor/model from Scene Builder and Continuity; exact Open saved take/return, filtered selection, stale project/source, Save/Cancel/rejected save, browser Back/Forward and A's history/Clear dirty regression.
12. All staging controls work with keyboard and touch without dragging; labelled phase/participant controls, linked tabs, status/error announcements, focus trap and exact return focus. Test long text, empty/off-camera states and complete copy/download text.
13. Synthetic before/after at 1440×900, 768×1024, 390×844 and 720×450 equivalent reflow/DPR2; decoded media and visible actual content. Inspect screenshots, not only counts. A design preview is not implementation evidence.

### Actual Codex/MCP B scenario

14. Fresh isolated Chromium at both `127.0.0.1` and actual `localhost` application origins, production stdio and desktop/shared-adapter registrations, installed Codex CLI and the existing loopback model fixture (no external credentials). Pair through the real signed native verification window for the manual acceptance path. If the helper/release is rebuilt, re-sign only the reviewed artifact and verify Valid; keep all keys/certificates/profiles ignored.
15. Authorize synthetic Shot 09's exact parent scene and B text/proposals. Ask Codex to make Aya stop at the aisle midpoint, keep her body toward the altar, turn her head/eyeline to the chapel door, keep her bouquet, Lucas/Outfits/Environment and other tracks unchanged, then coordinate the canonical video revision.
16. Actual get-scene → v5 preview → submit → review/status → real browser approval → immutable save → confirmed receipt → retry → Disconnect. Correlate every request/tool response by its actual call ID. No DB writes before Apply; exact saved IDs, changed paths, old scene integrity, preferred take and media hashes verified afterward.
17. Deny B read/proposal independently; deny Full/identity/asset/notes/filename permissions without leaks in success/errors/diffs/status. New scene and receipt grants must not widen text scope. Old bridge/v1 scope has B disabled; v1–v4 legacy calls still work.
18. Stale head/project/source/binding/media, permission revocation before Apply, changed approval content, injected abort/quota failure after queued writes, receipt replay and shared-client revocation. Assert all-or-nothing writes and preservation of foreign changes. A later successful call never substitutes for a failed earlier call.

The full “add a middle frame to Shot 09” scenario remains C's acceptance, reusing B's blocking rather than duplicating it. B must not claim to have created or preserved arbitrary keyframes that do not exist yet.

Run the complete existing app, bridge, native/helper and browser suites, typechecks, builds, production audits and QA ledger validators. Report exact exit codes, explicit native/manual skips, warnings, retained failures and successful hosted CI on the final signed B head. The existing Windows pre-boot probe timeout seen during A's CI is a known observation, not permission to raise/skip its security deadline.

## 10. Affected interfaces, builder choices and approval

Expected new pure modules: blocking types/validation, document/formatter, patch planner, spatial comparison and privacy projection. Integrate at `domain.ts`, `sceneDocument.ts`, `generationDocument.ts`, `promptAssembler.ts`, `sceneAuthoring.ts`, copy/draft paths, `phase4Validation.ts`, backup/export and capacity paths; the shared v5 schema/content/digest planner/writer; MCP scope/reads/broker/permissions; Scene Builder and A's focused Continuity components. Add versioned schema documentation and synthetic tests.

Do not edit the separate local `src/domain/validation.ts` changes merely for cleanup or to raise limits. Reuse its existing constants. No unrelated UI rewrite, paid dependency, AI backend or provider integration.

Left to the builder: component/module splits, internal function names, CSS/layout details inside the approved interaction, exact actionable error phrasing and test-fixture organization. Shared validators/formatters, strict scope/approval behavior, version boundaries, bounds, downgrade barrier and preservation requirements are not optional builder choices.

A fresh read-only builder check raised four material planning questions. They are now resolved here as agent proposals: receipt/ledger v2 and ledger-aware backup selection; one browser/MCP per-mode manual-output gate; an explicit interaction/entry-exit vocabulary; and final-simulated-storyboard comparisons with separate unselected-candidate findings. These are documented design calls for the owner's review, not previously granted implementation permission. No application code, database upgrade, implementation scaffolding, global Codex change, certificate use, remote branch update or merge occurs during design work. The design document and synthetic preview may remain uncommitted until reviewed; owner signing is required for later Git delivery.

### Design-stage verification

The two synthetic preview layouts, Board first (recommended) and Fields first, passed fresh automated checks at 1440, 1024, 768, 390 and 320 px widths (exit 0, zero page errors). Checks covered reflow, phase selection, independent screen/scene placement, participant bindings, off-camera hiding, adjacent-shot comparison, actual layout-carousel controls, modal keyboard containment, Escape and return focus. Ten screenshots were captured; desktop, tablet and narrow-mobile views were visually inspected. These are preview checks only, not product, persistence or MCP acceptance results. The application suites have not been rerun for this documentation-only design stage.

The preview renderer emitted its standard host-API warning; the fragment uses only optional local widget-state reads/writes, with no library connection, external AI call or database access. Early preview-check failures (a stale served rendering, a test selector mismatch and native modal focus escaping the sandbox) were diagnosed; final checks use a freshly rendered local wrapper and explicit modal keyboard containment. Review artifacts and screenshots remain in the ignored task workspace, outside the pending source diff.

The owner approved this B design, including the new optional authoring data, protected storage/backup compatibility and v5/scope-v2 contract rulings. The next artifact is the [implementation plan](../plans/2026-11-03-shot-blocking-spatial-continuity-b.md), for review before execution. This approval does not authorize C or live bridge activation.
