import React, { useId, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookmarkCheck,
  Copy,
  Download,
  Edit3,
  FolderPlus,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import {
  assembleScenePrompt,
  formatSceneExportTxt,
  isManualOutputStale,
  ORDERED_BUILDER_SLOTS,
} from '../domain/promptAssembler';
import { validateMediaCandidate } from '../domain/validation';
import type {
  MediaAsset,
  MediaLink,
  OutputMode,
  ReviewStatus,
} from '../types/domain';
import {
  createDraftFromSavedScene,
  saveMediaAsset,
  saveSceneDraft,
  saveSceneFromDraft,
  updateSavedSceneReviewAndResults,
} from '../storage/db';
import { downloadBlobAsFile } from '../hooks/useObjectUrl';
import { MediaThumbnail } from '../components/MediaThumbnail';
import {
  ReferenceBoard,
  type StudioReference,
} from '../components/ReferenceBoard';
import './promptOutput.css';

const OUTPUT_TABS = [
  { value: 'prompt', label: 'Prompt' },
  { value: 'references', label: 'References' },
  { value: 'review', label: 'Review' },
] as const;
const OUTPUT_MODES: { value: OutputMode; label: string }[] = [
  { value: 'full', label: 'Full Prompt' },
  { value: 'structured', label: 'Structured' },
  { value: 'compact', label: 'Compact' },
];
const COMPONENT_LABELS = {
  character: 'Character',
  wardrobe: 'Clothing / Outfit',
  environment: 'Environment',
  action: 'Action',
  camera: 'Camera',
  lighting: 'Lighting',
  style: 'Style',
};

function handleTabKeys(event: React.KeyboardEvent<HTMLDivElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  );
  const index = tabs.indexOf(event.target as HTMLButtonElement);
  if (index < 0) return;
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
          tabs.length;
  event.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}

