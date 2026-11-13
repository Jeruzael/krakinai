import type {
  Story,
  StoryAct,
  StorySequence,
  StorySceneNode,
  StoryBeat,
  StoryDramaticMeta,
} from './domain';

export type QwenLifecycleState = 'sleeping' | 'waking' | 'awake' | 'stopping' | 'error';

export type QwenReasoningEffort = 'off' | 'low' | 'medium' | 'high';

export interface QwenLiveSettings {
  reasoningEffort: QwenReasoningEffort;
  temperature: number; // 0.1 - 1.5, default 0.7
  topP: number; // 0.1 - 1.0, default 0.9
  maxTokens: number; // 256 - 4096, default 1536
}

export interface QwenHardwareSettings {
  executablePath: string; // default: C:\Users\HomePC\AI\llama.cpp\b12223\llama-server.exe
  modelPath: string; // default: C:\Users\HomePC\AI\models\Qwen3.5-9B-Defiant-Q4_K_S\Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-Q4_K_S.gguf
  host: string; // default: 127.0.0.1
  port: number; // default: 8080
  contextSize: 4096 | 8192 | 16384; // default: 8192 (-c)
  fitTargetMb: number; // default: 1536 (--fit-target)
  batchSize: number; // default: 256 (-b)
  ubatchSize: number; // default: 128 (-ub)
  cpuThreads: number | null; // default: null (or e.g. 4 for -t 4)
}

export type QwenSkillPersona =
  | 'screenwriter'
  | 'editor'
  | 'novelist'
  | 'director'
  | 'storyboarder';

export type QwenActiveScreenKind =
  | 'stories_overview'
  | 'story_workspace'
  | 'scene_builder'
  | 'library'
  | 'collections'
  | 'other';

export interface ActiveScreenFormDrafts {
  isEditModalOpen?: boolean;
  isEditingManuscript?: boolean;
  title?: string;
  author?: string;
  tags?: string[];
  logline?: string;
  premise?: string;
  synopsis?: string;
  treatment?: string;
  manuscriptDraft?: string;
}

export interface QwenActiveScreenContext {
  screenKind: QwenActiveScreenKind;
  routePath: string;
  screenLabel: string;
  activeTab?: 'book' | 'creator' | 'briefing';
  formDrafts?: ActiveScreenFormDrafts;
}

export interface StoryFieldsUpdatePayload {
  title?: string;
  author?: string;
  tags?: string[];
  logline?: string;
  premise?: string;
  synopsis?: string;
  treatment?: string;
  fullBookText?: string;
  bookTextMode?: 'append' | 'replace';
}

export type QwenDictionaryDetailLevel =
  | 'definition_only'
  | 'definition_examples'
  | 'full_with_context';

export type QwenDictionarySpeedPreset = 'fast' | 'balanced' | 'detailed';

export interface QwenDictionarySettings {
  detailLevel: QwenDictionaryDetailLevel;
  speedPreset: QwenDictionarySpeedPreset;
  showSynonyms: boolean;
  autoSaveToLibrary: boolean;
  cacheEnabled: boolean;
}

export interface DictionaryLibraryEntry {
  id: string; // normalized lowercase key
  word: string;
  partOfSpeech: string;
  definition: string;
  contextualMeaning?: string;
  examples: string[];
  synonyms: string[];
  tokenCost?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  detailLevel: QwenDictionaryDetailLevel;
  createdAt: number;
  lastAccessedAt: number;
  hitCount: number;
}

export interface DictionaryExportPayload {
  format: 'krakinai.qwen.dictionary';
  version: 1;
  exportedAt: string;
  totalEntries: number;
  entries: Record<string, DictionaryLibraryEntry>;
}

export interface QwenCustomSkillPrompt {
  id: string; // unique ID e.g. "skill-1718000000"
  command: string; // trigger without slash e.g. "critique" or "dark-fantasy"
  label: string; // display title e.g. "Plot Hole Critique"
  description: string; // short summary
  prompt: string; // injected prompt template
  icon?: string; // optional emoji or icon tag
  createdAt: number;
}

export type SlashCommandCategory =
  | 'persona'
  | 'screenplay'
  | 'editorial'
  | 'novelist'
  | 'director'
  | 'storyboarder'
  | 'creator'
  | 'utility'
  | 'custom';

