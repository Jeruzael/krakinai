# Workstream C — Multi-Frame Image Prompt Studio

Status: **design approved by the owner on 2026-11-03**; prepare the implementation plan for separate review. No product implementation or live library upgrade is authorized yet. Base verified on 2026-11-03: integrated master `e3012123647d9989a923936090102fadd58378a5` (merged B, PR #38). Branch: `codex/multi-frame-prompt-studio-c`. The original Continuity/Blocking/Multi-Frame brief and its Full Codex Support addendum govern scope.

## 1. Intent and decisions

One authoritative Recipe supplies two deliberately different outputs: a complete standalone still-image prompt for each deliberately planned keyframe, and a separate video prompt for motion, performance and audio. A plan can contain one frame, Start/End, several intermediate moments, or custom labels. Video-only scenes get no automatic frame plan.

The owner selected:

- **Unified shot workspace**, sharing shot/take context between Image Frames, Video Prompt and manual Flow preparation. Continuity opens the same frame editor.
- On a new take, **explicitly approved carry-over of unchanged frame images, with image review reset**. No old approval transfers. Changed/missing/stale frames do not silently inherit an image.
- The earlier recipe-first rule: incomplete Direct Prompt planning may be retained, but complete canonical image assembly uses guided Recipe conversion; preserve the original Direct Prompt and preferred take.
- Desktop/mobile mockups accompany the design. These use synthetic content and do not demonstrate product, persistence or provider integration.

### Approaches considered

1. **Unified shot workspace — selected.** Add clear Image Frames and Video Prompt modes to the existing output route and reuse the frame editor from Continuity. It keeps context/copy controls together, at the cost of a larger focused change to the output UI.
2. **Dedicated Frame Studio — not selected.** A separate frame-authoring route would touch less of the existing output layout, but adds navigation between image prompts, video prompts and take inspection.

The existing React/TypeScript, local IndexedDB, shared assembly/validation and browser-owned Stage B transaction architecture remain. No paid dependency, AI backend, remote storage or external provider automation is introduced.

## 2. Goals, exclusions and invariants

Deliver flexible ordered keyframes, complete independent image prompts, optional image manual buffers, actual image upload/selection and review, exact per-take image history, separate video review, manual Flow preparation/export, and an explicitly permissioned Codex workflow for all these authoring capabilities.

Preserve all old scene/output bytes, v1–v5 contracts, frozen identities/approved anchors, wardrobe ownership, source graphics, preferred takes, reference packs, legacy First/Last fields and backup/export limits. Never infer identity from an image, fabricate an approved asset/media record, automatically approve an image, or equate existing text with production readiness.

Excluded: image/video generation, Google Flow UI/Agent automation, credential handling, paid APIs, automatic temporal interpolation, physical-motion simulation, global Reference Pack Manager redesign, ZIP64 certification/PR #12, unrelated `src/domain/validation.ts` edits, real Wedding-library changes, global Codex registration and live bridge activation. No automatic merge/deployment.

## 3. Current architecture and affected interfaces

- `SceneDraft` and immutable `SavedScene` in `src/types/domain.ts` capture component/ensemble snapshots, B Blocking, reference provenance and video outputs. `sceneDocument.ts`, `generationDocument.ts` and `promptAssembler.ts` are the existing document/formatting boundaries.
- `src/storage/sceneAuthoring.ts` owns managed draft/revision/take saves. `src/storage/changeSets.ts` owns the shared reviewed atomic import. Hash preparation stays outside a write transaction; exact signatures are checked again inside it.
- `ProjectShot.firstFrameMediaId/lastFrameMediaId` are shot-level legacy associations. `src/storage/projectContinuity.ts` edits those separately from saved scenes. They must not become take-specific approved keyframes by implication.
- `ContinuityViews.tsx`, `ProjectContinuityPanel.tsx` and `PromptOutputScreen.tsx` provide the existing navigation/viewer. Preserve existing routes, query/history behavior, complete copy/download and reference controls.
- Camera snapshots may have typed `CameraComposition`, but legacy Camera/Action/Instructions fields contain arbitrary video prose. `composeCameraDirections()` deliberately emits movement, timing and capture directions; it is not a still-image formatter.
- Current library header is 2, with eight stores. Backup manifest 2 uses strict required-feature detection. Project Export has 128 MiB media, 16 MiB generated text and 2,000-entry limits. MCP packages/results remain 1 MiB/512 KiB; import ledger remains 4 MiB.

New pure-module families are proposed: `keyframeValidation`, `keyframePatch`, `imagePromptDocument`, `keyframeDependencies`, `frameImageAssociations`, `frameVideoReview`, `flowHandoff`, and `keyframeMcp`. Names/splits may be refined by the builder; the shared semantics below are mandatory.

## 4. Unified workspace and editing flow

Keep the exact shot/take header and Versions & Takes context. Add primary **Image Frames** and **Video Prompt** navigation; retain References and Review and expose **Prepare for Flow** as a clearly labelled action/view. Existing Prompt links/query values resolve to Video Prompt. No route silently opens a different take.

**Image Frames** shows an ordered frame strip and one selected inspector, not expanded prompts for every tile. Tiles show label, intended position, prompt state, actual-image thumbnail and review/attention state. Provide Add, Remove, explicit move earlier/later, optional pointer drag, Next incomplete, and adjacent comparison. Stable IDs own prompts/images; ordinal position never acts as identity. Show an empty Create frame plan action for video-only scenes; viewing does not create anything.

The selected inspector has compact Visual Setup, Image Prompt and Image controls. The complete image prompt is scrollable with persistent Copy/Download; long identity text stays collapsed in source details. A saved take is readonly, with an explicit Edit a Recipe copy action. The same editor opens from Continuity → Frames & Prompts, retaining exact project/shot/take/frame and return context.

**Video Prompt** retains Full/Narrative, Structured and Compact, existing JSON modes, exact copied bytes and manual buffers. A concise frame-plan rail shows relevant intended moments and review state. Whole image prompts are never appended to video text. Prepare for Flow is a manual handoff; it does not submit to a provider.

Desktop uses contained content panels and a focused inspector. Tablet/mobile stack the selected frame and its controls, with accessible full-width detail/dialog navigation. No essential control requires dragging or hovering. Test 1440×900, 768×1024, 390×844 and 720×450/DPR2 reflow, keyboard phase/frame navigation, dialog containment/return focus, status announcements and complete copy/download.

## 5. Proposed frame-plan model and bounds

Add optional `keyframePlan: KeyframePlanV1` to Recipe drafts/snapshots. The plan has a stable plan ID, version 1 and ordered frames. Every frame has a stable safe ID, label, role (`start | intermediate | end | custom`), optional relative position or intended time, selected on-camera participant refs, visual instructions, expression/pose, static composition, relevant reference-association IDs and a typed instantaneous Blocking choice.

Agent-proposed bounds for approval:

| Item | Proposed bound / rule |
| --- | --- |
| Frames per plan | 16; no frames manufactured for video-only scenes |
| Local IDs / labels | Existing safe B ID vocabulary, 64 characters / 120 characters |
| Frame instructions / per-person expression | 2,000 / 500 characters |
| Authored plan | 128 KiB UTF-8, including all frame instructions, excluding assembled strings |
| Individual complete/concise image mode | 256 KiB UTF-8; never truncate |
| All saved image output/manual strings in one take | 1 MiB UTF-8 combined; existing whole-library/export/ledger budgets also apply |
| Frame image history | At most 2,000 events and 4 MiB serialized metadata per project; reject additions before writes when exhausted |

These are new-feature ceilings, not changes to existing storage/backup/package/export constants. Large inherited identities may exceed an image-output budget: retain the recoverable plan, show the exact size/dependency finding, and do not call a truncated prompt complete. A small frame limit does not exempt a package, preview, manifest or receipt from its existing limits.

Order is explicit and contiguous after validation; IDs are independent of order. At most one Start and End role. Intermediate/custom frames are permitted without either endpoint. A one-frame plan may designate that frame as the start for handoff; no End is fabricated. Use either normalized relative position or intended seconds per frame, not both. Authored times must be finite, within known duration and strictly increasing in frame order. Unknown duration makes absolute timing unresolved, not a guessed duration. Reordering preserves IDs/images and flags conflicting authored times until explicitly repaired; it never retimes frames automatically.

Allow incomplete draft planning. A saved take may retain structurally valid planned frames without assembled image outputs, clearly marked incomplete. A missing/invalid target, identity binding or impossible authored time is not a valid assembled image prompt. Missing Recipe inputs still prevent the ordinary complete Recipe scene save; guided conversion retains its package without dummy assets.

### Instantaneous Blocking

Reuse B's `ParticipantRef`, binding tokens, `BlockingPhase`, directions, eyeline/landmark targets and prop-holder types. A frame either explicitly links to authored B Start/End or has an authored instant state using the same vocabulary. A middle frame is never calculated by interpolating B Action. Provide a labelled Copy Start/End state action for an editable custom moment; copied values retain their provenance.

Only selected on-camera Recipe participants may be shown. Off-camera people can remain eyeline/interaction targets but gain neither visible staging nor an image identity block automatically. Making one visible requires an explicit ensemble-presence revision. Repeated Character appearances require exact participant IDs; names are not bindings. Character/Outfit/Environment changes invalidate captured dependent frame bindings until explicit repair.

## 6. Canonical image assembly and source fidelity

Create one shared deterministic still-image document/formatter used by UI, v6 previews, saved output reads and exports. Reuse frozen snapshots and existing identity/anchor resolution; never refresh from current library records while inspecting a saved take.

The visual foundation contains the selected participants' exact captured appearance and wardrobe, Environment, Lighting/Style, source-fidelity requirements, aspect ratio, relevant explicitly selected references and the frame's instantaneous state/composition. Do not introduce an off-camera speaker as a visible subject. Required original source images/graphics use the existing `validateShotSourceMedia()` rules against current stored media before assembly/save/export; no duplicated permissive path.

### Separating existing video prose

Do **not** pass the Full video prompt, arbitrary Action text, dialogue/performance cues, B movement text or `composeCameraDirections()` into a still-image prompt. Typed static Camera dimensions (shot size, height, angle, orientation, framing, lens, focus, composition) may use a reviewed still-text projection. Movement/rig/capture/specialized techniques are not accepted wholesale by dimension; whitelist individual static contributions and omit temporal parameters. A motion trajectory is never converted into an invented camera position.

Legacy mixed Camera/Action/Scene Instructions cannot be reliably rewritten by a deterministic assembler. Show their original text as source context and offer an explicit still-composition/instant-action adaptation, reusable across that take's frames. Suggest values only from known typed static data or authored B instants. If none exists, request the missing visual detail or an explicit user decision that it is not required. Codex can propose that adaptation under the normal text permissions/review. Never infer it from an image, silently edit the source asset, or claim a word-filter proves all temporal prose absent.

Preserve full identity/wardrobe/foundation text; no summarizing identity to fit. Source descriptions may contain appearance traits expressed in ordinary language; completeness checks are structural and typed, with advisory checks for ambiguous free text. No semantic guarantee is claimed for arbitrary authored prose. No spoken line, multi-second motion command or audio instruction is emitted by the typed still formatter.

Persist each assembled image prompt as a versioned snapshot: exact Full and optional semantically complete Compact strings, assembler version, source/frame/visual digest, relevant reference provenance and hashes. Canonical strings are derived by KRAKINAI, never accepted as purported canonical model-supplied strings.

Users may edit an image prompt's raw draft buffer. Label that mode Manual / correspondence unverified. If its visual inputs change, require a per-frame/per-mode canonical-versus-keep-exact-manual choice, sharing the B output-review mechanism's rules. Saving creates a new take; old image/video prompt bytes remain exact. A manual image buffer cannot approve identity anchors or grant permissions. Codex revises structured visual instructions; it cannot submit a saved canonical output, approval flag or arbitrary replacement of unrelated outputs.

## 7. Dependency digests and video coordination

Separate whole-plan, per-frame visual and video-review digests. The per-frame visual digest includes resolved visual foundation, exact bindings, instant state, effective static instructions, references and assembler version. Display label, order and intended time are metadata, not silently injected into the image prompt body; reordering alone does not swap images or reassemble unrelated frame text. A source edit invalidates exactly its dependencies; global identity/wardrobe/environment edits can invalidate several frames and the preview must enumerate all of them.

Video review has an explicit basis: source take, whole plan/order/timing, Blocking and video-input digests. Changes that may alter motion/dialogue consistency show **Video review required**. Never claim that matching strings prove semantic agreement. Reordering/custom frames may change the intended progression even when individual still prompts are unchanged.

Offer two explicit reviewed new-take choices:

1. **Reassemble coordinated video:** existing video assembler plus a concise authored visual-moment section; retain all original dialogue/audio bytes and B motion. No whole image-prompt concatenation. Active manual video modes retain the existing per-mode decisions.
2. **Keep exact current video:** preserve all three effective video strings and manual buffers; mark correspondence to the new plan unverified / review required. A human can separately record that review against the exact plan/video digests, without changing prompt text. Do not mark it synchronized by saving or uploading an image.

A v6 change may explicitly request video review without proposing text changes. Consistency findings compare typed participants, staging, timings and cue progression; ambiguous natural language remains advisory. The browser shows exact old/new strings and reasons. Unchanged frame snapshots/reference sets remain byte-identical. Frame edits cannot silently select the new preferred take.

## 8. Image assignments, review and history

Keep actual image assignment outside immutable prompt authorship, in an optional versioned project extension keyed by **project + shot + saved scene/take + keyframe ID**. Each event captures its own ID/revision, media ID/SHA-256, exact effective prompt digest, provenance, timestamp and optional bounded review note. Replace/clear/review create history events or update a versioned active pointer; do not erase previous media IDs/history. Scene prompts are never rewritten by these operations.

Use the existing raster media pipeline and limits: PNG/JPEG/WebP, actual MIME/signature/decode/dimension checks, 10 MiB per image, 5,000 MiB stored-media ceiling. SVG demo/reference files remain available in their existing roles; they are not silently treated as externally generated raster frame images. No automatic crop, re-encode, fake thumbnail-as-original or approval on upload. Preserve original bytes/hash. Missing/corrupt files produce an actionable state and prevent handoff of a nonexistent file.

Saved-take image upload and its exact association commit in one transaction with expected project/association revision; a failure leaves no orphan media write. Draft-frame attachments persist with that draft's references/working ownership, not an unrelated saved take. Extend `collectReferencedMediaIds()` and every existing reachability/deletion/backup path to include draft assignments, active assignments and retained history. Protect active unsaved uploads in other tabs using the existing ownership/lease pattern or an equivalent explicit pending reference; no new orphan sweep.

### Approved carry-over rule

At new-take review, offer explicit carry-over only for the same stable frame ID whose complete effective prompt digest, frozen visual bindings and referenced media provenance are unchanged, and whose file still validates. Show the exact old/new take IDs and image IDs. User-approved carry-over creates a new association pointing to the same original bytes, records the source association and resets review to **Needs review**. No upload duplication and no inherited approval.

Changed prompts/bindings/removed frames do not carry automatically. Earlier images remain inspectable as historical references. A user may explicitly reuse an earlier image for a changed prompt, but it is labelled reused from a different prompt basis and requires fresh human review. Reordering unchanged frames preserves their identity; association roles follow the frame ID, never array index.

Legacy First/Last images stay in a separate labelled readonly compatibility section. Explicit **Use this legacy image for this keyframe** creates a new take/frame-bound association after validation and review; it does not clear/reassign the old shot fields. Legacy setters keep their current behavior.

## 9. Versioning, storage and recovery

Propose another explicit **header-only 2 → 3 protection upgrade**, same eight stores and no record backfill, so older B builds cannot open and drop C fields. Extend inspection/pre-upgrade backup/Enable/Cancel/blocked-tab/versionchange behavior for v1 and v2 sources. Consent explains the downgrade barrier; a pre-upgrade backup download is not proof of a saved file. No development test upgrades the real library.

Backup manifest 2 can keep its versioned required-feature mechanism: add `keyframes.v1`, `frame-image-history.v1`, and `change-set.v6-ledger` only when corresponding records/history exist. Preserve all v1 and B-v2 archives and exact feature selection. An older reader rejects unknown features before replacement. A ledger/history-only library still requires its appropriate features after C scenes are deleted.

Add Scene/Generation document version 4 only for C-bearing Recipe records; introduce a dedicated provider-independent `krakinai.image-prompt.v1` document. Existing v1–v3 documents and legacy video strings remain exact. C Project Export uses version 3 only when selected C records/associations require it; existing v1/v2 exports remain unchanged. Include exact image prompt snapshots/history and file hashes; do not silently filter saved reference files.

Templates omit scene-specific frame plans/images only after an explicit omission acknowledgement, alongside B's rule; never make a reusable template retain stale scene/frame IDs. Revision/copy/draft/duplicate-detection paths must include C data rather than silently stripping it.

Ordinary draft saves persist incomplete planning. Current-tab dirty navigation recovery remains distinct from durable saved drafts/downloaded guided-conversion packages. No browser-crash durability is claimed for an unsaved in-memory edit. Guided conversion accepts/resumes a strict v6 working package without changing the original Direct Prompt or creating an incomplete immutable conversion.

## 10. Codex contract proposal — v6 and scope3

These are **owner-approved design choices, not an existing implemented contract**. Freeze v1–v5 schemas/valid behavior/projections/receipt identities unchanged. New operations cannot be used until implementation and verification establish the contract.

### Capabilities and permissions

Advertise `keyframes.v1`, `image-prompts.v1`, `change-set.v6`, `scope.v3` in the existing proof-bound capability negotiation, alongside B capabilities. Add explicit `McpScopeV3` with B fields plus:

- `keyframeSceneIds` (≤250 exact saved scenes): authored plan/instant/composition text; normal project/scene metadata authorization is still required.
- `imagePromptFrameGrants` (≤250 exact scene/frame pairs): complete saved image prompt modes, distinctly consented from Video Full text. Require the exact plan grant and applicable identity/asset/Notes disclosure checks; no grant by project membership alone.
- `allowKeyframeProposals`, `allowFrameImageProposals`, `allowImagePromptDerivation`, all false by default. These require existing proposal permission for writes; image derivation also needs all contributing text grants. Blocking modifications still require the independent B grants.

Keep media IDs, identity/anchor, ordinary text, Notes, filenames and receipt permissions separate. Frame image association details require exact scene/frame scope and existing media metadata grants; never transmit original bytes. Sensitive role/performance/reference notes get the same complete contributing-disclosure checks fixed in B. Review notes are not image-generation instructions.

Scope3 requires Disconnect and fresh native/browser pairing with a supporting bridge. Old scopes retain no C grants; generic presets/select-all never enable them. No automatic live release/config activation or permission promotion. An old/unsupported peer fails closed for C while legacy scope behavior remains available. Actual key/AllSigned/signing rules are unchanged.

### Existing tools and canonical assembly

Retain the thirteen tool names. Extend their strict argument/projection unions only for the negotiated new capability:

- `krakinai_get_storyboard/get_scene`: availability metadata under normal scope; complete C authoring details only under exact plan grants. Page/bound results; never return a raw record spread.
- `krakinai_get_generation_prompt`: old `{sceneId}` video call unchanged; new explicit image target `{sceneId, target:{kind:'image',keyframeId,mode:'full'|'compact'}}` reads the complete saved image mode under exact grants.
- `krakinai_preview_change_set`: v6 applies the shared planner/assembler without writes. An optional explicit single operation/frame/mode projection requests canonical assembly for a proposed or existing frame, including a new frame that has no saved grant yet. That derivation needs the explicit derivation capability plus authorized source plan and all contributing identity/asset/Notes text. Otherwise return a withheld/incomplete state, never partial purportedly complete text.
- `krakinai_get_proposal_status`: v6 returns bounded difference/readiness/digest summaries by default; an explicit single-frame projection can retrieve permitted full proposed text. This keeps complete prompts available without returning every image mode in one oversized response.
- Submit, receipt retrieval and replay remain the existing authenticated workflow. New IDs gain no plan/image/video/media grants automatically. A receipt is not a text-read grant.

Preserve the 1 MiB package, 512 KiB result and other current transport/session limits. Complete single-mode output is returned or rejected with an actionable smaller-request/manual-export error. No truncation or silent bound increases. Actual old/new SDK tool discovery also needs its existing dedicated bounded test, as adding schemas can enlarge discovery independently of tool-result limits.

### v6 changes and differences

Extend the existing four Recipe create/revise/alternate/conversion operations with an optional typed frame-plan patch: stable-ID upserts/removals, explicit full resulting order, expected plan digest, and supplied-field-only instant/composition/reference changes. Omission preserves; explicit null removes from the new take. No generic JSON pointers, whole-output replacement, inferred IDs or frame ID regeneration on reorder. Removal must repair dependent handoff selections in the same reviewed result or leave them explicitly unresolved.

Add narrowly typed v6 operations for linking an **existing authorized media** record, clearing an association and proposing a video-correspondence review. Targets include exact project/revision, shot membership, source saved take/head/revision, frame ID/digest and expected association revision; same-batch new-take targets use normal client refs. Remote proposals never upload bytes or mark images/video reviewed/approved. Human review actions remain browser controls.

Preview contains exact changed/unchanged/removed frame IDs, old/new typed values, complete old/new image/video outputs for the human, dependent invalidations, carry-over image IDs/reset reviews, source proofs and intended project membership. Reassemble only affected frame snapshots; list shared-foundation changes affecting several frames rather than pretending the change is isolated.

Normal scene/storyboard approvals remain. Add separate C categories for keyframe/image-prompt changes, image-association changes/carry-over, and coordinated video decisions. Changing any choice invalidates exact consent. Submission alone never changes IndexedDB, route or keyboard focus.

### Atomic save, receipts and history

Use the existing Stage B writer and one-use human consent. Revalidate session/scope/epoch, exact live source/head/project/shot/frame/association revisions, file validity/hash, bindings/dependencies and approved-content digest at the atomic boundary. SHA preparation is outside the transaction with a current-record signature recheck inside. Commit new immutable take, targeted membership, explicit image-association events/reset reviews and receipt together or abort all. Preserve foreign writes and old takes; preferred selection still requires its own operation/approval.

Propose receipt version 3 with `changeSetSchema:'krakinai.change-set.v6'` and exact new take/frame/association mappings, plus import ledger version 3 accepting unchanged receipt1/2 entries. The receipt's internal reviewed evidence is bounded, non-executable and includes actual image/video decisions; it does not duplicate unnecessary assembly intermediates. The unchanged 4 MiB ledger budget is checked before save. Mixed history, receipt recovery after target deletion and exact replay create no duplicate takes/associations or expanded read grants.

## 11. Coverage of the Full Codex Support addendum

| Required capability | Proposed C path |
| --- | --- |
| Read authorized shots/recipes/Blocking/plans/frame metadata | Existing reads + exact scope3 plan/image/media projections |
| Propose positioning, movement, orientation, eyelines/interactions | Existing v5 B patch semantics carried into strict v6 |
| Add/revise/remove/reorder frames | Stable-ID frame patch with exact base/order digest |
| Preserve identity, wardrobe, environment/spatial continuity | Frozen visual foundation, exact participant binding tokens, dependency review |
| Request canonical individual-frame assembly | Read-only v6 preview single-frame projection/shared assembler |
| Coordinate video revisions | Explicit concise video reassembly or keep-exact/unverified decision |
| Identify inconsistencies | Typed plan/B/cue/time advisories and explicit unresolved text interpretation |
| Return complete reviewable differences | Human complete outputs and exact field/source/association diff; scoped model projections |
| Submit through human browser approval | Existing broker and Stage B atomic writer, separate C choices |
| Read confirmed results only within grants | Scoped receipt/status, new IDs ungranted until explicitly selected |

All new persistent authoring actions need both an in-app human path and an explicit proposal path. Image/video approval itself is always a human action, not an agent tool.

## 12. Prepare for Google Flow and export

Offer provider-independent image/video outputs first, then a dated manual Flow adapter. **Frames** chooses a valid actual Start image and optional End; **Ingredients** chooses an explicit ordered set of available images with their intended roles. Middle-frame intentions are not promised provider timestamps. Suggest multiple clips/Scenebuilder where the authored choreography exceeds the selected handoff mode; do not change the saved plan or duration to fit a provider silently.

Official guidance checked 2026-11-03 distinguishes endpoint frames from visual references and makes support model-dependent. A small local, source-linked compatibility table may show Frames/Ingredients and supported duration options, with an Unknown/Unverified option and the date checked. Do not hardcode an assumed universal Ingredients count, quotas, credit prices or feature guarantee. No network feature detection, Google credentials or provider requests run in KRAKINAI.

Sources: [creating videos, frames and ingredients](https://support.google.com/flow/answer/16353334), [model support](https://support.google.com/flow/answer/16352836), [manual scene arrangement](https://support.google.com/labs/answer/16935718). Current support differentiates Veo 3.1 Lite/Fast ingredient use from Quality; Gemini Omni Flash has a different duration set. This dated documentation is guidance, not certification of every user's account/region or generation result. Refresh it during implementation and before release; if not verifiable, show Unverified.

Handoff preview captures exact project/shot/take/frame IDs, plan/prompt/review basis, selected mode/model guidance, roles/order, complete image/video strings and explicitly selected actual files. Export a bounded ZIP with stable readable filenames and a versioned manifest mapping original media IDs, bytes/SHA-256 and archive paths. A shared media file may be stored once while retaining all associations. Preserve original bytes.

Use the existing 128 MiB media, 16 MiB generated-text and 2,000-entry Project Export ceilings, plus existing full-backup constraints. Preflight/cancellation/current-media validation happen before and during export; no oversized whole-archive array, fake missing file, unsafe entry path or hidden file selection. A partial preview may list missing images, but a claimed complete package cannot silently omit them: require explicit exclusion or block that export. Show excluded/unreviewed items in the manifest/readme. This shot handoff selection never alters a saved Reference Pack or the existing full Project Export selections.

## 13. Verification and delivery acceptance

These are future implementation gates, not tests claimed by this design.

1. Frame plans: absent/one/Start-End/multiple/custom, max16, unsafe/duplicate IDs, exact add/remove/reorder, finite/ordered timing, unknown duration, malformed/unresolved dependencies; no automatic plan creation.
2. Still assembly: exact frozen identities/approved-anchor ownership, distinct Outfits, multi-person/off-camera/repeated bindings, source graphics, static camera whitelist and legacy adaptations, frame-only pose/expression, no typed dialogue/motion leakage, unknown free-text advisories and UTF-8 budget rejection without truncation.
3. Independence: adding a middle frame preserves other frame IDs/strings/references/images; reorder changes no visual association; shared foundation changes enumerate affected frames. Legacy video/scene/generation bytes and v1–v5 schema/receipt digests remain exact.
4. Saved history: draft save/reopen and dirty recovery, new immutable take, alternate/copy/guided conversion, exact manual image/video buffers, per-mode resolution, preferred selection preservation, explicit template omission and stale foreign source rejection.
5. Images: decodable PNG/JPEG/WebP, invalid/MIME/dimension/corrupt/missing files, exact bytes/hash, replace/clear/history, explicit carry-over/reset review, no automatic approval/wrong-shot/wrong-take association, two-tab pending upload reachability and no orphan after late failure.
6. Compatibility: real synthetic v1 and v2 → v3 header-only upgrade/restart; cancel/blocked/late old-tab write preservation; old-client VersionError; actual old production readers reject C archives before writes; legacy/B/C backups and history-only receipts/associations; Project Export exact old contracts and unchanged budgets.
7. UI: two distinct output modes, complete copy/download at all four viewports/DPR2, long descriptions, empty/incomplete/missing image, selected take, keyboard/touch non-drag authoring, focus/status/dirty route restoration, comparison and manual-video review. Product screenshots are separate from design mockups.
8. Provider handoff: one/Start-End/Ingredients, explicit file roles/order/exclusion, missing/unsupported files, dated compatibility/unknown mode, exact prompt bytes, independently read archive/manifest/hash verification, cancellation and boundary failures. No Google call or temporal guarantee.
9. MCP: all old negotiation/contracts/calls; scope3 default false and fresh pairing; independent plan/image/derivation/association/B/Notes/identity/media/filename denials; canaries in preview/status/errors/context/receipts; correct per-frame projection; unchanged package/result/ledger limits; strict schema/discovery parity.
10. Actual acceptance: isolated synthetic Shot09, actual installed Codex/production stdio/signed Windows helper at IPv4 and localhost, plus shared desktop transport. Ask to add a middle frame showing Aya turning toward the chapel door, keep identity/gown/chapel, update relevant Blocking/image prompt and explicitly review video. Verify zero preapproval writes, real browser choices/Apply, exact new IDs, unchanged other frames/old take/preferred/media hashes, denied/stale/late quota rollback, receipt replay, Disconnect and shared last-client revocation. Correlate every response by its original call ID; retain every failed attempt.

Run full app/bridge/native/helper suites, typechecks, builds, production audits, schema/QA validators, existing backup regressions and synthetic browser suites. Verify signatures after final candidate builds, preserve AllSigned/trust, do not overwrite a live release, request only concrete owner signing/manual native actions when needed. Keep all profiles, keys/certs, ZIPs and temporary artifacts out of Git; delete no profiles without explicit path authorization.

After design approval, prepare a separately reviewed implementation plan. Implement inline only when that plan is authorized, with one independent whole-diff review, a single substantive fix pass, retained evidence and actual final-head hosted Linux/Windows CI. Use owner-signed commits, a dedicated feature PR and no automatic merge. Live migration/bridge activation and changes to the real Wedding library remain separate.

## 14. Builder choices and review gates

The initial owner preferences are in §1. On 2026-11-03 the owner approved the complete C design, including the proposed bounds, header3, optional record fields, v6/receipt3/ledger3/scope3, argument selectors, source adaptation, manual-output semantics and export adapter. These remain design decisions rather than shipped capabilities. The builder may settle file/component splits, exact accessible wording and nonsemantic layout details; it may not alter identities, permission boundaries, immutability, limits, compatibility or atomicity silently.

One fresh independent builder check is required before handoff. Material unanswered product questions return to the owner once; questions already answered here and minor implementation choices are resolved in the document with their provenance. No product scaffolding, dependency install, database change, application build, external generation, global configuration change or real-library action occurs during this design work.

### Design-stage verification — 2026-11-03

One fresh independent read-only builder check reviewed this document, the original brief and relevant existing architecture. Its complete disposition was **“nothing important left”**: no material unanswered questions requiring another owner decision before planning. This is a design-completeness check, not an implementation/security certification. No parallel product implementation was delegated.

The desktop/mobile interactive preview uses only fictional synthetic example text and an explicitly labelled composition sketch. It does not use the real Wedding identities, library, media, approval controls or MCP session. Upload, save, export and assembly buttons explain their proposed behavior without performing those operations. Tab/frame selection, reordering, handoff-mode selection, review choices and copy/fallback are local preview interactions.

Headless Chromium preview verification exited **0**: **20 layout/theme cases, 360 assertions passed**. Cases cover Desktop/Mobile variants, light/dark, widths 1440, 768, 390, 720 and 320, all at DPR2. Assertions cover full synthetic foundation/real paragraph breaks, no initial horizontal overflow, keyboard frame selection and focus, stable-ID reorder retaining selected text, arrow-key tabs, separate video text, Flow role/timing labels, complete-text fallback when clipboard permission is denied, initially unapproved image carry-over, review closure and return focus, and no JavaScript errors. This does not certify a screen reader, system clipboard success, actual app dialogs, decoding, persistence, exports or provider behavior.

An earlier preview-only run failed keyboard-focus retention: the standalone widget-state echo rerendered the frame strip after selection. The mockup now ignores unchanged state echoes; the successful full run above includes that assertion. The failed result is retained separately. The standalone renderer emitted its generic `window.openai` review warning; the fragment uses only the allowed widget-state read/write surface. All 60 attempted remote requests in the successful matrix were the wrapper's three allowlisted icon/positioning dependencies repeated per case, explicitly blocked during the checks; no application/provider API was invoked.

Five design screenshots were captured and their files checked, with desktop 1440 and 768 and mobile 390 visually inspected:

- `c-design-desktop-1440-dpr2.png`
- `c-design-desktop-768-dpr2.png`
- `c-design-desktop-390-dpr2.png`
- `c-design-desktop-720-dpr2.png`
- `c-design-mobile-390-dpr2.png`

Task-local machine-readable evidence is `mockup-results-1793715971146.json`; the earlier failed run is `mockup-results.json`. Preview fragments, screenshots, browser runner and results remain outside tracked product changes. Only this design document is pending in the feature branch. Product tests, builds, installed-Codex/native acceptance and hosted CI have **not** run for C and are not claimed by these results.

The owner approved the C design after this check on 2026-11-03. Next gate: a separately reviewed implementation plan. No code, dependency, database, signing, trust, global configuration or live activation change is authorized by design-stage mockup verification.
