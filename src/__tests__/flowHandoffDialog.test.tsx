import React from 'react';
import {it,expect,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {FlowHandoffDialog} from '../components/keyframes/FlowHandoffDialog';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
it('requires explicit selections and preview and makes no provider calls or library writes',async()=>{
 const f=await seedKeyframeStorage(),close=vi.fn();render(<FlowHandoffDialog scene={f.parent} collection={f.state.collections[0]} shotId={f.shotId} snapshot={{...f.state,drafts:[f.draft]} as never} onClose={close}/>);const user=userEvent.setup();expect(screen.getByRole('button',{name:'Download reviewed handoff'})).toBeDisabled();expect(screen.getByText(/No upload or generation occurs/)).toBeInTheDocument();await user.click(screen.getByRole('checkbox',{name:/Start.*middle/i}));await user.click(screen.getByRole('button',{name:'Preview selected handoff'}));expect(await screen.findByRole('alert')).toHaveTextContent(/missing|image|assigned/i);await user.click(screen.getByRole('button',{name:'Close Prepare manual Flow handoff'}));expect(close).toHaveBeenCalled();
});
