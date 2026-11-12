import type {
  Story,
  StoryAct,
  StorySequence,
  StorySceneNode,
  StoryBeat,
} from '../types/domain';
import type {
  CreatorModeSelection,
  QwenLiveSettings,
  QwenStoryPatchAction,
  QwenSkillPersona,
  QwenActiveScreenContext,
} from '../types/qwen';
import { validateStoryInput } from '../domain/storyValidator';
import { DEFAULT_BASE_SYSTEM_PROMPT } from '../storage/qwenSettings';

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
}

export function calculateLiveTokens(params: {
  committedMessages: Array<{ content: string; thinkingContent?: string }>;
  streamedThinking?: string;
  streamedAnswer?: string;
  baselinePromptTokens?: number;
}): {
  totalTokens: number;
  committedTokens: number;
  streamedTokens: number;
  baselinePromptTokens: number;
} {
  const baselinePromptTokens = Math.max(0, params.baselinePromptTokens || 0);
  const committedTokens = (params.committedMessages || []).reduce(
    (acc, m) => acc + estimateTokenCount(m.content || '') + estimateTokenCount(m.thinkingContent || ''),
    0
  );
  const streamedTokens =
    estimateTokenCount(params.streamedThinking || '') +
    estimateTokenCount(params.streamedAnswer || '');
  return {
    totalTokens: baselinePromptTokens + committedTokens + streamedTokens,
    committedTokens,
    streamedTokens,
    baselinePromptTokens,
  };
}

export function calculateGenerationSpeed(
  streamedTokens: number,
  elapsedSeconds: number
): number {
  if (elapsedSeconds <= 0 || streamedTokens <= 0) return 0;
  return Math.round((streamedTokens / elapsedSeconds) * 10) / 10;
}

export interface BuildStoryMessagesParams {
  story: Story;
  mode: 'pitch' | 'creator' | 'book';
  persona?: QwenSkillPersona;
  selection?: CreatorModeSelection;
  activeScreen?: QwenActiveScreenContext;
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  liveSettings: QwenLiveSettings;
  referencedAssets?: Array<{ id: string; name: string; kind?: string }>;
  customSystemPrompt?: string;
}

