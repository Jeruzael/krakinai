import React from 'react';
import {it,expect,afterEach,vi} from 'vitest';
import {render,screen,cleanup,waitFor,act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import * as db from '../storage/db';
import {seedBlockingStorage} from './fixtures/blockingStorageFixture';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('preserves newer typing when an earlier draft save completes, and saves the latest blocking draft using the returned revision',async()=>{
 const {draft}=await seedBlockingStorage();window.location.hash=`#/builder/${draft.id}`;render(<App/>);await screen.findByRole('heading',{name:'Scene Builder'},{timeout:10000});
 const real=db.saveSceneDraft;let release!:()=>void,started!:()=>void;const pending=new Promise<void>(r=>release=r),begun=new Promise<void>(r=>started=r);
 vi.spyOn(db,'saveSceneDraft').mockImplementationOnce(async(...args)=>{const saved=await real(...args);started();await pending;return saved;});
 const user=userEvent.setup(),title=screen.getByRole('textbox',{name:'Scene Title *'});
 await user.clear(title);await user.type(title,'Earlier title');await begun;
 await user.clear(title);await user.type(title,'Newer local title');await act(async()=>{release();await pending;});
 expect(title).toHaveValue('Newer local title');
 await user.click(screen.getByRole('button',{name:'Save Draft'}));
 await waitFor(async()=>{const stored=(await db.getAllSnapshot()).drafts.find(d=>d.id===draft.id)!;expect(stored.title).toBe('Newer local title');expect(stored.blocking).toEqual(draft.blocking);});
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
},15000);
it('waits for the own pending autosave before opening Blocking, then saves a new blocking edit against the stored revision',async()=>{
 const {draft}=await seedBlockingStorage();window.location.hash=`#/builder/${draft.id}`;render(<App/>);await screen.findByRole('heading',{name:'Scene Builder'},{timeout:10000});
 const real=db.saveSceneDraft;let release!:()=>void,started!:()=>void;const pending=new Promise<void>(r=>release=r),begun=new Promise<void>(r=>started=r);
 vi.spyOn(db,'saveSceneDraft').mockImplementationOnce(async(...args)=>{const saved=await real(...args);started();await pending;return saved;});
 const user=userEvent.setup(),title=screen.getByRole('textbox',{name:'Scene Title *'}),edit=screen.getByRole('button',{name:'Edit blocking'});
 await user.type(title,' edited');await begun;
 try{expect(edit).toBeDisabled();}finally{await act(async()=>{release();await pending;});}
 await waitFor(()=>expect(edit).toBeEnabled());await user.click(edit);await user.click(screen.getByRole('tab',{name:'End'}));await user.selectOptions(screen.getByRole('combobox',{name:'Head direction'}),JSON.stringify({kind:'screen',direction:'away_left'}));await user.click(screen.getByRole('button',{name:'Save blocking draft'}));
 await waitFor(async()=>expect((await db.getAllSnapshot()).drafts.find(d=>d.id===draft.id)!.blocking!.participants[0].end!.headDirection).toEqual({kind:'screen',direction:'away_left'}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
},15000);
