import React from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { legacyScene } from './fixtures/legacyScene';
import { LibraryProvider } from '../context/LibraryContext';
import { AiConnectionProvider } from '../connections/AiConnectionContext';
import { PermissionsWorkspace } from '../components/aiConnections/PermissionsWorkspace';
import { IncomingProposals } from '../components/aiConnections/IncomingProposals';
import { PermissionRecordPicker } from '../components/aiConnections/PermissionRecordPicker';
import { clearAllStoresForTesting, initializeDatabase, getAllSnapshot, openDatabase } from '../storage/db';
import { syntheticCamera } from './fixtures/changeSetFixture';
const user = () => userEvent.setup();

it('resets a vanished category without stranding remaining inventory or losing selected IDs', async () => {
 const onSelect=vi.fn(), selected=['keep'];
 const props={field:'candidateIds' as const,title:'Candidates',selected,onSelect,disabled:false};
 const {rerender}=render(<PermissionRecordPicker {...props} items={[{id:'pending',label:'Pending item',category:'pending'},{id:'keep',label:'Approved item',category:'approved'}]}/>);
 await user().selectOptions(screen.getByLabelText('Candidates category filter'),'pending');
 expect(screen.getByLabelText('Allow Candidates: Pending item')).toBeInTheDocument();
 rerender(<PermissionRecordPicker {...props} items={[{id:'keep',label:'Approved item',category:'approved'}]}/>);
 expect(await screen.findByLabelText('Allow Candidates: Approved item')).toBeChecked();
 expect(onSelect).not.toHaveBeenCalled(); expect(selected).toEqual(['keep']);
});
beforeEach(async () => {
 await clearAllStoresForTesting(); await initializeDatabase();
 const db=await openDatabase();
 await new Promise<void>((resolve,reject)=>{const tx=db.transaction('assets','readwrite');for(let i=0;i<80;i++)tx.objectStore('assets').put({...syntheticCamera(),id:'bulk_'+i,title:(i<65?'Matching ':'Hidden ')+i,category:i%2?'camera':'lighting'});tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});
 window.location.hash='#/connections/ai';
});
afterEach(cleanup);
async function permissions(u: ReturnType<typeof user>) { render(<App/>); await screen.findByRole('heading',{name:'AI Connections'});await u.click(screen.getByRole('tab',{name:'Permissions'})); }
it('keeps connection, permissions and proposals in accessible keyboard tabs',async()=>{
 const u=user();render(<App/>);await screen.findByRole('heading',{name:'AI Connections'});
 const connection=screen.getByRole('tab',{name:'Connection'});connection.focus();await u.keyboard('{ArrowRight}');
 expect(screen.getByRole('tab',{name:'Permissions'})).toHaveFocus();
 expect(screen.getByRole('region',{name:'Applied permissions'})).toBeVisible();
 await u.keyboard('{End}');expect(screen.getByRole('tab',{name:/Incoming Proposals/})).toHaveFocus();
 expect(screen.getByRole('heading',{name:'Incoming proposals'})).toBeVisible();
});
it('stages all 65 matching records beyond the rendered page, preserves hidden selections and writes no database data',async()=>{
 const before=await getAllSnapshot(),u=user();await permissions(u);
 await u.click(screen.getByRole('button',{name:/^Reusable assets category/}));
 const query=screen.getByRole('textbox',{name:'Search Reusable assets'});await u.type(query,'Hidden 79');
 await u.click(screen.getByRole('button',{name:'Select 1 Matching'}));await u.clear(query);await u.type(query,'Matching');
 await u.click(screen.getByRole('button',{name:'Select 65 Matching'}));
 expect(screen.getByText('66 of 80 selected',{exact:true})).toBeVisible();
 expect(within(screen.getByRole('region',{name:'Applied permissions'})).getByText('0 reusable assets')).toBeVisible();
 await u.click(screen.getByRole('button',{name:'Apply Permissions'}));
 expect(within(screen.getByRole('region',{name:'Applied permissions'})).getByText('66 reusable assets')).toBeVisible();
 await u.click(screen.getByRole('button',{name:'Clear Matching Selection'}));expect(screen.getByText('1 of 80 selected',{exact:true})).toBeVisible();
 expect(await getAllSnapshot()).toEqual(before);
});
it('requires explicit full-access confirmation and leaves active permissions unchanged until Apply',async()=>{
 const u=user();await permissions(u);const trigger=screen.getByRole('button',{name:'Full Access'});await u.click(trigger);
 const dialog=screen.getByRole('dialog',{name:'Review full access'});
 expect(within(dialog).getByText(/future projects and reusable assets/i)).toBeVisible();
 await u.click(within(dialog).getByRole('button',{name:'Cancel'}));
 expect(trigger).toHaveFocus();
 expect(screen.getByRole('checkbox',{name:'Share Character identities and approved anchors'})).not.toBeChecked();
 await u.click(screen.getByRole('button',{name:'Grant Full Access'}));
 await u.click(screen.getByRole('button',{name:'Use full-access draft'}));
 expect(screen.getByRole('checkbox',{name:'Share Character identities and approved anchors'})).toBeChecked();
 expect(within(screen.getByRole('region',{name:'Applied permissions'})).getByText('0 reusable assets')).toBeVisible();
 await u.click(screen.getByRole('button',{name:'Reset changes'}));
 expect(screen.getByRole('checkbox',{name:'Share Character identities and approved anchors'})).not.toBeChecked();
});
it('ordinary Select All never enables identity, full prompts, private notes or proposal capabilities',async()=>{
 const u=user();await permissions(u);await u.click(screen.getByRole('button',{name:'Select All Records'}));
 for(const name of ['Share Character identities and approved anchors','Share ordinary asset prompt text','Share private production notes','Share media filenames','Allow change-set proposals','Allow new project creation'])expect(screen.getByRole('checkbox',{name})).not.toBeChecked();
 expect(screen.getByRole('button',{name:'Apply Permissions'})).toBeEnabled();
 await u.click(screen.getByRole('tab',{name:'Connection'}));
 expect(screen.getByRole('button',{name:'Connect Codex'})).toBeDisabled();
 await u.click(screen.getByRole('tab',{name:'Permissions'}));await u.click(screen.getByRole('button',{name:'Reset changes'}));
 await u.click(screen.getByRole('tab',{name:'Connection'}));expect(screen.getByRole('button',{name:'Connect Codex'})).toBeEnabled();
});
it('keeps identity and ordinary text separate while reviewing a privacy change',async()=>{
 const u=user();await permissions(u);await u.click(screen.getByRole('checkbox',{name:'Share ordinary asset prompt text'}));
 expect(screen.getByRole('checkbox',{name:'Share Character identities and approved anchors'})).not.toBeChecked();
 expect(screen.getByRole('region',{name:'Permission review'})).toHaveTextContent('Previously allowed');
 expect(screen.getByRole('region',{name:'Permission review'})).toHaveTextContent('Proposed');
 expect(await getAllSnapshot()).not.toHaveProperty('connectionCredentials');
});