export function buildStoryCoPilotMessages(
  params: BuildStoryMessagesParams
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const { story, mode, persona = 'screenwriter', selection, activeScreen, chatHistory, liveSettings, referencedAssets, customSystemPrompt } = params;

  const baseInstructions = customSystemPrompt?.trim() || DEFAULT_BASE_SYSTEM_PROMPT;

  const systemInstructions: string[] = [
    baseInstructions,
    `Current Story: "${story.title}" by ${story.author || 'Anonymous'}`,
    `Logline: ${story.logline || '(None yet)'}`,
    `Premise: ${story.premise || '(None yet)'}`,
    `Synopsis: ${story.synopsis || '(None yet)'}`,
  ];

  // Active Screen Awareness & Live Form Field Values
  if (activeScreen) {
    systemInstructions.push(
      `Active Krakinai Screen: ${activeScreen.screenLabel} (${activeScreen.screenKind}, route: ${activeScreen.routePath})${
        activeScreen.activeTab ? `, Tab: ${activeScreen.activeTab}` : ''
      }`
    );

    if (activeScreen.formDrafts) {
      const drafts = activeScreen.formDrafts;
      const draftDetails: string[] = [];
      if (drafts.isEditModalOpen) draftDetails.push('Story Details Edit Modal is currently OPEN');
      if (drafts.isEditingManuscript) draftDetails.push('Manuscript Prose Textarea is currently OPEN for editing');
      if (drafts.title !== undefined) draftDetails.push(`Field "title": "${drafts.title}"`);
      if (drafts.author !== undefined) draftDetails.push(`Field "author": "${drafts.author}"`);
      if (drafts.tags !== undefined) draftDetails.push(`Field "tags": [${drafts.tags.join(', ')}]`);
      if (drafts.logline !== undefined) draftDetails.push(`Field "logline": "${drafts.logline}"`);
      if (drafts.premise !== undefined) draftDetails.push(`Field "premise": "${drafts.premise}"`);
      if (drafts.synopsis !== undefined) draftDetails.push(`Field "synopsis": "${drafts.synopsis}"`);
      if (drafts.treatment !== undefined) draftDetails.push(`Field "treatment": "${drafts.treatment}"`);
      if (drafts.manuscriptDraft !== undefined) {
        const preview = drafts.manuscriptDraft.length > 500 ? drafts.manuscriptDraft.slice(0, 500) + '...' : drafts.manuscriptDraft;
        draftDetails.push(`Field "manuscriptDraft": "${preview}"`);
      }
      if (draftDetails.length > 0) {
        systemInstructions.push(`Live Form Fields / Unsaved Drafts on Screen:\n${draftDetails.join('\n')}`);
      }
    }
  }

  // Auto-Write Instructions via <qwen-patch>
  systemInstructions.push(
    `You CAN see the user's active screen and form fields. When the user asks you to write, edit, rewrite, or populate fields (like changing the title, drafting a pitch, logline, premise, synopsis, treatment, or writing manuscript prose), you can auto-write directly to their screen fields!\nTo update fields, include a JSON block formatted exactly as:\n<qwen-patch>\n{\n  "type": "update_story_fields",\n  "fields": {\n    "title": "New Title",\n    "logline": "New Logline...",\n    "premise": "New Premise...",\n    "synopsis": "New Synopsis...",\n    "treatment": "New Treatment...",\n    "fullBookText": "New or appended prose...",\n    "bookTextMode": "replace" | "append"\n  }\n}\n</qwen-patch>\nIf creating a brand new story from the overview screen, use "type": "create_story". Always explain your creative choices outside the <qwen-patch> tags.`
  );

  // Specialized Persona / Skill Instructions
  if (persona === 'screenwriter') {
    systemInstructions.push(
      `Active Persona: Story Screenwriter (Phase 1). You excel at screenplay formatting, natural character dialogue, authentic Filipino/Taglish conversational rhythm when requested, dramatic subtext, and breaking scenes into 5-to-10-second cinematic story beats.`
    );
  } else if (persona === 'editor') {
    systemInstructions.push(
      `Active Persona: Script Doctor & Editor (Phase 2). You perform Beat Duration Audits, identifying bloated or dialogue-crammed beats that exceed 10 seconds. You inject dialogue breathing room, reaction pauses, and prepare clean Director Handoff Briefings with lighting, mood, and vocal performance notes.`
    );
  } else if (persona === 'novelist') {
    systemInstructions.push(
      `Active Persona: Book Novelist (Phase 2B). You translate dramatic story beats into continuous literary manuscript prose. You specialize in vivid sensory details, emotional depth, internal monologue, and evocative atmospheric pacing.`
    );
  } else if (persona === 'director') {
    systemInstructions.push(
      `Active Persona: Story Director (Phase 3). You translate narrative scenes into 5-to-10-second Google Flow Omni video shots. You produce 12-layer visual prompts (subject, environment, wardrobe, lighting, lens, mood), cinematic camera compositions, and start/end Keyframe Plans.`
    );
  } else if (persona === 'storyboarder') {
    systemInstructions.push(
      `Active Persona: Emotional Storyboard Crafter. You focus on dramatic dialogue breathing, emotional coverage, silent character reaction pacing, and psychological camera framing.`
    );
  }

  if (referencedAssets && referencedAssets.length > 0) {
    const assetList = referencedAssets
      .slice(0, 15)
      .map((a) => `${a.name}${a.kind ? ` (${a.kind})` : ''}`)
      .join(', ');
    systemInstructions.push(`Library Assets & Characters Available: ${assetList}`);
  }

  if (mode === 'pitch') {
    systemInstructions.push(
      `Mode: Pitch & Treatment Overview. Assist with high-concept hooks, compelling loglines, thematic premises, and treatment expansion.`
    );
  } else if (mode === 'creator') {
    systemInstructions.push(
      `Mode: Creator Mode (Hierarchical Structure: Acts -> Sequences -> Scenes -> Beats).`,
      `CRITICAL INSTRUCTION FOR CREATOR MODE: Do NOT write acts or scenes to fullBookText or manuscriptDraft. You are working in Creator Mode. To outline or add acts, sequences, scenes, or beats, you MUST output a <qwen-patch> using the hierarchical patch actions below.`
    );

    if (story.acts && story.acts.length > 0) {
      const actList = story.acts
        .map((a) => {
          const seqSummary = (a.sequences || [])
            .map((s) => `Sequence "${s.title}" (ID: "${s.id}")`)
            .join(', ');
          return `Act "${a.title}" (ID: "${a.id}")${seqSummary ? ` -> [${seqSummary}]` : ''}`;
        })
        .join('\n');
      systemInstructions.push(`Existing Acts in Story:\n${actList}`);
    } else {
      systemInstructions.push(
        `Total Acts: 0. Creator Mode is currently empty. The user wants you to create acts or seed a 3-act structure!`
      );
    }

    if (activeScreen?.formDrafts?.isEditModalOpen) {
      systemInstructions.push(
        `The "Add ACT" / "Edit ACT" modal is currently OPEN on the user's screen. If the user asks to add or refine an act, emit an "append_acts" patch with the act title, summary, and dramatic metadata to populate it directly!`
      );
    }

    if (selection) {
      const activeAct = story.acts?.find((a) => a.id === selection.actId);
      const activeSeq = activeAct?.sequences?.find((s) => s.id === selection.sequenceId);
      const activeScene = activeSeq?.scenes?.find((sc) => sc.id === selection.sceneId);
      const activeBeat = activeScene?.beats?.find((b) => b.id === selection.beatId);

      const targetParts: string[] = [];
      if (activeAct) targetParts.push(`Act: "${activeAct.title}" (ID: "${activeAct.id}")`);
      if (activeSeq) targetParts.push(`Sequence: "${activeSeq.title}" (ID: "${activeSeq.id}")`);
      if (activeScene) targetParts.push(`Scene: "${activeScene.title}" (ID: "${activeScene.id}")`);
      if (activeBeat) targetParts.push(`Beat: "${activeBeat.title}" (ID: "${activeBeat.id}")`);

      if (targetParts.length > 0) {
        systemInstructions.push(`Current Selection in Creator Hierarchy: ${targetParts.join(' > ')}`);
      }
    }

    systemInstructions.push(
      `Creator Mode Patch Schemas:\n` +
      `1. Append Act(s):\n` +
      `<qwen-patch>\n{\n  "type": "append_acts",\n  "acts": [\n    {\n      "title": "Act 1: Title",\n      "summary": "Act narrative arc summary...",\n      "dramaticMeta": {\n        "subtext": "...",\n        "incitingIncident": "...",\n        "climax": "...",\n        "setup": ["..."],\n        "payoffs": ["..."]\n      }\n    }\n  ]\n}\n</qwen-patch>\n\n` +
      `2. Append Sequence(s) to an existing Act:\n` +
      `<qwen-patch>\n{\n  "type": "append_sequences",\n  "actId": "<targetActId>",\n  "sequences": [\n    {\n      "title": "Sequence 1: Title",\n      "summary": "Summary of sequence..."\n    }\n  ]\n}\n</qwen-patch>\n\n` +
      `3. Append Scene(s) to an existing Sequence:\n` +
      `<qwen-patch>\n{\n  "type": "append_scenes",\n  "actId": "<targetActId>",\n  "sequenceId": "<targetSequenceId>",\n  "scenes": [\n    {\n      "title": "Scene 1: Title",\n      "location": "INT./EXT. ...",\n      "time": "DAY",\n      "dramaticGoal": "..."\n    }\n  ]\n}\n</qwen-patch>\n\n` +
      `4. Append Beat(s) to an existing Scene:\n` +
      `<qwen-patch>\n{\n  "type": "append_beats",\n  "actId": "<targetActId>",\n  "sequenceId": "<targetSequenceId>",\n  "sceneId": "<targetSceneId>",\n  "beats": [\n    {\n      "title": "Beat 1: Title",\n      "content": "5-to-10 second dramatic/dialogue beat description..."\n    }\n  ]\n}\n</qwen-patch>\n\n` +
      `5. Update Dramatic & Continuity Metadata:\n` +
      `<qwen-patch>\n{\n  "type": "update_dramatic_meta",\n  "target": { "actId": "<targetActId>" },\n  "dramaticMeta": {\n    "subtext": "...",\n    "incitingIncident": "...",\n    "climax": "..."\n  }\n}\n</qwen-patch>`
    );
  } else if (mode === 'book') {
    systemInstructions.push(
      `Mode: Book Mode (Literary Manuscript). Help draft chapter prose, translate outline beats into continuous flowing narrative, and refine dialogue/prose style.`
    );
    if (story.fullBookText) {
      const excerpt =
        story.fullBookText.length > 1800
          ? '...' + story.fullBookText.slice(-1800)
          : story.fullBookText;
      systemInstructions.push(`Current Manuscript Excerpt:\n"""\n${excerpt}\n"""`);
    }
  }

  if (liveSettings.reasoningEffort === 'off') {
    systemInstructions.push(
      `Do not use a <think> tag or reasoning preamble. Provide your response directly.`
    );
  } else {
    systemInstructions.push(
      `Reasoning effort is ${liveSettings.reasoningEffort}. Before writing your final response, you MUST output your internal thoughts, narrative pacing analysis, and subtext inside <think>...</think> tags.`
    );
  }

  // Context budgeting: keep rolling chat history bounded
  const systemContent = systemInstructions.join('\n\n');
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemContent },
  ];

  // Keep last 10 messages from chat history to avoid exceeding context
  const recentHistory = chatHistory.slice(-10);
  for (const m of recentHistory) {
    messages.push({ role: m.role, content: m.content });
  }

  return messages;
}

