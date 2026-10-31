# AI Connections workspace — Workstream A

Local implementation on `codex/ai-connections-workspace`, based on master `3e5d352531007f99e72f711396676423bbde6fe5`. No merge is authorized. Workstreams B and C await their requested review gates.

## Directly verified source changes

- `src/screens/AiConnectionsScreen.tsx` separates Connection, Permissions and Incoming Proposals into keyboard-accessible tabs. Switching tabs retains permission drafts and the selected proposal.
- `src/components/aiConnections/PermissionsWorkspace.tsx` stages changes, displays their difference from applied authority, and calls the existing permission boundary once on Apply. Reset/Cancel restore applied selections. Editing permissions never approves a production batch.
- `src/components/aiConnections/PermissionRecordPicker.tsx` searches and paginates the complete inventory, with category and selected-only filters. Bulk actions operate on all matching IDs, including results outside the rendered page. Hidden selections remain selected.
- `src/domain/mcpPermissionDraft.ts` reuses `validateMcpScope()` and its unchanged limits. Oversized actions fail as a whole. Full Access has explicit confirmation, freezes the current inventory, and stages a draft for review. It cannot bypass scope limits.
- Sensitive disclosure and proposal capabilities remain separate opt-ins. Full scene prompts and exact receipt recovery are explicit selections. Removing project access reveals dependent full-prompt revocations before Apply.
- `src/connections/proposalBroker.ts` exposes a copy of existing temporary approved-receipt grants for accurate display. `AiConnectionContext.tsx` exposes the confirmed session expiry. Neither changes the authorization protocol or transaction implementation.
- `ConnectionPanel.tsx` retains genuine native pairing and disconnect controls, validates the 43-character key format locally, clears submitted key input, and displays bounded error codes without logging a key.

Project grants continue to follow current storyboard take membership under existing policy. New projects and reusable assets are not automatically selected. This is not a promise that a selected project's future take metadata is excluded.

No persistence schema, prompt assembler, backup/restore, storage limits, immutable-scene transaction or `validation.ts` changes are part of this PR. The separate local pairing-helper repair remains in its original checkout.

## Automated verification

The final machine-readable measurements are in [ai-connections-workspace-results.json](qa/ai-connections-workspace-results.json). Local measurements describe the uncommitted working tree at test time; hosted CI must identify the final signed commit separately in its run artifact and PR description.

| Command | Result |
| --- | --- |
| `npm test -- --maxWorkers=1 --minWorkers=1 --reporter=default --reporter=junit --outputFile.junit=qa-results/vitest.xml` | Exit 0; 742/742 tests across 101 files. |
| `npm run typecheck` | Exit 0. |
| `npm run build` | Exit 0; Vite warns about the existing main bundle exceeding 500 kB. |
| `npm audit --omit=dev --json` | Exit 0; zero production advisories. |
| Bridge: `npm run build`, `npm run typecheck`, `npm test`, `npm audit --omit=dev --json` | Exit 0 each; 18 bridge tests pass; zero production advisories. |
| `npm run test:qa` | Exit 0; 8 reconciliation tests pass; historical ledger remains 207 checks / 45 screenshots. These are historical ledger counts, not the current Playwright total. |
| `node --test scripts/qa/mcp-codex-cli.test.mjs scripts/qa/mcp-cli-workflow.test.mjs` | Exit 0; 23 evidence-validation tests pass. This does not mean the installed Codex CLI was rerun. |
| `KRAKINAI_NATIVE_QA=0 npm run test:e2e` (PowerShell sets the environment variable first) | Exit 0; 148 passed, 5 explicitly skipped native scenarios (153 total). |
| `git diff --check` | Exit 0 after whitespace cleanup. |

