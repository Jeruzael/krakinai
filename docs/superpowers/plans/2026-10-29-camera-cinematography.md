# Camera & Cinematography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Expand the existing Camera category into a searchable technique explorer and optional scene-only cinematography composer without changing user assets or legacy outputs.

**Architecture:** A static versioned registry separates techniques, parameters, rigs and cross-category guidance. The composer uses existing Camera overrides plus optional versioned component metadata; legacy assembly is unchanged. A reviewed core pack installs only through an explicit idempotent add-only transaction.

**Tech Stack:** Existing React 18, TypeScript, IndexedDB, Vitest, Testing Library, Playwright and GitHub Actions; no new dependencies.

**Spec:** [Camera & Cinematography design](../../camera-cinematography-design.md).

## Global constraints

- Keep `camera` category/slot, all routes and four Shot Types.
- No automatic user database writes, migrations, preset overwrites or bulk creation before audit.
- Preserve existing identities, media, snapshots, reference packs and backup limits; Project Export stays 128 MiB.
- Raw actual-library evidence stays in ignored local QA files. All committed fixtures/screenshots are synthetic.
- No external generation backend or invented provider guarantees. No automatic merge.

## Review focus

- An existing manual override must survive composition reset byte-for-byte.
- Static camera with rack focus and staged static holds must not generate false motion-conflict warnings.
- A Camera preset changed while composing must not overwrite Lighting/Style or retain an obsolete base prompt.
- Graphic and footage workflows must not receive mandatory physical camera or lens fields.
- Interrupted or repeated pack installation must preserve existing assets and never insert ambiguous equivalents.

### Task 1: Registry, search and audit contract

Files: create `src/domain/cinematographyRegistry.ts`, `src/domain/cinematographyCatalog.ts`, `src/__tests__/cinematographyRegistry.test.ts`; keep private audit outside Git.

Interfaces: `CinematographyTechnique`, `CinematographyFamily`, `CINEMATOGRAPHY_TECHNIQUES`, `searchCinematography(query, filters)`, `getCinematographyTechnique(id)`; family/Shot Type/owner/property filters and normalized alias lookup.

- [x] Write tests for all 15 requested families/338 coverage items, unique canonical IDs/aliases, alias searches, applicability, and focus/rig/continuity ownership.
- [x] Observe missing implementation failures, implement registry with original explanations and explicit capture/editing labels, run focused tests.

### Task 2: Deterministic scene composition and metadata

Files: create `src/domain/cameraComposition.ts`, `src/__tests__/cameraComposition.test.ts`; extend `src/types/domain.ts`, `src/domain/phase4Validation.ts` and relevant snapshot/write/export boundaries.

Interfaces: versioned `CameraComposition`; `composeCameraDirections`, `applyCameraComposition`, `resetCameraComposition`, `rebaseCameraComposition`, `validateCameraComposition`, `getCameraCompositionWarnings`.

- [x] Write failing tests for fixed-order rendering, unspecified defaults, repeat application, exact reset, new preset rebase, manual override exit, optional metadata validation, and existing output hashes.
- [x] Implement scene-only built-in blueprint snapshots and preserve separate existing source prompts/overrides.
- [x] Test genuine contradictions and negative/valid cases: static versus simultaneous travel, optical/dolly difference, focus independence, compound dolly zoom, staged holds, focal endpoints, source-locked graphics and bounded motion values.
- [x] Verify metadata survives saved snapshots, JSON, project export and full-backup roundtrips without changing legacy bytes or archive limits.

### Task 3: Explorer and composer UI

Files: create `src/components/CinematographyExplorer.tsx`, `src/components/CameraComposer.tsx`, scoped styles and component tests; modify `src/screens/LibraryScreen.tsx`, `src/screens/SceneBuilderScreen.tsx`, `src/context/LibraryContext.tsx`, and shared category labels.

- [x] Write failing component tests for collapsed families, aliases/filters, original preset access, live complete preview, explicit apply/reset/cancel, keyboard and focus restoration.
- [x] Add the explorer within existing Camera browsing and the composer within existing builder dialog patterns. Keep ordinary preset selection and all original records usable.
- [x] Preserve/rebase active composition when selecting Camera assets/variants. Clear composition metadata, not authored text, when applying a manual override.
- [x] Verify independent Lighting/Style values, draft unsaved work, reference associations and source media remain unchanged.

### Task 4: Explicit core pack

