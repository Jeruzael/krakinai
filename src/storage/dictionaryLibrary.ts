import type { DictionaryLibraryEntry, DictionaryExportPayload } from '../types/qwen';

export const DICTIONARY_LIBRARY_STORAGE_KEY = 'krakinai.qwen.dictionary_library.v1';

export function normalizeDictionaryWordKey(word: string): string {
  if (!word) return '';
  return word.trim().toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
}

export function loadDictionaryLibrary(): Record<string, DictionaryLibraryEntry> {
  if (typeof localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = localStorage.getItem(DICTIONARY_LIBRARY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, DictionaryLibraryEntry>;
    }
    return {};
  } catch (err) {
    console.warn('[DictionaryLibrary] Failed to load dictionary library from storage:', err);
    return {};
  }
}

export function saveDictionaryLibrary(library: Record<string, DictionaryLibraryEntry>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DICTIONARY_LIBRARY_STORAGE_KEY, JSON.stringify(library));
  } catch (err) {
    console.warn('[DictionaryLibrary] Failed to save dictionary library:', err);
  }
}

export function findInDictionaryLibrary(word: string): DictionaryLibraryEntry | null {
  const key = normalizeDictionaryWordKey(word);
  if (!key) return null;

  const library = loadDictionaryLibrary();
  const entry = library[key];
  if (!entry) return null;

  // Update hitCount and lastAccessedAt
  entry.hitCount = (entry.hitCount || 0) + 1;
  entry.lastAccessedAt = Date.now();
  library[key] = entry;
  saveDictionaryLibrary(library);

  return entry;
}

export function saveToDictionaryLibrary(
  entry: Omit<DictionaryLibraryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'hitCount'> &
    Partial<Pick<DictionaryLibraryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'hitCount'>>
): DictionaryLibraryEntry {
  const key = normalizeDictionaryWordKey(entry.word);
  if (!key) {
    throw new Error('Cannot save empty word to dictionary library.');
  }

  const library = loadDictionaryLibrary();
  const existing = library[key];
  const now = Date.now();

  const fullEntry: DictionaryLibraryEntry = {
    ...entry,
    id: key,
    createdAt: existing?.createdAt || entry.createdAt || now,
    lastAccessedAt: now,
    hitCount: (existing?.hitCount || 0) + 1,
  };

  library[key] = fullEntry;
  saveDictionaryLibrary(library);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('krakinai:dictionary-library-updated'));
  }

  return fullEntry;
}

export function removeWordFromDictionaryLibrary(word: string): boolean {
  const key = normalizeDictionaryWordKey(word);
  if (!key) return false;

  const library = loadDictionaryLibrary();
  if (!library[key]) return false;

  delete library[key];
  saveDictionaryLibrary(library);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('krakinai:dictionary-library-updated'));
  }

  return true;
}

export function clearDictionaryLibrary(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(DICTIONARY_LIBRARY_STORAGE_KEY);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('krakinai:dictionary-library-updated'));
  }
}

export function getDictionaryLibraryStats(): {
  totalEntries: number;
  totalHits: number;
  entries: DictionaryLibraryEntry[];
} {
  const library = loadDictionaryLibrary();
  const entries = Object.values(library).sort(
    (a, b) => (b.lastAccessedAt || b.createdAt || 0) - (a.lastAccessedAt || a.createdAt || 0)
  );
  const totalEntries = entries.length;
  const totalHits = entries.reduce((acc, curr) => acc + (curr.hitCount || 0), 0);
  return { totalEntries, totalHits, entries };
}

export function generateDictionaryJson(library?: Record<string, DictionaryLibraryEntry>): string {
  const lib = library || loadDictionaryLibrary();
  const entries = Object.values(lib);
  const payload: DictionaryExportPayload = {
    format: 'krakinai.qwen.dictionary',
    version: 1,
    exportedAt: new Date().toISOString(),
    totalEntries: entries.length,
    entries: lib,
  };
  return JSON.stringify(payload, null, 2);
}

