import { expect, it } from 'vitest';
import { getProjectShots, getProjectRuntime, projectMembersFromShots, selectedSceneForShot } from '../domain/projectStoryboard';
import type { Collection, ProjectShot, SavedScene } from '../types/domain';

const collection: Collection = { id:'c', name:'Film', description:'', members:[{type:'asset',id:'a',addedAt:'old'},{type:'scene',id:'s2',addedAt:'old2'},{type:'scene',id:'missing',addedAt:'old3'},{type:'scene',id:'s1',addedAt:'old1'}],createdAt:'now',updatedAt:'now' };
const scene = (id:string,durationSeconds?:number) => ({id,title:id,settings:{durationSeconds}} as SavedScene);

it('derives legacy shots in member order without parsing scene titles and leaves missing links visible',()=>{
  const shots=getProjectShots(collection,[scene('s1',4),scene('s2')]);
  expect(shots.map(s=>[s.id,s.order,s.code,s.status,s.takeSceneIds])).toEqual([
    ['c:legacy:s2',0,'01','prompt_ready',['s2']],
    ['c:legacy:missing',1,'02','planned',['missing']],
    ['c:legacy:s1',2,'03','prompt_ready',['s1']],
  ]);
});

it('projects first occurrence takes and retains non-scene members and addedAt',()=>{
  const shots:ProjectShot[]=[{id:'x',order:0,code:'03A',title:'',takeSceneIds:['s1','s2'],selectedSceneId:'s2',status:'planned'},{id:'y',order:1,code:'04',title:'',takeSceneIds:['s1'],status:'planned'}];
  expect(projectMembersFromShots(collection,shots)).toEqual([{type:'asset',id:'a',addedAt:'old'},{type:'scene',id:'s1',addedAt:'old1'},{type:'scene',id:'s2',addedAt:'old2'}]);
  expect(selectedSceneForShot(shots[0],[scene('s1'),scene('s2')])?.id).toBe('s2');
});

it('counts unknown planned duration and does not guess eight seconds',()=>{
  const project={...collection,project:{version:1 as const,revision:0,shots:[{id:'x',order:0,code:'01',title:'',takeSceneIds:['s1'],selectedSceneId:'s1',status:'planned' as const},{id:'y',order:1,code:'02',title:'',takeSceneIds:[],status:'planned' as const,plannedDurationSeconds:3}]}};
  expect(getProjectRuntime(project,[scene('s1')])).toMatchObject({plannedSeconds:3,unknownShots:1,shotCount:2});
});
