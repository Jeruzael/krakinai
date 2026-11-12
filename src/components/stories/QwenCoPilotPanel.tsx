import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Story } from '../../types/domain';
import type {
  CreatorModeSelection,
  QwenChatMessage,
  QwenServerStatus,
  QwenSettings,
  QwenStoryPatchAction,
  QwenSkillPersona,
  SlashCommandItem,
} from '../../types/qwen';
import { streamChatCompletion } from '../../services/qwenClient';
import {
  buildStoryCoPilotMessages,
  estimateTokenCount,
  calculateLiveTokens,
  calculateGenerationSpeed,
  extractStoryPatchFromResponse,
  stripQwenPatchBlock,
} from '../../services/qwenStoryContext';
import {
  resolveSlashCommands,
  filterSlashCommands,
  generateSlashHelpMarkdown,
} from './slashCommands';
import { clearQwenChatHistory } from '../../storage/qwenSettings';
import { useQwen } from '../../context/QwenContext';
import {
  Settings,
  Trash2,
  Minus,
  X,
  Send,
  Square,
  Sparkles,
  Zap,
  ChevronDown,
} from 'lucide-react';
import { StoryMarkdownRenderer } from './StoryMarkdownRenderer';
import './qwenCoPilot.css';

interface QwenCoPilotPanelProps {
  isOpen?: boolean;
  story: Story;
  mode: 'pitch' | 'creator' | 'book';
  selection?: CreatorModeSelection;
  settings: QwenSettings;
  status: QwenServerStatus;
  onClose: () => void;
  onOpenSettings: () => void;
  onApplyStoryPatch: (action: QwenStoryPatchAction) => void;
  referencedAssets?: Array<{ id: string; name: string; kind?: string }>;
  positionAnchor?: { x: number; y: number };
}

export interface PersonaMeta {
  id: QwenSkillPersona;
  title: string;
  icon: string;
  tagline: string;
  description: string;
  quickActions: Array<{ label: string; prompt: string }>;
}

