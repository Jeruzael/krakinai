# Saved Scenes Bulk Delete and Archive — Design Spec

**Date:** 2026-11-07  
**Status:** Proposed for User Review

---

## 1. Goal & User Intent

In the **Saved Scenes** screen (`LibraryScreen` with `mode="scenes"`), users can already select multiple scenes to add them to a project, assign shot statuses, or export/copy prompts. However, there is currently no way to **delete** or **archive** multiple selected scenes at once, nor a way to soft-archive saved scenes to declutter the active Saved Scenes view without breaking existing Project/Storyboard shot takes.

### Intended Outcome
1. **Bulk Delete (`Delete Selected`)**: Users can delete all selected saved scenes in one atomic IndexedDB transaction after confirming a destructive action dialog, automatically unlinking deleted takes from any collections/projects while keeping source library assets and media intact.
2. **Soft-Archive & Unarchive (`Archive Selected` / `Unarchive Selected`)**: Users can archive or unarchive saved scenes both from the multi-select bulk toolbar and from individual scene cards.
3. **Saved Scenes Archive Filter**: Saved Scenes defaults to showing **Active scenes** (`!scene.archivedAt`), with an archive status filter (`Active scenes`, `Archived scenes`, `All scenes`) so users can view, unarchive, or permanently delete archived scenes at any time.
4. **Project Integrity & Scene Immutability**: Archiving a scene only sets `archivedAt?: string` (and `updatedAt`) on the `SavedScene` record. It never mutates frozen prompt outputs, component snapshots, blocking, ensemble, keyframe plans, or revision history, and existing Project/Storyboard shot links remain intact.

---

## 2. Approaches Considered

### Approach A: Optional `archivedAt?: string` on `SavedScene` + Atomic Bulk Storage Helpers (Recommended)
- **How it works:**
  - Add an optional `archivedAt?: string` ISO-8601 timestamp to `SavedSceneBase` in `src/types/domain.ts`. When unarchived, the property is omitted (`undefined`) so active scenes retain their exact legacy record shape.
  - Add `bulkDeleteSavedScenes` and `bulkSetScenesArchived` to `src/storage/projectBulk.ts` using atomic IndexedDB transactions.
  - Extend `SceneBulkActions` with `Archive Selected`, `Unarchive Selected`, and `Delete Selected` (guarded by `StudioDialog` confirmation).
  - Add an archive filter (`Active scenes` / `Archived scenes` / `All scenes`), an `Archived` badge, and a per-card Archive/Unarchive toggle button in `LibraryScreen.tsx`.
- **Pros:** Zero schema migration required; backward-compatible with v1 and v2 backups; preserves project take references and scene immutability; follows existing `ProjectBulkActions` and `projectBulk.ts` patterns.
- **Cons:** Requires validating optional `archivedAt` in `validateBackupZip`.

### Approach B: Separate `archived_scenes` Object Store in IndexedDB
- **How it works:** Move archived scenes out of the `scenes` store into a new IndexedDB store.
- **Pros:** Physical separation of active and archived records.
- **Cons:** Requires an IndexedDB version upgrade, breaks existing Project shot take lookups (`shot.takeSceneIds`), and complicates backup/restore and revision graph validation. Rejected (violates YAGNI and storage compatibility constraints).

### Approach C: Store Archive IDs in `Preferences`
- **How it works:** Keep an array of archived scene IDs inside `app_preferences`.
- **Pros:** Does not touch `SavedScene` records.
- **Cons:** Desynchronizes scene state from scene records, requires pruning `Preferences` on scene deletion, and does not scale cleanly. Rejected.

---

## 3. Architecture & Component Design

### 3.1 Data Model & Backup Validation
- **`src/types/domain.ts` (`SavedSceneBase`)**:
  - Add `archivedAt?: string;`.
- **`src/storage/backup.ts` (`validateBackupZip`)**:
  - Validate that if `scene.archivedAt !== undefined`, it is a non-empty string of at most 100 characters that parses to a finite timestamp (`Number.isFinite(Date.parse(scene.archivedAt))`), returning `{ valid: false, error: 'Invalid scene archivedAt.' }` otherwise.

### 3.2 Atomic Storage Operations (`src/storage/projectBulk.ts`)
- **`bulkDeleteSavedScenes({ sceneIds }: { sceneIds: string[] }): Promise<void>`**:
  - Validates `sceneIds` is a non-empty list of valid scene ID strings (deduplicated).
  - Runs a single `readwrite` transaction across `['scenes', 'collections']`.
  - Verifies every ID exists in `scenes`; if any is missing, throws `'One or more selected saved scenes no longer exist. Refresh the library.'` and aborts without deleting anything.
  - Deletes each selected scene from `scenes`.
  - Computes `remainingScenes` and updates any `Collection` whose `members` or `project.shots` reference any deleted scene ID via `removeTakeFromProject`, validating each updated collection with `validateProject` before writing.