export const PromptOutputScreen: React.FC<{ id: string }> = ({ id }) => {
  const {
    snapshot,
    navigate,
    copyText,
    openCollectionModal,
    openConfirmDialog,
    closeConfirmDialog,
    refreshSnapshot,
    showToast,
  } = useLibrary();

  const [mode, setMode] = useState<OutputMode>('full');
  const [activeTab, setActiveTab] =
    useState<(typeof OUTPUT_TABS)[number]['value']>('prompt');
  const [reviewNotesBuffer, setReviewNotesBuffer] = useState<string | null>(
    null
  );
  const tabId = useId();
  const [isEditingManual, setIsEditingManual] = useState(false);
  const [manualBuf, setManualBuf] = useState('');
  const [acknowledgedStaleModes, setAcknowledgedStaleModes] = useState<
    Partial<Record<OutputMode, boolean>>
  >({});

  const mediaMap = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const m of snapshot?.media ?? []) {
      map.set(m.id, m);
    }
    return map;
  }, [snapshot]);

  if (!snapshot) return null;

  const isSavedScene = id.startsWith('scene_');
  const savedScene = isSavedScene
    ? snapshot.scenes.find((s) => s.id === id)
    : undefined;
  const draft = !isSavedScene
    ? snapshot.drafts.find((d) => d.id === id)
    : undefined;

  if (!savedScene && !draft) {
    return (
      <div className="card">
        <h1 className="section-title">Scene or Draft Not Found</h1>
        <p className="muted-text">
          This output record ({id}) is no longer available.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/builder')}
        >
          Open Scene Builder
        </button>
      </div>
    );
  }

  const assembled = draft ? assembleScenePrompt(draft) : null;

  const title = savedScene ? savedScene.title : draft!.title;
  const settings = savedScene ? savedScene.settings : draft!.settings;
  const avoidText = savedScene
    ? (savedScene.avoidText ?? '')
    : (assembled?.avoidText ?? '');
  const references = savedScene
    ? savedScene.references
    : (assembled?.references ?? []);

  const manualOverride = savedScene
    ? savedScene.manualOutputs[mode]
    : draft!.manualOutputs[mode];

  const isStale =
    !isSavedScene &&
    draft &&
    isManualOutputStale(manualOverride, draft.inputRevision) &&
    !acknowledgedStaleModes[mode];

  const activeText = savedScene
    ? savedScene.outputs[mode]
    : (manualOverride?.text ?? assembled?.outputs[mode] ?? '');

  const handleCopyActivePrompt = async () => {
    if (isStale) {
      openConfirmDialog({
        title: 'Stale Manual Edit Warning',
        message:
          'These manual edits were based on older scene inputs. Do you want to retain and copy your manual edits anyway, or discard them and reassemble from the current builder inputs?',
        confirmLabel: 'Retain & Copy Manual Edits',
        cancelLabel: 'Cancel',
        onConfirm: async () => {
          setAcknowledgedStaleModes((prev) => ({ ...prev, [mode]: true }));
          closeConfirmDialog();
          await copyText(activeText, 'Prompt copied.');
        },
      });
      return;
    }
    await copyText(activeText, 'Prompt copied.');
  };

  const handleSaveManualOverride = async () => {
    if (!draft) return;
    const nextManual = {
      ...draft.manualOutputs,
      [mode]: {
        text: manualBuf,
        basedOnInputRevision: draft.inputRevision,
        updatedAt: new Date().toISOString(),
      },
    };
    await saveSceneDraft({
      ...draft,
      manualOutputs: nextManual,
      bumpInputRevision: false,
    });
    await refreshSnapshot();
    setIsEditingManual(false);
    showToast(`Saved manual edit for ${mode} output.`, 'success');
  };

  const handleDiscardManualOverride = () => {
    if (!draft || !manualOverride) return;
    openConfirmDialog({
      title: 'Discard Manual Output Edits?',
      message: `Discard your manual edits for the ${mode.toUpperCase()} tab and restore the deterministic assembled output?`,
      confirmLabel: 'Discard & Reassemble',
      danger: true,
      onConfirm: async () => {
        const nextManual = { ...draft.manualOutputs };
        delete nextManual[mode];
        await saveSceneDraft({
          ...draft,
          manualOutputs: nextManual,
          bumpInputRevision: false,
        });
        await refreshSnapshot();
        setIsEditingManual(false);
        closeConfirmDialog();
        showToast('Restored deterministic assembled output.', 'info');
      },
    });
  };

  const handleDownloadTxt = () => {
    const txt = formatSceneExportTxt({
      title,
      mode,
      promptText: activeText,
      settings,
      avoidText,
      references,
    });
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const safeName =
      title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) || 'scene_prompt';
    downloadBlobAsFile(blob, `${safeName}_${mode}.txt`);
    showToast('Downloaded .txt prompt & reference checklist.', 'success');
  };

  const handleSaveScene = async () => {
    if (!draft) return;
    try {
      const saved = await saveSceneFromDraft(draft.id);
      await refreshSnapshot();
      showToast(`Saved immutable scene "${saved.title}".`, 'success');
      navigate(`/output/${saved.id}`, true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to save scene.',
        'error'
      );
    }
  };

  const handleUploadResultOnSavedScene = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const targetLinks = savedScene
      ? savedScene.resultMediaLinks
      : draft!.resultMediaLinks;

    const check = validateMediaCandidate({
      name: file.name,
      type: file.type,
      size: file.size,
      existingCount: targetLinks.length,
    });
    if (!check.valid) {
      showToast(check.error || 'Invalid result file.', 'error');
      return;
    }

    try {
      const savedMedia = await saveMediaAsset({
        filename: file.name,
        mimeType: file.type,
        blob: file,
      });
      const nextLinks = [
        ...targetLinks,
        {
          mediaId: savedMedia.id,
          role: 'result' as const,
          altText: `Result for ${title}`,
          order: targetLinks.length,
          filename: savedMedia.filename,
          mimeType: savedMedia.mimeType,
        },
      ];

      if (savedScene) {
        await updateSavedSceneReviewAndResults({
          sceneId: savedScene.id,
          resultMediaLinks: nextLinks,
          reviewNotes: savedScene.reviewNotes,
          reviewStatus: savedScene.reviewStatus,
        });
      } else if (draft) {
        await saveSceneDraft({
          ...draft,
          resultMediaLinks: nextLinks,
          bumpInputRevision: false,
        });
      }
      await refreshSnapshot();
      showToast('Uploaded actual generation result.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to store result.',
        'error'
      );
    }
    e.target.value = '';
  };

  const record = savedScene ?? draft!;
  // The display keeps every slot association, including repeated links to one blob.
  // Exports continue to use the original assembler/saved-scene reference checklist.
  const studioReferences: StudioReference[] = ORDERED_BUILDER_SLOTS.flatMap(
    (slot) => {
      const component = record.slots[slot];
      return (component?.mediaLinks ?? []).map((link, index) => ({
        key: `${slot}_${index}_${link.mediaId}`,
        mediaId: link.mediaId,
        label: [COMPONENT_LABELS[slot], link.viewLabel]
          .filter(Boolean)
          .join(' · '),
        sourceTitle: component!.sourceTitle,
        role: link.role,
        altText: link.altText,
        filename: link.filename,
      }));
    }
  );
  // Match checklist entries to existing slot associations one at a time so an
  // unavailable file or repeated media ID cannot erase a distinct association.
  const referenceIdentity = (link: MediaLink) =>
    JSON.stringify([
      link.mediaId,
      link.role,
      link.altText,
      link.viewLabel ?? '',
      link.filename ?? '',
    ]);
  const unmatchedSlotReferences = ORDERED_BUILDER_SLOTS.flatMap((slot) =>
    (record.slots[slot]?.mediaLinks ?? []).map(referenceIdentity)
  );
  references.forEach((link, index) => {
    const matchingSlotIndex = unmatchedSlotReferences.indexOf(
      referenceIdentity(link)
    );
    if (matchingSlotIndex >= 0) {
      unmatchedSlotReferences.splice(matchingSlotIndex, 1);
    } else {
      studioReferences.push({
        key: `checklist_${index}_${link.mediaId}`,
        mediaId: link.mediaId,
        label: 'Scene reference',
        sourceTitle: title,
        role: link.role,
        altText: link.altText,
        filename: link.filename,
      });
    }
  });
  const activeModeLabel = OUTPUT_MODES.find(
    (item) => item.value === mode
  )!.label;
  const resultLinks =
    savedScene?.resultMediaLinks ?? draft?.resultMediaLinks ?? [];
  const reviewNotes = reviewNotesBuffer ?? record.reviewNotes;

  const saveReviewNotes = async () => {
    if (reviewNotesBuffer === null || reviewNotes === record.reviewNotes)
      return;
    const submittedNotes = reviewNotes;
    try {
      if (savedScene) {
        await updateSavedSceneReviewAndResults({
          sceneId: savedScene.id,
          resultMediaLinks: savedScene.resultMediaLinks,
          reviewNotes: submittedNotes,
          reviewStatus: savedScene.reviewStatus,
        });
      } else if (draft) {
        await saveSceneDraft({
          ...draft,
          reviewNotes: submittedNotes,
          bumpInputRevision: false,
        });
      }
      await refreshSnapshot();
      setReviewNotesBuffer((current) =>
        current === submittedNotes ? null : current
      );
      showToast('Saved scene review notes.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to save review notes.',
        'error'
      );
    }
  };

  return (
    <div className="output-workspace">
      <header className="output-header">
        <div className="output-heading">
          <div className="output-record-meta">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                navigate(draft ? `/builder/${draft.id}` : '/scenes')
              }
            >
              <ArrowLeft size={15} />{' '}
              {draft ? 'Back to Builder' : 'Back to Saved Scenes'}
            </button>
            <span
              className={`badge ${savedScene ? 'badge-success' : 'badge-warning'}`}
            >
              {savedScene
                ? 'Saved Scene (Immutable Snapshot)'
                : `Draft Output (Input Rev ${draft?.inputRevision})`}
            </span>
          </div>
          <h1 className="page-title">{title}</h1>
          <p className="muted-text output-subtitle">
            Your prompt and reference files, ready for your external generator.
          </p>
        </div>
        <div
          className="output-settings"
          aria-label="Settings (User Instructions)"
        >
          <span className="badge">
            Aspect Ratio: {settings.aspectRatio || '16:9'}
          </span>
          <span className="badge">
            Intended Duration:{' '}
            {settings.durationSeconds ? `${settings.durationSeconds}s` : 'N/A'}
          </span>
        </div>
      </header>

      <div className="card output-main-card">
        <div
          className="tabs-bar output-workspace-tabs"
          role="tablist"
          aria-label="Output workspace"
          onKeyDown={handleTabKeys}
        >
          {OUTPUT_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              id={`${tabId}-tab-${tab.value}`}
              aria-selected={activeTab === tab.value}
              aria-controls={`${tabId}-panel-${tab.value}`}
              tabIndex={activeTab === tab.value ? 0 : -1}
              className={`tab-btn ${activeTab === tab.value ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
              {tab.value === 'references' && (
                <span className="output-tab-count" aria-hidden="true">
                  {studioReferences.length}
                </span>
              )}
              {tab.value === 'review' && resultLinks.length > 0 && (
                <span className="output-tab-count" aria-hidden="true">
                  {resultLinks.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <section
          role="tabpanel"
          id={`${tabId}-panel-prompt`}
          aria-labelledby={`${tabId}-tab-prompt`}
          tabIndex={0}
          hidden={activeTab !== 'prompt'}
          className="output-tab-panel"
        >
          <div className="output-format-header">
            <div
              className="tabs-bar output-format-tabs"
              role="tablist"
              aria-label="Prompt format"
              onKeyDown={handleTabKeys}
            >
              {OUTPUT_MODES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  id={`${tabId}-mode-${item.value}`}
                  aria-selected={mode === item.value}
                  aria-controls={`${tabId}-mode-panel-${item.value}`}
                  tabIndex={mode === item.value ? 0 : -1}
                  className={`tab-btn ${mode === item.value ? 'active' : ''}`}
                  onClick={() => {
                    setMode(item.value);
                    setIsEditingManual(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="output-edit-actions">
              {manualOverride && (
                <span className="badge badge-warning">Edited output</span>
              )}
              {!isSavedScene && !isEditingManual && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setManualBuf(activeText);
                    setIsEditingManual(true);
                  }}
                >
                  <Edit3 size={14} /> Edit This Output
                </button>
              )}
              {!isSavedScene && manualOverride && !isEditingManual && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDiscardManualOverride}
                >
                  <RotateCcw size={14} /> Reset to Assembled
                </button>
              )}
            </div>
          </div>
          <p className="muted-text output-order">
            Character → Clothing → Environment → Action → Camera → Lighting →
            Style → Instructions → Dialogue
          </p>
          {OUTPUT_MODES.map((item) => (
            <div
              key={item.value}
              role="tabpanel"
              id={`${tabId}-mode-panel-${item.value}`}
              aria-labelledby={`${tabId}-mode-${item.value}`}
              tabIndex={0}
              hidden={mode !== item.value}
            >
              {mode === item.value &&
                (isEditingManual ? (
                  <div className="output-manual-editor">
                    <label htmlFor={`${tabId}-manual`} className="form-label">
                      Manual prompt output
                    </label>
                    <textarea
                      id={`${tabId}-manual`}
                      className="textarea output-manual-textarea"
                      rows={9}
                      value={manualBuf}
                      onChange={(e) => setManualBuf(e.target.value)}
                    />
                    <div className="output-edit-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setIsEditingManual(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleSaveManualOverride}
                      >
                        Save Manual Output Override
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    role="region"
                    aria-label="Complete prompt text"
                    tabIndex={0}
                    className="output-prompt-viewer"
                  >
                    {activeText}
                  </div>
                ))}
            </div>
          ))}
          <details className="output-disclosure">
            <summary>Avoid / Negative Text (Separate)</summary>
            <div className="output-disclosure-body">
              <p className="muted-text output-negative-text">
                {avoidText ||
                  'No avoid / negative text specified for this scene.'}
              </p>
              {avoidText && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyText(avoidText, 'Avoid text copied.')}
                >
                  <Copy size={13} /> Copy Avoid Text
                </button>
              )}
            </div>
          </details>
          <details className="output-disclosure">
            <summary>Settings (User Instructions)</summary>
            <div className="output-disclosure-body">
              <p className="muted-text">
                Set these options manually in your external generator.
              </p>
              <p className="muted-text output-negative-text">
                {settings.toolNotes || 'No additional tool / provider notes.'}
              </p>
            </div>
          </details>
        </section>

        <section
          role="tabpanel"
          id={`${tabId}-panel-references`}
          aria-labelledby={`${tabId}-tab-references`}
          tabIndex={0}
          hidden={activeTab !== 'references'}
          className="output-tab-panel"
        >
          <p className="muted-text output-reference-guidance">
            Copying prompt text does not upload reference images or videos to an
            external AI tool. Download and attach these reference files
            manually:
          </p>
          <ReferenceBoard
            items={studioReferences}
            mediaMap={mediaMap}
            title="Reference Files Checklist"
            collapseThumbnails
            downloadable
          />
        </section>

        <section
          role="tabpanel"
          id={`${tabId}-panel-review`}
          aria-labelledby={`${tabId}-tab-review`}
          tabIndex={0}
          hidden={activeTab !== 'review'}
          className="output-tab-panel"
        >
          <div className="output-review-header">
            <div>
              <h2 className="section-title">
                Uploaded External Results &amp; Review
              </h2>
              <p className="muted-text output-reference-guidance">
                Upload the actual image or video produced by your external tool
                to review alongside this preserved prompt specification.
              </p>
            </div>
            <label
              htmlFor={`${tabId}-result-upload`}
              className="btn btn-secondary btn-sm output-upload-label"
            >
              <Upload size={14} /> Upload Actual Result
              <input
                id={`${tabId}-result-upload`}
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                onChange={handleUploadResultOnSavedScene}
                className="output-upload-input"
              />
            </label>
          </div>
          {resultLinks.length > 0 ? (
            <div className="output-result-grid">
              {resultLinks.map((rLink, index) => (
                <div
                  key={`${rLink.mediaId}_${index}`}
                  className="output-result-media"
                >
                  <MediaThumbnail
                    media={mediaMap.get(rLink.mediaId)}
                    altText={rLink.altText}
                    showVideoControls
                    roleBadge="Actual Result"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="output-review-empty muted-text">
              No actual results uploaded yet.
            </div>
          )}
          <div className="output-review-form">
            <label htmlFor={`${tabId}-review-status`} className="form-label">
              Review Status:
            </label>
            <select
              id={`${tabId}-review-status`}
              className="select"
              value={record.reviewStatus}
              onChange={async (e) => {
                if (savedScene) {
                  await updateSavedSceneReviewAndResults({
                    sceneId: savedScene.id,
                    resultMediaLinks: savedScene.resultMediaLinks,
                    reviewNotes,
                    reviewStatus: e.target.value as ReviewStatus,
                  });
                } else if (draft) {
                  await saveSceneDraft({
                    ...draft,
                    reviewNotes,
                    reviewStatus: e.target.value as ReviewStatus,
                    bumpInputRevision: false,
                  });
                }
                await refreshSnapshot();
                showToast('Updated scene review status.', 'success');
              }}
            >
              <option value="unreviewed">Unreviewed</option>
              <option value="user-approved">User-approved</option>
            </select>
            <label htmlFor={`${tabId}-review-notes`} className="form-label">
              Review Notes
            </label>
            <textarea
              id={`${tabId}-review-notes`}
              className="textarea"
              rows={3}
              value={reviewNotes}
              onChange={(e) => setReviewNotesBuffer(e.target.value)}
              onBlur={(event) => {
                if (event.relatedTarget?.id !== `${tabId}-save-review-notes`)
                  void saveReviewNotes();
              }}
            />
            <button
              id={`${tabId}-save-review-notes`}
              type="button"
              className="btn btn-secondary btn-sm output-save-notes"
              onClick={saveReviewNotes}
            >
              Save Review Notes
            </button>
          </div>
        </section>
      </div>

      <footer
        className="card output-action-footer"
        role="region"
        aria-label="Prompt actions"
      >
        {isStale && (
          <div className="banner banner-warning output-stale-warning">
            <div className="output-stale-message">
              <AlertTriangle size={18} />
              <span>
                <strong>Stale manual edit:</strong> These edits were based on
                older scene inputs. Review before copying or discard to
                reassemble.
              </span>
            </div>
            <div className="output-footer-buttons">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setAcknowledgedStaleModes((p) => ({ ...p, [mode]: true }))
                }
              >
                Keep Manual Edit
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDiscardManualOverride}
              >
                <RotateCcw size={13} /> Discard &amp; Reassemble
              </button>
            </div>
          </div>
        )}
        <div className="output-footer-row">
          <div className="output-footer-context">
            <strong>{activeModeLabel}</strong>
            <span className="muted-text">
              {activeText.length.toLocaleString()} characters · complete output
            </span>
          </div>
          <div className="output-footer-buttons">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownloadTxt}
            >
              <Download size={16} /> Download .txt
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCopyActivePrompt}
            >
              <Copy size={16} /> Copy Prompt
            </button>
            {draft && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveScene}
              >
                <BookmarkCheck size={16} /> Save Scene
              </button>
            )}
            {savedScene && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    openCollectionModal({
                      type: 'scene',
                      id: savedScene.id,
                      title: savedScene.title,
                    })
                  }
                >
                  <FolderPlus size={16} /> Add to Collection
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    const copy = await createDraftFromSavedScene(savedScene.id);
                    await refreshSnapshot();
                    showToast(
                      'Created editable copy in Scene Builder.',
                      'success'
                    );
                    navigate(`/builder/${copy.id}`);
                  }}
                >
                  <Edit3 size={16} /> Edit a Copy
                </button>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
