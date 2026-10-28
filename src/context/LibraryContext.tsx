import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  BuilderSlot,
  CollectionMemberType,
  PromptAsset,
  SceneDraft,
  Variant,
} from '../types/domain';
import {
  checkCharacterReplacementInDraft,
  checkVariantApplicationToDraft,
  getAllSnapshot,
  initializeDatabase,
  loadStarterLibrary as dbLoadStarterLibrary,
  saveSceneDraft,
  type LibrarySnapshot,
} from '../storage/db';
import {
  createSnapshotFromAsset,
  createSnapshotFromVariant,
  ORDERED_BUILDER_SLOTS,
} from '../domain/promptAssembler';
import { CATEGORY_TO_SLOT } from '../domain/validation';
import { rebaseCameraComposition } from '../domain/cameraComposition';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
}

export interface LibraryBrowseState {
  query: string;
  selectedTags: string[];
  reviewFilter: 'all' | 'user-approved' | 'unreviewed';
  sortBy: 'updated' | 'newest' | 'az';
  visibleCount: number;
  scrollY: number;
}

export interface PendingConfirmDialog {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

interface LibraryContextValue {
  snapshot: LibrarySnapshot | null;
  loading: boolean;
  storageError: string | null;
  refreshSnapshot: () => Promise<LibrarySnapshot>;
  loadStarterData: (forceReset?: boolean) => Promise<void>;

  // Hash Routing
  hashPath: string;
  navigate: (nextHash: string, skipDirtyCheck?: boolean) => void;
  setDirtyFormGuard: (isDirty: boolean) => void;

  // Preserved Library Browse State
  browseState: LibraryBrowseState;
  updateBrowseState: (partial: Partial<LibraryBrowseState>) => void;