export const QWEN_PERSONAS: Record<QwenSkillPersona, PersonaMeta> = {
  screenwriter: {
    id: 'screenwriter',
    title: 'Story Screenwriter',
    icon: '🎭',
    tagline: 'Screenplay & Dialogue',
    description: 'Natural Taglish dialogue, banter, subtext, and 5-to-10-second beat breakdown.',
    quickActions: [
      { label: '🇵🇭 Polish Taglish Dialogue', prompt: 'Polish the scene dialogue with authentic, natural Filipino/Taglish conversational cadence.' },
      { label: '⏱️ Break into 5–10s Beats', prompt: 'Break down this scene into punchy 5-to-10-second cinematic story beats with clear action and dialogue.' },
      { label: '🎭 Subtext & Tension', prompt: 'Infuse subtle emotional subtext and unspoken tension between the characters.' },
      { label: '💥 Escalate Conflict', prompt: 'Escalate the dramatic stakes and character conflict with sharp, revealing lines.' },
    ],
  },
  editor: {
    id: 'editor',
    title: 'Script Doctor & Editor',
    icon: '🔍',
    tagline: 'Pacing & Duration Audit',
    description: 'Beat duration audits, dialogue breathing room, cutting fluff, and director handoffs.',
    quickActions: [
      { label: '⏱️ Beat Duration Audit', prompt: 'Audit this scene for beat duration. Flag any beats longer than 10 seconds or dialogue that is crammed.' },
      { label: '💨 Dialogue Breathing Room', prompt: 'Suggest where to insert silent reaction beats, character glances, and dramatic breathing room.' },
      { label: '📋 Director Handoff Briefing', prompt: 'Generate a Director Handoff Briefing with Lighting, Mood, and Vocal Performance notes.' },
      { label: '✂️ Cut Fluff & Tighten', prompt: 'Tighten this scene by trimming redundant lines and sharpening the core dramatic focus.' },
    ],
  },
  novelist: {
    id: 'novelist',
    title: 'Book Novelist',
    icon: '📚',
    tagline: 'Literary Manuscript',
    description: 'Continuous flowing chapter prose, sensory immersion, and internal monologues.',
    quickActions: [
      { label: '✍️ Write Next Chapter', prompt: 'Draft the next narrative chapter continuing from our current excerpt, maintaining vivid sensory immersion.' },
      { label: '🌿 Sensory Atmosphere', prompt: 'Deepen the environmental sensory details (sounds, smells, textures, ambient light).' },
      { label: '💭 Internal Monologue', prompt: 'Explore the protagonist\'s deep internal reflections and hidden emotional conflicts.' },
      { label: '📖 Expand Scene into Prose', prompt: 'Translate these outline beats into flowing, continuous literary manuscript prose.' },
    ],
  },
  director: {
    id: 'director',
    title: 'Story Director',
    icon: '🎬',
    tagline: 'Visual Prompts & Camera',
    description: '12-layer Omni visual prompts, camera framing, lighting assets, and keyframe stills.',
    quickActions: [
      { label: '🎥 12-Layer Visual Prompt', prompt: 'Generate a 12-layer visual prompt (subject, environment, wardrobe, lighting, lens, mood) for this shot.' },
      { label: '📐 Camera Composition', prompt: 'Suggest cinematic camera framing (e.g. low-angle dutch, slow push-in, shallow depth of field).' },
      { label: '💡 Lighting & Atmosphere', prompt: 'Define the lighting setup (e.g. golden hour rim light, neon chiaroscuro, volumetric mist).' },
      { label: '🎬 Keyframe Plan (Start/End)', prompt: 'Plan start and end keyframe stills to control motion across this 5-to-10-second shot.' },
    ],
  },
  storyboarder: {
    id: 'storyboarder',
    title: 'Storyboard Crafter',
    icon: '❤️',
    tagline: 'Emotional Reaction Coverage',
    description: 'Dramatic reaction pacing, emotional vulnerability micro-arcs, and psychological framing.',
    quickActions: [
      { label: '👁️ Reaction Shot Planning', prompt: 'Plan emotional reaction shots to give character emotions time to register and breathe.' },
      { label: '💓 Emotional Climax Arc', prompt: 'Map out the emotional micro-arcs and vulnerability shifts across this sequence.' },
      { label: '🪞 Psychological Staging', prompt: 'Use blocking and spatial staging to psychologically reflect the changing power dynamics.' },
      { label: '⏳ Lingering Close-Up', prompt: 'Design an intimate, lingering reaction shot capturing a silent realization.' },
    ],
  },
};

function getFieldNames(action?: QwenStoryPatchAction): string {
  if (!action) return '';
  if (action.type === 'update_pitch') {
    return Object.keys(action.fields).join(', ') || 'pitch details';
  }
  if (action.type === 'update_story_fields') {
    return (
      Object.keys(action.fields)
        .filter((k) => k !== 'bookTextMode')
        .join(', ') || 'story fields'
    );
  }
  if (action.type === 'create_story') {
    return `New Story: "${action.initialFields?.title || 'Untitled'}"`;
  }
  if (action.type === 'append_book_text') {
    return 'Manuscript prose';
  }
  if (action.type === 'append_acts') {
    const titles = action.acts.map((a) => `"${a.title}"`).join(', ');
    return `Acts: ${titles || 'New Act'} (Creator Mode)`;
  }
  if (action.type === 'append_sequences') {
    const titles = action.sequences.map((s) => `"${s.title}"`).join(', ');
    return `Sequences: ${titles || 'New Sequence'} (Creator Mode)`;
  }
  if (action.type === 'append_scenes') {
    const titles = action.scenes.map((sc) => `"${sc.title}"`).join(', ');
    return `Scenes: ${titles || 'New Scene'} (Creator Mode)`;
  }
  if (action.type === 'append_beats') {
    const titles = action.beats.map((b) => `"${b.title}"`).join(', ');
    return `Beats: ${titles || 'New Beat'} (Creator Mode)`;
  }
  if (action.type === 'update_dramatic_meta') return 'Dramatic & Continuity Metadata';
  return 'Fields';
}

