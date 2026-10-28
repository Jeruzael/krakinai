# Context-aware Shot Types — QA evidence

Baseline: master `8d2d14533918ecfa1597d5ef7d5c0f71deccf672`. Branch: `codex/context-aware-shot-types`. [Record/JSON contract and workflow](context-aware-shot-types.md). [Machine-readable results and hashes](qa/context-aware-shot-types-results.json).

## Directly verified facts

- The shared rules module drives Builder requirements, assembly, Preflight and immutable save validation. Missing or explicit Character Scene preserves the tested legacy output contracts. Sixteen SHA-256 expectations were frozen before implementation; the snapshot and existing compatibility suites passed afterward.
- Source inputs use optional stable-ID media links, separate from generated results. Switching retains inactive draft selections and sources; active prompts, negatives, identity views, reference packs and exports filter them. Immutable saves retain active inputs. Stored original MIME, byte size and blob metadata are validated inside the scene/project transaction.
- No IndexedDB store/version, migration, dependency, media/backup limit or Project Export limit changed. `validation.ts`, dependency files and test/build configs match baseline Git blobs. Project Export remains 128 MiB. PR #12 ZIP64 work remains separate.
- No actual user browser profile or library was opened, cleared or modified. Legacy saved strings and identities were not rewritten. Only synthetic screenshots are published.

## Automated results

| Command | Actual result | Exit |
| --- | --- | --- |
| `npm test -- --maxWorkers=2 --minWorkers=1` | **461 passed**, 68 files | 0 |
| `npm run typecheck` | Passed | 0 |
| `npm run build` | Passed | 0 |
| `npm audit --omit=dev` | **0 vulnerabilities** | 0 |
| `npm run test:qa` | **6 checks passed**; historical ledger remains 207 checks / 45 screenshots | 0 |
| `npm run test:e2e` | **79 passed**, 0 failures/flaky/skips | 0 |
| `python scripts/qa/verify-shot-types-archives.py` | Three archives read independently; original hashes/metadata/CRC match | 0 |
| `node scripts/qa/ci-summary.mjs` | Complete browser case list, within unchanged artifact size bound | 0 |
| `git diff --check` | Passed | 0 |

The historical ledger is separate from the 79 current Playwright cases. Seven current cases target Shot Types. Unit checks include original-field defaults, all four rules, inactive filtering, dialogue/performance, malformed metadata, missing/wrong stored originals, failed atomic scene/project saves, duplicate identity, templates, planning mismatch, reachability, old backups and new metadata roundtrips.

The clean baseline passed 409 tests. Required feature assertions were observed failing before implementation. Independent review identified two defects: duplicate pack orders after applying from Output, and inherited negative text leaking through refreshed saved-copy history. Both were reproduced, corrected, independently checked afterward, and covered by seven focused unit corrections plus a Chromium regression. An initial full browser run had 78 passes and one new-harness failure: direct API fixture writes bypassed the mounted library context. Adding an explicit fixture reload corrected it; the isolated case and final full run passed. No timeouts increased, retries enabled or tests skipped.

## Browser-tested behavior

The exact fictional MIDORI / 03 — Floor Plan scenario assembles a 4-second, 9:16 graphic specification with no Character, Environment or Action. It has zero blocking findings. Source selection reuses its existing ID without another binary. The original PNG decodes at 960×720; preview keyboard focus and prompt-dialog Escape/focus restoration pass.

All eight selections (Narrative, Structured, Compact, Project JSON, Generation JSON, Generic Structured, Gemini Omni Flash and Custom) preserve the complete expected string in the exact clipboard API payload and actual selected downloads. Copy/download leave the source bytes unchanged. UI Save Scene and Edit a Copy retain the type/original associations; project linking preserves the ordered three-shot storyboard. Reference/project ZIPs are actual UI downloads. Full backup validation/restore and project linking also exercise existing storage APIs within the isolated context; those API operations are not described as manually tested native dialogs.

