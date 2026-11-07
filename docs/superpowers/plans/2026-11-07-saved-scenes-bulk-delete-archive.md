# Saved Scenes Bulk Delete and Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to bulk-delete or soft-archive/unarchive multiple selected saved scenes (as well as archive/unarchive individual scene cards and filter Saved Scenes by Active, Archived, or All) while preserving scene immutability and project shot integrity.

**Architecture:** Add an optional `archivedAt?: string` ISO timestamp to `SavedSceneBase` (omitted when unarchived so legacy records remain unchanged) and validate it in backup manifests. Implement atomic `bulkDeleteSavedScenes` and `bulkSetScenesArchived` transactions in `src/storage/projectBulk.ts`, wire `Archive Selected`, `Unarchive Selected`, and a confirmation-guarded `Delete Selected` action into `SceneBulkActions`, and add an archive filter (`Active scenes` / `Archived scenes` / `All scenes`) plus per-card Archive/Unarchive controls to `LibraryScreen`.

**Tech Stack:** React 18, TypeScript, IndexedDB (`fake-indexeddb` in tests), Vitest, React Testing Library, Lucide React icons.

**Spec:** [`docs/superpowers/specs/2026-11-07-saved-scenes-bulk-delete-archive-design.md`](../specs/2026-11-07-saved-scenes-bulk-delete-archive-design.md)

## Global Constraints

- Preserve storage/backup limits, scene immutability (`outputs`, `slots`, `ensemble`, `blocking`, `keyframePlan`, `imagePromptSnapshots`, `revision`, `sceneRevision`), and existing contract compatibility.
- When a scene is unarchived, omit `archivedAt` (`delete next.archivedAt`) so unarchived `SavedScene` records retain their exact legacy property shape.
- Archiving or unarchiving scenes must keep existing Project/Storyboard shot links (`shot.takeSceneIds`, `shot.selectedSceneId`, `collection.members`) intact.
- Bulk deletion must atomically delete all selected scenes and unlink their takes from any referencing collections/projects via `removeTakeFromProject`, or abort the entire transaction if any selected scene ID does not exist.
- Bulk deletion in the UI must require explicit confirmation in a `StudioDialog` before executing.

## Review Focus

- **Multiple takes of the same project shot deleted in one batch**: `bulkDeleteSavedScenes` must apply `removeTakeFromProject` sequentially across all deleted IDs for each affected collection so that every deleted take is removed from the shot rather than overwriting earlier removals.
- **Missing or stale scene ID in a batch**: If any ID in `sceneIds` is missing from IndexedDB, `bulkDeleteSavedScenes` and `bulkSetScenesArchived` must reject and leave all `scenes` and `collections` completely unchanged.
- **Unarchiving restores exact legacy shape**: Calling `bulkSetScenesArchived({ sceneIds, archived: false })` must remove the `archivedAt` key (`'archivedAt' in scene === false`), not set `archivedAt: undefined` or `""`.
- **Malformed `archivedAt` in backup archive**: `validateBackupZip` must reject backups where `scene.archivedAt` is non-string, blank, >100 chars, or not a valid parseable date string.
- **Archive filter selection pruning**: Switching the Saved Scenes filter between `Active scenes` and `Archived scenes` must prune hidden scene IDs from `selectedSceneIds` so hidden scenes cannot be unintentionally deleted or modified.

---

### Task 1: Domain Type, Backup Validation, and Atomic Bulk Storage Operations

**Files:**
- Modify: `src/types/domain.ts:262-300`
- Modify: `src/storage/backup.ts:280-290`
- Modify: `src/storage/projectBulk.ts:1-81`
- Test: `src/__tests__/projectBulk.test.ts`

**Interfaces:**
- Consumes:
  - `removeTakeFromProject(collection: Collection, sceneId: string, scenes: SavedScene[]): Collection` from `src/domain/projectStoryboard.ts`
  - `validateProject(collection: Collection, scenes: SavedScene[]): string | null` from `src/domain/phase5ProjectValidation.ts`
- Produces:
  - `SavedSceneBase.archivedAt?: string` in `src/types/domain.ts`
  - `bulkDeleteSavedScenes({ sceneIds }: { sceneIds: string[] }): Promise<void>` in `src/storage/projectBulk.ts`
  - `bulkSetScenesArchived({ sceneIds, archived }: { sceneIds: string[]; archived: boolean }): Promise<SavedScene[]>` in `src/storage/projectBulk.ts`

