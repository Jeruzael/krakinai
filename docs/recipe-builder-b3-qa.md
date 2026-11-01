# B3 verification report

Verification snapshot: 2026-11-01, Windows, base
`96e819ae23adc2bf897c7e3ccc71e16176e28b42`. Runtime implementation through signed
commit `0a35dc707ccd9fd20e32d477fb4ab3d774f271ad`.

**In progress:** the complete browser suite and final independent branch review
are running/pending. Hosted CI has not yet run. This snapshot is not a completion
claim; the final delivery must include the PR's exact signed HEAD and green CI link.

## Directly inspected facts

- New workflow: `/#/recipes/ai`, implemented by
  [`AiRecipeBuilderScreen.tsx`](../src/screens/AiRecipeBuilderScreen.tsx),
  [`RecipeMappingEditor.tsx`](../src/components/RecipeMappingEditor.tsx) and
  [`recipeConversionRequest.ts`](../src/domain/recipeConversionRequest.ts).
  Mapping is transient; it does not mount the autosaving Scene Builder.
- V4 conversion and bounded provenance are defined in
  [`recipeConversionSchema.ts`](../src/domain/recipeConversionSchema.ts),
  [`recipeConversion.ts`](../src/types/recipeConversion.ts) and the published
  [v4 schema](change-set-v4.schema.json). V1–v3 remain separate contracts.
- [`recipeConversion.ts`](../src/domain/recipeConversion.ts) verifies source
  identity/hash/membership and prepares the new recipe. Its captured reference
  handling retains inactive and original-source associations. The old Direct
  prose does not become an implicit new instruction or manual output.
- [`changeSets.ts`](../src/storage/changeSets.ts) prepares source hashes before
  the existing atomic writer and rechecks stored state at commit.
  [`db.ts`](../src/storage/db.ts) retains database version 1 and eight stores.
  There is no database migration, cleanup-rule or storage-limit change.
- [`RecipeConversionReview.tsx`](../src/components/RecipeConversionReview.tsx)
  supplies complete modes and explicit mapping acknowledgements. The existing
  [`McpProposalReview.tsx`](../src/components/McpProposalReview.tsx) and
  [`proposalBroker.ts`](../src/connections/proposalBroker.ts) remain the browser
  approval boundary. No automatic approval/direct database-write tool was added.
- [`RecipeRevisionChoices.tsx`](../src/components/RecipeRevisionChoices.tsx)
  separates scene revisions from master-library editing. Returning to AI
  Connections now displays the actual active transport address, not default 4177.
- `src/domain/validation.ts` and `src/domain/promptAssembler.ts` are unchanged
  from the base. The separate local validation work was not edited. Project
  Export's128 MiB limit, full-library limits and PR #12 were not changed.

## Automated command evidence

| Command | Result | Exit |
| --- | --- | --- |
| `npm test` (default plus JSON reporter) |1105/1105; 128 files|0|
| `npm run typecheck` |Passed|0|
| `npm run build` |Passed; bundle-size warning below|0|
| `npm audit --omit=dev` |0 vulnerabilities|0|
| `npm run test:qa` |8 tests; existing historical ledger 207 checks/45 screenshots|0|
| Three installed-CLI validator files with `node --test` |42/42|0|
| `npm --prefix bridge run build` |Passed; compiled native helper re-signed afterward|0|
| `npm --prefix bridge run build:test` |Passed|0|
| `npm --prefix bridge run typecheck` |Passed|0|
| `npm --prefix bridge test` |18/18; 3 files on corrected rerun|0|
| `npm --prefix bridge audit --omit=dev` |0 vulnerabilities|0|
| Focused actual installed-CLI browser acceptance |2/2;41 actual calls per origin|0|
| Complete browser suite |189 declared; final result pending|Pending|

The 207-check ledger is historical QA evidence, not the number of B3 browser
tests. CLI calls are not counted as additional Playwright cases. No failed,
skipped or unverified case is promoted into a passing count.

The first bridge run failed 16/18: its stdio assertion still listed only v1–v3;
the test now verifies v4 and that conversion appears only there. An oversized
HTTP test also saw `ECONNRESET`; it passed in isolation and in the full rerun
without a production relay change. Retained initial logs remain part of the
record; a clean rerun is not proof that the network flake cannot recur.

Root tests emitted 43 React `act` warnings. Vite reported a 1,066.86 kB main chunk
(273.94 kB gzip), exceeding its 500 kB advisory. Browser execution emits the
`NO_COLOR`/`FORCE_COLOR` warning. The two completed installed-CLI records reported
no deprecation warning. Warnings were not suppressed.

## Browser and installed-CLI evidence

The committed [127-origin evidence](qa/recipe-builder-b3/native-127.json) and
[localhost evidence](qa/recipe-builder-b3/native-localhost.json) contain actual
synthetic saved IDs, old output/media hashes, complete-preview hashes and 41
ordered call IDs with actual argument and reply SHA-256 values each. See
[`recipe-conversion-native.spec.mjs`](../e2e/recipe-conversion-native.spec.mjs),
[`mcp-recipe-workflow.mjs`](../scripts/qa/mcp-recipe-workflow.mjs) and
[`mcp-codex-cli.mjs`](../scripts/qa/mcp-codex-cli.mjs).

