# UI polish, media drop and identity clarity implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Implement the supplied UI/UX Polish brief while preserving canonical prompt output, stored records and historical snapshots.

**Architecture:** Extend the existing React controls and CSS. A reusable file drop zone delivers files to one guarded Editor upload function using the existing candidate validation and storage functions. A separate reorder handle changes only the editor's local association order until Save. Library tags use a compact, searchable dialog, with case folding confined to filtering. Wider Studio dialogs use an explicit size option. Identity controls explain existing state and continue using the existing resolver and approval functions.

**Tech stack:** Existing React, TypeScript, CSS, Vitest/Testing Library and Playwright; no added dependencies.

**Spec:** User-supplied “KRAKINAI — UI/UX Polish, Drag-and-Drop Media & Identity Anchor Clarity”, 2026-10-27.

## Global constraints

- Base: verified origin/master 82c38032cd0feff8111422f1161f792c5caf59ce; feature branch codex/uiux-polish-media-identity.
- Do not modify validation.ts, limits, IndexedDB schema/persistence rules, assembler, backup, restore, immutable snapshots or existing media.
- Synthetic browser contexts only; do not open or modify the user's actual browser profile.
- Preserve Choose Files, Move Up/Down, media roles, covers and attachment removal. No automatic identity rewriting.
- Test 1440×900, 768×1024 and 390×844. Capture before/after for editor, variant, metadata, library, takes, compare, reference manager, identity and generation controls.
- Create a PR targeting master; do not merge.

## Review focus

- Repeated and overlapping drops: serialize uploads and compare candidate bytes to attached files, including this batch.
- Dropping onto inputs or reorder handles: external files must not navigate, and reorder drags must not trigger uploads.
- Long filenames, IDs, tags and take titles: shrinkable grids and bounded dialog content without losing controls.
- Existing mixed-case tags: count each record once, preserve OR multi-selection, and never rewrite stored tags.
- Unsaved anchor edits, stale approval and saved identity: make state explicit without changing approved/current eligibility or frozen generation sources.

## Task 1 — Shared media input and ordering

- [x] Add focused tests for file drop/button delivery, invalid files, six-file limit, duplicate/overlapping drops, cover/role retention and saved order.
- [x] Run tests and confirm the missing behavior fails.
- [x] Add MediaDropZone, file byte comparison, guarded shared Editor processing, and an explicit drag reorder handle. Keep keyboard buttons and busy/error feedback.
- [x] Run focused unit and real-browser upload/persistence checks.

## Task 2 — Dialogs, takes, references and metadata

- [x] Capture baseline screenshots using synthetic records with long names at all requested viewports.
- [x] Add an explicit wide StudioDialog size; adjust thumbnail/details grids and long text containment.
- [x] Compact reference cards and action text while keeping full accessible names, selection order, downloads and historical read-only controls.
- [x] Put media names in a closed Rename / Details disclosure, retaining original read-only filename and separate metadata/association descriptions.
- [x] Test take actions, reference order/read-only/downloads, dialog focus and responsive geometry.

## Task 3 — Compact library tags

- [x] Test eight most-used unique tags, searchable expansion, selected tags outside picker, OR filtering and clear/reset behavior.
- [x] Implement a reusable tag filter with counts per record and case-insensitive UI normalization; keep search/review/sort semantics unchanged.
- [x] Verify keyboard focus and all three layouts in Playwright.

## Task 4 — Identity source clarity

- [x] Test draft/approval/stale/source revisions, explicit copy and unchanged master text/saved snapshots.
- [x] Explain Master vs Anchor, record vs identity revision, approval timestamp and source revision; preserve existing storage actions and resolver.
- [x] Run identity unit/browser checks and capture screenshots.

## Task 5 — Verification and PR

- [x] Run all tests, typecheck, build, production audit, existing and new Playwright checks; retain exact command exit codes and warnings.
- [x] Compare protected file hashes and full diff; inspect all after screenshots and fix overflow or focus issues found.
- [ ] Record measured results and limitations, commit only product/test/docs changes, push the feature branch and open/attach a PR targeting master. Delivery is tracked by the pull request and its checks. Delivery is tracked by the pull request and its checks.