it('rejects oversized bulk access without selecting a prefix or enabling sensitive flags',async()=>{
 const db=await openDatabase();await new Promise<void>(resolve=>{const tx=db.transaction('assets','readwrite');for(let i=80;i<501;i++)tx.objectStore('assets').put({...syntheticCamera(),id:'bulk_'+i,title:'Extra '+i});tx.oncomplete=()=>resolve();});
 const u=user();await permissions(u);await u.click(screen.getByRole('button',{name:'Select All Records'}));
 expect(screen.getByRole('alert')).toHaveTextContent('501');expect(screen.getByRole('alert')).toHaveTextContent('500');
 expect(within(screen.getByRole('region',{name:'Applied permissions'})).getByText('0 reusable assets')).toBeVisible();
 expect(screen.getByRole('checkbox',{name:'Share Character identities and approved anchors'})).not.toBeChecked();
 expect(screen.getByRole('button',{name:'Apply Permissions'})).toBeDisabled();
});


it('shows dependent full-prompt revocation before removing project access',async()=>{
 const db=await openDatabase();await new Promise<void>(resolve=>{const tx=db.transaction(['scenes','collections'],'readwrite');
 tx.objectStore('scenes').put({...structuredClone(legacyScene),id:'scope_scene',title:'Scope Scene',references:[]});
 tx.objectStore('collections').put({id:'scope_project',name:'Scope Project',description:'',members:[],createdAt:'',updatedAt:'',project:{version:1,revision:1,shots:[{id:'scope_shot',code:'01',title:'Shot',order:0,status:'planned',takeSceneIds:['scope_scene']}]}});
 tx.oncomplete=()=>resolve();});
 const u=user();await permissions(u);
 await u.click(screen.getByRole('checkbox',{name:'Allow Projects: Scope Project'}));
 await u.click(screen.getByRole('button',{name:/^Complete scene prompts category/}));
 await u.click(screen.getByRole('checkbox',{name:'Allow Complete scene prompts: Scope Scene'}));
 await u.click(screen.getByRole('button',{name:'Apply Permissions'}));
 await u.click(screen.getByRole('button',{name:/^Projects category/}));
 await u.click(screen.getByRole('checkbox',{name:'Allow Projects: Scope Project'}));
 expect(screen.getByText('1 dependent full-prompt selection(s) removed from this draft:')).toBeVisible();
 expect(within(screen.getByRole('region',{name:'Applied permissions'})).getByText('1 full prompts')).toBeVisible();
 await u.click(screen.getByRole('button',{name:'Apply Permissions'}));
 expect(within(screen.getByRole('region',{name:'Applied permissions'})).getByText('0 full prompts')).toBeVisible();
 expect((await getAllSnapshot()).scenes[0].id).toBe('scope_scene');
});


