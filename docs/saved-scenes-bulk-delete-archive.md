# Saved Scenes Bulk Delete and Soft-Archive

## Overview

In the Saved Scenes screen (`/library?mode=scenes`), users can select multiple saved scenes to perform batch actions:
- **Bulk Delete (`Delete Selected`)**: Permanently delete all selected saved scene snapshots from IndexedDB in an atomic transaction, automatically unlinking deleted takes from any referencing Collections/Projects without affecting source library prompts or uploaded media.
- **Bulk Archive (`Archive Selected`)**: Soft-archive all selected active scenes so they are hidden from the default Saved Scenes view without breaking existing project storyboard shot takes.
- **Bulk Unarchive (`Unarchive Selected`)**: Restore archived scenes back to the active view.
- **Saved Scenes Archive Filter**: Filter by `Active scenes` (default), `Archived scenes`, or `All scenes`, automatically pruning selection if hidden scenes are deselected.
- **Per-Card Archive/Unarchive**: Individual scene cards feature an Archive / Unarchive toggle button and an `Archived` status badge.

---

## Architecture & Storage Contract

### 1. Data Model & Immutability
- [`SavedSceneBase`](../src/types/domain.ts) includes an optional `archivedAt?: string` ISO-8601 timestamp.
- When unarchived, `archivedAt` is omitted (`delete scene.archivedAt`) so active scenes retain their exact legacy property shape.
- Scene outputs (`full`, `structured`, `compact`), component slots, ensemble rosters, shot blocking, keyframe plans, and revision trees remain completely immutable.

### 2. Project Shot Take Unlinking
- When scenes are bulk-deleted via `bulkDeleteSavedScenes`, [`removeTakeFromProject`](../src/domain/projectStoryboard.ts) is sequentially applied across each affected collection for all deleted scene IDs.
- If a deleted take was the `selectedSceneId` for a shot, it falls back to an available remaining take or resets to `undefined` with shot status `'planned'`.
- If any selected scene ID does not exist in IndexedDB, the bulk operation throws an error and aborts atomically without deleting any scenes or updating collections.

### 3. Backup Validation
- [`validateBackupZip`](../src/storage/backup.ts) enforces that any `scene.archivedAt` present in backup manifests is a non-empty string ($\le 100$ characters) with a valid parseable date (`Number.isFinite(Date.parse(archivedAt))`).

---

## User Interface & Interactions

### Bulk Actions Toolbar (`SceneBulkActions`)
- Displays `Archive Selected` when any selected scene is active (`!scene.archivedAt`).
- Displays `Unarchive Selected` when any selected scene is archived (`Boolean(scene.archivedAt)`).
- Displays `Delete Selected` (`btn-danger`), which opens a `<StudioDialog title="Delete Selected Scenes?">` modal requiring explicit user confirmation before deletion.

### Saved Scenes Controls (`LibraryScreen`)
- Filter dropdown: `<select aria-label="Filter saved scenes">` with options:
  - `Active scenes` (default: `!scene.archivedAt`)
  - `Archived scenes` (`Boolean(scene.archivedAt)`)
  - `All scenes`
- Switching the archive filter automatically prunes non-matching scene IDs from `selectedSceneIds`.
- Per-card `Archive` / `ArchiveRestore` button in the card actions bar.

---

## Verification Evidence

| Test Suite | Coverage | Status |
|---|---|---:|
| `src/__tests__/projectBulk.test.ts` | Atomic archive/unarchive, bulk delete, multi-take shot unlinking, rollback on missing ID, backup validation | 12/12 PASS |
| `src/__tests__/projectBulkActions.test.tsx` | Toolbar button states, confirmation dialog opening/canceling/confirming, bulk function invocation | 6/6 PASS |
| `src/__tests__/sceneBulkSelection.test.tsx` | Archive filter, active/archived visibility, selection pruning, per-card archive/unarchive | 2/2 PASS |
| `tsc --noEmit` | Full repository TypeScript compilation check | 0 errors (Exit 0) |
