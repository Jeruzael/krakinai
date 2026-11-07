import React from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
const state=vi.hoisted(()=>({snapshot:null as any,browseState:{query:'',selectedTags:[],reviewFilter:'all',sortBy:'az',visibleCount:24,scrollY:0},navigate:vi.fn(),updateBrowseState:vi.fn(),refreshSnapshot:vi.fn(),showToast:vi.fn(),copyText:vi.fn(),openCollectionModal:vi.fn(),openConfirmDialog:vi.fn(),closeConfirmDialog:vi.fn()}));
const archiveMock=vi.hoisted(()=>vi.fn());
vi.mock('../storage/projectBulk',async(importOriginal)=>{
 const actual=await importOriginal<typeof import('../storage/projectBulk')>();
 return {...actual,bulkSetScenesArchived:archiveMock};
});
vi.mock('../context/LibraryContext',()=>({useLibrary:()=>state}));
vi.mock('../components/CollectionMembershipBadge',()=>({CollectionMembershipBadge:()=>null}));
vi.mock('../components/SceneBulkActions',()=>({SceneBulkActions:({selectedSceneIds,onClear}:{selectedSceneIds:string[];onClear:()=>void})=><section aria-label="Bulk scene IDs">{selectedSceneIds.join(',')}<button onClick={onClear}>Clear selected scenes</button></section>}));
import {LibraryScreen} from '../screens/LibraryScreen';
beforeEach(()=>{state.snapshot={assets:[],variants:[],media:[],collections:[],scenes:['Aya','Marco'].map((name,index)=>({id:`s${index}`,title:name,outputs:{full:`Exact ${name} output`},slots:{},settings:{},references:[],resultMediaLinks:[],reviewNotes:'',reviewStatus:'unreviewed',updatedAt:'2026-10-26'}))};});
it('selects only the filtered scenes, prunes deleted records and clears on a different library context',()=>{
 const before=JSON.stringify(state.snapshot);const {rerender}=render(<LibraryScreen mode="scenes"/>);
 fireEvent.change(screen.getByPlaceholderText('Search saved scenes by title, prompt text, or notes...'),{target:{value:'Marco'}});
 fireEvent.click(screen.getByRole('checkbox',{name:'Select all visible scenes'}));
 expect(screen.getByLabelText('Bulk scene IDs')).toHaveTextContent('s1');
 expect(JSON.stringify(state.snapshot)).toBe(before);
 state.snapshot={...state.snapshot,scenes:[state.snapshot.scenes[0]]};rerender(<LibraryScreen mode="scenes"/>);
 expect(screen.getByLabelText('Bulk scene IDs')).not.toHaveTextContent('s1');
 fireEvent.change(screen.getByPlaceholderText('Search saved scenes by title, prompt text, or notes...'),{target:{value:''}});
 fireEvent.click(screen.getByRole('checkbox',{name:'Select scene Aya'}));
 rerender(<LibraryScreen mode="all"/>);rerender(<LibraryScreen mode="scenes"/>);
 expect(screen.getByRole('checkbox',{name:'Select scene Aya'})).not.toBeChecked();
});

it('filters active and archived scenes, prunes selection on filter change, and supports per-card archive/unarchive', async () => {
 archiveMock.mockResolvedValue([]);
 state.snapshot = {
   assets: [],
   variants: [],
   media: [],
   collections: [],
   scenes: [
     { id: 'active-1', title: 'Active Scene', outputs: { full: 'Prompt 1' }, slots: {}, settings: {}, references: [], resultMediaLinks: [], reviewNotes: '', reviewStatus: 'unreviewed', updatedAt: '2026-10-26' },
     { id: 'archived-1', title: 'Archived Scene', archivedAt: '2026-11-07T12:00:00.000Z', outputs: { full: 'Prompt 2' }, slots: {}, settings: {}, references: [], resultMediaLinks: [], reviewNotes: '', reviewStatus: 'unreviewed', updatedAt: '2026-10-26' },
   ],
 };

 const { rerender } = render(<LibraryScreen mode="scenes" />);
 // Default is active scenes
 expect(screen.getByText('Active Scene')).toBeInTheDocument();
 expect(screen.queryByText('Archived Scene')).not.toBeInTheDocument();

 // Select the active scene
 fireEvent.click(screen.getByRole('checkbox', { name: 'Select scene Active Scene' }));
 expect(screen.getByLabelText('Bulk scene IDs')).toHaveTextContent('active-1');

 // Archive per-card button
 const archiveBtn = screen.getByRole('button', { name: 'Archive saved scene Active Scene' });
 fireEvent.click(archiveBtn);
 expect(archiveMock).toHaveBeenCalledWith({ sceneIds: ['active-1'], archived: true });

 // Switch filter to archived scenes
 fireEvent.change(screen.getByLabelText('Filter saved scenes'), { target: { value: 'archived' } });
 expect(screen.queryByText('Active Scene')).not.toBeInTheDocument();
 expect(screen.getByText('Archived Scene')).toBeInTheDocument();
 expect(screen.getByText('Archived')).toBeInTheDocument();
 // active-1 was pruned from selection because it's not visible
 expect(screen.getByLabelText('Bulk scene IDs')).not.toHaveTextContent('active-1');

 // Unarchive per-card button
 const unarchiveBtn = screen.getByRole('button', { name: 'Unarchive saved scene Archived Scene' });
 fireEvent.click(unarchiveBtn);
 expect(archiveMock).toHaveBeenCalledWith({ sceneIds: ['archived-1'], archived: false });

 // Switch to all scenes
 fireEvent.change(screen.getByLabelText('Filter saved scenes'), { target: { value: 'all' } });
 expect(screen.getByText('Active Scene')).toBeInTheDocument();
 expect(screen.getByText('Archived Scene')).toBeInTheDocument();
});
