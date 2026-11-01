# B2 — Participants, wardrobe and ordered dialogue

Status: approved by the user on 2026-11-01 for inline implementation, implementation planning without another approval, and a separately tested unmerged B2 PR.
Date: 2026-11-01 (Asia/Taipei).
Base: master `7ce149200bdd09b5d7c8f2f4d74a00801b0fd9c3`, incorporating PR #30/B1.
Branch: `codex/ensemble-recipe-b2`; reuse the clean existing linked worktree.
Authority: the user's Workstream B brief, sections 12–16, and instruction to proceed with B2.

## Outcome and boundaries

Support multiple real Characters in one recipe, independent wardrobe, ordered dialogue and per-speaker performance. The same metadata must survive Builder editing, immutable versions/takes, Script, Cast, continuity, reference packs, exports, backup/restore and reviewed MCP import.

Existing records without the new field must produce byte-identical outputs and scripts. Opening a record does not migrate it. All Character identities and approved anchors retain existing validation; no inferred identity, automatic reparenting or automatic approval. New variants require explicit human create/reuse/defer decisions.

B3 Direct Prompt conversion, final installed-Codex ensemble acceptance, production Wedding changes, external generation, cloud services, paid dependencies, ZIP64 PR #12 and unrelated local changes are excluded. Use fresh synthetic profiles only; retain QA artifacts. Preserve application/storage/export limits, including Project Export 128 MiB. No new IndexedDB store/version or destructive migration is needed.

## Current source and integration constraints

- `src/types/domain.ts` has one `slots.character`, `slots.wardrobe`, `dialogue` and `generation` on drafts/saved scenes. Variants already have exact `parentCharacterId`, `type`, `targetSlot`, revision and review status.
- `sceneDocument.ts`, `generationDocument.ts` and `promptAssembler.ts` derive outputs from frozen component snapshots. Scene JSON and Generation JSON currently use v1 schemas. The normal identity resolver validates a selected anchor against both the snapshot and actual live Character.
- `storage/sceneAuthoring.ts:planAuthoredScene` is the shared synchronous factory. `buildRevisionDraft` clones the parent; `storage/changeSets.ts` replans and commits approved batches atomically in the existing eight-store transaction.
- B1 v2 imports support real recipe bindings, Camera composition, manual-output consent and deterministic reviewed-content proofs. Candidate approvals and receipt replay already exist. Variants are currently read-only participants in the import transaction; B2 adds only explicitly approved variant writes through that same transaction.
- `projectContinuity.ts:getProjectCast/getWardrobeContinuity` inspect only the primary slots. `getProjectDialogue` returns one row per selected scene, and `ProjectScriptPanel.tsx` keys rows by shot ID. These assumptions must change for new ensemble records only.
- `referencePack.ts`, `shotTypeRules.ts`, `storage/db.ts`, project export, MCP scope/read DTOs and state signatures traverse current slots. Every new nested snapshot/reference needs explicit traversal so cleanup, export and permissions remain complete.
- Property / Environment can already include optional Characters. Graphic / Motion and Existing Footage exclude visual Character/wardrobe layers and retain their actual-original checks. B2 must use these distinctions, not require fake visual Characters for off-camera speech.

## Architectural decision

Use one opt-in `ensemble` envelope on recipe drafts/saved scenes, versioned independently from the database. Preserve primary legacy slots as checked compatibility projections. Extend the existing authoritative document/assembler pipeline with an ensemble branch; do not introduce a second informal prompt composer.

The rejected alternatives are merging people into the primary identity text, which loses explicit ownership, and rewriting all legacy scenes into arrays, which risks historical bytes and unnecessary migration. Parallel scene writers are also rejected: review, assembly and commit must share the same factory and transaction.

Add `krakinai.change-set.v3` for ensemble edits and parent-bound Outfit proposals. Freeze v1/v2 exported schemas and valid historical payloads. New scene/generation documents use explicit v2 schemas only when `ensemble` is present; old documents retain their current shape and bytes. New optional fields require the updated application; forward compatibility with older binaries is not promised.

## Persisted ensemble model

Proposed shape (design notation; snapshots come from trusted records, never external JSON):

```text
ensemble: {
  version: 1,
  primaryParticipantId: string | null,
  participants: [{
    id, character: ComponentSnapshot, wardrobe?: ComponentSnapshot,
    role?: string, presence: on_camera | off_camera,
    performanceNotes?: string, generation?: SceneGenerationChoice
  }],
  dialogueCues: [{
    id, participantId?: string,
    ...existing DialogueConfig,
    timing?: { startSeconds, endSeconds }
  }]
}
```

