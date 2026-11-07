# Chapter 2: Complete Terminology & Glossary

> *Part I: Foundations & Mental Model*  
> Previous: [Chapter 1: Introduction & Mental Model](./01-introduction-and-mental-model.md) | Next: [Chapter 3: Library & Templates](./03-user-guide-library-and-templates.md)

---

## 1. Overview

KRAKINAI employs an exacting domain vocabulary designed to eliminate ambiguity between human directors, prompt compilers, database storage layers, and autonomous AI agents. This glossary defines every core concept, entity type, status flag, and architectural term used throughout the application and its APIs.

---

## 2. Library & Asset Entities

### Prompt Asset (`PromptAsset`)
The fundamental reusable building block in KRAKINAI. An asset represents an approved creative ingredient stored in your local library. Every asset has an immutable ID, a category, a human-readable title, a descriptive prompt text, tags, revision number, and optional media reference links.

### Asset Categories
KRAKINAI divides cinematic elements into seven distinct categories:
1. **`characters`**: Visual identity, ethnicity, anatomy, hair, face, age, and default appearance.
2. **`wardrobe`**: Clothing, costumes, uniforms, footwear, headwear, and jewelry.
3. **`environments`**: Physical locations, architectural sets, natural landscapes, and weather conditions.
4. **`actions`**: Physical movements, gestures, choreography, combat, and locomotion.
5. **`camera`**: Cinematic lenses, angles, framing standards, and movement profiles.
6. **`lighting`**: Key/fill/rim setups, color temperatures, atmospheric lighting, and time-of-day illumination.
7. **`styles`**: Visual medium, grain, rendering aesthetics, film stock, color grading, or animation technique.

### Identity Anchor (`IdentityAnchor`)
A specialized security and continuity feature attached to Character assets to prevent AI generation drift.
- **`status`**: Indicates whether the identity is in `'draft'` or has been reviewed and `'approved'`.
- **`approvedText`**: The locked, authoritative prompt text describing the character's unchangeable anatomical and facial features.
- **`immutableTraits`**: Explicit list of physical traits that AI tools are forbidden from altering (e.g., "Sharp jawline, emerald green eyes, crooked nose bridge, silver hair").
- **`prohibitedDrift`**: Explicit negative constraints (e.g., "Do not change hair color; do not add facial hair; do not de-age").
- **`approvedMasterIdentityRevision`**: The exact revision number of the parent Character asset when this anchor was signed and locked.

### Outfit Variant (`Variant`)
A specialized child entity owned by a specific Character asset (`parentCharacterId`). While a character's anatomy remains fixed via their Identity Anchor, an Outfit variant specifies what that character wears in specific scenes (e.g., "Winter Tactical Parka" vs "Formal Evening Tuxedo").
- **Invariant**: An Outfit variant cannot exist independently; it must belong to a valid parent Character.
- **Revision Tracking**: Variants track their own independent revision number alongside `expectedParentRevision`.

### Template (`Template`)
A saved recipe archetype that pre-populates the Scene Builder with default asset bindings, camera configurations, and avoid text. Ideal for maintaining visual uniformity across recurring shot types (e.g., "Interrogation Two-Shot Template" or "Podcast Split-Screen Template").

### Media Asset (`MediaAsset`)
A local binary image or video file stored in KRAKINAI's Media Vault. Can serve two distinct functions:
- **`reference`**: Visual source material (e.g., a face anchor reference image, environment moodboard, or concept art) embedded into prompt assembly.
- **`sample`**: An externally generated video clip or image resulting from a completed generation run, attached to a scene take or keyframe.

---

## 3. Scene Authoring & Revision Lineage

### Scene Draft (`SceneDraft`)
The working, mutable canvas within the Scene Builder. A draft represents work-in-progress that has not yet been committed to the immutable database.

### Saved Scene (`SavedScene`)
An immutable, persisted scene record in `krakinai_db`. Once saved, a scene cannot be mutated in place.

### Authoring Modes
- **`recipe`**: The primary, structured mode. Prompts compile deterministically from Builder Slots, Ensembles, Dialogue, Camera parameters, and Blocking.
- **`direct_prompt`**: A legacy or emergency escape-hatch mode where raw text is entered directly without modular slot compilation. Direct prompt scenes can be converted to recipe mode using the guided Stage B / MCP conversion tools.

### Builder Slots (`BuilderSlot`)
The modular input channels of a recipe scene: `character`, `wardrobe`, `environment`, `action`, `camera`, `lighting`, and `style`.

### Component Snapshot (`ComponentSnapshot`)
When an asset from the library is bound to a slot in a scene, KRAKINAI takes a **Component Snapshot**. This records the asset's title, prompt text, and revision number at that moment in time. If the original asset in the library is later edited, existing saved scenes are protected from unexpected prompt changes.

