# Import history storage and capacity reporting

- Date: 2026-11-05
- Status: Approved by owner on 2026-11-05 for inline implementation and an unmerged PR; live upgrade remains separate
- Base: merged proposal-review workspace, master `4d9fc3dbbc252803011f1fa02253f1154920c063`
- Delivery: a separate, tested feature PR; keep it unmerged until the owner approves

## Intent

Let the owner review and apply a substantial Recipe batch without its durable import receipt unnecessarily repeating the same image and video prompts many times. Explain every admission limit before approval, including limits that apply to the whole batch rather than one operation. Keep exact reviewed evidence, receipt replay, backup compatibility and atomic saving.

The immediate trigger was a 15-shot Recipe proposal with 33 image-frame prompts and separate video prompts. Both its original and smaller revised package were blocked by cumulative import-history capacity. No final scene batch was applied. This design does not approve, resubmit, reject or apply either real proposal.

The owner approved lossless receipt compaction, the encoding/bounds/compatibility mechanism below, an 8 MiB history test target and visible capacity checks. This document preserves the pre-implementation baseline; demonstrated implementation results are recorded separately in the [final QA report](../../qa/import-history-storage.md).

## Verified baseline before implementation

- [changeSetLedger.ts](../../../src/domain/changeSetLedger.ts) limits the entire serialized import ledger to 4 MiB, at most 1,000 receipts and 250 combined asset/variant candidates. It never evicts a receipt to admit a new batch.
- Receipt v2 records the complete canonical Blocking review projection; receipt v3 records the complete canonical frame review projection and exact frame results. [changeSets.ts](../../../src/storage/changeSets.ts) stores these as `reviewedContent` strings.
- [keyframeReviewedProjection](../../../src/domain/keyframeChangeSet.ts) includes resolved authoring data and newly prepared scenes. Canonical/effective outputs, image snapshots and draft signatures can repeat substantial prompt content. JSON string escaping adds further physical storage cost.
- Preview and the final transaction both try to append the receipt and check the resulting full-backup metadata. A failed append adds a global `LEDGER_CAPACITY` finding. The final transaction aborts rather than dropping history or partially saving scenes.
- [keyframeMcp.ts](../../../src/domain/keyframeMcp.ts) reports findings attached to an operation. [proposalBroker.ts](../../../src/connections/proposalBroker.ts) does not currently include every global admission finding in its preview/status projection. Successful frame derivation therefore does not establish whole-batch readiness.
- [changeSetCapacity.ts](../../../src/domain/changeSetCapacity.ts) checks the prospective full-backup manifest against the existing 20 MiB limit in [validation.ts](../../../src/domain/validation.ts). That limit remains unchanged.
- The main database is version 3 with eight stores. [libraryCompatibility.ts](../../../src/storage/libraryCompatibility.ts) already implements explicit protected upgrades and closes connections on `versionchange`. Full backups use schema 1 or feature-gated schema 2 through [backupFeatures.ts](../../../src/domain/backupFeatures.ts).

### Measurement, with its limits

A pure, in-memory diagnostic using the existing planner measured a representative 30-operation/15-scene/33-frame batch:

| Existing representation | Canonical review evidence | Serialized new receipt |
| --- | ---: | ---: |
| Original package | 3,797,855 bytes | 3,970,653 bytes |
| Smaller package | 3,464,615 bytes | 3,634,759 bytes |

These are isolated baseline sizing results, not measurements of the real cumulative history. The fixture omits actual historical receipts and some media/provenance details. Splitting into 15 single-shot receipts increased estimated total receipt storage; it is not a demonstrated capacity remedy. At design time the new codec had not been implemented or measured. Do not infer a compression ratio, remaining live capacity, successful import or verified 8 MiB support from these baseline results; use the separate implementation QA evidence.

Do not put the real story, record IDs, manifests, full prompts or ignored diagnostic artifacts into the implementation PR. Committed fixtures must be independently authored synthetic equivalents.

## Approaches

1. **Raise the cap alone.** Smallest patch, but leaves duplicated prompt evidence and poor diagnostics. It only postpones the problem and cannot guarantee the 20 MiB backup metadata check will pass.
2. **Lossless compact receipts plus a measured cap increase.** Preserve the complete evidence, reduce repetition using the existing compression dependency, expose independent capacity limits and retain a bounded total history. This is the recommended approach the owner accepted in principle.
3. **Separate or external history archives.** Potentially scales farther, but requires a new persistence/backup architecture and new rules for receipts that are no longer locally available. Defer; do not add an eviction or archive mechanism to this fix.