export function stripQwenPatchBlock(rawAnswer: string): string {
  if (!rawAnswer) return '';
  return rawAnswer
    .replace(/<qwen-patch>[\s\S]*?<\/qwen-patch>/gi, '')
    .replace(/<qwen-patch>[\s\S]*$/gi, '')
    .trim();
}

export function extractStoryPatchFromResponse(
  userPrompt: string,
  rawAnswer: string,
  mode?: 'pitch' | 'creator' | 'book'
): QwenStoryPatchAction | null {
  if (!rawAnswer) return null;

  // 1. Structured JSON extraction inside <qwen-patch>...</qwen-patch>
  const patchMatch = rawAnswer.match(/<qwen-patch>([\s\S]*?)<\/qwen-patch>/i);
  if (patchMatch) {
    try {
      const parsed = JSON.parse(patchMatch[1].trim());
      if (parsed && typeof parsed === 'object' && parsed.type) {
        if (parsed.type === 'create_story') {
          return {
            type: 'create_story',
            initialFields: parsed.initialFields || parsed.story || {},
          };
        }
        return parsed as QwenStoryPatchAction;
      }
    } catch {
      // Failed to parse inner JSON, fallback to regex
    }
  }

  // 1b. In-flight / Truncated JSON recovery inside unclosed <qwen-patch>
  if (!patchMatch && /<qwen-patch>/i.test(rawAnswer)) {
    const patchContent = rawAnswer.split(/<qwen-patch>/i)[1] || '';
    const bookTextMatch = patchContent.match(/"fullBookText"\s*:\s*"((?:[^"\\]|\\.)*)/);
    if (bookTextMatch) {
      try {
        const unescaped = JSON.parse(`"${bookTextMatch[1]}"`);
        return {
          type: 'update_story_fields',
          fields: {
            fullBookText: unescaped,
            bookTextMode: patchContent.includes('"bookTextMode": "replace"') ? 'replace' : 'append',
          },
        };
      } catch {
        const fallbackUnescaped = bookTextMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        return {
          type: 'update_story_fields',
          fields: {
            fullBookText: fallbackUnescaped,
            bookTextMode: patchContent.includes('"bookTextMode": "replace"') ? 'replace' : 'append',
          },
        };
      }
    }

    // 1c. In-flight / Truncated JSON recovery for append_acts
    const actsMatch = patchContent.match(/"acts"\s*:\s*\[\s*\{[\s\S]*?"title"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
    if (actsMatch) {
      const actTitle = actsMatch[1].replace(/\\"/g, '"');
      const actSummaryMatch = patchContent.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
      const actSummary = actSummaryMatch ? actSummaryMatch[1].replace(/\\"/g, '"') : '';
      return {
        type: 'append_acts',
        acts: [
          {
            id: `act-${crypto.randomUUID()}`,
            title: actTitle,
            summary: actSummary,
            orderIndex: 0,
            sequences: [],
          },
        ],
      };
    }
  }

  // 2. Fallback: Deterministic Markdown extraction for common story fields
  const titleMatch = rawAnswer.match(/(?:\*{1,2}Title:\*{1,2}|Title:)\s*([^\n\r]+)/i);
  const authorMatch = rawAnswer.match(/(?:\*{1,2}Author:\*{1,2}|Author:)\s*([^\n\r]+)/i);
  const loglineMatch = rawAnswer.match(
    /(?:\*{1,2}Logline:\*{1,2}|Logline:)\s*([^\n\r]+(?:\n(?!\*{1,2}[A-Za-z]+:|Title:|Author:|Logline:|Premise:|Synopsis:|Treatment:)[^\n\r]+)*)/i
  );
  const premiseMatch = rawAnswer.match(
    /(?:\*{1,2}Premise:\*{1,2}|Premise:)\s*([^\n\r]+(?:\n(?!\*{1,2}[A-Za-z]+:|Title:|Author:|Logline:|Premise:|Synopsis:|Treatment:)[^\n\r]+)*)/i
  );
  const synopsisMatch = rawAnswer.match(
    /(?:\*{1,2}Synopsis:\*{1,2}|Synopsis:)\s*([\s\S]*?)(?=(?:\*{1,2}[A-Za-z]+:|Title:|Author:|Logline:|Premise:|Synopsis:|Treatment:|$))/i
  );
  const treatmentMatch = rawAnswer.match(
    /(?:\*{1,2}Treatment:\*{1,2}|Treatment:)\s*([\s\S]*?)(?=(?:\*{1,2}[A-Za-z]+:|Title:|Author:|Logline:|Premise:|Synopsis:|Treatment:|$))/i
  );

  if (titleMatch || authorMatch || loglineMatch || premiseMatch || synopsisMatch || treatmentMatch) {
    const fields: import('../types/qwen').StoryFieldsUpdatePayload = {};
    if (titleMatch) fields.title = titleMatch[1].trim();
    if (authorMatch) fields.author = authorMatch[1].trim();
    if (loglineMatch) fields.logline = loglineMatch[1].trim();
    if (premiseMatch) fields.premise = premiseMatch[1].trim();
    if (synopsisMatch) fields.synopsis = synopsisMatch[1].trim();
    if (treatmentMatch) fields.treatment = treatmentMatch[1].trim();
    return {
      type: 'update_story_fields',
      fields,
    };
  }

  // 3. Fallback: Natural language Act extraction for Creator Mode
  const actHeaderMatch = rawAnswer.match(/(?:^|\n)(?:###?\s*)?(Act\s+(?:[0-9]+|[IVXLCDM]+)[:\s–-]+[^\n\r]+)/i);
  if (actHeaderMatch && (mode === 'creator' || /act\s+[0-9ivx]/i.test(userPrompt) || /create\s+mode/i.test(userPrompt))) {
    const actTitle = actHeaderMatch[1].replace(/^###?\s*/, '').trim();
    const summaryMatch = rawAnswer.match(
      /(?:Summary|Beat Notes|Description|Arc)[:\s]+([^\n\r]+(?:\n(?!(?:Inciting|Climax|Subtext|Setup|Payoff|Sequence|Scene|Act\s+[0-9IVX]))[^\n\r]+)*)/i
    );
    const incitingMatch = rawAnswer.match(/Inciting Incident[:\s]+([^\n\r]+)/i);
    const climaxMatch = rawAnswer.match(/Climax[:\s]+([^\n\r]+)/i);
    const subtextMatch = rawAnswer.match(/Subtext[:\s]+([^\n\r]+)/i);

    const dramaticMeta: import('../types/domain').StoryDramaticMeta = {};
    if (incitingMatch) dramaticMeta.incitingIncident = incitingMatch[1].trim();
    if (climaxMatch) dramaticMeta.climax = climaxMatch[1].trim();
    if (subtextMatch) dramaticMeta.subtext = subtextMatch[1].trim();

    return {
      type: 'append_acts',
      acts: [
        {
          id: `act-${crypto.randomUUID()}`,
          title: actTitle,
          summary: summaryMatch ? summaryMatch[1].trim() : 'Act outline generated by Qwen Co-Pilot.',
          orderIndex: 0,
          sequences: [],
          dramaticMeta: Object.keys(dramaticMeta).length > 0 ? dramaticMeta : undefined,
        },
      ],
    };
  }

  return null;
}

export function applyQwenStoryPatch(story: Story, action: QwenStoryPatchAction): Story {
  let updated: Story = { ...story };

  switch (action.type) {
    case 'update_pitch': {
      const { title, author, tags, ...rest } = action.fields;
      updated = {
        ...updated,
        ...rest,
        title: title !== undefined ? (title.trim() || updated.title || 'Untitled Story') : updated.title,
        author: author !== undefined ? author : updated.author,
        tags: tags !== undefined ? tags : updated.tags,
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    case 'update_story_fields': {
      const { fields } = action;
      const updatedFields: Partial<Story> = {};
      if (fields.title !== undefined) {
        updatedFields.title = fields.title.trim() || updated.title || 'Untitled Story';
      }
      if (fields.author !== undefined) updatedFields.author = fields.author;
      if (fields.tags !== undefined) updatedFields.tags = fields.tags;
      if (fields.logline !== undefined) updatedFields.logline = fields.logline;
      if (fields.premise !== undefined) updatedFields.premise = fields.premise;
      if (fields.synopsis !== undefined) updatedFields.synopsis = fields.synopsis;
      if (fields.treatment !== undefined) updatedFields.treatment = fields.treatment;
      if (fields.fullBookText !== undefined) {
        if (fields.bookTextMode === 'replace') {
          updatedFields.fullBookText = fields.fullBookText;
        } else {
          const existing = (updated.fullBookText || '').trim();
          const separator = existing ? '\n\n' : '';
          updatedFields.fullBookText = existing + separator + fields.fullBookText.trim();
        }
      }

      updated = {
        ...updated,
        ...updatedFields,
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    case 'create_story': {
      const initial = action.initialFields;
      updated = {
        ...updated,
        id: `story-${crypto.randomUUID()}`,
        title: initial.title?.trim() || 'Untitled Story',
        author: initial.author || 'Anonymous',
        tags: initial.tags || [],
        logline: initial.logline || '',
        premise: initial.premise || '',
        synopsis: initial.synopsis || '',
        treatment: initial.treatment || '',
        fullBookText: initial.fullBookText || '',
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    case 'append_acts': {
      const currentActs = [...(updated.acts || [])];
      let nextIndex = currentActs.length;
      const newActs: StoryAct[] = action.acts.map((a) => ({
        ...a,
        id: a.id || `act-${crypto.randomUUID()}`,
        orderIndex: nextIndex++,
        sequences: a.sequences || [],
      }));
      updated = {
        ...updated,
        acts: [...currentActs, ...newActs],
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    case 'append_sequences': {
      const currentActs = [...(updated.acts || [])];
      const actIdx = currentActs.findIndex((a) => a.id === action.actId);
      if (actIdx === -1) {
        throw new Error(`Target act '${action.actId}' not found.`);
      }
      const targetAct = currentActs[actIdx];
      const currentSeqs = [...(targetAct.sequences || [])];
      let nextIndex = currentSeqs.length;
      const newSeqs: StorySequence[] = action.sequences.map((s) => ({
        ...s,
        id: s.id || `seq-${crypto.randomUUID()}`,
        orderIndex: nextIndex++,
        scenes: s.scenes || [],
      }));

      currentActs[actIdx] = {
        ...targetAct,
        sequences: [...currentSeqs, ...newSeqs],
      };
      updated = {
        ...updated,
        acts: currentActs,
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    case 'append_scenes': {
      const currentActs = [...(updated.acts || [])];
      const actIdx = currentActs.findIndex((a) => a.id === action.actId);
      if (actIdx === -1) {
        throw new Error(`Target act '${action.actId}' not found.`);
      }
      const targetAct = currentActs[actIdx];
      const seqIdx = targetAct.sequences.findIndex((s) => s.id === action.sequenceId);
      if (seqIdx === -1) {
        throw new Error(`Target sequence '${action.sequenceId}' not found.`);
      }
      const targetSeq = targetAct.sequences[seqIdx];
      const currentScenes = [...(targetSeq.scenes || [])];
      let nextIndex = currentScenes.length;
      const newScenes: StorySceneNode[] = action.scenes.map((sc) => ({
        ...sc,
        id: sc.id || `scene-${crypto.randomUUID()}`,
        orderIndex: nextIndex++,
        beats: sc.beats || [],
      }));

      const updatedSeqs = [...targetAct.sequences];
      updatedSeqs[seqIdx] = {
        ...targetSeq,
        scenes: [...currentScenes, ...newScenes],
      };

      currentActs[actIdx] = {
        ...targetAct,
        sequences: updatedSeqs,
      };

      updated = {
        ...updated,
        acts: currentActs,
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    case 'append_beats': {
      const currentActs = [...(updated.acts || [])];
      const actIdx = currentActs.findIndex((a) => a.id === action.actId);
      if (actIdx === -1) throw new Error(`Target act '${action.actId}' not found.`);
      const targetAct = currentActs[actIdx];
      const seqIdx = targetAct.sequences.findIndex((s) => s.id === action.sequenceId);
      if (seqIdx === -1) throw new Error(`Target sequence '${action.sequenceId}' not found.`);
      const targetSeq = targetAct.sequences[seqIdx];
      const scIdx = targetSeq.scenes.findIndex((sc) => sc.id === action.sceneId);
      if (scIdx === -1) throw new Error(`Target scene '${action.sceneId}' not found.`);
      const targetScene = targetSeq.scenes[scIdx];

      const currentBeats = [...(targetScene.beats || [])];
      let nextIndex = currentBeats.length;
      const newBeats: StoryBeat[] = action.beats.map((b) => ({
        ...b,
        id: b.id || `beat-${crypto.randomUUID()}`,
        orderIndex: nextIndex++,
      }));

      const updatedScenes = [...targetSeq.scenes];
      updatedScenes[scIdx] = {
        ...targetScene,
        beats: [...currentBeats, ...newBeats],
      };

      const updatedSeqs = [...targetAct.sequences];
      updatedSeqs[seqIdx] = {
        ...targetSeq,
        scenes: updatedScenes,
      };

      currentActs[actIdx] = {
        ...targetAct,
        sequences: updatedSeqs,
      };

      updated = {
        ...updated,
        acts: currentActs,
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    case 'update_dramatic_meta': {
      const { target, dramaticMeta } = action;
      const currentActs = [...(updated.acts || [])];
      const actIdx = currentActs.findIndex((a) => a.id === target.actId);
      if (actIdx !== -1) {
        const targetAct = currentActs[actIdx];
        if (target.sequenceId) {
          const seqIdx = targetAct.sequences.findIndex((s) => s.id === target.sequenceId);
          if (seqIdx !== -1) {
            const targetSeq = targetAct.sequences[seqIdx];
            if (target.sceneId) {
              const scIdx = targetSeq.scenes.findIndex((sc) => sc.id === target.sceneId);
              if (scIdx !== -1) {
                const targetScene = targetSeq.scenes[scIdx];
                if (target.beatId) {
                  const bIdx = targetScene.beats?.findIndex((b) => b.id === target.beatId);
                  if (bIdx !== -1 && targetScene.beats) {
                    targetScene.beats[bIdx] = {
                      ...targetScene.beats[bIdx],
                      dramaticMeta: { ...(targetScene.beats[bIdx].dramaticMeta || {}), ...dramaticMeta },
                    };
                  }
                } else {
                  targetScene.dramaticMeta = {
                    ...(targetScene.dramaticMeta || {}),
                    ...dramaticMeta,
                  };
                }
              }
            } else {
              targetSeq.dramaticMeta = {
                ...(targetSeq.dramaticMeta || {}),
                ...dramaticMeta,
              };
            }
          }
        } else {
          targetAct.dramaticMeta = {
            ...(targetAct.dramaticMeta || {}),
            ...dramaticMeta,
          };
        }
      }

      updated = {
        ...updated,
        acts: currentActs,
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    case 'append_book_text': {
      if (action.mode === 'replace') {
        updated = {
          ...updated,
          fullBookText: action.text,
          updatedAt: new Date().toISOString(),
        };
      } else {
        const existing = (updated.fullBookText || '').trim();
        const separator = existing ? '\n\n' : '';
        updated = {
          ...updated,
          fullBookText: existing + separator + action.text.trim(),
          updatedAt: new Date().toISOString(),
        };
      }
      break;
    }
  }

  // Validate the resulting story against domain requirements
  validateStoryInput(updated);
  return updated;
}
