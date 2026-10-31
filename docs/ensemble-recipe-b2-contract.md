# B2 ensemble recipes and Outfit proposals

B2 extends B1 recipes with an explicit ensemble, owned wardrobes and ordered dialogue cues. The builder and reviewed v3 change sets use the same canonical assembler and existing atomic save path. B1 single-character recipes and Direct Prompt scenes retain their existing behavior.

## Opt-in and frozen records

An ensemble is an optional `ensemble` envelope on a recipe draft or saved scene. It is created only by explicit builder opt-in or a v3 recipe operation. Opt-in seeds the existing Character, wardrobe and legacy dialogue once; it does not rewrite the identity prompt. Repeated opt-in does not duplicate them.

- At most **8 participants** and **32 cues**. Local IDs are unique, safe strings of at most 64 characters; `constructor`, `prototype` and `__proto__` are rejected. Role text is at most 500 characters and participant performance notes at most 1,000. Existing field/package limits also apply.
- Each participant has a stable local ID, frozen Character snapshot, optional wardrobe, presence, role, performance notes and optional generation choice. The explicit primary must be on camera. The legacy Character/wardrobe/generation fields are checked mirrors of that primary. With no visual participants the primary is null and those mirrors are absent.
- A real Outfit variant must belong to the selected actual Character. Shared Clothing assets are also supported. Participant identity text remains locked; selecting a different stored Character is an explicit replacement.
- Off-camera participants retain their snapshots and references for later editing and storage reachability. Their visual identity/wardrobe is not automatically included in visual generation inputs. Independently selected reference-pack associations remain selected.
- Existing template-backed Character/wardrobe snapshots remain template snapshots; no actual Character ID or approved anchor is fabricated. Bind an actual Character explicitly before using an owned Outfit or approved anchor.
- Full ensemble templates require explicit inclusion and retain participant-tagged selected associations, including historical guides whose participant was removed. Non-participant reference-pack associations are not part of these template defaults; the source draft and its files remain intact. Shared-only saving requires review and acknowledgement of omitted participants, outfits and cues. Opening or saving a legacy template does not automatically opt it into ensembles.

No IndexedDB version/store change or bulk migration is introduced. Saving creates an immutable scene through the existing authoring transaction; it does not refresh the other participants from their current library masters. Revisions and restore-as-new preserve the frozen source snapshots, old scenes and preferred takes unless an explicitly approved operation changes the preference.

## Dialogue and outputs

Cues extend the existing `DialogueConfig` with `id`, optional `participantId` and optional start/end timing. Array order is authoritative. Unlinked off-screen narration is valid; no officiant Character must be invented for an off-screen question followed by Lucas saying `I do.`. On-camera cue linkage and timing are validated against the actual scene and duration. Existing Performance Studio controls apply independently to each cue.

All three master prompt modes contain the complete relevant frozen identities and ordered dialogue. Display collapse never truncates copied/exported text. Cue text, including intentional whitespace and line breaks, survives unrelated editing. Script keys include shot/scene/cue identity; duration is counted once per shot. Cast and wardrobe continuity include each actual participant, while unbound template identities are honestly labelled.

Ensemble canonical documents and Generation JSON use version 2 only for ensemble records. The generation resolver checks each participant's current stored Character independently before selecting an approved anchor; stale, unavailable or unsupported anchors fall back to that participant's frozen master. Template-backed identities always use their frozen master. Master Full/Structured/Compact outputs do not substitute approved anchor text. Legacy documents/output hashes remain covered by the original regression tests.

## V3 change sets

Use `krakinai.change-set.v3`; the frozen v1/v2 schemas remain unchanged. The exported [v3 schema](change-set-v3.schema.json), runtime validator and MCP schema are tested for parity. Structural validation alone does not prove that a referenced record exists, is in scope or can assemble.

V3 retains the existing recipe operations and adds:

| Operation/field | Meaning |
| --- | --- |
| `ensemble.participantUpserts` | Explicit participant additions/patches; actual asset/variant IDs and expected revisions, or dependency-first approved candidate refs |
| `ensemble.removeParticipantIds` | Explicit removals; linked cues must also be resolved |
| `ensemble.participantOrder` | Complete explicit order, without duplicates or unknown IDs |
| `ensemble.primaryParticipantId` | Explicit on-camera primary, or null when there are no visual participants |
| `ensemble.dialogueCues` | Complete ordered cue replacement; omitted preserves existing cues |
| `variant.propose` | Propose a new `Outfit` for an already stored Character at its exact expected revision |
| `variant.review_candidate` | Review a previously deferred Outfit candidate at its expected candidate revision |

An omitted patch field preserves existing content; explicit supported nulls clear that field. Raw identity bodies, snapshot blobs and approval stamps cannot be injected through participant patches. Conflicting legacy Character/wardrobe/dialogue fields and ensemble patches are rejected. V1/v2 cannot silently rebuild an ensemble as a legacy recipe.

This is a recipe-operation fragment, **not a standalone import**. Obtain actual IDs/revisions from authorized metadata; the placeholders must not be imported as records:

```json
{
  "ensemble": {
    "version": 1,
    "participantUpserts": [{
      "id": "second-person",
      "character": { "asset": { "id": "ACTUAL_CHARACTER_ID" }, "expectedRevision": 3 },
      "wardrobe": { "variant": { "id": "ACTUAL_OWNED_OUTFIT_ID" }, "expectedRevision": 1 },
      "presence": "on_camera",
      "identitySource": "master"
    }],
    "participantOrder": ["primary", "second-person"],
    "primaryParticipantId": "primary"
  }
}
```

Outfit proposals have separate browser-owned **create/reuse/defer** decisions. New Outfits are unreviewed and do not grant identity approval. Reuse requires an exact existing owned variant and explicit local decision; no title matching can silently choose one. A same-batch new Character cannot parent a new Outfit: approve the Character first and propose the Outfit in a later batch. A deferred dependency blocks the dependent recipe rather than creating a partial scene.

Candidates remain within the existing shared candidate/package/ledger budgets: 50 per batch, 250 retained, 4 MiB ledger. Existing application limits and Project Export's **128 MiB** allowance remain unchanged.

## Approval, permissions and atomicity

Preview/submission do not write the library. The human reviews the exact proposal, decisions, people, cues, references, findings and complete output modes in KRAKINAI, then applies using the existing browser review controls. The content/state/scope proof is rechecked inside the existing transaction. Newly generated bookkeeping timestamps are excluded from content comparisons; approved-anchor timestamps and semantic content are bound.

Assets, variants, scenes, project/take updates and the import receipt commit together or roll back. Exact replay returns the retained receipt without creating another scene/Outfit, including after tested backup/restart. Stale draft edits retain the user's local buffer and report the rejected write.

Default MCP responses contain metadata, not private identities, cue scripts, notes or filenames. Existing explicit text/identity/full-prompt permissions control disclosure. Every nested asset/variant/parent read must be in scope; candidate reuse, receipts and newly created IDs do not grant future access. There is no MCP approval/apply tool. Disconnect revokes access.

## References and backups

Participant IDs qualify reference associations. The same stored media may serve several people/roles: associations remain separate while archive bytes are included once per media ID. A retained association is captured provenance; replacing/removing a participant does not silently reassign or delete its stored media.

Full backups round-trip optional ensemble fields, templates, variants and receipts using the existing backup path. Project ZIPs include the selected frozen take, participant labels, complete prompts/Generation JSON and hashes. This feature does not replace backup streaming, increase any ZIP/restore gate, or certify large-library restoration.

Implementation entry points: [types](../src/types/ensemble.ts), [validation](../src/domain/ensembleValidation.ts), [canonical document](../src/domain/ensembleDocument.ts), [change-set application](../src/domain/changeSetEnsemble.ts), [Outfit decisions](../src/domain/changeSetVariants.ts), [authoring transaction](../src/storage/sceneAuthoring.ts), [builder controls](../src/components/EnsembleControls.tsx), [MCP projection](../src/domain/ensembleAiContext.ts).

B3 Direct Prompt conversion and complete installed-Codex ensemble certification remain excluded. See the [QA report](ensemble-recipe-b2-qa.md) for actual evidence and limitations.