### Slot Overrides & Compact Text
- **Slot Override (`overrideText`)**: A scene-specific prompt modification applied to a single slot without altering the underlying library asset.
- **Compact Text (`compactText`)**: A concise, shorthand version of an asset's prompt text used when generating compact multi-shot prompts or token-constrained video prompts.

### Revision Lineage
- **Head ID (`headId`)**: The root identifier of a scene lineage. All revisions and alternate takes branching from an initial scene share the same `headId`.
- **Parent Scene ID (`parentSceneId`)**: The immediate ancestor scene from which the current revision was derived.
- **Version Number (`versionNumber`)**: A monotonically increasing integer (`1`, `2`, `3`...) indicating the chronological depth of the revision.
- **Take (`alternateTake: true`)**: A parallel creative attempt on the same shot (e.g., Take 1 vs Take 2). Unlike a revision, a new take creates a sibling branch rather than replacing the predecessor.

### Soft Archive vs Bulk Delete
- **Soft Archive (`archivedAt`)**: A non-destructive flag that hides older or experimental takes from default storyboard lists while preserving their presence in the revision lineage.
- **Bulk Delete**: Permanent removal of unreferenced saved scenes, requiring explicit human confirmation. Scenes currently selected as a shot's active take in a project cannot be deleted.

---

## 4. Ensemble, Dialogue & Performance Studio

### Scene Participant (`SceneParticipant`)
A character present in a multi-character scene. Each participant has:
- `id`: A unique local identifier (e.g., `p-hero`, `p-villain`).
- `character`: Binding to a Character asset (`assetId` and `expectedRevision`).
- `wardrobe`: Optional binding to an Outfit variant or standalone wardrobe asset.
- `role`: Short narrative descriptor (e.g., "Detective", "Hostage").
- `presence`: `'on_camera'` (physically visible) or `'off_camera'` (audible but outside the camera frame).
- `identitySource`: Whether to inject the character's full master prompt or their locked `'approved_anchor'`.

### Primary Participant (`primaryParticipantId`)
The designated anchor character in an ensemble scene. Used by the Prompt Assembler to establish focal framing and default camera perspectives.

### Dialogue Cue (`DialogueCue`)
An individual line of spoken dialogue anchored in time:
- `id`: Unique cue identifier (e.g., `cue-1`).
- `speakerParticipantId`: The ID of the `SceneParticipant` speaking the line.
- `lineText`: The verbatim spoken dialogue.
- `timing`: Exact temporal placement: `startSeconds` and `endSeconds` within the shot duration.
- `performanceDirection`: Fine-grained delivery and emotional direction.

### Performance Direction (`PerformanceDirection`)
- **Version 1 (Legacy)**: High-level delivery styles, speaking pace (`fast`, `measured`, `deliberate`), and body gestures.
- **Version 2 (Performance Studio)**: Detailed psychological direction:
  - `emotion`: Primary and secondary emotions with fine-grained intensity levels (`subtle`, `moderate`, `intense`, `explosive`).
  - `voice`: Acoustic vocal qualities (pitch, resonance, raspiness, breathiness, cadence).
  - `speech`: Articulation, emphasis, pauses, and accentuation.
  - `gestures`: Specific facial micro-expressions and physical body language.

---

## 5. Cinematography & Camera Parameters

### Camera Composition (`CameraCompositionChoice`)
A structured choice of cinematic techniques that governs framing, optical characteristics, and motion:
- **Technique IDs (`techniqueIds`)**: Standardized identifiers referencing KRAKINAI's built-in Cinematography Catalog (e.g., `'shot-size.medium-close-up'`, `'angle.low-angle'`, `'movement.slow-push-in'`).
- **Arrangement (`arrangement`)**:
  - `'simultaneous'`: Camera techniques occur concurrently (e.g., a low-angle tracking shot).
  - `'sequence'`: Movements happen in temporal order (e.g., static hold followed by a whip pan).
  - `'compound'`: Complex multi-axis camera motions (e.g., crane down while pushing in).
- **Parameters**: Explicit optical numbers:
  - Focal length in millimeters (e.g., `35mm` wide vs `85mm` portrait).
  - Aperture and depth-of-field (e.g., `f/1.4` shallow focus with creamy bokeh vs `f/11` deep cinematic focus).
  - Shutter angle, camera shake intensity, and movement speed.

---

## 6. Shot Blocking (v5) & Spatial Staging