This is a storage and validation project, not a constant-only fix. Its compatibility change and atomic-save checks justify a full design and separate implementation plan.

## Goals, constraints and anti-goals

- Retain every existing receipt and candidate, the exact canonical evidence of every new reviewed batch and every confirmed saved ID.
- Preserve all existing change-set v1-v6 input contracts, immutable scenes, image/video output bytes, reference associations, permissions, replay and rollback behavior.
- Make receipt, count, expanded-evidence and backup metadata limits independently visible and enforce all of them before and at saving.
- Use only existing local dependencies. No backend, cloud, external AI credentials or external provider actions.
- Test with isolated synthetic libraries only. No real-profile inspection, database writes, migration, history deletion or proposal approval during development.
- Keep the 20 MiB backup metadata guard, media/archive limits, verified large-restore gate and separate 128 MiB Project Export unchanged. This work is not ZIP64 certification and does not touch the separate ZIP64 PR.
- Do not compress saved scenes or change assembler logic to manufacture headroom. Do not summarize, truncate or discard review evidence, even if it appears derivable from other fields.

## Proposed storage representation

Introduce import ledger storage version 4 and receipt storage version 4. These are internal persistence versions, not a new change-set contract or permission format.

- Read legacy ledgers/receipts v1-v3 without rewriting their content. Preserve legacy validation rules and receipt recovery. On the next successful import, the ledger envelope becomes v4; earlier receipts remain unchanged.
- v1-v4 change-set imports can continue using their existing receipt v1 contents inside the v4 ledger.
- New v5/v6 imports use receipt storage v4. Retain the existing receipt envelope: change-set schema, package/approval digests, IDs, mappings, operations, approval decisions, project revisions, timestamps and v6 frame results.
- Replace only the new receipt's private `reviewedContent` storage field with a strict `reviewedEvidence` envelope: `encoding: "deflate-utf8-base64.v1"`, `uncompressedBytes`, `sha256` and `data`. Hash the exact UTF-8 bytes of the existing canonical review string, not a normalized or reassembled substitute.
- Use the already installed `fflate` dependency for lossless DEFLATE. Require canonical base64, an integer byte length and lowercase 64-character SHA-256. Reject unknown fields/encodings, malformed data, trailing compressed input, truncation, invalid UTF-8, inconsistent sizes or hash mismatches.
- Decoding must reproduce the original canonical string byte-for-byte, then pass the existing schema-specific evidence checks and canonical-JSON comparison. An evidence blob is never executable and is never reconstructed into database operations.
- Encode/decode one receipt at a time. Do not keep an expanded copy of the whole history in preferences, review cache, a global map or every UI component. A short-lived verified preparation may retain only what is needed for its pending operation; release it afterward.

### Independent bounds

| Limit | Proposal | Meaning |
| --- | ---: | --- |
| Serialized ledger | **8 MiB test target** | Exact UTF-8 length of compact `JSON.stringify(ledger)`, including base64, envelopes and candidates |
| Expanded evidence per new receipt | 4 MiB | Exact canonical UTF-8 bytes, independent of compression ratio; retains the existing review-evidence ceiling |
| Aggregate expanded evidence | 32 MiB test target | Sum of actual verified evidence lengths for all v2/v3/v4 receipts, without retaining all expanded strings |
| Receipt count | 1,000, unchanged | No implicit pruning |
| Combined candidates | 250, unchanged | Pending and resolved records retain current semantics |
| Full-backup metadata | 20 MiB, unchanged | Existing prospective manifest check, including checksum-field reservation |

The 32 MiB expansion bound is an engineering proposal to bound validation work, not a new media allowance or an unlimited logical archive. Legacy ledgers that were valid under 4 MiB fit this bound. The implementation must measure worst-case memory and durations. Lower an unverified target if necessary and report the demonstrated result; do not silently increase a bound to pass a fixture.

