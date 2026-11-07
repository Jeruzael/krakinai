# KRAKINAI Official Manual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the complete 10-chapter KRAKINAI Official Manual in `docs/manual/` covering terminologies, user workflows, internal engines, and technical/MCP reference documentation, with automated integrity tests and a print-ready HTML/PDF book compiler (`scripts/build-manual-pdf.mjs`).

**Architecture:** Organize the book into a master index (`docs/manual/README.md`) and 10 modular chapters grouped into four parts (Part I: Foundations & Terminologies, Part II: User & Director Guide, Part III: Internal Engines, Part IV: Detailed Technical & MCP Reference). Enforce documentation completeness and cross-link accuracy with a Vitest integrity test (`src/__tests__/manualDocsIntegrity.test.ts`) that checks every chapter against actual exported constants in `src/domain/mcpProtocol.ts`, `src/domain/scenePreflight.ts`, and `src/domain/changeSetSchema.ts`. Provide a zero-dependency Node script (`scripts/build-manual-pdf.mjs`) that compiles the chapters into a single print-formatted HTML book and invokes headless Edge/Chrome to emit `docs/manual/dist/KRAKINAI-Manual.pdf`.

**Tech Stack:** Markdown (GFM), Node.js (`fs`, `path`, `child_process`), TypeScript / Vitest (documentation integrity verification), Microsoft Edge / Chromium headless PDF rendering.

**Spec:** [`docs/superpowers/specs/2026-11-08-krakinai-manual-design.md`](../specs/2026-11-08-krakinai-manual-design.md)

## Global Constraints

- Every chapter in `docs/manual/` must reflect the exact current implementation in `src/` and `bridge/` — never invent non-existent UI buttons, database stores, schema versions, or MCP tool names.
- Chapter 10 (`docs/manual/10-technical-mcp-reference.md`) must document every single tool in `MCP_TOOL_NAMES` (all 36 tools: 13 core + 23 granular tools) with its exact wire name, required parameters, scope/capability requirements, and behavior.
- Chapter 7 (`docs/manual/07-inside-krakinai-engines.md`) must document all 9 Preflight rules (`P000` through `P008`), all 4 Shot Types (`character_scene`, `property_environment`, `graphic_motion`, `existing_footage`), and the exact component order from `SCENE_COMPONENT_ORDER`.
- Chapter 8 and Chapter 9 must document all 8 IndexedDB stores in `krakinai_db`, the `krakinai_review_inbox_db` store, and all 6 ChangeSet schema versions (`krakinai.change-set.v1` through `krakinai.change-set.v6`).
- Generated HTML/PDF outputs in `docs/manual/dist/` must be gitignored so binary PDF artifacts do not bloat the Git repository.

## Review Focus

1. **Drift between `MCP_TOOL_NAMES` in code and Chapter 10**: If any of the 36 MCP tool names in `src/domain/mcpProtocol.ts` is missing or misspelled in `docs/manual/10-technical-mcp-reference.md`, `manualDocsIntegrity.test.ts` must fail.
2. **Broken relative links between chapters**: Every markdown link `[...](./0X-...)` in `docs/manual/*.md` must resolve to an existing file in `docs/manual/`.
3. **Missing Preflight rules or ChangeSet versions**: `manualDocsIntegrity.test.ts` must assert that `P000`–`P008` appear in `07-inside-krakinai-engines.md` and `krakinai.change-set.v1`–`v6` appear in `09-technical-changeset-and-security.md`.
4. **Unrendered markdown or missing page breaks in compiled print HTML/PDF**: `scripts/build-manual-pdf.mjs` must wrap each chapter in `<section class="chapter-page">` with `page-break-before: always` CSS and render headings, tables, code blocks, and blockquotes cleanly.
5. **Git working tree cleanliness after PDF generation**: `.gitignore` must ignore `docs/manual/dist/` so running `node scripts/build-manual-pdf.mjs` leaves `git status` clean.

---

## File Structure

