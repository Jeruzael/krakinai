# Dialogue presets and collection cover picker

**Goal:** Implement the supplied brief on `codex/dialogue-presets-cover-picker`, from master `59c5a37b94c5a54553d6e2ddc86866958b34dbae`, and create an unmerged PR with CI evidence.

**Architecture:** Add optional versioned `dialogue.performanceDirection` selection metadata; retain `deliveryNotes` as fully editable custom text. One deterministic effective-delivery helper feeds canonical documents, generation exports and Project Script. Legacy strings and immutable saved outputs stay unchanged. Cover picker remains a staged editor using existing media storage and reference IDs.

**Decisions:** Canonical preset order; no default style/pace/gesture; only direct opposite pairs (calm/angry, sad/happy, nervous/confident) are incompatible and are explained, never silently swapped. Cover selection is local until Use Cover, then staged until Save Project/Save Changes. Cancel/Escape discard picker selection. Uploads store media immediately and remain available in All Images on cancellation. Covers grouping uses explicit collection cover IDs plus current-session uploads, without filename inference. Gallery pages contain at most 24 images.

**Constraints:** No IndexedDB schema change, media-limit change, ZIP architecture rewrite, provider integration, identity rewrite, immutable historical-output change, or automatic merge. Leave the user's separate `src/domain/validation.ts` unchanged; place new optional-field validation in a dedicated helper shared by assembly/storage/backup record validation. No new dependencies or personal browser data.

## Tasks

- [x] 1. Baseline tests; add failing delivery/output/backup tests. Add `dialoguePerformance.ts`, optional types, shared formatter and validation; update sceneDocument, promptAssembler, projectContinuity and record validation. Deep-copy optional nested dialogue metadata on saves/copies. Verify legacy output bytes and backup roundtrips.
- [x] 2. Add failing component tests; build Performance Direction controls with removable compatible checkboxes, optional pace/gesture selects, editable Custom Notes and exact effective preview. Wire SceneBuilder autosave without altering spoken text.
- [x] 3. Add failing cover-context and picker tests; implement relationship-only project image filtering, search, Project Media / All Images / Covers tabs, bounded gallery, accessible filenames and staged confirmation. Wire CollectionWorkspace and both CollectionsScreen paths, using existing validation/upload APIs.
- [x] 4. Synthetic Chromium checks at 1440×900, 768×1024, 390×844: exact Taglish text, output parity, draft reload, legacy/frozen data, cover search/filter/Unicode/missing media/upload/cancel/save, keyboard/focus/overflow. Capture screenshots with before/after evidence where useful.
- [x] 5. Run full tests, ledger, typecheck, build, production audit, full browser suite and independent review. Document exact counts/warnings, changed files, optional-field compatibility and remaining limitations. Signed commit, feature push/PR and exact-head remote CI are tracked by the subsequent PR handoff; preserve profiles and all user files.

## Review focus

- No inference from legacy text, no preset defaults, no silent removal of incompatible choices.
- Effective delivery appears once per output while exact spoken text and legacy strings stay byte-for-byte intact.
- Malformed optional metadata cannot replace existing data on restore; valid old backups remain valid.
- Picker cancellation never changes the parent selection or stored collection; uploads are retained without changing existing associations.
- Long Unicode filenames, empty/missing project images, large galleries and asynchronous upload failure preserve keyboard/focus access and bounded rendering.

## Ledger

- Detailed user brief authorizes implementation/PR; proceed inline with documented choices. Existing isolated worktree reused, previous branch/work retained.
- Preserve Git SSH signing configuration; if the signer needs its passphrase, the user must enter it locally, never in chat. Keep QA/profile artifacts unless deletion is explicitly authorized.

- Local final gates: 364 unit/component tests, 39 browser tests, 3 ledger tests, typecheck/build/audit/diff check all exit 0. Independent review: no actionable findings; 27 focused tests passed. Eighteen screenshot hashes verified. Signed commit, PR and exact-head remote CI remain pending.
