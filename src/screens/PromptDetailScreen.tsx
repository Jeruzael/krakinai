import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Download,
  Edit3,
  FolderPlus,
  Heart,
  Layers,
  MoreHorizontal,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import { CATEGORY_LABELS, SLOT_LABELS } from '../domain/validation';
import type { MediaAsset } from '../types/domain';
import { MediaThumbnail } from '../components/MediaThumbnail';
import {
  deletePromptAsset,
  deleteVariant,
  getAssetDeletionDependencies,
  savePromptAsset,
  saveVariant,
  toggleAssetFavorite,
  toggleVariantFavorite,
} from '../storage/db';
import { downloadBlobAsFile } from '../hooks/useObjectUrl';

interface PromptDetailScreenProps {
  id: string;
  kind: 'asset' | 'variant';
}

export const PromptDetailScreen: React.FC<PromptDetailScreenProps> = ({
  id,
  kind,
}) => {
  const {
    snapshot,
    navigate,
    copyText,
    applyAssetToScene,
    applyVariantToScene,
    openCollectionModal,
    openConfirmDialog,
    closeConfirmDialog,
    refreshSnapshot,
    showToast,
  } = useLibrary();

  const [activeTab, setActiveTab] = useState<
    'prompt' | 'variants' | 'notes' | 'related'
  >('prompt');
  const [selectedMediaIdx, setSelectedMediaIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const mediaMap = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const m of snapshot?.media ?? []) {
      map.set(m.id, m);
    }
    return map;
  }, [snapshot]);

  if (!snapshot) return null;

  const asset =
    kind === 'asset' ? snapshot.assets.find((a) => a.id === id) : undefined;
  const variant =
    kind === 'variant' ? snapshot.variants.find((v) => v.id === id) : undefined;
  const record = asset || variant;

  if (!record) {
    return (
      <div className="card">
        <h1 className="section-title" style={{ marginBottom: 8 }}>
          This item is no longer available
        </h1>
        <p className="muted-text" style={{ margin: '0 0 16px' }}>
          The requested {kind} record ({id}) could not be found in this browser
          library.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/library')}
        >
          Return to Library
        </button>
      </div>
    );
  }

  const parentCharacter =
    kind === 'variant' && variant
      ? snapshot.assets.find((a) => a.id === variant.parentCharacterId)
      : undefined;

  const linkedVariants =
    kind === 'asset' && asset?.category === 'characters'
      ? snapshot.variants.filter((v) => v.parentCharacterId === asset.id)
      : [];

  const relatedAssets = snapshot.assets
    .filter((a) => {
      if (a.id === record.id) return false;
      if (kind === 'asset' && asset && a.category === asset.category)
        return true;
      return a.tags.some((t) => record.tags.includes(t));
    })
    .slice(0, 4);

  const activeMediaLink =
    record.mediaLinks[selectedMediaIdx] || record.mediaLinks[0];
  const activeMedia = activeMediaLink
    ? mediaMap.get(activeMediaLink.mediaId)
    : undefined;

  const handleDuplicate = async () => {
    setMenuOpen(false);
    try {
      if (kind === 'asset' && asset) {
        const dup = await savePromptAsset({
          title: `${asset.title} (Copy)`,
          category: asset.category,
          description: asset.description,
          promptText: asset.promptText,
          compactText: asset.compactText,
          avoidText: asset.avoidText,
          tags: asset.tags,
          mediaLinks: asset.mediaLinks,
          coverMediaId: asset.coverMediaId,
          provenance: asset.provenance,
          notes: asset.notes,
        });
        await refreshSnapshot();
        showToast(`Duplicated as "${dup.title}".`, 'success');
        navigate(`/prompts/${dup.id}`);
      } else if (kind === 'variant' && variant) {
        const dup = await saveVariant({
          parentCharacterId: variant.parentCharacterId,
          type: variant.type,
          title: `${variant.title} (Copy)`,
          description: variant.description,
          promptText: variant.promptText,
          compactText: variant.compactText,
          avoidText: variant.avoidText,
          tags: variant.tags,
          mediaLinks: variant.mediaLinks,
          coverMediaId: variant.coverMediaId,
          notes: variant.notes,
        });
        await refreshSnapshot();
        showToast(`Duplicated variant as "${dup.title}".`, 'success');
        navigate(`/variants/${dup.id}`);
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to duplicate record.',
        'error'
      );
    }
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (kind === 'asset' && asset) {
      const deps = await getAssetDeletionDependencies(asset.id);
      if (deps.blockedByVariants.length > 0) {
        openConfirmDialog({
          title: 'Cannot Delete Character With Dependent Variants',
          message: `"${asset.title}" has ${deps.blockedByVariants.length} dependent variant(s) (${deps.blockedByVariants
            .map((v) => v.title)
            .join(
              ', '
            )}). To prevent accidental data loss, handle or delete those variants first.`,
          confirmLabel: 'View Variants',
          cancelLabel: 'Close',
          onConfirm: () => {
            closeConfirmDialog();
            navigate(`/characters/${asset.id}/variants`);
          },
        });
        return;
      }

      const depNote = [
        deps.affectedCollections.length > 0
          ? `Removes membership from ${deps.affectedCollections.length} collection(s).`
          : '',
        deps.usedInSavedScenes.length > 0
          ? `${deps.usedInSavedScenes.length} saved scene(s) will keep their preserved snapshot text and media.`
          : '',
      ]
        .filter(Boolean)
        .join(' ');

      openConfirmDialog({
        title: `Delete "${asset.title}"?`,
        message: `Are you sure you want to delete this prompt from your library? ${depNote}`,
        confirmLabel: 'Delete Prompt',
        danger: true,
        onConfirm: async () => {
          await deletePromptAsset(asset.id);
          await refreshSnapshot();
          closeConfirmDialog();
          showToast(`Deleted "${asset.title}".`, 'info');
          navigate(`/library/${asset.category}`);
        },
      });
    } else if (kind === 'variant' && variant) {
      openConfirmDialog({
        title: `Delete Variant "${variant.title}"?`,
        message:
          'Deleting this variant removes it from any collections while preserving existing saved-scene snapshots.',
        confirmLabel: 'Delete Variant',
        danger: true,
        onConfirm: async () => {
          await deleteVariant(variant.id);
          await refreshSnapshot();
          closeConfirmDialog();
          showToast(`Deleted variant "${variant.title}".`, 'info');
          navigate(`/characters/${variant.parentCharacterId}/variants`);
        },
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Breadcrumb & Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              kind === 'asset' && asset
                ? navigate(`/library/${asset.category}`)
                : variant
                ? navigate(`/characters/${variant.parentCharacterId}/variants`)
                : navigate('/library')
            }
          >
            <ArrowLeft size={15} /> Back
          </button>
          <span className="muted-text">
            {kind === 'asset' && asset
              ? `Library / ${CATEGORY_LABELS[asset.category]}`
              : `Variant of ${parentCharacter?.title || 'Character'}`}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              if (kind === 'asset' && asset) {
                await toggleAssetFavorite(asset.id);
              } else if (variant) {
                await toggleVariantFavorite(variant.id);
              }
              await refreshSnapshot();
            }}
          >
            <Heart
              size={15}
              fill={record.favorite ? '#2563EB' : 'none'}
              color={record.favorite ? '#2563EB' : 'currentColor'}
            />{' '}
            {record.favorite ? 'Favorited' : 'Favorite'}
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              navigate(
                kind === 'asset'
                  ? `/prompts/${record.id}/edit`
                  : `/variants/${record.id}/edit`
              )
            }
          >
            <Edit3 size={15} /> Edit
          </button>

          <button
            type="button"
            className="icon-btn"
            aria-label="More actions (Duplicate or Delete)"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MoreHorizontal size={18} />
          </button>

          {menuOpen && (
            <div
              className="card"
              style={{
                position: 'absolute',
                top: '110%',
                right: 0,
                zIndex: 40,
                padding: 8,
                minWidth: 180,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <button
                type="button"
                className="nav-link"
                onClick={handleDuplicate}
              >
                <Copy size={15} /> Duplicate Record
              </button>
              <button
                type="button"
                className="nav-link"
                style={{ color: 'var(--error-text)' }}
                onClick={handleDelete}
              >
                <Trash2 size={15} /> Delete Record
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Two-Column Detail Layout */}
      <div className="split-layout detail-split">
        {/* Left: Media Viewer & Thumbnails */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              width: '100%',
              minHeight: 300,
              maxHeight: 540,
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
              background: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MediaThumbnail
              media={activeMedia}
              altText={activeMediaLink?.altText || record.title}
              showVideoControls={true}
              roleBadge={activeMediaLink?.role}
            />
          </div>

          {record.mediaLinks.length > 1 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
              {record.mediaLinks.map((link, idx) => {
                const m = mediaMap.get(link.mediaId);
                return (
                  <button
                    key={`${link.mediaId}_${idx}`}
                    type="button"
                    onClick={() => setSelectedMediaIdx(idx)}
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 8,
                      overflow: 'hidden',
                      border:
                        idx === selectedMediaIdx
                          ? '2px solid var(--primary)'
                          : '1px solid var(--border-subtle)',
                      padding: 0,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    aria-label={`View sample ${idx + 1}`}
                  >
                    <MediaThumbnail media={m} altText={link.altText} />
                  </button>
                );
              })}
            </div>
          )}

          {activeMedia && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <span className="muted-text" style={{ fontSize: 12 }}>
                File: {activeMedia.filename} (
                {(activeMedia.byteSize / 1024).toFixed(1)} KiB)
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  downloadBlobAsFile(activeMedia.blob, activeMedia.filename)
                }
              >
                <Download size={14} /> Download Reference File
              </button>
            </div>
          )}
        </div>

        {/* Right: Metadata, Tabs, Prompt Text, and Primary Actions */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {kind === 'asset' && asset ? (
              <span className="badge badge-primary">
                {CATEGORY_LABELS[asset.category]}
              </span>
            ) : (
              variant && (
                <>
                  <span className="badge badge-primary">
                    {variant.type} Variant → {SLOT_LABELS[variant.targetSlot]}
                  </span>
                  {parentCharacter && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ minHeight: 28, padding: '2px 8px', fontSize: 12 }}
                      onClick={() => navigate(`/prompts/${parentCharacter.id}`)}
                    >
                      Parent: {parentCharacter.title}
                    </button>
                  )}
                </>
              )
            )}
            <span className="badge">Revision {record.revision}</span>
            <span
              className={`badge ${
                record.reviewStatus === 'user-approved' ? 'badge-success' : ''
              }`}
            >
              {record.reviewStatus === 'user-approved'
                ? 'User-approved'
                : 'Unreviewed'}
            </span>
          </div>

          <h1 className="page-title">{record.title}</h1>

          {record.description && (
            <p className="muted-text" style={{ margin: 0, fontSize: 15 }}>
              {record.description}
            </p>
          )}

          {record.tags.length > 0 && (
            <div className="tag-list">
              {record.tags.map((tag) => (
                <span key={tag} className="badge">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Primary Action Bar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                kind === 'asset' && asset
                  ? applyAssetToScene(asset)
                  : variant && applyVariantToScene(variant)
              }
            >
              <PlusCircle size={16} /> Add to Scene
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => copyText(record.promptText)}
            >
              <Copy size={16} /> Copy Prompt
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                openCollectionModal({
                  type: kind,
                  id: record.id,
                  title: record.title,
                })
              }
            >
              <FolderPlus size={16} /> Add to Collection
            </button>

            {kind === 'asset' && asset?.category === 'characters' && (
              <button
                type="button"
                className="btn btn-tint"
                onClick={() => navigate(`/characters/${asset.id}/variants`)}
              >
                <Layers size={16} /> Manage Variants ({linkedVariants.length})
              </button>
            )}
          </div>

          {/* Detail Tabs: Prompt, Variants, Notes, Related */}
          <div className="tabs-bar" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'prompt'}
              className={`tab-btn ${activeTab === 'prompt' ? 'active' : ''}`}
              onClick={() => setActiveTab('prompt')}
            >
              Prompt
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'variants'}
              className={`tab-btn ${activeTab === 'variants' ? 'active' : ''}`}
              onClick={() => setActiveTab('variants')}
            >
              Variants ({linkedVariants.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'notes'}
              className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              Notes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'related'}
              className={`tab-btn ${activeTab === 'related' ? 'active' : ''}`}
              onClick={() => setActiveTab('related')}
            >
              Related ({relatedAssets.length})
            </button>
          </div>

          {activeTab === 'prompt' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {kind === 'variant' && (
                <div className="banner banner-info" style={{ marginBottom: 0 }}>
                  <span style={{ fontSize: 13 }}>
                    Changed Layer Only ({variant?.type}): This variant stores
                    only the {SLOT_LABELS[variant!.targetSlot]} layer while
                    reusing {parentCharacter?.title || 'the parent character'}’s
                    locked base identity in Scene Builder.
                  </span>
                </div>
              )}

              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <strong style={{ fontSize: 13 }}>
                    {kind === 'variant'
                      ? 'Changed Layer Prompt Text'
                      : 'Full Prompt Text'}
                  </strong>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyText(record.promptText)}
                  >
                    <Copy size={13} /> Copy
                  </button>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 16,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    userSelect: 'text',
                  }}
                >
                  {record.promptText}
                </p>
              </div>

              {record.compactText && (
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <strong style={{ fontSize: 13 }}>
                    Optional Compact Text:
                  </strong>
                  <p style={{ margin: '6px 0 0', fontSize: 14 }}>
                    {record.compactText}
                  </p>
                </div>
              )}

              {record.avoidText && (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid var(--error-border)',
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <strong style={{ fontSize: 13, color: 'var(--error-text)' }}>
                    Avoid / Negative Text:
                  </strong>
                  <p style={{ margin: '6px 0 0', fontSize: 14 }}>
                    {record.avoidText}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'variants' && (
            <div>
              {kind === 'asset' && asset?.category === 'characters' ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <span className="muted-text">
                      Reusable outfits, expressions, poses, angles, locations &
                      styles for {asset.title}.
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        navigate(`/characters/${asset.id}/variants/new`)
                      }
                    >
                      + Add Variant
                    </button>
                  </div>
                  {linkedVariants.length === 0 ? (
                    <p className="muted-text">
                      No variants created for this character yet.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gap: 10,
                        gridTemplateColumns:
                          'repeat(auto-fill, minmax(220px, 1fr))',
                      }}
                    >
                      {linkedVariants.map((v) => (
                        <div
                          key={v.id}
                          className="card"
                          style={{ padding: 12 }}
                        >
                          <span className="badge badge-primary">{v.type}</span>
                          <h4 style={{ margin: '8px 0 4px' }}>{v.title}</h4>
                          <p
                            className="muted-text"
                            style={{ fontSize: 12, margin: '0 0 10px' }}
                          >
                            {v.promptText}
                          </p>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => navigate(`/variants/${v.id}`)}
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              className="btn btn-tint btn-sm"
                              onClick={() => applyVariantToScene(v)}
                            >
                              Use in Scene
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="muted-text">
                  Variants are linked to Character records.{' '}
                  {parentCharacter && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        navigate(`/characters/${parentCharacter.id}/variants`)
                      }
                    >
                      View all variants of {parentCharacter.title}
                    </button>
                  )}
                </p>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="muted-text" style={{ margin: 0, fontSize: 12 }}>
                User-entered tool, model, and seed notes are stored for your
                personal reference and do not imply verified compatibility.
              </p>
              {kind === 'asset' && asset?.provenance && (
                <div
                  style={{
                    background: '#F8FAFC',
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <strong>Tool / Generator:</strong>{' '}
                    {asset.provenance.toolName || 'Not specified'}
                  </div>
                  <div>
                    <strong>Model Label:</strong>{' '}
                    {asset.provenance.modelLabel || 'Not specified'}
                  </div>
                  <div>
                    <strong>Seed / Settings Note:</strong>{' '}
                    {asset.provenance.seed ||
                      asset.provenance.settingsNotes ||
                      'None'}
                  </div>
                </div>
              )}
              <div>
                <strong>Review & Personal Notes:</strong>
                <p className="muted-text">
                  {record.notes || 'No personal notes recorded.'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'related' && (
            <div>
              <p className="muted-text" style={{ marginTop: 0, fontSize: 12 }}>
                Matched by shared category or user-entered tags:
              </p>
              {relatedAssets.length === 0 ? (
                <p className="muted-text">No related prompts found.</p>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gap: 10,
                    gridTemplateColumns:
                      'repeat(auto-fill, minmax(220px, 1fr))',
                  }}
                >
                  {relatedAssets.map((r) => (
                    <div key={r.id} className="card" style={{ padding: 12 }}>
                      <span className="badge">
                        {CATEGORY_LABELS[r.category]}
                      </span>
                      <h4 style={{ margin: '6px 0' }}>{r.title}</h4>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/prompts/${r.id}`)}
                      >
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