- **Create:** `docs/manual/README.md` — Book cover page, audience guide, and Master Table of Contents linking all 10 chapters.
- **Create:** `docs/manual/01-introduction-and-mental-model.md` — Part I, Chapter 1: Vision, 4 core pillars, and end-to-end production workflow.
- **Create:** `docs/manual/02-terminologies-and-glossary.md` — Part I, Chapter 2: Exhaustive domain-grouped and A–Z glossary of all KRAKINAI terms.
- **Create:** `docs/manual/03-user-guide-library-and-templates.md` — Part II, Chapter 3: Reusable assets, Identity Anchors, Outfit variants, Media, and Templates.
- **Create:** `docs/manual/04-user-guide-scene-authoring.md` — Part II, Chapter 4: Scene Builder, Shot Types, Ensemble, Dialogue & Performance Studio, Cinematography Studio, Blocking (`v5`), Keyframes (`v6`), Preflight, and Saved Scenes.
- **Create:** `docs/manual/05-user-guide-projects-and-continuity.md` — Part II, Chapter 5: Projects, Storyboard Shots, Takes, Production Status, Continuity Workspace (Cast Bible), and Spatial Continuity Review.
- **Create:** `docs/manual/06-user-guide-ai-collaboration.md` — Part II, Chapter 6: Stage A/B manual workflows, Local MCP pairing, `McpScope` permissions, incremental `krakinai_stage_*` authoring, and Proposal Review Inbox.
- **Create:** `docs/manual/07-inside-krakinai-engines.md` — Part III, Chapter 7: Prompt Assembler pipeline, Cinematography & Performance catalogs, Shot Type matrices, and Preflight rule engine (`P000`–`P008`).
- **Create:** `docs/manual/08-technical-architecture-and-storage.md` — Part IV, Chapter 8: Codebase map, IndexedDB stores (`krakinai_db` & `krakinai_review_inbox_db`), storage budgets, scene revision lineage, and canonical SHA-256 digests.
- **Create:** `docs/manual/09-technical-changeset-and-security.md` — Part IV, Chapter 9: ChangeSet `v1`–`v6` schemas, operation payloads, concurrency proofs, Import Ledger & Receipts, and `event.isTrusted` security boundaries.
- **Create:** `docs/manual/10-technical-mcp-reference.md` — Part IV, Chapter 10: 3-tier Local Bridge architecture, HMAC pairing/rotation protocol, and complete 36-tool MCP reference manual.
- **Create:** `scripts/build-manual-pdf.mjs` — Compiles `docs/manual/README.md` + chapters `01`–`10` into `docs/manual/dist/KRAKINAI-Manual.html` and `docs/manual/dist/KRAKINAI-Manual.pdf`.
- **Modify:** `.gitignore` — Ignore `docs/manual/dist/`.
- **Modify:** `package.json` — Add `"docs:manual"` script (`node scripts/build-manual-pdf.mjs`).
- **Create:** `src/__tests__/manualDocsIntegrity.test.ts` — Automated test verifying all manual chapters, internal links, 36 MCP tools, Preflight rules, and ChangeSet versions.

---

### Task 1: Part I — Cover Index, Introduction & Complete Terminology Glossary (`README.md`, `01`, `02`)

**Files:**
- Create: `docs/manual/README.md`
- Create: `docs/manual/01-introduction-and-mental-model.md`
- Create: `docs/manual/02-terminologies-and-glossary.md`

**Interfaces:**
- Consumes: Domain types in `src/types/domain.ts`, `src/types/ensemble.ts`, `src/types/cinematography.ts`, `src/types/blocking.ts`, `src/types/keyframes.ts`, `src/types/changeSet.ts`, `src/types/mcp.ts`
- Produces: Master TOC (`docs/manual/README.md`) and Part I chapters (`01-introduction-and-mental-model.md`, `02-terminologies-and-glossary.md`)

- [ ] **Step 1: Author `docs/manual/README.md`**
  Write the book cover page, how to read the manual by role (Prompt Author / Storyboard Director / AI Agent / Software Engineer), and the linked 4-Part, 10-Chapter Table of Contents.

- [ ] **Step 2: Author `docs/manual/01-introduction-and-mental-model.md`**
  Document KRAKINAI's mission, the 4 foundational principles (*Recipe over Raw Text*, *Immutable Scene History*, *Deterministic Assembly*, *Human-Governed AI*), the workspace navigation map (8 main tabs), and the end-to-end production lifecycle diagram.

