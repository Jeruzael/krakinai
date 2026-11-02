# Continuity workspace A — verification report

Date: 2026-11-03. Base: `8d2907fc3af51b51682bcb42b47d796b05dc24ed`. Branch: `codex/continuity-workspace-a`. Delivery requires the owner's signed commit and exact-head hosted CI; this report does not certify a merge or live bridge activation.

## Directly verified scope

- [CollectionWorkspace](../../src/screens/CollectionWorkspace.tsx) adds a dedicated Continuity tab and compact active heading. Storyboard links to it. Other Collection views retain their existing layout.
- [Presentation model](../../src/domain/continuityWorkspace.ts) derives actual ordered shots, exact selected saved takes, per-participant frozen wardrobe, unique legacy image availability and exact adjacent/detached transition pairs. It has no write calls or output assembly.
- [Workspace](../../src/components/ProjectContinuityPanel.tsx), [views](../../src/components/ContinuityViews.tsx) and [editor](../../src/components/ContinuityEditor.tsx) show focused content and an inspector. Complete frozen descriptions stay collapsed until opened. Desktop content/inspector scroll independently; mobile stacks content and reuses the shared focus-trapped dialog.
- Existing storage functions remain the only explicit metadata/media writers. First/Last fields are labelled **legacy shot-level images**, with no inferred take ownership, approval or frame-plan status. Detached transitions retain their original pair.
- [Route state](../../src/domain/collectionNavigation.ts) preserves the allowlisted subview and exact shot through saved-take return routes. Existing routes without Continuity state retain their prior serialization.
- Unsaved reviews remain in UI memory across hash-history unmounts; explicit discard clears them. The optional [dirty-form discard callback](../../src/context/LibraryContext.tsx) preserves old boolean-only callers. This is not persistent recovery.
- [Repository instructions](../../AGENTS.md), [authoring guide](../agent-authoring-guide.md) and shared [MCP descriptions](../../bridge/src/registerTools.ts) prefer Recipe / Build from Assets, preserving explicit Direct Prompt requests, existing permissions and v1–v4 validity. Source changes do not update an installed portable release.

No storage schema, persistence implementation, assembler, immutable scene format, backup/export format, limit or change-set schema was edited. The real localhost:5173 library, live bridge, global Codex configuration, signing/trust settings, PR #12 and unrelated work were not used or modified for QA.

## Automated results

Final command totals and exit codes are recorded in [machine-readable evidence](continuity-workspace-a-results.json). All required local checks below finished successfully. Signed delivery and hosted CI remain pending.

| Command | Actual result | Exit |
| --- | --- | --- |
| `npm test -- --maxWorkers=2 --minWorkers=1` | 1,134 passed, 130 files, post-review source | 0 |
| `npm run typecheck` | Passed | 0 |
| `npm run build` | Passed; production index chunk 1,075.24 kB minified, 276.61 kB gzip; chunk-size warning retained | 0 |
| `npm audit --omit=dev` | 0 vulnerabilities | 0 |
| `node build.mjs --outdir qa-results/continuity-a-production` from `bridge/` | Isolated production build passed; live `bridge/dist` preserved | 0 |
| Bridge test suite with `KRAKINAI_TEST_BRIDGE_DIST=qa-results/continuity-a-production`, one worker | 54 passed | 0 |
| `npm --prefix bridge run typecheck` | Passed | 0 |
| `npm --prefix bridge audit --omit=dev` | 0 vulnerabilities | 0 |
| `dotnet run --project launcher/tests/Krakinai.BridgeLauncher.Tests.csproj` | 38 passed | 0 |
| Nine committed `scripts/qa/*.test.mjs` helper suites (exact file list in evidence) | 81 passed | 0 |
| `node scripts/qa/reconcile-results.mjs --check` | Historical ledger valid: 207 checks, 45 screenshots; separate from this new suite | 0 |
| Affected Continuity/ensemble/storyboard-screenshot browser run | 23 passed, including all 9 new Continuity cases | 0 |
| Final `npm run test:e2e` | 189 passed, 11 explicitly skipped, 0 failed/flaky, 200 declared cases, approximately 11 minutes | 0 |

Root component tests emit React `act` warnings; the build emits the existing large-chunk warning. Playwright emits `NO_COLOR`/`FORCE_COLOR` environment warnings. No timeout was raised and no skip was added to hide a failure. Native/manual browser cases retain their explicit opt-in fixtures; their final count is reported separately from passes.

