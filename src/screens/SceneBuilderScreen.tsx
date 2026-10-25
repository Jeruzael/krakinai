import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookmarkPlus,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import {
  SLOT_LABELS,
  validateMediaCandidate,
} from '../domain/validation';
import {
  assembleScenePrompt,
  createSnapshotFromAsset,
  createSnapshotFromVariant,
  ORDERED_BUILDER_SLOTS,
} from '../domain/promptAssembler';
import type {
  AspectRatioOption,
  BuilderSlot,
  ComponentSnapshot,
  MediaAsset,
  PromptAsset,
  ReviewStatus,
  SceneDraft,
  Variant,
} from '../types/domain';
import {
  checkCharacterReplacementInDraft,
  checkVariantApplicationToDraft,
  saveDraftAsTemplate,
  saveMediaAsset,
  saveSceneDraft,
} from '../storage/db';
import { MediaThumbnail } from '../components/MediaThumbnail';
import { AssetPickerModal } from '../components/SharedModals';

export const SceneBuilderScreen: React.FC<{ draftId?: string }> = ({
  draftId,
}) => {
  const {
    snapshot,
    navigate,
    refreshSnapshot,
    getOrCreateActiveDraft,
    openConfirmDialog,
    closeConfirmDialog,
    showToast,
  } = useLibrary();

  const [draft, setDraft] = useState<SceneDraft | null>(null);
  const [saveState, setSaveState] = useState<
    'saved' | 'saving' | 'error'
  >('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [assemblyErrors, setAssemblyErrors] = useState<string[]>([]);
  const [pickerSlot, setPickerSlot] = useState<BuilderSlot | null>(null);
  const [editingOverrideSlot, setEditingOverrideSlot] =
    useState<BuilderSlot | null>(null);
  const [overrideTextBuf, setOverrideTextBuf] = useState('');
  const [overrideCompactBuf, setOverrideCompactBuf] = useState('');

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [tplIncludeChar, setTplIncludeChar] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!snapshot) return;
      if (draftId) {
        const found = snapshot.drafts.find((d) => d.id === draftId);
        if (found && mounted) {
          setDraft(found);
          return;
        }
      }
      const active = await getOrCreateActiveDraft();
      if (mounted) setDraft(active);
    })();
    return () => {
      mounted = false;
    };
  }, [draftId, snapshot?.drafts.length]);

  const mediaMap = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const m of snapshot?.media ?? []) {
      map.set(m.id, m);
    }
    return map;
  }, [snapshot]);

  const persistDraftImmediate = async (
    nextDraft: SceneDraft,
    bumpRevision = true
  ) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState('saving');
    setSaveError(null);
    try {
      const saved = await saveSceneDraft({
        ...nextDraft,
        bumpInputRevision: bumpRevision,
      });
      setDraft(saved);
      setSaveState('saved');
      await refreshSnapshot();
      return saved;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save draft locally.';
      setSaveState('error');
      setSaveError(msg);
      return nextDraft;
    }
  };

  const scheduleDraftAutosave = (nextDraft: SceneDraft) => {
    setDraft(nextDraft);
    setSaveState('saving');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persistDraftImmediate(nextDraft, true);
    }, 800);
  };

  if (!snapshot || !draft) {
    return (
      <div className="card">
        <p className="muted-text">Loading Scene Builder...</p>
      </div>
    );
  }

  // Collect reference board thumbnails across all active slots
  const referenceBoardItems: Array<{
    slot: BuilderSlot;
    slotLabel: string;
    sourceTitle: string;
    mediaId: string;
    role: string;
  }> = [];

  for (const slot of ORDERED_BUILDER_SLOTS) {
    const snap = draft.slots[slot];
    if (!snap) continue;
    for (const link of snap.mediaLinks ?? []) {
      referenceBoardItems.push({
        slot,
        slotLabel: SLOT_LABELS[slot],
        sourceTitle: snap.sourceTitle,
        mediaId: link.mediaId,
        role: link.role,
      });
    }
  }

  const getLatestLibrarySource = (
    snap: ComponentSnapshot
  ): { record?: PromptAsset | Variant; hasNewerRevision: boolean } => {
    if (snap.sourceType === 'asset') {
      const found = snapshot.assets.find((a) => a.id === snap.sourceId);
      return {
        record: found,
        hasNewerRevision: Boolean(
          found && found.revision > snap.sourceRevision
        ),
      };
    }
    if (snap.sourceType === 'variant') {
      const found = snapshot.variants.find((v) => v.id === snap.sourceId);
      return {
        record: found,
        hasNewerRevision: Boolean(
          found && found.revision > snap.sourceRevision
        ),
      };
    }
    return { hasNewerRevision: false };
  };

  const handleSelectAssetForSlot = async (asset: PromptAsset) => {
    if (!pickerSlot) return;
    if (pickerSlot === 'character') {
      const check = checkCharacterReplacementInDraft(draft, asset.id);
      if (check.requiresConfirmation) {
        setPickerSlot(null);
        openConfirmDialog({
          title: 'Replace Character & Clear Incompatible Variants?',
          message: `Switching character to "${asset.title}" will clear incompatible linked variant(s): ${check.incompatibleVariantTitles.join(
            ', '
          )}. Continue?`,
          confirmLabel: 'Replace Character',
          danger: true,
          onConfirm: async () => {
            const nextSlots = { ...draft.slots };
            for (const s of check.incompatibleSlots) {
              delete nextSlots[s];
            }
            nextSlots.character = createSnapshotFromAsset(asset);
            await persistDraftImmediate({ ...draft, slots: nextSlots });
            closeConfirmDialog();
          },
        });
        return;
      }
    }

    const nextSlots = {
      ...draft.slots,
      [pickerSlot]: createSnapshotFromAsset(asset),
    };
    setPickerSlot(null);
    await persistDraftImmediate({ ...draft, slots: nextSlots });
  };

  const handleSelectVariantForSlot = async (variant: Variant) => {
    setPickerSlot(null);
    const check = checkVariantApplicationToDraft(
      draft,
      variant,
      snapshot.assets
    );
    const parentAsset = snapshot.assets.find(
      (a) => a.id === variant.parentCharacterId
    );

    if (check.requiresConfirmation) {
      openConfirmDialog({
        title: 'Character Identity Mismatch',
        message: `This variant belongs to ${check.parentCharacterTitle}. Replace ${check.currentCharacterTitle} with ${check.parentCharacterTitle}?`,
        confirmLabel: `Replace with ${check.parentCharacterTitle}`,
        onConfirm: async () => {
          const nextSlots = { ...draft.slots };
          for (const s of check.incompatibleVariantSlotsToClear) {
            delete nextSlots[s];
          }
          if (parentAsset) {
            nextSlots.character = createSnapshotFromAsset(parentAsset);
          }
          nextSlots[variant.targetSlot] = createSnapshotFromVariant(variant);
          await persistDraftImmediate({ ...draft, slots: nextSlots });
          closeConfirmDialog();
        },
      });
      return;
    }

    const nextSlots = { ...draft.slots };
    if (!nextSlots.character && parentAsset) {
      nextSlots.character = createSnapshotFromAsset(parentAsset);
    }
    nextSlots[variant.targetSlot] = createSnapshotFromVariant(variant);
    await persistDraftImmediate({ ...draft, slots: nextSlots });
  };

  const handleRemoveSlot = (slot: BuilderSlot) => {
    if (slot === 'character') {
      const check = checkCharacterReplacementInDraft(draft, null);
      if (check.requiresConfirmation) {
        openConfirmDialog({
          title: 'Remove Character & Clear Linked Variants?',
          message: `Removing the character will also clear character-linked variant(s): ${check.incompatibleVariantTitles.join(
            ', '
          )}. Continue?`,
          confirmLabel: 'Remove Character & Variants',
          danger: true,
          onConfirm: async () => {
            const nextSlots = { ...draft.slots };
            delete nextSlots.character;
            for (const s of check.incompatibleSlots) {
              delete nextSlots[s];
            }
            await persistDraftImmediate({ ...draft, slots: nextSlots });
            closeConfirmDialog();
          },
        });
        return;
      }
    }

    const nextSlots = { ...draft.slots };
    delete nextSlots[slot];
    persistDraftImmediate({ ...draft, slots: nextSlots });
  };

  const handleRefreshSlotSource = (slot: BuilderSlot, snap: ComponentSnapshot) => {
    const { record } = getLatestLibrarySource(snap);
    if (!record) return;

    const doRefresh = async () => {
      const freshSnap =
        snap.sourceType === 'asset'
          ? createSnapshotFromAsset(record as PromptAsset)
          : createSnapshotFromVariant(record as Variant);
      const nextSlots = {
        ...draft.slots,
        [slot]: freshSnap,
      };
      await persistDraftImmediate({ ...draft, slots: nextSlots });
      closeConfirmDialog();
      showToast(`Refreshed ${SLOT_LABELS[slot]} from latest source.`, 'success');
    };

    if (snap.overrideText) {
      openConfirmDialog({
        title: 'Overwrite Scene-Only Text Override?',
        message: `Refreshing "${snap.sourceTitle}" from the library will replace your scene-only text edit for ${SLOT_LABELS[slot]}. Continue?`,
        confirmLabel: 'Refresh & Replace Override',
        danger: true,
        onConfirm: doRefresh,
      });
      return;
    }

    doRefresh();
  };

  const handleUploadResultFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateMediaCandidate({
      name: file.name,
      type: file.type,
      size: file.size,
      existingCount: draft.resultMediaLinks.length,
    });
    if (!check.valid) {
      showToast(check.error || 'Invalid result media file.', 'error');
      return;
    }

    try {
      const savedMedia = await saveMediaAsset({
        filename: file.name,
        mimeType: file.type,
        blob: file,
      });
      const nextResults = [
        ...draft.resultMediaLinks,
        {
          mediaId: savedMedia.id,
          role: 'result' as const,
          altText: `Generated result for ${draft.title}`,
          order: draft.resultMediaLinks.length,
          filename: savedMedia.filename,
          mimeType: savedMedia.mimeType,
        },
      ];
      await persistDraftImmediate(
        { ...draft, resultMediaLinks: nextResults },
        false
      );
      showToast('Uploaded external generation result sample.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to store result file.',
        'error'
      );
    }
    e.target.value = '';
  };

  const handleAssemble = async () => {
    const saved = await persistDraftImmediate(draft, false);
    const res = assembleScenePrompt(saved);
    if (!res.valid) {
      setAssemblyErrors(res.errors);
      return;
    }
    setAssemblyErrors([]);
    navigate(`/output/${saved.id}`, true);
  };

  const handleSaveAsTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tpl = await saveDraftAsTemplate({
        draft,
        name: tplName,
        description: tplDesc,
        includeCharacterIdentity: tplIncludeChar,
      });
      await refreshSnapshot();
      setShowTemplateModal(false);
      setTplName('');
      setTplDesc('');
      showToast(`Saved template "${tpl.name}".`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to save template.',
        'error'
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Bar */}
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
          <h1 className="page-title">Scene Builder</h1>
          <p className="muted-text" style={{ margin: '4px 0 0' }}>
            Combine reusable prompt components into a deterministic single-shot
            specification.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {saveState === 'saving' && (
            <span className="badge badge-warning">Saving draft...</span>
          )}
          {saveState === 'saved' && (
            <span className="badge badge-success">
              <CheckCircle2 size={12} /> Draft saved (Rev {draft.inputRevision})
            </span>
          )}
          {saveState === 'error' && (
            <span className="badge badge-error">
              <AlertCircle size={12} /> Save Failed
            </span>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => persistDraftImmediate(draft, false)}
          >
            Save Draft
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setTplName(draft.title || 'Custom Arrangement');
              setShowTemplateModal(true);
            }}
          >
            <BookmarkPlus size={14} /> Save as Template
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAssemble}
          >
            <Sparkles size={16} /> Assemble Prompt
          </button>
        </div>
      </div>

      {saveError && (
        <div className="banner banner-error" role="alert">
          <span>
            <strong>Draft Save Failed:</strong> {saveError} Your in-memory edits
            are still shown below.
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => persistDraftImmediate(draft, false)}
          >
            Retry Save
          </button>
        </div>
      )}

      {assemblyErrors.length > 0 && (
        <div className="banner banner-error" role="alert">
          <div>
            <strong>Cannot Assemble Prompt Yet:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {assemblyErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Two-Column Builder Layout */}
      <div className="split-layout builder-split">
        {/* Left: Reference Board & Result Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <h2 className="section-title">Reference Board</h2>
              <span className="badge">
                {referenceBoardItems.length} reference sample(s)
              </span>
            </div>

            <div className="banner banner-info" style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                References only. This app does not render a combined scene.
              </span>
            </div>

            {referenceBoardItems.length === 0 ? (
              <div
                style={{
                  padding: 28,
                  borderRadius: 12,
                  border: '1px dashed var(--border-strong)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                Select character, outfit, environment, or camera components on
                the right to inspect their reference samples here.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                }}
              >
                {referenceBoardItems.map((item, idx) => {
                  const media = mediaMap.get(item.mediaId);
                  return (
                    <div
                      key={`${item.mediaId}_${idx}`}
                      style={{
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 12,
                        overflow: 'hidden',
                        background: '#F8FAFC',
                      }}
                    >
                      <div style={{ height: 130 }}>
                        <MediaThumbnail
                          media={media}
                          altText={item.sourceTitle}
                          roleBadge={item.slotLabel}
                        />
                      </div>
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>
                          {item.sourceTitle}
                        </div>
                        <div className="muted-text" style={{ fontSize: 11 }}>
                          Role: {item.role}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Separate Result Upload Area */}
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 6 }}>
              External Result Upload & Review (Separate from References)
            </h2>
            <p className="muted-text" style={{ margin: '0 0 14px', fontSize: 13 }}>
              After generating your image or video in an external tool, upload
              the actual result here for review and future reference. Result
              uploads never overwrite your input references.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label
                htmlFor="builder-result-upload"
                className="btn btn-secondary btn-sm"
                style={{ cursor: 'pointer' }}
              >
                <Upload size={14} /> Upload Actual Result (
                {draft.resultMediaLinks.length}/6)
              </label>
              <input
                id="builder-result-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                onChange={handleUploadResultFile}
                style={{ display: 'none' }}
              />
            </div>

            {draft.resultMediaLinks.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  marginBottom: 14,
                }}
              >
                {draft.resultMediaLinks.map((rLink, idx) => {
                  const media = mediaMap.get(rLink.mediaId);
                  return (
                    <div
                      key={`${rLink.mediaId}_${idx}`}
                      style={{
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 10,
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ height: 140 }}>
                        <MediaThumbnail
                          media={media}
                          altText={rLink.altText}
                          showVideoControls={true}
                          roleBadge="Actual Result"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 10 }}>
              <label htmlFor="builder-review-status" className="form-label">
                Result Review Status
              </label>
              <select
                id="builder-review-status"
                className="select"
                value={draft.reviewStatus}
                onChange={(e) =>
                  scheduleDraftAutosave({
                    ...draft,
                    reviewStatus: e.target.value as ReviewStatus,
                  })
                }
              >
                <option value="unreviewed">Unreviewed</option>
                <option value="user-approved">User-approved</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="builder-review-notes" className="form-label">
                Result Review Notes
              </label>
              <textarea
                id="builder-review-notes"
                className="textarea"
                rows={2}
                placeholder="Notes on how the external tool handled this prompt..."
                value={draft.reviewNotes}
                onChange={(e) =>
                  scheduleDraftAutosave({
                    ...draft,
                    reviewNotes: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Right: Scene Title, 7 Ordered Slots, Instructions, Dialogue & Settings */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="builder-scene-title" className="form-label">
              Scene Title *
            </label>
            <input
              id="builder-scene-title"
              className="input"
              placeholder="e.g., Maya Cafe Opening Shot"
              value={draft.title}
              onChange={(e) =>
                scheduleDraftAutosave({ ...draft, title: e.target.value })
              }
            />
          </div>

          <div>
            <h2 className="section-title" style={{ marginBottom: 4 }}>
              Ordered Scene Components (1 Item Per Slot)
            </h2>
            <p className="muted-text" style={{ margin: '0 0 12px', fontSize: 13 }}>
              Environment and Action are required for assembly. Character is
              optional for scenery-only shots, unless Dialogue or a
              character-required template is active.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ORDERED_BUILDER_SLOTS.map((slot, index) => {
                const snap = draft.slots[slot];
                const isRequired =
                  slot === 'environment' ||
                  slot === 'action' ||
                  draft.extraRequiredSlots.includes(slot);
                const latestInfo = snap
                  ? getLatestLibrarySource(snap)
                  : { hasNewerRevision: false };

                return (
                  <div
                    key={slot}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 12,
                      padding: 14,
                      background: snap ? '#FFFFFF' : '#F8FAFC',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginBottom: snap ? 8 : 0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="badge badge-primary">{index + 1}</span>
                        <strong>{SLOT_LABELS[slot]}</strong>
                        {isRequired ? (
                          <span className="badge badge-warning">Required</span>
                        ) : (
                          <span className="muted-text" style={{ fontSize: 12 }}>
                            Optional
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setPickerSlot(slot)}
                        >
                          <Plus size={13} /> {snap ? 'Replace' : 'Select'}
                        </button>
                        {snap && (
                          <>
                            {snap.sourceType !== 'template' && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() =>
                                  navigate(
                                    snap.sourceType === 'asset'
                                      ? `/prompts/${snap.sourceId}`
                                      : `/variants/${snap.sourceId}`
                                  )
                                }
                              >
                                <ExternalLink size={13} /> View Source
                              </button>
                            )}
                            {slot !== 'character' && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setEditingOverrideSlot(slot);
                                  setOverrideTextBuf(
                                    snap.overrideText ?? snap.promptText
                                  );
                                  setOverrideCompactBuf(
                                    snap.overrideCompactText ?? ''
                                  );
                                }}
                              >
                                <Edit3 size={13} /> Scene Edit
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRemoveSlot(slot)}
                              aria-label={`Remove ${SLOT_LABELS[slot]}`}
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {snap && (
                      <div style={{ fontSize: 13 }}>
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            marginBottom: 6,
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>
                            {snap.sourceTitle}
                          </span>
                          <span className="badge">
                            {snap.sourceType} • Rev {snap.sourceRevision}
                          </span>
                          {slot === 'character' && (
                            <span className="badge badge-primary">
                              <Lock size={11} /> Identity text locked in builder
                            </span>
                          )}
                          {snap.overrideText && (
                            <span className="badge badge-warning">
                              Scene-only override active
                            </span>
                          )}
                          {latestInfo.hasNewerRevision && (
                            <button
                              type="button"
                              className="btn btn-tint btn-sm"
                              style={{ minHeight: 26, padding: '2px 8px' }}
                              onClick={() => handleRefreshSlotSource(slot, snap)}
                            >
                              <RefreshCw size={12} /> Updated source available —
                              Refresh Source
                            </button>
                          )}
                        </div>

                        <p
                          className="muted-text"
                          style={{
                            margin: 0,
                            background: '#F8FAFC',
                            padding: 10,
                            borderRadius: 8,
                          }}
                        >
                          {snap.overrideText || snap.promptText}
                        </p>

                        {editingOverrideSlot === slot && slot !== 'character' && (
                          <div
                            style={{
                              marginTop: 10,
                              padding: 12,
                              background: '#EFF6FF',
                              borderRadius: 10,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                            }}
                          >
                            <label className="form-label">
                              Scene-Only Text Override (Does not modify library
                              record)
                            </label>
                            <textarea
                              className="textarea"
                              rows={3}
                              value={overrideTextBuf}
                              onChange={(e) =>
                                setOverrideTextBuf(e.target.value)
                              }
                            />
                            <label className="form-label" style={{ fontSize: 12 }}>
                              Optional Compact Override for this scene
                            </label>
                            <input
                              className="input"
                              placeholder="Leave blank to use full override in Compact mode"
                              value={overrideCompactBuf}
                              onChange={(e) =>
                                setOverrideCompactBuf(e.target.value)
                              }
                            />
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={async () => {
                                  const nextSlots = {
                                    ...draft.slots,
                                    [slot]: {
                                      ...snap,
                                      overrideText:
                                        overrideTextBuf.trim() || undefined,
                                      overrideCompactText:
                                        overrideCompactBuf.trim() || undefined,
                                    },
                                  };
                                  setEditingOverrideSlot(null);
                                  await persistDraftImmediate({
                                    ...draft,
                                    slots: nextSlots,
                                  });
                                }}
                              >
                                Apply Scene Override
                              </button>
                              {snap.overrideText && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={async () => {
                                    const nextSlots = {
                                      ...draft.slots,
                                      [slot]: {
                                        ...snap,
                                        overrideText: undefined,
                                        overrideCompactText: undefined,
                                      },
                                    };
                                    setEditingOverrideSlot(null);
                                    await persistDraftImmediate({
                                      ...draft,
                                      slots: nextSlots,
                                    });
                                  }}
                                >
                                  Clear Override
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setEditingOverrideSlot(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scene Instructions */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="builder-instructions" className="form-label">
              Scene Instructions (Optional)
            </label>
            <textarea
              id="builder-instructions"
              className="textarea"
              rows={2}
              placeholder="e.g., One continuous shot. Preserve the selected outfit and background arrangement."
              value={draft.sceneInstructions}
              onChange={(e) =>
                scheduleDraftAutosave({
                  ...draft,
                  sceneInstructions: e.target.value,
                })
              }
            />
          </div>

          {/* Dialogue (Requires Character) */}
          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: 14,
            }}
          >
            <strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
              Optional Spoken Dialogue (Requires a selected Character)
            </strong>
            <div
              style={{
                display: 'grid',
                gap: 10,
                gridTemplateColumns: '1fr 2fr',
              }}
            >
              <div>
                <label htmlFor="dialogue-speaker" className="form-label">
                  Speaker Label
                </label>
                <input
                  id="dialogue-speaker"
                  className="input"
                  placeholder="e.g., Maya"
                  value={draft.dialogue?.speaker ?? ''}
                  onChange={(e) =>
                    scheduleDraftAutosave({
                      ...draft,
                      dialogue: {
                        speaker: e.target.value,
                        line: draft.dialogue?.line ?? '',
                      },
                    })
                  }
                />
              </div>
              <div>
                <label htmlFor="dialogue-line" className="form-label">
                  Spoken Line (Preserved verbatim)
                </label>
                <input
                  id="dialogue-line"
                  className="input"
                  placeholder="e.g., Akala ko hindi ka na darating."
                  value={draft.dialogue?.line ?? ''}
                  onChange={(e) =>
                    scheduleDraftAutosave({
                      ...draft,
                      dialogue: {
                        speaker: draft.dialogue?.speaker ?? '',
                        line: e.target.value,
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* Settings */}
          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: 14,
            }}
          >
            <strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
              Shot Settings (User Instructions)
            </strong>
            <p className="muted-text" style={{ margin: '0 0 10px', fontSize: 12 }}>
              Settings are recorded as user instructions and exported separately;
              they do not verify external provider capabilities.
            </p>
            <div
              style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              }}
            >
              <div>
                <label htmlFor="setting-aspect" className="form-label">
                  Aspect Ratio
                </label>
                <select
                  id="setting-aspect"
                  className="select"
                  value={draft.settings.aspectRatio ?? '16:9'}
                  onChange={(e) =>
                    scheduleDraftAutosave({
                      ...draft,
                      settings: {
                        ...draft.settings,
                        aspectRatio: e.target.value as AspectRatioOption,
                      },
                    })
                  }
                >
                  <option value="16:9">16:9 (Landscape)</option>
                  <option value="9:16">9:16 (Vertical)</option>
                  <option value="1:1">1:1 (Square)</option>
                </select>
              </div>

              <div>
                <label htmlFor="setting-duration" className="form-label">
                  Intended Duration (1–60s)
                </label>
                <input
                  id="setting-duration"
                  type="number"
                  min={1}
                  max={60}
                  className="input"
                  value={draft.settings.durationSeconds ?? 8}
                  onChange={(e) =>
                    scheduleDraftAutosave({
                      ...draft,
                      settings: {
                        ...draft.settings,
                        durationSeconds: Number(e.target.value) || undefined,
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                openConfirmDialog({
                  title: 'Reset Scene Draft?',
                  message:
                    'Clear all selected slots and instructions in this draft?',
                  confirmLabel: 'Reset Draft',
                  danger: true,
                  onConfirm: async () => {
                    await persistDraftImmediate({
                      ...draft,
                      title: 'Untitled Scene Draft',
                      slots: {},
                      extraRequiredSlots: [],
                      sceneInstructions: '',
                      dialogue: undefined,
                      manualOutputs: {},
                    });
                    closeConfirmDialog();
                  },
                })
              }
            >
              <RotateCcw size={15} /> Reset Draft
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAssemble}
            >
              <Sparkles size={16} /> Assemble Prompt
            </button>
          </div>
        </div>
      </div>

      {pickerSlot && (
        <AssetPickerModal
          slot={pickerSlot}
          activeCharacterId={draft.slots.character?.sourceId}
          mediaMap={mediaMap}
          onSelectAsset={handleSelectAssetForSlot}
          onSelectVariant={handleSelectVariantForSlot}
          onClose={() => setPickerSlot(null)}
        />
      )}

      {showTemplateModal && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-tpl-title"
        >
          <div className="modal-panel" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 id="save-tpl-title" className="section-title">
                Save Current Draft as Template
              </h2>
            </div>
            <form onSubmit={handleSaveAsTemplate}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="tpl-name" className="form-label">
                    Template Name *
                  </label>
                  <input
                    id="tpl-name"
                    className="input"
                    required
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="tpl-desc" className="form-label">
                    Description
                  </label>
                  <input
                    id="tpl-desc"
                    className="input"
                    value={tplDesc}
                    onChange={(e) => setTplDesc(e.target.value)}
                  />
                </div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={tplIncludeChar}
                    onChange={(e) => setTplIncludeChar(e.target.checked)}
                  />
                  <span>
                    Include selected character identity for private reuse
                    (excluded by default)
                  </span>
                </label>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowTemplateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