Agent-proposed bounds: at most 8 participants and 32 cues; stable local IDs at most 64 characters; role at most 500 characters; participant performance notes at most 1,000. These are new-field bounds, not increased legacy limits. Reuse current Character, dialogue, performance, media, metadata-manifest and package bounds. Combined import candidate counts still use the current limits. IDs must be unique, bounded, safe under existing canonical JSON rules and stable across reorder/reopen/revision. Reject duplicate Character source IDs in one participant list rather than duplicating the same identity implicitly.

New Character bindings use real Character asset snapshots with source revision/identity revision, reference links and approval metadata. The participant may select master or a genuinely approved anchor through existing resolution logic. No caller approval stamp, raw identity snapshot or identity override is accepted. Keep unrelated frozen snapshots when adding/revising another participant; do not refresh them from live assets automatically.

Wardrobe may be an honestly labeled generic Wardrobe asset or an Outfit variant. A variant must target wardrobe and belong to that participant's exact Character ID. Generic assets must retain `sourceType: asset` and must not appear as parent-approved Outfit variants. Scene-only wardrobe overrides use the existing non-Character override semantics. Switching a participant's Character must explicitly resolve incompatible wardrobe; never reparent or silently reuse the old outfit.

Legacy exception: opt-in must also retain a valid existing primary Character/wardrobe snapshot with `sourceType: template`, including its exact frozen text, actual template source ID/revision, overrides and reference links. Clearly label it a frozen template snapshot; do not fabricate an asset ID or turn it into a library asset. Only trusted legacy/template application can seed these snapshots; external participant inputs cannot supply them. Such a Character has no actual parent Character asset ID, so it cannot receive a parent-bound Outfit variant or a newly approved anchor until the user explicitly selects a real stored Character. Master snapshot text remains usable. Cast continues to derive actual asset-backed Characters, while an unbound template participant is surfaced for review rather than becoming a false Character Bible entry. Unchanged template wardrobe remains valid as frozen template direction. This preserves existing template-based scenes and their ability to add cues without replacing frozen content.

When visual participants exist, primaryParticipantId must explicitly identify an on-camera participant. Its Character, wardrobe and generation are mirrored into the existing primary fields by one shared helper; mismatched stored mirrors reject instead of guessing an authority. With no visual participant, primaryParticipantId is null and visual primary slots/generation are absent. The ensemble is authoritative for new participant-aware documents; the primary mirror is never rendered a second time.

Off-camera participants remain explicit real records when chosen, but do not contribute visual identity/outfit directions or automatically selected visual reference files. Off-camera/voiceover cues may instead be unlinked and require only speaker and exact text. No fictional officiant Character is created. On-camera or unspecified spoken cues require an explicit linked on-camera participant; voiceover/off-screen cues may link a real participant without changing their visual presence. Existing speaker-name checks remain conservative advisory checks, not identity inference.

Visual participants are available wherever current Shot Type rules permit visual Character slots, including optional Characters in Property / Environment. Reject inapplicable visual selections for graphic/footage shots rather than silently filtering them. Audio-only cues remain available under existing non-character narration rules. Character Scene retains its existing Character requirement when speech is present; it can use the real on-camera participant while an officiant stays unlinked. Required Environment, Action and original image/video validation remain authoritative.

## Opt-in, legacy projection and revisions

Opening/saving a legacy scene without opting in takes the existing path and adds no ensemble field. The explicit Add participant / Use multiple dialogue cues action creates a new draft representation: seed the current Character/wardrobe/generation as participant `primary`, and copy a present legacy dialogue once into cue `legacy-dialogue`, preserving every text/mode/performance field. Its on-camera/spoken association uses the already bound primary; off-screen/voiceover remains unlinked unless explicitly selected. Delete the active draft's legacy dialogue field; reject dual active legacy/cue representations. The old immutable scene remains untouched.

Subsequent enables are idempotent. Empty/new ensemble records stay opt-in rather than silently downgrading formats when the last secondary participant or cue is removed. Reorder changes array order, not IDs. Removing a participant with linked cues requires explicit cue reassignment/removal; it does not silently delete speech. Primary replacement requires an explicit new primary or null when no visual participant remains.

If a legacy draft has wardrobe without any Character, opt-in must preserve that draft and require explicit assignment to a selected Character or explicit clearing first. It cannot silently discard a valid existing wardrobe component to satisfy the new primary projection.