- **`bulkSetScenesArchived({ sceneIds, archived }: { sceneIds: string[]; archived: boolean }): Promise<SavedScene[]>`**:
  - Validates `sceneIds` via `selected(sceneIds, 'scene')` and `typeof archived === 'boolean'`.
  - Runs a single `readwrite` transaction on `['scenes']`.
  - Verifies every ID exists in `scenes`; if any is missing, throws `'One or more selected saved scenes no longer exist. Refresh the library.'`.
  - When `archived === true`: sets `archivedAt: scene.archivedAt ?? now` and `updatedAt: now`.
  - When `archived === false`: omits `archivedAt` (`delete next.archivedAt`) and updates `updatedAt: now`.
  - Returns the updated `SavedScene[]` records. Does not modify collections or project shots.

### 3.3 Multi-Select Bulk Action Bar (`src/components/SceneBulkActions.tsx`)
- Inspects the selected scenes from `snapshot.scenes`:
  - Renders **`Archive Selected`** when at least one selected scene is active (`!scene.archivedAt`). Clicking invokes `bulkSetScenesArchived({ sceneIds, archived: true })`, refreshes the snapshot, clears selection, and shows toast `'Selected scenes archived.'`.
  - Renders **`Unarchive Selected`** when at least one selected scene is archived (`Boolean(scene.archivedAt)`). Clicking invokes `bulkSetScenesArchived({ sceneIds, archived: false })`, refreshes the snapshot, clears selection, and shows toast `'Selected scenes unarchived.'`.
  - Renders **`Delete Selected`** (`btn btn-danger btn-sm`). Clicking opens a `<StudioDialog title="Delete Selected Scenes?">` confirmation modal explaining how many scenes will be deleted, that linked project shot takes will be removed, and that source library prompts and media remain intact.
  - Confirming in the modal invokes `bulkDeleteSavedScenes({ sceneIds })`, refreshes the snapshot, clears selection, closes the modal, and shows toast `'Selected scenes deleted.'`.

### 3.4 Saved Scenes Filter & Card Actions (`src/screens/LibraryScreen.tsx`)
- **Archive Filter (`scenesArchiveFilter: 'active' | 'archived' | 'all'`)**:
  - Defaults to `'active'`.
  - Adds a `<select id="scenes-archive-filter" aria-label="Filter saved scenes">` in the Saved Scenes filter bar with options:
    - `active`: `Active scenes`
    - `archived`: `Archived scenes`
    - `all`: `All scenes`
  - `filteredScenes` filters by `scenesArchiveFilter` before applying search tokens and sort order.
  - Switching `scenesArchiveFilter` prunes any selected scene IDs that are no longer in the visible filter set so hidden scenes cannot be accidentally acted upon.
- **Scene Card Badge & Action Button**:
  - Displays `<span className="badge">Archived</span>` on archived scene cards.
  - Adds an Archive/Unarchive button on each scene card (`aria-label="Archive saved scene <title>"` or `"Unarchive saved scene <title>"`) that calls `bulkSetScenesArchived({ sceneIds: [scene.id], archived: !scene.archivedAt })` and refreshes the snapshot.

---

## 4. Error Handling & Edge Cases
1. **Stale Selection / Missing Scene ID**: If any selected scene ID was already deleted in another tab or view, both `bulkDeleteSavedScenes` and `bulkSetScenesArchived` reject atomically and surface the error message in `SceneBulkActions`'s `<p role="alert" className="project-bulk-error">`.
2. **Double-Click / Concurrent Execution**: `SceneBulkActions` guards all actions with `busyRef` and `busy` state, disabling buttons and modal controls while an operation is in flight.
3. **Project Shot Take Unlinking on Bulk Delete**: If multiple takes of the same shot (or across multiple shots/projects) are deleted in a single batch, `removeTakeFromProject` is applied sequentially per deleted scene ID against the updated collection state so all deleted takes are cleanly removed, `selectedSceneId` falls back to any remaining available take (or `undefined`), and shot status resets to `'planned'` when no takes remain.
4. **Hidden Selection Safety**: Changing the archive filter (`Active` / `Archived` / `All`) removes non-matching IDs from `selectedSceneIds` so bulk actions only affect scenes matching the current view.

---

## 5. Testing Strategy
1. **Storage Unit Tests (`src/__tests__/projectBulk.test.ts`)**:
   - `bulkDeleteSavedScenes` deletes multiple scenes atomically, removes take references from collections/projects, and aborts if any scene ID is missing.
   - `bulkSetScenesArchived` archives and unarchives multiple scenes atomically, preserves all immutable prompt/slot fields and project links, omits `archivedAt` when unarchived, and aborts if any scene ID is missing.
   - Backup validation (`src/__tests__/projectBackup.test.ts` or `src/__tests__/projectBulk.test.ts`) accepts valid `archivedAt` timestamps and rejects malformed `archivedAt` values.
2. **Component Tests (`src/__tests__/projectBulkActions.test.tsx`)**:
   - `SceneBulkActions` renders `Archive Selected`, `Unarchive Selected`, and `Delete Selected` appropriately, opens the confirmation dialog before deleting, and executes the bulk storage functions.
3. **Screen Integration Tests (`src/__tests__/sceneBulkSelection.test.tsx`)**:
   - `LibraryScreen` filters scenes by `Active scenes` (default), `Archived scenes`, and `All scenes`, supports per-card archive/unarchive, and prunes selection when switching archive filter.
