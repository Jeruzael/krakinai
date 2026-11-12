import type {
  QwenHardwareSettings,
  QwenLiveSettings,
  QwenServerStatus,
  QwenProcessMetrics,
  WordDefinitionResult,
  QwenDictionarySettings,
  QwenGenerationTelemetry,
} from '../types/qwen';
import { findInDictionaryLibrary, saveToDictionaryLibrary } from '../storage/dictionaryLibrary';

export type { WordDefinitionResult } from '../types/qwen';

export interface SplitThinkResult {
  thinking: string;
  answer: string;
  isThinking: boolean;
}

export function splitThinkContent(raw: string): SplitThinkResult {
  if (!raw) {
    return { thinking: '', answer: '', isThinking: false };
  }

  const thinkTags = [
    { open: '<think>', close: '</think>' },
    { open: '<thought>', close: '</thought>' },
    { open: '<reasoning>', close: '</reasoning>' },
  ];

  for (const tag of thinkTags) {
    const startIdx = raw.indexOf(tag.open);
    if (startIdx !== -1) {
      const endIdx = raw.indexOf(tag.close);
      if (endIdx !== -1) {
        const thinking = raw.slice(startIdx + tag.open.length, endIdx).trim();
        const answer = (raw.slice(0, startIdx) + raw.slice(endIdx + tag.close.length)).trim();
        return { thinking, answer, isThinking: false };
      } else {
        const thinking = raw.slice(startIdx + tag.open.length).trim();
        const answer = raw.slice(0, startIdx).trim();
        return { thinking, answer, isThinking: true };
      }
    }
  }

  return { thinking: '', answer: raw.trim(), isThinking: false };
}

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessageItem {
  role: ChatRole;
  content: string;
}

/**
 * Normalizes chat messages for ChatML / Jinja template compatibility (Qwen 3.5 & llama.cpp):
 * 1. Combines all system messages into a single system message positioned strictly at index 0.
 * 2. Preserves the chronological order of user and assistant dialogue.
 * 3. Prevents "Jinja Exception: System message must be at the beginning" (HTTP 500)
 *    when system messages or schema instructions are placed after user inputs.
 */
export function normalizeChatMessages(
  messages: Array<ChatMessageItem>
): Array<ChatMessageItem> {
  const systemInstructions: string[] = [];
  const dialogue: ChatMessageItem[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      const trimmed = msg.content ? msg.content.trim() : '';
      if (trimmed) {
        systemInstructions.push(trimmed);
      }
    } else {
      dialogue.push(msg);
    }
  }

  const result: ChatMessageItem[] = [];
  if (systemInstructions.length > 0) {
    result.push({
      role: 'system',
      content: systemInstructions.join('\n\n'),
    });
  }

  result.push(...dialogue);
  return result;
}

let activeAbortController: AbortController | null = null;

export async function getQwenStatus(): Promise<QwenServerStatus> {
  const res = await fetch('/api/qwen/control/status');
  if (!res.ok) {
    throw new Error(`Failed to get Qwen status: HTTP ${res.status}`);
  }
  return res.json();
}

export async function getQwenProcessMetrics(): Promise<QwenProcessMetrics> {
  const res = await fetch('/api/qwen/control/metrics');
  if (!res.ok) {
    throw new Error(`Failed to get Qwen metrics: HTTP ${res.status}`);
  }
  return res.json();
}

export async function startQwen(hardware?: QwenHardwareSettings): Promise<QwenServerStatus> {
  const res = await fetch('/api/qwen/control/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hardware }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to start Qwen: HTTP ${res.status}`);
  }
  return res.json();
}

export async function stopQwen(): Promise<QwenServerStatus> {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
  const res = await fetch('/api/qwen/control/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to stop Qwen: HTTP ${res.status}`);
  }
  return res.json();
}

export async function restartQwen(hardware?: QwenHardwareSettings): Promise<QwenServerStatus> {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
  const res = await fetch('/api/qwen/control/restart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hardware }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to restart Qwen: HTTP ${res.status}`);
  }
  return res.json();
}

export interface StreamDeltaCallbackParams {
  delta: string;
  accumulatedText: string;
  thinking: string;
  answer: string;
  isThinking: boolean;
  finishReason?: 'generating' | 'stop' | 'length' | 'aborted' | 'error' | null;
  ttftMs?: number | null;
}

