# Director's Handoff Briefing Tab & Script Editor MCP Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated **Director's Briefing** tab beside **Creator Mode** in the KRAKINAI Story Workspace (backed by Change-Set v7 and MCP `krakinai_stage_story`) and update the Phase 2 `story-script-editor` standalone skill to stage locked scripts, Creator Mode hierarchies, Color Scripts, and Director's Handoff Briefings directly into KRAKINAI's Story Section.

**Architecture:** We extend the `Story` domain model and `krakinai.change-set.v7` schema with an optional structured `directorBriefing: StoryDirectorBriefing` field covering all 4 sections produced by `story-script-editor` (Character/Wardrobe/Environment Continuity, Lighting & Mood Progression, Action & Emotion Archetypes, and Vocal & Performance Register, plus Pacing Audit Summary). We preserve the strict 45-tool MCP cap (`MCP_TOOL_NAMES.length === 45`) and `DB_VERSION = 4` by routing `directorBriefing` through the existing `krakinai_stage_story` and `krakinai_get_story` tools. On the frontend, we create `StoryDirectorBriefing.tsx` with full interactive CRUD editing and add the 3rd mode tab (`Director's Briefing`) beside `Book Mode` and `Creator Mode` in `StoryWorkspaceScreen.tsx`. Finally, we update `standalone_phase_2_skill_script_editor/SKILL.md` with the Option B MCP Story staging workflow.

**Tech Stack:** TypeScript, React 18, IndexedDB (`krakinai_stories_db`), Vitest, React Testing Library, Lucide React, Model Context Protocol (MCP).

**Spec:** Inline Architecture & Implementation Blueprint below.

## Global Constraints

- Preserve `DB_VERSION = 4` on `krakinai_prompt_library_db` and `STORIES_DB_VERSION = 1` on `krakinai_stories_db` (IndexedDB stores schemaless JS objects in `stories`, so optional `directorBriefing` is 100% backward-compatible without a version bump).
- Preserve the exact 45-tool array length in `MCP_TOOL_NAMES` (`src/domain/mcpProtocol.ts`). Do NOT add a 46th tool; extend `krakinai_stage_story` and `krakinai_get_story`.
- All AI writes must stage through `krakinai_review_inbox_db` (`ChangeSet` v7) and require human browser confirmation (`event.isTrusted`).
- Include `directorBriefing` in `storyDigestProjection` (`src/domain/storyValidator.ts`) so `expectedStoryDigest` concurrency protection covers briefing modifications.

## Review Focus

- Existing stories stored in IndexedDB without `directorBriefing` (`undefined`) must render cleanly in `StoryWorkspaceScreen` and `StoryDirectorBriefing` with an actionable empty state and zero runtime crashes.
- `computeStoryDigest` must produce identical digests for stories with `directorBriefing: undefined` vs omitted, or normalize consistently in `storyDigestProjection`.
- `krakinai_stage_story` in both `create` and `update` modes must validate and persist `directorBriefing` through `storyChangeSetSchema.ts` and `changeSetPlanner.ts`.
- `krakinai_get_story` must redact `directorBriefing` text fields when `scope.includeStoryText !== true`.
- Human edits to any of the 4 tables in the `Director's Briefing` tab must persist immediately via `saveStory` and increment/update the story state.

---

# 📐 Architecture & Implementation Blueprint

**Feature / Task:** Director's Handoff Briefing Tab (`StoryWorkspaceScreen`) & Option B MCP Story Staging in `story-script-editor`  
**Scope:** Full-Stack (Domain Types, Change-Set v7 Schema, MCP Staging/Reads, React UI Tab, Phase 2 Skill Spec)  
**Complexity:** Medium

---

