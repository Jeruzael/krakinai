# ZIP64 recovery certification — 2026-10-27

**Decision: near-limit full-library recovery is NOT certified. PR #12 must remain draft and unmerged.** The only fixed volume is C: (NTFS); the user confirmed no alternate volume is available. No 2,000 / 4,000 / 5,000 MiB dataset was generated and the production restore gate was not bypassed or raised.

The enforced gate remains **1,073,748,246 expanded bytes**, from the earlier **1 GiB opaque-media fixture**. That earlier capacity result does not demonstrate a representative near-limit library. This round demonstrates a complete representative synthetic graph at **2,900,631 expanded bytes**, with successful replacement, restart, exact metadata and media hashes. Neither result certifies a 5,000 MiB library.

[Machine-readable measurements, source hashes and raw-proof provenance](zip64-recovery-certification.json) accompany this report. The [previous report](zip64-results.md) describes the earlier generic ZIP64 boundary and opaque-media tests; those are historical evidence, not new large-library certification.

## Directly verified facts and preserved safeguards

- Limits are unchanged: media **5,000 MiB**, expanded and compressed ZIP **5,500 MiB each**, **2,000 entries**, manifest **20 MiB**, image/poster **10 MiB**, video **50 MiB**. Project Export remains **128 MiB**.
- `src/domain/validation.ts`, `src/domain/projectExport.ts`, and `src/storage/backupLimits.ts` are unchanged. Their SHA-256 values are in the accompanying JSON. The separate user checkout was clean when checked; this work stayed on `codex/full-library-zip64`.
- No changes were made to the ZIP64 parser, CRC/SHA validation, decompression checks, OPFS staging, main database schema, generation fence, atomic replacement, assembler, saved snapshots, existing reference packs or persistence rules in this certification update. Relevant source hashes were captured and compared after the final manual run.
- The production change is confined to `src/components/FullLibraryBackupPanel.tsx`: it says **Current enforced restore ceiling**, explicitly warns that near-limit recovery is uncertified, describes the opaque-media qualification, and displays the browser quota estimate separately from destination disk capacity.
- Tests used new persistent Windows Chromium profiles under named QA directories, synthetic data and separate loopback origins on ports 4198/4199. The normal application profile and its `localhost:5173` library were not opened or modified. The one operator-selected Documents ZIP was read without modification and matched the known synthetic fixture.

## Capacity preflight: estimated requirements, not archive measurements

Initial free NTFS space was **18,087,051,264 bytes (16.84 GiB)**. At the final repeat it was **18,923,229,184 bytes (17.62 GiB)**; unrelated machine activity can change free space. Both are below the requested practical floor of **35 GiB = 37,580,963,840 bytes**. The volume's capacity is 499,041,431,552 bytes.

Planning calculation for each case:

```
expanded allowance = target media + 20 MiB manifest
archive allowance  = expanded allowance + 1 MiB ZIP overhead
free disk required = archive + staging + new IndexedDB copy
                   + 128 MiB previous fixture + 1 GiB native/metadata allowance
                   + 8 GiB retained reserve
practical minimum = max(calculated free disk requirement, 35 GiB)
additional browser quota allowance = 2 * expanded + 1 GiB
```

These are conservative planning allowances for a small previous library, not a guarantee or a worst-case requirement for replacing any existing 5 GiB library. A large existing library, native temporary copies or WAL growth can require more space.

| Media target | Expanded allowance (bytes) | Archive allowance (bytes) | Calculated free disk (bytes) | Additional browser quota allowance (bytes) | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| 2,000 MiB | 2,118,123,520 | 2,119,172,096 | 16,153,313,280 | 5,309,988,864 | **Blocked, not run:** fails practical 35 GiB floor |
| 4,000 MiB | 4,215,275,520 | 4,216,324,096 | 22,444,769,280 | 9,504,292,864 | **Blocked, not run:** fails calculated disk requirement and practical floor |
| 5,000 MiB | 5,263,851,520 | 5,264,900,096 | 25,590,497,280 | 11,601,444,864 | **Blocked, not run:** fails disk requirements and conservative browser estimate |

The 2,000 MiB calculated byte budget fits the measured free space; that does **not** mean it met the requested practical headroom. The unchanged production gate would also reject these cases. No claim is made that a large restore ran or failed during replacement.

