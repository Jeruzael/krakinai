import {beforeEach,expect,it} from 'vitest';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {clearAllStoresForTesting,initializeDatabase,getAllSnapshot} from '../storage/db';
import {exportFullBackupZip,validateBackupZip,restoreFullBackupZip} from '../storage/backup';
beforeEach(async()=>{await clearAllStoresForTesting();await initializeDatabase();});
async function archive(change:(manifest:any)=>void){const files=unzipSync(await exportFullBackupZip());const manifest=JSON.parse(strFromU8(files['manifest.json']));change(manifest);files['manifest.json']=strToU8(JSON.stringify(manifest));return zipSync(files);}
const base=(m:any)=>{m.scenes=[{id:'s1',title:'One',slots:{},settings:{durationSeconds:5},references:[],resultMediaLinks:[]}];m.collections=[{id:'c',name:'Film',description:'',members:[{type:'scene',id:'s1',addedAt:'now'}],createdAt:'now',updatedAt:'now',project:{version:1,revision:2,shots:[{id:'shot',order:0,code:'03A',title:'Opening',takeSceneIds:['s1'],selectedSceneId:'s1',status:'reviewed'}]}}];};
it('roundtrips a valid project through full backup restore',async()=>{const bytes=await archive(base);expect((await validateBackupZip(bytes)).valid).toBe(true);await restoreFullBackupZip(bytes);expect((await getAllSnapshot()).collections[0].project?.shots[0].code).toBe('03A');});
it.each([
 ['duplicate shot',(m:any)=>m.collections[0].project.shots.push({...m.collections[0].project.shots[0],order:1})],
 ['missing take',(m:any)=>m.collections[0].project.shots[0].takeSceneIds=['missing']],
 ['selected outside takes',(m:any)=>m.collections[0].project.shots[0].selectedSceneId='other'],
 ['stale members',(m:any)=>m.collections[0].members=[]],
 ['bad duration',(m:any)=>m.collections[0].project.shots[0].plannedDurationSeconds=Infinity],
 ['invalid continuity notes',(m:any)=>m.collections[0].project.shots[0].continuityNotes={text:'bad'}],
])('rejects project %s before replacing library',async(_,change)=>{const before=await getAllSnapshot();const bytes=await archive(m=>{base(m);change(m);});expect((await validateBackupZip(bytes)).valid).toBe(false);await expect(restoreFullBackupZip(bytes)).rejects.toThrow();expect(await getAllSnapshot()).toEqual(before);});
it('rejects malformed saved project target lineage before replacement',async()=>{
  const bytes=await archive(m=>{base(m);m.scenes[0].saveProjectTarget={collectionId:'c',shotId:42};});
  expect((await validateBackupZip(bytes)).valid).toBe(false);
});
