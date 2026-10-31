# B1 recipe change-set QA

Scope: the approved single-character B1 design. Real browser libraries, production projects, ZIP64 PR #12, unrelated local work, database schema, limits and immutable existing outputs are excluded from writes. No automatic merge. B2/B3 remain gated.

## Directly verified source facts

- [Recipe construction](../src/domain/changeSetRecipe.ts) resolves actual asset/variant records and freezes unchanged parent snapshots. [Planning](../src/domain/changeSetPlanner.ts) calls existing `planAuthoredScene`; `promptAssembler.ts`, `shotTypeRules.ts`, `identityAnchors.ts` and `validation.ts` are unchanged.
- [Atomic save](../src/storage/changeSets.ts) revalidates current records, permissions and deterministic reviewed content inside the existing transaction. Recipe rows, targets and rendered metadata are included in the v2 content proof; the v1 proof remains unchanged.
- Published v1 schema bytes remain unchanged (SHA-256 `1daa940b3c00dc8df420aa18435911b2a1776b64d0a193ed2215d8cbed7a046a`). Runtime, exported v2 and MCP schemas share definitions; semantic validation still applies.
- [Review UI](../src/components/RecipeOperationPreview.tsx) displays actual IDs/revisions and complete canonical outputs behind tabs. Missing required inputs block Apply; the complete input package remains downloadable without partial writes or persistent draft claims.
- No dependency or lockfile change, new cloud service, new persistent store, storage-limit change, backup rewrite or global signing/configuration change.

## Automated results

Final command results, durations, exits, source hashes and warnings are recorded in [machine-readable evidence](qa/recipe-change-set-b1-results.json). Local tests ran against the uncommitted implementation subsequently submitted for signing; the PR/Actions run identifies the exact signed head. The evidence does not mislabel base master as the tested feature commit.

| Check | Actual result | Final exit |
| --- | --- | --- |
| Unit/component suite | 816/816, 106 files | 0 |
| Typecheck and production build | Passed | 0 each |
| Root production audit | 0 vulnerabilities | 0 |
| Bridge production/test builds and typecheck | Passed | 0 each |
| Bridge tests and production audit | 18/18; 0 vulnerabilities | 0 each |
| QA ledger tests/reconciliation | 8/8; historical 207 checks, 45 screenshots | 0 |
| Installed-CLI evidence validators | 23/23 | 0 |
| Published schema parity | Both versions match; v1 bytes unchanged | 0 |
| Full Windows browser suite, native enabled | 165/165; no failures/skips/retries, 9.8 minutes | 0 |
| Focused B1 browser/MCP gate | 12/12 including both signed native origins | 0 |
| Whitespace diff check | Clean | 0 |

Build warnings: main bundle 978.45 kB (gzip 250.28 kB) exceeds Vite's 500 kB advisory; mixed static/dynamic imports of `sceneAuthoring.ts` prevent it moving to a separate chunk. Existing React `act` warnings occur in media tests; browser logs include `NO_COLOR`/`FORCE_COLOR`. These are retained, not suppressed. Both production audits remain clean; dependencies/lockfiles are unchanged.

Focused tests cover strict v1/v2 parsing, field bounds, candidate dependencies, category/revision/variant ownership, frozen Camera-only edits, authoritative Full/Structured/Compact outputs, anchor freshness, current originals, manual-output consent, optional pending inputs, replay, late-write/quota/abort rollback, tampered preview and mixed/legacy backup restoration.

One fresh independent whole-diff review found one P2 defect and no critical/minor findings: replacing prior B1 extras after a user reordered the parent's Reference Pack could duplicate order values and block a valid revision. The new planner regression reproduced the exact error before the fix. Retained entries now keep their logical attachment order with sequential positions on the new draft only; the immutable parent stays unchanged. Replacement/clear and storage checks passed 44/44, followed by the full post-fix regression gate. No historical assertions were weakened and no re-review was substituted for tests.

The mixed backup fixture contains a legacy-shaped frozen recipe, a v1 Direct Prompt and a v2 recipe/receipt. An independent ZIP32 writer rebuilds the legacy container. Original media SHA-256, reference associations, old outputs and preferred takes are compared after restore. These are small functional fixtures, not large-library ZIP64 capacity certification.

