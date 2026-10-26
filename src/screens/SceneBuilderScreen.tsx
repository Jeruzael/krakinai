import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Clapperboard,
  Palette,
  Shirt,
  Sun,
  TreePine,
  User,
  BookmarkPlus,
  CheckCircle2,
  ExternalLink,
  Lock,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import { SLOT_LABELS, validateMediaCandidate } from '../domain/validation';
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
import { StudioDialog } from '../components/StudioDialog';
import { ReferenceBoard } from '../components/ReferenceBoard';
import { runScenePreflight, type PreflightFinding } from '../domain/scenePreflight';
import { ScenePreflightDialog } from '../components/ScenePreflightDialog';

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
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>(
    'saved'
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [assemblyErrors, setAssemblyErrors] = useState<string[]>([]);
  const [detailSlot, setDetailSlot] = useState<BuilderSlot | null>(null);
  const [showPreflight, setShowPreflight] = useState(false);
  const [intentionalIds, setIntentionalIds] = useState<string[]>([]);
  const [pickerSlot, setPickerSlot] = useState<BuilderSlot | null>(null);
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

  const handleRefreshSlotSource = (
    slot: BuilderSlot,
    snap: ComponentSnapshot
  ) => {
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
      showToast(
        `Refreshed ${SLOT_LABELS[slot]} from latest source.`,
        'success'
      );
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

  const recipeLabels: Record<BuilderSlot, string> = {
    character: 'Character',
    wardrobe: 'Clothing',
    environment: 'Environment',
    action: 'Action',
    camera: 'Camera',
    lighting: 'Lighting',
    style: 'Style',
  };
  const recipeIcons = {
    character: User,
    wardrobe: Shirt,
    environment: TreePine,
    action: Clapperboard,
    camera: Camera,
    lighting: Sun,
    style: Palette,
  };
  const detailSnapshot = detailSlot ? draft.slots[detailSlot] : undefined;
  const openDetails = (slot: BuilderSlot) => {
    const selected = draft.slots[slot];
    if (!selected) {
      setPickerSlot(slot);
      return;
    }
    setOverrideTextBuf(selected.overrideText ?? selected.promptText);
    setOverrideCompactBuf(selected.overrideCompactText ?? '');
    setDetailSlot(slot);
  };
  const preflightFindings = runScenePreflight(draft, new Set(mediaMap.keys()));
  const openPreflightComponent = (component: PreflightFinding['components'][number]) => {
    setShowPreflight(false);
    if (ORDERED_BUILDER_SLOTS.includes(component as BuilderSlot)) openDetails(component as BuilderSlot);
    else requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-preflight="${component}"]`);
      const details = target?.closest('details');
      if (details) details.open = true;
      target?.focus();
    });
  };

  return (
    <div className="recipe-workspace">
      <div className="studio-header">
        <div>
          <span className="studio-eyebrow">YOUR CREATION STUDIO</span>
          <h1 className="page-title">Scene Builder</h1>
          <p className="muted-text">
            Set the visual direction. Build your scene, one layer at a time.
          </p>
        </div>
        <div className="studio-inline">
          <span
            className={`badge ${saveState === 'saved' ? 'badge-success' : saveState === 'error' ? 'badge-error' : 'badge-warning'}`}
            role="status"
          >
            {saveState === 'saved' ? (
              <>
                <CheckCircle2 size={12} /> Draft saved
              </>
            ) : saveState === 'saving' ? (
              'Saving draft…'
            ) : (
              'Save failed'
            )}
          </span>
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
        </div>
      </div>

      {saveError && (
        <div className="banner banner-error" role="alert">
          <span>
            <strong>Draft Save Failed:</strong> {saveError} Your in-memory edits
            are still shown.
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
            <ul>
              {assemblyErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="recipe-layout">
        <div className="recipe-board-panel" tabIndex={-1} data-preflight="references">
          <ReferenceBoard
            items={referenceBoardItems.map((item, index) => ({
              key: `${item.slot}-${index}-${item.mediaId}`,
              mediaId: item.mediaId,
              label: recipeLabels[item.slot],
              sourceTitle: item.sourceTitle,
              role: item.role,
            }))}
            mediaMap={mediaMap}
          />
          <details className="studio-disclosure">
            <summary>
              External Results &amp; Review{' '}
              <span className="badge">
                {draft.resultMediaLinks.length} results
              </span>
            </summary>
            <p className="recipe-board-note">
              Upload results from your external generation tool. These stay
              separate from input references.
            </p>
            <div className="form-group">
              <label htmlFor="builder-result-upload" className="form-label">
                Upload Actual Result ({draft.resultMediaLinks.length}/6)
              </label>
              <input
                id="builder-result-upload"
                type="file"
                className="input"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                onChange={handleUploadResultFile}
              />
            </div>
            <div className="recipe-result-strip">
              {draft.resultMediaLinks.map((link, index) => (
                <div
                  className="recipe-result-preview"
                  key={`${link.mediaId}-${index}`}
                >
                  <MediaThumbnail
                    media={mediaMap.get(link.mediaId)}
                    altText={link.altText || 'External result'}
                    showVideoControls={true}
                    roleBadge="External result"
                  />
                </div>
              ))}
            </div>
            <div className="form-group">
              <label htmlFor="builder-review-status" className="form-label">
                Result Review Status
              </label>
              <select
                id="builder-review-status"
                className="select"
                value={draft.reviewStatus}
                onChange={(event) =>
                  scheduleDraftAutosave({
                    ...draft,
                    reviewStatus: event.target.value as ReviewStatus,
                  })
                }
              >
                <option value="unreviewed">Unreviewed</option>
                <option value="user-approved">User-approved</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="builder-review-notes" className="form-label">
                Result Review Notes
              </label>
              <textarea
                id="builder-review-notes"
                className="textarea"
                rows={2}
                value={draft.reviewNotes}
                onChange={(event) =>
                  scheduleDraftAutosave({
                    ...draft,
                    reviewNotes: event.target.value,
                  })
                }
              />
            </div>
          </details>
        </div>

        <section className="recipe-content-panel" aria-label="Scene Recipe">
          <div className="recipe-scroll">
            <label htmlFor="builder-scene-title" className="recipe-title-label">
              Scene Title *
            </label>
            <input
              id="builder-scene-title"
              className="input recipe-title"
              placeholder="e.g., Maya Cafe Opening Shot"
              value={draft.title}
              onChange={(event) =>
                scheduleDraftAutosave({ ...draft, title: event.target.value })
              }
            />
            <div className="studio-panel-heading">
              <h2 className="section-title">Scene Recipe</h2>
              <span className="muted-text" style={{ fontSize: 12 }}>
                {Object.values(draft.slots).filter(Boolean).length} / 7 selected
              </span>
            </div>
            <div className="recipe-rows">
              {ORDERED_BUILDER_SLOTS.map((slot) => {
                const selected = draft.slots[slot];
                const required =
                  slot === 'environment' ||
                  slot === 'action' ||
                  draft.extraRequiredSlots.includes(slot) ||
                  (slot === 'character' && Boolean(draft.dialogue?.line));
                const Icon = recipeIcons[slot];
                const newer =
                  selected && getLatestLibrarySource(selected).hasNewerRevision;
                const status = selected
                  ? slot === 'character'
                    ? 'Locked'
                    : selected.overrideText
                      ? 'Scene edit'
                      : newer
                        ? 'Source updated'
                        : 'Selected'
                  : required
                    ? 'Required'
                    : 'Optional';
                return (
                  <div
                    className="recipe-row"
                    data-testid="recipe-row"
                    key={slot}
                  >
                    <button
                      type="button"
                      className="recipe-row-main"
                      onClick={() => openDetails(slot)}
                      aria-label={`Open ${recipeLabels[slot]} details: ${selected?.sourceTitle || 'Not selected'}`}
                    >
                      <span className="recipe-row-icon">
                        <Icon size={17} aria-hidden="true" />
                      </span>
                      <span className="recipe-row-copy">
                        <strong>
                          {recipeLabels[slot]}
                          {slot === 'character' && selected && (
                            <Lock size={11} aria-label="Identity locked" />
                          )}
                        </strong>
                        <span>
                          {selected?.sourceTitle ||
                            `Choose ${recipeLabels[slot].toLowerCase()} · ${required ? 'required' : 'optional'}`}
                        </span>
                      </span>
                      <span
                        className={`recipe-row-status ${!selected && required ? 'required' : ''}`}
                      >
                        {status}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary recipe-row-change"
                      aria-label={`${selected ? 'Change' : 'Select'} ${recipeLabels[slot]}`}
                      onClick={() => setPickerSlot(slot)}
                    >
                      {selected ? 'Change' : 'Select'}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="recipe-options">
              <details className="studio-disclosure">
                <summary>
                  Scene Instructions{' '}
                  <span className="muted-text">
                    {draft.sceneInstructions ? 'Added' : 'Optional'}
                  </span>
                </summary>
                <div className="form-group">
                  <label htmlFor="builder-instructions" className="form-label">
                    Scene Instructions (Optional)
                  </label>
                  <textarea
                    id="builder-instructions"
                    data-preflight="instructions"
                    className="textarea"
                    rows={3}
                    value={draft.sceneInstructions}
                    onChange={(event) =>
                      scheduleDraftAutosave({
                        ...draft,
                        sceneInstructions: event.target.value,
                      })
                    }
                  />
                </div>
              </details>
              <details className="studio-disclosure">
                <summary>
                  Dialogue{' '}
                  <span className="muted-text">
                    {draft.dialogue?.line ? 'Added' : 'Optional'}
                  </span>
                </summary>
                <p className="recipe-board-note">
                  Spoken dialogue requires a selected character. Text is
                  preserved verbatim. Delivery, language, and captions are used
                  only when you specify them; external tools may handle speech
                  differently.
                </p>
                {draft.dialogue && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      scheduleDraftAutosave({ ...draft, dialogue: undefined })
                    }
                  >
                    Clear Dialogue
                  </button>
                )}
                <div className="form-group">
                  <label htmlFor="dialogue-speaker" className="form-label">
                    Speaker Label
                  </label>
                  <input
                    id="dialogue-speaker"
                    data-preflight="dialogue"
                    className="input"
                    value={draft.dialogue?.speaker ?? ''}
                    onChange={(event) =>
                      scheduleDraftAutosave({
                        ...draft,
                        dialogue: {
                          ...draft.dialogue,
                          speaker: event.target.value,
                          line: draft.dialogue?.line ?? '',
                        },
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="dialogue-line" className="form-label">
                    Exact Spoken Line (Preserved verbatim)
                  </label>
                  <textarea
                    id="dialogue-line"
                    className="textarea"
                    rows={3}
                    value={draft.dialogue?.line ?? ''}
                    onChange={(event) =>
                      scheduleDraftAutosave({
                        ...draft,
                        dialogue: {
                          ...draft.dialogue,
                          speaker: draft.dialogue?.speaker ?? '',
                          line: event.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="dialogue-mode" className="form-label">
                    Dialogue Mode
                  </label>
                  <select
                    id="dialogue-mode"
                    className="select"
                    value={draft.dialogue?.mode ?? 'spoken'}
                    onChange={(event) =>
                      scheduleDraftAutosave({
                        ...draft,
                        dialogue: {
                          speaker: '',
                          line: '',
                          ...draft.dialogue,
                          mode: event.target.value as NonNullable<
                            SceneDraft['dialogue']
                          >['mode'],
                        },
                      })
                    }
                  >
                    <option value="spoken">Spoken, unspecified position</option>
                    <option value="on_camera">On-camera speech</option>
                    <option value="voiceover">Voiceover</option>
                    <option value="off_screen">Off-screen speech</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="dialogue-delivery" className="form-label">
                    Delivery Notes (Optional)
                  </label>
                  <textarea
                    id="dialogue-delivery"
                    className="textarea"
                    rows={2}
                    maxLength={1000}
                    value={draft.dialogue?.deliveryNotes ?? ''}
                    onChange={(event) =>
                      scheduleDraftAutosave({
                        ...draft,
                        dialogue: {
                          speaker: '',
                          line: '',
                          ...draft.dialogue,
                          deliveryNotes: event.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="dialogue-language" className="form-label">
                    Language (Optional)
                  </label>
                  <input
                    id="dialogue-language"
                    className="input"
                    maxLength={100}
                    value={draft.dialogue?.language ?? ''}
                    onChange={(event) =>
                      scheduleDraftAutosave({
                        ...draft,
                        dialogue: {
                          speaker: '',
                          line: '',
                          ...draft.dialogue,
                          language: event.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="dialogue-captions" className="form-label">
                    Captions
                  </label>
                  <select
                    id="dialogue-captions"
                    className="select"
                    value={draft.dialogue?.captionPreference ?? 'unspecified'}
                    onChange={(event) =>
                      scheduleDraftAutosave({
                        ...draft,
                        dialogue: {
                          speaker: '',
                          line: '',
                          ...draft.dialogue,
                          captionPreference: event.target.value as NonNullable<
                            SceneDraft['dialogue']
                          >['captionPreference'],
                        },
                      })
                    }
                  >
                    <option value="unspecified">Not specified</option>
                    <option value="none">No on-screen captions</option>
                    <option value="requested">Captions requested</option>
                  </select>
                </div>
              </details>
              <details className="studio-disclosure">
                <summary>
                  Shot Settings{' '}
                  <span className="muted-text">
                    {draft.settings.aspectRatio || '16:9'} ·{' '}
                    {draft.settings.durationSeconds ?? 8}s
                  </span>
                </summary>
                <p className="recipe-board-note">
                  Instructions for your external tool; provider capabilities are
                  not verified.
                </p>
                <div className="recipe-settings-grid">
                  <div className="form-group">
                    <label htmlFor="setting-aspect" className="form-label">
                      Aspect Ratio
                    </label>
                    <select
                      id="setting-aspect"
                      data-preflight="settings"
                      className="select"
                      value={draft.settings.aspectRatio ?? '16:9'}
                      onChange={(event) =>
                        scheduleDraftAutosave({
                          ...draft,
                          settings: {
                            ...draft.settings,
                            aspectRatio: event.target
                              .value as AspectRatioOption,
                          },
                        })
                      }
                    >
                      <option value="16:9">16:9 (Landscape)</option>
                      <option value="9:16">9:16 (Vertical)</option>
                      <option value="1:1">1:1 (Square)</option>
                    </select>
                  </div>
                  <div className="form-group">
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
                      onChange={(event) =>
                        scheduleDraftAutosave({
                          ...draft,
                          settings: {
                            ...draft.settings,
                            durationSeconds:
                              Number(event.target.value) || undefined,
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="setting-notes" className="form-label">
                    Tool Notes
                  </label>
                  <textarea
                    id="setting-notes"
                    className="textarea"
                    rows={2}
                    value={draft.settings.toolNotes ?? ''}
                    onChange={(event) =>
                      scheduleDraftAutosave({
                        ...draft,
                        settings: {
                          ...draft.settings,
                          toolNotes: event.target.value,
                        },
                      })
                    }
                  />
                </div>
              </details>
              <details className="studio-disclosure">
                <summary>Draft options</summary>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
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
                  <RotateCcw size={14} /> Reset Draft
                </button>
              </details>
            </div>
          </div>
          <div
            className="recipe-actions"
            role="region"
            aria-label="Workspace actions"
          >
            <span className="muted-text">
              Stored on this browser · Rev {draft.inputRevision}
            </span>
            <div className="recipe-action-buttons">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPreflight(true)}>
                Preflight · {preflightFindings.length} findings
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => persistDraftImmediate(draft, false)}
              >
                Save Draft
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
        </section>
      </div>

      {showPreflight && <ScenePreflightDialog findings={preflightFindings} onClose={() => setShowPreflight(false)} onViewSource={openPreflightComponent} onEditComponent={openPreflightComponent} intentionalIds={intentionalIds} onIntentionalIdsChange={setIntentionalIds} />}
      {detailSlot && detailSnapshot && (
        <StudioDialog
          title={`${recipeLabels[detailSlot]} details`}
          onClose={() => setDetailSlot(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  const slot = detailSlot;
                  setDetailSlot(null);
                  handleRemoveSlot(slot);
                }}
              >
                <Trash2 size={14} /> Remove {recipeLabels[detailSlot]}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const slot = detailSlot;
                  setDetailSlot(null);
                  setPickerSlot(slot);
                }}
              >
                Change {recipeLabels[detailSlot]}
              </button>
            </>
          }
        >
          <h3 style={{ marginTop: 0 }}>{detailSnapshot.sourceTitle}</h3>
          <div className="studio-inline">
            <span className="badge">
              {detailSnapshot.sourceType} · Rev {detailSnapshot.sourceRevision}
            </span>
            {detailSlot === 'character' && (
              <span className="badge badge-primary">
                <Lock size={12} /> Identity text locked in builder
              </span>
            )}
            {detailSnapshot.overrideText && (
              <span className="badge badge-warning">
                Scene-only override active
              </span>
            )}
          </div>
          {detailSlot === 'character' ? (
            <>
              <p className="muted-text">
                Reuse this identity verbatim. To change its source, use the
                original character record.
              </p>
              <div
                className="studio-prompt-text"
                tabIndex={0}
                role="region"
                aria-label="Complete Character prompt"
              >
                {detailSnapshot.promptText}
              </div>
            </>
          ) : (
            <>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label htmlFor="scene-override-text" className="form-label">
                  Scene-Only Text Override (Does not modify library record)
                </label>
                <textarea
                  id="scene-override-text"
                  className="textarea"
                  rows={8}
                  value={overrideTextBuf}
                  onChange={(event) => setOverrideTextBuf(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="scene-override-compact" className="form-label">
                  Optional Compact Override for this scene
                </label>
                <input
                  id="scene-override-compact"
                  className="input"
                  value={overrideCompactBuf}
                  placeholder="Leave blank to use full override in Compact mode"
                  onChange={(event) =>
                    setOverrideCompactBuf(event.target.value)
                  }
                />
              </div>
              <div className="studio-toolbar">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    const nextSlots = {
                      ...draft.slots,
                      [detailSlot]: {
                        ...detailSnapshot,
                        overrideText: overrideTextBuf.trim() || undefined,
                        overrideCompactText:
                          overrideCompactBuf.trim() || undefined,
                      },
                    };
                    setDetailSlot(null);
                    await persistDraftImmediate({ ...draft, slots: nextSlots });
                  }}
                >
                  Apply Scene Override
                </button>
                {detailSnapshot.overrideText && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={async () => {
                      const nextSlots = {
                        ...draft.slots,
                        [detailSlot]: {
                          ...detailSnapshot,
                          overrideText: undefined,
                          overrideCompactText: undefined,
                        },
                      };
                      setDetailSlot(null);
                      await persistDraftImmediate({
                        ...draft,
                        slots: nextSlots,
                      });
                    }}
                  >
                    Clear Override
                  </button>
                )}
              </div>
            </>
          )}
          <div className="studio-toolbar" style={{ marginTop: 18 }}>
            {detailSnapshot.sourceType !== 'template' && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setDetailSlot(null);
                  navigate(
                    detailSnapshot.sourceType === 'asset'
                      ? `/prompts/${detailSnapshot.sourceId}`
                      : `/variants/${detailSnapshot.sourceId}`
                  );
                }}
              >
                <ExternalLink size={14} /> View Source
              </button>
            )}
            {getLatestLibrarySource(detailSnapshot).hasNewerRevision && (
              <button
                type="button"
                className="btn btn-tint btn-sm"
                onClick={() => {
                  const slot = detailSlot;
                  setDetailSlot(null);
                  handleRefreshSlotSource(slot, detailSnapshot);
                }}
              >
                <RefreshCw size={14} /> Refresh Source
              </button>
            )}
          </div>
        </StudioDialog>
      )}

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
        <StudioDialog
          title="Save Current Draft as Template"
          onClose={() => setShowTemplateModal(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowTemplateModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="studio-template-form"
                className="btn btn-primary"
              >
                Save Template
              </button>
            </>
          }
        >
          <form id="studio-template-form" onSubmit={handleSaveAsTemplate}>
            <div className="form-group">
              <label htmlFor="tpl-name" className="form-label">
                Template Name *
              </label>
              <input
                id="tpl-name"
                className="input"
                required
                value={tplName}
                onChange={(event) => setTplName(event.target.value)}
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
                onChange={(event) => setTplDesc(event.target.value)}
              />
            </div>
            <label className="studio-inline">
              <input
                type="checkbox"
                checked={tplIncludeChar}
                onChange={(event) => setTplIncludeChar(event.target.checked)}
              />
              Include selected character identity for private reuse (excluded by
              default)
            </label>
          </form>
        </StudioDialog>
      )}
    </div>
  );
};