- [ ] **Step 3: Author `docs/manual/02-terminologies-and-glossary.md`**
  Document every KRAKINAI terminology grouped by domain (Library & Assets, Scene Authoring & Revisions, Ensemble & Dialogue Performance, Cinematography & Camera Composition, Shot Blocking v5, Keyframes & Image Prompt Studio v6, Projects & Continuity, Stage A/B & Proposal Review, and Local MCP Bridge & Scopes) plus a quick-reference summary table.

- [ ] **Step 4: Verify Part I files exist and links match**
  Run: `cmd /c dir /b docs\manual`
  Expected: `01-introduction-and-mental-model.md`, `02-terminologies-and-glossary.md`, `README.md`

---

### Task 2: Part II — User & Director Guides (`03`, `04`, `05`, `06`)

**Files:**
- Create: `docs/manual/03-user-guide-library-and-templates.md`
- Create: `docs/manual/04-user-guide-scene-authoring.md`
- Create: `docs/manual/05-user-guide-projects-and-continuity.md`
- Create: `docs/manual/06-user-guide-ai-collaboration.md`

**Interfaces:**
- Consumes: UI and workflow semantics from `src/components/`, `src/domain/`, and `docs/agent-authoring-guide.md`
- Produces: Complete human and AI-collaborative user guides (`03` through `06`)

- [ ] **Step 1: Author `docs/manual/03-user-guide-library-and-templates.md`**
  Write step-by-step guides for creating reusable Prompt Assets across all 7 categories, configuring and approving Character Identity Anchors (`approvedText`, `immutableTraits`, `prohibitedDrift`), creating Character-owned `Outfit` variants, attaching Media (`reference` vs `sample`), and using Templates.

- [ ] **Step 2: Author `docs/manual/04-user-guide-scene-authoring.md`**
  Write step-by-step guides for the Scene Builder: selecting Shot Types, binding Builder Slots, switching to Multi-Character Ensemble mode, authoring timed Dialogue Cues and Performance Directions (`v1` & `v2`), configuring Cinematography Studio techniques and lens/DOF parameters, staging Shot Blocking (`v5`), planning Keyframes & deriving still-frame prompts (`v6`), interpreting Preflight findings (`P000`–`P008`), and managing Saved Scenes (version history, soft-archive, bulk delete, prompt export).

- [ ] **Step 3: Author `docs/manual/05-user-guide-projects-and-continuity.md`**
  Write step-by-step guides for Projects & Storyboards: creating Projects, adding/reordering Shots, attaching multiple Scene Takes, selecting Preferred Takes, advancing Shot Production Status (`planned` $\to$ `prompt_ready` $\to$ `generated` $\to$ `reviewed` $\to$ `final`), inspecting the Continuity Workspace (Cast Bible matrix, wardrobe timeline, transition warnings), and running Spatial Continuity Review.

- [ ] **Step 4: Author `docs/manual/06-user-guide-ai-collaboration.md`**
  Write step-by-step guides for both Stage A/B manual file exchange and live Local MCP pairing: launching the bridge, pairing with a browser session, configuring `McpScope` disclosure checkboxes (`includeAssetText`, `includeCharacterIdentity`, `includeNotes`, `fullPromptSceneIds`, `allowProposals`, `allowBlockingProposals`, `allowKeyframeProposals`), how AI agents stage storyboards incrementally via `krakinai_stage_*`, and how humans review/approve/reject proposals in the Incoming Proposals Inbox.

- [ ] **Step 5: Verify Part II files exist**
  Run: `cmd /c dir /b docs\manual`
  Expected: `03-user-guide-library-and-templates.md` through `06-user-guide-ai-collaboration.md` listed.

---

### Task 3: Part III & Part IV — Internal Engines & Detailed Technical Reference (`07`, `08`, `09`, `10`)

**Files:**
- Create: `docs/manual/07-inside-krakinai-engines.md`
- Create: `docs/manual/08-technical-architecture-and-storage.md`
- Create: `docs/manual/09-technical-changeset-and-security.md`
- Create: `docs/manual/10-technical-mcp-reference.md`

