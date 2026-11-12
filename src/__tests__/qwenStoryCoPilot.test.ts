import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_QWEN_SETTINGS,
  DEFAULT_BASE_SYSTEM_PROMPT,
  loadQwenSettings,
  saveQwenSettings,
  buildLlamaServerArgs,
  validateHardwareSettings,
  QWEN_SETTINGS_STORAGE_KEY,
} from '../storage/qwenSettings';
import {
  resolveSlashCommands,
  filterSlashCommands,
  generateSlashHelpMarkdown,
} from '../components/stories/slashCommands';
import type { QwenHardwareSettings, QwenSettings, DictionaryLibraryEntry } from '../types/qwen';
import {
  splitThinkContent,
  getQwenProcessMetrics,
  lookupWordDefinition,
  streamChatCompletion,
  normalizeChatMessages,
} from '../services/qwenClient';
import {
  saveToDictionaryLibrary,
  loadDictionaryLibrary,
  clearDictionaryLibrary,
  generateDictionaryJson,
  generateDictionaryMarkdown,
  importDictionaryFromJson,
  DICTIONARY_LIBRARY_STORAGE_KEY,
} from '../storage/dictionaryLibrary';
import {
  buildStoryCoPilotMessages,
  applyQwenStoryPatch,
  extractStoryPatchFromResponse,
  stripQwenPatchBlock,
  estimateTokenCount,
  calculateLiveTokens,
  calculateGenerationSpeed,
} from '../services/qwenStoryContext';
import type { Story } from '../types/domain';
import { validateStoryInput } from '../domain/storyValidator';