`buildRevisionDraft`, edit/copy, save fingerprints, manual-output acknowledgements, restore-as-new-version, alternate takes and prepared-content projections all include the complete envelope. A Camera-only revision preserves all participant/cue/reference fields exactly. Restores clone saved snapshots and resolve the actual live anchors consulted by the current rules; the approved proof binds those live reads. Ordinary library edits never rewrite previous scenes or silently refresh inherited participant snapshots.

V1/v2 replay and legacy operations on legacy records remain unchanged. A v1/v2 operation that would reconstruct an ensemble scene must fail with an actionable use-v3 message rather than lose fields. Metadata-only attachment/selection/status operations can still reference an existing ensemble take without reconstructing it. B3 conversion remains separate; B2 must not quietly turn an ensemble recipe into Direct Prompt authoring.

## Canonical assembly and output

Extend `buildSceneDocument` and the existing formatter/assembler to create a v2 participant-aware document for ensemble records. Identity and wardrobe appear once per applicable participant; Environment/Action/Camera/Lighting/Style remain shared recipe components. Participant performance notes are scene direction, not identity edits. Preserve dialogue cue order and exact spoken strings; retain language, mode, delivery/performance and caption settings independently per cue. Compact may compact wardrobe/direction according to existing semantics, but never truncate identities or spoken text.

Generation JSON v2 carries participant IDs, source revisions, applicable identity source, wardrobe relationships and ordered cues. Do not accept one global identity override that substitutes for all participants. Reuse `resolveGenerationIdentity` separately per participant and report honest fallback reasons. Existing provider/generic exports must handle the new canonical document; no provider-native multi-speaker capability is promised.

Retain the existing distinction between canonical master identity text and the selected generation identity source: Full/Structured/Compact use the frozen master snapshots as the current assembler does; Generation JSON/related generation exports resolve approved anchors separately per participant. Selecting an anchor never rewrites the underlying identity snapshot or silently substitutes it into all legacy output modes.

Aggregate participant/global negative text exactly once. Extend captured inherited-prefix handling for ensemble records so repeated Edit a Copy/save cycles cannot duplicate negative clauses. Old prefixes and output formatting stay untouched without ensemble metadata. Manual edits still require the existing explicit reassembly acknowledgement; show complete previous/proposed outputs.

Cue timing is optional intended planning metadata: finite nonnegative start, end greater than start and within known scene duration. Preserve cue list order rather than sorting by timing. Overlap can be deliberate; do not infer word timings, speaker identity or synthesis. Do not duplicate a legacy line during opt-in.

## V3 change-set contract and approved Outfit creation

V3 accepts existing operations and recipe types plus `variant.propose` and `variant.review_candidate`. The variant scope is Outfit/wardrobe only in B2. A proposal targets the exact existing stored parent Character ID and expected revision. It cannot create/reparent an identity or treat a same-batch unresolved Character reference as an existing parent. A new Character can be created first, then receive a parent-bound Outfit in a later approved batch.

Each recipe operation may carry a versioned ensemble patch:

- Participant upserts keyed by stable local ID. New participants require a scoped real Character binding or an earlier approved Character candidate ref. Existing participants retain omitted frozen fields. Wardrobe takes a stored asset, stored compatible variant or earlier approved Outfit candidate; null explicitly clears it. Identity-source choices use actual approval data.
- Explicit removeParticipantIds, optional complete participantOrder and optional primaryParticipantId. Omission preserves existing participants/order/primary; additions append in supplied order. Validate conflicts, unknown IDs and complete reorder membership. No omission means deletion.
- Ordered dialogueCues as an explicit complete replacement; omission preserves the parent cues and an empty array explicitly clears them. Stable IDs make reorder/diff/Script reliable. A legacy parent is seeded once when the operation explicitly opts into ensemble authoring.

Reject conflicting top-level Character/wardrobe/identity/dialogue fields with ensemble fields, and reject raw snapshots, manual outputs, approval flags and unknown B2 fields. Retain B1 global Camera/settings/override/pending/original semantics. Dependency-first refs must have the right kind: a variant result cannot masquerade as assetId. Versioned schema definitions, exported artifacts and existing preview/submit MCP input unions must agree.

Add an optional browser-owned variantDecisions map, separate from unchanged assetDecisions. Default defer; create/reuse require explicit confirmation, exact parent/revision and duplicate acknowledgement where applicable. Reuse matching is constrained to the same actual parent and Outfit type. Created variants have reviewStatus unreviewed and no identity/anchor approval.