### Shot Blocking (`SceneBlockingV1`)
The spatial orchestration of actors, landmarks, props, and camera within the scene environment over time:
- **`Start -> Action -> End`**: A 3-phase temporal model describing where participants begin, what physical actions they execute, and where they conclude before the next cut.
- **Screen Zones (`ScreenZone`)**: Standard 2D framing regions: `'center'`, `'screen_left'`, `'screen_right'`, `'top'`, `'bottom'`.
- **Depth Zones (`DepthZone`)**: 3D spatial planes: `'foreground'`, `'midground'`, `'background'`.
- **Postures & Eyelines**: Physical stance (`standing`, `sitting`, `kneeling`, `prone`) and gaze orientation relative to the camera lens and other participants.
- **Landmarks & Props**: Physical objects in the environment that ground participant movements (e.g., `Landmark: "Desk"`, `Prop: "Revolver"`).
- **Binding Tokens**: Cryptographic hashes (`bindingToken`, `wardrobeBindingToken`, `environmentBindingToken`) that lock a blocking participant to the exact Character, Outfit, and Environment bound in the scene recipe.

---

## 7. Keyframes & Image Prompt Studio (v6)

### Keyframe Plan (`KeyframePlanV1`)
A sequence of discrete image generation targets representing crucial narrative moments within a shot:
- **Frame Roles**: `'start'` (the opening frame of the video), `'end'` (the concluding frame), or `'custom'` (key emotional or action beats in between).
- **Beat Description**: Specific visual staging instructions for that individual frozen moment.
- **Camera Override & Action Override**: Frame-specific adjustments that modify the overall shot recipe.

### Canonical Derived Frame Prompt
A fully assembled, standalone text prompt generated specifically for rendering a single still image keyframe. This prompt strips continuous video motion descriptors and replaces them with static photographic composition instructions, optimized for diffusion models (Midjourney, Flux, Stable Diffusion) before sending the resulting still to an image-to-video generator (Google Flow, Kling, Runway).

### Frame Image Association (`frame_image.link` / `frame_image.clear`)
The operation of binding an externally generated image in the Media Vault to a specific keyframe in the scene. Once linked, the image serves as the verified visual anchor for downstream video generation.

---

## 8. Projects, Storyboards & Continuity

### Project / Collection (`Collection`)
The top-level container for an episodic story, film, or series. A project owns an ordered list of Storyboard Shots, project-level planning notes, and a shared revision counter.

### Storyboard Shot (`StoryboardShot`)
An individual continuous take in the storyboard timeline:
- **`shotCode`**: Narrative identifier (e.g., `S01`, `S02A`, `SC05-SH01`).
- **`plannedShotType`**: The intended cinematic classification (e.g., `character_scene`, `property_environment`).
- **`plannedDurationSeconds`**: Expected running time in seconds.
- **`takeSceneIds`**: Array of all scene takes authored for this shot.
- **`selectedSceneId`**: The active, preferred scene take chosen for final production.

### Shot Production Status (`ProductionStatus`)
The 5-stage lifecycle state of a storyboard shot:
1. **`planned`**: The shot outline exists, but scene recipes or generation prompts have not been finalized.
2. **`prompt_ready`**: The scene recipe is assembled, preflight has passed, and prompts are ready for external generation.
3. **`generated`**: Video generation runs have been initiated externally, and raw candidate media is pending review.
4. **`reviewed`**: The director has inspected the generated video outputs and verified visual fidelity.
5. **`final`**: The shot has been approved and locked for final editorial assembly.

### Continuity Workspace & Cast Bible
An automated analytical engine that inspects all shots across a project:
- **Cast Bible Matrix**: A grid tracking which characters appear in which shots and scenes.
- **Wardrobe Timeline**: Automatically detects whether characters change clothing between adjacent shots and flags unintentional costume discontinuities.
- **Transition Pairings**: Analyzes shot-to-shot cuts to warn about mismatched environments, missing characters, or jarring time-of-day jumps.

### Spatial Continuity Review
An automated advisory system that evaluates the spatial blocking between consecutive shots:
- Evaluates the **180-degree line** (axis of action).
- Detects disorienting screen-direction flips (e.g., Character A running screen-right in Shot 1, suddenly running screen-left in Shot 2 without an intervening reverse cut).
- Highlights actor depth and zone mismatches across cuts.

---

## 9. AI Collaboration, Proposal Review & MCP Governance

### Stage A: Context Export
A read-only JSON export generated by KRAKINAI that summarizes project structure, shot lists, available asset IDs, and continuity rules so an external AI model can author compliant storyboards with full awareness of existing library content.

### Stage B: Change-Set Package
A structured, cryptographically validated JSON payload containing an array of proposed changes (`project.*`, `shot.*`, `asset.*`, `variant.*`, `scene.*`, `frame_image.*`). Change-sets evolve across strict schema versions:
- **`krakinai.change-set.v1`**: Legacy direct prompts, basic projects, and candidate assets.
- **`krakinai.change-set.v2`**: Modular Recipe scene operations (`scene.create_recipe`, `scene.revise_recipe`, `scene.create_recipe_take`).
- **`krakinai.change-set.v3`**: Multi-character Ensemble patches, timed Dialogue Cues, and Outfit (`variant.propose`) operations.
- **`krakinai.change-set.v4`**: Guided Direct-to-Recipe conversions with provenance tracking.
- **`krakinai.change-set.v5`**: Structured Shot Blocking patches (`BlockingPatchV1`) with concurrency tokens.
- **`krakinai.change-set.v6`**: Keyframe Plans (`KeyframePatchV1`), canonical still-frame prompt derivation, and frame-image associations.

