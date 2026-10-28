# Camera & Cinematography

The existing Camera category has two views. **My Camera presets** keeps your original reusable records. **Technique explorer** searches 338 coverage items across 15 collapsible families. These items include techniques, optional controls and related planning concepts; they are not 338 newly installed assets.

## Compose one scene

1. In Scene Builder, choose **Compose Camera directions**, or open the Camera row and use the same action. From the Camera library, choose a technique's **Compose for scene** action.
2. Keep a reusable Camera preset as the base, or select **Unspecified — scene-only composition**. The original preset text remains available beneath the complete live preview.
3. Set independent framing, physical height, viewing angle, lens, focus and composition. Motion has primary/secondary components, phase arrangement and optional timing/path descriptors. Advanced contains rigs, capture descriptors, specialized techniques and property recipes. Unspecified controls add no instructions.
4. Review the complete Camera text and explainable advice. **Apply Camera directions** changes only this draft's Camera snapshot. Cancel and Escape discard unapplied controls. The library record and other recipe layers stay separate.

**Reset to Unspecified** removes structured controls and restores the exact prior Camera override, if present. It does not erase the reusable preset. Manually editing the Camera text exits structured controls; that authored text becomes the baseline if you compose again. Choosing a different Camera preset rebases the controls onto that new preset's text.

Saved takes retain frozen Camera text and metadata. Editing a copy creates a new draft; changing a draft does not regenerate an existing take.

## Find the right technique

Search canonical names or aliases such as `MCU`, `focus pull` and `Vertigo effect`. Filter by family, Shot Type or Property recommendations. Favorites and recent techniques are browser presentation preferences in localStorage, separate from library assets and full-library backups.

Lighting & Mood and Art Styles entries link to their existing categories. Coverage and continuity concepts link to Storyboard projects. Browsing these links does not apply a different Lighting or Style asset.

For Graphic / Motion Design and Existing Footage, the composer offers source-preserving editing choices. It does not require a physical camera height or lens. Existing incompatible selections remain visible for review. A flat floor plan is not a modeled 3D environment, and a digital crop/zoom does not create physical dolly parallax. Required original files remain subject to the existing Source Media and Preflight checks before assembly.

## Optional core pack

**Review core preset pack** previews eight small reusable Camera presets covering reviewed gaps. Nothing installs when the page or preview opens. Select missing entries, review the confirmation, then choose **Install selected missing presets**. The transaction checks the current library again, skips existing or ambiguous equivalents, and only adds selected missing IDs. It never replaces a preset or creates media.

The pack is `krakinai.cinematography-core@1`: Cowboy/American, Big close-up, Rule of thirds, Leading lines, Negative space, Look room, Deep focus and Source-locked composition. You can use all explorer techniques scene by scene without installing the pack.

## Optional snapshot contract

`ComponentSnapshot.cameraComposition` is optional and valid only in the `camera` slot:

```json
{
  "version": 1,
  "techniqueIds": ["composition.rule-of-thirds"],
  "parameters": { "movementSeconds": 4, "finalHoldSeconds": 1 },
  "arrangement": "sequence",
  "includeBaseText": true,
  "baselineOverrideText": "The exact pre-composition override, when present."
}
```

`techniqueIds` contains at most 40 unique, known Camera technique IDs. Lighting/Style, editorial planning and parameter catalog entries cannot masquerade as Camera selections. Parameters accept only documented keys; text is bounded to 500 characters and numbers must be finite and within the planning bounds in `cameraCompositionParameters.ts`. Unknown versions, IDs and fields fail validation before storage/import replacement. The UI bounds are broad planning limits, not a claim about a particular camera or generation service.

`baselineOverrideCompactText` preserves an optional compact baseline. `sceneOnly: true` identifies a component created solely by the current composition from `builtin:camera-composition:v1`; it is not a stored asset or database template. Reapplying regenerates from the baseline instead of appending directions again. Reset restores the baseline, including whitespace.

The original assembler consumes ordinary Camera overrides. Optional metadata is included in Project JSON's Camera component snapshot and Generation JSON's `cameraComposition` field only when present. Full-library backups and project ZIPs preserve it alongside frozen text. Older records need no migration or metadata backfill. Legacy output headers retain their historical wording to preserve existing bytes; UI labels use Camera & Cinematography.

## Limits of the advice

Warnings help review explicit contradictions and structured choices. They do not exhaustively interpret freeform prose, guarantee a feasible physical shoot, infer scene geometry or certify an external model's abilities. Capture values, rigs and movement descriptions are planning/prompt descriptors. Static camera-body framing can coexist with a rack focus or optical zoom. Deliberate compound moves and sequential phases are supported.

No provider API or camera-control integration is added. Existing media limits, immutable scene behavior, reference associations, backup safeguards and the separate 128 MiB Project Export limit are unchanged.
