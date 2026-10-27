import { beforeEach, expect, it, vi } from 'vitest';
import { getProjectCast, getProjectDialogue, getWardrobeContinuity, formatProjectScript } from '../domain/projectContinuity';
import { buildSceneDocument } from '../domain/sceneDocument';
import { clearAllStoresForTesting, createCollection, deletePromptAsset, deleteVariant, getAllSnapshot, saveMediaAsset, savePromptAsset, saveVariant } from '../storage/db';
import { addProjectShot, removeProjectShot, reorderProjectShots, updateProjectShot } from '../storage/projects';
import { removeProjectCast, removeProjectTransition, updateProjectFrames, updateWardrobeIntent, uploadProjectFrame, upsertProjectCast, upsertProjectTransition } from '../storage/projectContinuity';
import type { Collection, ProjectShot, SavedScene } from '../types/domain';
import { exportFullBackupZip, restoreFullBackupZip, validateBackupZip } from '../storage/backup';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const scene=(id:string,character:string,wardrobe?:string,line=''):SavedScene=>({id,title:id,slots:{character:{slot:'character',sourceType:'asset',sourceId:character,sourceRevision:1,sourceTitle:character,promptText:'identity',mediaLinks:[]},...(wardrobe?{wardrobe:{slot:'wardrobe',sourceType:'variant' as const,sourceId:wardrobe,sourceRevision:1,sourceTitle:wardrobe,promptText:wardrobe,mediaLinks:[]}}:{})},extraRequiredSlots:[],sceneInstructions:'',settings:{},outputs:{full:'unchanged',structured:'unchanged',compact:'unchanged'},manualOutputs:{},references:[],resultMediaLinks:[],dialogue:{speaker:character,line,language:'Taglish'},reviewNotes:'',reviewStatus:'unreviewed',revision:1,createdAt:'now',updatedAt:'now'});
const shot=(id:string,order:number,sceneId:string):ProjectShot=>({id,order,code:order===1?'03A':String(order+1).padStart(2,'0'),title:`Shot ${id}`,takeSceneIds:[sceneId],selectedSceneId:sceneId,status:'reviewed'});

it('preserves exact Unicode and multiline dialogue without changing snapshots',()=>{
  const scenes=[scene('s1','aya','red','Uy, Marco—tara na!\n第二行'),scene('s2','marco','blue','Oo, sandali. 😅')];
  const collection:Collection={id:'c',name:'Late Again',description:'',members:[],createdAt:'now',updatedAt:'now',project:{version:1,revision:0,shots:[shot('a',0,'s1'),shot('b',1,'s2')]}};
  const before=JSON.stringify({scenes,collection});
  expect(getProjectDialogue(collection,scenes).map(r=>r.exactLine)).toEqual(['Uy, Marco—tara na!\n第二行','Oo, sandali. 😅']);
  expect(formatProjectScript(collection,scenes)).toContain('Uy, Marco—tara na!\n第二行');
  expect(formatProjectScript(collection,scenes)).toContain('Language: Taglish');
  expect(formatProjectScript(collection,scenes)).toContain('Intended duration: unknown');
  expect(JSON.stringify({scenes,collection})).toBe(before);
});

it('compares adjacent occurrences of the same character and treats missing wardrobe as unknown',()=>{
  const scenes=[scene('s1','aya','red'),scene('s2','marco','blue'),scene('s3','aya','red'),scene('s4','aya','green'),scene('s5','aya'),scene('s6','aya','green')];
  const collection:Collection={id:'c',name:'Film',description:'',members:[],createdAt:'now',updatedAt:'now',project:{version:1,revision:0,shots:scenes.map((s,i)=>({...shot(`sh${i}`,i,s.id),intentionalWardrobeChange:i===3?'costume_change':undefined}))}};
  expect(getWardrobeContinuity(collection,scenes).map(r=>r.changed)).toEqual([false,false,false,true,false,false]);
  expect(getWardrobeContinuity(collection,scenes)[3].intentionalReason).toBe('costume_change');
  expect(getProjectCast(collection,scenes,[]).map(r=>[r.characterId,r.derived])).toEqual([['aya',true],['marco',true]]);
  scenes[3].slots.wardrobe!.overrideText='';
  expect(getWardrobeContinuity(collection,scenes)[3].wardrobeDescription).toBe(buildSceneDocument(scenes[3]).components.wardrobe?.prompt);
});

