import {beforeEach,expect,it,vi} from 'vitest';
import {addProjectShot} from '../storage/projects';
import {clearAllStoresForTesting,createCollection,getAllSnapshot,openDatabase} from '../storage/db';
import {bulkUpdateProjectShots,bulkAddScenesToCollection,bulkAssignSceneStatus,bulkDeleteSavedScenes,bulkSetScenesArchived,formatSelectedPrompts} from '../storage/projectBulk';
import {exportSnapshotBackupZip,validateBackupZip} from '../storage/backup';
import type {SavedScene} from '../types/domain';

beforeEach(clearAllStoresForTesting);
const scene=(id:string):SavedScene=>({id,title:`Title ${id}`,slots:{},extraRequiredSlots:[],sceneInstructions:'',settings:{durationSeconds:5},outputs:{full:`完整 ${id}\nsecond line`,structured:`S ${id}`,compact:`C ${id}`},manualOutputs:{},references:[],resultMediaLinks:[],reviewNotes:'',reviewStatus:'unreviewed',revision:1,createdAt:'2025-01-01',updatedAt:'2025-01-01'});
async function putScenes(...scenes:SavedScene[]){const db=await openDatabase();const tx=db.transaction('scenes','readwrite');for(const s of scenes)tx.objectStore('scenes').put(s);await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}
async function shots(){const c=await createCollection({name:'Film'});let latest=await addProjectShot({collectionId:c.id,title:'A'});latest=await addProjectShot({collectionId:c.id,title:'B'});latest=await addProjectShot({collectionId:c.id,title:'C'});latest=await addProjectShot({collectionId:c.id,title:'D'});return latest;}

it('moves a selected group one place while preserving its relative order and rejects stale order',async()=>{
 const c=await shots();const ids=c.project!.shots.map(s=>s.id);const moved=await bulkUpdateProjectShots({collectionId:c.id,shotIds:[ids[1],ids[2]],move:'down',expectedRevision:c.project!.revision});
 expect(moved.project!.shots.map(s=>s.id)).toEqual([ids[0],ids[3],ids[1],ids[2]]);
 expect(moved.project!.revision).toBe(c.project!.revision+1);
 await expect(bulkUpdateProjectShots({collectionId:c.id,shotIds:[ids[1]],move:'up',expectedRevision:c.project!.revision})).rejects.toThrow(/revision conflict/i);
 const restored=await bulkUpdateProjectShots({collectionId:c.id,shotIds:[ids[1],ids[2]],move:'up',expectedRevision:moved.project!.revision});
 expect(restored.project!.shots.map(s=>s.id)).toEqual(ids);
});

it('uses displayed order even when stored shot array is physically shuffled',async()=>{
 const c=await shots();const ids=c.project!.shots.map(s=>s.id);const db=await openDatabase();const tx=db.transaction('collections','readwrite');
 tx.objectStore('collections').put({...c,project:{...c.project!,shots:[c.project!.shots[2],c.project!.shots[0],c.project!.shots[1],c.project!.shots[3]]}});
 await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});
 const updated=await bulkUpdateProjectShots({collectionId:c.id,shotIds:[ids[1]],move:'down',expectedRevision:c.project!.revision});
 expect(updated.project!.shots.map(s=>s.id)).toEqual([ids[0],ids[2],ids[1],ids[3]]);
});

it('aborts an entire status update when one selected shot is missing',async()=>{
 const c=await shots();const before=await getAllSnapshot();
 await expect(bulkUpdateProjectShots({collectionId:c.id,shotIds:[c.project!.shots[0].id,'missing'],status:'final'})).rejects.toThrow(/shot/i);
 expect((await getAllSnapshot()).collections).toEqual(before.collections);
});

it('adds selected scenes once and preserves source scenes and independent project state',async()=>{
 const one=scene('one'),two=scene('two');await putScenes(one,two);
 const first=await createCollection({name:'First'}),second=await createCollection({name:'Second'});
 await bulkAddScenesToCollection({collectionId:first.id,sceneIds:[one.id]});
 const updated=await bulkAddScenesToCollection({collectionId:second.id,sceneIds:[one.id,two.id,one.id]});
 expect(updated.project!.shots.map(s=>s.takeSceneIds)).toEqual([[one.id],[two.id]]);
 expect((await getAllSnapshot()).collections.find(c=>c.id===first.id)?.project?.shots.map(s=>s.takeSceneIds)).toEqual([[one.id]]);
 expect((await getAllSnapshot()).scenes).toEqual([one,two]);
});

it('does not add any scene when one selected scene is unavailable',async()=>{
 const one=scene('one');await putScenes(one);const c=await createCollection({name:'Film'});const before=await getAllSnapshot();
 await expect(bulkAddScenesToCollection({collectionId:c.id,sceneIds:[one.id,'missing']})).rejects.toThrow(/saved scenes/i);
 expect((await getAllSnapshot()).collections).toEqual(before.collections);
});

it('assigns status only to matching shots in the chosen project',async()=>{
 const one=scene('one'),two=scene('two');await putScenes(one,two);const c=await createCollection({name:'Film'});
 await bulkAddScenesToCollection({collectionId:c.id,sceneIds:[one.id,two.id]});
 const changed=await bulkAssignSceneStatus({collectionId:c.id,sceneIds:[one.id],status:'final'});
 expect(changed.project!.shots.map(s=>s.status)).toEqual(['final','prompt_ready']);
 await expect(bulkAssignSceneStatus({collectionId:c.id,sceneIds:['missing'],status:'final'})).rejects.toThrow(/scene/i);
});

