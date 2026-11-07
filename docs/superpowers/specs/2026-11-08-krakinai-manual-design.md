# KRAKINAI Official Manual ("The Complete KRAKINAI Book") — Design Specification

**Date:** 2026-11-08  
**Status:** Approved for Implementation Planning

---

## 1. Goal & Purpose

Author a definitive, book-quality **KRAKINAI Manual** under `docs/manual/` that consolidates all KRAKINAI concepts, human workflows, AI collaboration patterns, internal engines, data models, security contracts, and the 36-tool MCP reference into a cohesive 10-chapter book, prepared for clean conversion to PDF.

### Core Pillars
1. **Terminologies & Mental Model**: Complete glossary and conceptual framework for every entity, status, and contract in KRAKINAI.
2. **How to Use KRAKINAI (User & Director Guide)**: Practical, step-by-step guides for every workspace tab (Library, Templates, Scene Builder, Saved Scenes, Projects/Storyboard/Continuity, AI Connections/Proposal Review, Media, and Backups).
3. **What's Inside KRAKINAI (Subsystem Tour)**: Deep dive into the deterministic Prompt Assembler, Context-Aware Shot Types, Cinematography & Performance Catalogs, Ensemble & Dialogue timing, Shot Blocking (`v5`), Keyframes & Image Prompt Studio (`v6`), and Preflight Validation (`P000`–`P008`).
4. **Detailed Technical Documentation**: System architecture, IndexedDB schemas (`krakinai_db` and `krakinai_review_inbox_db`), immutability and cryptographic digests, ChangeSet contracts (`v1`–`v6`), the 3-tier Local MCP Bridge & Native Host security architecture, and the complete 36-tool MCP API catalog.
5. **PDF-Ready Book Compilation**: Modular chapters in `docs/manual/` plus a deterministic build script (`scripts/build-manual-pdf.mjs`) that compiles the master index and all 10 chapters into a print-styled HTML/PDF book (`docs/manual/KRAKINAI-Manual.pdf` / `docs/manual/KRAKINAI-Manual-Print.html`).

---

## 2. Book Structure (`docs/manual/`)

| File | Part | Chapter Title | Key Contents |
| :--- | :--- | :--- | :--- |
| `docs/manual/README.md` | Index | **Cover & Master Table of Contents** | Book overview, audience guide (Creators, Directors, AI Agents, Developers), chapter links, and quick-start navigation. |
| `docs/manual/01-introduction-and-mental-model.md` | Part I | **Chapter 1: Introduction & Core Mental Model** | What KRAKINAI is; the 4 core pillars (Recipe over Raw Text, Immutable History, Deterministic Assembly, Human-Governed AI); end-to-end production lifecycle diagram. |
| `docs/manual/02-terminologies-and-glossary.md` | Part I | **Chapter 2: Complete Terminology & Glossary** | Exhaustive A–Z and domain-grouped definitions: Library, Scene Authoring, Ensemble & Performance, Cinematography, Blocking (`v5`), Keyframes (`v6`), Continuity, Stage A/B, and MCP Governance terms. |
| `docs/manual/03-user-guide-library-and-templates.md` | Part II | **Chapter 3: Building Your Reusable Asset Library & Templates** | Authoring Characters, locking Identity Anchors (`approvedText`, `immutableTraits`), creating Outfit Variants, managing Environments/Actions/Camera/Lighting/Styles, Media attachments, and Templates. |
| `docs/manual/04-user-guide-scene-authoring.md` | Part II | **Chapter 4: Authoring Scenes — Recipe Builder, Ensemble, Camera & Preflight** | Context-aware Shot Types, Single vs Ensemble authoring, Dialogue Cues & Performance Studio (`v1`/`v2`), Cinematography Studio, Shot Blocking (`v5`), Keyframes & Image Prompt Studio (`v6`), Preflight (`P000`–`P008`), and Saved Scenes management (revisions, soft-archive, bulk delete, export). |
| `docs/manual/05-user-guide-projects-and-continuity.md` | Part II | **Chapter 5: Directing Projects, Storyboards & Continuity** | Project creation, Shot ordering, attaching & selecting Preferred Takes, Production Status workflow (`planned` $\to$ `final`), Continuity Workspace (Cast Bible, wardrobe tracking, transitions), and Spatial Continuity Review. |
| `docs/manual/06-user-guide-ai-collaboration.md` | Part II | **Chapter 6: Collaborating with AI Agents (MCP & Stage A/B Workflows)** | Stage A Context Export, Stage B ChangeSet Import, Live Local MCP Pairing, configuring `McpScope` disclosure & capability grants, incremental storyboard staging (`krakinai_stage_*`), and Proposal Review Inbox workflow. |
| `docs/manual/07-inside-krakinai-engines.md` | Part III | **Chapter 7: Internal Engines — Prompt Assembler, Catalogs & Validators** | Exact `sceneDocument.ts` & `promptAssembler.ts` compilation order, Full/Structured/Compact output modes, Cinematography & Performance catalog reference tables, Shot Type rule matrices, and Preflight rule internals (`P000`–`P008`). |
| `docs/manual/08-technical-architecture-and-storage.md` | Part IV | **Chapter 8: System Architecture, Data Model & Storage** | Codebase directory map, IndexedDB schemas (`krakinai_db` 8 stores + `krakinai_review_inbox_db`), storage & backup byte limits, scene revision lineage (`headId`), and canonical SHA-256 digest computation. |
| `docs/manual/09-technical-changeset-and-security.md` | Part IV | **Chapter 9: Change-Set Contracts (`v1`–`v6`) & Security Model** | Complete specification of ChangeSet `v1` through `v6` schemas, operation types, concurrency proofs (`expectedSourceRevision`, `expectedSourceRecipeDigest`, `expectedBlockingDigest`, `expectedKeyframeDigest`), Import Ledger & Receipts, and `event.isTrusted` human consent enforcement. |
| `docs/manual/10-technical-mcp-reference.md` | Part IV | **Chapter 10: Complete MCP Protocol, Bridge Architecture & 36-Tool Reference** | 3-tier Local Bridge architecture (Browser `ProposalBroker` $\leftrightarrow$ Loopback HTTP Relay $\leftrightarrow$ Native Host / Stdio Adapter), HMAC epoch rotation, schema factoring, and the full 36-tool API reference (13 core + 23 granular tools). |

---

## 3. PDF Compilation Readiness

To ensure effortless conversion to PDF once the markdown chapters are complete:
- All chapters will use clean, standard GitHub-Flavored Markdown headings, tables, code blocks, and callouts.
- A dedicated build script (`scripts/build-manual-pdf.mjs`) will concatenate `docs/manual/README.md` and `01`–`10` in order into a single self-contained, print-styled HTML book (`docs/manual/dist/KRAKINAI-Manual.html`) with page-break rules (`page-break-before: always` per chapter) and automatically render `docs/manual/dist/KRAKINAI-Manual.pdf` via headless Chromium/Edge when invoked.
- Automated verification tests (`src/__tests__/manualDocsIntegrity.test.ts`) will verify that all 11 manual files exist, all internal chapter links resolve, all 36 `MCP_TOOL_NAMES` are documented in Chapter 10, and all Preflight rules (`P000`–`P008`) and ChangeSet versions (`v1`–`v6`) are covered.
