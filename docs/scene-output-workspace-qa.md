# Scene Output workspace QA

Baseline: `master` `10aaa84877c4b182c42ef3fd395173dbaa823223`. Feature branch: `codex/scene-output-workspace`.

The ordinary output workspace contains configuration, real associated media and a concise summary. Show Prompt opens the complete selected output in one shared dialog. Split View and Studio Tabs share the original canonical handlers. Long identity text stays out of the normal workspace.

## Directly verified source facts

- Existing assembler, serializers, identity rules, storage code, schema, limits, backups, Project Export, dependency manifest and lockfile match the baseline Git blobs. The machine report lists 33 protected files and their hashes.
- The entire canonical output/save/review/reference handler block in `src/screens/PromptOutputScreen.tsx` matches the baseline text exactly. Presentation code receives `activeText` and invokes those handlers.
- New indexing lives in `src/domain/promptSections.ts`; it recognizes explicit known headings and uses Full Prompt for unstructured text/JSON. It does not rewrite output.
- `src/components/ScenePromptViewerDialog.tsx` reuses `StudioDialog`. `FormattedPrompt` adds optional anchors; `GenerationIdentityControl` adds optional compact help. Their existing consumers retain their defaults.
- `src/components/SceneOutputWorkspace.tsx` contains the two presentation layouts and actual associated-media previews, including captured reference-pack associations. Layout and preview selection remain session UI state.
- This task used isolated synthetic contexts and did not operate the user's actual KRAKINAI browser profile. No schema/data migration or new runtime dependency is included. PR #12 remains separate.

## Automated results

| Command | Result | Exit code |
| --- | --- | --- |
| `npm test -- --maxWorkers=2 --minWorkers=1` | **409 passed**, 61 files; 0 failures/skips | 0 |
| `npm run typecheck` | Passed | 0 |
| `npm run build` | Passed | 0 |
| `npm audit --omit=dev` | 0 vulnerabilities | 0 |
| `npm run test:e2e` | **72 passed**, 0 failures/flaky/skips | 0 |
| `npm run test:qa` | 3 reconciliation tests; historical ledger 207 checks / 45 screenshots | 0 |

The historical ledger is a separate evidence set from this branch's 72 Playwright test cases. The new output-specific browser files contain 15 cases, including screenshots. Four integrity cases each exercise eight output selections, for **32 byte-integrity iterations**.

Actual machine evidence: [results and hashes](qa/scene-output-workspace-results.json). Local raw reports/logs remain under `qa-results/` and are excluded from the commit. GitHub Actions for the pushed commit is reported separately in PR checks and the final delivery.

## Output integrity

The frozen synthetic baseline was captured before UI implementation from the verified master revision. Tests compare Narrative, Structured, Compact, Project JSON, Generation JSON, Generic Structured, Gemini Omni Flash and Custom in both layouts, for drafts and saved scenes.

Each iteration checks the full Raw string, the exact Clipboard API payload and the bytes read from an actual selected download. Full Specification downloads are compared independently with the frozen baseline. The machine report contains expected/download/clipboard/specification SHA-256 values. Unicode, Tagalog/English dialogue, unusual spacing and line breaks are retained. New tests capture clipboard arguments without writing the OS clipboard; the inherited clipboard smoke also reads the browser clipboard and accounts for Windows LF/CRLF normalization.

UI navigation leaves stored scenes, identities, associations and media hashes unchanged in the synthetic fixtures. Separate tests cover legacy output strings, manual buffers, save/reset/stale confirmation, blocked clipboard fallback, duplicate decisions, save/new-take, Edit a Copy, collection return, reference packs and review/results. No external generator was called.

## Browser-tested behavior

- Both layout choices, responsive defaults, remembered manual layout/visual choices, inner and outer keyboard tabs.
- Complete Formatted/Raw content, conservative section links, JSON fallback, empty output and a roughly 60,000-character prompt.
- Focus enters/traps in the dialog, Escape closes it, closing returns to Show Prompt, background scrolling is locked, Raw keyboard Select All scopes selection to the prompt.
- Actual reference/sample images and an independently decodable synthetic result video; explicit image/player previews; truthful missing-media state.
- A stale copy started inside the viewer opens one operable confirmation. Unsaved editor text remains separate from saved output; opening the editor focuses it.
- 1440×900, 768×1024 and 390×844 layouts, plus 720×450 CSS reflow equivalent to 200% at 1440×900.
- Review found a desktop grid sizing defect at 1366×768 that could hide final text/late navigation behind the footer. The new laptop regression failed before the fix and passes for normal and 30-section prompts after constraining the row/rail. A separate assertion keeps the entire Show Prompt button above the desktop panel edge.

## Before and after

