# Scene Output Workspace Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement the tasks in this session. Steps use checkbox syntax for tracking.

**Goal:** Implement both approved output layouts and a shared full-prompt dialog while preserving existing output bytes and workflows.

**Architecture:** PromptOutputScreen remains the source of activeText and canonical actions. New presentation components share those handlers. A deterministic text index supplies anchors without reconstructing output.

**Tech Stack:** Existing React 18, TypeScript, CSS tokens, StudioDialog, MediaThumbnail, Vitest and Playwright; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-28-scene-output-design.md`, implementing the user's detailed Scene Output Workspace Redesign brief.

## Global Constraints

- Target master; isolated `codex/scene-output-workspace`; never merge automatically.
- Preserve prompt assembler, serializers, identity behavior, stored scene strings and reference associations.
- Preserve IndexedDB schema, limits, backups, Project Export and PR #12 separation.
- Never clear or modify the user's actual browser data; synthetic test contexts only.
- Test 1440×900, 768×1024, 390×844 and effective 200% reflow.

## Review Focus

- Long Unicode prose with heading-like words must remain complete and must not acquire invented metadata.
- Unsaved/stale manual edits must not be silently represented as copied edits.
- Nested stale confirmations must remain operable when copy starts in the prompt dialog.
- Missing media and repeated reference associations must preserve truthful labels and all associations.
- Layout/format changes and dialog closure must retain selection, focus and immutable records.

### Task 1: Baseline and shared viewer

**Files:** `src/domain/promptSections.ts`, `src/components/ScenePromptViewerDialog.tsx`, `src/components/FormattedPrompt.tsx`, `src/components/StudioDialog.tsx`, matching component/unit tests, synthetic output fixture and screenshots.

**Interfaces:** `indexPromptSections(text: string): PromptSection[]`, each with id/title/lineIndex/start/end. Viewer consumes exact text, format/title, canonical copy/download callbacks, optional initial section and return-focus ref.

- [x] Capture baseline unit results and output screenshots before screen changes.
- [x] Write and run failing tests for deterministic section boundaries, exact raw text, open/close/focus restoration, empty/long/JSON fallback and navigation without regeneration.
- [x] Implement the minimal index and shared dialog with one prompt scroll region; add optional formatted anchors and return-focus target.
- [x] Run focused tests and record results.

### Task 2: Shared layouts and integration

**Files:** `src/components/SceneOutputWorkspace.tsx`, `src/screens/PromptOutputScreen.tsx`, `src/screens/promptOutput.css`, component/integration tests.

**Interfaces:** Workspace receives layout choice and shared React content; all output calculation and handlers remain in the screen. Both layouts invoke the Task 1 viewer with identical activeText.

- [x] Write and run failing tests for no inline prompt, layout switching, section entry, format/workflow preservation, truthful/missing visuals and unsaved-editor labeling.
- [x] Implement Split View and Studio Tabs, responsive defaults, compact shared actions and Advanced Options.
- [x] Preserve stale confirmation/reset/manual save, preflight, reference/review and project/collection actions.
- [x] Update existing tests to open the explicit viewer where the UI moved; retain their data-integrity assertions.
- [x] Run focused tests and the full unit suite.

### Task 3: Browser integrity and visual QA

**Files:** `e2e/output-workspace*.mjs`, affected existing output browser checks, `docs/scene-output-workspace-qa.md`.

- [x] Assert actual clipboard/download UTF-8 against baseline text for five formats and three provider exports, unusual whitespace and Tagalog/Unicode.
- [x] Test modal focus/Escape/scroll lock, initial and clicked section positions, keyboard tabs, empty/long/JSON output, stale confirmation and saved-scene immutability.
- [x] Capture and inspect before/after screenshots for both layouts and all required states and widths; test 720×450 reflow.
- [x] Run full unit/browser suites, typecheck, build, production audit and QA ledger; record exact results and warnings.

### Task 4: Review and PR

- [x] Review the complete scoped diff and address material findings with focused regression tests.
- [x] Confirm protected domain/storage files and original working trees are unchanged; exclude profiles, ZIPs and temporary artifacts.
- [ ] Prepare signed commit(s), push only the feature branch, create and attach PR targeting master, and record GitHub Actions results.
- [ ] Report PR/head SHA, changed files, screenshots, byte-integrity/accessibility evidence and limitations; do not merge.

Local implementation and QA are complete. Publication and remote CI status are recorded in the PR checks and final handoff, after this pre-publication checklist.
