# Phase 4 Stage B verification

Verified 2026-10-26 in the managed `phase4-scene-workflows` worktree. Stage A is PR #4 (`910f1a5e645fcf88502d61d1816efdc0109e532d`), stacked on open PR #3. Stage B targets Stage A; neither is merged automatically.

## Directly verified facts

- IndexedDB version 1/eight stores and backup schema version 1 are unchanged. Optional identity/generation/reference-pack fields are added without migration or bulk backfill.
- Canonical assembler formatting and Project JSON are preserved. `promptAssembler.ts` changes only capture optional character identity metadata in new snapshots.
- Saved scenes freeze generation identity and explicit pack selection. Draft exports resolve against selected master snapshots with current approval checks. Reference selection does not delete media or alter source associations.
- Original working checkout and its running localhost:5173 were not used for QA. Its separate uncommitted `src/domain/validation.ts` capacity-limit changes remain untouched and excluded from these PRs.
- All QA data are synthetic, in disposable Chromium contexts. Logs, screenshots, profiles and ZIPs are outside Git. Only reviewed source/tests/docs are staged.

## Final automated command results

| Command | Exit | Result / warnings |
| --- | --- | --- |
| `npm ci` | 0 | 189 installed, 190 audited; deprecated whatwg-encoding; 6 existing development advisories (3 moderate, 1 high, 2 critical). No forced upgrades. |
| `npm test` | 0 | 126 tests / 22 files passed; final run has no warnings. Earlier intermediate runs had asynchronous React act warnings and failures corrected before the final run. |
| `npm run typecheck` | 0 | No diagnostics. |
| `npm run build` | 0 | 1,620 modules; JS 434.93 kB / 124.89 kB gzip; no warnings. |
| `npm audit --omit=dev` | 0 | 0 production vulnerabilities reported. |
| `git status --short` | 0 | Full pending source/test/doc list preserved in evidence; clean after commit. |
| `git diff --name-status` | 0 | Tracked change list preserved; newly created files are additionally listed by status/staging. |
| `git diff --check` | 0 | No whitespace errors after normalization. |

Regression evidence includes anchor draft/explicit approval, concurrency guards, stale master fallback, immutable chosen snapshots, exact Unicode/dialogue, legacy JSON/text, conservative negative deduplication, stable role/view associations, pack ZIP binary hashes, invalid restore metadata, legacy version-1 compatibility and synchronous/asynchronous rollback.

The rollback test discovered an actual defect: synchronous `DataCloneError` after queued clears could leave partial replacement committed. Replacement now attaches completion handlers first, explicitly aborts on enqueue failure and awaits transaction termination. Both synchronous and real asynchronous request-failure regressions pass. Review also caught a transient text-encoding change; canonical TXT punctuation was restored and its existing exact-byte test passes.

Independent Stage B source review ran 35 focused tests and found no outstanding actionable issue after the encoding correction. This is scoped code review, not a comprehensive security audit.

## Browser-tested behavior

Final isolated Chromium run: **51 assertions passed**, no uncaught page errors. The complete synthetic Mika flow covers draft/approval, snapshot refresh, explicit identity choice, rear-camera preflight and scene-only correction, exact Taglish dialogue, master/anchor comparison, Project/Generation JSON, Omni formatting, result-video upload, grouped reference selection, explicit suggestion/apply, preview, checklist order, ZIP selection/hash validation, reload, save/reopen, read-only historical packs, post-save source edits, stale copied drafts, full backup restore in a separate context and legacy backup restore. Missing selected media stays visible and blocks incomplete ZIP creation. Existing synthetic media hashes remain unchanged.

All three widths (1440×900, 768×1024, 390×844) pass page-overflow, complete Assemble-button bounds, dialog keyboard focus/trap and Escape restoration checks. At 1440×900 all seven compact rows and Assemble are visible. A targeted browser regression caught clipped mobile/tablet actions; responsive wrapping fixes it. Screenshots were visually inspected.

Evidence: 9 before + 6 Stage A + 12 final PNG screenshots, full raw logs, browser scripts/results, code diff, file lists and `qa_results.json` live outside Git in the task's `phase4` visualization directory. Screenshot existence, nonzero size and hashes are recorded there. Native clipboard writes call the real browser clipboard; exact write arguments and UTF-8 download bytes are compared. Windows clipboard readback in Stage A is checked with CRLF normalization explicitly disclosed.

## Security assumptions and remaining risks

- Production dependency audit is scoped to resolved production packages; it does not prove application security. No area is labeled SAFE from keyword searches.
- Preflight is incomplete deterministic pattern matching. Intentional creative choices may trigger findings; no finding does not guarantee consistency.
- Anchor approval is local user metadata, not identity authentication or a guarantee of external visual fidelity.
- Provider guidance was verified 2026-10-26 from official sources. No external generation, speech quality, provider-native request validation or paid service was tested; unknown general limits remain unknown.
- Chromium and touch emulation were tested; other engines, physical devices and spoken screen-reader output were not. Semantic labels, keyboard navigation and focus were tested.
- Full backup replacement remains explicit and transactional. Browser data remains profile/origin-specific; this work does not add sync.
- The existing GitHub workflow triggers only for master pushes/PRs. These stacked PR bases do not trigger it; local clean-install gates are recorded, and CI should run when the stack is retargeted after parent merges.