Compressed input is independently bounded by the physical ledger limit before decoding. Use incremental inflation with small controlled input chunks, enforce the output ceiling during decoding and stop at the first overrun. Do not use a whole-stream decoder that allocates from an attacker-declared expansion size. Test the decoder's internal allocation/overshoot as well as callback output; an after-the-fact length check is insufficient. Validate receipts sequentially and reject an aggregate expansion overrun. No public claim of a safe bound until adversarial fixtures and process-memory observations support it.

## Exact approval and atomic save

Keep `signedContent`, package/approved digests and the canonical review projections semantically unchanged. Compression bytes never replace human-reviewed content in the approval calculation. Prove output and digest equality on fixed legacy v1-v6 fixtures.

WebCrypto hashing and other asynchronous preparation must finish **before** the IndexedDB write transaction. Introduce a verified ledger/evidence preparation shared by preview, Apply, startup integrity checks, backup validation and receipt recovery:

1. Read the current ledger; validate legacy entries and bounded-decode/hash-check compact evidence sequentially. Retain an exact serialized comparison token locally, never in an MCP response.
2. Prepare the candidate receipt from the existing canonical review projection. Encode, decode and verify its exact bytes/hash outside the write transaction. Choose any needed application timestamp once, preserving v6's existing frozen preparation-time semantics.
3. Compute prospective capacity against the current ledger and complete planned snapshot. This is still a preview, not permission or approval.
4. Open the existing transaction, read its fresh state and retain all current re-planning, source/media/revision, digest, replay and synchronous authorization checks.
5. Compare the transaction's ledger to the exact verified ledger from preparation. A race fails closed and asks for a fresh capacity check; it never appends to an unverified history. Recompute the canonical review projection from the transaction's re-plan and require equality with the prepared evidence before copying the verified encoded envelope. Preserve existing legacy timestamp behavior; do not normalize timestamps or remove fields to make comparison pass.
6. Synchronously append and recheck stored bytes, counts, verified expansion totals and the full prospective backup metadata. Check authorization at the existing boundary, then commit all records and the receipt together.

No awaited compression/hash/decompression inside the write transaction, no keepalive requests to hide asynchronous preparation, and no receipt written after a scene transaction commits. Forced failure on any write aborts the entire batch. A ledger change after preview can be rechecked without inventing approval; any source or reviewed-content change still requires renewed exact review. A race during final preparation/transaction requires retry/revalidation.

Replay keeps the same exact package/digest/approval and current-scope requirements. A confirmed replay does not append a second receipt, consume extra capacity or create a take. A reused ID with different contents remains an error.

## Compatibility and backups

New receipt fields and a larger ledger cannot safely be edited by older builds. Use the existing explicit protection mechanism to advance the main IndexedDB version **3 to 4**, with the same eight stores and unchanged record keys. This changes the database header only; do not migrate, compact or delete existing records on upgrade.

- Extend the read-only compatibility inspection and pre-upgrade backup reader to accept v3 as a legacy input. Preserve v1/v2 upgrade paths.
- Before enabling, show that older builds will no longer open this browser/origin library. Offer the existing validated pre-upgrade full backup and require owner acknowledgement that a backup was saved. Never treat initiating a download as proof the file was saved. This does not certify large-library export/restore beyond existing limits.
- Old tabs receive `versionchange`, close their connection and stop writing. If a tab keeps a connection open, remain blocked with actionable close-tab/cancel controls; do not force-close or reset its data. Upgrade cancellation and failed schema inspection preserve the existing library.
- A new library starts in v4. A current build refuses a newer unknown database version. An older v3 build must fail opening v4, including a tab that resumes after an upgrade.
- Keep full-backup manifest schema 2 and add the required feature `compact-import-evidence.v1` whenever ledger v4 is present. Continue declaring v5/v6 features according to receipt `changeSetSchema`, even when scenes have been deleted. Older readers must reject the unknown feature before replacement.
- New readers continue accepting legacy schema 1/2 backups without rewriting their receipts. Validate new compact envelopes and hashes, all existing records/references and the 20 MiB manifest bound before replacement. Restore remains one atomic replacement; corrupt evidence must not replace even part of the existing library.
- Re-export and re-import a mixed old/new history, restart, retrieve receipts and replay the same package. A pre-upgrade backup is the return path for an older build in a separate profile/origin; do not promise in-place downgrade.