export function generateDictionaryMarkdown(library?: Record<string, DictionaryLibraryEntry>): string {
  const lib = library || loadDictionaryLibrary();
  const sorted = Object.values(lib).sort((a, b) => a.word.localeCompare(b.word));
  const dateStr = new Date().toISOString().slice(0, 10);

  const lines: string[] = [
    '# 📖 KRAKINAI Story Manuscript Lexicon',
    `*Exported on ${dateStr} • ${sorted.length} defined terms*`,
    '',
    '---',
    '',
  ];

  if (sorted.length === 0) {
    lines.push('_No words currently saved in dictionary library._');
    return lines.join('\n');
  }

  for (const entry of sorted) {
    lines.push(`### **${entry.word}** *(${entry.partOfSpeech || 'word'})*`);
    lines.push(`- **Definition:** ${entry.definition || '—'}`);
    if (entry.contextualMeaning) {
      lines.push(`- **Scene Nuance:** ${entry.contextualMeaning}`);
    }
    if (entry.examples && entry.examples.length > 0) {
      lines.push('- **Literary Examples:**');
      for (const ex of entry.examples) {
        lines.push(`  - *"${ex}"*`);
      }
    }
    if (entry.synonyms && entry.synonyms.length > 0) {
      const synTags = entry.synonyms.map((s) => `\`${s}\``).join(', ');
      lines.push(`- **Synonyms:** ${synTags}`);
    }
    const hits = entry.hitCount || 1;
    lines.push(`- **Lookups:** ${hits} instant cache hit${hits === 1 ? '' : 's'}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadFile(filename: string, content: string, mimeType: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportDictionaryAsJson(): void {
  const json = generateDictionaryJson();
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadFile(`krakinai-dictionary-${dateStr}.json`, json, 'application/json');
}

export function exportDictionaryAsMarkdown(): void {
  const md = generateDictionaryMarkdown();
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadFile(`krakinai-dictionary-glossary-${dateStr}.md`, md, 'text/markdown');
}

export function importDictionaryFromJson(
  rawJson: string,
  mode: 'merge' | 'replace' = 'merge'
): { importedCount: number; skippedCount: number } {
  if (!rawJson || typeof rawJson !== 'string') {
    throw new Error('Invalid dictionary payload: empty string.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new Error(`Failed to parse dictionary JSON: ${(err as Error).message}`);
  }

  let candidateEntries: Record<string, any>;
  if (parsed && parsed.format === 'krakinai.qwen.dictionary' && parsed.entries && typeof parsed.entries === 'object') {
    candidateEntries = parsed.entries;
  } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const values = Object.values(parsed);
    const isValidMap =
      values.length > 0 &&
      values.every((v: any) => v && typeof v === 'object' && typeof v.word === 'string' && typeof v.definition === 'string');
    if (isValidMap) {
      candidateEntries = parsed;
    } else {
      throw new Error('Invalid dictionary payload: unrecognized structure.');
    }
  } else {
    throw new Error('Invalid dictionary payload: must be a valid JSON dictionary export.');
  }

  const existing = mode === 'replace' ? {} : loadDictionaryLibrary();
  let importedCount = 0;
  let skippedCount = 0;

  for (const [key, rawEntry] of Object.entries(candidateEntries)) {
    if (!rawEntry || typeof rawEntry !== 'object' || !rawEntry.word || !rawEntry.definition) {
      skippedCount++;
      continue;
    }

    const normKey = normalizeDictionaryWordKey(rawEntry.word || key);
    if (!normKey) {
      skippedCount++;
      continue;
    }

    const prev = existing[normKey];
    const merged: DictionaryLibraryEntry = {
      id: normKey,
      word: rawEntry.word.trim(),
      partOfSpeech: rawEntry.partOfSpeech || prev?.partOfSpeech || 'unknown',
      definition: rawEntry.definition || prev?.definition || '',
      contextualMeaning: rawEntry.contextualMeaning || prev?.contextualMeaning,
      examples: Array.isArray(rawEntry.examples)
        ? rawEntry.examples
        : prev?.examples || [],
      synonyms: Array.isArray(rawEntry.synonyms)
        ? rawEntry.synonyms
        : prev?.synonyms || [],
      tokenCost: rawEntry.tokenCost || prev?.tokenCost,
      detailLevel: rawEntry.detailLevel || prev?.detailLevel || 'full_with_context',
      createdAt: prev?.createdAt || rawEntry.createdAt || Date.now(),
      lastAccessedAt: Math.max(prev?.lastAccessedAt || 0, rawEntry.lastAccessedAt || Date.now()),
      hitCount: (prev?.hitCount || 0) + (rawEntry.hitCount || 1),
    };

    existing[normKey] = merged;
    importedCount++;
  }

  saveDictionaryLibrary(existing);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('krakinai:dictionary-library-updated'));
  }

  return { importedCount, skippedCount };
}
