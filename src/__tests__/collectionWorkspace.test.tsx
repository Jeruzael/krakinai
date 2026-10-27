import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const state = vi.hoisted(() => ({
  snapshot: null as any,
  hashPath: '/collections/c?tab=storyboard&view=grid&sort=order&filter=',
  navigate: vi.fn(), refreshSnapshot: vi.fn(async () => undefined), showToast: vi.fn(),
  openConfirmDialog: vi.fn(), closeConfirmDialog: vi.fn(),
}));
const actions = vi.hoisted(() => ({
  update: vi.fn(async () => undefined), reorder: vi.fn(async () => undefined),
  add: vi.fn(async () => undefined), remove: vi.fn(async () => undefined),
  updateCollection: vi.fn(async () => undefined), deleteCollection: vi.fn(async () => undefined),
}));
vi.mock('../context/LibraryContext', () => ({ useLibrary: () => state }));
vi.mock('../storage/projects', () => ({
  updateProjectShot: actions.update, reorderProjectShots: actions.reorder,
  addProjectShot: actions.add, removeProjectShot: actions.remove,
}));
vi.mock('../storage/db', () => ({ updateCollection: actions.updateCollection, deleteCollection: actions.deleteCollection }));
vi.mock('../components/ProjectTakeManager', () => ({ ProjectTakeManager: ({ onClose }: { onClose: () => void }) => <div>Take manager<button onClick={onClose}>Close Takes</button></div> }));
vi.mock('../domain/projectRoutes', () => ({ startProjectShotDraft: vi.fn(async () => '/builder') }));
vi.mock('../components/ProjectBulkActions', () => ({ ProjectBulkActions: ({ selectedShotIds, onClear }: {selectedShotIds:string[];onClear:()=>void}) => <div aria-label="Selected shot IDs">{selectedShotIds.join(',')}<button onClick={onClear}>Clear shot selection</button></div> }));
vi.mock('../components/ProjectExportDialog', () => ({ ProjectExportDialog: ({onClose}:{onClose:()=>void}) => <div role="dialog" aria-label="Project export"><button onClick={onClose}>Close export</button></div> }));

import { CollectionWorkspace } from '../screens/CollectionWorkspace';

const scene = (id: string) => ({
  id, title: `Scene ${id}`, slots: {}, settings: {}, references: [], resultMediaLinks: [],
  reviewStatus: 'unreviewed', outputs: { full: 'FULL PROMPT SECRET', compact: '', structured: '' },
});
const shot = (id: string, order: number, sceneId?: string) => ({
  id, order, code: String(order + 1).padStart(2, '0'), title: `Shot ${id}`,
  takeSceneIds: sceneId ? [sceneId] : [], selectedSceneId: sceneId,
  status: sceneId ? 'prompt_ready' : 'planned',
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
  state.hashPath = '/collections/c?tab=storyboard&view=grid&sort=order&filter=';
  state.snapshot = {
    collections: [{ id: 'c', name: 'Late Again', description: 'A small film', members: [],
      project: { version: 1, revision: 4, shots: [shot('a', 0, 's1'), shot('b', 1), shot('c', 2, 'lost')] } }],
    scenes: [scene('s1')], assets: [], variants: [], media: [],
  };
});

