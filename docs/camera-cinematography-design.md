# Camera & Cinematography design

## Scope and evidence

Implement the supplied Comprehensive Cinematography Library addendum in the existing `camera` category and builder slot. The broader Production Workspace UI Refinement brief was not supplied; this change does not claim to implement it.

A read-only inventory of the actual browser library captured 72 Camera records on 29 October 2026 (Asia/Taipei). Two scans matched, using readonly transactions without media reads or database writes. Manual semantic review of title, positive prompt, compact text, tags, description and notes classified the 338 requested coverage items: 138 Existing, 49 Partial, 125 Missing, 26 Ambiguous. These are coverage items, including 20 movement controls, not proposed new database assets. Twenty-five ambiguous items belong to Lighting/Styles, whose actual records were outside the Camera-only inventory. The private evidence matrix and full record IDs stay in the ignored local QA directory, outside commits and the PR.

Review findings: CAM-042's Leading tag contradicts its rear-follow prompt; CAM-056/057 use a static camera base but describe temporal focus transitions despite a photo/video label; the bundled Wide Side Tracking title is medium-wide in its actual prompt. These records remain unchanged.

| Family | Items | Existing | Partial | Missing | Ambiguous |
| --- | ---: | ---: | ---: | ---: | ---: |
| A · Shot size | 13 | 8 | 2 | 3 | 0 |
| B · Angle, height, orientation | 21 | 17 | 2 | 2 | 0 |
| C · Framing and viewpoint | 24 | 14 | 5 | 5 | 0 |
| D · Composition | 30 | 16 | 1 | 13 | 0 |
| E · Movement | 47 | 34 | 4 | 9 | 0 |
| F · Motion parameters | 20 | 13 | 7 | 0 | 0 |
| G · Lens and optics | 25 | 8 | 1 | 16 | 0 |
| H · Focus | 19 | 9 | 2 | 8 | 0 |
| I · Exposure and capture | 22 | 1 | 1 | 20 | 0 |
| J · Rigs | 22 | 7 | 0 | 15 | 0 |
| K · Lighting/image look | 25 | 0 | 0 | 0 | 25 |
| L · Coverage/continuity | 18 | 5 | 9 | 4 | 0 |
| M · Specialized | 19 | 0 | 1 | 17 | 1 |
| N · Property | 21 | 6 | 14 | 1 | 0 |
| O · Source graphics | 12 | 0 | 0 | 12 | 0 |
| **Total** | **338** | **138** | **49** | **125** | **26** |

Existing motion-parameter coverage means prose coverage, not previously available structured controls. Missing source-graphic Camera assets does not mean the user's drafts lack animation instructions. The full local matrix includes actual matching asset IDs and reviewed evidence; the public report intentionally omits private prompts and records.

## Approach

A static, versioned technique registry supplies the searchable explorer and independent composer attributes. Reusable Camera records remain normal existing assets. The composer writes only a draft's ordinary scene-only Camera override, so the existing assembler consumes it without a new output mode or rewriting a preset. Optional versioned metadata in the frozen Camera component snapshot remembers controls and the exact pre-composition overrides for reset/rebase.

This avoids a new database category/store, automatic preset imports, an asset per combination, or a replacement assembler. An asset-only expansion would leave independent controls unavailable and create combinations; an assembler/schema redesign would increase compatibility risk without being necessary.

## Explorer

- Retain the Camera route and `camera` identifiers; display Camera & Cinematography consistently.
- Preserve the current preset browser, original text, search, favorites and selection behavior.
- Add collapsible technique families, canonical/alias search, Shot Type and property filters, concise explanations, ownership and applicability labels, and compatibility guidance.
- The 338-item registry distinguishes techniques from parameters, rigs, editorial/planning concepts, and cross-category Lighting/Style links. Physical capture, simulation and editing treatments have different descriptions.
- Lighting/Style links navigate to the existing owner category, never replace those scene selections. Coverage/continuity stays planning guidance rather than camera-body motion.
- Optional source references explain the technical basis; no provider capabilities or physical camera control are claimed.

## Scene composer

