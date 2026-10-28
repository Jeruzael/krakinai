export interface PromptSection {
  id: string;
  title: string;
  lineIndex: number;
  start: number;
  end: number;
}

// Navigation recognizes explicit exporter boundaries, never labels inside prose.
const TITLES = new Set([
  'scene overview',
  'overview',
  'character',
  'character identity',
  'clothing',
  'clothing / outfit',
  'wardrobe & accessories',
  'environment',
  'environment / location',
  'action',
  'action & performance',
  'camera',
  'camera & cinematography',
  'lighting',
  'lighting & atmosphere',
  'style',
  'visual style',
  'dialogue',
  'spoken dialogue script',
  'instructions',
  'additional scene instructions',
  'original source media',
  'animation instructions',
  'editing instructions',
  'tool / provider notes',
  'negative instructions',
  'reference checklist — attach files separately',
]);

/** Offsets point into the original string; no text is rewritten or truncated. */
export function indexPromptSections(text: string): PromptSection[] {
  const boundaries: Omit<PromptSection, 'id' | 'end'>[] = [];
  // JSON is deliberately a complete raw view, including heading-looking strings.
  const possibleJson = text.trimStart();
  if (!possibleJson.startsWith('{') && !possibleJson.startsWith('[')) {
    let offset = 0;
    text.split('\n').forEach((line, lineIndex) => {
      const heading = /^(?:===\s+(.+?)\s+===|#{1,3}\s+(.+?))\s*\r?$/.exec(line);
      const title = heading?.[1] ?? heading?.[2];
      if (title && TITLES.has(title.toLowerCase())) {
        boundaries.push({ title, lineIndex, start: offset });
      }
      offset += line.length + 1;
    });
  }
  if (!boundaries.length || boundaries[0].start > 0) {
    boundaries.unshift({ title: 'Full Prompt', lineIndex: 0, start: 0 });
  }
  return boundaries.map((section, index) => ({
    ...section,
    id: `prompt-section-${index}`,
    end: boundaries[index + 1]?.start ?? text.length,
  }));
}