  // Toasts
  toasts: ToastMessage[];
  showToast: (text: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;

  // Clipboard with fallback
  copyText: (text: string, label?: string) => Promise<boolean>;
  clipboardFallback: { text: string; label: string } | null;
  closeClipboardFallback: () => void;

  // Shared Modals
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  collectionModalTarget: {
    type: CollectionMemberType;
    id: string;
    title: string;
  } | null;
  openCollectionModal: (target: {
    type: CollectionMemberType;
    id: string;
    title: string;
  }) => void;
  closeCollectionModal: () => void;

  confirmDialog: PendingConfirmDialog | null;
  openConfirmDialog: (dialog: PendingConfirmDialog) => void;
  closeConfirmDialog: () => void;

  // Scene Builder Quick Actions
  getOrCreateActiveDraft: () => Promise<SceneDraft>;
  applyAssetToScene: (asset: PromptAsset, navigateToBuilder?: boolean) => Promise<void>;
  applyVariantToScene: (variant: Variant, navigateToBuilder?: boolean) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

function normalizeHash(rawHash: string): string {
  const cleaned = rawHash.replace(/^#/, '');
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [snapshot, setSnapshot] = useState<LibrarySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  const [hashPath, setHashPath] = useState<string>(() =>
    normalizeHash(window.location.hash || '#/')
  );
  const isDirtyRef = useRef(false);

  const [browseState, setBrowseState] = useState<LibraryBrowseState>({
    query: '',
    selectedTags: [],
    reviewFilter: 'all',
    sortBy: 'updated',
    visibleCount: 24,
    scrollY: 0,
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [clipboardFallback, setClipboardFallback] = useState<{
    text: string;
    label: string;
  } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [collectionModalTarget, setCollectionModalTarget] = useState<{
    type: CollectionMemberType;
    id: string;
    title: string;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] =
    useState<PendingConfirmDialog | null>(null);

  const showToast = useCallback(
    (text: string, type: ToastMessage['type'] = 'success') => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, text }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshSnapshot = useCallback(async () => {
    try {
      const snap = await getAllSnapshot();
      setSnapshot(snap);
      setStorageError(null);
      return snap;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to read from browser IndexedDB storage.';
      setStorageError(msg);
      throw err;
    }
  }, []);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden') void refreshSnapshot().catch(() => {}); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [refreshSnapshot]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const snap = await initializeDatabase();
        if (mounted) {
          setSnapshot(snap);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setStorageError(
            err instanceof Error
              ? err.message
              : 'IndexedDB storage is unavailable in this browser.'
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const next = normalizeHash(window.location.hash || '#/');
      setHashPath(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setDirtyFormGuard = useCallback((isDirty: boolean) => {
    isDirtyRef.current = isDirty;
  }, []);

  const navigate = useCallback((nextHash: string, skipDirtyCheck = false) => {
    const normalized = normalizeHash(nextHash);
    if (!skipDirtyCheck && isDirtyRef.current) {
      setConfirmDialog({
        title: 'Unsaved Changes',
        message:
          'You have unsaved edits on this form. Leave this screen and discard your unsaved changes?',
        confirmLabel: 'Discard Changes',
        cancelLabel: 'Stay on Page',
        danger: true,
        onConfirm: () => {
          isDirtyRef.current = false;
          setConfirmDialog(null);
          window.location.hash = `#${normalized}`;
          setHashPath(normalized);
        },
      });
      return;
    }
    window.location.hash = `#${normalized}`;
    setHashPath(normalized);
  }, []);

  const updateBrowseState = useCallback(
    (partial: Partial<LibraryBrowseState>) => {
      setBrowseState((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  const loadStarterData = useCallback(
    async (forceReset = false) => {
      try {
        const snap = await dbLoadStarterLibrary(forceReset);
        setSnapshot(snap);
        showToast(
          'Starter library loaded (21 prompts, 6 variants, 3 collections, 4 templates).',
          'success'
        );
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Failed to load starter library.',
          'error'
        );
      }
    },
    [showToast]
  );

  const copyText = useCallback(
    async (text: string, label = 'Prompt copied.') => {
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
          throw new Error('Clipboard API unavailable');
        }
        await navigator.clipboard.writeText(text);
        showToast(label, 'success');
        return true;
      } catch {
        setClipboardFallback({ text, label });
        return false;
      }
    },
    [showToast]
  );

  const getOrCreateActiveDraft = useCallback(async (): Promise<SceneDraft> => {
    const snap = snapshot ?? (await getAllSnapshot());
    const activeId = snap.preferences.activeDraftId;
    const found = activeId
      ? snap.drafts.find((d) => d.id === activeId)
      : snap.drafts[0];
    if (found) return found;

    const created = await saveSceneDraft({
      title: 'Untitled Scene Draft',
      slots: {},
      extraRequiredSlots: [],
      sceneInstructions: '',
      settings: { aspectRatio: '16:9', durationSeconds: 8 },
      manualOutputs: {},
      resultMediaLinks: [],
      reviewNotes: '',
      reviewStatus: 'unreviewed',
    });
    await refreshSnapshot();
    return created;
  }, [snapshot, refreshSnapshot]);

  const applyAssetToScene = useCallback(
    async (asset: PromptAsset, navigateToBuilder = true) => {
      const draft = await getOrCreateActiveDraft();
      const targetSlot = CATEGORY_TO_SLOT[asset.category];

      if (targetSlot === 'character') {
        const check = checkCharacterReplacementInDraft(draft, asset.id);
        if (check.requiresConfirmation) {
          setConfirmDialog({
            title: 'Replace Character & Clear Incompatible Variants?',
            message: `Replacing the character with "${asset.title}" will clear incompatible linked variant(s): ${check.incompatibleVariantTitles.join(
              ', '
            )}. Continue?`,
            confirmLabel: 'Replace & Clear Variants',
            cancelLabel: 'Cancel',
            danger: true,
            onConfirm: async () => {
              const nextSlots = { ...draft.slots };
              for (const s of check.incompatibleSlots) {
                delete nextSlots[s];
              }
              nextSlots.character = createSnapshotFromAsset(asset);
              await saveSceneDraft({
                ...draft,
                slots: nextSlots,
              });
              await refreshSnapshot();
              setConfirmDialog(null);
              showToast(`Added "${asset.title}" to Scene Builder.`, 'success');
              if (navigateToBuilder) navigate(`/builder/${draft.id}`, true);
            },
          });
          return;
        }
      }

      const nextSlots = {
        ...draft.slots,
        [targetSlot]: targetSlot === 'camera'
          ? rebaseCameraComposition(draft.slots.camera, createSnapshotFromAsset(asset))
          : createSnapshotFromAsset(asset),
      };
      const saved = await saveSceneDraft({
        ...draft,
        slots: nextSlots,
      });
      await refreshSnapshot();
      showToast(`Added "${asset.title}" to Scene Builder.`, 'success');
      if (navigateToBuilder) navigate(`/builder/${saved.id}`, true);
    },
    [getOrCreateActiveDraft, navigate, refreshSnapshot, showToast]
  );

  const applyVariantToScene = useCallback(
    async (variant: Variant, navigateToBuilder = true) => {
      const snap = snapshot ?? (await getAllSnapshot());
      const draft = await getOrCreateActiveDraft();
      const parentAsset = snap.assets.find(
        (a) => a.id === variant.parentCharacterId
      );

      const check = checkVariantApplicationToDraft(draft, variant, snap.assets);
      if (check.requiresConfirmation) {
        setConfirmDialog({
          title: 'Character Identity Mismatch',
          message: `This variant belongs to ${check.parentCharacterTitle}. Replace ${check.currentCharacterTitle} with ${check.parentCharacterTitle}?`,
          confirmLabel: `Switch to ${check.parentCharacterTitle}`,
          cancelLabel: 'Cancel',
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
            const saved = await saveSceneDraft({
              ...draft,
              slots: nextSlots,
            });
            await refreshSnapshot();
            setConfirmDialog(null);
            showToast(
              `Switched character to "${check.parentCharacterTitle}" and applied "${variant.title}".`,
              'success'
            );
            if (navigateToBuilder) navigate(`/builder/${saved.id}`, true);
          },
        });
        return;
      }

      const nextSlots: Partial<Record<BuilderSlot, any>> = { ...draft.slots };
      if (!nextSlots.character && parentAsset) {
        nextSlots.character = createSnapshotFromAsset(parentAsset);
      }
      nextSlots[variant.targetSlot] = variant.targetSlot === 'camera'
        ? rebaseCameraComposition(draft.slots.camera, createSnapshotFromVariant(variant))
        : createSnapshotFromVariant(variant);

      const saved = await saveSceneDraft({
        ...draft,
        slots: nextSlots,
      });
      await refreshSnapshot();
      showToast(`Applied variant "${variant.title}" to Scene Builder.`, 'success');
      if (navigateToBuilder) navigate(`/builder/${saved.id}`, true);
    },
    [getOrCreateActiveDraft, navigate, refreshSnapshot, showToast, snapshot]
  );

  const value = useMemo<LibraryContextValue>(
    () => ({
      snapshot,
      loading,
      storageError,
      refreshSnapshot,
      loadStarterData,
      hashPath,
      navigate,
      setDirtyFormGuard,
      browseState,
      updateBrowseState,
      toasts,
      showToast,
      dismissToast,
      copyText,
      clipboardFallback,
      closeClipboardFallback: () => setClipboardFallback(null),
      isSettingsOpen,
      setIsSettingsOpen,
      collectionModalTarget,
      openCollectionModal: setCollectionModalTarget,
      closeCollectionModal: () => setCollectionModalTarget(null),
      confirmDialog,
      openConfirmDialog: setConfirmDialog,
      closeConfirmDialog: () => setConfirmDialog(null),
      getOrCreateActiveDraft,
      applyAssetToScene,
      applyVariantToScene,
    }),
    [
      snapshot,
      loading,
      storageError,
      refreshSnapshot,
      loadStarterData,
      hashPath,
      navigate,
      setDirtyFormGuard,
      browseState,
      updateBrowseState,
      toasts,
      showToast,
      dismissToast,
      copyText,
      clipboardFallback,
      isSettingsOpen,
      collectionModalTarget,
      confirmDialog,
      getOrCreateActiveDraft,
      applyAssetToScene,
      applyVariantToScene,
    ]
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
};

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) {
    throw new Error('useLibrary must be used inside LibraryProvider');
  }
  return ctx;
}