The fresh browser reported `navigator.storage.estimate()` quota **10,737,446,617**, usage **28,377** (remaining **10,737,418,240 bytes**, 10 GiB). Native CDP reported a different origin policy quota, **299,424,858,930 bytes**. These APIs report estimates/policy ceilings, **not free NTFS space**. The conservative browser estimate fails the near-5,000 MiB allowance; it is not proof of a hard 10 GiB allocation ceiling.

## Browser-tested representative recovery

Canonical final run: **case-rich-06**, Windows, bundled **Chromium 156.0.8078.4**, production build plus an isolated QA API bundle. **12/12 checks passed; zero page-error events observed; 23,370 ms total.** Its generated records include:

- 21 assets, 6 variants, 29 media files, 3 drafts, 3 immutable saved scenes, 4 collections and 4 templates.
- 27 bundled SVG illustrations, one decodable 1024 × 768 deterministic-noise PNG, and one playable canvas-generated VP8 WebM. All are synthetic; the recorder used neither microphone nor screen capture. These are not opaque byte payloads.
- A shared character/outfit reference, scene result media, review status/notes, scene instructions, dialogue, ordered collection shots and variant membership.

Streaming export wrote a real OPFS `FileSystemWritableFileStream`. Independent **Python 3.11.9** read every member, checked CRC and compared all media SHA-256 values. UI revalidation and explicit **Confirm & Replace Current Library** preceded replacement. After a full owned-browser restart, all counts, JSON-representable metadata, every scene output string, slot/reference associations and **all 29 original/restored media hashes** matched. All 28 images decoded and the WebM advanced during playback.

| Measurement | Actual result |
| --- | ---: |
| Original media bytes | 2,756,457 |
| Compressed ZIP bytes | 2,778,120 |
| Expanded ZIP bytes | 2,900,631 |
| ZIP entries, including manifest | 30 |
| Observed browser working-set sum peak | 754,614,272 bytes |
| Free disk before / minimum sampled / after | 18,923,229,184 / 18,895,532,032 / 18,897,285,120 bytes |
| OPFS logical file sizes at end | 9,336,336 bytes across 64 files |
| Browser estimated usage after | 13,803,166 bytes (OPFS 9,351,098; IndexedDB 4,452,068) |
| Legacy v1 archive, optional media hashes omitted | 2,876,239 bytes |

ZIP SHA-256: `7023542fb64fc4d0a89eadaf1fe1a515261b139c893c7c9f003919605b488220`.

Whole JSON metadata SHA-256: `7eb9a009109fab9df92e50aea8699ace03d306bdc9b949d511cd28c8a8906d19`.

Every media and ZIP member hash is included in the accompanying JSON. Runtime-generated IDs/timestamps and WebM container bytes can vary in a new run; equality is required within each source/restore pair, not against another run's archive hash.

Memory was sampled about once a second by summing `WorkingSet64` for the browser's own processes. Shared pages may be counted more than once; short peaks can be missed. This is neither private committed memory nor a universal memory bound. OPFS logical sizes, browser estimates and changes in global free disk are different measurements. The intentional crash gap is not a zero-memory sample. No smooth-UI or near-limit stability claim follows from this small run.

## Failure and recovery evidence

All checks below compared the complete previous graph plus every media hash. The sentinel made the previous library distinct from the incoming backup.

| Test | Observed result | Approximate interval in final run |
| --- | --- | ---: |
| Native origin quota restriction | CDP reduced quota from its native policy value to **6,312,786 bytes**, above usage 5,788,498. Browser threw actual `QuotaExceededError` during staging; old library exact. Override reset and verified inactive. | 467 ms |
| Cancel during decompression | Abort after >512 KiB extracted; old library exact. | 369 ms |
| Corrupted PNG payload | Byte changed using Python's entry offset; rejected with **Invalid CRC32**; old library exact. | 389 ms |
| Crash during staging | Entire owned browser killed at extraction checkpoint; restart retained old library and an incomplete recoverable stage. | 861 ms |
| Crash during replacement | Entire owned browser killed after first live put; restart recovered previous library across the existing eight-store transaction. | 1,550 ms |
| Revalidate, confirm, replace and restart | Ready stage revalidated; old graph present before confirmation; all metadata/counts/hashes exact afterward. | 2,719 ms |
| Stale tab write | Older initialized tab rejected its save after replacement until reload. | Included above |
| Backward compatibility | Legacy version-1 ZIP without optional SHA fields restored the rich graph exactly after restart. | 1,846 ms |
| Interrupted destination writing | Aborted export to real OPFS writable preserved the prior destination sentinel and live library. | 209 ms |

