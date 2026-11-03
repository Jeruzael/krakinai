import {expect,it,vi} from 'vitest';
import {withStableLibraryMedia} from '../storage/mediaPreparationLock';
import {installSyntheticMediaLock} from './fixtures/syntheticMediaLock';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {saveAuthoredScene} from '../storage/sceneAuthoring';
import {getAllSnapshot,saveMediaAsset} from '../storage/db';
it('serializes cooperating media writers across the complete asynchronous preparation and commit boundary',async()=>{
 installSyntheticMediaLock();let release!:()=>void,entered!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve}),gate=new Promise<void>(resolve=>{release=resolve}),order:string[]=[];
 const first=withStableLibraryMedia(async()=>{order.push('prepare');entered();await gate;order.push('commit');},true);await started;
 const second=withStableLibraryMedia(async()=>{order.push('replace');});await Promise.resolve();await Promise.resolve();expect(order).toEqual(['prepare']);release();await Promise.all([first,second]);expect(order).toEqual(['prepare','commit','replace']);
});
it('blocks complete frame saves when cross-tab media stability is unavailable while leaving ordinary legacy writers available',async()=>{
 Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});const work=vi.fn(async()=>1);
 await expect(withStableLibraryMedia(work,true)).rejects.toThrow(/Web Locks|browser/i);expect(work).not.toHaveBeenCalled();expect(await withStableLibraryMedia(work)).toBe(1);
});
it('queues a same-ID same-size media replacement until the C save commits its original hashes',async()=>{
 installSyntheticMediaLock();const f=await seedKeyframeStorage(),file=f.state.media[0],original=crypto.subtle.digest.bind(crypto.subtle);let release!:()=>void,entered!:()=>void,injected=false;
 const started=new Promise<void>(resolve=>{entered=resolve}),gate=new Promise<void>(resolve=>{release=resolve});
 const spy=vi.spyOn(crypto.subtle,'digest').mockImplementation(async(algorithm,data)=>{if(!injected){injected=true;entered();await gate;}return original(algorithm,data);});
 try{
  const saving=saveAuthoredScene(f.draft.id,{requestId:'locked-c-save',expectedInputRevision:f.draft.inputRevision,frameVideoDecision:'keep_exact_unverified'});await started;
  let replaced=false;const replacement=saveMediaAsset({id:file.id,filename:file.filename,mimeType:file.mimeType,blob:new Blob([new Uint8Array(file.byteSize).fill(42)],{type:file.mimeType}),width:file.width,height:file.height}).then(()=>{replaced=true;});
  await new Promise(resolve=>setTimeout(resolve,25));expect(replaced).toBe(false);expect(await (await getAllSnapshot()).media.find(row=>row.id===file.id)!.blob.arrayBuffer()).toEqual(await file.blob.arrayBuffer());
  release();const saved=await saving;await replacement;expect(saved.imagePromptSnapshots!.start.referenceProvenance).toEqual(f.parent.imagePromptSnapshots!.start.referenceProvenance);
 }finally{release?.();spy.mockRestore();}
});