it('uses canonical wardrobe override fallback and preserves authored whitespace',()=>{
  const scenes=[scene('s1','aya','coat'),scene('s2','aya','coat'),scene('s3','aya','coat'),scene('s4','aya','coat')];
  scenes[0].slots.wardrobe!.promptText='  Original coat  ';
  scenes[1].slots.wardrobe!.promptText='  Original coat  ';
  scenes[1].slots.wardrobe!.overrideText='   ';
  scenes[2].slots.wardrobe!.promptText='  Original coat  ';
  scenes[2].slots.wardrobe!.overrideText='  New coat  ';
  scenes[3].slots.wardrobe!.promptText='  Original coat  ';
  scenes[3].slots.wardrobe!.overrideText='';
  const collection:Collection={id:'c',name:'Film',description:'',members:[],createdAt:'now',updatedAt:'now',project:{version:1,revision:0,shots:scenes.map((s,i)=>shot(`sh${i}`,i,s.id))}};
  const rows=getWardrobeContinuity(collection,scenes);
  expect(rows.map(r=>r.wardrobeDescription)).toEqual(scenes.map(s=>buildSceneDocument(s).components.wardrobe?.prompt));
  expect(rows.map(r=>r.changed)).toEqual([false,false,true,true]);
  expect(rows[1].wardrobeDescription).toBe('  Original coat  ');
  expect(rows[2].wardrobeDescription).toBe('  New coat  ');
});

beforeEach(clearAllStoresForTesting);
it('validates live cast, frame and transition references transactionally while retaining unrelated status',async()=>{
  const char=await savePromptAsset({title:'Aya',category:'characters',promptText:'Aya',tags:[]});
  const outfit=await saveVariant({title:'Blue',parentCharacterId:char.id,type:'Outfit',promptText:'Blue',tags:[]});
  const image=await saveMediaAsset({filename:'frame.png',mimeType:'image/png',blob:new Blob(['frame bytes'],{type:'image/png'})});
  const video=await saveMediaAsset({filename:'clip.mp4',mimeType:'video/mp4',blob:new Blob(['video bytes'],{type:'video/mp4'})});
  const collection=await createCollection({name:'Film'});const first=await addProjectShot({collectionId:collection.id});const second=await addProjectShot({collectionId:collection.id});
  const a=first.project!.shots[0].id,b=second.project!.shots[1].id;
  await Promise.all([upsertProjectCast({collectionId:collection.id,entry:{characterId:char.id,name:'Aya',approvedWardrobeVariantIds:[outfit.id],referenceMediaIds:[image.id]}}),updateProjectShot({collectionId:collection.id,shotId:a,patch:{status:'final'}})]);
  const withFrame=await updateProjectFrames({collectionId:collection.id,shotId:a,firstFrameMediaId:image.id});
  expect(withFrame.project!.shots[0]).toMatchObject({status:'final',firstFrameMediaId:image.id});
  const withIntent=await updateWardrobeIntent({collectionId:collection.id,shotId:a,reason:'new_day',notes:'Day two'});
  expect(withIntent.project!.shots[0]).toMatchObject({status:'final',continuityNotes:'Day two',intentionalWardrobeChange:'new_day'});
  const withTransition=await upsertProjectTransition({collectionId:collection.id,transition:{fromShotId:a,toShotId:b,type:'dissolve',description:'Soft',notes:'Hold'}});
  const edge=withTransition.project!.transitions![0];
  await reorderProjectShots({collectionId:collection.id,orderedShotIds:[b,a]});
  expect((await getAllSnapshot()).collections.find(c=>c.id===collection.id)?.project?.transitions?.[0]).toEqual(edge);
  const before=JSON.stringify((await getAllSnapshot()).collections.find(c=>c.id===collection.id));
  await expect(updateProjectFrames({collectionId:collection.id,shotId:a,lastFrameMediaId:video.id})).rejects.toThrow(/image/i);
  await expect(upsertProjectCast({collectionId:collection.id,entry:{characterId:char.id,approvedWardrobeVariantIds:['missing']}})).rejects.toThrow(/wardrobe/i);
  await expect(upsertProjectTransition({collectionId:collection.id,transition:{fromShotId:a,toShotId:a,type:'dissolve',description:'',notes:''}})).rejects.toThrow(/endpoint/i);
  expect(JSON.stringify((await getAllSnapshot()).collections.find(c=>c.id===collection.id))).toBe(before);
  expect((await updateProjectFrames({collectionId:collection.id,shotId:a,firstFrameMediaId:null})).project!.shots.find(s=>s.id===a)?.firstFrameMediaId).toBeUndefined();
  await removeProjectCast({collectionId:collection.id,characterId:char.id});
  await removeProjectTransition({collectionId:collection.id,transitionId:edge.id});
  expect((await getAllSnapshot()).collections.find(c=>c.id===collection.id)?.project?.transitions).toEqual([]);
  await removeProjectShot({collectionId:collection.id,shotId:a});
});

