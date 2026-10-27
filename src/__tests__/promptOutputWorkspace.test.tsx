import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryProvider, useLibrary } from '../context/LibraryContext';
import { ConfirmModal } from '../components/SharedModals';
import { PromptOutputScreen } from '../screens/PromptOutputScreen';
import {
  clearAllStoresForTesting,
  getAllSnapshot,
  saveMediaAsset,
  saveSceneDraft,
  saveSceneFromDraft,
  replaceAllStoresTransactionally,
  reopenDatabaseAfterPageReloadForTesting,
  createCollection,
} from '../storage/db';
import { addProjectShot } from '../storage/projects';
import * as objectUrls from '../hooks/useObjectUrl';
import { assembleScenePrompt } from '../domain/promptAssembler';
import { serializeSceneJson } from '../domain/sceneDocument';
import type { ComponentSnapshot, SceneDraft } from '../types/domain';

const identity = `Fictional adult character with an unchanged identity. ${'Identity detail. '.repeat(90)}END OF IDENTITY`;
const fullPrompt = `${identity}\n\nDark denim jacket.\n\nA quiet library.\n\nTurns a page.\n\nHold the final frame.`;
const compactPrompt = `${identity}\n\nDenim jacket.\n\nQuiet library.\n\nTurns a page.\n\nHold the final frame.`;
const manualPrompt =
  '  Preserved manual output.\n\nUnicode: café — 雨\nFinal manual line.  ';

function slot(
  slot: ComponentSnapshot['slot'],
  promptText: string,
  sourceTitle: string
): ComponentSnapshot {
  return {
    slot,
    sourceType: 'asset',
    sourceId: `asset_${slot}`,
    sourceRevision: 1,
    sourceTitle,
    promptText,
    mediaLinks: [],
  };
}

async function createFixture(manual = false): Promise<SceneDraft> {
  const media = await saveMediaAsset({
    filename: 'identity-demo.png',
    mimeType: 'image/png',
    blob: new Blob(['image'], { type: 'image/png' }),
  });
  const character = slot('character', identity, 'Ari Character');
  character.mediaLinks = Array.from({ length: 7 }, (_, order) => ({
    mediaId: media.id,
    role: order === 1 ? ('sample' as const) : ('reference' as const),
    altText: `Character view ${order + 1}`,
    viewLabel: `View ${order + 1}`,
    order,
    filename: media.filename,
  }));
  const wardrobe = {
    ...slot('wardrobe', 'Dark denim jacket.', 'Denim Outfit'),
    compactText: 'Denim jacket.',
  };
  wardrobe.mediaLinks = [
    {
      mediaId: media.id,
      role: 'reference',
      altText: 'Outfit front view',
      order: 0,
      filename: media.filename,
    },
  ];
  const draft = await saveSceneDraft({
    title: 'Quiet Library',
    slots: {
      character,
      wardrobe,
      environment: {
        ...slot('environment', 'A quiet library.', 'Library'),
        compactText: 'Quiet library.',
      },
      action: slot('action', 'Turns a page.', 'Reading'),
    },
    extraRequiredSlots: [],
    sceneInstructions: 'Hold the final frame.',
    avoidText: 'No text overlay.',
    settings: {
      aspectRatio: '9:16',
      durationSeconds: 8,
      toolNotes: 'Keep the seed.',
    },
    manualOutputs: {},
    resultMediaLinks: [],
    reviewNotes: '',
    reviewStatus: 'unreviewed',
  });
  if (!manual) return draft;
  return saveSceneDraft({
    ...draft,
    manualOutputs: {
      full: {
        text: manualPrompt,
        basedOnInputRevision: draft.inputRevision - 1,
        updatedAt: '2026-10-25T00:00:00.000Z',
      },
    },
    bumpInputRevision: false,
  });
}

function OutputHost({ id }: { id: string }) {
  const { hashPath } = useLibrary();
  const routeId = hashPath.startsWith('/output/')
    ? hashPath.slice('/output/'.length).split('?')[0]
    : id;
  return (
    <>
      <PromptOutputScreen id={routeId} />
      <ConfirmModal />
    </>
  );
}