An initial unbounded baseline `npm test` run passed 702 of 706 tests and failed four existing UI tests: three timeouts and one subsequent missing control. The affected three files passed 36/36 when rerun with one worker. A later two-worker run overlapped browser/build work and passed 738/739; the pairing transition did not observe Connected within its DOM wait. Its isolated six-test file passed. The final full run uses one worker without competing QA suites and passes 742/742; no assertions or default timeouts were relaxed. Dependency installation also reports deprecated `whatwg-encoding` and six development-inclusive advisories (3 moderate, 1 high, 2 critical). Locked dependencies are unchanged. Unit tests also emit existing MediaThumbnail act() warnings. The first full browser run passed 146, timed out in one existing camera-candidate case, and skipped five native cases; the isolated case passed and the final complete run passed 148 with five skips. New regression-fixture type errors found by an intermediate typecheck were corrected; final typecheck passes. Playwright emits the `NO_COLOR` / `FORCE_COLOR` environment warning.

## Browser-tested behavior

Six new Playwright scenarios use fresh isolated profiles and synthetic records at `http://127.0.0.1:4173`. They exercise:

1. All 65 filtered matches selected beyond the old 50-row boundary, retention of an independently selected hidden record, mixed checkbox state, clear-matching, and zero library mutations.
2. Rejection of a 501-record bulk grant against the existing 500 combined-record limit, with no partial selections or enabled sensitive flags. Errors remain visible beside the permission controls.
3. A real MCP SDK connection observing zero draft grants, then exactly 65 assets only after one Apply and one scope-epoch increment; disconnect revokes access.
4. Proposal arrival without route/focus stealing; deliberate review and queue-return focus; actual browser approval of synthetic candidates; visible temporary receipt access and explicit revocation by applying permissions. Permission changes do not change saved records.
5. Keyboard operation and no horizontal overflow at 720 CSS pixels with DPR 2, representing 200%-equivalent reflow from 1440 pixels.
6. Delayed connection startup with all permission mutations locked before the native challenge arrives; eventual connected authority matches the applied selections.

Component regressions additionally cover stale Full Access confirmation, an evicted selected proposal, shortcut focus, separate identity disclosure, dependent prompt revocation, accurate asset/variant/template counts, and a category disappearing during inventory refresh. Project suggestions follow variant parents and attached-media IDs without matching character names. Existing cryptographic transport, replay, denial, scope-change and immutable import tests remain in the full regression suites.

## Screenshots

All images contain only synthetic data (80 assets and default templates). Baselines were captured before UI edits from the combined original screen. After images show the Permissions tab with Reusable assets opened. They document different workflows; they are not a measured page-height benchmark.

| Viewport | Before | After |
| --- | --- | --- |
| 1440 × 900 | [Baseline](qa/ai-connections-workspace/before-1440x900.png) | [Permissions](qa/ai-connections-workspace/after-1440x900.png), [initial viewport](qa/ai-connections-workspace/after-1440x900-viewport.png) |
| 1366 × 768 | [Baseline](qa/ai-connections-workspace/before-1366x768.png) | [Permissions](qa/ai-connections-workspace/after-1366x768.png) |
| 768 × 1024 | [Baseline](qa/ai-connections-workspace/before-768x1024.png) | [Permissions](qa/ai-connections-workspace/after-768x1024.png) |
| 390 × 844 | [Baseline](qa/ai-connections-workspace/before-390x844.png) | [Permissions](qa/ai-connections-workspace/after-390x844.png) |
| 720 × 450 | [Baseline](qa/ai-connections-workspace/before-720x450.png) | [Permissions](qa/ai-connections-workspace/after-720x450.png), [DPR 2](qa/ai-connections-workspace/after-reflow-720-dpr2.png) |

The desktop picker uses the content width with 12 rows per page and no nested scrolling list. Applied authority, drafts and pending production proposals now have separate places; filtered bulk selection replaces repetitive individual selection. This improves the selection workflow without a claimed timing benchmark.

## Security boundaries and remaining verification limits