Keep historical ledger/default approval shapes unchanged. Add optional versioned variant-candidate entries alongside existing asset candidates, with typed variantId mappings in receipts. Existing ledger capacity applies to the combined candidates/receipts, with no eviction or doubled allowance. Existing receipt envelope can retain version 1 with newly recognized v3 operation/status values; legacy receipt values are unchanged. Deferred variant review remains available after reload/backup and returns the original receipt on exact replay.

Extract only necessary pure variant construction/validation from the existing repository path; do not call an asynchronous second writer inside the import transaction. Extend the existing plan with approved variant writes, then validate/create assets, variants, scenes, project changes and receipt in the same transaction. Any late failure rolls back all of them. A deferred required variant blocks the dependent recipe and the complete batch, leaving the package downloadable.

## References, retention and metadata

Extend common traversal helpers to enumerate all participant Character/wardrobe snapshots, legacy/global slots, source links, explicit packs and results. Cover draft writes, saved scenes, clipboard/export views, asset/variant dependency checks, media reachability/cleanup, backup validation, project ZIP and state signatures. Reuse existing media ownership/unsaved-form protection; no cleanup rule is weakened and no stored media is removed by opt-in or component changes.

New participant pack entries keep sourceSlot character/wardrobe and actual source IDs, adding an optional participantId. Association IDs include participant ID, slot, source ID and existing media/role occurrence identity. Skip mirrored primary slots so one relationship is not added twice. Do not rewrite legacy association IDs. Retain intentionally independent selected associations; do not silently discard earlier guides when components change.

One binary file can serve several legitimate participant/role associations: preserve those associations, write/export the bytes once per media ID and verify hashes. References for explicitly off-camera participants remain available in their snapshots but are not automatically visual inputs; user-selected independent associations remain explicit. Display participant/role labels throughout the pack and export manifest. Preserve reference selections/order/names and the B1 fix for reordered extra references.

Full-library and project exports preserve optional ensemble/candidate metadata and every associated original. Validate nested fields before transactional restore; malformed participants, parent ownership, duplicate IDs or invalid cues reject without replacement. Old backups need no backfill and retain their exact legacy behavior. The existing manifest/media/archive/export limits remain effective; this is not new large-library certification.

## Existing template workflow

Keep all legacy template behavior unchanged. For an ensemble draft, Save Draft as Template must preview an explicit choice: **Include ensemble defaults** (all participant snapshots, their wardrobe/generation, ordered cues and selected participant reference associations), or **Shared components only**. The ensemble option is unchecked by default, preserving the existing opt-in for saving identities. Shared-only mode clearly lists the omitted participants, per-person wardrobe and cues and requires confirmation of that omission; it must not silently save only the primary person. The draft itself is never changed by template saving.

Use an optional versioned `ensembleDefault` envelope on Template to retain the full chosen ensemble and its selected participant associations, without new stores or rewriting legacy defaults. Include-ensemble mode does not also store an independent includedCharacterSnapshot or primary wardrobe default that could override the envelope. Applying that explicitly selected template creates an ensemble draft from the frozen defaults, keeps local participant/cue IDs and source provenance, synchronizes primary mirrors and revalidates actual current anchor approvals before save. It does not refresh identities or reparent wardrobe.

Shared defaults, source-file selection and result files keep their existing template semantics. The preview states exactly which non-participant pack associations/originals/results are not included; no stored files or original draft selections are deleted. Preserve participant pack selections rather than reselecting every attachment on template application. Extend nested validation, media reachability, dependency checks, full backup/restore and template round-trip tests to cover ensembleDefault. Existing asset.propose/template candidates remain instruction-only; MCP template metadata must not disclose the new frozen identity/cue payload without the applicable existing text/identity permissions. B2 adds no new AI template-creation operation.

## Cast, wardrobe continuity, Script and Preflight

Cast derives every actual participant Character, without combining identities or replacing explicit bible entries. Wardrobe continuity tracks each Character independently across selected takes. Reuse the existing shot-level intentional wardrobe-change note as shot-wide context, clearly labeled; do not invent per-person intent or a new production-status change.

`getProjectDialogue` emits each cue in shot order then cue order, with stable optional cueId/participantId metadata for ensemble rows. Script UI keys rows by shot/scene/cue, with the existing legacy fallback. New multi-cue formatting groups speakers under the shot and preserves exact lines; legacy single-line Script output remains byte-identical. Voiceover/off-screen speakers have their true modes.

Preflight validates links, per-person ownership, primary mirrors, current original media and cue structure; name/style/camera advice remains appropriately advisory. Reuse existing identity/name/performance validators for each relevant participant/cue. Blocking findings identify participant/cue and an actionable control, without exposing private prompt evidence through metadata-only MCP responses.