const mockStory: Story = {
  id: 'story-test-1',
  title: 'Rise of the Fable',
  author: 'Author Name',
  tags: ['fantasy', 'magic'],
  coverMediaId: null,
  heroBannerMediaId: null,
  logline: 'A young mage discovers an ancient secret.',
  premise: 'Magic is fading from the realm.',
  synopsis: 'Full synopsis...',
  treatment: 'Detailed treatment...',
  fullBookText: 'Chapter 1: The Gathering Dust.',
  referencePack: { assetIds: [], variantIds: [], mediaIds: [] },
  linkedCollectionId: null,
  colorScript: [],
  favorite: false,
  revisionNumber: 1,
  acts: [
    {
      id: 'act-1',
      title: 'Act I: Discovery',
      orderIndex: 0,
      sequences: [
        {
          id: 'seq-1',
          title: 'Sequence 1: The Spark',
          orderIndex: 0,
          scenes: [
            {
              id: 'scene-1',
              title: 'Scene 1: The Hidden Vault',
              orderIndex: 0,
              beats: [
                {
                  id: 'beat-1',
                  title: 'Beat 1: Footsteps in the dark',
                  orderIndex: 0,
                  content: 'Quiet approach',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  directorBriefing: undefined,
  createdAt: '2026-11-11T00:00:00.000Z',
  updatedAt: '2026-11-11T00:00:00.000Z',
};

describe('Qwen Settings Storage & CLI Builder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides expected defaults matching the local setup and tuning guide', () => {
    expect(DEFAULT_QWEN_SETTINGS.hardware.executablePath).toBe(
      'C:\\Users\\HomePC\\AI\\llama.cpp\\b12223\\llama-server.exe'
    );
    expect(DEFAULT_QWEN_SETTINGS.hardware.modelPath).toBe(
      'C:\\Users\\HomePC\\AI\\models\\Qwen3.5-9B-Defiant-Q4_K_S\\Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-Q4_K_S.gguf'
    );
    expect(DEFAULT_QWEN_SETTINGS.hardware.host).toBe('127.0.0.1');
    expect(DEFAULT_QWEN_SETTINGS.hardware.port).toBe(8080);
    expect(DEFAULT_QWEN_SETTINGS.hardware.contextSize).toBe(8192);
    expect(DEFAULT_QWEN_SETTINGS.hardware.fitTargetMb).toBe(1536);
    expect(DEFAULT_QWEN_SETTINGS.hardware.batchSize).toBe(256);
    expect(DEFAULT_QWEN_SETTINGS.hardware.ubatchSize).toBe(128);
    expect(DEFAULT_QWEN_SETTINGS.hardware.cpuThreads).toBeNull();
    expect(DEFAULT_QWEN_SETTINGS.live.reasoningEffort).toBe('medium');
    expect(DEFAULT_QWEN_SETTINGS.live.temperature).toBe(0.7);
    expect(DEFAULT_QWEN_SETTINGS.live.topP).toBe(0.9);
    expect(DEFAULT_QWEN_SETTINGS.live.maxTokens).toBe(4096);
    expect(DEFAULT_QWEN_SETTINGS.isDockedInBed).toBe(true);
  });

  it('auto-migrates legacy 4096 contextSize to 8192 and legacy 1536 maxTokens to 4096', () => {
    localStorage.setItem(
      QWEN_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        hardware: { ...DEFAULT_QWEN_SETTINGS.hardware, contextSize: 4096 },
        live: { ...DEFAULT_QWEN_SETTINGS.live, maxTokens: 1536, reasoningEffort: 'off' },
      })
    );
    const migrated = loadQwenSettings();
    expect(migrated.hardware.contextSize).toBe(8192);
    expect(migrated.live.maxTokens).toBe(4096);
    expect(migrated.live.reasoningEffort).toBe('medium');
  });

  it('loads defaults when localStorage is empty', () => {
    const loaded = loadQwenSettings();
    expect(loaded).toEqual(DEFAULT_QWEN_SETTINGS);
  });

  it('persists and restores updated settings from localStorage', () => {
    const updated: QwenSettings = {
      ...DEFAULT_QWEN_SETTINGS,
      live: {
        ...DEFAULT_QWEN_SETTINGS.live,
        reasoningEffort: 'medium',
        temperature: 0.85,
      },
      hardware: {
        ...DEFAULT_QWEN_SETTINGS.hardware,
        contextSize: 16384,
        fitTargetMb: 2048,
        cpuThreads: 4,
      },
      isDockedInBed: false,
    };

    saveQwenSettings(updated);

    const raw = localStorage.getItem(QWEN_SETTINGS_STORAGE_KEY);
    expect(raw).toBeTruthy();

    const loaded = loadQwenSettings();
    expect(loaded.live.reasoningEffort).toBe('medium');
    expect(loaded.live.temperature).toBe(0.85);
    expect(loaded.hardware.contextSize).toBe(16384);
    expect(loaded.hardware.fitTargetMb).toBe(2048);
    expect(loaded.hardware.cpuThreads).toBe(4);
    expect(loaded.isDockedInBed).toBe(false);
  });

  it('builds exact command-line arguments for llama-server.exe', () => {
    const hw = DEFAULT_QWEN_SETTINGS.hardware;
    const args = buildLlamaServerArgs(hw);

    expect(args).toEqual([
      '-m',
      hw.modelPath,
      '--host',
      '127.0.0.1',
      '--port',
      '8080',
      '-ngl',
      'auto',
      '-c',
      '8192',
      '-b',
      '256',
      '-ub',
      '128',
      '-np',
      '1',
      '--fit',
      'on',
      '--fit-target',
      '1536',
      '--cors-origins',
      'localhost',
      '--no-cors-credentials',
    ]);
  });

  it('includes -t flag when cpuThreads is configured', () => {
    const hw: QwenHardwareSettings = {
      ...DEFAULT_QWEN_SETTINGS.hardware,
      cpuThreads: 6,
    };
    const args = buildLlamaServerArgs(hw);
    expect(args).toContain('-t');
    expect(args[args.indexOf('-t') + 1]).toBe('6');
  });

  it('validates hardware settings paths and port', () => {
    expect(() =>
      validateHardwareSettings({
        ...DEFAULT_QWEN_SETTINGS.hardware,
        executablePath: 'C:\\Windows\\notepad.exe',
      })
    ).toThrow(/llama-server\.exe/i);

    expect(() =>
      validateHardwareSettings({
        ...DEFAULT_QWEN_SETTINGS.hardware,
        modelPath: 'C:\\Users\\HomePC\\model.txt',
      })
    ).toThrow(/\.gguf/i);

    expect(() =>
      validateHardwareSettings({
        ...DEFAULT_QWEN_SETTINGS.hardware,
        port: 99999,
      })
    ).toThrow(/port/i);
  });
});

describe('Qwen Client <think> Splitter', () => {
  it('extracts thinking in-progress without closing tag', () => {
    const raw = '<think>Analyzing the narrative structure...';
    const result = splitThinkContent(raw);
    expect(result.isThinking).toBe(true);
    expect(result.thinking).toBe('Analyzing the narrative structure...');
    expect(result.answer).toBe('');
  });

  it('separates completed thinking from answer text', () => {
    const raw =
      '<think>Pacing should be slow and tense.\nNeed an ominous reveal.</think>\n\nThe door creaked open, exhaling century-old cold.';
    const result = splitThinkContent(raw);
    expect(result.isThinking).toBe(false);
    expect(result.thinking).toBe('Pacing should be slow and tense.\nNeed an ominous reveal.');
    expect(result.answer).toBe('The door creaked open, exhaling century-old cold.');
  });

  it('detects in-flight streaming thinking before closing tag arrives', () => {
    const raw = '<think>Analyzing scene tension and pacing...';
    const result = splitThinkContent(raw);
    expect(result.isThinking).toBe(true);
    expect(result.thinking).toBe('Analyzing scene tension and pacing...');
    expect(result.answer).toBe('');
  });

  it('supports alternative thought and reasoning tag formats', () => {
    const thoughtRaw = '<thought>Check Taglish cadence</thought>Kamusta ka, Elena?';
    const thoughtRes = splitThinkContent(thoughtRaw);
    expect(thoughtRes.thinking).toBe('Check Taglish cadence');
    expect(thoughtRes.answer).toBe('Kamusta ka, Elena?');

    const reasoningRaw = '<reasoning>Camera push-in on locked box</reasoning>CU on brass lock.';
    const reasoningRes = splitThinkContent(reasoningRaw);
    expect(reasoningRes.thinking).toBe('Camera push-in on locked box');
    expect(reasoningRes.answer).toBe('CU on brass lock.');
  });

  it('handles response without any think tags', () => {
    const raw = 'Just a straightforward creative paragraph.';
    const result = splitThinkContent(raw);
    expect(result.isThinking).toBe(false);
    expect(result.thinking).toBe('');
    expect(result.answer).toBe('Just a straightforward creative paragraph.');
  });
});

describe('Qwen Story Context & Prompt Builder', () => {
  it('builds pitch mode system prompt and keeps tokens bounded', () => {
    const messages = buildStoryCoPilotMessages({
      story: mockStory,
      mode: 'pitch',
      chatHistory: [{ role: 'user', content: 'Improve my logline.' }],
      liveSettings: DEFAULT_QWEN_SETTINGS.live,
    });

    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('Rise of the Fable');
    expect(messages[0].content).toContain('A young mage discovers an ancient secret.');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toBe('Improve my logline.');

    const totalEstimate = messages.reduce((acc, m) => acc + estimateTokenCount(m.content), 0);
    expect(totalEstimate).toBeLessThan(4000);
  });

  it('builds creator mode system prompt including selected scene node', () => {
    const messages = buildStoryCoPilotMessages({
      story: mockStory,
      mode: 'creator',
      selection: {
        actId: 'act-1',
        sequenceId: 'seq-1',
        sceneId: 'scene-1',
      },
      chatHistory: [{ role: 'user', content: 'Suggest 2 more beats.' }],
      liveSettings: DEFAULT_QWEN_SETTINGS.live,
    });

    expect(messages[0].content).toContain('Scene 1: The Hidden Vault');
    expect(messages[0].content).toContain('Creator Mode');
  });

  it('builds book mode system prompt with manuscript focus', () => {
    const messages = buildStoryCoPilotMessages({
      story: mockStory,
      mode: 'book',
      chatHistory: [{ role: 'user', content: 'Write the next paragraph.' }],
      liveSettings: DEFAULT_QWEN_SETTINGS.live,
    });

    expect(messages[0].content).toContain('Book Mode');
    expect(messages[0].content).toContain('Chapter 1: The Gathering Dust.');
  });
});

describe('Qwen Story Patch Helper', () => {
  it('applies pitch updates cleanly and passes story validation', () => {
    const patched = applyQwenStoryPatch(mockStory, {
      type: 'update_pitch',
      fields: {
        logline: 'An updated captivating logline.',
        synopsis: 'An expanded deep synopsis.',
      },
    });

    expect(patched.logline).toBe('An updated captivating logline.');
    expect(patched.synopsis).toBe('An expanded deep synopsis.');
    expect(patched.title).toBe(mockStory.title);
    expect(() => validateStoryInput(patched)).not.toThrow();
  });

  it('appends acts with valid sequential orderIndex', () => {
    const newAct = {
      id: 'act-2',
      title: 'Act II: The Journey',
      orderIndex: 0, // should be re-indexed or appended
      sequences: [],
    };

    const patched = applyQwenStoryPatch(mockStory, {
      type: 'append_acts',
      acts: [newAct],
    });

    expect(patched.acts.length).toBe(2);
    expect(patched.acts[1].title).toBe('Act II: The Journey');
    expect(patched.acts[1].orderIndex).toBe(1);
    expect(() => validateStoryInput(patched)).not.toThrow();
  });

  it('appends sequences into target act', () => {
    const newSeq = {
      id: 'seq-2',
      title: 'Sequence 2: Crossing the Threshold',
      orderIndex: 0,
      scenes: [],
    };

    const patched = applyQwenStoryPatch(mockStory, {
      type: 'append_sequences',
      actId: 'act-1',
      sequences: [newSeq],
    });

    expect(patched.acts[0].sequences.length).toBe(2);
    expect(patched.acts[0].sequences[1].title).toBe('Sequence 2: Crossing the Threshold');
    expect(patched.acts[0].sequences[1].orderIndex).toBe(1);
    expect(() => validateStoryInput(patched)).not.toThrow();
  });

  it('appends scenes into target sequence', () => {
    const newScene = {
      id: 'scene-2',
      title: 'Scene 2: Ambush at the Bridge',
      orderIndex: 0,
      beats: [],
    };

    const patched = applyQwenStoryPatch(mockStory, {
      type: 'append_scenes',
      actId: 'act-1',
      sequenceId: 'seq-1',
      scenes: [newScene],
    });

    expect(patched.acts[0].sequences[0].scenes.length).toBe(2);
    expect(patched.acts[0].sequences[0].scenes[1].title).toBe('Scene 2: Ambush at the Bridge');
    expect(patched.acts[0].sequences[0].scenes[1].orderIndex).toBe(1);
    expect(() => validateStoryInput(patched)).not.toThrow();
  });

  it('appends beats into target scene', () => {
    const newBeat = {
      id: 'beat-2',
      title: 'Beat 2: Shadows emerge from the pillars',
      orderIndex: 0,
      content: 'Tension peaks',
    };

    const patched = applyQwenStoryPatch(mockStory, {
      type: 'append_beats',
      actId: 'act-1',
      sequenceId: 'seq-1',
      sceneId: 'scene-1',
      beats: [newBeat],
    });

    expect(patched.acts[0].sequences[0].scenes[0].beats.length).toBe(2);
    expect(patched.acts[0].sequences[0].scenes[0].beats[1].title).toBe(
      'Beat 2: Shadows emerge from the pillars'
    );
    expect(patched.acts[0].sequences[0].scenes[0].beats[1].orderIndex).toBe(1);
    expect(() => validateStoryInput(patched)).not.toThrow();
  });

  it('updates dramatic meta on selected node', () => {
    const patched = applyQwenStoryPatch(mockStory, {
      type: 'update_dramatic_meta',
      target: { actId: 'act-1', sequenceId: 'seq-1', sceneId: 'scene-1' },
      dramaticMeta: {
        subtext: 'He knows he is being watched, but pretends not to notice.',
        climax: 'A shadowy dart grazes his shoulder.',
      },
    });

    const scene = patched.acts[0].sequences[0].scenes[0];
    expect(scene.dramaticMeta?.subtext).toBe(
      'He knows he is being watched, but pretends not to notice.'
    );
    expect(scene.dramaticMeta?.climax).toBe('A shadowy dart grazes his shoulder.');
    expect(() => validateStoryInput(patched)).not.toThrow();
  });

  it('calculates live tokens dynamically including in-flight streamed thinking and answer', () => {
    const committedMessages = [
      { content: 'Hello Qwen', thinkingContent: '' },
      { content: 'Hi there, how can I help?', thinkingContent: 'Polite greeting' },
    ];

    // When idle (no active stream)
    const idleResult = calculateLiveTokens({
      committedMessages,
    });
    expect(idleResult.committedTokens).toBeGreaterThan(0);
    expect(idleResult.streamedTokens).toBe(0);
    expect(idleResult.totalTokens).toBe(idleResult.committedTokens);

    // During active generation with in-flight streamed thinking and answer
    const activeResult = calculateLiveTokens({
      committedMessages,
      streamedThinking: 'Analyzing the narrative tension of the scene...',
      streamedAnswer: 'Here is a dramatic beat where the character uncovers the key.',
    });
    expect(activeResult.streamedTokens).toBeGreaterThan(0);
    expect(activeResult.totalTokens).toBe(
      activeResult.committedTokens + activeResult.streamedTokens
    );

    // Speed calculation
    const speed = calculateGenerationSpeed(activeResult.streamedTokens, 2.0);
    expect(speed).toBeGreaterThan(0);
  });

  it('injects specialized skill instructions based on the selected persona', () => {
    // 1. Screenwriter persona
    const screenwriterMsgs = buildStoryCoPilotMessages({
      story: mockStory,
      mode: 'creator',
      persona: 'screenwriter',
      chatHistory: [],
      liveSettings: DEFAULT_QWEN_SETTINGS.live,
    });
    expect(screenwriterMsgs[0].content).toContain('Story Screenwriter');
    expect(screenwriterMsgs[0].content).toContain('5-to-10-second');

    // 2. Director persona
    const directorMsgs = buildStoryCoPilotMessages({
      story: mockStory,
      mode: 'creator',
      persona: 'director',
      chatHistory: [],
      liveSettings: DEFAULT_QWEN_SETTINGS.live,
    });
    expect(directorMsgs[0].content).toContain('Story Director');
    expect(directorMsgs[0].content).toContain('12-layer');

    // 3. Editor persona
    const editorMsgs = buildStoryCoPilotMessages({
      story: mockStory,
      mode: 'creator',
      persona: 'editor',
      chatHistory: [],
      liveSettings: DEFAULT_QWEN_SETTINGS.live,
    });
    expect(editorMsgs[0].content).toContain('Script Doctor & Editor');
    expect(editorMsgs[0].content).toContain('Beat Duration Audit');

    // 4. Novelist persona
    const novelistMsgs = buildStoryCoPilotMessages({
      story: mockStory,
      mode: 'book',
      persona: 'novelist',
      chatHistory: [],
      liveSettings: DEFAULT_QWEN_SETTINGS.live,
    });
    expect(novelistMsgs[0].content).toContain('Book Novelist');
    expect(novelistMsgs[0].content).toContain('literary manuscript');

    // 5. Storyboarder persona
    const storyboarderMsgs = buildStoryCoPilotMessages({
      story: mockStory,
      mode: 'creator',
      persona: 'storyboarder',
      chatHistory: [],
      liveSettings: DEFAULT_QWEN_SETTINGS.live,
    });
    expect(storyboarderMsgs[0].content).toContain('Emotional Storyboard Crafter');
    expect(storyboarderMsgs[0].content).toContain('dialogue breathing');
  });

  describe('Active Screen Context & Direct Field Auto-Writer', () => {
    it('injects active screen and live open form draft fields into system prompt', () => {
      const messages = buildStoryCoPilotMessages({
        story: mockStory,
        mode: 'pitch',
        activeScreen: {
          screenKind: 'story_workspace',
          routePath: '/stories/story-test-1',
          screenLabel: 'Story Workspace: "Rise of the Fable"',
          activeTab: 'book',
          formDrafts: {
            isEditModalOpen: true,
            isEditingManuscript: false,
            title: 'Drafting New Title Live',
            logline: 'Unsaved logline draft in modal',
          },
        },
        chatHistory: [{ role: 'user', content: 'What screen am I on?' }],
        liveSettings: DEFAULT_QWEN_SETTINGS.live,
      });

      const sys = messages[0].content;
      expect(sys).toContain('Active Krakinai Screen: Story Workspace: "Rise of the Fable"');
      expect(sys).toContain('Story Details Edit Modal is currently OPEN');
      expect(sys).toContain('Field "title": "Drafting New Title Live"');
      expect(sys).toContain('Field "logline": "Unsaved logline draft in modal"');
      expect(sys).toContain('<qwen-patch>');
    });

    it('extracts structured <qwen-patch> JSON blocks from assistant answers', () => {
      const assistantRaw = `Here is the revised title and logline you asked for!

<qwen-patch>
{
  "type": "update_story_fields",
  "fields": {
    "title": "Whispers of the Fable",
    "logline": "A cursed scholar uncovers the truth behind the silent stars.",
    "premise": "Knowledge is forbidden when stars fall."
  }
}
</qwen-patch>

I made the title punchier and focused the logline on personal stakes.`;

      const patch = extractStoryPatchFromResponse('Change my title and logline', assistantRaw, 'pitch');
      expect(patch).not.toBeNull();
      expect(patch?.type).toBe('update_story_fields');
      if (patch && patch.type === 'update_story_fields') {
        expect(patch.fields.title).toBe('Whispers of the Fable');
        expect(patch.fields.logline).toBe('A cursed scholar uncovers the truth behind the silent stars.');
        expect(patch.fields.premise).toBe('Knowledge is forbidden when stars fall.');
      }

      const stripped = stripQwenPatchBlock(assistantRaw);
      expect(stripped).not.toContain('<qwen-patch>');
      expect(stripped).toContain('Here is the revised title and logline you asked for!');
      expect(stripped).toContain('I made the title punchier and focused the logline on personal stakes.');
    });

    it('strips unclosed / truncated <qwen-patch> block cleanly from chat output', () => {
      const truncatedRaw = `Here is the revised chapter opening:\n\n<qwen-patch>\n{\n  "type": "update_story_fields",\n  "fields": {\n    "fullBookText": "Elena pulled out the first one. It was dated August 12, 1998.\\n\\nThe note read:\\n\\n*\\"I didn`;
      const stripped = stripQwenPatchBlock(truncatedRaw);
      expect(stripped).not.toContain('<qwen-patch>');
      expect(stripped).not.toContain('update_story_fields');
      expect(stripped).toContain('Here is the revised chapter opening:');
    });

    it('extracts partial story fields from truncated in-flight <qwen-patch> block', () => {
      const truncatedRaw = `Here is the revised chapter:\n\n<qwen-patch>\n{\n  "type": "update_story_fields",\n  "fields": {\n    "fullBookText": "Elena ran through the rain.\\n\\nShe reached the depot safely."`;
      const patch = extractStoryPatchFromResponse('Revise manuscript', truncatedRaw, 'book');
      expect(patch).not.toBeNull();
      if (patch && patch.type === 'update_story_fields') {
        expect(patch.fields.fullBookText).toContain('Elena ran through the rain.\n\nShe reached the depot safely.');
      }
    });

    it('extracts fallback labeled markdown fields when model omits <qwen-patch> tags', () => {
      const markdownRaw = `Sure! Here is the revised pitch:

**Title:** Whispers of the Starfallen
**Logline:** A rogue cartographer charts forgotten celestial ruins before an empire burns them to ash.
**Premise:** Memory is an anchor to existence.
**Synopsis:** Across the frosted steppes, ancient maps reveal hidden paths...`;

      const patch = extractStoryPatchFromResponse('Update my pitch details', markdownRaw, 'pitch');
      expect(patch).not.toBeNull();
      expect(patch?.type).toBe('update_story_fields');
      if (patch && patch.type === 'update_story_fields') {
        expect(patch.fields.title).toBe('Whispers of the Starfallen');
        expect(patch.fields.logline).toBe(
          'A rogue cartographer charts forgotten celestial ruins before an empire burns them to ash.'
        );
        expect(patch.fields.premise).toBe('Memory is an anchor to existence.');
        expect(patch.fields.synopsis).toContain('Across the frosted steppes');
      }
    });

    it('applies update_story_fields patch to title, pitch, and manuscript prose atomically', () => {
      const patched = applyQwenStoryPatch(mockStory, {
        type: 'update_story_fields',
        fields: {
          title: 'Chronicles of the Starfallen',
          author: 'Elena Cruz',
          tags: ['epic', 'starlight'],
          logline: 'New epic logline.',
          fullBookText: 'Chapter 2: The Constellation Gate.',
          bookTextMode: 'append',
        },
      });

      expect(patched.title).toBe('Chronicles of the Starfallen');
      expect(patched.author).toBe('Elena Cruz');
      expect(patched.tags).toEqual(['epic', 'starlight']);
      expect(patched.logline).toBe('New epic logline.');
      expect(patched.fullBookText).toBe(
        'Chapter 1: The Gathering Dust.\n\nChapter 2: The Constellation Gate.'
      );
      expect(() => validateStoryInput(patched)).not.toThrow();
    });

    it('applies create_story patch initializing a brand new story', () => {
      const created = applyQwenStoryPatch(mockStory, {
        type: 'create_story',
        initialFields: {
          title: 'New Cyberpunk Manila Story',
          logline: 'In neon-lit Manila, a courier transports contraband memories.',
          premise: 'Memories can be stolen, but truth cannot be erased.',
        },
      });

      expect(created.title).toBe('New Cyberpunk Manila Story');
      expect(created.logline).toBe(
        'In neon-lit Manila, a courier transports contraband memories.'
      );
      expect(created.premise).toBe(
        'Memories can be stolen, but truth cannot be erased.'
      );
      expect(created.id).not.toBe(mockStory.id);
      expect(() => validateStoryInput(created)).not.toThrow();
    });

    it('injects Creator Mode hierarchical schemas when mode is creator and warns against fullBookText', () => {
      const messages = buildStoryCoPilotMessages({
        story: mockStory,
        mode: 'creator',
        activeScreen: {
          screenKind: 'story_workspace',
          routePath: '/stories/story-test-1',
          screenLabel: 'Story Workspace: "Rise of the Fable"',
          activeTab: 'creator',
          formDrafts: {
            isEditModalOpen: true,
          },
        },
        chatHistory: [{ role: 'user', content: 'try to add act 1' }],
        liveSettings: DEFAULT_QWEN_SETTINGS.live,
      });

      const sys = messages[0].content;
      expect(sys).toContain('Mode: Creator Mode');
      expect(sys).toContain('append_acts');
      expect(sys).toContain('append_sequences');
      expect(sys).toContain('append_scenes');
      expect(sys).toContain('append_beats');
      expect(sys).toContain('Do NOT write acts or scenes to fullBookText');
      expect(sys).toContain('Existing Acts in Story:');
      expect(sys).toContain('"act-1"');
    });

    it('extracts append_acts patch from <qwen-patch> block', () => {
      const raw = `Here is Act 1 for your story:\n\n<qwen-patch>\n{\n  "type": "append_acts",\n  "acts": [\n    {\n      "title": "Act 1: The Midnight Ticket",\n      "summary": "Elena works the late shift at the BPO when an impossible ticket arrives.",\n      "dramaticMeta": {\n        "incitingIncident": "A ticket arrives from an account that died ten years ago.",\n        "climax": "The phone receiver speaks her real name."\n      }\n    }\n  ]\n}\n</qwen-patch>\n\nI have structured this as the narrative hook.`;

      const patch = extractStoryPatchFromResponse('add act 1', raw, 'creator');
      expect(patch).not.toBeNull();
      expect(patch?.type).toBe('append_acts');
      if (patch && patch.type === 'append_acts') {
        expect(patch.acts.length).toBe(1);
        expect(patch.acts[0].title).toBe('Act 1: The Midnight Ticket');
        expect(patch.acts[0].summary).toContain('Elena works the late shift');
        expect(patch.acts[0].dramaticMeta?.incitingIncident).toContain('died ten years ago');
      }

      // Verify applying it updates story.acts
      const applied = applyQwenStoryPatch(mockStory, patch!);
      expect(applied.acts.length).toBe(2);
      expect(applied.acts[1].title).toBe('Act 1: The Midnight Ticket');
    });

    it('extracts natural language act outlines into an append_acts patch when in creator mode', () => {
      const naturalRaw = `Here is Act 1 for "After Hours":

Act 1: The First Call
Summary: Elena Reyes sits in her cubicle at 3:15 AM when a priority ticket locks her computer and whispers an impossible warning.
Inciting Incident: The caller knows her childhood name.
Climax: The reflection in the monitor blinks before Elena does.`;

      const patch = extractStoryPatchFromResponse('put act 1 in creator mode', naturalRaw, 'creator');
      expect(patch).not.toBeNull();
      expect(patch?.type).toBe('append_acts');
      if (patch && patch.type === 'append_acts') {
        expect(patch.acts[0].title).toContain('Act 1: The First Call');
        expect(patch.acts[0].summary).toContain('Elena Reyes sits in her cubicle');
        expect(patch.acts[0].dramaticMeta?.incitingIncident).toContain('childhood name');
      }
    });

    it('calculates total context tokens stably by including baselinePromptTokens', () => {
      const committedMessages = [
        { content: 'Elena Reyes works night shift.', thinkingContent: '' },
      ];

      // 1. Without baselinePromptTokens
      const simpleResult = calculateLiveTokens({ committedMessages });
      expect(simpleResult.totalTokens).toBe(estimateTokenCount(committedMessages[0].content));

      // 2. With baselinePromptTokens (system prompt + story metadata + scene hierarchy)
      const stableResult = calculateLiveTokens({
        committedMessages,
        baselinePromptTokens: 1450,
      });
      expect(stableResult.baselinePromptTokens).toBe(1450);
      expect(stableResult.totalTokens).toBe(1450 + estimateTokenCount(committedMessages[0].content));
    });
  });

  describe('qwenClient telemetry & dictionary lookup', () => {
    it('fetches real-time process metrics from /api/qwen/control/metrics', async () => {
      const mockMetrics = {
        pid: 14820,
        state: 'awake',
        ramWorkingSetMb: 5840.5,
        cpuPercent: 3.2,
        uptimeSeconds: 340,
        port: 8080,
        contextSize: 8192,
        fitTargetMb: 1536,
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockMetrics,
        })
      );

      const metrics = await getQwenProcessMetrics();
      expect(metrics).toEqual(mockMetrics);
      expect(fetch).toHaveBeenCalledWith('/api/qwen/control/metrics');
    });

    it('captures finishReason and ttftMs in streamChatCompletion', async () => {
      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"Once upon"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{"content":" a midnight dreary"},"finish_reason":"length"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      let index = 0;
      const mockStream = new ReadableStream({
        pull(controller) {
          if (index < sseChunks.length) {
            controller.enqueue(encoder.encode(sseChunks[index++]));
          } else {
            controller.close();
          }
        },
      });

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          body: mockStream,
        })
      );

      const result = await streamChatCompletion(
        [{ role: 'user', content: 'Tell me a story' }],
        DEFAULT_QWEN_SETTINGS.live
      );

      expect(result.fullText).toBe('Once upon a midnight dreary');
      expect(result.finishReason).toBe('length');
      expect(typeof result.ttftMs).toBe('number');
      expect(result.ttftMs).toBeGreaterThanOrEqual(0);
    });

    it('looks up dictionary definition, context meaning, and examples', async () => {
      const mockDefinition = {
        word: 'sickly',
        partOfSpeech: 'adjective',
        definition: 'Often unwell; unhealthy in appearance or atmosphere.',
        contextualMeaning: 'Describing the faint, eerie phosphor-green emergency flicker.',
        examples: [
          'The lantern cast a sickly amber glow against the rusted wall.',
          'A sickly wind rattled the warehouse corrugated panels.',
        ],
        synonyms: ['pallid', 'faint', 'wan', 'feeble'],
      };

      const sseChunks = [
        `data: {"choices":[{"delta":{"content":${JSON.stringify(JSON.stringify(mockDefinition))}},"finish_reason":"stop"}]}\n\n`,
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      let index = 0;
      const mockStream = new ReadableStream({
        pull(controller) {
          if (index < sseChunks.length) {
            controller.enqueue(encoder.encode(sseChunks[index++]));
          } else {
            controller.close();
          }
        },
      });

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          body: mockStream,
        })
      );

      const def = await lookupWordDefinition(
        'sickly',
        'the sickly phosphor-green flicker of a cracked emergency radio receiver.',
        DEFAULT_QWEN_SETTINGS.live
      );

      expect(def.word).toBe('sickly');
      expect(def.partOfSpeech).toBe('adjective');
      expect(def.definition).toContain('Often unwell');
      expect(def.examples.length).toBe(2);
      expect(def.synonyms).toContain('pallid');
    });

    it('enforces Jinja template constraint: merges system messages to index 0 so no system message follows user messages', async () => {
      const mockDefinition = {
        word: 'driftwood',
        partOfSpeech: 'noun',
        definition: 'Wood that has been washed ashore or is floating on water.',
        contextualMeaning: 'Used as an improvised torch.',
        examples: ['She carried a smoking driftwood branch.', 'The driftwood fire crackled.'],
        synonyms: ['flotsam', 'timber', 'salvage'],
      };

      const sseChunks = [
        `data: {"choices":[{"delta":{"content":${JSON.stringify(JSON.stringify(mockDefinition))}},"finish_reason":"stop"}]}\n\n`,
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      let index = 0;
      const mockStream = new ReadableStream({
        pull(controller) {
          if (index < sseChunks.length) {
            controller.enqueue(encoder.encode(sseChunks[index++]));
          } else {
            controller.close();
          }
        },
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });
      vi.stubGlobal('fetch', fetchMock);

      await lookupWordDefinition(
        'driftwood',
        'her driftwood torch spitting dancing orange sparks',
        DEFAULT_QWEN_SETTINGS.live
      );

      expect(fetchMock).toHaveBeenCalled();
      const requestCall = fetchMock.mock.calls[0];
      const payload = JSON.parse(requestCall[1].body);

      // Verify ChatML / Jinja compliance:
      // 1. Only 1 system message exists
      const systemMessages = payload.messages.filter((m: any) => m.role === 'system');
      expect(systemMessages.length).toBe(1);

      // 2. The single system message is at index 0
      expect(payload.messages[0].role).toBe('system');
      expect(payload.messages[0].content).toContain('lexicographer');
      expect(payload.messages[0].content).toContain('raw valid JSON');

      // 3. No system message appears after index 0 (especially not after user messages)
      const nonInitialMessages = payload.messages.slice(1);
      const invalidSystemMessage = nonInitialMessages.find((m: any) => m.role === 'system');
      expect(invalidSystemMessage).toBeUndefined();

      // 4. User message is preserved
      expect(payload.messages[1].role).toBe('user');
      expect(payload.messages[1].content).toContain('driftwood');
    });

    it('normalizeChatMessages correctly merges multiple system messages and preserves message sequence', () => {
      const input = [
        { role: 'system' as const, content: 'Base instruction.' },
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
        { role: 'system' as const, content: 'Schema: {"type": "object"}' },
        { role: 'user' as const, content: 'Do something' },
      ];

      const normalized = normalizeChatMessages(input);

      expect(normalized.length).toBe(4);
      expect(normalized[0].role).toBe('system');
      expect(normalized[0].content).toContain('Base instruction.');
      expect(normalized[0].content).toContain('Schema: {"type": "object"}');
      expect(normalized[1]).toEqual({ role: 'user', content: 'Hello' });
      expect(normalized[2]).toEqual({ role: 'assistant', content: 'Hi there!' });
      expect(normalized[3]).toEqual({ role: 'user', content: 'Do something' });
    });

    it('supports granular dictionary detail levels, speed presets, and attaches token cost', async () => {
      const mockDef = {
        word: 'phosphor',
        partOfSpeech: 'noun',
        definition: 'A synthetic fluorescent or phosphorescent substance.',
      };

      const sseChunks = [
        `data: {"choices":[{"delta":{"content":${JSON.stringify(JSON.stringify(mockDef))}},"finish_reason":"stop"}]}\n\n`,
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      let index = 0;
      const mockStream = new ReadableStream({
        pull(controller) {
          if (index < sseChunks.length) {
            controller.enqueue(encoder.encode(sseChunks[index++]));
          } else {
            controller.close();
          }
        },
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await lookupWordDefinition(
        'phosphor',
        'the phosphor-green flicker',
        DEFAULT_QWEN_SETTINGS.live,
        undefined,
        {
          detailLevel: 'definition_only',
          speedPreset: 'fast',
          showSynonyms: false,
          cacheEnabled: false,
        }
      );

      expect(res.word).toBe('phosphor');
      expect(res.definition).toContain('fluorescent');
      expect(res.tokenCost).toBeDefined();
      expect(res.tokenCost?.totalTokens).toBeGreaterThan(0);

      // Verify that schema requested definition only
      const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(payload.messages[0].content).toContain('"required":["word","partOfSpeech","definition"]');
    });

    it('returns cached word instantly from dictionary library without calling network when cache is hit', async () => {
      const { saveToDictionaryLibrary, clearDictionaryLibrary } = await import('../storage/dictionaryLibrary');
      clearDictionaryLibrary();

      saveToDictionaryLibrary({
        word: 'brine',
        partOfSpeech: 'noun',
        definition: 'Water strongly impregnated with salt.',
        examples: ['The smell of brine hung thick in the air.'],
        synonyms: ['saltwater', 'saline'],
        detailLevel: 'definition_examples',
      });

      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const res = await lookupWordDefinition(
        'brine',
        'saturated with brine',
        DEFAULT_QWEN_SETTINGS.live,
        undefined,
        { cacheEnabled: true }
      );

      expect(res.cached).toBe(true);
      expect(res.word).toBe('brine');
      expect(res.definition).toContain('impregnated with salt');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('handles truncated JSON without throwing Unexpected end of JSON input (recovers partial definition)', async () => {
      // Simulate Qwen running out of tokens mid-generation with unclosed JSON
      const truncatedRawOutput = `<think>\nThinking about dominion in context of tide...\n</think>\n{"word": "dominion", "partOfSpeech": "noun", "definition": "sovereign control or supreme authority over a domain", "contextualMeaning": "In this scene, describes the sea's complete control`;

      const sseChunks = [
        `data: {"choices":[{"delta":{"content":${JSON.stringify(truncatedRawOutput)}},"finish_reason":"length"}]}\n\n`,
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      let index = 0;
      const mockStream = new ReadableStream({
        pull(controller) {
          if (index < sseChunks.length) {
            controller.enqueue(encoder.encode(sseChunks[index++]));
          } else {
            controller.close();
          }
        },
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await lookupWordDefinition(
        'dominion',
        'held undisputed dominion over the drowned village',
        DEFAULT_QWEN_SETTINGS.live,
        undefined,
        { cacheEnabled: false }
      );

      expect(res.word).toBe('dominion');
      expect(res.partOfSpeech).toBe('noun');
      expect(res.definition).toContain('sovereign control');
      expect(res.contextualMeaning).toContain('complete control');
    });

    it('instructs model to suppress reasoning thought block during structured dictionary lookup to preserve tokens', async () => {
      const mockDefinition = {
        word: 'dominion',
        partOfSpeech: 'noun',
        definition: 'Sovereignty or control.',
      };

      const sseChunks = [
        `data: {"choices":[{"delta":{"content":${JSON.stringify(JSON.stringify(mockDefinition))}},"finish_reason":"stop"}]}\n\n`,
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      let index = 0;
      const mockStream = new ReadableStream({
        pull(controller) {
          if (index < sseChunks.length) {
            controller.enqueue(encoder.encode(sseChunks[index++]));
          } else {
            controller.close();
          }
        },
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });
      vi.stubGlobal('fetch', fetchMock);

      await lookupWordDefinition(
        'dominion',
        'held undisputed dominion over the drowned village',
        DEFAULT_QWEN_SETTINGS.live,
        undefined,
        { cacheEnabled: false }
      );

      const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
      const systemContent = payload.messages[0].content;
      expect(systemContent).toMatch(/do not (?:generate|output).*<think>/i);
      expect(payload.max_tokens).toBeGreaterThanOrEqual(400);
    });

    it('recovers cleanly from plain text or broken output during dictionary lookup without throwing SyntaxError', async () => {
      const plainTextAnswer = `Dominion: noun. Sovereignty or control; absolute ownership.\nScene nuance: complete power over the ruins.\nExamples: "He had dominion over all.", "The sea held dominion."`;

      const sseChunks = [
        `data: {"choices":[{"delta":{"content":${JSON.stringify(plainTextAnswer)}},"finish_reason":"stop"}]}\n\n`,
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      let index = 0;
      const mockStream = new ReadableStream({
        pull(controller) {
          if (index < sseChunks.length) {
            controller.enqueue(encoder.encode(sseChunks[index++]));
          } else {
            controller.close();
          }
        },
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await lookupWordDefinition(
        'dominion',
        'held undisputed dominion over the drowned village',
        DEFAULT_QWEN_SETTINGS.live,
        undefined,
        { cacheEnabled: false }
      );

      expect(res.word).toBe('dominion');
      expect(res.definition).toContain('Sovereignty or control');
    });

    it('instructs model to wrap reasoning in <think> tags when reasoning effort is enabled', () => {
      const messages = buildStoryCoPilotMessages({
        story: mockStory,
        mode: 'creator',
        persona: 'screenwriter',
        chatHistory: [],
        liveSettings: {
          ...DEFAULT_QWEN_SETTINGS.live,
          reasoningEffort: 'medium',
        },
      });
      const sys = messages[0].content;
      expect(sys).toContain('<think>...</think>');
      expect(sys).toContain('Reasoning effort is medium');
    });

    it('dispatches live telemetry events during dictionary lookup so Performance Monitor shows active token generation', async () => {
      const mockDef = {
        word: 'dominion',
        partOfSpeech: 'noun',
        definition: 'Sovereignty or control.',
      };

      const sseChunks = [
        `data: {"choices":[{"delta":{"content":${JSON.stringify(JSON.stringify(mockDef))}},"finish_reason":"stop"}]}\n\n`,
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      let index = 0;
      const mockStream = new ReadableStream({
        pull(controller) {
          if (index < sseChunks.length) {
            controller.enqueue(encoder.encode(sseChunks[index++]));
          } else {
            controller.close();
          }
        },
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });
      vi.stubGlobal('fetch', fetchMock);

      const telemetryEvents: any[] = [];
      const listener = (e: any) => telemetryEvents.push(e.detail);
      window.addEventListener('krakinai:telemetry-update', listener);

      try {
        await lookupWordDefinition(
          'dominion',
          'held undisputed dominion over the drowned village',
          DEFAULT_QWEN_SETTINGS.live,
          undefined,
          { cacheEnabled: false }
        );

        expect(telemetryEvents.length).toBeGreaterThan(0);
        const generatingEvent = telemetryEvents.find((evt) => evt.isGenerating === true);
        expect(generatingEvent).toBeDefined();
        const finishEvent = telemetryEvents[telemetryEvents.length - 1];
        expect(finishEvent.isGenerating).toBe(false);
      } finally {
        window.removeEventListener('krakinai:telemetry-update', listener);
      }
    });
  });

  describe('Dictionary Library Portability (Export & Import)', () => {
    beforeEach(() => {
      clearDictionaryLibrary();
    });

    it('generates structured JSON export payload with format metadata and all entries', () => {
      saveToDictionaryLibrary({
        word: 'driftwood',
        partOfSpeech: 'noun',
        definition: 'Wood that has been washed ashore or is floating in the sea.',
        contextualMeaning: 'Represents salvaged survival amidst tidal decay.',
        examples: ['Her driftwood torch spit dancing orange sparks.'],
        synonyms: ['flotsam', 'timber'],
        detailLevel: 'full_with_context',
      });

      const jsonStr = generateDictionaryJson();
      const parsed = JSON.parse(jsonStr);

      expect(parsed.format).toBe('krakinai.qwen.dictionary');
      expect(parsed.version).toBe(1);
      expect(parsed.totalEntries).toBe(1);
      expect(parsed.entries.driftwood).toBeDefined();
      expect(parsed.entries.driftwood.word).toBe('driftwood');
      expect(parsed.entries.driftwood.synonyms).toContain('flotsam');
    });

    it('generates formatted Markdown literary glossary sorted alphabetically', () => {
      saveToDictionaryLibrary({
        word: 'driftwood',
        partOfSpeech: 'noun',
        definition: 'Wood that has been washed ashore.',
        contextualMeaning: 'Salvaged sea wood.',
        examples: ['Her driftwood torch spit dancing orange sparks.'],
        synonyms: ['flotsam'],
        detailLevel: 'full_with_context',
      });
      saveToDictionaryLibrary({
        word: 'corrugated',
        partOfSpeech: 'adjective',
        definition: 'Having a wavy or ridged surface.',
        contextualMeaning: 'Weathered industrial texture.',
        examples: ['The corrugated roof groaned.'],
        synonyms: ['ridged', 'ribbed'],
        detailLevel: 'full_with_context',
      });

      const md = generateDictionaryMarkdown();

      expect(md).toContain('# 📖 KRAKINAI Story Manuscript Lexicon');
      expect(md).toContain('### **corrugated** *(adjective)*');
      expect(md).toContain('### **driftwood** *(noun)*');
      // Verify alphabetical order: 'corrugated' appears before 'driftwood'
      expect(md.indexOf('corrugated')).toBeLessThan(md.indexOf('driftwood'));
      expect(md).toContain('The corrugated roof groaned.');
      expect(md).toContain('`ridged`');
    });

    it('imports valid JSON dictionary in merge mode without dropping existing entries', () => {
      saveToDictionaryLibrary({
        word: 'driftwood',
        partOfSpeech: 'noun',
        definition: 'Local definition.',
        examples: [],
        synonyms: [],
        detailLevel: 'definition_only',
      });

      const incomingPayload = {
        format: 'krakinai.qwen.dictionary',
        version: 1,
        exportedAt: new Date().toISOString(),
        totalEntries: 2,
        entries: {
          driftwood: {
            id: 'driftwood',
            word: 'driftwood',
            partOfSpeech: 'noun',
            definition: 'Updated definition with nuance.',
            contextualMeaning: 'New nuance.',
            examples: ['Incoming example.'],
            synonyms: ['flotsam'],
            detailLevel: 'full_with_context',
            createdAt: Date.now() - 1000,
            lastAccessedAt: Date.now(),
            hitCount: 5,
          },
          belfry: {
            id: 'belfry',
            word: 'belfry',
            partOfSpeech: 'noun',
            definition: 'A bell tower.',
            examples: ['The slack tide belfry.'],
            synonyms: ['steeple'],
            detailLevel: 'definition_examples',
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            hitCount: 1,
          },
        },
      };

      const result = importDictionaryFromJson(JSON.stringify(incomingPayload), 'merge');
      expect(result.importedCount).toBe(2);

      const lib = loadDictionaryLibrary();
      expect(lib.driftwood).toBeDefined();
      expect(lib.driftwood.definition).toBe('Updated definition with nuance.');
      expect(lib.belfry).toBeDefined();
      expect(lib.belfry.word).toBe('belfry');
    });

    it('rejects invalid or non-dictionary JSON payloads gracefully', () => {
      expect(() => importDictionaryFromJson('not json at all')).toThrow();
      expect(() => importDictionaryFromJson(JSON.stringify({ some: 'other object' }))).toThrow(
        /Invalid dictionary payload/
      );
    });
  });

  describe('Editable System Prompts & Slash Command Skills', () => {
    it('persists and loads customSystemPrompt and customSkillPrompts in QwenSettings', () => {
      expect(DEFAULT_BASE_SYSTEM_PROMPT).toBeDefined();
      expect(typeof DEFAULT_BASE_SYSTEM_PROMPT).toBe('string');
      expect(DEFAULT_BASE_SYSTEM_PROMPT).toContain('KRAKINAI Story & Screenwriting Co-Pilot');

      const initial = loadQwenSettings();
      expect(initial.customSystemPrompt !== undefined).toBe(true);

      const customPrompt = 'You are a Noir Mystery Specialist Co-Pilot.';
      const customSkills = [
        {
          id: 'skill-1',
          command: 'noir-shadows',
          label: 'Noir Shadows',
          description: 'Add heavy chiaroscuro and existential tension',
          prompt: 'Inject harsh chiaroscuro shadows and existential dread into this scene.',
          createdAt: Date.now(),
        },
      ];

      saveQwenSettings({
        ...initial,
        customSystemPrompt: customPrompt,
        customSkillPrompts: customSkills,
      });

      const loaded = loadQwenSettings();
      expect(loaded.customSystemPrompt).toBe(customPrompt);
      expect(loaded.customSkillPrompts).toHaveLength(1);
      expect(loaded.customSkillPrompts?.[0].command).toBe('noir-shadows');
    });

    it('injects customSystemPrompt into buildStoryCoPilotMessages, falling back to default when empty', () => {
      // 1. With custom system prompt
      const customMsgs = buildStoryCoPilotMessages({
        story: mockStory,
        mode: 'creator',
        chatHistory: [],
        liveSettings: DEFAULT_QWEN_SETTINGS.live,
        customSystemPrompt: 'You are a Gothic Horror Narrative Master.',
      });
      expect(customMsgs[0].content).toContain('You are a Gothic Horror Narrative Master.');
      expect(customMsgs[0].content).toContain('Current Story: "Rise of the Fable"');

      // 2. Fallback to default when blank or undefined
      const defaultMsgs = buildStoryCoPilotMessages({
        story: mockStory,
        mode: 'creator',
        chatHistory: [],
        liveSettings: DEFAULT_QWEN_SETTINGS.live,
        customSystemPrompt: '   ',
      });
      expect(defaultMsgs[0].content).toContain('KRAKINAI Story & Screenwriting Co-Pilot');
    });

    it('resolves and filters built-in and custom slash commands', () => {
      const customSkills = [
        {
          id: 'skill-custom-1',
          command: 'dark-gothic',
          label: 'Dark Gothic Mood',
          description: 'Infuse gothic atmospheric detail',
          prompt: 'Deepen the dark gothic mood with decaying architecture and spectral fog.',
          createdAt: Date.now(),
        },
      ];

      const allCommands = resolveSlashCommands(customSkills);
      expect(allCommands.length).toBeGreaterThan(25);

      // Verify built-in personas
      expect(allCommands.some((c) => c.command === '/screenwriter')).toBe(true);
      expect(allCommands.some((c) => c.command === '/director')).toBe(true);

      // Verify built-in prompt skills
      expect(allCommands.some((c) => c.command === '/taglish')).toBe(true);
      expect(allCommands.some((c) => c.command === '/beats')).toBe(true);
      expect(allCommands.some((c) => c.command === '/audit')).toBe(true);
      expect(allCommands.some((c) => c.command === '/clear')).toBe(true);

      // Verify custom command resolution
      const customCmd = allCommands.find((c) => c.command === '/dark-gothic');
      expect(customCmd).toBeDefined();
      expect(customCmd?.category).toBe('custom');

      // Filter by query
      const filteredTaglish = filterSlashCommands('tag', allCommands);
      expect(filteredTaglish.length).toBeGreaterThanOrEqual(1);
      expect(filteredTaglish[0].command).toBe('/taglish');

      const filteredCustom = filterSlashCommands('gothic', allCommands);
      expect(filteredCustom.some((c) => c.command === '/dark-gothic')).toBe(true);

      // Help markdown generation
      const helpMd = generateSlashHelpMarkdown(allCommands);
      expect(helpMd).toContain('/screenwriter');
      expect(helpMd).toContain('/taglish');
      expect(helpMd).toContain('/dark-gothic');
    });
  });
});

