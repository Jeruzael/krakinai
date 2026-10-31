# B1 recipe change sets

B1 adds single-character recipe proposals to the existing human-reviewed importer. It does not create a scene when required components or original files are missing. Complete packages can be downloaded, corrected and reviewed again. No unapproved persistent draft is created.

## Versions and discovery

- `krakinai.change-set.v1` and [its published schema](change-set.schema.json) retain their existing operations and formatting.
- `krakinai.change-set.v2` accepts those operations plus `scene.create_recipe`, `scene.revise_recipe` and `scene.create_recipe_take`. Use the [v2 JSON Schema](change-set-v2.schema.json).
- Existing `krakinai_preview_change_set` and `krakinai_submit_change_set` tools advertise both versions through their MCP input schemas. Tool names, envelopes, API version, transport, permissions and approval requirements stay the same. There is no separate schema-fetch tool.
- Structural validation is not a promise that records exist or a recipe can assemble. Current records, revisions, media, required slots, identity and normal assembler limits are checked during preview and again inside the existing atomic save transaction.

## Creation example

IDs below are placeholders. Fetch only authorized metadata and use actual IDs/revisions; do not match or invent records by title. A same-batch asset candidate can instead be referenced as `{ "ref": "candidate-client-ref" }` after its producing operation.

```json
{
  "schema": "krakinai.change-set.v2",
  "changeSetId": "unique-recipe-request",
  "source": { "kind": "codex", "label": "Reviewed recipe proposal" },
  "operations": [{
    "operationId": "opening-recipe",
    "type": "scene.create_recipe",
    "clientRef": "opening-recipe",
    "project": { "id": "actual-project-id", "expectedRevision": 1 },
    "shot": { "id": "actual-shot-id" },
    "title": "Courtyard opening",
    "shotType": "property_environment",
    "settings": { "aspectRatio": "16:9", "durationSeconds": 4 },
    "assetRefs": [{
      "asset": { "id": "actual-environment-id" },
      "slot": "environment",
      "expectedRevision": 2
    }],
    "sceneInstructions": "Preserve the existing courtyard geometry."
  }]
}
```

Creation requires title, Shot Type, settings, project and shot targets. It uses the normal builder defaults for omitted optional values. Variants use the existing `variantRefs` shape with their actual ID and revision, and must belong to the selected Character. Candidate decisions remain browser-owned create/reuse/defer choices. New assets are unreviewed; a new Character has no approved anchor. A deferred dependency blocks the whole dependent batch. A human can explicitly reuse an unshared existing asset through the proposal-local review grant without granting future AI access to it.

## Revisions and alternate takes

Both recipe-parent operations require `sceneId`, `expectedHeadId`, project/shot targets and the expected project revision. A revision changes only explicitly supplied fields. An unchanged alternate take is allowed; an empty revision patch is rejected. Direct Prompt parents require a new recipe on the same shot; conversion is outside B1.

```json
{
  "operationId": "camera-revision",
  "type": "scene.revise_recipe",
  "clientRef": "camera-revision",
  "sceneId": "actual-recipe-parent-id",
  "expectedHeadId": "actual-current-head-id",
  "project": { "id": "actual-project-id", "expectedRevision": 2 },
  "shot": { "id": "actual-shot-id" },
  "assetRefs": [{
    "asset": { "id": "actual-camera-id" },
    "slot": "camera",
    "expectedRevision": 1
  }]
}
```

Unchanged slots retain their frozen parent snapshots even after global assets change. Settings merge by named field. `clearSlots` removes named slots; conflicting clear/rebind/override requests reject. Non-Character `overrides` accept `overrideText` and `overrideCompactText`; null clears that override. Character identity text cannot be overridden. `dialogue: null` clears the existing single dialogue configuration. `cameraComposition: null` resets composition through the existing helper. Composition choices use the published existing catalog and parameters, not caller baseline snapshots.

`identitySource` is `master` or `approved_anchor`. Anchor selection uses actual stored approval metadata and freshness checks. An unavailable/stale approved anchor produces the existing honest master fallback, never an invented approval. Caller identity text, approval stamps, raw snapshots, manual output overrides and externally assembled recipe outputs reject.

For parents with manually edited outputs, the browser must explicitly acknowledge discarding those edits and reassembling. The preview shows current and proposed outputs. Revisions/takes never change preferred takes implicitly; use the existing separately approved selection operation.

## Originals, references and incomplete work

`sourceMedia`, `references` and `pendingInputs` use the existing change-set shapes. Required original image/video records must exist in the current media map, have supported MIME types and consistent stored metadata. A pending label cannot substitute for an uploaded original. Original filenames come from actual stored records. Missing MIME claims use the stored MIME type; conflicting MIME claims block.

Inherited reference associations remain frozen. Explicit new extra references retain their roles and provenance. If existing Shot Type rules would discard an explicitly requested extra reference, preview blocks and directs the user to an active component, original source or pending input. B1 does not silently filter stored files, reassign media or change Reference Pack Manager behavior. Optional missing guides produce the existing Preflight finding; pending production inputs remain visibly pending and can accompany an otherwise assembled scene.

The existing factory produces all three complete outputs: Full, Structured and Compact. Preview and commit compare deterministic content and revalidate current state. No hand-built prompt substitute is saved. Copy passes the canonical string directly to Clipboard API; Windows may translate LF to CRLF in its native clipboard. Stored/downloaded JSON strings retain their exact values.

Blocked recipes remain reviewable and downloadable as the full change-set package, including pending inputs and caller text. They create no partial project, asset, scene, receipt or persistent draft. Complete recipes commit through the existing transaction with actual receipt IDs and immutable history; identical replay returns the receipt without duplication.

## Limits and boundaries

Existing limits remain: manual package 20 MiB, MCP package 1 MiB, 250 operations, 10 projects, 250 shots, 100 scene operations, 50 candidates, 500 pending inputs and dependency depth 16. Existing instruction/dialogue/performance text and semantic settings limits also apply. Invalid fields, unknown/forward references, wrong categories, stale revisions and ownership mismatches reject.

No database migration, new store, persistence-rule change, storage-limit change, assembler rewrite or backup implementation change. Mixed v1/v2 scenes and receipts restore in the current application; older application versions are not promised to understand new v2 receipts. B2 participants/new variants/multiple dialogue cues and B3 integration remain separate, gated work.

Implementation: [recipe construction](../src/domain/changeSetRecipe.ts), [planner](../src/domain/changeSetPlanner.ts), [reviewed-content projection](../src/domain/changeSetRecipeContent.ts), [atomic save](../src/storage/changeSets.ts), [preview UI](../src/components/RecipeOperationPreview.tsx). Run `node scripts/export-change-set-schema.mjs --check` for published-schema parity.
