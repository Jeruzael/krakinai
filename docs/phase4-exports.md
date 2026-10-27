# Phase 4 generation exports

Generation JSON (`krakinai.generation-prompt.v1`) is a KRAKINAI-defined export schema, not a provider request payload. Project JSON (`krakinai.scene-prompt.v1`) and canonical text remain unchanged. These pure adapters do not write scenes or invoke services.

`buildGenerationDocument(source, options?)` and `serializeGenerationJson(source, options?)` preserve complete effective snapshot text, instructions, settings and canonical dialogue. Keys are stable: schema, scene, character, wardrobe, environment, action, camera, lighting, style, dialogue, negativeInstructions, references. Missing components/dialogue are null; absent settings are null. Camera remains free text. Identity occurs once; character overrides/compact text do not replace its master. Explicit `options.identity` accepts an already resolved master/approved anchor; approval validation belongs to the identity domain. No approval is inferred by this serializer.

`GenerationExportOptions.references` explicitly overrides the legacy checklist, including an empty array. Absent options preserve the saved checklist or snapshot-derived legacy associations. References contain metadata only (associationId, mediaId, sourceSlot, purpose, order, filename, mimeType, role, altText), with no blobs, paths or transient URLs. Filename paths become basenames; unavailable filenames/MIME/alt text remain null. Association duplicates and provided ordering remain intact.

Negatives are compared as whole fields using NFC, trim, whitespace folding and lowercase; the first original string survives unchanged. Commas are never parsed. For saved scenes identified by their authoritative references field, only the exact component-fields joined prefix is removed from the archived combined negative field. Unrecognized text remains whole. Source records are never changed.

`EXPORT_PRESETS` describes Generic Structured, Gemini Omni Flash and Custom starting template. `formatGenerationText` emits sectioned, complete scene text. Omni dialogue uses speaker/action plus colon without adding outer quotes; user-authored quotation marks and Unicode survive. Voiceover and off-screen modes remain audio direction. Caption, language and delivery preferences are emitted only from canonical data. Negative instructions are ordinary text constraints. References are a checklist requiring separate attachment. Custom currently uses the generic template and does not persist user preferences.

Official guidance verified **2026-10-26**:

- [Gemini Omni API guide](https://ai.google.dev/gemini-api/docs/omni): current model `gemini-omni-1.1-flash`, reference roles and scoped video-reference workflow. Up to three video reference clips of up to three seconds each applies to that API workflow, not a universal attachment-count limit. No native `negativePrompt` parameter is documented.
- [Video generation guide](https://ai.google.dev/gemini-api/docs/video): Veo 3.1 Preview retired on 2026-10-22; it is not advertised as an available preset.
- [Gemini Omni prompt guide](https://deepmind.google/models/gemini-omni/prompt-guide/): explicit framing, motion, style, lighting, location and action descriptions.
- [Google video prompting best practices](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/best-practice): focused scenes and speaker/action followed by a colon without decorative quotation wrappers.

These are date-scoped prompting recommendations, not guaranteed compatibility or output quality. General attachment and output-duration limits are null in metadata because this adapter does not establish a specific provider request mode. `getProviderNotices` exposes this uncertainty. No claims are made about character consistency, speech quality or external generation success.

Focused tests cover exact Unicode/quotes, effective overrides, schema ordering, nulls, explicit resolved identity/reference options, whole-field deduplication, saved combined negatives, unchanged source/Project JSON, audio mode formatting and dated unknown-limit metadata.
