# Advanced prompt output and media preview

The user's complete specification is the binding scope. Enhance the existing local React/TypeScript application; keep IndexedDB version 1, existing records, backups, component associations, and immutable saved outputs.

## Approach

Keep stored `OutputMode` values `full`, `structured`, and `compact`. Display `full` as Narrative; add JSON as a derived presentation mode, never a mandatory saved output. A pure `buildSceneDocument(source)` function reads only the selected draft or saved scene snapshots, settings, dialogue, and reference checklist. New text assembly formats that document; saved scenes continue reading their original strings. Edit a Copy is the path to new formatting for a legacy scene.

Alternatives rejected: storing a fourth output would force unnecessary compatibility work; formatting independently in React would duplicate scene interpretation and risk copy/preview disagreement. A shared deterministic document avoids both problems.

## Interfaces

`src/domain/sceneDocument.ts` exports `SceneDocumentSource`, `SceneDocument`, `buildSceneDocument(source)`, and `serializeSceneJson(source): string`. `SceneDocumentSource` accepts SceneDraft or SavedScene without requiring an ID; fields are title, slots, sceneInstructions, optional dialogue, settings, optional avoidText, optional references. Presence of authoritative `references` (including an empty array) identifies the saved checklist and saved combined negative text. Draft references/negative text are assembled from ordered snapshots plus draft negative text.

Document keys in order: schema (`krakinai.scene-prompt.v1`), scene (title, type=single_shot, instructions), components (seven ordered slot keys, absent slots=null), dialogue (null when absent), avoidText, settings (aspectRatio, durationSeconds, toolNotes; missing values=null), referenceFiles. Each selected component includes title, effective prompt, compactPrompt, avoidText, source (type, id, revision, parentCharacterId), and snapshot (original promptText, compactText, overrideText, overrideCompactText). Identity always uses its complete original prompt. No invented camera/identity/model attributes. JSON references contain metadata and safe basenames only, never URLs, bytes, or filesystem paths.

Optional DialogueConfig properties: mode=`spoken`|`on_camera`|`voiceover`|`off_screen`, deliveryNotes, language, captionPreference=`unspecified`|`none`|`requested`. Absent legacy values default only in derived output; do not rewrite legacy records. Preserve exact speaker and line strings, including whitespace, punctuation, quotes, Unicode and line breaks. Validate partial speaker/line and optional enum/length bounds. New Structured, Narrative, and Compact outputs delimit a spoken script and describe only explicitly selected dialogue/caption options.

## UI

Keep Prompt / References / Review. Inner formats Narrative / Structured / Compact / JSON, Structured initially selected for drafts, Narrative for saved scenes. Formatted/Raw presentation is local UI state; copy/download always use complete raw selected text. JSON is read-only and derived from snapshots; explain that manual free-form edits are not translated. Preserve stale manual edits and unfinished editing buffers. Offer selected prompt download and clearly labeled full text specification download separately. No unsafe HTML rendering.

Scene Builder keeps its collapsible dialogue panel, adding mode, delivery, language, and caption controls. MediaThumbnail gains optional default-false hover preview, gated by hover+fine pointer and no reduced motion. Muted looped inline playback stops/resets on exit, eligibility loss, cover change, unmount and expanded dialog. Add a shared accessible media dialog using StudioDialog. Cards use sibling Expand Media, favorite, and Open Prompt actions with no nested buttons.

## Verification and preservation

Capture baseline three-format strings and before screenshots before runtime changes. Test legacy outputs and backups, scene-only overrides, exact long identity/dialogue/Unicode, JSON reference provenance and escaping, view/copy/download equality, manual edit handling, modal focus, hover eligibility/play rejection and URL cleanup. Run isolated Chromium Playwright at 1440x900, 768 and 390 widths with synthetic media. Never use the user's browser storage for QA. Run npm ci, tests, typecheck, build, production audit and diff checks; report actual warnings and exits. Deliver a feature-branch PR to master, never merge.
