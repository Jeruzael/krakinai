# Studio workspace design

## Intent and constraints

Implement the user's studio-workspace brief: make visual references and seven recipe selections visible together, with prompt details available on demand. Preserve every existing route, record, reference association, assembly byte, saved snapshot, and action. Storage, domain types, validation, assembler, backup, and dependencies stay unchanged. Reference Pack Manager is a separate follow-up; visual collapse never filters exports.

## Approach

The specified two-panel recipe workspace fits the existing React screens and local handlers. Keep those handlers and replace expanded presentation with shared visual reference and accessible dialog components. An all-accordion page would retain the long-page problem; a separate editor route would interrupt composition. Use in-place detail dialogs, as permitted by the brief.

## Screen behavior

- At desktop widths (1024px and above), Scene Builder has a bounded reference board on the left and an independently scrollable recipe panel on the right, with a sticky action footer. At 1440 × 900 all seven rows and Assemble Prompt are visible. Smaller widths stack panels and use normal page scrolling.
- Reference Board features one selected reference, a horizontal strip of at most six thumbnails, the full count, and a View All gallery. Every association is kept. Show component/role labels and an explicit demo illustration marker independently. External results remain visibly separate from input references.
- Rows show Character, Clothing, Environment, Action, Camera, Lighting, Style, selected name and status. Row details reveal complete prompt text. Character is read-only in the builder; other slots retain scene-only text/compact overrides, refresh, removal, and source navigation. Instructions, dialogue and settings use native expandable sections.
- Prompt Output uses accessible Prompt/References/Review tabs and existing Full Prompt/Structured/Compact submodes. Complete output is in a bounded focusable viewer. Copy, Download and Save stay available on every tab and always use the original complete strings. Existing manual-output edits, stale warnings, saved-scene immutability, collections and Edit a Copy remain.
- Character/variant details emphasize large media with compact metadata and full prompt disclosure. Variant cards show image, type, title, brief excerpt, details and Use in Scene. No trait inference or rewriting.
- Desktop navigation can collapse to a labeled icon rail; mobile navigation remains a drawer. Dialogs trap focus, close on Escape and restore the trigger. Tabs support arrow/Home/End keys and proper labels.

## Verification

Before/after screenshots use isolated synthetic browser storage at 1440px, 768px and 390px for builder, output, character and variants. Focused UI tests cover collapsed text, dialog focus and identity lock, keyboard tabs, full-string copying and downloads, reference completeness, and rail navigation. Existing tests, typecheck and build remain mandatory. Compare protected source files to the base and copied/exported output bytes to baseline fixtures.

## Delivery

Work on codex/studio-workspace-redesign, based on the merged QA fixes in master. Create a review PR; do not merge. Evidence and browser profiles remain outside the repository.