The durable proposal-review cache is separate from this ledger. Keep its existing database, eight-package/10 MiB limits, review lifetime, rejection feedback and cross-tab locks unchanged. Cached previews remain non-authoritative and must be revalidated after the upgrade. Do not automatically erase blocked proposals.

## Capacity model and browser presentation

Replace catch-by-error-message admission classification with a typed, shared capacity result. The domain calculation returns current/prospective serialized bytes, verified expanded-evidence bytes, receipt/candidate counts and prospective backup metadata bytes, with separate reasons for each exceeded or unevaluated bound. Corruption/unsupported evidence is an integrity failure, not a suggestion to use a smaller batch.

In the existing compact review workspace's **Batch & project checks / Ready to apply** area, show one small **Storage check** section, also available in manual import:

- Import history: used / limit and remaining stored space.
- This receipt: compact bytes and expanded evidence bytes; prospective cumulative totals.
- Backup metadata after import: checked upper bound / 20 MiB, labelled as a reservation when checksum fields are conservatively reserved.
- Receipt/candidate counts and expansion headroom when relevant; all exceeded limits appear in the same blocker list, linked to Batch & project checks.

Do not add a long second document or one repeated capacity card per frame. Use existing disclosure, status and responsive components; clear labels, keyboard access, polite recalculation status and an alert for a newly discovered blocker.

If required decisions/inputs are unresolved, show **Not yet calculable: resolve the listed choices** for affected prospective values. Never display zero, a green check, an exact remaining allowance or a purported successful import for missing calculations. If calculable with current choices but approvals remain, label it **Fits current preview; review and final recheck required**. Capacity is not reserved; another tab can consume it.

Recalculate after a candidate decision, canonical/manual output choice, proposal revalidation or relevant library update. Preserve the entered decisions while invalidating a stale calculation. Apply remains disabled for any conflict, unknown required capacity, missing approval or invalid evidence. The final transaction remains authoritative.

## MCP reporting without permission expansion

Add a small, versioned `batchChecks` result to the existing preview, submit and proposal-status responses for v1-v6. No new tool, input operation or automatically granted permission is needed.

- Fields: `version: 1`, `readiness: "blocked" | "review_required" | "not_evaluated"`, `previewIsSnapshot`, preview preparation time/digest when available, and allowlisted `{code, severity, message}` findings. Messages are fixed safe explanations, not raw exceptions containing private record labels or content.
- Include global ledger/backup admission findings even when all operation/frame checks succeed. Also report an authorized operation's code where needed to explain overall blocked status. Approval-only findings leave readiness `review_required`; unresolved validation/capacity remains blocked or explicitly `not_evaluated`, never ready.
- Owner-only history totals, receipt counts, remaining space, hidden project/asset/media IDs, compressed evidence, prompts, rejection comments and ledger comparison tokens do not leave the browser. This result communicates whether this authorized proposal fits, not information about unrelated history.
- Honor existing proposal/derivation grants, receipt recovery grants, scope epochs, disconnect/revocation, response size limits and projection redaction. Read-only frame derivation remains separately permitted; it does not grant submission or receipt access.
- Saved status is explicitly a snapshot. It cannot certify current headroom after other writes; refresh/revalidate before Apply. A confirmed applied status remains separate from preview readiness.
- Keep the public receipt projection semantically compatible: receipt storage v4 projects as logical receipt v2 for v5 or v3 for v6, with the same exact frame results and existing permission checks. Never expose the private evidence envelope through that projection.

Update agent guidance: canonical prompt derivation passing is not a successful batch-capacity check; `review_required` is not applied; confirm an authorized receipt and actual saved results after the owner's approval. Never bypass a limit by deleting history.

Bridge inputs, tool names and native pairing format stay unchanged. Validate the additive result with the production transport/adapter. Do not rebuild, re-sign or activate a launcher merely for this browser-side change. If source tracing/testing establishes that the compiled bridge needs a change, document that as a scope change and arrange a reviewed artifact plus specific signing/activation approval; never alter the live release silently.

## Verification and release decision

Implementation is not complete until these claims have machine-readable evidence from isolated synthetic libraries:

