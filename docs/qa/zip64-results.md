# Full-library ZIP64 QA report

**Verdict: CONDITIONAL PASS.** Streaming ZIP64 input and direct writable output were physically verified at **5,767,168,000 bytes (5,500 MiB)**. Full-library restore is enabled only through **1,073,748,246 expanded bytes**, the measured 1 GiB media fixture plus its manifest. Restoring a near-5,000 MiB valid library remains uncertified and is disabled above that gate.

The [machine-readable results](zip64-results.json) contain individual run outcomes, exact measurements, command exits and SHA-256 provenance for retained raw result files. The [architecture report](zip64-architecture.md) describes validation, staging, atomic commit and the generation fence. Raw archives, browser profiles and logs were kept outside Git. Synthetic ZIP files were removed after independent proof to respect the disk budget; result JSON, hashes and source fragments remain available locally.

## Directly verified facts

- `src/domain/validation.ts` is unchanged: SHA-256 `50660f5c044585676932402583c25e8b52ece28af04a714cc909898cc1970fae`. Media remains 5,000 MiB; expanded backup 5,500 MiB; image/poster 10 MiB; video 50 MiB; manifest 20 MiB; entries 2,000.
- The independent compressed ZIP cap is in `src/storage/backupLimits.ts`. The separate `src/domain/projectExport.ts` is unchanged: SHA-256 `fe0508ab9cb11e9ba73c31e64e7167a1e8687b3b6008bbaad2aa8a6217c7b63a`; its 128 MiB cap remains.
- The live database still has its existing eight stores and schema version. A separate temporary catalog has one staging store. Ordinary writes use 25 generation-fenced sites; controlled restore checks generation separately. The test reset is the additional intentional bypass, excluded from production writer counts.
- Full-library processing no longer calls `zipSync`/`unzipSync` or reads a whole archive into one buffer. The 64 MiB compatibility APIs are explicitly bounded. Original records, optional Phase 4/5 fields, saved outputs and media association semantics use the existing domain validators.
- All browser work used fresh or marker-owned synthetic profiles and separate origins on ports 4173/4196/4197. No test used the user's normal `localhost:5173` profile. No real library, backup, media or credentials were committed.

## Automated results

Final local validation followed a clean `npm ci`. Every command below exited **0**:

| Command | Actual result |
| --- | --- |
| `npm ci` | 194 packages installed; 195 audited |
| `npm test` | **352 tests, 50 files passed** |
| `npm run typecheck` | No diagnostics |
| `npm run build` | Passed; initial JS 472.07 kB, lazy backup chunk 215.90 kB; no chunk-size warning |
| `npm audit --omit=dev` | **0 production vulnerabilities** |
| `npm run test:qa` | **3 Node ledger tests passed**; retained QA ledger checked |
| `npm run test:e2e` | **7 Chromium tests passed**, 11.0 seconds |
| `git status --short` | Listed the intended changes before commit; complete list below |
| `git diff --name-status` | Listed tracked modifications before commit |
| `git diff --check` | No output |

Warnings are retained: **22 MediaThumbnail React `act(...)` warnings** in the unit run; `whatwg-encoding@3.1.1` deprecation during install; **6 development-dependency advisories** (3 moderate, 1 high, 2 critical); and two browser-log notices that `NO_COLOR` is ignored while `FORCE_COLOR` is set. These are distinct from the clean production audit. No forced major dependency upgrade was attempted.

The seven committed Chromium tests cover canonical output copy/save/small backup, duplicate-save confirmation, storyboard ordering/collection return, Settings limit labels, Verify without replacement, real OPFS writable export, legacy backup without hashes, SVG decode/MIME/byte preservation, stage reopening, stale preview rejection and stale-tab writes. A writable-failure test covers cancellation and adapter-injected quota/permission failures while preserving an existing destination. The injecting adapter closes its own nested native stream on its write error, as required by Web Streams error semantics; this is not an actual full NTFS disk or Windows ACL test.

## Physical archive results

All sizes are actual file bytes. Python 3.11.9 independently read every member to completion, verifying ZIP CRC32, sizes and SHA-256 against the synthetic source hashes. ZIP64 end records and locators were present. The 4,300 MiB and boundary cases contain member offsets beyond 32 bits.

| Fixture | Compressed bytes | Expanded bytes | Entries | Result |
| --- | ---: | ---: | ---: | --- |
| 128 MiB media | 134,219,031 | 134,218,912 | 4 | Engine + Python pass |
| 512 MiB media | 536,873,962 | 536,874,424 | 12 | Engine + Python pass |
| 1 GiB media | 1,073,747,057 | 1,073,748,246 | 22 | Engine + Python pass |
| 4,300 MiB media | **4,508,896,177** | 4,508,902,137 | 87 | Final parser + Python pass |
| Generic ZIP-layer ceiling | **5,767,168,000** | 5,767,145,018 | 110 | Node + Python + Chromium read/write pass |

