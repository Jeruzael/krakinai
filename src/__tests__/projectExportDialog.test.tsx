import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Collection, SavedScene } from '../types/domain';
import { ProjectExportDialog } from '../components/ProjectExportDialog';

const {library}=vi.hoisted(()=>({library:{snapshot:null as unknown}}));
vi.mock('../context/LibraryContext',()=>({useLibrary:()=>library}));
afterEach(()=>cleanup());

it('shows an actionable planning limit error without crashing the dialog',()=>{
 const scene={id:'scene-1',title:'Scene',slots:{},settings:{},outputs:{full:'x'.repeat(800_000),structured:'',compact:''},references:[],resultMediaLinks:[]} as unknown as SavedScene;
 const collection={id:'project',name:'Film',description:'',members:[],createdAt:'',updatedAt:'',project:{version:1,revision:1,shots:[{id:'shot',order:0,code:'01',title:'Shot',takeSceneIds:[scene.id],selectedSceneId:scene.id,status:'prompt_ready'}]}} as Collection;
 library.snapshot={scenes:[scene],media:[]};
 render(<ProjectExportDialog collection={collection} onClose={vi.fn()}/>);
 expect(screen.getByRole('alert')).toHaveTextContent('16 MiB');
 expect(screen.getByRole('button',{name:'Export project ZIP'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Close'})).toBeEnabled();
});
it('keeps association controls usable when a media estimate exceeds the bound',()=>{
 const scene={id:'scene-1',title:'Scene',slots:{},settings:{},outputs:{full:'',structured:'',compact:''},references:[{mediaId:'media-1',role:'reference',altText:'',order:0}],resultMediaLinks:[]} as unknown as SavedScene;
 const collection={id:'project',name:'Film',description:'',members:[],createdAt:'',updatedAt:'',project:{version:1,revision:1,shots:[{id:'shot',order:0,code:'01',title:'Shot',takeSceneIds:[scene.id],selectedSceneId:scene.id,status:'prompt_ready'}]}} as Collection;
 library.snapshot={scenes:[scene],media:[{id:'media-1',filename:'m.png',safeFilename:'m.png',mimeType:'image/png',byteSize:129*1024*1024,blob:new Blob(['x'])}]};
 render(<ProjectExportDialog collection={collection} onClose={vi.fn()}/>);
 expect(screen.getByRole('alert')).toHaveTextContent('128 MiB');
 expect(screen.getByRole('checkbox',{name:/m.png/})).toBeEnabled();
});
it('labels associations with a friendly shot and role without exposing record IDs',()=>{
 const scene={id:'scene-1',title:'Scene',slots:{},settings:{},outputs:{full:'',structured:'',compact:''},references:[],resultMediaLinks:[]} as unknown as SavedScene;
 const collection={id:'project',name:'Film',description:'',members:[],createdAt:'',updatedAt:'',project:{version:1,revision:1,shots:[{id:'shot-raw-id',order:0,code:'03A',title:'Harbor arrival',takeSceneIds:[scene.id],selectedSceneId:scene.id,status:'prompt_ready',firstFrameMediaId:'media-raw-id'}]}} as Collection;
 library.snapshot={scenes:[scene],media:[{id:'media-raw-id',filename:'harbor.png',safeFilename:'harbor.png',mimeType:'image/png',byteSize:1,blob:new Blob(['x'])}]};
 render(<ProjectExportDialog collection={collection} onClose={vi.fn()}/>);
 expect(screen.getByRole('checkbox',{name:/harbor\.png — First frame · Shot 03A · Harbor arrival/})).toBeEnabled();
 expect(document.body.textContent).not.toContain('firstFrameMediaId');
 expect(document.body.textContent).not.toContain('shot-raw-id');
 expect(document.body.textContent).not.toContain('media-raw-id');
});
