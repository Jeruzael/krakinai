# Phase 6 Stage A — Direct Prompt and immutable revisions

Local verification: 30 October 2026 (Asia/Taipei). Branch: `codex/direct-prompt-revisions`; base: `eb15dc1583f59cbee195eba9d356b0d35ef290fb`. This report describes the feature patch before signing. Hosted CI must identify the resulting PR commit separately; local results are not a hosted-CI claim.

## Directly verified source facts

- [Authoring types](../src/types/sceneAuthoring.ts) distinguish `recipe` and `direct_prompt` independently of Shot Type. The [domain validator](../src/domain/directPrompt.ts) bounds complete text at 100,000 UTF-16 units, rejects malformed surrogate strings and validates optional metadata. [Exact editor mapping](../src/domain/exactPromptText.ts) preserves untouched CRLF/CR text through browser textarea editing.
- [Transactional save](../src/storage/sceneAuthoring.ts) creates new immutable scene IDs, checks reviewed draft/project/head revisions, validates current asserted media, and atomically creates/attaches shots. Retry request IDs are bound to operation contents. A save keeps existing project preference/status unless selection is explicit. A shared scene has global linear history and an explicit project context; saving into project B does not update project A.
- [Reference reconciliation](../src/domain/directPromptReferences.ts) adds newly selected direct/original-source associations to inherited export packs, preserves explicit old exclusions, and retains repeated associations while archive bytes are deduplicated. It does not reassign stored media.
- [History UI](../src/components/SceneRevisionHistory.tsx) exposes full originals, bounded line comparison, metadata differences, version drafts, alternate takes, explicit preference and restore-as-new. Restore of Version 1 after Version 2 creates Version 3; it does not overwrite Version 1. Recipe output uses a compact Versions & Takes disclosure to preserve the existing primary action layout.
- [Direct workspace](../src/components/DirectPromptWorkspace.tsx) provides editor/review, original-text copy/download, optional stored references, unresolved inputs and explicit project destination. Claims/source labels are entered by the user. No identity inference, component extraction or AI call occurs.
- [Direct JSON](../src/domain/directPromptDocument.ts) preserves the original string and reports unavailable recipe formats honestly. [Project export](../src/domain/projectExport.ts) retains selected-take scope and the existing 128 MiB media / 16 MiB generated-text / 2,000-entry limits. Full history belongs in full-library backup.
- [Backup validation](../src/storage/backup.ts) accepts legacy records and validates new metadata/managed graphs before replacement. Database version, stores, archive mechanics and configured capacity limits remain unchanged. `src/domain/promptAssembler.ts`, `src/domain/cameraComposition.ts`, `src/domain/validation.ts`, dependency manifests and CI configuration have no changes. Separate local validation work is untouched.

## Automated verification

| Command | Actual result | Exit |
| --- | --- | --- |
| `npm test -- --maxWorkers=2 --minWorkers=1 --reporter=default --reporter=json --outputFile.json=qa-results/direct-prompts/full-unit.json --reporter=junit --outputFile.junit=qa-results/vitest.xml` | 581 passed, 83 files; 60 added tests plus the existing 521 | 0 |
| `npm run typecheck` | Passed | 0 |
| `npm run build` | Passed | 0 |
| `npm audit --omit=dev` | Zero production vulnerabilities | 0 |
| `npm run test:qa` | Six script tests and historical 207-check / 45-screenshot ledger; separate from current Playwright counts | 0 |
| `npm run test:e2e` | 113 unique cases passed; zero failures, skips, flaky cases or retries; 294 seconds | 0 |
| `git diff --check` | Final patch check recorded in machine evidence | 0 |

The [machine-readable report](qa/direct-prompt-results.json) contains individual unique browser cases, attempts, exact command exits, warning observations, runtime versions, source hashes, complete changed-file list, screenshot sizes/hashes and integrity results. Raw logs/profiles/ZIPs stay ignored under `qa-results/direct-prompts/`; these paths are local evidence, not committed artifacts.

Warnings: Vite reports a main JavaScript chunk over 500 kB. React `act()` notices from asynchronous thumbnail updates and Node's `NO_COLOR`/`FORCE_COLOR` notice are counted in machine evidence; they are not suppressed or counted as passing assertions. The production audit result is limited to dependency advisories, not a security certification.

Earlier failures are retained in machine evidence: initial test discovery overlapped creation of new modules; a loaded concurrent baseline had three existing UI timeouts (518/521), followed by a 521/521 serial existing-suite run. A new synthetic backup fixture initially omitted required variant tags. The first full browser run was 112/113: new recipe history controls pushed Show Prompt below the 1440px fold. The fixture and layout were corrected; final verification uses the unchanged original layout assertion. Review findings were reproduced RED before fixes; no failing assertion was weakened.

## Browser-tested behavior

The committed synthetic browser tests cover exact import without component assets; v1/v2 comparison; restore as v3; a separate take; unchanged 15-shot planning and explicit preference; atomic new-shot creation; current-media deletion/replacement; dirty-buffer and stale-tab safeguards; forced quota/write abort; idempotent retries; explicit shared-scene project routing; managed-recipe stale review/editor checks; and legacy output compatibility.

Exact text: 166 UTF-8 bytes containing CRLF, Taglish, quotation marks, emoji, combining Unicode, tabs, JSON-like text and edge whitespace. Source, actual clipboard readback and TXT download all hash to `4a76873a9abd7094b5b1f35c9a78d43454793b28e754221dc2776eedc2a10913`. All 22 captured legacy draft/saved output hashes also match the base.

