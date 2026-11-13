# Recipe Slot & Performance Studio Automation — Design

**Date:** 2026-11-09 · **Branch:** `codex/proposal-review-ui-redesign`

## Problem

1. Staged `character_scene` recipes from `story-krakinai-setup` bind only `environment` + `style`. `action` is a **required** slot for `character_scene` (`src/domain/shotTypeRules.ts:40-42`), so every scene fails with `Action & Emotion (action) is required for assembly`. `lighting` is optional, so it ends up `Unassigned`.
2. Performance Studio (dialogue cue `performanceDirection` v2) is never filled in. The staging path already passes `performanceDirection` through. The problem is that agents don't know the valid option IDs: `krakinai_list_catalog_presets({catalog:'performance'})` returns `voiceFields`/`speechFields` names without their option IDs. Also, any label or casing mismatch is rejected by `validatePerformanceDirection`.
3. The Phase 1–4 story skills never ask for Action & Emotion, Lighting & Mood or structured performance direction.

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **No new MCP tool.** Extend `krakinai_list_catalog_presets` (performance) with additive keys `emotionGroups`, `voiceOptions`, `speechOptions`, `gestureOptions`, `techniqueOptions` (id→label). Existing keys are unchanged. | Keeps tool count at 38 and doesn't change the existing response shape for current clients. |
| D2 | Add `normalizePerformanceDirection(raw)` to staging. It maps labels or any casing to catalog IDs, defaults `version: 2`, drops unknown values, and resolves quiet/loud technique conflicts by keeping the first. It reports every change as a warning. | Catches agent mistakes without silently changing meaning: every change is reported. |
| D3 | Pull the four duplicated cue-building blocks in `mcpGranularStaging.ts` into one `normalizeDialogueCue()`. | The same logic is currently copied four times. The new normalization should live in one place. |
| D4 | **No server-side invention of action/lighting assets.** Staging returns `warnings` for each `character_scene` missing `action` (`SLOT_REQUIRED_MISSING`) or `lighting` (`SLOT_OPTIONAL_UNASSIGNED`). | AGENTS.md: "Missing assets stay unresolved until the user supplies or approves them; do not substitute dummy content to pass assembly." |
| D5 | Skills author real reusable `action` and `lighting` candidates (or reuse library records via `krakinai_resolve_library_assets`). They also author structured performance direction per cue. | Fixes the problem where it starts: the agent's output. |

## Skill responsibilities

- **story-screenwriter:** every dialogue line gets a parenthetical with emotion + delivery + voice + gesture.
- **story-script-editor:** the Director's Handoff Briefing gets `Lighting & Mood Progression` and `Vocal & Performance Register`.
- **story-director:** the JSON gets top-level `action_library` and `lighting_library`, plus `action_ref`, `lighting_ref` and `dialogue_cues[].performance` (catalog IDs) per shot.
- **story-krakinai-setup:** every `character_scene` binds `environment`, `action`, `lighting` and `style`, and every cue carries `performanceDirection` v2. The agent must treat stage-response `warnings` as blockers to fix before handoff.

## Out of scope

UI changes, new MCP tools, auto-creating assets, changes to the change-set contract.