- [ ] **Step 1: Write the failing storage and backup validation tests in `src/__tests__/projectBulk.test.ts`**

Add tests to `src/__tests__/projectBulk.test.ts` covering:
1. `bulkSetScenesArchived` sets `archivedAt` ISO timestamp on multiple scenes while keeping immutable fields and project shot links intact, and removes the `archivedAt` key when `archived: false`.
2. `bulkSetScenesArchived` aborts atomically when any selected scene ID is missing.
3. `bulkDeleteSavedScenes` deletes multiple scenes (including two takes belonging to the same project shot), updates the project's shots and members via `removeTakeFromProject`, and aborts atomically if any selected scene ID is missing.
4. `validateBackupZip` accepts a backup containing a valid `archivedAt` ISO string and rejects a backup with an invalid `archivedAt` value (`"not-a-date"`).

```ts
it('archives and unarchives selected scenes atomically while preserving project shot takes and immutable fields', async () => {
  const one = scene('one'), two = scene('two');
  await putScenes(one, two);
  const c = await createCollection({ name: 'Film' });
  await bulkAddScenesToCollection({ collectionId: c.id, sceneIds: [one.id, two.id] });

  const archived = await bulkSetScenesArchived({ sceneIds: [one.id, two.id], archived: true });
  expect(archived.every(s => typeof s.archivedAt === 'string' && Number.isFinite(Date.parse(s.archivedAt!)))).toBe(true);
  const snapAfterArchive = await getAllSnapshot();
  expect(snapAfterArchive.collections[0].project!.shots.map(s => s.selectedSceneId)).toEqual([one.id, two.id]);

  await expect(bulkSetScenesArchived({ sceneIds: [one.id, 'missing'], archived: false })).rejects.toThrow(/saved scenes/i);
  expect((await getAllSnapshot()).scenes.every(s => Boolean(s.archivedAt))).toBe(true);

  const unarchived = await bulkSetScenesArchived({ sceneIds: [one.id], archived: false });
  expect('archivedAt' in unarchived[0]).toBe(false);
  expect((await getAllSnapshot()).scenes.find(s => s.id === two.id)?.archivedAt).toBeDefined();
});

it('deletes multiple selected scenes atomically, unlinks multiple takes from the same shot, and aborts on missing scene', async () => {
  const one = scene('one'), two = scene('two'), three = scene('three');
  await putScenes(one, two, three);
  const c = await createCollection({ name: 'Film' });
  await addProjectShot({ collectionId: c.id, title: 'Shot 1', sceneId: one.id });
  const db = await openDatabase();
  const tx = db.transaction('collections', 'readwrite');
  const current = (await getAllSnapshot()).collections[0];
  const shot = current.project!.shots[0];
  tx.objectStore('collections').put({
    ...current,
    project: { ...current.project!, shots: [{ ...shot, takeSceneIds: [one.id, two.id], selectedSceneId: one.id }] },
    members: [{ type: 'scene', id: one.id, addedAt: '' }, { type: 'scene', id: two.id, addedAt: '' }],
  });
  await new Promise<void>(r => tx.oncomplete = () => r());

  await expect(bulkDeleteSavedScenes({ sceneIds: [one.id, 'missing'] })).rejects.toThrow(/saved scenes/i);
  expect((await getAllSnapshot()).scenes).toHaveLength(3);

  await bulkDeleteSavedScenes({ sceneIds: [one.id, two.id] });
  const after = await getAllSnapshot();
  expect(after.scenes.map(s => s.id)).toEqual([three.id]);
  expect(after.collections[0].project!.shots[0].takeSceneIds).toEqual([]);
  expect(after.collections[0].project!.shots[0].selectedSceneId).toBeUndefined();
  expect(after.collections[0].project!.shots[0].status).toBe('planned');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/projectBulk.test.ts`
Expected: FAIL with `bulkSetScenesArchived is not a function` / `bulkDeleteSavedScenes is not a function`.

- [ ] **Step 3: Implement `archivedAt` on `SavedSceneBase`, backup check in `src/storage/backup.ts`, and `bulkDeleteSavedScenes` + `bulkSetScenesArchived` in `src/storage/projectBulk.ts`**