### Proposal Review Inbox
A dedicated browser-side storage database (`krakinai_review_inbox_db`) where incoming AI proposals are admitted. Holds a maximum of 8 proposals. Features:
- Visual diff inspection of proposed prompt texts and slot modifications.
- Candidate asset review: Allows the human to either approve a proposed character as a new library entry or map it to reuse an existing asset.
- Rejection with feedback: Sends structured rejection notes back to the AI agent.

### Cryptographic Package Digest (`packageDigest`)
A SHA-256 hash computed over the canonically sorted JSON representation of a ChangeSet. Guarantees that the exact package reviewed by the human is identical to what the AI submitted, down to the byte.

### Approved Digest (`approvedDigest`)
A SHA-256 hash generated once the human reviewer confirms their review choices in the UI. Serves as the one-time authorization token for applying the proposal to the real database.

### Import Ledger & Receipts
A tamper-evident historical ledger stored in user preferences. Every applied proposal receives a cryptographic **Receipt** recording `changeSetId`, `packageDigest`, `approvedDigest`, and timestamps. Prevents accidental duplicate applications.

### Model Context Protocol (MCP) Scope (`McpScope`)
A granular set of permissions configured in the browser UI under AI Connections that restricts what an external AI agent can see and do over the local MCP connection:
- `authorizedProjectIds`: Projects the agent is permitted to read or modify.
- `authorizedAssetIds`: Specific assets the agent can inspect.
- `includeAssetText`: Whether raw prompt text and descriptions are disclosed or redacted.
- `includeCharacterIdentity`: Whether sensitive Identity Anchor traits are visible.
- `includeNotes`: Whether internal director notes are shared.
- `fullPromptSceneIds`: Specific scenes granted full prompt visibility.
- `allowProposals`: Master permission flag to submit change-set proposals.
- `allowBlockingProposals`: Permission gate for v5 blocking operations.
- `allowKeyframeProposals`: Permission gate for v6 keyframe operations.

### Local Bridge & Relay
A 3-tier local security transport:
1. **Browser ProposalBroker**: Runs in the web app, holding session state and review locks.
2. **Loopback Relay**: A local HTTP service bound strictly to `127.0.0.1` that enforces HMAC challenge-response pairing and epoch rotation.
3. **Stdio MCP Adapter**: A Node.js CLI process that speaks standard MCP over stdio to tools like Claude Desktop, Codex, or Antigravity, communicating with the browser through the local relay.

---

## 10. Quick Reference Summary Table

| Term | Domain | Mutability | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **`PromptAsset`** | Library | Mutable (versioned) | Reusable creative building block (Character, Environment, Style, etc.). |
| **`IdentityAnchor`** | Library | Locked on Approval | Freezes facial & anatomical traits to prevent AI generation drift. |
| **`Variant` (Outfit)** | Library | Mutable (versioned) | Character-owned costume/clothing variant. |
| **`Template`** | Library | Mutable | Pre-configured baseline recipe for rapid authoring. |
| **`SceneDraft`** | Authoring | Mutable (transient) | In-progress canvas in the Scene Builder. |
| **`SavedScene`** | Storage | **Immutable** | Persisted recipe or direct take with revision history. |
| **`SceneParticipant`** | Ensemble | Bound to Scene | Actor participating in a multi-character scene. |
| **`DialogueCue`** | Dialogue | Bound to Scene | Timed spoken line with actor assignment & performance notes. |
| **`CameraComposition`** | Camera | Bound to Scene | Structured lens, shot size, angle, and camera motion choice. |
| **`SceneBlockingV1`** | Blocking (v5) | Bound to Scene | Spatial staging (`Start -> Action -> End`), landmarks, and screen zones. |
| **`KeyframePlanV1`** | Keyframes (v6)| Bound to Scene | Start/end frame still targets and derived prompt generator. |
| **`StoryboardShot`** | Storyboard | Mutable (versioned) | Sequential shot unit within a project containing multiple takes. |
| **`ChangeSet`** | AI / MCP | Proposal Draft | Cryptographically hashed batch of proposed operations (`v1`–`v6`). |
| **`McpScope`** | Security | Browser-Governed | Granular disclosure and write-proposal permissions granted to AI. |

---

> **Next Up:** Continue to [Chapter 3: Building Your Reusable Asset Library & Templates](./03-user-guide-library-and-templates.md) to learn how to create and manage characters, identity anchors, and library items.
