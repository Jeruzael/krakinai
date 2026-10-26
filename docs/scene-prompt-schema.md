# KRAKINAI scene prompt v1

JSON is a locally derived KRAKINAI document, identified by `"schema": "krakinai.scene-prompt.v1"`. It is **not** an official Google, Veo, Omni, or other provider format. External tools may require their own adapter; exact speech and lip-sync remain dependent on the external generator.

`buildSceneDocument(source)` and `serializeSceneJson(source)` in `src/domain/sceneDocument.ts` read the selected draft or saved scene's preserved snapshots. They never look up newer library prompts, infer scene attributes, or translate free-form manual output edits. Serialization uses `JSON.stringify(document, null, 2)` with stable insertion order, no timestamps, no network request, and no binary embedding.

## Document contract

| Field            | Type and meaning                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------- | ----- |
| `schema`         | Literal `krakinai.scene-prompt.v1`                                                                                      |
| `scene`          | `title`, `type: "single_shot"`, and exact user `instructions`                                                           |
| `components`     | Seven ordered keys: character, wardrobe, environment, action, camera, lighting, style. Missing components are `null`.   |
| `dialogue`       | `null` if absent; otherwise the spoken-audio object below                                                               |
| `avoidText`      | Separate combined negative string; saved scenes use their stored combined text unchanged                                |
| `settings`       | `aspectRatio: string                                                                                                    | null`, `durationSeconds: number | null`, `toolNotes: string | null` |
| `referenceFiles` | Ordered metadata records from the authoritative saved checklist, or ordered unique media IDs from draft component links |

Selected components contain:

- `title`: source snapshot title.
- `prompt`: effective complete text; character identity always uses the original identity prompt. Other slots use a nonempty scene override if present.
- `compactPrompt`: complete character identity; otherwise a manually provided compact version, a matching compact override, or the complete effective prompt. A scene override without a compact override never reuses the old source's compact text.
- `avoidText`: component negative text or `null`.
- `source`: snapshot source `type`, `id`, `revision`, and `parentCharacterId` (`null` when absent).
- `snapshot`: original `promptText`, plus `compactText`, `overrideText`, and `overrideCompactText` (`null` when absent). Original and effective wording both remain available.

Reference metadata fields are `mediaId`, `role`, `altText`, `viewLabel`, `order`, `filename`, and `mimeType`. Optional missing metadata is `null`. Filenames are basenames; filesystem paths and transient URL values are excluded from metadata. Blob data, base64 media, object URLs and poster bytes are never serialized. Reference roles and duplicate associations in a saved checklist are retained; deriving JSON does not change stored associations or filter exported backup files.

## Spoken dialogue

```json
{
  "type": "spoken_audio",
  "mode": "on_camera",
  "speaker": "Mika",
  "language": "Taglish",
  "deliveryNotes": "Natural, user-entered delivery.",
  "exactLine": "Hello! I'm Mika, an AI avatar.\n\"Kumusta?\" — Tara, let's go! 😊",
  "captionPreference": "none"
}
```

Modes are `spoken` (unspecified position), `on_camera`, `voiceover`, and `off_screen`. Caption preferences are `unspecified`, `none`, and `requested`. Optional legacy values default to `spoken`, `null` language/delivery, and `unspecified` captions in the derived document only. No language, delivery, accent or lip-sync behavior is inferred. Speaker and exact spoken words are separate strings and retain punctuation, whitespace, quotes, Unicode and multiline content.

Dialogue requires the existing character selection, speaker and nonblank line. Additional fields are optional. Clear Dialogue removes only the dialogue configuration, preserving selected components and scene instructions.

## Workflow and compatibility

Prompt / References / Review remain the primary tabs. Prompt offers Narrative (`full` internally), Structured, Compact, and JSON. Draft output opens in Structured; saved scenes open in Narrative using their exact stored strings. Formatted and Raw are presentation choices. Copy always passes the complete raw selected string to the existing clipboard service; JSON uses Copy JSON. Selected downloads contain that same UTF-8 string. The separate full specification TXT includes prompt, settings, negative text and reference checklist. In JSON mode, this supplementary TXT is explicitly the Structured specification.

There are still only three stored output modes. No IndexedDB migration or mandatory JSON field was introduced. Opening a legacy saved scene does not regenerate its Full, Structured, or Compact bytes. Use Edit a Copy and assemble to adopt new formatting. JSON for an old scene is derived from its immutable snapshots and settings; manually edited text is not automatically interpreted into JSON fields.

Windows may normalize line endings to CRLF when text is read back from the system clipboard. The app sends the raw string unchanged; downloaded files retain the exact UTF-8 output bytes.

## Dialogue example before and after

For the synthetic Mika QA scene, the legacy assembler appended:

```text
Dialogue (Mika): Hello! I'm Mika, an AI avatar.
"Kumusta?" — Tara, let's go! 😊
```

With explicitly selected on-camera mode, Taglish, delivery notes and no captions, new Structured output contains:

```text
=== SPOKEN DIALOGUE SCRIPT ===
Speaker: Mika
Dialogue Mode: On-camera speech
Language: Taglish
Delivery Notes: Natural, user-entered delivery.
Captions: No on-screen captions.

EXACT SPOKEN LINE:
"Hello! I'm Mika, an AI avatar.
"Kumusta?" — Tara, let's go! 😊"

Performance Instruction:
Speak the exact line aloud as on-camera dialogue.
Treat the quoted words as the spoken performance script, separate from scene and camera instructions.
Do not display the spoken words as on-screen text unless captions were explicitly requested.
```

The spoken wording is unchanged. JSON represents the line as a properly escaped string. Voiceover and off-screen selections use their own explicit audio directions without instructing the character to visibly speak to camera. Without dialogue, the entire script section is absent.

Future nonblocking warnings about conflicting creative instructions are a separate enhancement. This release preserves both instructions rather than silently resolving a conflict such as photorealistic identity plus a stylized visual layer.