1. In `src/types/domain.ts`, add `archivedAt?: string;` to `SavedSceneBase`.
2. In `src/storage/backup.ts` (inside `for (const scene of manifest.scenes)`), add:
   ```ts
   if (scene.archivedAt !== undefined && (typeof scene.archivedAt !== 'string' || !scene.archivedAt.trim() || scene.archivedAt.length > 100 || !Number.isFinite(Date.parse(scene.archivedAt)))) return { valid: false, error: 'Invalid scene archivedAt.' };
   ```
3. In `src/storage/projectBulk.ts`:
   - Import `removeTakeFromProject` from `../domain/projectStoryboard`.
   - Implement `bulkSetScenesArchived({ sceneIds, archived }: { sceneIds: string[]; archived: boolean }): Promise<SavedScene[]>`.
   - Implement `bulkDeleteSavedScenes({ sceneIds }: { sceneIds: string[] }): Promise<void>`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/projectBulk.test.ts`
Expected: PASS (all tests in `projectBulk.test.ts` green).

---

### Task 2: Bulk Action Toolbar (`SceneBulkActions.tsx`)

**Files:**
- Modify: `src/components/SceneBulkActions.tsx`
- Test: `src/__tests__/projectBulkActions.test.tsx`

**Interfaces:**
- Consumes:
  - `bulkDeleteSavedScenes`, `bulkSetScenesArchived` from `src/storage/projectBulk.ts`
  - `StudioDialog` from `src/components/StudioDialog.tsx`
- Produces:
  - `Archive Selected`, `Unarchive Selected`, and `Delete Selected` (with `StudioDialog` confirmation modal `"Delete Selected Scenes?"` and confirm button `"Confirm Delete Selected Scenes"`) in `SceneBulkActions`.

- [ ] **Step 1: Write the failing component tests in `src/__tests__/projectBulkActions.test.tsx`**

Add tests in `src/__tests__/projectBulkActions.test.tsx` verifying:
1. When active scenes are selected, `Archive Selected` and `Delete Selected` buttons appear; clicking `Delete Selected` opens the `Delete Selected Scenes?` dialog and canceling closes it without deleting.
2. Confirming `Confirm Delete Selected Scenes` calls `bulkDeleteSavedScenes({ sceneIds: ['s'] })` and `onClear`.
3. Clicking `Archive Selected` calls `bulkSetScenesArchived({ sceneIds: ['s'], archived: true })`; when an archived scene is selected, `Unarchive Selected` appears and calls `bulkSetScenesArchived({ sceneIds: ['s'], archived: false })`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/projectBulkActions.test.tsx`
Expected: FAIL because `Archive Selected` / `Delete Selected` buttons are not yet rendered in `SceneBulkActions`.

- [ ] **Step 3: Implement Archive, Unarchive, and Delete Selected with confirmation modal in `src/components/SceneBulkActions.tsx`**

In `src/components/SceneBulkActions.tsx`:
- Import `bulkDeleteSavedScenes` and `bulkSetScenesArchived` from `../storage/projectBulk`, and `StudioDialog` from `./StudioDialog`.
- Add `const [confirmDelete, setConfirmDelete] = useState(false);` and reset `setConfirmDelete(false)` on successful `run(...)`.
- Compute `selectedRecords` from `snapshot?.scenes` matching `selectedSceneIds`:
  - `hasActive = selectedRecords.some(s => !s.archivedAt)`
  - `hasArchived = selectedRecords.some(s => Boolean(s.archivedAt))`
- In the action row alongside `Export Prompts .txt` and `Copy Prompts`:
  - Render `Archive Selected` button when `hasActive` is true, calling `run(() => bulkSetScenesArchived({ sceneIds: scenes().map(s => s.id), archived: true }), 'Selected scenes archived.')`.
  - Render `Unarchive Selected` button when `hasArchived` is true, calling `run(() => bulkSetScenesArchived({ sceneIds: scenes().map(s => s.id), archived: false }), 'Selected scenes unarchived.')`.
  - Render `Delete Selected` button (`className="btn btn-danger btn-sm"`), opening `setConfirmDelete(true)`.
