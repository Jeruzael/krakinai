import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  FolderPlus,
  HardDrive,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import {
  addMemberToCollection,
  createCollection,
  removeMemberFromCollection,
} from '../storage/db';
import {
  exportFullBackupZip,
  restoreFullBackupZip,
  validateBackupZip,
  type BackupValidationSummary,
} from '../storage/backup';
import { downloadBlobAsFile } from '../hooks/useObjectUrl';
import {
  CATEGORY_LABELS,
  MAX_TOTAL_MEDIA_BYTES,
  SLOT_LABELS,
  SLOT_TO_CATEGORY,
} from '../domain/validation';
import type {
  BuilderSlot,
  MediaAsset,
  PromptAsset,
  Variant,
} from '../types/domain';
import { MediaThumbnail } from './MediaThumbnail';
import { StudioDialog } from './StudioDialog';

export const ConfirmModal: React.FC = () => {
  const { confirmDialog, closeConfirmDialog } = useLibrary();
  if (!confirmDialog) return null;

  return (
    <StudioDialog
      title={confirmDialog.title}
      onClose={closeConfirmDialog}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={closeConfirmDialog}
          >
            {confirmDialog.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            className={`btn ${
              confirmDialog.danger ? 'btn-danger' : 'btn-primary'
            }`}
            onClick={() => confirmDialog.onConfirm()}
          >
            {confirmDialog.confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 15 }}>{confirmDialog.message}</p>
    </StudioDialog>
  );
};

