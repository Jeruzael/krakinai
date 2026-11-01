# B3: guided AI Recipe Builder and conversion contract

This guide is for creators using the mapping screen and developers producing
reviewable change sets. The original Direct Prompt remains saved. Conversion
creates a newly assembled recipe alternate take on the **same existing shot**;
its wording and formatting can differ from the original.

## Creator workflow

1. Save the Direct Prompt and attach it to an existing storyboard shot. Open
   **AI Recipe Builder** from the shot/Direct Prompt actions, or `/#/recipes/ai`.
   Select the exact saved source and its destination membership.
2. Choose reusable components in the seven compact rows. Their complete text
   stays in detail controls. Character identity stays locked. Enable participants
   and ordered cues for an ensemble; choose each person's compatible Outfit.
   An off-camera officiant can be an external speaker without a fake Character.
3. Review scene-only instructions, negative text, settings, pending inputs and
   original source media. Upload originals through the existing Source Media
   workflow; choose the stored original here. Missing required originals block
   saving. Optional future reference frames can remain explicitly pending.
4. Propose missing reusable assets/Outfits as candidates, then add each candidate
   to the package. Unsubmitted candidate text remains an unsaved editing idea.
   Mapping edits, previews and candidate proposals do not save library records.
5. Download the mapping package to keep unfinished work. Resume accepts a bounded
   JSON package (20 MiB); it restores inputs, never approval. Leaving dirty work
   warns, but a browser crash can still lose work that was not downloaded.
6. Open review. Inspect actual selected IDs/revisions, mapping assessments and
   complete Full/Structured/Compact outputs. Copy uses the complete mode string.
   Acknowledge uncertain, omitted and unassigned rows and the whole mapping.
   Candidate decisions or edited inputs invalidate previous approval.
7. Apply through the existing local import review or the incoming MCP proposal's
   browser controls. Stage B atomically saves the approved batch and its receipt.
   The old preferred take remains selected. Choosing another preferred take is
   a separate `shot.select_take` operation with its own explicit approval.

**Revise This Scene** creates an immutable version from frozen components.
**Create or Revise Reusable Asset** opens the existing library editor or creation
workflow. Editing a master affects future explicit selections, not frozen scene
outputs. Existing **Build from Assets**, revision and alternate-take actions remain.

Editing an incoming mapping rejects that original proposal and opens a **new**
package with another ID. Download/review/resubmit that package; approval and the
original proposal's receipt identity cannot be transferred to it.

## Versioned operation

[`change-set-v4.schema.json`](change-set-v4.schema.json) extends v3's operations
with `scene.convert_direct_to_recipe`. V1, v2 and v3 remain available with their
existing serialization. The conversion operation uses the existing recipe input
fields plus:

| Field | Meaning |
| --- | --- |
| `sceneId`, `expectedHeadId` | Existing saved Direct Prompt and its current family head |
| `project: {id, expectedRevision}` | Existing exact project revision, not a new-project client reference |
| `shot: {id}` | Existing shot already containing that Direct Prompt |
| `conversion.version` | `1` |
| `conversion.sourceTextSha256` | Lowercase SHA-256 of the exact saved Full string encoded as UTF-8 |
| `conversion.mappings` | 1–128 unique, typed review rows |

There is no normalization of whitespace, line endings or Unicode before hashing.
Optional `sourceSpan: {start,end}` uses JavaScript UTF-16 offsets into that saved
string; ranges must be valid and must not split surrogate pairs. A mapping row
has a bounded local `id`, one `target`, an `assessment` (`suggested`, `uncertain`,
`unassigned`, `omitted`), and an optional explanation of up to 500 characters.
Targets are a component slot; participant Character/wardrobe; cue; settings;
instructions; avoid; references; source media; or pending inputs. IDs and targets
must be unique. Required mapped inputs and explicit omissions are checked against
the resolved recipe, not accepted merely because a row exists.

Author a genuine recipe using selected snapshots, scene-only overrides,
instructions and cues. The source Direct Prompt is a creative reference, never
an implicit fallback instruction block or manual output override. Existing
package/operation/candidate limits remain in force (including 250 operations).

The new saved scene has `authoringMode: "recipe"`, a fresh revision root at
sequence 1, `separateTakeOfSceneId` identifying the Direct take, and bounded
`conversionProvenance` containing source ID/hash/mappings. It has no Direct body
or copied manual outputs. Later recipe versions belong to this new recipe family.
Provenance is descriptive; it grants no permissions and needs no live original
scene to remain valid after a backup restore.

## MCP authority and response handling

Existing authenticated tools perform scoped reads, preview, submission, proposal
status and receipt recovery. No approval or direct database-write tool is added.
Pairing, source-project selection, original full-prompt disclosure, ordinary
asset text and Character identity grants remain explicit and separate. Notes
and media filenames keep their existing separate controls. Full-prompt grants
share the saved string verbatim; they do not redact text embedded inside it.

A v4 conversion preview/status may return complete three-mode outputs only when
its source/text/identity scopes permit them. Server response bounds still fail
explicitly; they do not truncate output. A new record's receipt ID does not grant
ongoing read access. Project membership permits metadata access; full prompt
and reusable-asset reads retain their separate grants. Permission changes revoke
pending approvals. Disconnect requires confirming **Disconnect now**.

In receipts, candidate and created-record IDs differ: `idMappings[clientRef].id`
is the candidate ID for `asset.propose`/`variant.propose`. Use its `assetId` or
`variantId` for the created reusable record. Scene mappings use `kind: "scene"`
and `id` for the saved scene. Check the actual confirmed receipt, not a client
reference, guessed ID or assistant success message.

**Codex CLI 0.73.0 limitation:** the client clipped a ten-shot preview while its
enclosing JSON remained valid. The installed-CLI certification uses documented
`tool_output_token_limit=100000` in its isolated child configuration and rejects
clipping markers. It does not change global Codex configuration or application
limits. Use smaller batches or a deliberately reviewed client budget when a
client cannot retain a complete response. The browser review remains the place
to inspect the complete saved outputs. See the official
[configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

## Storage, compatibility and recovery

Source hashes are prepared outside the write transaction. The atomic writer
then rechecks current source text, head, project revision, bindings, media and
consent against current stored state before committing. No cryptographic await
is introduced inside an active IndexedDB write transaction. Failed or stale
approval does not partially save candidates, scenes or preferred selections.
Exact replay returns the existing receipt without another import.

Captured reference associations are retained, including inactive entries. Active
assembly continues to use the existing reference selectors. Original source
links and duplicate checklist occurrences are not silently dropped. This is not
a Reference Pack Manager or automatic export-filtering feature.

The database stays at version 1 with the existing eight stores. Full backups
retain optional provenance under the existing validation/replacement workflow;
legacy backups remain valid. Project Export retains its 128 MiB limit and adds
only optional selected-take provenance metadata; no new Project ZIP restore
workflow is claimed. The assembler, storage limits and ZIP64 experiment are not
changed by B3. The real Wedding project is not converted by these tests.

Implementation entry points: [conversion planning](../src/domain/recipeConversion.ts),
[schema](../src/domain/recipeConversionSchema.ts),
[guided workspace](../src/screens/AiRecipeBuilderScreen.tsx),
[shared review](../src/components/RecipeConversionReview.tsx),
[atomic import](../src/storage/changeSets.ts),
[MCP projection](../src/domain/recipeConversionMcp.ts), and
[actual installed-CLI acceptance](../e2e/recipe-conversion-native.spec.mjs).

Verification and limitations: [B3 QA report](recipe-builder-b3-qa.md).
