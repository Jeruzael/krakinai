# B2 ensemble recipe QA

Scope: the approved optional ensemble/ordered-cue/Outfit implementation on `codex/ensemble-recipe-b2`, based on master `7ce149200bdd09b5d7c8f2f4d74a00801b0fd9c3`. This report separates source facts, automated checks, browser observations and security assumptions. Hosted CI/PR metadata identify the final signed head; no baseline SHA is presented as the tested feature head.

Local verification and its source timing are listed below. This committed report records checks before publication; the PR's Checks/Actions identify the final signed head and hosted outcome without a self-referential documentation commit. [Machine-readable results](qa/ensemble-recipe-b2-results.json) contain every full-run browser case, SDK call ID/response hash, actual receipt IDs, media/output/archive hashes, screenshot hashes and the complete [changed-file inventory](qa/ensemble-recipe-b2-files.txt).

## Directly verified source facts

- [Ensemble types](../src/types/ensemble.ts) and [validator](../src/domain/ensembleValidation.ts) bound optional participants/cues to 8/32 and retain explicit primary mirrors. [Opt-in](../src/domain/ensemble.ts) preserves inherited template snapshots rather than inventing actual asset identities.
- [Canonical assembly](../src/domain/ensembleDocument.ts), [Preflight](../src/domain/scenePreflight.ts) and [generation resolution](../src/domain/ensembleDocument.ts) share the existing validators/identity rules; all three output modes retain complete master identities. Local save loads each actual participant master inside the [existing authoring transaction](../src/storage/sceneAuthoring.ts).
- [V3 schema](change-set-v3.schema.json), [recipe patcher](../src/domain/changeSetEnsemble.ts), [Outfit candidate logic](../src/domain/changeSetVariants.ts) and existing change-set save path provide explicit create/reuse/defer and atomic receipts. V1/v2 schema bytes, dependencies/lockfiles, database version/store layout and application limits are unchanged.
- [Reference traversal](../src/domain/ensembleReferences.ts), template persistence and production export preserve every participant's frozen references. The same media can have distinct associations without duplicating archive bytes. Project Export remains 128 MiB; PR #12 and its restore gate are unchanged.
- No actual browser library, Wedding project, production bridge on 4177 or unrelated local `validation.ts` work was used or modified. All acceptance seeding refuses a nonempty isolated test library.

## Automated and browser evidence

| Actual command | Result | Exit |
| --- | --- | --- |
| `npm test -- --maxWorkers=1 --minWorkers=1` | 1,024 passed / 119 files; 292.59 s | 0 |
| `npm run typecheck` | Passed | 0 |
| `npm run build` | Passed; warnings below | 0 |
| In `bridge/`: `npm run build`, `npm run build:test`, `npm run typecheck` | Passed | 0 each |
| In `bridge/`: `npm run test` | 18 passed / 3 files | 0 |
| `npm audit --omit=dev` in root and `bridge/` | 0 vulnerabilities in each production tree | 0 each |
| `npm run test:qa` | 8 passed; historical ledger 207 checks / 45 screenshots | 0 |
| `node --test scripts/qa/mcp-codex-cli.test.mjs scripts/qa/mcp-cli-workflow.test.mjs` | 23 passed | 0 |
| `node scripts/export-change-set-schema.mjs --check` | Passed; frozen v1/v2 hashes unchanged | 0 |
| `npx playwright test` with native QA explicitly enabled, on `b630507` before the final gap-only CSS correction | **179 passed, 0 failed, 0 skipped, 0 retries**; about 11.5 minutes | 0 |
| Post-gap B2 and signed native/installed-CLI browser suites (command in JSON) | **23 passed, 0 failed/skipped/retries**; 4.2 minutes | 0 |
| `python scripts/qa/verify-ensemble-archives.py` | 3 archives CRC/SHA passed; 5 full-library source hashes / 3 project binaries matched | 0 |
| `git diff --check` | No whitespace errors | 0 |

These are separate suites. The archived 207-check ledger is not the 179-case Playwright suite. The full Windows run and 1,024-test root rerun preceded the final single-rule desktop row-gap correction; post-gap testing covers all B2 plus signed Windows native/installed-CLI cases, and the final whole hosted suite tests the final signed source. No logical JavaScript, storage or bridge behavior changed in that last CSS rule. Linux native skips are reported separately by Actions, not counted as native passes. Both complete original reports (`playwright-final-179.json`, `playwright-gap-focused.json`) are retained in this plan's ignored evidence directory.

