import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { Story } from '../types/domain';
import type {
  ActiveScreenFormDrafts,
  CreatorModeSelection,
  QwenActiveScreenContext,
  QwenHardwareSettings,
  QwenServerStatus,
  QwenSettings,
  QwenStoryPatchAction,
  StoryFieldsUpdatePayload,
  QwenGenerationTelemetry,
  QwenProcessMetrics,
} from '../types/qwen';
import {
  getQwenStatus,
  getQwenProcessMetrics,
  startQwen,
  stopQwen,
  restartQwen,
} from '../services/qwenClient';
import {
  loadQwenSettings,
  saveQwenSettings,
  loadQwenChatHistory,
  saveQwenChatHistory,
  clearQwenChatHistory,
  DEFAULT_QWEN_SETTINGS,
} from '../storage/qwenSettings';
import { calculateLiveTokens } from '../services/qwenStoryContext';

export interface StoryContextBinding {
  story: Story;
  mode: 'pitch' | 'creator' | 'book';
  selection?: CreatorModeSelection;
  formDrafts?: ActiveScreenFormDrafts;
  onApplyStoryPatch: (action: QwenStoryPatchAction) => void;
  onUndoStoryPatch?: (previousStory: Story) => void;
  referencedAssets?: Array<{ id: string; name: string; kind?: string }>;
}