it('removes shot associations and incident transitions but retains source scenes',async()=>{
 const one=scene('one');await putScenes(one);const c=await createCollection({name:'Film'});let p=await addProjectShot({collectionId:c.id,sceneId:one.id});p=await addProjectShot({collectionId:c.id,sceneId:one.id});
 const db=await openDatabase();const tx=db.transaction('collections','readwrite');tx.objectStore('collections').put({...p,project:{...p.project!,transitions:[{id:'t',fromShotId:p.project!.shots[0].id,toShotId:p.project!.shots[1].id,type:'straight_cut',description:'',notes:''}]}});await new Promise<void>(r=>tx.oncomplete=()=>r());
 const result=await bulkUpdateProjectShots({collectionId:c.id,shotIds:[p.project!.shots[0].id],remove:true});
 expect(result.project!.transitions).toEqual([]);expect(result.members.filter(m=>m.type==='scene').map(m=>m.id)).toEqual([one.id]);expect((await getAllSnapshot()).scenes).toEqual([one]);
});

it('rolls back a bulk write on injected storage failure',async()=>{
 const c=await shots();const before=(await getAllSnapshot()).collections;const original=IDBObjectStore.prototype.put;
 const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value:any,key?:IDBValidKey){if(this.name==='collections')throw new DOMException('Storage full','QuotaExceededError');return key===undefined?original.call(this,value):original.call(this,value,key);});
 try{await expect(bulkUpdateProjectShots({collectionId:c.id,shotIds:c.project!.shots.slice(0,2).map(s=>s.id),status:'final'})).rejects.toThrow(/Storage full/);}finally{spy.mockRestore();}
 expect((await getAllSnapshot()).collections).toEqual(before);
});

it('exports exact full Unicode outputs without trimming and rejects oversized exports',()=>{
 const one=scene('一');one.outputs.full='  雪\n\nΩ  ';
 expect(formatSelectedPrompts([one])).toContain(one.outputs.full);
 const giant=scene('giant');giant.outputs.full='x'.repeat(17*1024*1024);
 expect(()=>formatSelectedPrompts([giant])).toThrow(/too large/i);
});

it('archives and unarchives selected scenes atomically while preserving project shot takes and immutable fields', async () => {
 const one = scene('one'), two = scene('two');
 await putScenes(one, two);
 const c = await createCollection({ name: 'Film' });
 await bulkAddScenesToCollection({ collectionId: c.id, sceneIds: [one.id, two.id] });

 const archived = await bulkSetScenesArchived({ sceneIds: [one.id, two.id], archived: true });
 expect(archived.every(s => typeof s.archivedAt === 'string' && Number.isFinite(Date.parse(s.archivedAt!)))).toBe(true);
 const snapAfterArchive = await getAllSnapshot();
 expect(snapAfterArchive.collections[0].project!.shots.map(s => s.selectedSceneId)).toEqual([one.id, two.id]);

 await expect(bulkSetScenesArchived({ sceneIds: [one.id, 'missing'], archived: false })).rejects.toThrow(/saved scenes/i);
 expect((await getAllSnapshot()).scenes.every(s => Boolean(s.archivedAt))).toBe(true);

 const unarchived = await bulkSetScenesArchived({ sceneIds: [one.id], archived: false });
 expect('archivedAt' in unarchived[0]).toBe(false);
 expect((await getAllSnapshot()).scenes.find(s => s.id === two.id)?.archivedAt).toBeDefined();
});

it('deletes multiple selected scenes atomically, unlinks multiple takes from the same shot, and aborts on missing scene', async () => {
 const one = scene('one'), two = scene('two'), three = scene('three');
 await putScenes(one, two, three);
 const c = await createCollection({ name: 'Film' });
 await addProjectShot({ collectionId: c.id, title: 'Shot 1', sceneId: one.id });
 const current = (await getAllSnapshot()).collections[0];
 const shot = current.project!.shots[0];
 const db = await openDatabase();
 const tx = db.transaction('collections', 'readwrite');
 tx.objectStore('collections').put({
   ...current,
   project: { ...current.project!, shots: [{ ...shot, takeSceneIds: [one.id, two.id], selectedSceneId: one.id }] },
   members: [{ type: 'scene', id: one.id, addedAt: '' }, { type: 'scene', id: two.id, addedAt: '' }],
 });
 await new Promise<void>(r => tx.oncomplete = () => r());

 await expect(bulkDeleteSavedScenes({ sceneIds: [one.id, 'missing'] })).rejects.toThrow(/saved scenes/i);
 expect((await getAllSnapshot()).scenes).toHaveLength(3);

 await bulkDeleteSavedScenes({ sceneIds: [one.id, two.id] });
 const after = await getAllSnapshot();
 expect(after.scenes.map(s => s.id)).toEqual([three.id]);
 expect(after.collections[0].project!.shots[0].takeSceneIds).toEqual([]);
 expect(after.collections[0].project!.shots[0].selectedSceneId).toBeUndefined();
 expect(after.collections[0].project!.shots[0].status).toBe('planned');
});

it('accepts valid archivedAt in backup archives and rejects invalid archivedAt', async () => {
 const one = scene('one');
 one.archivedAt = new Date().toISOString();
 await putScenes(one);
 const validZip = await exportSnapshotBackupZip(await getAllSnapshot());
 expect((await validateBackupZip(validZip)).valid).toBe(true);

 const invalidSnap = await getAllSnapshot();
 (invalidSnap.scenes[0] as any).archivedAt = 'not-a-valid-date';
 const invalidZip = await exportSnapshotBackupZip(invalidSnap);
 const result = await validateBackupZip(invalidZip);
 expect(result.valid).toBe(false);
 expect(result.error).toMatch(/archivedAt/i);
});