## 1. Requirements & Acceptance Criteria
- **REQ-1 (Domain & Storage Contract):** Extend `Story` in `src/types/domain.ts` with `directorBriefing?: StoryDirectorBriefing` containing `pacingAuditSummary`, `continuityLocks`, `lightingProgression`, `actionArchetypes`, and `vocalRegister`.
- **REQ-2 (Change-Set v7 & Digest Integrity):** Allow `directorBriefing` on `story.create` and `story.update` operations in `src/types/changeSet.ts`, `src/domain/storyChangeSetSchema.ts`, and `src/domain/changeSetPlanner.ts`, and include `directorBriefing` in `storyDigestProjection` (`src/domain/storyValidator.ts`).
- **REQ-3 (MCP Read & Staging Support within 45-Tool Cap):** Extend `krakinai_stage_story` (`src/domain/mcpProtocol.ts`, `src/domain/mcpGranularStaging.ts`) to accept `directorBriefing`, and extend `krakinai_get_story` (`src/domain/mcpGranularReads.ts`) to support `projection: 'director_briefing'` (as well as returning `directorBriefing` in `'full'` projection, gated by `scope.includeStoryText`).
- **REQ-4 (Director's Briefing UI Tab):** Add a 3rd tab **"Director's Briefing"** beside **Book Mode** and **Creator Mode** in `src/screens/StoryWorkspaceScreen.tsx`, rendering `src/components/stories/StoryDirectorBriefing.tsx` with interactive add/edit/delete modals for all 4 handoff tables and pacing summary, plus rich sample data in `src/domain/sampleStory.ts`.
- **REQ-5 (Phase 2 `story-script-editor` Skill Update — Option B):** Update `C:\Users\HomePC\.gemini\config\skills\standalone_phase_2_skill_script_editor\SKILL.md` so that when a script passes (`STATUS: LOCKED_FOR_DIRECTOR`), the agent stages the locked story (`krakinai_stage_story` with `directorBriefing`, `krakinai_stage_story_structure`, `krakinai_stage_story_dramatic_meta`, `krakinai_stage_story_references`) into KRAKINAI's Story Section.

---

## 2. System Architecture Plan

### 2.1 Architectural Overview & Data Flow
```
┌────────────────────────────────────────────────────────────────────────────┐
│ Phase 2: story-script-editor (Outcome B: STATUS: LOCKED_FOR_DIRECTOR)      │
│ Outputs 02_locked_shooting_script.md + Stages Story via KRAKINAI MCP       │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ KRAKINAI MCP Bridge & Proposal Broker (krakinai.change-set.v7)             │
│ • krakinai_stage_story (title, prose, treatment, directorBriefing)         │
│ • krakinai_stage_story_structure (Act -> Sequence -> Scene -> Beat)        │
│ • krakinai_stage_story_dramatic_meta (Subtext, Inciting Incident, Climax)  │
│ • krakinai_stage_story_references (Color Script + Matched Library Assets)  │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │ Human Approval (event.isTrusted)
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ StoryWorkspaceScreen.tsx (3-Mode Authoring & Inspection Workspace)         │
│  [ 📖 Book Mode ]   [ ✨ Creator Mode ]   [ 📋 Director's Briefing ]       │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Models, Types & API Contracts

```ts
// src/types/domain.ts
export type StoryBriefingAssetKind = 'character' | 'wardrobe' | 'environment' | 'style' | 'camera';

export interface StoryContinuityLockEntry {
  id: string;
  assetType: StoryBriefingAssetKind;
  candidateRefOrId: string;
  description: string;
}

export interface StoryLightingProgressionEntry {
  id: string;
  beatRange: string;
  candidateRefOrId: string;
  setupAndMood: string;
}

export interface StoryActionArchetypeEntry {
  id: string;
  beatRange: string;
  candidateRefOrId: string;
  kinematicsAndIntensity: string;
}

export interface StoryVocalPerformanceEntry {
  id: string;
  character: string;
  beatId: string;
  emotion: string;
  deliveryTechnique: string;
  voiceCharacteristics: string;
  speechIntonation: string;
  bodyLanguage: string;
}

export interface StoryDirectorBriefing {
  pacingAuditSummary?: string;
  continuityLocks: StoryContinuityLockEntry[];
  lightingProgression: StoryLightingProgressionEntry[];
  actionArchetypes: StoryActionArchetypeEntry[];
  vocalRegister: StoryVocalPerformanceEntry[];
}
```

### 2.3 Security, Edge Cases & Failure Modes
| Risk / Edge Case | Architectural Mitigation |
|------------------|--------------------------|
| Legacy/manual stories lack `directorBriefing` | Optional `directorBriefing?: StoryDirectorBriefing` defaults gracefully to empty arrays in UI and `null` in `storyDigestProjection`. |
| Unauthorized MCP text read | `krakinai_get_story` checks `scope.includeStoryText === true` before returning `directorBriefing` contents; otherwise returns `textRedacted: true`. |
| Exceeding 45-tool MCP limit | Zero new tool names added; `directorBriefing` is integrated into `krakinai_stage_story` and `krakinai_get_story`. |

---

## 3. File Impact Manifest
- `[MODIFY]` `src/types/domain.ts` — Add `StoryDirectorBriefing` and sub-entry interfaces; add `directorBriefing?: StoryDirectorBriefing` to `Story`.
- `[MODIFY]` `src/types/changeSet.ts` — Add `directorBriefing?: StoryDirectorBriefing` to `StoryCreateOperation` and `StoryUpdateOperation`.
- `[MODIFY]` `src/domain/storyChangeSetSchema.ts` — Add `directorBriefingRule` JSON schema validation to `story.create` and `story.update`.
- `[MODIFY]` `src/domain/storyValidator.ts` — Include `directorBriefing: story.directorBriefing ?? null` in `storyDigestProjection` and validate briefing entries in `validateStoryInput`.
- `[MODIFY]` `src/domain/changeSetPlanner.ts` — Map `op.directorBriefing` in `story.create` and `story.update`.
- `[MODIFY]` `src/domain/mcpProtocol.ts` — Add `directorBriefing: { type: 'object' }` to `krakinai_stage_story` and add `'director_briefing'` to `krakinai_get_story` `projection` enum.
- `[MODIFY]` `src/domain/mcpGranularStaging.ts` — Pass `directorBriefing` in `stageStoryOperation` for both create and update modes.
- `[MODIFY]` `src/domain/mcpGranularReads.ts` — Support `projection === 'director_briefing'` and include `directorBriefing` in `'full'` projection when `includeStoryText` is enabled.
- `[CREATE]` `src/components/stories/StoryDirectorBriefing.tsx` — Interactive UI component rendering the 4 Director's Handoff Briefing tables, Pacing Audit banner, library asset match badges, and row/section editors.
- `[MODIFY]` `src/screens/StoryWorkspaceScreen.tsx` — Add the 3rd tab (`Director's Briefing`) beside `Creator Mode` and wire `StoryDirectorBriefing`.
- `[MODIFY]` `src/domain/sampleStory.ts` — Populate `directorBriefing` on `SAMPLE_STORY_CREATOR_MODE` (*Wool and Fang: The Timberline Snare*).
- `[MODIFY]` `C:\Users\HomePC\.gemini\config\skills\standalone_phase_2_skill_script_editor\SKILL.md` — Add Option B MCP Story Section staging protocol when a script reaches `STATUS: LOCKED_FOR_DIRECTOR`.
- `[MODIFY]` `src/__tests__/storyMcpTools.test.ts` — Add unit tests for staging and reading `directorBriefing` via MCP.
- `[MODIFY]` `src/__tests__/storyWorkspaceUi.test.tsx` — Add UI tests for switching to the `Director's Briefing` tab, viewing the 4 tables, and adding/editing briefing rows.

---

## 4. Step-by-Step Implementation Tasks

### Task 1: Domain Types, Digest, Change-Set v7 Schema & Planner Support

**Files:**
- Modify: `src/types/domain.ts:480-504`
- Modify: `src/types/changeSet.ts:240-278`
- Modify: `src/domain/storyValidator.ts:135-226`
- Modify: `src/domain/storyChangeSetSchema.ts:130-203`
- Modify: `src/domain/changeSetPlanner.ts:238-312`
- Test: `src/__tests__/storyStorageAndValidation.test.ts`

**Interfaces:**
- Produces: `StoryDirectorBriefing`, `StoryContinuityLockEntry`, `StoryLightingProgressionEntry`, `StoryActionArchetypeEntry`, `StoryVocalPerformanceEntry` in `src/types/domain.ts`.

- [ ] **Step 1: Write the failing test in `src/__tests__/storyStorageAndValidation.test.ts`**

```ts
it('validates and computes digest including directorBriefing when present', () => {
  const baseStory = createValidStory();
  const digestWithout = computeStoryDigest(baseStory);
  const withBriefing: Story = {
    ...baseStory,
    directorBriefing: {
      pacingAuditSummary: 'All beats verified <= 10s',
      continuityLocks: [
        { id: 'cl-1', assetType: 'character', candidateRefOrId: 'char-kael', description: 'Silver wolf raider' },
      ],
      lightingProgression: [
        { id: 'lp-1', beatRange: 'BEAT-01-03', candidateRefOrId: 'light-dawn', setupAndMood: 'Cold slate mist' },
      ],
      actionArchetypes: [
        { id: 'aa-1', beatRange: 'BEAT-01', candidateRefOrId: 'act-prowl', kinematicsAndIntensity: 'Low crouch' },
      ],
      vocalRegister: [
        {
          id: 'vr-1',
          character: 'Kael',
          beatId: 'BEAT-01',
          emotion: 'Torn',
          deliveryTechnique: 'Raspy whisper',
          voiceCharacteristics: 'Low baritone',
          speechIntonation: 'Falling cadence',
          bodyLanguage: 'Claws dug into loam',
        },
      ],
    },
  };
  validateStoryInput(withBriefing);
  const digestWith = computeStoryDigest(withBriefing);
  expect(digestWith).not.toBe(digestWithout);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run src/__tests__/storyStorageAndValidation.test.ts`
Expected: FAIL (digest does not change because `directorBriefing` is not in `storyDigestProjection`).

- [ ] **Step 3: Implement types, schema rules, digest projection, and planner mapping**

Add `StoryDirectorBriefing` interfaces to `src/types/domain.ts` and `src/types/changeSet.ts`, update `storyDigestProjection` in `src/domain/storyValidator.ts`, add `directorBriefingRule` in `src/domain/storyChangeSetSchema.ts`, and map `op.directorBriefing` in `src/domain/changeSetPlanner.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run src/__tests__/storyStorageAndValidation.test.ts`
Expected: PASS

---

### Task 2: MCP Protocol (`krakinai_stage_story` & `krakinai_get_story`) Integration

**Files:**
- Modify: `src/domain/mcpProtocol.ts:271-292`
- Modify: `src/domain/mcpGranularStaging.ts:1744-1797`
- Modify: `src/domain/mcpGranularReads.ts:730-832`
- Test: `src/__tests__/storyMcpTools.test.ts`

**Interfaces:**
- Consumes: `StoryDirectorBriefing` from Task 1.
- Produces: `directorBriefing` parameter on `krakinai_stage_story` and `'director_briefing'` projection on `krakinai_get_story`.

- [ ] **Step 1: Write the failing test in `src/__tests__/storyMcpTools.test.ts`**

```ts
it('stages directorBriefing via krakinai_stage_story and reads it via krakinai_get_story projection', async () => {
  const res = await broker.handleCommand(sessionId, {
    requestId: 'req-briefing-1',
    tool: 'krakinai_stage_story',
    args: {
      changeSetId: 'cs-story-briefing',
      clientRef: 'story-briefing-1',
      mode: 'create',
      title: 'Briefing Test Story',
      directorBriefing: {
        pacingAuditSummary: 'Verified 5-10s Omni pacing.',
        continuityLocks: [
          { id: 'cl-1', assetType: 'character', candidateRefOrId: 'char-kael', description: 'Lean silver wolf' },
        ],
        lightingProgression: [],
        actionArchetypes: [],
        vocalRegister: [],
      },
    },
  });
  expect(res.ok).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run src/__tests__/storyMcpTools.test.ts`
Expected: FAIL with `INVALID_REQUEST` (unexpected field `directorBriefing` in `krakinai_stage_story`).

- [ ] **Step 3: Update `mcpProtocol.ts`, `mcpGranularStaging.ts`, and `mcpGranularReads.ts`**

Add `directorBriefing: { type: 'object' }` ( plus optional `acts`, `colorScript`, `referencePack` on `krakinai_stage_story`), wire `args.directorBriefing` in `stageStoryOperation`, and add `'director_briefing'` projection in `mcpGetStory`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run src/__tests__/storyMcpTools.test.ts`
Expected: PASS

---

### Task 3: Director's Briefing UI Tab (`StoryDirectorBriefing.tsx` & `StoryWorkspaceScreen.tsx`) + Sample Story Data

**Files:**
- Create: `src/components/stories/StoryDirectorBriefing.tsx`
- Modify: `src/screens/StoryWorkspaceScreen.tsx:85-95,795-930`
- Modify: `src/domain/sampleStory.ts`
- Test: `src/__tests__/storyWorkspaceUi.test.tsx`

**Interfaces:**
- Consumes: `Story`, `StoryDirectorBriefing` from `src/types/domain.ts`.
- Produces: `StoryDirectorBriefing` component with `story: Story`, `assets: PromptAsset[]`, `onUpdateStory: (updated: Story) => Promise<void>`.

- [ ] **Step 1: Write the failing test in `src/__tests__/storyWorkspaceUi.test.tsx`**

```tsx
it('renders Director\'s Briefing tab beside Creator Mode and allows adding briefing entries', async () => {
  await saveStory(SAMPLE_STORY_CREATOR_MODE);
  renderWorkspace('story_wool_and_fang');

  const briefingTab = await screen.findByRole('tab', { name: /Director's Briefing/i });
  fireEvent.click(briefingTab);

  expect(await screen.findByText(/Character, Wardrobe & Environment Continuity/i)).toBeInTheDocument();
  expect(screen.getByText(/Lighting & Mood Progression/i)).toBeInTheDocument();
  expect(screen.getByText(/Action & Emotion Archetypes/i)).toBeInTheDocument();
  expect(screen.getByText(/Vocal & Performance Register/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run src/__tests__/storyWorkspaceUi.test.tsx`
Expected: FAIL (unable to find tab with name `/Director's Briefing/i`).

- [ ] **Step 3: Implement `StoryDirectorBriefing.tsx`, wire tab in `StoryWorkspaceScreen.tsx`, and enrich `sampleStory.ts`**

Build `StoryDirectorBriefing.tsx` with:
1. Pacing Audit Summary banner & edit modal.
2. Table 1: Character, Wardrobe & Environment Continuity (`+ Add Continuity Lock`, edit/delete rows, resolved library asset badge if `candidateRefOrId` matches an existing `PromptAsset`).
3. Table 2: Lighting & Mood Progression (`+ Add Lighting Setup`, edit/delete rows).
4. Table 3: Action & Emotion Archetypes (`+ Add Action Archetype`, edit/delete rows).
5. Table 4: Vocal & Performance Register (`+ Add Vocal Cue`, edit/delete rows).
6. Add **"✨ Seed Sample Briefing"** empty-state helper when a newly created story has an empty briefing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run src/__tests__/storyWorkspaceUi.test.tsx`
Expected: PASS

---

### Task 4: Update Phase 2 Standalone Skill (`story-script-editor/SKILL.md`) for Option B Story Section Staging

**Files:**
- Modify: `C:\Users\HomePC\.gemini\config\skills\standalone_phase_2_skill_script_editor\SKILL.md`

- [ ] **Step 1: Add Stage 2B (KRAKINAI Story Section MCP Staging) to `SKILL.md`**

Document the exact deterministic MCP workflow executed whenever Outcome B (`STATUS: LOCKED_FOR_DIRECTOR`) is reached:
1. Check `krakinai_connection_status` (`allowStoryProposals`).
2. Check existing stories via `krakinai_list_stories` and existing library assets via `krakinai_resolve_library_assets`.
3. Stage the locked Story into KRAKINAI using `krakinai_stage_story` (including `directorBriefing`), `krakinai_stage_story_structure` (`Act -> Sequence -> Scene -> Beat`), `krakinai_stage_story_dramatic_meta`, and `krakinai_stage_story_references` (`colorScript` + matched `referencePack.assetIds`).
4. Verify proposal status via `krakinai_get_proposal_status` and present the staged Proposal ID alongside `02_locked_shooting_script.md`.

- [ ] **Step 2: Verify full test suite, typecheck, and build**

Run: `npx.cmd vitest run src/__tests__/story ; npm.cmd run typecheck ; npm.cmd run build`
Expected: All tests pass, 0 TypeScript errors, clean production build.

---

## 5. QA Hand-Off & Traceability Matrix
| Req ID | Implemented In (`filepath`) | Verified By Test (`testpath`) |
|--------|-----------------------------|-------------------------------|
| REQ-1  | `src/types/domain.ts`, `src/domain/storyValidator.ts` | `src/__tests__/storyStorageAndValidation.test.ts` |
| REQ-2  | `src/types/changeSet.ts`, `src/domain/storyChangeSetSchema.ts`, `src/domain/changeSetPlanner.ts` | `src/__tests__/storyChangeSetAndScope.test.ts` |
| REQ-3  | `src/domain/mcpProtocol.ts`, `src/domain/mcpGranularStaging.ts`, `src/domain/mcpGranularReads.ts` | `src/__tests__/storyMcpTools.test.ts` |
| REQ-4  | `src/components/stories/StoryDirectorBriefing.tsx`, `src/screens/StoryWorkspaceScreen.tsx`, `src/domain/sampleStory.ts` | `src/__tests__/storyWorkspaceUi.test.tsx` |
| REQ-5  | `C:\Users\HomePC\.gemini\config\skills\standalone_phase_2_skill_script_editor\SKILL.md` | Manual & Skill Inspection |