| Width | Baseline | Split View | Studio Tabs |
| --- | --- | --- | --- |
| 1440px | [Before](images/scene-output-workspace/before-1440.png) | [Split View](images/scene-output-workspace/split-1440.png) | [Studio Tabs](images/scene-output-workspace/studio-1440.png) |
| 768px | [Before](images/scene-output-workspace/before-768.png) | [Split View](images/scene-output-workspace/split-768.png) | [Studio Tabs](images/scene-output-workspace/studio-768.png) |
| 390px | [Before](images/scene-output-workspace/before-390.png) | [Split View](images/scene-output-workspace/split-390.png) | [Studio Tabs](images/scene-output-workspace/studio-390.png) |

[Desktop viewer](images/scene-output-workspace/viewer-formatted-1440.png) · [Mobile viewer](images/scene-output-workspace/viewer-formatted-390.png) · [200% reflow](images/scene-output-workspace/reflow-200-percent.png).

All **42** captured PNGs exist and are hashed in the machine report. Twelve representative images are permanent review assets in this PR. The remaining local screenshots include Preview/Sections/Tools, JSON, draft, long prompt, missing media and stale-override states. Representative desktop/tablet/mobile images were visually inspected; all capture steps also assert no horizontal page overflow.

## Warnings, assumptions and limits

- Vite reports a 539.84 kB main chunk (158.11 kB gzip), exceeding its 500 kB warning threshold. The build succeeds.
- Full dependency audit reports 6 existing development-inclusive advisories (3 moderate, 1 high, 2 critical); production audit reports zero. Dependencies were preserved.
- Final unit output contains React act warnings: {'EditorScreen': 0, 'MediaThumbnail': 14}. These warnings remain disclosed; all assertions passed. Browser CLI also reports NO_COLOR/FORCE_COLOR precedence.
- Default local test concurrency intermittently reached existing 5-second deadlines; a concurrent run also had a UI-readiness failure. Final full unit verification used two workers. No timeout was raised, retry enabled or test skipped. Earlier failed reports remain local.
- Browser verification used Chromium. Manual screen-reader, Firefox and Safari testing remain unverified. The 200% check uses equivalent CSS dimensions rather than a browser-chrome zoom action.
- Prompt strings are escaped React text, including HTML-like inputs covered by tests. This review covers the changed presentation paths and data-preservation evidence; it does not certify external generation quality or provider capabilities.

## Reproduce

```sh
npm ci
npm test -- --maxWorkers=2 --minWorkers=1
npm run typecheck
npm run build
npm audit --omit=dev
npm run test:qa
npm run test:e2e
```

Playwright uses its own contexts on `127.0.0.1:4173`. Before screenshots were captured from the baseline sources; the capture script rejects attempting to relabel changed presentation/serializer sources as that baseline.

## Complete changed-file list

- `docs/images/scene-output-workspace/before-1440.png`
- `docs/images/scene-output-workspace/before-390.png`
- `docs/images/scene-output-workspace/before-768.png`
- `docs/images/scene-output-workspace/reflow-200-percent.png`
- `docs/images/scene-output-workspace/split-1440.png`
- `docs/images/scene-output-workspace/split-390.png`
- `docs/images/scene-output-workspace/split-768.png`
- `docs/images/scene-output-workspace/studio-1440.png`
- `docs/images/scene-output-workspace/studio-390.png`
- `docs/images/scene-output-workspace/studio-768.png`
- `docs/images/scene-output-workspace/viewer-formatted-1440.png`
- `docs/images/scene-output-workspace/viewer-formatted-390.png`
- `docs/qa/scene-output-workspace-results.json`
- `docs/scene-output-workspace-qa.md`
- `docs/superpowers/plans/2026-10-28-scene-output-workspace.md`
- `docs/superpowers/specs/2026-10-28-scene-output-design.md`
- `e2e/dialogue-cover.spec.mjs`
- `e2e/fixtures/output-workspace-baseline.json`
- `e2e/output-workspace-fixture.mjs`
- `e2e/output-workspace-screenshots.spec.mjs`
- `e2e/output-workspace.spec.mjs`
- `e2e/performance-studio.spec.mjs`
- `e2e/scene-workflows.spec.mjs`
- `src/__tests__/appWorkflow.test.tsx`
- `src/__tests__/promptOutputWorkspace.test.tsx`
- `src/__tests__/promptSections.test.ts`
- `src/__tests__/scenePromptViewer.test.tsx`
- `src/components/FormattedPrompt.tsx`
- `src/components/GenerationIdentityControl.tsx`
- `src/components/SceneOutputWorkspace.tsx`
- `src/components/ScenePromptViewerDialog.tsx`
- `src/components/StudioDialog.tsx`
- `src/components/scenePromptViewer.css`
- `src/domain/promptSections.ts`
- `src/screens/PromptOutputScreen.tsx`
- `src/screens/promptOutput.css`

Only scoped source, tests, permanent review documentation and synthetic screenshots are included. Browser profiles, ZIPs, logs, credentials, user library records and temporary QA files are excluded.