export async function streamChatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  settings: QwenLiveSettings,
  onDelta?: (params: StreamDeltaCallbackParams) => void,
  externalSignal?: AbortSignal
): Promise<{
  fullText: string;
  thinking: string;
  answer: string;
  finishReason: 'stop' | 'length' | 'aborted' | 'error' | null;
  ttftMs: number | null;
}> {
  // Abort any previous active stream (enforces -np 1 mutex)
  if (activeAbortController) {
    activeAbortController.abort();
  }
  const localController = new AbortController();
  activeAbortController = localController;

  const handleExternalAbort = () => localController.abort();
  if (externalSignal) {
    externalSignal.addEventListener('abort', handleExternalAbort, { once: true });
  }

  let fullText = '';
  let finishReason: 'stop' | 'length' | 'aborted' | 'error' | null = null;
  const requestStartTime = performance.now();
  let firstTokenTime: number | null = null;

  try {
    const normalizedMessages = normalizeChatMessages(messages);

    const res = await fetch('/api/qwen/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: localController.signal,
      body: JSON.stringify({
        messages: normalizedMessages,
        temperature: settings.temperature,
        top_p: settings.topP,
        max_tokens: settings.maxTokens,
        stream: true,
      }),
    });

    if (!res.ok) {
      finishReason = 'error';
      const errText = await res.text();
      throw new Error(`Inference error: HTTP ${res.status} - ${errText}`);
    }

    if (!res.body) {
      finishReason = 'error';
      throw new Error('Response body is null.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed === 'data: [DONE]') {
          if (!finishReason) finishReason = 'stop';
          break;
        }

        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const choice = parsed.choices?.[0];
            const delta = choice?.delta?.content || '';

            if (choice?.finish_reason) {
              if (choice.finish_reason === 'length') {
                finishReason = 'length';
              } else if (choice.finish_reason === 'stop') {
                finishReason = 'stop';
              }
            }

            if (delta) {
              if (firstTokenTime === null) {
                firstTokenTime = performance.now();
              }
              fullText += delta;
              const split = splitThinkContent(fullText);
              const currentTtft = firstTokenTime !== null ? Math.round(firstTokenTime - requestStartTime) : null;
              onDelta?.({
                delta,
                accumulatedText: fullText,
                thinking: split.thinking,
                answer: split.answer,
                isThinking: split.isThinking,
                finishReason: finishReason || 'generating',
                ttftMs: currentTtft,
              });
            }
          } catch {
            // ignore malformed SSE line
          }
        }
      }
    }
  } catch (err: unknown) {
    if (localController.signal.aborted || (externalSignal && externalSignal.aborted)) {
      finishReason = 'aborted';
    } else {
      finishReason = 'error';
    }
    throw err;
  } finally {
    if (activeAbortController === localController) {
      activeAbortController = null;
    }
    if (externalSignal) {
      externalSignal.removeEventListener('abort', handleExternalAbort);
    }
  }

  if (!finishReason) {
    finishReason = 'stop';
  }

  const finalTtft = firstTokenTime !== null ? Math.round(firstTokenTime - requestStartTime) : null;
  const finalSplit = splitThinkContent(fullText);
  return {
    fullText,
    thinking: finalSplit.thinking,
    answer: finalSplit.answer || (finalSplit.thinking ? '' : fullText),
    finishReason,
    ttftMs: finalTtft,
  };
}