export const ClipboardFallbackModal: React.FC = () => {
  const { clipboardFallback, closeClipboardFallback } = useLibrary();
  if (!clipboardFallback) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clipboard-fallback-title"
    >
      <div className="modal-panel" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <h2 id="clipboard-fallback-title" className="section-title">
            Manual Copy Required
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={closeClipboardFallback}
            aria-label="Close manual copy dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="banner banner-warning" style={{ marginBottom: 12 }}>
            <span>
              Clipboard access was blocked. Select and copy the text below
              manually (Ctrl+C or Cmd+C).
            </span>
          </div>
          <label htmlFor="fallback-copy-textarea" className="form-label">
            Selectable Prompt Text
          </label>
          <textarea
            id="fallback-copy-textarea"
            className="textarea"
            readOnly
            value={clipboardFallback.text}
            rows={8}
            onFocus={(e) => e.currentTarget.select()}
            style={{ marginTop: 8 }}
          />
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-primary"
            onClick={closeClipboardFallback}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export const CollectionMembershipModal: React.FC = () => {
  const {
    snapshot,
    collectionModalTarget,
    closeCollectionModal,
    refreshSnapshot,
    showToast,
  } = useLibrary();
  const [search, setSearch] = useState('');
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!collectionModalTarget || !snapshot) return null;

  const filtered = snapshot.collections.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleMembership = async (colId: string, isMember: boolean) => {
    try {
      if (isMember) {
        await removeMemberFromCollection({
          collectionId: colId,
          memberType: collectionModalTarget.type,
          memberId: collectionModalTarget.id,
        });
        showToast('Removed from collection.', 'info');
      } else {
        await addMemberToCollection({
          collectionId: colId,
          memberType: collectionModalTarget.type,
          memberId: collectionModalTarget.id,
        });
        showToast('Added to collection.', 'success');
      }
      await refreshSnapshot();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to update collection.',
        'error'
      );
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const created = await createCollection({
        name: newColName,
        description: newColDesc,
      });
      await addMemberToCollection({
        collectionId: created.id,
        memberType: collectionModalTarget.type,
        memberId: collectionModalTarget.id,
      });
      setNewColName('');
      setNewColDesc('');
      await refreshSnapshot();
      showToast(
        `Created collection "${created.name}" and added item.`,
        'success'
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create collection.'
      );
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="col-modal-title"
    >
      <div className="modal-panel" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <h2 id="col-modal-title" className="section-title">
            Add “{collectionModalTarget.title}” to Collection
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={closeCollectionModal}
            aria-label="Close collection dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p className="muted-text" style={{ marginTop: 0 }}>
            Collections store references, not duplicate copies. Removing an item
            from a collection keeps the underlying record in your library.
          </p>

          <div className="form-group">
            <label htmlFor="col-search-input" className="form-label">
              Filter Collections
            </label>
            <input
              id="col-search-input"
              className="input"
              placeholder="Search collections..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxHeight: 220,
              overflowY: 'auto',
              marginBottom: 20,
            }}
          >
            {filtered.length === 0 ? (
              <p className="muted-text">No matching collections yet.</p>
            ) : (
              filtered.map((col) => {
                const isMember = col.members.some(
                  (m) =>
                    m.type === collectionModalTarget.type &&
                    m.id === collectionModalTarget.id
                );
                return (
                  <label
                    key={col.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid var(--border-subtle)',
                      background: isMember ? 'var(--primary-tint)' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{col.name}</div>
                      <div className="muted-text" style={{ fontSize: 12 }}>
                        {col.members.length} items
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isMember}
                      onChange={() => handleToggleMembership(col.id, isMember)}
                      style={{ width: 18, height: 18 }}
                    />
                  </label>
                );
              })
            )}
          </div>

          <form
            onSubmit={handleCreateCollection}
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 16,
            }}
          >
            <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>
              Create New Collection
            </h3>
            {error && <div className="form-error">{error}</div>}
            <div className="form-group">
              <label htmlFor="new-col-name" className="form-label">
                Collection Name *
              </label>
              <input
                id="new-col-name"
                className="input"
                placeholder="e.g., Episode 1 Shots"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-col-desc" className="form-label">
                Description (Optional)
              </label>
              <input
                id="new-col-desc"
                className="input"
                placeholder="Notes about this collection/project"
                value={newColDesc}
                onChange={(e) => setNewColDesc(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-secondary">
              <FolderPlus size={16} /> Create & Add Item
            </button>
          </form>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-primary"
            onClick={closeCollectionModal}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export const SettingsBackupModal: React.FC = () => {
  const {
    snapshot,
    isSettingsOpen,
    setIsSettingsOpen,
    refreshSnapshot,
    loadStarterData,
    showToast,
  } = useLibrary();

  const [exporting, setExporting] = useState(false);
  const [restoreSummary, setRestoreSummary] =
    useState<BackupValidationSummary | null>(null);
  const [pendingZipBytes, setPendingZipBytes] = useState<Uint8Array | null>(
    null
  );
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  if (!isSettingsOpen || !snapshot) return null;

  const totalMediaBytes = snapshot.media.reduce(
    (sum, m) => sum + m.byteSize + (m.posterBlob?.size ?? 0),
    0
  );
  const mediaMiB = (totalMediaBytes / (1024 * 1024)).toFixed(2);
  const maxMiB = (MAX_TOTAL_MEDIA_BYTES / (1024 * 1024)).toFixed(0);

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const zipBytes = await exportFullBackupZip();
      const blob = new Blob([zipBytes as unknown as BlobPart], {
        type: 'application/zip',
      });
      const datePart = new Date().toISOString().slice(0, 10);
      downloadBlobAsFile(blob, `krakinai-backup-${datePart}.zip`);
      showToast('Full ZIP backup exported (metadata + media).', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to export backup.',
        'error'
      );
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    setRestoreSummary(null);
    setPendingZipBytes(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);
      const res = await validateBackupZip(bytes);
      if (!res.valid || !res.summary) {
        setRestoreError(res.error || 'Backup validation failed.');
        return;
      }
      setRestoreSummary(res.summary);
      setPendingZipBytes(bytes);
    } catch (err) {
      setRestoreError(
        err instanceof Error ? err.message : 'Could not read ZIP file.'
      );
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingZipBytes) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      await restoreFullBackupZip(pendingZipBytes);
      await refreshSnapshot();
      setPendingZipBytes(null);
      setRestoreSummary(null);
      showToast('Library restored from full ZIP backup.', 'success');
      setIsSettingsOpen(false);
    } catch (err) {
      setRestoreError(
        err instanceof Error
          ? err.message
          : 'Restore failed. Existing library was preserved.'
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="modal-panel" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h2 id="settings-modal-title" className="section-title">
            Settings & Local Data Backup
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setIsSettingsOpen(false)}
            aria-label="Close Settings"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="banner banner-info">
            <div>
              <strong>Stored on this browser. Not synced.</strong>
              <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                Local browser storage (IndexedDB) is not cloud sync or an
                automatic backup. Another browser, profile, private window, or
                app URL will have a separate library. Export a full ZIP backup
                before clearing browser data or moving devices.
              </p>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>
              <HardDrive size={16} style={{ verticalAlign: 'middle' }} /> Local
              Storage Summary
            </h3>
            <p className="muted-text" style={{ margin: '0 0 8px' }}>
              Media usage: <strong>{mediaMiB} MiB</strong> of {maxMiB} MiB
              prototype limit (250 MiB max uncompressed backup).
            </p>
            <div className="tag-list">
              <span className="badge">{snapshot.assets.length} Prompts</span>
              <span className="badge">{snapshot.variants.length} Variants</span>
              <span className="badge">
                {snapshot.scenes.length} Saved Scenes
              </span>
              <span className="badge">
                {snapshot.collections.length} Collections
              </span>
              <span className="badge">{snapshot.media.length} Media Files</span>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>
              Export Full Backup (ZIP)
            </h3>
            <p className="muted-text" style={{ margin: '0 0 12px' }}>
              This backup includes your versioned JSON manifest and all original
              stored media files. (Metadata-only JSON is never described as a
              full backup.)
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportBackup}
              disabled={exporting}
            >
              <Download size={16} />{' '}
              {exporting ? 'Exporting ZIP...' : 'Export Full Backup (.zip)'}
            </button>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>
              Restore Full Backup (Transactional Replacement)
            </h3>
            <p className="muted-text" style={{ margin: '0 0 12px' }}>
              Restoring validates the archive first, then atomically replaces
              the current library in this browser. If validation or write fails,
              your existing data is preserved.
            </p>

            <label
              htmlFor="restore-zip-input"
              className="btn btn-secondary"
              style={{ cursor: 'pointer' }}
            >
              <Upload size={16} /> Select Backup .zip File
            </label>
            <input
              id="restore-zip-input"
              type="file"
              accept=".zip,application/zip"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {restoreError && (
              <div
                className="banner banner-error"
                style={{ marginTop: 12, marginBottom: 0 }}
              >
                <AlertTriangle size={18} />
                <span>{restoreError}</span>
              </div>
            )}

            {restoreSummary && (
              <div
                className="banner banner-warning"
                style={{
                  marginTop: 14,
                  marginBottom: 0,
                  flexDirection: 'column',
                }}
              >
                <div>
                  <strong>
                    Replace the library stored in this browser with this backup?
                  </strong>
                  <p style={{ margin: '6px 0', fontSize: 13 }}>
                    Validated archive from{' '}
                    {new Date(restoreSummary.exportedAt).toLocaleString()}:{' '}
                    {restoreSummary.assetsCount} prompts,{' '}
                    {restoreSummary.variantsCount} variants,{' '}
                    {restoreSummary.scenesCount} saved scenes,{' '}
                    {restoreSummary.collectionsCount} collections, and{' '}
                    {restoreSummary.mediaCount} media files.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleConfirmRestore}
                    disabled={restoring}
                  >
                    <CheckCircle2 size={16} />{' '}
                    {restoring
                      ? 'Replacing Library...'
                      : 'Confirm & Replace Current Library'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setRestoreSummary(null);
                      setPendingZipBytes(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>
              Starter Demo Content
            </h3>
            <p className="muted-text" style={{ margin: '0 0 12px' }}>
              Load or re-seed the 21 illustrative starter prompts, 6 Maya
              variants, 3 collections, and 4 starter templates.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadStarterData(true)}
            >
              <Archive size={16} /> Load / Reset Starter Library Items
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsSettingsOpen(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface AssetPickerModalProps {
  slot: BuilderSlot;
  activeCharacterId?: string;
  mediaMap: Map<string, MediaAsset>;
  onSelectAsset: (asset: PromptAsset) => void;
  onSelectVariant: (variant: Variant) => void;
  onClose: () => void;
}

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  slot,
  activeCharacterId,
  mediaMap,
  onSelectAsset,
  onSelectVariant,
  onClose,
}) => {
  const { snapshot } = useLibrary();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'assets' | 'variants'>('assets');

  const targetCategory = SLOT_TO_CATEGORY[slot];

  const matchingAssets = useMemo(() => {
    if (!snapshot) return [];
    const q = query.trim().toLowerCase();
    return snapshot.assets.filter((a) => {
      if (a.category !== targetCategory) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.promptText.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [snapshot, targetCategory, query]);

  const matchingVariants = useMemo(() => {
    if (!snapshot || slot === 'character') return [];
    const q = query.trim().toLowerCase();
    return snapshot.variants.filter((v) => {
      if (v.targetSlot !== slot) return false;
      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        v.promptText.toLowerCase().includes(q) ||
        v.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [snapshot, slot, query]);

  if (!snapshot) return null;

  return (
    <StudioDialog
      title={`Select ${SLOT_LABELS[slot]}`}
      onClose={onClose}
      className="asset-picker-dialog"
      footer={
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
      }
    >
      <p className="muted-text">Category: {CATEGORY_LABELS[targetCategory]}</p>

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <input
            className="input"
            aria-label={`Search ${SLOT_LABELS[slot]}`}
            placeholder={`Search ${SLOT_LABELS[slot].toLowerCase()}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {slot !== 'character' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={`btn btn-sm ${
                tab === 'assets' ? 'btn-primary' : 'btn-secondary'
              }`}
              onClick={() => setTab('assets')}
            >
              Library Prompts ({matchingAssets.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${
                tab === 'variants' ? 'btn-primary' : 'btn-secondary'
              }`}
              onClick={() => setTab('variants')}
            >
              Character Variants ({matchingVariants.length})
            </button>
          </div>
        )}
      </div>

      {tab === 'assets' ? (
        matchingAssets.length === 0 ? (
          <p className="muted-text">
            No matching prompts in {CATEGORY_LABELS[targetCategory]}.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            }}
          >
            {matchingAssets.map((a) => {
              const coverId = a.coverMediaId || a.mediaLinks[0]?.mediaId;
              const media = coverId ? mediaMap.get(coverId) : undefined;
              return (
                <div key={a.id} className="card" style={{ padding: 12 }}>
                  <div
                    style={{
                      height: 120,
                      borderRadius: 10,
                      overflow: 'hidden',
                      marginBottom: 8,
                    }}
                  >
                    <MediaThumbnail media={media} altText={a.title} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{a.title}</div>
                  <p
                    className="muted-text"
                    style={{
                      fontSize: 12,
                      margin: '6px 0 10px',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {a.promptText}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%' }}
                    onClick={() => onSelectAsset(a)}
                  >
                    Select
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : matchingVariants.length === 0 ? (
        <p className="muted-text">
          No character variants mapped to {SLOT_LABELS[slot]}.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          }}
        >
          {matchingVariants.map((v) => {
            const parent = snapshot.assets.find(
              (a) => a.id === v.parentCharacterId
            );
            const isOtherChar =
              activeCharacterId && activeCharacterId !== v.parentCharacterId;
            const coverId = v.coverMediaId || v.mediaLinks[0]?.mediaId;
            const media = coverId ? mediaMap.get(coverId) : undefined;
            return (
              <div key={v.id} className="card" style={{ padding: 12 }}>
                <div
                  style={{
                    height: 120,
                    borderRadius: 10,
                    overflow: 'hidden',
                    marginBottom: 8,
                  }}
                >
                  <MediaThumbnail media={media} altText={v.title} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{v.title}</div>
                <div
                  className="muted-text"
                  style={{ fontSize: 11, marginBottom: 4 }}
                >
                  Parent: {parent?.title || v.parentCharacterId}
                  {isOtherChar && ' (Requires character switch)'}
                </div>
                <p
                  className="muted-text"
                  style={{
                    fontSize: 12,
                    margin: '4px 0 10px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {v.promptText}
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%' }}
                  onClick={() => onSelectVariant(v)}
                >
                  Select Variant
                </button>
              </div>
            );
          })}
        </div>
      )}
    </StudioDialog>
  );
};
