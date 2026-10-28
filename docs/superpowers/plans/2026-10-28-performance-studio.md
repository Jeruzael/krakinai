# Performance Studio Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. The user has authorized inline execution and full verification.

**Goal:** Offer optional, searchable acting and vocal direction while preserving exact dialogue and all historical authoring and output data.

**Architecture:** Keep the existing optional `dialogue.performanceDirection` key, with a discriminated `version: 1 | 2` union. Version 1 retains its existing field semantics, strict validation, deterministic formatter and selection order. Version 2 separates emotion, delivery techniques, voice, speech and gestures. Custom delivery notes remain in `deliveryNotes`; no parser or migration infers settings from prose. Existing storage cloning and backup validation carry the union without an IndexedDB schema change. Every consumer continues to call `getEffectiveDialogueDelivery`.

**Tech Stack:** Existing React, TypeScript, Vitest, Testing Library, Playwright, IndexedDB and fflate; no new dependency.

**Spec:** `C:/Users/HomePC/.codex/attachments/2346c890-bd5b-4c02-b03d-6143252de84e/Pasted text.txt`, PR B only.

## Global Constraints

- Preserve the spoken line byte for byte, including whitespace, Filipino, English, Taglish, quotes and emoji.
- Preserve every v1 record and saved output. Never upgrade on load, preview, save or copy.
- Legacy UI supports removing each style, pace and gesture. Explicit replacement clears legacy presets, preserves custom notes and opens the new editor; it does not translate old choices.
- No default acting style. Empty settings generate no extra instruction. Each field can be cleared, and Clear All removes structured direction plus custom notes only.
- No edits to `src/domain/validation.ts`, ZIP64 architecture/limits, provider integrations or schema versions. No paid dependencies or synthesis APIs. Synthetic isolated browser contexts only.
- Work on `codex/advanced-performance-studio` based on `ae510d3b90f731c115eaf6f1daf261ebaec88981`; no commit/push/PR creation because signing needs the user's local passphrase.

## Representation

`DialoguePerformanceDirectionV1` retains `{version:1,styles,pace?,gestures?}`. `DialoguePerformanceDirectionV2` is `{version:2,emotion?,techniques?,customTechnique?,voice?,speech?,gestures?}`. Emotion has independent primary/secondary catalog IDs, optional intensity and bounded custom text. Voice and speech have optional named enum fields; speech also supports bounded free-text emphasis. Gestures and techniques are unique arrays. Catalog IDs are lower snake case. Unsupported keys, invalid enum values, non-string or overlong prose, duplicate selections, duplicate primary/secondary emotions and simultaneous whispered/murmured with shouted/screamed techniques are rejected. Mixed angry + sad is valid. No sequential delivery editor is added; custom technique prose can describe a sequential change. All generated sentences follow fixed field/catalog ordering; custom prose is appended exactly as authored when nonblank.

## Tasks

- [x] 1. Add failing domain tests for the full v2 example across all output paths, empty settings, catalog choices, incompatible extremes and Preflight metadata evidence. Add persistence tests for save/reload/copy/backup/restore, immutable outputs and malformed nested metadata. Run the relevant tests red.
- [x] 2. Add v2 types/catalogs/validation/formatter while leaving v1 behavior intact. Run domain and persistence tests green. Existing serializers keep their shared formatter; do not concatenate instructions elsewhere.
- [x] 3. Add failing component tests for collapsed/searchable groups, mixed emotions, optional voice/speech controls, removable selections, explicit legacy replacement and Clear All. Implement the responsive accordion UI with one actively opened group, compact summaries, catalog filtering and keyboard-native controls. Run component tests green.
- [x] 4. Update existing delivery UI tests to explicitly seed v1 records; retain their golden output assertions. Add v2 browser coverage for all exports, persistence, exact dialogue, keyboard/reduced motion and overflow at 1440x900, 768x1024, 390x844 and effective 200% reflow. Capture before/after screenshots with unchanged base source for before.
- [x] 5. Run all unit tests, typecheck, build, production audit, test:qa and complete Playwright suite on isolated port 4273. Record true results, source hashes, changed files, preservation evidence and limitations in `docs/performance-studio-qa.md` and `docs/qa/performance-studio/qa_results.json`, with a screenshot gallery. Keep logs/raw backups/profiles ignored.

## Review Focus

- Unknown nested fields must fail before draft writes or backup restore; tests assert existing library equality after rejected restore.
- Legacy styles such as energetic/apologetic/urgent must remain exact, removable and unconverted; tests assert v1 output and authoring metadata before/after UI interaction.
- Clearing a structured field must not trim custom prose or dialogue; component and persistence tests compare exact values.
- Duplicate/incompatible technique combinations from untrusted backups must fail even if UI prevents selecting them; domain and backup tests cover both.
- Long Unicode instructions/search queries must wrap at mobile width without changing stored text; browser screenshots and overflow checks cover all required widths.

## Verification

Execution ruling: emotion fields remain independently optional. If primary is removed, the existing secondary ID is retained in its original field and formatted as the single remaining emotion. This permits per-field removal without silently deleting or reassigning another authored choice; domain and component tests cover it.

`npm test`, `npm run typecheck`, `npm run build`, `npm audit --omit=dev`, `npm run test:qa`, `npx playwright test --config playwright.performance.local.mjs`. Each must exit 0; audit must report no production vulnerabilities. Any failure/skip is recorded with its actual reason.