export function repairTruncatedJsonString(input: string): string | null {
  if (!input) return null;
  const firstBrace = input.indexOf('{');
  if (firstBrace === -1) return null;

  let text = input.slice(firstBrace).trim();

  // If there's an odd number of unescaped quotes, close the open string
  const quotesCount = (text.match(/(?<!\\)"/g) || []).length;
  if (quotesCount % 2 !== 0) {
    text += '"';
  }

  // Strip trailing dangling keys or separators like `, "foo": ` or `, `
  text = text.replace(/,\s*"[^"]*"\s*:\s*"?$/, '');
  text = text.replace(/,\s*$/, '');

  // Balance brackets '[' and ']'
  const openBrackets = (text.match(/\[/g) || []).length;
  const closeBrackets = (text.match(/\]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    text += ']';
  }

  // Balance braces '{' and '}'
  const openBraces = (text.match(/\{/g) || []).length;
  const closeBraces = (text.match(/\}/g) || []).length;
  for (let i = 0; i < openBraces - closeBraces; i++) {
    text += '}';
  }

  return text;
}

export function recoverFieldsFromBrokenJson<T>(
  raw: string,
  fallback?: Partial<T>
): Partial<T> | null {
  if (!raw) return null;
  const result: Record<string, unknown> = { ...(fallback || {}) };

  // word
  const wordMatch = raw.match(/"word"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
  if (wordMatch) result.word = wordMatch[1];

  // partOfSpeech
  const posMatch = raw.match(/"partOfSpeech"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
  if (posMatch) result.partOfSpeech = posMatch[1];

  // definition (supports truncated definition too)
  const defMatch =
    raw.match(/"definition"\s*:\s*"((?:[^"\\]|\\.)*)"/i) ||
    raw.match(/"definition"\s*:\s*"([^"\n]+)/i);
  if (defMatch) {
    result.definition = defMatch[1];
  } else {
    // Plain text definition fallback
    const plainDefMatch =
      raw.match(/(?:definition|meaning)[:\s]+([^\n\r]+)/i) ||
      raw.match(/(?:^[A-Za-z]+|\b[A-Za-z]+)\s*[:–-]\s*(?:\([a-z]+\)|[a-z]+\.)?\s*([^\n\r]+)/i);
    if (plainDefMatch && plainDefMatch[1]) {
      result.definition = plainDefMatch[1].trim();
    }
  }

  // partOfSpeech fallback
  if (!posMatch) {
    const plainPosMatch = raw.match(/\b(noun|verb|adjective|adverb|pronoun|preposition|conjunction)\b/i);
    if (plainPosMatch) {
      result.partOfSpeech = plainPosMatch[1].toLowerCase();
    }
  }

  // contextualMeaning
  const ctxMatch =
    raw.match(/"contextualMeaning"\s*:\s*"((?:[^"\\]|\\.)*)"/i) ||
    raw.match(/"contextualMeaning"\s*:\s*"([^"\n]+)/i);
  if (ctxMatch) {
    result.contextualMeaning = ctxMatch[1];
  } else {
    const plainCtxMatch = raw.match(/(?:scene nuance|contextual meaning|context)[:\s]+([^\n\r]+)/i);
    if (plainCtxMatch) {
      result.contextualMeaning = plainCtxMatch[1].trim();
    }
  }

  // examples array
  const examplesBlock = raw.match(/"examples"\s*:\s*\[([\s\S]*?)\]/i);
  if (examplesBlock) {
    const items = [...examplesBlock[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
    if (items.length > 0) result.examples = items;
  } else {
    const plainExMatches = [...raw.matchAll(/(?:example[s]?|usage)[:\s]*"([^"\\]+)"/gi)].map((m) => m[1]);
    if (plainExMatches.length > 0) {
      result.examples = plainExMatches;
    }
  }

  // synonyms array
  const synonymsBlock = raw.match(/"synonyms"\s*:\s*\[([\s\S]*?)\]/i);
  if (synonymsBlock) {
    const items = [...synonymsBlock[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
    if (items.length > 0) result.synonyms = items;
  }

  if (result.word || result.definition) {
    return result as Partial<T>;
  }

  return null;
}

export function safeParseStructuredJson<T>(
  rawText: string,
  fallbackDefaults?: Partial<T>
): T {
  if (!rawText || typeof rawText !== 'string') {
    if (fallbackDefaults) return fallbackDefaults as T;
    throw new Error('Empty model output for structured JSON parsing.');
  }

  // 1. Direct parse attempt
  try {
    return JSON.parse(rawText.trim()) as T;
  } catch {
    // Continue to robust extraction
  }

  // 2. Extract block within markdown code fences
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : rawText.trim();

  // 3. Find first '{' and last '}'
  const firstBrace = candidate.indexOf('{');
  if (firstBrace !== -1) {
    const lastBrace = candidate.lastIndexOf('}');
    if (lastBrace > firstBrace) {
      const sliceCandidate = candidate.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(sliceCandidate) as T;
      } catch {
        // Fall through to repair
      }
    }
  }

  // 4. Truncation Repair: Clean up unclosed strings, dangling keys, arrays, and braces
  const repaired = repairTruncatedJsonString(candidate);
  if (repaired) {
    try {
      return JSON.parse(repaired) as T;
    } catch {
      // Fall through to regex extraction
    }
  }

  // 5. Regex Field Recovery for dictionary/structured objects
  const regexRecovered = recoverFieldsFromBrokenJson(candidate, fallbackDefaults);
  if (regexRecovered) {
    return regexRecovered as T;
  }

  if (fallbackDefaults) {
    return fallbackDefaults as T;
  }

  throw new Error('Failed to parse structured JSON from model response.');
}

export function dispatchTelemetryUpdate(detail: Partial<QwenGenerationTelemetry>): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('krakinai:telemetry-update', { detail }));
  }
}

