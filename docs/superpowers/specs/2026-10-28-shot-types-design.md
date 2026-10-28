# Context-aware Shot Types

The supplied MIDORI brief is the implementation specification. Work starts from master `8d2d145` on `codex/context-aware-shot-types`; no user browser profile is used.

## Design

Add optional `shotType` and `sourceMediaLinks` to drafts and saved scenes, optional `shotType` to templates, and optional `plannedShotType` to storyboard shots. Missing Shot Type resolves to `character_scene`. Do not migrate or backfill existing records or add a database store.

One `shotTypeRules.ts` module owns required, optional and inactive slots, source kind, instruction labels, dialogue requirements and applicable Preflight rules. Character scenes keep their old Environment/Action/template and conditional character requirements. Property scenes require Environment. Graphic and footage shots require an original image/video and authored instructions; Camera and Style are optional. Their Character, Clothing, Environment, Action and Lighting selections remain inactive in the draft. A type change preserves all selections and source associations. Active views and exports exclude inactive selections. Immutable saved snapshots capture only active slots and source associations.

Source associations use stable existing media IDs and the existing media validation/upload pipeline. A source is distinct from a generated result. The source is available in reference packs, JSON and ZIP exports, media reachability, backup validation and restore. Saving validates original stored media inside the existing atomic transaction. A failed save cannot create a partial scene or project membership.

Voiceover/off-screen dialogue can accompany non-character shots without a visible character. Spoken/On-camera modes conservatively require a relevant active character. Spoken text and all existing performance controls remain exact. Physical character/camera/light contradiction checks do not run on unrelated graphic or footage instructions.

Legacy serializers omit new fields and preserve exact old strings. Non-character JSON adds optional Shot Type and source-media metadata while retaining `scene.type = single_shot`. These are KRAKINAI contracts, not official external-provider schemas. Source fidelity guidance preserves the original without inferring dimensions, labels, identities or rendered results.

## Alternatives and boundaries

Reusing result media would confuse input and output; separate optional source links preserve provenance. Separate media stores or database migration are unnecessary. Clearing incompatible selections would be destructive; retaining inactive draft selections is reversible. Full-library and Project Export limits, ZIP64 recovery work, identity approval, snapshots and existing data remain unchanged.

## Verification

Freeze legacy outputs before changes. Test the four rule sets, inactive contamination, dialogue, MIME/missing sources, duplicate detection, templates, save rollback, Edit a Copy, project planning authority, reference ZIP, Project ZIP and full backup/restore hashes. Exercise the exact MIDORI four-second 9:16 floor-plan scenario in isolated Playwright storage at 1440, 768 and 390 widths, with keyboard/focus checks and before/after screenshots. Run unit tests, typecheck, build, production audit, QA ledger, browser suite and diff checks. Obtain an independent final review; publish a feature PR to master without merging.
