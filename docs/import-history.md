# Import history and storage checks

KRAKINAI keeps a durable receipt when an approved import saves your records. The receipt records what you approved, the actual saved IDs and the evidence needed to recover the result without importing it twice. Removing a review draft does **not** remove its committed receipt or free this history allowance.

## Before enabling the updated format

1. Save your work and a **full-library backup** using your current build. Keep the saved ZIP.
2. Open the updated build in your usual browser/profile and exact application address. Other browsers or addresses have separate libraries.
3. On **Enable the updated library format**, download/check your pre-upgrade backup if needed, then acknowledge **I saved a pre-upgrade full backup**. Starting a download does not prove that you saved it.
4. Enable the format. If older tabs block the upgrade, save and close them or cancel. Existing records remain in place; the update changes the protected database header, not their contents.

Older builds cannot open this library afterward. To return to an older build, restore the pre-upgrade backup in a separate compatible browser profile/address. There is no in-place downgrade. This update does not increase the independently verified large-media backup/restore capacity.

The existing native bridge, signed helper, Codex configuration and permissions need no upgrade for these additive browser-side results. Reloading KRAKINAI can end a session; use the usual pairing steps if needed. No permissions are expanded automatically.

## Reviewing a proposal

Open **AI Connections → Incoming Proposals → Review proposal**. **Storage check** appears in the readiness panel, or **Issues & approvals** on smaller screens. For manual JSON imports, it appears inside the scrollable approvals panel above **Approve separately**.

- **Fits current preview** means the current choices fit the checked allowances. Review and final approval are still required; space is not reserved against another tab.
- **Not yet calculable** means inputs/decisions must be resolved and revalidated. It is not a zero-byte estimate or permission to save.
- **Storage limits block this batch** identifies each failed allowance. Open **Usage and limits** for the prospective receipt/history totals, exact stored bytes, expanded evidence, receipt/candidate counts and remaining space.

New Blocking/frame receipts store their complete canonical evidence using lossless compression. Decoding restores the exact original text and verifies its length, framing and SHA-256. Existing receipts are retained unchanged; prompts are never summarized to fit.

| Allowance | Limit |
| --- | ---: |
| Stored import ledger, including candidates | 8 MiB |
| Expanded evidence in one new receipt | 50 MiB |
| Aggregate expanded review evidence | 96 MiB |
| Import receipts | 1,000 |
| Combined reusable-asset and Outfit candidates | 250 |
| Entire full-backup metadata manifest | 20 MiB, unchanged |

All apply independently. An 8 MiB history allowance does not guarantee room in the full-backup manifest, or unlimited imports. A new batch that exceeds a limit is blocked before and at the atomic save boundary. No receipt is discarded automatically and no partial project or take is saved.

Splitting a batch can increase cumulative receipt storage. Ask for a revised package only after identifying the failed allowance. History archiving/retrospective compaction is a separate follow-up; this release has no automatic pruning or retrospective migration.

## Codex and recovery

MCP preview, submission and proposal-status responses include **`batchChecks`**. These safe summaries report batch blockers even when an individual frame prompt derives successfully. They do not expose your history usage, other receipts, private prompts or hidden records. A status snapshot is not a current reservation or proof of a successful save.

After your approval, an authorized confirmed receipt is the proof of the saved result. Exact retry returns that receipt rather than creating duplicate scenes, including after a restart and renewed authorization. Changed content cannot reuse an already-applied change-set ID.

Full-library backups with the new history format declare `compact-import-evidence.v1` so an older reader rejects them before replacement. Updated builds continue reading legacy backups. Corrupt or unsupported receipt evidence blocks restore before replacement; keep the original library and report the error rather than clearing history.

See the [QA evidence](qa/import-history-storage.md) for demonstrated limits, resource observations, failed attempts and supported-browser limitations. Native strict decompression is required for new compact evidence; an unsupported browser fails closed with an update-browser message.
