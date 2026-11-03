import React,{useState} from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {FrameOutputDecisions} from '../components/keyframes/FrameOutputDecisions';
import type {ImagePromptSnapshotV1,FrameOutputDecisions as Decisions} from '../types/keyframes';
import * as downloads from '../hooks/useObjectUrl';
const snapshot:ImagePromptSnapshotV1={schema:'krakinai.image-prompt.v1',assemblerVersion:1,full:'BEGIN '+('文字\n'.repeat(10000))+' EXACT END',compact:'Complete compact still.',visualDigest:'a'.repeat(64),sourceDigest:'b'.repeat(64),referenceProvenance:[]};afterEach(cleanup);
it('shows and copies the complete selected mode without expanding other frame prompts',async()=>{
 const user=userEvent.setup(),write=vi.spyOn(navigator.clipboard,'writeText').mockResolvedValue();render(<FrameOutputDecisions source={{imagePromptSnapshots:{selected:snapshot,other:{...snapshot,full:'UNSELECTED_FULL_TEXT'}}}} frameId="selected" decisions={{}} onChange={()=>{}}/>);expect(screen.getByRole('textbox',{name:'Complete image prompt'})).toHaveValue(snapshot.full);expect(screen.queryByText('UNSELECTED_FULL_TEXT')).not.toBeInTheDocument();await user.click(screen.getByRole('button',{name:'Copy complete image prompt'}));expect(write).toHaveBeenCalledWith(snapshot.full);await user.selectOptions(screen.getByRole('combobox',{name:'Image prompt mode'}),'compact');expect(screen.getByRole('textbox',{name:'Complete image prompt'})).toHaveValue(snapshot.compact);write.mockRestore();
});
it('keeps manual buffers exact and requires separate canonical/manual decisions per mode',async()=>{
 const user=userEvent.setup(),onChange=vi.fn(),source={imagePromptSnapshots:{selected:snapshot},manualImageOutputs:{selected:{full:{text:'  MANUAL STILL\r\n buffer ',updatedAt:'2026-11-03T00:00:00Z',basedOnVisualDigest:'c'.repeat(64)}}}};function Harness(){const [decisions,setDecisions]=useState<Decisions>({});return <FrameOutputDecisions source={source} frameId="selected" canonical={snapshot} decisions={decisions} onChange={value=>{setDecisions(value);onChange(value);}}/>;}
 const write=vi.spyOn(navigator.clipboard,'writeText').mockResolvedValue();render(<Harness/>);expect(onChange).not.toHaveBeenCalled();expect(screen.getByRole('textbox',{name:'Complete image prompt'})).toHaveValue(source.manualImageOutputs.selected.full.text.replaceAll('\r\n','\n'));await user.click(screen.getByRole('button',{name:'Copy complete image prompt'}));expect(write).toHaveBeenCalledWith(source.manualImageOutputs.selected.full.text);await user.selectOptions(screen.getByRole('combobox',{name:'Image output decision'}),'canonical');expect(onChange).toHaveBeenLastCalledWith({selected:{full:'canonical'}});expect(screen.getByRole('textbox',{name:'Complete image prompt'})).toHaveValue(snapshot.full);expect(source.manualImageOutputs.selected.full.text).toBe('  MANUAL STILL\r\n buffer ');write.mockRestore();
});
it('offers manual selection when clipboard access rejects without losing the complete text',async()=>{
 const user=userEvent.setup(),write=vi.spyOn(navigator.clipboard,'writeText').mockRejectedValue(new Error('Synthetic clipboard denial'));render(<FrameOutputDecisions source={{imagePromptSnapshots:{selected:snapshot}}} frameId="selected" decisions={{}} onChange={()=>{}}/>);await user.click(screen.getByRole('button',{name:'Copy complete image prompt'}));expect(screen.getByRole('status')).toHaveTextContent('Copy unavailable');expect(screen.getByRole('textbox',{name:'Complete image prompt'})).toHaveValue(snapshot.full);write.mockRestore();
});
it('downloads both complete modes using backing bytes, including Unicode and CRLF',async()=>{
 const download=vi.spyOn(downloads,'downloadBlobAsFile').mockImplementation(()=>{}),user=userEvent.setup(),manual='  Exact image\r\n雨  ';
 render(<FrameOutputDecisions source={{imagePromptSnapshots:{selected:snapshot},manualImageOutputs:{selected:{full:{text:manual,updatedAt:'2026-11-03T00:00:00Z',basedOnVisualDigest:snapshot.visualDigest}}}}} frameId="selected" decisions={{}} onChange={()=>{}}/>);
 await user.click(screen.getByRole('button',{name:'Download complete image prompt'}));expect(await download.mock.calls.at(-1)![0].text()).toBe(manual);
 await user.selectOptions(screen.getByRole('combobox',{name:'Image prompt mode'}),'compact');await user.click(screen.getByRole('button',{name:'Download complete image prompt'}));expect(await download.mock.calls.at(-1)![0].text()).toBe(snapshot.compact);download.mockRestore();
});
