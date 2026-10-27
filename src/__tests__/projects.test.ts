import {beforeEach,expect,it,vi} from 'vitest';
import {clearAllStoresForTesting,createCollection,getAllSnapshot,saveSceneDraft,saveSceneFromDraft,addMemberToCollection,removeMemberFromCollection,deleteSavedScene,deletePromptAsset} from '../storage/db';
import {initializeProject,addProjectShot,addProjectTake,removeProjectTake,removeProjectShot,reorderProjectShots,updateProjectShot,selectProjectTake} from '../storage/projects';

beforeEach(clearAllStoresForTesting);
const makeDraft=()=>saveSceneDraft({title:'Take',slots:{character:{slot:'character',sourceType:'asset',sourceId:'aya',sourceRevision:1,sourceTitle:'Aya',promptText:'Aya.',mediaLinks:[]},environment:{slot:'environment',sourceType:'asset',sourceId:'env',sourceRevision:1,sourceTitle:'Room',promptText:'Room.',mediaLinks:[]},action:{slot:'action',sourceType:'asset',sourceId:'act',sourceRevision:1,sourceTitle:'Walk',promptText:'Walk.',mediaLinks:[]}},extraRequiredSlots:[],sceneInstructions:'',settings:{durationSeconds:5},manualOutputs:{},resultMediaLinks:[],reviewNotes:'',reviewStatus:'unreviewed'});

it('initializes legacy members and serializes simultaneous narrow changes',async()=>{
  const draft=await makeDraft();const scene=await saveSceneFromDraft(draft.id);const c=await createCollection({name:'Film'});await addMemberToCollection({collectionId:c.id,memberType:'scene',memberId:scene.id});
  const initial=await initializeProject(c.id);expect(initial.project?.shots[0].id).toBe(`${c.id}:legacy:${scene.id}`);
  const shotId=initial.project!.shots[0].id;
  await Promise.all([updateProjectShot({collectionId:c.id,shotId,patch:{status:'reviewed'}}),addProjectShot({collectionId:c.id,title:'Insert'})]);
  const saved=(await getAllSnapshot()).collections.find(x=>x.id===c.id)!;
  expect(saved.project?.shots).toHaveLength(2);expect(saved.project?.shots[0].status).toBe('reviewed');expect(saved.project?.revision).toBe(2);
  expect(saved.members.filter(m=>m.type==='scene').map(m=>m.id)).toEqual([scene.id]);
});

it('rejects stale reorder and invalid selected take without altering collection',async()=>{
  const c=await createCollection({name:'Film'});const first=await addProjectShot({collectionId:c.id});const shotId=first.project!.shots[0].id;
  await expect(addProjectTake({collectionId:c.id,shotId,sceneId:'missing'})).rejects.toThrow(/scene/i);
  await addProjectShot({collectionId:c.id});
  await expect(reorderProjectShots({collectionId:c.id,orderedShotIds:first.project!.shots.map(x=>x.id),expectedRevision:first.project!.revision})).rejects.toThrow(/revision|conflict/i);
  expect((await getAllSnapshot()).collections.find(x=>x.id===c.id)?.project?.shots).toHaveLength(2);
});

it('attaches a new saved scene to a shot atomically and binds retry token to target',async()=>{
  const draft=await makeDraft();const c=await createCollection({name:'Film'});const shot=await addProjectShot({collectionId:c.id});const shotId=shot.project!.shots[0].id;
  const target={collectionId:c.id,shotId};const scene=await saveSceneFromDraft(draft.id,{requestId:'request',projectTarget:target});
  expect(await saveSceneFromDraft(draft.id,{requestId:'request',projectTarget:target})).toEqual(scene);
  await expect(saveSceneFromDraft(draft.id,{requestId:'request',projectTarget:{collectionId:c.id,shotId:'other'}})).rejects.toThrow(/request/i);
  const saved=(await getAllSnapshot()).collections.find(x=>x.id===c.id)!;
  expect(saved.project?.shots[0].takeSceneIds).toEqual([scene.id]);expect(saved.project?.shots[0].selectedSceneId).toBe(scene.id);expect(saved.members.filter(x=>x.type==='scene').map(x=>x.id)).toEqual([scene.id]);
  await deleteSavedScene(scene.id);
  const after=(await getAllSnapshot()).collections.find(x=>x.id===c.id)!;
  expect(after.project?.shots[0].takeSceneIds).toEqual([]);expect(after.project?.shots[0].selectedSceneId).toBeUndefined();expect(after.members.filter(x=>x.type==='scene')).toEqual([]);
});

it('preserves project edits when asset deletion races from another transaction',async()=>{
  const c=await createCollection({name:'Film'});const p=await addProjectShot({collectionId:c.id});const shotId=p.project!.shots[0].id;
  await Promise.all([updateProjectShot({collectionId:c.id,shotId,patch:{status:'final'}}),deletePromptAsset('unused')]);
  expect((await getAllSnapshot()).collections.find(x=>x.id===c.id)?.project?.shots[0].status).toBe('final');
});

