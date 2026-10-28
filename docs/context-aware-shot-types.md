# Context-aware Shot Types

Shot Type describes the content of a shot. The existing single-shot video concept remains separate: JSON still uses `scene.type: "single_shot"`.

| Shot Type | Required assets | Source and instructions | Dialogue |
| --- | --- | --- | --- |
| Character Scene | Existing Environment, Action and template requirements | Existing optional scene instructions | Existing conditional Character requirement, including voiceover |
| Property / Environment | Environment; other layers optional | Optional scene instructions | Voiceover/off-screen without Character; on-camera/unspecified spoken mode requires Character |
| Graphic / Motion Design | No Character, Clothing, Environment, Action or Lighting assets | Original supported image and Animation Instructions | Voiceover/off-screen without an on-screen Character |
| Existing Footage | No Character, Clothing, Environment, Action or Lighting assets | Original supported video and Editing Instructions | Voiceover/off-screen without an on-screen Character |

Camera and Style are optional for source-based shots. Physical-character/camera/lighting contradiction heuristics are not applied to graphic or footage directions. Required source failures are blocking. Existing advisory evidence and acknowledgements remain available for applicable checks.

Select Shot Type beneath Scene Title. Switching preserves all selected draft layers and source links; Not Applicable layers are inactive. They do not enter the assembled prompt, identity exports, reference checklist or generated JSON. Switching back restores access to those selections. An immutable saved scene captures active layers. Its originating draft keeps the inactive work.

Source Media is original input, separate from external results. Upload an original or reuse a stored file, preview it, replace or remove the association. Reusing an existing ID does not create another binary. Image uploads retain the existing JPEG/PNG/WebP rules and 10 MiB limit; video uses MP4/WebM and 50 MiB. Existing per-record and total storage limits remain unchanged. Original filenames and bytes are preserved; an export filename can still follow existing naming rules.

Copying text does not attach a file to an external AI tool. Attach the original separately. KRAKINAI creates an animation/editing specification; it does not render the image or video, infer new architectural content or verify an external provider's capabilities.

## Optional record and JSON metadata

No IndexedDB store, database version or data migration is added. Existing records without metadata are not backfilled or rewritten.

- `SceneDraft.shotType` / `SavedScene.shotType`: optional `character_scene`, `property_environment`, `graphic_motion`, or `existing_footage`. Missing means Character Scene.
- `SceneDraft.sourceMediaLinks` / `SavedScene.sourceMediaLinks`: optional ordered existing `MediaLink` records, with stable `mediaId`, input `role: "reference"`, original `filename` and `mimeType`. The underlying media remains in the existing media store.
- `SceneDraft.inheritedAvoidPrefix` / `SavedScene.inheritedAvoidPrefix`: optional internal provenance for component negatives inherited by Edit a Copy. Character behavior stays unchanged, including its historical aggregate text. A non-character conversion excludes only the known inherited portion and keeps authored scene negatives. New copies retain the complete prefix through refresh/save/copy operations. Older copies recover it from available immutable ancestry by exact matching; no existing scene is rewritten. Arbitrary authored negatives are never split or guessed from words.
- `Template.shotType`: optional intended type. Compatible shared rules govern its requirements. A template does not embed a new binary; attach an original to each source-based draft.
- `ProjectShot.plannedShotType`: optional planning hint. Once a saved take is selected, that scene's effective type is authoritative. A mismatch is displayed explicitly; changing the plan cannot rewrite the saved take.
- New non-character Scene/Generation JSON adds `scene.shotType`. Source-based exports also add `scene.sourceFidelity` and a root `sourceMedia` array of `{mediaId, filename, mimeType}`. Original references use `sourceSlot: "source"`, `purpose: "general"`, input role `reference`.
- Reference Pack, Reference ZIP and Project ZIP retain source associations and original media. Their existing manifests gain optional source/shot metadata; original file hashes remain independently inspectable.

Existing `krakinai.scene-prompt.v1` and `krakinai.generation-prompt.v1` identifiers remain. These are optional KRAKINAI metadata extensions, not official request schemas for any external provider. Missing and explicit Character Scene metadata retain the legacy text and JSON bytes. Historical saved output strings remain frozen.

## Save, restore and recovery

Drafts may be unfinished, including an image retained while switching to Existing Footage. Backups preserve those drafts and validate existing source associations without requiring a finished shot. A new immutable scene requires the original file to exist, have the correct supported kind and consistent stored MIME/size/blob metadata, plus authored instructions. This validation runs within the existing atomic save transaction, including project membership updates.

Old backups remain importable. New backups preserve optional metadata and originals; older application builds may not understand the extended source association enum. Use a build with Shot Type support to restore those new backups. No ZIP64 recovery gate or full-library limit is raised by this feature. Project Export remains a separate 128 MiB feature.

The QA report distinguishes unit fixtures (some opaque bytes), the browser's decodable fictional floor-plan PNG, API roundtrips within an isolated browser context, actual UI interactions, and independent archive readback. No actual user browser data is used.