- When `confirmDelete` is true, render `<StudioDialog title="Delete Selected Scenes?" ...>` with `Cancel` and `Confirm Delete Selected Scenes` buttons.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/projectBulkActions.test.tsx`
Expected: PASS.

---

### Task 3: Saved Scenes Archive Filter & Per-Card Archive/Unarchive (`LibraryScreen.tsx`)

**Files:**
- Modify: `src/screens/LibraryScreen.tsx`
- Test: `src/__tests__/sceneBulkSelection.test.tsx`

**Interfaces:**
- Consumes:
  - `bulkSetScenesArchived` from `src/storage/projectBulk.ts`
  - `SavedScene.archivedAt` from `src/types/domain.ts`
- Produces:
  - Archive status filter `<select id="scenes-archive-filter" aria-label="Filter saved scenes">` with values `'active'` (default, `"Active scenes"`), `'archived'` (`"Archived scenes"`), and `'all'` (`"All scenes"`).
  - `<span className="badge">Archived</span>` on archived scene cards.
  - Per-card Archive/Unarchive button with `aria-label="Archive saved scene ${scene.title}"` / `"Unarchive saved scene ${scene.title}"`.

- [ ] **Step 1: Write the failing screen tests in `src/__tests__/sceneBulkSelection.test.tsx`**

Add tests in `src/__tests__/sceneBulkSelection.test.tsx` verifying:
1. Default view (`Active scenes`) hides scenes with `archivedAt` set and shows only active scenes.
2. Switching `Filter saved scenes` to `Archived scenes` shows only archived scenes (with an `Archived` badge) and prunes any selected active scene IDs from `selectedSceneIds`.
3. Switching `Filter saved scenes` to `All scenes` shows both active and archived scenes.
4. Clicking a card's `Archive saved scene <title>` or `Unarchive saved scene <title>` button invokes `bulkSetScenesArchived` and refreshes the snapshot.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/sceneBulkSelection.test.tsx`
Expected: FAIL because `Filter saved scenes` select and per-card archive buttons do not exist yet.

- [ ] **Step 3: Implement the archive filter, selection pruning, badge, and per-card Archive/Unarchive button in `src/screens/LibraryScreen.tsx`**

1. In `src/screens/LibraryScreen.tsx`:
   - Import `Archive, ArchiveRestore` from `lucide-react` and `bulkSetScenesArchived` from `../storage/projectBulk`.
   - Add state `const [scenesArchiveFilter, setScenesArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');`.
   - Update `filteredScenes` `useMemo` to filter by `scenesArchiveFilter`:
     - `'active'`: `!s.archivedAt`
     - `'archived'`: `Boolean(s.archivedAt)`
     - `'all'`: `true`
   - Prune `selectedSceneIds` when `snapshot?.scenes` or `scenesArchiveFilter` changes so deleted or archive-filtered scenes are deselected:
     ```ts
     useEffect(() => {
       setSelectedSceneIds((previous) => {
         const allowedIds = new Set(
           (snapshot?.scenes ?? [])
             .filter((scene) =>
               scenesArchiveFilter === 'active'
                 ? !scene.archivedAt
                 : scenesArchiveFilter === 'archived'
                   ? Boolean(scene.archivedAt)
                   : true
             )
             .map((scene) => scene.id)
         );
         const next = [...previous].filter((id) => allowedIds.has(id));
         return next.length === previous.size ? previous : new Set(next);
       });
     }, [snapshot?.scenes, scenesArchiveFilter]);
     ```
   - Add `<select id="scenes-archive-filter" aria-label="Filter saved scenes" className="select" value={scenesArchiveFilter} onChange={(e) => setScenesArchiveFilter(e.target.value as 'active' | 'archived' | 'all')}>` with options `Active scenes` (`active`), `Archived scenes` (`archived`), and `All scenes` (`all`).
   - On each scene card in `mode === 'scenes'`:
     - Show `<span className="badge">Archived</span>` when `scene.archivedAt` is truthy.
     - Add an Archive/Unarchive button (`aria-label={scene.archivedAt ? `Unarchive saved scene ${scene.title}` : `Archive saved scene ${scene.title}`}`) calling `bulkSetScenesArchived({ sceneIds: [scene.id], archived: !scene.archivedAt })`, `refreshSnapshot()`, and `showToast(...)`.

- [ ] **Step 4: Run tests to verify all unit and integration suites pass**

Run: `npx vitest run src/__tests__/sceneBulkSelection.test.tsx src/__tests__/projectBulkActions.test.tsx src/__tests__/projectBulk.test.ts`
Expected: PASS (all test files green).
