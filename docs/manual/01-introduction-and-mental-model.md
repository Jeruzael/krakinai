# Chapter 1: Introduction & Core Mental Model

> *Part I: Foundations & Mental Model*  
> Previous: [README (Cover & Table of Contents)](./README.md) | Next: [Chapter 2: Complete Terminology & Glossary](./02-terminologies-and-glossary.md)

---

## 1. The Paradigm Shift: Why KRAKINAI Exists

Traditional AI image and video generation tools suffer from a fundamental flaw: **they treat complex visual storytelling as disposable, one-off text blobs**. When directing a multi-shot sequence or an episodic narrative, creators face massive friction:
- **Character Drift**: A character's facial features, age, clothing, or hair change unpredictably between Shot 1 and Shot 2.
- **Lost Cinematic Intent**: Camera movements, lens selections, and lighting styles get buried in massive "prompt soup," resulting in AI hallucinations and conflicting directions.
- **Zero Reusability**: When a scene prompt works, changing one character's wardrobe or tweaking a camera angle requires manually rewriting dozens of sentences across multiple documents.
- **Uncontrolled AI Overwrites**: Autonomous AI tools often hallucinate non-existent files or overwrite previously working scripts with unverified changes.

**KRAKINAI solves this by introducing a local-first, compiler-driven mental model for visual storytelling.** In KRAKINAI, a prompt is not a raw paragraph typed into a chat box; it is an **assembled software artifact** compiled deterministically from modular, reusable assets and structured cinematic parameters.

```mermaid
flowchart LR
    subgraph Traditional["Traditional AI Prompting (Fragile)"]
        direction TB
        T1["Raw Paragraph of Text"] --> T2["AI Video Generator"]
        T2 --> T3["Inconsistent Characters, Drifting Colors, Broken Continuity"]
    end

    subgraph KrakinAI["KRAKINAI Compiler Architecture (Robust)"]
        direction TB
        K1["Reusable Assets\n(Characters, Outfits, Environments)"] --> K4["Deterministic\nPrompt Assembler"]
        K2["Cinematic Parameters\n(Lenses, Camera Moves, Lighting)"] --> K4
        K3["Spatial Blocking & Keyframes\n(Screen Zones, Start->Action->End)"] --> K4
        K4 --> K5["Preflight Checks (P000-P008)"]
        K5 --> K6["Multi-Tier Prompts\n(Full / Structured / Compact)"]
        K6 --> K7["Consistent, Reusable Video Generation"]
    end
```

---

## 2. The Four Core Architectural Pillars

Every feature in KRAKINAI is built upon four foundational principles:

### Pillar 1: Recipe over Raw Text
Instead of unstructured text, scenes are authored as **Recipes** consisting of discrete **Builder Slots**:
- Character & Identity Anchors
- Wardrobe / Outfits
- Environment / Location
- Physical Actions
- Camera Angle, Lens & Movement
- Lighting Mood & Time of Day
- Visual Style & Medium

By separating these components, changing a character's wardrobe across an entire episodic storyline requires selecting a new **Outfit variant**, without touching the character's facial features, the environment, or the cinematography instructions.

### Pillar 2: Immutable Scene History
In film production, you never erase a previous camera take; you shoot Take 2 while preserving Take 1. KRAKINAI enforces **strict immutability**:
- When a saved scene recipe is modified, KRAKINAI **never overwrites** the existing record in storage.
- It produces a new revision with an incremented version number, linking back to the original `headId` and preserving the complete parent revision lineage.
- Multiple takes on the same shot can be saved, tested, compared, and swapped without ever losing working prompt outputs.

### Pillar 3: Deterministic Assembly & Preflight
KRAKINAI behaves like a compiler:
- Given the exact same assets, slots, dialogue, and camera settings, the **Prompt Assembler** always outputs the exact same character-for-character prompt.
- Negative prompts and "avoid" text inherit deterministically from parent assets down to individual shots.
- Before a scene can be saved or submitted, the **Preflight Engine** evaluates deterministic rules (`P000` through `P008`), catching common visual contradictions (e.g., commanding a camera to be stationary while simultaneously commanding a dolly push-in, or requesting a direct lens gaze while placing the camera behind the character).

### Pillar 4: Human-Governed AI Pair Directing
AI assistants (like Claude, Codex, Antigravity, or local LLMs) can act as brilliant co-directors, but they must never act as unchecked administrators:
- MCP tools and Stage B imports submit structured **proposals** into the browser's **Proposal Review Inbox**.
- **No external AI tool can write directly to your local database.**
- Every staged proposal displays visual diffs, allows selective operation approvals, and requires an explicit, authenticated human click (`event.isTrusted`) to apply.

---

## 3. The Workspace Navigation Map

KRAKINAI is structured into **8 primary workspace views**, accessible via the global navigation sidebar:

```mermaid
graph TD
    classDef main fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#f8fafc;
    classDef sub fill:#1e293b,stroke:#64748b,stroke-width:1px,color:#cbd5e1;

    Nav["KRAKINAI Workspace Navigation"]
    
    V1["1. Asset Library"] --> Nav
    V2["2. Templates"] --> Nav
    V3["3. Scene Builder"] --> Nav
    V4["4. Saved Scenes"] --> Nav
    V5["5. Projects & Storyboard"] --> Nav
    V6["6. AI Connections & Inbox"] --> Nav
    V7["7. Media Vault"] --> Nav
    V8["8. Storage & Backups"] --> Nav

    class Nav main;
    class V1,V2,V3,V4,V5,V6,V7,V8 sub;
```

