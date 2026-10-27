# ZIP64 final recovery certification plan

**Goal:** Certify complete library recovery only at demonstrated sizes; otherwise retain the existing gate and report a concrete capacity blocker and atomic alternative.

**Architecture:** Preserve the existing archive parser, OPFS staging and atomic eight-store replacement. Use new isolated Windows Chromium profiles and metadata-rich synthetic data. No changes to storage limits or the verified restore gate without successful complete evidence. This user-provided certification brief authorizes routine testing and UI/documentation corrections; no new persistence architecture will be implemented here.

**Spec:** User request “KRAKINAI — Final ZIP64 Recovery Certification”, 2026-10-27 (Asia/Taipei). User confirmed no additional NTFS volume is available.

## Constraints

- PR #12 stays draft and unmerged. Preserve actual user profiles, existing records, snapshots and original checkout.
- No removal of disposable QA profiles or other artifacts without explicit named-path authorization. Retain new files and inventory them.
- Media 5000 MiB, expanded/compressed 5500 MiB, entries2000, Project Export128 MiB unchanged.
- Large restore cases require practical headroom of at least35 GiB plus an explicit case-specific calculation and browser quota check. Do not allocate those datasets when preflight fails.
- Current verified expanded-byte gate1073748246 remains. Parser/OPFS export success alone is not full-library certification.

## Execution

- [x] Record all fixed volumes, free bytes, browser quota/usage, practical headroom and calculated requirements for2000/4000/5000MiB cases. All three blocked and not generated; user has no alternate volume.
- [x] Test a small metadata-rich library with decodable/playable media, scenes, variants, collections and references through export, Python readback, staged confirmation, replacement, restart and hashes. Final case06:12/12.
- [x] Exercise native browser quota failure, interrupted staging, cancellation, corruption, crash rollback, destination interruption and stale writes only in owned synthetic profiles. Native quota restriction verified; physical NTFS exhaustion and external-write crash remain untested.
- [x] Exercise actual installed Chrome Save As at the attainable fixture size, with user operating dialog. Selected external synthetic file verified and restored after restart. Edge/large files not certified.
- [x] Add UI warnings and estimated browser quota display with focused tests; keep the restore gate unchanged.
- [x] Document measured capacity, blocked matrix, retained files, source/archive hashes and a versioned generation/pointer alternative that preserves atomicity and old data.
- [x] Run local automated gates and prepare the PR #12 update. 353 unit tests on repeat, 3 ledger tests and 8 browser tests pass; the first unit timeout is retained in evidence.

Hosted status is recorded in PR #12 after push and exact-head CI verification, rather than predicted in this pre-push plan snapshot. PR #12 must remain draft and unmerged.