Initial failures are retained in the ignored task workspace rather than erased:

- Presentation/route tests failed before the model and Continuity route existed.
- Workspace tests and the first product-browser entry failed before the dedicated tab existed. One initial browser command also stopped because the agent's own baseline QA server still owned its port; that server was stopped before continuing.
- An unsaved-note unmount regression failed, then passed after in-memory draft recovery. A later component run exposed fixture contamination because a test intentionally left that recovered draft open; the test now explicitly discards after asserting retention.
- The first integrated browser run passed 4/6: return-route comparison used a noncanonical URL, and the remounted notes control used an unreliable label locator. The corrected checks compare the complete canonical route and use its accessible textbox role; all 6 then passed.
- A desktop focus regression failed before explicit field focus was added; it passed in the integrated 19-check run.
- Both actual compiled MCP registrations failed missing recipe-first descriptions, then passed after the shared description change.
- A component run caught missing ResizeObserver in jsdom; layout observation now degrades to viewport-resize handling when that API is absent.
- Initial typecheck/build caught an unsupported Testing Library `exact` option; its string-name assertion was corrected.
- The first unrestricted full unit run had 1,127 passes and 4 failures: one old tab-order expectation, two 5-second timeouts and an asynchronous AI Connections heading lookup. The tab-order assertion was updated for the new tab. The bounded full rerun passed 1,132 tests; the final post-review full run passed 1,134, without increasing timeouts or weakening assertions.
- The first full browser run exposed an existing ensemble test's removed-accordion selector. It was stopped after 116 cases so the final review corrections could be verified on a stable source tree. Its partial run is not counted as a full pass. Both that entry and the old storyboard screenshot entry were adapted to the new tab/inspector, retaining their saved-take, export, media and template assertions.

## Independent review and disposition

The independent read-only reviewer inspected the entire tracked diff, all new source/tests/docs, 19 actual screenshots and the surrounding storage/navigation/dialog/media code. No Critical issue was reported. Its Important finding was a real dirty-review loss path: browser Back could expose **Clear** in Frames while a wardrobe review remained dirty, and Clear bypassed the discard guard. A failing regression demonstrated a storage call before confirmation. Clear now uses the existing guard; component and actual browser-history regressions confirm that cancelling preserves the note and frame assignment.

Two reviewer items were regraded as Important for this delivery because the approved accessibility/evidence criteria require them: outer tab/panel linkage and meaningful screenshot coverage. The tab-link regression failed before stable IDs/ARIA associations were added. Captures now reset content/inspector scroll, wait for decoded images and use full-page capture at mobile/short widths. The 23 affected browser cases passed after the fix pass. There are no deferred review findings; no second reviewer was used.

Rulings made during execution:

- Retain QA artifacts/profiles rather than delete them, following the owner's preservation instruction. Cost: local disk usage.
- Group task checkpoints into one final owner-signed delivery rather than repeatedly request SSH passphrases. Cost: intermediate progress is recoverable from the ledger/working files until signing, rather than intermediate commits.
- Retain dirty reviews in UI memory across hash Back and add an optional explicit-discard callback. Reason: hash history bypasses the existing navigation prompt. Cost: no persistent crash/reload recovery is claimed.
- Review the frozen working tree and listed new files against the base before signing. Reason: the owner must unlock SSH signing locally. Cost: final staging must exactly match the reviewed/fixed, verified files.
- Regrade the tab linkage and screenshot issues for the approved accessibility/evidence requirements, and fix them with the Clear defect in one pass. No unrelated feature work was added.
- Treat pending suites/signing/CI, physical screen-reader use, other engines, native pairing and external generation as independently unverified until their own evidence exists. The source review cannot certify those outcomes.

## Browser-tested behavior

[Focused browser tests](../../e2e/continuity-workspace.spec.mjs) use fresh synthetic libraries and actual IndexedDB operations. Read-only navigation compares full stored scene records/outputs, project records and SHA-256 media proofs before/after. The explicit wardrobe save asserts only the intended shot note and normal project revision change; other shots, takes, scenes and media remain equal.

