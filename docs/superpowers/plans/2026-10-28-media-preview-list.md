# Media preview and Storyboard List implementation plan

**Goal:** Deliver independently mergeable PR A against master, retaining all storage and immutable output behavior.
**Spec:** User's Advanced Performance Studio, Media Previews & Storyboard List Fix brief (2026-10-28), PR A sections A1–A4.
**Architecture:** Reuse MediaThumbnail's coordinated hover player and MediaPreviewDialog's explicit native controls. Add fit-relative image zoom to MediaThumbnail only when requested by the shared dialog; no second video implementation. Suspend parent modal while opening nested preview and restore the exact trigger after remount, avoiding two competing focus traps. Gallery pages bound associations without deduplicating them. List mode uses a dedicated media/details inner row; Grid appearance stays unchanged.
**Tech stack:** Existing React/TypeScript/CSS, Vitest and Playwright; no dependencies.

## Rulings and safeguards

- The supplied detailed design authorizes implementation; settle routine fit/zoom/UI choices without a new approval flow. Fit never enlarges beyond source dimensions; 100–400% zoom is relative to fit, with visible scaling information and a native-size action. Panning uses bounded native scrolling.
- Reuse current clean isolated worktree on `codex/media-preview-storyboard-list`; base is latest master after PR20 merged. PR B proceeds independently in a separate worktree.
- Asset and variant cards retain explicit Select; Preview never selects or writes. Missing media disables preview. Reference associations retain their unique keys and role labels even for repeated media IDs. Render at most 12 gallery associations per page.
- Preserve schema, media limits, backup/export architecture, protected validation.ts, all reference ownership and original filenames. Never open the actual localhost:5173 browser profile. No QA files/profile deletion.
- SSH signing remains enabled; prepare reviewed staged changes before requesting local key access if required.

## Tasks

- [x] Add failing zoom, asset/variant selection-independence and gallery pagination/focus tests. Capture baseline List screenshots with 11 real synthetic video shots at requested widths.
- [x] Implement shared image fit/zoom/actual-size controls, native explicit video playback, aligned picker cards with hover/Preview, paginated reference association previews and trigger restoration.
- [x] Add dedicated shot media/details inner row and bounded desktop media column, mobile stacking, long Unicode wrapping, unchanged Grid spacing/actions.
- [x] Exercise real synthetic video hover/exit, single player, reduced motion, touch Preview, image zoom/scroll/reset, native video controls/seek, repeated open/close URLs, selection independence, layouts/200% reflow, frozen-data/hash preservation. Capture after screenshots.
- [x] Run full tests/typecheck/build/audit/ledger/browser suite, independent source review, QA report/JSON with all source/screenshot hashes and complete changed files. Signed commit, feature push, PR and exact-head CI are tracked in the handoff.

Final local gates: 367/56 unit files, 51 Playwright cases, typecheck/build/audit/ledger/diff pass. Independent focus finding fixed and verified. Resource cycles alternate six images/six videos; URL count2to2 and detached players paused/reset. Synthetic artifacts preserved. Signed commit/PR/CI tracked in final handoff.