it('roundtrips exact frame bytes and cast references, and rejects invalid restore metadata',async()=>{
  const char=await savePromptAsset({title:'Aya',category:'characters',promptText:'Aya',tags:[]});
  const image=await saveMediaAsset({filename:'first.png',mimeType:'image/png',blob:new Blob(['original \u2603 bytes'],{type:'image/png'})});
  const collection=await createCollection({name:'Late Again'});
  const first=await addProjectShot({collectionId:collection.id});const a=first.project!.shots[0].id;
  const second=await addProjectShot({collectionId:collection.id});const b=second.project!.shots[1].id;
  await upsertProjectCast({collectionId:collection.id,entry:{characterId:char.id,name:'Aya',referenceMediaIds:[image.id]}});
  await updateProjectFrames({collectionId:collection.id,shotId:a,firstFrameMediaId:image.id,lastFrameMediaId:image.id});
  await upsertProjectTransition({collectionId:collection.id,transition:{fromShotId:a,toShotId:b,type:'straight_cut',description:'Cut',notes:'Keep'}});
  const bytes=await exportFullBackupZip();const valid=await validateBackupZip(bytes);
  expect(valid.valid).toBe(true);
  await restoreFullBackupZip(bytes);
  const restored=await getAllSnapshot();
  expect(await restored.media.find(m=>m.id===image.id)?.blob.text()).toBe('original \u2603 bytes');
  expect(restored.collections.find(c=>c.id===collection.id)?.project?.cast?.[0].referenceMediaIds).toEqual([image.id]);
  for(const invalid of [
    (p:any)=>{p.shots[0].firstFrameMediaId='missing';},
    (p:any)=>{p.cast[0].referenceMediaIds=['missing'];},
    (p:any)=>{p.cast.push({...p.cast[0]});},
    (p:any)=>{p.transitions[0].toShotId=p.transitions[0].fromShotId;},
  ]){
    const files=unzipSync(bytes);const manifest=JSON.parse(strFromU8(files['manifest.json']));
    invalid(manifest.collections.find((c:any)=>c.id===collection.id).project);
    files['manifest.json']=strToU8(JSON.stringify(manifest));
    const before=JSON.stringify((await getAllSnapshot()).collections);
    expect((await validateBackupZip(zipSync(files))).valid).toBe(false);
    expect(JSON.stringify((await getAllSnapshot()).collections)).toBe(before);
  }
});