Each test used installed `codex-cli 0.73.0`, its measured executable hash, the
production SDK stdio launcher, the signed Windows verification window, actual
browser review controls, and Stage B's atomic save. A fresh owned Chromium
profile was used for each exact application origin (`127.0.0.1:4173` and
`localhost:4173`). The deterministic loopback model fixture used no external
AI credentials. This certifies integration mechanics, not model creativity or
the quality of automatic prompt extraction.

Per profile:

- Ten-shot 70-second 9:16 project, three fictional Characters, three existing
  parent-owned Outfits, shared components and six pending starting frames.
  Five PNGs were independently decoded: two tiny fixtures and three synthetic
  canvas illustrations; no photographs or opaque-byte media were substituted.
- 28 complete-store/media checks before application. Incoming mapping was edited
  as a new package and the original proposal was rejected. The new batch created
  ten genuine recipe roots, one camera and one Outfit. Drafts stayed unchanged.
- Actual stored counts 10→21 scenes, 10→11 assets, 3→4 variants after the separate
  recipe revision. The old ten scenes and their output hashes stayed unchanged.
  Thirty complete mode hashes matched the browser-approved saved outputs.
- Ensembles, participant-owned wardrobe, exact whitespace/CRLF/emoji dialogue,
  an external officiant and six unresolved frames were preserved. Scene-only
  camera revision retained the other six snapshots, ensemble and settings.
  Editing the reusable camera left all saved scenes unchanged.
- Newly created asset/full-prompt access was denied before explicit additional
  browser grants. Preferred selection changed only in a third, separately
  approved batch. Exact retry did not duplicate records.
- Disconnect confirmation completed an actual successful revoke request.
  Subsequent status/read/preview/submit calls confirmed revocation. The other
  application origin had an empty separate library; reopening the same owned
  profile retained exact records and all five media hashes.

The strict harness rejected incomplete/truncated replies and earlier development
mistakes rather than accepting later success messages. Those attempts exposed
candidate-versus-created IDs, closed/duplicated controls and missed confirmation
steps in the harness. They also reproduced the active-relay display defect,
which received a failing then passing paired-context navigation regression.
All development failure logs/profiles are retained locally.

[`recipe-conversion.spec.mjs`](../e2e/recipe-conversion.spec.mjs) covers guided
mapping, data-only source text, exact copies of all three modes, missing original
replacement, actual write-fault rollback/retry, replay, keyboard/focus/reflow,
master-edit isolation and separate preferred selection. Native full-workflow
assertions are kept separate from ordinary browser checks and unit mocks.

## Screenshots and preservation

Nine committed screenshots exist at 1440, 768 and 390px widths, with byte counts,
dimensions and verified SHA-256 in
[`screenshots.json`](qa/recipe-builder-b3/screenshots.json). Baseline images came
from an isolated export of unchanged base 96e819a using matching valid synthetic
fixtures. Mapping and review images were visually inspected at desktop/mobile
sizes. Full-page mapping still scrolls; no claim is made that all controls fit
above the fold. Long prompt bodies remain collapsed and actions stay accessible.

No tool targeted the real browser library at `localhost:5173` or production
bridge 4177. Real Wedding work remains an ignored, historical/unverified local
conversion plan only; current production IDs/revisions were not read. There is
no production before/after hash claim because the actual library was not opened.
PR #12 and unrelated local worktrees were not operated on.

Windows PowerShell 5.1 retained effective `AllSigned`; compiled helper and reviewed
QA-driver signatures were `Valid` after the bridge rebuild. The separate existing
PowerShell 7 tool host remains `RemoteSigned`; no execution policy or trust store
was changed. No signing key or certificate was exported.

## Assumptions, limitations and retained artifacts

- Local OS, browser profile, installed binaries and the user's approved signing
  trust remain trusted. These tests are not an exhaustive security audit and do
  not defend against a compromised browser extension or operating system.
- CLI 0.73 can clip large tool responses. Certification used the child-only
  documented 100000-token budget and rejects clipping; normal client defaults
  were not modified. See the [contract](recipe-builder-b3-contract.md).
- Actual native acceptance is Windows Chromium only. Firefox, Safari, other OS
  native helpers and human screen-reader use are not certified here. Automated
  accessible names, keyboard/focus and 390/768/1440px layouts are tested.
- Transient edits require download to survive a crash. New recipes are newly
  assembled text; equality with original Direct prose is not claimed.
- Large ZIP64 recovery and video codec coverage are outside B3 and unchanged.
- Retained, ignored paths: `qa-results/recipe-builder-b3/` (logs, baseline export,
  reviewed signed QA copy, local Wedding plan), `qa-results/local-mcp/` (owned
  profiles and isolated CLI homes), `qa-results/playwright-runs/`, and the B3
  `.superpowers/sdd/` ledger. No profile, test ZIP, key, certificate, credential
  or raw run dump is intended for Git. No deletion/cleanup was performed.

Final machine results and complete file inventory will be linked here after the
full suite and review finish. Hosted CI must be checked on the PR's final signed
HEAD; Linux CI skips Windows-only native acceptance and cannot replace it.
