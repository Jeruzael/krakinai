import React from 'react';
import { expect,it,vi } from 'vitest';
import { render,screen,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('../context/LibraryContext',()=>({useLibrary:()=>({snapshot:{collections:[{id:'one',name:'One',description:'Original',members:[],updatedAt:'2026-10-26'}],media:[],assets:[],scenes:[],variants:[]},hashPath:'/collections/one',navigate:vi.fn(),refreshSnapshot:vi.fn()})}));
import { CollectionsScreen } from '../screens/CollectionsScreen';
it('returns from cover picker to the retained editor draft on Escape',async()=>{
 const user=userEvent.setup();render(<React.StrictMode><CollectionsScreen collectionId="one"/></React.StrictMode>);
 await user.click(screen.getByRole('button',{name:'Rename / Edit'}));
 const name=screen.getByLabelText('Collection Name *');await user.clear(name);await user.type(name,'Unsaved name');
 await user.click(screen.getByRole('button',{name:'Change Cover'}));
 expect(screen.getAllByRole('dialog',{hidden:true})).toHaveLength(1);
 await user.keyboard('{Escape}');
 expect(screen.getByRole('dialog',{name:'Edit Collection'})).toBeInTheDocument();
 expect(screen.getByLabelText('Collection Name *')).toHaveValue('Unsaved name');
 await waitFor(()=>expect(screen.getByRole('button',{name:'Change Cover'})).toHaveFocus());
});
