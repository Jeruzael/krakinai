import React, { useState, useEffect, useRef } from 'react';
import type {
  QwenSettings,
  QwenHardwareSettings,
  QwenReasoningEffort,
  QwenDictionaryDetailLevel,
  QwenDictionarySpeedPreset,
  QwenDictionarySettings,
  QwenSkillPersona,
  QwenCustomSkillPrompt,
} from '../../types/qwen';
import { DEFAULT_QWEN_SETTINGS, DEFAULT_BASE_SYSTEM_PROMPT } from '../../storage/qwenSettings';
import { estimateTokenCount } from '../../services/qwenStoryContext';
import {
  getDictionaryLibraryStats,
  clearDictionaryLibrary,
  removeWordFromDictionaryLibrary,
  exportDictionaryAsJson,
  exportDictionaryAsMarkdown,
  importDictionaryFromJson,
} from '../../storage/dictionaryLibrary';
import { Download, Upload, FileText, CheckCircle2, AlertCircle, Plus, Trash2, Sparkles, Terminal } from 'lucide-react';
import './qwenCoPilot.css';

const PERSONA_PROMPTS: Record<QwenSkillPersona, { label: string; icon: string; prompt: string }> = {
  screenwriter: {
    label: 'Story Screenwriter (Phase 1)',
    icon: '🎭',
    prompt:
      'Active Persona: Story Screenwriter (Phase 1). You excel at screenplay formatting, natural character dialogue, authentic Filipino/Taglish conversational rhythm when requested, dramatic subtext, and breaking scenes into 5-to-10-second cinematic story beats.',
  },
  editor: {
    label: 'Script Doctor & Editor (Phase 2)',
    icon: '🔍',
    prompt:
      'Active Persona: Script Doctor & Editor (Phase 2). You perform Beat Duration Audits, identifying bloated or dialogue-crammed beats that exceed 10 seconds. You inject dialogue breathing room, reaction pauses, and prepare clean Director Handoff Briefings with lighting, mood, and vocal performance notes.',
  },
  novelist: {
    label: 'Book Novelist (Phase 2B)',
    icon: '📚',
    prompt:
      'Active Persona: Book Novelist (Phase 2B). You translate dramatic story beats into continuous literary manuscript prose. You specialize in vivid sensory details, emotional depth, internal monologue, and evocative atmospheric pacing.',
  },
  director: {
    label: 'Story Director (Phase 3)',
    icon: '🎬',
    prompt:
      'Active Persona: Story Director (Phase 3). You translate narrative scenes into 5-to-10-second Google Flow Omni video shots. You produce 12-layer visual prompts (subject, environment, wardrobe, lighting, lens, mood), cinematic camera compositions, and start/end Keyframe Plans.',
  },
  storyboarder: {
    label: 'Storyboard Crafter',
    icon: '❤️',
    prompt:
      'Active Persona: Emotional Storyboard Crafter. You focus on dramatic dialogue breathing, emotional coverage, silent character reaction pacing, and psychological camera framing.',
  },
};

interface QwenSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: QwenSettings;
  onSaveSettings: (settings: QwenSettings) => void;
  onApplyAndRestart: (hw: QwenHardwareSettings) => Promise<void>;
  isRestarting?: boolean;
}

