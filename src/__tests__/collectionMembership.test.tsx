import React from 'react';
import { describe,it,expect,vi } from 'vitest';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
const state=vi.hoisted(()=>({snapshot:{collections:[{id:'one',name:'One',members:[]},{id:'two',name:'Two',members:[]}]},collectionModalTarget:{type:'scene',id:'s',title:'Scene'},closeCollectionModal:vi.fn(),refreshSnapshot:vi.fn(),showToast:vi.fn()}));
const add=vi.hoisted(()=>vi.fn());
vi.mock('../context/LibraryContext',()=>({useLibrary:()=>state}));
vi.mock('../storage/db',()=>({addMemberToCollection:add,removeMemberFromCollection:vi.fn(),createCollection:vi.fn()}));
import { CollectionMembershipModal } from '../components/SharedModals';
it('starts with collapsed creation and serializes target-only toggles',async()=>{
 let finish!:()=>void;add.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
 render(<CollectionMembershipModal/>);
 expect(screen.getByText('+ New Collection').closest('details')).not.toHaveAttribute('open');
 const boxes=screen.getAllByRole('checkbox');fireEvent.click(boxes[0]);fireEvent.click(boxes[1]);
 expect(add).toHaveBeenCalledTimes(1);
 expect(add).toHaveBeenCalledWith({collectionId:'one',memberType:'scene',memberId:'s'});
 expect(boxes[1]).toBeDisabled();finish();await waitFor(()=>expect(boxes[1]).not.toBeDisabled());
});