1. **Lossless codec:** full Unicode, escapes/newlines, manual and canonical prompt choices; exact original bytes and SHA-256 after decode; representative v5/v6 projections; incompressible input; unsupported encoding, noncanonical base64, trailing input, wrong length/hash, truncated/corrupt streams and decompression bombs. Preserve legacy evidence validation.
2. **All independent bounds:** below/at/over stored 8 MiB target, per-receipt 4 MiB, aggregate expanded 32 MiB target, 1,000 receipts, 250 combined candidates and 20 MiB prospective backup metadata. Test one bound failing while others fit. Never replace boundary tests with highly compressible repeated filler alone.
3. **Representative end-to-end batch:** independently authored 15-shot/33-frame/30-operation Recipe fixture with Characters, Outfits, environments, Blocking, cues and separate complete image/video prompts. Seed legitimate mixed prior receipts, pass review, approve via actual synthetic browser controls and atomically save; restart, verify every ID/count, old scene and preferred take integrity, exact output/media hashes and receipt replay. Record before/after stored and expanded sizes.
4. **Atomic failures:** stale source, concurrent receipt append, permission rejection/revocation, altered approved content, forced failure after at least one staged write and receipt-write failure. Compare the complete pre/post library and preserve original receipt/record/media contents on failure. No duplicate take or partial receipt.
5. **Compatibility/backup:** v1/v2/v3 library upgrade, v3 connection blocked/cancelled, old-reader rejection, no record changes during header upgrade, mixed-history full ZIP backup/restore and re-export, malformed/new unsupported features, corrupt compressed evidence, restart/replay and legacy backups. Verify the 128 MiB Project Export and unrelated backup/media/archive limits are unchanged; do not claim near-limit media certification.
6. **Browser UX:** visible storage blocker before approval, accurate unknown/recalculation states, batch navigation, disabled Apply, desktop/mobile layouts, keyboard/focus and existing proposal decisions/cache preserved. Synthetic screenshot evidence at 1440, 768 and 390 widths.
7. **Actual MCP calls:** preview/submit/status include the batch blocker when individual frame derivations pass; caller/call-ID-correlated results, redaction and revoked-scope rejection; successful browser-approved save, authorized receipt retrieval and duplicate replay. Use existing local synthetic model/transport fixtures, never external AI credentials. Do not report SDK coverage as installed-CLI/native certification.
8. **Resource observations:** record peak browser/process memory and durations for a representative batch, near-boundary history, incompressible and adversarial compressed evidence. Separate compressed bytes, expanded bytes and serialized manifest bytes. Investigate decoder over-allocation; reduce or retain a target when full-bound verification fails.
9. **Regression and review:** run app tests, bridge/native/helper suites, existing browser suite, typecheck, production build, production audits and appropriate QA evidence checks. Record actual exits, warnings, skips and failed attempts. Obtain an independent final source review, a signed commit and successful hosted Linux/Windows CI on that exact head. Keep the PR unmerged and do not activate a live library upgrade.

## Remaining risks and builder decisions

Compression reduces repetition, not unlimited storage demand. Incompressible evidence, cumulative receipts or the unchanged backup metadata allowance can still block a proposal. The interface must explain the actual failed bound without promising that splitting will solve it.

Expanded JSON validation and compression consume CPU/memory; declared lengths and callback limits alone are not proof of bounded internal decoder allocation. The specific chunk size, worker placement, verified-preparation cache lifetime and typed error names are builder decisions, subject to the measured limits and atomicity rules above. Do not add a handwritten cryptographic hash implementation to avoid WebCrypto timing.

Existing receipts remain uncompressed in this first release. Retrospective compaction or exportable history archives are separate future features requiring their own preservation/approval design.

The protected upgrade prevents opening this library with older builds. The owner must approve that tradeoff in this design and deliberately enable it later in the browser; development and merging do not constitute live upgrade consent.

The implementation plan must list touched compatibility, receipt, backup, review, MCP and test entry points, and include a gate that retains the existing supported capacity if the new targets cannot be demonstrated safely.

## Review checkpoint

The fresh independent builder check returned “nothing important left.” All nine local source links resolve. These are design checks, not automated evidence that a codec, capacity increase or migration works; those remain implementation acceptance requirements.

At the design-review checkpoint, only this document and read-only source/remote inspection had been prepared. No application code, current limits, stored history, proposal content, native signatures, global MCP registration or live browser data had changed at that checkpoint. The owner subsequently approved implementation; see the [implementation plan](../plans/2026-11-05-import-history-storage.md). Signed Git commits remain under the owner's existing local signing configuration.