The boundary fixture has no library manifest and exceeds the media allowance. It proves the ZIP layer, not a valid 5,500 MiB library restore. Synthetic MP4 MIME payloads are incrementally generated random bytes and are intentionally nonplayable. A retained 50 MiB file supplies bounded file-backed slices; the entire archive is never constructed as an in-memory Blob.

Node's 250 ms sampled peak RSS was 92,766,208 / 102,674,432 / 104,669,184 bytes for the first three cases. The 4,300 MiB final readback peaked at 102,436,864 bytes; original writer memory was not captured. At the exact ceiling, writing took **74,576 ms**, observed peak **122,437,632 bytes**; readback took **73,019 ms**, peak **121,589,760 bytes**. Python verification took 5.781 seconds.

## Browser-tested behavior

The production-static 1 GiB run passed **10/10 checks with zero page errors** in **295,790 ms**. It first checked the reused synthetic library's 21 original media hashes, then killed the owned browser after the first native put inside replacement. Reopening recovered the original library, all original hashes, and the ready stage. Subsequent confirmed replacement, stage deletion, page reload, all restored hashes, stale-tab rejection and direct OPFS export/readback passed. The exported file was 1,073,750,340 bytes. Sampled peak browser working-set sum was **823,848,960 bytes**; sampled JS heap was 5,913,180 bytes.

A clean-room production 128 MiB run independently exercised a newly created profile: **10/10 checks, zero page errors**, 35,918 ms; peak observed working-set sum 739,545,088 bytes. The earlier 128 MiB run also tested corrupted physical member data, cancellation during extraction, injected native-put quota rollback after a prior put, and cancellation inside the live transaction. The 512 MiB run passed 7 checks, 133,468 ms; peak 656,793,600 bytes.

At the exact 5,500 MiB ZIP boundary:

| Browser operation | Measured outcome |
| --- | --- |
| Select and stream-read actual input File | File size 5,767,168,000; all 110 hashes/CRCs pass; 88,060 ms; working-set peak **729,239,552**; JS heap 11,028,760 bytes |
| Write from retained file-backed source slices | Real OPFS writable closed at **5,767,168,000 bytes**; 110-member readback passed |
| Writer/readback timing | 130,749 / 85,521 ms; overall 220,983 ms |
| Writer/readback memory | Working-set peak **539,623,424**; JS heap 11,894,140 bytes |
| Responsiveness | Writer case 6,849 timer ticks and 44,222 progress events; read-only case 148 ticks over about 88 seconds. The read-only result does not prove smooth UI responsiveness. |
| Disk | Writer case free bytes before/after: 18,760,728,576 / 18,599,452,672. Input and output tests ran sequentially, with an 8 GiB reserve and 256 MiB allowance. The harness removed only its own OPFS output after verification. |

Browser process sums were sampled every second and may double-count shared pages. These are observed peaks, not universal upper bounds. JS heap alone excludes native storage/compression/process allocations. The external Windows Save As dialog was not automated: the browser test used the actual OPFS `FileSystemWritableFileStream` implementation, and the UI picker path was tested with a picker stub returning a real handle.

## Failed/intermediate checks and corrections

- Independent review reproduced malformed trailing ZIP extra fields, host-bypassed link metadata, and cancellation before destination close. The implementation was fixed and all three received regressions; the archive suite passed 13/13 on re-review.
- Restored opaque staging Files initially lost MIME types. Typed Blob slices fixed SVG/MP4/JPEG poster restoration; a real Chromium SVG decode and 13 semantic tests passed.
- A no-op initializer originally invalidated preview clocks on reload. It now uses a readonly fast path; the regression and restart tests passed. Post-commit catalog failure reports committed success with a cleanup warning.
- The first >4 GiB Node verification exposed Windows Node 22.23.3 `fs.openAsBlob()` returning file size modulo 2^32. The local harness now uses bounded 64-bit positioned reads. Python could already read the physically valid file; final-engine readback then passed. Production browser File handling was checked separately.
- The first exact-boundary generator underestimated 28 ZIP64 central-offset extras by 224 bytes. The actual compressed limit aborted the output; the corrected planner reached the exact ceiling and passed all independent checks.
- A 20-second close-event harness timeout rejected during the longer pre-commit rehash. The harness now immediately handles that promise and waits for the deliberate crash checkpoint. A dev-server 1 GiB run subsequently had three HMR provider errors despite passing data checks; the frozen production rerun had zero errors.
- Static harness close-button ambiguity and fresh-profile assumptions were corrected and rerun in a clean owned directory. An early writable-fault test forgot to close its own nested stream; its corrected adapter passed.

