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
import { validateMediaCandidate } from '../domain/validation';
import { SLOT_UI_LABELS as SLOT_LABELS } from '../domain/displayLabels';
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
  ShotType,
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
import { GenerationIdentityControl } from '../components/GenerationIdentityControl';
import { ReferencePackManager } from '../components/ReferencePackManager';
import { PerformanceDirection } from '../components/PerformanceDirection';
import { carryProjectTarget, getProjectSaveTarget } from '../domain/projectRoutes';
import { getActiveReferencePack, getActiveSceneSlots, getActiveSourceMediaLinks, getShotTypeRules, resolveShotType, validateShotSourceMedia, SHOT_TYPES, SHOT_TYPE_LABELS, SHOT_TYPE_DESCRIPTIONS } from '../domain/shotTypeRules';
import { SourceMediaPicker } from '../components/SourceMediaPicker';
import { CameraComposer } from '../components/CameraComposer';
import { rebaseCameraComposition, clearCameraComposition } from '../domain/cameraComposition';
import { EnsembleControls } from '../components/EnsembleControls';
import { EnsembleTemplateChoice } from '../components/EnsembleTemplateChoice';
import { getSceneSnapshotEntries } from '../domain/ensembleReferences';
import { validateSceneEnsemble } from '../domain/ensembleValidation';

