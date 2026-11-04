# Review incoming Codex proposals

Incoming proposals have a **24-hour review window**. KRAKINAI saves the original package and navigation progress locally in the same browser and origin. Closing and reopening KRAKINAI keeps a saved draft, but does not restore a connection, permissions, approvals or rejection-sharing authority.

## Review a batch

1. Open **AI Connections → Incoming Proposals → Review proposal**.
2. Select one change from the navigator. Use **Recipe**, **Blocking**, **Frames**, **Video** or **Exact data** to inspect its details. Frames and video prompts remain separate. Copy and Download use complete text.
3. Read **Ready to apply?**. On smaller screens, open **Issues & approvals**. Data conflicts, approval categories and connection requirements are listed separately. **Go to** selects the relevant item and focuses its heading. Global findings appear under **Batch & project checks**, including errors that cannot honestly be attributed to one shot.
4. Make the required candidate/manual-output decisions and approve each requested category. **Mark this item viewed** only records navigation progress; it grants no approval.
5. Confirm **I reviewed this exact proposal**, then **Apply reviewed batch**. Selection does not filter the import: the whole approved batch saves atomically. Saved scenes remain immutable.

If Apply is disabled, its explanation and the Issues panel show the remaining requirements. Some data conflicts require a revised package or a smaller batch; checking approval boxes cannot resolve those conflicts.

## Continue later

Proposals received by an older version were not stored by that version. Before updating or refreshing, keep the original change-set JSON where available, or ask the submitting Codex chat to resubmit the exact package after reconnecting. This feature cannot recover an old draft that was never saved. Exact committed packages recover their receipt instead of creating duplicates.

An expired, rejected or disconnected package remains inspectable and downloadable. Pair with the correct browser library, apply the minimum necessary permissions, then choose **Revalidate and resume**. An expired draft instead offers **Revalidate for another day**; a rejected draft offers **Reconsider and revalidate**. Renewal is explicit and checks current scope and records. It does not rebase stale revisions or restore prior approval. Opening, viewing or retrying a proposal does not extend its deadline.

The review window and connection timers are separate. Pairing still lasts two minutes; a session lasts at most one hour and expires after 15 minutes idle. Final Apply consent remains one-use with a 60-second deadline. A one-day draft does not grant one-day access to your library.

## Reject with a comment

Choose **Reject proposal**, optionally enter a reason, then select:

- **Reject locally**: keep the reason in this browser only.
- **Reject and share feedback**: explicitly authorize the entered comment and rejection timestamp for currently authorized Codex clients. Shared-session clients can read it through proposal status; KRAKINAI cannot identify one particular chat as its exclusive recipient. Delivery is confirmed only when a client retrieves it.

Comments are plain text, limited to 2,000 Unicode characters and 8 KiB UTF-8. Sharing requires a current authorized proposal context. It does not enable access to other notes, identities, prompts or media. A saved sharing-history flag cannot authorize disclosure after reconnecting or changing permissions. A failed save keeps your comment in the dialog and warns before discarding it. Rejection never creates a replacement or modifies library records.

## Local storage and recovery

Review packages use a separate `krakinai_review_inbox_db` database, version 1, one `packages` store. The production library remains version 3 with eight stores. Concurrent saved-review mutations require Web Locks. Apply and recovery use a crash-releasing lock for the exact package; another tab must wait for the active save to finish. Browsers without Web Locks can inspect/download drafts and save navigation hints, but cannot revalidate, approve, reject or remove valid review packages.

The inbox stores original validated packages, digests, timestamps, navigation hints and optional rejection comments—not credentials, session keys, grants or final consent.

Limits are eight packages, 1 MiB per incoming MCP package, 64 KiB of progress/metadata per record and 10 MiB total. A full inbox rejects new admissions instead of silently evicting existing drafts. Use **Local draft options → Remove local review draft** to make room. This removes only that review package, not library records or committed receipts. A malformed saved record is quarantined with explicit Download/Remove controls. Applied packages also retain Download and Remove beside their confirmed receipt, so successful imports do not permanently fill the inbox.

Unexpected cache-write failure can leave a visibly labelled **Not saved for later** in-memory proposal. Download it before closing the tab. Review-cache writes are distinct from production-library writes: submitting a proposal may save a review draft but never commits library records before approval.

**Review drafts are excluded from full-library backups and Project Export.** Use **Download recipe package (JSON)** for a portable copy. A downloaded package contains the supplied prompt text and should be handled accordingly. The existing manual JSON importer remains available with its own 20 MiB allowance; importing does not approve a package.

An interrupted or failed save is checked against the actual import ledger after reconnection and validation. A local `applying` or `applied` label alone is never proof of success. If the library transaction committed but updating the review cache failed, KRAKINAI reports the confirmed receipt and the cache warning; it does not claim the commit rolled back. Exact replay never creates duplicate scenes.

## Agent compatibility

All 13 authenticated MCP tools and change-set input contracts v1–v6 remain supported. Explicitly shared feedback is optional additive metadata on `krakinai_get_proposal_status` and an authorized exact duplicate-submit status:

```json
{"feedback":{"comment":"Keep the other frames.","rejectedAt":"2026-11-04T12:00:00.000Z"}}
```

Agents must not treat a comment as approval, renew on the user's behalf, infer permissions from a cached draft, or claim success from submission alone. Read an authorized confirmed receipt before reporting saved IDs. Prefer Recipe/Build from Assets and preserve unrelated frames, takes and reusable identities.