export async function generateStructuredJson<T>(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  schema: Record<string, unknown>,
  settings: QwenLiveSettings,
  signal?: AbortSignal,
  fallbackDefaults?: Partial<T>,
  onDelta?: (params: StreamDeltaCallbackParams) => void
): Promise<T> {
  const schemaInstruction = `You MUST return raw valid JSON matching the schema below. Do not wrap in markdown code fences.\nDo NOT output a <think> reasoning block. Respond with the raw JSON object directly.\nSchema: ${JSON.stringify(
    schema
  )}`;

  const combinedMessages = normalizeChatMessages([
    { role: 'system', content: schemaInstruction },
    ...messages,
  ]);

  const result = await streamChatCompletion(
    combinedMessages,
    {
      ...settings,
      temperature: Math.min(settings.temperature, 0.3), // Lower temp for deterministic structured outputs
    },
    onDelta,
    signal
  );

  const rawTextToParse = result.answer.trim() || result.fullText.trim();
  return safeParseStructuredJson<T>(rawTextToParse, fallbackDefaults);
}

export async function lookupWordDefinition(
  word: string,
  contextSentence: string,
  settings: QwenLiveSettings,
  signal?: AbortSignal,
  dictSettings?: Partial<QwenDictionarySettings>
): Promise<WordDefinitionResult> {
  const cleanWord = word.trim();
  const cacheEnabled = dictSettings?.cacheEnabled !== false;

  // 1. Check persistent dictionary library first
  if (cacheEnabled) {
    const cachedEntry = findInDictionaryLibrary(cleanWord);
    if (cachedEntry) {
      return {
        word: cachedEntry.word,
        partOfSpeech: cachedEntry.partOfSpeech,
        definition: cachedEntry.definition,
        contextualMeaning: cachedEntry.contextualMeaning,
        examples: cachedEntry.examples || [],
        synonyms: cachedEntry.synonyms || [],
        tokenCost: cachedEntry.tokenCost || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        cached: true,
      };
    }
  }

  const detailLevel = dictSettings?.detailLevel || 'full_with_context';
  const speedPreset = dictSettings?.speedPreset || 'balanced';
  const showSynonyms = dictSettings?.showSynonyms !== false;

  // Dynamic schema & prompt tailored to detail level
  const properties: Record<string, unknown> = {
    word: { type: 'string' },
    partOfSpeech: { type: 'string' },
    definition: { type: 'string' },
  };
  const required = ['word', 'partOfSpeech', 'definition'];
  let systemPrompt =
    'You are an expert literary editor and lexicographer. Define the given word accurately with its part of speech and a concise definition. Do NOT output a <think> reasoning block. Return raw valid JSON matching the schema directly.';

  if (detailLevel === 'definition_examples') {
    properties.examples = { type: 'array', items: { type: 'string' } };
    required.push('examples');
    systemPrompt =
      'You are an expert literary editor and lexicographer. Define the given word accurately with its part of speech, a concise definition, and exactly 2 high-quality literary example sentences showing expressive usage. Do NOT output a <think> reasoning block. Return raw valid JSON matching the schema directly.';
  } else if (detailLevel === 'full_with_context') {
    properties.contextualMeaning = { type: 'string' };
    properties.examples = { type: 'array', items: { type: 'string' } };
    required.push('examples');
    if (showSynonyms) {
      properties.synonyms = { type: 'array', items: { type: 'string' } };
      required.push('synonyms');
    }
    systemPrompt = `You are an expert literary editor, lexicographer, and creative writing consultant. Define the given word accurately with its part of speech, standard concise definition, contextual meaning in the provided scene context, ${
      showSynonyms ? 'up to 4 synonyms, ' : ''
    }and exactly 2 high-quality literary example sentences showing expressive usage. Do NOT output a <think> reasoning block. Return raw valid JSON matching the schema directly.`;
  }

  const schema = {
    type: 'object',
    properties,
    required,
  };

  const userPrompt = `Word: "${cleanWord}"\nSentence context: "${contextSentence || ''}"`;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  // Adjust live settings for speed preset with sufficient headroom for thinking + schema tokens
  let adjustedTemp = 0.2;
  let adjustedMaxTokens = 512;
  if (speedPreset === 'fast') {
    adjustedTemp = 0.1;
    adjustedMaxTokens = 400;
  } else if (speedPreset === 'detailed') {
    adjustedTemp = 0.35;
    adjustedMaxTokens = 768;
  }

  const effectiveSettings: QwenLiveSettings = {
    ...settings,
    temperature: adjustedTemp,
    maxTokens: adjustedMaxTokens,
  };

  const promptChars = systemPrompt.length + userPrompt.length + JSON.stringify(schema).length;
  const promptTokens = Math.ceil(promptChars / 3.8);

  const fallbackDefaults: Partial<WordDefinitionResult> = {
    word: cleanWord,
    partOfSpeech: 'unknown',
    definition: `Lexical definition for "${cleanWord}".`,
    contextualMeaning: contextSentence ? `Used in scene context: "${contextSentence.slice(0, 80)}..."` : undefined,
    examples: [],
    synonyms: [],
  };

  const startTime = performance.now();
  dispatchTelemetryUpdate({
    isGenerating: true,
    taskName: `Dictionary: "${cleanWord}"`,
    thinkingTokens: 0,
    answerTokens: 0,
    generatedTokens: 0,
    currentSpeedTokPerSec: 0,
    ttftMs: null,
  });

  let rawResult: WordDefinitionResult;
  try {
    rawResult = await generateStructuredJson<WordDefinitionResult>(
      messages,
      schema,
      effectiveSettings,
      signal,
      fallbackDefaults,
      (deltaParams) => {
        const elapsed = (performance.now() - startTime) / 1000;
        const currentTokens = Math.ceil(deltaParams.accumulatedText.length / 3.8);
        const speed = elapsed > 0 ? Math.round((currentTokens / elapsed) * 10) / 10 : 0;
        dispatchTelemetryUpdate({
          isGenerating: true,
          taskName: `Dictionary: "${cleanWord}"`,
          currentSpeedTokPerSec: speed,
          ttftMs: deltaParams.ttftMs ?? null,
          generatedTokens: currentTokens,
          answerTokens: currentTokens,
        });
      }
    );
  } finally {
    dispatchTelemetryUpdate({
      isGenerating: false,
      currentSpeedTokPerSec: 0,
    });
  }

  const resultChars = JSON.stringify(rawResult).length;
  const completionTokens = Math.ceil(resultChars / 3.8);
  const totalTokens = promptTokens + completionTokens;

  const finalResult: WordDefinitionResult = {
    word: rawResult.word || cleanWord,
    partOfSpeech: rawResult.partOfSpeech || 'unknown',
    definition: rawResult.definition || '',
    contextualMeaning: rawResult.contextualMeaning,
    examples: rawResult.examples || [],
    synonyms: rawResult.synonyms || [],
    tokenCost: {
      promptTokens,
      completionTokens,
      totalTokens,
    },
    cached: false,
  };

  // 3. Save to local dictionary library if enabled
  if (dictSettings?.autoSaveToLibrary !== false) {
    try {
      saveToDictionaryLibrary({
        word: finalResult.word,
        partOfSpeech: finalResult.partOfSpeech,
        definition: finalResult.definition,
        contextualMeaning: finalResult.contextualMeaning,
        examples: finalResult.examples,
        synonyms: finalResult.synonyms,
        tokenCost: finalResult.tokenCost,
        detailLevel,
      });
    } catch {
      // ignore storage write errors
    }
  }

  return finalResult;
}