export const SceneBuilderScreen: React.FC<{ draftId?: string }> = ({
  draftId,
}) => {
  const {
    snapshot,
    hashPath,
    navigate,
    refreshSnapshot,
    getOrCreateActiveDraft,
    openConfirmDialog,
    closeConfirmDialog,
    showToast,
  } = useLibrary();

  const [draft, setDraft] = useState<SceneDraft | null>(null);
  const latestDraft = useRef<SceneDraft | null>(null);
  latestDraft.current = draft;
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>(
    'saved'
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [assemblyErrors, setAssemblyErrors] = useState<string[]>([]);
  const [detailSlot, setDetailSlot] = useState<BuilderSlot | null>(null);
  const [showPreflight, setShowPreflight] = useState(false);
  const [showReferencePack, setShowReferencePack] = useState(false);
  const [intentionalIds, setIntentionalIds] = useState<string[]>([]);
  const [pickerSlot, setPickerSlot] = useState<BuilderSlot | null>(null);
  const [showCameraComposer, setShowCameraComposer] = useState(false);
  const cameraRowRef = useRef<HTMLButtonElement>(null);
  const cameraComposerReturnRef = useRef<HTMLElement | null>(null);
  const [overrideTextBuf, setOverrideTextBuf] = useState('');
  const [overrideCompactBuf, setOverrideCompactBuf] = useState('');

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [tplIncludeChar, setTplIncludeChar] = useState(false);
  const [tplEnsembleMode,setTplEnsembleMode]=useState<'full'|'shared_only'>();
  const [tplEnsembleConfirmed,setTplEnsembleConfirmed]=useState(false);
  const [ensembleRequest,setEnsembleRequest]=useState<{kind:'participants'|'cues';id?:string;token:number}>();

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
    bumpRevision = true,
    reportFailure = false
  ) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState('saving');
    setSaveError(null);
    try {
      const saved = await saveSceneDraft({
        ...nextDraft,
        ...(nextDraft.revisionIntent||nextDraft.ensemble?{expectedInputRevision:nextDraft.inputRevision}:{}),
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
      if(reportFailure)throw Error(msg);
      return undefined;
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

  const shotRules = getShotTypeRules(draft);
  const activeSlots = getActiveSceneSlots(draft);
  const activeSources = getActiveSourceMediaLinks(draft);
  const activePack = getActiveReferencePack(draft);
  const activeDraft = { ...draft, slots: activeSlots, sourceMediaLinks: activeSources, referencePack: activePack };
  const requiredSlots = [...new Set([...shotRules.requiredSlots, ...(shotRules.conditionalCharacterRequired ? ['character' as const] : [])])];
  const selectedRequiredCount = requiredSlots.filter(slot => activeSlots[slot]).length;
  // Inactive selections stay in the draft; only applicable references appear here.
  const referenceBoardItems: Array<{
    slot: BuilderSlot;
    slotLabel: string;
    sourceTitle: string;
    mediaId: string;
    role: string;
  }> = [];

  for (const {slot,snapshot:snap,participantId} of getSceneSnapshotEntries(activeDraft,{activeOnly:true})) {
    for (const link of snap.mediaLinks ?? []) {
      referenceBoardItems.push({
        slot,
        slotLabel: SLOT_LABELS[slot],
        sourceTitle: participantId?`${draft.ensemble!.participants.find(p=>p.id===participantId)!.character.sourceTitle} · ${snap.sourceTitle}`:snap.sourceTitle,
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
      [pickerSlot]: pickerSlot === 'camera'
        ? rebaseCameraComposition(draft.slots.camera, createSnapshotFromAsset(asset))
        : createSnapshotFromAsset(asset),
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
          nextSlots[variant.targetSlot] = variant.targetSlot === 'camera'
            ? rebaseCameraComposition(draft.slots.camera, createSnapshotFromVariant(variant))
            : createSnapshotFromVariant(variant);
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
    nextSlots[variant.targetSlot] = variant.targetSlot === 'camera'
      ? rebaseCameraComposition(draft.slots.camera, createSnapshotFromVariant(variant))
      : createSnapshotFromVariant(variant);
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
    const context = getProjectSaveTarget(hashPath, snapshot.collections);
    if (context.error) { setAssemblyErrors([context.error]); return; }
    const saved = await persistDraftImmediate(draft, false);
    if (!saved) return;
    if (getShotTypeRules(saved).sourceKind) {
      try {
        // Re-read storage: the rendered media map can predate a deletion or change.
        const current = await refreshSnapshot();
        const errors = validateShotSourceMedia(saved, new Map(current.media.map(media => [media.id, media])));
        if (errors.length) {
          setAssemblyErrors([...errors, 'Review Source Media and the required instructions. Restore the original file or select a valid replacement, then assemble again.']);
          return;
        }
      } catch {
        setAssemblyErrors(['Could not verify the original file in storage. Your draft is saved. Check Source Media and retry assembly.']);
        return;
      }
    }
    const res = assembleScenePrompt(saved);
    if (!res.valid) {
      setAssemblyErrors(res.errors);
      return;
    }
    setAssemblyErrors([]);
    navigate(carryProjectTarget(`/output/${saved.id}`, hashPath), true);
  };

  const handleSaveAsTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tpl = await saveDraftAsTemplate({
        draft,
        name: tplName,
        description: tplDesc,
        includeCharacterIdentity: tplIncludeChar && !getShotTypeRules(draft).inapplicableSlots.includes('character'),
        ...(draft.ensemble?{ensembleMode:tplEnsembleMode,confirmEnsembleOmissions:tplEnsembleConfirmed}:{}),
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
  const openEnsemble=(kind:'participants'|'cues',id?:string)=>setEnsembleRequest(previous=>({kind,id,token:(previous?.token??0)+1}));
  const openDetails = (slot: BuilderSlot) => {
    if(draft.ensemble&&['character','wardrobe'].includes(slot)){openEnsemble('participants',draft.ensemble.primaryParticipantId??undefined);return;}
    const selected = draft.slots[slot];
    if (!selected) {
      setPickerSlot(slot);
      return;
    }
    setOverrideTextBuf(selected.overrideText ?? selected.promptText);
    setOverrideCompactBuf(selected.overrideCompactText ?? '');
    setDetailSlot(slot);
  };
  const preflightFindings = runScenePreflight(draft, mediaMap);
  const openPreflightComponent = (component: PreflightFinding['components'][number]) => {
    setShowPreflight(false);
    if(draft.ensemble&&component==='dialogue'){openEnsemble('cues');return;}
    if (ORDERED_BUILDER_SLOTS.includes(component as BuilderSlot)) openDetails(component as BuilderSlot);
    else requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-preflight="${component === 'references' && shotRules.sourceKind ? 'source' : component}"]`);
      const details = target?.closest('details');
      if (details) details.open = true;
      target?.focus();
    });
  };

  return (
    <div className="recipe-workspace">
      {getProjectSaveTarget(hashPath, snapshot.collections).requested && <div className="card" role="status">{getProjectSaveTarget(hashPath, snapshot.collections).error || 'Creating a new take for this project shot. Existing saved takes remain unchanged.'}{getProjectSaveTarget(hashPath, snapshot.collections).error && <button className="btn btn-secondary" onClick={() => navigate(`/builder/${draft.id}`, true)}>Continue as Standalone Draft</button>}</div>}
      <div className="studio-header">
        <div>
          <span className="studio-eyebrow">YOUR CREATION STUDIO</span>
          <h1 className="page-title">Scene Builder</h1>
          <p className="muted-text">
            Set the visual direction. Build your scene, one layer at a time.
          </p>
        </div>
        <div className="studio-inline">
          <button type="button" className="btn btn-secondary btn-sm" onClick={()=>navigate(carryProjectTarget('/direct/new',hashPath))}>Import Full Prompt</button>
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
              setTplEnsembleMode(undefined);setTplEnsembleConfirmed(false);
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
          <button type="button" className="btn btn-secondary btn-sm" style={{marginBottom:8}} onClick={() => setShowReferencePack(true)}>
            Manage Reference Pack · {activePack ? `${activePack.entries.length} selected` : 'all linked (legacy)'}
          </button>
          <ReferenceBoard
            items={[...activeSources.map((link, index) => ({
              key: `source-${index}-${link.mediaId}`, mediaId: link.mediaId, label: 'Original Source', sourceTitle: mediaMap.get(link.mediaId)?.filename || link.filename || 'Original source', role: link.role, isSource: true,
            })), ...referenceBoardItems.map((item, index) => ({
              key: `${item.slot}-${index}-${item.mediaId}`,
              mediaId: item.mediaId,
              label: recipeLabels[item.slot],
              sourceTitle: item.sourceTitle,
              role: item.role,
            }))]}
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
            <div className="form-group builder-shot-type">
              <label htmlFor="builder-shot-type" className="form-label">Shot Type</label>
              <select id="builder-shot-type" className="select" value={resolveShotType(draft)} aria-describedby="builder-shot-description" onChange={event => {
                if(draft.ensemble){const error=validateSceneEnsemble({...draft,shotType:event.target.value as ShotType})[0];if(error){showToast(`Review Participants and ordered cues before changing Shot Type. ${error}`,'error');return;}}
                setDetailSlot(null); setPickerSlot(null);
                scheduleDraftAutosave({ ...draft, shotType: event.target.value as ShotType });
              }}>{SHOT_TYPES.map(type => <option key={type} value={type}>{SHOT_TYPE_LABELS[type]}</option>)}</select>
              <span id="builder-shot-description" className="muted-text">{SHOT_TYPE_DESCRIPTIONS[resolveShotType(draft)]} Selections for other shot types are preserved.</span>
            </div>
            {shotRules.sourceKind && <SourceMediaPicker kind={shotRules.sourceKind} links={draft.sourceMediaLinks ?? []} mediaMap={mediaMap} onUploaded={async () => { await refreshSnapshot(); }} onError={message => showToast(message, 'error')} onChange={async sourceMediaLinks => {
              const saved = await persistDraftImmediate({ ...(latestDraft.current ?? draft), sourceMediaLinks });
              if (!saved) throw new Error('Source association could not be saved. Retry your selection.');
            }} />}
            <div className="studio-panel-heading">
              <h2 className="section-title">Scene Recipe</h2>
              <span className="muted-text" style={{ fontSize: 12 }}>
                {requiredSlots.length ? `${selectedRequiredCount} / ${requiredSlots.length} required components` : 'No required component assets'}
              </span>
            </div>
            <div className="recipe-rows">
              {ORDERED_BUILDER_SLOTS.map((slot) => {
                const selected = draft.slots[slot];
                const inactive = shotRules.inapplicableSlots.includes(slot);
                const required = requiredSlots.includes(slot);
                const Icon = recipeIcons[slot];
                const newer =
                  selected && getLatestLibrarySource(selected).hasNewerRevision;
                const status = inactive ? 'Not Applicable' : selected
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
                    className={`recipe-row${inactive ? ' is-inactive' : ''}`}
                    data-testid="recipe-row"
                    key={slot}
                  >
                    <button
                      type="button"
                      className="recipe-row-main"
                      ref={slot === 'camera' ? cameraRowRef : undefined}
                      disabled={inactive}
                      onClick={() => openDetails(slot)}
                      aria-label={`Open ${recipeLabels[slot]} details: ${selected?.sourceTitle || 'Not selected'}`}
                    >
                      <span className="recipe-row-icon">
                        <Icon size={17} aria-hidden="true" />
                      </span>
                      <span className="recipe-row-copy">
                        <strong>
                          {recipeLabels[slot]}
                          {slot === 'character' && selected && !inactive && (
                            <Lock size={11} aria-label="Identity locked" />
                          )}
                        </strong>
                        <span>
                          {inactive ? (selected ? `${selected.sourceTitle} · Preserved for other shot types` : 'Not used for this shot type') : selected?.sourceTitle ||
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
                      disabled={inactive}
                      onClick={() => draft.ensemble&&['character','wardrobe'].includes(slot)?openEnsemble('participants',draft.ensemble.primaryParticipantId??undefined):setPickerSlot(slot)}
                    >
                      {selected ? 'Change' : 'Select'}
                    </button>
                  </div>
                );
              })}
            </div>
            <EnsembleControls draft={draft} assets={snapshot.assets} variants={snapshot.variants} request={ensembleRequest} onChange={async next=>!!(await persistDraftImmediate(next,true,true))}/>
            <div className="recipe-options">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={event => {
                  cameraComposerReturnRef.current = event.currentTarget;
                  setShowCameraComposer(true);
                }}
              >
                Compose Camera directions
              </button>
              {!draft.ensemble&&!shotRules.inapplicableSlots.includes('character') && <GenerationIdentityControl source={activeDraft} liveMaster={snapshot.assets.find(asset => asset.id === activeSlots.character?.sourceId)} onChange={async generation => { await persistDraftImmediate({...draft,generation}, false); }} />}
              <details key={shotRules.instructionLabel} className="studio-disclosure" open={shotRules.requiresInstructions || undefined}>
                <summary>
                  {shotRules.instructionLabel}{' '}
                  <span className="muted-text">
                    {draft.sceneInstructions ? 'Added' : shotRules.requiresInstructions ? 'Required' : 'Optional'}
                  </span>
                </summary>
                <div className="form-group">
                  <label htmlFor="builder-instructions" className="form-label">
                    {shotRules.instructionLabel} ({shotRules.requiresInstructions ? 'Required' : 'Optional'})
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
              {!draft.ensemble&&<details className="studio-disclosure">
                <summary>
                  Dialogue{' '}
                  <span className="muted-text">
                    {draft.dialogue?.line ? 'Added' : 'Optional'}
                  </span>
                </summary>
                <p className="recipe-board-note">
                  {shotRules.allowsAudioOnlyWithoutCharacter ? 'Voiceover and off-screen speech can accompany this shot without a visible character. Spoken or on-camera speech requires a relevant character.' : 'Spoken dialogue requires a selected character.'} Text is
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
                <PerformanceDirection dialogue={draft.dialogue??{speaker:'',line:''}} onChange={dialogue=>scheduleDraftAutosave({...draft,dialogue})}/>
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
              </details>}
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
                        draft.ensemble?'Clear all participants, clothing, ordered cues, selected slots and instructions in this draft? Saved scenes and stored media stay available.':'Clear all selected slots and instructions in this draft?',
                      confirmLabel: 'Reset Draft',
                      danger: true,
                      onConfirm: async () => {
                        await persistDraftImmediate({
                          ...draft,
                          title: 'Untitled Scene Draft',
                          slots: {},
                          ...(draft.ensemble?{ensemble:{version:1 as const,primaryParticipantId:null,participants:[],dialogueCues:[]}}:{}),
                          extraRequiredSlots: [],
                          sceneInstructions: '',
                          dialogue: undefined,
                          manualOutputs: {},
                          generation: undefined,
                          referencePack: undefined,
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
      {showReferencePack && <ReferencePackManager source={activeDraft} mediaMap={mediaMap} onClose={() => setShowReferencePack(false)} onApply={async referencePack => {
        const activeIds = new Set(activePack?.entries.map(entry => entry.associationId) ?? []);
        const inactiveEntries = (draft.referencePack?.entries ?? []).filter(entry => !activeIds.has(entry.associationId));
        const combined = [...referencePack.entries, ...inactiveEntries];
        const saved = await persistDraftImmediate({...draft,referencePack:{...referencePack, entries: combined.map((entry, order) => ({...entry, order}))}}, false);
        if (!saved) throw new Error('Reference Pack could not be saved. Your selection remains available here.');
        setShowReferencePack(false);
      }} />}
      {showCameraComposer && (
        <CameraComposer
          snapshot={draft.slots.camera}
          assets={snapshot.assets}
          shotType={draft.shotType}
          durationSeconds={draft.settings.durationSeconds}
          sceneInstructions={draft.sceneInstructions}
          returnFocusRef={cameraComposerReturnRef}
          onClose={() => setShowCameraComposer(false)}
          onApply={async camera => {
            const current = latestDraft.current ?? draft;
            const slots = { ...current.slots };
            if (camera) slots.camera = camera;
            else delete slots.camera;
            const saved = await persistDraftImmediate({ ...current, slots });
            if (!saved) throw new Error('Camera directions could not be saved. Your controls remain here.');
            setShowCameraComposer(false);
          }}
        />
      )}
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
          {detailSlot === 'camera' && (
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => {
                cameraComposerReturnRef.current = cameraRowRef.current;
                setDetailSlot(null);
                setShowCameraComposer(true);
              }}
            >
              Compose Camera directions
            </button>
          )}
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
                        ...(detailSlot === 'camera' ? clearCameraComposition(detailSnapshot) : detailSnapshot),
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
                          ...(detailSlot === 'camera' ? clearCameraComposition(detailSnapshot) : detailSnapshot),
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
          activeCharacterId={activeSlots.character?.sourceId}
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
                disabled={!!draft.ensemble&&(!tplEnsembleMode||(tplEnsembleMode==='shared_only'&&!tplEnsembleConfirmed))}
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
            {draft.ensemble?<EnsembleTemplateChoice ensemble={draft.ensemble} mode={tplEnsembleMode} confirmed={tplEnsembleConfirmed} onMode={mode=>{setTplEnsembleMode(mode);setTplEnsembleConfirmed(false);}} onConfirm={setTplEnsembleConfirmed}/>:<label className="studio-inline">
              <input
                type="checkbox"
                checked={tplIncludeChar}
                disabled={shotRules.inapplicableSlots.includes('character')}
                onChange={(event) => setTplIncludeChar(event.target.checked)}
              />
              Include selected character identity for private reuse (excluded by
              default)
            </label>}
            <p className="muted-text">Shot Type: {SHOT_TYPE_LABELS[resolveShotType(draft)]}. The template copies applicable layers and requirements. Attach an original source to each new graphic or footage draft.</p>
          </form>
        </StudioDialog>
      )}
    </div>
  );
};