it('reports assets separately from variants and templates in the applied summary',async()=>{
 const u=user();await permissions(u);await u.click(screen.getByRole('button',{name:'Select All Records'}));await u.click(screen.getByRole('button',{name:'Apply Permissions'}));
 const summary=screen.getByRole('region',{name:'Applied permissions'});
 expect(within(summary).getByText('80 reusable assets')).toBeVisible();
 expect(within(summary).getByText('0 variants · 4 templates')).toBeVisible();
});


it('focuses the Permissions tab when opening it from the Connection shortcut',async()=>{
 const u=user();render(<App/>);await screen.findByRole('heading',{name:'AI Connections'});
 await u.click(screen.getByRole('button',{name:'Review Permissions'}));
 expect(screen.getByRole('tab',{name:'Permissions'})).toHaveFocus();
});


it('keeps a Full Access confirmation frozen when the library inventory changes',async()=>{
 const initial=await getAllSnapshot(),u=user();
 const show=(state: typeof initial)=><LibraryProvider><AiConnectionProvider><PermissionsWorkspace snapshot={state} onDirty={()=>{}}/></AiConnectionProvider></LibraryProvider>;
 const rendered=render(show(initial));await u.click(screen.getByRole('button',{name:'Grant Full Access'}));
 rendered.rerender(show({...initial,assets:[...initial.assets,{...syntheticCamera(),id:'new_after_confirmation'}]}));
 await u.click(screen.getByRole('button',{name:'Use full-access draft'}));
 expect(screen.getByRole('alert')).toHaveTextContent('library changed');
 expect(screen.getByRole('checkbox',{name:'Share Character identities and approved anchors'})).not.toBeChecked();
 expect(screen.getByRole('button',{name:'Apply Permissions'})).toBeDisabled();
 expect((await getAllSnapshot()).assets).toEqual(initial.assets);
});
it('returns to the proposal queue if the selected proposal has left the bounded queue',async()=>{
 const u=user();
 function Harness(){const[selected,setSelected]=React.useState<string|undefined>('removed_proposal');return <LibraryProvider><AiConnectionProvider><IncomingProposals selected={selected} proposals={[]} onSelect={setSelected}/></AiConnectionProvider></LibraryProvider>;}
 render(<Harness/>);await u.click(await screen.findByRole('button',{name:'Back to proposals'}));
 expect(screen.getByRole('heading',{name:'Incoming proposals'})).toHaveFocus();
});
