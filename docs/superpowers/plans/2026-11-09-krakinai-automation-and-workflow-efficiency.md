# KrakinAI Automation, Smart Asset Resolution, Session Persistence & One-Click Full Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate manual per-asset "create vs. reuse" selection during proposal review, add an MCP asset-resolution tool and smart batch auto-binding, extend active MCP sessions to 3+ hours (staying alive until the browser tab or server closes), and make "Full Access" immediately check and grant all permissions (including Blocking and Frame/Image scopes) for one-click application.

**Architecture:**
1. **Smart Asset Auto-Resolution & Pre-Approval (`mcpGranularReads.ts`, `mcpGranularStaging.ts`, `changeSetPlanner.ts`, `proposalBroker.ts`):** Add `krakinai_resolve_library_assets` so agents can match story entities against the library in one call. Enhance `stageStoryboardBatchOperation` to auto-link existing assets/variants when unchanged and auto-heal uncast dialogue cue `participantId`s. Enhance `ProposalBroker` and `planChangeSet` with `buildSmartInitialApproval` so incoming proposals pre-select `reuse` (with exact `assetId` and `expectedRevision`) for matched library assets and `create` for new assets instead of defaulting to `defer` (which caused `DEPENDENCY_BLOCKED` on every scene).
2. **Extended Session Persistence (`mcpProtocol.ts`, `relay.ts`, `browserTransport.ts`, `proposalBroker.ts`, `AiConnectionContext.tsx`):** Increase `idleMs` to 3 hours (`10_800_000` ms) and `sessionMs` to 12 hours (`43_200_000` ms), with sliding activity renewal on every authenticated browser poll (`/v1/session/poll`) so an open browser tab stays connected indefinitely until the tab is closed (`pagehide`/`beforeunload`) or the server stops.
3. **One-Click Full Access Permissions (`mcpPermissionDraft.ts`, `PermissionsWorkspace.tsx`):** Update `presetPermissionDraft('full', ...)` to automatically enable `version: 3` (when disconnected) and check all record categories, sensitive disclosures, proposal capabilities, Blocking grants (`blockingSceneIds`, `allowBlockingProposals`), and Frame/Image grants (`keyframeSceneIds`, `imagePromptFrameGrants`, `allowKeyframeProposals`, `allowFrameImageProposals`, `allowImagePromptDerivation`). Remove the intermediate confirmation modal on "Full Access" so clicking "Full Access" checks everything immediately and clicking "Apply Permissions" applies it all.
4. **Skill Pipeline Alignment (`story-director`, `story-krakinai-setup`):** Update Phase 3 and Phase 4 skills to run library asset resolution upfront and rely on automated reuse/create binding.

**Tech Stack:** TypeScript, React 18, Vitest, Node.js HTTP Loopback Relay (`bridge/`).

---

## Global Constraints

- Preserve existing Stage B atomic write guarantees: human click on "Apply reviewed batch" in the browser remains the final commit trigger, but all asset decisions (`reuse` vs `create`) and approval checkboxes (`storyboard`, `scenes`) are pre-populated so a conflict-free proposal is ready for 1-click apply.
- When already connected in `v1` or `v2` pairing mode, clicking "Full Access" must grant all fields supported by the active pairing version without throwing `CAPABILITY_REQUIRED`; when disconnected, "Full Access" upgrades the draft to `version: 3` so the next pairing includes Blocking and Keyframe capabilities automatically.
- `MCP_LIMITS.idleMs` must be at least `10_800_000` (3 hours) and `MCP_LIMITS.sessionMs` must be `43_200_000` (12 hours), with poll requests refreshing session activity.
- Rebuild `bridge/dist/` when `src/domain/mcpProtocol.ts` or `bridge/src/relay.ts` changes so the standalone/desktop bridge uses the updated limits and tool schemas.

## Review Focus

- Existing character with slightly different title casing or suffix (e.g., `"Silvester Vale"` vs `"Silvester Vale (Base Character)"`): normalized title/tag matching in `krakinai_resolve_library_assets` and `findCandidateMatches` must still match and pre-select `reuse`.
- Brand-new character or wardrobe with no library match: must default to `action: "create"` instead of `action: "defer"` so dependent scenes assemble immediately with 0 `DEPENDENCY_BLOCKED` errors.
- Candidate with a library match where the agent explicitly proposes a new asset (e.g., duplicate acknowledged): must set `acknowledgeDuplicate: true` when `action === "create"` so `DUPLICATE_ASSET` does not block assembly.
- Dialogue cue referencing an off-screen speaker or uncast character ID in `stageSceneRecipeOperation`: must automatically unlink `participantId` (for off-screen/narration) or auto-cast from staged batch assets so `DOMAIN_RULE` never blocks assembly.
- Clicking "Full Access" while disconnected vs. while connected: must immediately check all applicable checkboxes in `PermissionsWorkspace` without a modal dialog, and clicking "Apply Permissions" must apply them cleanly.

