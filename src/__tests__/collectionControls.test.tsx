import React from 'react';
import { describe,it,expect,vi } from 'vitest';
import { render,screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const navigate=vi.fn();
vi.mock('../context/LibraryContext',()=>({useLibrary:()=>({snapshot:{collections:[{id:'one',name:'One',members:[{type:'scene',id:'s'}]},{id:'two',name:'Two',members:[{type:'scene',id:'s'}]}]},navigate})}));
import { CollectionMembershipBadge } from '../components/CollectionMembershipBadge';
import { CollectionCoverPicker } from '../components/CollectionCoverPicker';
describe('collection controls',()=>{
 it('links both collections for one scene with keyboard accessible dialog',async()=>{
 const user=userEvent.setup();render(<CollectionMembershipBadge sceneId="s"/>);
 await user.click(screen.getByRole('button',{name:'In 2 Collections'}));
 expect(screen.getByRole('dialog',{name:'Scene Collections'})).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'One'})).toHaveAttribute('href','#/collections/one?tab=scenes');
 await user.click(screen.getByRole('link',{name:'Two'}));expect(navigate).toHaveBeenCalledWith('/collections/two?tab=scenes');
 });
 it('selects existing media without saving another binary and explicitly removes covers',async()=>{
 const user=userEvent.setup(), select=vi.fn();
 render(<CollectionCoverPicker media={[{id:'m',filename:'cover.png',mimeType:'image/png',blob:new Blob()} as any]} currentId="missing" onSelect={select} onClose={()=>{}} onUploaded={async()=>{}}/>);
 expect(screen.getByRole('status')).toHaveTextContent('Current cover is missing');
 await user.click(screen.getByRole('tab',{name:/All Images/}));
 await user.click(screen.getByRole('button',{name:'Use cover.png as cover'}));expect(select).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Use Cover'}));expect(select).toHaveBeenCalledWith('m');
 await user.click(screen.getByRole('button',{name:'Remove Cover'}));expect(select).toHaveBeenCalledWith(null);
 });
});
