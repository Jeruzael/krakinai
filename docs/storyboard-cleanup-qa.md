# Storyboard cleanup and collection previews — QA

Base: master `7d91096e2da730a4477359567557d2350217d8da` (PR #18 merged). Branch: `codex/storyboard-cleanup-hover-video`. Target: master; no automatic merge.

[Machine-readable results](qa/storyboard-cleanup/qa_results.json) include command exits, every browser case, synthetic media SHA-256, preservation proof, tested source hashes and all 30 screenshot hashes/dimensions. The [before/after gallery](qa/storyboard-cleanup/README.md) contains five views at 1440×900, 768×1024 and 390×844 on each side, totaling 2,495,132 bytes. Baseline images came from an unmodified `git archive` of the base, served on a separate local port with the same synthetic fixture.

## Directly verified source facts

- [ProjectContinuityPanel](../src/components/ProjectContinuityPanel.tsx) uses dedicated `.pc-form` / `.pc-form-field` containers for wardrobe, transition and frame selection controls. Labels stack above full-width inputs. The existing StudioDialog keeps Cancel/Save outside its scrolling body. Wardrobe summaries show character, shot, source and status; complete descriptions, source IDs and notes remain accessible under Details. Transitions have compact metadata with full text under Transition details. Existing storage actions and explicit changed-field patches remain in use.
- [ScenePreflightDialog](../src/components/ScenePreflightDialog.tsx) groups findings by severity, presents compact cards, and starts exact evidence/suggestions collapsed. A source selector replaces repeated pairs of buttons with View Source and Edit Component / Edit a Copy. Blocking findings cannot be acknowledged. Other acknowledgement remains local and does not remove findings. Preflight rules are unchanged, including P005 for Aya Santos with speaker Joy.
- [CollectionWorkspace](../src/screens/CollectionWorkspace.tsx) keeps Open and Manage Takes visible. [ShotActions](../src/components/ShotActions.tsx) contains Edit, New Take/Create Prompt, Move Up/Down, Insert Before/After and Remove in a native disclosure. Escape closes it and returns focus. Remove still requires confirmation. A dedicated draggable grip keeps video and editing interactions separate from ordering; keyboard ordering remains available.
- [CollectionMediaPreview](../src/components/CollectionMediaPreview.tsx) uses the existing MediaThumbnail and MediaPreviewDialog for storyboard images, project covers, overview covers and results. A visible Preview works for mouse, keyboard and touch. It never navigates. The thumbnail unmounts during enlargement, releasing its decoder. Enlarged native controls start muted, play inline and require explicit playback.
- [MediaThumbnail](../src/components/MediaThumbnail.tsx) retains fine-pointer/non-reduced-motion hover gating, muted looping inline video and metadata preloading. It resets on exit, pauses on hidden/offscreen state and unmount, and coordinates one active hover player. Rejected play promises and decode errors remain recoverable. Images never become autoplay videos. [useObjectUrl](../src/hooks/useObjectUrl.ts) is unchanged; object URLs are revoked on unmount.

The complete `src/domain`, `src/storage`, `src/types`, `useObjectUrl.ts`, `package.json` and lockfile are unchanged against the base. Protected `validation.ts` SHA-256: `50660f5c044585676932402583c25e8b52ece28af04a714cc909898cc1970fae`. Schema, storage limits, full ZIP backup/restore, separate 128 MiB Project Export, assembler, immutable outputs, identity records and reference associations receive no implementation changes.

## Automated results

Local Windows Node v22.23.3 / npm 10.9.9:

| Command | Actual result | Exit |
|---|---|---:|
| `npm test` | 337/337, 50 files; baseline 329/329 | 0 |
| `npm run typecheck` | No diagnostics | 0 |
| `npm run build` | Built successfully; no warnings | 0 |
| `npm audit --omit=dev` | 0 vulnerabilities | 0 |
| `npm run test:qa` | 3/3 tests; existing historical ledger valid: 207 counted checks, 45 screenshots | 0 |
| `npm run test:e2e` | 31/31 Chromium tests; 0 skipped, failed or flaky | 0 |
| Before screenshot capture | 3/3 size cases | 0 |
| After screenshot recapture | 3/3 size cases | 0 |
| `git status --short`, `git diff --name-status`, `git diff --check` | Executed; whitespace check clean | 0 |

The historical ledger's 207 checks are separate from this PR's 31 Playwright tests; the counts are not added together. Production bundles: main JS 496.76 kB / gzip 144.73 kB; collection JS 81.73 kB / gzip 22.87 kB.

Warnings are retained: final unit output has 34 React `act(...)` warnings (33 MediaThumbnail, one EditorScreen). The full browser run has two runner `NO_COLOR`/`FORCE_COLOR` warnings. Typecheck, build, audit and QA-ledger commands report no warnings. Passing results do not mean warning-free tests.

## Browser-tested behavior

All cases use isolated Playwright contexts and synthetic IndexedDB on `127.0.0.1:4173` (baseline captures on 4174). The user's localhost:5173 browser/profile was never opened, cleared or modified.

- Eleven video-backed shots reuse one real, decodable synthetic 320×180 WebM, 27,354 bytes in the full local run, SHA-256 `032574a2473dd470180f4854fbab11d6d69b1986b6b2075566997a9e2525be2c`. All eleven start on hover, stay muted/looped/inline, and pause/reset on exit. At most one hover player is active. Workspace/overview covers and result previews use the same path.
- Touch emulation and reduced motion disable hover autoplay and retain a visible Preview with native controls. Playing or previewing never navigates or starts shot dragging. The dedicated grip and keyboard Move Up restore the original canonical order.
- Preview Escape restores trigger focus. Wardrobe/transition Escape preserves stored data and restores focus. Footers stay reachable at all requested sizes and a 720×450 effective zoom/reflow viewport. Unbroken 100-character shot titles and long evidence wrap without horizontal document/dialog scrolling.
- P001, informational P004 and genuine P005 Aya/Joy remain present. Every expanded evidence block equals the exact source string. Source selection/View Source works; Edit a Copy creates a new draft with saved scenes untouched. Unit tests preserve blockers and local acknowledgement.
- Rejected playback and corrupted WebM remain recoverable with no uncaught page errors. Navigation unmounts the active thumbnail, pauses/resets it and revokes its URL.
- The browsing/preview flow compares all eight snapshot sections and original media SHA-256 before/after and after reload. Explicit wardrobe/transition review changes only project metadata; other stores, frozen prompts, identities, scenes and media remain equal. Existing legacy backup, canonical copy, reference-pack, identity and media-upload regressions also pass in the full suite.

The initial 11-shot test found a stale IntersectionObserver value blocking playback after scrolling. A failing unit regression and real eleven-shot run passed after removing that stale pointer-entry gate while retaining offscreen pause. Long-title checks found transition-caption overflow; wrapping fixed all four sizes. Preliminary harness issues (image-only cover validation, explicit duplicate-take setup, incorrect output route, overly exact select-label lookup) were corrected in synthetic fixtures/selectors without relaxing production validation. All final cases pass.

## Review and assumptions

An independent reviewer inspected the settled diff and protected-path hashes and found no confirmed defects. That was read-only source review, separate from the author's browser evidence. Layout, keyboard and data-preservation assertions support the claims above; a search for function names is not a security assessment. There is no new security boundary or external service.

Only intended UI source, tests, documentation and synthetic screenshots are committed. Actual browser data, profiles, backup ZIPs, generated test media and temporary QA logs/archives remain outside the staged file set. Existing user files and QA files are retained; no disposable profile deletion was attempted.

## Remaining limitations

- Automated Chromium is verified. Manual Firefox/Safari, NVDA/JAWS, Windows Explorer drag and browser-toolbar zoom sessions were not performed.
- The 720×450 case checks desktop reflow at an effective 200% viewport; it is not a manual browser-toolbar zoom action.
- Eleven small video-backed shots establish interaction correctness, not high-resolution decoder memory or a large-library performance ceiling.
- Cover writes still accept images only. Existing video-cover compatibility uses a synthetic historical fixture without changing those write rules.
- Autoplay remains subject to browser/codec policy; explicit Preview and decode-error feedback remain available.

GitHub CI is separate from these local results. The PR Checks tab and final handoff identify the Actions run and tested head SHA. No merge is performed.
