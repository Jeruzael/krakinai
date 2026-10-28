import { expect, it } from 'vitest';
import { assembleScenePrompt } from '../domain/promptAssembler';
import { serializeSceneJson } from '../domain/sceneDocument';
import { serializeGenerationJson } from '../domain/generationDocument';
import { formatGenerationText } from '../domain/exportPresets';
import { legacyDraft, legacyScene } from './fixtures/legacyScene';

// Frozen before Shot Type implementation on master 8d2d145; synthetic records.
it('preserves the exact legacy draft/saved bytes across every output contract', async () => {
  const hashes = await Promise.all([legacyDraft, legacyScene].map(async source => {
    const assembled = assembleScenePrompt(source as typeof legacyDraft);
    const outputs = { ...assembled.outputs, project: serializeSceneJson(source),
      generation: serializeGenerationJson(source),
      generic: formatGenerationText(source, 'generic_structured'),
      provider: formatGenerationText(source, 'gemini_omni_flash'),
      custom: formatGenerationText(source, 'custom') };
    return Object.fromEntries(await Promise.all(Object.entries(outputs).map(async ([key, value]) =>
      [key,Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('')])));
  }));
  expect(hashes).toMatchSnapshot();
});
