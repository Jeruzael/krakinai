import { describe, expect, it, vi } from 'vitest';
import type { Collection, SavedScene } from '../types/domain';
import type { LibrarySnapshot } from '../storage/db';
import { planProjectExport, buildProjectExport } from '../domain/projectExport';
import { unzipSync, strFromU8 } from 'fflate';

const scene = {id:'scene-1',title:'A scene',slots:{},settings:{},outputs:{full:'Exact\n😀',structured:'Structured',compact:'Compact'},references:[],resultMediaLinks:[],dialogue:{speaker:'Aya',line:'Mabuhay\n😀'}} as unknown as SavedScene;
const collection = {id:'project-1',name:'A Project',description:'Story',members:[{type:'scene',id:scene.id,addedAt:'2026-01-01'}],project:{version:1,revision:1,shots:[{id:'shot-1',order:0,code:'01',title:'Intro',takeSceneIds:[scene.id],selectedSceneId:scene.id,status:'prompt_ready'}]}} as Collection;
const snapshot = {scenes:[scene],media:[],assets:[],variants:[],drafts:[],collections:[collection],templates:[]} as unknown as LibrarySnapshot;

describe('project export', () => {
 it('plans ordered selected takes and preserves exact authored outputs in a ZIP', async () => {
  expect(planProjectExport(collection,snapshot).associations).toEqual([]);
  const result=await buildProjectExport(collection,snapshot);
  expect(result.manifest.schema).toBe('krakinai.project-export.v1');
  expect(result.manifest.shots[0].selectedSceneId).toBe(scene.id);
  expect(result.bytes.length).toBeGreaterThan(0);
  const files=unzipSync(result.bytes);
  for(const path of Object.values(result.manifest.documents)) expect(files[path]).toBeDefined();
  for(const path of Object.values(result.manifest.shots[0].files!)) expect(files[path]).toBeDefined();
  expect(strFromU8(files[Object.keys(files).find(path=>path.endsWith('/prompt.txt'))!])).toBe('Exact\n😀');
  expect(strFromU8(files[Object.keys(files).find(path=>path.endsWith('/structured.txt'))!])).toBe('Structured');
  expect(strFromU8(files[Object.keys(files).find(path=>path.endsWith('/compact.txt'))!])).toBe('Compact');
  expect(strFromU8(files[Object.keys(files).find(path=>path.endsWith('/dialogue-script.md'))!])).toContain('Mabuhay\n😀');
 });
 it('warns for planned and unavailable selected takes',()=>{
  const planned={...collection,project:{...collection.project!,shots:[{...collection.project!.shots[0],selectedSceneId:undefined,status:'planned' as const}]}};
  expect(planProjectExport(planned,snapshot).warnings.join(' ')).toMatch(/no selected take.*planned shot/);
  const missing={...collection,project:{...collection.project!,shots:[{...collection.project!.shots[0],selectedSceneId:'absent',takeSceneIds:['absent']}]}};
  expect(planProjectExport(missing,snapshot).warnings.join(' ')).toContain('selected scene absent is missing');
 });
 it('requires explicit exclusion for a missing selected binary and records it',async()=>{
  const withReference={...scene,references:[{mediaId:'gone',role:'reference' as const,altText:'lost',order:0}]};
  const data={...snapshot,scenes:[withReference]};
  const id=planProjectExport(collection,data).associations[0].id;
  await expect(buildProjectExport(collection,data)).rejects.toThrow('Missing selected original media');
  const result=await buildProjectExport(collection,data,{excludedAssociationIds:[id]});
  expect(result.manifest.associations[0]).toMatchObject({id,excluded:true,missing:true});
 });
 it('rejects oversized metadata without allocating giant blobs',async()=>{
  const huge={...snapshot,media:[{id:'media-1',filename:'original.png',safeFilename:'original.png',mimeType:'image/png',byteSize:129*1024*1024,blob:new Blob(['x'])}]};
  const withReference={...scene,references:[{mediaId:'media-1',role:'reference' as const,altText:'large',order:0}]};
  const data={...huge,scenes:[withReference]} as LibrarySnapshot;
  await expect(buildProjectExport(collection,data)).rejects.toThrow('128 MiB');
 });
 it('stops cancelled exports before ZIP construction',async()=>{
  const controller=new AbortController();controller.abort();
  await expect(buildProjectExport(collection,snapshot,{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
 });
 it('deduplicates binary bytes while retaining roles, names and SHA-256',async()=>{
  const blob=new Blob(['same binary'],{type:'image/png'});
  const media={id:'media-1',filename:'original.png',safeFilename:'original.png',mimeType:'image/png',byteSize:blob.size,blob};
  const withReference={...scene,references:[{mediaId:'media-1',role:'reference' as const,altText:'one',order:0,filename:'first.png',namesCaptured:true as const},{mediaId:'media-1',role:'sample' as const,altText:'two',order:1,filename:'second.png',namesCaptured:true as const}]};
  const data={...snapshot,scenes:[withReference],media:[media]} as LibrarySnapshot;
  const result=await buildProjectExport(collection,data);
  const files=unzipSync(result.bytes);const binaryPaths=Object.keys(files).filter(path=>path.includes('/media/'));
  expect(binaryPaths).toHaveLength(1);
  expect(strFromU8(files[binaryPaths[0]])).toBe('same binary');
  expect(result.manifest.associations).toHaveLength(2);
  expect(result.manifest.associations.map(a=>a.requestedFilename)).toEqual(['first.png','second.png']);
  expect(result.manifest.associations[0].sha256).toBe(result.manifest.associations[1].sha256);
 });
 it('honors an explicit pack without adding unselected result media',async()=>{
  const image=new Blob(['chosen'],{type:'image/png'}),video=new Blob(['unselected'],{type:'video/mp4'});
  const chosen={id:'chosen',filename:'chosen.png',safeFilename:'chosen.png',mimeType:'image/png',byteSize:image.size,blob:image};
  const unselected={id:'unselected',filename:'video.mp4',safeFilename:'video.mp4',mimeType:'video/mp4',byteSize:video.size,blob:video};
  const withPack={...scene,referencePack:{version:1 as const,entries:[{associationId:'chosen-one',mediaId:'chosen',sourceSlot:'character' as const,sourceId:'asset-1',sourceTitle:'A',role:'reference' as const,altText:'',purpose:'identity' as const,order:0}]},resultMediaLinks:[{mediaId:'unselected',role:'result' as const,altText:'',order:0}]};
  const data={...snapshot,scenes:[withPack],media:[chosen,unselected]} as LibrarySnapshot;
  const result=await buildProjectExport(collection,data);
  expect(result.manifest.associations.map(a=>a.mediaId)).toEqual(['chosen']);
  expect(Object.keys(unzipSync(result.bytes)).filter(path=>path.includes('/media/'))).toHaveLength(1);
 });
 it('checks actual blob size even when byteSize understates it',async()=>{
  const actual=new Blob(['oversize']);Object.defineProperty(actual,'size',{value:129*1024*1024});
  const media={id:'m',filename:'m.png',safeFilename:'m.png',mimeType:'image/png',byteSize:1,blob:actual};
  const withReference={...scene,references:[{mediaId:'m',role:'reference' as const,altText:'',order:0}]};
  await expect(buildProjectExport(collection,{...snapshot,scenes:[withReference],media:[media]} as LibrarySnapshot)).rejects.toThrow('actual media size');
 });
 it('rejects aggregate actual media over the limit before reading any binary',async()=>{
  const first=new Blob(['a']),second=new Blob(['b']);
  const firstRead=vi.fn(),secondRead=vi.fn();
  Object.defineProperty(first,'size',{value:70*1024*1024});Object.defineProperty(second,'size',{value:70*1024*1024});
  Object.defineProperty(first,'arrayBuffer',{value:firstRead});Object.defineProperty(second,'arrayBuffer',{value:secondRead});
  const media=[{id:'a',filename:'a.png',safeFilename:'a.png',mimeType:'image/png',byteSize:1,blob:first},{id:'b',filename:'b.png',safeFilename:'b.png',mimeType:'image/png',byteSize:1,blob:second}];
  const withReference={...scene,references:media.map((m,i)=>({mediaId:m.id,role:'reference' as const,altText:'',order:i}))};
  await expect(buildProjectExport(collection,{...snapshot,scenes:[withReference],media} as LibrarySnapshot)).rejects.toThrow('actual media size');
  expect(firstRead).not.toHaveBeenCalled();expect(secondRead).not.toHaveBeenCalled();
 });
 it('does not traverse unrelated scene content',async()=>{
  const unrelated={id:'unrelated'} as SavedScene;
  Object.defineProperty(unrelated,'outputs',{get(){throw new Error('Unrelated text was traversed');}});
  await expect(buildProjectExport(collection,{...snapshot,scenes:[scene,unrelated]})).resolves.toHaveProperty('manifest.schema','krakinai.project-export.v1');
 });
 it('keeps Unicode ZIP path components below 240 UTF-8 bytes',async()=>{
  const astral='𠀀'.repeat(48);const blob=new Blob(['x'],{type:'image/png'});
  const media={id:'m'.repeat(100),filename:`${astral}.png`,safeFilename:`${astral}.png`,mimeType:'image/png',byteSize:blob.size,blob};
  const unicodeScene={...scene,references:[{mediaId:media.id,role:'reference' as const,altText:'',order:0}]};
  const unicodeProject={...collection,id:'p'.repeat(100),name:astral,project:{...collection.project!,shots:[{...collection.project!.shots[0],id:'s'.repeat(100),code:astral,title:astral}]}};
  const result=await buildProjectExport(unicodeProject,{...snapshot,scenes:[unicodeScene],media:[media]} as LibrarySnapshot);
  for(const path of Object.keys(unzipSync(result.bytes))) for(const component of path.split('/')) expect(new TextEncoder().encode(component).length).toBeLessThanOrEqual(240);
 });
 it('uses frozen saved identity and pack provenance in Generation JSON',async()=>{
  const anchor={text:'Frozen Aya',approvedMasterIdentityRevision:1,approvedAt:'2026-01-01T00:00:00Z'};
  const saved={...scene,slots:{character:{slot:'character' as const,sourceType:'asset' as const,sourceId:'aya',sourceRevision:1,sourceTitle:'Aya',promptText:'Old master',mediaLinks:[]}},generation:{identitySource:'approved_anchor' as const,anchor},referencePack:{version:1 as const,entries:[{associationId:'pick-1',mediaId:'missing',sourceSlot:'character' as const,sourceId:'aya',sourceTitle:'Aya old',role:'reference' as const,altText:'portrait',purpose:'identity' as const,order:0,exportFilename:'frozen.png',filename:'original.png',namesCaptured:true as const}]}};
  const data={...snapshot,scenes:[saved],assets:[{id:'aya',promptText:'New master'}]} as unknown as LibrarySnapshot;
  const id=planProjectExport(collection,data).associations[0].id;
  const result=await buildProjectExport(collection,data,{includeGenerationJson:true,excludedAssociationIds:[id]});
  const generationPath=Object.keys(unzipSync(result.bytes)).find(path=>path.endsWith('/generation.json'))!;
  const generation=JSON.parse(strFromU8(unzipSync(result.bytes)[generationPath]));
  expect(generation.character.description).toBe('Frozen Aya');
  expect(generation.references[0].associationId).toBe('pick-1');
  expect(result.manifest.associations[0]).toMatchObject({sourceId:'aya',sourceTitle:'Aya old',capturedExportFilename:'frozen.png',requestedFilename:'frozen.png',excluded:true});
 });
 it('uses one captured source snapshot during asynchronous media reads',async()=>{
  const blob=new Blob(['x'],{type:'image/png'});const media={id:'m',filename:'m.png',safeFilename:'m.png',mimeType:'image/png',byteSize:blob.size,blob};
  const mutableScene={...scene,references:[{mediaId:'m',role:'reference' as const,altText:'',order:0}]};
  const mutableProject={...collection,project:{...collection.project!,cast:[{characterId:'aya',name:'Original'}]}};
  const result=await buildProjectExport(mutableProject,{...snapshot,scenes:[mutableScene],media:[media]} as LibrarySnapshot,{onProgress:stage=>{if(stage.startsWith('Reading media')){mutableProject.project.cast![0].name='Changed';mutableScene.outputs.full='Changed';}}});
  expect(result.manifest.cast[0].name).toBe('Original');
  const files=unzipSync(result.bytes);expect(strFromU8(files[Object.keys(files).find(path=>path.endsWith('/prompt.txt'))!])).toBe('Exact\n😀');
 });
 it('rejects more than 2000 entries without generating ZIP text',async()=>{
  const scenes=Array.from({length:500},(_,i)=>({...scene,id:`scene-${i}`}));
  const many={...collection,project:{...collection.project!,shots:scenes.map((item,i)=>({id:`shot-${i}`,order:i,code:String(i),title:'',takeSceneIds:[item.id],selectedSceneId:item.id,status:'prompt_ready' as const}))}};
  expect(planProjectExport(many,{...snapshot,scenes}).estimatedEntries).toBeGreaterThan(2000);
  await expect(buildProjectExport(many,{...snapshot,scenes})).rejects.toThrow('2000 ZIP entries');
 });
 it('makes unique safe archive paths for hostile and case-colliding original names',async()=>{
  const a=new Blob(['a'],{type:'image/png'}),b=new Blob(['b'],{type:'image/png'});
  const media=[{id:'a',filename:'../CON.png',safeFilename:'../CON.png',mimeType:'image/png',byteSize:a.size,blob:a},{id:'b',filename:'con.png',safeFilename:'con.png',mimeType:'image/png',byteSize:b.size,blob:b}];
  const withRefs={...scene,references:media.map((m,i)=>({mediaId:m.id,role:'reference' as const,altText:'',order:i}))};
  const result=await buildProjectExport(collection,{...snapshot,scenes:[withRefs],media} as LibrarySnapshot);
  const paths=Object.keys(unzipSync(result.bytes));
  expect(new Set(paths.map(path=>path.toLowerCase())).size).toBe(paths.length);
  expect(paths.every(path=>!path.split('/').includes('..'))).toBe(true);
  expect(result.manifest.associations[0].originalFilename).toBe('../CON.png');
 });
 it('terminates asynchronous compression when cancelled',async()=>{
  const blob=new Blob([new Uint8Array(256_000).map((_,i)=>i%251)],{type:'image/png'});
  const media={id:'large',filename:'large.png',safeFilename:'large.png',mimeType:'image/png',byteSize:blob.size,blob};
  const withReference={...scene,references:[{mediaId:'large',role:'reference' as const,altText:'',order:0}]};
  const controller=new AbortController();
  await expect(buildProjectExport(collection,{...snapshot,scenes:[withReference],media:[media]} as LibrarySnapshot,{signal:controller.signal,onProgress:stage=>{if(stage==='Compressing project ZIP')setTimeout(()=>controller.abort(),0);}})).rejects.toMatchObject({name:'AbortError'});
 });
 it('fails without a ZIP when asynchronous binary reading errors',async()=>{
  const blob=new Blob(['x']);Object.defineProperty(blob,'arrayBuffer',{value:()=>Promise.reject(new Error('read failed'))});
  const media={id:'broken',filename:'broken.png',safeFilename:'broken.png',mimeType:'image/png',byteSize:blob.size,blob};
  const withReference={...scene,references:[{mediaId:'broken',role:'reference' as const,altText:'',order:0}]};
  await expect(buildProjectExport(collection,{...snapshot,scenes:[withReference],media:[media]} as LibrarySnapshot)).rejects.toThrow('read failed');
 });
});