Intervals include surrounding harness assertions and may share work; they are not isolated performance benchmarks. Fixture/decode setup took 2,611 ms, OPFS export/readback 11,925 ms, independent Python readback 292 ms. The export interval includes stream setup and bounded small-fixture readback.

The quota restriction uses the [Chrome DevTools Storage protocol](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Storage.pdl); it exercises the browser's native quota error path rather than throwing a JavaScript mock error. It does **not** simulate a full NTFS volume or revoked Windows ACL. Destination interruption was OPFS-backed, not a forced crash while writing an external NTFS file.

## Actual Windows Save As: small file only

The user operated the actual Windows Save As dialog in the fresh **installed Chrome 155.0.8059.85** test window. Native automation could not initialize because of a kernel-assets path error. No alternate low-level UI automation was used.

The user identified `krakinai-backup-2026-10-27.zip` in Documents. It is a **synthetic certification export, not a backup of the user's actual library**. The file was read without changing its bytes or modification time:

- **2,778,074 compressed bytes**; SHA-256 `2cc10d125d900a3180ef9bd219123e7a371bad6a476757fb0fc3cc5ba0e59e19`.
- Independent Python member CRC/SHA verification matched the case-rich-04 source, all 29 media, scene outputs and references. Whole metadata validation matched too.
- Restored from that actual external file in another newly created isolated profile, with explicit confirmation and full browser restart: **pass**, exact graph and 29 hashes, 28 decoded images and playable video. Restore/readback took **3,328 ms** in bundled Chromium 156.0.8078.4; the original file remained unchanged.

The first harness assumed a different destination and reported ENOENT after the UI reported Saved. The operator-provided path resolved that readback gap. A second duplicate picker probe was stopped after the original file was identified; it is not counted as another successful dialog test. The repeatable manual harness now captures and delegates to the original native picker for future small-file readback. That optional interactive instrumentation was not rerun as a second certification.

**Large Windows Save As remains untested.** Edge's native dialog was not tested. 7-Zip was unavailable; Python compatibility does not establish 7-Zip interoperability. Earlier generic 5,500 MiB ZIP and Python checks remain documented separately in the historical report; that fixture has no valid library manifest and exceeds the media allowance.

## Automated results and warnings

| Command | Exit | Actual result |
| --- | ---: | --- |
| `npm ci` | 0 | 194 packages installed, 195 audited |
| First `npm test` | **1** | 352 passed, 1 failed: existing dialogue compatibility test timed out waiting for Assemble Prompt |
| `npm test -- src/__tests__/dialogueCompatibility.test.tsx` | 0 | 3/3 passed without source changes |
| Full `npm test` repeat | 0 | **353/353**, 50 files, 30.43 s |
| `npm run typecheck` | 0 | No diagnostics |
| `npm run build` | 0 | Vite build passed; initial JS 472.07 kB, backup chunk 217.43 kB; no chunk-size warning |
| `npm audit --omit=dev` | 0 | **0 production vulnerabilities** |
| `npm run test:qa` | 0 | **3/3** ledger tests; historical ledger remains **207 checks, 45 screenshot records** |
| `npm run test:e2e` | 0 | **8/8 Chromium tests**, 29.0 s |
| `git diff --check` / final staged check | 0 | No whitespace diagnostics after normalizing the new JSON to LF; initial staged check exited 2 on CRLF trailing-whitespace diagnostics |
| Final `node scripts/qa/recovery-certification.mjs --output=<new external case directory>` | 0 | **12/12**, small fixture only; large cases marked blocked |
| `node scripts/qa/recovery-native-restore.mjs --case=<owned case-rich-04> --file=<operator-selected synthetic ZIP>` | 0 | Explicit restore/restart/full equality passed |

Warnings retained: `whatwg-encoding@3.1.1` deprecation; **6 development advisories (3 moderate, 1 high, 2 critical)** during install; **14 MediaThumbnail React act warnings** in the passing local full repeat; NO_COLOR/FORCE_COLOR notices in browser logs. The first failed run had additional act warnings. No unrelated dependency upgrade or test-timeout change was made. The unit timeout remains a test-timing risk; a passing retry does not erase the failure.

The new committed `e2e/recovery-certification.spec.mjs` covers real native quota restriction, complete previous-graph preservation, explicit UI confirmation, restored graph/hash equality and playable/decodable media. Existing committed tests cover settings, writable aborts, legacy restore, generation fencing and scene workflows. This round's manual production-static checks add real process-crash checkpoints.

