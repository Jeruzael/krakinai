# KRAKINAI — AI Video Prompt Library

**KRAKINAI** is a single-user, local-first visual prompt library and deterministic scene builder for saving, editing, organizing, and combining prompts used in external AI image and video tools.

---

## 1. Product Boundaries & External-Generation Workflow

KRAKINAI manages reusable creative instructions, reference files, and sample results. It **does not** call external AI APIs, request API keys, include authentication/cloud sync/payments/analytics, or generate images/videos inside the app.

### Core Workflow

1. **Save a Character (`Characters`)**: Paste a character identity prompt (describing stable facial, hair, and body traits) and optionally attach up to 6 reference images or playable video samples.
2. **Add Variants (`Variants`)**: Create reusable look layers linked to a parent character (`Outfit`, `Expression`, `Pose`, `Camera Angle`, `Location`, `Visual Style`). Each variant stores only the changed layer and maps deterministically to its target Scene Builder slot.
3. **Compose a Shot (`Scene Builder`)**:
   - Select up to one component per ordered slot:
     1. `Character` (optional for scenery/product/B-roll shots; locked identity text in builder)
     2. `Clothing & Accessories`
     3. `Environment` _(required for assembly)_
     4. `Action & Emotion` _(required for assembly)_
     5. `Camera & Movement`
     6. `Lighting & Mood`
     7. `Art Style`
   - Add optional scene instructions, spoken dialogue (requires a character and speaker label), aspect ratio (`16:9`, `9:16`, `1:1`), and intended duration (`1–60s`).
   - Selecting an asset or variant snapshots its revision, text, and reference media IDs so later library edits never silently rewrite saved scenes.
   - The **Reference Board** displays selected input references only (`References only. This app does not render a combined scene.`).
4. **Inspect & Copy Output (`Prompt Output`)**:
   - View deterministic output in **Narrative**, **Structured** (recommended for new assemblies), **Compact**, or derived **JSON** mode. Use **Formatted** for readable production sections or **Raw** to inspect the exact copied string.
   - Keep exact spoken dialogue separate from visual direction; optionally select on-camera speech, voiceover, off-screen speech, language, delivery notes and captions. No words or delivery styles are inferred.
   - Copy the complete active output (with a selectable-text fallback dialog if clipboard access is blocked), download the selected `.txt`/`.json`, or export a separate full `.txt` specification containing **Prompt**, **Settings**, **Avoid / Negative Text**, and **Reference Checklist**.
   - Separately download and attach the listed reference files in your chosen external AI video/image generator.
   - Existing saved scene output strings remain unchanged. Use **Edit a Copy** to assemble with new formatting. JSON uses KRAKINAI's own [versioned scene document](docs/scene-prompt-schema.md), derived from preserved snapshots; it does not reinterpret manual text edits or claim provider-native support.
5. **Upload Results & Organize (`Saved Scenes` & `Collections`)**:
   - Upload the actual image or video generated externally into the scene's separate result area, record manual review notes (`Unreviewed` / `User-approved`), and group items into **Collections**.

> **Important Note on Character Identity:** Identity locking inside KRAKINAI preserves your saved identity prompt text and reference file checklist across scenes. It does not guarantee that an external AI generator will maintain visual character consistency.

---

## 2. Information Architecture & Hash Routes

All 9 primary screen types use client-side hash routing (`/#/...`) so refreshes work on any static host without server rewrites:

| Screen ID | Screen Name                        | Hash Route(s)                                                                                     | Source File                          |
| :-------- | :--------------------------------- | :------------------------------------------------------------------------------------------------ | :----------------------------------- |
| **S01**   | **Home**                           | `/#/`                                                                                             | `src/screens/HomeScreen.tsx`         |
| **S02**   | **Category / Library**             | `/#/library`, `/#/library/:category`, `/#/favorites`, `/#/scenes`                                 | `src/screens/LibraryScreen.tsx`      |
| **S03**   | **Prompt / Variant Detail**        | `/#/prompts/:id`, `/#/variants/:id`                                                               | `src/screens/PromptDetailScreen.tsx` |
| **S04**   | **Create / Edit Prompt & Variant** | `/#/prompts/new`, `/#/prompts/:id/edit`, `/#/characters/:id/variants/new`, `/#/variants/:id/edit` | `src/screens/EditorScreen.tsx`       |
| **S05**   | **Character Variants**             | `/#/characters/:id/variants`                                                                      | `src/screens/VariantsScreen.tsx`     |
| **S06**   | **Scene Builder**                  | `/#/builder`, `/#/builder/:draftId`                                                               | `src/screens/SceneBuilderScreen.tsx` |
| **S07**   | **Prompt Output**                  | `/#/output/:sceneOrDraftId`                                                                       | `src/screens/PromptOutputScreen.tsx` |
| **S08**   | **Collections**                    | `/#/collections`, `/#/collections/:id`                                                            | `src/screens/CollectionsScreen.tsx`  |
| **S09**   | **Templates**                      | `/#/templates`                                                                                    | `src/screens/TemplatesScreen.tsx`    |

