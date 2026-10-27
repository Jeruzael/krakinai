import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Collection, PromptAsset, SavedScene, Variant } from '../types/domain';
import { ProjectCastPanel } from '../components/ProjectCastPanel';
import { ProjectScriptPanel } from '../components/ProjectScriptPanel';
import * as castStorage from '../storage/projectContinuity';

const { library } = vi.hoisted(() => ({ library: { snapshot: null as unknown, navigate: vi.fn(), copyText: vi.fn().mockResolvedValue(true), showToast: vi.fn() } }));
vi.mock('../context/LibraryContext', () => ({ useLibrary: () => library }));
vi.mock('../storage/projectContinuity', () => ({ upsertProjectCast: vi.fn(), removeProjectCast: vi.fn() }));

const character = (id: string): PromptAsset => ({ id, title: `Character ${id}`, category: 'characters', description: '', promptText: `Full identity for ${id}`, tags: [], mediaLinks: [], favorite: false, reviewStatus: 'unreviewed', provenance: {}, notes: '', revision: 1, createdAt: '', updatedAt: '' });
const variant = { id: 'coat', parentCharacterId: 'aya', type: 'Outfit', targetSlot: 'wardrobe', title: 'Rain coat', description: '', promptText: 'Blue coat', tags: [], mediaLinks: [], favorite: false, reviewStatus: 'unreviewed', revision: 1, createdAt: '', updatedAt: '' } as Variant;
const scene = (id: string, line: string): SavedScene => ({ id, title: `Scene ${id}`, slots: { character: { slot: 'character', sourceType: 'asset', sourceId: 'aya', sourceRevision: 1, sourceTitle: 'Aya', promptText: 'Snapshot', mediaLinks: [] } }, extraRequiredSlots: [], sceneInstructions: '', dialogue: { speaker: 'Aya', line, mode: 'voiceover', language: 'Filipino', deliveryNotes: 'quietly' }, settings: { durationSeconds: 8 }, outputs: { full: '', structured: '', compact: '' }, manualOutputs: {}, references: [], resultMediaLinks: [], reviewNotes: '', reviewStatus: 'unreviewed', revision: 1, createdAt: '', updatedAt: '' });
const shots = [{ id: 'sh1', order: 0, code: '03A', title: 'First', takeSceneIds: ['a'], selectedSceneId: 'a', status: 'reviewed' as const }, { id: 'sh2', order: 1, code: '04', title: 'Second', takeSceneIds: ['b'], selectedSceneId: 'b', status: 'reviewed' as const }];
const collection = { id: 'p', name: 'Film', description: '', members: [], createdAt: '', updatedAt: '', project: { version: 1, revision: 1, shots } } as Collection;
const setup = (project = collection) => { library.snapshot = { assets: [character('aya'), character('bob')], variants: [variant], scenes: [scene('a', '  Kumusta, 世界?\nnext line  '), scene('b', 'Second!')], media: [] }; const onChanged = vi.fn().mockResolvedValue(undefined); render(<><ProjectCastPanel collection={project} onChanged={onChanged} /><ProjectScriptPanel collection={project} onChanged={onChanged} /></>); return onChanged; };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('shows selected-shot cast as derived and saves only manually entered Bible fields', async () => {
  vi.mocked(castStorage.upsertProjectCast).mockResolvedValue(collection);
  const original = structuredClone([scene('a', 'hello'), character('aya')]);
  const onChanged = setup();
  expect(screen.getByText(/Derived from selected shot/)).toBeInTheDocument();
  expect(screen.queryByText(/personality/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Bible for Character aya' }));
  expect(screen.getByRole('dialog', { name: 'Character Bible: Character aya' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Personality' }), { target: { value: 'Observant, not inferred' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Bible' }));
  await waitFor(() => expect(castStorage.upsertProjectCast).toHaveBeenCalledWith({ collectionId: 'p', entry: expect.objectContaining({ characterId: 'aya', personality: 'Observant, not inferred' }), expectedRevision: 1 }));
  expect(onChanged).toHaveBeenCalledOnce();
  expect([scene('a', 'hello'), character('aya')]).toEqual(original);
});

it('adds an existing character by ID and confirms removal of only project metadata', async () => {
  const withCast = { ...collection, project: { ...collection.project!, cast: [{ characterId: 'aya', storyRole: 'Lead' }] } } as Collection;
  vi.mocked(castStorage.upsertProjectCast).mockResolvedValue(withCast);
  vi.mocked(castStorage.removeProjectCast).mockResolvedValue(collection);
  setup(withCast);
  fireEvent.change(screen.getByRole('combobox', { name: 'Add existing character' }), { target: { value: 'bob' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to cast' }));
  await waitFor(() => expect(castStorage.upsertProjectCast).toHaveBeenCalledWith({ collectionId: 'p', entry: { characterId: 'bob' }, expectedRevision: 1 }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove Bible for Character aya' }));
  expect(screen.getByText(/original character and saved scenes remain/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm remove Bible' }));
  await waitFor(() => expect(castStorage.removeProjectCast).toHaveBeenCalledWith({ collectionId: 'p', characterId: 'aya' }));
});

it('keeps one accessible dialog, closes on Escape and restores focus', async () => {
  const user = userEvent.setup();
  setup();
  const open = screen.getByRole('button', { name: 'Edit Bible for Character aya' });
  open.focus();
  await user.click(open);
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Close Character Bible: Character aya' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(open).toHaveFocus();
});

it('keeps a stale Bible editor open with a visible revision conflict', async () => {
  vi.mocked(castStorage.upsertProjectCast).mockRejectedValue(new Error('Project revision conflict: refresh/reopen editor.'));
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Bible for Character aya' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Story role' }), { target: { value: 'Lead' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Bible' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Project revision conflict'));
  expect(screen.getByRole('dialog', { name: 'Character Bible: Character aya' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Story role' })).toHaveValue('Lead');
});

it('copies exact multiline Unicode dialogue and the displayed script export', async () => {
  setup();
  const board = screen.getByRole('region', { name: 'Project Script' });
  expect(within(board).getAllByText(/Kumusta, 世界/).length).toBeGreaterThan(0);
  const lines = within(board).getAllByRole('button', { name: /Copy line/ });
  fireEvent.click(lines[0]);
  await waitFor(() => expect(library.copyText).toHaveBeenCalledWith('  Kumusta, 世界?\nnext line  ', expect.anything()));
  fireEvent.click(within(board).getByRole('button', { name: 'Copy Script' }));
  await waitFor(() => expect(library.copyText).toHaveBeenCalledWith((within(board).getByRole('textbox', { name: 'Script document' }) as HTMLTextAreaElement).value, expect.anything()));
  expect(within(board).getAllByText(/03A/)[0]).toBeInTheDocument();
});

it('downloads the displayed Markdown as UTF-8 in selected shot order', async () => {
  let blob: Blob | undefined;
  const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(value => { blob = value as Blob; return 'blob:script'; });
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { expect(this.download).toBe('Film-script.md'); });
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Download Script .md' }));
  expect(click).toHaveBeenCalledOnce();
  expect(blob?.type).toBe('text/markdown;charset=utf-8');
  const text = await blob!.text();
  expect(text).toBe((screen.getByRole('textbox', { name: 'Script document' }) as HTMLTextAreaElement).value);
  expect(text.indexOf('  Kumusta, 世界?\nnext line  ')).toBeLessThan(text.indexOf('Second!'));
  create.mockRestore(); revoke.mockRestore(); click.mockRestore();
});