---

### Task 1: One-Click "Full Access" Permission Preset & Immediate UI Selection

**Files:**
- Modify: `src/domain/mcpPermissionDraft.ts`
- Modify: `src/components/aiConnections/PermissionsWorkspace.tsx`
- Test: `src/__tests__/mcpPermissionDraft.test.ts`
- Test: `src/__tests__/aiConnectionsScreen.test.tsx`

**Interfaces:**
- Modify `presetPermissionDraft(preset: 'minimal' | 'creative' | 'full', scope: McpScope, state: ChangeSetState, options?: { connected?: boolean }): McpScope` in `src/domain/mcpPermissionDraft.ts`.
- When `preset === 'full'`:
  - Target version is `options?.connected ? scope.version : 3`.
  - Selects all records across `PERMISSION_FIELDS` (clamped to `MCP_SCOPE_LIMITS`), `fullPromptSceneIds`, and `receiptGrants`.
  - Sets all `DISCLOSURE_FIELDS` and `CAPABILITY_FIELDS` to `true`.
  - If target version `>= 2`, selects all `blockingSceneIds` and sets `allowBlockingProposals = true`.
  - If target version `=== 3`, selects all `keyframeSceneIds`, all `imagePromptFrameGrants`, and sets `allowKeyframeProposals = true`, `allowFrameImageProposals = true`, `allowImagePromptDerivation = true`.
- In `PermissionsWorkspace.tsx`:
  - Replace `proposeFullAccess` modal workflow with immediate draft update: `edit(s => presetPermissionDraft('full', s, snapshot, { connected: phase === 'connected' }), 'Full Access')`.

- [ ] **Step 1: Write failing tests in `src/__tests__/mcpPermissionDraft.test.ts` and `src/__tests__/aiConnectionsScreen.test.tsx`**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement `presetPermissionDraft` and `PermissionsWorkspace.tsx` updates**
- [ ] **Step 4: Run tests to verify pass**
- [ ] **Step 5: Commit**

---

### Task 2: 3+ Hour Session Persistence & Browser Lifecycle Heartbeat

**Files:**
- Modify: `src/domain/mcpProtocol.ts`
- Modify: `bridge/src/relay.ts`
- Modify: `src/connections/browserTransport.ts`
- Modify: `src/connections/proposalBroker.ts`
- Modify: `src/connections/AiConnectionContext.tsx`
- Test: `bridge/test/relay.test.ts`
- Test: `src/__tests__/proposalBroker.test.ts`

**Interfaces:**
- In `src/domain/mcpProtocol.ts`:
  - Update `MCP_LIMITS`: `sessionMs: 43200000` (12 hours), `idleMs: 10800000` (3 hours).
- In `bridge/src/relay.ts`:
  - On `/v1/session/poll`, update `current.activity = now()` in addition to `current.seen = now()`, and slide `current.created` or deadline forward so active browser tabs never expire prematurely.
- In `src/connections/proposalBroker.ts` & `src/connections/browserTransport.ts`:
  - Add `touchActivity()` on `ProposalBroker` called by `BrowserTransport` during poll cycles so `this.#activity` and `this.#deadline` stay alive while the browser tab is open.
- In `src/connections/AiConnectionContext.tsx`:
  - Register a `window.addEventListener('pagehide', ...)` / `beforeunload` handler that calls `transportRef.current?.disconnect('Browser tab closed.')` when the tab/window closes.

- [ ] **Step 1: Write failing tests for 3-hour idle limit and poll activity keepalive**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Update `MCP_LIMITS`, `relay.ts`, `browserTransport.ts`, `proposalBroker.ts`, and `AiConnectionContext.tsx`, and rebuild `bridge/`**
- [ ] **Step 4: Run tests to verify pass**
- [ ] **Step 5: Commit**

---

### Task 3: Smart Asset Auto-Resolution, Default Reuse/Create Pre-Approval & Dialogue Cue Guard

**Files:**
- Modify: `src/domain/mcpProtocol.ts`
- Modify: `src/domain/mcpGranularReads.ts`
- Modify: `src/domain/mcpGranularStaging.ts`
- Modify: `src/domain/changeSetCandidates.ts`
- Modify: `src/domain/proposalReview.ts`
- Modify: `src/connections/proposalBroker.ts`
- Test: `src/__tests__/mcpGranularTools.test.ts`
- Test: `src/__tests__/proposalReviewWorkspace.test.tsx`

