# Context-aware Shot Types implementation plan

Spec: `docs/superpowers/specs/2026-10-28-shot-types-design.md` and the supplied MIDORI brief.

## Invariants and review focus

- Missing metadata and explicit Character Scene preserve legacy text bytes; no automatic record backfill.
- Source media is original input, never a result; IDs/filenames/bytes survive all export and restore paths.
- Inactive selections are retained in drafts but excluded from prompts, negatives, identity choices, packs and exports.
- Wrong/missing stored source files and failed saves cannot create partial immutable scenes or storyboard membership.
- Saved-take Shot Type is authoritative over optional planning metadata; no conflicting requirements from templates.

## Tasks

- [x] Baseline: clean master branch, full unit run, freeze legacy export fixtures and before screenshots.
- [x] Shared contract: optional `ShotType`/source fields in `types/domain.ts`; `resolveShotType`, `getShotTypeRules`, `getActiveSceneSlots`, `getActiveSourceMediaLinks`, `getActiveReferencePack`, `validateShotSourceMedia` in `domain/shotTypeRules.ts`. Write rule tests, observe failures, implement and rerun.
- [x] Assembly: use rules in assembler and Preflight; extend Scene/Generation document and provider views for new types only. Tests pin exact legacy outputs, graphic instructions/source fidelity, voiceover/on-camera and inactive negatives/references.
- [x] Persistence and exports: draft/save/copy/template paths; duplicates; media reachability; reference pack; backup metadata validation; project ZIP metadata and original media. Focused storage/roundtrip/rollback tests first. No schema/store/limit changes.
- [x] UI: Shot Type directly below title, current requirements/counts, inactive rows, source upload/existing picker/original preview/remove/replace, instruction labels, templates and planned storyboard metadata/mismatch. Focused component tests first.
- [x] Integration: isolated MIDORI Playwright scenario including file hashes through reference/project/full backups, before/after captures at required widths, legacy fixtures, keyboard/focus and regression suite.
- [x] Verification: all tests, typecheck, build, audit, QA ledger, browser suite, diff checks; independent review; accurate machine evidence and changed-file list.
- [ ] Publication: user-configured signed commit, push feature branch, PR to master, successful CI link; do not merge or touch actual browser data.

## Shared interfaces

`ShotType = character_scene | property_environment | graphic_motion | existing_footage`.
SceneDraft/SavedScene: optional `shotType?: ShotType`, `sourceMediaLinks?: MediaLink[]`.
Template: optional `shotType?: ShotType`; ProjectShot: optional `plannedShotType?: ShotType`.
`getShotTypeRules(source)` returns `shotType`, `requiredSlots`, `optionalSlots`, `inapplicableSlots`, `sourceKind`, `requiresInstructions`, `instructionLabel`, `allowsAudioOnlyWithoutCharacter`, `preflightRules`.
`getActiveSceneSlots(source)` and `getActiveSourceMediaLinks(source)` return filtered values without mutation. `getActiveReferencePack(source)` returns a filtered optional pack. `validateShotSourceMedia(source, mediaMap?)` returns string errors; map validation includes stored MIME/blob existence. Assembly validates declared links; save and Preflight additionally validate against current media storage.

Implementation ownership is split after this shared contract exists: parent owns types/rules/assembly/serialization/Preflight, one focused agent owns persistence/export data paths, and one owns builder/template/storyboard UI. They must not edit each other's files. Integrate before running the full suites. The dispatching-parallel-agents skill supplies this scoped delegation workflow.

Verification completed locally: 461 unit tests, 79 browser tests, typecheck/build, production audit, 6 QA script checks. Independent review findings were fixed with failing-then-passing regressions and checked again. Publication/signing/hosted CI remain tracked by the final delivery.
