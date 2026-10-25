import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Edit3,
  ExternalLink,
  FolderKanban,
  FolderPlus,
  Trash2,
} from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import type { MediaAsset } from '../types/domain';
import {
  createCollection,
  deleteCollection,
  removeMemberFromCollection,
  toggleAssetFavorite,
  toggleVariantFavorite,
  updateCollection,
} from '../storage/db';
import { PromptCard } from '../components/PromptCard';
import { MediaThumbnail } from '../components/MediaThumbnail';

export const CollectionsScreen: React.FC<{ collectionId?: string }> = ({
  collectionId,
}) => {
  const {
    snapshot,
    navigate,
    copyText,
    applyAssetToScene,
    applyVariantToScene,
    openConfirmDialog,
    closeConfirmDialog,
    refreshSnapshot,
    showToast,
  } = useLibrary();

  const [search, setSearch] = useState('');
  const [detailTab, setDetailTab] = useState<'assets' | 'variants' | 'scenes'>(
    'assets'
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [colName, setColName] = useState('');
  const [colDesc, setColDesc] = useState('');

  const mediaMap = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const m of snapshot?.media ?? []) {
      map.set(m.id, m);
    }
    return map;
  }, [snapshot]);

  if (!snapshot) return null;

  // Collection Detail View
  if (collectionId) {
    const col = snapshot.collections.find((c) => c.id === collectionId);
    if (!col) {
      return (
        <div className="card">
          <h1 className="section-title">Collection not found</h1>
          <p className="muted-text">
            This collection is no longer available.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/collections')}
          >
            Back to Collections
          </button>
        </div>
      );
    }

    const assetRefs = col.members.filter((m) => m.type === 'asset');
    const variantRefs = col.members.filter((m) => m.type === 'variant');
    const sceneRefs = col.members.filter((m) => m.type === 'scene');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginBottom: 8 }}
              onClick={() => navigate('/collections')}
            >
              <ArrowLeft size={15} /> Back to Collections
            </button>
            <h1 className="page-title">{col.name}</h1>
            <p className="muted-text" style={{ margin: '4px 0 0' }}>
              {col.description || 'Project / Collection folder'} •{' '}
              {col.members.length} item(s)
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setEditingColId(col.id);
                setColName(col.name);
                setColDesc(col.description);
                setShowCreateModal(true);
              }}
            >
              <Edit3 size={14} /> Rename / Edit
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() =>
                openConfirmDialog({
                  title: 'Delete Collection?',
                  message:
                    'Delete this collection? Its prompts and scenes will be kept in your library.',
                  confirmLabel: 'Delete Collection',
                  danger: true,
                  onConfirm: async () => {
                    await deleteCollection(col.id);
                    await refreshSnapshot();
                    closeConfirmDialog();
                    showToast('Deleted collection.', 'info');
                    navigate('/collections');
                  },
                })
              }
            >
              <Trash2 size={14} /> Delete Collection
            </button>
          </div>
        </div>

        <div className="tabs-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={detailTab === 'assets'}
            className={`tab-btn ${detailTab === 'assets' ? 'active' : ''}`}
            onClick={() => setDetailTab('assets')}
          >
            Prompts ({assetRefs.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={detailTab === 'variants'}
            className={`tab-btn ${detailTab === 'variants' ? 'active' : ''}`}
            onClick={() => setDetailTab('variants')}
          >
            Variants ({variantRefs.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={detailTab === 'scenes'}
            className={`tab-btn ${detailTab === 'scenes' ? 'active' : ''}`}
            onClick={() => setDetailTab('scenes')}
          >
            Saved Scenes ({sceneRefs.length})
          </button>
        </div>

        {detailTab === 'assets' &&
          (assetRefs.length === 0 ? (
            <div className="card">
              <p className="muted-text">
                No prompt assets in this collection yet. Open any prompt in the
                Library and click “Add to Collection”.
              </p>
            </div>
          ) : (
            <div className="card-grid">
              {assetRefs.map((ref) => {
                const asset = snapshot.assets.find((a) => a.id === ref.id);
                if (!asset) {
                  return (
                    <div key={ref.id} className="card">
                      <p className="muted-text">
                        Missing item ({ref.id}) — no longer in library.
                      </p>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          await removeMemberFromCollection({
                            collectionId: col.id,
                            memberType: 'asset',
                            memberId: ref.id,
                          });
                          await refreshSnapshot();
                        }}
                      >
                        Remove Reference
                      </button>
                    </div>
                  );
                }
                return (
                  <PromptCard
                    key={asset.id}
                    item={asset}
                    kind="asset"
                    mediaMap={mediaMap}
                    onOpen={() => navigate(`/prompts/${asset.id}`)}
                    onCopy={() => copyText(asset.promptText)}
                    onToggleFavorite={async () => {
                      await toggleAssetFavorite(asset.id);
                      await refreshSnapshot();
                    }}
                    onAddToScene={() => applyAssetToScene(asset)}
                    extraAction={
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          await removeMemberFromCollection({
                            collectionId: col.id,
                            memberType: 'asset',
                            memberId: asset.id,
                          });
                          await refreshSnapshot();
                          showToast(
                            'Removed from collection (prompt kept in library).',
                            'info'
                          );
                        }}
                      >
                        Remove from Collection
                      </button>
                    }
                  />
                );
              })}
            </div>
          ))}

        {detailTab === 'variants' &&
          (variantRefs.length === 0 ? (
            <div className="card">
              <p className="muted-text">No variants in this collection yet.</p>
            </div>
          ) : (
            <div className="card-grid">
              {variantRefs.map((ref) => {
                const variant = snapshot.variants.find((v) => v.id === ref.id);
                if (!variant) return null;
                return (
                  <PromptCard
                    key={variant.id}
                    item={variant}
                    kind="variant"
                    mediaMap={mediaMap}
                    onOpen={() => navigate(`/variants/${variant.id}`)}
                    onCopy={() => copyText(variant.promptText)}
                    onToggleFavorite={async () => {
                      await toggleVariantFavorite(variant.id);
                      await refreshSnapshot();
                    }}
                    onAddToScene={() => applyVariantToScene(variant)}
                    extraAction={
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          await removeMemberFromCollection({
                            collectionId: col.id,
                            memberType: 'variant',
                            memberId: variant.id,
                          });
                          await refreshSnapshot();
                          showToast('Removed variant from collection.', 'info');
                        }}
                      >
                        Remove from Collection
                      </button>
                    }
                  />
                );
              })}
            </div>
          ))}

        {detailTab === 'scenes' &&
          (sceneRefs.length === 0 ? (
            <div className="card">
              <p className="muted-text">
                No saved scenes in this collection yet.
              </p>
            </div>
          ) : (
            <div className="card-grid">
              {sceneRefs.map((ref) => {
                const scene = snapshot.scenes.find((s) => s.id === ref.id);
                if (!scene) return null;
                return (
                  <div key={scene.id} className="card">
                    <span className="badge badge-success">Saved Scene</span>
                    <h3 style={{ margin: '8px 0' }}>{scene.title}</h3>
                    <p className="prompt-card-excerpt clamped">
                      {scene.outputs.full}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/output/${scene.id}`)}
                      >
                        <ExternalLink size={14} /> Open Scene
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          await removeMemberFromCollection({
                            collectionId: col.id,
                            memberType: 'scene',
                            memberId: scene.id,
                          });
                          await refreshSnapshot();
                          showToast('Removed scene from collection.', 'info');
                        }}
                      >
                        Remove from Collection
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

        {showCreateModal && (
          <CollectionEditModal
            isEdit={true}
            name={colName}
            desc={colDesc}
            onChangeName={setColName}
            onChangeDesc={setColDesc}
            onClose={() => setShowCreateModal(false)}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editingColId) return;
              await updateCollection({
                id: editingColId,
                name: colName,
                description: colDesc,
              });
              await refreshSnapshot();
              setShowCreateModal(false);
              showToast('Collection updated.', 'success');
            }}
          />
        )}
      </div>
    );
  }

  // Collections Overview
  const filteredCollections = snapshot.collections.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 className="page-title">Collections</h1>
          <p className="muted-text" style={{ margin: '4px 0 0' }}>
            Organize prompts, variants, and saved scenes into project folders
            without duplicating records.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditingColId(null);
            setColName('');
            setColDesc('');
            setShowCreateModal(true);
          }}
        >
          <FolderPlus size={16} /> New Collection
        </button>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <input
          className="input"
          placeholder="Search collections..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredCollections.length === 0 ? (
        <div className="card">
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            No collections found
          </h2>
          <p className="muted-text" style={{ margin: '0 0 14px' }}>
            Create a collection (such as a drama series, client campaign, or
            character pack) to group reusable assets and scenes.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingColId(null);
              setColName('');
              setColDesc('');
              setShowCreateModal(true);
            }}
          >
            <FolderPlus size={16} /> New Collection
          </button>
        </div>
      ) : (
        <div className="card-grid">
          {filteredCollections.map((col) => {
            // Find first member thumbnail
            let coverMedia: MediaAsset | undefined;
            for (const m of col.members) {
              if (m.type === 'asset') {
                const a = snapshot.assets.find((x) => x.id === m.id);
                const cid = a?.coverMediaId || a?.mediaLinks[0]?.mediaId;
                if (cid && mediaMap.has(cid)) {
                  coverMedia = mediaMap.get(cid);
                  break;
                }
              }
            }

            return (
              <article key={col.id} className="prompt-card">
                <div
                  className="prompt-card-media"
                  onClick={() => navigate(`/collections/${col.id}`)}
                >
                  {coverMedia ? (
                    <MediaThumbnail media={coverMedia} altText={col.name} />
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        color: 'var(--primary)',
                      }}
                    >
                      <FolderKanban size={32} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>
                        Collection Folder
                      </span>
                    </div>
                  )}
                </div>

                <div className="prompt-card-body">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span className="badge badge-primary">
                      {col.members.length} items
                    </span>
                    <span className="muted-text" style={{ fontSize: 11 }}>
                      Updated {new Date(col.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3
                    className="prompt-card-title"
                    onClick={() => navigate(`/collections/${col.id}`)}
                  >
                    {col.name}
                  </h3>

                  {col.description && (
                    <p className="prompt-card-excerpt clamped">
                      {col.description}
                    </p>
                  )}

                  <div className="prompt-card-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/collections/${col.id}`)}
                    >
                      Open Collection
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditingColId(col.id);
                        setColName(col.name);
                        setColDesc(col.description);
                        setShowCreateModal(true);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      aria-label={`Delete collection ${col.name}`}
                      onClick={() =>
                        openConfirmDialog({
                          title: 'Delete Collection?',
                          message:
                            'Delete this collection? Its prompts and scenes will be kept.',
                          confirmLabel: 'Delete Collection',
                          danger: true,
                          onConfirm: async () => {
                            await deleteCollection(col.id);
                            await refreshSnapshot();
                            closeConfirmDialog();
                            showToast('Deleted collection.', 'info');
                          },
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CollectionEditModal
          isEdit={Boolean(editingColId)}
          name={colName}
          desc={colDesc}
          onChangeName={setColName}
          onChangeDesc={setColDesc}
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              if (editingColId) {
                await updateCollection({
                  id: editingColId,
                  name: colName,
                  description: colDesc,
                });
                showToast('Collection updated.', 'success');
              } else {
                await createCollection({
                  name: colName,
                  description: colDesc,
                });
                showToast('Collection created.', 'success');
              }
              await refreshSnapshot();
              setShowCreateModal(false);
            } catch (err) {
              showToast(
                err instanceof Error
                  ? err.message
                  : 'Failed to save collection.',
                'error'
              );
            }
          }}
        />
      )}
    </div>
  );
};

const CollectionEditModal: React.FC<{
  isEdit: boolean;
  name: string;
  desc: string;
  onChangeName: (v: string) => void;
  onChangeDesc: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}> = ({
  isEdit,
  name,
  desc,
  onChangeName,
  onChangeDesc,
  onClose,
  onSubmit,
}) => (
  <div
    className="modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="col-edit-title"
  >
    <div className="modal-panel" style={{ maxWidth: 460 }}>
      <div className="modal-header">
        <h2 id="col-edit-title" className="section-title">
          {isEdit ? 'Edit Collection' : 'New Collection'}
        </h2>
      </div>
      <form onSubmit={onSubmit}>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="modal-col-name" className="form-label">
              Collection Name *
            </label>
            <input
              id="modal-col-name"
              className="input"
              required
              maxLength={100}
              value={name}
              onChange={(e) => onChangeName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="modal-col-desc" className="form-label">
              Description (Optional)
            </label>
            <textarea
              id="modal-col-desc"
              className="textarea"
              rows={3}
              value={desc}
              onChange={(e) => onChangeDesc(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {isEdit ? 'Save Changes' : 'Create Collection'}
          </button>
        </div>
      </form>
    </div>
  </div>
);
