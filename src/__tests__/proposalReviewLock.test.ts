import {it,expect,vi,afterEach} from 'vitest';
import {withProposalReviewLock} from '../connections/proposalReviewLock';
const original=Object.getOwnPropertyDescriptor(navigator,'locks');
afterEach(()=>{if(original)Object.defineProperty(navigator,'locks',original);else Reflect.deleteProperty(navigator,'locks');});
it('fails closed without Web Locks while leaving inspection and download independent',async()=>{
 Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});const work=vi.fn();await expect(withProposalReviewLock('review-id',work)).rejects.toThrow(/Web Locks|supported/i);expect(work).not.toHaveBeenCalled();
});
it('does not wait for or steal another tab active apply lock',async()=>{
 const request=vi.fn(async(_name,_options,work)=>work(null));Object.defineProperty(navigator,'locks',{value:{request},configurable:true});const work=vi.fn();await expect(withProposalReviewLock('review-id',work)).rejects.toThrow(/another tab/i);expect(work).not.toHaveBeenCalled();expect(request.mock.calls[0].slice(0,2)).toEqual(['krakinai-review:review-id',{mode:'exclusive',ifAvailable:true}]);
});
it('runs only while the browser has granted the exclusive lease and propagates failures',async()=>{
 Object.defineProperty(navigator,'locks',{value:{request:async(_name:string,_options:unknown,work:(lock:object)=>unknown)=>work({mode:'exclusive'})},configurable:true});await expect(withProposalReviewLock('review-id',async()=>42)).resolves.toBe(42);await expect(withProposalReviewLock('review-id',async()=>{throw Error('Owned failure');})).rejects.toThrow('Owned failure');
});
