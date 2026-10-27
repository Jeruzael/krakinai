import React from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {act,fireEvent,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {Collection,SavedScene} from '../types/domain';

const c:Collection={id:'c',name:'Film',description:'',members:[],createdAt:'',updatedAt:'',project:{version:1,revision:2,shots:[{id:'a',order:0,code:'01',title:'A',takeSceneIds:[],status:'planned'}]}};
const other:Collection={...c,id:'other',name:'Other project',project:{version:1,revision:0,shots:[]}};
const scene:SavedScene={id:'s',title:'Scene',slots:{},extraRequiredSlots:[],sceneInstructions:'',settings:{},outputs:{full:'Exact',structured:'',compact:''},manualOutputs:{},references:[],resultMediaLinks:[],reviewNotes:'',reviewStatus:'unreviewed',revision:1,createdAt:'',updatedAt:''};
const copyTextMock=vi.hoisted(()=>vi.fn());
vi.mock('../context/LibraryContext',()=>({useLibrary:()=>({snapshot:{collections:[c,other],scenes:[scene]},copyText:copyTextMock,showToast:vi.fn()})}));
import {ProjectBulkActions} from '../components/ProjectBulkActions';
import {SceneBulkActions} from '../components/SceneBulkActions';
beforeEach(()=>copyTextMock.mockReset());

it('shows explicit project bulk targets, selected count, and confirmation before association removal',async()=>{
 const user=userEvent.setup();render(<ProjectBulkActions collection={c} selectedShotIds={['a']} onClear={()=>{}} onChanged={async()=>{}}/>);
 expect(screen.getByText(/1 shot selected/i)).toBeInTheDocument();
 expect(screen.getByRole('combobox',{name:/destination project/i})).toHaveTextContent('Other project');
 await user.click(screen.getByRole('button',{name:'Remove Selected Shots'}));
 expect(screen.getByRole('dialog',{name:/remove selected shots/i})).toHaveTextContent(/saved scenes remain/i);
 await user.click(screen.getByRole('button',{name:'Cancel'}));
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('reports missing preferred scenes instead of silently skipping selected shots',async()=>{
 const user=userEvent.setup();render(<ProjectBulkActions collection={c} selectedShotIds={['a']} onClear={()=>{}} onChanged={async()=>{}}/>);
 expect(screen.getByText(/1 selected shot has no available preferred scene/i)).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Copy Prompts'}));
 expect(await screen.findByRole('alert')).toHaveTextContent(/no available preferred scene/i);
});

it('requires an explicit project target for library status and add actions',()=>{
 render(<SceneBulkActions selectedSceneIds={['s']} onClear={()=>{}} onChanged={async()=>{}}/>);
 expect(screen.getByText(/1 scene selected/i)).toBeInTheDocument();
 expect(screen.getByRole('combobox',{name:/target project/i})).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Assign Status'})).toBeDisabled();
});

it('keeps bulk toolbars hidden without a selection',()=>{
 const {rerender}=render(<ProjectBulkActions collection={c} selectedShotIds={[]} onClear={()=>{}} onChanged={async()=>{}}/>);
 expect(screen.queryByRole('region',{name:/selected project shot actions/i})).not.toBeInTheDocument();
 rerender(<SceneBulkActions selectedSceneIds={[]} onClear={()=>{}} onChanged={async()=>{}}/>);
 expect(screen.queryByRole('region',{name:/selected saved scene actions/i})).not.toBeInTheDocument();
});

it('starts only one copy action for two clicks in the same render',async()=>{
 copyTextMock.mockResolvedValue(true);
 render(<SceneBulkActions selectedSceneIds={['s']} onClear={()=>{}} onChanged={async()=>{}}/>);
 const button=screen.getByRole('button',{name:'Copy Prompts'});
 await act(async()=>{fireEvent.click(button);fireEvent.click(button);});
 expect(copyTextMock).toHaveBeenCalledTimes(1);
});
