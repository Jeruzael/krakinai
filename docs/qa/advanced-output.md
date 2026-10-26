# Advanced output QA — 2026-10-26

Base: `9f64d95055975278fa699c7e5840b5d34b5402ab` (master after the Studio Workspace merge). Feature branch: `codex/structured-json-prompt-output`.

## Directly verified source facts

- `src/domain/sceneDocument.ts` is pure and deterministic. It uses authoritative snapshots and saved reference checklists, preserves original/effective component text and source revisions, and serializes version `krakinai.scene-prompt.v1`. JSON is derived, not a mandatory fourth stored output.
- `src/domain/promptAssembler.ts` formats newly assembled Narrative, Structured and Compact text with explicit spoken-script sections; full identity and exact dialogue are not shortened. Negative text stays separate. `full`, `structured`, and `compact` remain the stored identifiers in `src/types/domain.ts`.
- `src/screens/SceneBuilderScreen.tsx` adds optional dialogue mode, language, delivery and captions; Clear Dialogue removes only dialogue. `src/screens/PromptOutputScreen.tsx` keeps Prompt/References/Review and supplies safe Formatted/Raw views, complete raw copy, selected UTF-8 downloads, and a separate full TXT specification.
- `src/components/FormattedPrompt.tsx` uses escaped React text nodes and elements, not HTML injection. `src/components/MediaThumbnail.tsx` has opt-in hover preview gated by fine pointer/hover and reduced-motion preference. `MediaPreviewDialog.tsx` reuses the existing keyboard-trapped `StudioDialog` with native video controls.
- `src/storage/db.ts`, `src/storage/backup.ts`, `src/context`, `src/hooks`, `package.json` and `package-lock.json` are unchanged. No IndexedDB migration, backend, cloud, AI call, provider integration, paid dependency, cover reassignment or reference filtering was introduced.

## Automated verification

| Command                | Exit      | Actual result                                                                                                                                                                                                          |
| ---------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`               | 1, then 0 | First attempt hit Windows EPERM on the running dev server's esbuild executable. After stopping that specific server, retry installed 189 packages and audited 190. Server restarted on the same localhost:5173 origin. |
| `npm test`             | 0         | 71 tests in 13 files; final run 14.86s, no warnings/stderr.                                                                                                                                                            |
| `npm run typecheck`    | 0         | No diagnostics.                                                                                                                                                                                                        |
| `npm run build`        | 0         | Vite 6.4.5, 1608 modules; JS 400.10 kB (113.30 kB gzip), CSS 31.50 kB (6.30 kB gzip). No build warnings.                                                                                                               |
| `npm audit --omit=dev` | 0         | Zero production dependency vulnerabilities reported.                                                                                                                                                                   |
| `git diff --check`     | 0         | No whitespace errors.                                                                                                                                                                                                  |

Install warnings: deprecated `whatwg-encoding@3.1.1`; the full development dependency graph reports six advisories (3 moderate, 1 high, 2 critical). No dependency or lockfile upgrades were included. The production-only audit is not a complete security assessment.

GitHub PR #3's Build, Typecheck & Test check passed for source commit `38860fb4c418ec8110083ac8500582e54af1c816`: [CI job](https://github.com/Jeruzael/krakinai/actions/runs/40264799694/job/121384735131). Its existing workflow reports one Node 20 action-runtime deprecation warning for checkout/setup-node v4 (GitHub forces Node 24), and one notice about ubuntu-latest moving to Ubuntu 26. The workflow is unchanged. The subsequent documentation-only commit records this evidence and completed delivery; source verification remains the same.

The new serializer tests were red before implementation. Legacy Full/Structured/Compact strings were captured from the archived base before runtime edits and committed as a synthetic golden fixture in `src/__tests__/fixtures/legacyScene.ts`. New-format goldens cover ordered sections and exact spoken-script wording. Repository/ZIP tests verify optional dialogue persistence, immutable legacy output bytes after source edits and review uploads, old optional-field compatibility, and Edit a Copy adopting the new format. UI tests verify complete JSON copy/download, escaped hostile markup, per-format unfinished edits, stale manual outputs, media play rejection/races/cleanup and modal focus.

Independent review found missing dialogue removal and three corrupted Unicode labels. Both were corrected; Clear Dialogue has a red/green regression test and the scoped re-review passed. An asynchronous test-settling warning was corrected by waiting for actual refreshed reference media URLs, without suppressing console output or changing the app's media hook.

## Browser-tested behavior

Chromium `145.0.7632.6`, new isolated contexts at `http://127.0.0.1:4180`; no user browser/profile/IndexedDB records used. Twenty checks passed, with zero console warnings, console errors, page errors or off-origin HTTP requests:

- Open a character, inspect full locked identity, select an outfit variant, and retain all seven compact recipe rows.
- Save/reload all four dialogue modes and exact multiline Taglish/Unicode words with user-selected delivery, language and captions.
- Narrative/Structured/Compact/JSON: switch Formatted/Raw; verify the exact string passed to the real native clipboard API and exact UTF-8 selected download bytes. JSON parses and contains the exact identity/dialogue and correctly typed settings.
- Export the full text specification with distinct prompt/settings/negative/reference sections.
- Keyboard tab navigation and unfinished per-format manual text survive tab/format changes; JSON explains that manual free-form text is not interpreted.
- Save/reopen a scene without adding a mandatory JSON stored field; open a legacy scene and compare all three stored text outputs byte for byte.
- Full ZIP export/validation/restore roundtrip preserves all fixture records, immutable snapshots, reference IDs, dialogue properties and SHA-256 digests of actual media blobs.
- Real synthetic WebM hover playback is muted/looped/inline; pointer exit pauses/resets; changing reduced-motion preference stops playback. Expanded native video controls permit playback and seeking, with card playback stopped.
- Image expansion, keyboard focus containment, Escape and trigger restoration work. Touch uses explicit expansion and native controls.
- At 1440x900, 768x1024 and 390x844: no horizontal page overflow, bounded prompt viewer, accessible actions; desktop primary actions remain within the viewport.

Windows native clipboard readback normalizes line endings to CRLF. The app's clipboard write argument exactly matches Raw View, and downloads preserve exact UTF-8 bytes; native clipboard content matches after platform newline normalization. This is reported separately rather than claiming byte-identical OS clipboard readback.

Earlier harness issues were resolved before the final pass: shared dependency optimization cache between archived/current Vite servers, a missing picker-tab selection in the harness, hidden-background locator handling during modals, lazy image decoding during screenshots, and reloading the touch context after programmatic fixture seeding. These did not require persistence changes.

## Screenshots and reproducibility

External evidence directory (not committed):

`C:\Users\HomePC\.codex\visualizations\2026\10\26\01a172e9-6e93-73f1-8220-ee98cad74baf\advanced-output`

It contains six before screenshots (Prompt Output and camera cards at each width), eleven after screenshots (same views, three JSON views, expanded image/video), `screenshots.json` with verified PNG dimensions/sizes/SHA-256, `qa_results.json`, raw command/browser logs, archived base, synthetic baseline fixture, and reproducible `baseline.cjs` / `browser-qa.cjs` harnesses. No user ZIP files, browser profiles, credentials, temporary helper pages, screenshots or QA runtime artifacts are staged for commit.

Run normal verification after stopping any dev server locking Windows esbuild: `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm audit --omit=dev`, `git diff --check`. The isolated browser harness uses the bundled Playwright/Chromium runtime and a synthetic WebM fixture; it never attaches to a user's profile.

## Security assumptions and remaining risks

Direct observations establish local deterministic generation, text-node rendering, metadata-only JSON, no new service integration, and unchanged storage/backup implementation. No area is labeled safe solely from function-name searches. This work is not a full security audit.

Actual external model acceptance of the custom JSON schema, speech accuracy, lip-sync and creative conflicts are not tested or guaranteed. User-entered conflicting instructions are preserved; future nonblocking conflict warnings are separate work. Real-browser testing covers Chromium with desktop/touch emulation; Firefox, Safari, physical devices and a live screen-reader audio session were not tested. IndexedDB remains scoped to each browser/profile/origin; this feature adds no cross-browser sync. Existing development dependency advisories remain outside this feature's scope.