export const QwenSettingsModal: React.FC<QwenSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onApplyAndRestart,
  isRestarting = false,
}) => {
  const [draft, setDraft] = useState<QwenSettings>({ ...settings });
  const [activeTab, setActiveTab] = useState<'live' | 'dictionary' | 'prompts' | 'hardware'>('live');
  const [dictStats, setDictStats] = useState(() => getDictionaryLibraryStats());
  const [importFeedback, setImportFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedPersonaPreview, setSelectedPersonaPreview] = useState<QwenSkillPersona>('screenwriter');
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [newSkillCommand, setNewSkillCommand] = useState('');
  const [newSkillLabel, setNewSkillLabel] = useState('');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [newSkillPrompt, setNewSkillPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-dismiss import feedback
  useEffect(() => {
    if (!importFeedback) return;
    const timer = setTimeout(() => setImportFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [importFeedback]);

  // Keep draft and dictStats in sync when modal opens or settings change
  useEffect(() => {
    if (isOpen) {
      setDraft({ ...settings });
      setDictStats(getDictionaryLibraryStats());
    }
  }, [isOpen, settings]);

  useEffect(() => {
    if (activeTab === 'dictionary') {
      setDictStats(getDictionaryLibraryStats());
    }
  }, [activeTab]);

  // Live subscription to dictionary library additions/deletions
  useEffect(() => {
    const handleDictUpdated = () => {
      setDictStats(getDictionaryLibraryStats());
    };
    window.addEventListener('krakinai:dictionary-library-updated', handleDictUpdated);
    return () => {
      window.removeEventListener('krakinai:dictionary-library-updated', handleDictUpdated);
    };
  }, []);

  if (!isOpen) return null;

  const handleLiveChange = <K extends keyof QwenSettings['live']>(
    key: K,
    val: QwenSettings['live'][K]
  ) => {
    const updated = {
      ...draft,
      live: {
        ...draft.live,
        [key]: val,
      },
    };
    setDraft(updated);
    onSaveSettings(updated);
  };

  const handleDictChange = <K extends keyof QwenDictionarySettings>(
    key: K,
    val: QwenDictionarySettings[K]
  ) => {
    const updated: QwenSettings = {
      ...draft,
      dictionary: {
        ...(draft.dictionary || DEFAULT_QWEN_SETTINGS.dictionary),
        [key]: val,
      },
    };
    setDraft(updated);
    onSaveSettings(updated);
  };

  const handleHwChange = <K extends keyof QwenHardwareSettings>(
    key: K,
    val: QwenHardwareSettings[K]
  ) => {
    const updated = {
      ...draft,
      hardware: {
        ...draft.hardware,
        [key]: val,
      },
    };
    setDraft(updated);
    onSaveSettings(updated);
  };

  const handleClearDict = () => {
    if (window.confirm('Clear all cached words from your local dictionary library?')) {
      clearDictionaryLibrary();
      setDictStats(getDictionaryLibraryStats());
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = importDictionaryFromJson(text, 'merge');
        setDictStats(getDictionaryLibraryStats());
        setImportFeedback({
          message: `Successfully imported ${result.importedCount} word${result.importedCount === 1 ? '' : 's'} into Dictionary Library!`,
          type: 'success',
        });
      } catch (err) {
        setImportFeedback({
          message: `Import failed: ${(err as Error).message}`,
          type: 'error',
        });
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.onerror = () => {
      setImportFeedback({
        message: 'Failed to read selected file.',
        type: 'error',
      });
      if (e.target) e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleRemoveWord = (word: string) => {
    removeWordFromDictionaryLibrary(word);
    setDictStats(getDictionaryLibraryStats());
  };

  const handleSystemPromptChange = (text: string) => {
    const updated: QwenSettings = {
      ...draft,
      customSystemPrompt: text,
    };
    setDraft(updated);
    onSaveSettings(updated);
  };

  const handleResetSystemPrompt = () => {
    const updated: QwenSettings = {
      ...draft,
      customSystemPrompt: '',
    };
    setDraft(updated);
    onSaveSettings(updated);
  };

  const handleAddCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = newSkillCommand.trim().replace(/^\/+/, '').toLowerCase();
    const label = newSkillLabel.trim();
    const prompt = newSkillPrompt.trim();
    if (!cmd || !prompt) return;

    const newCustomSkill: QwenCustomSkillPrompt = {
      id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      command: cmd,
      label: label || `/${cmd}`,
      description: newSkillDesc.trim() || 'Custom user prompt skill',
      prompt,
      createdAt: Date.now(),
    };

    const updatedSkills = [...(draft.customSkillPrompts || []), newCustomSkill];
    const updated: QwenSettings = {
      ...draft,
      customSkillPrompts: updatedSkills,
    };
    setDraft(updated);
    onSaveSettings(updated);

    setNewSkillCommand('');
    setNewSkillLabel('');
    setNewSkillDesc('');
    setNewSkillPrompt('');
    setIsAddingSkill(false);
  };

  const handleDeleteCustomSkill = (skillId: string) => {
    const updatedSkills = (draft.customSkillPrompts || []).filter((s) => s.id !== skillId);
    const updated: QwenSettings = {
      ...draft,
      customSkillPrompts: updatedSkills,
    };
    setDraft(updated);
    onSaveSettings(updated);
  };

  const handleResetDefaults = () => {
    const reset = {
      ...draft,
      live: { ...DEFAULT_QWEN_SETTINGS.live },
      hardware: { ...DEFAULT_QWEN_SETTINGS.hardware },
      dictionary: { ...DEFAULT_QWEN_SETTINGS.dictionary },
      customSystemPrompt: '',
      customSkillPrompts: [],
    };
    setDraft(reset);
    onSaveSettings(reset);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qwen-settings-title"
      className="qwen-modal-overlay"
    >
      <div className="qwen-modal-card">
        {/* Header */}
        <div className="qwen-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚙️</span>
            <h2 id="qwen-settings-title" style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
              Qwen 3.5 Settings & Parameters
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn"
            style={{ color: '#94a3b8' }}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className="qwen-modal-tabs">
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`qwen-modal-tab-btn ${activeTab === 'live' ? 'active' : ''}`}
          >
            Live Generation
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('prompts')}
            className={`qwen-modal-tab-btn ${activeTab === 'prompts' ? 'active' : ''}`}
          >
            🧠 Prompts & Skills
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dictionary')}
            className={`qwen-modal-tab-btn ${activeTab === 'dictionary' ? 'active' : ''}`}
          >
            📖 Dictionary & Lookup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hardware')}
            className={`qwen-modal-tab-btn ${activeTab === 'hardware' ? 'active' : ''}`}
          >
            Server & Hardware Flags
          </button>
        </div>

        {/* Tab Body */}
        <div className="qwen-modal-body">
          {activeTab === 'dictionary' ? (
            <>
              {/* Detail Level Selector */}
              <div className="qwen-modal-field">
                <label className="qwen-modal-label">Output Detail Level</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'definition_only', label: 'Definition Only', desc: 'Fastest (~30 tok)' },
                    { id: 'definition_examples', label: 'With Examples', desc: 'Balanced (~90 tok)' },
                    { id: 'full_with_context', label: 'Full Story Context', desc: 'Nuanced (~160 tok)' },
                  ].map((lvl) => {
                    const isSelected = (draft.dictionary?.detailLevel || 'full_with_context') === lvl.id;
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => handleDictChange('detailLevel', lvl.id as QwenDictionaryDetailLevel)}
                        style={{
                          padding: '8px',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.12)',
                          background: isSelected ? 'rgba(79, 70, 229, 0.35)' : 'rgba(30, 41, 59, 0.6)',
                          color: isSelected ? '#a5b4fc' : '#94a3b8',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          textAlign: 'center',
                        }}
                      >
                        <span>{lvl.label}</span>
                        <span style={{ fontSize: '9px', opacity: 0.8 }}>{lvl.desc}</span>
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  Choose whether highlight popovers show definition only, examples, or full scene nuance with synonyms.
                </span>
              </div>

              {/* Speed & Creativity Preset */}
              <div className="qwen-modal-field">
                <label className="qwen-modal-label">Response Speed & Model Sampling</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'fast', label: '⚡ Quick Response', desc: 'Temp 0.1 • Fast' },
                    { id: 'balanced', label: '⚖️ Balanced', desc: 'Temp 0.2 • Standard' },
                    { id: 'detailed', label: '🎨 Detailed & Deep', desc: 'Temp 0.35 • Deep' },
                  ].map((preset) => {
                    const isSelected = (draft.dictionary?.speedPreset || 'balanced') === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleDictChange('speedPreset', preset.id as QwenDictionarySpeedPreset)}
                        style={{
                          padding: '8px',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.12)',
                          background: isSelected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(30, 41, 59, 0.6)',
                          color: isSelected ? '#6ee7b7' : '#94a3b8',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          textAlign: 'center',
                        }}
                      >
                        <span>{preset.label}</span>
                        <span style={{ fontSize: '9px', opacity: 0.8 }}>{preset.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Synonyms & Cache Toggles */}
              <div className="qwen-modal-field" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={draft.dictionary?.showSynonyms ?? true}
                    onChange={(e) => handleDictChange('showSynonyms', e.target.checked)}
                    style={{ accentColor: '#6366f1' }}
                  />
                  <span>Show Synonyms Row in definition card</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={draft.dictionary?.cacheEnabled ?? true}
                    onChange={(e) => handleDictChange('cacheEnabled', e.target.checked)}
                    style={{ accentColor: '#6366f1' }}
                  />
                  <span>Cache-First Lookups (Instantly retrieve saved words at 0 new tokens)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={draft.dictionary?.autoSaveToLibrary ?? true}
                    onChange={(e) => handleDictChange('autoSaveToLibrary', e.target.checked)}
                    style={{ accentColor: '#6366f1' }}
                  />
                  <span>Automatically save newly generated words to Dictionary Library</span>
                </label>
              </div>

              {/* Dictionary Library Manager */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginTop: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
                      📚 Local Dictionary Library
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {dictStats.totalEntries} words cached • {dictStats.totalHits} instant lookups served
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".json"
                      onChange={handleImportFile}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="qwen-dict-action-btn"
                      title="Import words from an exported JSON file"
                    >
                      <Upload size={12} />
                      <span>Import JSON</span>
                    </button>
                    <button
                      type="button"
                      disabled={dictStats.totalEntries === 0}
                      onClick={exportDictionaryAsJson}
                      className="qwen-dict-action-btn"
                      title="Export all dictionary words as a JSON file"
                    >
                      <Download size={12} />
                      <span>Export JSON</span>
                    </button>
                    <button
                      type="button"
                      disabled={dictStats.totalEntries === 0}
                      onClick={exportDictionaryAsMarkdown}
                      className="qwen-dict-action-btn"
                      title="Export all dictionary words as a formatted Markdown glossary"
                    >
                      <FileText size={12} />
                      <span>Export Markdown</span>
                    </button>
                    {dictStats.totalEntries > 0 && (
                      <button
                        type="button"
                        onClick={handleClearDict}
                        className="qwen-dict-clear-btn"
                        title="Clear all cached words from your local library"
                      >
                        Clear Cache
                      </button>
                    )}
                  </div>
                </div>

                {importFeedback && (
                  <div className={`qwen-import-feedback-banner ${importFeedback.type}`}>
                    {importFeedback.type === 'success' ? (
                      <CheckCircle2 size={13} className="text-emerald" />
                    ) : (
                      <AlertCircle size={13} className="text-rose" />
                    )}
                    <span>{importFeedback.message}</span>
                  </div>
                )}

                {/* Cached Words Chips List */}
                {dictStats.entries && dictStats.entries.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      maxHeight: '120px',
                      overflowY: 'auto',
                      padding: '4px 0',
                    }}
                  >
                    {dictStats.entries.map((entry) => (
                      <span
                        key={entry.id}
                        style={{
                          background: 'rgba(30, 41, 59, 0.8)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          color: '#e2e8f0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <strong style={{ color: '#38bdf8' }}>{entry.word}</strong>
                        {entry.partOfSpeech && (
                          <span style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic' }}>
                            ({entry.partOfSpeech})
                          </span>
                        )}
                        {entry.hitCount > 1 && (
                          <span style={{ fontSize: '9px', color: '#34d399' }} title={`${entry.hitCount} lookups`}>
                            {entry.hitCount}x
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveWord(entry.word)}
                          title={`Remove "${entry.word}" from cache`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '0 2px',
                            fontSize: '11px',
                            lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                    No words cached yet. Highlight words in the reader or chat to auto-cache definitions.
                  </div>
                )}
              </div>
            </>
          ) : activeTab === 'live' ? (
            <>
              {/* Reasoning Effort */}
              <div className="qwen-modal-field">
                <label className="qwen-modal-label">
                  Reasoning Effort (&lt;think&gt; mode)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {(['off', 'low', 'medium', 'high'] as QwenReasoningEffort[]).map((effort) => (
                    <button
                      key={effort}
                      type="button"
                      onClick={() => handleLiveChange('reasoningEffort', effort)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '8px',
                        border: draft.live.reasoningEffort === effort ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.12)',
                        background: draft.live.reasoningEffort === effort ? 'rgba(79, 70, 229, 0.35)' : 'rgba(30, 41, 59, 0.6)',
                        color: draft.live.reasoningEffort === effort ? '#a5b4fc' : '#94a3b8',
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      {effort}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  When 'off', Qwen skips the &lt;think&gt; block and writes story text directly.
                </span>
              </div>

              {/* Temperature */}
              <div className="qwen-modal-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0', fontWeight: 500 }}>
                  <span>Temperature (Creativity)</span>
                  <span style={{ fontFamily: 'monospace', color: '#818cf8' }}>{draft.live.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.05"
                  value={draft.live.temperature}
                  onChange={(e) => handleLiveChange('temperature', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#6366f1' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                  <span>0.1 (Deterministic)</span>
                  <span>0.7 (Recommended)</span>
                  <span>1.5 (High Variety)</span>
                </div>
              </div>

              {/* Top-P */}
              <div className="qwen-modal-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0', fontWeight: 500 }}>
                  <span>Top-P (Nucleus Sampling)</span>
                  <span style={{ fontFamily: 'monospace', color: '#818cf8' }}>{draft.live.topP}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={draft.live.topP}
                  onChange={(e) => handleLiveChange('topP', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#6366f1' }}
                />
              </div>

              {/* Max Tokens */}
              <div className="qwen-modal-field">
                <label className="qwen-modal-label">Max Output Tokens</label>
                <input
                  type="number"
                  min={256}
                  max={4096}
                  step={128}
                  value={draft.live.maxTokens}
                  onChange={(e) => handleLiveChange('maxTokens', parseInt(e.target.value, 10) || 1536)}
                  className="qwen-modal-input"
                />
              </div>
            </>
          ) : activeTab === 'prompts' ? (
            <>
              {/* Base System Prompt Editor */}
              <div className="qwen-modal-field">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="qwen-modal-label" style={{ marginBottom: 0 }}>
                    🧠 Base System Instructions
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                      ~{estimateTokenCount(draft.customSystemPrompt || DEFAULT_BASE_SYSTEM_PROMPT)} tok ({draft.customSystemPrompt ? draft.customSystemPrompt.length : DEFAULT_BASE_SYSTEM_PROMPT.length} chars)
                    </span>
                    {draft.customSystemPrompt && draft.customSystemPrompt.trim() !== '' && (
                      <button
                        type="button"
                        onClick={handleResetSystemPrompt}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '6px',
                          color: '#fca5a5',
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          cursor: 'pointer',
                        }}
                      >
                        Reset to Default
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  rows={6}
                  value={draft.customSystemPrompt ?? ''}
                  onChange={(e) => handleSystemPromptChange(e.target.value)}
                  placeholder={DEFAULT_BASE_SYSTEM_PROMPT}
                  className="qwen-modal-input"
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    lineHeight: '1.4',
                    resize: 'vertical',
                    padding: '8px 10px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    borderColor: draft.customSystemPrompt ? '#6366f1' : 'rgba(255, 255, 255, 0.12)',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  {draft.customSystemPrompt
                    ? 'Custom instructions active. Leave empty to use the default KRAKINAI prompt.'
                    : 'Using default KRAKINAI Story & Screenwriting Co-Pilot system prompt. Edit above to customize.'}
                </span>
              </div>

              {/* Persona Instructions Preview */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
                    🎭 Persona System Rules & Techniques
                  </div>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>Preview injected prompt rules</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {(['screenwriter', 'editor', 'novelist', 'director', 'storyboarder'] as QwenSkillPersona[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedPersonaPreview(p)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: selectedPersonaPreview === p ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: selectedPersonaPreview === p ? 'rgba(79, 70, 229, 0.3)' : 'rgba(30, 41, 59, 0.5)',
                        color: selectedPersonaPreview === p ? '#a5b4fc' : '#94a3b8',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {PERSONA_PROMPTS[p].icon} {PERSONA_PROMPTS[p].label.split(' ')[1] || PERSONA_PROMPTS[p].label}
                    </button>
                  ))}
                </div>
                <div
                  style={{
                    background: 'rgba(2, 6, 23, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '11px',
                    color: '#cbd5e1',
                    lineHeight: '1.4',
                    fontFamily: 'monospace',
                  }}
                >
                  {PERSONA_PROMPTS[selectedPersonaPreview].prompt}
                </div>
              </div>

              {/* Custom Slash Skills Manager */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginTop: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={14} color="#818cf8" />
                      Custom Slash Skills (/)
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Define custom skill prompts that you can trigger by typing <code>/</code> in the chat input.
                    </div>
                  </div>
                  {!isAddingSkill && (
                    <button
                      type="button"
                      onClick={() => setIsAddingSkill(true)}
                      className="qwen-dict-action-btn"
                      style={{ background: '#4f46e5', color: '#ffffff', borderColor: '#6366f1' }}
                    >
                      <Plus size={12} />
                      <span>New Skill</span>
                    </button>
                  )}
                </div>

                {isAddingSkill && (
                  <form
                    onSubmit={handleAddCustomSkill}
                    style={{
                      background: 'rgba(30, 41, 59, 0.6)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>
                          Command (e.g. critique or dark-gothic)
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '0 6px' }}>
                          <span style={{ color: '#818cf8', fontWeight: 600, fontSize: '12px' }}>/</span>
                          <input
                            type="text"
                            value={newSkillCommand}
                            onChange={(e) => setNewSkillCommand(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                            placeholder="command-name"
                            required
                            style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '12px', outline: 'none', padding: '6px 4px', width: '100%' }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>
                          Display Label
                        </label>
                        <input
                          type="text"
                          value={newSkillLabel}
                          onChange={(e) => setNewSkillLabel(e.target.value)}
                          placeholder="e.g. Dark Gothic Atmosphere"
                          required
                          className="qwen-modal-input"
                          style={{ padding: '6px 8px' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>
                        Description (short summary)
                      </label>
                      <input
                        type="text"
                        value={newSkillDesc}
                        onChange={(e) => setNewSkillDesc(e.target.value)}
                        placeholder="e.g. Infuses gothic atmosphere, fog, and crumbling stone"
                        className="qwen-modal-input"
                        style={{ padding: '6px 8px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>
                        Prompt Template
                      </label>
                      <textarea
                        rows={2}
                        value={newSkillPrompt}
                        onChange={(e) => setNewSkillPrompt(e.target.value)}
                        placeholder="e.g. Deepen the dark gothic mood with decaying architecture and spectral fog:"
                        required
                        className="qwen-modal-input"
                        style={{ padding: '6px 8px', resize: 'vertical' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingSkill(false);
                          setNewSkillCommand('');
                          setNewSkillLabel('');
                          setNewSkillDesc('');
                          setNewSkillPrompt('');
                        }}
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '11px', padding: '4px 10px', background: '#4f46e5' }}
                      >
                        Save Skill
                      </button>
                    </div>
                  </form>
                )}

                {/* List of custom skills */}
                {draft.customSkillPrompts && draft.customSkillPrompts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {draft.customSkillPrompts.map((skill) => (
                      <div
                        key={skill.id}
                        style={{
                          background: 'rgba(30, 41, 59, 0.7)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#38bdf8', fontSize: '12px' }}>
                              /{skill.command.replace(/^\/+/, '')}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 500, color: '#f1f5f9' }}>
                              {skill.label}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {skill.description}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomSkill(skill.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#f87171',
                            cursor: 'pointer',
                            padding: '4px',
                            opacity: 0.8,
                            flexShrink: 0,
                          }}
                          title="Delete skill"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                    No custom slash skills added yet. Click &quot;New Skill&quot; above to create one.
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: '10px 14px', background: 'rgba(120, 53, 15, 0.25)', border: '1px solid rgba(217, 119, 6, 0.4)', borderRadius: '10px', color: '#fde68a', fontSize: '12px' }}>
                ⚠️ Changes to Server & Hardware flags require restarting the local <code>llama-server.exe</code> process.
              </div>

              {/* Context Size */}
              <div className="qwen-modal-field">
                <label className="qwen-modal-label">Context Window (-c)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {([4096, 8192, 16384] as const).map((ctx) => (
                    <button
                      key={ctx}
                      type="button"
                      onClick={() => handleHwChange('contextSize', ctx)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '8px',
                        border: draft.hardware.contextSize === ctx ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.12)',
                        background: draft.hardware.contextSize === ctx ? 'rgba(79, 70, 229, 0.35)' : 'rgba(30, 41, 59, 0.6)',
                        color: draft.hardware.contextSize === ctx ? '#a5b4fc' : '#94a3b8',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {ctx} tokens
                    </button>
                  ))}
                </div>
              </div>

              {/* Fit Target */}
              <div className="qwen-modal-field">
                <label className="qwen-modal-label">GPU Safety VRAM Margin (--fit-target MB)</label>
                <input
                  type="number"
                  min={512}
                  max={4096}
                  step={256}
                  value={draft.hardware.fitTargetMb}
                  onChange={(e) => handleHwChange('fitTargetMb', parseInt(e.target.value, 10) || 1536)}
                  className="qwen-modal-input"
                />
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Recommended: 1536 MB to reserve headroom on your RTX 4060 8 GB.
                </span>
              </div>

              {/* CPU Threads */}
              <div className="qwen-modal-field">
                <label className="qwen-modal-label">CPU Threads (-t, optional)</label>
                <input
                  type="number"
                  placeholder="Auto (Recommended)"
                  value={draft.hardware.cpuThreads ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    handleHwChange('cpuThreads', v ? parseInt(v, 10) : null);
                  }}
                  className="qwen-modal-input"
                />
              </div>

              {/* Paths */}
              <div className="qwen-modal-field">
                <label className="qwen-modal-label">llama-server.exe Path</label>
                <input
                  type="text"
                  value={draft.hardware.executablePath}
                  onChange={(e) => handleHwChange('executablePath', e.target.value)}
                  className="qwen-modal-input"
                />
              </div>

              <div className="qwen-modal-field">
                <label className="qwen-modal-label">Qwen Model .gguf Path</label>
                <input
                  type="text"
                  value={draft.hardware.modelPath}
                  onChange={(e) => handleHwChange('modelPath', e.target.value)}
                  className="qwen-modal-input"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px' }}
                >
                  Reset Defaults
                </button>
                <button
                  type="button"
                  disabled={isRestarting}
                  onClick={() => onApplyAndRestart(draft.hardware)}
                  style={{
                    background: '#4f46e5',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: isRestarting ? 0.6 : 1,
                  }}
                >
                  {isRestarting ? 'Restarting Server...' : '🔄 Apply & Restart Qwen'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="qwen-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline btn-sm"
            style={{ color: '#cbd5e1', borderColor: 'rgba(255, 255, 255, 0.2)' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
