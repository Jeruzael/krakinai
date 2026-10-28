import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
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
  SimilarSceneError,
  type SaveSceneOptions,
  updateSavedSceneReviewAndResults,
} from '../storage/db';
import { downloadBlobAsFile } from '../hooks/useObjectUrl';
import { MediaThumbnail } from '../components/MediaThumbnail';
import {
  ReferenceBoard,
  type StudioReference,
} from '../components/ReferenceBoard';
import { buildSceneDocument, serializeSceneJson } from '../domain/sceneDocument';
import { ScenePromptViewerDialog } from '../components/ScenePromptViewerDialog';
import { SceneOutputWorkspace, type OutputWorkspaceLayout } from '../components/SceneOutputWorkspace';
import { indexPromptSections } from '../domain/promptSections';
import { serializeGenerationJson } from '../domain/generationDocument';
import { formatGenerationText, getProviderNotices, type ExportPresetId } from '../domain/exportPresets';
import { runScenePreflight } from '../domain/scenePreflight';
import { ScenePreflightDialog } from '../components/ScenePreflightDialog';
import { StudioDialog } from '../components/StudioDialog';
import type { PreflightComponent } from '../domain/scenePreflight';
import { resolveGenerationIdentity } from '../domain/identityAnchors';
import { GenerationIdentityControl } from '../components/GenerationIdentityControl';
import { ReferencePackManager } from '../components/ReferencePackManager';
import { getGenerationPackReferences } from '../domain/referencePack';
import { CollectionReturnControl } from '../components/CollectionReturnControl';
import { carryProjectTarget, getProjectSaveTarget } from '../domain/projectRoutes';
import { collectionSceneRoute } from '../domain/collectionNavigation';
import './promptOutput.css';

