import type { QwenHardwareSettings, QwenSettings, QwenDictionarySettings } from '../types/qwen';

export const QWEN_SETTINGS_STORAGE_KEY = 'krakinai.qwen.settings.v1';

export const DEFAULT_DICTIONARY_SETTINGS: QwenDictionarySettings = {
  detailLevel: 'full_with_context',
  speedPreset: 'balanced',
  showSynonyms: true,
  autoSaveToLibrary: true,
  cacheEnabled: true,
};

export const DEFAULT_BASE_SYSTEM_PROMPT =
  `You are the KRAKINAI Story & Screenwriting Co-Pilot, powered by local Qwen 3.5.\n` +
  `You collaborate with the author on narrative architecture, pacing, character arcs, and dialogue.\n` +
  `You naturally support both authentic cinematic English and Filipino/Taglish when appropriate.`;

export const DEFAULT_QWEN_SETTINGS: QwenSettings = {
  live: {
    reasoningEffort: 'medium',
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 4096,
  },
  hardware: {
    executablePath: 'C:\\Users\\HomePC\\AI\\llama.cpp\\b12223\\llama-server.exe',
    modelPath:
      'C:\\Users\\HomePC\\AI\\models\\Qwen3.5-9B-Defiant-Q4_K_S\\Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-Q4_K_S.gguf',
    host: '127.0.0.1',
    port: 8080,
    contextSize: 8192,
    fitTargetMb: 1536,
    batchSize: 256,
    ubatchSize: 128,
    cpuThreads: null,
  },
  dictionary: DEFAULT_DICTIONARY_SETTINGS,
  companionPosition: null,
  performancePosition: null,
  isPerformancePanelOpen: false,
  isDockedInBed: true,
  activePersona: 'screenwriter',
  autoApplyPatches: true,
  customSystemPrompt: '',
  customSkillPrompts: [],
};

export function validateHardwareSettings(hw: QwenHardwareSettings): void {
  if (!hw) {
    throw new Error('Hardware settings are required.');
  }
  const exe = (hw.executablePath || '').trim();
  if (!exe.toLowerCase().endsWith('llama-server.exe')) {
    throw new Error(`Executable path must point to llama-server.exe. Got: "${exe}"`);
  }
  const model = (hw.modelPath || '').trim();
  if (!model.toLowerCase().endsWith('.gguf')) {
    throw new Error(`Model path must point to a .gguf file. Got: "${model}"`);
  }
  if (typeof hw.port !== 'number' || hw.port < 1024 || hw.port > 65535) {
    throw new Error(`Server port must be between 1024 and 65535. Got: ${hw.port}`);
  }
}

export function buildLlamaServerArgs(hw: QwenHardwareSettings): string[] {
  validateHardwareSettings(hw);

  const args = [
    '-m',
    hw.modelPath,
    '--host',
    hw.host || '127.0.0.1',
    '--port',
    String(hw.port || 8080),
    '-ngl',
    'auto',
    '-c',
    String(hw.contextSize || 8192),
    '-b',
    String(hw.batchSize || 256),
    '-ub',
    String(hw.ubatchSize || 128),
    '-np',
    '1',
    '--fit',
    'on',
    '--fit-target',
    String(hw.fitTargetMb || 1536),
    '--cors-origins',
    'localhost',
    '--no-cors-credentials',
  ];

  if (typeof hw.cpuThreads === 'number' && hw.cpuThreads > 0) {
    args.push('-t', String(hw.cpuThreads));
  }

  return args;
}

