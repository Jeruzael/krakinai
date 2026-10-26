# Advanced Prompt Output Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development or executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Add reliable production text, derived JSON, explicit dialogue, safe formatted previews, and controlled media previews without changing existing saved output bytes or data.

**Architecture:** Pure snapshot-derived scene document drives new assembly and JSON. Output UI retains legacy saved strings and derives the JSON separately. Shared media components add opt-in preview and accessible enlargement.

**Tech Stack:** Existing React 18, TypeScript, Vite, Vitest, IndexedDB, fflate; isolated Playwright; no new application dependencies.

**Spec:** ../specs/2026-10-26-structured-output-design.md and user-provided Advanced Prompt Formatting specification.

## Global constraints

No storage clearing, schema migration, cloud/API, media filtering, identity shortening, library-based reconstruction, HTML injection or direct master push. Preserve saved strings, associations, manual outputs, stale warnings, backup semantics, exact dialogue and full specification exports. QA uses an isolated browser profile only.

## Review focus

- Legacy saved scene text and references must remain byte-identical after source edits and review uploads.
- JSON must preserve Unicode/multiline text and source overrides while excluding media bytes, temporary URLs and filesystem paths.
- Saved authoritative empty reference arrays must not be rebuilt from snapshot associations.
- Manual free-form outputs must survive mode/view switches and never be implicitly interpreted as JSON.
- Hover playback must stop on pointer exit, reduced-motion changes, unmount and media expansion; rejected playback promises must be handled.

## Tasks

### 1. Protect baseline and establish branch

- [x] Inspect requested files and verify clean master includes Studio redesign.
- [x] Fetch master and create codex/structured-json-prompt-output at 9f64d95055975278fa699c7e5840b5d34b5402ab.
- [x] Install pinned dependencies; capture legacy golden strings and isolated before screenshots at three widths.

### 2. Scene document, text assembly and dialogue (primary agent)

Files: types/domain.ts, domain/sceneDocument.ts, domain/promptAssembler.ts, screens/SceneBuilderScreen.tsx; focused serializer/repository/backup tests and fixtures.

- [x] Write failing exact-text/JSON/legacy/dialogue/override/reference tests.
- [x] Implement the pure document contract from the design, text production formatters, optional dialogue types/controls and validation.
- [x] Verify all text and dialogue persistence/backup compatibility tests.

### 3. Output workspace (independent UI task)

Files: screens/PromptOutputScreen.tsx, screens/promptOutput.css, components/FormattedPrompt.tsx, focused output tests.
Consumes: serializeSceneJson(source: SceneDocumentSource): string; optional DialogueConfig fields; existing three stored modes.

- [x] Write failing UI tests for four formats, safe formatted/raw rendering, exact copy/download, manual edit state and legacy scenes.
- [x] Implement derived JSON, format/view selectors, default modes, complete raw actions and JSON/manual edit notices.
- [x] Preserve all reference/review/save and stale warning workflows; run scoped tests.

### 4. Media previews (independent media task)

Files: components/MediaThumbnail.tsx, MediaPreviewDialog.tsx, PromptCard.tsx, ReferenceBoard.tsx, screens/PromptDetailScreen.tsx, VariantsScreen.tsx, media CSS and focused tests.

- [x] Write failing tests for eligibility, play rejection, exit/reset/unmount, images, expansion and keyboard focus.
- [x] Add optional hover behavior and shared StudioDialog-based media enlargement; keep navigation and favorite actions separate.
- [x] Verify no media/association/persistence changes and no touch/reduced-motion autoplay.

### 5. Integration, browser QA and delivery

- [x] Review integrated diff and run complete tests/typecheck/build/audit/diff checks.
- [x] Run isolated Playwright full workflow, all formats/copied/downloaded bytes, legacy scene, backup roundtrip, playable video, keyboard and three widths; capture after screenshots.
- [x] Resolve review findings, document schema/workflow/QA with before/after dialogue example, and record warnings/limitations.
- [ ] Commit only reviewed source/docs/tests, push feature branch, create/attach PR, inspect CI. Do not merge.
