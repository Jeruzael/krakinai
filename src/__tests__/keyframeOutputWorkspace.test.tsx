import React from 'react';
import {it,expect,afterEach,vi} from 'vitest';
import {render,screen,cleanup,waitFor,act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {getAllSnapshot} from '../storage/db';
import rasters from './fixtures/frame-raster-fixtures.json';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('opens legacy output URLs on Video Prompt and separates complete per-frame prompts without changing the take',async()=>{
 const f=await seedKeyframeStorage(),before=await getAllSnapshot();window.location.hash=`#/output/${f.parent.id}`;render(<App/>);const user=userEvent.setup();
 expect(await screen.findByRole('tab',{name:'Video Prompt'})).toHaveAttribute('aria-selected','true');
 await user.click(screen.getByRole('tab',{name:'Image Frames'}));await user.click(await screen.findByRole('tab',{name:/middle/}));
 await waitFor(()=>expect(screen.getByRole('textbox',{name:'Complete image prompt'})).toHaveValue(f.parent.imagePromptSnapshots!.middle.full));
 await user.click(screen.getByRole('tab',{name:'References'}));await user.click(screen.getByRole('tab',{name:'Review'}));
 expect(await getAllSnapshot()).toEqual(before);
});
it('requires a video choice and leaves image carry-over unchecked on a new recipe take',async()=>{
 const f=await seedKeyframeStorage();window.location.hash=`#/output/${f.draft.id}`;render(<App/>);const user=userEvent.setup();await user.click(await screen.findByRole('tab',{name:'Image Frames'}));
 expect(await screen.findByLabelText('Video prompt decision')).toHaveValue('');expect(screen.getByRole('checkbox',{name:/Attach selected draft images/})).not.toBeChecked();
 expect(screen.getByRole('button',{name:'Save Scene'})).toBeDisabled();await user.selectOptions(screen.getByLabelText('Video prompt decision'),'keep_exact_unverified');
 await waitFor(()=>expect(screen.getByRole('button',{name:'Save Scene'})).toBeEnabled());
});
it('honors explicit frame workspace links when navigating between takes without a full page load',async()=>{
 const f=await seedKeyframeStorage();window.location.hash=`#/output/${f.parent.id}`;render(<App/>);await screen.findByRole('tab',{name:'Video Prompt'});
 act(()=>{window.location.hash=`#/output/${f.draft.id}?outputTab=frames`;window.dispatchEvent(new HashChangeEvent('hashchange'));});
 await waitFor(()=>expect(screen.getByRole('tab',{name:'Image Frames'})).toHaveAttribute('aria-selected','true'));expect(screen.getByRole('button',{name:'Edit frame plan'})).toBeVisible();
});
it('opens and saves the shared frame editor directly from the output workspace',async()=>{
 const f=await seedKeyframeStorage();window.location.hash=`#/output/${f.draft.id}?outputTab=frames`;render(<App/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Edit frame plan'}));expect(await screen.findByRole('dialog',{name:'Image frame plan'})).toBeVisible();await user.clear(screen.getByRole('textbox',{name:'Frame label'}));await user.type(screen.getByRole('textbox',{name:'Frame label'}),'Start changed explicitly');await user.click(screen.getByRole('button',{name:'Save frame plan'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect((await getAllSnapshot()).drafts.find(d=>d.id===f.draft.id)!.keyframePlan!.frames[0].label).toBe('Start changed explicitly');
});
it('preserves an unsaved manual image buffer and blocks saving it against a changed draft revision',async()=>{
 const f=await seedKeyframeStorage();window.location.hash=`#/output/${f.draft.id}?outputTab=frames`;render(<App/>);const user=userEvent.setup();await user.click(await screen.findByRole('tab',{name:/Middle middle/}));const edit=screen.getByRole('button',{name:'Edit manual image prompt'});await waitFor(()=>expect(edit).toBeEnabled());await user.click(edit);const buffer=screen.getByRole('textbox',{name:'Manual full image prompt'});await user.clear(buffer);await user.type(buffer,'My unsaved original buffer');
 await user.upload(screen.getByLabelText('Upload draft frame image'),new File([Uint8Array.from(atob(rasters.files[0].base64),c=>c.charCodeAt(0))],'synthetic.png',{type:'image/png'}));await screen.findByText('Draft image retained · needs review');await waitFor(()=>expect(screen.getByLabelText('Upload draft frame image')).toBeEnabled());expect(buffer).toHaveValue('My unsaved original buffer');expect(screen.getByRole('button',{name:'Save manual image text'})).toBeDisabled();expect((await getAllSnapshot()).drafts.find(d=>d.id===f.draft.id)!.manualImageOutputs?.middle).toBeUndefined();
});
it('keeps the exact selected frame in the route and does not substitute another frame for an unavailable ID',async()=>{
 const f=await seedKeyframeStorage();window.location.hash=`#/output/${f.parent.id}?outputTab=frames&frame=unavailable`;render(<App/>);await screen.findByRole('tab',{name:'Image Frames'});expect(screen.queryByRole('textbox',{name:'Complete image prompt'})).not.toBeInTheDocument();const user=userEvent.setup();await user.click(screen.getByRole('tab',{name:/Middle middle/}));await waitFor(()=>expect(window.location.hash).toContain('frame=middle'));expect(screen.getByRole('textbox',{name:'Complete image prompt'})).toHaveValue(f.parent.imagePromptSnapshots!.middle.full);
});
