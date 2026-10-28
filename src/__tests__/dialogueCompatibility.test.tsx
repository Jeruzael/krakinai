import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import {
  clearAllStoresForTesting,
  createDraftFromSavedScene,
  getAllSnapshot,
  initializeDatabase,
  loadStarterLibrary,
  replaceAllStoresTransactionally,
  savePromptAsset,
  saveSceneDraft,
  saveSceneFromDraft,
  updateSavedSceneReviewAndResults,
} from '../storage/db';
import {
  exportFullBackupZip,
  restoreFullBackupZip,
  validateBackupZip,
} from '../storage/backup';
import { serializeSceneJson } from '../domain/sceneDocument';
import { legacyDraft, legacyScene } from './fixtures/legacyScene';

beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
  await loadStarterLibrary();
});
afterEach(cleanup);

describe('Dialogue and legacy data compatibility', () => {
  it('clears dialogue independently after selecting options while preserving scene layers and instructions', async () => {
    const draft = await saveSceneDraft({
      ...legacyDraft,
      id: 'draft_clear_dialogue',
      dialogue: {
        speaker: '',
        line: '',
        mode: 'spoken',
        captionPreference: 'unspecified',
      },
    });
    window.location.hash = `#/builder/${draft.id}`;
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('button', { name: 'Assemble Prompt' });
    await user.click(screen.getByText(/^Dialogue/, { selector: 'summary' }));
    await user.click(screen.getByRole('button', { name: 'Clear Dialogue' }));
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(async () => {
      const stored = (await getAllSnapshot()).drafts.find(
        (d) => d.id === draft.id
      )!;
      expect(stored.dialogue).toBeUndefined();
      expect(stored.slots).toEqual(draft.slots);
      expect(stored.sceneInstructions).toBe(draft.sceneInstructions);
    });
  });
  it('retains mode, delivery, language, captions and exact multiline words through builder save, immutable save, and ZIP restore', async () => {
    const draft = await saveSceneDraft({
      ...legacyDraft,
      id: 'draft_dialogue_test',
    });
    window.location.hash = `#/builder/${draft.id}`;
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('button', { name: 'Assemble Prompt' });
    await user.click(screen.getByText(/^Dialogue/, { selector: 'summary' }));
    await user.selectOptions(
      screen.getByLabelText('Dialogue Mode'),
      'voiceover'
    );
    await user.click(screen.getByRole('button', { name: /^Custom Instructions/ }));
    await user.type(
      screen.getByLabelText('Custom Notes'),
      'User-entered calm delivery.'
    );
    await user.type(screen.getByLabelText('Language (Optional)'), 'Taglish');
    await user.selectOptions(screen.getByLabelText('Captions'), 'requested');
    const line = screen.getByLabelText(
      'Exact Spoken Line (Preserved verbatim)'
    );
    await user.clear(line);
    await user.type(line, "“Kumusta?”\nHello, I'm Mika! 😊");
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(async () =>
      expect(
        (await getAllSnapshot()).drafts.find((d) => d.id === draft.id)?.dialogue
      ).toEqual({
        speaker: 'Mika',
        line: "“Kumusta?”\nHello, I'm Mika! 😊",
        mode: 'voiceover',
        deliveryNotes: 'User-entered calm delivery.',
        language: 'Taglish',
        captionPreference: 'requested',
      })
    );
    cleanup();
    const saved = await saveSceneFromDraft(draft.id);
    const zip = await exportFullBackupZip();
    expect((await validateBackupZip(zip)).valid).toBe(true);
    await restoreFullBackupZip(zip);
    const restored = (await getAllSnapshot()).scenes.find(
      (s) => s.id === saved.id
    )!;
    expect(restored.dialogue).toEqual(saved.dialogue);
    expect(restored.outputs).toEqual(saved.outputs);
    expect(restored.outputs.structured).toContain('Dialogue Mode: Voiceover');
    expect(JSON.parse(serializeSceneJson(restored)).dialogue.exactLine).toBe(
      saved.dialogue!.line
    );
  });

  it('keeps legacy golden output bytes and snapshots immutable across source edits, review uploads and backup restore', async () => {
    const snap = await getAllSnapshot();
    await replaceAllStoresTransactionally({
      ...snap,
      scenes: [structuredClone(legacyScene)],
    });
    const source = snap.assets.find(
      (a) => a.id === legacyScene.slots.character!.sourceId
    )!;
    await savePromptAsset({
      ...source,
      promptText: 'A later library revision must not rewrite an old scene.',
    });
    await updateSavedSceneReviewAndResults({
      sceneId: legacyScene.id,
      reviewNotes: 'Reviewed externally.',
      reviewStatus: 'user-approved',
      resultMediaLinks: [
        {
          mediaId: snap.media[0].id,
          role: 'result',
          altText: 'Synthetic test result',
          order: 0,
        },
      ],
    });
    const json = JSON.parse(
      serializeSceneJson((await getAllSnapshot()).scenes[0])
    );
    expect(json.components.character.prompt).toBe(
      legacyScene.slots.character!.promptText
    );
    const zip = await exportFullBackupZip();
    expect((await validateBackupZip(zip)).valid).toBe(true);
    await restoreFullBackupZip(zip);
    const restored = (await getAllSnapshot()).scenes[0];
    for (const mode of ['full', 'structured', 'compact'] as const)
      expect(new TextEncoder().encode(restored.outputs[mode])).toEqual(
        new TextEncoder().encode(legacyScene.outputs[mode])
      );
    expect(restored.slots).toEqual(legacyScene.slots);
    expect(restored.references).toEqual(legacyScene.references);
    const copy = await createDraftFromSavedScene(restored.id);
    const newlySaved = await saveSceneFromDraft(copy.id);
    expect(newlySaved.outputs.structured).toContain('=== SCENE OVERVIEW ===');
    expect(
      (await getAllSnapshot()).scenes.find((s) => s.id === legacyScene.id)!
        .outputs
    ).toEqual(legacyScene.outputs);
  });
});
