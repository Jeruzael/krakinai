import React from 'react';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,screen,cleanup,act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {LibraryCompatibilityGate} from '../components/LibraryCompatibilityGate';
import * as compatibility from '../storage/libraryCompatibility';
vi.mock('../storage/libraryCompatibility',()=>({inspectLibraryCompatibility:vi.fn(),enableBlockingLibrary:vi.fn()}));
beforeEach(()=>{vi.mocked(compatibility.inspectLibraryCompatibility).mockResolvedValue('legacy-v1');});
afterEach(()=>{cleanup();vi.resetAllMocks();});
const setup=()=>render(<React.StrictMode><LibraryCompatibilityGate><div>Normal library initialization</div></LibraryCompatibilityGate></React.StrictMode>);
it('keeps providers unmounted before explicit consent and Cancel leaves the decision available',async()=>{
 setup();await screen.findByRole('heading',{name:'Enable the blocking-compatible library?'});
 expect(screen.queryByText('Normal library initialization')).not.toBeInTheDocument();
 await userEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(compatibility.enableBlockingLibrary).not.toHaveBeenCalled();
 expect(screen.getByRole('button',{name:'Enable blocking-compatible library'})).toBeEnabled();expect(screen.getByRole('status')).toHaveTextContent('not changed');
});
it('mounts only after a successful upgrade, including StrictMode',async()=>{
 setup();await screen.findByRole('button',{name:'Enable blocking-compatible library'});let finish!:()=>void;
 vi.mocked(compatibility.enableBlockingLibrary).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 await userEvent.click(screen.getByRole('button',{name:'Enable blocking-compatible library'}));expect(screen.queryByText('Normal library initialization')).not.toBeInTheDocument();
 await act(async()=>finish());expect(await screen.findByText('Normal library initialization')).toBeVisible();expect(compatibility.enableBlockingLibrary).toHaveBeenCalledTimes(1);
});
it('shows blocked guidance and cancels the actual pending operation without mounting providers',async()=>{
 vi.mocked(compatibility.enableBlockingLibrary).mockImplementation(({signal,onBlocked})=>new Promise((_resolve,reject)=>{onBlocked();signal!.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')));}));
 setup();await userEvent.click(await screen.findByRole('button',{name:'Enable blocking-compatible library'}));
 expect(screen.getByRole('status')).toHaveTextContent('older KRAKINAI tabs');await userEvent.click(screen.getByRole('button',{name:'Cancel'}));
 expect(await screen.findByRole('button',{name:'Enable blocking-compatible library'})).toBeEnabled();expect(screen.queryByText('Normal library initialization')).not.toBeInTheDocument();
});
it('does not describe an upgrade as cancelled when the committed transaction wins',async()=>{
 vi.mocked(compatibility.enableBlockingLibrary).mockImplementation(({signal})=>new Promise(resolve=>{signal!.addEventListener('abort',()=>resolve());}));
 setup();await userEvent.click(await screen.findByRole('button',{name:'Enable blocking-compatible library'}));await userEvent.click(screen.getByRole('button',{name:'Cancel'}));
 expect(await screen.findByText('Normal library initialization')).toBeVisible();
});
it('accepts fresh/current libraries and blocks unsupported versions without downgrade',async()=>{
 vi.mocked(compatibility.inspectLibraryCompatibility).mockResolvedValue('unsupported');setup();expect(await screen.findByRole('alert')).toHaveTextContent('compatible');expect(compatibility.enableBlockingLibrary).not.toHaveBeenCalled();
 cleanup();vi.mocked(compatibility.inspectLibraryCompatibility).mockResolvedValue('absent');setup();expect(await screen.findByText('Normal library initialization')).toBeVisible();
});
