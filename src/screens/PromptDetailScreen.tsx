import React, { useId, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Download,
  Edit3,
  FolderPlus,
  Heart,
  Layers,
  Lock,
  MoreHorizontal,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import { CATEGORY_LABELS, SLOT_LABELS } from '../domain/validation';
import type { MediaAsset } from '../types/domain';
import { MediaPreviewDialog } from '../components/MediaPreviewDialog';
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
import './characterStudio.css';
import { IdentityAnchorPanel } from '../components/IdentityAnchorPanel';
import { getDownloadFilename, getMediaDisplayName } from '../domain/mediaNaming';

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
  const [preview, setPreview] = useState<{
    media: MediaAsset;
    title: string;
    altText?: string;
  } | null>(null);
  const [selectedMediaIdx, setSelectedMediaIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const tabsId = useId();

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
  const isVisualDetail = kind === 'variant' || asset?.category === 'characters';

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
    <div className="character-studio character-studio-detail">
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
        <div className="character-studio-breadcrumb">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              kind === 'asset' && asset
                ? navigate(`/library/${asset.category}`)
                : variant
                  ? navigate(
                      `/characters/${variant.parentCharacterId}/variants`
                    )
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

        <div className="character-studio-record-actions">
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
            aria-expanded={menuOpen}
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
      <div className="split-layout detail-split character-studio-layout">
        {/* Left: Media Viewer & Thumbnails */}
        <div className="card character-studio-media-panel">
          <div className="character-studio-preview-heading">
            <strong>Visual reference</strong>
            <span className="muted-text">
              {record.mediaLinks.length}{' '}
              {record.mediaLinks.length === 1 ? 'file' : 'files'}
            </span>
          </div>
          {preview && (
            <MediaPreviewDialog {...preview} onClose={() => setPreview(null)} />
          )}
          <div className="character-studio-preview">
            {!preview && (
              <MediaThumbnail
                media={activeMedia}
                altText={activeMediaLink?.altText || record.title}
                showVideoControls={true}
                roleBadge={activeMediaLink?.role}
              />
            )}
          </div>
          {activeMedia && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-label={`Expand media: ${record.title}`}
              onClick={() =>
                setPreview({
                  media: activeMedia,
                  title: record.title,
                  altText: activeMediaLink?.altText,
                })
              }
            >
              Expand Media
            </button>
          )}
          {activeMedia?.isBundledIllustration && (
            <span className="muted-text character-studio-demo-label">
              Demo / Illustrative
            </span>
          )}

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
                    aria-pressed={idx === selectedMediaIdx}
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
              <span className="muted-text character-studio-filename">
                {getMediaDisplayName(activeMedia)} · Original Filename: {activeMedia.filename} (
                {(activeMedia.byteSize / 1024).toFixed(1)} KiB)
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  downloadBlobAsFile(activeMedia.blob, getDownloadFilename(activeMedia))
                }
              >
                <Download size={14} /> Download Reference File
              </button>
            </div>
          )}
        </div>

        {/* Right: Metadata, Tabs, Prompt Text, and Primary Actions */}
        <div className="card character-studio-metadata">
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
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

          {asset?.category === 'characters' && (
            <p className="character-studio-identity-note">
              <Lock size={14} aria-hidden="true" /> Base identity is preserved
              verbatim in scenes.
            </p>
          )}

          {record.description &&
            (record.description.length > 240 ? (
              <details className="character-studio-description">
                <summary>View description</summary>
                <p className="muted-text">{record.description}</p>
              </details>
            ) : (
              <p className="muted-text" style={{ margin: 0, fontSize: 15 }}>
                {record.description}
              </p>
            ))}

          {record.tags.length > 0 && (
            <div className="tag-list">
              {record.tags.map((tag) => (
                <span key={tag} className="badge">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {asset?.category === 'characters' && <IdentityAnchorPanel character={asset} onSaved={refreshSnapshot} onCopy={text => copyText(text, 'Anchor copied.')} />}
          {/* Primary Action Bar */}
          <div className="character-studio-primary-actions">
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
          <div
            className="tabs-bar"
            role="tablist"
            aria-label="Record details"
            onKeyDown={(event) => {
              const tabs = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  '[role="tab"]'
                )
              );
              const current = tabs.indexOf(
                document.activeElement as HTMLButtonElement
              );
              if (current < 0) return;
              const next =
                event.key === 'ArrowRight'
                  ? (current + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (current - 1 + tabs.length) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : -1;
              if (next < 0) return;
              event.preventDefault();
              tabs[next].focus();
              tabs[next].click();
            }}
          >
            <button
              type="button"
              role="tab"
              id={`${tabsId}-tab-prompt`}
              aria-controls={`${tabsId}-panel-prompt`}
              aria-selected={activeTab === 'prompt'}
              tabIndex={activeTab === 'prompt' ? 0 : -1}
              className={`tab-btn ${activeTab === 'prompt' ? 'active' : ''}`}
              onClick={() => setActiveTab('prompt')}
            >
              Prompt
            </button>
            <button
              type="button"
              role="tab"
              id={`${tabsId}-tab-variants`}
              aria-controls={`${tabsId}-panel-variants`}
              aria-selected={activeTab === 'variants'}
              tabIndex={activeTab === 'variants' ? 0 : -1}
              className={`tab-btn ${activeTab === 'variants' ? 'active' : ''}`}
              onClick={() => setActiveTab('variants')}
            >
              Variants ({linkedVariants.length})
            </button>
            <button
              type="button"
              role="tab"
              id={`${tabsId}-tab-notes`}
              aria-controls={`${tabsId}-panel-notes`}
              aria-selected={activeTab === 'notes'}
              tabIndex={activeTab === 'notes' ? 0 : -1}
              className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              Notes
            </button>
            <button
              type="button"
              role="tab"
              id={`${tabsId}-tab-related`}
              aria-controls={`${tabsId}-panel-related`}
              aria-selected={activeTab === 'related'}
              tabIndex={activeTab === 'related' ? 0 : -1}
              className={`tab-btn ${activeTab === 'related' ? 'active' : ''}`}
              onClick={() => setActiveTab('related')}
            >
              Related ({relatedAssets.length})
            </button>
          </div>

          {activeTab === 'prompt' && (
            <div
              role="tabpanel"
              id={`${tabsId}-panel-prompt`}
              aria-labelledby={`${tabsId}-tab-prompt`}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
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

              <details
                className="character-studio-prompt-details"
                open={!isVisualDetail}
              >
                <summary>
                  {kind === 'variant'
                    ? 'View full variant prompt'
                    : asset?.category === 'characters'
                      ? 'View full identity prompt'
                      : 'Prompt details'}
                </summary>
                <div
                  className="character-studio-prompt-content"
                  tabIndex={0}
                  role="region"
                  aria-label="Complete prompt details"
                >
                  <div className="character-studio-source-block">
                    <div className="character-studio-source-heading">
                      <strong>
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
                    <p className="character-studio-full-text">
                      {record.promptText}
                    </p>
                  </div>

                  {record.compactText && (
                    <div className="character-studio-source-block">
                      <strong>Optional Compact Text:</strong>
                      <p className="character-studio-full-text">
                        {record.compactText}
                      </p>
                    </div>
                  )}

                  {record.avoidText && (
                    <div className="character-studio-source-block character-studio-avoid-text">
                      <strong>Avoid / Negative Text:</strong>
                      <p className="character-studio-full-text">
                        {record.avoidText}
                      </p>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}

          {activeTab === 'variants' && (
            <div
              role="tabpanel"
              id={`${tabsId}-panel-variants`}
              aria-labelledby={`${tabsId}-tab-variants`}
            >
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
                    <div className="character-studio-linked-grid">
                      {linkedVariants.map((v) => (
                        <div
                          key={v.id}
                          className="card"
                          style={{ padding: 12 }}
                        >
                          <button
                            type="button"
                            className="character-studio-linked-preview"
                            aria-label={`Expand media: ${v.title}`}
                            disabled={
                              !mediaMap.has(
                                v.coverMediaId || v.mediaLinks[0]?.mediaId
                              )
                            }
                            onClick={() => {
                              const media = mediaMap.get(
                                v.coverMediaId || v.mediaLinks[0]?.mediaId
                              );
                              if (media) setPreview({ media, title: v.title });
                            }}
                          >
                            <MediaThumbnail
                              media={mediaMap.get(
                                v.coverMediaId || v.mediaLinks[0]?.mediaId
                              )}
                              altText={v.title}
                              enableHoverPreview={!preview}
                            />
                          </button>
                          <span className="badge badge-primary">{v.type}</span>
                          <h4 style={{ margin: '8px 0 4px' }}>{v.title}</h4>
                          <p
                            className="muted-text"
                            style={{ fontSize: 12, margin: '0 0 10px' }}
                          >
                            {v.promptText.length > 140
                              ? `${v.promptText.slice(0, 140)}…`
                              : v.promptText}
                          </p>
                          <div className="character-studio-inline-actions">
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
            <div
              role="tabpanel"
              id={`${tabsId}-panel-notes`}
              aria-labelledby={`${tabsId}-tab-notes`}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
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
            <div
              role="tabpanel"
              id={`${tabsId}-panel-related`}
              aria-labelledby={`${tabsId}-tab-related`}
            >
              <p className="muted-text" style={{ marginTop: 0, fontSize: 12 }}>
                Matched by shared category or user-entered tags:
              </p>
              {relatedAssets.length === 0 ? (
                <p className="muted-text">No related prompts found.</p>
              ) : (
                <div className="character-studio-linked-grid">
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