Files: create `src/domain/cinematographyPresets.ts`, `src/storage/cinematographyPresets.ts`, focused storage tests; add preview/install UI to explorer.

- [x] Test stable versioned IDs, semantic duplicate/ambiguous exclusions, explicit no-write preview, atomic add-only install, repeated install and rollback.
- [x] Include only reviewed missing core concepts; never install on load or change old presets.

### Task 5: Browser regression, documentation and delivery

Files: add synthetic `e2e/cinematography.spec.mjs`, fixture and screenshot checks; update documentation/QA evidence as required by existing CI.

- [x] Capture before/after at 1440px, 768px and 390px using synthetic records only.
- [x] Test actual UI search/families/filters, compose/apply/reset/cancel, existing camera and identity preservation, source-type advice, copy/export, saved output immutability, restart and archive compatibility.
- [x] Run all unit/component/browser tests, typecheck, build, production audit, diff check and QA ledger; review actual failures and final diff.
- [x] Stage only intended source/docs/tests/synthetic screenshots. Respect configured signing; if local passphrase access is necessary, prepare the complete verified staged result before the user's signing step.
- [ ] Push only `codex/camera-cinematography`, create/attach PR, verify and link the exact GitHub Actions result. Do not merge.

## Execution ledger

- Base: `a03bd5d62bf42f55142565147bd0c0b99d2899db`; existing isolated linked worktree reused on `codex/camera-cinematography`.
- Ruling: implement the supplied cinematography addendum; the broader UI-refinement brief was not supplied. Cost if wrong: additional workspace requirements need a separate brief.
- Ruling: retain the complete actual-library inventory and coverage matrix locally, outside Git. Public documentation contains aggregates and generic catalog data. Cost if wrong: reviewers need the local report to inspect actual matching IDs and evidence.
- Tasks 1–4: registry, deterministic composition, compatibility, UI and explicit pack implemented through focused RED→GREEN tests. Original assembler, schema, archive limits and actual browser records are unchanged.
- Final review: one fresh read-only reviewer inspected the whole branch. Four Important findings: manual built-in baseline reset; missing active-draft fallback; equivalent Deep focus detection; primary/secondary movement order. Each reproduced in focused tests before correction.
- Final: fixed manual built-in reset — `restores a manually authored built-in Camera...` RED→GREEN.
- Final: fixed library-first target mismatch — `previews and updates the same fallback draft...` RED→GREEN; preview and Apply bind the same draft and Shot Type.
- Final: fixed Deep focus duplicate classification — `skips canonical and concurrent near/far sharpness...` RED→GREEN; rack-focus negative still passes.
- Final: fixed movement-role/order loss — `preserves primary/secondary movement roles...` RED→GREEN; independent dimensions retain deterministic ordering.
- Final: Ruling: treat obsolete generated-motion advice as a correctness issue in the editing workflow; it falsely described removed directions as authored constraints. Fixed with a reopened-composition RED→GREEN regression. Cost if left unfixed: misleading warnings during ordinary edits.
- Final: Ruling: finish the explicitly requested consistent UI labels despite their low severity. A separate UI mapping changes reference/template/variant/editor labels while legacy assembly labels remain byte-identical. Variant UI regression RED→GREEN. Cost if left unfixed: inconsistent names for the same Camera category.
- Final focused verification: 46 tests across composition, preview/install, integrated UI, dialogs and legacy output hashes passed after these corrections. No second reviewer was dispatched.
- Final: Ruling: the reviewer did not open private audit evidence or judge pending full-suite/CI results. The implementing agent verified the actual inventory/coverage and is responsible for final command evidence; GitHub CI can only verify the eventual signed head after push. Cost if wrong: unsupported audit or CI claims; final reporting distinguishes these evidence sources.
- The source-workflow browser test initially attempted a form fill before asynchronous Apply had closed its inert dialog. It now waits for dialog closure; three focused repetitions passed. No application behavior change was needed for this test sequencing issue.

- Final local verification: 521/521 unit/component tests; 94/94 browser cases (83 retained + 11 new); typecheck/build/production audit and all six QA-ledger tests exit 0. Eighteen synthetic before/after PNGs exist and are hashed. Staged manifest: 67 intended files, no ZIP/profile/private evidence/credential artifacts. Configured SSH signing is retained; push/PR/remote CI remain pending the signed commit.
- Signed-commit attempt reached the local SSH passphrase prompt and was cancelled; HEAD is unchanged, no index lock remains, and all 67 files stay staged. No commit, push, PR or remote CI result is claimed yet.