The historical successful hosted run [40371030390](https://github.com/Jeruzael/krakinai/actions/runs/40371030390) tested **b01dae956cf00f98e5da398916d1f92e5d923bd2**, before this update. The exact new head and its verified successful Actions run are recorded in [PR #12](https://github.com/Jeruzael/krakinai/pull/12) after push; no future CI result is asserted by this committed report. Hosted Linux browser tests do not certify Windows multi-GiB recovery.

Harness development failures are retained in raw evidence: cases 01/02 failed fixture setup because a take decision was invalid; case 03 compared optional `undefined` own-properties to absent JSON keys even though metadata hashes matched; case 04 assumed the wrong native output path; case 05 passed 12 checks but an Error.name field obscured one flattened check label. The final case 06 uses stable IDs/nested details and passes. No user records were involved in those corrections.

## Retained files and scoped review

No paths were deleted in this certification task. Raw logs, source snapshots, synthetic ZIPs, production-static bundles and all owned profiles remain outside Git. The detailed local `retained-inventory.json` lists each remaining file under the current `zip64-recovery` and earlier `qa-ci-zip64` roots, with relative paths and logical bytes; it intentionally excludes itself and does not follow reparse points. Directory totals are in the public JSON. This is a point-in-time inventory; later CI logs may add files. The operator-selected Documents synthetic ZIP is listed separately and preserved.

The certification update changes only the panel, focused tests, manual QA scripts, this evidence/report and its plan, plus a historical-report cross-reference. Review of the actual diff found no new runtime parser/persistence changes, credentials, browser profiles, ZIP fixtures, real media, personal records or temporary artifacts in the commit selection. The browser quota query is read-only and handles unavailable estimates without treating them as zero capacity. No API, authentication, paid dependency, database migration or deployment change is introduced by this update.

Review outcome: the targeted warning/test/documentation changes are suitable for review, but **large-library certification is blocked**. There is no general SAFE verdict. Search results alone are not evidence of data safety.

## Security assumptions and remaining risks

- CRC/SHA detect corruption; they do not authenticate the archive's author. Legacy backups can omit optional SHA fields.
- Atomic recovery depends on browser IndexedDB transaction/durability semantics. The process kills demonstrate finite checkpoints, not every power-loss or machine-reboot condition.
- Native quota exhaustion was verified at small size. Physical NTFS exhaustion, revoked OS permissions and a crash during external destination writing are untested.
- Representative multi-GiB replacement, a combined 2,000-entry/near-media-limit graph, native large-file dialog handling, 7-Zip, Edge's picker, Firefox and Safari remain unverified.
- Storage quota, temporary files, browser versions and existing-library size can constrain recovery below configured limits. No universal memory or responsiveness guarantee is established.
- Incomplete OPFS stages and retained QA profiles consume space. They are preserved pending explicit named-path cleanup authorization, including profiles whose earlier removal was policy-blocked.

## Proposed scalable alternative — design only

A separate storage migration could keep immutable media in content-addressed OPFS files and build an **inactive library generation** incrementally. Generation metadata and the active-generation pointer would live in the **same IndexedDB database**. Each OPFS file must be closed, hashed and durable before the generation is sealed; all metadata, references and original scene outputs must validate before activation.

Activation would use one small IndexedDB transaction that checks the expected write-generation token and changes the active pointer. Reads would capture one active generation for a consistent operation. Every writer would check the active generation and write token inside its transaction; older tabs would be fenced and required to reload. A crash before activation leaves the previous generation active. A crash after activation exposes only the sealed, complete new generation. The old generation remains recoverable until explicitly authorized retirement; no automatic cleanup of user data is proposed.

This would avoid reinserting all media Blobs in one huge live transaction and reduce duplicated native blob processing, while preserving user IDs and immutable snapshots. It still needs space for the archive, staged/new media and retained previous generation; it does not make this C: volume adequate for certification. It requires a separately reviewed versioned migration, legacy import/export compatibility and a complete failure/recovery matrix. **It is not implemented in this PR update.**

Reattempt near-limit certification only on an NTFS location with at least the calculated requirement and practical 35–40 GiB headroom, then recheck browser quota and actual previous-library size. Raise the gate only after complete staged confirmation, atomic replacement, browser restart and exact graph/media verification at the demonstrated size.
