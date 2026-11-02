# Continuity production workspace — Workstream A design

Date: 2026-11-03. Status: approved by owner for inline A implementation and a separately tested unmerged PR; no second planning approval required. B/C retain their separate review gates.

This document covers the first scoped workstream of the Continuity, Blocking & Multi-Frame Prompt Production brief, including the subsequent Full Codex Support requirement and the owner's recipe-first instruction. It does not approve a new external change-set contract or authorize changes to the production library.

## Intent and sequence

Creators need to inspect continuity without expanding every shot's wardrobe descriptions, frame images and transitions into one long page. A supplies the shared Continuity workspace. B will add structured blocking and its permissioned Codex workflow. C will add multi-frame image prompts, take-specific image associations, and manual Google Flow preparation, with its Codex workflow included in delivery.

Use separate sequential branches/PRs, as requested. A starts from integrated master `8d2907fc3af51b51682bcb42b47d796b05dc24ed` (PR #36 merged). Before B or C, recheck the actual integrated base and obtain the relevant data/contract design ruling. Do not merge, deploy, rebuild over a live bridge, edit global Codex settings or operate on the real Wedding library.

### Approaches

| Approach | Tradeoff | Decision |
| --- | --- | --- |
| One combined UI, storage, assembler and MCP PR | Reduces interim feature boundaries, but combines several compatibility and approval surfaces in one review | Not selected |
| Sequential A → B → C on the existing scene/approval architecture | Keeps each review scoped and lets later authoring capabilities reuse the shared workspace; interim capability labels must be honest | Selected by the owner's brief |
| Separate frame database and independent AI writer | Separates development, but creates competing authorship, approval and media ownership paths | Ruled out by the single-recipe and existing-approval requirements |

The implementation choices below are proposals by the agent, except where identified as owner decisions.

## Verified current architecture

- `src/screens/CollectionWorkspace.tsx` owns the production Collection UI and its Storyboard, Characters, Assets, Results and Project Details tabs. Continuity currently appears in a `details` section inside Storyboard.
- `src/components/ProjectContinuityPanel.tsx` renders every wardrobe row, shot's First/Last pair and adjacent transition sequentially. It already has dialogs for metadata edits and original-image inspection.
- `src/domain/projectContinuity.ts` derives wardrobe rows from selected saved-take snapshots. Ensemble rows retain their participant IDs and include on-camera participants.
- `src/storage/projectContinuity.ts` owns the existing wardrobe-intent, legacy frame and transition write functions. Transition editing already passes the project revision and preserves exact transition IDs/pairs.
- `src/types/domain.ts` stores `firstFrameMediaId` and `lastFrameMediaId` on `ProjectShot`. These are legacy shot-level associations, not take-specific keyframes. No arbitrary keyframe-plan or structured-blocking model exists yet.
- Saved scene recipes contain frozen component/ensemble snapshots and stored output strings. Scene revision and take workflows already preserve the old saved scene. A must not call a reassembler merely to display a scene.
- `src/domain/collectionNavigation.ts` parses allowed Collection tabs and carries shot/view/sort/filter context into and back from Prompt Output. It currently has no Continuity subview field.
- `src/components/StudioDialog.tsx` supplies background inertness, focus trapping, Escape handling and return focus. Reuse it for mobile editing/preview rather than introducing another modal system.
- MCP has 13 tools; both launch paths use `bridge/src/registerTools.ts`. Reads are projected through `src/domain/mcpReads.ts` and explicit scope checks. Preview and submission use the existing versioned change-set planner, browser review, signed approved content, atomic writer and receipt ledger.
- `src/domain/mcpProtocol.ts` bounds a package at 1 MiB and a result at 512 KiB. Project Export remains 128 MiB of selected media and 2,000 entries. These are constraints for the later frame-count/contract ruling, not allowances to raise in A.

## Owner decisions already received

1. Direct Prompt shots may have incomplete planning. Complete canonical image-prompt assembly should use the existing guided conversion to a Recipe. Keep the original Direct Prompt intact.
2. Agents should prefer Recipe creation and Build from Assets wherever practical, so components remain reusable and editable.
3. Include desktop/mobile design mockups. They use synthetic examples and are design previews, not implementation screenshots or evidence of generated media.

## Scope of A

Deliver a dedicated Continuity Collection tab, compact sequence navigation, contextual inspection and the current wardrobe/frame/transition operations in focused subviews. Include recipe-first agent guidance through documentation and MCP tool descriptions.

A does not add structured blocking, arbitrary planned keyframes, canonical still-image assembly, new image associations, Flow handoff export or new change-set operations. Those remain required B/C deliverables. A must label future capabilities rather than displaying fabricated completeness counts or working authoring controls for them.

### Entry and shared context

Add `continuity` to the existing Collection tab allowlist, preserving current routes and default-tab behavior. Move the existing full Continuity accordion out of Storyboard; provide an Open Continuity action there so the workflow remains discoverable.

When Continuity is active, use a compact project heading with the Collection title and return navigation. Avoid the large project-cover hero consuming the working area. Other Collection tabs retain their current layout.

Keep a compact ordered shot navigator, search, attention/status filter, selected shot/take labels, and Previous/Next controls. Preserve real storyboard order: this navigator does not reorder stored shots. Previous/Next follows the visible filtered sequence. If a filter hides the current selection, retain its exact ID and show an explicit outside-filter state rather than silently selecting another shot. Empty and missing-shot states are explicit.

Extend URL/UI navigation state with an allowlisted Continuity subview. Preserve shot and subview through browser Back/Forward, reload and an Open Saved Take → Return to Collection round trip. Unknown subviews fall back to Overview. These are navigation fields, not persisted domain records.

The displayed take is the project's selected saved take. Display its exact title/ID or an unavailable/no-take state. Viewing it does not select a different preferred take. Existing take management remains an explicit action through the current workflow; A adds no implicit take-selection save.

### Five subviews

**Overview.** Show real derived counts and a compact shot summary: available/missing selected takes, known/unknown wardrobe, advisory wardrobe changes, available/missing legacy images, defined adjacent transitions and detached transitions. Distinguish a stored media ID whose record is missing from an optional unassigned image. Missing optional frames/transitions are not blockers. Summary counts identify whether they cover the whole project or filtered shots. Do not manufacture image-prompt/keyframe/blocking completeness metrics before B/C exists.

**Wardrobe.** Use Character-based matrix rows and ordered shot columns, with compact per-participant cells where a Character binding occurs more than once. Group adjacent unchanged appearances using actual frozen source IDs and effective snapshot text, not title similarity. Preserve participant identity/presence and unknown or unbound states; never infer identity or copy a primary participant's Outfit into another participant's cell. Full snapshot text and the existing intentional-change reason/continuity notes live in the inspector. Reuse `getWardrobeContinuity` and existing saved snapshots as the authority.

**Blocking.** Include the navigation destination with a clear Workstream B availability message. A has no staging inputs, fake stage data or readiness claims. B replaces this state with the reviewed structured editor.

**Frames & Prompts.** For A, provide focused First/Last comparison, current image availability, original preview, existing-media choice, upload, replace and clear operations. Label these as legacy shot-level images, with no claim of take binding or prompt/image approval. The selected take is context, not ownership inferred from those legacy fields. Preserve both legacy IDs exactly on reads; do not create a frame plan or copy an assignment into a future take-specific association. Canonical image prompts and arbitrary keyframes become available in C.

**Transitions.** Render a compact adjacent-shot rail and pair inspector. Keep real `fromShotId`, `toShotId`, transition ID, type, duration, description and notes. Reordering never retargets an old pair. A separate detached group exposes historical pairs for review/removal. Existing transition edit/remove confirmations remain available. No transition is required simply because two shots are adjacent.

### Inspector, editing and media

At desktop width, show the focused detail/edit panel beside the active content and constrain the main content scroll when needed. Keep the selected context and Save/Cancel actions visible without creating a page-length list of all descriptions. At tablet widths, move the inspector below content or open the same accessible dialog; at mobile, use one full-width content flow and the existing dialog pattern for editing.

Default to a compact read-only selection summary, with explicit Review wardrobe or Edit transition actions entering their forms. Do not expand every metadata input simply because a shot is selected.

View selection, search, matrix expansion and media preview are read-only. Save only on the existing explicit actions, passing the existing storage APIs the exact selected shot/side/pair. Keep edited values until success or explicit discard. A navigation/selection change that would discard dirty metadata asks for confirmation; failed saves keep the draft and actionable error. Preserve transition expected-revision handling. Do not change persistence semantics or advertise stronger existing save guards than those APIs actually supply.

Maintain a single active dialog and restore the exact originating control after media preview. Opening an original image from a dirty transition editor must retain its text and selected pair when the preview closes. Avoid embedding Blob/object URLs in persisted state.

### Accessibility and responsive behavior

- Collection and Continuity tabs have names, selected state, linked panels, Arrow keys and Home/End behavior, with scoped focus selectors so nested tablists cannot steal each other's focus.
- Shot navigation and matrix cells use real buttons with full accessible names. Selection, advisory and missing states are not color-only. No essential control requires hover or drag.
- Inspector dialogs retain focus trapping, Escape and return focus. Failed save messages are announced; routine state changes use a concise status message.
- Test 1440×900, 768×1024, 390×844, equivalent-width 200% reflow and DPR2 where media is inspected. Long frozen prompts remain accessible and wrap within their inspector.

## Recipe-first agent guidance in A

Add a concise repository agent instruction and a linked authoring guide, and surface the same preference in the shared MCP authoring tool descriptions. It must reach both the direct stdio and desktop adapter registrations, rather than relying on the agent having this chat open.

Guidance:

1. Prefer structured Recipe creation / Build from Assets. Search only the user's authorized reusable records before proposing new ones.
2. Use the existing recipe operations (`scene.create_recipe`, `scene.revise_recipe`, `scene.create_recipe_take`) in their supported v2–v4 contracts. Use explicit participant/Outfit bindings when relevant.
3. Propose missing reusable assets/variants through the existing candidate review; do not fabricate an approved Character identity, silently expand scope or create dummy dependencies to satisfy assembly.
4. Use Direct Prompt when the user explicitly asks for it or when structured authoring cannot faithfully represent the request. Explain that limitation and preserve the incomplete recipe/planning package where appropriate. Do not silently convert existing scenes or reject historically valid Direct Prompt payloads.
5. For an existing Direct Prompt, keep incomplete planning possible and use the existing guided conversion before complete canonical frame assembly. The original and preferred take remain preserved unless the user separately approves a change.
6. Preview complete actual changes and submit proposals for browser approval. Pairing and permissions never authorize automatic writes or approval.

This is authoring guidance, not a new write tool or an enforcement rule that breaks v1–v4 schemas. Keep all tool names, input schemas, scope semantics and result bounds unchanged in A. Runtime guidance is available only after a separately reviewed bridge build is deployed; committing source does not update the owner's live portable release. No live rebuild/activation is included in A development.

## B/C requirements carried forward

The following are required future design and delivery gates, not optional follow-ups to omit after the UI work:

| Capability | Required workstream and guard |
| --- | --- |
| Read authorized shot recipes, blocking, plans and frame-prompt metadata | B/C scoped projections; classify authored text separately from structural metadata; retain independent Character/asset/media/notes/full-output controls |
| Propose positioning, motion, orientation, gaze, interactions and props | B structured participant-bound blocking, common UI/MCP validators and video assembler, new immutable revision |
| Add/revise/remove/reorder keyframes | C stable IDs and exact scene/shot targets, explicit expected source/head/plan revisions, no effect on unrelated frames |
| Assemble a standalone still-image prompt per frame | C one canonical domain assembler used by UI and read-only MCP computation; frozen shared visual foundation, static composition distinct from motion/dialogue |
| Coordinate video revisions and identify contradictions | B/C advisory continuity findings and explicit separately reviewable video changes; retain old output bytes and flag stale correspondence |
| Complete deterministic differences and human approval | Existing preview/submission/browser review, approved-content binding and Stage B atomic save; never another writer or approval tool |
| Confirm results and replay | Recheck live scope, source state, approved content and IDs at commit; receipt recovery stays scoped; replay produces no duplicate records |
| Store images and preserve legacy frames | C exact `(shotId, savedSceneId, keyframeId, mediaId)` ownership, separate from immutable prompt authorship; legacy projection is read-only and never silently reassigned |
| Externally generated images/video and Flow | C manual-only handoff, actual files/hashes, explicit user image review, verified or clearly unverified provider guidance; no provider automation or generation claim |

B/C must obtain an explicit ruling on optional versioned authoring data, storage/export compatibility and any new proposal contract beyond v4. Do not silently add new operations/fields to a historical schema. Design new disclosure opt-ins if new authored text is not covered by the meaning of an existing grant; do not turn an existing video-full-prompt grant into blanket frame-output access or transfer grants to a new take.

Choose and test the frame bound against existing 1 MiB MCP packages, 512 KiB responses, 20 MiB backup manifests, 2,000 entries, per-file/media limits and 128 MiB Project Export. Read/assemble individual frames and page metadata as necessary; do not truncate complete copied outputs or raise limits to make examples fit. No frame count or provider input ceiling is assumed by A.

The final synthetic acceptance must use the exact Shot 09/Aya/chapel-door scenario through actual MCP calls and actual browser review, including denied permissions, stale state, atomic failure/rollback and receipt replay. Preserve the old scene, other frames, wardrobe/identity/environment, preferred take, media bytes and references. Correlate each real tool response to its own call ID; do not substitute fabricated success or a later successful call.

## A implementation boundaries and affected interfaces

Expected areas: `CollectionWorkspace.tsx`, `collectionNavigation.ts`, the Continuity component/styles or focused child components, pure continuity presentation helpers, shared MCP tool-description guidance, repository/authoring docs and focused tests. File splitting and internal names are left to the builder.

No IndexedDB version/store change, domain-record migration, new storage write API, backup/restore format change, Project Export contract change, scene assembler change, frame-plan/blocking type or external change-set version is part of A. Preserve source/store behavior, identity anchors, snapshots, preferred takes, result/reference media and all v1–v4 payload semantics. Do not edit separate local validation work or PR #12.

## Verification and evidence for A

1. Pure presentation tests for derived counts, matrix grouping, duplicate participant bindings, missing/optional data, filtered selection, detached pairs and legacy images.
2. Component/browser tests for navigation, search/filter, inspector selection, dirty discard, save failure retention, original-image preview, keyboard/focus and nested-tab isolation. Retain the existing wardrobe/frame/transition assertions while changing their entry/navigation selectors deliberately.
3. Fresh synthetic browser libraries with known immutable scene/output/media hashes. Read-only navigation/inspection must leave all records byte-equivalent. Explicit metadata saves change only their intended existing fields; First/Last edits retain the correct shot/side and atomic upload behavior. Take selection changes only via the existing explicitly invoked workflow.
4. Recipe-first guidance appears in both actual MCP registrations; all 13 tool schemas/annotations and legacy contracts remain unchanged. Test both guided recipe preference and the explicit Direct Prompt exception without changing permissions.
5. Run root unit/component tests, bridge tests, typechecks, production builds/audits, browser suite, backup/export regression, v1–v4 parity checks and QA evidence validators. Report actual counts, explicit skips, warnings and retained failed attempts, rather than carrying over old test totals.
6. Capture synthetic before/after Overview, Wardrobe, legacy Frames and Transitions at the specified desktop/tablet/mobile sizes and reflow. Mockups are not substituted for these screenshots. Include visible future-capability labels in A's screenshots.
7. Obtain an independent read-only whole-diff review, resolve confirmed issues and rerun affected checks. Prepare signed commits, push A's branch and open its own unmerged PR. Verify hosted CI on the exact signed head.

## Risks and approval boundary

The main A risks are losing exact selection/return context, accidental preferred-take changes, matrix grouping that hides a participant, stale editor context, lost text when opening media, and giving legacy shot-level images a false take-specific meaning. The tests above target these risks.

Later B/C risks include identity leakage through assembled image prompts, multiplied output/package sizes, wrong-take media association, silent output replacement, scope changes between review and commit, and destructive backup/export incompatibility. These require their own concrete design and tests before implementation.

Approval of this document authorizes A and its recipe-first guidance only. It does not approve new authoring data/contracts, B/C implementation, real-library operations, live launcher activation or merging. After approval, write A's implementation plan, then implement and verify within this boundary.
