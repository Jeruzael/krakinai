import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { clearAllStoresForTesting, createCollection, getAllSnapshot, initializeDatabase, loadStarterLibrary, saveMediaAsset, saveSceneDraft, saveSceneFromDraft } from '../storage/db';
import { addProjectShot, updateProjectShot } from '../storage/projects';
import { startProjectShotDraft } from '../domain/projectRoutes';
import { createSnapshotFromAsset } from '../domain/promptAssembler';

beforeEach(async () => { await clearAllStoresForTesting(); await initializeDatabase(); });
afterEach(cleanup);

describe('Shot Type builder controls', () => {
  it('switches requirements immediately, retains inactive slots, and restores them on return', async () => {
    await loadStarterLibrary();
    const snapshot = await getAllSnapshot();
    const character = createSnapshotFromAsset(snapshot.assets.find(asset => asset.category === 'characters')!);
    const environment = createSnapshotFromAsset(snapshot.assets.find(asset => asset.category === 'environments')!);
    const original = await saveMediaAsset({filename:'preserved-floor-plan.png',mimeType:'image/png',blob:new Blob(['png'],{type:'image/png'})});
    const draft = await saveSceneDraft({ title: 'MIDORI / 03 — Floor Plan', sourceMediaLinks:[{mediaId:original.id,filename:original.filename,mimeType:original.mimeType,role:'reference',order:0,altText:'Original floor plan'}], slots: { character, environment }, extraRequiredSlots: ['wardrobe'], sceneInstructions: '', settings: {}, manualOutputs: {}, resultMediaLinks: [], reviewNotes: '', reviewStatus: 'unreviewed' });
    window.location.hash = `#/builder/${draft.id}`;
    render(<App />);
    const shotType = await screen.findByLabelText('Shot Type');
    fireEvent.change(shotType, { target: { value: 'graphic_motion' } });
    expect(screen.getByText('No required component assets')).toBeInTheDocument();
    expect(screen.getAllByTestId('recipe-row')).toHaveLength(7);
    const characterRow = screen.getAllByTestId('recipe-row')[0];
    expect(within(characterRow).getByText('Not Applicable')).toBeInTheDocument();
    expect(within(characterRow).getByText(/Preserved for other shot types/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Character Identity Source')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Animation Instructions (Required)')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/^Dialogue/, {selector:'summary'}));
    fireEvent.change(screen.getByLabelText('Dialogue Mode'),{target:{value:'voiceover'}});
    fireEvent.change(screen.getByLabelText('Speaker Label'),{target:{value:'Narrator'}});
    fireEvent.change(screen.getByLabelText('Exact Spoken Line (Preserved verbatim)'),{target:{value:'Two bedrooms.\nRoom to grow.'}});
    expect(screen.getByText('No required component assets')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(async () => {
      const saved = (await getAllSnapshot()).drafts.find(item => item.id === draft.id)!;
      expect(saved.shotType).toBe('graphic_motion');
      expect(saved.slots).toEqual(draft.slots);
      expect(saved.sourceMediaLinks).toEqual(draft.sourceMediaLinks);
      expect(saved.dialogue?.line).toBe('Two bedrooms.\nRoom to grow.');
    });
    fireEvent.change(shotType, { target: { value: 'character_scene' } });
    expect(screen.getByLabelText('Character Identity Source')).toBeInTheDocument();
    expect(within(characterRow).queryByText('Not Applicable')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region',{name:'Reference Board'})).queryByText(original.filename)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Save Draft'}));
    await waitFor(async()=>expect((await getAllSnapshot()).drafts.find(item=>item.id===draft.id)?.shotType).toBe('character_scene'));
  });

  it('reuses original media IDs, previews and removes sources without changing the binary', async () => {
    const original = await saveMediaAsset({ filename: 'MIDORI two-bedroom original.png', mimeType: 'image/png', blob: new Blob(['original-png-bytes'], { type: 'image/png' }) });
    const draft = await saveSceneDraft({ shotType: 'graphic_motion', title: 'Floor Plan', slots: {}, extraRequiredSlots: [], sceneInstructions: 'Preserve geometry.', settings: {}, manualOutputs: {}, resultMediaLinks: [], reviewNotes: '', reviewStatus: 'unreviewed' });
    window.location.hash = `#/builder/${draft.id}`;
    render(<App />);
    fireEvent.change(await screen.findByLabelText('Existing source media'), { target: { value: original.id } });
    await waitFor(async () => expect((await getAllSnapshot()).drafts.find(item => item.id === draft.id)?.sourceMediaLinks?.[0].mediaId).toBe(original.id));
    expect(within(screen.getByRole('region', {name:/^Source Media/})).getByText(original.filename, {selector:'strong'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview original source' }));
    expect(screen.getByRole('dialog', { name: `Media: ${original.filename}` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `Close Media: ${original.filename}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove source media' }));
    await waitFor(async () => expect((await getAllSnapshot()).drafts.find(item => item.id === draft.id)?.sourceMediaLinks).toEqual([]));
    const stored = (await getAllSnapshot()).media;
    expect(stored).toHaveLength(1);
    expect(stored[0].blob).toEqual(original.blob);
    expect(stored[0].filename).toBe(original.filename);
  });
});

describe('Shot Type storyboard planning', () => {
  it('treats the saved take as authoritative, displays mismatches, and starts a copy with its type', async () => {
    const media = await saveMediaAsset({ filename: 'original.png', mimeType: 'image/png', blob: new Blob(['png'], {type:'image/png'}) });
    const draft = await saveSceneDraft({ shotType:'graphic_motion', sourceMediaLinks:[{mediaId:media.id,role:'reference',order:0,altText:'Floor plan',mimeType:media.mimeType,filename:media.filename}], title:'Floor Plan',slots:{},extraRequiredSlots:[],sceneInstructions:'Preserve the original geometry.',settings:{durationSeconds:4},manualOutputs:{},resultMediaLinks:[],reviewNotes:'',reviewStatus:'unreviewed' });
    const scene = await saveSceneFromDraft(draft.id);
    const collection = await createCollection({name:'MIDORI'});
    const added = await addProjectShot({collectionId:collection.id,sceneId:scene.id,plannedShotType:'property_environment'});
    const shot = added.project!.shots[0];
    window.location.hash = `#/collections/${collection.id}?tab=storyboard`;
    render(<App />);
    expect(await screen.findByText(/Planned as Property \/ Environment; selected saved take uses Graphic \/ Motion Design/)).toHaveTextContent('The saved take is authoritative.');
    cleanup();
    const route = await startProjectShotDraft(collection.id,shot.id);
    const copyId = decodeURIComponent(route.split('?')[0].split('/').pop()!);
    const snapshot = await getAllSnapshot();
    expect(snapshot.drafts.find(item=>item.id===copyId)?.shotType).toBe('graphic_motion');
    expect(snapshot.collections.find(item=>item.id===collection.id)?.project?.shots[0].plannedShotType).toBe('property_environment');
  });

  it('persists optional planning metadata, starts an empty draft with it, and clears it reversibly', async () => {
    const collection = await createCollection({ name: 'MIDORI' });
    const added = await addProjectShot({ collectionId: collection.id, title: 'Floor plan', plannedShotType: 'graphic_motion' });
    const shot = added.project!.shots[0];
    expect(shot.plannedShotType).toBe('graphic_motion');
    const route = await startProjectShotDraft(collection.id, shot.id);
    const draftId = decodeURIComponent(route.split('?')[0].split('/').pop()!);
    expect((await getAllSnapshot()).drafts.find(draft=>draft.id===draftId)?.shotType).toBe('graphic_motion');
    const changed = await updateProjectShot({ collectionId: collection.id, shotId: shot.id, patch: { plannedShotType: null } });
    expect(changed.project!.shots[0].plannedShotType).toBeUndefined();
  });

  it('lets users specify an intended shot type when planning a shot', async () => {
    const collection = await createCollection({ name: 'MIDORI' });
    window.location.hash = `#/collections/${collection.id}?tab=storyboard`;
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Planned Shot' }));
    fireEvent.change(screen.getByLabelText('Planned Shot Type'), { target: { value: 'graphic_motion' } });
    fireEvent.change(screen.getByLabelText('Shot title'), { target: { value: 'Floor plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Shot' }));
    await waitFor(async () => expect((await getAllSnapshot()).collections.find(item => item.id === collection.id)?.project?.shots[0].plannedShotType).toBe('graphic_motion'));
    expect(await screen.findByText('Graphic / Motion Design')).toBeInTheDocument();
  });
});