The new B2 browser cases use actual IndexedDB/Blob state, DOM controls and SDK wire responses. They verify immutable parent/preferred preservation; create/reuse/defer; missing-original blocking/replacement; stale writes and scope rejection; same-file reference roles; exact copy arguments; Cast/Script; full template and mixed-version backup/restart/project-export round trips. Each MCP response is matched to its actual wire call ID and response hash, including expected denials; a later success cannot substitute for an earlier failed call.

Application clipboard arguments are checked against exact assembler strings. Windows clipboard readback normalizes line endings; downloaded prompt bytes are separately checked against UTF-8 output bytes. This distinction does not imply that the app rewrites copied text.

One fresh whole-branch review found four material issues, all reproduced before correction: primary-slot filtering lost secondary/historical wardrobe associations; full ensemble templates dropped retained guides after participant removal; take comparison omitted participants/cues; continuity labels used the primary outfit for secondary rows. Six focused regressions passed after the corrections (41 tests across the four affected suites), followed by an actual browser production-save/export/template/continuity/comparison regression. The review did not establish another concrete security defect; it was source/probe review, not penetration testing. The minor primary-centric version metadata summary remains deferred; complete participant/cue comparisons are now available. Per-person freeform wardrobe override editing remains a UI limitation; existing frozen overrides survive and stored Clothing/owned Outfits can be explicitly selected.

The first complete browser attempt returned **exit 1: 176 passed, 1 failed out of 177**, with no retries. The existing Direct Prompt mixed-library backup test failed at its persistent-browser reopen UI assertion (builder visible instead of the original-text region). It passed unchanged in isolation and in the final full run. A separate read-only diagnostic reopened the retained failed profile and found the byte-exact original prompt, rendered its original-text region and confirmed records stayed unchanged during that diagnostic. No application router/storage repair is attributed to these passes; the original failure is retained and its root cause remains unestablished. The original attempt's global reporter JSON was overwritten by the focused run; its command output and error context remain, and the final complete JSON was explicitly retained.