Supporting dialogs/drawers (`src/components/SharedModals.tsx` and `src/screens/SceneBuilderScreen.tsx`):

- **Settings & Full ZIP Backup / Restore Dialog**
- **Scene Builder Asset & Variant Picker Modal**
- **Collection Membership & Creation Dialog**
- **Clipboard Fallback Modal** (when `navigator.clipboard.writeText` is denied/unavailable)
- **Confirmation Dialogs** (Unsaved form changes, Character-Variant parent mismatch, Character replacement clearing incompatible variants, Dependency-checked deletion)

---

## 3. Codebase Structure

```text
krakinai/
├── index.html                          # Entry HTML document
├── package.json                        # Scripts & dependencies (React 18, TypeScript, Vite, fflate, Vitest)
├── tsconfig.json                       # Strict TypeScript configuration
├── vite.config.ts                      # Vite & Vitest configuration
└── src/
    ├── App.tsx                         # Hash route dispatcher across all 9 screen types
    ├── main.tsx                        # React DOM entry point
    ├── index.css                       # Design tokens, responsive grids, reduced motion, accessible focus styles
    ├── types/
    │   └── domain.ts                   # Core TypeScript interfaces (PromptAsset, Variant, SceneDraft, SavedScene, etc.)
    ├── domain/
    │   ├── validation.ts               # Field bounds, media MIME/size validation, category & variant slot mapping
    │   ├── promptAssembler.ts          # Deterministic Full/Structured/Compact prompt assembler & .txt formatter
    │   └── starterData.ts              # 4 starter templates, 21 starter prompts, 6 Maya variants, 3 collections, local SVGs
    ├── storage/
    │   ├── db.ts                       # IndexedDB repository (krakinai_prompt_library_db), snapshot & dependency rules
    │   └── backup.ts                   # Full ZIP backup export, pre-restore validation, and atomic transactional restore
    ├── hooks/
    │   └── useObjectUrl.ts             # Ephemeral URL.createObjectURL / revokeObjectURL lifecycle hook
    ├── context/
    │   └── LibraryContext.tsx          # App state, hash navigation, dirty-form guard, clipboard fallback, modals
    ├── components/
    │   ├── AppShell.tsx                # Fixed desktop sidebar, mobile drawer, top bar, "Stored on this browser" badge
    │   ├── MediaThumbnail.tsx          # Image/video thumbnail renderer with graceful empty/broken placeholders
    │   ├── PromptCard.tsx              # Reusable card for assets and character variants
    │   └── SharedModals.tsx            # Settings/Backup, Collection membership, Clipboard fallback, Confirmations
    ├── screens/                        # S01–S09 screen implementations
    └── __tests__/                      # Automated unit, repository/backup, starter library, and E2E workflow tests
```

---

## 4. Local Persistence (`Stored on this browser`)

- All prompt assets, variants, collections, saved scenes, drafts, templates, preferences, and original media `Blob`s are stored locally in your browser's **IndexedDB** (`krakinai_prompt_library_db`).
- Uploaded media is never stored as base64 in `localStorage`, and temporary `blob:` object URLs are never persisted — object URLs are created at render time from stored `Blob`s and revoked on cleanup.
- **Limitations:** Browser IndexedDB storage is tied to this specific browser profile and origin/URL. It is **not** cloud sync or an automatic backup. Opening the app in another browser, private window, or different URL will display a separate library, and clearing browser site data will remove local records.

### Prototype Media & Storage Limits

- **Images:** JPEG, PNG, WebP up to **10 MiB** each.
- **Videos:** Playable MP4, WebM up to **50 MiB** each.
- **Attachments per record:** Up to **6 files** per prompt/variant and up to **6 result files** per scene.
- **Total stored media:** **200 MiB** prototype limit.
- **Uncompressed backup archive:** **250 MiB** prototype limit.

On fine-pointer desktop devices, video card covers support muted hover preview unless reduced motion is enabled. Leaving the preview pauses and resets it. Use **Expand media** for an image lightbox or video with native controls; **Open Prompt** remains a separate navigation action. Touch devices use explicit expansion, without relying on hover.

---

## 5. Full ZIP Backup & Transactional Restore

Open **Settings & Backup (.zip)** from the sidebar or top bar at any time:

- **Export Full Backup (`.zip`):** Packages `manifest.json` (versioned schema metadata, assets, variants, drafts, saved scenes, collections, templates, and preferences) together with all original binary files under `media/` (and optional `posters/`). Metadata-only JSON is never described as a full backup.
- **Restore Full Backup (`.zip`):**
  1. Validates the ZIP archive structure, schema version, entry bounds, byte sizes, variant-parent links, collection references, and media integrity before writing.
  2. Displays a pre-restore summary and requires explicit confirmation before replacing the current browser library.
  3. Performs a **transactional replacement** (not a merge) across all IndexedDB stores. If archive validation or database write fails, the transaction aborts and your existing library remains intact.

---

## 6. Development & Verification Commands

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Run TypeScript type checking
npm run typecheck

# Run automated test suite (Vitest + fake-indexeddb + Testing Library)
npm test

# Build production bundle
npm run build
```