export interface SlashCommandItem {
  command: string; // e.g. "/screenwriter", "/taglish", "/critique"
  label: string; // display label
  category: SlashCommandCategory;
  categoryLabel: string;
  description: string;
  icon: string;
  actionType: 'switch_persona' | 'insert_prompt' | 'utility';
  targetPersona?: QwenSkillPersona;
  promptTemplate?: string;
  utilityId?: 'clear' | 'help';
}

export interface QwenSettings {
  live: QwenLiveSettings;
  hardware: QwenHardwareSettings;
  dictionary: QwenDictionarySettings;
  companionPosition: { x: number; y: number } | null; // null = docked in Virtual Bed
  performancePosition?: { x: number; y: number } | null; // floating telemetry modal position
  isPerformancePanelOpen?: boolean;
  isDockedInBed: boolean; // default: true (starts OFF to save RAM/VRAM until dragged out)
  activePersona?: QwenSkillPersona; // default: 'screenwriter'
  autoApplyPatches: boolean; // default: true (instantly updates active fields/story)
  customSystemPrompt?: string; // User-defined base system prompt override (falls back to default if blank)
  customSkillPrompts?: QwenCustomSkillPrompt[]; // User-defined custom slash skills
}

export interface QwenProcessMetrics {
  pid: number | null;
  state: QwenLifecycleState;
  ramWorkingSetMb: number;
  cpuPercent: number;
  gpuPercent: number | null;
  vramUsedMb: number | null;
  vramTotalMb: number | null;
  temperatureC: number | null;
  gpuDeviceName: string | null;
  uptimeSeconds: number;
  port: number;
  contextSize: number;
  fitTargetMb: number;
}

export interface QwenGenerationTelemetry {
  isGenerating: boolean;
  taskName?: string | null;
  currentSpeedTokPerSec: number;
  peakSpeedTokPerSec: number;
  speedHistory: number[]; // Last 30 samples for sparkline
  ttftMs: number | null; // Time to first token in ms
  elapsedSeconds: number;
  promptTokens: number;
  thinkingTokens: number; // Real-time count of thinking tokens consumed
  answerTokens: number;   // Real-time count of answer tokens generated
  storyContextTokens: number;
  chatHistoryTokens: number;
  generatedTokens: number;
  totalTokens: number;
  contextMax: number;
  finishReason: 'generating' | 'stop' | 'length' | 'aborted' | 'error' | null;
}

export interface WordDefinitionResult {
  word: string;
  partOfSpeech: string;
  definition: string;
  contextualMeaning?: string;
  examples: string[];
  synonyms: string[];
  tokenCost?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cached?: boolean;
}

export interface QwenServerStatus {
  state: QwenLifecycleState;
  pid: number | null;
  port: number;
  modelReady: boolean;
  lastError: string | null;
  activeArgs?: string[];
}

export interface CreatorModeSelection {
  actId?: string;
  sequenceId?: string;
  sceneId?: string;
  beatId?: string;
}

export type QwenStoryPatchAction =
  | {
      type: 'update_pitch';
      fields: Partial<Pick<Story, 'title' | 'author' | 'tags' | 'logline' | 'premise' | 'synopsis' | 'treatment'>>;
    }
  | {
      type: 'update_story_fields';
      fields: StoryFieldsUpdatePayload;
    }
  | {
      type: 'create_story';
      initialFields: StoryFieldsUpdatePayload;
    }
  | {
      type: 'append_acts';
      acts: StoryAct[];
    }
  | {
      type: 'append_sequences';
      actId: string;
      sequences: StorySequence[];
    }
  | {
      type: 'append_scenes';
      actId: string;
      sequenceId: string;
      scenes: StorySceneNode[];
    }
  | {
      type: 'append_beats';
      actId: string;
      sequenceId: string;
      sceneId: string;
      beats: StoryBeat[];
    }
  | {
      type: 'update_dramatic_meta';
      target: CreatorModeSelection;
      dramaticMeta: StoryDramaticMeta;
    }
  | {
      type: 'append_book_text';
      text: string;
      mode: 'append' | 'replace';
    };

export interface QwenChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  thinkingContent?: string;
  patchAction?: QwenStoryPatchAction;
  patchApplied?: boolean;
  previousStorySnapshot?: Story;
  finishReason?: 'generating' | 'stop' | 'length' | 'aborted' | 'error' | null;
  timestamp: number;
}