The existing [frozen output matrix](../e2e/fixtures/direct-prompt-baseline.json) contains 22 SHA-256 values across draft/saved text and specifications. Its unchanged values and the actual browser comparison result are included in machine-readable evidence. Recipe acceptance additionally records hashes of actual saved Full/Structured/Compact strings and original media, rather than inferring preservation from successful navigation.

## Browser-tested behavior

Fresh retained synthetic Chromium profiles are used exclusively. Tests refuse a nonempty initial synthetic library. Browser assertions read actual saved records and hashes, observe zero IndexedDB writes before approval and use the actual review controls.

- Existing-asset recipe creation, same-batch create/reuse/defer, proposal-local reuse grants, missing-dependency blocking and unchanged ongoing AI scopes.
- Immutable Camera-only revision and alternate take after a global Environment edit; old scene, frozen unrelated slots, global assets, draft, preferred take and media hashes remain intact.
- Required original deleted after preview: Apply blocks and preserves the draft/library. A valid explicit replacement succeeds. Caller MIME mismatch also blocks against the actual stored record.
- Exact Clipboard API string, complete native clipboard readback, keyboard tab navigation, focus restoration, collapsed prompt details and no horizontal page overflow at 1440, 768 and 390 pixels. Windows native clipboard translates LF to CRLF; only that platform translation is normalized in readback assertions. Stored outputs and API copy arguments remain exact.
- Real MCP SDK v2 preview/submit, browser approval, actual receipt IDs, replay and disconnect/revocation. Both production/native `127.0.0.1` and `localhost` application origins are tested in disposable profiles; the other origin remains an empty separate library.

Native checks use the production stdio launcher and signed Windows WPF verification helper under Windows PowerShell AllSigned. Compiled helper signatures are checked as Valid after rebuilding/re-signing; no key or certificate is committed. All seven native-gated cases passed in the final 165-case aggregate. The installed Codex CLI 0.73.0 runs the existing full v1 scene-revision acceptance workflow against the isolated loopback model fixture at both origins. Every response is matched to its actual tool-call ID. This does not claim the new v2 recipe ensemble was exercised by the installed CLI; v2 end-to-end evidence is the actual SDK workflow. Full v2 installed-CLI ensemble remains B3.

An initial native regression run passed seven of nine cases; both existing full CLI workflows stopped after five of nine calls because the test tried Disconnect while the Connection tab was hidden after the earlier UI redesign. One test navigation line was corrected. The subsequent two full CLI workflows passed all nine correlated calls each. No earlier failed call is relabeled successful. Final aggregate results are recorded separately.

Synthetic screenshots: [desktop preview](qa/recipe-change-set-b1/preview-1440.png), [tablet preview](qa/recipe-change-set-b1/preview-768.png), [mobile preview](qa/recipe-change-set-b1/preview-390.png), [desktop output](qa/recipe-change-set-b1/output-1440.png), [tablet output](qa/recipe-change-set-b1/output-768.png), [mobile output](qa/recipe-change-set-b1/output-390.png).

## Security assumptions and limits

The transaction/rollback claims rely on browser IndexedDB guarantees and the existing browser authorization boundary. Tests inject abort/quota failures and scope revocation; they do not certify every hardware failure or constitute an independent security audit. Production dependency audit results describe known advisory findings, not overall security. No area is labeled safe on the basis of function-name searches.

Native acceptance is Windows-specific. Linux CI exercises the synthetic stdio/browser verifier and skips the explicitly gated Windows native cases; local signed native results are reported separately. Firefox, WebKit and the user's actual Chrome profile are not tested. The real library is deliberately untouched.

Incomplete recipes are packages, not saved immutable scenes or persistent drafts. Existing Shot Type restrictions can block unbound generic extra guides. Older KRAKINAI versions are not promised to restore new v2 receipts. Multi-character participants, new variant proposals, multiple dialogue cues and Direct Prompt conversion are outside B1. Existing large-library backup certification limits remain unchanged.