async function renderOutput(id: string) {
  render(
    <LibraryProvider>
      <OutputHost id={id} />
    </LibraryProvider>
  );
  await screen.findByRole('heading', { name: 'Quiet Library', level: 1 });
  await waitFor(() =>
    expect(
      screen
        .getAllByAltText('Character view 1')
        .every((image) => image.hasAttribute('src'))
    ).toBe(true)
  );
}

describe('Prompt Output studio workspace', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    window.location.hash = '#/';
    await clearAllStoresForTesting();
  });

  it('saves a new project take atomically and retains the originating shot return', async () => {
    const user=userEvent.setup(); const draft=await createFixture();
    const collection=await createCollection({name:'Film'});
    const project=await addProjectShot({collectionId:collection.id,title:'Waiting'});
    const shotId=project.project!.shots[0].id;
    window.location.hash=`#/output/${draft.id}?collection=${collection.id}&shot=${shotId}&takeTarget=1`;
    await renderOutput(draft.id);
    await user.click(screen.getByRole('button',{name:'Save New Take'}));
    await screen.findByRole('button',{name:'Back to Collection'});
    const saved=await getAllSnapshot();
    expect(saved.scenes).toHaveLength(1);
    expect(saved.collections[0].project!.shots[0].takeSceneIds).toEqual([saved.scenes[0].id]);
    expect(saved.scenes[0].saveProjectTarget).toEqual({collectionId:collection.id,shotId});
    await user.click(screen.getByRole('button',{name:'Back to Collection'}));
    expect(window.location.hash).toContain(`/collections/${collection.id}?tab=storyboard`);
  });

  it('does not silently save a detached scene when the requested shot is unavailable', async () => {
    const user=userEvent.setup(); const draft=await createFixture();
    window.location.hash=`#/output/${draft.id}?collection=deleted&shot=missing&takeTarget=1`;
    await renderOutput(draft.id);
    await user.click(screen.getByRole('button',{name:'Save Scene'}));
    expect((await getAllSnapshot()).scenes).toHaveLength(0);
    expect(screen.getAllByText(/This project shot is unavailable/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button',{name:'Continue as Standalone Draft'}));
    expect(window.location.hash).toBe(`#/output/${draft.id}`);
  });

  it('starts a new save attempt after returning from a first saved output', async () => {
    const user = userEvent.setup();
    const draft = await createFixture();
    await renderOutput(draft.id);
    await user.click(screen.getByRole('button', {name:'Save Scene'}));
    await waitFor(() => expect(window.location.hash).toMatch(/output\/scene_/));
    act(() => { window.location.hash = `#/output/${draft.id}`; window.dispatchEvent(new HashChangeEvent('hashchange')); });
    await user.click(await screen.findByRole('button', {name:'Save Scene'}));
    await screen.findByRole('dialog', {name:'Similar saved scene'});
    expect((await getAllSnapshot()).scenes).toHaveLength(1);
  });

  it('retains unfinished per-mode buffers after opening a duplicate and returning', async () => {
    const user = userEvent.setup();
    const draft = await createFixture();
    const existing = await saveSceneFromDraft(draft.id);
    await renderOutput(draft.id);
    const before = await getAllSnapshot();
    await user.click(screen.getByRole('button', {name:'Edit This Output'}));
    await user.clear(screen.getByLabelText('Manual prompt output'));
    await user.type(screen.getByLabelText('Manual prompt output'), 'Unfinished structured text');
    await user.click(screen.getByRole('tab', {name:'Narrative'}));
    await user.click(screen.getByRole('button', {name:'Edit This Output'}));
    await user.clear(screen.getByLabelText('Manual prompt output'));
    await user.type(screen.getByLabelText('Manual prompt output'), 'Unfinished narrative text');
    await user.click(screen.getByRole('button', {name:'Save Scene'}));
    await screen.findByRole('dialog', {name:'Similar saved scene'});
    await user.click(screen.getByRole('button', {name:'Cancel'}));
    expect(screen.getByLabelText('Manual prompt output')).toHaveValue('Unfinished narrative text');
    await user.click(screen.getByRole('button', {name:'Save Scene'}));
    await user.click(await screen.findByRole('button', {name:'Open Existing Scene'}));
    await waitFor(() => expect(window.location.hash).toContain(existing.id));
    act(() => { window.location.hash = `#/output/${draft.id}`; window.dispatchEvent(new HashChangeEvent('hashchange')); });
    await waitFor(() => expect(screen.getByLabelText('Manual prompt output')).toHaveValue('Unfinished structured text'));
    await user.click(screen.getByRole('tab', {name:'Narrative'}));
    expect(screen.getByLabelText('Manual prompt output')).toHaveValue('Unfinished narrative text');
    const after = await getAllSnapshot();
    expect(after.drafts).toEqual(before.drafts);
    expect(after.scenes).toEqual(before.scenes);
  });

  it('guards rapid first save clicks', async () => {
    const draft = await createFixture();
    await renderOutput(draft.id);
    const save = screen.getByRole('button', {name:'Save Scene'});
    act(() => { save.click(); save.click(); });
    await waitFor(() => expect(screen.queryByRole('button', {name:'Save Scene'})).not.toBeInTheDocument());
    expect((await getAllSnapshot()).scenes).toHaveLength(1);
  });

  it('guards rapid save and explicit duplicate decision clicks', async () => {
    const draft = await createFixture();
    await saveSceneFromDraft(draft.id);
    await renderOutput(draft.id);
    const save = screen.getByRole('button', {name:'Save Scene'});
    act(() => { save.click(); save.click(); });
    const dialog = await screen.findByRole('dialog', {name:'Similar saved scene'});
    expect((await getAllSnapshot()).scenes).toHaveLength(1);
    const version = within(dialog).getByRole('button', {name:'Save as New Version'});
    act(() => { version.click(); version.click(); });
    await waitFor(async () => expect((await getAllSnapshot()).scenes).toHaveLength(2));
  });

  it('switches export workflows without altering canonical scenes and copies complete generation JSON', async () => {
    const user = userEvent.setup();
    const draft = await createFixture();
    await renderOutput(draft.id);
    const before = (await getAllSnapshot()).drafts;
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.selectOptions(screen.getByLabelText('Target Workflow'), 'generation_json');
    expect(screen.getByRole('tab', { name: 'Generation JSON' })).toHaveAttribute('aria-selected', 'true');
    const text = screen.getByRole('region', { name: 'Complete prompt text' }).textContent!;
    expect(JSON.parse(text).schema).toBe('krakinai.generation-prompt.v1');
    expect(JSON.parse(text).character.description).toBe(identity);
    expect(screen.queryByRole('button', { name: 'Edit This Output' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy JSON' }));
    expect(writeText).toHaveBeenCalledWith(text);
    await user.selectOptions(screen.getByLabelText('Target Workflow'), 'gemini_omni_flash');
    expect(screen.getByRole('tab', { name: /Structured/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Complete prompt text' }).textContent).toContain(identity);
    await user.click(screen.getByRole('tab', { name: 'Narrative' }));
    expect(screen.getByLabelText('Target Workflow')).toHaveValue('canonical');
    expect(screen.getByRole('button', { name: 'Edit This Output' })).toBeVisible();
    expect((await getAllSnapshot()).drafts).toEqual(before);
  });

  it('supports keyboard top tabs and prompt formats without mutating stored inputs', async () => {
    const user = userEvent.setup();
    const draft = await createFixture();
    await renderOutput(draft.id);
    const before = (await getAllSnapshot()).drafts;
    const workspace = screen.getByRole('tablist', { name: 'Output workspace' });
    const prompt = within(workspace).getByRole('tab', { name: 'Prompt' });
    const references = within(workspace).getByRole('tab', {
      name: 'References',
    });
    const review = within(workspace).getByRole('tab', { name: 'Review' });
    expect(prompt).toHaveAttribute('tabindex', '0');
    expect(references).toHaveAttribute('tabindex', '-1');
    expect(prompt).toHaveAttribute(
      'aria-controls',
      screen.getByRole('tabpanel', { name: 'Prompt' }).id
    );
    await user.click(prompt);
    await user.keyboard('{ArrowRight}');
    expect(references).toHaveFocus();
    expect(
      screen.getByRole('tabpanel', { name: 'References' })
    ).toHaveAttribute('tabindex', '0');
    expect(
      screen.queryByRole('region', { name: 'Complete prompt text' })
    ).not.toBeInTheDocument();
    await user.keyboard('{End}');
    expect(review).toHaveFocus();
    await user.keyboard('{Home}');
    expect(prompt).toHaveFocus();
    const formats = screen.getByRole('tablist', { name: 'Prompt format' });
    for (const tab of within(formats).getAllByRole('tab')) {
      const panel = document.getElementById(tab.getAttribute('aria-controls')!);
      expect(panel).not.toBeNull();
      expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    }
    await user.click(screen.getByRole('button', { name: 'Raw' }));
    await user.click(within(formats).getByRole('tab', { name: 'Narrative' }));
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(within(formats).getByRole('tab', { name: 'Compact' })).toHaveFocus();
    expect(
      screen.getByRole('region', { name: 'Complete prompt text' }).textContent
    ).toBe(assembleScenePrompt(draft).outputs.compact);
    await user.keyboard('{Home}');
    expect(
      screen.getByRole('region', { name: 'Complete prompt text' }).textContent
    ).toBe(assembleScenePrompt(draft).outputs.full);
    expect(
      screen.getByRole('region', { name: 'Complete prompt text' })
    ).toHaveAttribute('tabindex', '0');
    expect((await getAllSnapshot()).drafts).toEqual(before);
  });

  it('keeps full copy and text-download actions available on References and Review', async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue();
    const download = vi
      .spyOn(objectUrls, 'downloadBlobAsFile')
      .mockImplementation(() => {});
    const draft = await createFixture();
    await renderOutput(draft.id);
    await user.click(screen.getByRole('tab', { name: 'Compact' }));
    await user.click(screen.getByRole('tab', { name: 'References' }));
    const actions = screen.getByRole('region', { name: 'Prompt actions' });
    expect(within(actions).getByText(/Compact/)).toBeVisible();
    await user.click(
      within(actions).getByRole('button', { name: 'Copy Prompt' })
    );
    expect(writeText).toHaveBeenLastCalledWith(
      assembleScenePrompt(draft).outputs.compact
    );
    await user.click(
      within(actions).getByRole('button', { name: 'Download selected .txt' })
    );
    expect(await download.mock.calls.at(-1)![0].text()).toBe(
      assembleScenePrompt(draft).outputs.compact
    );
    await user.click(screen.getByRole('tab', { name: 'Review' }));
    await user.click(
      within(actions).getByRole('button', {
        name: 'Download full specification .txt',
      })
    );
    const [blob, filename] = download.mock.calls.at(-1)!;
    expect(filename).toBe('Quiet_Library_compact_specification.txt');
    expect(await blob.text()).toBe(
      [
        'KRAKINAI — AI VIDEO PROMPT LIBRARY EXPORT',
        'Scene: Quiet Library',
        '',
        '=== PROMPT (COMPACT) ===',
        assembleScenePrompt(draft).outputs.compact,
        '',
        '=== SETTINGS (USER INSTRUCTIONS) ===',
        'Aspect Ratio: 9:16',
        'Intended Duration: 8s',
        'Tool / Provider Notes: Keep the seed.',
        '(Note: Settings are user instructions, not verified provider capabilities.)',
        '',
        '=== AVOID / NEGATIVE TEXT ===',
        'No text overlay.',
        '',
        '=== REFERENCE CHECKLIST (ATTACH SEPARATELY) ===',
        'Copying or downloading this text does not upload reference files to an external tool.',
        '1. identity-demo.png (reference) — Character view 1',
        '',
      ].join('\n')
    );
    expect(
      within(actions).getByRole('button', { name: 'Save Scene' })
    ).toBeVisible();
  });

  it('preserves stale-output confirmation and unfinished editing when moving between top tabs', async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue();
    const draft = await createFixture(true);
    await renderOutput(draft.id);
    await user.click(screen.getByRole('tab', { name: 'Narrative' }));
    await user.click(screen.getByRole('button', { name: 'Edit This Output' }));
    const editor = screen.getByRole('textbox', {
      name: 'Manual prompt output',
    });
    await user.clear(editor);
    await user.type(editor, 'Unfinished manual buffer.');
    await user.click(screen.getByRole('tab', { name: 'Review' }));
    await user.click(screen.getByRole('button', { name: 'Copy Prompt' }));
    expect(writeText).not.toHaveBeenCalled();
    await user.click(
      await screen.findByRole('button', { name: 'Retain & Copy Manual Edits' })
    );
    expect(writeText).toHaveBeenLastCalledWith(manualPrompt);
    await user.click(screen.getByRole('tab', { name: 'Prompt' }));
    expect(
      screen.getByRole('textbox', { name: 'Manual prompt output' })
    ).toHaveValue('Unfinished manual buffer.');
    await user.click(
      screen.getByRole('button', { name: 'Save Manual Output Override' })
    );
    await waitFor(async () =>
      expect((await getAllSnapshot()).drafts[0].manualOutputs.full?.text).toBe(
        'Unfinished manual buffer.'
      )
    );
    expect((await getAllSnapshot()).drafts[0].inputRevision).toBe(
      draft.inputRevision
    );
  });

  it('shows every reference association in the gallery and keeps negative text collapsed', async () => {
    const user = userEvent.setup();
    const draft = await createFixture();
    await renderOutput(draft.id);
    expect(screen.getByText('No text overlay.')).not.toBeVisible();
    await user.click(screen.getByText('Avoid / Negative Text (Separate)'));
    expect(screen.getByText('No text overlay.')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Copy Avoid Text' })
    ).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'References' }));
    expect(
      screen.getByText(
        /Copying prompt text does not upload reference images or videos/
      )
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'View All (8)' }));
    const gallery = screen.getByRole('dialog');
    expect(within(gallery).getAllByText('Ari Character').length).toBe(7);
    expect(within(gallery).getByText('Denim Outfit')).toBeVisible();
    expect(within(gallery).getByText('sample')).toBeVisible();
    expect(
      (await getAllSnapshot()).drafts[0].slots.character?.mediaLinks
    ).toHaveLength(7);
  });

  it('saves an immutable scene from Review and persists review notes and status separately', async () => {
    const user = userEvent.setup();
    const draft = await createFixture();
    const saved = await saveSceneFromDraft(draft.id);
    await renderOutput(saved.id);
    await user.click(screen.getByRole('tab', { name: 'Review' }));
    expect(screen.getByLabelText('Upload Actual Result')).toBeInTheDocument();
    const notes = screen.getByRole('textbox', { name: 'Review Notes' });
    await user.type(notes, 'Keep the last frame.');
    await user.click(screen.getByRole('button', { name: 'Save Review Notes' }));
    await waitFor(async () =>
      expect((await getAllSnapshot()).scenes[0].reviewNotes).toBe(
        'Keep the last frame.'
      )
    );
    await user.selectOptions(
      screen.getByLabelText('Review Status:'),
      'user-approved'
    );
    await waitFor(async () =>
      expect((await getAllSnapshot()).scenes[0].reviewStatus).toBe(
        'user-approved'
      )
    );
    const current = (await getAllSnapshot()).scenes[0];
    expect(current.outputs).toEqual(saved.outputs);
    expect(current.slots).toEqual(saved.slots);
    expect(current.references).toEqual(saved.references);
    expect(
      screen.getByRole('button', { name: 'Add to Collection' })
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit a Copy' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Edit This Output' })
    ).not.toBeInTheDocument();
  });

  it('keeps review notes when leaving the field and saving a scene from Review', async () => {
    const user = userEvent.setup();
    const draft = await createFixture();
    await renderOutput(draft.id);
    await user.click(screen.getByRole('tab', { name: 'Review' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Review Notes' }),
      'Save this scene with these notes.'
    );
    const beforeNotesUrl = screen.getAllByAltText('Character view 1')[0].getAttribute('src');
    await user.click(screen.getByRole('tab', { name: 'Prompt' }));
    await waitFor(() => {
      // A refreshed media object produces a new URL after the asynchronous
      // blur save. Wait for its effect before beginning the next interaction.
      const images = screen.getAllByAltText('Character view 1');
      expect(images.every(image => image.getAttribute('src') && image.getAttribute('src') !== beforeNotesUrl)).toBe(true);
    });
    await waitFor(async () =>
      expect((await getAllSnapshot()).drafts[0].reviewNotes).toBe('Save this scene with these notes.')
    );
    await user.click(screen.getByRole('tab', { name: 'Review' }));
    const beforeSceneUrl = screen.getAllByAltText('Character view 1')[0].getAttribute('src');
    await user.click(screen.getByRole('button', { name: 'Save Scene' }));
    await waitFor(() => {
      const images = screen.getAllByAltText('Character view 1');
      expect(images.every(image => image.getAttribute('src') && image.getAttribute('src') !== beforeSceneUrl)).toBe(true);
    });
    expect(
      await screen.findByText('Saved Scene (Immutable Snapshot)')
    ).toBeVisible();
    const saved = (await getAllSnapshot()).scenes[0];
    expect(saved.outputs.full).toBe(assembleScenePrompt(draft).outputs.full);
    expect(saved.reviewNotes).toBe('Save this scene with these notes.');
    expect(JSON.parse(JSON.stringify(saved.slots), (key, value) => key === 'namesCaptured' ? undefined : value)).toEqual(draft.slots);
  });

  it('uploads an external result from Review without changing the prompt or references', async () => {
    const user = userEvent.setup();
    const draft = await createFixture();
    const saved = await saveSceneFromDraft(draft.id);
    await renderOutput(saved.id);
    await user.click(screen.getByRole('tab', { name: 'Review' }));
    await user.upload(
      screen.getByLabelText('Upload Actual Result'),
      new File(['actual result'], 'actual.png', { type: 'image/png' })
    );
    await waitFor(async () =>
      expect((await getAllSnapshot()).scenes[0].resultMediaLinks).toHaveLength(
        1
      )
    );
    const current = (await getAllSnapshot()).scenes[0];
    expect(current.resultMediaLinks[0]).toMatchObject({
      filename: 'actual.png',
      role: 'result',
    });
    expect(current.outputs).toEqual(saved.outputs);
    expect(current.references).toEqual(saved.references);
    expect(await screen.findByText('Actual Result')).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'References' }));
    expect(screen.queryByText('Actual Result')).not.toBeVisible();
  });

  it('retains separate unavailable-file associations from a saved reference checklist', async () => {
    const user = userEvent.setup();
    const draft = await createFixture();
    const saved = await saveSceneFromDraft(draft.id);
    const snapshot = await getAllSnapshot();
    const missingReferences = [
      {
        mediaId: 'media_unavailable',
        role: 'reference' as const,
        altText: 'Missing reference view',
        filename: 'missing.png',
        order: 1,
      },
      {
        mediaId: 'media_unavailable',
        role: 'sample' as const,
        altText: 'Missing sample view',
        filename: 'missing.png',
        order: 2,
      },
    ];
    await replaceAllStoresTransactionally({
      ...snapshot,
      scenes: [
        { ...saved, references: [...saved.references, ...missingReferences] },
      ],
    });
    await reopenDatabaseAfterPageReloadForTesting();
    await renderOutput(saved.id);
    await user.click(screen.getByRole('tab', { name: 'References' }));
    await user.click(screen.getByRole('button', { name: 'View All (10)' }));
    const gallery = screen.getByRole('dialog');
    expect(within(gallery).getAllByText('missing.png')).toHaveLength(2);
    expect(
      within(gallery).getAllByRole('button', {
        name: 'Download Scene reference: Quiet Library',
      })
    ).toHaveLength(2);
    for (const download of within(gallery).getAllByRole('button', {
      name: 'Download Scene reference: Quiet Library',
    })) {
      expect(download).toBeDisabled();
    }
  });
  it('defaults drafts to Structured and copies/downloads exact derived JSON without saving it', async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue();
    const download = vi
      .spyOn(objectUrls, 'downloadBlobAsFile')
      .mockImplementation(() => {});
    const draft = await createFixture();
    await renderOutput(draft.id);
    expect(screen.getByRole('tab', { name: /Structured/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await user.click(screen.getByRole('tab', { name: 'Project JSON' }));
    expect(screen.getByText(/KRAKINAI-specific schema/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Edit This Output' })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Raw' }));
    const raw = screen.getByRole('region', {
      name: 'Complete prompt text',
    }).textContent;
    expect(raw).toBe(serializeSceneJson(draft));
    await user.click(screen.getByRole('button', { name: 'Copy JSON' }));
    expect(writeText).toHaveBeenLastCalledWith(raw);
    await user.click(screen.getByRole('button', { name: 'Download .json' }));
    const [blob, filename] = download.mock.calls.at(-1)!;
    expect(filename).toBe('Quiet_Library_json.json');
    expect(await blob.text()).toBe(raw);
    await user.click(
      screen.getByRole('button', {
        name: 'Download Structured full specification .txt',
      })
    );
    const [specification, specificationName] = download.mock.calls.at(-1)!;
    expect(specificationName).toBe(
      'Quiet_Library_structured_specification.txt'
    );
    expect(await specification.text()).toContain('=== PROMPT (STRUCTURED) ===');
    expect(await specification.text()).toContain(
      assembleScenePrompt(draft).outputs.structured
    );
    expect((await getAllSnapshot()).drafts[0]).toEqual(draft);
  });

  it('retains unfinished per-format edits across modes and renders HTML as literal text', async () => {
    const user = userEvent.setup();
    const draft = await createFixture();
    await renderOutput(draft.id);
    await user.click(screen.getByRole('button', { name: 'Edit This Output' }));
    const editor = screen.getByRole('textbox', {
      name: 'Manual prompt output',
    });
    await user.clear(editor);
    await user.type(editor, '<img src=x onerror=alert(1)> **HAIR**');
    await user.click(screen.getByRole('button', { name: 'Raw' }));
    await user.click(screen.getByRole('tab', { name: 'Project JSON' }));
    await user.click(screen.getByRole('tab', { name: /Structured/ }));
    await user.click(screen.getByRole('button', { name: 'Formatted' }));
    expect(
      screen.getByRole('textbox', { name: 'Manual prompt output' })
    ).toHaveValue('<img src=x onerror=alert(1)> **HAIR**');
    await user.click(
      screen.getByRole('button', { name: 'Save Manual Output Override' })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('textbox', { name: 'Manual prompt output' })
      ).not.toBeInTheDocument()
    );
    expect(
      screen
        .getByRole('region', { name: 'Complete prompt text' })
        .querySelector('img')
    ).toBeNull();
    expect(
      screen.getByText('<img src=x onerror=alert(1)>', { exact: false })
    ).toBeVisible();
  });

  it('opens legacy saved scenes in Narrative and preserves all original output bytes', async () => {
    const user = userEvent.setup();
    const draft = await createFixture();
    const saved = await saveSceneFromDraft(draft.id);
    const outputs = {
      full: fullPrompt,
      structured: '  Legacy structured\nunchanged.  ',
      compact: compactPrompt,
    };
    const snapshot = await getAllSnapshot();
    await replaceAllStoresTransactionally({
      ...snapshot,
      scenes: [{ ...saved, outputs }],
    });
    await reopenDatabaseAfterPageReloadForTesting();
    await renderOutput(saved.id);
    expect(screen.getByRole('tab', { name: 'Narrative' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await user.click(screen.getByRole('button', { name: 'Raw' }));
    for (const [label, text] of [
      ['Narrative', outputs.full],
      ['Structured', outputs.structured],
      ['Compact', outputs.compact],
    ]) {
      await user.click(screen.getByRole('tab', { name: new RegExp(label) }));
      expect(
        screen.getByRole('region', { name: 'Complete prompt text' }).textContent
      ).toBe(text);
    }
    await user.click(screen.getByRole('tab', { name: 'Project JSON' }));
    expect((await getAllSnapshot()).scenes[0].outputs).toEqual(outputs);
  });
});