**Interfaces:**
- Add MCP tool `krakinai_resolve_library_assets` to `MCP_TOOL_NAMES` and `MCP_INPUT_SCHEMAS` in `src/domain/mcpProtocol.ts`:
  - Input: `{ items: Array<{ clientRef?: string; kind: string; title: string; promptText?: string; tags?: string[]; parentCharacterTitle?: string }> }`
  - Output in `src/domain/mcpGranularReads.ts`: `resolveLibraryAssets(state, scope, args)` returning for each item:
    - `matchStatus: 'exact_match' | 'title_match_prompt_differs' | 'no_match'`
    - `matchedRecord?: { id: string; kind: 'asset' | 'variant'; title: string; revision: number; promptText?: string }`
    - `recommendedAction: 'reuse' | 'propose_revision' | 'create'`
- In `src/domain/changeSetCandidates.ts`:
  - Improve `findCandidateMatches` so base character titles with suffixes like `"Silvester Vale (Base Character)"` match `"Silvester Vale"` (strip parenthetical qualifiers like `(base character)`, `(character)`, `(clean)` when comparing normalized core titles within the same category).
- In `src/domain/proposalReview.ts` & `src/connections/proposalBroker.ts`:
  - Add `buildSmartInitialApproval(changeSet: ChangeSet, state: ChangeSetState, scope?: McpScope): ChangeSetApproval`:
    - Pre-sets `storyboard: true`, `scenes: true`.
    - For each `asset.propose` operation: runs `findCandidateMatches`. If a match exists (and is in `scope.assetIds` when scope is provided), sets `assetDecisions[op.operationId] = { action: 'reuse', assetId: match[0].id, expectedRevision: match[0].revision }`. Otherwise sets `{ action: 'create', ...(matches.length ? { acknowledgeDuplicate: true } : {}) }`.
    - For each `variant.propose` operation: if a matching variant exists on the parent character, sets `variantDecisions[op.operationId] = { action: 'reuse', variantId: match[0].id, expectedRevision: match[0].revision }`. Otherwise sets `{ action: 'create', ...(matches.length ? { acknowledgeDuplicate: true } : {}) }`.
  - Use `buildSmartInitialApproval` in `ProposalBroker` when admitting/previewing/staging proposals (`krakinai_submit_change_set` and `krakinai_stage_*`) so every staged proposal arrives with zero `DEPENDENCY_BLOCKED` or `APPROVAL_*` blockers!
- In `src/domain/mcpGranularStaging.ts`:
  - In `stageSceneRecipeOperation` / `stageSceneDialogueOperation`: validate `dialogueCues` against `ensemble.participantUpserts`. If a cue has a `participantId` not in `participantUpserts`, check if `participantId` matches a participant by case-insensitive ID or speaker name; if still not in `participantUpserts`, omit `participantId` (treating it as unlinked narration/off-screen voice) so it never causes a `DOMAIN_RULE` conflict.

- [ ] **Step 1: Write failing tests in `src/__tests__/mcpGranularTools.test.ts`**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement `krakinai_resolve_library_assets`, improved `findCandidateMatches`, `buildSmartInitialApproval`, and dialogue cue participant auto-linking/unlinking**
- [ ] **Step 4: Run tests to verify pass**
- [ ] **Step 5: Commit**

---

### Task 4: Update `story-director` and `story-krakinai-setup` Skills for Automated Asset Reuse

**Files:**
- Modify: `C:\Users\HomePC\.gemini\config\skills\standalone_phase_3_skill_director\SKILL.md`
- Modify: `C:\Users\HomePC\.gemini\config\skills\standalone_phase_4_skill_krakinai_setup\SKILL.md`

**Interfaces:**
- Update `story-director` (`SKILL.md`) to include a Pre-Flight Library Check (`krakinai_resolve_library_assets` / `krakinai_search_assets`) so existing characters, outfits, environments, and styles in KrakinAI are referenced consistently in `03_director_storyboard.md` and `03_storyboard_prompts.json`.
- Update `story-krakinai-setup` (`SKILL.md`) Stage 3 & Stage 4 instructions to call `krakinai_resolve_library_assets` first, reuse existing asset IDs (`{ id, expectedRevision }`) directly in `assetRefs` and `ensemble.participantUpserts` when unchanged, and ensure every `dialogueCue.participantId` strictly matches an entry in that shot's `participantUpserts` (or omits `participantId` for off-screen/voiceover lines).

- [ ] **Step 1: Update `story-director/SKILL.md` and `story-krakinai-setup/SKILL.md`**
- [ ] **Step 2: Verify skill markdown formatting and instructions**
- [ ] **Step 3: Run full test suite (`npx.cmd vitest run`, `npm.cmd run typecheck`, `npm.cmd run build`)**
