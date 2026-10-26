# Full-library streaming backup and staged restore

Full Library Backup is separate from the 128 MiB Project Export. The Project Export implementation, saved-scene assembler and version-1 library schema are unchanged. The storage-limit file is deliberately untouched.

## Limits and supported paths

Compressed input and actual ZIP output have a separate 5,500 MiB ceiling. Expanded archive contents remain capped at 5,500 MiB; originals and posters together at 5,000 MiB; manifest at 20 MiB; entries at 2,000. Individual images/posters remain 10 MiB and video 50 MiB. The archive index adds a 16 MiB central-directory bound and 1,024-byte ASCII path bound; generated legacy KRAKINAI paths are ASCII. STORE and DEFLATE are supported. Encrypted, multipart, link/device/directory and ambiguous-path archives are rejected.

The restore gate in `src/storage/backupLimits.ts` is deliberately lower than the format ceilings. Only a physically demonstrated restore maximum is enabled. Increasing a constant alone does not establish support. A valid library may not reach the compressed ceiling because media has a lower allowance. The separate generic ZIP-layer boundary fixture is deliberately not a valid library backup.

Chrome/Edge can save directly through a user-gesture `showSaveFilePicker` and `FileSystemWritableFileStream`. The engine applies backpressure and reads one media Blob in 256 KiB slices. Text is compressed; media is stored. CRC32 and incremental SHA-256 are checked on read; new manifests include optional media hashes. Legacy manifests without SHA-256 retain CRC and association validation. Integrity hashes do not authenticate a backup's creator.

No multi-GiB Blob fallback exists. An explicitly labelled 64 MiB buffered compatibility path remains for small legacy callers and browsers without direct file saving. Browsers without OPFS can process only the bounded small path. FAT32 cannot hold a file of 4 GiB or more, and browser APIs cannot reliably predict destination free space. Saved means destination closure completed; Verified requires a subsequent readback.

## Input validation before decompression

The seekable preflight bounds the EOCD/ZIP64 records and central directory before zip.js can allocate its directory buffer. It checks safe integer offsets, single-disk metadata, all extra-field structures, central/local names and sizes, data descriptors, file types, overlapping extents, supported methods and flags, canonical duplicates, and traversal forms. Entries above 1 MiB with expansion ratios above 2,000 are rejected; that avoids a low ratio cutoff that would reject normal compressed JSON. Actual streamed entry and expanded totals are checked independently of declared sizes. CRC verification is explicitly enabled.

Library validation then checks MIME metadata, individual and total media sizes, JPEG posters, optional SHA-256, required media associations, archive membership, and the existing Phase 4/5 optional fields. Unassociated archive members are rejected. Restored Blobs use typed slices so SVG/image/video MIME types survive opaque staging filenames without copying entire media files.

## Staging, confirmation and transaction boundary

Restore payloads go to opaque files in an app-owned OPFS staging directory. A separate small IndexedDB catalog records paths, sizes, hashes and lifecycle state; it does not duplicate payloads or change the live eight-store schema. Nothing in staging is automatically applied. Interrupted stages can be listed/discarded; ready stages must be rehashed and revalidated before another confirmation. Temporary storage can itself fail or be evicted.

A preview captures the live snapshot metadata, private mutation clock and restore generation in one readonly transaction. Confirmation rechecks staged File handles and hashes before opening the live transaction. One strict-durability eight-store transaction compares the baseline and registered generation, clears and queues native puts sequentially, and writes the new clock/generation atomically. No filesystem, decompression or hash awaits occur inside that transaction. Abort or request failure rolls back all stores.

The commit's completion event is the replacement boundary. A crash before completion must retain the old library; a crash after completion may retain the complete new library. Strict durability is a browser hint, not a guarantee against every hardware/OS failure. If post-commit catalog bookkeeping fails, the API reports committed success with a cleanup warning; it does not misreport an unchanged library. A leftover ready catalog cannot silently replay because its baseline no longer matches.

The 25 ordinary production writer sites share a private generation fence and mutation clock through the existing preferences store. Controlled restore compares the registered generation separately; the 27th readwrite site is the deliberately separate test reset. These private operational records are excluded from snapshots/manifests. A current-build tab that predates a successful restore rejects future writes, including deferred stale saves, until reload. The initiating tab also requires reload. Unsaved visible text can be copied first. Existing old builds or arbitrary same-origin scripts that omit these checks are outside this protection; reload older tabs before restoring.

## Verification scope and limitations

The executable small tests cover legacy optional metadata, malformed archives, checksum/hash/reference failures, cancellation, transaction rollback, stage reopening, generation registration/stale writers and MIME preservation. Hosted Chromium tests use fresh synthetic contexts; manual large tests use separate owned persistent profiles. Neither uses the user's normal library or `localhost:5173` profile.

See the companion measured results report for actual file sizes, process working-set samples, independent Python results, failures during harness development and the verified restore gate. Process working set is sampled, includes native allocations and may count shared pages more than once; it is not a proof of a universal memory bound. JavaScript heap alone is not process memory. Injected quota/permission failures are distinguished from a real exhausted disk or revoked Windows ACL. External OS Save As permission dialogs, non-Chromium browsers, FAT32 and 7-Zip are not certified by an OPFS/Python test.

Production dependencies are pinned to `@zip.js/zip.js@2.24.0` (BSD-3-Clause) and `@noble/hashes@2.4.0` (MIT). `fflate` remains for the unrelated bounded Project Export. Primary implementation references: [zip.js](https://gildas-lormeau.github.io/zip.js/), [versioned source](https://github.com/gildas-lormeau/zip.js/tree/v2.24.0), [browser writable stream](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemWritableFileStream), [save picker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker), and [IndexedDB transaction lifecycle](https://w3c.github.io/IndexedDB/#transaction-lifecycle).
