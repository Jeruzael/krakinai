import{beforeEach,it,expect}from'vitest';
import{unzipSync,zipSync,strFromU8,strToU8}from'fflate';
import{clearAllStoresForTesting,initializeDatabase,openDatabase,getAllSnapshot,saveMediaAsset}from'../storage/db';
import{previewChangeSet,applyApprovedChangeSet}from'../storage/changeSets';
import{exportFullBackupZip,restoreFullBackupZip,validateBackupZip}from'../storage/backup';
import{buildProjectExport,PROJECT_EXPORT_MEDIA_LIMIT}from'../domain/projectExport';
import{conversionScenario,conversionSourceText}from'./fixtures/recipeConversionFixture';
import{ENSEMBLE_TEST_PNG_BASE64}from'./fixtures/ensembleStorageFixture';
import{canonicalStringify}from'../domain/changeSetCanonical';
const hash=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
beforeEach(async()=>{await clearAllStoresForTesting();await initializeDatabase();const{state}=await conversionScenario(),db=await openDatabase();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['assets','scenes','collections'],'readwrite');for(const key of['assets','scenes','collections']as const)for(const r of state[key])tx.objectStore(key).put(r);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)});});
async function seedConverted(){
 const png=Uint8Array.from(atob(ENSEMBLE_TEST_PNG_BASE64),c=>c.charCodeAt(0)),media=await saveMediaAsset({filename:'synthetic-b3-valid.png',mimeType:'image/png',blob:new Blob([png],{type:'image/png'})});
 const state=await getAllSnapshot(),env=state.assets.find(a=>a.id==='environment')!;env.mediaLinks=[{mediaId:media.id,role:'sample',altText:'Synthetic illustrative guide',order:0}];
 const db=await openDatabase();await new Promise<void>(resolve=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(env);tx.oncomplete=()=>resolve()});
 const f=await conversionScenario();f.input.operations[0].conversion.mappings.push({id:'references',target:{kind:'references'},assessment:'suggested'});const p=await previewChangeSet(f.input,f.approval);expect(p.plan.findings.filter(f=>f.severity==='blocking')).toEqual([]);
 const receipt=await applyApprovedChangeSet(p,p.approvedDigest);return{receipt,media};
}
it('round trips exact original/converted scenes, provenance, receipts, associations and valid PNG hashes',async()=>{
 const{media}=await seedConverted(),before=await getAllSnapshot(),oldHash=await hash(await media.blob.arrayBuffer()),zip=await exportFullBackupZip();expect((await validateBackupZip(zip)).valid).toBe(true);
 await restoreFullBackupZip(zip);const after=await getAllSnapshot();expect(canonicalStringify(after.scenes)).toBe(canonicalStringify(before.scenes));expect(after.preferences.aiImports).toEqual(before.preferences.aiImports);
 expect(after.scenes.find(s=>s.id==='direct-source')!.outputs.full).toBe(conversionSourceText);expect(await hash(await after.media[0].blob.arrayBuffer())).toBe(oldHash);
});
it.each(['version','hash','target','duplicate row'])('rejects malformed conversion provenance (%s) before replacement',async kind=>{
 await seedConverted();const files=unzipSync(await exportFullBackupZip()),manifest=JSON.parse(strFromU8(files['manifest.json'])),scene=manifest.scenes.find((s:any)=>s.conversionProvenance);
 if(kind==='version')scene.conversionProvenance.version=2;
 if(kind==='hash')scene.conversionProvenance.sourceTextSha256='invalid';
 if(kind==='target')scene.conversionProvenance.mappings[0].target={kind:'path',path:'__proto__.approved'};
 if(kind==='duplicate row')scene.conversionProvenance.mappings.push(scene.conversionProvenance.mappings[0]);
 files['manifest.json']=strToU8(JSON.stringify(manifest));const bad=zipSync(files),before=await getAllSnapshot();expect((await validateBackupZip(bad)).valid).toBe(false);await expect(restoreFullBackupZip(bad)).rejects.toThrow(/conversion|mapping|provenance|field|version/i);expect(await getAllSnapshot()).toEqual(before);
});
it('allows standalone converted provenance without requiring the original scene in the restored library',async()=>{
 const{receipt}=await seedConverted(),files=unzipSync(await exportFullBackupZip()),manifest=JSON.parse(strFromU8(files['manifest.json'])),newId=receipt.idMappings.converted.id;
 manifest.scenes=manifest.scenes.filter((s:any)=>s.id!== 'direct-source');
 for(const c of manifest.collections){c.members=c.members.filter((m:any)=>m.id!=='direct-source');if(c.project)for(const shot of c.project.shots){shot.takeSceneIds=shot.takeSceneIds.filter((id:string)=>id!=='direct-source');if(shot.selectedSceneId==='direct-source')shot.selectedSceneId=newId}}
 files['manifest.json']=strToU8(JSON.stringify(manifest));const independent=zipSync(files);expect((await validateBackupZip(independent)).valid).toBe(true);await restoreFullBackupZip(independent);const after=await getAllSnapshot();expect(after.scenes).toHaveLength(1);expect(after.scenes[0].conversionProvenance?.sourceSceneId).toBe('direct-source');
});
it('exports frozen conversion provenance and every selected reference under the unchanged 128 MiB Project allowance',async()=>{
 await seedConverted();const state=await getAllSnapshot(),project=state.collections[0];expect(PROJECT_EXPORT_MEDIA_LIMIT).toBe(128*1024*1024);
 const converted=state.scenes.find(s=>s.conversionProvenance)!;const exportProject=structuredClone(project);exportProject.project!.shots[0].selectedSceneId=converted.id;
 const result=await buildProjectExport(exportProject,state);expect(result.bytes.length).toBeGreaterThan(0);const files=unzipSync(result.bytes),shot=result.manifest.shots[0];
 expect(shot.selectedTake?.conversionProvenance).toEqual(converted.conversionProvenance);expect(result.manifest.associations.map(a=>a.mediaId)).toEqual(converted.referencePack!.entries.map(e=>e.mediaId));
 expect(strFromU8(files[shot.files!.prompt])).toBe(converted.outputs.full);expect(strFromU8(files[shot.files!.structured!])).toBe(converted.outputs.structured);expect(strFromU8(files[shot.files!.compact!])).toBe(converted.outputs.compact);
});