const OUTPUT_TABS = [
  { value: 'prompt', label: 'Prompt' },
  { value: 'references', label: 'References' },
  { value: 'review', label: 'Review' },
] as const;
type ViewMode = OutputMode | 'json' | 'generation_json';
type Workflow = 'canonical' | ExportPresetId | 'json' | 'generation_json';
const OUTPUT_MODES: { value: ViewMode; label: string }[] = [
  { value: 'full', label: 'Narrative' },
  { value: 'structured', label: 'Structured' },
  { value: 'compact', label: 'Compact' },
  { value: 'json', label: 'Project JSON' },
  { value: 'generation_json', label: 'Generation JSON' },
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

type DraftEditorBuffers = {
  manualBuffers: Partial<Record<OutputMode, string>>;
  editingModes: Partial<Record<OutputMode, boolean>>;
};
// Session-only UI state. Never persist unfinished edits into canonical records.
const draftEditorCache = new Map<string, DraftEditorBuffers>();
function rememberDraftEditor(value: DraftEditorBuffers & {id:string}) {
  if (!value.id.startsWith('scene_')) draftEditorCache.set(value.id, {
    manualBuffers: {...value.manualBuffers}, editingModes: {...value.editingModes},
  });
}

export const PromptOutputScreen: React.FC<{ id: string }> = ({ id }) => {
  const {
    snapshot,
    hashPath,
    navigate,
    copyText,
    clipboardFallback,
    openCollectionModal,
    openConfirmDialog,
    closeConfirmDialog,
    refreshSnapshot,
    showToast,
  } = useLibrary();

  const saveGuard = useRef(false);
  const saveToken = useRef<{binding:string;id:string} | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [similarScenes, setSimilarScenes] = useState<import('../types/domain').SavedScene[]>([]);
  const [duplicateTarget, setDuplicateTarget] = useState('');
  const [mode, setMode] = useState<ViewMode>(
    id.startsWith('scene_') ? 'full' : 'structured'
  );
  const [workflow, setWorkflow] = useState<Workflow>('canonical');
  const [showPreflight, setShowPreflight] = useState(false);
  const [showReferencePack, setShowReferencePack] = useState(false);
  const [intentionalIds, setIntentionalIds] = useState<string[]>([]);
  const [preflightSource, setPreflightSource] = useState<PreflightComponent | null>(null);
  const jsonMode = mode === 'json' || mode === 'generation_json';
  const canonicalMode: OutputMode = jsonMode ? 'structured' : mode as OutputMode;
  const derivedView = jsonMode || workflow !== 'canonical';
  const [activeTab, setActiveTab] =
    useState<(typeof OUTPUT_TABS)[number]['value']>('prompt');
  const [reviewNotesBuffer, setReviewNotesBuffer] = useState<string | null>(
    null
  );
  const tabId = useId();
  const [layoutChoice, setLayoutChoice] =
    useState<OutputWorkspaceLayout | null>(null);
  const [largeWorkspace, setLargeWorkspace] = useState(
    () => window.matchMedia?.('(min-width: 1200px)').matches ?? false
  );
  const workspaceLayout = layoutChoice ?? (largeWorkspace ? 'split' : 'tabs');
  const [promptSection, setPromptSection] = useState<string | null>(null);
  const showPromptRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const query = window.matchMedia?.('(min-width: 1200px)');
    if (!query) return;
    const update = () => setLargeWorkspace(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const [editingModes, setEditingModes] = useState<
    Partial<Record<OutputMode, boolean>>
  >({});
  const [manualBuffers, setManualBuffers] = useState<
    Partial<Record<OutputMode, string>>
  >({});
  const isEditingManual = !derivedView && !!editingModes[canonicalMode];
  const manualBuf = derivedView ? '' : (manualBuffers[canonicalMode] ?? '');
  const setIsEditingManual = (editing: boolean) => {
    if (!derivedView)
      setEditingModes((previous) => ({ ...previous, [canonicalMode]: editing }));
  };
  const setManualBuf = (text: string) => {
    if (!derivedView)
      setManualBuffers((previous) => ({ ...previous, [canonicalMode]: text }));
  };
  const [acknowledgedStaleModes, setAcknowledgedStaleModes] = useState<
    Partial<Record<OutputMode, boolean>>
  >({});

  const latestEditor = useRef({id, manualBuffers, editingModes});
  // Keep the previous record's latest values until the route effect captures them.
  if (latestEditor.current.id === id) latestEditor.current = {id, manualBuffers, editingModes};
  useEffect(() => () => rememberDraftEditor(latestEditor.current), []);

  useEffect(() => {
    // A return visit is a new operation; retries within this visit retain the token.
    saveToken.current = null;
    if (latestEditor.current.id !== id) rememberDraftEditor(latestEditor.current);
    const restored = !id.startsWith('scene_') ? draftEditorCache.get(id) : undefined;
    latestEditor.current = {id, manualBuffers: restored?.manualBuffers ?? {}, editingModes: restored?.editingModes ?? {}};
    setMode(id.startsWith('scene_') ? 'full' : 'structured');
    setWorkflow('canonical');
    setIntentionalIds([]);
    setShowPreflight(false);
    setPreflightSource(null);
    setEditingModes(restored?.editingModes ?? {});
    setManualBuffers(restored?.manualBuffers ?? {});
    setAcknowledgedStaleModes({});
    setReviewNotesBuffer(null);
    setPromptSection(null);
  }, [id]);

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
  const projectContext = getProjectSaveTarget(hashPath, snapshot.collections);

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
  const source = savedScene ?? draft!;
  const liveMaster = snapshot.assets.find(asset => asset.id === source.slots.character?.sourceId);
  const generationOptions = {
    identity: resolveGenerationIdentity(source, liveMaster, !!savedScene).identity,
    ...(source.referencePack ? {references:getGenerationPackReferences(source.referencePack)} : {}),
  };

  const title = savedScene ? savedScene.title : draft!.title;
  const settings = savedScene ? savedScene.settings : draft!.settings;
  const avoidText = savedScene
    ? (savedScene.avoidText ?? '')
    : (assembled?.avoidText ?? '');
  const references = savedScene
    ? savedScene.references
    : (assembled?.references ?? []);

  const manualOverride =
    derivedView
      ? undefined
      : savedScene
        ? savedScene.manualOutputs[canonicalMode]
        : draft!.manualOutputs[canonicalMode];

  const isStale =
    !isSavedScene &&
    draft &&
    isManualOutputStale(manualOverride, draft.inputRevision) &&
    !derivedView &&
    !acknowledgedStaleModes[canonicalMode];

  const activeText =
    mode === 'json'
      ? serializeSceneJson(savedScene ?? draft!)
      : mode === 'generation_json'
        ? serializeGenerationJson(source, generationOptions)
        : workflow !== 'canonical'
          ? formatGenerationText(source, workflow as ExportPresetId, generationOptions)
      : savedScene
        ? savedScene.outputs[canonicalMode]
        : (manualOverride?.text ?? assembled?.outputs[canonicalMode] ?? '');

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
    if (!draft || derivedView) return;
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
    if (!draft || derivedView || !manualOverride) return;
    openConfirmDialog({
      title: 'Discard Manual Output Edits?',
      message: `Discard your manual edits for the ${mode.toUpperCase()} tab and restore the deterministic assembled output?`,
      confirmLabel: 'Discard & Reassemble',
      danger: true,
      onConfirm: async () => {
        const nextManual = { ...draft.manualOutputs };
        delete nextManual[canonicalMode];
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
      mode: derivedView ? 'structured' : canonicalMode,
      promptText:
        derivedView
          ? (savedScene?.outputs.structured ??
            draft?.manualOutputs.structured?.text ??
            assembled?.outputs.structured ??
            '')
          : activeText,
      settings,
      avoidText,
      references,
    });
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const safeName =
      title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) || 'scene_prompt';
    downloadBlobAsFile(
      blob,
      `${safeName}_${derivedView ? 'structured' : mode}_specification.txt`
    );
    showToast('Downloaded .txt prompt & reference checklist.', 'success');
  };

  const handleDownloadSelected = () => {
    const json = jsonMode;
    const safeName =
      title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) || 'scene_prompt';
    downloadBlobAsFile(
      new Blob([activeText], {
        type: json
          ? 'application/json;charset=utf-8'
          : 'text/plain;charset=utf-8',
      }),
      `${safeName}_${mode}.${json ? 'json' : 'txt'}`
    );
    showToast('Downloaded complete selected output.', 'success');
  };

  const handleSaveScene = async (decision?: 'version' | 'take') => {
    if (!draft || saveGuard.current) return;
    if (projectContext.error) { setSaveError(projectContext.error); return; }
    saveGuard.current = true;
    setSaveBusy(true);
    setSaveError('');
    const binding = JSON.stringify([draft, decision, decision ? duplicateTarget : undefined, projectContext.target]);
    if (saveToken.current?.binding !== binding) saveToken.current = {binding, id: crypto.randomUUID()};
    const options: SaveSceneOptions = {requestId:saveToken.current.id, ...(projectContext.target ? {projectTarget:projectContext.target} : {}), ...(decision ? {duplicateDecision:decision,duplicateOfSceneId:duplicateTarget} : {})};
    try {
      const saved = await saveSceneFromDraft(draft.id, options);
      await refreshSnapshot();
      setSimilarScenes([]);
      showToast(`Saved immutable scene "${saved.title}".`, 'success');
      navigate(projectContext.target ? collectionSceneRoute(saved.id, projectContext.target.collectionId, {tab:'storyboard',shot:projectContext.target.shotId}) : `/output/${saved.id}`, true);
    } catch (err) {
      if (err instanceof SimilarSceneError) {
        setSimilarScenes(err.matches);
        setDuplicateTarget(err.matches[0]?.id ?? '');
      } else {
        const message = err instanceof Error ? err.message : 'Failed to save scene.';
        setSaveError(message);
        showToast(message, 'error');
      }
    } finally { saveGuard.current = false; setSaveBusy(false); }
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
        displayName: link.displayName,
        exportFilename: link.exportFilename,
        namesCaptured: link.namesCaptured,
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
        displayName: link.displayName,
        exportFilename: link.exportFilename,
        namesCaptured: link.namesCaptured,
      });
    }
  });
  const activeModeLabel = (workflow === 'gemini_omni_flash' ? 'Gemini Omni Flash · ' : workflow === 'generic_structured' ? 'Generic Structured · ' : workflow === 'custom' ? 'Custom template · ' : '') + OUTPUT_MODES.find(
    (item) => item.value === mode
  )!.label;
  const resultLinks =
    savedScene?.resultMediaLinks ?? draft?.resultMediaLinks ?? [];
  const reviewNotes = reviewNotesBuffer ?? record.reviewNotes;
  const preflightFindings = runScenePreflight(record, new Set(mediaMap.keys()));
  const providerNotices = !jsonMode && workflow !== 'canonical'
    ? getProviderNotices(record, workflow as ExportPresetId, generationOptions) : [];
  const editPreflightSource = () => {
    setShowPreflight(false);
    if (draft) navigate(`/builder/${draft.id}`);
    else void createDraftFromSavedScene(savedScene!.id).then(async copy => {
      await refreshSnapshot();
      navigate(`/builder/${copy.id}`);
    });
  };

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

  const promptSections = indexPromptSections(activeText);
  const outputTools = (
    <details className="output-disclosure output-advanced">
      <summary>Advanced Options</summary>
      <div className="output-advanced-content">
        {providerNotices.length > 0 && (
          <details className="output-disclosure">
            <summary>Provider guidance and limits</summary>
            <div className="output-disclosure-body">
              {providerNotices.map((notice) => (
                <p key={notice} className="muted-text">
                  {notice}
                </p>
              ))}
            </div>
          </details>
        )}{' '}
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
      </div>
    </details>
  );
  const outputEditingActions = (
    <>
      <div className="output-edit-actions">
        {manualOverride && (
          <span className="badge badge-warning">Edited output</span>
        )}
        {!isSavedScene && !derivedView && !isEditingManual && (
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
    </>
  );
  const outputConfiguration = (
    <div className="output-configuration">
      {' '}
      <div className="output-workflow-control">
        <label htmlFor={`${tabId}-workflow`} className="form-label">
          Target Workflow
        </label>
        <select
          id={`${tabId}-workflow`}
          className="select"
          value={workflow}
          onChange={(event) => {
            const next = event.target.value as Workflow;
            setWorkflow(next);
            setMode(
              next === 'json' || next === 'generation_json'
                ? next
                : next === 'canonical'
                  ? canonicalMode
                  : 'structured'
            );
          }}
        >
          <option value="canonical">
            Current format · canonical scene text
          </option>
          <option value="generic_structured">Generic Structured</option>
          <option value="gemini_omni_flash">Gemini Omni Flash</option>
          <option value="custom">Custom starting template</option>
          <option value="json">Project JSON</option>
          <option value="generation_json">Generation JSON</option>
        </select>
      </div>
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
                setWorkflow(
                  item.value === 'json' || item.value === 'generation_json'
                    ? item.value
                    : 'canonical'
                );
              }}
            >
              {item.label}
              {item.value === 'structured' && (
                <span className="output-recommended">Recommended</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <GenerationIdentityControl
        compact
        source={record}
        liveMaster={liveMaster}
        saved={!!savedScene}
        onChange={async (generation) => {
          if (!draft) return;
          try {
            await saveSceneDraft({
              ...draft,
              generation,
              bumpInputRevision: false,
            });
            await refreshSnapshot();
          } catch (error) {
            showToast(
              error instanceof Error
                ? error.message
                : 'Could not save identity source.',
              'error'
            );
          }
        }}
      />
    </div>
  );
  const outputSummary = (
    <section className="output-summary" aria-label="Prompt summary">
      <h3>Prompt Summary</h3>
      {OUTPUT_MODES.map((item) => (
        <div
          key={item.value}
          role="tabpanel"
          id={`${tabId}-mode-panel-${item.value}`}
          aria-labelledby={`${tabId}-mode-${item.value}`}
          hidden={mode !== item.value}
          tabIndex={0}
        >
          {mode === item.value && (
            <>
              <p>
                <strong>{activeModeLabel}</strong>
                <span className="muted-text">
                  {' '}
                  · {activeText.length.toLocaleString()} characters
                </span>
              </p>
              <div className="output-component-chips">
                {ORDERED_BUILDER_SLOTS.filter((slot) => record.slots[slot]).map(
                  (slot) => (
                    <span className="badge" key={slot}>
                      {COMPONENT_LABELS[slot]}
                    </span>
                  )
                )}
                {record.dialogue?.line && (
                  <span className="badge">Dialogue</span>
                )}
                {record.sceneInstructions && (
                  <span className="badge">Instructions</span>
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </section>
  );
  const promptActions = (
    <section
      className="output-quick-actions"
      role="region"
      aria-label="Prompt actions"
    >
      <div className="output-quick-context">
        <h3>Quick Actions <span className="output-active-mode">{activeModeLabel}</span></h3>
      </div>
      {isEditingManual && <p className="output-buffer-notice" role="status">Manual edits are unsaved. Copy and Download use the last saved output.</p>}
      <div className="output-quick-buttons">
        <button
          ref={showPromptRef}
          type="button"
          className="btn btn-primary"
          onClick={() => setPromptSection('')}
        >
          Show Prompt
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleCopyActivePrompt}
        >
          <Copy size={15} aria-hidden="true" />{' '}
          {jsonMode ? 'Copy JSON' : 'Copy Prompt'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          aria-label={jsonMode ? 'Download .json' : 'Download selected .txt'}
          onClick={handleDownloadSelected}
        >
          <Download size={15} aria-hidden="true" /> Download Selected
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-label={
            derivedView
              ? 'Download Structured full specification .txt'
              : 'Download full specification .txt'
          }
          onClick={handleDownloadTxt}
        >
          <Download size={14} aria-hidden="true" /> Full Specification
        </button>
      </div>
      {outputEditingActions}
    </section>
  );
  const workspaceMedia: StudioReference[] = [
    ...resultLinks.map((link, index) => ({
      ...link,
      key: `result_${index}_${link.mediaId}`,
      label: 'External result',
      sourceTitle: title,
    })),
    ...(record.referencePack?.entries ?? []).slice().sort((a, b) => a.order - b.order).map(entry => ({
      ...entry,
      key: `pack_${entry.associationId}`,
      label: `Reference pack · ${entry.purpose}`,
    })),
    ...studioReferences,
  ];

  return (
    <div className="output-workspace">
      {draft && projectContext.requested && (
        <div className="card" role="status">
          {projectContext.error ||
            'Save this draft as a new take in the originating project shot.'}
          {projectContext.error && (
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/output/${draft.id}`, true)}
            >
              Continue as Standalone Draft
            </button>
          )}
        </div>
      )}
      <header className="output-header">
        <div className="output-heading">
          <div className="output-record-meta">
            {savedScene ? (
              <CollectionReturnControl sceneId={savedScene.id} />
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  navigate(
                    draft
                      ? carryProjectTarget(`/builder/${draft.id}`, hashPath)
                      : '/scenes'
                  )
                }
              >
                <ArrowLeft size={15} />{' '}
                {draft ? 'Back to Builder' : 'Back to Saved Scenes'}
              </button>
            )}
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
        <div className="output-header-controls">
          <div className="output-layout-control">
            <label htmlFor={`${tabId}-layout`}>Workspace Layout</label>
            <select
              id={`${tabId}-layout`}
              className="select"
              value={workspaceLayout}
              onChange={(event) =>
                setLayoutChoice(event.target.value as OutputWorkspaceLayout)
              }
            >
              <option value="split">Split View</option>
              <option value="tabs">Studio Tabs</option>
            </select>
          </div>
          <div
            className="output-settings"
            aria-label="Settings (User Instructions)"
          >
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPreflight(true)}
            >
              Preflight · {preflightFindings.length} findings
            </button>
            <span className="badge">
              Aspect Ratio: {settings.aspectRatio || 'Not set'}
            </span>
            <span className="badge">
              Intended Duration:{' '}
              {settings.durationSeconds
                ? `${settings.durationSeconds}s`
                : 'N/A'}
            </span>
          </div>
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
          {activeTab === 'prompt' && jsonMode && (
            <p className="output-json-notice muted-text">
              JSON uses a KRAKINAI-specific schema. It preserves structured
              source data; manual prose is not translated into JSON.
            </p>
          )}
          <SceneOutputWorkspace
            layout={workspaceLayout}
            configuration={outputConfiguration}
            summary={outputSummary}
            actions={activeTab === 'prompt' ? promptActions : null}
            tools={outputTools}
            sections={promptSections}
            onSection={setPromptSection}
            media={workspaceMedia}
            mediaMap={mediaMap}
          />
          {isEditingManual && (
            <section
              className="output-manual-panel"
              aria-label="Manual output editor"
            >
              <p className="banner banner-warning">
                Unsaved editing buffer. Show Prompt, Copy and Download use the
                last saved output until you save this override.
              </p>
              <div className="output-manual-editor">
                <label htmlFor={`${tabId}-manual`} className="form-label">
                  Manual prompt output
                </label>
                <textarea
                  id={`${tabId}-manual`}
                  autoFocus
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
                    Cancel Editing
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
            </section>
          )}
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
          <div className="studio-inline" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowReferencePack(true)}
            >
              Manage Reference Pack
            </button>
            <span className="muted-text">
              {record.referencePack
                ? `${record.referencePack.entries.length} selected associations`
                : 'All linked references · legacy export behavior'}
            </span>
          </div>
          {record.referencePack && (
            <ReferenceBoard
              items={[...record.referencePack.entries]
                .sort((a, b) => a.order - b.order)
                .map((entry) => ({
                  key: entry.associationId,
                  mediaId: entry.mediaId,
                  label: `${entry.order + 1} · ${entry.purpose}`,
                  sourceTitle: entry.sourceTitle,
                  role: entry.role,
                  altText: entry.altText,
                  filename: entry.filename,
                  displayName: entry.displayName,
                  exportFilename: entry.exportFilename,
                  namesCaptured: entry.namesCaptured,
                }))}
              mediaMap={mediaMap}
              historical={!!savedScene}
              title="Selected Reference Pack"
              collapseThumbnails
              downloadable
            />
          )}
          <ReferenceBoard
            items={studioReferences}
            mediaMap={mediaMap}
            historical={!!savedScene}
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

      {activeTab !== 'prompt' && promptActions}
      <footer
        className="card output-action-footer"
        role="region"
        aria-label="Scene actions"
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
            {draft && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={saveBusy}
                onClick={() => void handleSaveScene()}
              >
                <BookmarkCheck size={16} />{' '}
                {projectContext.target ? 'Save New Take' : 'Save Scene'}
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
      {promptSection !== null && !clipboardFallback && (
        <ScenePromptViewerDialog
          title={title}
          formatLabel={activeModeLabel}
          text={activeText}
          json={jsonMode}
          initialSection={promptSection || undefined}
          returnFocusRef={showPromptRef}
          onClose={() => setPromptSection(null)}
          onCopy={() => {
            if (isStale) setPromptSection(null);
            return handleCopyActivePrompt();
          }}
          onDownload={handleDownloadSelected}
        />
      )}
      {saveError && <p role="alert">{saveError}</p>}
      {similarScenes.length > 0 && (
        <StudioDialog
          title="Similar saved scene"
          onClose={() => {
            if (!saveGuard.current) {
              setSimilarScenes([]);
              setSaveError('');
            }
          }}
        >
          <p>A similar saved scene already exists.</p>
          <label htmlFor={`${tabId}-duplicate-target`}>Existing scene</label>
          <select
            id={`${tabId}-duplicate-target`}
            value={duplicateTarget}
            disabled={saveBusy}
            onChange={(event) => setDuplicateTarget(event.target.value)}
          >
            {similarScenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.title} · {scene.id}
              </option>
            ))}
          </select>
          {saveError && <p role="alert">{saveError}</p>}
          <div className="output-footer-buttons">
            <button
              className="btn btn-secondary"
              disabled={saveBusy}
              onClick={() => {
                setSimilarScenes([]);
                navigate(`/output/${duplicateTarget}`);
              }}
            >
              Open Existing Scene
            </button>
            <button
              className="btn btn-primary"
              disabled={saveBusy}
              onClick={() => void handleSaveScene('version')}
            >
              Save as New Version
            </button>
            <button
              className="btn btn-secondary"
              disabled={saveBusy}
              onClick={() => void handleSaveScene('take')}
            >
              Save as Separate Take
            </button>
            <button
              className="btn btn-secondary"
              disabled={saveBusy}
              onClick={() => {
                setSimilarScenes([]);
                setSaveError('');
              }}
            >
              Cancel
            </button>
          </div>
        </StudioDialog>
      )}
      {showPreflight && (
        <ScenePreflightDialog
          findings={preflightFindings}
          onClose={() => setShowPreflight(false)}
          onViewSource={(component) => {
            setShowPreflight(false);
            setPreflightSource(component);
          }}
          onEditComponent={editPreflightSource}
          readOnly={!!savedScene}
          intentionalIds={intentionalIds}
          onIntentionalIdsChange={setIntentionalIds}
        />
      )}
      {showReferencePack && (
        <ReferencePackManager
          source={record}
          mediaMap={mediaMap}
          onClose={() => setShowReferencePack(false)}
          readOnly={!!savedScene}
          onEditCopy={editPreflightSource}
          onCopyText={async (text) => {
            await copyText(text, 'Reference checklist copied.');
          }}
          onApply={async (referencePack) => {
            if (!draft) return;
            await saveSceneDraft({
              ...draft,
              referencePack,
              bumpInputRevision: false,
            });
            await refreshSnapshot();
            setShowReferencePack(false);
          }}
        />
      )}
      {preflightSource && (
        <StudioDialog
          title={`Preserved source: ${preflightSource}`}
          onClose={() => setPreflightSource(null)}
        >
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {preflightSource === 'dialogue'
              ? JSON.stringify(record.dialogue ?? {}, null, 2)
              : preflightSource === 'settings'
                ? JSON.stringify(record.settings, null, 2)
                : preflightSource === 'instructions'
                  ? record.sceneInstructions
                  : preflightSource === 'references'
                    ? JSON.stringify(references, null, 2)
                    : (buildSceneDocument(record).components[preflightSource]
                        ?.prompt ?? '(empty source)')}
          </pre>
        </StudioDialog>
      )}
    </div>
  );
};