it.each(['character','wardrobe'] as const)('keeps unavailable %s cast metadata restorable after source deletion',async(source)=>{
  const char=await savePromptAsset({title:'Aya',category:'characters',promptText:'Aya',tags:[]});
  const outfit=await saveVariant({title:'Blue',parentCharacterId:char.id,type:'Outfit',promptText:'Blue',tags:[]});
  const collection=await createCollection({name:'Film'});
  await upsertProjectCast({collectionId:collection.id,entry:{characterId:char.id,approvedWardrobeVariantIds:[outfit.id],notes:'Historical continuity'}});
  if(source==='character'){await deleteVariant(outfit.id);await deletePromptAsset(char.id);}else await deleteVariant(outfit.id);
  const bytes=await exportFullBackupZip();
  expect((await validateBackupZip(bytes)).valid).toBe(true);
  await restoreFullBackupZip(bytes);
  expect((await getAllSnapshot()).collections.find(c=>c.id===collection.id)?.project?.cast?.[0]).toMatchObject({characterId:char.id,approvedWardrobeVariantIds:[outfit.id],notes:'Historical continuity'});
  await expect(upsertProjectCast({collectionId:collection.id,entry:{characterId:char.id,approvedWardrobeVariantIds:[outfit.id]}})).rejects.toThrow(/unavailable/);
});

it('rejects stale full-entry cast and transition saves while narrow shot updates merge',async()=>{
  const char=await savePromptAsset({title:'Aya',category:'characters',promptText:'Aya',tags:[]});
  const collection=await createCollection({name:'Film'});
  const first=await addProjectShot({collectionId:collection.id});
  const second=await addProjectShot({collectionId:collection.id});
  const [a,b]=second.project!.shots.map(s=>s.id);
  const revision=second.project!.revision;
  await updateProjectShot({collectionId:collection.id,shotId:a,patch:{status:'reviewed'}});
  await expect(upsertProjectCast({collectionId:collection.id,entry:{characterId:char.id,name:'Stale'},expectedRevision:revision})).rejects.toThrow(/revision conflict/i);
  await expect(upsertProjectTransition({collectionId:collection.id,transition:{fromShotId:a,toShotId:b,type:'straight_cut',description:'Stale',notes:''},expectedRevision:revision})).rejects.toThrow(/revision conflict/i);
  const current=(await getAllSnapshot()).collections.find(c=>c.id===collection.id)!;
  expect(current.project?.cast).toBeUndefined();expect(current.project?.transitions).toBeUndefined();
  expect(current.project?.shots[0].status).toBe('reviewed');
  await upsertProjectCast({collectionId:collection.id,entry:{characterId:char.id,name:'Fresh'},expectedRevision:current.project!.revision});
  await updateWardrobeIntent({collectionId:collection.id,shotId:a,notes:'Merged'});
  expect((await getAllSnapshot()).collections.find(c=>c.id===collection.id)?.project?.shots[0]).toMatchObject({status:'reviewed',continuityNotes:'Merged'});
  expect(first.project!.shots[0].id).toBe(a);
});

it('uploads and assigns a frame atomically, retaining exact bytes through backup restore',async()=>{
  const collection=await createCollection({name:'Film'});const added=await addProjectShot({collectionId:collection.id});
  const shotId=added.project!.shots[0].id;
  const uploaded=await uploadProjectFrame({collectionId:collection.id,shotId,side:'firstFrameMediaId',file:new File(['frame \u2603 bytes'],'frame.png',{type:'image/png'})});
  const mediaId=uploaded.project!.shots[0].firstFrameMediaId!;
  const snap=await getAllSnapshot();
  expect(snap.media.find(m=>m.id===mediaId)).toMatchObject({filename:'frame.png',safeFilename:'frame.png',mimeType:'image/png',byteSize:new Blob(['frame \u2603 bytes']).size});
  expect(await snap.media.find(m=>m.id===mediaId)?.blob.text()).toBe('frame \u2603 bytes');
  const bytes=await exportFullBackupZip();expect((await validateBackupZip(bytes)).valid).toBe(true);
  await restoreFullBackupZip(bytes);
  expect((await getAllSnapshot()).collections.find(c=>c.id===collection.id)?.project?.shots[0].firstFrameMediaId).toBe(mediaId);
  expect(await (await getAllSnapshot()).media.find(m=>m.id===mediaId)?.blob.text()).toBe('frame \u2603 bytes');
});

