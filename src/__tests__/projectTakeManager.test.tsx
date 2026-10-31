import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Collection, ProjectShot, SavedScene } from '../types/domain';
import { ProjectTakeManager } from '../components/ProjectTakeManager';
import * as projects from '../storage/projects';
import { ensembleDraft } from './fixtures/ensembleFixture';

const { library } = vi.hoisted(() => ({ library: { snapshot: null as unknown, showToast: vi.fn() } }));
vi.mock('../context/LibraryContext', () => ({ useLibrary: () => library }));
vi.mock('../storage/projects', () => ({
  addProjectTake: vi.fn(), removeProjectTake: vi.fn(), selectProjectTake: vi.fn(), updateProjectTakeNote: vi.fn(),
}));

const scene = (id: string, line: string): SavedScene => ({
  id, title: `Scene ${id}`, slots: {
    camera: { slot: 'camera', sourceType: 'asset', sourceId: `camera-${id}`, sourceRevision: 2, sourceTitle: 'Camera', promptText: `Close-up ${id}`, overrideText: `Pan → ${id}`, mediaLinks: [] },
    action: { slot: 'action', sourceType: 'asset', sourceId: `action-${id}`, sourceRevision: 1, sourceTitle: 'Action', promptText: `Walk ${id}`, mediaLinks: [] },
  }, extraRequiredSlots: [], sceneInstructions: `Instructions ${id}`, dialogue: { speaker: 'Aya', line }, settings: { aspectRatio: '16:9', durationSeconds: 9, toolNotes: `Tool ${id}` },
  outputs: { full: '', structured: '', compact: '' }, manualOutputs: {}, references: [], resultMediaLinks: [], reviewNotes: `Review ${id}`, reviewStatus: 'unreviewed', revision: 3, createdAt: '', updatedAt: '',
});
const shot = { id: 'shot-1', order: 0, code: '03A', title: 'Meeting', takeSceneIds: ['scene-a', 'scene-b'], selectedSceneId: 'scene-a', status: 'generated', takeNotes: { 'scene-a': 'Good pause' } } as ProjectShot;
const collection = { id: 'project-1', name: 'Project', description: '', members: [], createdAt: '', updatedAt: '', project: { version: 1, revision: 1, shots: [shot] } } as Collection;
const scenes = [scene('scene-a', 'Kumusta, Marco?'), scene('scene-b', 'Sandali lang.'), scene('scene-c', 'Third.')];
const setup = (currentShot = shot) => {
  library.snapshot = { scenes, media: [] };
  const onChanged = vi.fn().mockResolvedValue(undefined);
  render(<ProjectTakeManager collection={collection} shot={currentShot} onClose={vi.fn()} onChanged={onChanged} />);
  return onChanged;
};
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('compares frozen ensemble participants, independent wardrobe and ordered exact cues without changing takes', () => {
  const left = { ...scene('scene-a', ''), ...ensembleDraft(), id: 'scene-a' } as SavedScene;
  const right = { ...structuredClone(left), id: 'scene-b' };
  right.ensemble!.dialogueCues[1].line = '  A different exact reply.\r\n😊  ';
  const before = structuredClone([left, right]);
  library.snapshot = { scenes: [left, right], media: [] };
  render(<ProjectTakeManager collection={collection} shot={shot} onClose={vi.fn()} onChanged={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Compare takes' }));
  const panes = screen.getAllByRole('region', { name: /Take [AB]$/ });
  for (const pane of panes) {
    expect(within(pane).getByText(`${left.ensemble!.participants[1].character.sourceTitle} locked identity`)).toBeInTheDocument();
    expect(within(pane).getByText(/Clothing:.*groom|Clothing:.*suit/i)).toBeInTheDocument();
  }
  expect(within(panes[0]).getByLabelText('Exact line lucas-reply')).toHaveValue(left.ensemble!.dialogueCues[1].line.replace(/\r\n/g, '\n'));
  expect(within(panes[1]).getByLabelText('Exact line lucas-reply')).toHaveValue(right.ensemble!.dialogueCues[1].line.replace(/\r\n/g, '\n'));
  expect(library.snapshot).toEqual({ scenes: before, media: [] });
  expect(projects.selectProjectTake).not.toHaveBeenCalled();
});

it('adds a searched existing scene by ID without creating or changing a source scene', async () => {
  vi.mocked(projects.addProjectTake).mockResolvedValue(collection);
  const original = structuredClone(scenes);
  const onChanged = setup();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Find existing scene' }), { target: { value: 'scene-c' } });
  fireEvent.click(screen.getByRole('button', { name: /Add Scene scene-c/ }));
  await waitFor(() => expect(projects.addProjectTake).toHaveBeenCalledWith({ collectionId: 'project-1', shotId: 'shot-1', sceneId: 'scene-c' }));
  expect(onChanged).toHaveBeenCalledOnce();
  expect(scenes).toEqual(original);
});

it('compares exact effective text in two panes, then returns to the saved notes', async () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Compare takes' }));
  const panes = screen.getAllByRole('region', { name: /Take [AB]/ });
  expect(panes).toHaveLength(2);
  expect(within(panes[0]).getAllByText('Pan → scene-a').length).toBeGreaterThan(0);
  expect(within(panes[0]).getByText('Kumusta, Marco?')).toBeInTheDocument();
  expect(within(panes[1]).getByText('Sandali lang.')).toBeInTheDocument();
  expect(within(panes[0]).getByText('Good pause')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to takes' }));
  expect(screen.getByRole('textbox', { name: 'Project note for Scene scene-a' })).toHaveValue('Good pause');
});

it('guards pending preference changes and reports errors without closing', async () => {
  let reject!: (error: Error) => void;
  vi.mocked(projects.selectProjectTake).mockImplementation(() => new Promise((_, no) => { reject = no; }));
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Select Scene scene-b as preferred' }));
  expect(screen.getByRole('button', { name: 'Select Scene scene-b as preferred' })).toBeDisabled();
  reject(new Error('Concurrent change'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Concurrent change'));
  expect(screen.getByRole('dialog', { name: 'Takes for 03A' })).toBeInTheDocument();
});

it('saves project-only note text with its take ID and keeps source dialogue unchanged', async () => {
  vi.mocked(projects.updateProjectTakeNote).mockResolvedValue(collection);
  const original = structuredClone(scenes);
  setup();
  fireEvent.change(screen.getByRole('textbox', { name: 'Project note for Scene scene-b' }), { target: { value: 'Use the quieter pause.' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Save note' })[1]);
  await waitFor(() => expect(projects.updateProjectTakeNote).toHaveBeenCalledWith({ collectionId: 'project-1', shotId: 'shot-1', sceneId: 'scene-b', note: 'Use the quieter pause.' }));
  expect(scenes).toEqual(original);
});

it('keeps two distinct take IDs when a comparison choice changes', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Compare takes' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Take A' }), { target: { value: 'scene-b' } });
  expect(screen.getByRole('combobox', { name: 'Take A' })).toHaveValue('scene-b');
  expect(screen.getByRole('combobox', { name: 'Take B' })).toHaveValue('scene-a');
  expect(screen.getByRole('region', { name: 'Take A' })).toHaveTextContent('Sandali lang.');
  expect(screen.getByRole('region', { name: 'Take B' })).toHaveTextContent('Kumusta, Marco?');
});

it('requires confirmation for association removal and restores focus after Escape', async () => {
  const user = userEvent.setup();
  vi.mocked(projects.removeProjectTake).mockResolvedValue(collection);
  const trigger = document.createElement('button'); trigger.textContent = 'Open'; document.body.append(trigger); trigger.focus();
  library.snapshot = { scenes, media: [] };
  const onChanged = vi.fn().mockResolvedValue(undefined);
  const Host = () => { const [open, setOpen] = React.useState(true); return open && <ProjectTakeManager collection={collection} shot={shot} onClose={() => setOpen(false)} onChanged={onChanged} />; };
  render(<Host />);
  await user.click(screen.getByRole('button', { name: 'Remove Scene scene-a from shot' }));
  expect(screen.getByText(/source scene is preserved/i)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Confirm remove take' }));
  await waitFor(() => expect(projects.removeProjectTake).toHaveBeenCalledWith({ collectionId: 'project-1', shotId: 'shot-1', sceneId: 'scene-a' }));
  expect(onChanged).toHaveBeenCalledOnce();
  await user.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
  trigger.remove();
});

it('keeps the removal confirmation visible after a failed repository action', async () => {
  vi.mocked(projects.removeProjectTake).mockRejectedValue(new Error('Take changed elsewhere'));
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Scene scene-a from shot' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm remove take' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Take changed elsewhere'));
  expect(screen.getByRole('button', { name: 'Confirm remove take' })).toBeInTheDocument();
});
