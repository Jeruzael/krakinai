import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Collection, SavedScene } from '../types/domain';
import { legacyScene } from './fixtures/legacyScene';
import { ProjectContinuityPanel } from '../components/ProjectContinuityPanel';
import * as writes from '../storage/projectContinuity';

const { library } = vi.hoisted(()=>({library:{snapshot:null as unknown,setDirtyFormGuard:vi.fn()}}));
vi.mock('../context/LibraryContext',()=>({useLibrary:()=>library}));
vi.mock('../storage/projectContinuity',()=>({updateWardrobeIntent:vi.fn(),updateProjectFrames:vi.fn(),uploadProjectFrame:vi.fn(),upsertProjectTransition:vi.fn(),removeProjectTransition:vi.fn()}));
function setup() {
 const scenes:SavedScene[]=['a','b'].map(id=>({...structuredClone(legacyScene),id}));
 const collection:Collection={id:'p',name:'Synthetic project',description:'',members:[],createdAt:'',updatedAt:'',project:{version:1,revision:7,shots:scenes.map((s,i)=>({id:'shot-'+s.id,order:i,code:String(i+8),title:'Shot '+s.id,takeSceneIds:[s.id],selectedSceneId:s.id,status:'planned',...(i===1?{firstFrameMediaId:'missing-image'}:{})}))}};
 library.snapshot={scenes,media:[]};
 const mounted=render(<ProjectContinuityPanel collection={collection} onChanged={vi.fn().mockResolvedValue(undefined)}/>);
 return {collection,scenes,user:userEvent.setup(),mounted};
}
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('opens focused Overview and optional saved blocking inspection without writes',async()=>{
 const {user}=setup();
 expect(screen.getByRole('tab',{name:'Overview'})).toHaveAttribute('aria-selected','true');
 await user.click(screen.getByRole('tab',{name:'Blocking'}));
 expect(within(screen.getByRole('tabpanel')).getByText(/No authored blocking.*optional/)).toBeVisible();
 expect(screen.getByRole('button',{name:'Edit a recipe copy'})).toBeVisible();
 expect(screen.queryByRole('button',{name:/Save blocking/})).not.toBeInTheDocument();
 expect(writes.updateProjectFrames).not.toHaveBeenCalled();
});
it('retains the exact selected shot when filters hide it',async()=>{
 const {user}=setup();
 await user.type(screen.getByRole('searchbox',{name:'Find a shot'}),'Shot b');
 expect(screen.getByText(/selected shot is outside/i)).toBeVisible();
 expect(within(screen.getByRole('complementary',{name:'Selected shot inspector'})).getByText(/8 Shot a/)).toBeVisible();
 expect(writes.updateWardrobeIntent).not.toHaveBeenCalled();
});
it('preserves dirty notes on cancelled discard and failed saves',async()=>{
 const {user}=setup();
 await user.click(screen.getByRole('button',{name:'Review wardrobe'}));
 const notes=screen.getByRole('textbox',{name:'Continuity notes'});
 await user.type(notes,'Keep this unsaved note');
 await user.click(screen.getByRole('button',{name:'Cancel'}));
 await user.click(screen.getByRole('button',{name:'Keep editing'}));
 expect(screen.getByRole('textbox',{name:'Continuity notes'})).toHaveValue('Keep this unsaved note');
 vi.mocked(writes.updateWardrobeIntent).mockRejectedValueOnce(new Error('Synthetic write rejected'));
 await user.click(screen.getByRole('button',{name:'Save review'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Synthetic write rejected');
 expect(screen.getByRole('textbox',{name:'Continuity notes'})).toHaveValue('Keep this unsaved note');
 await user.click(screen.getByRole('button',{name:'Cancel'}));
 await user.click(screen.getByRole('button',{name:'Discard changes'}));
});
it('keeps frozen wardrobe descriptions collapsed and inspects the selected shot only',async()=>{
 const {user,scenes}=setup();
 await user.click(screen.getByRole('tab',{name:'Wardrobe'}));
 expect(screen.getByRole('table',{name:'Character wardrobe continuity'})).toBeVisible();
 const description=screen.getByText(scenes[0].slots.wardrobe!.promptText);
 expect(description).not.toBeVisible();
 await user.click(screen.getByText('Frozen wardrobe description'));
 expect(description).toBeVisible();
});
it('recovers unsaved review text after an unmount such as browser Back without writing',async()=>{
 const {user,collection,mounted}=setup();
 await user.click(screen.getByRole('button',{name:'Review wardrobe'}));
 await user.type(screen.getByRole('textbox',{name:'Continuity notes'}),'Recover across browser Back');
 mounted.unmount();
 render(<ProjectContinuityPanel collection={collection} onChanged={vi.fn().mockResolvedValue(undefined)}/>);
 expect(screen.getByRole('textbox',{name:'Continuity notes'})).toHaveValue('Recover across browser Back');
 expect(writes.updateWardrobeIntent).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Cancel'}));
 await user.click(screen.getByRole('button',{name:'Discard changes'}));
});
it('blocks a review opened against a stale project revision without losing its text',async()=>{
 const {user,collection,mounted}=setup();
 await user.click(screen.getByRole('button',{name:'Review wardrobe'}));
 await user.type(screen.getByRole('textbox',{name:'Continuity notes'}),'Original target notes');
 mounted.rerender(<ProjectContinuityPanel collection={{...collection,project:{...collection.project!,revision:8}}} onChanged={vi.fn()}/>);
 await user.click(screen.getByRole('button',{name:'Save review'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Project changed');
 expect(screen.getByRole('textbox',{name:'Continuity notes'})).toHaveValue('Original target notes');
 expect(writes.updateWardrobeIntent).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Cancel'}));
 await user.click(screen.getByRole('button',{name:'Discard changes'}));
});
it('guards frame clearing when browser history exposes Frames beneath a dirty review',async()=>{
 const {user,collection,mounted}=setup();collection.project!.shots[0].lastFrameMediaId='synthetic-image';
 mounted.rerender(<ProjectContinuityPanel collection={collection} view="wardrobe" onChanged={vi.fn()}/>);
 await user.click(screen.getByRole('button',{name:'Review wardrobe'}));
 await user.type(screen.getByRole('textbox',{name:'Continuity notes'}),'Retain until explicit discard');
 mounted.rerender(<ProjectContinuityPanel collection={collection} view="frames" onChanged={vi.fn()}/>);
 await user.click(screen.getByRole('button',{name:'Clear'}));
 expect(writes.updateProjectFrames).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Keep editing'}));
 expect(screen.getByRole('textbox',{name:'Continuity notes'})).toHaveValue('Retain until explicit discard');
 await user.click(screen.getByRole('button',{name:'Cancel'}));
 await user.click(screen.getByRole('button',{name:'Discard changes'}));
});
