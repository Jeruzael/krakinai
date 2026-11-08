# Recipe Slot & Performance Studio Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make agent-staged storyboards fill in Action & Emotion, Lighting & Mood and Performance Studio automatically, without KRAKINAI making up content.

**Architecture:** An additive catalog read gives agents every valid Performance Studio ID. One shared `normalizeDialogueCue()` sanitizes `performanceDirection` v2. Staging returns slot-coverage `warnings` instead of inventing assets. The four story skills are updated so the agent authors real `action`/`lighting` candidates and structured per-cue performance.

**Tech Stack:** TypeScript, Vitest, React 18 (no UI change), Markdown skills.

**Spec:** `docs/superpowers/specs/2026-11-09-recipe-slot-and-performance-automation-design.md`

## Global Constraints

- MCP tool count stays **38**. No new tool names, no input-schema key changes in `src/domain/mcpProtocol.ts`.
- `readCatalogPresets('performance')` existing keys (`emotions`, `emotionalIntensities`, `deliveryStyles`, `speakingPaces`, `bodyLanguage`, `techniques`, `voiceFields`, `speechFields`, `gestures`) keep their current values. New keys are additive only.
- Never create, link or approve an asset server-side to satisfy assembly (AGENTS.md).
- Normalized `performanceDirection` must pass `validatePerformanceDirection` (`src/domain/dialoguePerformance.ts:60`). Values that can't be mapped are dropped and reported, never guessed.
- Change-set contracts v1–v6 unchanged. Commit with `git commit --no-gpg-sign`.

## Review Focus

1. Label vs ID input (`"Joyful"`, `"Laughing while speaking"`, `"BREATHY"`) → maps to `joyful`, `laughing_while_speaking`, `breathy`. *(Task 2 test)*
2. `primary === secondary` emotion → drop `secondary`, warn. Otherwise validation rejects the whole cue. *(Task 2 test)*
3. `whispered` + `shouted` together → keep first in input order, warn. *(Task 2 test)*
4. `property_environment` scene without action → **no** `SLOT_REQUIRED_MISSING` warning (action is not required there). *(Task 3 test)*
5. Scene whose `action` comes through `assetRefs` by `id` (existing library record) instead of `ref` → counts as covered. *(Task 3 test)*

---

### Task 1: Expand performance catalog read

**Files:**
- Modify: `src/domain/mcpGranularReads.ts:153-166`
- Test: `src/__tests__/mcpGranularReads.test.ts`

**Interfaces:**
- Produces: `readCatalogPresets(..., {catalog:'performance'})` additionally returns
  `emotionGroups: Record<string, Record<EmotionId,string>>`, `techniqueOptions: Record<TechniqueId,string>`, `voiceOptions: Record<keyof VOICE_FIELDS, Record<string,string>>`, `speechOptions: Record<keyof SPEECH_FIELDS, Record<string,string>>`, `gestureOptions: Record<BodyGesture,string>`, and `performanceDirectionExample` (a valid v2 object).

- [ ] **Step 1: Write failing test** `it('exposes every Performance Studio option ID for agents')`:
  ```ts
  const r = readCatalogPresets(snapshot, scope, { catalog: 'performance' }) as any;
  expect(r.voiceOptions.texture.breathy).toBe('Breathy');
  expect(r.speechOptions.pauses.dramatic).toBe('Dramatic');
  expect(r.emotionGroups['Sad / Vulnerable'].heartbroken).toBe('Heartbroken');
  expect(r.techniqueOptions.laughing_while_speaking).toBe('Laughing while speaking');
  expect(r.gestureOptions.open_palm).toBe('Open-palm gestures');
  expect(validatePerformanceDirection(r.performanceDirectionExample)).toBeUndefined();
  expect(r.voiceFields).toEqual(Object.keys(VOICE_FIELDS)); // unchanged
  ```
- [ ] **Step 2:** `npx.cmd vitest run src/__tests__/mcpGranularReads.test.ts`. Expected: FAIL (`voiceOptions` undefined).
- [ ] **Step 3:** Add the keys. Build `voiceOptions`/`speechOptions` by mapping each field to its `.options`. Example: `{version:2, emotion:{primary:'excited',intensity:'strong'}, techniques:['conversational'], voice:{tone:'warm'}, speech:{pace:'fast'}, gestures:['expressive']}`.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Update `docs/manual/10-technical-mcp-reference.md` (performance catalog section) to list the new keys. Run `npx.cmd vitest run src/__tests__/manualDocsIntegrity.test.ts`. Expected: PASS.
- [ ] **Step 6:** Commit `feat(mcp): expose full Performance Studio option IDs in performance catalog`.