## Assumptions, blockers and remaining risks

**Near-maximum valid-library restore remains blocked.** A 5,000 MiB ZIP, staging payload and restored copy plus the 8 GiB reserve require at least **24,318,574,592 bytes**, before metadata/native overhead or an existing library. Initial free space was **23,941,218,304 bytes**. Larger native IndexedDB insertion memory, crash recovery and quota behavior were not certified. The application rejects restore above the exact verified expanded-byte gate rather than enabling an untested size.

Checksums/hashes establish integrity, not authorship. The generation fence covers current-build writers; older open application versions and arbitrary same-origin database changes do not participate. Reload older tabs before restoring. Strict durability is not a hardware guarantee. Actual exhausted filesystems, revoked OS permissions, FAT32, non-Chromium browsers and `7z t` remain untested; Python was the independent interoperability tool.

The explicitly bounded small download still hashes before rejecting an oversized compatibility export; this can waste time but does not buffer or save a multi-GiB archive. Protected `validation.ts` retains an inherited video-limit error phrase saying 200 MiB; its actual cap and the new backup UI are 5,000 MiB, and the separate media-save error was corrected without editing that protected file.

Automatic approval review rejected recursive deletion of the disposable profile folders with “blocked by policy.” The folders remain outside Git. Individual synthetic ZIP files were removed only after engine/Python/browser proof. All actual user browser data and original work were left alone.

## Reproduction

Use a 64-bit Windows/NTFS test machine with sufficient free disk. The scripts refuse hosted CI and require an explicit output directory outside the repository. Run ordinary validation first. For example:

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm audit --omit=dev
npm run test:qa
npm run test:e2e
node scripts/qa/zip64-stress.mjs --output=C:/qa/krakinai/case128 --size-mib=128
node scripts/qa/zip64-browser-stress.mjs --output=C:/qa/krakinai/case128 --crash=true
```

The browser harness snapshots the production build plus a separate manual API bundle outside `dist`; its source/build hashes are recorded. Use a fresh owned directory/profile. Reusing an existing synthetic profile requires explicit reuse flags and passes strict synthetic-content/hash checks. `--inspect-existing=true` can read a retained archive and 50 MiB source without overwriting them. Sizes 512, 1024 and 4300 exercise the same archive harness; the restore gate intentionally blocks larger library restore attempts.

For the generic ceiling, generate `--size-mib=5500`, then run `zip64-boundary-browser.mjs --output=<owned directory> --go=true --mode=read-input`. If two large copies would breach the reserve, retain the JSON/Python proofs and source, remove only the specifically generated input ZIP, then run `--mode=write-source`. No profile-folder cleanup is necessary. Metadata-only preflight is not a substitute for these physical runs.

## Changed files

The complete reviewed file list is appended below by Git inventory. Logs, ZIP payloads, profiles, credentials, personal records and temporary QA outputs are excluded.

```text
A	docs/qa/zip64-architecture.md
A	docs/qa/zip64-results.json
A	docs/qa/zip64-results.md
A	e2e/full-library-backup.spec.mjs
A	e2e/full-library-stream-failures.spec.mjs
M	package-lock.json
M	package.json
A	scripts/qa/zip64-boundary-browser.mjs
A	scripts/qa/zip64-browser-api.mjs
A	scripts/qa/zip64-browser-stress.mjs
A	scripts/qa/zip64-inspect.py
A	scripts/qa/zip64-stress.mjs
M	src/App.tsx
A	src/__tests__/backupArchive.test.ts
A	src/__tests__/backupSemantics.test.ts
M	src/__tests__/dialogueCompatibility.test.tsx
A	src/__tests__/fullLibraryBackupPanel.test.tsx
A	src/__tests__/libraryWrite.test.ts
M	src/__tests__/mediaMetadata.test.ts
M	src/__tests__/projectContinuity.test.ts
M	src/__tests__/promptOutputWorkspace.test.tsx
A	src/__tests__/restoreStaging.test.ts
A	src/components/FullLibraryBackupPanel.tsx
A	src/components/LibraryReloadNotice.tsx
M	src/components/SharedModals.tsx
M	src/storage/backup.ts
A	src/storage/backupArchive.ts
A	src/storage/backupLimits.ts
A	src/storage/backupZipIndex.ts
M	src/storage/db.ts
A	src/storage/libraryWrite.ts
M	src/storage/mediaMetadata.ts
M	src/storage/projectBulk.ts
M	src/storage/projectContinuity.ts
M	src/storage/projects.ts
A	src/storage/restoreStaging.ts
```