Voiceover without a visible character passes with exact spoken whitespace/Unicode. On-camera dialogue without a relevant character is blocked. Wrong MIME and missing stored originals fail before creating an immutable scene. UI pack application followed by full backup validation/restore preserves inactive draft associations with unique contiguous orders. Copy → refresh → save → copy again → Graphic excludes inherited component negatives and retains authored scene negatives.

## Original source and independent archive evidence

Synthetic original: `MIDORI-two-bedroom-original.png`, **61,534 bytes**, SHA-256 `6fbc36b8960dcbb56fd75fec5cd69d2c208b8620061ea2b1d3e5bf8288ad4cfa`. It is a fictional QA floor plan, not a user property document. Python's ZIP reader independently checked CRC, the exact original bytes, source metadata and PNG header dimensions. Browser preview independently checked decoding. Some low-level unit fixtures use opaque bytes and are not claimed to be decodable media.

| Archive | ZIP bytes | Entries | SHA-256 |
| --- | --- | --- | --- |
| midori-reference.zip | 55,803 | 2 | `38309bf896fe84715f1d05bff0574ac424788c882ca7c709e8de60cf2872f35d` |
| midori-project.zip | 64,130 | 11 | `ad02872a87bc29030c4304c1ae1a9f14878425153e82bce852880e66de5dab02` |
| midori-full-backup.zip | 60,197 | 2 | `eb93473f08ad183aed5e24f098b5c936d6eb33e0cbc2927b149f6e4704948145` |

The restored original hash is identical. This small synthetic compatibility test does not extend any large-library ZIP64 verified ceiling.

## Before/after and responsive verification

| Width | Before | After Builder | After Output | Prompt Viewer |
| --- | --- | --- | --- | --- |
| 1440px | [Before](images/context-aware-shot-types/before-builder-1440.png) | [Builder](images/context-aware-shot-types/after-builder-1440.png) | [Output](images/context-aware-shot-types/after-output-1440.png) | [Prompt](images/context-aware-shot-types/after-prompt-1440.png) |
| 768px | [Before](images/context-aware-shot-types/before-builder-768.png) | [Builder](images/context-aware-shot-types/after-builder-768.png) | [Output](images/context-aware-shot-types/after-output-768.png) | [Prompt](images/context-aware-shot-types/after-prompt-768.png) |
| 390px | [Before](images/context-aware-shot-types/before-builder-390.png) | [Builder](images/context-aware-shot-types/after-builder-390.png) | [Output](images/context-aware-shot-types/after-output-390.png) | [Prompt](images/context-aware-shot-types/after-prompt-390.png) |

All **12** published PNG files exist and their hashes/dimensions are in the machine report. Before images came from an immutable master archive on a separate port with critical source hashes verified. After views passed overflow assertions at 1440×900, 768×1024 and 390×844; representative views were inspected visually. Desktop actions remain available in the existing sticky workspace footer. Mobile uses normal stacked scrolling.

## Assumptions, warnings and remaining risks

- Automated browser checks use Chromium. Manual screen-reader, Firefox and Safari testing remain unverified. ARIA labels, keyboard interactions and focus have automated coverage; this is not a general accessibility certification.
- Source validation follows existing MIME/file-size/storage rules and checks stored byte metadata. No external generator was called; output documents are KRAKINAI specifications, not official provider request schemas or rendered media.
- A historical copied record whose original ancestry was already deleted may lack enough provenance to distinguish old component negatives from authored prose. Recovery uses exact available prefixes and never guesses arbitrary user text. New copies retain provenance across refresh/save/copy operations.
- Vite warns about the **561.87 kB** main chunk (164.31 kB gzip), over its 500 kB threshold. The build passes. Full development-inclusive audit exits 1 with **6 existing advisories** (3 moderate, 1 high, 2 critical); production audit exits 0 with none. Dependencies are unchanged. Final unit output contains 31 React act warnings; all assertions passed. Playwright reports the existing NO_COLOR/FORCE_COLOR precedence warning.
- Actual Windows Save As, large-library capacity and ZIP64 recovery were not retested. Existing limits and the separate PR #12 safeguards remain untouched.

