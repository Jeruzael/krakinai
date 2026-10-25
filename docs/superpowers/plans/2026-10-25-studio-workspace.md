# Studio Workspace Implementation Plan

> **For agentic workers:** Use the existing React screen handlers and implement the following bounded UI tasks. Track completed work here.

**Goal:** Deliver the specified visual studio without changing persistence or generated prompt content.

**Architecture:** Shared dialog and reference-board presentation components, independent screen markup, and scoped CSS. Existing repositories and assembler remain untouched.

**Tech Stack:** React 18, TypeScript, CSS variables, lucide-react, Vitest/Testing Library, external Playwright QA.

**Spec:** ../specs/2026-10-25-studio-workspace-design.md

## Global constraints

- Do not modify IndexedDB schema, persistence rules, prompt assembler logic, saved-scene immutability, or backup/restore behavior.
- No AI backend, cloud storage, API calls, paid dependencies, reference filtering, or rewritten identity prompts.
- Preserve existing routes, complete output strings, labels, media associations and actions.

## Review focus

- Very long identities must remain hidden until explicit detail disclosure.
- Missing media and multiple links to the same blob must remain representable without dropping associations.
- Closing dialogs must restore focus; keyboard users must reach every action and tab.
- Changing tabs or previewing media must not change draft/saved output bytes or reference arrays.
- Mobile navigation and actions must remain usable at 390px, with no horizontal page overflow.

## Tasks

- [x] Capture baseline screenshots of all four affected screens at 1440/768/390, with a seven-slot long-identity fixture. Keep evidence outside Git.
- [x] Add `StudioDialog.tsx` and `ReferenceBoard.tsx` with scoped `studio.css`: dialog focus/restore/Escape, featured reference, six-item strip, full gallery and accessible original-file downloads. Write and run focused component tests before implementation.
- [x] Replace Scene Builder expanded cards with seven compact rows, dialog details, native expandable instructions/dialogue/settings, separate result review, bounded desktop layout and sticky actions. Keep all handlers; add red/green builder interaction tests.
- [x] Reorganize Prompt Output into three top tabs and preserve existing handlers/mode strings/export formatter. Add output UI tests covering tabs, manual edits, references, complete copy and downloads. This screen may be implemented independently after shared interfaces are defined.
- [x] Improve character/variant pages using visual previews, concise text and explicit full-detail disclosure. Add focused UI coverage; preserve all actions and routes. This screen may be implemented independently.
- [x] Add desktop icon rail and keyboard-accessible mobile drawer behavior in AppShell; verify route labels and focus restoration.
- [x] Run full tests/typecheck/build; run browser keyboard/mobile/byte-equivalence and data-preservation checks. Capture after screenshots at all three widths, review actual screenshots and fix discovered UI defects.
- [ ] Review the complete diff and protected-file hashes; commit, push feature branch and create/attach PR with evidence and limitations. Do not merge.

## Decisions and progress

- User's detailed brief supplies the layout and scope; routine choices use existing components and palette. Implementation proceeds under the user's authorization.
- Shared interface: `StudioDialog({title, onClose, children, footer?, className?})`; `ReferenceBoard({items, mediaMap, title?, collapseThumbnails?, downloadable?})`, with `StudioReference = {key, mediaId, label, sourceTitle, role, altText?}`. The view never changes or deduplicates stored arrays.
- Main implementation owns shared components, Scene Builder, AppShell and shared CSS. Independent screen workers own their screen files, scoped CSS and tests only. Main reviews and integrates all changes.

- Verification complete: 46 tests, typecheck, build, production audit, whitespace checks, 16 Chromium browser checks; all passed. All protected source and dependency files are unchanged. Independent review is resolved. See docs/qa/studio-workspace.md.