Use the existing dialog components and compact recipe layout. Independent controls cover shot size, physical height, viewing angle, framing, lens, focus, composition, movement, and optional movement/capture descriptors. All start as Unspecified. Show the complete assembled Camera text live, with the original preset and any prior manual override accessible separately.

The Camera snapshot gains optional `cameraComposition` metadata with `version: 1`, selected canonical technique IDs, motion/capture values, phase arrangement and the exact pre-composition override values. Render independent dimensions in a fixed order, retaining primary/secondary movement order and roles within the movement dimension. There are no random IDs/dates in direction text. Reapplying regenerates from the baseline rather than appending twice. Reset removes only the composition and restores the prior override exactly.

When no preset is selected, use a scene-only snapshot from the versioned built-in composer blueprint, identified explicitly as `builtin:camera-composition:v1` with template provenance. This is not a stored library asset or database template. Reset removes that scene-only snapshot. Its optional metadata and ordinary override text use the same backup/export path as other template-derived snapshots. No identity or source-media association is inferred.

Selecting a new Camera preset while composition is active rebases the scene attributes onto the new frozen snapshot. Manually editing the Camera override exits structured composition while preserving the authored text. Removing the camera removes its scene composition; other slots and reference associations remain intact.

Graphic/footage filters recommend source-preserving editing descriptions, not physical camera requirements. Existing freeform presets remain available. Switching Shot Type preserves existing authored selections; incompatible structured choices are explained for review rather than silently rewriting frozen or authored text. A flat floor-plan image is not treated as a modeled environment. A 2D crop does not acquire physical dolly parallax. Four existing Shot Types and Source Media validation remain unchanged.

## Advice and installation

Warnings are advisory and explain their evidence. Distinguish camera position from aim, static body from focus pull, optical zoom from travel, lens from sensor format, rigs from motion, and static holds from travel phases. Allow dolly zoom, deliberate compound movement, and staged transitions. Do not infer impossible physical speeds without actual distance/duration evidence. Existing Preflight findings and blocking source checks remain intact.

A small versioned core pack addresses reviewed gaps only. Installation is an explicit preview/confirm action and rechecks current Camera content, IDs and aliases; existing or ambiguous equivalents are skipped, never overwritten. Use atomic add-only writes and stable versioned IDs. Nothing installs on startup, opening the explorer, or loading a backup.

## Compatibility boundaries

- No IndexedDB version/store or data migration, no rewrite/backfill of old records.
- Optional metadata is validated for type, version, bounds, known IDs and slot ownership at write/import boundaries. Unknown future versions fail with an actionable message rather than being rewritten.
- Existing snapshots, output strings, manual overrides, identities, media, reference packs and archives remain unchanged when composition is absent.
- Project JSON, Generation JSON, Narrative/Structured/Compact, project export and full backup must roundtrip new snapshots and retain legacy output hashes. No archive limits, Project Export 128 MiB limit, or ZIP64 restore gate changes.
- No cloud storage, API calls, backend, paid dependency or actual user data in tests/CI/screenshots. User's separate validation.ts work remains untouched.

## Verification and delivery

Test registry IDs/aliases/search and all requested coverage areas; deterministic composition/reset/rebase/manual overrides; positive and negative advice; source Shot Types; explicit idempotent installs and rollback; legacy snapshot/output bytes; backup/project/JSON roundtrips. Browser tests cover search/families/filters, composer dialogs, keyboard/focus, copy/export, and desktop/tablet/mobile layouts in isolated synthetic profiles. Run full tests, typecheck, build, production audit, QA ledger and CI. Publish a feature PR with synthetic screenshots and actual test/run links; never merge automatically.

## Technical references

- [Sony: depth of field](https://www.sony.com/electronics/support/a-mount-body-dslr-a900-series/dslr-a900/articles/00031291).
- [Cooke Optics: focus distance, aperture, focal length and format](https://cookeoptics.com/news-and-events/how-cookes-s8-i-ff-lenses-support-the-modern-cinematography-aesthetic/).
- [RED: shutter speed, shutter angle and exposure conversion](https://docs.red.com/955-0190_v1.4/955-0190_v1.4.1_REV-1.1_RED_PS_KOMODO_Operation_Guide/Content/4_Menus/Image_LUT/Shutter.htm).