The first [hosted run](https://github.com/Jeruzael/krakinai/actions/runs/41251350874), on signed head `25da776`, passed 1,024 unit/component and 18 bridge tests plus the other non-browser gates, then returned **168 browser passes, 1 failure and 9 expected native skips**. At 1440×900, a toolbar button ended at y=779.953125 while the pane ended at y=771.5. The first correction set compact row line height and smaller control margins; full Windows/native179 and root1,024 passed afterward. However, [run87](https://github.com/Jeruzael/krakinai/actions/runs/41253729415) on `b630507` still returned **168 passes, 2 layout failures and 9 skips**: both default and alternate-font checks ended at y=775.953125, still 4.45px over budget. The font-specific hypothesis was not established; the measurable problem is insufficient desktop vertical space.

The final correction reduces the six inter-row gaps from 4px to 2px, reclaiming 12px while preserving row/control sizes, mobile spacing and the original strict rectangle assertions. All 23 B2/native/installed-CLI checks passed afterward; typecheck/build passed again. Five additional layout checks include numeric geometry logging (pane/scrollbar/hint/row/control sizes) to make cross-platform results diagnosable. All 18 screenshots were refreshed. The complete final signed-head hosted result is reported in PR Checks/Actions. The alternate-font test is additional robustness coverage; actual hosted failures are the RED evidence.

Independent archive readback is reproducible after the browser suite with `python scripts/qa/verify-ensemble-archives.py`. It reads the generated reports and ZIPs without extraction or deletion, checks archive/entry hashes and CRCs, and writes `qa-results/ensemble-b2/python-readback.json`. It is limited to small synthetic fixtures (8 MiB compressed, 16 MiB declared uncompressed, 32 entries), not production backup capacity.

The production stdio launcher and real signed Windows verification helper are exercised at both IPv4 and **localhost** in disposable profiles, alongside private-pipe synthetic SDK tests. Browser-only approval is required; write observation and full library snapshots show no writes before approval. Existing installed Codex CLI 0.73.0 legacy acceptance remains a regression; **the complete new ensemble CLI workflow is B3 and is not claimed here**.

## Screenshots and fixture provenance

Eighteen curated synthetic screenshots cover builder, participants, cues, proposal and output at 1440/768/390 widths, plus the before-density view at each width. The before-density comparison loads the actual Studio CSS from `b49f815039e1bd8a369135a957a7e50fdb807c1c` into the same B2 code/data; it is **not** a full master-code before/after comparison. A 720px viewport is equivalent-width 200% reflow, not a claim that browser zoom itself was exercised. Desktop row visibility is checked against the scroll pane's actual rectangle, not merely the viewport beneath a sticky footer.

| View | 1440px | 768px | 390px |
| --- | --- | --- | --- |
| Before density correction | [Image](qa/ensemble-recipe-b2/before-density-1440.png) | [Image](qa/ensemble-recipe-b2/before-density-768.png) | [Image](qa/ensemble-recipe-b2/before-density-390.png) |
| Scene Builder | [Image](qa/ensemble-recipe-b2/builder-1440.png) | [Image](qa/ensemble-recipe-b2/builder-768.png) | [Image](qa/ensemble-recipe-b2/builder-390.png) |
| Participants | [Image](qa/ensemble-recipe-b2/participants-1440.png) | [Image](qa/ensemble-recipe-b2/participants-768.png) | [Image](qa/ensemble-recipe-b2/participants-390.png) |
| Ordered cues | [Image](qa/ensemble-recipe-b2/cues-1440.png) | [Image](qa/ensemble-recipe-b2/cues-768.png) | [Image](qa/ensemble-recipe-b2/cues-390.png) |
| Proposal review | [Image](qa/ensemble-recipe-b2/proposal-1440.png) | [Image](qa/ensemble-recipe-b2/proposal-768.png) | [Image](qa/ensemble-recipe-b2/proposal-390.png) |
| Prompt Output | [Image](qa/ensemble-recipe-b2/output-1440.png) | [Image](qa/ensemble-recipe-b2/output-768.png) | [Image](qa/ensemble-recipe-b2/output-390.png) |

New B2 visual guides are three browser-decoded canvas PNGs; the new 1×1 unit PNG is independently decoded in browser acceptance (SHA-256 `4e77ec6bec4f2ea373dceeabdfb7f7b3fd70ea498165b7307ecb0d361a58dc78`). Two inherited B1 PNG-labelled byte fixtures with SHA-256 `fe11666ec8157e27b056de146fa15436e929c550174e27f631435ef023238942` are **not decodable**. They remain unchanged as legacy opaque-byte fixtures and are not counted as playable/decodable media. Archive/hash tests include them honestly.

## Security assumptions and practical limits

This is focused application verification, not an independent penetration test or a claim of blanket safety. The OS/account, trusted local signing key, browser engine and existing transaction implementation are trusted. Stored media metadata/size/type participates in stale-state checks; a same-size malicious raw-Blob replacement through DevTools is not newly authenticated by that proof. End-to-end restored/exported bytes are separately SHA-256 checked.

Native automation uses an already trusted local certificate and reviewed ignored driver on synthetic profiles. AllSigned remains enabled; rebuilt compiled helpers are re-signed and Authenticode checked Valid. Keys, certificates, profiles, ZIPs and raw secret-bearing transcripts remain outside Git. Linux hosted CI cannot certify the Windows window; native cases must be explicitly labelled as skipped there.

The tested archives are small representative libraries, not large-limit ZIP64 recovery certification. No restore gate is raised. Only Chromium/installed Windows Chrome paths are exercised, not all browser/assistive-technology combinations. Keyboard/focus labels and reflow are checked, but a human screen-reader session is not claimed. Master prompt output preservation is covered by frozen legacy regressions; no AI generation service or external AI credential is used.

## Warnings and retained artifacts

The existing Vite mixed static/dynamic import and >500 kB chunk warnings remain (current index bundle approximately 1,049 kB). Playwright reports inherited NO_COLOR/FORCE_COLOR notices; existing component tests can report React `act` warnings. They do not change the commands' actual exit codes and are recorded with the final results.

Ignored evidence stays in `qa-results/ensemble-b2/`, `qa-results/local-mcp/profiles/`, unique Playwright run folders and this plan's `.superpowers/sdd/` directory. No cleanup was attempted. Only curated synthetic screenshots and sanitized machine-readable results are published with the source inventory.