- Backend enforcement remains the existing broker, validated explicit scope, authenticated transport and trusted browser approval. UI visibility alone is not authorization. The tested SDK denial/grant/revocation paths provide behavioral evidence, not a claim that the whole application is secure.
- Five opt-in native Windows scenarios are not rerun in this worktree. Its production bridge build copies an unsigned helper; running it under AllSigned would require a separately reviewed signing action. The native Windows PowerShell host reports AllSigned (the separate PowerShell Core QA shell reports RemoteSigned); no execution policy is changed. Existing native certification is historical evidence only.
- Synthetic pairing uses the existing isolated test verifier. This run does not certify a new real Windows verification-window interaction or installed Codex CLI workflow. No real KRAKINAI profile, library, AI credential or pairing key is used.
- Reflow and keyboard behavior are tested in pinned Chromium. Actual OS/browser zoom, NVDA/JAWS/VoiceOver output, and every supported browser still require manual accessibility verification.
- Applying permissions intentionally invalidates pending proposal consent and revokes temporary receipt grants under existing policy. Users must review a proposal again after authority changes.
- Full Access can fail for a library exceeding existing scope limits; use filtered or individual selections. It never silently selects a prefix or widens enforcement limits.
- Hosted CI and the signed commit are pending at local measurement time. Their exact SHA and run link belong in the PR's final evidence. PR #12 is untouched; no PR is merged automatically.

Only scoped source/tests/docs/CI changes and the twelve deliberately curated synthetic screenshots belong to the commit. Raw logs, browser profiles, library exports, media, keys, certificates, secrets and temporary QA scripts remain ignored and retained locally. No disposable profile is deleted.

## Review decisions at local verification

One independent whole-branch reviewer found three issues. The startup authority race, disappearing category filter, and incomplete variant-parent/media context each reproduced in a failing test, then passed (39/39 focused regressions; complete final suites above). The two inventory issues were treated as material workflow defects. No review findings remain deferred. The final correction patch was verified by tests rather than a second reviewer.

The execution ledger records these decisions, in order:

- Ruling: retain the separate uncommitted pairing repair in its original checkout — this PR starts at the requested master — carrying it would mix unrelated local work.
- Ruling: collect the scoped work in a final configured signed commit — the user's SSH signer requires local passphrase entry — per-task commits would repeatedly interrupt implementation.
- Ruling: retain ignored QA profiles and the task ledger rather than deleting the skill workspace, because user cleanup restrictions take precedence; cost is retained local disk usage.
- Ruling: use bounded two-worker full unit runs after the unbounded baseline resource failures; assertions/timeouts unchanged, cost is longer execution and less local parallelism.
- Ruling: do not run five opt-in native tests against an unsigned newly built helper or extend prior two-file signing approval to new paths. Preserve AllSigned; cost is native pairing not recertified by this UI task.
- Ruling: the review-package helper rejects the intentionally empty unsigned commit range. Review the full staged patch and newly added files against master instead; cost if wrong is an incomplete review, mitigated by the explicit staged file list and package.
- Final: Ruling: B/C and real-library migration remain outside A, per approved delivery gates; cost if wrong is delayed production recipe conversion, not hidden production writes.
- Final: Ruling: native verification and installed-CLI recertification remain excluded; signed-helper approval is path-specific and production native files are unchanged. Cost is no fresh native interaction evidence for this UI PR.
- Final: Ruling: OS/browser zoom, screen-reader output and other browsers require manual checks; CSS/DPR reflow and Chromium keyboard tests cover only tested behavior. Cost is residual platform-specific accessibility risk.
- Final: Ruling: final suite counts, signing and CI are completion gates rather than assumed successes; publish only observed machine results and exact signed-SHA hosted runs. Cost if wrong is inaccurate release evidence.
- Final: Ruling: retain existing selected-project metadata membership behavior, including later takes; changing it would alter approved authorization policy. Cost if misunderstood is sharing metadata for a newly added take in an already selected project; UI explicitly explains it.

The requested PR delivery was already approved, so no repeated integration-choice approval is required. The worktree and ignored evidence are retained for review. Subsequent signed commit and hosted-CI delivery are recorded in the PR rather than retroactively changing this local measurement.