## Reproduce and publication

Run `npm ci`, the commands above, then the archive verifier after Playwright produces its synthetic ZIPs. The before-capture script requires the pinned master source snapshot and its separate Vite server; it refuses source hash mismatches. Local raw reports, archives, baseline snapshot and logs remain under ignored `qa-results/`. Browser profiles, credentials, actual user records and temporary QA archives are excluded from the commit. No QA profile or user data path was manually deleted.

GitHub Actions for the signed pushed head is reported separately in PR checks and the final delivery. Do not merge without approval.

## Complete changed-file list

- `README.md`
- `docs/context-aware-shot-types-qa.md`
- `docs/context-aware-shot-types.md`
- `docs/images/context-aware-shot-types/after-builder-1440.png`
- `docs/images/context-aware-shot-types/after-builder-390.png`
- `docs/images/context-aware-shot-types/after-builder-768.png`
- `docs/images/context-aware-shot-types/after-output-1440.png`
- `docs/images/context-aware-shot-types/after-output-390.png`
- `docs/images/context-aware-shot-types/after-output-768.png`
- `docs/images/context-aware-shot-types/after-prompt-1440.png`
- `docs/images/context-aware-shot-types/after-prompt-390.png`
- `docs/images/context-aware-shot-types/after-prompt-768.png`
- `docs/images/context-aware-shot-types/before-builder-1440.png`
- `docs/images/context-aware-shot-types/before-builder-390.png`
- `docs/images/context-aware-shot-types/before-builder-768.png`
- `docs/qa/context-aware-shot-types-results.json`
- `docs/scene-prompt-schema.md`
- `docs/superpowers/plans/2026-10-28-shot-types.md`
- `docs/superpowers/specs/2026-10-28-shot-types-design.md`
- `e2e/shot-types-fixture.mjs`
- `e2e/shot-types.spec.mjs`
- `scripts/qa/capture-shot-types-before.mjs`
- `scripts/qa/verify-shot-types-archives.py`
- `src/__tests__/__snapshots__/shotTypeLegacy.test.ts.snap`
- `src/__tests__/shotTypeCorrections.test.tsx`
- `src/__tests__/shotTypeExports.test.ts`
- `src/__tests__/shotTypeLegacy.test.ts`
- `src/__tests__/shotTypePersistence.test.ts`
- `src/__tests__/shotTypes.test.ts`
- `src/__tests__/shotTypesSourceMedia.test.tsx`
- `src/__tests__/shotTypesUI.test.tsx`
- `src/components/ReferenceBoard.tsx`
- `src/components/ReferencePackManager.tsx`
- `src/components/SceneOutputWorkspace.tsx`
- `src/components/SourceMediaPicker.tsx`
- `src/components/sourceMediaPicker.css`
- `src/domain/exportPresets.ts`
- `src/domain/generationDocument.ts`
- `src/domain/phase4Validation.ts`
- `src/domain/phase5ProjectValidation.ts`
- `src/domain/projectExport.ts`
- `src/domain/projectRoutes.ts`
- `src/domain/projectStoryboard.ts`
- `src/domain/promptAssembler.ts`
- `src/domain/promptSections.ts`
- `src/domain/referencePack.ts`
- `src/domain/sceneDocument.ts`
- `src/domain/sceneDuplicates.ts`
- `src/domain/scenePreflight.ts`
- `src/domain/shotTypeRules.ts`
- `src/screens/CollectionWorkspace.tsx`
- `src/screens/PromptOutputScreen.tsx`
- `src/screens/SceneBuilderScreen.tsx`
- `src/screens/TemplatesScreen.tsx`
- `src/storage/backup.ts`
- `src/storage/db.ts`
- `src/storage/projects.ts`
- `src/types/domain.ts`