---

### Task 2: Performance direction normalizer + shared cue builder

**Files:**
- Modify: `src/domain/mcpGranularStaging.ts` (cue blocks near lines 786-852 and 981-1065)
- Test: `src/__tests__/mcpGranularStaging.test.ts`

**Interfaces:**
- Produces (exported from `mcpGranularStaging.ts`):
  - `normalizePerformanceDirection(raw: unknown): { value?: DialoguePerformanceDirectionV2; warnings: string[] }`
  - `normalizeDialogueCue(raw: Record<string,unknown>, index: number, ctx: { castIds: Set<string>; cast: any[]; maxDuration: number; defaultId?: string }): { cue: DialogueCue; warnings: string[] }`. This covers id/speaker/line/timing clamp, participant auto-heal (existing logic, moved here unchanged), and performanceDirection.
- Behaviour pinned:
  - Lookup is case-insensitive on ID **or** label for emotions, intensities, techniques, voice/speech option values and gestures. Spaces and hyphens become `_` when matching IDs.
  - Missing `version` → `2`. A legacy v1 object (`{version:1,styles,...}`) passes through unchanged if `validatePerformanceDirection` accepts it.
  - Unmappable value → removed, warning `performanceDirection.<path>: "<value>" is not a catalog option`.
  - `secondary === primary` → drop secondary, warn.
  - Quiet/loud conflict (`conflictingTechnique`) → keep the earlier one, drop later ones, warn.
  - Free text (`emotion.custom`, `customTechnique`, `speech.emphasis`) longer than 1000 chars → truncated to 1000, warn.
  - If nothing valid remains → `value` undefined.
  - Final `value` must satisfy `validatePerformanceDirection(value) === undefined`.

- [ ] **Step 1: Write failing tests** in `describe('normalizePerformanceDirection')`:
  - `it('maps labels and casing to catalog IDs and defaults version 2')`: input `{emotion:{primary:'Joyful',intensity:'STRONG'},techniques:['Laughing while speaking'],voice:{texture:'Breathy'},speech:{pauses:'dramatic'},gestures:['Open-palm gestures']}` → `value` equals `{version:2,emotion:{primary:'joyful',intensity:'strong'},techniques:['laughing_while_speaking'],voice:{texture:'breathy'},speech:{pauses:'dramatic'},gestures:['open_palm']}`, `warnings` is `[]`.
  - `it('drops duplicate secondary emotion and conflicting loud technique with warnings')`: `{emotion:{primary:'sad',secondary:'Sad'},techniques:['whispered','shouted']}` → `emotion` is `{primary:'sad'}`, `techniques` is `['whispered']`, `warnings.length === 2`.
  - `it('drops unknown values and returns undefined when nothing valid remains')`: `{emotion:{primary:'ecstatic-ish'}}` → `value` undefined, 1 warning.