**Interfaces:**
- Consumes: `src/domain/sceneDocument.ts`, `src/domain/promptAssembler.ts`, `src/domain/cinematographyCatalog.ts`, `src/domain/performanceCatalog.ts`, `src/domain/shotTypeRules.ts`, `src/domain/scenePreflight.ts`, `src/storage/db.ts`, `src/storage/proposalReviewInbox.ts`, `src/domain/changeSetSchema.ts`, `src/domain/mcpProtocol.ts`, `bridge/src/`
- Produces: Deep-dive subsystem & technical reference chapters (`07` through `10`)

- [ ] **Step 1: Author `docs/manual/07-inside-krakinai-engines.md`**
  Document the internal deterministic engines:
  - Prompt Assembly (`SCENE_COMPONENT_ORDER`: `character`, `wardrobe`, `environment`, `action`, `camera`, `lighting`, `style`, plus `dialogue`, `blocking`, `keyframePlan`, `sceneInstructions`, `settings`, `avoidText`, and `full` / `structured` / `compact` output modes).
  - Shot Type rule matrix (`character_scene`, `property_environment`, `graphic_motion`, `existing_footage` required/optional/inapplicable slots and source media rules).
  - Cinematography Catalog (`CATALOG_FAMILIES`, `CATALOG_TECHNIQUES`, camera parameters, arrangements) and Performance Catalog (`EMOTIONS`, `EMOTIONAL_INTENSITIES`, `TECHNIQUES`, `VOICE_FIELDS`, `SPEECH_FIELDS`, `GESTURES`, `DELIVERY_STYLES`, `SPEAKING_PACES`, `BODY_LANGUAGE`).
  - Complete Preflight Rule Engine table (`P000` through `P008`) with trigger conditions, severities, and resolution steps.

- [ ] **Step 2: Author `docs/manual/08-technical-architecture-and-storage.md`**
  Document the codebase architecture (`src/types/`, `src/domain/`, `src/storage/`, `src/connections/`, `src/components/`, `bridge/src/`), the two IndexedDB databases (`krakinai_db` with its 8 object stores and `krakinai_review_inbox_db` with its `review_drafts` store), byte limits and backup constraints, immutable scene revision chains (`headId`, `parentSceneId`, `versionNumber`), and canonical JSON serialization + SHA-256 digest computation (`changeSetCanonical.ts`).

- [ ] **Step 3: Author `docs/manual/09-technical-changeset-and-security.md`**
  Document all 6 ChangeSet contracts (`krakinai.change-set.v1` through `krakinai.change-set.v6`), every operation type (`project.*`, `shot.*`, `asset.*`, `variant.*`, `scene.*`, `frame_image.*`), concurrency proof tokens (`expectedRevision`, `expectedHeadId`, `expectedSourceRevision`, `expectedSourceRecipeDigest`, `expectedBlockingDigest`, `expectedKeyframeDigest`), the Import Ledger & Receipts, and browser-enforced security invariants (`event.isTrusted`, Web Locks, zero unapproved database writes).

- [ ] **Step 4: Author `docs/manual/10-technical-mcp-reference.md`**
  Document the 3-tier Local MCP Bridge architecture (Browser `ProposalBroker` $\leftrightarrow$ Loopback HTTP Relay $\leftrightarrow$ Native Host / Stdio Adapter), pairing challenge/response & HMAC epoch rotation, schema factoring (`schemaDiscovery.ts`), protocol limits (`MCP_LIMITS`), error codes, and the complete 36-tool reference table and detailed parameter schemas for all 13 core tools and 23 granular tools.

- [ ] **Step 5: Verify Part III & IV files exist**
  Run: `cmd /c dir /b docs\manual`
  Expected: All 11 markdown files (`README.md` + `01` through `10`) present in `docs/manual/`.

---

### Task 4: Automated Documentation Integrity Test & PDF Book Compiler (`manualDocsIntegrity.test.ts`, `build-manual-pdf.mjs`)

**Files:**
- Create: `src/__tests__/manualDocsIntegrity.test.ts`
- Create: `scripts/build-manual-pdf.mjs`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: `docs/manual/*.md`, `MCP_TOOL_NAMES` from `src/domain/mcpProtocol.ts`, `SHOT_TYPES` from `src/domain/shotTypeRules.ts`
- Produces:
  - Vitest suite `src/__tests__/manualDocsIntegrity.test.ts`
  - CLI builder `scripts/build-manual-pdf.mjs` (`npm run docs:manual`) generating `docs/manual/dist/KRAKINAI-Manual.html` and `docs/manual/dist/KRAKINAI-Manual.pdf`