## UI behavior and permission boundary

Keep compact scene recipe rows and existing visual reference workspace. Ensemble controls provide participant add/select/remove/reorder, primary/presence, clearly owned wardrobe and per-person performance/anchor details. Character identity text remains locked. Dialogue uses compact ordered cue items with editing details, explicit speaker/participant/mode and existing Performance Studio controls. Show exact output and actual bindings in reviewed change-set details. All new controls require clear labels, keyboard operation, focus return and mobile reflow.

Read DTOs and scope traversal must cover nested Character/variant/source media refs, candidate parents and imported mappings. Existing character-identity, ordinary asset-text, notes, filenames and full-scene disclosure flags still apply independently; do not leak participant identities through summaries, cue performance notes or errors. An MCP Outfit proposal's existing parent Character ID must already be authorized; unknown/unshared caller parent IDs fail generically before submission. Manual owner import and explicit proposal-local human reuse remain supported, but reuse does not retroactively authorize an unshared caller-supplied parent ID or a lookup by title. Newly created Character/variant IDs and receipt mappings do not automatically widen ongoing AI read permissions.

Reviewed-content proofs include participant/cue metadata, snapshots, ownership, intended timing, resolved variants, target IDs, visible findings and all authoritative outputs. Relevant-state signatures bind every current asset/variant/media/anchor/candidate read, including deletion. Recheck browser scope epoch, project/head revisions and exact content inside the write transaction. No new approve/apply MCP tool and no automatic selection/status change.

## Acceptance and delivery

Use only synthetic data representing three fictional adult Characters. Tests must show two distinct participants, addition of a third, independent outfits/performance, wrong-parent rejection, no unintended identity replacement and frozen data after library edits. Mandatory cue case: off-screen officiant asks Lucas whether he takes Aya as his wife; Lucas answers `I do.` on camera, as two ordered cues, without an officiant Character record.

Also cover legacy opt-in exactly once; inherited template Character/wardrobe snapshots without fabricated asset IDs; full-ensemble/shared-only template saving and application, explicit omission review and restored template media reachability; empty/reordered/removed participants and cues; stale head/project/variant/master/media/scope; approved-anchor fallback per participant; all Shot Types; negative-prefix stability; full copy/download; no duplicate associations/binaries; unsaved-media reachability; same-batch approved/deferred/reused Outfit candidates; no pre-approval writes; late quota/abort rollback; exact replay after restart/backup; mixed legacy/B1/B2 full backup and project ZIP with SHA-256 checks.

Preserve all frozen legacy output/script hash tests and frozen v1/v2 schema bytes. Add runtime/exported/MCP v3 parity tests. Run full unit/component and bridge suites, typechecks/builds, production audits, historical QA reconciliation, CLI evidence validators, full synthetic browser suite and focused production-launcher SDK acceptance. Capture 1440/768/390 widths, keyboard/focus and equivalent 200% reflow. Use signed Valid native helpers under AllSigned after bridge rebuild; label skipped/unverified native tests honestly. The full actual installed-Codex ensemble workflow remains B3, but existing installed-CLI regression/discovery must remain compatible.

Deliver one separately reviewed/tested B2 PR against master, signed commit, exact-head hosted CI, source-file inventory, hashes, screenshots, failure/rollback evidence and honest limitations. Keep unmerged. Retain local work and QA profiles/artifacts. The real Wedding project remains unchanged.

## Calls proposed by the agent

V3 change sets and v2 ensemble-only document schemas; one optional envelope with checked primary mirrors; bounded 8 participants/32 cues; explicit upsert/removal/order semantics; unique actual Character IDs within a scene; separate optional Outfit-candidate decisions/ledger entries; new Outfit proposals only for actual existing parents; inherited template snapshots remain honestly frozen; ensemble-aware template defaults require explicit inclusion; no implicit identity/wardrobe refresh; explicit opt-in and immutable old scenes. These are implementation proposals for review, not claims of prior user approval. The builder may choose module splits/control composition while keeping these contracts and acceptance outcomes.

## Builder check disposition

One fresh read-only builder check raised two planning questions. Both are resolved above from the preservation requirements and existing template behavior: retain inherited template Character/wardrobe snapshots without invented parent IDs, and support explicit ensemble/defaults versus shared-only template saving instead of silently dropping secondary participants. These are agent-proposed compatibility decisions for the user's design review. No product implementation, library access, data migration or remote change has occurred at this design stage.