it('removing one association keeps a shared scene member until its final shot is removed',async()=>{
  const draft=await makeDraft();const scene=await saveSceneFromDraft(draft.id);const c=await createCollection({name:'Film'});
  const a=await addProjectShot({collectionId:c.id,sceneId:scene.id});const b=await addProjectShot({collectionId:c.id,sceneId:scene.id});
  await removeProjectTake({collectionId:c.id,shotId:a.project!.shots[0].id,sceneId:scene.id});
  expect((await getAllSnapshot()).collections.find(x=>x.id===c.id)?.members.filter(m=>m.type==='scene').map(m=>m.id)).toEqual([scene.id]);
  await removeProjectTake({collectionId:c.id,shotId:b.project!.shots[1].id,sceneId:scene.id});
  expect((await getAllSnapshot()).collections.find(x=>x.id===c.id)?.members.filter(m=>m.type==='scene')).toEqual([]);
});

it('preserves a status write from a second IndexedDB connection during shot insertion',async()=>{
  const c=await createCollection({name:'Film'});const initial=await addProjectShot({collectionId:c.id});const shotId=initial.project!.shots[0].id;
  const second=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('krakinai_prompt_library_db',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{
    const independent=(async()=>{
      const tx=second.transaction('collections','readwrite');const store=tx.objectStore('collections');
      const current=await new Promise<any>((resolve,reject)=>{const r=store.get(c.id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      current.project.shots[0].status='reviewed';current.project.revision++;store.put(current);
      await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});
    })();
    await Promise.all([independent,addProjectShot({collectionId:c.id,title:'Next'})]);
    const saved=(await getAllSnapshot()).collections.find(x=>x.id===c.id)!;
    expect(saved.project?.shots).toHaveLength(2);expect(saved.project?.shots.find(x=>x.id===shotId)?.status).toBe('reviewed');
  }finally{second.close();}
});

it('makes an empty shot planned after final take removal while preserving status with another take',async()=>{
  const draft=await makeDraft();const one=await saveSceneFromDraft(draft.id);const two=await saveSceneFromDraft(draft.id,{duplicateDecision:'take',duplicateOfSceneId:one.id});
  const c=await createCollection({name:'Film'});const initial=await addProjectShot({collectionId:c.id,sceneId:one.id});const shotId=initial.project!.shots[0].id;
  await addProjectTake({collectionId:c.id,shotId,sceneId:two.id});await updateProjectShot({collectionId:c.id,shotId,patch:{status:'final'}});
  const afterOne=await removeProjectTake({collectionId:c.id,shotId,sceneId:one.id});
  expect(afterOne.project?.shots[0].status).toBe('final');expect(afterOne.project?.shots[0].selectedSceneId).toBe(two.id);
  const empty=await removeProjectTake({collectionId:c.id,shotId,sceneId:two.id});
  expect(empty.project?.shots[0]).toMatchObject({status:'planned',takeSceneIds:[]});
});

it('turns final empty shots into planned placeholders on membership removal and saved-scene deletion',async()=>{
  const draft=await makeDraft();const one=await saveSceneFromDraft(draft.id);const two=await saveSceneFromDraft(draft.id,{duplicateDecision:'take',duplicateOfSceneId:one.id});
  const c=await createCollection({name:'Film'});const a=await addProjectShot({collectionId:c.id,sceneId:one.id});const b=await addProjectShot({collectionId:c.id,sceneId:two.id});
  await updateProjectShot({collectionId:c.id,shotId:a.project!.shots[0].id,patch:{status:'final'}});
  await updateProjectShot({collectionId:c.id,shotId:b.project!.shots[1].id,patch:{status:'reviewed'}});
  await removeMemberFromCollection({collectionId:c.id,memberType:'scene',memberId:one.id});await deleteSavedScene(two.id);
  const saved=(await getAllSnapshot()).collections.find(x=>x.id===c.id)!;
  expect(saved.project?.shots.map(s=>[s.status,s.takeSceneIds])).toEqual([['planned',[]],['planned',[]]]);
});

it('does not save a scene when its project target shot was deleted',async()=>{
  const draft=await makeDraft();const c=await createCollection({name:'Film'});const added=await addProjectShot({collectionId:c.id});const shotId=added.project!.shots[0].id;
  await removeProjectShot({collectionId:c.id,shotId});const before=await getAllSnapshot();
  await expect(saveSceneFromDraft(draft.id,{projectTarget:{collectionId:c.id,shotId}})).rejects.toThrow(/target project shot/i);
  const after=await getAllSnapshot();expect(after.scenes).toEqual(before.scenes);expect(after.collections).toEqual(before.collections);
});

it('rolls back collection take attachment when scene put fails synchronously',async()=>{
  const draft=await makeDraft();const c=await createCollection({name:'Film'});const added=await addProjectShot({collectionId:c.id});const shotId=added.project!.shots[0].id;
  const before=await getAllSnapshot();const original=IDBObjectStore.prototype.put;let collectionQueued=false;
  const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value:any,key?:IDBValidKey){
    if(this.name==='collections') collectionQueued=true;
    if(this.name==='scenes')throw new DOMException(collectionQueued?'Storage full':'Scene put preceded target update','QuotaExceededError');
    return key===undefined?original.call(this,value):original.call(this,value,key);
  });
  try{await expect(saveSceneFromDraft(draft.id,{projectTarget:{collectionId:c.id,shotId}})).rejects.toThrow(/Storage full/);}finally{spy.mockRestore();}
  expect(collectionQueued).toBe(true);
  const after=await getAllSnapshot();expect(after.scenes).toEqual(before.scenes);expect(after.collections).toEqual(before.collections);
});
