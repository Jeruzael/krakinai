# B3 — Guided AI Recipe Builder and Direct Prompt Conversion

Date: 2026-11-01. Status: approved for inline implementation on 2026-11-01.

## Intent and baseline

Turn an existing saved Direct Prompt into a reviewable, genuinely assembled
recipe alternate take on the same storyboard shot. Make reusable components,
per-person wardrobe, dialogue attribution, uncertain extraction, and missing
production inputs visible before anything is saved. Complete the installed-Codex
workflow using the authenticated bridge and actual browser approval controls.

Base: `master` merge commit `96e819ae23adc2bf897c7e3ccc71e16176e28b42`
(B2 PR #31). Work in the existing isolated checkout on
`codex/ai-recipe-builder-b3`; open a separate PR against `master`, unmerged.

The user's Workstream B brief, sections 17–24 and its compatibility/delivery
requirements, defines B3. The user chose **Guided conversion screen** on
2026-11-01 and approved this document for inline implementation, including writing
the implementation plan without another planning approval. Production conversion
and PR merging remain unauthorized.

### Existing implementation, directly inspected

- `src/components/DirectPromptWorkspace.tsx`: **Build from Assets** currently
  creates a blank persisted recipe draft, without a Direct Prompt mapping or
  same-shot conversion target. Keep that existing action compatible.
- `src/domain/changeSetRecipe.ts`: v2/v3 recipe operations reconstruct recipes
  through the existing assembler/save planner. A Direct Prompt is deliberately
  rejected as a recipe revision parent.
- `src/storage/sceneAuthoring.ts`: `planAuthoredScene()` already supports fresh
  recipe roots and immutable revisions/takes, exact project revision checks,
  source validation, and explicit preferred-take selection.
- `src/connections/proposalBroker.ts`: proposal submission is read/preview-only;
  approval needs trusted browser events, exact digests, live scope, and Stage B's
  atomic save. Preserve this authority boundary.
- `src/types/changeSet.ts`, `src/domain/ensembleChangeSetSchema.ts`: v3 supplies
  participants, compatible Outfit bindings, ordered cues, and reviewed candidates.
- `src/domain/mcpReads.ts`, `src/domain/mcpScope.ts`: existing scoped reads can
  retrieve project/shot metadata, explicitly shared prompts, reusable assets,
  variants, receipts, and generation prompts. No new MCP tool is needed.
- `scripts/qa/mcp-cli-workflow.mjs`: the current installed-CLI certification
  validates one Direct Prompt revision. It is not evidence of a ten-shot recipe
  conversion; B3 needs a separate strict workflow and evidence.

These are source observations, not B3 test results. B3 has no implementation or
passing test claim at design time.

## Goals, non-goals, and failure conditions

Deliver the guided screen, explicit conversion provenance, versioned import/MCP
parity, scene-versus-library revision choices, synthetic full-workflow acceptance,
and a production conversion plan. Preserve all historical outputs and references.

Do not convert the real Wedding project during development or testing. Do not
create another production Wedding project. Do not implement Stage D/ChatGPT Web,
an AI backend, automatic extraction requests, cloud storage, new paid dependencies,
automatic approval, or direct-write MCP tools. Do not change unrelated
`validation.ts` work, PR #12, large-backup gates, storage limits, or actual profiles.

The feature fails if it silently copies the Direct Prompt as the new output,
changes an old scene, selects a new preferred take implicitly, rewrites a global
asset through a scene edit, invents media IDs, implies a pending frame exists,
expands ongoing Codex read permissions, or claims synthetic evidence proves a
real-library operation. It also fails if a later successful CLI reply is used to
hide an earlier failed call.

## Approaches

1. **Guided screen, selected by the user.** A focused in-app mapping workspace
   feeds the existing import review and atomic writer. It adds UI work, but makes
   source, component provenance, uncertainty, and pending inputs understandable.
2. **Existing review screens only.** Codex could emit an import package and use
   the current importer. Less UI, but no clear conversion entry or guided mapping.
   The user did not select this option.

Implementation choices below are the agent's proposals, rather than additional
choices already made by the user. Reuse the existing React/TypeScript components,
palette, dialogs, pickers, assembler, Stage B transaction, and Stage C broker.

## User flow

### Entry points and exact target

Add **AI Recipe Builder** to the existing AI planning actions, and **Convert to
Recipe** to saved Direct Prompt actions and storyboard take actions. Keep current
routes working. A proposed lazy route is `/recipes/ai`; conversion adds the source
scene, collection, and shot through existing project-route helpers.

The entry screen offers **Build a recipe** and **Convert a saved Direct Prompt**.
Build a recipe points to the existing builder and offers a scoped Codex request;
it must not introduce another general-purpose scene editor. Conversion is the new
guided workflow. Saved recipe actions expose **Revise This Scene**, **Create
Alternate Take**, and **Create or Revise Reusable Asset** with their different
effects stated before proceeding.

Conversion accepts a saved Direct Prompt already attached to an existing shot.
If context is ambiguous, select one of its actual project/shot memberships. If
none exists, explain that it must first be attached using the existing storyboard
workflow. Never guess a project, select a similarly titled shot, create a project,
or attach the new take to a different shot. Unsaved Direct Prompt forms must be
saved explicitly before conversion; the existing form is preserved.

### Guided workspace

1. **Source and destination.** Show the exact source scene/version, current
   project revision, shot code/title, preferred take, Shot Type, aspect ratio,
   duration, and source reference/pending-input counts. The complete original
   prompt is in a labelled collapsible, scrollable viewer. Explain that the
   result is a new assembled take whose wording/format can differ.
2. **Map the recipe.** Show compact shared component rows and the existing
   participant/wardrobe and ordered-cue controls. Each mapping shows the selected
   asset/variant ID, title, revision, origin, and an extraction assessment.
   Search uses existing local records; compatible Outfit results are constrained
   to their actual parent Character. Identity text remains locked. Source prose
   is never treated as authority to infer a new identity or approve an anchor.
3. **Preview and review.** Render the same resolved recipe preview used by Stage
   B: complete Full/Structured/Compact outputs, source comparison, actual component
   snapshots, dialogue/camera settings, readiness, reference associations, pending
   inputs, and candidate decisions. Copy/download operate on complete text.
   **Review and save alternate take** opens the existing browser review controls;
   it is not a second writer or a shortcut around confirmation.

The mapping form is transient browser memory. Opening it, searching, preparing
packages, receiving proposals, and previewing cause no database writes. Do not
mount the existing auto-saving builder as a hidden conversion implementation.
Offer **Download mapping package** and a leave-page warning for unsaved mapping
work. Reopening the downloaded package through the importer restores its proposed
mapping and uncertainty, but never restores browser approvals. Do not add a store
or silently persist private source text in localStorage or URLs.

### Codex assistance without a new AI backend

Offer **Prepare Codex mapping request** with source/project/shot IDs, the requested
workflow, and the existing context-export/AI Connections actions. The user can
copy/download this request and bring it to Codex. Do not automatically send it to
a provider or add a free-form prompt to assembled recipe output.

Reading source text through MCP still requires its existing explicit full-prompt
grant. Character identities, ordinary asset prompts, notes, filenames, and other
disclosures keep their separate existing controls. Opening the guided screen or
copying an IDs-only request grants nothing. Any optional source/context export
uses the existing explicit disclosure selection and preview.

Manual mapping works locally without pairing. Codex-generated mappings arrive as
normal immutable proposals and open in the same guided presentation from an
explicit **Review mapping** action. Proposal arrival never moves focus or changes
routes. Editing a received mapping creates a new browser-owned package and
requires a new preview/digest/approval; it does not mutate the incoming proposal,
reuse its consent, or claim that the original proposal was applied. Reject or
supersede the old proposal explicitly, and show which package owns the receipt.

## Versioned conversion contract

Introduce `krakinai.change-set.v4`, derived from v3 with one new operation:
`scene.convert_direct_to_recipe`. Keep v1/v2/v3 schemas and historical behavior
unchanged, including the prohibition on silently using a Direct Prompt as a
`scene.revise_recipe` parent.

The new operation uses the existing operation ID/clientRef, explicit stored
project target with expected revision, and explicit stored shot ID. It includes:

- `sceneId`: exact saved Direct Prompt source; `expectedHeadId`: its current
  revision-family head. An older explicit source may be converted only while its
  expected current head still matches and that source belongs to the target shot.
- `conversion`: version 1, expected source Full-text SHA-256, and bounded mapping
  rows. SHA-256 is over UTF-8 source Full text without normalization. Any source
  text, membership, head, component revision, or project change invalidates the
  existing preview/consent through the current state-signature checks.
- Explicit title, Shot Type, and scene settings, plus the existing v3 recipe
  fields: actual asset/variant bindings, ensemble, cues, scene-only overrides,
  instructions, negative text, Camera composition, references, original source
  media, pending inputs, and factual-claim notes. No raw snapshots, manual output
  strings, human-approval flags, identity rewrites, or invented upload completion.

Extend v4 parser/types, created-kind/dependency resolution, planner, schema export,
manual import, MCP preview/submit unions, receipt validation, context projection,
and backup validation together. Retain strict unknown-field rejection and verify
runtime/JSON Schema parity. Do not merely add an enum without all execution paths.

### Mapping rows and human decisions

Use stable bounded IDs and a typed target union rather than executable object
paths. Targets cover a shared component slot; a participant's Character/wardrobe;
a dialogue cue; settings; scene instructions/avoid text; the reference pack;
original source media; or the pending-input group. For ensemble recipes, mirrored
primary slots are a display convenience, not duplicate mappings or associations.

Each row contains an assessment (`suggested`, `uncertain`, `unassigned`, or
`omitted`) and a bounded explanation. An optional source span uses UTF-16 string
offsets into the exact source text, is bounds checked, and is labelled an excerpt
location rather than a byte offset or proof of semantic correctness. A target
must exist in the proposed recipe, and displayed IDs/revisions are derived from
the actual bindings, not duplicated author-supplied claims. Proposed bounds:
128 rows per conversion, 64-character row IDs, 500-character explanations; all
existing operation, string, package, frame, and result limits still apply.

Browser-owned approval adds a per-operation mapping-reviewed acknowledgement and
per-row acknowledgements for uncertainty or intentional optional omissions.
Defaults are unreviewed; Codex cannot submit these acknowledgements. Required
unassigned components block assembly/application and cannot be waived by a
checkbox. Optional missing production references may instead remain honest
pending inputs. Acknowledgements are bound into the reviewed projection/digest,
invalidated on any mapping/decision/scope/state change, and consumed once through
the existing review transaction. A package can be schema-valid and downloadable
while assembly is blocked; the UI states why and provides the relevant picker.

## Assembly, provenance, references, and storage

Construct a fresh transient recipe draft from explicit v4 inputs. Set
`authoringMode: recipe`, keep `manualOutputs` empty, and invoke the existing
assembler and `planAuthoredScene()` through the Stage B planner. Never use source
Full text as a fallback, hidden manual output, automatic scene instruction, or
new assembler branch. An explicit creative reference remains provenance visible
to the reviewer; it does not feed the assembler automatically.

The new saved scene starts its own recipe revision root (sequence 1, no Direct
Prompt graph parent). Keep the existing source-scene link and add optional,
validated version-1 conversion provenance: exact source scene ID/text hash and
reviewed mapping. Preserve that provenance through later recipe revisions/takes,
copy/export/restore, without requiring the source record to be present in an
independently exported project. Do not repurpose the existing revision graph as a
mixed authoring-mode history. Old records need no backfill or schema migration.

Retain the original scene's complete record, output bytes, reference-pack
associations, media bytes, result links, review state, and revision graph. In the
new recipe, carry forward the source's explicit reference associations/order by
default, alongside actual mapped component references, using existing traversal
and association rules. Do not silently filter files or rename roles. Any optional
reference exclusion from the new take must be explicit and previewed; it never
changes the original or deletes media. Do not carry externally generated results
into the new take as if they were new generation results. Show them as source
context only unless the user explicitly chooses a legitimate reference role.

Source media for Graphic/Motion or Existing Footage must satisfy the existing
`validateShotSourceMedia()` rules against the current stored map before assembly
and inside save validation. Missing optional Character/Property reference frames
remain pending with readiness warnings; they are not fabricated or silently
treated as mandatory original source media.

Conversion must preserve all original pending requirements unless the user
explicitly resolves/removes them in the reviewed mapping. Source settings seed
the mapping visibly; later changes are explicit. Frozen Character/approved anchor
semantics and media ownership/unsaved-form protection are unchanged.

Append the new recipe take to the same shot in the same Stage B transaction as
approved asset/Outfit writes, project updates, candidates, and the receipt. Default
preferred selection is unchanged. Choosing a preferred take remains a separate
`shot.select_take` operation with expected selection and explicit preferred-take
approval; conversion approval alone is insufficient. Exact replay returns the
same receipt and creates nothing; conflicting IDs/digests fail. A late failure
rolls back every write, including candidates and the receipt.

Keep IndexedDB's version and eight stores, cleanup/persistence rules, immutable
outputs, legacy backup support, and all current limits unchanged. Optional record
metadata needs bounded validation across save, full backup, project export, and
restore; malformed metadata must reject before replacement. Project Export stays
128 MiB. This is not ZIP64 recovery certification.

## Reusable elements and revision actions

Use existing asset/Outfit proposals and browser create/reuse/defer decisions.
Search before proposing; show possible matches and correct parent ownership.
New records remain unreviewed without identity/anchor approval. Deferring a
required dependency blocks the dependent conversion and its complete batch;
download and resume it rather than partially saving scenes.

A new Character cannot parent a same-batch Outfit under existing B2 rules.
Approve the Character first, then explicitly select its ID/revision in scope and
propose the Outfit in a later reviewed batch. Existing Characters can use approved
same-batch Outfit candidates. No cap increase or new read-permission exception is
needed. Preserve 250 operations, 100 scene operations, 50 asset/variant candidate
operations, 500 pending inputs, and the existing project/shot and ledger bounds.
Manual imports remain 20 MiB; MCP packages 1 MiB and results 512 KiB. Oversized
requests/previews fail with no writes; split into dependency-first approved
batches or use the existing explicitly reviewed manual importer.

**Revise This Scene** starts from its frozen snapshots, changes only explicitly
selected components/instructions/cues/settings, and creates an immutable recipe
revision; changing a live library asset does not automatically update it.
**Create Alternate Take** uses the existing new-root take behavior on the same
shot and leaves preference unchanged. **Create or Revise Reusable Asset** uses
existing proposals or the current library editor; editing an existing asset is
never disguised as a scene-only override. Scenes adopt newer asset revisions only
through an explicit refresh/rebind and a new immutable save. Character identity
edits use the existing protected library/anchor workflow, never inline overrides.

## MCP authorization and acceptance architecture

No new MCP tool or transport. Extend the existing supported change-set union.
For conversion, require authorization to the source scene, exact target project
and shot, and existing bindings/media. Full source text or comparison returned
to Codex requires its explicit full-prompt grant; do not leak it through preview
errors, conversion mappings, provenance, history, receipts, or newly created takes.
Preserve existing per-field identity/text/note/filename redaction. Browser-only
mapping does not grant MCP access. New asset/variant IDs in receipts are not read
grants; explicit permission changes still invalidate pending approvals.

Add a separate installed-CLI workflow validator alongside the current strict
single-revision validator. Use the actual installed CLI (record executable/version
when run), production stdio launcher, existing isolated loopback model fixture,
signed native Windows helper, and a fresh disposable Chromium profile. No external
AI credentials, actual browser data, fake approved strings, injected native
decision callback, or direct SDK replacement for this acceptance evidence.

The loopback model fixture is deterministic synthetic model input, not evidence
of real model creativity. The CLI must really execute the tool calls and receive
the actual authenticated bridge responses. Correlate every response with its
unique call ID/tool/expected arguments; validate immutable earlier responses on
every step, and record success/error codes plus response hashes. A failed or
missing call fails the workflow at that step. Reject fabricated success text,
wrong IDs, swapped responses, partial receipts, and a later success masking an
earlier failure. Add negative tests for the validator itself.

### Synthetic ten-shot acceptance

Seed three clearly labelled synthetic fictional Characters (Iris, Noah, Evan as
test counterparts to Aya, Lucas, Marco), several parent-owned Outfits, shared
Environment records, reusable Actions, Camera, Lighting, and Style; ten saved
synthetic Direct Prompts on ten existing storyboard shots totaling 70 seconds at
9:16, with each original selected as preferred. Seed valid decodable synthetic
media and exactly six honest pending reference-frame requirements. Seed a second
unselected project/asset as a privacy canary.

Through the installed CLI, require real scoped project/storyboard/source reads,
asset/variant searches, at least one compatible stored Outfit, missing reusable
element and same-batch Outfit proposals, multi-character bindings, and ordered
cue attribution. The ten-shot scene structure follows the Wedding mapping below,
using explicitly fictional dialogue fixtures. Include a camera/lighting change
that proves output comes from the selected recipe components, not the original
prose; retain an unmapped source-only sentinel that must not appear automatically
in new output. No production dialogue or records are exported to fixtures.

Preview all three assembled modes through the actual tool. Submit the complete
bounded conversion package. Assert every database store is unchanged before
approval, including drafts/candidates/preferences and media hashes. Open the
actual mapping review with Playwright's trusted UI interactions, make candidate
decisions, acknowledge mapping/uncertainty, and approve the exact batch through
Stage B. Check the ten new recipe-root IDs from the actual receipt, assembler
equality, old records/outputs/reference associations/media hashes, all ten
unchanged preferences, 70-second plan/order/IDs, pending-frame semantics, correctly
attributed cues, parent-owned wardrobe, and shared Environment reuse.

Have the installed CLI retrieve actual proposal status and the confirmed receipt;
replay the identical package and assert identical receipt/IDs and no store change.
Read permitted new scene metadata without broadening full-prompt permissions;
test unauthorized newly created asset reads/searches remain unavailable. Exercise
new immutable recipe revision and alternate take behavior with unchanged frozen
components, plus a separately approved preferred-take operation in a distinct
synthetic test. Disconnect through the real UI, then prove project reads, proposal
submission/status, and receipt access are revoked through actual CLI responses.

Run complete acceptance for both `http://127.0.0.1:4173` and
`http://localhost:4173`; prove the opposite origin has an independent empty
library, then reload/reopen the owned test profile and verify committed data.
Never use the real `localhost:5173` library or live bridge at port 4177. Record
the exact test configuration so localhost-origin coverage is not mislabelled as
a real-profile operation.

## Wedding conversion plan — no production execution

Use only the user's brief to write a non-destructive production plan. Historical
reported state is ten Direct Prompt takes, ten preferred selections, ten shots,
70 seconds, 9:16, and six pending frames. This is not a current live inventory.
Keep the private project identifier and any later authorized real inventory in
an ignored local plan; publish only the generic workflow and synthetic evidence.

| Shot | Reusable mapping from the brief |
| --- | --- |
| 01 — The Wedding Day | Chapel Exterior, Establishing Camera, Daylight, Romantic Drama |
| 02 — The Bride Still Waiting | Aya, Bridal Outfit, Bridal Room, Waiting, Mirror Camera, Aya cue |
| 03 — Marco Is Running Late | Marco, Formal Outfit, Walkway, Urgent Approach, Following Camera, Marco cue |
| 04 — The Last Look Back | Aya and Lucas, distinct Outfits, Chapel Aisle, Hesitant Walk, Aisle Master |
| 05 — The Question | Aya and Lucas, Chapel Altar, Emotional Hesitation, off-camera officiant cue |
| 06 — I Do | Aya and Lucas, Chapel Altar, Quiet Acceptance, Close-Up, Aya cue |
| 07 — Lucas's Promise | Lucas and Aya, Chapel Altar, Ring Exchange, Detail Camera, two ordered cues |
| 08 — Husband and Wife | Aya and Lucas, Chapel Altar, Wedding Kiss, officiant pronouncement |
| 09 — Marco Arrives Too Late | Marco, Aya, Lucas, Chapel Entrance, Sudden Realization, Arrival Reveal, Marco cue |
| 10 — Late Again | Aya, Lucas, Marco, Chapel Entrance, Silent Parting, Eye-Line Match, Aya cue |

Off-camera officiant speech uses the existing non-participant/off-camera cue
mechanism; do not invent a fourth Character identity. Keep reusable Actions
generic, person-specific behavior scene-only, and share chapel Environments.
Exact production dialogue must later be taken from the explicitly authorized
saved prompts, not invented or reconstructed from the plan's short summaries.

Retain pending frames for 02 (mirror), 03 (approach), 04 (aisle), 06 (altar),
09 (arrival), and 10 (09's approved ending frame). Shot 10's dependency is not
an uploaded image or a fake media ID. It stays pending until a real approved frame
exists and is explicitly selected.

Only after the B1/B2/B3 PRs are merged, the synthetic acceptance passes, and the
user separately authorizes production changes: read the actual existing project
and revisions, resolve authorized real assets, propose missing components, preview
ten recipe alternate takes on its existing shots, obtain human approval, and
return actual IDs/receipt. Never create a replacement project or change preferred
selections without separate explicit approval.

## Verification and evidence

Before product changes, capture synthetic baseline screenshots at 1440, 768, and
390 px widths. After implementation capture guided mapping, pending/uncertain and
resolved states, recipe preview, and receipt at the same widths. Verify keyboard
entry/order, labelled controls/errors, focus entry/return in reused dialogs,
screen-reader tab/panel relationships, no focus stealing on incoming proposals,
mobile page scrolling, and no horizontal clipping. Optional prompt previews stay
collapsed; complete copy/download and viewers remain accessible.

Add focused unit/integration/component/browser cases for contract parity;
positive/negative conversion; same-shot/head/project/component stale guards;
uncertainty acknowledgement invalidation; wrong-parent Outfit rejection; missing
mandatory sources versus optional pending frames; correct cue attribution;
legacy three-mode hashes; no manual-output fallback; source-only sentinel;
no-write preview; late transactional rollback; idempotent replay; explicit-only
preferred selection; source/reference/media preservation; local versus global
revision; permission redaction and newly created record denial; full/project
backup round-trips and malformed metadata rejection; localhost isolation; and
strict CLI response correlation.

Run the existing full root suite, bridge suite, typecheck, build, QA reconciliation,
CLI validator suite, production audits, and complete browser suites. Record exact
commands, exit codes, counts, skips, warnings, and retained failure artifacts.
Measure actual baseline/new output/media hashes rather than claiming blanket
identity or security from a source-name search. Native-only tests skipped on
hosted Linux are reported as skipped, never as passed there.

Preserve Windows PowerShell AllSigned. After every bridge rebuild compare the
compiled verification helper to the reviewed source, re-sign only the reviewed
compiled helper using the already approved local procedure, and verify
Authenticode `Valid`. Use a separately reviewed, ignored, signed QA-driver copy.
Do not export keys/certificates, lower execution policy, persist pairing secrets,
or commit profiles, secrets, actual library dumps, test ZIPs, or QA temporaries.
Do not delete disposable profiles or old QA files; list retained artifacts.

Provide the exact base and final signed commit, complete changed-file inventory,
schema/contract docs, machine-readable synthetic QA results, screenshots, CLI
version/call-ID audit, receipt and restored-record/media hashes, failure/rollback
evidence, and hosted CI run link for that exact signed commit. Keep the B3 PR
draft if required native acceptance cannot be completed; do not merge it.

Distinguish directly verified source facts, automated results, browser/native
behavior, security assumptions, and remaining risks. Deterministic model fixtures
prove integration mechanics, not creative quality or autonomous extraction
accuracy. Human mapping review remains required.

## Builder discretion and approval boundary

The builder may choose component/file splits, reuse of existing presentational
controls, precise route/query names, stable diagnostic codes, test fixture text,
and small CSS/layout details. Preserve this flow and all authority/compatibility
constraints. Material scope or contract changes return for review; minor choices
are recorded in the implementation notes.

This is the complete proposed design, not an implemented feature. After design
approval, write the implementation plan before code. Execute inline if authorized,
with one final branch review and a separate tested PR; no production conversion
or PR merge is authorized by approving this design.
