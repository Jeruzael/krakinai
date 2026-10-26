import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import {
  CATEGORY_LABELS,
  SLOT_LABELS,
  VARIANT_TYPE_TO_SLOT,
  validateMediaCandidate,
} from '../domain/validation';
import type {
  MediaAsset,
  MediaLink,
  MediaRole,
  PromptCategory,
  ReviewStatus,
  VariantType,
} from '../types/domain';
import {
  saveMediaAsset,
  savePromptAsset,
  saveVariant,
} from '../storage/db';
import { MediaMetadataEditor } from '../components/MediaMetadataEditor';
import { MediaThumbnail } from '../components/MediaThumbnail';

interface EditorScreenProps {
  mode: 'create-asset' | 'edit-asset' | 'create-variant' | 'edit-variant';
  targetId?: string;
  parentCharacterId?: string;
  initialCategory?: PromptCategory;
}

const ALL_CATEGORIES: PromptCategory[] = [
  'characters',
  'wardrobe',
  'actions',
  'environments',
  'camera',
  'lighting',
  'styles',
];

const ALL_VARIANT_TYPES: VariantType[] = [
  'Outfit',
  'Expression',
  'Pose',
  'Camera Angle',
  'Location',
  'Visual Style',
];

export const EditorScreen: React.FC<EditorScreenProps> = ({
  mode,
  targetId,
  parentCharacterId,
  initialCategory,
}) => {
  const {
    snapshot,
    navigate,
    setDirtyFormGuard,
    refreshSnapshot,
    showToast,
  } = useLibrary();

  const isVariantMode =
    mode === 'create-variant' || mode === 'edit-variant';
  const isEditMode = mode === 'edit-asset' || mode === 'edit-variant';

  const existingAsset =
    mode === 'edit-asset' && targetId
      ? snapshot?.assets.find((a) => a.id === targetId)
      : undefined;

  const existingVariant =
    mode === 'edit-variant' && targetId
      ? snapshot?.variants.find((v) => v.id === targetId)
      : undefined;

  const resolvedParentId =
    existingVariant?.parentCharacterId || parentCharacterId || '';
  const parentCharacter = snapshot?.assets.find(
    (a) => a.id === resolvedParentId
  );

  const [title, setTitle] = useState(
    existingAsset?.title ?? existingVariant?.title ?? ''
  );
  const [category, setCategory] = useState<PromptCategory>(
    existingAsset?.category ?? initialCategory ?? 'characters'
  );
  const [variantType, setVariantType] = useState<VariantType>(
    existingVariant?.type ?? 'Outfit'
  );
  const [description, setDescription] = useState(
    existingAsset?.description ?? existingVariant?.description ?? ''
  );
  const [promptText, setPromptText] = useState(
    existingAsset?.promptText ?? existingVariant?.promptText ?? ''
  );
  const [compactText, setCompactText] = useState(
    existingAsset?.compactText ?? existingVariant?.compactText ?? ''
  );
  const [avoidText, setAvoidText] = useState(
    existingAsset?.avoidText ?? existingVariant?.avoidText ?? ''
  );
  const [tagsInput, setTagsInput] = useState(
    (existingAsset?.tags ?? existingVariant?.tags ?? []).join(', ')
  );
  const [toolName, setToolName] = useState(
    existingAsset?.provenance?.toolName ?? ''
  );
  const [modelLabel, setModelLabel] = useState(
    existingAsset?.provenance?.modelLabel ?? ''
  );
  const [seedNote, setSeedNote] = useState(
    existingAsset?.provenance?.seed ?? ''
  );
  const [notes, setNotes] = useState(
    existingAsset?.notes ?? existingVariant?.notes ?? ''
  );
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(
    existingAsset?.reviewStatus ?? existingVariant?.reviewStatus ?? 'unreviewed'
  );

  const [mediaLinks, setMediaLinks] = useState<MediaLink[]>(
    existingAsset?.mediaLinks ?? existingVariant?.mediaLinks ?? []
  );
  const [coverMediaId, setCoverMediaId] = useState<string | undefined>(
    existingAsset?.coverMediaId ?? existingVariant?.coverMediaId
  );

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  useEffect(() => {
    setDirtyFormGuard(dirty);
    return () => setDirtyFormGuard(false);
  }, [dirty, setDirtyFormGuard]);

  const mediaMap = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const m of snapshot?.media ?? []) {
      map.set(m.id, m);
    }
    return map;
  }, [snapshot]);

  if (!snapshot) return null;

  if (isEditMode && !existingAsset && !existingVariant) {
    return (
      <div className="card">
        <h1 className="section-title">Record not found</h1>
        <p className="muted-text">
          The item you are trying to edit is no longer available.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/library', true)}
        >
          Return to Library
        </button>
      </div>
    );
  }

  const markDirty = () => {
    if (!dirty) setDirty(true);
  };

  const handleFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadErrors([]);
    const errs: string[] = [];
    let currentCount = mediaLinks.length;
    let currentTotalBytes = snapshot.media.reduce(
      (sum, m) => sum + m.byteSize,
      0
    );

    const newLinks: MediaLink[] = [];
    for (const file of files) {
      const check = validateMediaCandidate({
        name: file.name,
        type: file.type,
        size: file.size,
        existingCount: currentCount,
        currentTotalBytes,
      });
      if (!check.valid) {
        errs.push(check.error || `${file.name}: Invalid media file.`);
        continue;
      }

      try {
        const savedMedia = await saveMediaAsset({
          filename: file.name,
          mimeType: file.type,
          blob: file,
        });
        currentCount += 1;
        currentTotalBytes += file.size;
        newLinks.push({
          mediaId: savedMedia.id,
          role: 'reference',
          altText: file.name,
          order: currentCount - 1,
          filename: savedMedia.filename,
          mimeType: savedMedia.mimeType,
        });
      } catch (err) {
        errs.push(
          err instanceof Error
            ? err.message
            : `${file.name}: Failed to store file.`
        );
      }
    }

    if (errs.length > 0) {
      setUploadErrors(errs);
    }
    if (newLinks.length > 0) {
      await refreshSnapshot();
      const combined = [...mediaLinks, ...newLinks];
      setMediaLinks(combined);
      if (!coverMediaId) {
        setCoverMediaId(combined[0].mediaId);
      }
      markDirty();
      showToast(`Uploaded ${newLinks.length} sample file(s).`, 'success');
    }
    e.target.value = '';
  };

  const moveMedia = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= mediaLinks.length) return;
    const copy = [...mediaLinks];
    const [item] = copy.splice(idx, 1);
    copy.splice(target, 0, item);
    setMediaLinks(copy.map((l, i) => ({ ...l, order: i })));
    markDirty();
  };

  const removeMedia = (idx: number) => {
    const removed = mediaLinks[idx];
    const next = mediaLinks
      .filter((_, i) => i !== idx)
      .map((l, i) => ({ ...l, order: i }));
    setMediaLinks(next);
    if (coverMediaId === removed?.mediaId) {
      setCoverMediaId(next[0]?.mediaId);
    }
    markDirty();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (isVariantMode) {
        const saved = await saveVariant({
          id: existingVariant?.id,
          parentCharacterId: resolvedParentId,
          type: variantType,
          title,
          description,
          promptText,
          compactText,
          avoidText,
          tags: parsedTags,
          mediaLinks,
          coverMediaId,
          reviewStatus,
          notes,
        });
        setDirty(false);
        setDirtyFormGuard(false);
        await refreshSnapshot();
        showToast(
          isEditMode ? 'Variant updated.' : 'Variant created.',
          'success'
        );
        navigate(`/characters/${saved.parentCharacterId}/variants`, true);
      } else {
        const saved = await savePromptAsset({
          id: existingAsset?.id,
          title,
          category,
          description,
          promptText,
          compactText: category === 'characters' ? undefined : compactText,
          avoidText,
          tags: parsedTags,
          mediaLinks,
          coverMediaId,
          reviewStatus,
          provenance: {
            toolName: toolName.trim() || undefined,
            modelLabel: modelLabel.trim() || undefined,
            seed: seedNote.trim() || undefined,
          },
          notes,
        });
        setDirty(false);
        setDirtyFormGuard(false);
        await refreshSnapshot();
        showToast(
          isEditMode ? 'Prompt updated.' : 'Prompt saved to library.',
          'success'
        );
        navigate(`/prompts/${saved.id}`, true);
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to save record.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
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
            onClick={() => navigate('/library')}
          >
            <ArrowLeft size={15} /> Cancel
          </button>
          <h1 className="page-title">
            {mode === 'create-asset' &&
              (category === 'characters'
                ? 'Create Character'
                : 'Create Prompt')}
            {mode === 'edit-asset' && `Edit ${existingAsset?.title}`}
            {mode === 'create-variant' &&
              `Add Variant for ${parentCharacter?.title || 'Character'}`}
            {mode === 'edit-variant' && `Edit Variant ${existingVariant?.title}`}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {dirty && <span className="badge badge-warning">Unsaved changes</span>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            <Check size={16} />{' '}
            {saving
              ? 'Saving...'
              : isVariantMode
              ? 'Save Variant'
              : 'Save Prompt'}
          </button>
        </div>
      </div>

      {formError && (
        <div className="banner banner-error" role="alert">
          <span>{formError}</span>
        </div>
      )}

      <div className="split-layout detail-split">
        {/* Left: Media Upload & Sample Management */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 className="section-title" style={{ marginBottom: 4 }}>
              Sample & Reference Media (Optional)
            </h2>
            <p className="muted-text" style={{ margin: 0, fontSize: 13 }}>
              Accepts JPEG, PNG, WebP up to 10 MiB each, or playable MP4/WebM up
              to 50 MiB each (maximum 6 files per record). Use media you own or
              have permission to use.
            </p>
          </div>

          <div>
            <label
              htmlFor="media-file-upload"
              className="btn btn-secondary"
              style={{ width: '100%', cursor: 'pointer' }}
            >
              <Upload size={16} /> Choose Image or Video Files (
              {mediaLinks.length}/6)
            </label>
            <input
              id="media-file-upload"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              onChange={handleFilesSelected}
              style={{ display: 'none' }}
            />
          </div>

          {uploadErrors.length > 0 && (
            <div className="banner banner-error" style={{ marginBottom: 0 }}>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {uploadErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {mediaLinks.length === 0 ? (
            <div
              style={{
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px dashed var(--border-strong)',
              }}
            >
              <MediaThumbnail
                media={undefined}
                emptyLabel="No sample yet. Add an image or video when ready."
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {mediaLinks.map((link, idx) => {
                const m = mediaMap.get(link.mediaId);
                const isCover =
                  (coverMediaId || mediaLinks[0]?.mediaId) === link.mediaId;
                return (
                  <div
                    key={`${link.mediaId}_${idx}`}
                    className="card"
                    style={{
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ height: 160, borderRadius: 8, overflow: 'hidden' }}>
                      <MediaThumbnail media={m} altText={link.altText} />
                    </div>
                    {m && <MediaMetadataEditor media={m} onSaved={async () => { await refreshSnapshot(); }} />}

                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <input
                        className="input"
                        style={{ flex: 1, minHeight: 36, fontSize: 13 }}
                        aria-label="Accessibility Description" placeholder="Accessibility Description"
                        value={link.altText}
                        onChange={(e) => {
                          const next = [...mediaLinks];
                          next[idx] = { ...link, altText: e.target.value };
                          setMediaLinks(next);
                          markDirty();
                        }}
                      />
                      <select
                        className="select"
                        style={{ width: 130, minHeight: 36, fontSize: 13 }}
                        value={link.role}
                        onChange={(e) => {
                          const next = [...mediaLinks];
                          next[idx] = {
                            ...link,
                            role: e.target.value as MediaRole,
                          };
                          setMediaLinks(next);
                          markDirty();
                        }}
                        aria-label="Media role"
                      >
                        <option value="reference">Reference</option>
                        <option value="sample">Sample</option>
                        <option value="result">Result</option>
                      </select>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 6,
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        type="button"
                        className={`btn btn-sm ${
                          isCover ? 'btn-primary' : 'btn-secondary'
                        }`}
                        onClick={() => {
                          setCoverMediaId(link.mediaId);
                          markDirty();
                        }}
                      >
                        <Star size={13} /> {isCover ? 'Cover Image' : 'Set Cover'}
                      </button>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={idx === 0}
                          onClick={() => moveMedia(idx, -1)}
                          aria-label={`Move sample ${idx + 1} up`}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={idx === mediaLinks.length - 1}
                          onClick={() => moveMedia(idx, 1)}
                          aria-label={`Move sample ${idx + 1} down`}
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => removeMedia(idx)}
                          aria-label={`Remove sample ${idx + 1}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Prompt Metadata & Content Fields */}
        <div className="card">
          {isVariantMode && (
            <div className="banner banner-info">
              <div>
                <strong>
                  Parent Character:{' '}
                  {parentCharacter?.title || resolvedParentId}
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                  Locked Identity Context: This variant records only the changed
                  layer ({SLOT_LABELS[VARIANT_TYPE_TO_SLOT[variantType]]}) and
                  maps automatically to its Scene Builder slot.
                </p>
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="editor-title" className="form-label">
              Title *
            </label>
            <input
              id="editor-title"
              className="input"
              required
              maxLength={100}
              placeholder={
                isVariantMode
                  ? 'e.g., Office Navy Blazer'
                  : 'e.g., Maya Santos / Base Identity'
              }
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                markDirty();
              }}
            />
          </div>

          {!isVariantMode ? (
            <div className="form-group">
              <label htmlFor="editor-category" className="form-label">
                Category *
              </label>
              <select
                id="editor-category"
                className="select"
                value={category}
                disabled={isEditMode}
                onChange={(e) => {
                  setCategory(e.target.value as PromptCategory);
                  markDirty();
                }}
              >
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              {isEditMode && (
                <span className="form-hint">
                  Category is fixed after first save. Duplicate this record to
                  change its category.
                </span>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="editor-variant-type" className="form-label">
                Variant Type * (Maps to {SLOT_LABELS[VARIANT_TYPE_TO_SLOT[variantType]]})
              </label>
              <select
                id="editor-variant-type"
                className="select"
                value={variantType}
                disabled={isEditMode}
                onChange={(e) => {
                  setVariantType(e.target.value as VariantType);
                  markDirty();
                }}
              >
                {ALL_VARIANT_TYPES.map((vt) => (
                  <option key={vt} value={vt}>
                    {vt} → {SLOT_LABELS[VARIANT_TYPE_TO_SLOT[vt]]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="editor-description" className="form-label">
              Description (Optional)
            </label>
            <input
              id="editor-description"
              className="input"
              maxLength={500}
              placeholder="Short summary for browsing cards..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markDirty();
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="editor-prompt-text" className="form-label">
              {isVariantMode ? 'Changed Layer Only *' : 'Prompt Text *'}
            </label>
            {!isVariantMode && category === 'characters' && (
              <span className="form-hint">
                For Characters, describe stable identity and body/face/hair
                traits only — keep outfits, actions, camera angles, and settings
                in separate reusable layers.
              </span>
            )}
            <textarea
              id="editor-prompt-text"
              className="textarea"
              required
              rows={5}
              placeholder={
                isVariantMode
                  ? 'Describe only this variant layer (e.g., outfit or expression)...'
                  : 'Paste or write the reusable prompt block...'
              }
              value={promptText}
              onChange={(e) => {
                setPromptText(e.target.value);
                markDirty();
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="editor-tags" className="form-label">
              Tags (Comma-separated, max 12)
            </label>
            <input
              id="editor-tags"
              className="input"
              placeholder="e.g., Realistic, Adult, Daytime"
              value={tagsInput}
              onChange={(e) => {
                setTagsInput(e.target.value);
                markDirty();
              }}
            />
          </div>

          {(isVariantMode || category !== 'characters') && (
            <div className="form-group">
              <label htmlFor="editor-compact" className="form-label">
                Optional Compact Text (For Compact Output Mode)
              </label>
              <textarea
                id="editor-compact"
                className="textarea"
                rows={2}
                placeholder="Shorter user-supplied phrasing for Compact mode..."
                value={compactText}
                onChange={(e) => {
                  setCompactText(e.target.value);
                  markDirty();
                }}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="editor-avoid" className="form-label">
              Optional Avoid / Negative Text
            </label>
            <input
              id="editor-avoid"
              className="input"
              placeholder="Elements to avoid (kept separate from main prompt)..."
              value={avoidText}
              onChange={(e) => {
                setAvoidText(e.target.value);
                markDirty();
              }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            }}
          >
            {!isVariantMode && (
              <>
                <div className="form-group">
                  <label htmlFor="editor-tool" className="form-label">
                    Source Tool Note (Optional)
                  </label>
                  <input
                    id="editor-tool"
                    className="input"
                    placeholder="e.g., External Video Tool"
                    value={toolName}
                    onChange={(e) => {
                      setToolName(e.target.value);
                      markDirty();
                    }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editor-model" className="form-label">
                    Model / Version Note
                  </label>
                  <input
                    id="editor-model"
                    className="input"
                    placeholder="Manual note only"
                    value={modelLabel}
                    onChange={(e) => {
                      setModelLabel(e.target.value);
                      markDirty();
                    }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editor-seed" className="form-label">
                    Seed / Settings Note
                  </label>
                  <input
                    id="editor-seed"
                    className="input"
                    placeholder="Optional seed string"
                    value={seedNote}
                    onChange={(e) => {
                      setSeedNote(e.target.value);
                      markDirty();
                    }}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="editor-review-status" className="form-label">
                Review Status
              </label>
              <select
                id="editor-review-status"
                className="select"
                value={reviewStatus}
                onChange={(e) => {
                  setReviewStatus(e.target.value as ReviewStatus);
                  markDirty();
                }}
              >
                <option value="unreviewed">Unreviewed</option>
                <option value="user-approved">User-approved</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="editor-notes" className="form-label">
              Personal Notes (Optional)
            </label>
            <textarea
              id="editor-notes"
              className="textarea"
              rows={2}
              placeholder="Observations from external generations..."
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                markDirty();
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 12,
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/library')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              <Check size={16} />{' '}
              {saving
                ? 'Saving...'
                : isVariantMode
                ? 'Save Variant'
                : 'Save Prompt'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