describe('CollectionWorkspace storyboard', () => {
  it('keeps secondary shot actions collapsed with keyboard access and a separate drag grip', () => {
    render(<CollectionWorkspace collectionId="c" />);
    expect(screen.getByRole('button',{name:'Edit Shot a'})).not.toBeVisible();
    const more=screen.getByLabelText('More actions for Shot a');
    fireEvent.click(more);
    expect(screen.getByRole('button',{name:'Edit Shot a'})).toBeVisible();
    expect(screen.getByRole('button',{name:'Move Shot a down'})).toBeVisible();
    fireEvent.keyDown(more,{key:'Escape'});
    expect(screen.getByRole('button',{name:'Edit Shot a'})).not.toBeVisible();
    const grip=screen.getByRole('button',{name:'Drag Shot a to reorder'});
    expect(grip).toHaveAttribute('draggable','true');
    expect(grip.closest('article')).not.toHaveAttribute('draggable','true');
  });

  it('previews video with native controls without navigating, saving or retaining a duplicate thumbnail player', async () => {
    const media={id:'movie',filename:'synthetic.webm',mimeType:'video/webm',blob:new Blob(['fixture']),byteSize:7,createdAt:''};
    state.snapshot.media=[media];
    state.snapshot.scenes[0].resultMediaLinks=[{mediaId:media.id,role:'result',order:0,altText:'Synthetic video'}];
    const before=JSON.stringify(state.snapshot);
    render(<CollectionWorkspace collectionId="c" />);
    const card=screen.getByRole('heading',{name:'Shot a'}).closest('article')!;
    fireEvent.click(within(card).getByRole('button',{name:'Preview media: Shot a'}));
    const dialog=screen.getByRole('dialog',{name:'Media: Shot a'});
    expect(dialog.querySelector('video')).toHaveAttribute('controls');
    expect(card.querySelector('video')).toBeNull();
    expect(state.navigate).not.toHaveBeenCalled();
    expect(actions.update).not.toHaveBeenCalled();
    expect(JSON.stringify(state.snapshot)).toBe(before);
  });
  it('selects only visible shots and can clear a bulk selection without changing snapshots', () => {
    const before=JSON.stringify(state.snapshot);
    render(<CollectionWorkspace collectionId="c" />);
    fireEvent.change(screen.getByPlaceholderText('Code or title'),{target:{value:'Shot b'}});
    fireEvent.click(screen.getByRole('checkbox',{name:'Select all visible shots'}));
    expect(screen.getByLabelText('Selected shot IDs')).toHaveTextContent('b');
    expect(screen.getByRole('checkbox',{name:'Select shot Shot b'})).toBeChecked();
    fireEvent.click(screen.getByRole('button',{name:'Clear shot selection'}));
    expect(screen.getByRole('checkbox',{name:'Select shot Shot b'})).not.toBeChecked();
    expect(JSON.stringify(state.snapshot)).toBe(before);
  });
  it('opens project export as its own dialog and clears selection on a different project', () => {
    state.snapshot.collections.push({...state.snapshot.collections[0],id:'other',name:'Other'});
    const {rerender}=render(<CollectionWorkspace collectionId="c" />);
    fireEvent.click(screen.getByRole('checkbox',{name:'Select shot Shot a'}));
    fireEvent.click(screen.getByRole('button',{name:'Export Project'}));
    expect(screen.getByRole('dialog',{name:'Project export'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Close export'}));
    rerender(<CollectionWorkspace collectionId="other" />);
    expect(screen.getByRole('checkbox',{name:'Select shot Shot a'})).not.toBeChecked();
  });
  it('shows planned and missing shots without exposing full prompt text', () => {
    render(<CollectionWorkspace collectionId="c" />);
    expect(screen.getByRole('heading', { name: 'Late Again' })).toBeInTheDocument();
    expect(screen.getByText('Shot b')).toBeInTheDocument();
    expect(screen.getByText('Saved scene missing (lost)')).toBeInTheDocument();
    expect(screen.queryByText('FULL PROMPT SECRET')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Storyboard/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('edits only changed fields and cancel leaves storage untouched', async () => {
    render(<CollectionWorkspace collectionId="c" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Shot a' }));
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '03A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(actions.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Shot a' }));
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '03A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Shot' }));
    await waitFor(() => expect(actions.update).toHaveBeenCalledWith({
      collectionId: 'c', shotId: 'a', patch: { code: '03A' },
    }));
  });

  it('moves a shot through full canonical order and sends expected revision', async () => {
    render(<CollectionWorkspace collectionId="c" />);
    fireEvent.click(screen.getByRole('button', { name: 'Move Shot b up' }));
    await waitFor(() => expect(actions.reorder).toHaveBeenCalledWith({
      collectionId: 'c', orderedShotIds: ['b', 'a', 'c'], expectedRevision: 4,
    }));
  });

  it('uses collection route context when opening a saved take', () => {
    render(<CollectionWorkspace collectionId="c" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Shot a' }));
    expect(state.navigate).toHaveBeenCalledWith(expect.stringContaining('shot=a'));
  });

  it('changes status without rewriting other shot metadata', async () => {
    render(<CollectionWorkspace collectionId="c" />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Status for Shot a' }), { target: { value: 'reviewed' } });
    await waitFor(() => expect(actions.update).toHaveBeenCalledWith({
      collectionId: 'c', shotId: 'a', patch: { status: 'reviewed' },
    }));
  });

  it('saves planned duration and keeps keyboard tab navigation available', async () => {
    render(<CollectionWorkspace collectionId="c" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Shot b' }));
    fireEvent.change(screen.getByLabelText('Planned duration (seconds)'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Shot' }));
    await waitFor(() => expect(actions.update).toHaveBeenCalledWith({
      collectionId: 'c', shotId: 'b', patch: { plannedDurationSeconds: 12 },
    }));
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Storyboard' }), { key: 'ArrowRight' });
    expect(state.navigate).toHaveBeenCalledWith(expect.stringContaining('tab=characters'));
  });

  it('requires confirmation before removing a shot and keeps source scenes', async () => {
    render(<CollectionWorkspace collectionId="c" />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Shot a' }));
    expect(screen.getByText(/Source saved scenes and their prompts are kept/)).toBeInTheDocument();
    expect(actions.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Shot' }));
    await waitFor(() => expect(actions.remove).toHaveBeenCalledWith({ collectionId: 'c', shotId: 'a' }));
  });

  it('shows a missing legacy scene association before project initialization', () => {
    state.snapshot.collections[0] = {
      id: 'c', name: 'Legacy', description: '',
      members: [{ type: 'scene', id: 'gone', addedAt: '2026-01-01' }],
    };
    render(<CollectionWorkspace collectionId="c" />);
    expect(screen.getByText('Saved scene missing (gone)')).toBeInTheDocument();
  });

  it('returns from Manage Takes to the unsaved shot edit', () => {
    render(<CollectionWorkspace collectionId="c" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Shot a' }));
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '03A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Manage Takes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close Takes' }));
    expect(screen.getByLabelText('Code')).toHaveValue('03A');
  });

  it('does not offer an invalid source route for a template character snapshot', () => {
    state.hashPath = '/collections/c?tab=characters';
    state.snapshot.scenes[0].slots.character = {
      slot: 'character', sourceType: 'template', sourceId: 'tpl', sourceTitle: 'Template character',
      sourceRevision: 1, promptText: '', mediaLinks: [],
    };
    render(<CollectionWorkspace collectionId="c" />);
    expect(screen.getByText('Template character')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open source' })).not.toBeInTheDocument();
  });

  it('opens storyboard by default for a legacy scene collection and maps old tabs', () => {
    state.snapshot.collections[0].members = [{ type: 'scene', id: 's1', addedAt: '2026-01-01' }];
    state.hashPath = '/collections/c';
    const view = render(<CollectionWorkspace collectionId="c" />);
    expect(screen.getByRole('tab', { name: 'Storyboard' })).toHaveAttribute('aria-selected', 'true');
    state.hashPath = '/collections/c?tab=scenes';
    view.rerender(<CollectionWorkspace collectionId="c" />);
    expect(screen.getByRole('tab', { name: 'Storyboard' })).toHaveAttribute('aria-selected', 'true');
    state.hashPath = '/collections/c?tab=variants';
    view.rerender(<CollectionWorkspace collectionId="c" />);
    expect(screen.getByRole('tab', { name: 'Assets' })).toHaveAttribute('aria-selected', 'true');
  });

  it('does not revert status or duration changed elsewhere while editing title', async () => {
    const view = render(<CollectionWorkspace collectionId="c" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Shot a' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New title' } });
    state.snapshot = { ...state.snapshot, collections: [{ ...state.snapshot.collections[0], project: {
      ...state.snapshot.collections[0].project,
      shots: [{ ...state.snapshot.collections[0].project.shots[0], status: 'reviewed', plannedDurationSeconds: 12 }, ...state.snapshot.collections[0].project.shots.slice(1)],
    } }] };
    view.rerender(<CollectionWorkspace collectionId="c" />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Shot' }));
    await waitFor(() => expect(actions.update).toHaveBeenCalledWith({
      collectionId: 'c', shotId: 'a', patch: { title: 'New title' },
    }));
  });

  it('deletes only the collection after shared confirmation', async () => {
    state.hashPath = '/collections/c?tab=details';
    render(<CollectionWorkspace collectionId="c" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Collection' }));
    expect(actions.deleteCollection).not.toHaveBeenCalled();
    const confirm = state.openConfirmDialog.mock.calls[0][0];
    expect(confirm.message).toMatch(/scenes.*kept in your library/i);
    await confirm.onConfirm();
    expect(actions.deleteCollection).toHaveBeenCalledWith('c');
    expect(state.refreshSnapshot).toHaveBeenCalled();
    expect(state.closeConfirmDialog).toHaveBeenCalled();
    expect(state.navigate).toHaveBeenCalledWith('/collections');
  });
});
