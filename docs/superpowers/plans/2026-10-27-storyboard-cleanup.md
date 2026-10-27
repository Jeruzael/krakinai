# Storyboard cleanup and collection video previews

**Goal:** Implement the supplied Storyboard UI Cleanup & Hover-to-Play Videos brief on a feature branch from master `7d91096`, using synthetic browser fixtures only.

**Architecture:** Keep continuity writes, Preflight rules and media ownership unchanged. Use dedicated vertical form styles, expandable evidence, a keyboard accessible secondary action disclosure, and the existing MediaThumbnail / MediaPreviewDialog playback path. Keep Open separate from Preview.

**Constraints:** No schema, storage limits, backup/restore, assembler, immutable outputs, character identity or reference association changes. No new dependencies. Preserve the separate validation.ts changes. PR targets master; no merge.

**Design decisions:** Native details/summary controls provide evidence and action disclosures; only one source selector plus View and Edit actions per finding. A collection media wrapper adds an explicit Preview button, including touch and reduced motion. Pause offscreen/hidden previews and use one active hover player across thumbnails. Shot dragging uses a dedicated grip so media and controls cannot initiate ordering.

## Tasks

- [x] 1. Capture baseline tests and before screenshots at 1440×900, 768×1024 and 390×844. Synthetic fixture includes Aya Santos, speaker Joy, long wardrobe text and 11 real video-backed shots. Record hashes of all stores/media before interactions.
- [x] 2. Add failing continuity form/disclosure tests, implement vertical full-width wardrobe/transition/frame fields and compact wardrobe summaries, then run focused tests.
- [x] 3. Add failing Preflight expansion/source/action tests and actual Aya/Joy regression. Implement compact severity-grouped cards with exact evidence and suggested actions in details. Preserve saved-scene edit-copy semantics and blockers.
- [x] 4. Add failing collection/playback tests. Implement explicit Preview actions for cover/storyboard/results, primary Open/Manage Takes, secondary action disclosure, dedicated drag grip and guarded existing thumbnail playback. Test cancellation of pending playback, reduced motion, touch, decode failure, exit/reset, visibility/unmount cleanup and one hover player.
- [x] 5. Run synthetic real Chromium browser checks, actual decoded media, 11-shot playback, keyboard/order/menu/dialog/focus behavior, long evidence, narrow/zoomed layouts, and persisted snapshot/blob SHA equality. Capture after screenshots and inspect them.
- [ ] 6. Run unit tests, QA ledger, typecheck, build, production audit and full Playwright; review the complete diff and protected paths; document exact results, warnings and limitations. Push only the feature branch, open PR, attach it, and verify exact-head GitHub Actions.

## Review focus

- Late play() completion after exit/unmount or a different hover must not revive playback.
- Hidden details descendants must not enter the dialog tab loop; Escape/focus restoration must work.
- Long unbroken source IDs, shot titles and evidence must wrap without horizontal overflow, including a 720px effective desktop zoom viewport.
- Media/preview interactions must not begin drag or navigate; all ordering remains accessible by keyboard.
- Viewing/reviewing UI must leave all saved scenes, prompt outputs, identity records, references and original media bytes unchanged.

## Evidence ledger

- Dedicated branch: codex/storyboard-cleanup-hover-video. Existing isolated worktree reused; actual localhost:5173 browser library is outside test scope.
- Ruling: the detailed user brief authorizes implementation and PR creation; proceed inline without an additional design approval round. Reuse existing native controls and media APIs to limit changes.
- Ruling: retain all QA files/profiles unless explicitly authorized for deletion; historical deletion restrictions take precedence over skill cleanup defaults.

- Tasks 1–5: complete. Baseline 329/329; final unit 337/337; browser 31/31; ledger 3/3; typecheck/build/audit exit 0. Independent source review: no confirmed findings. Final CI/PR verification remains in Task 6.