export function loadQwenSettings(): QwenSettings {
  if (typeof localStorage === 'undefined') {
    return { ...DEFAULT_QWEN_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(QWEN_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_QWEN_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    const parsedHw = parsed.hardware || {};
    const parsedLive = parsed.live || {};

    // Auto-migrate legacy 4096 contextSize to 8192, legacy 1536 maxTokens to 4096, and legacy 'off' reasoningEffort to 'medium'
    const migratedContextSize =
      typeof parsedHw.contextSize === 'number' && parsedHw.contextSize <= 4096
        ? 8192
        : (parsedHw.contextSize || DEFAULT_QWEN_SETTINGS.hardware.contextSize);

    const migratedMaxTokens =
      typeof parsedLive.maxTokens === 'number' && parsedLive.maxTokens <= 1536
        ? 4096
        : (parsedLive.maxTokens || DEFAULT_QWEN_SETTINGS.live.maxTokens);

    const migratedReasoningEffort =
      parsedLive.reasoningEffort === 'off' || !parsedLive.reasoningEffort
        ? 'medium'
        : parsedLive.reasoningEffort;

    return {
      live: {
        ...DEFAULT_QWEN_SETTINGS.live,
        ...parsedLive,
        maxTokens: migratedMaxTokens,
        reasoningEffort: migratedReasoningEffort,
      },
      hardware: {
        ...DEFAULT_QWEN_SETTINGS.hardware,
        ...parsedHw,
        contextSize: migratedContextSize,
      },
      dictionary: {
        ...DEFAULT_DICTIONARY_SETTINGS,
        ...(parsed.dictionary || {}),
      },
      companionPosition: parsed.companionPosition ?? null,
      performancePosition: parsed.performancePosition ?? null,
      isPerformancePanelOpen: typeof parsed.isPerformancePanelOpen === 'boolean' ? parsed.isPerformancePanelOpen : false,
      isDockedInBed: typeof parsed.isDockedInBed === 'boolean' ? parsed.isDockedInBed : true,
      activePersona: parsed.activePersona || 'screenwriter',
      autoApplyPatches: typeof parsed.autoApplyPatches === 'boolean' ? parsed.autoApplyPatches : true,
      customSystemPrompt: typeof parsed.customSystemPrompt === 'string' ? parsed.customSystemPrompt : '',
      customSkillPrompts: Array.isArray(parsed.customSkillPrompts) ? parsed.customSkillPrompts : [],
    };
  } catch (err) {
    console.warn('[QwenSettings] Failed to parse stored settings, falling back to defaults:', err);
    return { ...DEFAULT_QWEN_SETTINGS };
  }
}

export function saveQwenSettings(settings: QwenSettings): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(QWEN_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export const QWEN_CHAT_STORAGE_KEY = 'krakinai.qwen.chat_history.v1';

export function getDefaultGreeting(storyTitle?: string): import('../types/qwen').QwenChatMessage {
  return {
    id: 'initial-greeting',
    role: 'assistant',
    content: storyTitle
      ? `Hello! I am your local Qwen 3.5 Story Co-Pilot. I'm connected to "${storyTitle}". How can I assist you with your story today?`
      : `Hello! I am your local Qwen 3.5 Story Co-Pilot. How can I assist you with your creative work today?`,
    timestamp: Date.now(),
  };
}

export function loadQwenChatHistory(storyTitle?: string): import('../types/qwen').QwenChatMessage[] {
  if (typeof localStorage === 'undefined') {
    return [getDefaultGreeting(storyTitle)];
  }
  try {
    const raw = localStorage.getItem(QWEN_CHAT_STORAGE_KEY);
    if (!raw) return [getDefaultGreeting(storyTitle)];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [getDefaultGreeting(storyTitle)];
  } catch (err) {
    console.warn('[QwenChat] Failed to parse stored chat history:', err);
    return [getDefaultGreeting(storyTitle)];
  }
}

export function saveQwenChatHistory(messages: import('../types/qwen').QwenChatMessage[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(QWEN_CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch (err) {
    console.warn('[QwenChat] Failed to save chat history:', err);
  }
}

export function clearQwenChatHistory(storyTitle?: string): import('../types/qwen').QwenChatMessage[] {
  const initial = [getDefaultGreeting(storyTitle)];
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(QWEN_CHAT_STORAGE_KEY);
  }
  return initial;
}