it('leaves no orphan media or collection edit for deleted shot or failed collection put',async()=>{
  const collection=await createCollection({name:'Film'});const added=await addProjectShot({collectionId:collection.id});const shotId=added.project!.shots[0].id;
  const before=await getAllSnapshot();
  await expect(uploadProjectFrame({collectionId:collection.id,shotId:'deleted-shot',side:'lastFrameMediaId',file:new File(['x'],'frame.png',{type:'image/png'})})).rejects.toThrow(/shot not found/i);
  expect((await getAllSnapshot()).media).toEqual(before.media);
  expect((await getAllSnapshot()).collections).toEqual(before.collections);
  const original=IDBObjectStore.prototype.put;let queuedMedia=false;
  const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value:any,key?:IDBValidKey){
    if(this.name==='media')queuedMedia=true;
    if(this.name==='collections')throw new DOMException('Collection write failed','QuotaExceededError');
    return key===undefined?original.call(this,value):original.call(this,value,key);
  });
  try{await expect(uploadProjectFrame({collectionId:collection.id,shotId,side:'firstFrameMediaId',file:new File(['new frame'],'new.png',{type:'image/png'})})).rejects.toThrow(/Collection write failed/);}finally{spy.mockRestore();}
  expect(queuedMedia).toBe(true);
  expect((await getAllSnapshot()).media).toEqual(before.media);
  expect((await getAllSnapshot()).collections).toEqual(before.collections);
});

it('rolls back both records on asynchronous transaction abort',async()=>{
  const collection=await createCollection({name:'Film'});const added=await addProjectShot({collectionId:collection.id});const shotId=added.project!.shots[0].id;
  const before=await getAllSnapshot();const original=IDBObjectStore.prototype.put;
  const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value:any,key?:IDBValidKey){
    const result=key===undefined?original.call(this,value):original.call(this,value,key);
    if(this.name==='collections')queueMicrotask(()=>{try{this.transaction.abort();}catch{}});
    return result;
  });
  try{await expect(uploadProjectFrame({collectionId:collection.id,shotId,side:'lastFrameMediaId',file:new File(['frame'],'last.png',{type:'image/png'})})).rejects.toThrow(/abort|failed/i);}finally{spy.mockRestore();}
  const after=await getAllSnapshot();expect(after.media).toEqual(before.media);expect(after.collections).toEqual(before.collections);
});

it('checks the current transaction media total before writing an uploaded frame',async()=>{
  const collection=await createCollection({name:'Film'});const added=await addProjectShot({collectionId:collection.id});const shotId=added.project!.shots[0].id;
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('krakinai_prompt_library_db',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  try{
    const tx=db.transaction('media','readwrite');tx.objectStore('media').put({id:'synthetic-full',filename:'tiny.png',safeFilename:'tiny.png',mimeType:'image/png',byteSize:5000*1024*1024,blob:new Blob(['x'],{type:'image/png'}),createdAt:'now'});
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});
  }finally{db.close();}
  const before=await getAllSnapshot();
  await expect(uploadProjectFrame({collectionId:collection.id,shotId,side:'firstFrameMediaId',file:new File(['frame'],'frame.png',{type:'image/png'})})).rejects.toThrow(/limit/i);
  const after=await getAllSnapshot();expect(after.media).toEqual(before.media);expect(after.collections).toEqual(before.collections);
});