- [ ] **Step 2: Write failing integration test** `it('stages dialogue cues with normalized performanceDirection that passes change-set validation')`: call `stageSceneRecipeOperation` with an ensemble (participant `amber`) and `dialogueCues:[{speaker:'Amber',participantId:'amber',line:'Dragon Slayer ako!',performanceDirection:{emotion:{primary:'Proud'},techniques:['Shouted']}}]`. Assert the cue's `performanceDirection` is `{version:2,emotion:{primary:'proud'},techniques:['shouted']}` and `parseChangeSet(result.changeSet)` does not throw.
- [ ] **Step 3:** `npx.cmd vitest run src/__tests__/mcpGranularStaging.test.ts`. Expected: FAIL.
- [ ] **Step 4:** Implement both functions. Replace the four inline cue blocks in `stageSceneRecipeOperation` (dialogueCues + single dialogue) and `stageSceneDialogueOperation` (dialogueCues + single dialogue) with `normalizeDialogueCue`. Define `StagingWarning` here (shape in Task 3's Interfaces). Wrap normalizer strings as `{code:'PERFORMANCE_NORMALIZED', operationId, message}`, and wrap participant auto-heal drops as `CUE_PARTICIPANT_UNLINKED`. Return them as `warnings: StagingWarning[]` (Task 3 surfaces them).
- [ ] **Step 5:** Re-run the staging tests, plus `src/__tests__/proposalReviewWorkspace.test.tsx`. Expected: all PASS (existing participant auto-heal behaviour unchanged).
- [ ] **Step 6:** Commit `feat(staging): normalize Performance Studio direction on staged dialogue cues`.

---

### Task 3: Slot-coverage warnings surfaced through MCP

**Files:**
- Modify: `src/domain/mcpGranularStaging.ts` (`stageSceneRecipeOperation`, `stageSceneDialogueOperation`, `stageStoryboardBatchOperation` return types)
- Modify: `src/connections/proposalBroker.ts:440-449` (staging result payload)
- Test: `src/__tests__/mcpGranularStaging.test.ts`, `src/__tests__/proposalReviewBroker.test.ts`

**Interfaces:**
- Consumes: `normalizeDialogueCue` warnings (Task 2).
- Produces:
  - `export function sceneSlotCoverageWarnings(op: RecipeSceneOperation): StagingWarning[]`
  - *(Declared in Task 2, exported from `mcpGranularStaging.ts`)* `export interface StagingWarning { code: 'SLOT_REQUIRED_MISSING'|'SLOT_OPTIONAL_UNASSIGNED'|'PERFORMANCE_NORMALIZED'|'CUE_PARTICIPANT_UNLINKED'; operationId: string; slot?: BuilderSlot; message: string }`
  - The staging functions return `{ changeSet, operationId, warnings: StagingWarning[] }`. Batch staging concatenates warnings from every scene.
  - The broker's staging response adds `warnings` (an empty array when there are none).
- Rules: use `getShotTypeRules({shotType: op.shotType, extraRequiredSlots: []}).requiredSlots`. A slot counts as covered if any `assetRefs[].slot` or `variantRefs[].slot` matches (by `id` or `ref`). Required slot missing → `SLOT_REQUIRED_MISSING`. For `character_scene`, missing `lighting` → `SLOT_OPTIONAL_UNASSIGNED`. Messages name the slot label from `SLOT_LABELS` and tell the agent to fix it: `Bind an existing <Label> record or propose a <kind> candidate via assetRefs`. No operation is changed.

- [ ] **Step 1: Write failing tests:**
  - `it('warns when a character_scene lacks action and lighting')`: scene with only environment+style refs → warnings contain `{code:'SLOT_REQUIRED_MISSING',slot:'action'}` and `{code:'SLOT_OPTIONAL_UNASSIGNED',slot:'lighting'}`. Assert `assetRefs` is unchanged (length 2).
  - `it('does not warn for property_environment without action')`: zero `SLOT_REQUIRED_MISSING`.
  - `it('treats an id-bound existing action asset as covered')`: `assetRefs:[{slot:'action',asset:{id:'act-1'},expectedRevision:2}, ...]` → no action warning.
  - `it('aggregates warnings across a storyboard batch')`: 2 scenes missing action → 2 `SLOT_REQUIRED_MISSING` warnings with different `operationId`s.
- [ ] **Step 2:** In `proposalReviewBroker.test.ts`, add `it('returns staging warnings in the stage tool result')`: stage a scene missing action through the broker's `krakinai_stage_scene_recipe` handler and assert `data.warnings[0].code === 'SLOT_REQUIRED_MISSING'`.
- [ ] **Step 3:** Run both test files. Expected: FAIL.
- [ ] **Step 4:** Implement it. In the broker, read `staged.warnings ?? []` and add it to the `resultData` payload next to `stagedOperationId`.
- [ ] **Step 5:** Re-run. Expected: PASS. Then run the full gate: `npm.cmd run typecheck`, `npm.cmd --prefix bridge run typecheck`, `npm.cmd --prefix bridge test` (75 pass, tool count 38), `npx.cmd vitest run`, `npm.cmd run build`.
- [ ] **Step 6:** Document `warnings` in `docs/manual/10-technical-mcp-reference.md` under the staging tools. Commit `feat(mcp): report recipe slot coverage and cue normalization warnings on staging`.

---

### Task 4: Story skill updates (Phases 1–4)

**Files** (outside repo, not committed to git; verify by reading back):
- Modify: `C:/Users/HomePC/.gemini/config/skills/standalone_phase_1_skill_screenwriter/SKILL.md`
- Modify: `C:/Users/HomePC/.gemini/config/skills/standalone_phase_2_skill_script_editor/SKILL.md`
- Modify: `C:/Users/HomePC/.gemini/config/skills/standalone_phase_3_skill_director/SKILL.md`
- Modify: `C:/Users/HomePC/.gemini/config/skills/standalone_phase_4_skill_krakinai_setup/SKILL.md`

**Interfaces:**
- Consumes: catalog keys (Task 1), `warnings` codes (Task 3).
- Produces (the Phase 3 → Phase 4 JSON contract):
  - Top level: `action_library: [{ref, title, promptText, tags}]`, `lighting_library: [{ref, title, promptText, tags}]`.
  - Per shot: `action_ref`, `lighting_ref`, `dialogue_cues: [{speaker, participant, line, performance: {emotion:{primary,secondary?,intensity?}, techniques[], voice{}, speech{}, gestures[]}}]`. All values are catalog **IDs**.

- [ ] **Step 1: Screenwriter.** In the Beat format, require every dialogue parenthetical to state emotion + delivery + voice quality + gesture, e.g. `*(proud, shouted, bright projected voice, fist raised)*`. Add a rule: no dialogue line without a parenthetical.
- [ ] **Step 2: Script Editor.** Add `Lighting & Mood Progression` and `Vocal & Performance Register` bullets to the Director's Handoff Briefing template. Add an audit check that flags dialogue missing parentheticals as `Category: Performance`.
- [ ] **Step 3: Director.** Add a section "Action & Emotion, Lighting & Mood, Performance Studio". It covers: define reusable action archetypes and lighting setups once (reuse across shots), give every shot `action_ref` + `lighting_ref`, and give every spoken line a `performance` object using IDs from `krakinai_list_catalog_presets({catalog:"performance"})` (`emotionGroups`, `techniqueOptions`, `voiceOptions`, `speechOptions`, `gestureOptions`). Extend the JSON example (SHOT_06) with these fields. Bump the version to 2.2.0.
- [ ] **Step 4: KRAKINAI Setup.** (a) Add "Required recipe slots" rule: every `character_scene` binds `environment`, `action`, `lighting` and `style` in `assetRefs`. Resolve action/lighting via `krakinai_resolve_library_assets` first (`kind:"action"`, `kind:"lighting"`), else propose candidates (`kind:"action"|"lighting"`). (b) Update the batch JSON template: add one action and one lighting asset to `assets`, add `{slot:"action"}` and `{slot:"lighting"}` refs to both example scenes, and add `performanceDirection` v2 to both example cues. (c) Add "Stage warnings gate": after each stage call, any `SLOT_REQUIRED_MISSING` must be fixed and re-staged before writing `04_krakinai_setup_report.md`. List `SLOT_OPTIONAL_UNASSIGNED`/`PERFORMANCE_NORMALIZED` in the report.
- [ ] **Step 5: Verify.** `Select-String` each file for `action_ref`, `lighting_ref`, `performanceDirection`, `SLOT_REQUIRED_MISSING` (Phase 3/4) and `Lighting & Mood Progression` (Phase 2). Expected: every term present in its file. Validate the Phase 4 JSON example by pasting it into a scratch `.json` file and running `node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" <file>`. Expected: exit 0.

---

### Task 5: Final verification & push

- [ ] **Step 1:** `npm.cmd run typecheck`, `npm.cmd --prefix bridge run typecheck`, `npm.cmd --prefix bridge test`, `npx.cmd vitest run`, `npm.cmd run build`. Expected: all exit 0, tool count still 38.
- [ ] **Step 2:** `git status` clean except intended files, then `git push origin codex/proposal-review-ui-redesign`.
- [ ] **Step 3:** Manual QA on a synthetic isolated library: stage one `character_scene` without action and confirm the warning comes back. Re-stage with action+lighting+performance and confirm the Recipe tab shows Action & Emotion / Lighting & Mood selected and the cue's Performance Studio sections are filled in.