export const QwenCoPilotPanel: React.FC<QwenCoPilotPanelProps> = ({
  isOpen = true,
  story,
  mode,
  selection,
  settings,
  status,
  onClose,
  onOpenSettings,
  onApplyStoryPatch,
  referencedAssets,
  positionAnchor,
}) => {
  const {
    chatMessages,
    setChatMessages,
    clearChatMessages,
    saveSettings,
    activeScreen,
    activeStoryBinding,
    createStoryFromCoPilot,
    updateTelemetry,
    metrics,
    applyAndRestart,
  } = useQwen();

  const [activePersona, setActivePersona] = useState<QwenSkillPersona>(
    () => settings.activePersona || 'screenwriter'
  );
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
  const personaMeta = QWEN_PERSONAS[activePersona] || QWEN_PERSONAS.screenwriter;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedThinking, setStreamedThinking] = useState('');
  const [streamedAnswer, setStreamedAnswer] = useState('');
  const [isLiveThinkingExpanded, setIsLiveThinkingExpanded] = useState(true);
  const [generationSpeed, setGenerationSpeed] = useState<number>(0);
  const streamStartTimeRef = useRef<number>(0);

  // Slash commands autocomplete state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  const allSlashCommands = useMemo(
    () => resolveSlashCommands(settings.customSkillPrompts),
    [settings.customSkillPrompts]
  );

  const filteredSlashCommands = useMemo(
    () => filterSlashCommands(slashQuery, allSlashCommands),
    [slashQuery, allSlashCommands]
  );

  useEffect(() => {
    setSelectedSlashIndex(0);
  }, [slashQuery]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof scrollRef.current?.scrollIntoView === 'function') {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, streamedAnswer, streamedThinking]);

  // Handle escape key to close persona dropdown or slash menu
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPersonaMenuOpen) setIsPersonaMenuOpen(false);
        if (slashMenuOpen) setSlashMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isPersonaMenuOpen, slashMenuOpen]);

  const handleSelectPersona = (pId: QwenSkillPersona) => {
    setActivePersona(pId);
    saveSettings({ ...settings, activePersona: pId });
    setIsPersonaMenuOpen(false);
  };

  const handleExecuteSlashCommand = (cmdItem: SlashCommandItem) => {
    if (!cmdItem) return;

    if (cmdItem.actionType === 'switch_persona' && cmdItem.targetPersona) {
      handleSelectPersona(cmdItem.targetPersona);
      setInput('');
      setSlashMenuOpen(false);
      const switchNotify: QwenChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `🎭 **Persona Switched:** Active persona is now **${cmdItem.label}**.\n\n${cmdItem.description}`,
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev, switchNotify]);
      return;
    }

    if (cmdItem.actionType === 'utility') {
      if (cmdItem.utilityId === 'clear') {
        const cleared = clearQwenChatHistory(story?.title);
        setChatMessages(cleared);
        setInput('');
        setSlashMenuOpen(false);
        return;
      }
      if (cmdItem.utilityId === 'help') {
        setInput('');
        setSlashMenuOpen(false);
        const helpMsg: QwenChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: generateSlashHelpMarkdown(allSlashCommands),
          timestamp: Date.now(),
        };
        setChatMessages((prev) => [...prev, helpMsg]);
        return;
      }
    }

    if (cmdItem.actionType === 'insert_prompt' && cmdItem.promptTemplate) {
      setInput(cmdItem.promptTemplate + ' ');
      setSlashMenuOpen(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const len = inputRef.current.value.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }, 50);
      return;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    if (val.startsWith('/')) {
      setSlashMenuOpen(true);
      setSlashQuery(val);
    } else {
      if (slashMenuOpen) setSlashMenuOpen(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!slashMenuOpen || filteredSlashCommands.length === 0) {
      if (e.key === 'Escape' && slashMenuOpen) {
        setSlashMenuOpen(false);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSlashIndex((prev) => (prev + 1) % filteredSlashCommands.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSlashIndex((prev) => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
      return;
    }

    if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      handleExecuteSlashCommand(filteredSlashCommands[selectedSlashIndex]);
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setSlashMenuOpen(false);
      return;
    }
  };

  // Quick actions combine persona actions and contextual mode actions
  const quickActions = personaMeta.quickActions;

  const handleUndoPatch = (messageId: string, snapshot?: Story) => {
    if (!snapshot) return;
    if (activeStoryBinding?.onUndoStoryPatch) {
      activeStoryBinding.onUndoStoryPatch(snapshot);
    }
    setChatMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, patchApplied: false } : m))
    );
  };

  const handleManualApplyPatch = async (messageId: string, action: QwenStoryPatchAction) => {
    if (action.type === 'create_story') {
      await createStoryFromCoPilot(action.initialFields);
      setChatMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, patchApplied: true } : m))
      );
    } else if (activeScreen.screenKind === 'stories_overview' && action.type === 'update_story_fields') {
      await createStoryFromCoPilot(action.fields);
      setChatMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, patchApplied: true } : m))
      );
    } else if (onApplyStoryPatch) {
      const snapshot = JSON.parse(JSON.stringify(story));
      onApplyStoryPatch(action);
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, patchApplied: true, previousStorySnapshot: snapshot }
            : m
        )
      );
    }
  };

  const handleSend = async (userText: string) => {
    const textToSend = userText.trim();
    if (!textToSend || isStreaming) return;

    const userMessage: QwenChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
    };

    const newHistory = [...chatMessages, userMessage];
    setChatMessages(newHistory);
    setInput('');
    setIsStreaming(true);
    setStreamedThinking('');
    setStreamedAnswer('');
    setGenerationSpeed(0);
    streamStartTimeRef.current = performance.now();

    updateTelemetry({
      isGenerating: true,
      taskName: `Co-Pilot: ${activePersona}`,
      currentSpeedTokPerSec: 0,
      ttftMs: null,
      thinkingTokens: 0,
      answerTokens: 0,
      generatedTokens: 0,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const promptMessages = buildStoryCoPilotMessages({
        story,
        mode,
        persona: activePersona,
        selection,
        activeScreen,
        chatHistory: newHistory
          .filter((m): m is QwenChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
          .map((m) => ({ role: m.role, content: m.content })),
        liveSettings: settings.live,
        referencedAssets,
        customSystemPrompt: settings.customSystemPrompt,
      });

      const response = await streamChatCompletion(
        promptMessages,
        settings.live,
        (deltaParams) => {
          setStreamedThinking(deltaParams.thinking);
          setStreamedAnswer(deltaParams.answer);

          const elapsedSec = (performance.now() - streamStartTimeRef.current) / 1000;
          const currentThinkingTokens = estimateTokenCount(deltaParams.thinking);
          const currentAnswerTokens = estimateTokenCount(deltaParams.answer);
          const currentStreamedTokens = currentThinkingTokens + currentAnswerTokens;
          const speed = calculateGenerationSpeed(currentStreamedTokens, elapsedSec);
          setGenerationSpeed(speed);

          updateTelemetry({
            isGenerating: true,
            currentSpeedTokPerSec: speed,
            ttftMs: deltaParams.ttftMs ?? null,
            thinkingTokens: currentThinkingTokens,
            answerTokens: currentAnswerTokens,
            generatedTokens: currentStreamedTokens,
            totalTokens: estimateTokenCount(promptMessages.map((p) => p.content).join(' ')) + currentStreamedTokens,
          });
        },
        controller.signal
      );

      const extractedPatch = extractStoryPatchFromResponse(textToSend, response.answer, mode);
      const cleanAnswer = stripQwenPatchBlock(response.answer);

      let patchApplied = false;
      let previousStorySnapshot: Story | undefined;

      if (extractedPatch) {
        if (settings.autoApplyPatches) {
          if (extractedPatch.type === 'create_story') {
            try {
              await createStoryFromCoPilot(extractedPatch.initialFields);
              patchApplied = true;
            } catch (err) {
              console.error('Failed to auto-create story from patch:', err);
            }
          } else if (
            activeScreen.screenKind === 'stories_overview' &&
            extractedPatch.type === 'update_story_fields'
          ) {
            try {
              await createStoryFromCoPilot(extractedPatch.fields);
              patchApplied = true;
            } catch (err) {
              console.error('Failed to auto-create story from fields patch:', err);
            }
          } else if (onApplyStoryPatch) {
            try {
              previousStorySnapshot = JSON.parse(JSON.stringify(story));
              onApplyStoryPatch(extractedPatch);
              patchApplied = true;
            } catch (err) {
              console.error('Failed to auto-apply patch:', err);
            }
          }
        }
      }

      const assistantMessage: QwenChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: cleanAnswer || response.answer,
        thinkingContent: response.thinking || undefined,
        patchAction: extractedPatch || undefined,
        patchApplied,
        previousStorySnapshot,
        finishReason: response.finishReason,
        timestamp: Date.now(),
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setChatMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `⚠️ Error during generation: ${(err as Error).message}`,
            timestamp: Date.now(),
          },
        ]);
      }
    } finally {
      setIsStreaming(false);
      setStreamedThinking('');
      setStreamedAnswer('');
      setGenerationSpeed(0);
      updateTelemetry({
        isGenerating: false,
        currentSpeedTokPerSec: 0,
      });
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleResetChat = () => {
    clearChatMessages();
  };

  // Build baseline prompt messages to accurately budget system instructions, story metadata & hierarchy
  const promptMessages = useMemo(() => {
    if (!story) return [];
    return buildStoryCoPilotMessages({
      story,
      mode,
      persona: activePersona,
      selection,
      activeScreen,
      chatHistory: chatMessages
        .filter((m): m is QwenChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content })),
      liveSettings: settings.live,
      referencedAssets,
    });
  }, [story, mode, activePersona, selection, activeScreen, chatMessages, settings.live, referencedAssets]);

  const baselinePromptTokens = useMemo(() => {
    return estimateTokenCount(promptMessages.map((p) => p.content).join(' '));
  }, [promptMessages]);

  // Live token calculation including baseline prompt and in-flight streamed content
  const { totalTokens, streamedTokens, committedTokens } = calculateLiveTokens({
    committedMessages: chatMessages,
    streamedThinking,
    streamedAnswer,
    baselinePromptTokens,
  });

  // Keep telemetry in sync with true context window usage
  useEffect(() => {
    updateTelemetry({
      storyContextTokens: baselinePromptTokens,
      totalTokens,
    });
  }, [baselinePromptTokens, totalTokens]);

  const runningContext = metrics?.contextSize || settings.hardware.contextSize || 8192;
  const targetContext = settings.hardware.contextSize || 8192;
  const isContextPendingRestart = Boolean(metrics?.contextSize && metrics.contextSize !== targetContext);
  const contextMax = runningContext;
  const contextUsagePercent = Math.min(100, Math.round((totalTokens / contextMax) * 100));

  // Position calculation relative to avatar
  let panelLeft = window.innerWidth - 460;
  let panelTop = 80;
  if (positionAnchor) {
    if (positionAnchor.x > window.innerWidth / 2) {
      panelLeft = Math.max(16, positionAnchor.x - 450);
    } else {
      panelLeft = Math.min(window.innerWidth - 460, positionAnchor.x + 70);
    }
    panelTop = Math.max(70, Math.min(window.innerHeight - 660, positionAnchor.y - 20));
  }

  return (
    <div
      role="region"
      aria-label="Qwen Story Co-Pilot"
      className="qwen-copilot-container"
      style={{
        left: `${panelLeft}px`,
        top: `${panelTop}px`,
        display: isOpen ? 'flex' : 'none',
      }}
    >
      {/* Header */}
      <div className="qwen-copilot-header">
        <div className="qwen-copilot-header-info">
          <span style={{ fontSize: '20px' }}>🤖</span>
          <div>
            <div className="qwen-copilot-header-title">
              <span>Qwen 3.5-9B</span>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: status.state === 'awake' ? '#10b981' : '#f59e0b',
                  display: 'inline-block',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <button
                type="button"
                onClick={() => setIsPersonaMenuOpen(!isPersonaMenuOpen)}
                className="qwen-persona-pill-btn"
                aria-label={`Active Skill: ${personaMeta.title}. Click to switch.`}
                aria-haspopup="listbox"
                aria-expanded={isPersonaMenuOpen}
                title="Switch AI Skill & Persona"
              >
                <span>{personaMeta.icon}</span>
                <span>{personaMeta.title.replace('Story ', '').replace('Script Doctor & ', '')}</span>
                <ChevronDown size={11} className={`chevron ${isPersonaMenuOpen ? 'open' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={onOpenSettings}
            title="Qwen Settings"
            aria-label="Settings"
            className="qwen-header-btn"
          >
            <Settings size={15} />
          </button>
          <button
            type="button"
            onClick={handleResetChat}
            title="Clear Chat History"
            aria-label="Clear chat"
            className="qwen-header-btn"
          >
            <Trash2 size={15} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Minimize"
            aria-label="Minimize Co-Pilot"
            className="qwen-header-btn"
          >
            <Minus size={15} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close Co-Pilot"
            className="qwen-header-btn"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Persona Selection Dropdown Menu */}
      {isPersonaMenuOpen && (
        <div className="qwen-persona-dropdown" role="listbox" aria-label="AI Skill Personas">
          <div className="qwen-persona-dropdown-header">
            <span>Select AI Skill Persona</span>
          </div>
          {Object.values(QWEN_PERSONAS).map((p) => (
            <div
              key={p.id}
              role="option"
              aria-selected={activePersona === p.id}
              onClick={() => handleSelectPersona(p.id)}
              className={`qwen-persona-item ${activePersona === p.id ? 'active' : ''}`}
            >
              <span className="persona-item-icon">{p.icon}</span>
              <div className="persona-item-body">
                <div className="persona-item-title-row">
                  <span className="persona-item-title">{p.title}</span>
                  {activePersona === p.id && <span className="persona-item-check">✓ Active</span>}
                </div>
                <span className="persona-item-desc">{p.description}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Screen & Auto-Write Bar */}
      <div className="qwen-active-screen-banner">
        <div className="qwen-active-screen-badge">
          <span className="qwen-screen-pulse" />
          <span className="qwen-screen-title" title={activeScreen.screenLabel}>
            📍 {activeScreen.screenLabel}
          </span>
          {activeScreen.formDrafts?.isEditModalOpen && (
            <span className="qwen-form-tag">Modal Open</span>
          )}
          {activeScreen.formDrafts?.isEditingManuscript && (
            <span className="qwen-form-tag">Editing Manuscript</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            className={`qwen-thinking-toggle-pill ${settings.live.reasoningEffort !== 'off' ? 'active' : ''}`}
            onClick={() => {
              const nextEffort = settings.live.reasoningEffort === 'off' ? 'medium' : 'off';
              saveSettings({
                ...settings,
                live: {
                  ...settings.live,
                  reasoningEffort: nextEffort,
                },
              });
            }}
            title={
              settings.live.reasoningEffort !== 'off'
                ? `Reasoning is ON (${settings.live.reasoningEffort}): Qwen outputs thinking process before writing.`
                : 'Reasoning is OFF: Qwen outputs response directly without thinking block.'
            }
          >
            {settings.live.reasoningEffort !== 'off' ? '🧠 Thinking: ON' : '💭 Thinking: OFF'}
          </button>

          <button
            type="button"
            className={`qwen-autowrite-pill ${settings.autoApplyPatches ? 'active' : ''}`}
            onClick={() =>
              saveSettings({ ...settings, autoApplyPatches: !settings.autoApplyPatches })
            }
            title={
              settings.autoApplyPatches
                ? 'Auto-Write is ON: Qwen will automatically update open fields & drafts.'
                : 'Auto-Write is OFF: Qwen will show an Apply button before updating fields.'
            }
          >
            {settings.autoApplyPatches ? '⚡ Auto-Write: ON' : '⏸️ Auto-Write: OFF'}
          </button>
        </div>
      </div>

      {/* Quick Action Chips */}
      <div className="qwen-copilot-quick-actions">
        {quickActions.map((action, i) => (
          <button
            key={i}
            type="button"
            disabled={isStreaming}
            onClick={() => handleSend(action.prompt)}
            className="qwen-quick-action-chip"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div className="qwen-copilot-messages">
        {chatMessages.map((m) => (
          <div
            key={m.id}
            className={`qwen-message-wrapper ${m.role === 'user' ? 'user' : 'assistant'}`}
          >
            <div className="qwen-message-bubble">
              {m.thinkingContent && (
                <details className="qwen-thought-accordion">
                  <summary className="qwen-thought-summary">
                    💭 Thought Process ({estimateTokenCount(m.thinkingContent)} tokens)
                  </summary>
                  <div className="qwen-thought-content">
                    {m.thinkingContent}
                  </div>
                </details>
              )}

              {m.role === 'assistant' ? (
                <StoryMarkdownRenderer content={m.content} variant="chat" />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              )}

              {m.finishReason === 'length' && (
                <div className="qwen-length-continuation-banner">
                  <span>⚠️ Generation paused at token limit (~{runningContext.toLocaleString()} tokens).</span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="qwen-continue-btn"
                      onClick={() => {
                        void handleSend(
                          'Please continue writing the story from where you left off. Do not repeat previous text.'
                        );
                      }}
                    >
                      ⏩ Continue Generating Manuscript
                    </button>
                    {isContextPendingRestart && (
                      <button
                        type="button"
                        className="qwen-continue-btn restart-action"
                        onClick={() => applyAndRestart(settings.hardware)}
                        title={`Restart llama-server with target context ${targetContext.toLocaleString()} tokens`}
                      >
                        🔄 Restart Server ({targetContext.toLocaleString()} Context)
                      </button>
                    )}
                  </div>
                </div>
              )}

              {m.patchAction && (
                <div className={`qwen-patch-card ${m.patchApplied ? 'applied' : 'pending'}`}>
                  <div className="patch-card-header">
                    <span className="patch-card-status">
                      {m.patchApplied ? '✅ Auto-written to' : '📝 Suggested changes for'}:{' '}
                      <strong>{getFieldNames(m.patchAction)}</strong>
                    </span>
                  </div>
                  <div className="patch-card-actions">
                    {m.patchApplied && m.previousStorySnapshot && (
                      <button
                        type="button"
                        onClick={() => handleUndoPatch(m.id, m.previousStorySnapshot)}
                        className="qwen-patch-undo-btn"
                        title="Revert story fields to state before this response"
                      >
                        ↩️ Undo
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleManualApplyPatch(m.id, m.patchAction!)}
                      className="qwen-patch-apply-btn"
                    >
                      {m.patchApplied ? '✍️ Re-Apply' : '✍️ Write to Fields'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <span
              style={{
                fontSize: '9px',
                color: '#64748b',
                marginTop: '3px',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {/* Live Streaming Delta */}
        {isStreaming && (
          <div className="qwen-message-wrapper assistant">
            <div className="qwen-message-bubble" style={{ opacity: 0.95 }}>
              {streamedThinking ? (
                <div className="qwen-live-thinking-card">
                  <div
                    className="qwen-live-thinking-header"
                    onClick={() => setIsLiveThinkingExpanded(!isLiveThinkingExpanded)}
                  >
                    <span className="live-thinking-badge">
                      <span className="live-thinking-pulse" />
                      💭 Thinking ({estimateTokenCount(streamedThinking)} tokens)
                    </span>
                    <button
                      type="button"
                      className="live-thinking-toggle-btn"
                    >
                      {isLiveThinkingExpanded ? 'Hide' : 'Show Stream'}
                    </button>
                  </div>
                  {isLiveThinkingExpanded && (
                    <div className="qwen-live-thinking-body">
                      {streamedThinking}
                    </div>
                  )}
                </div>
              ) : !streamedAnswer ? (
                <div className="qwen-live-thinking-card" style={{ marginBottom: '8px' }}>
                  <div className="qwen-live-thinking-header">
                    <span className="live-thinking-badge">
                      <span className="live-thinking-pulse" />
                      🧠 {settings.live.reasoningEffort !== 'off' ? 'Qwen is reasoning & planning beats...' : 'Qwen is reading context & drafting...'}
                    </span>
                  </div>
                </div>
              ) : null}
              <StoryMarkdownRenderer
                content={streamedAnswer || (streamedThinking ? '' : 'Generating response...')}
                variant="chat"
              />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Footer / Input Bar */}
      <div className="qwen-copilot-footer">
        {/* Token Progress Bar Track */}
        <div className="qwen-token-bar-track">
          <div
            className={`qwen-token-bar-fill ${contextUsagePercent > 75 ? 'warning' : ''}`}
            style={{ width: `${contextUsagePercent}%` }}
          />
        </div>

        <div className="qwen-copilot-token-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span
              title={`Context Breakdown:\n• Story Context & Instructions: ~${baselinePromptTokens.toLocaleString()} tokens\n• Chat Messages: ~${committedTokens.toLocaleString()} tokens\n• In-Flight Stream: ~${streamedTokens.toLocaleString()} tokens`}
              style={{ cursor: 'help' }}
            >
              Context: ~{totalTokens.toLocaleString()} / {runningContext.toLocaleString()} tokens ({contextUsagePercent}%)
            </span>
            {isContextPendingRestart && (
              <button
                type="button"
                className="qwen-context-restart-pill"
                title={`Active server is running at ${runningContext.toLocaleString()} tokens. Target is ${targetContext.toLocaleString()} tokens. Click to restart server now.`}
                onClick={() => applyAndRestart(settings.hardware)}
              >
                ⚡ Restart to Apply {targetContext.toLocaleString()}
              </button>
            )}
            {isStreaming && (
              <span className="qwen-token-speed-badge">
                <span className="qwen-token-live-dot" />
                <Zap size={10} />
                {generationSpeed > 0 ? `${generationSpeed} t/s` : 'generating...'}
              </span>
            )}
          </div>
          {isStreaming && (
            <button
              type="button"
              onClick={handleStop}
              style={{
                color: '#f87171',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '4px',
                padding: '2px 6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Square size={10} /> Stop
            </button>
          )}
        </div>

        {/* Slash Command Autocomplete Menu */}
        {slashMenuOpen && (
          <div className="qwen-slash-autocomplete-menu" role="listbox" aria-label="Slash commands">
            <div className="qwen-slash-menu-header">
              <span className="qwen-slash-menu-title">⚡ Skills & Slash Commands</span>
              <span className="qwen-slash-menu-hint">
                {filteredSlashCommands.length} found • ↑↓ to navigate • ↵ / Tab to select • Esc
              </span>
            </div>
            <div className="qwen-slash-menu-list">
              {filteredSlashCommands.length > 0 ? (
                filteredSlashCommands.map((item, idx) => {
                  const isSelected = idx === selectedSlashIndex;
                  return (
                    <div
                      key={item.command + idx}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleExecuteSlashCommand(item)}
                      onMouseEnter={() => setSelectedSlashIndex(idx)}
                      className={`qwen-slash-menu-item ${isSelected ? 'selected' : ''}`}
                    >
                      <span className="qwen-slash-item-icon">{item.icon}</span>
                      <div className="qwen-slash-item-content">
                        <div className="qwen-slash-item-top">
                          <span className="qwen-slash-item-cmd">{item.command}</span>
                          <span className={`qwen-slash-category-badge cat-${item.category}`}>
                            {item.categoryLabel}
                          </span>
                          <span className="qwen-slash-item-label">{item.label}</span>
                        </div>
                        <div className="qwen-slash-item-desc">{item.description}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="qwen-slash-empty-state">
                  No matching slash skills found for &quot;{slashQuery}&quot;
                </div>
              )}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="qwen-copilot-input-form"
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask Qwen for story beats, dialogue, or chapter prose (type '/' for skills)..."
            value={input}
            disabled={isStreaming}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            className="qwen-copilot-input"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="qwen-copilot-send-btn"
          >
            <Send size={13} style={{ marginRight: 4, display: 'inline' }} />
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