- [ ] **Step 1: Write failing documentation integrity test in `src/__tests__/manualDocsIntegrity.test.ts`**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCP_TOOL_NAMES } from '../domain/mcpProtocol';
import { SHOT_TYPES } from '../domain/shotTypeRules';

const MANUAL_DIR = path.resolve(__dirname, '../../docs/manual');
const EXPECTED_FILES = [
  'README.md',
  '01-introduction-and-mental-model.md',
  '02-terminologies-and-glossary.md',
  '03-user-guide-library-and-templates.md',
  '04-user-guide-scene-authoring.md',
  '05-user-guide-projects-and-continuity.md',
  '06-user-guide-ai-collaboration.md',
  '07-inside-krakinai-engines.md',
  '08-technical-architecture-and-storage.md',
  '09-technical-changeset-and-security.md',
  '10-technical-mcp-reference.md',
];

describe('KRAKINAI Manual Integrity', () => {
  it('contains all 11 manual files with substantial content and valid relative chapter links', () => {
    for (const file of EXPECTED_FILES) {
      const fullPath = path.join(MANUAL_DIR, file);
      expect(fs.existsSync(fullPath), `Missing ${file}`).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      expect(content.length).toBeGreaterThan(1500);

      const linkRegex = /\]\(\.\/([^)#]+)(?:#[^)]*)?\)/g;
      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(content)) !== null) {
        const targetPath = path.join(MANUAL_DIR, match[1]);
        expect(fs.existsSync(targetPath), `Broken link ./${match[1]} in ${file}`).toBe(true);
      }
    }
  });

  it('documents all 36 MCP tools in Chapter 10, all Preflight rules P000-P008 and Shot Types in Chapter 7, and ChangeSet v1-v6 in Chapter 9', () => {
    const ch7 = fs.readFileSync(path.join(MANUAL_DIR, '07-inside-krakinai-engines.md'), 'utf8');
    for (const rule of ['P000', 'P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008']) {
      expect(ch7).toContain(rule);
    }
    for (const shotType of SHOT_TYPES) {
      expect(ch7).toContain(shotType);
    }

    const ch9 = fs.readFileSync(path.join(MANUAL_DIR, '09-technical-changeset-and-security.md'), 'utf8');
    for (let v = 1; v <= 6; v++) {
      expect(ch9).toContain(`krakinai.change-set.v${v}`);
    }

    const ch10 = fs.readFileSync(path.join(MANUAL_DIR, '10-technical-mcp-reference.md'), 'utf8');
    for (const toolName of MCP_TOOL_NAMES) {
      expect(ch10, `Missing MCP tool ${toolName} in Chapter 10`).toContain(toolName);
    }
  });
});
```

- [ ] **Step 2: Implement `scripts/build-manual-pdf.mjs`, `.gitignore`, and `package.json` script**
  - Create `scripts/build-manual-pdf.mjs` that reads `docs/manual/README.md` and `01`–`10` in order, converts Markdown headings, tables, alerts, lists, and fenced code blocks (including Mermaid blocks) into a clean, print-styled HTML book at `docs/manual/dist/KRAKINAI-Manual.html`, and invokes headless Microsoft Edge / Chrome (`--headless --print-to-pdf=... --no-pdf-header-footer`) when available to produce `docs/manual/dist/KRAKINAI-Manual.pdf`.
  - Add `docs/manual/dist/` to `.gitignore`.
  - Add `"docs:manual": "node scripts/build-manual-pdf.mjs"` to `package.json`.

- [ ] **Step 3: Run integrity test and PDF build script to verify**
  Run: `cmd /c npx vitest run src/__tests__/manualDocsIntegrity.test.ts`
  Expected: PASS (2 passed)

  Run: `cmd /c npm run docs:manual`
  Expected: Generates `docs/manual/dist/KRAKINAI-Manual.html` and `docs/manual/dist/KRAKINAI-Manual.pdf` with exit code 0.