interface QwenContextValue {
  settings: QwenSettings;
  status: QwenServerStatus;
  metrics: QwenProcessMetrics | null;
  isPanelOpen: boolean;
  isSettingsOpen: boolean;
  isRestarting: boolean;
  isHoveringBed: boolean;
  isDraggingAvatar: boolean;
  activeScreen: QwenActiveScreenContext;
  chatMessages: import('../types/qwen').QwenChatMessage[];
  activeStoryBinding: StoryContextBinding | null;
  bedElementRef: React.MutableRefObject<HTMLDivElement | null>;
  setIsPanelOpen: (open: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setIsHoveringBed: (hovering: boolean) => void;
  setIsDraggingAvatar: (dragging: boolean) => void;
  setActiveScreen: React.Dispatch<React.SetStateAction<QwenActiveScreenContext>>;
  setChatMessages: React.Dispatch<React.SetStateAction<import('../types/qwen').QwenChatMessage[]>>;
  clearChatMessages: () => void;
  telemetry: QwenGenerationTelemetry;
  updateTelemetry: (partial: Partial<QwenGenerationTelemetry>) => void;
  wakeQwen: () => Promise<void>;
  sleepQwen: () => Promise<void>;
  saveSettings: (newSettings: QwenSettings) => void;
  applyAndRestart: (hw: QwenHardwareSettings) => Promise<void>;
  updateAvatarPosition: (pos: { x: number; y: number } | null) => void;
  registerStoryContext: (binding: StoryContextBinding) => void;
  unregisterStoryContext: () => void;
  createStoryFromCoPilot: (initialFields: StoryFieldsUpdatePayload) => Promise<string | void>;
  registerStoryCreationHandler: (handler: (initialFields: StoryFieldsUpdatePayload) => Promise<string | void>) => () => void;
}

const QwenContext = createContext<QwenContextValue | null>(null);

export const QwenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<QwenSettings>(() => loadQwenSettings());
  const [status, setStatus] = useState<QwenServerStatus>({
    state: 'sleeping',
    pid: null,
    port: 8080,
    modelReady: false,
    lastError: null,
  });
  const [metrics, setMetrics] = useState<QwenProcessMetrics | null>(null);

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isHoveringBed, setIsHoveringBed] = useState(false);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);
  const [activeStoryBinding, setActiveStoryBinding] = useState<StoryContextBinding | null>(null);
  const [activeScreen, setActiveScreen] = useState<QwenActiveScreenContext>({
    screenKind: 'library',
    routePath: '/',
    screenLabel: 'Visual Prompt Library',
  });
  const storyCreationHandlerRef = useRef<((initialFields: StoryFieldsUpdatePayload) => Promise<string | void>) | null>(null);
  const [chatMessages, setChatMessages] = useState<import('../types/qwen').QwenChatMessage[]>(() =>
    loadQwenChatHistory()
  );

  const bedElementRef = useRef<HTMLDivElement | null>(null);

  const [telemetry, setTelemetry] = useState<QwenGenerationTelemetry>(() => {
    const initialTokens = calculateLiveTokens({ committedMessages: loadQwenChatHistory() }).totalTokens;
    return {
      isGenerating: false,
      currentSpeedTokPerSec: 0,
      peakSpeedTokPerSec: 0,
      speedHistory: [],
      ttftMs: null,
      elapsedSeconds: 0,
      promptTokens: 0,
      thinkingTokens: 0,
      answerTokens: 0,
      storyContextTokens: 0,
      chatHistoryTokens: 0,
      generatedTokens: 0,
      totalTokens: initialTokens,
      contextMax: 8192,
      finishReason: null,
    };
  });

  const updateTelemetry = (partial: Partial<QwenGenerationTelemetry>) => {
    setTelemetry((prev) => ({ ...prev, ...partial }));
  };

  useEffect(() => {
    const handleTelemetryEvent = (e: Event) => {
      const custom = e as CustomEvent<Partial<QwenGenerationTelemetry>>;
      if (custom.detail) {
        updateTelemetry(custom.detail);
      }
    };
    window.addEventListener('krakinai:telemetry-update', handleTelemetryEvent);
    return () => {
      window.removeEventListener('krakinai:telemetry-update', handleTelemetryEvent);
    };
  }, []);

  useEffect(() => {
    const currentTokens = calculateLiveTokens({
      committedMessages: chatMessages,
      baselinePromptTokens: telemetry.storyContextTokens || 0,
    }).totalTokens;
    setTelemetry((prev) => ({ ...prev, totalTokens: currentTokens }));
  }, [chatMessages, telemetry.storyContextTokens]);

  useEffect(() => {
    let isMounted = true;
    getQwenStatus()
      .then((s) => {
        if (isMounted) {
          setStatus(s);
          if (s.state === 'awake') {
            setSettings((prev) => ({ ...prev, isDockedInBed: false }));
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setStatus((prev) => ({ ...prev, state: 'sleeping' }));
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Poll engine process metrics when awake
  useEffect(() => {
    if (status.state !== 'awake') {
      setMetrics(null);
      return;
    }
    let isMounted = true;
    const fetchMetrics = () => {
      getQwenProcessMetrics()
        .then((m) => {
          if (isMounted) setMetrics(m);
        })
        .catch(() => {});
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [status.state]);

  const handleSaveSettings = (newSettings: QwenSettings) => {
    setSettings(newSettings);
    saveQwenSettings(newSettings);
  };

  const wakeQwen = async () => {
    setStatus((prev) => ({ ...prev, state: 'waking' }));
    try {
      const s = await startQwen(settings.hardware);
      setStatus(s);
      const updated = {
        ...settings,
        isDockedInBed: false,
        companionPosition: settings.companionPosition || {
          x: Math.max(20, window.innerWidth - 90),
          y: 90,
        },
      };
      handleSaveSettings(updated);
      setIsPanelOpen(true);
      getQwenProcessMetrics().then(setMetrics).catch(() => {});
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        state: 'error',
        lastError: (err as Error).message,
      }));
    }
  };

  const sleepQwen = async () => {
    setStatus((prev) => ({ ...prev, state: 'stopping' }));
    try {
      const s = await stopQwen();
      setStatus(s);
      const updated = {
        ...settings,
        isDockedInBed: true,
        companionPosition: null,
      };
      handleSaveSettings(updated);
      setIsPanelOpen(false);
      setIsHoveringBed(false);
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        state: 'error',
        lastError: (err as Error).message,
      }));
    }
  };

  const applyAndRestart = async (hw: QwenHardwareSettings) => {
    setIsRestarting(true);
    try {
      const s = await restartQwen(hw);
      setStatus(s);
      const updated: QwenSettings = {
        ...settings,
        hardware: { ...hw },
      };
      handleSaveSettings(updated);
      getQwenProcessMetrics().then(setMetrics).catch(() => {});
    } finally {
      setIsRestarting(false);
    }
  };

  const updateAvatarPosition = (pos: { x: number; y: number } | null) => {
    setSettings((prev) => {
      const next = { ...prev, companionPosition: pos };
      saveQwenSettings(next);
      return next;
    });
  };

  const handleSetChatMessages: React.Dispatch<React.SetStateAction<import('../types/qwen').QwenChatMessage[]>> = (action) => {
    setChatMessages((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      saveQwenChatHistory(next);
      return next;
    });
  };

  const handleClearChat = () => {
    const fresh = clearQwenChatHistory(activeStoryBinding?.story?.title);
    setChatMessages(fresh);
  };

  const registerStoryContext = (binding: StoryContextBinding) => {
    setActiveStoryBinding(binding);
    setActiveScreen({
      screenKind: 'story_workspace',
      routePath: `/stories/${binding.story.id}`,
      screenLabel: `Story Workspace: "${binding.story.title || 'Untitled Story'}"`,
      activeTab: binding.mode === 'creator' ? 'creator' : binding.mode === 'book' ? 'book' : undefined,
      formDrafts: binding.formDrafts,
    });
  };

  const unregisterStoryContext = () => {
    setActiveStoryBinding(null);
  };

  const registerStoryCreationHandler = (
    handler: (initialFields: StoryFieldsUpdatePayload) => Promise<string | void>
  ) => {
    storyCreationHandlerRef.current = handler;
    return () => {
      if (storyCreationHandlerRef.current === handler) {
        storyCreationHandlerRef.current = null;
      }
    };
  };

  const createStoryFromCoPilot = async (initialFields: StoryFieldsUpdatePayload) => {
    if (storyCreationHandlerRef.current) {
      return await storyCreationHandlerRef.current(initialFields);
    }
  };

  return (
    <QwenContext.Provider
      value={{
        settings,
        status,
        metrics,
        isPanelOpen,
        isSettingsOpen,
        isRestarting,
        isHoveringBed,
        isDraggingAvatar,
        activeScreen,
        chatMessages,
        telemetry,
        updateTelemetry,
        activeStoryBinding,
        bedElementRef,
        setIsPanelOpen,
        setIsSettingsOpen,
        setIsHoveringBed,
        setIsDraggingAvatar,
        setActiveScreen,
        setChatMessages: handleSetChatMessages,
        clearChatMessages: handleClearChat,
        wakeQwen,
        sleepQwen,
        saveSettings: handleSaveSettings,
        applyAndRestart,
        updateAvatarPosition,
        registerStoryContext,
        unregisterStoryContext,
        createStoryFromCoPilot,
        registerStoryCreationHandler,
      }}
    >
      {children}
    </QwenContext.Provider>
  );
};

export function useQwenOptional(): QwenContextValue | null {
  return useContext(QwenContext);
}

const FALLBACK_QWEN_CONTEXT: QwenContextValue = {
  settings: {
    ...DEFAULT_QWEN_SETTINGS,
  },
  status: {
    state: 'sleeping',
    pid: null,
    port: 8080,
    modelReady: false,
    lastError: null,
  },
  metrics: null,
  isPanelOpen: false,
  isSettingsOpen: false,
  isRestarting: false,
  isHoveringBed: false,
  isDraggingAvatar: false,
  activeScreen: {
    screenKind: 'library',
    routePath: '/',
    screenLabel: 'Visual Prompt Library',
  },
  chatMessages: [
    {
      id: 'initial-greeting',
      role: 'assistant',
      content: 'Hello! I am your local Qwen 3.5 Story Co-Pilot. How can I assist you today?',
      timestamp: Date.now(),
    },
  ],
  activeStoryBinding: null,
  bedElementRef: { current: null },
  setIsPanelOpen: () => {},
  setIsSettingsOpen: () => {},
  setIsHoveringBed: () => {},
  setIsDraggingAvatar: () => {},
  setActiveScreen: () => {},
  setChatMessages: () => {},
  clearChatMessages: () => {},
  telemetry: {
    isGenerating: false,
    currentSpeedTokPerSec: 0,
    peakSpeedTokPerSec: 0,
    speedHistory: [],
    ttftMs: null,
    elapsedSeconds: 0,
    promptTokens: 0,
    thinkingTokens: 0,
    answerTokens: 0,
    storyContextTokens: 0,
    chatHistoryTokens: 0,
    generatedTokens: 0,
    totalTokens: 0,
    contextMax: 8192,
    finishReason: null,
  },
  updateTelemetry: () => {},
  wakeQwen: async () => {},
  sleepQwen: async () => {},
  saveSettings: () => {},
  applyAndRestart: async () => {},
  updateAvatarPosition: () => {},
  registerStoryContext: () => {},
  unregisterStoryContext: () => {},
  createStoryFromCoPilot: async () => {},
  registerStoryCreationHandler: () => () => {},
};

export function useQwen(): QwenContextValue {
  const ctx = useContext(QwenContext);
  return ctx || FALLBACK_QWEN_CONTEXT;
}
