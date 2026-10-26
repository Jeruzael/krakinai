# Studio workspace verification — 2026-10-25

## Scope and behavior

Scene Builder now pairs a featured reference board with seven compact recipe rows. Complete component text opens in a focus-managed dialog; character identity remains read-only in the builder. Instructions, dialogue, shot settings and external review use expandable sections. Desktop panels scroll independently with Save Draft and Assemble Prompt always available; smaller layouts stack and use normal page scrolling.

Prompt Output separates Prompt, References and Review, with Full/Structured/Compact modes and persistent copy, download and scene actions. Character and variant screens provide larger visual previews and explicit full-text disclosure. Navigation includes an optional desktop icon rail and a keyboard-contained mobile drawer.

## Directly verified boundaries

- The base is master commit `7e71a296feac860b3b65b4ff0595eb736df60e8b`.
- Storage, domain/assembler/validation, types, context, object-URL/download hooks, package.json and lockfile are unchanged from the base.
- No IndexedDB migration, dependency, backend, cloud service or application API call was added.
- Preview selection, dialogs, cancelled confirmations and output tabs leave the stored records unchanged. Assembly still performs its existing draft save before navigation.
- Reference galleries retain every association, including repeated and unavailable media. The existing export checklist and formatter remain authoritative and unchanged.
- Reference Pack Manager is a separate follow-up: future user-selected export packs must be explicit and must not mutate saved references. No export-selection or filtering behavior was introduced here.

## Automated results

All final commands exited 0, without warnings:

| Command | Result |
| --- | --- |
| `npm test` | 46 passed across nine files (27 existing and 19 new UI tests) |
| `npm run typecheck` | No TypeScript diagnostics |
| `npm run build` | Successful; 1,605 modules, 388.49 kB JS / 109.98 kB gzip |
| `npm audit --omit=dev` | Zero production dependency vulnerabilities reported |
| `git diff --check` | No whitespace diagnostics |

Focused UI coverage includes collapsed identities, scene-only editing, reference completeness/missing files, dialog focus restoration and containment, video controls, rail routes, keyboard tabs, complete copy/download text, manual edit buffers and stale warnings, review notes/results, and immutable scene saving. An independent code review identified the video-focus omission; its regression failed before the fix and passed afterward. No review findings remain outstanding.

## Browser verification

Sixteen Playwright checks passed in Chromium 145.0.7632.6 with zero console warnings, console errors, page errors or off-origin HTTP requests. Tests used fresh isolated storage and synthetic data, not an existing browser profile.

- At 1440 × 900 all seven rows and Assemble Prompt are visible; the last row ends at about 754px and the action at 855px.
- All three actual clipboard strings and downloaded UTF-8 `.txt` files match a separately served pre-redesign baseline byte for byte.
- Dialog Escape/Tab/Shift+Tab behavior, native video focus, picker labels, compatibility-confirmation cancellation and stable trigger restoration pass.
- Review uploads remain separate from seven input references; saved Full/Structured/Compact outputs remain unchanged.
- Stacked 768px and 390px layouts have no horizontal page overflow; galleries fit the viewport and mobile drawer focus/close behavior passes.

## Screenshots and scroll measurements

Captured 12 before and 12 after images: Scene Builder, Prompt Output, character details and variants at 1440px, 768px and 390px. Two additional screenshots show the icon rail and external-result review. The screenshot manifest, hashes, browser harness and complete command logs are delivered as local QA evidence in the associated chat, outside the repository.

Measured with the same seven-slot, long-identity synthetic fixture:

| Viewport width | Scene Builder before → after | Prompt Output before → after |
| --- | --- | --- |
| 1440px (900px tall) | 3,389px → 900px | 2,361px → 900px |
| 768px | 5,494px → 1,829px | 5,155px → 1,259px |
| 390px | 6,936px → 1,753px | 6,091px → 1,164px |

These are page-height measurements, not a measured task-completion-time study. Complete output and full reference galleries remain accessible inside scrollable panels or on demand.

## Remaining limitations

Browser interaction was checked in Chromium; Firefox, Safari, physical devices and an actual screen-reader audio session were not run. Accessible roles, labels and keyboard/focus behavior were verified through browser/DOM queries. Deliberately delayed concurrent writes and existing storage/backup security limitations are outside this presentation-only change. Retained media and browser storage limits continue to behave as before.
