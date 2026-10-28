# Scene Output workspace design

Implements the user's Scene Output Workspace Redesign brief and its approved Split View and Studio Tabs concepts. Baseline: master `10aaa84877c4b182c42ef3fd395173dbaa823223`.

## Intent and boundaries

Remove the full inline prompt from the normal output workspace. Keep configuration, truthful scene visuals, a concise summary and existing actions visible. Show the complete selected output in a shared accessible dialog. Both layouts use the same screen state and existing handlers.

Preserve all canonical strings, serializers, workflow/format selection relationships, identity rules, immutable scenes, reference associations, storage schema/limits, project workflows and backup behavior. No dependencies, remote APIs or real-browser data changes. PR #12 remains separate.

## Approach

One presentation component receives shared configuration, summary, tools, sections and action content from PromptOutputScreen. Split View places actual associated media beside configuration and summary. Studio Tabs offers Configuration, Preview, Sections and Tools. Actions have one active location within the selected panel; scene management remains in one footer. A separate generator for each layout was rejected because it could change output semantics. Persisting layout in scenes was rejected because layout is presentation state.

Default to Split View at 1200 CSS pixels and above; use Studio Tabs below that breakpoint. A user's manual selection overrides automatic defaults for the current output visit. Mobile Split View stacks. This breakpoint and the temporary preference are implementation choices.

Scene visuals prefer an available result, then an available linked reference. Users may select another association. Preserve Reference/Result/Sample labels, including illustrative media. Missing files show a placeholder and disabled preview. Never infer scene descriptions or create media.

## Prompt viewer

Use StudioDialog focus trapping, Escape, background inertness and scroll locking. Add an optional return-focus target for the viewer's Show Prompt action. One vertical prompt viewport holds all content; header/actions/footer stay outside it. Desktop navigation sits alongside the viewport; mobile uses a compact selector.

The deterministic index recognizes standalone delimited headings emitted by existing exporters and recognized Markdown headings. Unknown prose remains text. JSON and text without recognized headings have a Full Prompt fallback. Navigation preserves format. Formatted headings have anchors; Raw preserves all whitespace and characters. Copy/download always call the existing handlers with activeText.

## Editing and secondary controls

Retain the per-format manual editor and its session cache. Show an explicit unsaved-buffer notice: viewing, copying and downloading use the last saved output until Save Manual Output Override. Keep stale-edit confirmation, reset, preflight, reference management, review/results, save/new-take, Edit a Copy, collection membership and return navigation. Avoid/provider/settings controls move into Advanced Options/Tools.

## Verification

Capture deterministic synthetic output before and after at 1440×900, 768×1024 and 390×844. Exercise both layouts, modal navigation/presentation, JSON, long and empty output, missing media, stale edits and immutable saved scenes. Compare UTF-8 clipboard and actual selected/full-spec downloads with baseline fixtures across all formats and workflows. Test keyboard focus, Escape, trapping, page scroll lock, section scroll location, browser reload and 720×450 CSS reflow (200% equivalent). Run full unit/component and browser suites, typecheck, build and production audit, then review the full diff. Keep synthetic artifacts ignored; publish only scoped source, tests and documentation.
