import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,waitFor,cleanup,act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import * as db from '../storage/db';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('saves only the explicit frame-plan draft changes and preserves saved takes, references and files',async()=>{
 const f=await seedKeyframeStorage(),before=await db.getAllSnapshot();window.location.hash=`#/builder/${f.draft.id}`;render(<App/>);await screen.findByRole('heading',{name:'Scene Builder'});const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Image Frames · 3 planned'}));const label=screen.getByRole('textbox',{name:'Frame label'});await user.clear(label);await user.type(label,'Start reviewed label');await user.click(screen.getByRole('button',{name:'Save frame plan'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 const after=await db.getAllSnapshot(),draft=after.drafts.find(d=>d.id===f.draft.id)!;expect(draft.keyframePlan!.frames[0].label).toBe('Start reviewed label');expect(draft.inputRevision).toBe(f.draft.inputRevision+1);expect(draft.imagePromptSnapshots).toEqual(f.draft.imagePromptSnapshots);expect(after.scenes).toEqual(before.scenes);expect(after.media).toEqual(before.media);expect(after.collections).toEqual(before.collections);expect(draft.referencePack).toEqual(f.draft.referencePack);
});
it('waits for a pending own autosave before opening and saving frame controls',async()=>{
 const f=await seedKeyframeStorage();window.location.hash=`#/builder/${f.draft.id}`;render(<App/>);await screen.findByRole('heading',{name:'Scene Builder'});const real=db.saveSceneDraft;let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);
 vi.spyOn(db,'saveSceneDraft').mockImplementationOnce(async(...args)=>{const stored=await real(...args);entered();await gate;return stored;});const user=userEvent.setup(),open=screen.getByRole('button',{name:'Image Frames · 3 planned'});await user.type(screen.getByRole('textbox',{name:'Scene Title *'}),' edited');await started;try{expect(open).toBeDisabled();}finally{await act(async()=>{release();await gate;});}await waitFor(()=>expect(open).toBeEnabled());await user.click(open);await user.type(screen.getByRole('textbox',{name:'Frame visual instructions'}),' Freeze this exact moment.');await user.click(screen.getByRole('button',{name:'Save frame plan'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect((await db.getAllSnapshot()).drafts.find(d=>d.id===f.draft.id)!.keyframePlan!.frames[0].visualInstructions).toContain('Freeze this exact moment.');
},15000);