Mixed-library backup: 22,854 compressed bytes; archive SHA-256 `2f8432ca519c4a006d07a2b356f25e8d788285b26952da48cb647ceeb3675faa`. Restored 10 assets, 1 variant, 3 scenes, 4 drafts, 2 collections, 1 decodable synthetic PNG and 4 templates. Every compared record, preferences and original media hash matched after isolated restore; verification included closing Chromium and relaunching the persistent synthetic profile. The media SHA-256 is `6dd6e297af6966b50dcbc451ab51f3f5bb46fae8b15a6c58912cef31a3c6e4f6`. The retained profile is `qa-results/direct-prompts/profiles/restart-1793305596203`; no deletion was attempted.

Before screenshots were captured with a source-diff guard against the base before product edits: eight recipe Builder/Output images. Twelve after images show direct editor/output/history at 1440×900, 1366×768, 768×1024 and 390×844. All 20 PNGs exist under [screenshots/direct-prompts](screenshots/direct-prompts/); dimensions, sizes and SHA-256 values are listed in machine evidence. Desktop Review Prompt remains in the viewport. Keyboard tabs, disclosure activation, history focus restoration and 720×450 reflow (equivalent to 200% of a 1440×900 layout) are automated. Native browser zoom controls and standalone screen-reader software were not tested.

| View | Before | After |
| --- | --- | --- |
| 1440 desktop | [Builder](screenshots/direct-prompts/before/builder-1440.png), [Output](screenshots/direct-prompts/before/output-1440.png) | [Editor](screenshots/direct-prompts/after/editor-1440.png), [Output](screenshots/direct-prompts/after/output-1440.png), [History](screenshots/direct-prompts/after/history-1440.png) |
| 1366 laptop | [Builder](screenshots/direct-prompts/before/builder-1366.png), [Output](screenshots/direct-prompts/before/output-1366.png) | [Editor](screenshots/direct-prompts/after/editor-1366.png), [Output](screenshots/direct-prompts/after/output-1366.png), [History](screenshots/direct-prompts/after/history-1366.png) |
| 768 tablet | [Builder](screenshots/direct-prompts/before/builder-768.png), [Output](screenshots/direct-prompts/before/output-768.png) | [Editor](screenshots/direct-prompts/after/editor-768.png), [Output](screenshots/direct-prompts/after/output-768.png), [History](screenshots/direct-prompts/after/history-768.png) |
| 390 mobile | [Builder](screenshots/direct-prompts/before/builder-390.png), [Output](screenshots/direct-prompts/before/output-390.png) | [Editor](screenshots/direct-prompts/after/editor-390.png), [Output](screenshots/direct-prompts/after/output-390.png), [History](screenshots/direct-prompts/after/history-390.png) |

## Independent review and execution rulings

One fresh whole-branch review returned six Important groups: recipe dialogue/negative preservation; explicit project context overriding historical provenance; new attachments in inherited packs; independently compared reference representations; caller-owned stale draft/project checks; and duplicate original-source associations in revision/copy drafts. Each group has a regression reproduced before the correction and passing afterward. The alternate-take label was regraded Important because distinguishing a take from a version is an explicit acceptance requirement; it was corrected and tested. Additional cases cover repeated associations and a globally shared history head with project-specific attachment.

Rulings: future Stages B–D remain documentation only; clipboard behavior and final suites require parent-run evidence; historical legacy copy behavior stays unchanged while new managed constructors are corrected; save/restore boundaries validate managed metadata, with arbitrary external IndexedDB mutation outside the supported write API; selected-take export scope and intentional old pack exclusions remain, with new explicit associations included. No second review loop was run. No profile cleanup is authorized, so disposable QA profiles are retained. The user's approved implementation and PR workflow require no repeated approval question; signing remains enabled.

## Security assumptions and remaining risks

- Storage remains browser/profile/origin-local. No cloud service, new endpoint, credential store or AI bridge is introduced. Source review, transaction tests and a production dependency audit support specific claims above; no area is labelled SAFE based on a function-name search.
- External applications can transform clipboard text. Exact file bytes and the observed pinned Windows Chromium clipboard payload are verified, not every native clipboard consumer.
- New direct/revision records require a Stage A-capable app. Legacy backup read compatibility is tested; older binaries are not promised forward compatibility with new record shapes.
- The representative backup is small. This task adds no large-library ZIP64 certification, raises no restore gate and changes nothing on PR #12. That PR remains a separate unmerged draft.
- Stage B change-set import, Stage C authenticated MCP pairing and Stage D ChatGPT connectivity are design contracts in [direct-prompt-contract.md](direct-prompt-contract.md), not functioning integrations.
- The complete changed-file list is in machine evidence. Intended commits contain source, tests, documentation and 20 synthetic screenshots. Personal library data, browser profiles, test ZIPs, credentials and temporary QA artifacts are excluded. Actual browser data, the live localhost:5173 app and all existing work are preserved.

Review steps: open Import Full Prompt in Scene Builder or a storyboard shot; paste text; save a draft; review/save an immutable scene; create a version; compare; restore old content as a new version; explicitly choose a preferred take. Inspect full text and honest export formats. Test assets only in an isolated profile; do not use or clear a real library for QA.

Release status: local evidence is finalized before signing. The PR will carry the signed commit and its hosted Actions result. No merge is authorized.
