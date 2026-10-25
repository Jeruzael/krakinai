import React, { useMemo, useState } from 'react';
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
} from '../domain/promptAssembler';
import { validateMediaCandidate } from '../domain/validation';
import type {
  MediaAsset,
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
    ? savedScene.avoidText ?? ''
    : assembled?.avoidText ?? '';
  const references = savedScene
    ? savedScene.references
    : assembled?.references ?? [];

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
    : manualOverride?.text ?? assembled?.outputs[mode] ?? '';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 6,
            }}
          >
            {draft ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => navigate(`/builder/${draft.id}`)}
              >
                <ArrowLeft size={15} /> Back to Builder
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/scenes')}
              >
                <ArrowLeft size={15} /> Back to Saved Scenes
              </button>
            )}
            <span
              className={`badge ${
                savedScene ? 'badge-success' : 'badge-warning'
              }`}
            >
              {savedScene
                ? 'Saved Scene (Immutable Snapshot)'
                : `Draft Output (Input Rev ${draft?.inputRevision})`}
            </span>
          </div>
          <h1 className="page-title">{title}</h1>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDownloadTxt}
          >
            <Download size={16} /> Download .txt
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
                  showToast('Created editable copy in Scene Builder.', 'success');
                  navigate(`/builder/${copy.id}`);
                }}
              >
                <Edit3 size={16} /> Edit a Copy
              </button>
            </>
          )}
        </div>
      </div>

      {/* Output Tabs: Full Prompt, Structured, Compact */}
      <div className="card">
        <div className="tabs-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'full'}
            className={`tab-btn ${mode === 'full' ? 'active' : ''}`}
            onClick={() => {
              setMode('full');
              setIsEditingManual(false);
            }}
          >
            Full Prompt
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'structured'}
            className={`tab-btn ${mode === 'structured' ? 'active' : ''}`}
            onClick={() => {
              setMode('structured');
              setIsEditingManual(false);
            }}
          >
            Structured
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'compact'}
            className={`tab-btn ${mode === 'compact' ? 'active' : ''}`}
            onClick={() => {
              setMode('compact');
              setIsEditingManual(false);
            }}
          >
            Compact
          </button>
        </div>

        {isStale && (
          <div className="banner banner-warning">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} />
              <span>
                <strong>Stale manual edit:</strong> These edits were based on
                older scene inputs. Review before copying or discard to
                reassemble.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
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
                <RotateCcw size={13} /> Discard & Reassemble
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="muted-text" style={{ fontSize: 13 }}>
              Order: Character → Clothing → Environment → Action → Camera →
              Lighting → Style → Instructions → Dialogue
            </span>
            {manualOverride && (
              <span className="badge badge-warning">Edited output</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
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
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleCopyActivePrompt}
            >
              <Copy size={14} /> Copy Prompt
            </button>
          </div>
        </div>

        {isEditingManual ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              className="textarea"
              rows={9}
              value={manualBuf}
              onChange={(e) => setManualBuf(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
            style={{
              background: '#F8FAFC',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: 18,
              fontSize: 16,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              userSelect: 'text',
            }}
          >
            {activeText}
          </div>
        )}
      </div>

      {/* Separate Avoid / Negative Text & Settings */}
      <div className="split-layout detail-split">
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <h2 className="section-title">Avoid / Negative Text (Separate)</h2>
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
          <p className="muted-text" style={{ margin: 0 }}>
            {avoidText || 'No avoid / negative text specified for this scene.'}
          </p>
        </div>

        <div className="card">
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            Settings (User Instructions)
          </h2>
          <p className="muted-text" style={{ margin: '0 0 8px', fontSize: 12 }}>
            Set these options manually in your external generator.
          </p>
          <div className="tag-list">
            <span className="badge">
              Aspect Ratio: {settings.aspectRatio || '16:9'}
            </span>
            <span className="badge">
              Intended Duration:{' '}
              {settings.durationSeconds ? `${settings.durationSeconds}s` : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Reference Checklist (Must be attached manually in external tool) */}
      <div className="card">
        <h2 className="section-title" style={{ marginBottom: 6 }}>
          Reference Files Checklist (Attach Separately in Your External Tool)
        </h2>
        <p className="muted-text" style={{ margin: '0 0 14px', fontSize: 13 }}>
          Copying prompt text does not upload reference images or videos to an
          external AI tool. Download and attach these reference files manually:
        </p>

        {references.length === 0 ? (
          <p className="muted-text">
            No reference files attached to the selected components.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            }}
          >
            {references.map((ref, idx) => {
              const m = mediaMap.get(ref.mediaId);
              return (
                <div
                  key={`${ref.mediaId}_${idx}`}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ height: 120, borderRadius: 8, overflow: 'hidden' }}>
                    <MediaThumbnail media={m} altText={ref.altText} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {m?.filename || ref.filename || ref.mediaId}
                  </div>
                  {m && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => downloadBlobAsFile(m.blob, m.filename)}
                    >
                      <Download size={13} /> Download Reference
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Result Upload & Review on Output Screen */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div>
            <h2 className="section-title">Uploaded External Results & Review</h2>
            <p className="muted-text" style={{ margin: '4px 0 0', fontSize: 13 }}>
              Upload the actual image or video produced by your external tool to
              review alongside this preserved prompt specification.
            </p>
          </div>
          <div>
            <label
              htmlFor="output-result-upload"
              className="btn btn-secondary btn-sm"
              style={{ cursor: 'pointer' }}
            >
              <Upload size={14} /> Upload Actual Result
            </label>
            <input
              id="output-result-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              onChange={handleUploadResultOnSavedScene}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {(savedScene?.resultMediaLinks ?? draft?.resultMediaLinks ?? [])
          .length > 0 && (
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              marginBottom: 14,
            }}
          >
            {(savedScene?.resultMediaLinks ?? draft?.resultMediaLinks ?? []).map(
              (rLink, idx) => {
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
                    <div style={{ height: 160 }}>
                      <MediaThumbnail
                        media={media}
                        altText={rLink.altText}
                        showVideoControls={true}
                        roleBadge="Actual Result"
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}

        {savedScene && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <label htmlFor="saved-scene-review" className="form-label">
              Review Status:
            </label>
            <select
              id="saved-scene-review"
              className="select"
              style={{ width: 200 }}
              value={savedScene.reviewStatus}
              onChange={async (e) => {
                await updateSavedSceneReviewAndResults({
                  sceneId: savedScene.id,
                  resultMediaLinks: savedScene.resultMediaLinks,
                  reviewNotes: savedScene.reviewNotes,
                  reviewStatus: e.target.value as ReviewStatus,
                });
                await refreshSnapshot();
                showToast('Updated scene review status.', 'success');
              }}
            >
              <option value="unreviewed">Unreviewed</option>
              <option value="user-approved">User-approved</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
};