1. **Asset Library**: The creative repository of reusable visual elements. Create and manage Characters (with locked Identity Anchors), Outfits, Environments, Actions, Camera profiles, Lighting setups, and Visual Styles.
2. **Templates**: Pre-configured scene baselines with pre-selected slots, default camera movements, and negative constraints for rapid shot authoring.
3. **Scene Builder**: The heart of KRAKINAI. An interactive canvas for assembling recipes, organizing Multi-Character Ensembles, timing Dialogue Cues, setting Cinematography parameters, authoring Shot Blocking (v5), and planning Keyframes (v6).
4. **Saved Scenes**: The immutable catalog of saved scene takes. Inspect prompt outputs, compare revision diffs, soft-archive deprecated takes, perform bulk operations, and export compiled prompts.
5. **Projects & Storyboard**: The episodic director suite. Organize shots into sequential storyboards, assign shot codes and planned durations, attach and switch preferred takes, inspect the **Cast Bible Continuity Matrix**, and review **Spatial Blocking Continuity**.
6. **AI Connections & Proposals**: Manage local AI bridge pairings, configure granular disclosure scopes (`McpScope`), inspect incoming AI proposals, review operation diffs, and approve or reject change-sets.
7. **Media Vault**: Local reference files, visual identity anchors, and externally generated video/image assets linked to specific shots and keyframes.
8. **Storage & Backups**: Local storage health diagnostics, backup exports (JSON/ZIP), storage quota usage, and database maintenance tools.

---

## 4. The End-to-End Production Lifecycle

Directing a project in KRAKINAI follows a clean 6-stage lifecycle:

```mermaid
sequenceDiagram
    autonumber
    actor Creator as Creative Director
    participant Lib as Asset Library
    participant Proj as Storyboard & Continuity
    participant Build as Scene Builder & Preflight
    participant Inbox as Proposal Review Inbox
    participant Ext as AI Video Generator (External)
    participant Media as Media Vault & Takes

    Note over Creator,Lib: Stage 1: Pre-Production & Cast Setup
    Creator->>Lib: Create Characters & Lock Identity Anchors
    Creator->>Lib: Create Outfit Variants & Environments

    Note over Creator,Proj: Stage 2: Storyboard Outlining
    Creator->>Proj: Create Project (e.g., "Episode 1")
    Creator->>Proj: Add Shots (S01, S02, S03) with Planned Types & Durations

    Note over Creator,Build: Stage 3: Scene Authoring & Blocking
    Creator->>Build: Assemble Recipe (Slots, Dialogue, Camera)
    Creator->>Build: Configure Blocking (Start -> Action -> End)
    Creator->>Build: Generate Keyframe Plan (Start/End Frame Prompts)
    Build->>Build: Run Preflight Checks (P000-P008)
    Creator->>Build: Save Immutable Scene Take

    Note over Creator,Inbox: Stage 4: AI Co-Directing (Optional)
    Creator->>Inbox: Review AI-Staged Proposals via MCP
    Creator->>Inbox: Confirm & Apply Approved Operations

    Note over Creator,Ext: Stage 5: Generation Execution
    Creator->>Build: Export Multi-Tier Prompts (Full / Compact)
    Creator->>Ext: Paste into Google Flow / Kling / Runway / Midjourney

    Note over Creator,Media: Stage 6: Review & Final Assembly
    Creator->>Media: Link Generated Video/Image to Shot/Frame
    Creator->>Proj: Advance Shot Status (Planned -> Prompt Ready -> Final)
    Creator->>Proj: Inspect Continuity Matrix & Spatial Flow
```

### Stage 1: Pre-Production & Library Setup
Before writing individual scenes, you define your narrative's reusable visual cast. Characters receive **Identity Anchors** that freeze critical facial structure, ethnicity, and distinguishing marks. Reusable environments and styles are created once and referenced across all scenes.

### Stage 2: Project & Storyboard Outlining
Create a Project (e.g., a commercial, a pilot episode, or a cinematic trailer). Outline your storyboard shots with code designations (e.g., `S01`, `S02`), planned durations, and intended shot types.

### Stage 3: Modular Scene Authoring
In the Scene Builder, author modular takes for each shot. Select a **Context-Aware Shot Type** (`character_scene`, `property_environment`, `graphic_motion`, `existing_footage`). Bind assets into slots, configure multi-character ensemble roles, set timed dialogue cues, fine-tune lens and movement parameters in the Cinematography Studio, and define spatial staging in Shot Blocking.

### Stage 4: Deterministic Preflight & Validation
As you author, KRAKINAI's Preflight engine evaluates the scene against semantic rules (`P000`–`P008`), catching potential visual conflicts before you burn generation tokens.

### Stage 5: External Generation
KRAKINAI compiles the recipe into exact, model-optimized prompts. Export Full Prompts for detailed image generation (Midjourney, Flux, Stable Diffusion) or Compact Prompts with start/end keyframe descriptions for state-of-the-art video models (Google Flow, Kling, Runway Gen-3, Luma Dream Machine).

### Stage 6: Media Association & Continuity Finalization
Import generated video clips or keyframe images back into KRAKINAI's Media Vault, linking them to specific shots. Track the production status of each shot from `planned` to `final` and verify that character presence, clothing, and spatial positions remain continuous across every cut.

---

> **Next Up:** Continue to [Chapter 2: Complete Terminology & Glossary](./02-terminologies-and-glossary.md) to explore every entity, property, and concept in the KRAKINAI ecosystem.