Checks cover all five subviews, outside-filter selection, exact saved-take return, reload/history, cancelled discard, explicit global discard, editor focus, one active original-image dialog, focus return, responsive layouts and scoped nested-tab keys. Existing [storyboard regressions](../../e2e/storyboard-cleanup.spec.mjs) retain their exact persistence, media, field-stack, footer, playback and Preflight assertions through the new entry points. Failed-save and stale-view revision retention are also tested at the component/repository boundary.

Synthetic before screenshots were captured from the integrated base before implementation. Product after screenshots cover Overview, Wardrobe, legacy Frames and Transitions at 1440×900, 768×1024, 390×844 and 720×450 CSS pixels. The machine-readable evidence inventories each real file, dimensions, byte size and SHA-256. The earlier interactive design mockups are separate and are not product test evidence.

| Width | Before | After |
| --- | --- | --- |
| 1440 | [Original long Continuity section](../screenshots/continuity-workspace-a/before/continuity-1440.png) | [Overview](../screenshots/continuity-workspace-a/after/overview-1440.png), [Wardrobe](../screenshots/continuity-workspace-a/after/wardrobe-1440.png), [Frames](../screenshots/continuity-workspace-a/after/frames-1440.png), [Transitions](../screenshots/continuity-workspace-a/after/transitions-1440.png) |
| 768 | [Before](../screenshots/continuity-workspace-a/before/continuity-768.png) | [Overview](../screenshots/continuity-workspace-a/after/overview-768.png), [Wardrobe](../screenshots/continuity-workspace-a/after/wardrobe-768.png), [Frames](../screenshots/continuity-workspace-a/after/frames-768.png), [Transitions](../screenshots/continuity-workspace-a/after/transitions-768.png) |
| 390 | [Before](../screenshots/continuity-workspace-a/before/continuity-390.png) | [Overview](../screenshots/continuity-workspace-a/after/overview-390.png), [Wardrobe](../screenshots/continuity-workspace-a/after/wardrobe-390.png), [Frames](../screenshots/continuity-workspace-a/after/frames-390.png), [Transitions](../screenshots/continuity-workspace-a/after/transitions-390.png) |
| 720 reflow | — | [Overview](../screenshots/continuity-workspace-a/after/overview-720.png), [Wardrobe](../screenshots/continuity-workspace-a/after/wardrobe-720.png), [Frames](../screenshots/continuity-workspace-a/after/frames-720.png), [Transitions](../screenshots/continuity-workspace-a/after/transitions-720.png) |

## Security assumptions and limits of evidence

This is a UI and descriptive-guidance change, not an independent security certification. MCP retains its existing authenticated transport, separate scope/text permissions, browser-owned review and Stage B atomic writer. Tests exercise those existing boundaries; descriptive instructions cannot grant additional authority. The two actual SDK process tests negotiate with compiled production entry points and inspect returned tool metadata. They do not stand in for a new signed-native human-pairing acceptance test.

QA uses synthetic data and pinned Chromium. A stored image's MIME/record availability is not proof that its pixels decode or that a person approved it. Identity locking and snapshot comparison do not guarantee an external generator's visual continuity.

## Remaining risks and later gates

- B/C remain unimplemented: no structured blocking, arbitrary keyframes, canonical image-frame output, new proposal contract or Flow automation is included. Their reviewed data/permission contracts and actual-MCP acceptance remain required.
- UI draft recovery survives in-app history only. Reload/exit warns while mounted; forced termination can lose unsaved UI text. It never writes private drafts to browser persistence.
- The editor's source-revision check uses the current loaded Collection. Existing storage API concurrency behavior is unchanged; A does not claim a new atomic stale-write guarantee for every metadata operation.
- Very large matrices scroll horizontally within their content region. Physical assistive-technology testing and browsers other than the configured Chromium are not certified here.
- Existing production bundle chunk-size and React test warnings must be reported with final evidence. No dependency upgrade or unrelated warning cleanup is included.
- No signing key/certificate, profile, synthetic ZIP, imported media fixture, credential or temporary QA log is intended for Git. Only intentional synthetic PNG screenshots accompany source/tests/docs.

The staged deliverable contains 49 files: 30 source/test/documentation/evidence files and 19 intentional synthetic PNG screenshots. The [machine-readable inventory](continuity-workspace-a-results.json) lists every path. Temporary logs, retained profiles, compiled bridge test builds and other QA fixtures remain ignored. Both staged and unstaged diff checks are clean. Hosted CI has not run for this change; it requires the owner's signed commit and push. The PR must remain unmerged.
